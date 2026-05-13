import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { HashingService } from "../auth/hashing.service";
import type { CreateLeaseDto } from "./dto/create-lease.dto";
import type { RenewLeaseDto } from "./dto/renew-lease.dto";
import type { TerminationRequestDto } from "./dto/termination-request.dto";
import type { TerminationApprovalDto } from "./dto/termination-approval.dto";
import type { DepositRefundDto } from "./dto/deposit-refund.dto";
import { RentService } from "../rent/rent.service";

/** Lease status int codes */
export const LEASE_STATUS = {
  ACTIVE: 0,
  EXPIRED: 1,
  RENEWED: 2,
  TERMINATED: 3,
} as const;

/** Termination approval status int codes */
export const APPROVAL_STATUS = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
} as const;

/** Unit state int codes (mirrors units.service.ts UNIT_STATE) */
const UNIT_STATE = { AVAILABLE: 0, LISTED: 1, OCCUPIED: 2, MAINTENANCE: 3 } as const;

/** Role int codes */
const ROLE = { ADMIN: 0, PROPERTY_MANAGER: 1, MAINTENANCE: 2, TENANT: 3 } as const;

/** Generate a temporary password for auto-created tenant accounts. */
function generateTempPassword(): string {
  return `Tmp@${randomBytes(6).toString("hex")}`;
}

/** Safe lease select shape for API responses. */
const LEASE_SELECT = {
  id: true,
  unit_id: true,
  start_date: true,
  end_date: true,
  monthly_rent_paise: true,
  security_deposit_paise: true,
  late_fee_per_day_paise: true,
  status: true,
  signed_by_pm_id: true,
  signed_at: true,
  terminated_at: true,
  created_at: true,
  updated_at: true,
} as const;

type LeaseRow = Prisma.LeaseGetPayload<{ select: typeof LEASE_SELECT }>;

/** Converts BigInt paise fields to strings for JSON serialization. */
function serializeLease(lease: LeaseRow & Record<string, unknown>): Record<string, unknown> {
  return {
    ...lease,
    monthly_rent_paise: lease.monthly_rent_paise.toString(),
    security_deposit_paise: lease.security_deposit_paise.toString(),
    late_fee_per_day_paise: lease.late_fee_per_day_paise.toString(),
  };
}

/** Checks whether a Prisma error is a unique-constraint violation. */
function isPrismaUniqueError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

@Injectable()
export class LeasesService {
  private readonly logger = new Logger(LeasesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly hashing: HashingService,
    private readonly rentService: RentService,
  ) {}

  // ---------------------------------------------------------------------------
  // Create lease (POST /properties/:propertyId/units/:unitId/leases)
  // BL-01: partial unique index prevents two ACTIVE leases on same unit.
  // BL-04: unit.state -> OCCUPIED inside same transaction.
  // BL-07: at least one tenant.
  // ---------------------------------------------------------------------------

  async create(
    propertyId: number,
    unitId: number,
    dto: CreateLeaseDto,
    actorId: number,
  ) {
    // Date-order guard: endDate must be strictly after startDate (BUG-008-002)
    if (new Date(dto.endDate) <= new Date(dto.startDate)) {
      throw new BadRequestException({
        error: {
          code: "INVALID_LEASE_DATES",
          message: "End date must be after start date.",
        },
      });
    }

    // BL-07 guard (DTO-level validator also enforces, belt-and-suspenders)
    if (!dto.tenants || dto.tenants.length === 0) {
      throw new BadRequestException({
        error: {
          code: "LEASE_NEEDS_TENANT",
          message: "At least one tenant is required to create a lease (BL-07)",
        },
      });
    }

    // Verify unit exists in this property
    const unit = await this.prisma.unit.findFirst({
      where: { id: unitId, property_id: propertyId },
    });
    if (!unit) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: `Unit ${unitId} not found in property ${propertyId}` },
      });
    }

    // Cannot lease a retired unit
    if (unit.is_retired) {
      throw new ConflictException({
        error: { code: "UNIT_RETIRED", message: "Cannot lease a retired unit" },
      });
    }

    // BL-04: unit must not be in a state that blocks leasing (MAINTENANCE=3)
    if (unit.state === UNIT_STATE.MAINTENANCE) {
      throw new ConflictException({
        error: {
          code: "UNIT_STATUS_BLOCKED",
          message: `Unit is in MAINTENANCE state and cannot be leased`,
          details: { current_state: unit.state },
        },
      });
    }

    // BL-18: 24-hour turnover gap. If this unit had a lease terminated in the last 24 hours,
    // reject the new lease creation.
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentTermination = await this.prisma.lease.findFirst({
      where: {
        unit_id: unitId,
        status: LEASE_STATUS.TERMINATED,
        terminated_at: { gte: twentyFourHoursAgo },
      },
      select: { id: true, terminated_at: true },
    });
    if (recentTermination) {
      throw new ConflictException({
        error: {
          code: "TURNOVER_GAP_REQUIRED",
          message: `Unit had a lease terminated less than 24 hours ago (BL-18). Wait until ${new Date(recentTermination.terminated_at!.getTime() + 24 * 60 * 60 * 1000).toISOString()}.`,
          details: { previous_terminated_at: recentTermination.terminated_at },
        },
      });
    }

    // Pre-compute temp passwords outside the transaction (Argon2 is slow)
    type TenantCreationEntry = {
      name: string;
      email: string;
      phone?: string;
      is_primary: boolean;
      dob?: string;
      id_proof_type?: string;
      id_proof_number?: string;
      emergency_contact_name?: string;
      emergency_contact_phone?: string;
      tempPassword?: string;
      passwordHash?: string;
    };

    const tenantCreationData: TenantCreationEntry[] = [];

    for (const t of dto.tenants) {
      const existing = await this.prisma.user.findUnique({ where: { email: t.email } });
      if (existing && existing.role !== ROLE.TENANT) {
        throw new ConflictException({
          error: {
            code: "USER_NOT_TENANT",
            message: `User with email ${t.email} exists but has role ${existing.role}. Cannot assign as tenant.`,
          },
        });
      }

      // Strip the incoming `password` field — it never belongs on the
      // creation entry; we feed it into the hash and discard.
      const { password: pmSuppliedPassword, ...rest } = t;

      if (!existing) {
        // PM may set the initial password during lease signing. If they did,
        // use it verbatim; otherwise fall back to a generated temp password
        // (preserves backward-compat with callers that don't supply one).
        const pw =
          pmSuppliedPassword && pmSuppliedPassword.length > 0
            ? pmSuppliedPassword
            : generateTempPassword();
        const hash = await this.hashing.hashPassword(pw);
        tenantCreationData.push({ ...rest, tempPassword: pw, passwordHash: hash });
      } else {
        // Existing account — the BE never overwrites an existing user's
        // password from the lease form. Any password the FE sent for this
        // row is silently dropped here.
        tenantCreationData.push({ ...rest });
      }
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const tenantResults: Array<{
            tenantId: number;
            userId: number;
            name: string;
            email: string;
            isPrimary: boolean;
            tempPassword?: string;
          }> = [];

          for (const td of tenantCreationData) {
            // Upsert User by email
            let user = await tx.user.findUnique({ where: { email: td.email } });

            if (!user) {
              user = await tx.user.create({
                data: {
                  email: td.email,
                  phone: td.phone ?? null,
                  name: td.name,
                  role: ROLE.TENANT,
                  password_hash: td.passwordHash!,
                  created_by_user_id: actorId,
                },
              });

              await this.audit.writeLog(tx, {
                actorId,
                action: "user.create",
                entityType: "User",
                entityId: user.id,
                before: null,
                after: { id: user.id, email: user.email, role: user.role },
              });
            }

            // Upsert Tenant row (1:1 with User)
            let tenant = await tx.tenant.findUnique({ where: { user_id: user.id } });

            if (!tenant) {
              tenant = await tx.tenant.create({
                data: {
                  user_id: user.id,
                  dob: td.dob ? new Date(td.dob) : null,
                  id_proof_type: td.id_proof_type ?? null,
                  id_proof_number: td.id_proof_number ?? null,
                  emergency_contact_name: td.emergency_contact_name ?? null,
                  emergency_contact_phone: td.emergency_contact_phone ?? null,
                },
              });

              await this.audit.writeLog(tx, {
                actorId,
                action: "tenant.create",
                entityType: "Tenant",
                entityId: tenant.id,
                before: null,
                after: { id: tenant.id, user_id: tenant.user_id },
              });
            }

            tenantResults.push({
              tenantId: tenant.id,
              userId: user.id,
              name: td.name,
              email: td.email,
              isPrimary: td.is_primary,
              tempPassword: td.tempPassword,
            });
          }

          // Create the Lease
          const lease = await tx.lease.create({
            data: {
              unit_id: unitId,
              start_date: new Date(dto.startDate),
              end_date: new Date(dto.endDate),
              monthly_rent_paise: BigInt(dto.monthlyRentPaise),
              security_deposit_paise: BigInt(dto.securityDepositPaise),
              status: LEASE_STATUS.ACTIVE,
              signed_by_pm_id: actorId,
              signed_at: new Date(),
            },
            select: LEASE_SELECT,
          });

          await this.audit.writeLog(tx, {
            actorId,
            action: "lease.create",
            entityType: "Lease",
            entityId: lease.id,
            before: null,
            after: {
              ...lease,
              monthly_rent_paise: lease.monthly_rent_paise.toString(),
              security_deposit_paise: lease.security_deposit_paise.toString(),
              late_fee_per_day_paise: lease.late_fee_per_day_paise.toString(),
            },
          });

          // Create LeaseTenant rows
          for (const tr of tenantResults) {
            await tx.leaseTenant.create({
              data: {
                lease_id: lease.id,
                tenant_id: tr.tenantId,
                is_primary: tr.isPrimary,
              },
            });

            await this.audit.writeLog(tx, {
              actorId,
              action: "lease_tenant.create",
              entityType: "LeaseTenant",
              entityId: `${lease.id}:${tr.tenantId}`,
              before: null,
              after: { lease_id: lease.id, tenant_id: tr.tenantId, is_primary: tr.isPrimary },
            });
          }

          // BL-04: set unit state to OCCUPIED
          const prevState = unit.state;
          await tx.unit.update({
            where: { id: unitId },
            data: { state: UNIT_STATE.OCCUPIED },
          });

          await this.audit.writeLog(tx, {
            actorId,
            action: "unit.state_change",
            entityType: "Unit",
            entityId: unitId,
            before: { state: prevState },
            after: { state: UNIT_STATE.OCCUPIED },
          });

          // Phase 4: generate the first rent period inside the same transaction (BL-12/BL-13).
          // period_start = lease.start_date, grace_days = 0, status = DUE.
          await this.rentService.generateFirstPeriod(
            tx,
            lease.id,
            lease.start_date,
            lease.monthly_rent_paise,
            actorId,
          );

          return {
            lease: serializeLease(lease),
            tenants: tenantResults.map((tr) => ({
              // FC-1: `id` is the canonical Tenant.id field expected by the frontend.
              // `tenantId` is kept as an alias for backward compatibility.
              id: tr.tenantId,
              tenantId: tr.tenantId,
              userId: tr.userId,
              name: tr.name,
              email: tr.email,
              isPrimary: tr.isPrimary,
              ...(tr.tempPassword ? { tempPassword: tr.tempPassword } : {}),
            })),
          };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (err) {
      if (isPrismaUniqueError(err)) {
        // The partial unique index on leases(unit_id) WHERE status=0(ACTIVE) fired
        throw new ConflictException({
          error: {
            code: "UNIT_HAS_ACTIVE_LEASE",
            message: `Unit ${unitId} already has an active lease`,
          },
        });
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // List leases (GET /leases?propertyId=&unitId=&tenantId=&status=&cursor=&limit=)
  // FC-2: tenantId filter accepts User.id and joins through tenant.user_id internally.
  // ---------------------------------------------------------------------------

  async list(filters: {
    propertyId?: number | string;
    unitId?: number | string;
    tenantId?: number | string;
    status?: string;
    cursor?: number;
    limit?: number;
    page?: number;
    pageSize?: number;
    actorId: number;
    actorRole: number;
  }) {
    const useOffset = filters.page !== undefined;
    const ps = filters.pageSize !== undefined ? Math.min(Math.max(filters.pageSize, 1), 100) : undefined;
    const take = useOffset ? (ps ?? 10) : Math.min(filters.limit ?? 20, 100);
    const currentPage = filters.page ?? 1;

    // Build where clause with proper Prisma types
    let where: Prisma.LeaseWhereInput = {};

    if (filters.unitId !== undefined) {
      where = { ...where, unit_id: Number(filters.unitId) };
    }

    if (filters.status !== undefined) {
      // Accept status as a name string ("ACTIVE", "TERMINATED") or numeric string
      const STATUS_NAME_TO_CODE: Record<string, number> = {
        ACTIVE: LEASE_STATUS.ACTIVE,
        EXPIRED: LEASE_STATUS.EXPIRED,
        RENEWED: LEASE_STATUS.RENEWED,
        TERMINATED: LEASE_STATUS.TERMINATED,
      };
      const statusCode = STATUS_NAME_TO_CODE[filters.status.toUpperCase()] ??
        (isNaN(Number(filters.status)) ? undefined : Number(filters.status));
      if (statusCode !== undefined) {
        where = { ...where, status: statusCode };
      }
    }

    if (filters.propertyId !== undefined) {
      where = { ...where, unit: { property_id: Number(filters.propertyId) } };
    }

    if (filters.tenantId !== undefined) {
      // FC-2: tenantId param is treated as User.id (JWT sub claim).
      // Join through tenant.user_id so the FE can use its auth context directly.
      where = {
        ...where,
        lease_tenants: {
          some: {
            tenant: { user_id: Number(filters.tenantId) },
            removed_at: null,
          },
        },
      };
    }

    // PROPERTY_MANAGER: scope to their property only (role code 1)
    if (filters.actorRole === ROLE.PROPERTY_MANAGER) {
      const managedProperty = await this.prisma.property.findFirst({
        where: { active_pm_id: filters.actorId, deleted_at: null },
        select: { id: true },
      });
      if (managedProperty) {
        where = {
          ...where,
          unit: { ...(where.unit as Prisma.UnitWhereInput ?? {}), property_id: managedProperty.id },
        };
      } else {
        return {
          data: [],
          meta: { next_cursor: null, has_more: false, total: 0, page: currentPage, page_size: take, total_pages: 0 },
        };
      }
    }

    const findManySelect = {
      ...LEASE_SELECT,
      unit: { select: { id: true, unit_number: true } },
      lease_tenants: {
        where: { removed_at: null },
        select: {
          is_primary: true,
          tenant: {
            select: {
              id: true,
              user_id: true,
              user: { select: { id: true, name: true, email: true, phone: true } },
            },
          },
        },
      },
    } as const;

    // Explicit-branch findMany avoids a TS inference issue with conditional
    // spread of `cursor`/`skip` (Prisma's typed args don't unify cleanly).
    const findManyPromise = useOffset
      ? this.prisma.lease.findMany({
          where,
          select: findManySelect,
          orderBy: { created_at: "asc" },
          skip: (currentPage - 1) * take,
          take,
        })
      : this.prisma.lease.findMany({
          where,
          select: findManySelect,
          orderBy: { created_at: "asc" },
          take: take + 1,
          ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
        });

    const [items, total] = await this.prisma.$transaction([
      findManyPromise,
      this.prisma.lease.count({ where }),
    ]);

    let hasMore: boolean;
    let data: typeof items;
    let nextCursor: number | undefined;

    if (useOffset) {
      data = items;
      hasMore = currentPage * take < total;
      nextCursor = undefined;
    } else {
      hasMore = items.length > take;
      data = hasMore ? items.slice(0, take) : items;
      nextCursor = hasMore ? data[data.length - 1]?.id : undefined;
    }

    const totalPages = total === 0 ? 0 : Math.ceil(total / take);

    return {
      // Flatten unit + tenants for the FE table contract.
      // `lease_tenants` is still returned alongside for any consumer that
      // wants the raw nested shape.
      data: data.map((l) => {
        const serialized = serializeLease(l as LeaseRow & Record<string, unknown>);
        const lt = (l as unknown as {
          unit: { id: number; unit_number: string } | null;
          lease_tenants: Array<{
            is_primary: boolean;
            tenant: { id: number; user: { name: string } };
          }>;
        });
        return {
          ...serialized,
          unit: lt.unit ? { id: lt.unit.id, name: lt.unit.unit_number } : null,
          tenants: lt.lease_tenants.map((row) => ({
            id: row.tenant.id,
            name: row.tenant.user.name,
            is_primary: row.is_primary,
          })),
        };
      }),
      meta: { next_cursor: nextCursor ?? null, has_more: hasMore, total, page: currentPage, page_size: take, total_pages: totalPages },
    };
  }

  // ---------------------------------------------------------------------------
  // Get single lease (GET /leases/:id)
  // ---------------------------------------------------------------------------

  async findById(id: number): Promise<LeaseRow> {
    const lease = await this.prisma.lease.findUnique({
      where: { id },
      select: LEASE_SELECT,
    });

    if (!lease) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: `Lease ${id} not found` },
      });
    }

    return lease;
  }

  /** Returns the lease serialized for API responses (BigInt → string). */
  async findByIdForResponse(id: number) {
    const lease = await this.findById(id);

    // Also load tenants for the single-lease endpoint
    const leaseTenants = await this.prisma.leaseTenant.findMany({
      where: { lease_id: id },
      select: {
        id: true,
        is_primary: true,
        joined_at: true,
        removed_at: true,
        tenant: {
          select: {
            id: true,
            user_id: true,
            dob: true,
            id_proof_type: true,
            emergency_contact_name: true,
            emergency_contact_phone: true,
            user: { select: { id: true, name: true, email: true, phone: true, role: true } },
          },
        },
      },
    });

    // Load the unit so the FE detail page can render unit_number / property.
    const unit = await this.prisma.unit.findUnique({
      where: { id: lease.unit_id },
      select: {
        id: true,
        unit_number: true,
        property: { select: { id: true, name: true } },
      },
    });

    // Flatten unit + tenants for the FE contract. Raw `lease_tenants` is
    // kept alongside so existing consumers that walked the nested shape
    // continue to work.
    return {
      ...serializeLease(lease),
      unit: unit ? { id: unit.id, name: unit.unit_number, property: unit.property } : null,
      tenants: leaseTenants
        .filter((lt) => lt.removed_at === null)
        .map((lt) => ({
          id: lt.tenant.id,
          name: lt.tenant.user.name,
          email: lt.tenant.user.email,
          phone: lt.tenant.user.phone,
          is_primary: lt.is_primary,
        })),
      lease_tenants: leaseTenants,
    };
  }

  // ---------------------------------------------------------------------------
  // Renew lease (POST /leases/:id/renew)
  // BL-02: creates a NEW lease; marks old as RENEWED.
  // BL-04: unit stays OCCUPIED throughout.
  // ---------------------------------------------------------------------------

  async renew(leaseId: number, dto: RenewLeaseDto, actorId: number) {
    const existing = await this.findById(leaseId);

    if (existing.status !== LEASE_STATUS.ACTIVE) {
      throw new ConflictException({
        error: {
          code: "LEASE_NOT_ACTIVE",
          message: `Cannot renew a lease with status ${existing.status}`,
        },
      });
    }

    // Renewal end date must extend beyond the current lease's end date (BUG-008-002)
    if (new Date(dto.newEndDate) <= new Date(existing.end_date)) {
      throw new BadRequestException({
        error: {
          code: "INVALID_LEASE_DATES",
          message: "Renewal newEndDate must be after the current lease end date.",
        },
      });
    }

    // Idempotency: if a renewal was done for this unit in the last 5 seconds by the same PM
    const recentRenew = await this.prisma.lease.findFirst({
      where: {
        unit_id: existing.unit_id,
        status: LEASE_STATUS.ACTIVE,
        signed_by_pm_id: actorId,
        id: { not: leaseId },
        created_at: { gte: new Date(Date.now() - 5000) },
      },
      select: LEASE_SELECT,
    });

    if (recentRenew) {
      this.logger.log(`Idempotent renew: returning recently created lease ${recentRenew.id}`);
      return serializeLease(recentRenew);
    }

    // Get current tenants
    const leaseTenants = await this.prisma.leaseTenant.findMany({
      where: { lease_id: leaseId, removed_at: null },
      select: { tenant_id: true, is_primary: true },
    });

    // Filter to requested tenantIds if provided
    const tenantsToCarry = dto.tenantIds
      ? leaseTenants.filter((lt) => dto.tenantIds!.includes(lt.tenant_id))
      : leaseTenants;

    if (tenantsToCarry.length === 0) {
      throw new BadRequestException({
        error: {
          code: "LEASE_NEEDS_TENANT",
          message: "Renewed lease must have at least one tenant",
        },
      });
    }

    return this.prisma.$transaction(
      async (tx) => {
        // Mark old lease as RENEWED (BL-02 trigger: we don't change rent fields here)
        await tx.lease.update({
          where: { id: leaseId },
          data: { status: LEASE_STATUS.RENEWED },
        });

        await this.audit.writeLog(tx, {
          actorId,
          action: "lease.renew_old",
          entityType: "Lease",
          entityId: leaseId,
          before: { status: LEASE_STATUS.ACTIVE },
          after: { status: LEASE_STATUS.RENEWED },
        });

        // Create new lease
        const newLease = await tx.lease.create({
          data: {
            unit_id: existing.unit_id,
            start_date: existing.end_date, // new lease starts where old one ended
            end_date: new Date(dto.newEndDate),
            monthly_rent_paise: dto.monthlyRentPaise
              ? BigInt(dto.monthlyRentPaise)
              : existing.monthly_rent_paise,
            security_deposit_paise: dto.securityDepositPaise !== undefined
              ? BigInt(dto.securityDepositPaise)
              : existing.security_deposit_paise,
            status: LEASE_STATUS.ACTIVE,
            signed_by_pm_id: actorId,
          },
          select: LEASE_SELECT,
        });

        await this.audit.writeLog(tx, {
          actorId,
          action: "lease.create",
          entityType: "Lease",
          entityId: newLease.id,
          before: { renewed_from: leaseId },
          after: {
            ...newLease,
            monthly_rent_paise: newLease.monthly_rent_paise.toString(),
            security_deposit_paise: newLease.security_deposit_paise.toString(),
          },
        });

        // Carry tenants over to new lease
        for (const lt of tenantsToCarry) {
          await tx.leaseTenant.create({
            data: {
              lease_id: newLease.id,
              tenant_id: lt.tenant_id,
              is_primary: lt.is_primary,
            },
          });
        }

        // Mark old LeaseTenant rows as removed
        await tx.leaseTenant.updateMany({
          where: { lease_id: leaseId, removed_at: null },
          data: { removed_at: new Date() },
        });

        return serializeLease(newLease);
      },
      { isolationLevel: "Serializable" },
    );
  }

  // ---------------------------------------------------------------------------
  // Request termination (POST /leases/:id/terminate-request)
  // BL-08 / BL-09: creates approval rows for all co-tenants.
  // H-01: TENANT caller must be the same person as requestedByTenantId.
  // M-01: allLeaseTenants read moved inside the Serializable transaction.
  // ---------------------------------------------------------------------------

  async requestTermination(
    leaseId: number,
    dto: TerminationRequestDto,
    actorId: number,
    actorRole: number,
  ) {
    const lease = await this.findById(leaseId);

    if (lease.status !== LEASE_STATUS.ACTIVE) {
      throw new ConflictException({
        error: {
          code: "LEASE_NOT_ACTIVE",
          message: `Cannot request termination on a lease with status ${lease.status}`,
        },
      });
    }

    // H-01: if the caller is a TENANT, derive their Tenant.id from the JWT User.id
    // and assert it equals dto.requestedByTenantId.  PMs may pass any requestedByTenantId
    // on the lease (PM-initiated termination flow).
    if (actorRole === ROLE.TENANT) {
      const callerTenant = await this.prisma.tenant.findUnique({
        where: { user_id: actorId },
        select: { id: true },
      });
      if (!callerTenant || callerTenant.id !== dto.requestedByTenantId) {
        throw new ForbiddenException({
          error: {
            code: "FORBIDDEN_TENANT_ACTION",
            message: "You can only request termination on your own behalf (H-01)",
          },
        });
      }
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // M-01: verify tenant and read all lease tenants INSIDE the Serializable tx
          const requestingTenant = await tx.tenant.findUnique({
            where: { id: dto.requestedByTenantId },
          });
          if (!requestingTenant) {
            throw new NotFoundException({
              error: { code: "RESOURCE_NOT_FOUND", message: `Tenant ${dto.requestedByTenantId} not found` },
            });
          }

          const requesterOnLease = await tx.leaseTenant.findFirst({
            where: { lease_id: leaseId, tenant_id: dto.requestedByTenantId, removed_at: null },
          });
          if (!requesterOnLease) {
            throw new ForbiddenException({
              error: {
                code: "TENANT_NOT_ON_LEASE",
                message: "The requesting tenant is not on this lease",
              },
            });
          }

          // M-01: read all tenants inside the transaction (TOCTOU fix)
          const allLeaseTenants = await tx.leaseTenant.findMany({
            where: { lease_id: leaseId, removed_at: null },
            select: { tenant_id: true },
          });

          const termination = await tx.leaseTermination.create({
            data: {
              lease_id: leaseId,
              requested_by_tenant_id: dto.requestedByTenantId,
              reason: dto.reason ?? null,
              effective_date: new Date(dto.effectiveDate),
            },
          });

          await this.audit.writeLog(tx, {
            actorId,
            action: "lease_termination.request",
            entityType: "LeaseTermination",
            entityId: termination.id,
            before: null,
            after: { lease_id: leaseId, requested_by_tenant_id: dto.requestedByTenantId },
          });

          // Requester is auto-APPROVED; all others are PENDING
          for (const lt of allLeaseTenants) {
            const isRequester = lt.tenant_id === dto.requestedByTenantId;
            await tx.leaseTerminationApproval.create({
              data: {
                termination_id: termination.id,
                tenant_id: lt.tenant_id,
                status: isRequester ? APPROVAL_STATUS.APPROVED : APPROVAL_STATUS.PENDING,
                responded_at: isRequester ? new Date() : null,
                note: isRequester ? "Requester auto-approved" : null,
              },
            });
          }

          return {
            termination: {
              id: termination.id,
              lease_id: termination.lease_id,
              requested_by_tenant_id: termination.requested_by_tenant_id,
              requested_at: termination.requested_at,
              effective_date: termination.effective_date,
              reason: termination.reason,
              tenant_count: allLeaseTenants.length,
              pending_approvals: allLeaseTenants.length - 1,
            },
          };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (err) {
      if (isPrismaUniqueError(err)) {
        throw new ConflictException({
          error: {
            code: "TERMINATION_OPEN",
            message: "An open termination request already exists for this lease",
          },
        });
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Approve/reject termination (POST /leases/:id/terminate-approve)
  // H-01: TENANT caller must be voting for themselves only.
  // H-01: PROPERTY_MANAGER cannot approve on behalf of tenants.
  // M-01: Serializable isolation.
  // ---------------------------------------------------------------------------

  async approveTermination(
    leaseId: number,
    dto: TerminationApprovalDto,
    actorId: number,
    actorRole: number,
  ) {
    // H-01: PMs and non-ADMIN roles cannot cast votes on behalf of tenants.
    // Only TENANT self-vote and ADMIN are allowed.
    if (actorRole === ROLE.PROPERTY_MANAGER) {
      throw new ForbiddenException({
        error: {
          code: "FORBIDDEN_TENANT_ACTION",
          message: "Property managers cannot approve termination on behalf of a tenant (H-01). Only the tenant themselves or ADMIN may cast this vote.",
        },
      });
    }

    // H-01: if the caller is a TENANT, they may only vote for their own approval row.
    if (actorRole === ROLE.TENANT) {
      const callerTenant = await this.prisma.tenant.findUnique({
        where: { user_id: actorId },
        select: { id: true },
      });
      if (!callerTenant || callerTenant.id !== dto.tenantId) {
        throw new ForbiddenException({
          error: {
            code: "FORBIDDEN_TENANT_ACTION",
            message: "You can only vote on your own termination approval (H-01)",
          },
        });
      }
    }

    return this.prisma.$transaction(
      async (tx) => {
        const termination = await tx.leaseTermination.findFirst({
          where: { lease_id: leaseId, finalized_at: null, withdrawn_at: null },
        });

        if (!termination) {
          throw new NotFoundException({
            error: {
              code: "NO_OPEN_TERMINATION",
              message: "No open termination request found for this lease",
            },
          });
        }

        const approval = await tx.leaseTerminationApproval.findFirst({
          where: { termination_id: termination.id, tenant_id: dto.tenantId },
        });

        if (!approval) {
          throw new NotFoundException({
            error: {
              code: "APPROVAL_NOT_FOUND",
              message: `No approval row found for tenant ${dto.tenantId} on this termination`,
            },
          });
        }

        const updated = await tx.leaseTerminationApproval.update({
          where: { id: approval.id },
          data: {
            status: dto.decision,
            responded_at: new Date(),
            note: dto.note ?? null,
          },
        });

        await this.audit.writeLog(tx, {
          actorId,
          action: "lease_termination.approval",
          entityType: "LeaseTerminationApproval",
          entityId: approval.id,
          before: { status: approval.status },
          after: { status: dto.decision, note: dto.note },
        });

        return { approval: updated };
      },
      { isolationLevel: "Serializable" },
    );
  }

  // ---------------------------------------------------------------------------
  // Withdraw termination (POST /leases/:id/terminate-withdraw)
  // H-01: TENANT caller must be the requester themselves.
  // M-01: Serializable isolation.
  // ---------------------------------------------------------------------------

  async withdrawTermination(
    leaseId: number,
    requestingTenantId: number,
    actorId: number,
    actorRole: number,
  ) {
    // H-01: TENANT caller must prove they ARE the requester before we even look up the termination.
    if (actorRole === ROLE.TENANT) {
      const callerTenant = await this.prisma.tenant.findUnique({
        where: { user_id: actorId },
        select: { id: true },
      });
      if (!callerTenant || callerTenant.id !== requestingTenantId) {
        throw new ForbiddenException({
          error: {
            code: "FORBIDDEN_TENANT_ACTION",
            message: "You can only withdraw a termination request that you initiated (H-01)",
          },
        });
      }
    }

    return this.prisma.$transaction(
      async (tx) => {
        const termination = await tx.leaseTermination.findFirst({
          where: { lease_id: leaseId, finalized_at: null, withdrawn_at: null },
        });

        if (!termination) {
          throw new NotFoundException({
            error: {
              code: "NO_OPEN_TERMINATION",
              message: "No open termination request found for this lease",
            },
          });
        }

        if (termination.requested_by_tenant_id !== requestingTenantId) {
          throw new ForbiddenException({
            error: {
              code: "ONLY_REQUESTER_CAN_WITHDRAW",
              message: "Only the tenant who requested the termination can withdraw it",
            },
          });
        }

        const updated = await tx.leaseTermination.update({
          where: { id: termination.id },
          data: { withdrawn_at: new Date() },
        });

        await this.audit.writeLog(tx, {
          actorId,
          action: "lease_termination.withdraw",
          entityType: "LeaseTermination",
          entityId: termination.id,
          before: { withdrawn_at: null },
          after: { withdrawn_at: updated.withdrawn_at },
        });

        return { termination: updated };
      },
      { isolationLevel: "Serializable" },
    );
  }

  // ---------------------------------------------------------------------------
  // Finalize termination (POST /leases/:id/finalize-termination)
  // BL-04: unit → AVAILABLE. BL-18: 24-hour turnover gap.
  // ---------------------------------------------------------------------------

  async finalizeTermination(leaseId: number, actorId: number, currentDate?: Date) {
    const now = currentDate ?? new Date();

    const lease = await this.findById(leaseId);

    if (lease.status !== LEASE_STATUS.ACTIVE) {
      throw new ConflictException({
        error: {
          code: "LEASE_NOT_ACTIVE",
          message: `Cannot finalize termination on a lease with status ${lease.status}`,
        },
      });
    }

    const termination = await this.prisma.leaseTermination.findFirst({
      where: { lease_id: leaseId, finalized_at: null, withdrawn_at: null },
      include: { approvals: true },
    });

    if (!termination) {
      throw new NotFoundException({
        error: {
          code: "NO_OPEN_TERMINATION",
          message: "No open termination request found for this lease",
        },
      });
    }

    // Check all approvals are APPROVED (BL-08 / BL-09) — status code 0=PENDING, 2=REJECTED
    const pending = termination.approvals.filter((a) => a.status === APPROVAL_STATUS.PENDING);
    const rejected = termination.approvals.filter((a) => a.status === APPROVAL_STATUS.REJECTED);

    if (pending.length > 0 || rejected.length > 0) {
      throw new ConflictException({
        error: {
          code: "TERMINATION_NOT_FULLY_APPROVED",
          message: `Cannot finalize: ${pending.length} approval(s) pending, ${rejected.length} rejected. All co-tenants must APPROVE (BL-08/BL-09).`,
          details: {
            pending_tenant_ids: pending.map((a) => a.tenant_id),
            rejected_tenant_ids: rejected.map((a) => a.tenant_id),
          },
        },
      });
    }

    // BL-18: 24-hour turnover gap check
    const unitId = lease.unit_id;
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const recentTerminated = await this.prisma.lease.findFirst({
      where: {
        unit_id: unitId,
        id: { not: leaseId },
        status: LEASE_STATUS.TERMINATED,
        terminated_at: { gte: twentyFourHoursAgo },
      },
      select: { id: true, terminated_at: true },
    });

    if (recentTerminated) {
      throw new ConflictException({
        error: {
          code: "TURNOVER_GAP_REQUIRED",
          message: `Unit had a lease terminated less than 24 hours ago (BL-18). Wait until ${new Date(recentTerminated.terminated_at!.getTime() + 24 * 60 * 60 * 1000).toISOString()}.`,
          details: { previous_terminated_at: recentTerminated.terminated_at },
        },
      });
    }

    return this.prisma.$transaction(
      async (tx) => {
        await tx.leaseTermination.update({
          where: { id: termination.id },
          data: { finalized_at: now },
        });

        await tx.lease.update({
          where: { id: leaseId },
          data: { status: LEASE_STATUS.TERMINATED, terminated_at: now },
        });

        await this.audit.writeLog(tx, {
          actorId,
          action: "lease.terminate",
          entityType: "Lease",
          entityId: leaseId,
          before: { status: LEASE_STATUS.ACTIVE },
          after: { status: LEASE_STATUS.TERMINATED, terminated_at: now },
        });

        await tx.leaseTenant.updateMany({
          where: { lease_id: leaseId, removed_at: null },
          data: { removed_at: now },
        });

        // BL-04: unit → AVAILABLE
        await tx.unit.update({
          where: { id: unitId },
          data: { state: UNIT_STATE.AVAILABLE },
        });

        await this.audit.writeLog(tx, {
          actorId,
          action: "unit.state_change",
          entityType: "Unit",
          entityId: unitId,
          before: { state: UNIT_STATE.OCCUPIED },
          after: { state: UNIT_STATE.AVAILABLE },
        });

        return {
          message: "Lease terminated successfully",
          lease_id: leaseId,
          terminated_at: now,
          unit_state: UNIT_STATE.AVAILABLE,
        };
      },
      { isolationLevel: "Serializable" },
    );
  }

  // ---------------------------------------------------------------------------
  // Create deposit refund (POST /deposit-refunds)
  // H-02: PM must own the property this lease belongs to.
  // Lease must be TERMINATED. One refund per lease (unique index).
  // ---------------------------------------------------------------------------

  async createDepositRefund(dto: DepositRefundDto, actorId: number, actorRole: number) {
    const lease = await this.prisma.lease.findUnique({
      where: { id: dto.leaseId },
      select: {
        id: true,
        status: true,
        security_deposit_paise: true,
        unit: { select: { property_id: true } },
      },
    });

    if (!lease) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: `Lease ${dto.leaseId} not found` },
      });
    }

    // H-02: belt-and-suspenders PM→property check (decorator alone is not enough if bodyKey
    // resolution ever drifts). ADMIN bypasses this check.
    if (actorRole === ROLE.PROPERTY_MANAGER) {
      const property = await this.prisma.property.findFirst({
        where: { id: lease.unit.property_id, active_pm_id: actorId, deleted_at: null },
        select: { id: true },
      });
      if (!property) {
        throw new ForbiddenException({
          error: {
            code: "PROPERTY_ACCESS_DENIED",
            message: "You are not the assigned manager for the property this lease belongs to (H-02)",
          },
        });
      }
    }

    if (lease.status !== LEASE_STATUS.TERMINATED) {
      throw new ConflictException({
        error: {
          code: "LEASE_NOT_TERMINATED",
          message: "Deposit refund can only be processed after the lease is terminated",
        },
      });
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: dto.paidToTenantId },
    });
    if (!tenant) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: `Tenant ${dto.paidToTenantId} not found` },
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const refund = await tx.depositRefund.create({
          data: {
            lease_id: dto.leaseId,
            amount_paise: BigInt(dto.amountPaise),
            deductions_paise: BigInt(dto.deductionsPaise ?? 0),
            deduction_reason: dto.deductionReason ?? null,
            paid_to_tenant_id: dto.paidToTenantId,
            processed_by_pm_id: actorId,
            processed_at: new Date(),
          },
        });

        await this.audit.writeLog(tx, {
          actorId,
          action: "deposit_refund.create",
          entityType: "DepositRefund",
          entityId: refund.id,
          before: null,
          after: {
            lease_id: refund.lease_id,
            amount_paise: refund.amount_paise.toString(),
            deductions_paise: refund.deductions_paise.toString(),
            paid_to_tenant_id: refund.paid_to_tenant_id,
          },
        });

        return {
          id: refund.id,
          lease_id: refund.lease_id,
          amount_paise: refund.amount_paise.toString(),
          deductions_paise: refund.deductions_paise.toString(),
          deduction_reason: refund.deduction_reason,
          paid_to_tenant_id: refund.paid_to_tenant_id,
          processed_by_pm_id: refund.processed_by_pm_id,
          processed_at: refund.processed_at,
          created_at: refund.created_at,
        };
      });
    } catch (err) {
      if (isPrismaUniqueError(err)) {
        throw new ConflictException({
          error: {
            code: "DEPOSIT_REFUND_EXISTS",
            message: `A deposit refund has already been processed for lease ${dto.leaseId}`,
          },
        });
      }
      throw err;
    }
  }
}
