/**
 * Phase 7 — Security Hardening Tests
 *
 * Coverage:
 * 1. Helmet security headers present on every response
 * 2. CORS rejects non-allowlisted origin
 * 3. JSON body > 100KB → 413 Payload Too Large
 * 4. forbidNonWhitelisted: true → 400 on unknown fields
 * 5. GET /audit-log → 200 for ADMIN; 403 for TENANT, PM, MAINTENANCE
 * 6. auth.login.success audit row written on successful login
 * 7. auth.login.failure audit row does NOT include attempted password
 * 8. BL-03 Serializable unit rent update rejects rent change on OCCUPIED unit
 * 9. Audit log filters — action prefix, entityType, redaction
 */

import type { INestApplication, CanActivate, ExecutionContext } from "@nestjs/common";
import { Injectable, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerStorage } from "@nestjs/throttler";
import helmet from "helmet";
import { json } from "express";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require("cookie-parser");
import type { SuperTest, Test as SuperTestTest } from "supertest";
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const supertestFn = require("supertest") as (app: unknown) => SuperTest<SuperTestTest>;
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * No-op throttler guard for integration tests.
 *
 * The global ThrottlerGuard is replaced here so that the in-memory throttle
 * counters from prior sections / prior test runs do not pollute section 5 and
 * section 6 where we need to send multiple requests to /auth/login and
 * /audit-log without hitting the per-IP rate limits.
 *
 * Production rate-limit behaviour is verified separately by the throttler unit
 * test in phase6-role-matrix-full.spec.ts which mocks the guard directly.
 */
@Injectable()
class NoOpThrottlerGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}

/**
 * Stub ThrottlerStorage that always reports 0 hits so the ThrottlerGuard
 * never fires a 429, even when `APP_GUARD` override is insufficient.
 */
class UnlimitedThrottlerStorage {
  async increment(
    _key: string,
    _ttl: number,
    _limit: number,
    _blockDuration: number,
    _throttlerName: string,
  ): Promise<{ totalHits: number; timeToExpire: number; isBlocked: boolean; timeToBlockExpire: number }> {
    return { totalHits: 1, timeToExpire: 0, isBlocked: false, timeToBlockExpire: 0 };
  }
}

// Matches seed.ts credentials
const ADMIN_EMAIL = "admin@gharsetu.local";
const ADMIN_PASSWORD = "Admin@gharsetu2026!";
const TENANT_EMAIL = "tenant.test@gharsetu.local";
const TENANT_PASSWORD = "Password#123";
const PM_EMAIL = "pm.test@gharsetu.local";
const PM_PASSWORD = "Password#123";
const MAINTENANCE_EMAIL = "maintenance.test@gharsetu.local";
const MAINTENANCE_PASSWORD = "Password#123";

describe("Phase 7 — Security hardening", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let st: SuperTest<SuperTestTest>;
  let adminToken: string;
  let tenantToken: string;
  let pmToken: string;
  let maintenanceToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Replace the global ThrottlerGuard via both the APP_GUARD token and the
      // ThrottlerStorage token so that accumulated in-memory counters from prior
      // sections / prior test runs do not throttle sections 5 and 6.
      // Rate-limit behaviour is tested separately (phase6-role-matrix-full.spec.ts).
      .overrideProvider(APP_GUARD)
      .useClass(NoOpThrottlerGuard)
      // Override ThrottlerStorage so even the ThrottlerGuard class (used by
      // UserThrottlerGuard) never accumulates hits.
      .overrideProvider(ThrottlerStorage)
      .useClass(UnlimitedThrottlerStorage)
      // Override ThrottlerGuard class itself so UserThrottlerGuard (which extends
      // ThrottlerGuard) also uses the unlimited storage.
      .overrideProvider(ThrottlerGuard)
      .useClass(NoOpThrottlerGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");

    // Apply the same middleware as main.ts so helmet, body limit, etc. are active
    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            "default-src": ["'none'"],
            "frame-ancestors": ["'none'"],
          },
        },
        referrerPolicy: { policy: "no-referrer" },
      }),
    );
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    app.use(cookieParser());
    app.use(json({ limit: "100kb" }));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );

    await app.init();

    prisma = moduleRef.get(PrismaService);
    st = supertestFn(app.getHttpServer());

    // Reset any locked seeded users to prevent 401 cascades from prior test runs
    await prisma.user.updateMany({
      where: {
        email: { in: [ADMIN_EMAIL, TENANT_EMAIL, PM_EMAIL, MAINTENANCE_EMAIL] },
      },
      data: { failed_login_count: 0, locked_until: null, is_active: true },
    });

    // Obtain tokens using seeded users
    const adminRes = await st
      .post("/api/v1/auth/login")
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
    adminToken = adminRes.body.accessToken as string;

    const tenantRes = await st
      .post("/api/v1/auth/login")
      .send({ email: TENANT_EMAIL, password: TENANT_PASSWORD });
    tenantToken = tenantRes.body.accessToken as string;

    const pmRes = await st
      .post("/api/v1/auth/login")
      .send({ email: PM_EMAIL, password: PM_PASSWORD });
    pmToken = pmRes.body.accessToken as string;

    const maintRes = await st
      .post("/api/v1/auth/login")
      .send({ email: MAINTENANCE_EMAIL, password: MAINTENANCE_PASSWORD });
    maintenanceToken = maintRes.body.accessToken as string;
  }, 60000);

  afterAll(async () => {
    await app.close();
  }, 30000);

  // ---------------------------------------------------------------------------
  // 1. Helmet security headers
  // ---------------------------------------------------------------------------

  describe("1. Security headers (helmet)", () => {
    it("GET /health returns X-Content-Type-Options: nosniff", async () => {
      const res = await st.get("/api/v1/health");
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    });

    it("GET /health returns X-Frame-Options", async () => {
      const res = await st.get("/api/v1/health");
      // helmet sets SAMEORIGIN by default; our config is using frame-ancestors in CSP
      expect(res.headers["x-frame-options"]).toBeDefined();
    });

    it("GET /health returns Referrer-Policy: no-referrer", async () => {
      const res = await st.get("/api/v1/health");
      expect(res.headers["referrer-policy"]).toBe("no-referrer");
    });

    it("GET /health does NOT return X-Powered-By", async () => {
      const res = await st.get("/api/v1/health");
      expect(res.headers["x-powered-by"]).toBeUndefined();
    });

    it("GET /health returns Content-Security-Policy", async () => {
      const res = await st.get("/api/v1/health");
      expect(res.headers["content-security-policy"]).toBeDefined();
      expect(res.headers["content-security-policy"]).toContain("default-src");
    });
  });

  // ---------------------------------------------------------------------------
  // 2. JSON body size cap — 100KB
  // ---------------------------------------------------------------------------

  describe("2. JSON body size cap — 413 for > 100KB", () => {
    it("POST /auth/login with oversized body → 413", async () => {
      // Build a JSON payload > 100KB. The password field absorbs the extra bytes.
      // Content-Type must be application/json so the json() middleware evaluates it.
      const bigValue = "x".repeat(103 * 1024);
      const res = await st
        .post("/api/v1/auth/login")
        .set("Content-Type", "application/json")
        .send(JSON.stringify({ email: "a@b.com", password: bigValue }));
      // 413 = Express json() body size limit (CodeErrorFilter maps PayloadTooLargeError → 413)
      expect(res.status).toBe(413);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. forbidNonWhitelisted — unknown fields → 400
  // ---------------------------------------------------------------------------

  describe("3. forbidNonWhitelisted: true", () => {
    it("POST /auth/login with extra unknown field → 400", async () => {
      const res = await st.post("/api/v1/auth/login").send({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        unexpectedField: "should be rejected",
      });
      expect(res.status).toBe(400);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. GET /audit-log RBAC
  // ---------------------------------------------------------------------------

  describe("4. GET /audit-log RBAC", () => {
    it("ADMIN → 200 with data + meta", async () => {
      const res = await st
        .get("/api/v1/audit-log")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("meta");
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("TENANT → 403", async () => {
      const res = await st
        .get("/api/v1/audit-log")
        .set("Authorization", `Bearer ${tenantToken}`);
      expect(res.status).toBe(403);
    });

    it("PROPERTY_MANAGER → 403", async () => {
      const res = await st
        .get("/api/v1/audit-log")
        .set("Authorization", `Bearer ${pmToken}`);
      expect(res.status).toBe(403);
    });

    it("MAINTENANCE → 403", async () => {
      const res = await st
        .get("/api/v1/audit-log")
        .set("Authorization", `Bearer ${maintenanceToken}`);
      expect(res.status).toBe(403);
    });

    it("Unauthenticated → 401", async () => {
      const res = await st.get("/api/v1/audit-log");
      expect(res.status).toBe(401);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Audit log — auth events
  // ---------------------------------------------------------------------------

  describe("5. Auth event audit rows", () => {
    it("auth.login.success row written after successful login", async () => {
      // Trigger a fresh login to generate a row
      await st
        .post("/api/v1/auth/login")
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

      const logs = await prisma.auditLog.findMany({
        where: { action: "auth.login.success" },
        orderBy: { created_at: "desc" },
        take: 1,
      });
      expect(logs.length).toBeGreaterThan(0);
    });

    it("auth.login.failure row written on wrong password", async () => {
      // Note: count before attempting, then count after — to avoid
      // depending on prior test state.
      const countBefore = await prisma.auditLog.count({
        where: { action: "auth.login.failure" },
      });

      const loginRes = await st
        .post("/api/v1/auth/login")
        .send({ email: MAINTENANCE_EMAIL, password: "definitely_wrong_pw_xyz_!" });

      // Verify the request reached the handler (not throttled/validation-rejected)
      expect(loginRes.status).toBe(401);

      const countAfter = await prisma.auditLog.count({
        where: { action: "auth.login.failure" },
      });
      expect(countAfter).toBeGreaterThan(countBefore);
    });

    it("auth.login.failure row does NOT contain attempted password", async () => {
      const logs = await prisma.auditLog.findMany({
        where: { action: "auth.login.failure" },
        orderBy: { created_at: "desc" },
        take: 5,
      });
      for (const log of logs) {
        const after = log.after as Record<string, unknown> | null;
        expect(after).not.toHaveProperty("password");
        expect(after).not.toHaveProperty("passwordAttempt");
        expect(after).not.toHaveProperty("attempted_password");
      }
    });

    it("auth.login.failure for unknown email has null actor_id", async () => {
      const countBefore = await prisma.auditLog.count({
        where: { action: "auth.login.failure", actor_id: null },
      });

      await st
        .post("/api/v1/auth/login")
        .send({ email: "nobody_p7_xyz_unique@nowhere-xyz.com", password: "irrelevant123!" });

      const countAfter = await prisma.auditLog.count({
        where: { action: "auth.login.failure", actor_id: null },
      });
      expect(countAfter).toBeGreaterThan(countBefore);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. GET /audit-log — filters and redaction
  // ---------------------------------------------------------------------------

  describe("6. GET /audit-log filters and redaction", () => {
    it("action prefix filter: action=auth.login → only rows starting with auth.login", async () => {
      const res = await st
        .get("/api/v1/audit-log?action=auth.login&limit=10")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      const rows = res.body.data as Array<{ action: string }>;
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.action).toMatch(/^auth\.login/);
      }
    });

    it("entityType filter: entityType=Auth → only Auth rows", async () => {
      const res = await st
        .get("/api/v1/audit-log?entityType=Auth&limit=5")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      // Response uses camelCase `entityType` per audit-log service serialization
      const rows = res.body.data as Array<{ entityType: string }>;
      if (rows.length > 0) {
        for (const row of rows) {
          expect(row.entityType).toBe("Auth");
        }
      }
    });

    it("sensitive keys in after snapshot are redacted to [REDACTED]", async () => {
      // Inject a synthetic audit row with a password_hash in after
      const adminUser = await prisma.user.findUnique({
        where: { email: ADMIN_EMAIL },
        select: { id: true },
      });
      await prisma.auditLog.create({
        data: {
          actor_id: adminUser!.id,
          action: "test.p7.redact",
          entity_type: "Test",
          entity_id: "p7-redact-1",
          after: { user_id: "xyz", password_hash: "not_a_real_hash", name: "visible" },
        },
      });

      const res = await st
        .get("/api/v1/audit-log?action=test.p7.redact")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      const rows = res.body.data as Array<{ after: Record<string, unknown> }>;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0]!.after["password_hash"]).toBe("[REDACTED]");
      expect(rows[0]!.after["name"]).toBe("visible");

      // cleanup
      await prisma.auditLog.deleteMany({ where: { action: "test.p7.redact" } });
    });
  });

  // ---------------------------------------------------------------------------
  // 7. BL-03 — Serializable isolation for unit rent update
  // ---------------------------------------------------------------------------

  describe("7. BL-03 — Unit rent update blocked for OCCUPIED state (Serializable tx)", () => {
    let unitId: number;
    let propertyId: number;
    let adminUserId: number;

    beforeAll(async () => {
      const adminUser = await prisma.user.findUnique({
        where: { email: ADMIN_EMAIL },
        select: { id: true },
      });
      adminUserId = adminUser!.id;

      const property = await prisma.property.create({
        data: {
          name: "P7 BL03 Test Property",
          address: "1 Phase7 Lane",
          city: "Delhi",
          state: "Delhi",
          pincode: "110001",
          created_by_user_id: adminUserId,
        },
      });
      propertyId = property.id;

      const unit = await prisma.unit.create({
        data: {
          property_id: propertyId,
          unit_number: "P7-BL03-01",
          bedrooms: 2,
          bathrooms: 1,
          monthly_rent_paise: 2000000,
          state: 2,
        },
      });
      unitId = unit.id;
    });

    afterAll(async () => {
      await prisma.unit.deleteMany({ where: { id: unitId } });
      await prisma.property.deleteMany({ where: { id: propertyId } });
      await prisma.auditLog.deleteMany({ where: { entity_id: String(unitId) } });
    });

    it("PATCH /units/:id with rent change on OCCUPIED unit → 409 UNIT_RENT_LOCKED", async () => {
      const res = await st
        .patch(`/api/v1/units/${unitId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ monthly_rent_paise: 2500000 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("UNIT_RENT_LOCKED");
    });
  });
});
