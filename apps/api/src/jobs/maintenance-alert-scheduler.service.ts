import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { MAINTENANCE_ALERT_QUEUE, MAINTENANCE_ALERT_JOB } from "./maintenance-alert.processor";

/**
 * MaintenanceAlertSchedulerService — registers the BullMQ repeatable job on startup.
 *
 * Schedule: 00:10 IST daily (cron '10 0 * * *' with tz 'Asia/Kolkata').
 * BL-17: daily run checks for tenants with >= 5 requests in the current calendar month.
 */
@Injectable()
export class MaintenanceAlertSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceAlertSchedulerService.name);

  constructor(
    @InjectQueue(MAINTENANCE_ALERT_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Remove stale repeatable jobs before re-adding to avoid duplicates
    const existing = await this.queue.getRepeatableJobs();
    for (const job of existing) {
      if (job.name === MAINTENANCE_ALERT_JOB) {
        await this.queue.removeRepeatableByKey(job.key);
        this.logger.log(`Removed stale repeatable job: ${job.key}`);
      }
    }

    // Add the daily repeatable job at 00:10 IST (BL-17)
    await this.queue.add(
      MAINTENANCE_ALERT_JOB,
      {},
      {
        repeat: {
          pattern: "10 0 * * *", // 00:10 every day
          tz: "Asia/Kolkata",    // IST (BL-22)
        },
        jobId: `${MAINTENANCE_ALERT_JOB}-scheduled`,
      },
    );

    this.logger.log("Registered daily maintenance-alert job: 00:10 IST (Asia/Kolkata)");
  }
}
