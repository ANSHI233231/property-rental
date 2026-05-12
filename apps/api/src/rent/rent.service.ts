import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { RecordPaymentDto } from "./dto/record-payment.dto";
import type { VoidPaymentDto } from "./dto/void-payment.dto";

/**
 * Rent period status int codes
 * UPCOMING=0  DUE=1  PARTIAL=2  PAID=3  OVERDUE=4  PREPAID=5
 */
const RENT_STATUS = {
  UPCOMING: 0,
  DUE: 1,
  PARTIAL: 2,
  PAID: 3,
  OVERDUE: 4,
  PREPAID: 5,
} as const;

/** Role int codes */
const ROLE = { ADMIN: 0, PROPERTY_MANAGER: 1, MAINTENANCE: 2, TENANT: 3 } as const;

/** Lease status ACTIVE int code */
const LEASE_ACTIVE = 0;

/**
 * TransactionClient — the intersection of what Prisma's $transaction callback
 * provides and what PrismaService adds. Using Prisma's own Omit type means
 * both PrismaService and the tx callback client satisfy this type.
 */
type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/** Serialize BigInt fields on a RentPeriod to strings for JSON safety. */
function serializePeriod(p: Record<string, unknown>): Record<string, unknown> {
  return {
    ...p,
    amount_due_paise: p["amount_due_paise"]?.toString(),
    late_fee_paise: p["late_fee_paise"]?.toString(),
    paid_paise: p["paid_paise"]?.toString(),
    outstanding_paise: p["outstanding_paise"]?.toString(),
  };
}

/** Serialize BigInt fields on a Payment to strings for JSON safety. */
function serializePayment(p: Record<string, unknown>): Record<string, unknown> {
  return {
    ...p,
    amount_paise: p["amount_paise"]?.toString(),
  };
}

/** Compute outstanding = amount_due + late_fee - paid (BigInt). */
function computeOutstanding(
  amountDue: bigint,
  lateFee: bigint,
  paid: bigint,
): bigint {
  const outstanding = amountDue + lateFee - paid;
  // Outstanding cannot go negative (overpayment → spillover to PrepaidCredit)
  return outstanding < 0n ? 0n : outstanding;
}

/**
 * withSerializableRetry — retries a Serializable transaction on P2034 / 40001 / 40P01
 * (Postgres serialization failure or deadlock). Up to maxAttempts tries with
 * exponential-ish backoff + small jitter.
 */
async function withSerializableRetry<T>(fn: () => Promise<T>, maxAttempts = 10): Promise<T> {
  await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 30)));

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const isPrismaKnown = e instanceof Prisma.PrismaClientKnownRequestError;
      if (isPrismaKnown) {
        const prismaErr = e as Prisma.PrismaClientKnownRequestError;
        const topCode = prismaErr.code;
        const metaCode =
          typeof prismaErr.meta?.code === "string" ? (prismaErr.meta.code as string) : "";
        const isRetryable =
          topCode === "P2034" ||
          topCode === "40001" ||
          topCode === "40P01" ||
          (topCode === "P2010" && (metaCode === "40001" || metaCode === "40P01"));
        if (!isRetryable || attempt === maxAttempts) {
          throw e;
        }
      } else {
        throw e;
      }
      const base = Math.min(50 * attempt * attempt, 500);
      const jitter = Math.floor(Math.random() * 100);
      await new Promise((r) => setTimeout(r, base + jitter));
      lastErr = e;
    }
  }
  throw lastErr;
}

/** Derive rent period status (as int code) after a payment update. */
function deriveStatus(outstanding: bigint, paid: bigint): number {
  if (outstanding === 0n) return RENT_STATUS.PAID;
  if (paid === 0n) return RENT_STATUS.DUE;
  return RENT_STATUS.PARTIAL;
}

@Injectable()
export class RentService {
  private readonly logger = new Logger(RentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // generateFirstPeriod — called from LeasesService.create
  // Creates the initial rent period when a lease is signed.
  // ---------------------------------------------------------------------------

  async generateFirstPeriod(
    tx: TransactionClient,
    leaseId: number,
    startDate: Date,
    monthlyRentPaise: bigint,
    actorId: number,
  ): Promise<void> {
    const periodStart = new Date(startDate);
    const periodEnd = this.addMonthMinusOneDay(periodStart);
    const dueDate = new Date(periodStart);

    const outstanding = monthlyRentPaise; // no late fee yet

    const period = await tx.rentPeriod.create({
      data: {
        lease_id: leaseId,
        period_start: periodStart,
        period_end: periodEnd,
        due_date: dueDate,
        amount_due_paise: monthlyRentPaise,
        late_fee_paise: 0n,
        paid_paise: 0n,
        outstanding_paise: outstanding,
        status: RENT_STATUS.DUE,
      },
    });

    await this.audit.writeLog(tx, {
      actorId,
      action: "rent_period.create",
      entityType: "RentPeriod",
      entityId: period.id,
      before: null,
      after: {
        lease_id: leaseId,
        period_start: periodStart,
        period_end: periodEnd,
        status: RENT_STATUS.DUE,
        amount_due_paise: monthlyRentPaise.toString(),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // List rent periods
  // ---------------------------------------------------------------------------

  async listPeriods(filters: {
    leaseId?: number;
    unitId?: number;
    propertyId?: number;
    status?: string;
    periodStart_gte?: string;
    periodStart_lte?: string;
    cursor?: number;
    limit?: number;
    actorId: number;
    actorRole: number;
  }) {
    const take = Math.min(filters.limit ?? 20, 100);
    let where: Prisma.RentPeriodWhereInput = {};

    if (filters.leaseId !== undefined) {
      where = { ...where, lease_id: filters.leaseId };
    }

    if (filters.status) {
      // Accept status name string and map to int code
      const STATUS_NAME_TO_CODE: Record<string, number> = {
        UPCOMING: RENT_STATUS.UPCOMING,
        DUE: RENT_STATUS.DUE,
        PARTIAL: RENT_STATUS.PARTIAL,
        PAID: RENT_STATUS.PAID,
        OVERDUE: RENT_STATUS.OVERDUE,
        PREPAID: RENT_STATUS.PREPAID,
      };
      const code = STATUS_NAME_TO_CODE[filters.status.toUpperCase()];
      if (code !== undefined) {
        where = { ...where, status: code };
      }
    }

    // FC-3: period_start date range filter
    if (filters.periodStart_gte || filters.periodStart_lte) {
      where = {
        ...where,
        period_start: {
          ...(filters.periodStart_gte ? { gte: new Date(filters.periodStart_gte) } : {}),
          ...(filters.periodStart_lte ? { lte: new Date(filters.periodStart_lte) } : {}),
        },
      };
    }

    if (filters.unitId !== undefined) {
      where = {
        ...where,
        lease: {
          ...(where.lease as Prisma.LeaseWhereInput ?? {}),
          unit_id: filters.unitId,
        },
      };
    }

    if (filters.propertyId !== undefined) {
      where = {
        ...where,
        lease: {
          ...(where.lease as Prisma.LeaseWhereInput ?? {}),
          unit: {
            ...((where.lease as Prisma.LeaseWhereInput)?.unit as Prisma.UnitWhereInput ?? {}),
            property_id: filters.propertyId,
          },
        },
      };
    }

    // TENANT: only their own lease's periods
    if (filters.actorRole === ROLE.TENANT) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { user_id: filters.actorId },
        select: { id: true },
      });
      if (!tenant) {
        return { data: [], meta: { next_cursor: null, has_more: false } };
      }
      where = {
        ...where,
        lease: {
          ...(where.lease as Prisma.LeaseWhereInput ?? {}),
          lease_tenants: {
            some: { tenant_id: tenant.id, removed_at: null },
          },
        },
      };
    }

    // PROPERTY_MANAGER: scope to their property.
    if (filters.actorRole === ROLE.PROPERTY_MANAGER) {
      const managedProperty = await this.prisma.property.findFirst({
        where: { active_pm_id: filters.actorId, deleted_at: null },
        select: { id: true },
      });
      if (!managedProperty) {
        return { data: [], meta: { next_cursor: null, has_more: false } };
      }
      // If PM supplied a propertyId that differs from their assigned one → empty
      if (filters.propertyId !== undefined && filters.propertyId !== managedProperty.id) {
        return { data: [], meta: { next_cursor: null, has_more: false } };
      }
      where = {
        ...where,
        lease: {
          ...(where.lease as Prisma.LeaseWhereInput ?? {}),
          unit: {
            ...((where.lease as Prisma.LeaseWhereInput)?.unit as Prisma.UnitWhereInput ?? {}),
            property_id: managedProperty.id,
          },
        },
      };
    }

    // FC-2: include lease → unit → property for admin overdue table
    const items = await this.prisma.rentPeriod.findMany({
      where,
      orderBy: { period_start: "desc" },
      take: take + 1,
      include: {
        lease: {
          select: {
            id: true,
            unit: {
              select: {
                id: true,
                unit_number: true,
                property: {
                  select: {
                    id: true,
                    name: true,
                    city: true,
                  },
                },
              },
            },
          },
        },
      },
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > take;
    const data = hasMore ? items.slice(0, take) : items;
    const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

    return {
      data: data.map((p) => ({
        ...serializePeriod(p as unknown as Record<string, unknown>),
        lease: p.lease,
      })),
      meta: { next_cursor: nextCursor ?? null, has_more: hasMore },
    };
  }

  // ---------------------------------------------------------------------------
  // Get single rent period with its payments and prepaid credits
  // ---------------------------------------------------------------------------

  async findPeriodById(id: number) {
    const period = await this.prisma.rentPeriod.findUnique({
      where: { id },
      include: {
        payments: {
          orderBy: { recorded_at: "desc" },
        },
      },
    });

    if (!period) {
      throw new NotFoundException({
        error: { code: "RESOURCE_NOT_FOUND", message: `RentPeriod ${id} not found` },
      });
    }

    const credits = await this.prisma.prepaidCredit.findMany({
      where: { lease_id: period.lease_id },
      orderBy: { created_at: "asc" },
    });

    return {
      ...serializePeriod(period as unknown as Record<string, unknown>),
      payments: period.payments.map((p) => serializePayment(p as unknown as Record<string, unknown>)),
      prepaid_credits: credits.map((c) => ({
        ...c,
        amount_paise: c.amount_paise.toString(),
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // Record payment — POST /payments
  // BL-10: caller must be PROPERTY_MANAGER or ADMIN (enforced by @Roles decorator).
  // BL-11: Serializable transaction with SELECT FOR UPDATE semantics.
  // ---------------------------------------------------------------------------

  async recordPayment(
    dto: RecordPaymentDto,
    actorId: number,
    actorRole: number,
    idempotencyKey?: string,
  ) {
    // BL-10: belt-and-suspenders role check (decorator is primary enforcement)
    if (actorRole !== ROLE.PROPERTY_MANAGER && actorRole !== ROLE.ADMIN) {
      throw new ForbiddenException({
        error: {
          code: "BL_10_TENANT_CANNOT_RECORD_PAYMENT",
          message: "Only Property Managers and Admins may record payments (BL-10)",
        },
      });
    }

    // Phase 7: Idempotency-Key check
    if (idempotencyKey) {
      const existing = await this.prisma.payment.findFirst({
        where: { idempotency_key: idempotencyKey },
      });
      if (existing) {
        this.logger.debug(
          `[idempotency] returning existing payment ${existing.id} for key ${idempotencyKey}`,
        );
        return {
          payment: {
            ...serializePayment(existing as unknown as Record<string, unknown>),
            amount_paise: existing.amount_paise.toString(),
          },
          period: { id: existing.rent_period_id },
          idempotent: true,
        };
      }
    }

    return withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
        // BL-11: lock the rent period row for the duration of the transaction.
        // $queryRaw returns BIGINT columns as strings in node-postgres; coerce to BigInt.
        const periodRows = await tx.$queryRaw<Array<{
          id: number;
          lease_id: number;
          amount_due_paise: string | bigint;
          late_fee_paise: string | bigint;
          paid_paise: string | bigint;
          outstanding_paise: string | bigint;
          status: number;
        }>>`
          SELECT id, lease_id, amount_due_paise, late_fee_paise, paid_paise, outstanding_paise, status
          FROM rent_periods
          WHERE id = ${dto.rentPeriodId}
          FOR UPDATE
        `;

        if (periodRows.length === 0) {
          throw new NotFoundException({
            error: { code: "RESOURCE_NOT_FOUND", message: `RentPeriod ${dto.rentPeriodId} not found` },
          });
        }

        const rawPeriod = periodRows[0]!;
        const period = {
          ...rawPeriod,
          amount_due_paise: BigInt(rawPeriod.amount_due_paise),
          late_fee_paise: BigInt(rawPeriod.late_fee_paise),
          paid_paise: BigInt(rawPeriod.paid_paise),
          outstanding_paise: BigInt(rawPeriod.outstanding_paise),
        };

        // PROPERTY_MANAGER scope check: must be PM for this property
        if (actorRole === ROLE.PROPERTY_MANAGER) {
          const lease = await tx.lease.findUnique({
            where: { id: period.lease_id },
            select: { unit: { select: { property_id: true } } },
          });
          const property = await tx.property.findFirst({
            where: { id: lease?.unit.property_id, active_pm_id: actorId, deleted_at: null },
            select: { id: true },
          });
          if (!property) {
            throw new ForbiddenException({
              error: {
                code: "PROPERTY_ACCESS_DENIED",
                message: "You are not the assigned manager for this property",
              },
            });
          }
        }

        const incomingPaise = BigInt(dto.amountPaise);

        // Recompute outstanding from locked row data
        const outstanding = computeOutstanding(
          period.amount_due_paise,
          period.late_fee_paise,
          period.paid_paise,
        );

        // Determine how much goes to this period vs spillover
        let appliedToPeriod: bigint;
        let spilloverPaise: bigint;

        if (incomingPaise >= outstanding) {
          appliedToPeriod = outstanding;
          spilloverPaise = incomingPaise - outstanding;
        } else {
          appliedToPeriod = incomingPaise;
          spilloverPaise = 0n;
        }

        // Update paid_paise and recompute outstanding
        const newPaidPaise = period.paid_paise + appliedToPeriod;
        const newOutstanding = computeOutstanding(
          period.amount_due_paise,
          period.late_fee_paise,
          newPaidPaise,
        );
        const newStatus = deriveStatus(newOutstanding, newPaidPaise);

        await tx.rentPeriod.update({
          where: { id: period.id },
          data: {
            paid_paise: newPaidPaise,
            outstanding_paise: newOutstanding,
            status: newStatus,
          },
        });

        // Map PaymentMethod string to int code
        const METHOD_CODE: Record<string, number> = {
          CASH: 0,
          BANK_TRANSFER: 1,
          UPI: 2,
          CHEQUE: 3,
          OTHER: 4,
        };
        const methodCode = typeof dto.method === "string"
          ? (METHOD_CODE[dto.method.toUpperCase()] ?? 0)
          : (dto.method as number);

        // Create the Payment record (append-only)
        const payment = await tx.payment.create({
          data: {
            rent_period_id: period.id,
            lease_id: period.lease_id,
            amount_paise: incomingPaise,
            method: methodCode,
            reference: dto.reference ?? null,
            paid_on: new Date(dto.paidOn),
            recorded_by_user_id: actorId,
            idempotency_key: idempotencyKey ?? null,
          },
        });

        await this.audit.writeLog(tx, {
          actorId,
          action: "payment.record",
          entityType: "Payment",
          entityId: payment.id,
          before: {
            rent_period_id: period.id,
            previous_paid_paise: period.paid_paise.toString(),
            previous_status: period.status,
          },
          after: {
            amount_paise: incomingPaise.toString(),
            method: dto.method,
            new_paid_paise: newPaidPaise.toString(),
            new_status: newStatus,
          },
        });

        // Handle spillover: create PrepaidCredit if excess exists
        let prepaidCredit: { id: number; amount_paise: string } | null = null;

        if (spilloverPaise > 0n) {
          const credit = await tx.prepaidCredit.create({
            data: {
              lease_id: period.lease_id,
              source_payment_id: payment.id,
              amount_paise: spilloverPaise,
            },
          });

          await this.audit.writeLog(tx, {
            actorId,
            action: "prepaid_credit.create",
            entityType: "PrepaidCredit",
            entityId: credit.id,
            before: null,
            after: {
              lease_id: period.lease_id,
              source_payment_id: payment.id,
              amount_paise: spilloverPaise.toString(),
            },
          });

          prepaidCredit = { id: credit.id, amount_paise: spilloverPaise.toString() };
        }

        return {
          payment: {
            ...serializePayment(payment as unknown as Record<string, unknown>),
            amount_paise: payment.amount_paise.toString(),
          },
          period: {
            id: period.id,
            status: newStatus,
            paid_paise: newPaidPaise.toString(),
            outstanding_paise: newOutstanding.toString(),
          },
          ...(prepaidCredit ? { prepaid_credit: prepaidCredit } : {}),
        };
        },
        { isolationLevel: "Serializable" },
      )
    );
  }

  // ---------------------------------------------------------------------------
  // Void payment — POST /payments/:id/void
  // BL-10: PROPERTY_MANAGER + ADMIN only.
  // ---------------------------------------------------------------------------

  async voidPayment(paymentId: number, dto: VoidPaymentDto, actorId: number, actorRole: number) {
    return withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
        // Lock the payment row
        const rawPayments = await tx.$queryRaw<Array<{
          id: number;
          rent_period_id: number;
          lease_id: number;
          amount_paise: string | bigint;
          is_voided: boolean;
        }>>`
          SELECT id, rent_period_id, lease_id, amount_paise, is_voided
          FROM payments
          WHERE id = ${paymentId}
          FOR UPDATE
        `;

        if (rawPayments.length === 0) {
          throw new NotFoundException({
            error: { code: "RESOURCE_NOT_FOUND", message: `Payment ${paymentId} not found` },
          });
        }

        const rawP = rawPayments[0]!;
        const payment = { ...rawP, amount_paise: BigInt(rawP.amount_paise) };

        if (payment.is_voided) {
          throw new ConflictException({
            error: { code: "PAYMENT_ALREADY_VOIDED", message: "This payment is already voided" },
          });
        }

        // PROPERTY_MANAGER scope check
        if (actorRole === ROLE.PROPERTY_MANAGER) {
          const lease = await tx.lease.findUnique({
            where: { id: payment.lease_id },
            select: { unit: { select: { property_id: true } } },
          });
          const property = await tx.property.findFirst({
            where: { id: lease?.unit.property_id, active_pm_id: actorId, deleted_at: null },
            select: { id: true },
          });
          if (!property) {
            throw new ForbiddenException({
              error: {
                code: "PROPERTY_ACCESS_DENIED",
                message: "You are not the assigned manager for this property",
              },
            });
          }
        }

        // Check for consumed downstream prepaid credit
        const downstreamCredit = await tx.prepaidCredit.findUnique({
          where: { source_payment_id: paymentId },
        });

        if (downstreamCredit?.consumed_at !== null && downstreamCredit?.consumed_at !== undefined) {
          throw new ConflictException({
            error: {
              code: "PAYMENT_VOID_CASCADE_BLOCKED",
              message:
                "Cannot void this payment: the excess prepaid credit it created has already been consumed by a subsequent payment. Void that payment first.",
              details: {
                prepaid_credit_id: downstreamCredit.id,
                consumed_at: downstreamCredit.consumed_at,
                consumed_by_payment_id: downstreamCredit.consumed_by_payment_id,
              },
            },
          });
        }

        // If there's an unconsumed prepaid credit, delete it
        if (downstreamCredit && !downstreamCredit.consumed_at) {
          await tx.prepaidCredit.delete({ where: { id: downstreamCredit.id } });
          await this.audit.writeLog(tx, {
            actorId,
            action: "prepaid_credit.delete_on_void",
            entityType: "PrepaidCredit",
            entityId: downstreamCredit.id,
            before: { amount_paise: downstreamCredit.amount_paise.toString() },
            after: null,
          });
        }

        // Mark the payment as voided
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            is_voided: true,
            voided_by_user_id: actorId,
            voided_at: new Date(),
            void_reason: dto.reason,
          },
        });

        // Recompute the affected rent period
        const rawPeriodRows = await tx.$queryRaw<Array<{
          id: number;
          amount_due_paise: string | bigint;
          late_fee_paise: string | bigint;
          paid_paise: string | bigint;
          status: number;
        }>>`
          SELECT id, amount_due_paise, late_fee_paise, paid_paise, status
          FROM rent_periods
          WHERE id = ${payment.rent_period_id}
          FOR UPDATE
        `;

        const rawPeriodRow = rawPeriodRows[0]!;
        const period = {
          ...rawPeriodRow,
          amount_due_paise: BigInt(rawPeriodRow.amount_due_paise),
          late_fee_paise: BigInt(rawPeriodRow.late_fee_paise),
          paid_paise: BigInt(rawPeriodRow.paid_paise),
        };

        // Sum all non-voided payments for this period
        const sumResult = await tx.$queryRaw<Array<{ total: string | bigint | null }>>`
          SELECT COALESCE(SUM(amount_paise), 0) AS total
          FROM payments
          WHERE rent_period_id = ${period.id}
            AND is_voided = false
        `;

        const rawTotal = sumResult[0]?.total ?? 0;
        const newPaidPaise = rawTotal !== null ? BigInt(rawTotal) : 0n;
        const newOutstanding = computeOutstanding(
          period.amount_due_paise,
          period.late_fee_paise,
          newPaidPaise,
        );

        // Determine status: if previously PAID/PARTIAL, revert appropriately
        let newStatus: number;
        if (newPaidPaise === 0n) {
          // Back to due or overdue — preserve OVERDUE if it was overdue
          newStatus = period.status === RENT_STATUS.OVERDUE ? RENT_STATUS.OVERDUE : RENT_STATUS.DUE;
        } else if (newOutstanding === 0n) {
          newStatus = RENT_STATUS.PAID;
        } else {
          newStatus = RENT_STATUS.PARTIAL;
        }

        await tx.rentPeriod.update({
          where: { id: period.id },
          data: {
            paid_paise: newPaidPaise,
            outstanding_paise: newOutstanding,
            status: newStatus,
          },
        });

        await this.audit.writeLog(tx, {
          actorId,
          action: "payment.void",
          entityType: "Payment",
          entityId: paymentId,
          before: { is_voided: false, amount_paise: payment.amount_paise.toString() },
          after: {
            is_voided: true,
            void_reason: dto.reason,
            period_reverted_to_status: newStatus,
          },
        });

        return {
          message: "Payment voided successfully",
          payment_id: paymentId,
          period: {
            id: period.id,
            status: newStatus,
            paid_paise: newPaidPaise.toString(),
            outstanding_paise: newOutstanding.toString(),
          },
        };
        },
        { isolationLevel: "Serializable" },
      )
    );
  }

  // ---------------------------------------------------------------------------
  // tenantHasAccessToPeriod — ownership check for TENANT role
  // ---------------------------------------------------------------------------

  async tenantHasAccessToPeriod(periodId: number, userId: number): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { user_id: userId },
      select: { id: true },
    });
    if (!tenant) return false;

    const period = await this.prisma.rentPeriod.findUnique({
      where: { id: periodId },
      select: { lease_id: true },
    });
    if (!period) return false;

    const lt = await this.prisma.leaseTenant.findFirst({
      where: { lease_id: period.lease_id, tenant_id: tenant.id, removed_at: null },
    });
    return !!lt;
  }

  // ---------------------------------------------------------------------------
  // pmHasAccessToPeriod — H-01: ownership check for PROPERTY_MANAGER role
  // ---------------------------------------------------------------------------

  async pmHasAccessToPeriod(periodId: number, pmUserId: number): Promise<boolean> {
    const period = await this.prisma.rentPeriod.findUnique({
      where: { id: periodId },
      select: { lease_id: true },
    });
    if (!period) return false;

    const lease = await this.prisma.lease.findUnique({
      where: { id: period.lease_id },
      select: { unit: { select: { property_id: true } } },
    });
    if (!lease) return false;

    const property = await this.prisma.property.findFirst({
      where: { id: lease.unit.property_id, active_pm_id: pmUserId, deleted_at: null },
      select: { id: true },
    });
    return !!property;
  }

  // ---------------------------------------------------------------------------
  // Helper: add one month and subtract one day (period_end calculation)
  // ---------------------------------------------------------------------------

  private addMonthMinusOneDay(date: Date): Date {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const d = date.getUTCDate();

    const lastOfNextMonth = new Date(Date.UTC(y, m + 2, 0));
    const lastDay = lastOfNextMonth.getUTCDate();

    if (d >= lastDay) {
      return lastOfNextMonth;
    }

    return new Date(Date.UTC(y, m + 1, d - 1));
  }

  // ---------------------------------------------------------------------------
  // generateNextPeriod — called by @nestjs/schedule cron service
  // ---------------------------------------------------------------------------

  async generateNextPeriod(
    tx: TransactionClient,
    leaseId: number,
    lastPeriodEnd: Date,
    monthlyRentPaise: bigint,
    actorId: number,
  ): Promise<void> {
    const nextStart = new Date(lastPeriodEnd);
    nextStart.setDate(nextStart.getDate() + 1);

    // Prevent duplicate period creation (unique index will also catch it)
    const existing = await tx.rentPeriod.findUnique({
      where: { lease_id_period_start: { lease_id: leaseId, period_start: nextStart } },
    });

    if (existing) return; // already generated

    const periodEnd = this.addMonthMinusOneDay(nextStart);
    const dueDate = new Date(nextStart); // grace_days = 0

    const period = await tx.rentPeriod.create({
      data: {
        lease_id: leaseId,
        period_start: nextStart,
        period_end: periodEnd,
        due_date: dueDate,
        amount_due_paise: monthlyRentPaise,
        late_fee_paise: 0n,
        paid_paise: 0n,
        outstanding_paise: monthlyRentPaise,
        status: RENT_STATUS.DUE,
      },
    });

    await this.audit.writeLog(tx, {
      actorId,
      action: "rent_period.generate",
      entityType: "RentPeriod",
      entityId: period.id,
      before: null,
      after: {
        lease_id: leaseId,
        period_start: nextStart,
        period_end: periodEnd,
        status: RENT_STATUS.DUE,
        amount_due_paise: monthlyRentPaise.toString(),
      },
    });
  }
}
