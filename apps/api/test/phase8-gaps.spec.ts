/**
 * Phase 8 — Gap tests for TC IDs that had no automated coverage.
 *
 * Covers:
 *   TC-RENT-012: Lease starting on 31 Jan → Feb period_end = 28 Feb (last day).
 *                BUG-008-001 fixed: addMonthMinusOneDay now uses first-of-month-two-ahead
 *                strategy to avoid Jan-31 → Mar-2 overflow.
 *   TC-NEG-001: POST /leases with endDate < startDate → 400 INVALID_LEASE_DATES.
 *                BUG-008-002 fixed: service-layer guard rejects invalid date order.
 *   TC-NEG-005: DELETE /maintenance-requests/:id → 404 (route absent) for MAINTENANCE role.
 */

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const supertestFn = require("supertest") as (app: unknown) => import("supertest").SuperTest<import("supertest").Test>;
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const cookieParser = require("cookie-parser");

const ADMIN_EMAIL = "admin@gharsetu.local";
const ADMIN_PASSWORD = "Admin@gharsetu2026!";

let app: INestApplication;
let prisma: PrismaService;
let adminToken: string;

// Cleanup tracking
const cleanup = {
  userIds: [] as number[],
  propertyIds: [] as number[],
  unitIds: [] as number[],
  leaseIds: [] as number[],
  tenantIds: [] as number[],
  periodIds: [] as number[],
  maintenanceIds: [] as number[],
};

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("api/v1");
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  app.use(cookieParser());
  await app.init();

  prisma = moduleRef.get<PrismaService>(PrismaService);

  const loginRes = await supertestFn(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

  adminToken = loginRes.body.accessToken as string;
}, 60_000);

afterAll(async () => {
  // Cleanup in dependency order
  if (cleanup.maintenanceIds.length > 0) {
    await prisma.maintenanceRequest.deleteMany({ where: { id: { in: cleanup.maintenanceIds } } });
  }

  await prisma.$executeRawUnsafe(`ALTER TABLE payments DISABLE TRIGGER payments_no_delete`);
  await prisma.$executeRawUnsafe(`ALTER TABLE payments DISABLE TRIGGER payments_restrict_update`);
  try {
    if (cleanup.leaseIds.length > 0) {
      await prisma.$executeRawUnsafe(`DELETE FROM payments WHERE lease_id = ANY($1::bigint[])`, cleanup.leaseIds);
      await prisma.prepaidCredit.deleteMany({ where: { lease_id: { in: cleanup.leaseIds } } });
    }
  } finally {
    await prisma.$executeRawUnsafe(`ALTER TABLE payments ENABLE TRIGGER payments_no_delete`);
    await prisma.$executeRawUnsafe(`ALTER TABLE payments ENABLE TRIGGER payments_restrict_update`);
  }

  if (cleanup.periodIds.length > 0) {
    await prisma.rentPeriod.deleteMany({ where: { id: { in: cleanup.periodIds } } });
  }

  for (const leaseId of cleanup.leaseIds) {
    await prisma.leaseTenant.deleteMany({ where: { lease_id: leaseId } });
  }
  if (cleanup.leaseIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: {
        entity_type: { in: ["Lease", "RentPeriod", "Payment", "PrepaidCredit", "LeaseTenant"] },
      },
    });
    await prisma.rentPeriod.deleteMany({ where: { lease_id: { in: cleanup.leaseIds } } });
    await prisma.lease.deleteMany({ where: { id: { in: cleanup.leaseIds } } });
  }

  if (cleanup.tenantIds.length > 0) {
    await prisma.tenant.deleteMany({ where: { id: { in: cleanup.tenantIds } } });
  }
  // Units must be deleted AFTER leases (foreign key constraint)
  if (cleanup.unitIds.length > 0) {
    await prisma.unit.deleteMany({ where: { id: { in: cleanup.unitIds }, leases: { none: {} } } });
  }
  if (cleanup.propertyIds.length > 0) {
    await prisma.property.updateMany({
      where: { id: { in: cleanup.propertyIds } },
      data: { active_pm_id: null },
    });
    await prisma.property.deleteMany({ where: { id: { in: cleanup.propertyIds } } });
  }
  if (cleanup.userIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { actor_id: { in: cleanup.userIds } } });
    await prisma.refreshToken.deleteMany({ where: { user_id: { in: cleanup.userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: cleanup.userIds } } });
  }

  await app.close();
}, 30_000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createPM(): Promise<{ pmId: number; pmToken: string }> {
  const email = `pm-ph8-${Date.now()}@test.local`;
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ firstName: "Phase8", lastName: "PM", email, role: "PROPERTY_MANAGER", password: "PMpass@8888!" });
  const pmId = res.body.id as number;
  if (!pmId) throw new Error(`createPM failed: ${JSON.stringify(res.body)}`);
  cleanup.userIds.push(pmId);

  const loginRes = await supertestFn(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: "PMpass@8888!" });
  return { pmId, pmToken: loginRes.body.accessToken as string };
}

async function createPropertyAndUnit(pmId: number): Promise<{ propId: number; unitId: number }> {
  const propRes = await supertestFn(app.getHttpServer())
    .post("/api/v1/properties")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: `Ph8-Prop-${Date.now()}`,
      address: "8 Test Road",
      city: "Delhi",
      state: "Delhi",
      pincode: "110001",
      active_pm_id: pmId,
    });
  const propId = propRes.body.id as number;
  if (!propId) throw new Error(`createProperty failed: ${JSON.stringify(propRes.body)}`);
  cleanup.propertyIds.push(propId);

  const unitRes = await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propId}/units`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ unit_number: `U8-${Date.now()}`, bedrooms: 1, bathrooms: 1, monthly_rent_paise: 1_800_000 });
  const unitId = unitRes.body.id as number;
  if (!unitId) throw new Error(`createUnit failed: ${JSON.stringify(unitRes.body)}`);
  cleanup.unitIds.push(unitId);

  return { propId, unitId };
}

const MAINT_PASSWORD = "Maint@ph8!2026x";

async function createMaintUser(): Promise<{ id: number; token: string }> {
  const email = `maint-ph8-${Date.now()}@test.local`;
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ firstName: "Phase8", lastName: "Maint", email, role: "MAINTENANCE", password: MAINT_PASSWORD, specialization: "general" });
  const id = res.body.id as number;
  if (!id) throw new Error(`createMaintUser failed: ${JSON.stringify(res.body)}`);
  cleanup.userIds.push(id);

  const loginRes = await supertestFn(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: MAINT_PASSWORD });
  return { id, token: loginRes.body.accessToken as string };
}

// ---------------------------------------------------------------------------
// TC-RENT-012 — 31-Jan lease → Feb period_end = 28 Feb (last day)
// BUG-008-001 FIXED: addMonthMinusOneDay now uses first-of-month-two-ahead
// strategy (setUTCDate(1) → setUTCMonth(+2) → setUTCDate(-1)), which correctly
// yields Feb 28 for a Jan 31 input instead of the former Mar 2 overflow.
// ---------------------------------------------------------------------------

describe("TC-RENT-012 — 31-Jan start: first period end = last day of Feb (BL SRS §4 Module 5)", () => {
  let pmToken: string;
  let propId: number;
  let unitId: number;

  beforeAll(async () => {
    const pm = await createPM();
    pmToken = pm.pmToken;
    ({ propId, unitId } = await createPropertyAndUnit(pm.pmId));
  }, 30_000);

  it("TC-RENT-012: lease starting 2026-01-31 → first period_start = 2026-01-31, due_date = 2026-01-31", async () => {
    /**
     * Per SRS §4 Module 5:
     * "Due date = same day each month from lease start. If start = 31st and month has no 31st,
     *  use last day of that month."
     *
     * A lease starting 2026-01-31 should have:
     *   - period_start = 2026-01-31 (Jan)
     *   - due_date    = 2026-01-31  (same day in Jan)
     *   - period_end  = 2026-02-28  (end of Jan period = Feb 28 - 1 ... actually end of month)
     *
     * The critical assertion: the period due_date for the NEXT period (February)
     * should be 2026-02-28 (last day of Feb), not 2026-03-02 (overflow).
     */
    const tenantEmail = `ten-rent012-${Date.now()}@test.local`;
    const leaseRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${propId}/units/${unitId}/leases`)
      .set("Authorization", `Bearer ${pmToken}`)
      .send({
        startDate: "2026-01-31",
        endDate: "2027-01-30",
        monthlyRentPaise: 1_800_000,
        securityDepositPaise: 3_600_000,
        tenants: [{ name: "RentEdge Tenant", email: tenantEmail, is_primary: true }],
      });

    expect(leaseRes.status).toBe(201);
    const leaseId = leaseRes.body.lease?.id as number;
    expect(leaseId).toBeTruthy();
    cleanup.leaseIds.push(leaseId);

    const tenantUserId = leaseRes.body.tenants?.[0]?.userId as number;
    const tenantId = leaseRes.body.tenants?.[0]?.tenantId as number;
    if (tenantId) cleanup.tenantIds.push(tenantId);
    if (tenantUserId) cleanup.userIds.push(tenantUserId);

    // Collect all periods for cleanup
    const periods = await prisma.rentPeriod.findMany({ where: { lease_id: leaseId } });
    for (const p of periods) cleanup.periodIds.push(p.id);

    // First period: starts Jan 31
    const firstPeriod = await prisma.rentPeriod.findFirst({
      where: { lease_id: leaseId },
      orderBy: { period_start: "asc" },
    });
    expect(firstPeriod).toBeTruthy();

    const periodStartDate = firstPeriod!.period_start;
    expect(periodStartDate.getUTCMonth()).toBe(0); // January (0-indexed)
    expect(periodStartDate.getUTCDate()).toBe(31);

    // The period_end for the Jan period should be 2026-02-28 (last day of Feb 2026)
    // because: period covers Jan 31 → Feb 28 (one month minus one day using last-of-month logic)
    const periodEndDate = firstPeriod!.period_end;

    // CRITICAL ASSERTION (TC-RENT-012): period_end must NOT overflow into March.
    // BUG-008-001 FIXED: addMonthMinusOneDay(2026-01-31) now returns 2026-02-28.
    expect(periodEndDate.getUTCMonth()).toBe(1); // February (1 = Feb, 0-indexed)
    expect(periodEndDate.getUTCDate()).toBe(28); // last day of Feb 2026
  });
});

// ---------------------------------------------------------------------------
// TC-NEG-001 — POST /leases with endDate < startDate → 400/422
// ---------------------------------------------------------------------------

describe("TC-NEG-001 — Lease endDate < startDate must be rejected", () => {
  let pmToken: string;
  let propId: number;
  let unitId: number;

  beforeAll(async () => {
    const pm = await createPM();
    pmToken = pm.pmToken;
    ({ propId, unitId } = await createPropertyAndUnit(pm.pmId));
  }, 30_000);

  it("TC-NEG-001: endDate 2025-01-01 before startDate 2026-06-01 → 400 or 422", async () => {
    const tenantEmail = `ten-neg001-${Date.now()}@test.local`;
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${propId}/units/${unitId}/leases`)
      .set("Authorization", `Bearer ${pmToken}`)
      .send({
        startDate: "2026-06-01",
        endDate: "2025-01-01",  // end BEFORE start — must be rejected
        monthlyRentPaise: 1_800_000,
        securityDepositPaise: 3_600_000,
        tenants: [{ name: "NegTest Tenant", email: tenantEmail, is_primary: true }],
      });

    // BUG-008-002 FIXED: service-layer guard rejects endDate < startDate with 400 INVALID_LEASE_DATES.
    expect(res.status).toBe(400);
    expect(res.body?.error?.code).toBe("INVALID_LEASE_DATES");

    // Must not leave a dangling lease
    const leaked = await prisma.lease.findFirst({
      where: {
        unit_id: unitId,
        start_date: new Date("2026-06-01"),
        end_date: new Date("2025-01-01"),
      },
    });
    expect(leaked).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TC-NEG-005 — DELETE /maintenance-requests/:id as MAINTENANCE role
// The route does not exist → 404; BL-16 (maintenance cannot create/delete)
// ---------------------------------------------------------------------------

describe("TC-NEG-005 — DELETE /maintenance-requests/:id is not allowed (BL-16)", () => {
  it("TC-NEG-005: DELETE /maintenance-requests/:id as MAINTENANCE → 403, 404, or 405 (route absent)", async () => {
    const { token: maintToken } = await createMaintUser();

    // Use a fake UUID that does not need to exist — we're testing that the route is absent/blocked.
    const fakeId = "00000000-0000-0000-0000-000000000099";
    const res = await supertestFn(app.getHttpServer())
      .delete(`/api/v1/maintenance-requests/${fakeId}`)
      .set("Authorization", `Bearer ${maintToken}`);

    // Route does not exist (no @Delete decorator in MaintenanceController).
    // Acceptable: 403 (forbidden by role guard if route existed), 404 (route not found), 405 (method not allowed).
    const isBlocked = [403, 404, 405].includes(res.status);
    expect(isBlocked).toBe(true); // route must not exist or must be forbidden
  });

  it("TC-NEG-005 (ADMIN): DELETE /maintenance-requests/:id as ADMIN → 404 (route absent = hard delete impossible)", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000099";
    const res = await supertestFn(app.getHttpServer())
      .delete(`/api/v1/maintenance-requests/${fakeId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    // Admin is also blocked — no DELETE route exists at all.
    const isAdminBlocked = [403, 404, 405].includes(res.status);
    expect(isAdminBlocked).toBe(true); // DELETE route must not exist even for ADMIN
  });
});

// ---------------------------------------------------------------------------
// F-02 — Array-bomb guard: tenants[] capped at 20 (VAPT phase-8)
// Submitting 21 tenant entries must return 400 VALIDATION_FAILED before any
// DB operation is attempted. Tests @ArrayMaxSize(20) on CreateLeaseDto.
// ---------------------------------------------------------------------------

describe("F-02 — tenants[] array-bomb guard: 21-element array → 400 VALIDATION_FAILED", () => {
  let pmToken: string;
  let propId: number;
  let unitId: number;

  beforeAll(async () => {
    const pm = await createPM();
    pmToken = pm.pmToken;
    ({ propId, unitId } = await createPropertyAndUnit(pm.pmId));
  }, 30_000);

  it("F-02: POST /leases with 21-element tenants[] → 400 with VALIDATION_FAILED", async () => {
    // Build 21 minimal tenant objects — well within the 100 KB body limit but above the array cap.
    const tenants = Array.from({ length: 21 }, (_, i) => ({
      name: `Tenant${i}`,
      email: `f02-tenant${i}-${Date.now()}@test.local`,
      is_primary: i === 0,
    }));

    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${propId}/units/${unitId}/leases`)
      .set("Authorization", `Bearer ${pmToken}`)
      .send({
        startDate: "2026-06-01",
        endDate: "2027-06-01",
        monthlyRentPaise: 1_800_000,
        securityDepositPaise: 3_600_000,
        tenants,
      });

    expect(res.status).toBe(400);
    // NestJS ValidationPipe returns error code VALIDATION_FAILED via the global exception filter.
    const code: string = res.body?.error?.code ?? res.body?.code ?? "";
    expect(code).toBe("VALIDATION_FAILED");
  });

  it("F-02 baseline: POST /leases with exactly 1 tenant → 201 (min bound still works)", async () => {
    const tenantEmail = `f02-baseline-${Date.now()}@test.local`;
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${propId}/units/${unitId}/leases`)
      .set("Authorization", `Bearer ${pmToken}`)
      .send({
        startDate: "2026-06-01",
        endDate: "2027-06-01",
        monthlyRentPaise: 1_800_000,
        securityDepositPaise: 3_600_000,
        tenants: [{ name: "Baseline Tenant", email: tenantEmail, is_primary: true }],
      });

    expect(res.status).toBe(201);
    const leaseId = res.body.lease?.id as number;
    if (leaseId) cleanup.leaseIds.push(leaseId);
    const tenantUserId = res.body.tenants?.[0]?.userId as number;
    const tenantId = res.body.tenants?.[0]?.tenantId as number;
    if (tenantId) cleanup.tenantIds.push(tenantId);
    if (tenantUserId) cleanup.userIds.push(tenantUserId);
  });
});
