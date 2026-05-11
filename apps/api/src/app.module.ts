import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_PIPE } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { AuditModule } from "./audit/audit.module";
import { PropertiesModule } from "./properties/properties.module";
import { UnitsModule } from "./units/units.module";
import { TenantsModule } from "./tenants/tenants.module";
import { LeasesModule } from "./leases/leases.module";
import { RentModule } from "./rent/rent.module";
import { JobsModule } from "./jobs/jobs.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env"],
    }),
    // Global throttler configuration: 100 requests per 60-second window per IP.
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1-minute window (ms)
        limit: 100, // 100 requests per window per IP
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    AuditModule,
    UsersModule,
    PropertiesModule,
    UnitsModule,
    TenantsModule,
    LeasesModule,
    RentModule,
    JobsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,        // strip unknown fields
        forbidNonWhitelisted: false,
        transform: true,        // auto-transform (e.g., @Transform on DTOs)
        transformOptions: { enableImplicitConversion: false },
      }),
    },
  ],
})
export class AppModule {}
