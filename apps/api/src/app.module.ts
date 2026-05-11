import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_PIPE } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { CodeErrorFilter } from "./common/filters/code-error.filter";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import type { ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

// The auth-slow / change-pwd buckets are intended for very specific routes
// (password reset, change password). NestJS Throttler applies every named
// throttler to every route unless told otherwise, so without these skipIf
// guards the 5/hour and 5/min limits would lock the whole API after a handful
// of normal requests.
const isPasswordResetRoute = (ctx: ExecutionContext): boolean => {
  const url = ctx.switchToHttp().getRequest<Request>().url;
  return /\/auth\/(forgot-password|reset-password)(\?|$|\/)/.test(url);
};
const isChangePasswordRoute = (ctx: ExecutionContext): boolean => {
  const url = ctx.switchToHttp().getRequest<Request>().url;
  return /\/users\/me\/change-password(\?|$|\/)/.test(url);
};
import { LoggerModule } from "nestjs-pino";
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
import { MaintenanceModule } from "./maintenance/maintenance.module";
import { JobsModule } from "./jobs/jobs.module";
import { AuditLogModule } from "./audit-log/audit-log.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env"],
    }),
    // Phase 7: structured pino logger with PII redaction.
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env["NODE_ENV"] === "production" ? "info" : "debug",
        // Redact sensitive fields from all log records (Phase 7 — §10).
        redact: {
          paths: [
            "password",
            "password_hash",
            "token",
            "refreshToken",
            "accessToken",
            "secret",
            "cookie",
            "*.dob",
            "*.id_proof_number",
            "req.headers.authorization",
            "req.headers.cookie",
          ],
          censor: "[REDACTED]",
        },
        transport:
          process.env["NODE_ENV"] !== "production"
            ? { target: "pino-pretty", options: { singleLine: true } }
            : undefined,
      },
    }),
    // Phase 7: Named throttlers for fine-grained per-endpoint rate limits.
    // - "default"    : 100 req/min per IP — all routes inherit this.
    // - "login"      : 10 req/min per IP — POST /auth/login.
    // - "auth-slow"  : 5 req/hour per IP — POST /auth/forgot-password and /reset-password.
    // - "change-pwd" : 5 req/min per user — POST /users/me/change-password (JWT tracker).
    //
    // In the Jest test environment (`NODE_ENV=test`), all limits are raised to
    // 100 000/min so throttling never interferes with integration tests.
    // Integration tests that explicitly verify rate-limit behaviour override the
    // ThrottlerStorage provider directly (see phase7-hardening.spec.ts).
    ThrottlerModule.forRoot(
      process.env["NODE_ENV"] === "test"
        ? [
            { name: "default",    ttl: 60000,   limit: 100000 },
            { name: "login",      ttl: 60000,   limit: 100000 },
            { name: "auth-slow",  ttl: 3600000, limit: 100000, skipIf: (ctx) => !isPasswordResetRoute(ctx) },
            { name: "change-pwd", ttl: 60000,   limit: 100000, skipIf: (ctx) => !isChangePasswordRoute(ctx) },
          ]
        : [
            { name: "default",    ttl: 60000,   limit: 100   },
            { name: "login",      ttl: 60000,   limit: 10    },
            { name: "auth-slow",  ttl: 3600000, limit: 5,     skipIf: (ctx) => !isPasswordResetRoute(ctx) },
            { name: "change-pwd", ttl: 60000,   limit: 5,     skipIf: (ctx) => !isChangePasswordRoute(ctx) },
          ],
    ),
    PrismaModule,
    HealthModule,
    AuthModule,
    AuditModule,
    AuditLogModule,
    UsersModule,
    PropertiesModule,
    UnitsModule,
    TenantsModule,
    LeasesModule,
    RentModule,
    MaintenanceModule,
    JobsModule,
  ],
  providers: [
    // Global exception filter — normalises every error to { error: { code, message } }
    // so the FE error-mapper (apps/web/src/lib/api/errors.ts) always receives a
    // stable machine-readable `code` field (BUG-PHASE-4-1).
    {
      provide: APP_FILTER,
      useClass: CodeErrorFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,        // strip unknown fields
        forbidNonWhitelisted: true,  // Phase 7 fix: M-04 — reject unknown fields with 400
        transform: true,        // auto-transform (e.g., @Transform on DTOs)
        transformOptions: { enableImplicitConversion: false },
      }),
    },
  ],
})
export class AppModule {}
