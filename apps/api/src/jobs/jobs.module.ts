import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { RentAccrualProcessor, RENT_ACCRUAL_QUEUE } from "./rent-accrual.processor";
import { RentAccrualSchedulerService } from "./rent-accrual-scheduler.service";
import { MaintenanceAlertProcessor, MAINTENANCE_ALERT_QUEUE } from "./maintenance-alert.processor";
import { MaintenanceAlertSchedulerService } from "./maintenance-alert-scheduler.service";
import { JobsController } from "./jobs.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { RentModule } from "../rent/rent.module";
import { MaintenanceModule } from "../maintenance/maintenance.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuditModule,
    RentModule,
    MaintenanceModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>("REDIS_HOST") ?? "localhost";
        const port = parseInt(config.get<string>("REDIS_PORT") ?? "6380", 10);
        const password = config.get<string>("REDIS_PASSWORD");
        return {
          connection: {
            host,
            port,
            ...(password ? { password } : {}),
          },
        };
      },
    }),
    BullModule.registerQueue({
      name: RENT_ACCRUAL_QUEUE,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    }),
    BullModule.registerQueue({
      name: MAINTENANCE_ALERT_QUEUE,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    }),
  ],
  providers: [
    RentAccrualProcessor,
    RentAccrualSchedulerService,
    MaintenanceAlertProcessor,
    MaintenanceAlertSchedulerService,
  ],
  controllers: [JobsController],
  exports: [BullModule],
})
export class JobsModule {}
