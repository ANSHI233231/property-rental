import { Module } from "@nestjs/common";
import { RentChangeScheduleService } from "./rent-change-schedule.service";
import { RentChangeScheduleController } from "./rent-change-schedule.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [PrismaModule, AuditModule, NotificationsModule, AuthModule],
  providers: [RentChangeScheduleService],
  controllers: [RentChangeScheduleController],
  exports: [RentChangeScheduleService],
})
export class RentChangeScheduleModule {}
