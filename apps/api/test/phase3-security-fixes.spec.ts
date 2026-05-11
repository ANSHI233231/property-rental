/**
 * Phase 3 Security Fixes — Lock-in Tests
 *
 * H-01: Tenant impersonation blocked on termination endpoints.
 *   - A TENANT can only act on their own behalf (requestedByTenantId / tenantId must
 *     match the calling user's Tenant.id derived from JWT sub → User.id → Tenant.user_id).
 *   - PROPERTY_MANAGER is excluded from terminate-approve entirely.
 *
 * H-02: Deposit-refund scoped to PM's property via @PropertyScopeBody('leaseId').
 *   - A PM assigned to Property A cannot process a refund for a lease on Property B.
 *   - A PM on their own property's terminated lease → 201.
 *   - ADMIN on any property's terminated lease → 201.
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

let cleanLeaseIds: string[] = [];
let cleanTenantIds: string[] = [];
let cleanUnitIds: string[] = [];
let cleanPropertyIds: string[] = [];
let cleanUserIds: string[] = [];

afterEach(async () => {
  // Deposit refunds
  if (cleanLeaseIds.length > 0) {
    await prisma.depositRefund.deleteMany({ where: { lease_id: { in: cleanLeaseIds } } });
    const termIds = await prisma.leaseTermination.findMany({
      where: { lease_id: { in: cleanLeaseIds } },
      select: { id: true },
    });
    if (termIds.length > 0) {
      await prisma.leaseTerminationApproval.deleteMany({
        where: { termination_id: { in: termIds.map((t) => t.id) } },
      });
      await prisma.leaseTermination.deleteMany({ where: { id: { in: termIds.map((t) => t.id) } } });
    }
    await prisma.leaseTenant.deleteMany({ where: { lease_id: { in: cleanLeaseIds } } });
    await prisma.auditLog.deleteMany({
      where: { entity_type: "Lease", entity_id: { in: cleanLeaseIds } },
    });
    for (const lid of cleanLeaseIds) {
      await prisma.auditLog.deleteMany({
        where: { entity_type: "LeaseTenant", entity_id: { startsWith: lid } },
      });
    }
    await prisma.lease.deleteMany({ where: { id: { in: cleanLeaseIds } } });
    cleanLeaseIds = [];
  }

  if (cleanTenantIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entity_type: "Tenant", entity_id: { in: cleanTenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: cleanTenantIds } } });
    cleanTenantIds = [];
  }

  if (cleanUnitIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entity_type: "Unit", entity_id: { in: cleanUnitIds } } });
    await prisma.unit.deleteMany({ where: { id: { in: cleanUnitIds } } });
    cleanUnitIds = [];
  }

  if (cleanPropertyIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entity_type: "Property", entity_id: { in: cleanPropertyIds } } });
    await prisma.propertyTransferLog.deleteMany({ where: { property_id: { in: cleanPropertyIds } } });
    await prisma.property.deleteMany({ where: { id: { in: cleanPropertyIds } } });
    cleanPropertyIds = [];
  }

  if (cleanUserIds.length > 0) {
    // Delete all audit logs that reference these users either as entity or as actor
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { entity_type: "User", entity_id: { in: cleanUserIds } },
          { actor_id: { in: cleanUserIds } },
        ],
      },
    });
    await prisma.refreshToken.deleteMany({ where: { user_id: { in: cleanUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: cleanUserIds } } });
    cleanUserIds = [];
  }
}, 30000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createProp(): Promise<{ id: string }> {
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/properties")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: `SecFix Prop ${Date.now()}`,
      address: "1 Test Rd",
      city: "Delhi",
      state: "Delhi",
      pincode: "110001",
    });
  expect(res.status).toBe(201);
  cleanPropertyIds.push(res.body.id as string);
  return res.body as { id: string };
}

async function createUnit(propertyId: string): Promise<{ id: string }> {
  const res = await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propertyId}/units`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ unit_number: `U${Date.now()}`, bedrooms: 2, bathrooms: 1, monthly_rent_paise: 1_800_000 });
  expect(res.status).toBe(201);
  cleanUnitIds.push(res.body.id as string);
  return res.body as { id: string };
}

async function createPM(tag: string): Promise<{ id: string; email: string; temp_password: string }> {
  const email = `pm-secfix-${tag}-${Date.now()}@test.local`;
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ email, name: `PM ${tag}`, role: "PROPERTY_MANAGER" });
  expect(res.status).toBe(201);
  cleanUserIds.push(res.body.id as string);
  return { ...res.body as { id: string; temp_password: string }, email };
}

async function loginAs(email: string, password: string): Promise<string> {
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password });
  expect(res.status).toBe(200);
  return res.body.accessToken as string;
}

/** Create a 2-tenant lease; returns lease + typed tenant array. */
async function createMultiTenantLease(
  propId: string,
  unitId: string,
  token: string,
): Promise<{
  leaseId: string;
  tenantA: { tenantId: string; userId: string; tempPassword: string };
  tenantB: { tenantId: string; userId: string; tempPassword: string };
}> {
  const ts = Date.now();
  const res = await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propId}/units/${unitId}/leases`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      startDate: "2026-06-01",
      endDate: "2027-05-31",
      monthlyRentPaise: 1_800_000,
      securityDepositPaise: 3_600_000,
      tenants: [
        { name: "Tenant A", email: `ta-secfix-${ts}@test.local`, is_primary: true },
        { name: "Tenant B", email: `tb-secfix-${ts}@test.local`, is_primary: false },
      ],
    });
  expect(res.status).toBe(201);

  const leaseId = res.body.lease.id as string;
  cleanLeaseIds.push(leaseId);

  const tenants = res.body.tenants as Array<{ tenantId: string; userId: string; isPrimary: boolean; tempPassword: string }>;
  for (const t of tenants) {
    cleanTenantIds.push(t.tenantId);
    cleanUserIds.push(t.userId);
  }

  const tA = tenants.find((t) => t.isPrimary)!;
  const tB = tenants.find((t) => !t.isPrimary)!;

  return {
    leaseId,
    tenantA: { tenantId: tA.tenantId, userId: tA.userId, tempPassword: tA.tempPassword },
    tenantB: { tenantId: tB.tenantId, userId: tB.userId, tempPassword: tB.tempPassword },
  };
}

/** Create a single-tenant lease, terminate it, and return everything needed for deposit refund tests. */
async function createTerminatedLease(propId: string, unitId: string): Promise<{ leaseId: string; tenantId: string }> {
  const ts = Date.now();
  const res = await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propId}/units/${unitId}/leases`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      startDate: "2026-06-01",
      endDate: "2027-05-31",
      monthlyRentPaise: 1_800_000,
      securityDepositPaise: 3_600_000,
      tenants: [{ name: "Tenant", email: `t-refund-${ts}@test.local`, is_primary: true }],
    });
  expect(res.status).toBe(201);

  const leaseId = res.body.lease.id as string;
  cleanLeaseIds.push(leaseId);

  const tenants = res.body.tenants as Array<{ tenantId: string; userId: string }>;
  for (const t of tenants) {
    cleanTenantIds.push(t.tenantId);
    cleanUserIds.push(t.userId);
  }

  const tenantId = tenants[0]!.tenantId;

  // Request + finalize termination
  const tReq = await supertestFn(app.getHttpServer())
    .post(`/api/v1/leases/${leaseId}/terminate-request`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ requestedByTenantId: tenantId, effectiveDate: "2026-07-01" });
  expect(tReq.status).toBe(201);

  const tFin = await supertestFn(app.getHttpServer())
    .post(`/api/v1/leases/${leaseId}/finalize-termination`)
    .set("Authorization", `Bearer ${adminToken}`);
  expect(tFin.status).toBe(200);

  return { leaseId, tenantId };
}

// ===========================================================================
// H-01 — Tenant impersonation on termination endpoints
// ===========================================================================

describe("H-01 — Tenant cannot impersonate another tenant on termination endpoints", () => {
  it("Tenant A token + body tenantId=B → terminate-approve returns 403", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);
    const { leaseId, tenantA, tenantB } = await createMultiTenantLease(prop.id, unit.id, adminToken);

    // Tenant A requests termination (using admin token to set up the scenario)
    const tReq = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-request`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requestedByTenantId: tenantA.tenantId, effectiveDate: "2026-07-01" });
    expect(tReq.status).toBe(201);

    // Login as Tenant A
    const tokenA = await loginAs(`ta-secfix-${Object.values(tenantA).join("")}`.split("@")[0] + "@test.local", tenantA.tempPassword)
      .catch(async () => {
        // find email by userId
        const user = await prisma.user.findUnique({ where: { id: tenantA.userId }, select: { email: true } });
        return loginAs(user!.email, tenantA.tempPassword);
      });

    // Tenant A tries to approve on behalf of Tenant B → 403
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-approve`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ tenantId: tenantB.tenantId, decision: "APPROVED" });

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe("FORBIDDEN_TENANT_ACTION");
  }, 60000);

  it("Tenant A token + body requestedByTenantId=B → terminate-request returns 403", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);
    const { leaseId, tenantA, tenantB } = await createMultiTenantLease(prop.id, unit.id, adminToken);

    const userA = await prisma.user.findUnique({ where: { id: tenantA.userId }, select: { email: true } });
    const tokenA = await loginAs(userA!.email, tenantA.tempPassword);

    // Tenant A tries to request termination on behalf of Tenant B → 403
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-request`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ requestedByTenantId: tenantB.tenantId, effectiveDate: "2026-07-01" });

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe("FORBIDDEN_TENANT_ACTION");
  }, 60000);

  it("Tenant A token + requestedByTenantId=B → terminate-withdraw returns 403 (B was requester)", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);
    const { leaseId, tenantA, tenantB } = await createMultiTenantLease(prop.id, unit.id, adminToken);

    // Tenant B requests termination (using admin token)
    const tReq = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-request`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requestedByTenantId: tenantB.tenantId, effectiveDate: "2026-07-01" });
    expect(tReq.status).toBe(201);

    const userA = await prisma.user.findUnique({ where: { id: tenantA.userId }, select: { email: true } });
    const tokenA = await loginAs(userA!.email, tenantA.tempPassword);

    // Tenant A tries to withdraw on behalf of Tenant B (the requester) → 403
    // (A claims to be B in the body)
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-withdraw`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ requestedByTenantId: tenantB.tenantId });

    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe("FORBIDDEN_TENANT_ACTION");
  }, 60000);

  it("Tenant A self-vote (tenantId=A) → terminate-approve returns 200", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);
    const { leaseId, tenantA, tenantB } = await createMultiTenantLease(prop.id, unit.id, adminToken);

    // Tenant A requests termination (via admin)
    const tReq = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-request`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requestedByTenantId: tenantA.tenantId, effectiveDate: "2026-07-01" });
    expect(tReq.status).toBe(201);

    const userB = await prisma.user.findUnique({ where: { id: tenantB.userId }, select: { email: true } });
    const tokenB = await loginAs(userB!.email, tenantB.tempPassword);

    // Tenant B casts their own vote → should succeed
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-approve`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ tenantId: tenantB.tenantId, decision: "APPROVED" });

    expect(res.status).toBe(200);
  }, 60000);

  it("PM token → terminate-approve returns 403 (PMs excluded from this endpoint)", async () => {
    const prop = await createProp();
    const unit = await createUnit(prop.id);
    const { leaseId, tenantA } = await createMultiTenantLease(prop.id, unit.id, adminToken);

    // Request termination via admin
    const tReq = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-request`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ requestedByTenantId: tenantA.tenantId, effectiveDate: "2026-07-01" });
    expect(tReq.status).toBe(201);

    // Create a PM and assign to this property
    const pm = await createPM("h01pm");
    await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${prop.id}/transfer-pm`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ toPmId: pm.id });

    const pmToken = await loginAs(pm.email, pm.temp_password);

    // PM tries to cast a vote → 403 (role excluded at controller level)
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-approve`)
      .set("Authorization", `Bearer ${pmToken}`)
      .send({ tenantId: tenantA.tenantId, decision: "APPROVED" });

    expect(res.status).toBe(403);
  }, 60000);
});

// ===========================================================================
// H-02 — Deposit refund scoped to PM's property
// ===========================================================================

describe("H-02 — Deposit refund scoped to PM's property via @PropertyScopeBody", () => {
  it("PM-1 (Property A) → deposit-refund for Property B's terminated lease → 403", async () => {
    const propA = await createProp();
    const propB = await createProp();
    const unitA = await createUnit(propA.id);
    const unitB = await createUnit(propB.id);

    // Create PM-1 and assign to Property A
    const pm1 = await createPM("h02pm1");
    await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${propA.id}/transfer-pm`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ toPmId: pm1.id });

    // Create and terminate a lease on Property B (using admin token)
    const { leaseId: leaseBId, tenantId: tenantBId } = await createTerminatedLease(propB.id, unitB.id);

    // Also create a lease on Property A so PM-1 has something valid to do
    // (prevents PM-1 from having no leases at all, which might cause auth issues)
    const leaseARes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${propA.id}/units/${unitA.id}/leases`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        startDate: "2026-06-01",
        endDate: "2027-05-31",
        monthlyRentPaise: 1_800_000,
        securityDepositPaise: 3_600_000,
        tenants: [{ name: "Tenant A", email: `ta-h02-${Date.now()}@test.local`, is_primary: true }],
      });
    expect(leaseARes.status).toBe(201);
    cleanLeaseIds.push(leaseARes.body.lease.id as string);
    for (const t of leaseARes.body.tenants as Array<{ tenantId: string; userId: string }>) {
      cleanTenantIds.push(t.tenantId);
      cleanUserIds.push(t.userId);
    }

    const pm1Token = await loginAs(pm1.email, pm1.temp_password);

    // PM-1 attempts to process a refund for Property B's lease → 403
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/deposit-refunds")
      .set("Authorization", `Bearer ${pm1Token}`)
      .send({
        leaseId: leaseBId,
        amountPaise: 3_500_000,
        deductionsPaise: 0,
        paidToTenantId: tenantBId,
      });

    expect(res.status).toBe(403);
  }, 60000);

  it("PM-1 (Property A) → deposit-refund for their own terminated lease → 201", async () => {
    const propA = await createProp();
    const unitA = await createUnit(propA.id);

    // Create PM-1 and assign to Property A
    const pm1 = await createPM("h02pm1own");
    await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${propA.id}/transfer-pm`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ toPmId: pm1.id });

    // Create and terminate a lease on Property A
    const { leaseId, tenantId } = await createTerminatedLease(propA.id, unitA.id);

    const pm1Token = await loginAs(pm1.email, pm1.temp_password);

    // PM-1 processes a refund for their own property's lease → 201
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/deposit-refunds")
      .set("Authorization", `Bearer ${pm1Token}`)
      .send({
        leaseId,
        amountPaise: 3_500_000,
        deductionsPaise: 0,
        paidToTenantId: tenantId,
      });

    expect(res.status).toBe(201);
    expect(res.body.lease_id).toBe(leaseId);
  }, 60000);

  it("ADMIN → deposit-refund for any property's terminated lease → 201", async () => {
    const propX = await createProp();
    const unitX = await createUnit(propX.id);

    // Terminate a lease on a property with no PM assigned
    const { leaseId, tenantId } = await createTerminatedLease(propX.id, unitX.id);

    // ADMIN processes the refund
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/deposit-refunds")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        leaseId,
        amountPaise: 3_500_000,
        deductionsPaise: 0,
        paidToTenantId: tenantId,
      });

    expect(res.status).toBe(201);
    expect(res.body.lease_id).toBe(leaseId);
  }, 60000);
});
