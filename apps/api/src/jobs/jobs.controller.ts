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
import { RentChangeApplyService } from "./rent-change-apply.service";

/**
 * JobsController — manual trigger endpoints for in-process cron services.
 *
 * POST /jobs/rent-accrual/run          — ADMIN only. BL-12/13.
 * POST /jobs/maintenance-alert/run     — ADMIN only. BL-17.
 * POST /jobs/rent-change-apply/run     — ADMIN only. Change 5.
 */
@Controller("jobs")
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobsController {
  private readonly logger = new Logger(JobsController.name);

  constructor(
    private readonly rentAccrualService: RentAccrualService,
    private readonly maintenanceAlertService: MaintenanceAlertService,
    private readonly rentChangeApplyService: RentChangeApplyService,
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

  /**
   * POST /jobs/rent-change-apply/run — Admin only.
   * Manually triggers the rent-change-apply cron for today (Change 5).
   */
  @Post("rent-change-apply/run")
  @Roles("ADMIN")
  @HttpCode(HttpStatus.OK)
  async triggerRentChangeApply() {
    this.logger.log("Manual rent-change-apply trigger via Admin endpoint");
    const result = await this.rentChangeApplyService.applyDueSchedules();
    return {
      message: "Rent change apply run completed",
      result,
    };
  }
}
