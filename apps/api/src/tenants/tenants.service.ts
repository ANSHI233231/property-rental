import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { UpdateTenantDto } from "./dto/update-tenant.dto";

/** Lease status ACTIVE int code */
const LEASE_ACTIVE = 0;

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

  async listByProperty(propertyId: number, cursor?: number, limit = 20, page?: number, pageSize?: number) {
    // Verify property exists
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, deleted_at: null },
    });
    if (!property) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: `Property ${propertyId} not found` },
      });
    }

    const useOffset = page !== undefined;
    const ps = pageSize !== undefined ? Math.min(Math.max(pageSize, 1), 100) : undefined;
    const take = useOffset ? (ps ?? 10) : Math.min(limit, 100);
    const currentPage = page ?? 1;

    const where = {
      removed_at: null,
      lease: {
        status: LEASE_ACTIVE,
        unit: { property_id: propertyId },
      },
    } as const;

    const ltSelect = {
      id: true,
      is_primary: true,
      lease_id: true,
      tenant_id: true,
    } as const;

    const ltFindMany = useOffset
      ? this.prisma.leaseTenant.findMany({
          where,
          select: ltSelect,
          orderBy: { joined_at: "asc" },
          skip: (currentPage - 1) * take,
          take,
        })
      : this.prisma.leaseTenant.findMany({
          where,
          select: ltSelect,
          orderBy: { joined_at: "asc" },
          take: take + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });

    const [leaseTenantRaw, total] = await Promise.all([
      ltFindMany,
      this.prisma.leaseTenant.count({ where }),
    ]);

    let hasMore: boolean;
    let data: typeof leaseTenantRaw;

    if (useOffset) {
      data = leaseTenantRaw;
      hasMore = currentPage * take < total;
    } else {
      hasMore = leaseTenantRaw.length > take;
      data = hasMore ? leaseTenantRaw.slice(0, take) : leaseTenantRaw;
    }

    // Hydrate tenant + lease + unit + co-tenants in three batched queries so
    // the FE table receives a fully-denormalised row (avoids N+1).
    const tenantIds = data.map((lt) => lt.tenant_id);
    const leaseIds = Array.from(new Set(data.map((lt) => lt.lease_id)));

    const [tenants, leases, coTenantLinks] = await Promise.all([
      this.prisma.tenant.findMany({
        where: { id: { in: tenantIds } },
        select: TENANT_SELECT,
      }),
      this.prisma.lease.findMany({
        where: { id: { in: leaseIds } },
        select: {
          id: true,
          start_date: true,
          end_date: true,
          monthly_rent_paise: true,
          status: true,
          unit: { select: { id: true, unit_number: true } },
        },
      }),
      // All active co-tenant links across the same leases — used to build
      // the co_tenants[] sibling list for each row.
      this.prisma.leaseTenant.findMany({
        where: { lease_id: { in: leaseIds }, removed_at: null },
        select: {
          lease_id: true,
          tenant_id: true,
          tenant: {
            select: { id: true, user: { select: { name: true } } },
          },
        },
      }),
    ]);

    const tenantMap = new Map(tenants.map((t) => [t.id, t]));
    const leaseMap = new Map(leases.map((l) => [l.id, l]));
    const coTenantsByLease = new Map<number, Array<{ id: number; name: string }>>();
    for (const link of coTenantLinks) {
      const arr = coTenantsByLease.get(link.lease_id) ?? [];
      arr.push({ id: link.tenant.id, name: link.tenant.user.name });
      coTenantsByLease.set(link.lease_id, arr);
    }

    return {
      data: data.map((lt) => {
        const tenant = tenantMap.get(lt.tenant_id);
        const lease = leaseMap.get(lt.lease_id);
        const user = tenant?.user;
        const coTenants = (coTenantsByLease.get(lt.lease_id) ?? []).filter(
          (c) => c.id !== lt.tenant_id,
        );
        return {
          // tenant identity + nested user (kept for back-compat)
          ...tenant,
          // Flattened user fields the FE table reads as top-level keys
          name: user?.name ?? null,
          email: user?.email ?? null,
          phone: user?.phone ?? null,
          // Lease + unit context
          lease_id: lt.lease_id,
          lease: lease
            ? {
                id: lease.id,
                start_date: lease.start_date,
                end_date: lease.end_date,
                monthly_rent_paise: lease.monthly_rent_paise.toString(),
                status: lease.status,
              }
            : null,
          unit: lease?.unit
            ? { id: lease.unit.id, name: lease.unit.unit_number }
            : null,
          co_tenants: coTenants,
          is_primary: lt.is_primary,
        };
      }),
      meta: {
        next_cursor: hasMore && !useOffset ? (data[data.length - 1]?.id ?? null) : null,
        has_more: hasMore,
        total,
        page: currentPage,
        page_size: take,
        total_pages: total === 0 ? 0 : Math.ceil(total / take),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Find single tenant by ID
  // ---------------------------------------------------------------------------

  async findById(id: number) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      select: TENANT_SELECT,
    });

    if (!tenant) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: `Tenant ${id} not found` },
      });
    }

    // Hydrate the most recent active LeaseTenant link (if any) so the
    // tenant-detail page receives lease + unit + co_tenants alongside the
    // flat user fields, matching the FE's expected shape.
    const link = await this.prisma.leaseTenant.findFirst({
      where: { tenant_id: id, removed_at: null, lease: { status: LEASE_ACTIVE } },
      orderBy: { joined_at: "desc" },
      select: {
        lease_id: true,
        is_primary: true,
        lease: {
          select: {
            id: true,
            start_date: true,
            end_date: true,
            monthly_rent_paise: true,
            status: true,
            unit: { select: { id: true, unit_number: true } },
          },
        },
      },
    });

    let coTenants: Array<{ id: number; name: string }> = [];
    if (link) {
      const peers = await this.prisma.leaseTenant.findMany({
        where: { lease_id: link.lease_id, removed_at: null, tenant_id: { not: id } },
        select: { tenant: { select: { id: true, user: { select: { name: true } } } } },
      });
      coTenants = peers.map((p) => ({ id: p.tenant.id, name: p.tenant.user.name }));
    }

    const user = tenant.user;
    return {
      ...tenant,
      // Flattened user fields (FE reads tenant.name / .email / .phone)
      name: user?.name ?? null,
      email: user?.email ?? null,
      phone: user?.phone ?? null,
      // Lease + unit context (matches PM Tenants detail page expectations)
      lease_id: link?.lease_id ?? null,
      lease: link?.lease
        ? {
            id: link.lease.id,
            start_date: link.lease.start_date,
            end_date: link.lease.end_date,
            monthly_rent_paise: link.lease.monthly_rent_paise.toString(),
            status: link.lease.status,
          }
        : null,
      unit: link?.lease?.unit
        ? { id: link.lease.unit.id, name: link.lease.unit.unit_number }
        : null,
      co_tenants: coTenants,
      is_primary: link?.is_primary ?? null,
    };
  }

  // ---------------------------------------------------------------------------
  // Find tenant by user_id
  // ---------------------------------------------------------------------------

  async findByUserId(userId: number) {
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

  async update(id: number, dto: UpdateTenantDto, actorId: number) {
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

  async assertTenantOnLease(tenantId: number, leaseId: number): Promise<void> {
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
