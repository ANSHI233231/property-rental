import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_PIPE } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Read .env from the apps/api directory; the monorepo root .env.example
      // is the documentation source. Each app maintains its own runtime .env.
      envFilePath: [".env"],
    }),
    // Global throttler configuration: 100 requests per 60-second window per IP.
    // ThrottlerGuard is registered as APP_GUARD below so every controller inherits
    // these limits. Individual endpoints may override via @Throttle() decorators.
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1-minute window (ms)
        limit: 100, // 100 requests per window per IP
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
  ],
  providers: [
    // H-01 fix: register ThrottlerGuard globally so @Throttle() decorators are
    // actually enforced. Without this the decorators are pure metadata no-ops.
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
