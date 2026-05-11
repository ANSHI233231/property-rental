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
import type { UnitState } from "@prisma/client";

/**
 * Unit state transition rules (BL-04 / Phase 2 subset).
 * LISTED → OCCUPIED is allowed here so Admin can set test units to OCCUPIED.
 * Phase 3 adds the lease-link guard on top: transition to OCCUPIED is only
 * legal when creating/activating a lease (the lease module will use a different
 * service method that passes the lease context). The raw PATCH /units/:id/state
 * endpoint remains available for Admin override.
 */
const LEGAL_TRANSITIONS: Record<UnitState, UnitState[]> = {
  AVAILABLE: ["LISTED", "MAINTENANCE"],
  LISTED: ["AVAILABLE", "OCCUPIED", "MAINTENANCE"],
  OCCUPIED: ["MAINTENANCE"], // Phase 3 adds the lease-end path (OCCUPIED → AVAILABLE after termination)
  MAINTENANCE: ["AVAILABLE"],
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
} as const;

@Injectable()
export class UnitsService {
  private readonly logger = new Logger(UnitsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // List units for a property (cursor-based)
  // ---------------------------------------------------------------------------

  async list(propertyId: string, cursor?: string, limit = 20) {
    // Verify property exists
    await this.getPropertyOrThrow(propertyId);

    const take = Math.min(limit, 100);
    const items = await this.prisma.unit.findMany({
      where: { property_id: propertyId },
      select: UNIT_SELECT,
      orderBy: { created_at: "asc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > take;
    const data = hasMore ? items.slice(0, take) : items;
    const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

    return {
      data,
      meta: { next_cursor: nextCursor ?? null, has_more: hasMore },
    };
  }

  // ---------------------------------------------------------------------------
  // Create unit
  // ---------------------------------------------------------------------------

  async create(propertyId: string, dto: CreateUnitDto, actorId: string) {
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
            state: "AVAILABLE",
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

  async findById(id: string) {
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

  // ---------------------------------------------------------------------------
  // Update unit metadata (PATCH /units/:id)
  // BL-03: monthly_rent_paise change rejected if state ∈ {OCCUPIED, MAINTENANCE}.
  // ---------------------------------------------------------------------------

  async update(id: string, dto: UpdateUnitDto, actorId: string) {
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
            id: string;
            state: string;
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

          const lockingStates: UnitState[] = ["OCCUPIED", "MAINTENANCE"];
          if (lockingStates.includes(locked.state as UnitState)) {
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

  async changeState(id: string, dto: UnitStateChangeDto, actorId: string) {
    const before = await this.findById(id);

    if (before.is_retired) {
      throw new ConflictException({
        error: {
          code: "UNIT_RETIRED",
          message: "Cannot change state of a retired unit",
        },
      });
    }

    const targetState = dto.state as UnitState;
    const legalNext = LEGAL_TRANSITIONS[before.state as UnitState] ?? [];

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

  async retire(id: string, actorId: string) {
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
          state: "MAINTENANCE",
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
  // Helpers
  // ---------------------------------------------------------------------------

  private async getPropertyOrThrow(propertyId: string) {
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
