import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { RENT_ACCRUAL_QUEUE, RENT_ACCRUAL_JOB } from "./rent-accrual.processor";

/**
 * RentAccrualSchedulerService — registers the BullMQ repeatable job on startup.
 *
 * Schedule: 00:05 IST daily (cron '5 0 * * *' with tz 'Asia/Kolkata').
 * BL-12 / BL-13: daily run flips overdue status and accrues late fees.
 *
 * Uses OnModuleInit so the schedule is registered after the queue connection
 * is established, and only once per application lifecycle.
 */
@Injectable()
export class RentAccrualSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(RentAccrualSchedulerService.name);

  constructor(
    @InjectQueue(RENT_ACCRUAL_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    // Remove stale repeatable jobs before re-adding to avoid duplicates
    const existing = await this.queue.getRepeatableJobs();
    for (const job of existing) {
      if (job.name === RENT_ACCRUAL_JOB) {
        await this.queue.removeRepeatableByKey(job.key);
        this.logger.log(`Removed stale repeatable job: ${job.key}`);
      }
    }

    // Add the daily repeatable job
    await this.queue.add(
      RENT_ACCRUAL_JOB,
      {},
      {
        repeat: {
          pattern: "5 0 * * *", // 00:05 every day
          tz: "Asia/Kolkata",   // IST (BL-22)
        },
        jobId: `${RENT_ACCRUAL_JOB}-scheduled`,
      },
    );

    this.logger.log("Registered daily rent-accrual job: 00:05 IST (Asia/Kolkata)");
  }
}
