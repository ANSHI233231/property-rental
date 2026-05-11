import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { HashingService } from "./hashing.service";
import { JwtTokenService } from "./jwt.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { PropertyScopeGuard } from "./guards/property-scope.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    AuditModule,
    // ThrottlerModule is registered globally in AppModule (H-01 fix).
    // No local registration needed here.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: configService.get<string>("JWT_ACCESS_TTL") ?? "15m",
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, HashingService, JwtTokenService, JwtAuthGuard, RolesGuard, PropertyScopeGuard],
  exports: [AuthService, HashingService, JwtTokenService, JwtAuthGuard, RolesGuard, PropertyScopeGuard],
})
export class AuthModule {}
