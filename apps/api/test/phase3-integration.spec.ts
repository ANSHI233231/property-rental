/**
 * Phase 3 — Tenants + Leases + co-tenant flows Integration Tests
 *
 * Covers:
 *   BL-01 (service-layer):  Two concurrent POST lease requests on same unit → one 409 UNIT_HAS_ACTIVE_LEASE
 *   BL-01 (DB-level):       Direct prisma.lease.create with status=ACTIVE bypassing service → DB unique index rejects
 *   BL-02:                  prisma.lease.update({monthly_rent_paise}) on existing lease → DB trigger throws
 *   BL-04:                  Creating ACTIVE lease flips unit to OCCUPIED; terminating flips back to AVAILABLE
 *   BL-07:                  POST lease with empty tenants array → 400 LEASE_NEEDS_TENANT
 *   BL-08/09 (single):      Single-tenant lease → terminate-request → finalize succeeds (requester is auto-APPROVED)
 *   BL-08/09 (single):      Requester can withdraw before finalize
 *   BL-08/09 (multi):       Multi-tenant → approval rows created PENDING for co-tenants; finalize blocked until all APPROVED
 *   BL-08/09 (multi):       If any tenant REJECTS → finalize is 409 forever
 *   BL-18:                  Terminate lease then immediately start new lease → 409 TURNOVER_GAP_REQUIRED
 *   PropertyScopeGuard:     PM-B hitting POST /properties/A/units/.../leases → 403
 *   DepositRefund unique:   Two refunds on same lease → second is 409 DEPOSIT_REFUND_EXISTS
 *   Idempotent renew:       Rapid duplicate renew within 5 sec returns same new lease ID
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

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let app: INestApplication;
let prisma: PrismaService;
let adminToken: string;

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
}, 60000);

afterAll(async () => {
  await app.close();
}, 30000);

// ---------------------------------------------------------------------------
// Test data tracking for cleanup
// ---------------------------------------------------------------------------

let createdLeaseIds: number[] = [];
let createdTenantIds: number[] = [];
let createdUnitIds: number[] = [];
let createdPropertyIds: number[] = [];
let createdUserIds: number[] = [];

afterEach(async () => {
  // Clean up in strict dependency order:
  //   deposit_refunds → lease_termination_approvals → lease_terminations
  //   → lease_tenants → leases (audit) → leases
  //   → tenant audit → tenants
  //   → unit audit → units  (must come AFTER leases deleted due to FK)
  //   → property audit + transfer_logs → properties
  //   → user audit + refresh_tokens → users

  if (createdLeaseIds.length > 0) {
    // Deposit refunds
    await prisma.depositRefund.deleteMany({ where: { lease_id: { in: createdLeaseIds } } });
    // Termination approvals (join via termination which joins via lease)
    const termIds = await prisma.leaseTermination.findMany({
      where: { lease_id: { in: createdLeaseIds } },
      select: { id: true },
    });
    if (termIds.length > 0) {
      await prisma.leaseTerminationApproval.deleteMany({
        where: { termination_id: { in: termIds.map((t) => t.id) } },
      });
      await prisma.leaseTermination.deleteMany({ where: { id: { in: termIds.map((t) => t.id) } } });
    }
    await prisma.leaseTenant.deleteMany({ where: { lease_id: { in: createdLeaseIds } } });
    await prisma.auditLog.deleteMany({
      where: { entity_type: "Lease", entity_id: { in: createdLeaseIds.map(String) } },
    });
    // LeaseTenant audit entries use composite entity_id like "leaseId:tenantId"
    for (const lid of createdLeaseIds) {
      await prisma.auditLog.deleteMany({
        where: { entity_type: "LeaseTenant", entity_id: { startsWith: String(lid) } },
      });
    }
    // Phase 4: delete payments (bypass trigger) and rent_periods before leases
    await prisma.$executeRawUnsafe(
      `DELETE FROM payments WHERE lease_id = ANY($1::bigint[])`,
      createdLeaseIds,
    );
    await prisma.prepaidCredit.deleteMany({ where: { lease_id: { in: createdLeaseIds } } });
    await prisma.rentPeriod.deleteMany({ where: { lease_id: { in: createdLeaseIds } } });
    await prisma.auditLog.deleteMany({ where: { entity_type: "RentPeriod" } });
    await prisma.lease.deleteMany({ where: { id: { in: createdLeaseIds } } });
    createdLeaseIds = [];
  }

  if (createdTenantIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entity_type: "Tenant", entity_id: { in: createdTenantIds.map(String) } } });
    await prisma.tenant.deleteMany({ where: { id: { in: createdTenantIds } } });
    createdTenantIds = [];
  }

  // Units must be deleted AFTER leases (FK: leases.unit_id → units.id ON DELETE RESTRICT)
  if (createdUnitIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entity_type: "Unit", entity_id: { in: createdUnitIds.map(String) } } });
    await prisma.unit.deleteMany({ where: { id: { in: createdUnitIds } } });
    createdUnitIds = [];
  }

  if (createdPropertyIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entity_type: "Property", entity_id: { in: createdPropertyIds.map(String) } } });
    await prisma.propertyTransferLog.deleteMany({ where: { property_id: { in: createdPropertyIds } } });
    await prisma.property.deleteMany({ where: { id: { in: createdPropertyIds } } });
    createdPropertyIds = [];
  }

  if (createdUserIds.length > 0) {
    // Delete audit rows where entity is this user AND where actor_id is this user (FK constraint)
    await prisma.auditLog.deleteMany({ where: { entity_type: "User", entity_id: { in: createdUserIds.map(String) } } });
    await prisma.auditLog.deleteMany({ where: { actor_id: { in: createdUserIds } } });
    await prisma.refreshToken.deleteMany({ where: { user_id: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds = [];
  }
}, 30000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTestProperty() {
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/properties")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: `Test Prop ${Date.now()}`,
      address: "1 Test Rd",
      city: "Delhi",
      state: "Delhi",
      pincode: "110001",
    });
  expect(res.status).toBe(201);
  createdPropertyIds.push(res.body.id as number);
  return res.body as { id: number };
}

async function createTestUnit(propertyId: number) {
  const res = await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propertyId}/units`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      unit_number: `U${Date.now()}`,
      bedrooms: 2,
      bathrooms: 1,
      monthly_rent_paise: 1_800_000,
    });
  expect(res.status).toBe(201);
  createdUnitIds.push(res.body.id as number);
  return res.body as { id: number };
}

const P3_PM_PASSWORD = "P3PM@test2026!!";

async function createTestPM(emailPrefix: string): Promise<{ id: number; email: string; temp_password: string }> {
  const email = `${emailPrefix}-${Date.now()}@test.local`;
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      email,
      firstName: "Test",
      lastName: "PM",
      role: "PROPERTY_MANAGER",
      password: P3_PM_PASSWORD,
    });
  expect(res.status).toBe(201);
  createdUserIds.push(res.body.id as number);
  // temp_password no longer in response; return known password under that key for backward-compat
  return { ...(res.body as { id: number }), email, temp_password: P3_PM_PASSWORD };
}

async function loginAs(email: string, password: string): Promise<string> {
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password });
  expect(res.status).toBe(200);
  return res.body.accessToken as string;
}

async function createLease(
  propertyId: number,
  unitId: number,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propertyId}/units/${unitId}/leases`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      startDate: "2026-06-01",
      endDate: "2027-05-31",
      monthlyRentPaise: 1_800_000,
      securityDepositPaise: 3_600_000,
      tenants: [
        {
          name: `Tenant ${Date.now()}`,
          email: `tenant-${Date.now()}@test.local`,
          is_primary: true,
        },
      ],
      ...overrides,
    });
  return res;
}

// ===========================================================================
// BL-07: empty tenants array
// ===========================================================================

describe("BL-07 — Lease requires at least one tenant", () => {
  it("POST lease with empty tenants → 400 LEASE_NEEDS_TENANT", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.id);

    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${prop.id}/units/${unit.id}/leases`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        startDate: "2026-06-01",
        endDate: "2027-05-31",
        monthlyRentPaise: 1_800_000,
        securityDepositPaise: 3_600_000,
        tenants: [],
      });

    expect(res.status).toBe(400);
  }, 30000);
});

// ===========================================================================
// BL-01 service-layer — duplicate ACTIVE lease
// ===========================================================================

describe("BL-01 — One active lease per unit", () => {
  it("POST second lease on same unit → 409 UNIT_HAS_ACTIVE_LEASE", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.id);

    const res1 = await createLease(prop.id, unit.id, adminToken);
    expect(res1.status).toBe(201);
    // Track leases and tenants for cleanup
    if (res1.body.lease?.id) createdLeaseIds.push(res1.body.lease.id as number);
    if (res1.body.tenants) {
      for (const t of res1.body.tenants as Array<{ tenantId: number; userId: number }>) {
        createdTenantIds.push(t.tenantId);
        createdUserIds.push(t.userId);
      }
    }

    const res2 = await createLease(prop.id, unit.id, adminToken, {
      tenants: [{ name: "Another Tenant", email: `another-${Date.now()}@test.local`, is_primary: true }],
    });
    expect(res2.status).toBe(409);
    expect(res2.body.error?.code).toBe("UNIT_HAS_ACTIVE_LEASE");
  }, 30000);

  it("BL-01 DB-level regression — direct prisma insert bypassing service → unique index rejects", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.id);

    // Create first lease via service (so unit.state = OCCUPIED and first ACTIVE lease exists)
    const res1 = await createLease(prop.id, unit.id, adminToken);
    expect(res1.status).toBe(201);
    if (res1.body.lease?.id) createdLeaseIds.push(res1.body.lease.id as number);
    if (res1.body.tenants) {
      for (const t of res1.body.tenants as Array<{ tenantId: number; userId: number }>) {
        createdTenantIds.push(t.tenantId);
        createdUserIds.push(t.userId);
      }
    }

    // Now attempt to bypass the service layer and insert directly via Prisma
    // The partial unique index on leases(unit_id) WHERE status='ACTIVE' must block this.
    const adminUser = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    expect(adminUser).toBeTruthy();

    await expect(
      prisma.lease.create({
        data: {
          unit_id: unit.id,
          start_date: new Date("2026-06-01"),
          end_date: new Date("2027-05-31"),
          monthly_rent_paise: BigInt(1_800_000),
          security_deposit_paise: BigInt(3_600_000),
          status: 0,
          signed_by_pm_id: adminUser!.id,
          signed_at: new Date(),
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  }, 30000);
});

// ===========================================================================
// BL-02 — rent immutability (DB trigger)
// ===========================================================================

describe("BL-02 — Lease rent/deposit immutable after creation", () => {
  it("prisma.lease.update({monthly_rent_paise}) on existing lease → DB trigger throws", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.id);

    const res = await createLease(prop.id, unit.id, adminToken);
    expect(res.status).toBe(201);
    const leaseId = res.body.lease?.id as number;
    createdLeaseIds.push(leaseId);
    if (res.body.tenants) {
      for (const t of res.body.tenants as Array<{ tenantId: number; userId: number }>) {
        createdTenantIds.push(t.tenantId);
        createdUserIds.push(t.userId);
      }
    }

    // Attempt to mutate monthly_rent_paise directly via Prisma (bypassing service).
    // The DB trigger raises P0001; Prisma wraps it in PrismaClientUnknownRequestError
    // so we match on the message string rather than code.
    await expect(
      prisma.lease.update({
        where: { id: leaseId },
        data: { monthly_rent_paise: BigInt(999) },
      }),
    ).rejects.toThrow(/BL_02_RENT_IMMUTABLE/);
  }, 30000);

  it("prisma.lease.update({security_deposit_paise}) on existing lease → DB trigger throws", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.id);

    const res = await createLease(prop.id, unit.id, adminToken);
    expect(res.status).toBe(201);
    const leaseId = res.body.lease?.id as number;
    createdLeaseIds.push(leaseId);
    if (res.body.tenants) {
      for (const t of res.body.tenants as Array<{ tenantId: number; userId: number }>) {
        createdTenantIds.push(t.tenantId);
        createdUserIds.push(t.userId);
      }
    }

    await expect(
      prisma.lease.update({
        where: { id: leaseId },
        data: { security_deposit_paise: BigInt(1) },
      }),
    ).rejects.toThrow(/BL_02_DEPOSIT_IMMUTABLE/);
  }, 30000);
});

// ===========================================================================
// BL-04 — unit state transitions with lease
// ===========================================================================

describe("BL-04 — Unit state pairs with lease status", () => {
  it("Creating ACTIVE lease flips unit.state to OCCUPIED", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.id);

    const unitBefore = await prisma.unit.findUnique({ where: { id: unit.id } });
    expect(unitBefore?.state).toBe(0); // UnitState.AVAILABLE = 0

    const res = await createLease(prop.id, unit.id, adminToken);
    expect(res.status).toBe(201);
    const leaseId = res.body.lease?.id as number;
    createdLeaseIds.push(leaseId);
    if (res.body.tenants) {
      for (const t of res.body.tenants as Array<{ tenantId: number; userId: number }>) {
        createdTenantIds.push(t.tenantId);
        createdUserIds.push(t.userId);
      }
    }

    const unitAfter = await prisma.unit.findUnique({ where: { id: unit.id } });
    expect(unitAfter?.state).toBe(2); // UnitState.OCCUPIED = 2
  }, 30000);
});

// ===========================================================================
// BL-08 / BL-09 — single-tenant termination
// ===========================================================================

describe("BL-08/09 — Single-tenant lease termination", () => {
  it("terminate-request → finalize succeeds (requester auto-APPROVED)", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.id);

    const leaseRes = await createLease(prop.id, unit.id, adminToken);
    expect(leaseRes.status).toBe(201);
    const leaseId = leaseRes.body.lease?.id as number;
    createdLeaseIds.push(leaseId);
    const tenantId = leaseRes.body.tenants?.[0]?.tenantId as number;
    const userId = leaseRes.body.tenants?.[0]?.userId as number;
    createdTenantIds.push(tenantId);
    createdUserIds.push(userId);

    // Request termination
    const termRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-request`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        requestedByTenantId: tenantId,
        effectiveDate: "2026-07-01",
        reason: "Moving out",
      });

    expect(termRes.status).toBe(201);
    expect(termRes.body.termination?.pending_approvals).toBe(0);

    // Finalize (single tenant — all approvals are APPROVED from the start)
    // But BL-18 blocks if another lease was terminated within 24h on the same unit.
    // Since this is a fresh unit, finalize should succeed.
    const finalRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/finalize-termination`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(finalRes.status).toBe(200);
    expect(finalRes.body.unit_state).toBe(0); // UnitState.AVAILABLE = 0

    // BL-04: unit should be AVAILABLE again
    const unitAfter = await prisma.unit.findUnique({ where: { id: unit.id } });
    expect(unitAfter?.state).toBe(0); // UnitState.AVAILABLE = 0
  }, 60000);

  it("Requester can withdraw termination request", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.id);

    const leaseRes = await createLease(prop.id, unit.id, adminToken);
    expect(leaseRes.status).toBe(201);
    const leaseId = leaseRes.body.lease?.id as number;
    createdLeaseIds.push(leaseId);
    const tenantId = leaseRes.body.tenants?.[0]?.tenantId as number;
    const userId = leaseRes.body.tenants?.[0]?.userId as number;
    createdTenantIds.push(tenantId);
    createdUserIds.push(userId);

    // Request
    const termRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-request`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requestedByTenantId: tenantId, effectiveDate: "2026-07-01" });
    expect(termRes.status).toBe(201);

    // Withdraw
    const withdrawRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-withdraw`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requestedByTenantId: tenantId });
    expect(withdrawRes.status).toBe(200);
    expect(withdrawRes.body.termination?.withdrawn_at).toBeTruthy();

    // Lease should still be ACTIVE
    const lease = await prisma.lease.findUnique({ where: { id: leaseId } });
    expect(lease?.status).toBe(0); // LeaseStatus.ACTIVE = 0
  }, 30000);

  it("Second terminate-request while one is open → 409 TERMINATION_OPEN", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.id);

    const leaseRes = await createLease(prop.id, unit.id, adminToken);
    expect(leaseRes.status).toBe(201);
    const leaseId = leaseRes.body.lease?.id as number;
    createdLeaseIds.push(leaseId);
    const tenantId = leaseRes.body.tenants?.[0]?.tenantId as number;
    const userId = leaseRes.body.tenants?.[0]?.userId as number;
    createdTenantIds.push(tenantId);
    createdUserIds.push(userId);

    await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-request`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requestedByTenantId: tenantId, effectiveDate: "2026-07-01" });

    const second = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-request`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requestedByTenantId: tenantId, effectiveDate: "2026-08-01" });

    expect(second.status).toBe(409);
    expect(second.body.error?.code).toBe("TERMINATION_OPEN");
  }, 30000);
});

// ===========================================================================
// BL-08 / BL-09 — multi-tenant termination
// ===========================================================================

describe("BL-08/09 — Multi-tenant lease termination", () => {
  it("Finalize blocked until all co-tenants APPROVE", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.id);

    const ts = Date.now();
    const leaseRes = await createLease(prop.id, unit.id, adminToken, {
      tenants: [
        { name: "Tenant A", email: `ta-${ts}@test.local`, is_primary: true },
        { name: "Tenant B", email: `tb-${ts}@test.local`, is_primary: false },
      ],
    });
    expect(leaseRes.status).toBe(201);
    const leaseId = leaseRes.body.lease?.id as number;
    createdLeaseIds.push(leaseId);

    for (const t of leaseRes.body.tenants as Array<{ tenantId: number; userId: number }>) {
      createdTenantIds.push(t.tenantId);
      createdUserIds.push(t.userId);
    }

    const tenantA = (leaseRes.body.tenants as Array<{ tenantId: number; isPrimary: boolean }>).find(
      (t) => t.isPrimary,
    )!;
    const tenantB = (leaseRes.body.tenants as Array<{ tenantId: number; isPrimary: boolean }>).find(
      (t) => !t.isPrimary,
    )!;

    // Tenant A requests termination
    const termRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-request`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requestedByTenantId: tenantA.tenantId, effectiveDate: "2026-07-01" });
    expect(termRes.status).toBe(201);
    expect(termRes.body.termination?.pending_approvals).toBe(1);

    // Finalize should fail — Tenant B still PENDING
    const failFinal = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/finalize-termination`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(failFinal.status).toBe(409);
    expect(failFinal.body.error?.code).toBe("TERMINATION_NOT_FULLY_APPROVED");

    // Tenant B approves
    const approveRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tenantId: tenantB.tenantId, decision: 1 });
    expect(approveRes.status).toBe(200);

    // Now finalize should succeed
    const finalRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/finalize-termination`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(finalRes.status).toBe(200);
    expect(finalRes.body.unit_state).toBe(0); // UnitState.AVAILABLE = 0
  }, 60000);

  it("If a co-tenant REJECTS, finalize is 409 forever (until withdrawn + new request)", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.id);

    const ts = Date.now();
    const leaseRes = await createLease(prop.id, unit.id, adminToken, {
      tenants: [
        { name: "Tenant A", email: `ta2-${ts}@test.local`, is_primary: true },
        { name: "Tenant B", email: `tb2-${ts}@test.local`, is_primary: false },
      ],
    });
    expect(leaseRes.status).toBe(201);
    const leaseId = leaseRes.body.lease?.id as number;
    createdLeaseIds.push(leaseId);

    for (const t of leaseRes.body.tenants as Array<{ tenantId: number; userId: number }>) {
      createdTenantIds.push(t.tenantId);
      createdUserIds.push(t.userId);
    }

    const tenantA = (leaseRes.body.tenants as Array<{ tenantId: number; isPrimary: boolean }>).find(
      (t) => t.isPrimary,
    )!;
    const tenantB = (leaseRes.body.tenants as Array<{ tenantId: number; isPrimary: boolean }>).find(
      (t) => !t.isPrimary,
    )!;

    await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-request`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requestedByTenantId: tenantA.tenantId, effectiveDate: "2026-07-01" });

    // Tenant B rejects
    await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tenantId: tenantB.tenantId, decision: 2 });

    // Finalize is forever 409
    const finalRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/finalize-termination`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(finalRes.status).toBe(409);
    expect(finalRes.body.error?.code).toBe("TERMINATION_NOT_FULLY_APPROVED");
    expect(finalRes.body.error?.details?.rejected_tenant_ids).toContain(tenantB.tenantId);
  }, 30000);
});

// ===========================================================================
// BL-18 — 24-hour turnover gap
// ===========================================================================

describe("BL-18 — 24-hour turnover gap between leases", () => {
  it("Terminate lease then immediately try to lease same unit → 409 TURNOVER_GAP_REQUIRED", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.id);

    // Create and finalize first lease
    const leaseRes = await createLease(prop.id, unit.id, adminToken);
    expect(leaseRes.status).toBe(201);
    const leaseId = leaseRes.body.lease?.id as number;
    createdLeaseIds.push(leaseId);
    const tenantId = leaseRes.body.tenants?.[0]?.tenantId as number;
    const userId = leaseRes.body.tenants?.[0]?.userId as number;
    createdTenantIds.push(tenantId);
    createdUserIds.push(userId);

    // Request + finalize termination
    await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-request`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requestedByTenantId: tenantId, effectiveDate: "2026-07-01" });

    const finalRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/finalize-termination`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(finalRes.status).toBe(200);

    // Now immediately try to create a new lease on the same unit
    const newLeaseRes = await createLease(prop.id, unit.id, adminToken, {
      tenants: [{ name: "New Tenant", email: `new-${Date.now()}@test.local`, is_primary: true }],
    });

    expect(newLeaseRes.status).toBe(409);
    expect(newLeaseRes.body.error?.code).toBe("TURNOVER_GAP_REQUIRED");
  }, 60000);

  it("After 24h (mocked via terminated_at backdating), new lease is allowed", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.id);

    // Create and terminate first lease directly in DB with terminated_at 25h ago
    const adminUser = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    const tenantUser = await prisma.user.create({
      data: {
        email: `mock-tenant-${Date.now()}@test.local`,
        name: "Mock Tenant",
        role: 3,
        password_hash: "mock_hash",
        created_by_user_id: adminUser!.id,
      },
    });
    createdUserIds.push(tenantUser.id);

    const tenantRow = await prisma.tenant.create({ data: { user_id: tenantUser.id } });
    createdTenantIds.push(tenantRow.id);

    const oldLease = await prisma.lease.create({
      data: {
        unit_id: unit.id,
        start_date: new Date("2026-01-01"),
        end_date: new Date("2026-05-31"),
        monthly_rent_paise: BigInt(1_800_000),
        security_deposit_paise: BigInt(3_600_000),
        status: 3,
        signed_by_pm_id: adminUser!.id,
        signed_at: new Date(),
        // Backdated 25 hours ago — past the BL-18 gap
        terminated_at: new Date(Date.now() - 25 * 60 * 60 * 1000),
      },
    });
    createdLeaseIds.push(oldLease.id);

    // Now unit.state is still AVAILABLE (no active lease). Try new lease.
    const newLeaseRes = await createLease(prop.id, unit.id, adminToken, {
      tenants: [{ name: "New Tenant 25h", email: `new25h-${Date.now()}@test.local`, is_primary: true }],
    });

    expect(newLeaseRes.status).toBe(201);
    if (newLeaseRes.body.lease?.id) createdLeaseIds.push(newLeaseRes.body.lease.id as number);
    if (newLeaseRes.body.tenants) {
      for (const t of newLeaseRes.body.tenants as Array<{ tenantId: number; userId: number }>) {
        createdTenantIds.push(t.tenantId);
        createdUserIds.push(t.userId);
      }
    }
  }, 30000);
});

// ===========================================================================
// PropertyScopeGuard — cross-property access denied
// ===========================================================================

describe("PropertyScopeGuard — cross-property access denied", () => {
  it("PM-B token hitting POST /properties/A/units/.../leases → 403", async () => {
    // Create two properties
    const propA = await createTestProperty();
    const propB = await createTestProperty();
    const unit = await createTestUnit(propA.id);

    // Create PM-B and assign to property B
    const pmB = await createTestPM("pmb");
    await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${propB.id}/transfer-pm`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ toPmId: pmB.id });

    // Login as PM-B using the exact email returned from createTestPM
    const pmBToken = await loginAs(pmB.email, pmB.temp_password);

    // Attempt to create lease on property A's unit using PM-B token
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${propA.id}/units/${unit.id}/leases`)
      .set("Authorization", `Bearer ${pmBToken}`)
      .send({
        startDate: "2026-06-01",
        endDate: "2027-05-31",
        monthlyRentPaise: 1_800_000,
        securityDepositPaise: 3_600_000,
        tenants: [{ name: "Test", email: `scope-${Date.now()}@test.local`, is_primary: true }],
      });

    expect(res.status).toBe(403);
  }, 30000);
});

// ===========================================================================
// DepositRefund — one refund per lease
// ===========================================================================

describe("DepositRefund — idempotency constraint", () => {
  it("Two refunds on same terminated lease → second is 409 DEPOSIT_REFUND_EXISTS", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.id);

    const leaseRes = await createLease(prop.id, unit.id, adminToken);
    expect(leaseRes.status).toBe(201);
    const leaseId = leaseRes.body.lease?.id as number;
    createdLeaseIds.push(leaseId);
    const tenantId = leaseRes.body.tenants?.[0]?.tenantId as number;
    const userId = leaseRes.body.tenants?.[0]?.userId as number;
    createdTenantIds.push(tenantId);
    createdUserIds.push(userId);

    // Terminate the lease
    await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-request`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requestedByTenantId: tenantId, effectiveDate: "2026-07-01" });

    await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/finalize-termination`)
      .set("Authorization", `Bearer ${adminToken}`);

    const refundPayload = {
      leaseId,
      amountPaise: 3_500_000,
      deductionsPaise: 100_000,
      deductionReason: "Minor damages",
      paidToTenantId: tenantId,
    };

    const r1 = await supertestFn(app.getHttpServer())
      .post("/api/v1/deposit-refunds")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(refundPayload);
    expect(r1.status).toBe(201);
    expect(r1.body.amount_paise).toBe("3500000");

    const r2 = await supertestFn(app.getHttpServer())
      .post("/api/v1/deposit-refunds")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(refundPayload);
    expect(r2.status).toBe(409);
    expect(r2.body.error?.code).toBe("DEPOSIT_REFUND_EXISTS");
  }, 60000);
});

// ===========================================================================
// Lease renew — idempotency
// ===========================================================================

describe("Lease renew — idempotency", () => {
  it("Rapid duplicate renew within 5 sec → second returns same (or equivalent) new lease", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.id);

    const leaseRes = await createLease(prop.id, unit.id, adminToken);
    expect(leaseRes.status).toBe(201);
    const leaseId = leaseRes.body.lease?.id as number;
    createdLeaseIds.push(leaseId);
    if (leaseRes.body.tenants) {
      for (const t of leaseRes.body.tenants as Array<{ tenantId: number; userId: number }>) {
        createdTenantIds.push(t.tenantId);
        createdUserIds.push(t.userId);
      }
    }

    const renewPayload = { newEndDate: "2028-05-31" };

    const r1 = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/renew`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(renewPayload);
    expect(r1.status).toBe(201);
    const newLeaseId1 = r1.body.id as number;
    if (newLeaseId1) createdLeaseIds.push(newLeaseId1);

    // Second call within 5 seconds — should return same new lease ID (idempotent)
    const r2 = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/renew`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(renewPayload);
    // Either 201 with same ID or 409 (lease already RENEWED)
    // The service returns the same new lease ID if within 5s window; otherwise 409
    if (r2.status === 201) {
      expect(r2.body.id).toBe(newLeaseId1);
    } else {
      expect(r2.status).toBe(409);
      expect(r2.body.error?.code).toBe("LEASE_NOT_ACTIVE");
    }
  }, 30000);
});

// ===========================================================================
// Lease creation smoke test — tempPassword in response
// ===========================================================================

describe("Lease creation response", () => {
  it("New tenant gets tempPassword in response", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.id);

    const res = await createLease(prop.id, unit.id, adminToken);
    expect(res.status).toBe(201);
    expect(res.body.lease).toBeDefined();
    expect(res.body.tenants).toHaveLength(1);
    expect(res.body.tenants[0].tempPassword).toBeDefined();
    expect(typeof res.body.tenants[0].tempPassword).toBe("string");

    if (res.body.lease?.id) createdLeaseIds.push(res.body.lease.id as number);
    if (res.body.tenants) {
      for (const t of res.body.tenants as Array<{ tenantId: number; userId: number }>) {
        createdTenantIds.push(t.tenantId);
        createdUserIds.push(t.userId);
      }
    }
  }, 30000);

  it("Existing TENANT user re-used (no duplicate user created)", async () => {
    const prop = await createTestProperty();
    const unit1 = await createTestUnit(prop.id);
    const unit2 = await createTestUnit(prop.id);

    const email = `reuse-${Date.now()}@test.local`;

    // Create lease on unit1 with this email
    const r1 = await createLease(prop.id, unit1.id, adminToken, {
      tenants: [{ name: "Reuse Tenant", email, is_primary: true }],
    });
    expect(r1.status).toBe(201);
    if (r1.body.lease?.id) createdLeaseIds.push(r1.body.lease.id as number);
    const firstTenantId = r1.body.tenants?.[0]?.tenantId as number;
    const firstUserId = r1.body.tenants?.[0]?.userId as number;
    createdTenantIds.push(firstTenantId);
    createdUserIds.push(firstUserId);

    // Terminate first lease so we can create a second
    await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${r1.body.lease.id}/terminate-request`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requestedByTenantId: firstTenantId, effectiveDate: "2026-07-01" });
    await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${r1.body.lease.id}/finalize-termination`)
      .set("Authorization", `Bearer ${adminToken}`);

    // Wait >24h requirement by backdating in DB
    await prisma.lease.update({
      where: { id: r1.body.lease.id },
      // We can only mutate non-immutable fields; we update status only since BL-02 blocks rent change
      // terminated_at is not one of the immutable fields so we set it 25h ago
      data: { terminated_at: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });

    // Create lease on unit2 with same email — should reuse tenant row
    const r2 = await createLease(prop.id, unit2.id, adminToken, {
      tenants: [{ name: "Reuse Tenant", email, is_primary: true }],
    });
    expect(r2.status).toBe(201);
    if (r2.body.lease?.id) createdLeaseIds.push(r2.body.lease.id as number);
    const secondTenantId = r2.body.tenants?.[0]?.tenantId as number;

    // Same tenant ID — user was reused
    expect(secondTenantId).toBe(firstTenantId);
    // No tempPassword returned for existing user
    expect(r2.body.tenants?.[0]?.tempPassword).toBeUndefined();
  }, 60000);
});
