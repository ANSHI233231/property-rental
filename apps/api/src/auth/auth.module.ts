import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { HashingService } from "./hashing.service";
import { JwtTokenService } from "./jwt.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { PropertyScopeGuard } from "./guards/property-scope.guard";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [
    PrismaModule,
    ConfigModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => [
        {
          ttl: 60000, // 1 minute window
          limit: 100, // 100 req/min per IP
        },
      ],
    }),
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
