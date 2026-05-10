import { Module } from "@nestjs/common";
import { UnitsController, PropertyUnitsController } from "./units.controller";
import { UnitsService } from "./units.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [PrismaModule, AuthModule, AuditModule],
  controllers: [UnitsController, PropertyUnitsController],
  providers: [UnitsService],
  exports: [UnitsService],
})
export class UnitsModule {}
