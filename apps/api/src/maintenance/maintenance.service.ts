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
// Maintenance status int codes (mirror DB CASE WHEN convention)
// ---------------------------------------------------------------------------

export const MAINTENANCE_STATUS = {
  OPEN: 0,
  ASSIGNED: 1,
  IN_PROGRESS: 2,
  RESOLVED: 3,
  CLOSED: 4,
} as const;

export const MAINTENANCE_PRIORITY = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
  EMERGENCY: 3,
} as const;

/** Status name → code lookup (for query param filtering) */
const STATUS_NAME_TO_CODE: Record<string, number> = {
  OPEN: MAINTENANCE_STATUS.OPEN,
  ASSIGNED: MAINTENANCE_STATUS.ASSIGNED,
  IN_PROGRESS: MAINTENANCE_STATUS.IN_PROGRESS,
  RESOLVED: MAINTENANCE_STATUS.RESOLVED,
  CLOSED: MAINTENANCE_STATUS.CLOSED,
};

/** Role int codes */
const ROLE = { ADMIN: 0, PROPERTY_MANAGER: 1, MAINTENANCE: 2, TENANT: 3 } as const;

/** Lease status ACTIVE int code */
const LEASE_ACTIVE = 0;

/** MAINTENANCE role code (for user.role check) */
const MAINTENANCE_ROLE_CODE = 2;

// Valid status name strings for request validation
const VALID_STATUS_NAMES = Object.keys(STATUS_NAME_TO_CODE);

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
  // Nested context for FE — req.unit.name, req.raised_by.name, req.assigned_to.name
  unit: { select: { id: true, unit_number: true } },
  raised_by: { select: { id: true, name: true } },
  assigned_to: { select: { id: true, name: true } },
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
      unitId?: number;
      propertyId?: number;
      status?: string;
      assignedToUserId?: number;
      scope?: string;
      cursor?: number;
      limit?: number;
      page?: number;
      pageSize?: number;
    },
  ) {
    const useOffset = query.page !== undefined;
    const ps = query.pageSize !== undefined ? Math.min(Math.max(query.pageSize, 1), 100) : undefined;
    const take = useOffset ? (ps ?? 10) : Math.min(query.limit ?? 20, 100);
    const currentPage = query.page ?? 1;

    const where: Prisma.MaintenanceRequestWhereInput = {};

    if (actor.role === ROLE.TENANT) {
      // Tenant sees only their own requests
      where.raised_by_user_id = actor.sub;
    } else if (actor.role === ROLE.MAINTENANCE) {
      if (query.scope === "all-open") {
        // All open/assigned/in-progress across all properties
        where.status = { in: [MAINTENANCE_STATUS.OPEN, MAINTENANCE_STATUS.ASSIGNED, MAINTENANCE_STATUS.IN_PROGRESS] };
      } else {
        // Only their own assigned requests
        where.assigned_to_user_id = actor.sub;
      }
    } else if (actor.role === ROLE.PROPERTY_MANAGER) {
      // Scoped to their property's units
      const pm = await this.prisma.property.findFirst({
        where: { active_pm_id: actor.sub, deleted_at: null },
        select: { id: true },
      });
      if (!pm) {
        return {
          data: [],
          meta: { next_cursor: null, has_more: false, total: 0, page: currentPage, page_size: take, total_pages: 0 },
        };
      }
      where.unit = { property_id: pm.id };
      if (query.unitId !== undefined) where.unit_id = query.unitId;
    }
    // ADMIN sees all — no extra filter

    if (actor.role === ROLE.ADMIN || actor.role === ROLE.PROPERTY_MANAGER) {
      if (query.unitId !== undefined) where.unit_id = query.unitId;
      if (query.assignedToUserId !== undefined) where.assigned_to_user_id = query.assignedToUserId;
    }

    if (query.propertyId !== undefined && actor.role === ROLE.ADMIN) {
      where.unit = { property_id: query.propertyId };
    }

    if (query.status) {
      const upperStatus = query.status.toUpperCase();
      if (!VALID_STATUS_NAMES.includes(upperStatus)) {
        throw new BadRequestException({
          code: "INVALID_STATUS",
          message: `Invalid status value '${query.status}'. Valid values: ${VALID_STATUS_NAMES.join(", ")}`,
        });
      }
      where.status = STATUS_NAME_TO_CODE[upperStatus];
    }

    // Explicit-branch findMany — avoids TS conditional-spread inference issue.
    const findManyPromise = useOffset
      ? this.prisma.maintenanceRequest.findMany({
          where,
          select: REQUEST_SELECT,
          orderBy: { created_at: "desc" },
          skip: (currentPage - 1) * take,
          take,
        })
      : this.prisma.maintenanceRequest.findMany({
          where,
          select: REQUEST_SELECT,
          orderBy: { created_at: "desc" },
          take: take + 1,
          ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        });

    const [rawItems, total] = await Promise.all([
      findManyPromise,
      this.prisma.maintenanceRequest.count({ where }),
    ]);

    let hasMore: boolean;
    let data: typeof rawItems;
    let nextCursor: number | undefined;

    if (useOffset) {
      data = rawItems;
      hasMore = currentPage * take < total;
      nextCursor = undefined;
    } else {
      hasMore = rawItems.length > take;
      data = hasMore ? rawItems.slice(0, take) : rawItems;
      nextCursor = hasMore ? data[data.length - 1]?.id : undefined;
    }

    // M-01: strip lease_id from MAINTENANCE all-open scope — no PII linkage needed
    if (actor.role === ROLE.MAINTENANCE && query.scope === "all-open") {
      data = data.map((item) => ({ ...item, lease_id: null }));
    }

    const totalPages = total === 0 ? 0 : Math.ceil(total / take);

    return {
      data,
      meta: {
        next_cursor: nextCursor ?? null,
        has_more: hasMore,
        total,
        page: currentPage,
        page_size: take,
        total_pages: totalPages,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // findOne — scoped by role
  // ---------------------------------------------------------------------------

  async findOne(id: number, actor: JwtPayload) {
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
    // Verify unit exists
    const unit = await this.prisma.unit.findUnique({
      where: { id: dto.unitId },
      select: { id: true, property_id: true },
    });
    if (!unit) throw new NotFoundException("Unit not found");

    let leaseId: number | null = null;

    if (actor.role === ROLE.TENANT) {
      // Tenant must have an active lease on this unit.
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
            status: LEASE_ACTIVE,
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
    } else if (actor.role === ROLE.ADMIN) {
      // Admin acts on behalf — find active lease if any
      const lease = await this.prisma.lease.findFirst({
        where: { unit_id: dto.unitId, status: LEASE_ACTIVE },
        select: { id: true },
      });
      leaseId = lease?.id ?? null;
    } else if (actor.role === ROLE.PROPERTY_MANAGER) {
      // BL-16 deviation: PM raises on behalf of a tenant on a unit in their
      // assigned property. Scope-check the unit → property → active_pm_id.
      const unit = await this.prisma.unit.findUnique({
        where: { id: dto.unitId },
        select: {
          id: true,
          property: { select: { id: true, active_pm_id: true } },
        },
      });
      if (!unit) {
        throw new NotFoundException({
          code: "RESOURCE_NOT_FOUND",
          message: `Unit ${dto.unitId} not found`,
        });
      }
      if (unit.property.active_pm_id !== actor.sub) {
        throw new ForbiddenException({
          code: "PROPERTY_ACCESS_DENIED",
          message: "You can only raise requests on units in your assigned property.",
        });
      }
      const lease = await this.prisma.lease.findFirst({
        where: { unit_id: dto.unitId, status: LEASE_ACTIVE },
        select: { id: true },
      });
      leaseId = lease?.id ?? null;
    }

    const now = new Date();

    // Map priority string to int code
    const PRIORITY_CODE: Record<string, number> = {
      LOW: MAINTENANCE_PRIORITY.LOW,
      NORMAL: MAINTENANCE_PRIORITY.NORMAL,
      HIGH: MAINTENANCE_PRIORITY.HIGH,
      EMERGENCY: MAINTENANCE_PRIORITY.EMERGENCY,
    };
    const priorityCode = typeof dto.priority === "string"
      ? (PRIORITY_CODE[dto.priority.toUpperCase()] ?? MAINTENANCE_PRIORITY.NORMAL)
      : (dto.priority as number);

    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.maintenanceRequest.create({
        data: {
          unit_id: dto.unitId,
          lease_id: leaseId,
          raised_by_user_id: actor.sub,
          title: dto.title,
          description: dto.description,
          priority: priorityCode,
          status: MAINTENANCE_STATUS.OPEN,
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

    // EMERGENCY priority: structured log
    if (priorityCode === MAINTENANCE_PRIORITY.EMERGENCY) {
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

  async assign(id: number, dto: AssignMaintenanceDto, actor: JwtPayload) {
    const req = await this.getRequestOrThrow(id);
    await this.assertWriteAccess(req, actor);

    if (req.status !== MAINTENANCE_STATUS.OPEN) {
      throw new ConflictException({
        code: "INVALID_TRANSITION",
        message: `Cannot assign a request with status '${req.status}'. Expected OPEN (0).`,
      });
    }

    // Validate assignee is MAINTENANCE role and active
    const assignee = await this.prisma.user.findUnique({
      where: { id: dto.assigneeUserId },
      select: { id: true, role: true, is_active: true },
    });
    if (!assignee) throw new NotFoundException("Assignee user not found");
    if (assignee.role !== MAINTENANCE_ROLE_CODE) {
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
          status: MAINTENANCE_STATUS.ASSIGNED,
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
        after: { status: MAINTENANCE_STATUS.ASSIGNED, assigned_to_user_id: dto.assigneeUserId },
      });

      return result;
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // inProgress — ASSIGNED → IN_PROGRESS
  // ---------------------------------------------------------------------------

  async inProgress(id: number, actor: JwtPayload) {
    const req = await this.getRequestOrThrow(id);
    await this.assertWriteAccess(req, actor);

    if (req.status !== MAINTENANCE_STATUS.ASSIGNED) {
      throw new ConflictException({
        code: "INVALID_TRANSITION",
        message: `Cannot mark in-progress a request with status '${req.status}'. Expected ASSIGNED (1).`,
      });
    }

    // MAINTENANCE can only act on their own assigned requests
    if (actor.role === ROLE.MAINTENANCE && req.assigned_to_user_id !== actor.sub) {
      throw new ForbiddenException({
        code: "NOT_YOUR_ASSIGNMENT",
        message: "This maintenance request is not assigned to you.",
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: MAINTENANCE_STATUS.IN_PROGRESS,
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
        after: { status: MAINTENANCE_STATUS.IN_PROGRESS },
      });

      return result;
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // resolve — IN_PROGRESS → RESOLVED
  // ---------------------------------------------------------------------------

  async resolve(id: number, dto: ResolveMaintenanceDto, actor: JwtPayload) {
    const req = await this.getRequestOrThrow(id);
    await this.assertWriteAccess(req, actor);

    if (req.status !== MAINTENANCE_STATUS.IN_PROGRESS) {
      throw new ConflictException({
        code: "INVALID_TRANSITION",
        message: `Cannot resolve a request with status '${req.status}'. Expected IN_PROGRESS (2).`,
      });
    }

    // MAINTENANCE can only act on their own requests
    if (actor.role === ROLE.MAINTENANCE && req.assigned_to_user_id !== actor.sub) {
      throw new ForbiddenException({
        code: "NOT_YOUR_ASSIGNMENT",
        message: "This maintenance request is not assigned to you.",
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.maintenanceRequest.update({
        where: { id },
        data: {
          status: MAINTENANCE_STATUS.RESOLVED,
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
        after: { status: MAINTENANCE_STATUS.RESOLVED, resolution_notes: dto.resolutionNotes },
      });

      return result;
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // close — RESOLVED → CLOSED (TENANT only — BL-21)
  // ---------------------------------------------------------------------------

  async close(id: number, actor: JwtPayload) {
    const req = await this.getRequestOrThrow(id);

    if (req.status !== MAINTENANCE_STATUS.RESOLVED) {
      throw new ConflictException({
        code: "INVALID_TRANSITION",
        message: `Cannot close a request with status '${req.status}'. Expected RESOLVED (3).`,
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
          status: MAINTENANCE_STATUS.CLOSED,
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
        after: { status: MAINTENANCE_STATUS.CLOSED, closed_by_user_id: actor.sub },
      });

      return result;
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // listAlerts — GET /maintenance-requests/alerts (Admin / PM)
  // BL-17: Admin sees all active alerts; PM sees only their property's alerts.
  // ---------------------------------------------------------------------------

  async listAlerts(actor: JwtPayload, query: {
    dismissed?: string;
    cursor?: number;
    limit?: number;
    page?: number;
    pageSize?: number;
  }) {
    const useOffset = query.page !== undefined;
    const ps = query.pageSize !== undefined ? Math.min(Math.max(query.pageSize, 1), 100) : undefined;
    const take = useOffset ? (ps ?? 10) : Math.min(query.limit ?? 20, 100);
    const currentPage = query.page ?? 1;

    const where: Prisma.MaintenanceAlertWhereInput = {};

    // Default: only active (not dismissed) alerts unless ?dismissed=true
    if (query.dismissed !== "true") {
      where.dismissed_at = null;
    }

    if (actor.role === ROLE.PROPERTY_MANAGER) {
      // Scope: only alerts for units in the PM's assigned property
      const pm = await this.prisma.property.findFirst({
        where: { active_pm_id: actor.sub, deleted_at: null },
        select: { id: true },
      });
      if (!pm) {
        return {
          data: [],
          meta: { next_cursor: null, has_more: false, total: 0, page: currentPage, page_size: take, total_pages: 0 },
        };
      }
      where.unit = { property_id: pm.id };
    }
    // ADMIN: no additional scoping

    // Explicit-branch findMany — avoids TS conditional-spread inference issue.
    const findManyPromise = useOffset
      ? this.prisma.maintenanceAlert.findMany({
          where,
          select: ALERT_SELECT,
          orderBy: { triggered_at: "desc" },
          skip: (currentPage - 1) * take,
          take,
        })
      : this.prisma.maintenanceAlert.findMany({
          where,
          select: ALERT_SELECT,
          orderBy: { triggered_at: "desc" },
          take: take + 1,
          ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        });

    const [rawItems, total] = await Promise.all([
      findManyPromise,
      this.prisma.maintenanceAlert.count({ where }),
    ]);

    let hasMore: boolean;
    let data: typeof rawItems;
    let nextCursor: number | undefined;

    if (useOffset) {
      data = rawItems;
      hasMore = currentPage * take < total;
      nextCursor = undefined;
    } else {
      hasMore = rawItems.length > take;
      data = hasMore ? rawItems.slice(0, take) : rawItems;
      nextCursor = hasMore ? data[data.length - 1]?.id : undefined;
    }

    const totalPages = total === 0 ? 0 : Math.ceil(total / take);

    return {
      data,
      meta: {
        next_cursor: nextCursor ?? null,
        has_more: hasMore,
        total,
        page: currentPage,
        page_size: take,
        total_pages: totalPages,
      },
    };
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
    if (actor.role === ROLE.PROPERTY_MANAGER) {
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
  // BL-17 alert runner — called by the @nestjs/schedule cron service
  // ---------------------------------------------------------------------------

  async runAlertCheck(nowOverride?: Date): Promise<{
    monthKey: string;
    tenantsChecked: number;
    alertsCreated: number;
    alertsUpdated: number;
  }> {
    const now = nowOverride ?? new Date();
    const monthKey = toISTMonthKey(now);

    const [year, month] = monthKey.split("-").map(Number) as [number, number];

    const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

    const monthStartIST = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - IST_OFFSET_MS);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
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

  private async getRequestOrThrow(id: number) {
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
    req: { raised_by_user_id: number; assigned_to_user_id: number | null; unit: { property_id: number } },
    actor: JwtPayload,
  ): Promise<void> {
    if (actor.role === ROLE.ADMIN) return;

    if (actor.role === ROLE.TENANT) {
      if (req.raised_by_user_id !== actor.sub) {
        throw new ForbiddenException({
          code: "NOT_YOUR_REQUEST",
          message: "You can only view your own maintenance requests.",
        });
      }
      return;
    }

    if (actor.role === ROLE.MAINTENANCE) {
      if (req.assigned_to_user_id !== actor.sub) {
        throw new ForbiddenException({
          code: "NOT_YOUR_ASSIGNMENT",
          message: "This maintenance request is not assigned to you.",
        });
      }
      return;
    }

    if (actor.role === ROLE.PROPERTY_MANAGER) {
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
    req: { unit: { property_id: number } },
    actor: JwtPayload,
  ) {
    if (actor.role === ROLE.ADMIN) return;

    if (actor.role === ROLE.PROPERTY_MANAGER) {
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
