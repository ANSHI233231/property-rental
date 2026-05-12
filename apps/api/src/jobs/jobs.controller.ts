import {
  Controller,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RentAccrualService } from "./rent-accrual.service";
import { MaintenanceAlertService } from "./maintenance-alert.service";

/**
 * JobsController — manual trigger endpoints for in-process cron services.
 *
 * POST /jobs/rent-accrual/run          — ADMIN only. BL-12/13.
 * POST /jobs/maintenance-alert/run     — ADMIN only. BL-17.
 */
@Controller("jobs")
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobsController {
  private readonly logger = new Logger(JobsController.name);

  constructor(
    private readonly rentAccrualService: RentAccrualService,
    private readonly maintenanceAlertService: MaintenanceAlertService,
  ) {}

  @Post("rent-accrual/run")
  @Roles("ADMIN")
  @HttpCode(HttpStatus.OK)
  async triggerRentAccrual() {
    this.logger.log("Manual rent-accrual trigger via Admin endpoint");
    const result = await this.rentAccrualService.runAccrual();
    return {
      message: "Rent accrual run completed",
      result,
    };
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
    const result = await this.maintenanceAlertService.runAlertCheck();
    return {
      message: "Maintenance alert check completed",
      result,
    };
  }
}
