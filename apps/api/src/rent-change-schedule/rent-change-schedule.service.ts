import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../notifications/email.service";
import { Prisma } from "@prisma/client";
import type { CreateRentScheduleDto } from "./dto/create-rent-schedule.dto";
import type { UpdateRentScheduleDto } from "./dto/update-rent-schedule.dto";
import type { JwtPayload } from "../auth/jwt.service";

/** Role int codes */
const ROLE = { ADMIN: 0, PROPERTY_MANAGER: 1 } as const;

/** RentChangeSchedule status int codes */
const SCHEDULE_STATUS = { PENDING: 0, CANCELLED: 1, APPLIED: 2 } as const;

/** LeaseStatus ACTIVE int code */
const LEASE_ACTIVE = 0;

/** Minimum days between today and effective_date */
const MIN_DAYS_AHEAD = 60;

/** IST offset in minutes */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** Return today's date string in IST (YYYY-MM-DD) from a UTC Date */
function toISTDateString(utc: Date): string {
  const istMs = utc.getTime() + IST_OFFSET_MS;
  return new Date(istMs).toISOString().slice(0, 10);
}

/** Parse a YYYY-MM-DD string into a UTC midnight Date */
function parseDateUTC(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** Count calendar days between two UTC-midnight Dates */
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

/** Serialize a schedule row for HTTP responses (BigInt → string) */
function serializeSchedule(row: {
  id: number;
  unit_id: number;
  new_amount_paise: bigint;
  effective_date: Date;
  status: number;
  created_by_user_id: number;
  created_at: Date;
  updated_at: Date;
  applied_at: Date | null;
  cancelled_at: Date | null;
}) {
  return {
    id: row.id,
    unitId: row.unit_id,
    newAmountPaise: row.new_amount_paise.toString(),
    effectiveDate: row.effective_date.toISOString().slice(0, 10),
    status: row.status,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    appliedAt: row.applied_at ?? null,
    cancelledAt: row.cancelled_at ?? null,
  };
}

/** Prisma select shape for schedule rows */
const SCHEDULE_SELECT = {
  id: true,
  unit_id: true,
  new_amount_paise: true,
  effective_date: true,
  status: true,
  created_by_user_id: true,
  created_at: true,
  updated_at: true,
  applied_at: true,
  cancelled_at: true,
} as const;

@Injectable()
export class RentChangeScheduleService {
  private readonly logger = new Logger(RentChangeScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  // ---------------------------------------------------------------------------
  // create — POST units/:unitId/rent-schedule
  // ---------------------------------------------------------------------------

  async create(unitId: number, dto: CreateRentScheduleDto, actor: JwtPayload) {
    const unit = await this.resolveUnitOrThrow(unitId);
    this.assertPMScope(unit, actor);

    // Validate effective_date >= today + 60 days
    const todayIST = toISTDateString(new Date());
    const todayDate = parseDateUTC(todayIST);
    const effectiveDate = parseDateUTC(dto.effectiveDate);
    const daysAhead = daysBetween(todayDate, effectiveDate);

    if (daysAhead < MIN_DAYS_AHEAD) {
      throw new BadRequestException({
        error: {
          code: "EFFECTIVE_DATE_TOO_SOON",
          message: `effectiveDate must be at least ${MIN_DAYS_AHEAD} calendar days from today (today IST: ${todayIST}, provided: ${dto.effectiveDate}, days ahead: ${daysAhead}).`,
        },
      });
    }

    if (dto.newAmountPaise <= 0) {
      throw new BadRequestException({
        error: { code: "INVALID_AMOUNT", message: "newAmountPaise must be greater than 0" },
      });
    }

    // Check for existing PENDING schedule (pre-flight for clean 409 before DB unique violation)
    const existing = await this.prisma.rentChangeSchedule.findFirst({
      where: { unit_id: unitId, status: SCHEDULE_STATUS.PENDING },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        error: {
          code: "PENDING_SCHEDULE_EXISTS",
          message: `Unit ${unitId} already has a pending rent change schedule (id=${existing.id}). Cancel or modify it first.`,
        },
      });
    }

    const newAmountPaise = BigInt(dto.newAmountPaise);

    const schedule = await this.prisma.$transaction(async (tx) => {
      let created;
      try {
        created = await tx.rentChangeSchedule.create({
          data: {
            unit_id: unitId,
            new_amount_paise: newAmountPaise,
            effective_date: effectiveDate,
            status: SCHEDULE_STATUS.PENDING,
            created_by_user_id: actor.sub,
          },
          select: SCHEDULE_SELECT,
        });
      } catch (err) {
        if (this.isUniqueViolation(err)) {
          throw new ConflictException({
            error: {
              code: "PENDING_SCHEDULE_EXISTS",
              message: `Unit ${unitId} already has a pending rent change schedule.`,
            },
          });
        }
        throw err;
      }

      await this.audit.writeLog(tx, {
        actorId: actor.sub,
        action: "rent_change.scheduled",
        entityType: "RentChangeSchedule",
        entityId: created.id,
        before: null,
        after: {
          unit_id: unitId,
          new_amount_paise: newAmountPaise.toString(),
          effective_date: dto.effectiveDate,
          created_by: actor.sub,
        },
      });

      return created;
    });

    // Fire-and-forget email to active tenants (does not block response)
    await this.notifyActiveTenants(unitId, unit.unit_number, newAmountPaise, effectiveDate, "scheduled");

    return serializeSchedule(schedule);
  }

  // ---------------------------------------------------------------------------
  // modify — PATCH units/:unitId/rent-schedule
  // ---------------------------------------------------------------------------

  async modify(unitId: number, dto: UpdateRentScheduleDto, actor: JwtPayload) {
    // At least one field must be provided
    if (dto.newAmountPaise === undefined && dto.effectiveDate === undefined) {
      throw new BadRequestException({
        error: {
          code: "MISSING_FIELDS",
          message: "At least one of newAmountPaise or effectiveDate must be provided.",
        },
      });
    }

    const unit = await this.resolveUnitOrThrow(unitId);
    this.assertPMScope(unit, actor);

    // Find existing PENDING schedule
    const existing = await this.prisma.rentChangeSchedule.findFirst({
      where: { unit_id: unitId, status: SCHEDULE_STATUS.PENDING },
      select: SCHEDULE_SELECT,
    });
    if (!existing) {
      throw new NotFoundException({
        error: {
          code: "NO_PENDING_SCHEDULE",
          message: `No pending rent change schedule found for unit ${unitId}.`,
        },
      });
    }

    // Merge with existing values
    const newAmountStr = dto.newAmountPaise !== undefined
      ? dto.newAmountPaise
      : Number(existing.new_amount_paise);
    const newEffectiveDateStr = dto.effectiveDate ?? existing.effective_date.toISOString().slice(0, 10);

    // Re-validate effective_date if it changed
    if (dto.effectiveDate !== undefined) {
      const todayIST = toISTDateString(new Date());
      const todayDate = parseDateUTC(todayIST);
      const effectiveDate = parseDateUTC(dto.effectiveDate);
      const daysAhead = daysBetween(todayDate, effectiveDate);
      if (daysAhead < MIN_DAYS_AHEAD) {
        throw new BadRequestException({
          error: {
            code: "EFFECTIVE_DATE_TOO_SOON",
            message: `effectiveDate must be at least ${MIN_DAYS_AHEAD} calendar days from today (today IST: ${todayIST}, provided: ${dto.effectiveDate}, days ahead: ${daysAhead}).`,
          },
        });
      }
    }

    const finalAmountPaise = BigInt(newAmountStr);
    const finalEffectiveDate = parseDateUTC(newEffectiveDateStr);

    const newSchedule = await this.prisma.$transaction(async (tx) => {
      // Cancel old schedule
      await tx.rentChangeSchedule.update({
        where: { id: existing.id },
        data: { status: SCHEDULE_STATUS.CANCELLED, cancelled_at: new Date() },
      });

      await this.audit.writeLog(tx, {
        actorId: actor.sub,
        action: "rent_change.cancelled",
        entityType: "RentChangeSchedule",
        entityId: existing.id,
        before: {
          status: SCHEDULE_STATUS.PENDING,
          new_amount_paise: existing.new_amount_paise.toString(),
          effective_date: existing.effective_date.toISOString().slice(0, 10),
        },
        after: { status: SCHEDULE_STATUS.CANCELLED, reason: "MODIFIED_BY_PM" },
      });

      // Create replacement schedule
      let created;
      try {
        created = await tx.rentChangeSchedule.create({
          data: {
            unit_id: unitId,
            new_amount_paise: finalAmountPaise,
            effective_date: finalEffectiveDate,
            status: SCHEDULE_STATUS.PENDING,
            created_by_user_id: actor.sub,
          },
          select: SCHEDULE_SELECT,
        });
      } catch (err) {
        if (this.isUniqueViolation(err)) {
          // Should not happen since we cancelled the old one above, but guard anyway
          throw new ConflictException({
            error: {
              code: "PENDING_SCHEDULE_EXISTS",
              message: `Unit ${unitId} already has a pending rent change schedule.`,
            },
          });
        }
        throw err;
      }

      await this.audit.writeLog(tx, {
        actorId: actor.sub,
        action: "rent_change.scheduled",
        entityType: "RentChangeSchedule",
        entityId: created.id,
        before: null,
        after: {
          unit_id: unitId,
          new_amount_paise: finalAmountPaise.toString(),
          effective_date: newEffectiveDateStr,
          created_by: actor.sub,
          replaced_schedule_id: existing.id,
        },
      });

      return created;
    });

    // Notify tenants of the modification
    await this.notifyActiveTenants(unitId, unit.unit_number, finalAmountPaise, finalEffectiveDate, "modified");

    return serializeSchedule(newSchedule);
  }

  // ---------------------------------------------------------------------------
  // cancel — DELETE units/:unitId/rent-schedule
  // ---------------------------------------------------------------------------

  async cancel(unitId: number, actor: JwtPayload) {
    const unit = await this.resolveUnitOrThrow(unitId);
    this.assertPMScope(unit, actor);

    const existing = await this.prisma.rentChangeSchedule.findFirst({
      where: { unit_id: unitId, status: SCHEDULE_STATUS.PENDING },
      select: SCHEDULE_SELECT,
    });
    if (!existing) {
      throw new NotFoundException({
        error: {
          code: "NO_PENDING_SCHEDULE",
          message: `No pending rent change schedule found for unit ${unitId}.`,
        },
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rentChangeSchedule.update({
        where: { id: existing.id },
        data: { status: SCHEDULE_STATUS.CANCELLED, cancelled_at: new Date() },
      });

      await this.audit.writeLog(tx, {
        actorId: actor.sub,
        action: "rent_change.cancelled",
        entityType: "RentChangeSchedule",
        entityId: existing.id,
        before: {
          status: SCHEDULE_STATUS.PENDING,
          new_amount_paise: existing.new_amount_paise.toString(),
          effective_date: existing.effective_date.toISOString().slice(0, 10),
        },
        after: { status: SCHEDULE_STATUS.CANCELLED },
      });
    });

    // Notify tenants of cancellation
    await this.notifyActiveTenants(
      unitId,
      unit.unit_number,
      existing.new_amount_paise,
      existing.effective_date,
      "cancelled",
    );

    return { success: true, message: `Pending rent change schedule for unit ${unitId} has been cancelled.` };
  }

  // ---------------------------------------------------------------------------
  // getCurrent — GET units/:unitId/rent-schedule
  // ---------------------------------------------------------------------------

  async getCurrent(unitId: number) {
    await this.resolveUnitOrThrow(unitId);

    const schedule = await this.prisma.rentChangeSchedule.findFirst({
      where: { unit_id: unitId, status: SCHEDULE_STATUS.PENDING },
      select: SCHEDULE_SELECT,
    });

    if (!schedule) {
      throw new NotFoundException({
        error: {
          code: "NO_PENDING_SCHEDULE",
          message: `No pending rent change schedule found for unit ${unitId}.`,
        },
      });
    }

    return serializeSchedule(schedule);
  }

  // ---------------------------------------------------------------------------
  // getEffectiveSchedule — helper used by units serialization
  // Returns the active PENDING row, or null.
  // ---------------------------------------------------------------------------

  async getEffectiveSchedule(unitId: number): Promise<{
    scheduledRent: string | null;
    scheduledRentEffectiveDate: string | null;
  }> {
    const schedule = await this.prisma.rentChangeSchedule.findFirst({
      where: { unit_id: unitId, status: SCHEDULE_STATUS.PENDING },
      select: { new_amount_paise: true, effective_date: true },
    });

    if (!schedule) {
      return { scheduledRent: null, scheduledRentEffectiveDate: null };
    }

    return {
      scheduledRent: schedule.new_amount_paise.toString(),
      scheduledRentEffectiveDate: schedule.effective_date.toISOString().slice(0, 10),
    };
  }

  // ---------------------------------------------------------------------------
  // getEffectiveRentForUnit — what rent applied to a unit on a given date.
  //
  // Used at rent-period generation time (rent-accrual cron) to honor the
  // "rent effective on due_date" rule (Item 1 of the additional spec).
  //
  // Returns the new_amount_paise of the latest non-cancelled schedule whose
  // effective_date is on or before `asOf`, or null if no such schedule exists
  // (caller falls back to lease.monthly_rent_paise — BL-02 snapshot).
  //
  // We include PENDING schedules so that a period generated for a future
  // due_date picks up an already-scheduled rent change even before the
  // applyDue cron has flipped it to APPLIED.
  // ---------------------------------------------------------------------------

  async getEffectiveRentForUnit(unitId: number, asOf: Date): Promise<bigint | null> {
    const row = await this.prisma.rentChangeSchedule.findFirst({
      where: {
        unit_id: unitId,
        effective_date: { lte: asOf },
        status: { in: [SCHEDULE_STATUS.PENDING, SCHEDULE_STATUS.APPLIED] },
      },
      orderBy: { effective_date: "desc" },
      select: { new_amount_paise: true },
    });
    return row?.new_amount_paise ?? null;
  }

  // ---------------------------------------------------------------------------
  // applyDue — called by the cron job daily at 00:15 IST
  // ---------------------------------------------------------------------------

  async applyDue(today: Date): Promise<{ applied: number; errors: number }> {
    const todayIST = toISTDateString(today);
    const todayDate = parseDateUTC(todayIST);

    // Find all PENDING schedules with effective_date <= today (IST)
    const due = await this.prisma.rentChangeSchedule.findMany({
      where: {
        status: SCHEDULE_STATUS.PENDING,
        effective_date: { lte: todayDate },
      },
      select: {
        id: true,
        unit_id: true,
        new_amount_paise: true,
        effective_date: true,
      },
    });

    let applied = 0;
    let errors = 0;

    // Resolve system audit actor (bootstrap admin)
    const admin = await this.prisma.user.findFirst({
      where: { role: ROLE.ADMIN },
      select: { id: true },
    });
    const actorId = admin?.id ?? 0;

    for (const schedule of due) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Update the unit's monthly_rent_paise
          const unitBefore = await tx.unit.findUniqueOrThrow({
            where: { id: schedule.unit_id },
            select: { monthly_rent_paise: true },
          });

          await tx.unit.update({
            where: { id: schedule.unit_id },
            data: { monthly_rent_paise: Number(schedule.new_amount_paise) },
          });

          // Flip the schedule to APPLIED
          await tx.rentChangeSchedule.update({
            where: { id: schedule.id },
            data: { status: SCHEDULE_STATUS.APPLIED, applied_at: new Date() },
          });

          // Audit the change
          await this.audit.writeLog(tx, {
            actorId,
            action: "rent_change.applied",
            entityType: "RentChangeSchedule",
            entityId: schedule.id,
            before: {
              schedule_status: SCHEDULE_STATUS.PENDING,
              unit_monthly_rent_paise: unitBefore.monthly_rent_paise,
            },
            after: {
              schedule_status: SCHEDULE_STATUS.APPLIED,
              unit_monthly_rent_paise: schedule.new_amount_paise.toString(),
              effective_date: schedule.effective_date.toISOString().slice(0, 10),
            },
          });
        });

        applied++;
        this.logger.log(
          `Applied rent change schedule id=${schedule.id}: unit=${schedule.unit_id} new_amount=${schedule.new_amount_paise} paise`,
        );
      } catch (err) {
        errors++;
        this.logger.error(
          `Failed to apply rent change schedule id=${schedule.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { applied, errors };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Resolve a non-retired unit, throw 404 if not found or retired. */
  private async resolveUnitOrThrow(unitId: number) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        id: true,
        unit_number: true,
        is_retired: true,
        property: { select: { id: true, active_pm_id: true } },
      },
    });
    if (!unit) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: `Unit ${unitId} not found` },
      });
    }
    if (unit.is_retired) {
      throw new ConflictException({
        error: { code: "UNIT_RETIRED", message: `Unit ${unitId} is retired and cannot have rent schedules.` },
      });
    }
    return unit;
  }

  /**
   * PM authorization check:
   * - ADMIN always passes (role=0).
   * - PROPERTY_MANAGER must be the active_pm_id on the unit's property.
   * Throws ForbiddenException if not authorized.
   */
  private assertPMScope(
    unit: { property: { active_pm_id: number | null } },
    actor: JwtPayload,
  ): void {
    if (actor.role === ROLE.ADMIN) return;
    if (actor.role === ROLE.PROPERTY_MANAGER) {
      if (unit.property.active_pm_id !== actor.sub) {
        throw new ForbiddenException({
          error: {
            code: "PROPERTY_ACCESS_DENIED",
            message: "You are not the assigned manager for this property.",
          },
        });
      }
      return;
    }
    throw new ForbiddenException({
      error: { code: "PROPERTY_ACCESS_DENIED", message: "Your role does not have access to this resource." },
    });
  }

  /** Get email addresses of active tenants on a unit's active lease */
  private async getActiveTenantEmails(unitId: number): Promise<string[]> {
    const leaseTenants = await this.prisma.leaseTenant.findMany({
      where: {
        lease: { unit_id: unitId, status: LEASE_ACTIVE },
        removed_at: null,
      },
      select: {
        tenant: {
          select: {
            user: { select: { email: true, is_active: true } },
          },
        },
      },
    });

    return leaseTenants
      .map((lt) => lt.tenant.user)
      .filter((u) => u.is_active)
      .map((u) => u.email);
  }

  private async notifyActiveTenants(
    unitId: number,
    unitNumber: string,
    newAmountPaise: bigint,
    effectiveDate: Date,
    type: "scheduled" | "modified" | "cancelled",
  ): Promise<void> {
    try {
      const emails = await this.getActiveTenantEmails(unitId);
      if (emails.length > 0) {
        await this.email.sendRentChangeNotice(emails, unitNumber, newAmountPaise, effectiveDate, type);
      }
    } catch (err) {
      // Email errors must never propagate to the caller
      this.logger.error(
        `notifyActiveTenants error (unit=${unitId}, type=${type}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
    );
  }
}
