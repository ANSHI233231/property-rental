import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { MaintenanceService } from "../maintenance/maintenance.service";

/**
 * MaintenanceAlertService — @nestjs/schedule cron for BL-17 alert generation.
 *
 * Scheduled at 00:10 IST (cron: '10 0 * * *', TZ: Asia/Kolkata).
 *
 * Logic:
 *   For each (tenant_user_id, unit_id) combination with >= 5 maintenance_requests
 *   in the current calendar month (1st 00:00 IST → last-day 23:59:59 IST):
 *   - Create a MaintenanceAlert row if not exists (BL-17 idempotent).
 *   - Update request_count if the row exists but count changed.
 *   - Dismissal state is preserved (never reset by a subsequent run).
 *
 * RUN_SCHEDULER env flag: set to 'false' to disable cron triggers on additional replicas.
 */
@Injectable()
export class MaintenanceAlertService {
  private readonly logger = new Logger(MaintenanceAlertService.name);

  constructor(
    private readonly maintenanceService: MaintenanceService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Daily cron at 00:10 IST (BL-17).
   * RUN_SCHEDULER=false skips execution (safe for additional replicas).
   */
  @Cron("10 0 * * *", { timeZone: "Asia/Kolkata" })
  async runDailyMaintenanceAlert(): Promise<{
    monthKey: string;
    tenantsChecked: number;
    alertsCreated: number;
    alertsUpdated: number;
    skipped?: boolean;
  }> {
    if (this.config.get<string>("RUN_SCHEDULER") === "false") {
      this.logger.log("RUN_SCHEDULER=false — skipping daily maintenance-alert cron");
      return {
        monthKey: "",
        tenantsChecked: 0,
        alertsCreated: 0,
        alertsUpdated: 0,
        skipped: true,
      };
    }
    return this.runAlertCheck();
  }

  // ---------------------------------------------------------------------------
  // runAlertCheck — also called directly by the manual trigger endpoint and tests
  // ---------------------------------------------------------------------------

  async runAlertCheck(nowOverride?: Date): Promise<{
    monthKey: string;
    tenantsChecked: number;
    alertsCreated: number;
    alertsUpdated: number;
  }> {
    const result = await this.maintenanceService.runAlertCheck(nowOverride);
    this.logger.log(
      `Alert check done — month=${result.monthKey} checked=${result.tenantsChecked} ` +
      `created=${result.alertsCreated} updated=${result.alertsUpdated}`,
    );
    return result;
  }
}
