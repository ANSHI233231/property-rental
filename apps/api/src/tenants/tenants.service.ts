import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { UpdateTenantDto } from "./dto/update-tenant.dto";

/** Safe tenant shape returned in API responses. */
const TENANT_SELECT = {
  id: true,
  user_id: true,
  dob: true,
  id_proof_type: true,
  id_proof_number: true,
  emergency_contact_name: true,
  emergency_contact_phone: true,
  created_at: true,
  updated_at: true,
  user: {
    select: {
      id: true,
      email: true,
      phone: true,
      name: true,
      role: true,
      is_active: true,
    },
  },
} as const;

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // List tenants on active leases for a property (cursor-based)
  // ---------------------------------------------------------------------------

  async listByProperty(propertyId: string, cursor?: string, limit = 20) {
    // Verify property exists
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deleted_at: null },
    });
    if (!property) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: `Property ${propertyId} not found` },
      });
    }

    const take = Math.min(limit, 100);

    // Get tenants who have active LeaseTenant rows on leases in this property.
    const leaseTenants = await this.prisma.leaseTenant.findMany({
      where: {
        removed_at: null,
        lease: {
          status: "ACTIVE",
          unit: { property_id: propertyId },
        },
      },
      select: {
        tenant: { select: TENANT_SELECT },
        is_primary: true,
        lease_id: true,
      },
      orderBy: { joined_at: "asc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = leaseTenants.length > take;
    const data = hasMore ? leaseTenants.slice(0, take) : leaseTenants;

    return {
      data: data.map((lt) => ({ ...lt.tenant, is_primary: lt.is_primary, lease_id: lt.lease_id })),
      meta: {
        next_cursor: hasMore ? (data[data.length - 1]?.tenant.id ?? null) : null,
        has_more: hasMore,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Find single tenant by ID
  // ---------------------------------------------------------------------------

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: TENANT_SELECT,
    });

    if (!tenant) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: `Tenant ${id} not found` },
      });
    }

    return tenant;
  }

  // ---------------------------------------------------------------------------
  // Find tenant by user_id
  // ---------------------------------------------------------------------------

  async findByUserId(userId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { user_id: userId },
      select: TENANT_SELECT,
    });

    if (!tenant) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: `Tenant for user ${userId} not found` },
      });
    }

    return tenant;
  }

  // ---------------------------------------------------------------------------
  // Update personal info (PATCH /tenants/:id)
  // BL-16 note: MAINTENANCE role should not hit this route; the controller enforces roles.
  // ---------------------------------------------------------------------------

  async update(id: string, dto: UpdateTenantDto, actorId: string) {
    const before = await this.findById(id);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenant.update({
        where: { id },
        data: {
          ...(dto.dob !== undefined ? { dob: dto.dob ? new Date(dto.dob) : null } : {}),
          ...(dto.id_proof_type !== undefined ? { id_proof_type: dto.id_proof_type ?? null } : {}),
          ...(dto.id_proof_number !== undefined ? { id_proof_number: dto.id_proof_number ?? null } : {}),
          ...(dto.emergency_contact_name !== undefined
            ? { emergency_contact_name: dto.emergency_contact_name ?? null }
            : {}),
          ...(dto.emergency_contact_phone !== undefined
            ? { emergency_contact_phone: dto.emergency_contact_phone ?? null }
            : {}),
        },
        select: TENANT_SELECT,
      });

      await this.audit.writeLog(tx, {
        actorId,
        action: "tenant.update",
        entityType: "Tenant",
        entityId: id,
        before: { ...before, user: undefined },
        after: { ...updated, user: undefined },
      });

      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // Verify a tenant belongs to a specific lease (for tenant auth checks)
  // ---------------------------------------------------------------------------

  async assertTenantOnLease(tenantId: string, leaseId: string): Promise<void> {
    const lt = await this.prisma.leaseTenant.findFirst({
      where: { tenant_id: tenantId, lease_id: leaseId, removed_at: null },
    });
    if (!lt) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_NOT_ON_LEASE",
          message: "You are not a tenant on this lease",
        },
      });
    }
  }
}
