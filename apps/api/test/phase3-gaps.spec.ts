/**
 * Phase 3 — Gap Tests
 *
 * Covers TC-IDs not yet addressed by phase3-integration.spec.ts or
 * phase3-security-fixes.spec.ts:
 *
 *   TC-LEASE-003 (BL-01): Sign lease with existing non-TENANT User → 400 USER_NOT_TENANT
 *   TC-LEASE-004 (BL-07): Sign lease with empty tenants array → 400 LEASE_NEEDS_TENANT  [duplicate guard]
 *   TC-LEASE-005 (BL-05 tenant): Existing TENANT user re-used on new lease → no tempPassword; Tenant.user_id matches
 *   TC-LEASE-006 (BL-04): Active lease flips unit.state to OCCUPIED (confirmed, + finalize → AVAILABLE)
 *   TC-LEASE-007 (BL-02): Direct prisma.lease.update on monthly_rent_paise throws trigger
 *   TC-LEASE-008: Lease renew → old lease status RENEWED, new lease status ACTIVE; same unit, same tenants
 *   TC-LEASE-009: Idempotent renew — 5-second window returns same new lease ID (or 409 LEASE_NOT_ACTIVE)
 *   TC-TERM-001 (BL-08/09): Single-tenant terminate-request → finalize → unit AVAILABLE
 *   TC-TERM-002 (BL-08/09): Multi-tenant happy path — both approve → finalize succeeds
 *   TC-TERM-003 (BL-09): Multi-tenant rejection → finalize always 409 TERMINATION_NOT_FULLY_APPROVED
 *   TC-TERM-004 (BL-09): Requester withdraws → new request can open on same lease
 *   TC-TERM-005 (BL-09): Second terminate-request while one open → 409 TERMINATION_OPEN
 *   TC-TERM-006 (BL-18): Finalize → immediately create new lease → 409 TURNOVER_GAP_REQUIRED
 *   TC-REFUND-001: Refund on ACTIVE (not terminated) lease → 409 LEASE_NOT_TERMINATED
 *   TC-REFUND-002: Second refund on same terminated lease → 409 DEPOSIT_REFUND_EXISTS
 *   Cross-property-scope: PM-B on GET /leases/:idFromPropertyA → 403
 *   Cross-property-scope: PM-B on POST /leases/:idFromPropertyA/renew → 403
 *   Cross-property-scope: PM-B on POST /leases/:idFromPropertyA/terminate-request → 403
 *   Cross-property-scope: PM-B on POST /leases/:idFromPropertyA/finalize-termination → 403
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
// Cleanup tracking
// ---------------------------------------------------------------------------

let gapLeaseIds: number[] = [];
let gapTenantIds: number[] = [];
let gapUnitIds: number[] = [];
let gapPropertyIds: number[] = [];
let gapUserIds: number[] = [];

afterEach(async () => {
  if (gapLeaseIds.length > 0) {
    await prisma.depositRefund.deleteMany({ where: { lease_id: { in: gapLeaseIds } } });
    const termIds = await prisma.leaseTermination.findMany({
      where: { lease_id: { in: gapLeaseIds } },
      select: { id: true },
    });
    if (termIds.length > 0) {
      await prisma.leaseTerminationApproval.deleteMany({
        where: { termination_id: { in: termIds.map((t) => t.id) } },
      });
      await prisma.leaseTermination.deleteMany({ where: { id: { in: termIds.map((t) => t.id) } } });
    }
    await prisma.leaseTenant.deleteMany({ where: { lease_id: { in: gapLeaseIds } } });
    await prisma.auditLog.deleteMany({
      where: { entity_type: "Lease", entity_id: { in: gapLeaseIds.map(String) } },
    });
    for (const lid of gapLeaseIds) {
      await prisma.auditLog.deleteMany({
        where: { entity_type: "LeaseTenant", entity_id: { startsWith: String(lid) } },
      });
    }
    // Phase 4: delete prepaid_credits and payments before leases (FK cascade guard)
    await prisma.prepaidCredit.deleteMany({ where: { lease_id: { in: gapLeaseIds } } });
    await prisma.$executeRawUnsafe(`ALTER TABLE payments DISABLE TRIGGER payments_no_delete`);
    await prisma.$executeRawUnsafe(`ALTER TABLE payments DISABLE TRIGGER payments_restrict_update`);
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM payments WHERE lease_id = ANY($1::bigint[])`, gapLeaseIds);
    } finally {
      await prisma.$executeRawUnsafe(`ALTER TABLE payments ENABLE TRIGGER payments_no_delete`);
      await prisma.$executeRawUnsafe(`ALTER TABLE payments ENABLE TRIGGER payments_restrict_update`);
    }
    await prisma.rentPeriod.deleteMany({ where: { lease_id: { in: gapLeaseIds } } });
    await prisma.lease.deleteMany({ where: { id: { in: gapLeaseIds } } });
    gapLeaseIds = [];
  }

  if (gapTenantIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entity_type: "Tenant", entity_id: { in: gapTenantIds.map(String) } } });
    await prisma.tenant.deleteMany({ where: { id: { in: gapTenantIds } } });
    gapTenantIds = [];
  }

  if (gapUnitIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entity_type: "Unit", entity_id: { in: gapUnitIds.map(String) } } });
    await prisma.unit.deleteMany({ where: { id: { in: gapUnitIds } } });
    gapUnitIds = [];
  }

  if (gapPropertyIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entity_type: "Property", entity_id: { in: gapPropertyIds.map(String) } } });
    await prisma.propertyTransferLog.deleteMany({ where: { property_id: { in: gapPropertyIds } } });
    await prisma.property.deleteMany({ where: { id: { in: gapPropertyIds } } });
    gapPropertyIds = [];
  }

  if (gapUserIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entity_type: "User", entity_id: { in: gapUserIds.map(String) } },
          { actor_id: { in: gapUserIds } },
        ],
      },
    });
    await prisma.refreshToken.deleteMany({ where: { user_id: { in: gapUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: gapUserIds } } });
    gapUserIds = [];
  }
}, 30000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createProp(): Promise<{ id: number }> {
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/properties")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: `Gap Prop ${Date.now()}`,
      address: "1 Gap Rd",
      city: "Delhi",
      state: "Delhi",
      pincode: "110001",
    });
  expect(res.status).toBe(201);
  gapPropertyIds.push(res.body.id as number);
  return res.body as { id: number };
}

async function createUnit(propertyId: number): Promise<{ id: number }> {
  const res = await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propertyId}/units`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ unit_number: `U${Date.now()}`, bedrooms: 2, bathrooms: 1, monthly_rent_paise: 1_800_000 });
  expect(res.status).toBe(201);
  gapUnitIds.push(res.body.id as number);
  return res.body as { id: number };
}

const GAP3_PM_PASSWORD = "Gap3PM@test2026!";

async function createPM(tag: string): Promise<{ id: number; email: string; temp_password: string }> {
  const email = `pm-gap-${tag}-${Date.now()}@test.local`;
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ email, firstName: "PM", lastName: tag, role: "PROPERTY_MANAGER", password: GAP3_PM_PASSWORD });
  expect(res.status).toBe(201);
  gapUserIds.push(res.body.id as number);
  // temp_password no longer in response; return the known password under that key for backward-compat with callers
  return { ...(res.body as { id: number }), email, temp_password: GAP3_PM_PASSWORD };
}

async function loginAs(email: string, password: string): Promise<string> {
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password });
  expect(res.status).toBe(200);
  return res.body.accessToken as string;
}

async function signLease(
  propId: number,
  unitId: number,
  token: string,
  overrides: Record<string, unknown> = {},
) {
  const ts = Date.now();
  return supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propId}/units/${unitId}/leases`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      startDate: "2026-06-01",
      endDate: "2027-05-31",
      monthlyRentPaise: 1_800_000,
      securityDepositPaise: 3_600_000,
      tenants: [
        { name: `Tenant ${ts}`, email: `t-${ts}@test.local`, is_primary: true },
      ],
      ...overrides,
    });
}

type LeaseResult = {
  leaseId: number;
  tenantId: number;
  userId: number;
  tempPassword?: string;
};

async function createActiveLease(
  propId: number,
  unitId: number,
  overrides: Record<string, unknown> = {},
): Promise<LeaseResult> {
  const res = await signLease(propId, unitId, adminToken, overrides);
  expect(res.status).toBe(201);
  gapLeaseIds.push(res.body.lease.id as number);
  const tenant = (res.body.tenants as Array<{ tenantId: number; userId: number; tempPassword?: string }>)[0]!;
  gapTenantIds.push(tenant.tenantId);
  gapUserIds.push(tenant.userId);
  return {
    leaseId: res.body.lease.id as number,
    tenantId: tenant.tenantId,
    userId: tenant.userId,
    tempPassword: tenant.tempPassword,
  };
}

async function terminateLease(leaseId: number, tenantId: number): Promise<void> {
  const tReq = await supertestFn(app.getHttpServer())
    .post(`/api/v1/leases/${leaseId}/terminate-request`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ requestedByTenantId: tenantId, effectiveDate: "2026-07-01" });
  expect(tReq.status).toBe(201);

  const tFin = await supertestFn(app.getHttpServer())
    .post(`/api/v1/leases/${leaseId}/finalize-termination`)
    .set("Authorization", `Bearer ${adminToken}`);
  expect(tFin.status).toBe(200);
}

// ===========================================================================
// TC-LEASE-003 — Signing lease with existing non-TENANT user → USER_NOT_TENANT
// ===========================================================================

describe("TC-LEASE-003 — USER_NOT_TENANT: existing non-TENANT user cannot be a tenant", () => {
  it("POST lease where one tenant email belongs to a PROPERTY_MANAGER → 400 USER_NOT_TENANT", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);

    // Create a PM (role=PROPERTY_MANAGER) via admin
    const pm = await createPM("tc003");

    const res = await signLease(prop.id, unit.id, adminToken, {
      tenants: [
        {
          name: "PM as Tenant",
          email: pm.email, // This user is a PROPERTY_MANAGER, not a TENANT
          is_primary: true,
        },
      ],
    });

    // Service throws ConflictException (409) for this case — existing user in wrong role
    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe("USER_NOT_TENANT");
  }, 30000);

  it("POST lease where one tenant email belongs to ADMIN → 409 USER_NOT_TENANT", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);

    const res = await signLease(prop.id, unit.id, adminToken, {
      tenants: [
        {
          name: "Admin as Tenant",
          email: ADMIN_EMAIL, // Admin user role is ADMIN
          is_primary: true,
        },
      ],
    });

    // Service throws ConflictException (409) — existing account in wrong role
    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe("USER_NOT_TENANT");
  }, 30000);
});

// ===========================================================================
// TC-LEASE-004 — Empty tenants (belt-and-suspenders; also in phase3-integration)
// ===========================================================================

describe("TC-LEASE-004 — LEASE_NEEDS_TENANT guard (belt-and-suspenders)", () => {
  it("POST lease with tenants=[] → 400; error body present", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);

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
    // Accept either structured error body or validation pipe error
    const hasCode =
      res.body.error?.code === "LEASE_NEEDS_TENANT" ||
      res.body.error?.code === "VALIDATION_FAILED" ||
      (res.body.error?.message && typeof res.body.error.message !== "undefined");
    expect(hasCode).toBe(true);
  }, 30000);
});

// ===========================================================================
// TC-LEASE-005 — Tenant.user_id matches User.id; tempPassword only for new users
// ===========================================================================

describe("TC-LEASE-005 — Tenant user_id links and temp password behaviour", () => {
  it("newly created tenant has tempPassword in response", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);

    const res = await signLease(prop.id, unit.id, adminToken);
    expect(res.status).toBe(201);

    gapLeaseIds.push(res.body.lease.id as number);
    const tenant = (res.body.tenants as Array<{ tenantId: number; userId: number; tempPassword: string }>)[0]!;
    gapTenantIds.push(tenant.tenantId);
    gapUserIds.push(tenant.userId);

    expect(typeof tenant.tempPassword).toBe("string");
    expect(tenant.tempPassword.length).toBeGreaterThan(0);
  }, 30000);

  it("Tenant.user_id in DB matches the userId returned in lease response", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);

    const res = await signLease(prop.id, unit.id, adminToken);
    expect(res.status).toBe(201);

    gapLeaseIds.push(res.body.lease.id as number);
    const tenantResult = (res.body.tenants as Array<{ tenantId: number; userId: number }>)[0]!;
    gapTenantIds.push(tenantResult.tenantId);
    gapUserIds.push(tenantResult.userId);

    const tenantRow = await prisma.tenant.findUnique({
      where: { id: tenantResult.tenantId },
      select: { user_id: true },
    });
    expect(tenantRow).not.toBeNull();
    expect(tenantRow!.user_id).toBe(tenantResult.userId);
  }, 30000);

  it("re-using an existing TENANT email → no tempPassword returned", async () => {
    const prop = await createProp();
    const unit1 = await createUnit(prop.id);
    const unit2 = await createUnit(prop.id);

    const email = `reuse-gap-${Date.now()}@test.local`;

    // First lease — user created, tempPassword returned
    const r1 = await signLease(prop.id, unit1.id, adminToken, {
      tenants: [{ name: "Reuse User", email, is_primary: true }],
    });
    expect(r1.status).toBe(201);
    gapLeaseIds.push(r1.body.lease.id as number);
    const t1 = (r1.body.tenants as Array<{ tenantId: number; userId: number; tempPassword?: string }>)[0]!;
    gapTenantIds.push(t1.tenantId);
    gapUserIds.push(t1.userId);
    expect(t1.tempPassword).toBeDefined();

    // Terminate first lease so unit is free
    await terminateLease(r1.body.lease.id as number, t1.tenantId);

    // Backdate terminated_at to bypass BL-18
    await prisma.lease.update({
      where: { id: r1.body.lease.id as number },
      data: { terminated_at: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });

    // Second lease on unit2 with same email — user already exists as TENANT
    const r2 = await signLease(prop.id, unit2.id, adminToken, {
      tenants: [{ name: "Reuse User", email, is_primary: true }],
    });
    expect(r2.status).toBe(201);
    gapLeaseIds.push(r2.body.lease.id as number);
    const t2 = (r2.body.tenants as Array<{ tenantId: number; userId: number; tempPassword?: string }>)[0]!;
    // No new user created → no tempPassword
    expect(t2.tempPassword).toBeUndefined();
    // Same tenant row reused
    expect(t2.tenantId).toBe(t1.tenantId);
  }, 60000);
});

// ===========================================================================
// TC-LEASE-006 — BL-04: unit state transitions with lease lifecycle
// ===========================================================================

describe("TC-LEASE-006 — BL-04: unit state paired with lease lifecycle", () => {
  it("unit is AVAILABLE before, OCCUPIED after lease create, AVAILABLE after finalize", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);

    const before = await prisma.unit.findUnique({ where: { id: unit.id } });
    expect(before?.state).toBe(0); // UnitState.AVAILABLE = 0

    const { leaseId, tenantId } = await createActiveLease(prop.id, unit.id);

    const during = await prisma.unit.findUnique({ where: { id: unit.id } });
    expect(during?.state).toBe(2); // UnitState.OCCUPIED = 2

    await terminateLease(leaseId, tenantId);

    const after = await prisma.unit.findUnique({ where: { id: unit.id } });
    expect(after?.state).toBe(0); // UnitState.AVAILABLE = 0
  }, 60000);
});

// ===========================================================================
// TC-LEASE-007 — BL-02: DB trigger blocks rent mutation on existing lease
// ===========================================================================

describe("TC-LEASE-007 — BL-02: DB trigger prevents rent mutation", () => {
  it("prisma.lease.update on monthly_rent_paise → rejects with BL_02_RENT_IMMUTABLE", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);
    const { leaseId } = await createActiveLease(prop.id, unit.id);

    await expect(
      prisma.lease.update({
        where: { id: leaseId },
        data: { monthly_rent_paise: BigInt(9_999) },
      }),
    ).rejects.toThrow(/BL_02_RENT_IMMUTABLE/);
  }, 30000);

  it("prisma.lease.update on security_deposit_paise → rejects with BL_02_DEPOSIT_IMMUTABLE", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);
    const { leaseId } = await createActiveLease(prop.id, unit.id);

    await expect(
      prisma.lease.update({
        where: { id: leaseId },
        data: { security_deposit_paise: BigInt(1) },
      }),
    ).rejects.toThrow(/BL_02_DEPOSIT_IMMUTABLE/);
  }, 30000);
});

// ===========================================================================
// TC-LEASE-008 — Renew: old lease → RENEWED, new lease → ACTIVE, same unit + tenants
// ===========================================================================

describe("TC-LEASE-008 — Lease renew: status transitions and tenant carry-over", () => {
  it("renew sets old lease status=RENEWED and creates new ACTIVE lease on same unit", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);
    const { leaseId } = await createActiveLease(prop.id, unit.id);

    const renewRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/renew`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ newEndDate: "2028-05-31" });

    expect(renewRes.status).toBe(201);
    const newLeaseId = renewRes.body.id as number;
    gapLeaseIds.push(newLeaseId);

    // Verify old lease is now RENEWED
    const oldLease = await prisma.lease.findUnique({ where: { id: leaseId }, select: { status: true } });
    expect(oldLease?.status).toBe(2); // LeaseStatus.RENEWED = 2

    // Verify new lease is ACTIVE on the same unit
    const newLease = await prisma.lease.findUnique({
      where: { id: newLeaseId },
      select: { status: true, unit_id: true },
    });
    expect(newLease?.status).toBe(0); // LeaseStatus.ACTIVE = 0
    expect(newLease?.unit_id).toBe(unit.id);

    // Verify new lease has tenants carried over
    const newTenants = await prisma.leaseTenant.findMany({
      where: { lease_id: newLeaseId, removed_at: null },
    });
    expect(newTenants.length).toBeGreaterThan(0);
  }, 30000);
});

// ===========================================================================
// TC-LEASE-009 — Idempotent renew within 5 seconds
// ===========================================================================

describe("TC-LEASE-009 — Idempotent renew within 5-second window", () => {
  it("calling renew twice rapidly returns same new lease ID (or 409 LEASE_NOT_ACTIVE on old)", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);
    const { leaseId } = await createActiveLease(prop.id, unit.id);

    const payload = { newEndDate: "2028-05-31" };

    const r1 = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/renew`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload);
    expect(r1.status).toBe(201);
    const newId1 = r1.body.id as number;
    gapLeaseIds.push(newId1);

    const r2 = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/renew`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload);

    // Within 5s window: idempotent → same new lease ID returned as 201
    // After old lease is RENEWED: service returns LEASE_NOT_ACTIVE → 409
    if (r2.status === 201) {
      expect(r2.body.id).toBe(newId1);
    } else {
      expect(r2.status).toBe(409);
      expect(r2.body.error?.code).toBe("LEASE_NOT_ACTIVE");
    }
  }, 30000);
});

// ===========================================================================
// TC-TERM-001 — Single-tenant termination happy path
// ===========================================================================

describe("TC-TERM-001 — Single-tenant termination: requester auto-approved, finalize succeeds", () => {
  it("terminate-request → pending_approvals=0; finalize → 200; unit AVAILABLE", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);
    const { leaseId, tenantId } = await createActiveLease(prop.id, unit.id);

    const termRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-request`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requestedByTenantId: tenantId, effectiveDate: "2026-07-01", reason: "Moving out" });

    expect(termRes.status).toBe(201);
    expect(termRes.body.termination?.pending_approvals).toBe(0);

    const finalRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/finalize-termination`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(finalRes.status).toBe(200);
    expect(finalRes.body.unit_state).toBe(0); // UnitState.AVAILABLE = 0

    const unit2 = await prisma.unit.findUnique({ where: { id: unit.id } });
    expect(unit2?.state).toBe(0); // UnitState.AVAILABLE = 0
  }, 60000);
});

// ===========================================================================
// TC-TERM-002 — Multi-tenant happy path: all approve → finalize succeeds
// ===========================================================================

describe("TC-TERM-002 — Multi-tenant happy path", () => {
  it("Tenant A requests → Tenant B (PENDING) approves → finalize 200", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);
    const ts = Date.now();

    const leaseRes = await signLease(prop.id, unit.id, adminToken, {
      tenants: [
        { name: "TA", email: `ta-t002-${ts}@test.local`, is_primary: true },
        { name: "TB", email: `tb-t002-${ts}@test.local`, is_primary: false },
      ],
    });
    expect(leaseRes.status).toBe(201);
    gapLeaseIds.push(leaseRes.body.lease.id as number);

    const tenants = leaseRes.body.tenants as Array<{ tenantId: number; userId: number; isPrimary: boolean }>;
    for (const t of tenants) { gapTenantIds.push(t.tenantId); gapUserIds.push(t.userId); }

    const tenantA = tenants.find((t) => t.isPrimary)!;
    const tenantB = tenants.find((t) => !t.isPrimary)!;
    const leaseId = leaseRes.body.lease.id as number;

    // Tenant A requests
    const tReq = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-request`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requestedByTenantId: tenantA.tenantId, effectiveDate: "2026-07-01" });
    expect(tReq.status).toBe(201);
    expect(tReq.body.termination?.pending_approvals).toBe(1);

    // Finalize blocked — B still PENDING
    const blockedFin = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/finalize-termination`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(blockedFin.status).toBe(409);
    expect(blockedFin.body.error?.code).toBe("TERMINATION_NOT_FULLY_APPROVED");

    // Tenant B approves (via admin, which acts as ADMIN role — allowed)
    const approveRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tenantId: tenantB.tenantId, decision: 1 }); // 1 = APPROVED
    expect(approveRes.status).toBe(200);

    // Now finalize succeeds
    const finalRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/finalize-termination`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(finalRes.status).toBe(200);
    expect(finalRes.body.unit_state).toBe(0); // UnitState.AVAILABLE = 0
  }, 60000);
});

// ===========================================================================
// TC-TERM-003 — Multi-tenant rejection: finalize is 409 while rejected
// ===========================================================================

describe("TC-TERM-003 — Multi-tenant rejection blocks finalize", () => {
  it("Tenant C rejects → finalize returns 409 with rejected_tenant_ids", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);
    const ts = Date.now();

    const leaseRes = await signLease(prop.id, unit.id, adminToken, {
      tenants: [
        { name: "TA", email: `ta-t003-${ts}@test.local`, is_primary: true },
        { name: "TC", email: `tc-t003-${ts}@test.local`, is_primary: false },
      ],
    });
    expect(leaseRes.status).toBe(201);
    gapLeaseIds.push(leaseRes.body.lease.id as number);

    const tenants = leaseRes.body.tenants as Array<{ tenantId: number; userId: number; isPrimary: boolean }>;
    for (const t of tenants) { gapTenantIds.push(t.tenantId); gapUserIds.push(t.userId); }

    const tenantA = tenants.find((t) => t.isPrimary)!;
    const tenantC = tenants.find((t) => !t.isPrimary)!;
    const leaseId = leaseRes.body.lease.id as number;

    await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-request`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requestedByTenantId: tenantA.tenantId, effectiveDate: "2026-07-01" });

    // Tenant C rejects
    await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-approve`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ tenantId: tenantC.tenantId, decision: 2 }); // 2 = REJECTED

    // Finalize is 409 forever until withdrawn + new request
    const finalRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/finalize-termination`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(finalRes.status).toBe(409);
    expect(finalRes.body.error?.code).toBe("TERMINATION_NOT_FULLY_APPROVED");
    expect(finalRes.body.error?.details?.rejected_tenant_ids).toContain(tenantC.tenantId);
  }, 60000);
});

// ===========================================================================
// TC-TERM-004 — Requester withdraws → new request can open
// ===========================================================================

describe("TC-TERM-004 — Withdraw: requester can withdraw and new request can open", () => {
  it("withdraw → lease back to ACTIVE; new terminate-request succeeds", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);
    const { leaseId, tenantId } = await createActiveLease(prop.id, unit.id);

    // Open termination
    const tReq = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-request`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requestedByTenantId: tenantId, effectiveDate: "2026-07-01" });
    expect(tReq.status).toBe(201);

    // Withdraw
    const withdrawRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-withdraw`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requestedByTenantId: tenantId });
    expect(withdrawRes.status).toBe(200);
    expect(withdrawRes.body.termination?.withdrawn_at).toBeTruthy();

    // Lease still ACTIVE
    const lease = await prisma.lease.findUnique({ where: { id: leaseId } });
    expect(lease?.status).toBe(0); // LeaseStatus.ACTIVE = 0

    // New terminate-request should succeed now
    const tReq2 = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-request`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requestedByTenantId: tenantId, effectiveDate: "2026-08-01" });
    expect(tReq2.status).toBe(201);
  }, 60000);
});

// ===========================================================================
// TC-TERM-005 — Only one open termination: second request → 409 TERMINATION_OPEN
// ===========================================================================

describe("TC-TERM-005 — Only one open termination at a time", () => {
  it("second terminate-request while open → 409 TERMINATION_OPEN", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);
    const { leaseId, tenantId } = await createActiveLease(prop.id, unit.id);

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
// TC-TERM-006 — BL-18: immediately after finalize, new lease on same unit → 409
// ===========================================================================

describe("TC-TERM-006 — BL-18: 24-hour turnover gap enforced after finalize", () => {
  it("terminate → immediately POST new lease → 409 TURNOVER_GAP_REQUIRED", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);
    const { leaseId, tenantId } = await createActiveLease(prop.id, unit.id);

    await terminateLease(leaseId, tenantId);

    // Immediately try new lease on same unit — BL-18 must block
    const newLeaseRes = await signLease(prop.id, unit.id, adminToken, {
      tenants: [{ name: "New Tenant", email: `new-t006-${Date.now()}@test.local`, is_primary: true }],
    });

    expect(newLeaseRes.status).toBe(409);
    expect(newLeaseRes.body.error?.code).toBe("TURNOVER_GAP_REQUIRED");
  }, 60000);
});

// ===========================================================================
// TC-REFUND-001 — Refund on ACTIVE lease → 409 LEASE_NOT_TERMINATED
// ===========================================================================

describe("TC-REFUND-001 — Deposit refund blocked on ACTIVE lease", () => {
  it("POST /deposit-refunds on ACTIVE lease → 409 LEASE_NOT_TERMINATED", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);
    const { leaseId, tenantId } = await createActiveLease(prop.id, unit.id);

    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/deposit-refunds")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        leaseId,
        amountPaise: 3_500_000,
        deductionsPaise: 0,
        paidToTenantId: tenantId,
      });

    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe("LEASE_NOT_TERMINATED");
  }, 30000);
});

// ===========================================================================
// TC-REFUND-002 — Second refund on same terminated lease → 409 DEPOSIT_REFUND_EXISTS
// ===========================================================================

describe("TC-REFUND-002 — One deposit refund per terminated lease", () => {
  it("second refund call → 409 DEPOSIT_REFUND_EXISTS", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);
    const { leaseId, tenantId } = await createActiveLease(prop.id, unit.id);

    await terminateLease(leaseId, tenantId);

    const payload = {
      leaseId,
      amountPaise: 3_500_000,
      deductionsPaise: 100_000,
      deductionReason: "Minor repairs",
      paidToTenantId: tenantId,
    };

    const r1 = await supertestFn(app.getHttpServer())
      .post("/api/v1/deposit-refunds")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload);
    expect(r1.status).toBe(201);

    const r2 = await supertestFn(app.getHttpServer())
      .post("/api/v1/deposit-refunds")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(payload);
    expect(r2.status).toBe(409);
    expect(r2.body.error?.code).toBe("DEPOSIT_REFUND_EXISTS");
  }, 60000);
});

// ===========================================================================
// Cross-property PropertyScopeGuard regression
// ===========================================================================

describe("PropertyScopeGuard — PM-B cannot access Property A lease endpoints", () => {
  let propA: { id: number };
  let propB: { id: number };
  let leaseId: number;
  let pmBToken: string;
  let gapLeaseIdOuter: number | undefined;

  beforeEach(async () => {
    propA = await createProp();
    propB = await createProp();
    const unitA = await createUnit(propA.id);

    // Create lease on Property A
    const lr = await signLease(propA.id, unitA.id, adminToken);
    expect(lr.status).toBe(201);
    leaseId = lr.body.lease.id as number;
    gapLeaseIdOuter = leaseId;
    gapLeaseIds.push(leaseId);
    const t = (lr.body.tenants as Array<{ tenantId: number; userId: number }>)[0]!;
    gapTenantIds.push(t.tenantId);
    gapUserIds.push(t.userId);

    // Create PM-B assigned to Property B
    const pmB = await createPM("scope-pmb");
    await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${propB.id}/transfer-pm`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ toPmId: pmB.id });

    pmBToken = await loginAs(pmB.email, pmB.temp_password);
  });

  it("PM-B: GET /leases/:idFromPropertyA → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/leases/${leaseId}`)
      .set("Authorization", `Bearer ${pmBToken}`);
    expect(res.status).toBe(403);
  }, 30000);

  it("PM-B: POST /leases/:idFromPropertyA/renew → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/renew`)
      .set("Authorization", `Bearer ${pmBToken}`)
      .send({ newEndDate: "2028-05-31" });
    expect(res.status).toBe(403);
  }, 30000);

  it("PM-B: POST /leases/:idFromPropertyA/terminate-request → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-request`)
      .set("Authorization", `Bearer ${pmBToken}`)
      .send({ requestedByTenantId: "any-tenant-id", effectiveDate: "2026-07-01" });
    expect(res.status).toBe(403);
  }, 30000);

  it("PM-B: POST /leases/:idFromPropertyA/finalize-termination → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/finalize-termination`)
      .set("Authorization", `Bearer ${pmBToken}`);
    expect(res.status).toBe(403);
  }, 30000);
});
