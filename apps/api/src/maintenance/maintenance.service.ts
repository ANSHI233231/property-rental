import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { CreateMaintenanceRequestDto } from "./dto/create-maintenance-request.dto";
import type { AssignMaintenanceDto } from "./dto/assign-maintenance.dto";
import type { ResolveMaintenanceDto } from "./dto/resolve-maintenance.dto";
import type { DismissAlertDto } from "./dto/dismiss-alert.dto";
import type { JwtPayload } from "../auth/jwt.service";

// ---------------------------------------------------------------------------
// Safe select shape — no internal fields leaked
// ---------------------------------------------------------------------------

const REQUEST_SELECT = {
  id: true,
  unit_id: true,
  lease_id: true,
  raised_by_user_id: true,
  assigned_to_user_id: true,
  title: true,
  description: true,
  priority: true,
  status: true,
  resolution_notes: true,
  assigned_at: true,
  in_progress_at: true,
  resolved_at: true,
  closed_at: true,
  closed_by_user_id: true,
  created_at: true,
  updated_at: true,
} as const;

const ALERT_SELECT = {
  id: true,
  tenant_user_id: true,
  unit_id: true,
  month_key: true,
  request_count: true,
  triggered_at: true,
  dismissed_at: true,
  dismissed_by_user_id: true,
  dismiss_note: true,
  created_at: true,
} as const;

// ---------------------------------------------------------------------------
// Helper: convert UTC Date to YYYY-MM-DD string in Asia/Kolkata
// ---------------------------------------------------------------------------

function toISTDateStr(date: Date): string {
  // IST = UTC + 5:30
  const istMs = date.getTime() + (5 * 60 + 30) * 60 * 1000;
  return new Date(istMs).toISOString().slice(0, 10);
}

function toISTMonthKey(date: Date): string {
  return toISTDateStr(date).slice(0, 7); // YYYY-MM
}

// ---------------------------------------------------------------------------
// MaintenanceService
// ---------------------------------------------------------------------------

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // list — scoped by role
  // ---------------------------------------------------------------------------

  async list(
    actor: JwtPayload,
    query: {
      unitId?: string;
      propertyId?: string;
      status?: string;
      assignedToUserId?: string;
      scope?: string;
      cursor?: string;
      limit?: number;
    },
  ) {
    const limit = Math.min(query.limit ?? 20, 100);
    const where: Prisma.MaintenanceRequestWhereInput = {};

    if (actor.role === "TENANT") {
      // Tenant sees only their own requests
      where.raised_by_user_id = actor.sub;
    } else if (actor.role === "MAINTENANCE") {
      if (query.scope === "all-open") {
        // All open/assigned/in-progress across all properties
        where.status = { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] };
      } else {
        // Only their own assigned requests
        where.assigned_to_user_id = actor.sub;
      }
    } else if (actor.role === "PROPERTY_MANAGER") {
      // Scoped to their property's units
      const pm = await this.prisma.property.findFirst({
        where: { active_pm_id: actor.sub, deleted_at: null },
        select: { id: true },
      });
      if (!pm) {
        return { data: [], nextCursor: null };
      }
      where.unit = { property_id: pm.id };
      if (query.unitId) where.unit_id = query.unitId;
    }
    // ADMIN sees all — no extra filter

    if (actor.role === "ADMIN" || actor.role === "PROPERTY_MANAGER") {
      if (query.unitId) where.unit_id = query.unitId;
      if (query.assignedToUserId) where.assigned_to_user_id = query.assignedToUserId;
    }

    if (query.propertyId && actor.role === "ADMIN") {
      where.unit = { property_id: query.propertyId };
    }

    if (query.status) {
      where.status = query.status as Prisma.EnumMaintenanceStatusFilter;
    }

    const items = await this.prisma.maintenanceRequest.findMany({
      where,
      select: REQUEST_SELECT,
      orderBy: { created_at: "desc" },
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    let data = hasMore ? items.slice(0, limit) : items;
    const lastItem = data[data.length - 1];
    const nextCursor = hasMore && lastItem ? lastItem.id : null;

    // M-01: strip lease_id from MAINTENANCE all-open scope — no PII linkage needed
    if (actor.role === "MAINTENANCE" && query.scope === "all-open") {
      data = data.map((item) => ({ ...item, lease_id: null }));
    }

    return { data, nextCursor };
  }

  // ---------------------------------------------------------------------------
  // findOne — scoped by role
  // ---------------------------------------------------------------------------

  async findOne(id: string, actor: JwtPayload) {
    const req = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      select: {
        ...REQUEST_SELECT,
        unit: { select: { property_id: true } },
      },
    });
    if (!req) throw new NotFoundException("Maintenance request not found");

    await this.assertReadAccess(req, actor);

    // Strip the joined unit field from the response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { unit: _unit, ...rest } = req;
    return rest;
  }

  // ---------------------------------------------------------------------------
  // create — BL-16: MAINTENANCE blocked at controller; TENANT must have active lease
  // ---------------------------------------------------------------------------

  async create(dto: CreateMaintenanceRequestDto, actor: JwtPayload) {
    // Verify tenant has an active lease on the specified unit
    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
      select: { id: true, property_id: true },
    });
    if (!unit) throw new NotFoundException("Unit not found");

    let leaseId: string | null = null;

    if (actor.role === "TENANT") {
      // Tenant must have an active lease on this unit.
      // Two-step: find Tenant record for this user, then check LeaseTenant → Lease.
      const tenantRecord = await this.prisma.tenant.findUnique({
        where: { user_id: actor.sub },
        select: { id: true },
      });
      if (!tenantRecord) {
        throw new ForbiddenException({
          code: "NO_ACTIVE_LEASE_ON_UNIT",
          message: "You do not have an active lease on this unit.",
        });
      }
      const leaseTenant = await this.prisma.leaseTenant.findFirst({
        where: {
          tenant_id: tenantRecord.id,
          removed_at: null,
          lease: {
            unit_id: dto.unitId,
            status: "ACTIVE",
          },
        },
        select: { lease_id: true },
      });
      if (!leaseTenant) {
        throw new ForbiddenException({
          code: "NO_ACTIVE_LEASE_ON_UNIT",
          message: "You do not have an active lease on this unit.",
        });
      }
      leaseId = leaseTenant.lease_id;
    } else if (actor.role === "ADMIN") {
      // Admin acts on behalf — find active lease if any
      const lease = await this.prisma.lease.findFirst({
        where: { unit_id: dto.unitId, status: "ACTIVE" },
        select: { id: true },
      });
      leaseId = lease?.id ?? null;
    }

    const now = new Date();

    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceRequest.create({
        data: {
          unit_id: dto.unitId,
          lease_id: leaseId,
          raised_by_user_id: actor.sub,
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          status: "OPEN",
        },
        select: REQUEST_SELECT,
      });

      await this.audit.writeLog(tx, {
        actorId: actor.sub,
        action: "maintenance_request.create",
        entityType: "MaintenanceRequest",
        entityId: created.id,
        before: null,
        after: {
          unit_id: created.unit_id,
          title: created.title,
          priority: created.priority,
          status: created.status,
        },
      });

      return created;
    });

    // EMERGENCY priority: structured log (Phase 7 can wire SMS/email)
    if (dto.priority === "EMERGENCY") {
      this.logger.warn({
        event: "EMERGENCY_MAINTENANCE_REQUEST",
        requestId: request.id,
        unitId: dto.unitId,
        raisedBy: actor.sub,
        title: dto.title,
        timestamp: now.toISOString(),
      });
    }

    return request;
  }

  // ---------------------------------------------------------------------------
  // assign — OPEN → ASSIGNED (PM/Admin only)
  // ---------------------------------------------------------------------------

  async assign(id: string, dto: AssignMaintenanceDto, actor: JwtPayload) {
    const req = await this.getRequestOrThrow(id);
    await this.assertWriteAccess(req, actor);

    if (req.status !== "OPEN") {
      throw new ConflictException({
        code: "INVALID_TRANSITION",
        message: `Cannot assign a request with status '${req.status}'. Expected OPEN.`,
      });
    }

    // Validate assignee is MAINTENANCE role and active
    const assignee = await this.prisma.user.findUnique({
      where: { id: dto.assigneeUserId },
      select: { id: true, role: true, is_active: true },
    });
    if (!assignee) throw new NotFoundException("Assignee user not found");
    if (assignee.role !== "MAINTENANCE") {
      throw new BadRequestException({
        code: "ASSIGNEE_NOT_MAINTENANCE_ROLE",
        message: "Assignee must have the MAINTENANCE role.",
      });
    }
    if (!assignee.is_active) {
      throw new BadRequestException({
        code: "ASSIGNEE_NOT_ACTIVE",
        message: "Assignee account is not active.",
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: "ASSIGNED",
          assigned_to_user_id: dto.assigneeUserId,
          assigned_at: new Date(),
        },
        select: REQUEST_SELECT,
      });

      await this.audit.writeLog(tx, {
        actorId: actor.sub,
        action: "maintenance_request.assign",
        entityType: "MaintenanceRequest",
        entityId: id,
        before: { status: req.status, assigned_to_user_id: req.assigned_to_user_id },
        after: { status: "ASSIGNED", assigned_to_user_id: dto.assigneeUserId },
      });

      return result;
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // inProgress — ASSIGNED → IN_PROGRESS
  // ---------------------------------------------------------------------------

  async inProgress(id: string, actor: JwtPayload) {
    const req = await this.getRequestOrThrow(id);
    await this.assertWriteAccess(req, actor);

    if (req.status !== "ASSIGNED") {
      throw new ConflictException({
        code: "INVALID_TRANSITION",
        message: `Cannot mark in-progress a request with status '${req.status}'. Expected ASSIGNED.`,
      });
    }

    // MAINTENANCE can only act on their own assigned requests
    if (actor.role === "MAINTENANCE" && req.assigned_to_user_id !== actor.sub) {
      throw new ForbiddenException({
        code: "NOT_YOUR_ASSIGNMENT",
        message: "This maintenance request is not assigned to you.",
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: "IN_PROGRESS",
          in_progress_at: new Date(),
        },
        select: REQUEST_SELECT,
      });

      await this.audit.writeLog(tx, {
        actorId: actor.sub,
        action: "maintenance_request.in_progress",
        entityType: "MaintenanceRequest",
        entityId: id,
        before: { status: req.status },
        after: { status: "IN_PROGRESS" },
      });

      return result;
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // resolve — IN_PROGRESS → RESOLVED
  // ---------------------------------------------------------------------------

  async resolve(id: string, dto: ResolveMaintenanceDto, actor: JwtPayload) {
    const req = await this.getRequestOrThrow(id);
    await this.assertWriteAccess(req, actor);

    if (req.status !== "IN_PROGRESS") {
      throw new ConflictException({
        code: "INVALID_TRANSITION",
        message: `Cannot resolve a request with status '${req.status}'. Expected IN_PROGRESS.`,
      });
    }

    // MAINTENANCE can only act on their own requests
    if (actor.role === "MAINTENANCE" && req.assigned_to_user_id !== actor.sub) {
      throw new ForbiddenException({
        code: "NOT_YOUR_ASSIGNMENT",
        message: "This maintenance request is not assigned to you.",
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: "RESOLVED",
          resolution_notes: dto.resolutionNotes,
          resolved_at: new Date(),
        },
        select: REQUEST_SELECT,
      });

      await this.audit.writeLog(tx, {
        actorId: actor.sub,
        action: "maintenance_request.resolve",
        entityType: "MaintenanceRequest",
        entityId: id,
        before: { status: req.status },
        after: { status: "RESOLVED", resolution_notes: dto.resolutionNotes },
      });

      return result;
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // close — RESOLVED → CLOSED (TENANT only — BL-21)
  // ---------------------------------------------------------------------------

  async close(id: string, actor: JwtPayload) {
    const req = await this.getRequestOrThrow(id);

    if (req.status !== "RESOLVED") {
      throw new ConflictException({
        code: "INVALID_TRANSITION",
        message: `Cannot close a request with status '${req.status}'. Expected RESOLVED.`,
      });
    }

    // BL-21: only the original raising tenant may close
    if (req.raised_by_user_id !== actor.sub) {
      throw new ForbiddenException({
        code: "NOT_YOUR_REQUEST",
        message: "You can only close maintenance requests that you raised.",
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: "CLOSED",
          closed_at: new Date(),
          closed_by_user_id: actor.sub,
        },
        select: REQUEST_SELECT,
      });

      await this.audit.writeLog(tx, {
        actorId: actor.sub,
        action: "maintenance_request.close",
        entityType: "MaintenanceRequest",
        entityId: id,
        before: { status: req.status },
        after: { status: "CLOSED", closed_by_user_id: actor.sub },
      });

      return result;
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // dismissAlert — BL-17 alert dismissal (Admin / PM)
  // ---------------------------------------------------------------------------

  async dismissAlert(dto: DismissAlertDto, actor: JwtPayload) {
    const alert = await this.prisma.maintenanceAlert.findUnique({
      where: { id: dto.alertId },
      select: {
        ...ALERT_SELECT,
        unit: { select: { property_id: true } },
      },
    });
    if (!alert) throw new NotFoundException("Maintenance alert not found");

    // PM scope: verify alert's unit is in their property
    if (actor.role === "PROPERTY_MANAGER") {
      const pm = await this.prisma.property.findFirst({
        where: { active_pm_id: actor.sub, deleted_at: null },
        select: { id: true },
      });
      if (!pm || alert.unit.property_id !== pm.id) {
        throw new ForbiddenException({
          code: "PROPERTY_SCOPE_VIOLATION",
          message: "This alert belongs to a property not assigned to you.",
        });
      }
    }

    // Idempotent: if already dismissed, return existing row
    if (alert.dismissed_at) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { unit: _unit, ...rest } = alert;
      return rest;
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.maintenanceAlert.update({
        where: { id: dto.alertId },
        data: {
          dismissed_at: now,
          dismissed_by_user_id: actor.sub,
          dismiss_note: dto.note ?? null,
        },
        select: ALERT_SELECT,
      });

      await this.audit.writeLog(tx, {
        actorId: actor.sub,
        action: "maintenance_alert.dismiss",
        entityType: "MaintenanceAlert",
        entityId: dto.alertId,
        before: { dismissed_at: null },
        after: { dismissed_at: now.toISOString(), dismiss_note: dto.note ?? null },
      });

      return result;
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // BL-17 alert runner — called by the BullMQ processor
  // ---------------------------------------------------------------------------

  async runAlertCheck(nowOverride?: Date): Promise<{
    monthKey: string;
    tenantsChecked: number;
    alertsCreated: number;
    alertsUpdated: number;
  }> {
    const now = nowOverride ?? new Date();
    const monthKey = toISTMonthKey(now);

    // Start and end of current calendar month in IST (as UTC moments)
    const [year, month] = monthKey.split("-").map(Number) as [number, number];

    // IST offset: 5h30m = 330 min = 19800 sec = 19800000 ms
    const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

    // Start of month in IST = 1st 00:00:00 IST → UTC = 1st 00:00:00 IST minus 5:30
    const monthStartIST = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - IST_OFFSET_MS);
    // End of month in IST = last day 23:59:59.999 IST
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate(); // last day of month
    const monthEndIST = new Date(
      Date.UTC(year, month - 1, lastDay, 23, 59, 59, 999) - IST_OFFSET_MS,
    );

    // Count requests per (raised_by_user_id, unit_id) in current calendar month
    const grouped = await this.prisma.maintenanceRequest.groupBy({
      by: ["raised_by_user_id", "unit_id"],
      where: {
        created_at: {
          gte: monthStartIST,
          lte: monthEndIST,
        },
      },
      _count: { id: true },
      having: {
        id: { _count: { gte: 5 } },
      },
    });

    let alertsCreated = 0;
    let alertsUpdated = 0;
    const triggeredAt = now;

    for (const group of grouped) {
      const count = group._count.id;
      const tenantUserId = group.raised_by_user_id;
      const unitId = group.unit_id;

      // Upsert the alert row
      const existing = await this.prisma.maintenanceAlert.findUnique({
        where: {
          tenant_user_id_unit_id_month_key: {
            tenant_user_id: tenantUserId,
            unit_id: unitId,
            month_key: monthKey,
          },
        },
        select: { id: true, request_count: true, dismissed_at: true },
      });

      if (!existing) {
        await this.prisma.maintenanceAlert.create({
          data: {
            tenant_user_id: tenantUserId,
            unit_id: unitId,
            month_key: monthKey,
            request_count: count,
            triggered_at: triggeredAt,
          },
        });
        alertsCreated++;
        this.logger.warn({
          event: "MAINTENANCE_ALERT_TRIGGERED",
          tenantUserId,
          unitId,
          monthKey,
          requestCount: count,
          timestamp: triggeredAt.toISOString(),
        });
      } else {
        // Always update request_count; leave dismissal state untouched
        if (existing.request_count !== count) {
          await this.prisma.maintenanceAlert.update({
            where: { id: existing.id },
            data: { request_count: count },
          });
          alertsUpdated++;
        }
      }
    }

    return {
      monthKey,
      tenantsChecked: grouped.length,
      alertsCreated,
      alertsUpdated,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async getRequestOrThrow(id: string) {
    const req = await this.prisma.maintenanceRequest.findUnique({
      where: { id },
      select: {
        ...REQUEST_SELECT,
        unit: { select: { property_id: true } },
      },
    });
    if (!req) throw new NotFoundException("Maintenance request not found");
    return req;
  }

  /**
   * Read access check — TENANT can only see their own, MAINTENANCE can see their
   * own assigned (or all-open scope, handled in list()), PM sees their property.
   */
  private async assertReadAccess(
    req: { raised_by_user_id: string; assigned_to_user_id: string | null; unit: { property_id: string } },
    actor: JwtPayload,
  ): Promise<void> {
    if (actor.role === "ADMIN") return;

    if (actor.role === "TENANT") {
      if (req.raised_by_user_id !== actor.sub) {
        throw new ForbiddenException({
          code: "NOT_YOUR_REQUEST",
          message: "You can only view your own maintenance requests.",
        });
      }
      return;
    }

    if (actor.role === "MAINTENANCE") {
      if (req.assigned_to_user_id !== actor.sub) {
        throw new ForbiddenException({
          code: "NOT_YOUR_ASSIGNMENT",
          message: "This maintenance request is not assigned to you.",
        });
      }
      return;
    }

    if (actor.role === "PROPERTY_MANAGER") {
      // H-01 fix: verify PM is the active PM for this request's property
      const pm = await this.prisma.property.findFirst({
        where: {
          id: req.unit.property_id,
          active_pm_id: actor.sub,
          deleted_at: null,
        },
        select: { id: true },
      });
      if (!pm) {
        throw new ForbiddenException({
          code: "PROPERTY_ACCESS_DENIED",
          message: "This maintenance request belongs to a property not assigned to you.",
        });
      }
      return;
    }
  }

  /**
   * Write access check — PM must be active PM for the request's property.
   */
  private async assertWriteAccess(
    req: { unit: { property_id: string } },
    actor: JwtPayload,
  ) {
    if (actor.role === "ADMIN") return;

    if (actor.role === "PROPERTY_MANAGER") {
      const pm = await this.prisma.property.findFirst({
        where: {
          id: req.unit.property_id,
          active_pm_id: actor.sub,
          deleted_at: null,
        },
        select: { id: true },
      });
      if (!pm) {
        throw new ForbiddenException({
          code: "PROPERTY_SCOPE_VIOLATION",
          message: "This maintenance request belongs to a property not assigned to you.",
        });
      }
      return;
    }

    // MAINTENANCE role: scope checked per-action (assigned_to_user_id check)
  }
}
