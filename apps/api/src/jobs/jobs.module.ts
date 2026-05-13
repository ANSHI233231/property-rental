import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { RentAccrualService } from "./rent-accrual.service";
import { MaintenanceAlertService } from "./maintenance-alert.service";
import { RentChangeApplyService } from "./rent-change-apply.service";
import { JobsController } from "./jobs.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { RentModule } from "../rent/rent.module";
import { MaintenanceModule } from "../maintenance/maintenance.module";
import { RentChangeScheduleModule } from "../rent-change-schedule/rent-change-schedule.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    AuditModule,
    RentModule,
    MaintenanceModule,
    RentChangeScheduleModule,
  ],
  providers: [
    RentAccrualService,
    MaintenanceAlertService,
    RentChangeApplyService,
  ],
  controllers: [JobsController],
  exports: [RentAccrualService, MaintenanceAlertService, RentChangeApplyService],
})
export class JobsModule {}
