import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { computeLateFeePaise } from "@gharsetu/shared";
import { RentService } from "../rent/rent.service";

/**
 * RentAccrualService — @nestjs/schedule cron for daily rent-period lifecycle management.
 *
 * Scheduled at 00:05 IST (cron: '5 0 * * *', TZ: Asia/Kolkata).
 *
 * Per-run logic (BL-12, BL-13):
 *   1. Idempotency check: look up RentAccrualLog for today's IST date.
 *      If finished_at is set, skip (no-op).
 *   2. Find all DUE/PARTIAL/OVERDUE periods with due_date <= today - 5 days.
 *      - Set status = OVERDUE (BL-12: exactly 5 calendar days past due).
 *      - Compute weeks_overdue = floor((today - due_date) / 7).
 *      - Set late_fee_paise = floor(amount_due_paise × 0.02 × weeks_overdue) (BL-13).
 *        Non-compounded: always on original amount_due_paise, never on outstanding.
 *      - Recompute outstanding_paise.
 *   3. Generate next rent period for ACTIVE leases whose latest period
 *      ends within 7 days and no next period exists.
 *   4. Write summary to RentAccrualLog with finished_at = now.
 *
 * RUN_SCHEDULER env flag: set to 'false' to disable cron triggers on additional replicas.
 */

export interface AccrualResult {
  date: string;
  periodsExamined: number;
  periodsOverdueFlipped: number;
  lateFeesAddedPaise: string;
  nextPeriodsGenerated: number;
  skipped: boolean;
}

@Injectable()
export class RentAccrualService {
  private readonly logger = new Logger(RentAccrualService.name);

  /** Resolved at first run: the bootstrap Admin user's ID used as audit actor. */
  private systemActorId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly rentService: RentService,
    private readonly config: ConfigService,
  ) {}

  /** Resolve a valid DB user ID to use as the audit actor for system jobs. */
  private async resolveSystemActorId(): Promise<string> {
    if (this.systemActorId) return this.systemActorId;
    const admin = await this.prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    if (!admin) throw new Error("No ADMIN user found for system job audit actor");
    this.systemActorId = admin.id;
    return this.systemActorId;
  }

  /**
   * Daily cron at 00:05 IST (BL-12, BL-13).
   * RUN_SCHEDULER=false skips execution (safe for additional replicas).
   */
  @Cron("5 0 * * *", { timeZone: "Asia/Kolkata" })
  async runDailyAccrual(): Promise<AccrualResult> {
    if (this.config.get<string>("RUN_SCHEDULER") === "false") {
      this.logger.log("RUN_SCHEDULER=false — skipping daily accrual cron");
      return {
        date: this.toISTDate(new Date()),
        periodsExamined: 0,
        periodsOverdueFlipped: 0,
        lateFeesAddedPaise: "0",
        nextPeriodsGenerated: 0,
        skipped: true,
      };
    }
    return this.runAccrual();
  }

  // ---------------------------------------------------------------------------
  // runAccrual — main entry point (also called by the manual trigger endpoint)
  // ---------------------------------------------------------------------------

  async runAccrual(nowOverride?: Date): Promise<AccrualResult> {
    // Compute today's date in IST (UTC+5:30)
    const now = nowOverride ?? new Date();
    const istNow = this.toISTDate(now);

    this.logger.log(`Accrual run for IST date: ${istNow}`);

    // BL-13 idempotency: check if a completed run already exists for today
    const existingLog = await this.prisma.rentAccrualLog.findUnique({
      where: { run_date: new Date(istNow) },
    });

    if (existingLog?.finished_at) {
      this.logger.log(`Accrual for ${istNow} already completed. Skipping.`);
      return {
        date: istNow,
        periodsExamined: existingLog.periods_examined,
        periodsOverdueFlipped: existingLog.periods_overdue_flipped,
        lateFeesAddedPaise: existingLog.late_fees_added_paise.toString(),
        nextPeriodsGenerated: existingLog.next_periods_generated,
        skipped: true,
      };
    }

    // Create or update the log row with started_at.
    // M-01: two concurrent calls on the same date race past the existingLog check.
    // The second create will hit the unique index on run_date (P2002) — treat as skip.
    let logEntry: Awaited<ReturnType<typeof this.prisma.rentAccrualLog.create>>;
    try {
      logEntry = existingLog
        ? await this.prisma.rentAccrualLog.update({
            where: { id: existingLog.id },
            data: { started_at: now, finished_at: null, error: null },
          })
        : await this.prisma.rentAccrualLog.create({
            data: { run_date: new Date(istNow), started_at: now },
          });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        // Another concurrent call already created the log for this date.
        this.logger.log(
          `Accrual log P2002 — another run for ${istNow} is already in progress or finished. Skipping.`,
        );
        return {
          date: istNow,
          periodsExamined: 0,
          periodsOverdueFlipped: 0,
          lateFeesAddedPaise: "0",
          nextPeriodsGenerated: 0,
          skipped: true,
        };
      }
      throw err;
    }

    let periodsExamined = 0;
    let periodsOverdueFlipped = 0;
    let lateFeesAddedPaise = 0n;
    let nextPeriodsGenerated = 0;
    let errorMsg: string | null = null;

    // Resolve a valid DB user ID for audit entries
    const actorId = await this.resolveSystemActorId();

    try {
      // BL-12: 5 calendar days past due_date → OVERDUE
      const overdueThreshold = new Date(now);
      overdueThreshold.setDate(overdueThreshold.getDate() - 5);
      // Normalize to date-only (midnight UTC)
      const overdueThresholdDate = new Date(
        Date.UTC(overdueThreshold.getUTCFullYear(), overdueThreshold.getUTCMonth(), overdueThreshold.getUTCDate()),
      );

      // Find all actionable periods (DUE, PARTIAL, OVERDUE) with due_date <= threshold
      const actionablePeriods = await this.prisma.rentPeriod.findMany({
        where: {
          status: { in: ["DUE", "PARTIAL", "OVERDUE"] },
          due_date: { lte: overdueThresholdDate },
        },
        select: {
          id: true,
          lease_id: true,
          due_date: true,
          amount_due_paise: true,
          late_fee_paise: true,
          paid_paise: true,
          outstanding_paise: true,
          status: true,
        },
      });

      periodsExamined = actionablePeriods.length;

      for (const period of actionablePeriods) {
        const dueDate = new Date(period.due_date);
        const dueDateIST = new Date(this.toISTDate(dueDate));

        const todayIST = new Date(istNow);
        const daysOverdue = Math.floor(
          (todayIST.getTime() - dueDateIST.getTime()) / (1000 * 60 * 60 * 24),
        );

        const newLateFee = computeLateFeePaise(period.amount_due_paise, daysOverdue);
        const wasOverdue = period.status === "OVERDUE";
        const newStatus = "OVERDUE";

        const newOutstanding =
          period.amount_due_paise + newLateFee - period.paid_paise < 0n
            ? 0n
            : period.amount_due_paise + newLateFee - period.paid_paise;

        if (!wasOverdue) periodsOverdueFlipped++;

        const lateFeeAdded = newLateFee - period.late_fee_paise;
        if (lateFeeAdded > 0n) lateFeesAddedPaise += lateFeeAdded;

        // Update the period transactionally
        await this.prisma.$transaction(async (tx) => {
          await tx.rentPeriod.update({
            where: { id: period.id },
            data: {
              status: newStatus,
              late_fee_paise: newLateFee,
              outstanding_paise: newOutstanding,
              last_accrued_at: now,
            },
          });

          if (!wasOverdue || lateFeeAdded > 0n) {
            await this.audit.writeLog(tx, {
              actorId,
              action: !wasOverdue ? "rent_period.overdue_flip" : "rent_period.late_fee_accrual",
              entityType: "RentPeriod",
              entityId: period.id,
              before: {
                status: period.status,
                late_fee_paise: period.late_fee_paise.toString(),
                outstanding_paise: period.outstanding_paise.toString(),
              },
              after: {
                status: newStatus,
                days_overdue: daysOverdue,
                late_fee_paise: newLateFee.toString(),
                outstanding_paise: newOutstanding.toString(),
              },
            });
          }
        });
      }

      // Generate next rent period for ACTIVE leases whose latest period ends soon
      const sevenDaysFromNow = new Date(now);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const activeLeases = await this.prisma.lease.findMany({
        where: { status: "ACTIVE" },
        select: {
          id: true,
          monthly_rent_paise: true,
          end_date: true,
          rent_periods: {
            orderBy: { period_start: "desc" },
            take: 1,
            select: {
              id: true,
              period_end: true,
              period_start: true,
            },
          },
        },
      });

      for (const lease of activeLeases) {
        const latestPeriod = lease.rent_periods[0];
        if (!latestPeriod) continue;

        const periodEnd = new Date(latestPeriod.period_end);

        // Generate next period if it ends within 7 days from now
        if (periodEnd <= sevenDaysFromNow) {
          // Check no next period already exists
          const nextStart = new Date(periodEnd);
          nextStart.setDate(nextStart.getDate() + 1);

          const existingNext = await this.prisma.rentPeriod.findUnique({
            where: {
              lease_id_period_start: { lease_id: lease.id, period_start: nextStart },
            },
          });

          if (!existingNext) {
            await this.prisma.$transaction(async (tx) => {
              await this.rentService.generateNextPeriod(
                tx,
                lease.id,
                periodEnd,
                lease.monthly_rent_paise,
                actorId,
              );
            });
            nextPeriodsGenerated++;
          }
        }
      }
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Accrual run error: ${errorMsg}`);
    }

    // Update the log with summary
    await this.prisma.rentAccrualLog.update({
      where: { id: logEntry.id },
      data: {
        finished_at: errorMsg ? null : new Date(),
        periods_examined: periodsExamined,
        periods_overdue_flipped: periodsOverdueFlipped,
        late_fees_added_paise: lateFeesAddedPaise,
        next_periods_generated: nextPeriodsGenerated,
        error: errorMsg,
      },
    });

    if (errorMsg) {
      throw new Error(`Accrual failed: ${errorMsg}`);
    }

    return {
      date: istNow,
      periodsExamined,
      periodsOverdueFlipped,
      lateFeesAddedPaise: lateFeesAddedPaise.toString(),
      nextPeriodsGenerated,
      skipped: false,
    };
  }

  // ---------------------------------------------------------------------------
  // toISTDate — convert a UTC Date to a YYYY-MM-DD string in Asia/Kolkata (IST)
  // ---------------------------------------------------------------------------

  private toISTDate(utcDate: Date): string {
    // IST = UTC + 5:30 (330 minutes)
    const istOffset = 5 * 60 + 30; // minutes
    const istMs = utcDate.getTime() + istOffset * 60 * 1000;
    const istDate = new Date(istMs);
    return istDate.toISOString().slice(0, 10); // YYYY-MM-DD
  }
}
