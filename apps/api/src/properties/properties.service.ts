import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { CreatePropertyDto } from "./dto/create-property.dto";
import type { UpdatePropertyDto } from "./dto/update-property.dto";
import type { TransferPmDto } from "./dto/transfer-pm.dto";
import type { JwtPayload } from "../auth/jwt.service";

/** Fields that are safe to return in API responses. */
const PROPERTY_SELECT = {
  id: true,
  name: true,
  address: true,
  city: true,
  state: true,
  pincode: true,
  timezone: true,
  active_pm_id: true,
  deleted_at: true,
  created_by_user_id: true,
  created_at: true,
  updated_at: true,
  active_pm: {
    select: { id: true, name: true, email: true, role: true, is_active: true },
  },
} as const;

@Injectable()
export class PropertiesService {
  private readonly logger = new Logger(PropertiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // List (cursor-based pagination)
  // ADMIN: all non-deleted properties.
  // PROPERTY_MANAGER: only the property assigned to them (BL-19).
  // ---------------------------------------------------------------------------

  async list(cursor?: string, limit = 20, actor?: JwtPayload) {
    const take = Math.min(limit, 100);

    // Scope for PROPERTY_MANAGER: only their assigned property.
    const where: { deleted_at: null; active_pm_id?: string } = { deleted_at: null };
    if (actor?.role === "PROPERTY_MANAGER") {
      where.active_pm_id = actor.sub;
    }

    const items = await this.prisma.property.findMany({
      where,
      select: PROPERTY_SELECT,
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
  // Create
  // ---------------------------------------------------------------------------

  async create(dto: CreatePropertyDto, actorId: string) {
    // Validate PM if provided
    if (dto.active_pm_id) {
      await this.validatePmAvailability(dto.active_pm_id);
    }

    return this.prisma.$transaction(async (tx) => {
      const property = await tx.property.create({
        data: {
          name: dto.name,
          address: dto.address,
          city: dto.city,
          state: dto.state,
          pincode: dto.pincode,
          timezone: dto.timezone ?? "Asia/Kolkata",
          active_pm_id: dto.active_pm_id ?? null,
          created_by_user_id: actorId,
        },
        select: PROPERTY_SELECT,
      });

      await this.audit.writeLog(tx, {
        actorId,
        action: "property.create",
        entityType: "Property",
        entityId: property.id,
        before: null,
        after: property,
      });

      return property;
    });
  }

  // ---------------------------------------------------------------------------
  // Find one
  // ---------------------------------------------------------------------------

  async findById(id: string) {
    const property = await this.prisma.property.findFirst({
      where: { id, deleted_at: null },
      select: PROPERTY_SELECT,
    });

    if (!property) {
      throw new NotFoundException({ error: { code: "RESOURCE_NOT_FOUND", message: `Property ${id} not found` } });
    }

    return property;
  }

  // ---------------------------------------------------------------------------
  // Update (PATCH /properties/:id — metadata only, not active_pm_id)
  // ---------------------------------------------------------------------------

  async update(id: string, dto: UpdatePropertyDto, actorId: string) {
    const before = await this.findById(id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.property.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.address !== undefined ? { address: dto.address } : {}),
          ...(dto.city !== undefined ? { city: dto.city } : {}),
          ...(dto.state !== undefined ? { state: dto.state } : {}),
          ...(dto.pincode !== undefined ? { pincode: dto.pincode } : {}),
          ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        },
        select: PROPERTY_SELECT,
      });

      await this.audit.writeLog(tx, {
        actorId,
        action: "property.update",
        entityType: "Property",
        entityId: id,
        before,
        after: updated,
      });

      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // Soft-delete (DELETE /properties/:id → sets deleted_at)
  // ---------------------------------------------------------------------------

  async softDelete(id: string, actorId: string) {
    const before = await this.findById(id);

    // Guard: cannot delete a property that has an assigned PM.
    if (before.active_pm_id) {
      throw new ConflictException({
        error: {
          code: "PROPERTY_HAS_ACTIVE_PM",
          message: "Transfer or unassign the PM before deleting this property",
        },
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.property.update({
        where: { id },
        data: { deleted_at: new Date() },
        select: PROPERTY_SELECT,
      });

      await this.audit.writeLog(tx, {
        actorId,
        action: "property.soft_delete",
        entityType: "Property",
        entityId: id,
        before,
        after: updated,
      });

      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // Transfer PM (POST /properties/:id/transfer-pm)
  // BL-19: each PM assigned to exactly one property.
  // BL-20: previous PM keeps read_only_audit access (logged here; enforced by scope guard).
  // ---------------------------------------------------------------------------

  async transferPm(id: string, dto: TransferPmDto, actorId: string) {
    const property = await this.findById(id);

    // Validate new PM if non-null
    if (dto.toPmId !== null) {
      await this.validatePmAvailability(dto.toPmId, id);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Write PropertyTransferLog (append-only, BL-20)
        await tx.propertyTransferLog.create({
          data: {
            property_id: id,
            from_pm_id: property.active_pm_id ?? null,
            to_pm_id: dto.toPmId,
            actor_id: actorId,
            note: dto.note ?? null,
          },
        });

        const before = property;

        const updated = await tx.property.update({
          where: { id },
          data: { active_pm_id: dto.toPmId },
          select: PROPERTY_SELECT,
        });

        await this.audit.writeLog(tx, {
          actorId,
          action: "property.transfer_pm",
          entityType: "Property",
          entityId: id,
          before: { active_pm_id: before.active_pm_id },
          after: { active_pm_id: updated.active_pm_id },
        });

        return updated;
      });
    } catch (err: unknown) {
      // Unique constraint on active_pm_id — two concurrent transfers for the same PM
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: string }).code === "P2002"
      ) {
        throw new ConflictException({
          error: {
            code: "PM_ALREADY_ASSIGNED",
            message: `PROPERTY_MANAGER ${dto.toPmId ?? "null"} is already assigned to another property. Transfer them first.`,
          },
        });
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Validates that a given user ID:
   * 1. Exists and is active.
   * 2. Has role PROPERTY_MANAGER.
   * 3. Is NOT already assigned to another property (BL-19).
   *
   * @param pmId         - The candidate PM user ID.
   * @param excludePropertyId - When transferring, exclude the current property
   *                           (the PM is already assigned here, so that's OK).
   */
  private async validatePmAvailability(pmId: string, excludePropertyId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: pmId } });

    if (!user || !user.is_active) {
      throw new BadRequestException({
        error: {
          code: "INVALID_PM_ROLE",
          message: `User ${pmId} not found or inactive`,
        },
      });
    }

    if (user.role !== "PROPERTY_MANAGER") {
      throw new BadRequestException({
        error: {
          code: "INVALID_PM_ROLE",
          message: `User ${pmId} is not a PROPERTY_MANAGER (role: ${user.role})`,
        },
      });
    }

    // Check if already assigned to another property (BL-19).
    const alreadyAssigned = await this.prisma.property.findFirst({
      where: {
        active_pm_id: pmId,
        deleted_at: null,
        ...(excludePropertyId ? { id: { not: excludePropertyId } } : {}),
      },
    });

    if (alreadyAssigned) {
      throw new ConflictException({
        error: {
          code: "PM_ALREADY_ASSIGNED",
          message: `PROPERTY_MANAGER ${pmId} is already assigned to property ${alreadyAssigned.id}. Transfer them first.`,
          details: { property_id: alreadyAssigned.id },
        },
      });
    }
  }
}
