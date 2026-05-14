/**
 * Security regression tests for H-01 and H-02 fixes.
 *
 * H-01: ThrottlerGuard registered globally — verified by inspecting the
 *       AppModule providers metadata for an APP_GUARD binding to ThrottlerGuard,
 *       and by confirming ThrottlerModule appears in the imports list.
 *
 * H-02: Raw reset token never logged in production — verified by spying on
 *       Logger.prototype.log during forgotPassword with NODE_ENV=production.
 */

import { APP_GUARD } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { Test } from "@nestjs/testing";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule } from "@nestjs/config";
import "reflect-metadata";
import { AppModule } from "../app.module";
import { AuthService } from "./auth.service";
import { HashingService } from "./hashing.service";
import { JwtTokenService } from "./jwt.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { EmailService } from "../notifications/email.service";

// ---------------------------------------------------------------------------
// Minimal Prisma mock (no real DB needed for these tests)
// ---------------------------------------------------------------------------

const mockUser = {
  id: 1, // Int PK (BL int-id refactor: was "sec-test-user-id")
  email: "admin@gharsetu.local",
  name: "Security Test Admin",
  password_hash: "",
  role: 0, // ADMIN=0 (BL int-id refactor: was "ADMIN")
  is_active: true,
  failed_login_count: 0,
  locked_until: null,
  phone: null,
  created_by_user_id: null,
  created_at: new Date(),
  updated_at: new Date(),
};

const prismaMock = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
  refreshToken: {
    create: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({}),
  },
  passwordResetToken: {
    updateMany: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue({}),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  auditLog: {
    create: jest.fn().mockResolvedValue({}),
  },
  $transaction: jest.fn().mockImplementation((fn: (tx: unknown) => unknown) => fn(prismaMock)),
};

// ---------------------------------------------------------------------------
// H-01: ThrottlerGuard is registered as a global APP_GUARD in AppModule
// ---------------------------------------------------------------------------

describe("H-01 — ThrottlerGuard registered as global APP_GUARD", () => {
  it("SEC-H01-001: AppModule @Module providers list contains APP_GUARD -> ThrottlerGuard", () => {
    // NestJS stores @Module({ providers }) metadata under the key "providers".
    // This is the exact same metadata the DI container reads at bootstrap — no
    // running server or DB connection is required.
    const providers = Reflect.getMetadata(
      "providers",
      AppModule,
    ) as Array<{ provide: unknown; useClass: unknown }>;

    expect(Array.isArray(providers)).toBe(true);

    const throttlerGuardEntry = providers.find(
      (p) => p.provide === APP_GUARD && p.useClass === ThrottlerGuard,
    );

    expect(throttlerGuardEntry).toBeDefined();
  });

  it("SEC-H01-002: AppModule imports include ThrottlerModule (global throttle config)", () => {
    // NestJS stores @Module({ imports }) metadata under the key "imports".
    const imports = Reflect.getMetadata("imports", AppModule) as Array<{
      module?: unknown;
    }>;

    expect(Array.isArray(imports)).toBe(true);

    // ThrottlerModule.forRoot() returns a DynamicModule whose .module === ThrottlerModule.
    const hasThrottlerImport = imports.some(
      (imp) =>
        imp === ThrottlerModule ||
        (imp &&
          typeof imp === "object" &&
          (imp as { module?: unknown }).module === ThrottlerModule),
    );

    expect(hasThrottlerImport).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// H-02: Raw reset token is never logged in production
// ---------------------------------------------------------------------------

describe("H-02 — Reset token not logged in production", () => {
  let authService: AuthService;
  let logSpy: jest.SpyInstance;
  const originalNodeEnv = process.env["NODE_ENV"];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_SECRET: "unit_test_secret_32chars_minimum_xxx",
              JWT_ACCESS_TTL: "15m",
              NODE_ENV: "production",
            }),
          ],
        }),
        JwtModule.register({
          secret: "unit_test_secret_32chars_minimum_xxx",
          signOptions: { expiresIn: "15m" },
        }),
      ],
      providers: [
        AuthService,
        HashingService,
        JwtTokenService,
        { provide: PrismaService, useValue: prismaMock },
        {
          provide: AuditService,
          useValue: {
            writeLog: jest.fn().mockResolvedValue(undefined),
            writeLogDirect: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
            sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.passwordResetToken.updateMany.mockResolvedValue({});
    prismaMock.passwordResetToken.create.mockResolvedValue({});

    // Spy on Logger.prototype.log to capture all log calls
    logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);

    // Belt-and-suspenders: also set the process-level env var
    process.env["NODE_ENV"] = "production";
  });

  afterEach(() => {
    logSpy.mockRestore();
    process.env["NODE_ENV"] = originalNodeEnv;
  });

  it("SEC-H02-001: Logger.log is never called during forgotPassword in production", async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser);

    await authService.forgotPassword("admin@gharsetu.local");

    // No Logger.log call should have been made at all
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("SEC-H02-002: no log call contains a reset-password URL pattern in production", async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser);

    await authService.forgotPassword("admin@gharsetu.local");

    // Flatten all arguments across all calls and check for the token URL shape
    const allArgs = logSpy.mock.calls.flat().map(String);
    const hasResetUrl = allArgs.some((arg) => /reset-password\/[a-f0-9]+/i.test(arg));
    expect(hasResetUrl).toBe(false);
  });

});
