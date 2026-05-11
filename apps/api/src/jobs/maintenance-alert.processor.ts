import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";
import { MaintenanceService } from "../maintenance/maintenance.service";

export const MAINTENANCE_ALERT_QUEUE = "maintenance-alert";
export const MAINTENANCE_ALERT_JOB = "daily-alert-check";

/**
 * MaintenanceAlertProcessor — BullMQ worker for BL-17 alert generation.
 *
 * Scheduled at 00:10 IST (cron: '10 0 * * *', TZ: Asia/Kolkata).
 *
 * Logic:
 *   For each (tenant_user_id, unit_id) combination with >= 5 maintenance_requests
 *   in the current calendar month (1st 00:00 IST → last-day 23:59:59 IST):
 *   - Create a MaintenanceAlert row if not exists (BL-17 idempotent).
 *   - Update request_count if the row exists but count changed.
 *   - Dismissal state is preserved (never reset by a subsequent run).
 */
@Processor(MAINTENANCE_ALERT_QUEUE)
export class MaintenanceAlertProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceAlertProcessor.name);

  constructor(private readonly maintenanceService: MaintenanceService) {
    super();
  }

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing maintenance-alert job ${job.id}`);
    await this.runAlertCheck();
  }

  @OnWorkerEvent("completed")
  onCompleted(job: Job) {
    this.logger.log(`Maintenance-alert job ${job.id} completed`);
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job, err: Error) {
    this.logger.error(
      `Maintenance-alert job ${job.id} failed: ${err.message}`,
      err.stack,
    );
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
