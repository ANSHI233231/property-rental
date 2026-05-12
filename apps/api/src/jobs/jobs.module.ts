import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { RentAccrualService } from "./rent-accrual.service";
import { MaintenanceAlertService } from "./maintenance-alert.service";
import { JobsController } from "./jobs.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { RentModule } from "../rent/rent.module";
import { MaintenanceModule } from "../maintenance/maintenance.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    AuditModule,
    RentModule,
    MaintenanceModule,
  ],
  providers: [
    RentAccrualService,
    MaintenanceAlertService,
  ],
  controllers: [JobsController],
  exports: [RentAccrualService, MaintenanceAlertService],
})
export class JobsModule {}
