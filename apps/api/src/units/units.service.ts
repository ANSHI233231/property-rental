import {
  Injectable,
  NotFoundException,
  ConflictException,
  MethodNotAllowedException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { CreateUnitDto } from "./dto/create-unit.dto";
import type { UpdateUnitDto } from "./dto/update-unit.dto";
import type { UnitStateChangeDto } from "./dto/unit-state-change.dto";
/**
 * Unit state codes (smallint, permanent contract):
 *   AVAILABLE=0  LISTED=1  OCCUPIED=2  MAINTENANCE=3
 *
 * Unit state transition rules (BL-04 / Phase 2 subset).
 * LISTED → OCCUPIED is allowed here so Admin can set test units to OCCUPIED.
 * Phase 3 adds the lease-link guard on top: transition to OCCUPIED is only
 * legal when creating/activating a lease (the lease module will use a different
 * service method that passes the lease context). The raw PATCH /units/:id/state
 * endpoint remains available for Admin override.
 */
export const UNIT_STATE = { AVAILABLE: 0, LISTED: 1, OCCUPIED: 2, MAINTENANCE: 3 } as const;
export type UnitStateCode = (typeof UNIT_STATE)[keyof typeof UNIT_STATE];

const LEGAL_TRANSITIONS: Record<UnitStateCode, UnitStateCode[]> = {
  0: [1, 3],    // AVAILABLE → LISTED, MAINTENANCE
  1: [0, 2, 3], // LISTED    → AVAILABLE, OCCUPIED, MAINTENANCE
  2: [3],       // OCCUPIED  → MAINTENANCE
  3: [0],       // MAINTENANCE → AVAILABLE
};

const UNIT_SELECT = {
  id: true,
  property_id: true,
  unit_number: true,
  floor: true,
  bedrooms: true,
  bathrooms: true,
  area_sqft: true,
  monthly_rent_paise: true,
  state: true,
  is_retired: true,
  retired_at: true,
  retired_by_user_id: true,
  created_at: true,
  updated_at: true,
  // Used by /admin/units list to show "Property Name" column. PM scope
  // doesn't need it for display but the join is the same.
  property: { select: { id: true, name: true } },
} as const;

@Injectable()
export class UnitsService {
  private readonly logger = new Logger(UnitsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // List all units — flat, cross-property (Admin only, for admin dashboard)
  // ---------------------------------------------------------------------------

  async listAll(query: {
    cursor?: number;
    limit?: number;
    status?: string;
    propertyId?: number;
    page?: number;
    pageSize?: number;
    /** When set, scope to units in the property where this user is the
     *  active PM. Used by /pm/units. Admins pass undefined to see all. */
    pmUserId?: number;
  }) {
    const useOffset = query.page !== undefined;
    const ps = query.pageSize !== undefined ? Math.min(Math.max(query.pageSize, 1), 100) : undefined;
    const take = useOffset ? (ps ?? 10) : Math.min(query.limit ?? 20, 200);

    // Accept state as int code string ("0") or name ("AVAILABLE" / "RETIRED")
    const STATE_NAME_TO_CODE: Record<string, number> = {
      AVAILABLE: 0, LISTED: 1, OCCUPIED: 2, MAINTENANCE: 3,
    };
    const where: {
      state?: number;
      property_id?: number;
      is_retired?: boolean;
      property?: { active_pm_id: number };
    } = {};
    if (query.status) {
      const upper = query.status.toUpperCase();
      if (upper === "RETIRED") {
        // "Retired" is a derived bucket — units with is_retired=true regardless of state.
        where.is_retired = true;
      } else {
        const asInt = parseInt(query.status, 10);
        if (!isNaN(asInt)) {
          where.state = asInt;
        } else {
          const code = STATE_NAME_TO_CODE[upper];
          if (code !== undefined) where.state = code;
        }
      }
    }
    if (query.propertyId !== undefined) {
      where.property_id = query.propertyId;
    }
    if (query.pmUserId !== undefined) {
      // PM scope — only their own property's units.
      where.property = { active_pm_id: query.pmUserId };
    }

    const currentPage = query.page ?? 1;
    const findManyPromise = useOffset
      ? this.prisma.unit.findMany({
          where,
          select: UNIT_SELECT,
          orderBy: { created_at: "asc" },
          skip: (currentPage - 1) * take,
          take,
        })
      : this.prisma.unit.findMany({
          where,
          select: UNIT_SELECT,
          orderBy: { created_at: "asc" },
          take: take + 1,
          ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        });

    const [rawItems, total] = await Promise.all([
      findManyPromise,
      this.prisma.unit.count({ where }),
    ]);

    let hasMore: boolean;
    let raw: typeof rawItems;
    let nextCursor: number | undefined;

    if (useOffset) {
      raw = rawItems;
      hasMore = currentPage * take < total;
      nextCursor = undefined;
    } else {
      hasMore = rawItems.length > take;
      raw = hasMore ? rawItems.slice(0, take) : rawItems;
      nextCursor = hasMore ? raw[raw.length - 1]?.id : undefined;
    }

    const data = await this.enrichWithScheduledRent(raw);
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
  // List units for a property (cursor-based)
  // ---------------------------------------------------------------------------

  async list(
    propertyId: number,
    cursor?: number,
    limit = 20,
    state?: string,
    page?: number,
    pageSize?: number,
  ) {
    // Verify property exists
    await this.getPropertyOrThrow(propertyId);

    const useOffset = page !== undefined;
    const ps = pageSize !== undefined ? Math.min(Math.max(pageSize, 1), 100) : undefined;
    const take = useOffset ? (ps ?? 10) : Math.min(limit, 100);

    // Accept state as int code string ("0") or name ("AVAILABLE")
    const STATE_NAME_TO_CODE: Record<string, number> = {
      AVAILABLE: 0, LISTED: 1, OCCUPIED: 2, MAINTENANCE: 3,
    };
    const where: { property_id: number; state?: number } = { property_id: propertyId };
    if (state) {
      const asInt = parseInt(state, 10);
      if (!isNaN(asInt)) {
        where.state = asInt;
      } else {
        const code = STATE_NAME_TO_CODE[state.toUpperCase()];
        if (code !== undefined) where.state = code;
      }
    }

    const currentPage = page ?? 1;
    const findManyPromise = useOffset
      ? this.prisma.unit.findMany({
          where,
          select: UNIT_SELECT,
          orderBy: { created_at: "asc" },
          skip: (currentPage - 1) * take,
          take,
        })
      : this.prisma.unit.findMany({
          where,
          select: UNIT_SELECT,
          orderBy: { created_at: "asc" },
          take: take + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

    const [rawItems, total] = await Promise.all([
      findManyPromise,
      this.prisma.unit.count({ where }),
    ]);

    let hasMore: boolean;
    let raw: typeof rawItems;
    let nextCursor: number | undefined;

    if (useOffset) {
      raw = rawItems;
      hasMore = currentPage * take < total;
      nextCursor = undefined;
    } else {
      hasMore = rawItems.length > take;
      raw = hasMore ? rawItems.slice(0, take) : rawItems;
      nextCursor = hasMore ? raw[raw.length - 1]?.id : undefined;
    }

    const data = await this.enrichWithScheduledRent(raw);
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
  // Create unit
  // ---------------------------------------------------------------------------

  async create(propertyId: number, dto: CreateUnitDto, actorId: number) {
    await this.getPropertyOrThrow(propertyId);

    // Prisma will enforce the @@unique([property_id, unit_number]) constraint.
    // If it fires, catch and re-throw a user-friendly error.
    return this.prisma.$transaction(async (tx) => {
      let unit;
      try {
        unit = await tx.unit.create({
          data: {
            property_id: propertyId,
            unit_number: dto.unit_number,
            floor: dto.floor ?? null,
            bedrooms: dto.bedrooms,
            bathrooms: dto.bathrooms,
            area_sqft: dto.area_sqft ?? null,
            monthly_rent_paise: dto.monthly_rent_paise,
            state: UNIT_STATE.AVAILABLE,
          },
          select: UNIT_SELECT,
        });
      } catch (err: unknown) {
        if (this.isPrismaUniqueError(err)) {
          throw new ConflictException({
            error: {
              code: "UNIT_NUMBER_DUPLICATE",
              message: `Unit number "${dto.unit_number}" already exists in this property`,
            },
          });
        }
        throw err;
      }

      await this.audit.writeLog(tx, {
        actorId,
        action: "unit.create",
        entityType: "Unit",
        entityId: unit.id,
        before: null,
        after: unit,
      });

      return unit;
    });
  }

  // ---------------------------------------------------------------------------
  // Find single unit
  // ---------------------------------------------------------------------------

  async findById(id: number) {
    const unit = await this.prisma.unit.findUnique({
      where: { id },
      select: UNIT_SELECT,
    });

    if (!unit) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: `Unit ${id} not found` },
      });
    }

    return unit;
  }

  /** Find single unit with scheduled rent enrichment (for GET /units/:id) */
  async findByIdWithSchedule(id: number) {
    const unit = await this.findById(id);
    const [enriched] = await this.enrichWithScheduledRent([unit]);
    return enriched!;
  }

  // ---------------------------------------------------------------------------
  // Update unit metadata (PATCH /units/:id)
  // BL-03: monthly_rent_paise change rejected if state ∈ {OCCUPIED, MAINTENANCE}.
  // ---------------------------------------------------------------------------

  async update(id: number, dto: UpdateUnitDto, actorId: number) {
    const isRentChange = dto.monthly_rent_paise !== undefined;

    // Phase 7 / BL-03 / M-05: if changing rent, run the state check AND the write
    // inside a Serializable transaction with FOR UPDATE to prevent a race where
    // a concurrent state-change (→ OCCUPIED) sneaks through between the check and
    // the write.
    if (isRentChange) {
      return this.prisma.$transaction(
        async (tx) => {
          // Re-read unit inside the transaction (Serializable snapshot).
          const lockedRows = await tx.$queryRaw<Array<{
            id: number;
            state: number;
            is_retired: boolean;
          }>>`
            SELECT id, state, is_retired FROM units WHERE id = ${id} FOR UPDATE
          `;

          if (lockedRows.length === 0) {
            throw new NotFoundException({
              error: { code: "RESOURCE_NOT_FOUND", message: `Unit ${id} not found` },
            });
          }

          const locked = lockedRows[0]!;

          if (locked.is_retired) {
            throw new ConflictException({
              error: {
                code: "UNIT_RETIRED",
                message: "Cannot update a retired unit. Create a new unit instead.",
              },
            });
          }

          const lockingStates: UnitStateCode[] = [UNIT_STATE.OCCUPIED, UNIT_STATE.MAINTENANCE];
          if (lockingStates.includes(locked.state as UnitStateCode)) {
            throw new ConflictException({
              error: {
                code: "UNIT_RENT_LOCKED",
                message: `Rent cannot be changed when unit state is ${locked.state}. Only AVAILABLE or LISTED units may have rent updated. (BL-03)`,
                details: { current_state: locked.state },
              },
            });
          }

          const before = await this.findById(id); // for audit snapshot (no extra lock needed)

          const updated = await tx.unit.update({
            where: { id },
            data: {
              ...(dto.unit_number !== undefined ? { unit_number: dto.unit_number } : {}),
              ...(dto.floor !== undefined ? { floor: dto.floor } : {}),
              ...(dto.bedrooms !== undefined ? { bedrooms: dto.bedrooms } : {}),
              ...(dto.bathrooms !== undefined ? { bathrooms: dto.bathrooms } : {}),
              ...(dto.area_sqft !== undefined ? { area_sqft: dto.area_sqft } : {}),
              monthly_rent_paise: dto.monthly_rent_paise,
            },
            select: UNIT_SELECT,
          });

          await this.audit.writeLog(tx, {
            actorId,
            action: "unit.update",
            entityType: "Unit",
            entityId: id,
            before,
            after: updated,
          });

          return updated;
        },
        { isolationLevel: "Serializable" },
      );
    }

    // Non-rent update: no race concern — standard transaction.
    const before = await this.findById(id);

    if (before.is_retired) {
      throw new ConflictException({
        error: {
          code: "UNIT_RETIRED",
          message: "Cannot update a retired unit. Create a new unit instead.",
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.unit.update({
        where: { id },
        data: {
          ...(dto.unit_number !== undefined ? { unit_number: dto.unit_number } : {}),
          ...(dto.floor !== undefined ? { floor: dto.floor } : {}),
          ...(dto.bedrooms !== undefined ? { bedrooms: dto.bedrooms } : {}),
          ...(dto.bathrooms !== undefined ? { bathrooms: dto.bathrooms } : {}),
          ...(dto.area_sqft !== undefined ? { area_sqft: dto.area_sqft } : {}),
        },
        select: UNIT_SELECT,
      });

      await this.audit.writeLog(tx, {
        actorId,
        action: "unit.update",
        entityType: "Unit",
        entityId: id,
        before,
        after: updated,
      });

      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // State transition (PATCH /units/:id/state)
  // BL-04: state-machine guard for legal transitions.
  // ---------------------------------------------------------------------------

  async changeState(id: number, dto: UnitStateChangeDto, actorId: number) {
    const before = await this.findById(id);

    if (before.is_retired) {
      throw new ConflictException({
        error: {
          code: "UNIT_RETIRED",
          message: "Cannot change state of a retired unit",
        },
      });
    }

    // dto.state is a string like "AVAILABLE"; map to int code
    const STATE_NAME_TO_CODE: Record<string, UnitStateCode> = {
      AVAILABLE: 0, LISTED: 1, OCCUPIED: 2, MAINTENANCE: 3,
    };
    const targetState: UnitStateCode = STATE_NAME_TO_CODE[dto.state] ?? (Number(dto.state) as UnitStateCode);
    const currentState = before.state as UnitStateCode;
    const legalNext = LEGAL_TRANSITIONS[currentState] ?? [];

    if (!legalNext.includes(targetState)) {
      throw new ConflictException({
        error: {
          code: "UNIT_STATUS_BLOCKED",
          message: `Cannot transition unit from ${before.state} to ${targetState}. Legal transitions: ${legalNext.join(", ")}`,
          details: { from: before.state, to: targetState, legal_next: legalNext },
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.unit.update({
        where: { id },
        data: { state: targetState },
        select: UNIT_SELECT,
      });

      await this.audit.writeLog(tx, {
        actorId,
        action: "unit.state_change",
        entityType: "Unit",
        entityId: id,
        before: { state: before.state },
        after: { state: updated.state },
      });

      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // Retire unit (POST /units/:id/retire)
  // BL-05: one-way — is_retired=true is terminal. DB trigger also enforces this.
  // ---------------------------------------------------------------------------

  async retire(id: number, actorId: number) {
    const before = await this.findById(id);

    if (before.is_retired) {
      throw new ConflictException({
        error: {
          code: "UNIT_ALREADY_RETIRED",
          message: "Unit is already retired",
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.unit.update({
        where: { id },
        data: {
          is_retired: true,
          retired_at: new Date(),
          retired_by_user_id: actorId,
          // Set state to MAINTENANCE per plan (keeps the partial-index consistent
          // and prevents any accidental lease-link in Phase 3).
          state: UNIT_STATE.MAINTENANCE,
        },
        select: UNIT_SELECT,
      });

      await this.audit.writeLog(tx, {
        actorId,
        action: "unit.retire",
        entityType: "Unit",
        entityId: id,
        before,
        after: updated,
      });

      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // DELETE /units/:id — always 405 (units are retired, never deleted)
  // ---------------------------------------------------------------------------

  deleteNotAllowed(): never {
    throw new MethodNotAllowedException({
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Units cannot be deleted. Use POST /units/:id/retire to retire a unit (BL-05).",
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Enrich unit rows with scheduled-rent info (Change 5)
  // ---------------------------------------------------------------------------

  /**
   * For a list of unit rows, find any PENDING RentChangeSchedule for each unit
   * and append scheduledRent (new_amount_paise as string) and
   * scheduledRentEffectiveDate (YYYY-MM-DD) to the response shape.
   *
   * Done in a single batch query: one findMany for all unit IDs.
   */
  async enrichWithScheduledRent<T extends { id: number }>(
    units: T[],
  ): Promise<(T & { scheduledRent: string | null; scheduledRentEffectiveDate: string | null })[]> {
    if (units.length === 0) return [];

    const unitIds = units.map((u) => u.id);
    const pendingSchedules = await this.prisma.rentChangeSchedule.findMany({
      where: { unit_id: { in: unitIds }, status: 0 /* PENDING */ },
      select: { unit_id: true, new_amount_paise: true, effective_date: true },
    });

    // Build lookup: unitId → schedule
    const scheduleMap = new Map<number, { new_amount_paise: bigint; effective_date: Date }>();
    for (const s of pendingSchedules) {
      scheduleMap.set(s.unit_id, s);
    }

    return units.map((unit) => {
      const s = scheduleMap.get(unit.id);
      return {
        ...unit,
        scheduledRent: s ? s.new_amount_paise.toString() : null,
        scheduledRentEffectiveDate: s ? s.effective_date.toISOString().slice(0, 10) : null,
      };
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async getPropertyOrThrow(propertyId: number) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deleted_at: null },
    });
    if (!property) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: `Property ${propertyId} not found` },
      });
    }
    return property;
  }

  private isPrismaUniqueError(err: unknown): boolean {
    return (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    );
  }
}
