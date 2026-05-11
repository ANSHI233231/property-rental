import {
  Controller,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RentAccrualProcessor, RENT_ACCRUAL_QUEUE, RENT_ACCRUAL_JOB } from "./rent-accrual.processor";
import { MaintenanceAlertProcessor, MAINTENANCE_ALERT_QUEUE } from "./maintenance-alert.processor";

/**
 * JobsController — manual trigger endpoints for BullMQ workers.
 *
 * POST /jobs/rent-accrual/run          — ADMIN only. Phase 4.
 * POST /jobs/rent-accrual/schedule     — ADMIN only. Phase 4 async.
 * POST /jobs/maintenance-alert/run     — ADMIN only. Phase 5 (BL-17 manual trigger).
 */
@Controller("jobs")
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobsController {
  private readonly logger = new Logger(JobsController.name);

  constructor(
    @InjectQueue(RENT_ACCRUAL_QUEUE) private readonly rentAccrualQueue: Queue,
    private readonly rentAccrualProcessor: RentAccrualProcessor,
    @InjectQueue(MAINTENANCE_ALERT_QUEUE) private readonly maintenanceAlertQueue: Queue,
    private readonly maintenanceAlertProcessor: MaintenanceAlertProcessor,
  ) {}

  @Post("rent-accrual/run")
  @Roles("ADMIN")
  @HttpCode(HttpStatus.OK)
  async triggerRentAccrual() {
    this.logger.log("Manual rent-accrual trigger via Admin endpoint");
    const result = await this.rentAccrualProcessor.runAccrual();
    return {
      message: "Rent accrual run completed",
      result,
    };
  }

  @Post("rent-accrual/schedule")
  @Roles("ADMIN")
  @HttpCode(HttpStatus.OK)
  async scheduleRentAccrual() {
    const job = await this.rentAccrualQueue.add(
      RENT_ACCRUAL_JOB,
      {},
      { jobId: `manual-${Date.now()}` },
    );
    return { message: "Rent accrual job enqueued", jobId: job.id };
  }

  /**
   * POST /jobs/maintenance-alert/run — Admin only.
   * Runs BL-17 alert check synchronously; used by ops and integration tests.
   */
  @Post("maintenance-alert/run")
  @Roles("ADMIN")
  @HttpCode(HttpStatus.OK)
  async triggerMaintenanceAlert() {
    this.logger.log("Manual maintenance-alert trigger via Admin endpoint");
    const result = await this.maintenanceAlertProcessor.runAlertCheck();
    return {
      message: "Maintenance alert check completed",
      result,
    };
  }
}
