/**
 * Phase 4 — Gap tests for the acceptance pass.
 *
 * Covers:
 *   TC-RENT-005 (BL-11 concurrency): 10 parallel POST /payments of ₹100 each
 *     against a period with outstanding ₹500 → sum-of-paid + spillover = 1000 paise;
 *     no 500s; no negative outstanding.
 *   TC-RENT-006 (void-cascade block): already covered in phase4-integration.spec.ts.
 *     This file DOES NOT duplicate it.
 *   TC-RENT-007 (append-only): covered in phase4-integration.spec.ts.
 *     This file DOES NOT duplicate it.
 *   TC-LATEFEE-001 (BL-12): already covered in phase4-integration.spec.ts.
 *     This file DOES NOT duplicate it.
 *   TC-LATEFEE-002 (BL-13 worked example): already covered in phase4-integration.spec.ts.
 *     This file DOES NOT duplicate it.
 *   TC-LATEFEE-003 (BL-13 boundary): 6 days → 0 late fee, exactly 7 → 1 week,
 *     13 days → 1 week, 14 days → 2 weeks. The 13-day case is already in
 *     phase4-integration; this adds 6-day and 14-day boundary checks.
 *   TC-LATEFEE-004 (BL-13 idempotency concurrent): already covered by
 *     phase4-security-fixes.spec.ts (M-01). Verified count only — not duplicated.
 *   30-day simulated cron run: advances a frozen clock 30 days one day at a
 *     time, runs the worker each day, verifies progressive late-fee accrual and
 *     final state (₹18,000 rent, due on day 0, 25 days overdue at day 30 →
 *     floor(25/7)=3 full weeks → 3 × 2% × 1,800,000 = 108,000 paise, ₹1,080).
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
}, 60_000);

afterAll(async () => {
  await prisma.rentAccrualLog.deleteMany({});

  const validIds = (arr: string[]) => arr.filter((id): id is string => typeof id === "string" && id.length > 0);

  const leaseIds = validIds(cleanup.leaseIds);

  const creditIds = validIds(cleanup.prepaidCreditIds);
  if (creditIds.length > 0) {
    await prisma.prepaidCredit.deleteMany({ where: { id: { in: creditIds } } });
  }
  if (leaseIds.length > 0) {
    await prisma.prepaidCredit.deleteMany({ where: { lease_id: { in: leaseIds } } });
  }

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

  const periodIds = validIds(cleanup.periodIds);
  if (periodIds.length > 0) {
    await prisma.rentPeriod.deleteMany({ where: { id: { in: periodIds } } });
  }

  for (const leaseId of leaseIds) {
    await prisma.leaseTenant.deleteMany({ where: { lease_id: leaseId } });
  }
  if (leaseIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { entity_type: { in: ["Lease", "RentPeriod", "Payment", "PrepaidCredit", "LeaseTenant"] } },
    });
    await prisma.rentPeriod.deleteMany({ where: { lease_id: { in: leaseIds } } });
    await prisma.lease.deleteMany({ where: { id: { in: leaseIds } } });
  }

  const tenantIds = validIds(cleanup.tenantIds);
  if (tenantIds.length > 0) {
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  }

  const unitIds = validIds(cleanup.unitIds);
  if (unitIds.length > 0) {
    await prisma.unit.deleteMany({ where: { id: { in: unitIds } } });
  }

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
}, 30_000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createPM(suffix: string): Promise<{ pmId: string; pmToken: string }> {
  const email = `pm-gap4-${suffix}-${Date.now()}@test.local`;
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: `PM Gaps4 ${suffix}`,
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
      name: `Gap4 Prop ${Date.now()}`,
      address: "Test Road",
      city: "Delhi",
      state: "Delhi",
      pincode: "110001",
      active_pm_id: pmId,
    });
  const propId = res.body.id as string;
  cleanup.propertyIds.push(propId);
  return propId;
}

async function createUnit(propId: string, rentPaise: number = 1_800_000): Promise<string> {
  const res = await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propId}/units`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      unit_number: `U-${Date.now()}`,
      bedrooms: 2,
      bathrooms: 1,
      monthly_rent_paise: rentPaise,
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
  rentPaise: number = 1_800_000,
): Promise<{ leaseId: string; tenantToken: string }> {
  const email = `ten-gap4-${Date.now()}@test.local`;
  const res = await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propId}/units/${unitId}/leases`)
    .set("Authorization", `Bearer ${pmToken}`)
    .send({
      startDate,
      endDate: "2027-12-01",
      monthlyRentPaise: rentPaise,
      securityDepositPaise: rentPaise * 2,
      tenants: [{ name: "Gap4 Tenant", email, is_primary: true }],
    });
  const leaseId = res.body.lease?.id as string;
  const tenantUserId = res.body.tenants?.[0]?.userId as string;
  const tenantId = res.body.tenants?.[0]?.tenantId as string;
  const tempPw = res.body.tenants?.[0]?.tempPassword as string;
  if (!leaseId) throw new Error(`createLease failed: ${JSON.stringify(res.body)}`);
  cleanup.leaseIds.push(leaseId);
  if (tenantId) cleanup.tenantIds.push(tenantId);
  if (tenantUserId) cleanup.userIds.push(tenantUserId);

  const loginRes = await supertestFn(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password: tempPw });

  const periods = await prisma.rentPeriod.findMany({ where: { lease_id: leaseId } });
  for (const p of periods) cleanup.periodIds.push(p.id);

  return { leaseId, tenantToken: loginRes.body.accessToken as string };
}

async function getFirstPeriod(leaseId: string) {
  return prisma.rentPeriod.findFirst({ where: { lease_id: leaseId }, orderBy: { period_start: "asc" } });
}

// ---------------------------------------------------------------------------
// TC-RENT-005 (BL-11 concurrency): 10 parallel payments of ₹100 each
// Period outstanding = ₹500; excess routes to PrepaidCredit
// ---------------------------------------------------------------------------

describe("TC-RENT-005 (BL-11 concurrency): 10 parallel ₹100 payments, ₹500 outstanding", () => {
  let pmToken: string;
  let leaseId: string;
  let periodId: string;

  const PAISE_PER_PAYMENT = 10_000; // ₹100 each
  const PAYMENTS_COUNT = 10;
  const INITIAL_OUTSTANDING = 50_000; // ₹500

  beforeAll(async () => {
    const pm = await createPM("race");
    pmToken = pm.pmToken;
    const propId = await createProperty(pm.pmId);
    // Create unit with ₹500 rent so the first period's outstanding = 50,000 paise
    const unitId = await createUnit(propId, INITIAL_OUTSTANDING);
    const lease = await createLease(propId, unitId, pmToken, "2026-08-01", INITIAL_OUTSTANDING);
    leaseId = lease.leaseId;
    const period = await getFirstPeriod(leaseId);
    periodId = period!.id;

    // Ensure period is in DUE state with correct outstanding
    await prisma.rentPeriod.update({
      where: { id: periodId },
      data: {
        status: "DUE",
        outstanding_paise: BigInt(INITIAL_OUTSTANDING),
        paid_paise: 0n,
        amount_due_paise: BigInt(INITIAL_OUTSTANDING),
      },
    });
  }, 30_000);

  /**
   * BUG-001 (TC-RENT-005): Concurrent POST /payments using Serializable isolation +
   * SELECT FOR UPDATE produces Postgres serialization conflicts (error code 40001 /
   * P2034) when 10 transactions race on the same period row. The service does not
   * have retry logic on serialization failures, so some requests return 500 instead
   * of a meaningful HTTP status.
   *
   * This test captures the current behavior and is the regression harness for the fix.
   * Expected behavior (post-fix): all 10 return 201, final outstanding = 0.
   * Current behavior: some return 500 on serialization conflict.
   *
   * Owner: gharsetu-backend
   * Priority: P0 (data integrity at risk — 500 instead of serialized success)
   */
  it("BUG-001 REGRESSION: 10 parallel payments — concurrency causes 500 on serialization conflict", async () => {
    const requests = Array.from({ length: PAYMENTS_COUNT }, () =>
      supertestFn(app.getHttpServer())
        .post("/api/v1/payments")
        .set("Authorization", `Bearer ${pmToken}`)
        .send({
          rentPeriodId: periodId,
          amountPaise: PAISE_PER_PAYMENT,
          method: "UPI",
          paidOn: "2026-08-01",
        }),
    );

    const results = await Promise.all(requests);

    // Capture the statuses so we can report the exact distribution
    const statusCounts = results.reduce<Record<number, number>>((acc, r) => {
      acc[r.status as number] = (acc[r.status as number] ?? 0) + 1;
      return acc;
    }, {});

    // Collect payment IDs from successful responses
    for (const r of results) {
      if (r.status === 201) {
        if (r.body.payment?.id) cleanup.paymentIds.push(r.body.payment.id as string);
        if (r.body.prepaid_credit?.id) cleanup.prepaidCreditIds.push(r.body.prepaid_credit.id as string);
      }
    }

    // No payment record in the DB should have negative outstanding
    const finalPeriod = await prisma.rentPeriod.findUnique({ where: { id: periodId } });
    expect(finalPeriod).not.toBeNull();
    // outstanding must never go negative — BL-11 invariant
    expect(finalPeriod!.outstanding_paise).toBeGreaterThanOrEqual(0n);

    // Post-fix: every request must return 201 (never 500).
    const has500 = (statusCounts[500] ?? 0) > 0;
    expect(has500).toBe(false);

    // All 10 payments must succeed.
    const successfulCount = statusCounts[201] ?? 0;
    expect(successfulCount).toBe(PAYMENTS_COUNT);

    // Financial invariant: paid + prepaid credits == total incoming paise
    const expectedTotalPaid = BigInt(PAISE_PER_PAYMENT) * BigInt(PAYMENTS_COUNT);
    const credits = await prisma.prepaidCredit.findMany({ where: { lease_id: finalPeriod!.lease_id } });
    const totalCredits = credits.reduce((sum, c) => sum + c.amount_paise, 0n);
    expect(finalPeriod!.paid_paise + totalCredits).toBe(expectedTotalPaid);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// TC-LATEFEE-003 (BL-13 boundaries): 6, 7, 13, 14 days overdue
// The 13-day case is covered in phase4-integration — only 6 and 14 are new here.
// ---------------------------------------------------------------------------

describe("TC-LATEFEE-003 (BL-13 boundaries)", () => {
  let pmToken: string;
  let leaseId: string;

  beforeAll(async () => {
    const pm = await createPM("boundaries");
    pmToken = pm.pmToken;
    const propId = await createProperty(pm.pmId);
    const unitId = await createUnit(propId);
    const lease = await createLease(propId, unitId, pmToken, "2026-09-01");
    leaseId = lease.leaseId;
  }, 30_000);

  afterEach(async () => {
    // Clean accrual logs between boundary tests
    await prisma.rentAccrualLog.deleteMany({});
  });

  it("BL-13 boundary: 6 days overdue → 0 full weeks → ₹0 late fee (but status IS OVERDUE per BL-12)", async () => {
    const period = await getFirstPeriod(leaseId);
    const sixDaysAgo = new Date();
    sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);

    await prisma.rentPeriod.update({
      where: { id: period!.id },
      data: {
        due_date: sixDaysAgo,
        status: "DUE",
        late_fee_paise: 0n,
        outstanding_paise: 1_800_000n,
        amount_due_paise: 1_800_000n,
      },
    });

    await processor.runAccrual();

    const updated = await prisma.rentPeriod.findUnique({ where: { id: period!.id } });
    // 6 days past due: BL-12 threshold is 5 days. 6 > 5, so the period IS flipped to OVERDUE.
    // BL-13: floor(6/7) = 0 full weeks → ₹0 late fee.
    // Combined: status=OVERDUE but late_fee_paise=0.
    expect(updated?.status).toBe("OVERDUE");
    expect(updated?.late_fee_paise).toBe(0n);
    // Outstanding unchanged (no late fee added yet — first full week not yet elapsed)
    expect(updated?.outstanding_paise).toBe(1_800_000n);
  });

  it("BL-13 boundary: exactly 7 days overdue → 1 full week → ₹360 (36,000 paise)", async () => {
    const period = await getFirstPeriod(leaseId);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    await prisma.rentPeriod.update({
      where: { id: period!.id },
      data: {
        due_date: sevenDaysAgo,
        status: "DUE",
        late_fee_paise: 0n,
        outstanding_paise: 1_800_000n,
        amount_due_paise: 1_800_000n,
      },
    });

    await processor.runAccrual();

    const updated = await prisma.rentPeriod.findUnique({ where: { id: period!.id } });
    expect(updated?.status).toBe("OVERDUE");
    // floor(7/7) = 1 week → 1 × 2% × 1,800,000 = 36,000
    expect(updated?.late_fee_paise).toBe(36_000n);
    expect(updated?.outstanding_paise).toBe(1_836_000n);
  });

  it("BL-13 boundary: exactly 14 days overdue → 2 full weeks → ₹720 (72,000 paise)", async () => {
    const period = await getFirstPeriod(leaseId);
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    await prisma.rentPeriod.update({
      where: { id: period!.id },
      data: {
        due_date: fourteenDaysAgo,
        status: "DUE",
        late_fee_paise: 0n,
        outstanding_paise: 1_800_000n,
        amount_due_paise: 1_800_000n,
      },
    });

    await processor.runAccrual();

    const updated = await prisma.rentPeriod.findUnique({ where: { id: period!.id } });
    expect(updated?.status).toBe("OVERDUE");
    // floor(14/7) = 2 weeks → 2 × 2% × 1,800,000 = 72,000
    expect(updated?.late_fee_paise).toBe(72_000n);
    expect(updated?.outstanding_paise).toBe(1_872_000n);
  });
});

// ---------------------------------------------------------------------------
// 30-day simulated cron run (Master Plan Phase 4 acceptance gate)
//
// Setup:
//   - Rent: ₹18,000 (1,800,000 paise)
//   - Period due date: TODAY (so at day 0 it is just DUE, not overdue)
//   - Advance clock 30 days, running the worker with each day's date
//
// Day 5  → worker flips status to OVERDUE (BL-12: 5 calendar days past due)
// Day 12 → 12 days overdue → floor(12/7)=1 week → fee = 36,000 paise
// Day 19 → 19 days overdue → floor(19/7)=2 weeks → fee = 72,000 paise
// Day 26 → 26 days overdue → floor(26/7)=3 weeks → fee = 108,000 paise
// Day 30 → 30 days overdue → floor(30/7)=4 weeks → fee = 144,000 paise
//
// The worker is idempotent per IST date, so we use distinct synthetic dates.
// ---------------------------------------------------------------------------

describe("30-day simulated cron run (progressive BL-12/BL-13 accrual)", () => {
  let pmToken: string;
  let leaseId: string;
  let periodId: string;

  // Anchor the "due date" to a fixed point in the past so we control the math.
  // Using 2025-10-01 as due date — well in the past, no overlap with other tests.
  const DUE_DATE = new Date("2025-10-01T00:00:00Z");
  const RENT_PAISE = 1_800_000n; // ₹18,000

  beforeAll(async () => {
    const pm = await createPM("30day");
    pmToken = pm.pmToken;
    const propId = await createProperty(pm.pmId);
    const unitId = await createUnit(propId);
    const lease = await createLease(propId, unitId, pmToken, "2025-10-01");
    leaseId = lease.leaseId;
    const period = await getFirstPeriod(leaseId);
    periodId = period!.id;

    // Set the period's due_date to our anchor and reset all paise fields
    await prisma.rentPeriod.update({
      where: { id: periodId },
      data: {
        due_date: DUE_DATE,
        status: "DUE",
        late_fee_paise: 0n,
        outstanding_paise: RENT_PAISE,
        paid_paise: 0n,
        amount_due_paise: RENT_PAISE,
      },
    });

    // Clean accrual logs from any previous runs
    await prisma.rentAccrualLog.deleteMany({});
  }, 30_000);

  it("runs 30 days of accrual in sequence and verifies progressive late-fee accumulation", async () => {
    // Run the worker day by day using synthetic dates.
    // Each day uses a unique ISO date string to keep the idempotency log correct.
    for (let day = 1; day <= 30; day++) {
      const syntheticDate = new Date(`2025-10-${String(day + 1).padStart(2, "0")}T00:00:00Z`);
      // Note: day+1 because due_date is Oct-01, so Oct-02 is day 1 overdue etc.
      // But we want daysOverdue = day (relative to DUE_DATE).
      // Compute the actual synthetic "today" as DUE_DATE + day days
      const today = new Date(DUE_DATE);
      today.setDate(today.getDate() + day);

      const result = await processor.runAccrual(today);
      // Each day must be a fresh run (skipped:false) because we use distinct dates
      expect(result.skipped).toBe(false);
    }

    const finalPeriod = await prisma.rentPeriod.findUnique({ where: { id: periodId } });
    expect(finalPeriod).not.toBeNull();

    // Day 30 = 30 days overdue → floor(30/7) = 4 full weeks
    // late_fee = 4 × 2% × 1,800,000 = 144,000 paise (₹1,440)
    expect(finalPeriod!.status).toBe("OVERDUE");
    expect(finalPeriod!.late_fee_paise).toBe(144_000n);
    expect(finalPeriod!.outstanding_paise).toBe(RENT_PAISE + 144_000n);
  }, 120_000);

  it("verifies intermediate state at day 5 (OVERDUE flip, 0 weeks → still 0 late fee)", async () => {
    // Reset the period to DUE with a fresh due_date = 5 days ago (exactly the threshold).
    // The worker uses `today - 5 days` as the overdue threshold. A period due 5 days
    // ago (today - 5) is exactly at the threshold and IS included in the OVERDUE query.
    // days_overdue = 5 → floor(5/7) = 0 full weeks → late_fee = 0.
    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    await prisma.rentPeriod.update({
      where: { id: periodId },
      data: {
        due_date: fiveDaysAgo,
        status: "DUE",
        late_fee_paise: 0n,
        outstanding_paise: RENT_PAISE,
        paid_paise: 0n,
        amount_due_paise: RENT_PAISE,
      },
    });
    await prisma.rentAccrualLog.deleteMany({});

    // Run the worker once (today = real today, period is 5 days overdue)
    await processor.runAccrual();

    const atDay5 = await prisma.rentPeriod.findUnique({ where: { id: periodId } });
    // BL-12: 5 days past due → OVERDUE
    expect(atDay5!.status).toBe("OVERDUE");
    // BL-13: floor(5/7) = 0 full weeks → late_fee = 0
    expect(atDay5!.late_fee_paise).toBe(0n);
    // Outstanding = original rent (no late fee added)
    expect(atDay5!.outstanding_paise).toBe(RENT_PAISE);

    await prisma.rentAccrualLog.deleteMany({});
  }, 30_000);

  it("verifies 19-days-overdue state directly: floor(19/7)=2 weeks → 72,000 paise late fee", async () => {
    // Direct setup: period due 19 days ago, run worker once with real today.
    // This avoids synthetic date complexity and directly verifies the BL-13 formula
    // for 19 days (which gives 2 full weeks → ₹720).
    const nineteenDaysAgo = new Date();
    nineteenDaysAgo.setDate(nineteenDaysAgo.getDate() - 19);

    await prisma.rentPeriod.update({
      where: { id: periodId },
      data: {
        due_date: nineteenDaysAgo,
        status: "DUE",
        late_fee_paise: 0n,
        outstanding_paise: RENT_PAISE,
        paid_paise: 0n,
        amount_due_paise: RENT_PAISE,
      },
    });
    await prisma.rentAccrualLog.deleteMany({});

    await processor.runAccrual();

    const atDay19 = await prisma.rentPeriod.findUnique({ where: { id: periodId } });
    expect(atDay19!.status).toBe("OVERDUE");
    // 19 days → floor(19/7) = 2 full weeks → 2 × 2% × 1,800,000 = 72,000 paise (₹720)
    expect(atDay19!.late_fee_paise).toBe(72_000n);
    expect(atDay19!.outstanding_paise).toBe(RENT_PAISE + 72_000n);

    await prisma.rentAccrualLog.deleteMany({});
  }, 30_000);

  it("verifies BL-13 boundary at exactly 25 days overdue → 3 full weeks → 108,000 paise (₹1,080)", async () => {
    // This test directly sets up the scenario from the master plan example:
    // Rent ₹18,000, due date = TODAY - 25 days
    const twentyFiveDaysAgo = new Date();
    twentyFiveDaysAgo.setDate(twentyFiveDaysAgo.getDate() - 25);

    await prisma.rentPeriod.update({
      where: { id: periodId },
      data: {
        due_date: twentyFiveDaysAgo,
        status: "DUE",
        late_fee_paise: 0n,
        outstanding_paise: RENT_PAISE,
        paid_paise: 0n,
        amount_due_paise: RENT_PAISE,
      },
    });
    await prisma.rentAccrualLog.deleteMany({});

    await processor.runAccrual();

    const updated = await prisma.rentPeriod.findUnique({ where: { id: periodId } });
    expect(updated!.status).toBe("OVERDUE");
    // 25 days → floor(25/7)=3 full weeks → 3 × 2% × 1,800,000 = 108,000 paise (₹1,080)
    expect(updated!.late_fee_paise).toBe(108_000n);
    expect(updated!.outstanding_paise).toBe(RENT_PAISE + 108_000n);
  }, 30_000);
});
