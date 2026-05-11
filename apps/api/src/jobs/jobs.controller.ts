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

/**
 * JobsController — manual trigger endpoints for BullMQ workers.
 *
 * POST /jobs/rent-accrual/run — ADMIN only.
 *   Triggers the rent accrual processor synchronously (waits for result).
 *   Used by ops and integration tests with a frozen clock.
 */
@Controller("jobs")
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobsController {
  private readonly logger = new Logger(JobsController.name);

  constructor(
    @InjectQueue(RENT_ACCRUAL_QUEUE) private readonly rentAccrualQueue: Queue,
    private readonly rentAccrualProcessor: RentAccrualProcessor,
  ) {}

  @Post("rent-accrual/run")
  @Roles("ADMIN")
  @HttpCode(HttpStatus.OK)
  async triggerRentAccrual() {
    this.logger.log("Manual rent-accrual trigger via Admin endpoint");
    // Run synchronously so the caller gets the result immediately (ops/test use case)
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
    // Enqueue an immediate job (for async background execution)
    const job = await this.rentAccrualQueue.add(
      RENT_ACCRUAL_JOB,
      {},
      { jobId: `manual-${Date.now()}` },
    );
    return { message: "Rent accrual job enqueued", jobId: job.id };
  }
}
