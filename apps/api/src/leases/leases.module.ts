import { Module, forwardRef } from "@nestjs/common";
import { LeasesController } from "./leases.controller";
import { LeasesService } from "./leases.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AuditModule } from "../audit/audit.module";
import { RentModule } from "../rent/rent.module";

@Module({
  imports: [PrismaModule, AuthModule, AuditModule, forwardRef(() => RentModule)],
  controllers: [LeasesController],
  providers: [LeasesService],
  exports: [LeasesService],
})
export class LeasesModule {}
