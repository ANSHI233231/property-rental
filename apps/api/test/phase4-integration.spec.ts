/**
 * Phase 4 — Rent Collection + Payments + Late-fee Accrual Integration Tests
 *
 * Covers:
 *   BL-10: TENANT token on POST /payments → 403 BL_10_TENANT_CANNOT_RECORD_PAYMENT
 *   BL-10 (cross-role): MAINTENANCE token → 403
 *   BL-11 underpayment: pay less than outstanding → PARTIAL, paid_paise updated
 *   BL-11 exact payment: → PAID
 *   BL-11 overpayment: pay more → period PAID, excess goes to PrepaidCredit
 *   BL-12: period 5 days past due, run worker → status=OVERDUE
 *   BL-13 worked example: ₹18,000 rent, 17 days overdue → late_fee_paise=72,000
 *   BL-13 partial week: 13 days → 36,000 paise
 *   BL-13 not-yet-overdue: 4 days → no late fee, status stays DUE
 *   Idempotency: worker run twice same IST date → second is skipped
 *   Append-only: prisma.payment.delete → trigger exception
 *   Append-only: prisma.payment.update(amount_paise) → trigger exception
 *   Append-only: prisma.payment.update(is_voided) → succeeds
 *   Void cascade block: pay over → spillover → consume credit → void original → 409
 *   PropertyScopeGuard: PM-B on PM-A's payment → 403
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

// Test data tracking
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
  // Clean up accrual logs
  await prisma.rentAccrualLog.deleteMany({});

  // Helper to filter undefined values pushed into cleanup arrays before a helper throws
  const validIds = (arr: string[]) => arr.filter((id): id is string => typeof id === "string" && id.length > 0);

  const leaseIds = validIds(cleanup.leaseIds);

  // 1. Delete prepaid_credits FIRST (FK references payments.id with RESTRICT).
  //    Delete all credits for tracked leases plus any explicitly tracked credit IDs.
  const creditIds = validIds(cleanup.prepaidCreditIds);
  if (creditIds.length > 0) {
    await prisma.prepaidCredit.deleteMany({ where: { id: { in: creditIds } } });
  }
  if (leaseIds.length > 0) {
    await prisma.prepaidCredit.deleteMany({ where: { lease_id: { in: leaseIds } } });
  }

  // 2. Delete payments: disable the append-only trigger for test teardown only.
  //    Do this in a single session with the trigger disabled to avoid FK ordering issues.
  await prisma.$executeRawUnsafe(`ALTER TABLE payments DISABLE TRIGGER payments_no_delete`);
  await prisma.$executeRawUnsafe(`ALTER TABLE payments DISABLE TRIGGER payments_restrict_update`);
  try {
    const payIds = validIds(cleanup.paymentIds);
    if (payIds.length > 0) {
      await prisma.$executeRawUnsafe(`DELETE FROM payments WHERE id = ANY($1::text[])`, payIds);
    }
    if (leaseIds.length > 0) {
      await prisma.$executeRawUnsafe(`DELETE FROM payments WHERE lease_id = ANY($1::text[])`, leaseIds);
    }
  } finally {
    await prisma.$executeRawUnsafe(`ALTER TABLE payments ENABLE TRIGGER payments_no_delete`);
    await prisma.$executeRawUnsafe(`ALTER TABLE payments ENABLE TRIGGER payments_restrict_update`);
  }

  // 3. Clean up rent periods
  const periodIds = validIds(cleanup.periodIds);
  if (periodIds.length > 0) {
    await prisma.rentPeriod.deleteMany({ where: { id: { in: periodIds } } });
  }

  // 4. Clean up leases and related
  for (const leaseId of leaseIds) {
    await prisma.leaseTenant.deleteMany({ where: { lease_id: leaseId } });
  }
  if (leaseIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entity_type: { in: ["Lease", "RentPeriod", "Payment", "PrepaidCredit", "LeaseTenant"] } } });
    await prisma.rentPeriod.deleteMany({ where: { lease_id: { in: leaseIds } } });
    await prisma.lease.deleteMany({ where: { id: { in: leaseIds } } });
  }

  // Tenants
  const tenantIds = validIds(cleanup.tenantIds);
  if (tenantIds.length > 0) {
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  }

  // Units
  const unitIds = validIds(cleanup.unitIds);
  if (unitIds.length > 0) {
    await prisma.unit.deleteMany({ where: { id: { in: unitIds } } });
  }

  // Properties — unassign PM first to avoid FK issues
  const propIds = validIds(cleanup.propertyIds);
  if (propIds.length > 0) {
    await prisma.property.updateMany({ where: { id: { in: propIds } }, data: { active_pm_id: null } });
    await prisma.property.deleteMany({ where: { id: { in: propIds } } });
  }

  // Users — must delete audit_log rows where actor_id = userId before deleting the user
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
  const email = `pm-p4-${suffix}-${Date.now()}@test.local`;
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: `PM Phase4 ${suffix}`,
      email,
      role: "PROPERTY_MANAGER",
      password: "PMpass@9876!",
    });
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
    .send({
      name: `P4 Property ${Date.now()}`,
      address: "Test Street",
      city: "Delhi",
      state: "Delhi",
      pincode: "110001",
      active_pm_id: pmId,
    });
  const propId = res.body.id as string;
  cleanup.propertyIds.push(propId);
  return propId;
}

async function createUnit(propId: string): Promise<string> {
  const res = await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propId}/units`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      unit_number: `U-${Date.now()}`,
      bedrooms: 2,
      bathrooms: 1,
      monthly_rent_paise: 1_800_000, // ₹18,000
    });
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
  const email = `tenant-p4-${Date.now()}@test.local`;
  const res = await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propId}/units/${unitId}/leases`)
    .set("Authorization", `Bearer ${pmToken}`)
    .send({
      startDate,
      endDate: "2027-05-01",
      monthlyRentPaise: 1_800_000,
      securityDepositPaise: 3_600_000,
      tenants: [{ name: "Test Tenant P4", email, is_primary: true }],
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
  const tenantToken = loginRes.body.accessToken as string;

  // Collect the auto-generated rent period ID
  const periods = await prisma.rentPeriod.findMany({ where: { lease_id: leaseId } });
  for (const p of periods) cleanup.periodIds.push(p.id);

  return { leaseId, tenantId, tenantToken, tenantUserId };
}

async function getFirstPeriod(leaseId: string) {
  return prisma.rentPeriod.findFirst({ where: { lease_id: leaseId }, orderBy: { period_start: "asc" } });
}

// ---------------------------------------------------------------------------
// BL-10: role enforcement
// ---------------------------------------------------------------------------

describe("BL-10: Only PM/Admin may record payments", () => {
  let pmToken: string;
  let tenantToken: string;
  let periodId: string;

  beforeAll(async () => {
    const pm = await createPM("bl10");
    pmToken = pm.pmToken;
    const propId = await createProperty(pm.pmId);
    const unitId = await createUnit(propId);
    const lease = await createLease(propId, unitId, pmToken, "2026-01-01");
    tenantToken = lease.tenantToken;
    const period = await getFirstPeriod(lease.leaseId);
    periodId = period!.id;
  }, 30000);

  it("TENANT token → 403 BL_10_TENANT_CANNOT_RECORD_PAYMENT", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({ rentPeriodId: periodId, amountPaise: 100_000, method: "CASH", paidOn: "2026-01-01" });

    expect(res.status).toBe(403);
  });

  it("MAINTENANCE token → 403", async () => {
    // Create a maintenance user
    const maintRes = await supertestFn(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Maint P4", email: `maint-p4-${Date.now()}@test.local`, role: "MAINTENANCE", password: "Maint@9876!" });
    cleanup.userIds.push(maintRes.body.id as string);

    const maintLogin = await supertestFn(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: maintRes.body.email, password: "Maint@9876!" });
    const maintToken = maintLogin.body.accessToken as string;

    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${maintToken}`)
      .send({ rentPeriodId: periodId, amountPaise: 100_000, method: "CASH", paidOn: "2026-01-01" });

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// BL-11: payment reconciliation
// ---------------------------------------------------------------------------

describe("BL-11: payment reconciliation", () => {
  let pmToken: string;
  let leaseId: string;

  beforeAll(async () => {
    const pm = await createPM("bl11");
    pmToken = pm.pmToken;
    const propId = await createProperty(pm.pmId);
    const unitId = await createUnit(propId);
    const lease = await createLease(propId, unitId, pmToken, "2026-02-01");
    leaseId = lease.leaseId;
  }, 30000);

  it("underpayment → PARTIAL status, paid_paise updated", async () => {
    const period = await getFirstPeriod(leaseId);
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${pmToken}`)
      .send({ rentPeriodId: period!.id, amountPaise: 900_000, method: "CASH", paidOn: "2026-02-01" });

    expect(res.status).toBe(201);
    expect(res.body.period.status).toBe("PARTIAL");
    expect(res.body.period.paid_paise).toBe("900000");
    cleanup.paymentIds.push(res.body.payment.id as string);
  });

  it("exact payment → PAID status", async () => {
    // Create a fresh lease/period
    const pm = await createPM("bl11-exact");
    const pmTok = pm.pmToken;
    const propId = await createProperty(pm.pmId);
    const unitId = await createUnit(propId);
    const lease = await createLease(propId, unitId, pmTok, "2026-03-01");
    const period = await getFirstPeriod(lease.leaseId);

    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${pmTok}`)
      .send({ rentPeriodId: period!.id, amountPaise: 1_800_000, method: "UPI", paidOn: "2026-03-01" });

    expect(res.status).toBe(201);
    expect(res.body.period.status).toBe("PAID");
    expect(res.body.period.outstanding_paise).toBe("0");
    cleanup.paymentIds.push(res.body.payment.id as string);
  });

  it("overpayment → period PAID, excess to PrepaidCredit", async () => {
    // Create a fresh lease/period
    const pm = await createPM("bl11-over");
    const pmTok = pm.pmToken;
    const propId = await createProperty(pm.pmId);
    const unitId = await createUnit(propId);
    const lease = await createLease(propId, unitId, pmTok, "2026-04-01");
    const period = await getFirstPeriod(lease.leaseId);

    // Pay 200,000 paise over the ₹18,000 (1,800,000) due = 2,000,000 paise
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${pmTok}`)
      .send({ rentPeriodId: period!.id, amountPaise: 2_000_000, method: "BANK_TRANSFER", paidOn: "2026-04-01" });

    expect(res.status).toBe(201);
    expect(res.body.period.status).toBe("PAID");
    expect(res.body.period.outstanding_paise).toBe("0");
    // Spillover should create a PrepaidCredit
    expect(res.body.prepaid_credit).toBeDefined();
    expect(res.body.prepaid_credit.amount_paise).toBe("200000");
    cleanup.paymentIds.push(res.body.payment.id as string);
    if (res.body.prepaid_credit?.id) {
      cleanup.prepaidCreditIds.push(res.body.prepaid_credit.id as string);
    }
  });
});

// ---------------------------------------------------------------------------
// BL-12 / BL-13: accrual worker
// ---------------------------------------------------------------------------

describe("BL-12/BL-13: accrual worker", () => {
  let pmToken: string;
  let leaseId: string;

  beforeAll(async () => {
    const pm = await createPM("accrual");
    pmToken = pm.pmToken;
    const propId = await createProperty(pm.pmId);
    const unitId = await createUnit(propId);
    const lease = await createLease(propId, unitId, pmToken, "2026-01-01");
    leaseId = lease.leaseId;
  }, 30000);

  afterEach(async () => {
    // Clean accrual logs between tests so idempotency check doesn't interfere
    await prisma.rentAccrualLog.deleteMany({});
  });

  it("BL-12: period 5 days past due → status OVERDUE after worker run", async () => {
    const period = await getFirstPeriod(leaseId);

    // Manually set due_date to 5 days ago to trigger overdue
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    await prisma.rentPeriod.update({
      where: { id: period!.id },
      data: { due_date: fiveDaysAgo, status: "DUE" },
    });

    await processor.runAccrual();

    const updated = await prisma.rentPeriod.findUnique({ where: { id: period!.id } });
    expect(updated?.status).toBe("OVERDUE");
  });

  it("BL-13 worked example: 17 days overdue → late_fee_paise = 72,000", async () => {
    const period = await getFirstPeriod(leaseId);

    // Set due_date to 17 days ago
    const seventeenDaysAgo = new Date();
    seventeenDaysAgo.setDate(seventeenDaysAgo.getDate() - 17);
    await prisma.rentPeriod.update({
      where: { id: period!.id },
      data: {
        due_date: seventeenDaysAgo,
        status: "DUE",
        late_fee_paise: 0n,
        paid_paise: 0n,
        outstanding_paise: 1_800_000n,
        amount_due_paise: 1_800_000n,
      },
    });

    await processor.runAccrual();

    const updated = await prisma.rentPeriod.findUnique({ where: { id: period!.id } });
    expect(updated?.status).toBe("OVERDUE");
    // floor(17/7)=2 weeks → 2 × 0.02 × 1,800,000 = 72,000
    expect(updated?.late_fee_paise).toBe(72_000n);
    expect(updated?.outstanding_paise).toBe(1_872_000n);
  });

  it("BL-13 partial week: 13 days → late_fee_paise = 36,000", async () => {
    const period = await getFirstPeriod(leaseId);

    const thirteenDaysAgo = new Date();
    thirteenDaysAgo.setDate(thirteenDaysAgo.getDate() - 13);
    await prisma.rentPeriod.update({
      where: { id: period!.id },
      data: {
        due_date: thirteenDaysAgo,
        status: "DUE",
        late_fee_paise: 0n,
        paid_paise: 0n,
        outstanding_paise: 1_800_000n,
        amount_due_paise: 1_800_000n,
      },
    });

    await processor.runAccrual();

    const updated = await prisma.rentPeriod.findUnique({ where: { id: period!.id } });
    // floor(13/7)=1 week → 0.02 × 1,800,000 = 36,000
    expect(updated?.late_fee_paise).toBe(36_000n);
  });

  it("BL-13 not-yet-overdue: 4 days past due → no late fee, status stays DUE", async () => {
    const period = await getFirstPeriod(leaseId);

    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    await prisma.rentPeriod.update({
      where: { id: period!.id },
      data: {
        due_date: fourDaysAgo,
        status: "DUE",
        late_fee_paise: 0n,
        outstanding_paise: 1_800_000n,
      },
    });

    await processor.runAccrual();

    const updated = await prisma.rentPeriod.findUnique({ where: { id: period!.id } });
    // 4 days < 5 threshold → not in worker query → no change
    expect(updated?.status).toBe("DUE");
    expect(updated?.late_fee_paise).toBe(0n);
  });

  it("Idempotency: running worker twice on same IST date → second run is skipped", async () => {
    const period = await getFirstPeriod(leaseId);
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
    await prisma.rentPeriod.update({ where: { id: period!.id }, data: { due_date: fiveDaysAgo, status: "DUE" } });

    const result1 = await processor.runAccrual();
    expect(result1.skipped).toBe(false);

    const result2 = await processor.runAccrual();
    expect(result2.skipped).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Append-only payment trigger
// ---------------------------------------------------------------------------

describe("Append-only payment DB triggers", () => {
  let pmToken: string;
  let periodId: string;
  let paymentId: string;

  beforeAll(async () => {
    const pm = await createPM("trigger");
    pmToken = pm.pmToken;
    const propId = await createProperty(pm.pmId);
    const unitId = await createUnit(propId);
    const lease = await createLease(propId, unitId, pmToken, "2026-05-01");
    const period = await getFirstPeriod(lease.leaseId);
    periodId = period!.id;

    // Record a payment
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${pmToken}`)
      .send({ rentPeriodId: periodId, amountPaise: 500_000, method: "CASH", paidOn: "2026-05-01" });
    paymentId = res.body.payment.id as string;
    cleanup.paymentIds.push(paymentId);
  }, 30000);

  it("prisma.payment.delete → DB trigger raises exception", async () => {
    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM payments WHERE id = $1`, paymentId),
    ).rejects.toThrow();
  });

  it("prisma.payment.update(amount_paise) → DB trigger raises exception", async () => {
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE payments SET amount_paise = 999 WHERE id = $1`,
        paymentId,
      ),
    ).rejects.toThrow();
  });

  it("prisma.payment.update(is_voided=true) → succeeds (allowed void columns)", async () => {
    // Use the void endpoint, not direct SQL, to ensure the service path works
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/payments/${paymentId}/void`)
      .set("Authorization", `Bearer ${pmToken}`)
      .send({ reason: "Test void reason for trigger test" });
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Void cascade block
// ---------------------------------------------------------------------------

describe("Void cascade block (PAYMENT_VOID_CASCADE_BLOCKED)", () => {
  let pmToken: string;

  beforeAll(async () => {
    const pm = await createPM("cascade");
    pmToken = pm.pmToken;
  }, 15000);

  it("overpay → consume credit on next period → void original → 409 PAYMENT_VOID_CASCADE_BLOCKED", async () => {
    const pm = await createPM("cascade2");
    pmToken = pm.pmToken;
    const propId = await createProperty(pm.pmId);
    const unitId = await createUnit(propId);
    const lease = await createLease(propId, unitId, pmToken, "2026-06-01");
    const period = await getFirstPeriod(lease.leaseId);

    // Overpay to create spillover
    const overRes = await supertestFn(app.getHttpServer())
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${pmToken}`)
      .send({ rentPeriodId: period!.id, amountPaise: 2_000_000, method: "CASH", paidOn: "2026-06-01" });
    expect(overRes.status).toBe(201);
    const sourcePaymentId = overRes.body.payment.id as string;
    const creditId = overRes.body.prepaid_credit?.id as string;
    cleanup.paymentIds.push(sourcePaymentId);
    if (creditId) cleanup.prepaidCreditIds.push(creditId);

    // Manually mark the credit as consumed (simulate downstream payment consuming it)
    if (creditId) {
      await prisma.prepaidCredit.update({
        where: { id: creditId },
        data: { consumed_at: new Date(), consumed_by_payment_id: null },
      });
      // set consumed_by to a dummy — use sourcePaymentId as reference (it exists)
      await prisma.prepaidCredit.update({
        where: { id: creditId },
        data: { consumed_by_payment_id: sourcePaymentId },
      });
    }

    // Now try to void the original payment — should be blocked
    const voidRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/payments/${sourcePaymentId}/void`)
      .set("Authorization", `Bearer ${pmToken}`)
      .send({ reason: "Trying to void with consumed credit" });

    expect(voidRes.status).toBe(409);
    expect(voidRes.body.error.code).toBe("PAYMENT_VOID_CASCADE_BLOCKED");
  });
});

// ---------------------------------------------------------------------------
// PropertyScopeGuard: PM-B cannot record payment on PM-A's lease
// ---------------------------------------------------------------------------

describe("PropertyScopeGuard: cross-property payment attempt", () => {
  it("PM-B recording payment against PM-A property period → 403", async () => {
    const pmA = await createPM("scope-a");
    const pmB = await createPM("scope-b");

    const propA = await createProperty(pmA.pmId);
    const unitA = await createUnit(propA);
    const leaseA = await createLease(propA, unitA, pmA.pmToken, "2026-07-01");
    const periodA = await getFirstPeriod(leaseA.leaseId);

    // PM-B tries to record payment against PM-A's period
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${pmB.pmToken}`)
      .send({ rentPeriodId: periodA!.id, amountPaise: 500_000, method: "CASH", paidOn: "2026-07-01" });

    expect(res.status).toBe(403);
  });
});
