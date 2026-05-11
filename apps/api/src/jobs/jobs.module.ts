import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { RentAccrualProcessor, RENT_ACCRUAL_QUEUE } from "./rent-accrual.processor";
import { RentAccrualSchedulerService } from "./rent-accrual-scheduler.service";
import { JobsController } from "./jobs.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { RentModule } from "../rent/rent.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AuditModule,
    RentModule,
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
        removeOnComplete: 100, // keep last 100 completed jobs
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
      },
    }),
  ],
  providers: [RentAccrualProcessor, RentAccrualSchedulerService],
  controllers: [JobsController],
  exports: [BullModule],
})
export class JobsModule {}
