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
import { computeLateFeePaise } from "@gharsetu/shared";

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

/**
 * TransactionClient — the intersection of what Prisma's $transaction callback
 * provides and what PrismaService adds. Using Prisma's own Omit type means
 * both PrismaService and the tx callback client satisfy this type.
 */
type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/** Calendar-day diff today−dueDate (UTC date math; positive = past due). */
function daysOverdueFromDueDate(dueDate: Date | string | undefined | null): number {
  if (!dueDate) return 0;
  const due = new Date(dueDate);
  const dueUTC = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const now = new Date();
  const nowUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((nowUTC - dueUTC) / (1000 * 60 * 60 * 24));
}

/**
 * Serialize a RentPeriod row for the wire. BigInts → strings.
 *
 * `late_fee_paise` is NOT stored — it is computed on every read via the
 * BL-13 formula. `outstanding_paise` stored is `amount_due - paid`; the
 * response value adds the computed late fee back so consumers see the
 * total tenants owe.
 */
function serializePeriod(p: Record<string, unknown>): Record<string, unknown> {
  const amountDue = (p["amount_due_paise"] as bigint | undefined) ?? 0n;
  const paid = (p["paid_paise"] as bigint | undefined) ?? 0n;
  const status = (p["status"] as number | undefined) ?? RENT_STATUS.DUE;

  // Settled / not-yet-due periods do not accrue a late fee.
  const accrues = status === RENT_STATUS.DUE
    || status === RENT_STATUS.PARTIAL
    || status === RENT_STATUS.OVERDUE;
  const days = accrues
    ? daysOverdueFromDueDate(p["due_date"] as Date | string | undefined)
    : 0;
  const lateFee = computeLateFeePaise(amountDue, days);

  const storedOutstanding = (p["outstanding_paise"] as bigint | undefined) ?? (amountDue - paid);
  const totalOutstanding = storedOutstanding + lateFee;
  const outstandingStr = (totalOutstanding < 0n ? 0n : totalOutstanding).toString();

  // Emit BOTH snake_case (for Prisma-aligned internal tooling) and camelCase
  // (the FE contract used across pm/admin/tenant rent pages). Adding camelCase
  // is the canonical fix for BUG observed at /pm/rent-collection where the
  // page reads outstandingPaise/lateFeePaise etc. and got undefined.
  return {
    ...p,
    // snake_case (existing wire shape, kept for back-compat)
    amount_due_paise: amountDue.toString(),
    late_fee_paise: lateFee.toString(),
    paid_paise: paid.toString(),
    outstanding_paise: outstandingStr,
    // camelCase (FE contract)
    id: p["id"],
    leaseId: p["lease_id"],
    periodStart: p["period_start"],
    periodEnd: p["period_end"],
    dueDate: p["due_date"],
    status: p["status"],
    lastAccruedAt: p["last_accrued_at"] ?? null,
    amountDuePaise: amountDue.toString(),
    lateFeePaise: lateFee.toString(),
    paidPaise: paid.toString(),
    outstandingPaise: outstandingStr,
  };
}

/** Serialize BigInt fields on a Payment to strings for JSON safety. */
function serializePayment(p: Record<string, unknown>): Record<string, unknown> {
  const amount = p["amount_paise"]?.toString();
  return {
    ...p,
    amount_paise: amount,
    // camelCase aliases for FE contract (rent pages consume this shape)
    id: p["id"],
    rentPeriodId: p["rent_period_id"],
    leaseId: p["lease_id"],
    amountPaise: amount,
    method: p["method"],
    reference: p["reference"],
    paidOn: p["paid_on"],
    recordedByUserId: p["recorded_by_user_id"],
    recordedAt: p["recorded_at"],
    isVoided: p["is_voided"],
    voidedByUserId: p["voided_by_user_id"] ?? null,
    voidedAt: p["voided_at"] ?? null,
    voidReason: p["void_reason"] ?? null,
  };
}

/**
 * Compute outstanding = amount_due + late_fee - paid (BigInt).
 * Kept for internal payment-processing math. `lateFee` is computed at the
 * call site via computeLateFeePaise (no longer read from DB).
 */
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

    const outstanding = monthlyRentPaise; // amount_due - paid (no fee — fee is computed on read)

    const period = await tx.rentPeriod.create({
      data: {
        lease_id: leaseId,
        period_start: periodStart,
        period_end: periodEnd,
        due_date: dueDate,
        amount_due_paise: monthlyRentPaise,
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
    page?: number;
    pageSize?: number;
    actorId: number;
    actorRole: number;
  }) {
    const useOffset = filters.page !== undefined;
    const ps = filters.pageSize !== undefined ? Math.min(Math.max(filters.pageSize, 1), 100) : undefined;
    const take = useOffset ? (ps ?? 10) : Math.min(filters.limit ?? 20, 100);
    const currentPage = filters.page ?? 1;
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
        return { data: [], meta: { next_cursor: null, has_more: false, total: 0, page: currentPage, page_size: take, total_pages: 0 } };
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
        return { data: [], meta: { next_cursor: null, has_more: false, total: 0, page: currentPage, page_size: take, total_pages: 0 } };
      }
      // If PM supplied a propertyId that differs from their assigned one → empty
      if (filters.propertyId !== undefined && filters.propertyId !== managedProperty.id) {
        return { data: [], meta: { next_cursor: null, has_more: false, total: 0, page: currentPage, page_size: take, total_pages: 0 } };
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

    const leaseInclude = {
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
    };

    // FC-2: include lease → unit → property for admin overdue table
    const baseArgs = { where, orderBy: { period_start: "desc" as const }, include: leaseInclude };
    const [items, total] = await Promise.all([
      useOffset
        ? this.prisma.rentPeriod.findMany({ ...baseArgs, skip: (currentPage - 1) * take, take })
        : filters.cursor
          ? this.prisma.rentPeriod.findMany({ ...baseArgs, take: take + 1, cursor: { id: filters.cursor }, skip: 1 })
          : this.prisma.rentPeriod.findMany({ ...baseArgs, take: take + 1 }),
      this.prisma.rentPeriod.count({ where }),
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
      data: data.map((p) => ({
        ...serializePeriod(p as unknown as Record<string, unknown>),
        lease: p.lease,
      })),
      meta: { next_cursor: nextCursor ?? null, has_more: hasMore, total, page: currentPage, page_size: take, total_pages: totalPages },
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
        // late_fee_paise is no longer stored — computed below from due_date.
        const periodRows = await tx.$queryRaw<Array<{
          id: number;
          lease_id: number;
          amount_due_paise: string | bigint;
          paid_paise: string | bigint;
          outstanding_paise: string | bigint;
          status: number;
          due_date: Date;
        }>>`
          SELECT id, lease_id, amount_due_paise, paid_paise, outstanding_paise, status, due_date
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
        const lateFeeAtPaymentTime = (
          rawPeriod.status === RENT_STATUS.DUE
            || rawPeriod.status === RENT_STATUS.PARTIAL
            || rawPeriod.status === RENT_STATUS.OVERDUE
        )
          ? computeLateFeePaise(
              BigInt(rawPeriod.amount_due_paise),
              daysOverdueFromDueDate(rawPeriod.due_date),
            )
          : 0n;
        const period = {
          ...rawPeriod,
          amount_due_paise: BigInt(rawPeriod.amount_due_paise),
          late_fee_paise: lateFeeAtPaymentTime,
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

        // Update paid_paise and recompute status. `outstanding_paise` is stored
        // as max(0, amount_due - paid) (no fee); the late fee is recomputed on
        // every read. Status decisions use the TOTAL outstanding (incl. fee).
        const newPaidPaise = period.paid_paise + appliedToPeriod;
        const newTotalOutstanding = computeOutstanding(
          period.amount_due_paise,
          period.late_fee_paise,
          newPaidPaise,
        );
        const newStoredOutstanding =
          period.amount_due_paise - newPaidPaise < 0n
            ? 0n
            : period.amount_due_paise - newPaidPaise;
        const newStatus = deriveStatus(newTotalOutstanding, newPaidPaise);

        await tx.rentPeriod.update({
          where: { id: period.id },
          data: {
            paid_paise: newPaidPaise,
            outstanding_paise: newStoredOutstanding,
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
            outstanding_paise: newTotalOutstanding.toString(),
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

        // Recompute the affected rent period.
        // late_fee_paise is no longer stored — recomputed here from due_date.
        const rawPeriodRows = await tx.$queryRaw<Array<{
          id: number;
          amount_due_paise: string | bigint;
          paid_paise: string | bigint;
          status: number;
          due_date: Date;
        }>>`
          SELECT id, amount_due_paise, paid_paise, status, due_date
          FROM rent_periods
          WHERE id = ${payment.rent_period_id}
          FOR UPDATE
        `;

        const rawPeriodRow = rawPeriodRows[0]!;
        const periodLateFee = (
          rawPeriodRow.status === RENT_STATUS.DUE
            || rawPeriodRow.status === RENT_STATUS.PARTIAL
            || rawPeriodRow.status === RENT_STATUS.OVERDUE
        )
          ? computeLateFeePaise(
              BigInt(rawPeriodRow.amount_due_paise),
              daysOverdueFromDueDate(rawPeriodRow.due_date),
            )
          : 0n;
        const period = {
          ...rawPeriodRow,
          amount_due_paise: BigInt(rawPeriodRow.amount_due_paise),
          late_fee_paise: periodLateFee,
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
        const newTotalOutstanding = computeOutstanding(
          period.amount_due_paise,
          period.late_fee_paise,
          newPaidPaise,
        );
        // Stored outstanding excludes the fee.
        const newStoredOutstanding =
          period.amount_due_paise - newPaidPaise < 0n
            ? 0n
            : period.amount_due_paise - newPaidPaise;

        // Determine status: if previously PAID/PARTIAL, revert appropriately
        let newStatus: number;
        if (newPaidPaise === 0n) {
          // Back to due or overdue — preserve OVERDUE if it was overdue
          newStatus = period.status === RENT_STATUS.OVERDUE ? RENT_STATUS.OVERDUE : RENT_STATUS.DUE;
        } else if (newTotalOutstanding === 0n) {
          newStatus = RENT_STATUS.PAID;
        } else {
          newStatus = RENT_STATUS.PARTIAL;
        }

        await tx.rentPeriod.update({
          where: { id: period.id },
          data: {
            paid_paise: newPaidPaise,
            outstanding_paise: newStoredOutstanding,
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
            outstanding_paise: newTotalOutstanding.toString(),
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

    // Auto-consume any unconsumed prepaid credits for this lease, FIFO. Credits
    // arise from concurrent-payment spillover (BL-11) — the second payment for a
    // fully-paid period becomes a PrepaidCredit, then this consumes it against
    // the next period when generated. A single credit that would over-pay the
    // period is left intact for the period after this one (no splitting).
    const credits = await tx.prepaidCredit.findMany({
      where: { lease_id: leaseId, consumed_at: null },
      orderBy: { created_at: "asc" },
      select: { id: true, amount_paise: true },
    });

    let consumedTotalPaise = 0n;
    const consumedCreditIds: number[] = [];
    for (const credit of credits) {
      if (consumedTotalPaise + credit.amount_paise > monthlyRentPaise) break;
      consumedTotalPaise += credit.amount_paise;
      consumedCreditIds.push(credit.id);
    }

    if (consumedCreditIds.length > 0) {
      const now = new Date();
      await tx.prepaidCredit.updateMany({
        where: { id: { in: consumedCreditIds } },
        data: { consumed_at: now },
      });

      const newOutstanding = monthlyRentPaise - consumedTotalPaise;
      const newStatus = newOutstanding === 0n
        ? RENT_STATUS.PREPAID  // period fully covered before due_date
        : RENT_STATUS.PARTIAL;

      await tx.rentPeriod.update({
        where: { id: period.id },
        data: {
          paid_paise: consumedTotalPaise,
          outstanding_paise: newOutstanding,
          status: newStatus,
        },
      });

      await this.audit.writeLog(tx, {
        actorId,
        action: "prepaid_credit.auto_applied",
        entityType: "RentPeriod",
        entityId: period.id,
        before: { paid_paise: "0", status: RENT_STATUS.DUE },
        after: {
          paid_paise: consumedTotalPaise.toString(),
          outstanding_paise: newOutstanding.toString(),
          status: newStatus,
          consumed_credit_ids: consumedCreditIds,
        },
      });
    }
  }
}
