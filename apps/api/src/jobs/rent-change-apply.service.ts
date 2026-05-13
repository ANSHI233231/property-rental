import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { RentChangeScheduleService } from "../rent-change-schedule/rent-change-schedule.service";

/**
 * RentChangeApplyService — daily cron at 00:15 IST.
 *
 * Finds all PENDING RentChangeSchedule rows with effective_date <= today (IST)
 * and, for each, atomically:
 *   1. Sets unit.monthly_rent_paise = schedule.new_amount_paise.
 *   2. Flips schedule.status to APPLIED + sets applied_at.
 *   3. Writes an audit log entry.
 *
 * Idempotent: the status flip from PENDING → APPLIED means re-running the cron
 * on the same day is a safe no-op (the row is no longer PENDING).
 *
 * RUN_SCHEDULER=false disables cron triggers on additional replicas.
 */
@Injectable()
export class RentChangeApplyService {
  private readonly logger = new Logger(RentChangeApplyService.name);

  constructor(
    private readonly rentChangeScheduleService: RentChangeScheduleService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Daily cron at 00:15 IST (runs 5 minutes after the rent-accrual job at 00:05).
   */
  @Cron("15 0 * * *", { timeZone: "Asia/Kolkata" })
  async runDailyApply(): Promise<void> {
    if (this.config.get<string>("RUN_SCHEDULER") === "false") {
      this.logger.log("RUN_SCHEDULER=false — skipping rent-change-apply cron");
      return;
    }
    await this.applyDueSchedules();
  }

  /**
   * Main apply logic — exposed for manual triggering via JobsController.
   */
  async applyDueSchedules(nowOverride?: Date): Promise<{ applied: number; errors: number }> {
    const now = nowOverride ?? new Date();
    this.logger.log(`rent-change-apply: running for UTC=${now.toISOString()}`);

    const result = await this.rentChangeScheduleService.applyDue(now);

    this.logger.log(
      `rent-change-apply: applied=${result.applied} errors=${result.errors}`,
    );

    return result;
  }
}
