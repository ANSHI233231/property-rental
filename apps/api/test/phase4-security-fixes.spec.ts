/**
 * Phase 4 — Security & Contract Fix Tests
 *
 * Covers:
 *   H-01: PM-B cannot GET /rent-periods/:idFromPropertyA (403)
 *   H-01: PM-B GET /rent-periods?propertyId=A → empty (own-scope enforcement)
 *   H-01: Admin GET /rent-periods/:idFromPropertyA → 200
 *   H-01: Tenant on lease X cannot GET period from another tenant → 403 (regression)
 *   M-01: Concurrent POST /jobs/rent-accrual/run on same date → 1×real + 1×skipped, no 500
 *   M-02: POST /payments with amountPaise=9_999_999_999 → 400
 *   M-02: POST /payments with amountPaise=1_000_000_000 → 201 (boundary allowed)
 *   M-02: POST /payments with amountPaise=1_000_000_001 → 400
 *   FC-1: GET /rent-periods?propertyId=X → filtered by property for Admin
 *   FC-2: GET /rent-periods list includes lease.unit.property embed
 *   FC-3: GET /rent-periods?periodStart_gte=&periodStart_lte= date range filter
 */

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { RentAccrualProcessor } from "../src/jobs/rent-accrual.processor";

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const supertestFn = require("supertest") as (app: unknown) => import("supertest").SuperTest<import("supertest").Test>;
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const cookieParser = require("cookie-parser");

const ADMIN_EMAIL = "admin@gharsetu.local";
const ADMIN_PASSWORD = "Admin@gharsetu2026!";

let app: INestApplication;
let prisma: PrismaService;
let processor: RentAccrualProcessor;
let adminToken: string;

const cleanup = {
  paymentIds: [] as string[],
  periodIds: [] as string[],
  leaseIds: [] as string[],
  tenantIds: [] as string[],
  unitIds: [] as string[],
  propertyIds: [] as string[],
  userIds: [] as string[],
  prepaidCreditIds: [] as string[],
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
  processor = moduleRef.get<RentAccrualProcessor>(RentAccrualProcessor);

  const loginRes = await supertestFn(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

  adminToken = loginRes.body.accessToken as string;
}, 60000);

afterAll(async () => {
  await prisma.rentAccrualLog.deleteMany({});

  const validIds = (arr: string[]) => arr.filter((id): id is string => typeof id === "string" && id.length > 0);
  const leaseIds = validIds(cleanup.leaseIds);

  const creditIds = validIds(cleanup.prepaidCreditIds);
  if (creditIds.length > 0) await prisma.prepaidCredit.deleteMany({ where: { id: { in: creditIds } } });
  if (leaseIds.length > 0) await prisma.prepaidCredit.deleteMany({ where: { lease_id: { in: leaseIds } } });

  await prisma.$executeRawUnsafe(`ALTER TABLE payments DISABLE TRIGGER payments_no_delete`);
  await prisma.$executeRawUnsafe(`ALTER TABLE payments DISABLE TRIGGER payments_restrict_update`);
  try {
    const payIds = validIds(cleanup.paymentIds);
    if (payIds.length > 0) await prisma.$executeRawUnsafe(`DELETE FROM payments WHERE id = ANY($1::text[])`, payIds);
    if (leaseIds.length > 0) await prisma.$executeRawUnsafe(`DELETE FROM payments WHERE lease_id = ANY($1::text[])`, leaseIds);
  } finally {
    await prisma.$executeRawUnsafe(`ALTER TABLE payments ENABLE TRIGGER payments_no_delete`);
    await prisma.$executeRawUnsafe(`ALTER TABLE payments ENABLE TRIGGER payments_restrict_update`);
  }

  const periodIds = validIds(cleanup.periodIds);
  if (periodIds.length > 0) await prisma.rentPeriod.deleteMany({ where: { id: { in: periodIds } } });

  for (const leaseId of leaseIds) await prisma.leaseTenant.deleteMany({ where: { lease_id: leaseId } });
  if (leaseIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entity_type: { in: ["Lease", "RentPeriod", "Payment", "PrepaidCredit", "LeaseTenant"] } } });
    await prisma.rentPeriod.deleteMany({ where: { lease_id: { in: leaseIds } } });
    await prisma.lease.deleteMany({ where: { id: { in: leaseIds } } });
  }

  const tenantIds = validIds(cleanup.tenantIds);
  if (tenantIds.length > 0) await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });

  const unitIds = validIds(cleanup.unitIds);
  if (unitIds.length > 0) await prisma.unit.deleteMany({ where: { id: { in: unitIds } } });

  const propIds = validIds(cleanup.propertyIds);
  if (propIds.length > 0) {
    await prisma.property.updateMany({ where: { id: { in: propIds } }, data: { active_pm_id: null } });
    await prisma.property.deleteMany({ where: { id: { in: propIds } } });
  }

  const userIds = validIds(cleanup.userIds);
  if (userIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { actor_id: { in: userIds } } });
    await prisma.refreshToken.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  await app.close();
}, 30000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createPM(suffix: string): Promise<{ pmId: string; pmToken: string }> {
  const email = `pm-sec4-${suffix}-${Date.now()}@test.local`;
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: `PM Sec4 ${suffix}`, email, role: "PROPERTY_MANAGER", password: "PMpass@9876!" });
  const pmId = res.body.id as string;
  if (!pmId) throw new Error(`createPM failed: ${JSON.stringify(res.body)}`);
  cleanup.userIds.push(pmId);
  const loginRes = await supertestFn(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: "PMpass@9876!" });
  return { pmId, pmToken: loginRes.body.accessToken as string };
}

async function createProperty(pmId: string): Promise<string> {
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/properties")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: `Sec4 Prop ${Date.now()}`, address: "Test St", city: "Delhi", state: "Delhi", pincode: "110001", active_pm_id: pmId });
  const propId = res.body.id as string;
  cleanup.propertyIds.push(propId);
  return propId;
}

async function createUnit(propId: string): Promise<string> {
  const res = await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propId}/units`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ unit_number: `U-${Date.now()}`, bedrooms: 1, bathrooms: 1, monthly_rent_paise: 1_800_000 });
  const unitId = res.body.id as string;
  cleanup.unitIds.push(unitId);
  return unitId;
}

async function createLease(
  propId: string,
  unitId: string,
  pmToken: string,
  startDate: string,
): Promise<{ leaseId: string; tenantId: string; tenantToken: string; tenantUserId: string }> {
  const email = `ten-sec4-${Date.now()}@test.local`;
  const res = await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propId}/units/${unitId}/leases`)
    .set("Authorization", `Bearer ${pmToken}`)
    .send({
      startDate,
      endDate: "2027-06-01",
      monthlyRentPaise: 1_800_000,
      securityDepositPaise: 3_600_000,
      tenants: [{ name: "Sec4 Tenant", email, is_primary: true }],
    });
  const leaseId = res.body.lease.id as string;
  const tenantId = res.body.tenants[0].tenantId as string;
  const tenantUserId = res.body.tenants[0].userId as string;
  const tempPw = res.body.tenants[0].tempPassword as string;
  cleanup.leaseIds.push(leaseId);
  cleanup.tenantIds.push(tenantId);
  cleanup.userIds.push(tenantUserId);
  const loginRes = await supertestFn(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: tempPw });
  const periods = await prisma.rentPeriod.findMany({ where: { lease_id: leaseId } });
  for (const p of periods) cleanup.periodIds.push(p.id);
  return { leaseId, tenantId, tenantToken: loginRes.body.accessToken as string, tenantUserId };
}

async function getFirstPeriod(leaseId: string) {
  return prisma.rentPeriod.findFirst({ where: { lease_id: leaseId }, orderBy: { period_start: "asc" } });
}

// ---------------------------------------------------------------------------
// H-01: GET /rent-periods/:id PM scope check
// ---------------------------------------------------------------------------

describe("H-01: GET /rent-periods/:id PM scope enforcement", () => {
  let pmAToken: string;
  let pmBToken: string;
  let periodIdFromA: string;
  let tenantTokenA: string;
  let tenantTokenB: string;

  beforeAll(async () => {
    const pmA = await createPM("h01-a");
    const pmB = await createPM("h01-b");
    pmAToken = pmA.pmToken;
    pmBToken = pmB.pmToken;

    const propA = await createProperty(pmA.pmId);
    const unitA = await createUnit(propA);
    const leaseA = await createLease(propA, unitA, pmAToken, "2026-01-01");
    periodIdFromA = (await getFirstPeriod(leaseA.leaseId))!.id;
    tenantTokenA = leaseA.tenantToken;

    const propB = await createProperty(pmB.pmId);
    const unitB = await createUnit(propB);
    const leaseB = await createLease(propB, unitB, pmBToken, "2026-01-01");
    tenantTokenB = leaseB.tenantToken;
  }, 60000);

  it("PM-B GET /rent-periods/:idFromPropertyA → 403 PROPERTY_ACCESS_DENIED", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/rent-periods/${periodIdFromA}`)
      .set("Authorization", `Bearer ${pmBToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe("PROPERTY_ACCESS_DENIED");
  });

  it("PM-A GET /rent-periods/:idFromPropertyA → 200 (own period)", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/rent-periods/${periodIdFromA}`)
      .set("Authorization", `Bearer ${pmAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(periodIdFromA);
  });

  it("Admin GET /rent-periods/:idFromPropertyA → 200", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/rent-periods/${periodIdFromA}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  it("Tenant-B GET /rent-periods/:idFromPropertyA (another tenant's period) → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/rent-periods/${periodIdFromA}`)
      .set("Authorization", `Bearer ${tenantTokenB}`);

    expect(res.status).toBe(403);
  });

  it("Tenant-A GET /rent-periods/:idFromPropertyA (own period) → 200", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/rent-periods/${periodIdFromA}`)
      .set("Authorization", `Bearer ${tenantTokenA}`);

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// H-01: GET /rent-periods list PM scope check
// ---------------------------------------------------------------------------

describe("H-01: GET /rent-periods list PM scope enforcement", () => {
  let pmAToken: string;
  let pmBToken: string;
  let propAId: string;

  beforeAll(async () => {
    const pmA = await createPM("h01-list-a");
    const pmB = await createPM("h01-list-b");
    pmAToken = pmA.pmToken;
    pmBToken = pmB.pmToken;

    propAId = await createProperty(pmA.pmId);
    const unitA = await createUnit(propAId);
    await createLease(propAId, unitA, pmAToken, "2026-02-01");

    const propB = await createProperty(pmB.pmId);
    const unitB = await createUnit(propB);
    await createLease(propB, unitB, pmBToken, "2026-02-01");
  }, 60000);

  it("PM-B GET /rent-periods?propertyId=A → empty list (scope enforcement)", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/rent-periods?propertyId=${propAId}`)
      .set("Authorization", `Bearer ${pmBToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it("Admin GET /rent-periods?propertyId=A → periods from property A", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/rent-periods?propertyId=${propAId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // At least the auto-generated period for the lease in propA
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const period of res.body.data as Array<{ lease: { unit: { property: { id: string } } } }>) {
      expect(period.lease.unit.property.id).toBe(propAId);
    }
  });
});

// ---------------------------------------------------------------------------
// M-01: Concurrent accrual run P2002 safe
// ---------------------------------------------------------------------------

describe("M-01: Concurrent accrual run on same date → no 500", () => {
  afterEach(async () => {
    await prisma.rentAccrualLog.deleteMany({});
  });

  it("Two parallel runAccrual calls → first returns real summary, second returns skipped:true, no error thrown", async () => {
    // Use a fixed test date so both calls use the same IST date
    const testDate = new Date("2025-11-11T00:00:00Z");

    // Fire both concurrently
    const [result1, result2] = await Promise.all([
      processor.runAccrual(testDate).catch((e: Error) => ({ error: e.message })),
      processor.runAccrual(testDate).catch((e: Error) => ({ error: e.message })),
    ]);

    // Neither should have thrown (no 500-equivalent error propagation)
    expect("error" in result1).toBe(false);
    expect("error" in result2).toBe(false);

    // Exactly one must be skipped, one must not be skipped
    const r1 = result1 as { skipped: boolean };
    const r2 = result2 as { skipped: boolean };
    const skippedCount = [r1.skipped, r2.skipped].filter(Boolean).length;
    expect(skippedCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// M-02: amountPaise upper-bound enforcement
// ---------------------------------------------------------------------------

describe("M-02: amountPaise capped at ₹10 crore (1,000,000,000 paise)", () => {
  let pmToken: string;
  let periodId: string;

  beforeAll(async () => {
    const pm = await createPM("m02");
    pmToken = pm.pmToken;
    const propId = await createProperty(pm.pmId);
    const unitId = await createUnit(propId);
    const lease = await createLease(propId, unitId, pmToken, "2026-03-01");
    periodId = (await getFirstPeriod(lease.leaseId))!.id;
  }, 30000);

  it("amountPaise=9_999_999_999 → 400 validation error", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${pmToken}`)
      .send({ rentPeriodId: periodId, amountPaise: 9_999_999_999, method: "CASH", paidOn: "2026-03-01" });

    expect(res.status).toBe(400);
  });

  it("amountPaise=1_000_000_001 → 400 validation error", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${pmToken}`)
      .send({ rentPeriodId: periodId, amountPaise: 1_000_000_001, method: "CASH", paidOn: "2026-03-01" });

    expect(res.status).toBe(400);
  });

  it("amountPaise=1_000_000_000 (boundary, ₹10 crore) → 201 success", async () => {
    // Reset the period to DUE with a high enough amount_due_paise to accept the payment
    await prisma.rentPeriod.update({
      where: { id: periodId },
      data: {
        amount_due_paise: 1_000_000_000n,
        outstanding_paise: 1_000_000_000n,
        paid_paise: 0n,
        status: "DUE",
      },
    });

    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${pmToken}`)
      .send({ rentPeriodId: periodId, amountPaise: 1_000_000_000, method: "BANK_TRANSFER", paidOn: "2026-03-01" });

    expect(res.status).toBe(201);
    cleanup.paymentIds.push(res.body.payment?.id as string);
  });
});

// ---------------------------------------------------------------------------
// FC-2: lease.unit.property embed on list
// ---------------------------------------------------------------------------

describe("FC-2: GET /rent-periods list includes lease.unit.property", () => {
  it("Admin list response includes nested property name", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/rent-periods?limit=5")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    if ((res.body.data as unknown[]).length > 0) {
      const first = res.body.data[0] as {
        lease?: { unit?: { property?: { id?: string; name?: string } } };
      };
      expect(first.lease).toBeDefined();
      expect(first.lease?.unit).toBeDefined();
      expect(first.lease?.unit?.property).toBeDefined();
      expect(typeof first.lease?.unit?.property?.name).toBe("string");
    }
  });
});

// ---------------------------------------------------------------------------
// FC-3: periodStart date range filter
// ---------------------------------------------------------------------------

describe("FC-3: GET /rent-periods supports periodStart_gte / periodStart_lte", () => {
  let pmToken: string;
  let leaseId: string;

  beforeAll(async () => {
    const pm = await createPM("fc3");
    pmToken = pm.pmToken;
    const propId = await createProperty(pm.pmId);
    const unitId = await createUnit(propId);
    const lease = await createLease(propId, unitId, pmToken, "2026-04-01");
    leaseId = lease.leaseId;
  }, 30000);

  it("periodStart_gte=2026-04-01&periodStart_lte=2026-04-30 → returns only April periods", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/rent-periods?leaseId=${leaseId}&periodStart_gte=2026-04-01&periodStart_lte=2026-04-30`)
      .set("Authorization", `Bearer ${pmToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // All returned periods should have period_start in April 2026
    for (const p of res.body.data as Array<{ period_start: string }>) {
      const start = new Date(p.period_start);
      expect(start.getUTCFullYear()).toBe(2026);
      expect(start.getUTCMonth()).toBe(3); // 0-indexed: April = 3
    }
  });

  it("periodStart_gte=2030-01-01 → empty result (future date, no periods exist)", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/rent-periods?leaseId=${leaseId}&periodStart_gte=2030-01-01`)
      .set("Authorization", `Bearer ${pmToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });
});
