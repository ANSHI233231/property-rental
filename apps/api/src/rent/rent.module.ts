import { Module } from "@nestjs/common";
import { RentController } from "./rent.controller";
import { RentService } from "./rent.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [RentController],
  providers: [RentService],
  exports: [RentService],
})
export class RentModule {}
