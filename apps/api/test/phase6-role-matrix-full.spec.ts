/**
 * Phase 6 — Full role-leakage matrix (~100 new cells)
 *
 * This file covers the GAPS not already asserted by:
 *   - phase2-integration, phase2-gaps
 *   - phase3-integration, phase3-gaps, phase3-security-fixes
 *   - phase4-integration, phase4-gaps, phase4-security-fixes
 *   - phase5-integration, phase5-gaps, phase5-security-fixes
 *   - phase6-role-leakage (existing 23 cases)
 *
 * DO NOT duplicate cells already covered by those files.
 *
 * Matrix layout — 4 roles × endpoints:
 *
 * ADMIN (baseline / allowed)  — tested only where a 200/201 positive is needed for contrast.
 * PROPERTY_MANAGER (PM)       — forbidden on Admin-only; scoped on property-level.
 * MAINTENANCE                 — forbidden on everything except /maintenance-requests list/get/in-progress/resolve.
 * TENANT                      — forbidden on write/admin paths; scoped reads only.
 *
 * Sections:
 *   A. Units — PM/TENANT/MAINTENANCE blocked on PATCH/:id, PATCH/:id/state, POST/:id/retire
 *   B. Users admin endpoints — MAINTENANCE + TENANT blocked
 *   C. Tenants module — MAINTENANCE + TENANT blocked
 *   D. Leases — MAINTENANCE + TENANT blocked on create/renew/finalize; MAINTENANCE blocked on terminate-approve
 *   E. Deposit refunds — MAINTENANCE + TENANT blocked
 *   F. Rent-periods — MAINTENANCE blocked (GET list + GET by-id)
 *   G. Void payment — TENANT + MAINTENANCE blocked
 *   H. Jobs — PM/TENANT/MAINTENANCE blocked on rent-accrual/run; PM/TENANT blocked on maintenance-alert/run
 *   I. Tenant data-scope cross-isolation (Tenant-A cannot read Tenant-B's records)
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
const TEST_PASSWORD = "FullMatrix@2026!";

let app: INestApplication;
let prisma: PrismaService;
let adminToken: string;

// Track created resources for cleanup
const cleanup = {
  leaseIds: [] as string[],
  unitIds: [] as string[],
  propertyIds: [] as string[],
  userIds: [] as string[],
  requestIds: [] as string[],
};

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

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
  expect(adminToken).toBeTruthy();
}, 60_000);

afterAll(async () => {
  // Clean up maintenance requests first
  if (cleanup.requestIds.length > 0) {
    await prisma.maintenanceRequest.deleteMany({ where: { id: { in: cleanup.requestIds } } });
  }
  // Clean leases and dependents
  if (cleanup.leaseIds.length > 0) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM payments WHERE lease_id = ANY($1::text[])`,
      cleanup.leaseIds,
    );
    await prisma.prepaidCredit.deleteMany({ where: { lease_id: { in: cleanup.leaseIds } } });
    await prisma.rentPeriod.deleteMany({ where: { lease_id: { in: cleanup.leaseIds } } });
    await prisma.leaseTenant.deleteMany({ where: { lease_id: { in: cleanup.leaseIds } } });
    await prisma.lease.deleteMany({ where: { id: { in: cleanup.leaseIds } } });
  }
  if (cleanup.unitIds.length > 0) {
    await prisma.unit.deleteMany({ where: { id: { in: cleanup.unitIds } } });
  }
  if (cleanup.propertyIds.length > 0) {
    const xferIds = (
      await prisma.propertyTransferLog.findMany({
        where: { property_id: { in: cleanup.propertyIds } },
        select: { id: true },
      })
    ).map((r) => r.id);
    if (xferIds.length) {
      await prisma.propertyTransferLog.deleteMany({ where: { id: { in: xferIds } } });
    }
    await prisma.property.deleteMany({ where: { id: { in: cleanup.propertyIds } } });
  }
  await prisma.tenant.deleteMany({ where: { user_id: { in: cleanup.userIds } } });
  await prisma.auditLog.deleteMany({ where: { actor_id: { in: cleanup.userIds } } });
  await prisma.refreshToken.deleteMany({ where: { user_id: { in: cleanup.userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: cleanup.userIds } } });
  await app.close();
}, 60_000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginAs(email: string, password: string): Promise<string> {
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email, password });
  expect(res.status).toBe(200);
  return res.body.accessToken as string;
}

async function createUser(
  role: string,
  tag: string,
): Promise<{ id: string; email: string; token: string }> {
  const email = `matrix-full-${role.toLowerCase()}-${tag}-${Date.now()}@test.local`;
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: `MatrixFull ${role} ${tag}`, email, role, password: TEST_PASSWORD });
  expect(res.status).toBe(201);
  cleanup.userIds.push(res.body.id as string);
  const token = await loginAs(email, TEST_PASSWORD);
  return { id: res.body.id as string, email, token };
}

async function createPropertyWithPm(
  pmId: string,
): Promise<{ propertyId: string }> {
  const propRes = await supertestFn(app.getHttpServer())
    .post("/api/v1/properties")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: `MatrixFull-Prop-${Date.now()}`,
      address: "1 Matrix Full Road",
      city: "Delhi",
      state: "Delhi",
      pincode: "110001",
    });
  expect(propRes.status).toBe(201);
  const propertyId = propRes.body.id as string;
  cleanup.propertyIds.push(propertyId);

  await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propertyId}/transfer-pm`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ toPmId: pmId });

  return { propertyId };
}

async function createUnit(propertyId: string): Promise<string> {
  // unit_number MaxLength(20) — use last 8 digits of timestamp + 4-char random = 14 chars total
  const rnd = Math.random().toString(36).slice(2, 6);
  const ts = String(Date.now()).slice(-8);
  const res = await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propertyId}/units`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      unit_number: `M${ts}${rnd}`,
      bedrooms: 1,
      bathrooms: 1,
      monthly_rent_paise: 1_500_000,
    });
  expect(res.status).toBe(201);
  const unitId = res.body.id as string;
  cleanup.unitIds.push(unitId);
  return unitId;
}

// Shared role tokens for the matrix — set up once in a beforeAll per section.
// Some sections create fresh roles; others share a global set.

// ===========================================================================
// SECTION A — Units: PM / TENANT / MAINTENANCE blocked on write endpoints
// ===========================================================================

describe("Section A — Units write endpoints: PM/TENANT/MAINTENANCE → 403", () => {
  let pmToken: string;
  let tenantToken: string;
  let maintToken: string;
  let unitId: string;

  beforeAll(async () => {
    const pm = await createUser("PROPERTY_MANAGER", "unitA");
    pmToken = pm.token;
    const tenant = await createUser("TENANT", "unitA");
    tenantToken = tenant.token;
    const maint = await createUser("MAINTENANCE", "unitA");
    maintToken = maint.token;

    // Create a unit using admin
    const propRes = await supertestFn(app.getHttpServer())
      .post("/api/v1/properties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `SectA-Prop-${Date.now()}`,
        address: "A Road",
        city: "Delhi",
        state: "Delhi",
        pincode: "110001",
      });
    expect(propRes.status).toBe(201);
    const propId = propRes.body.id as string;
    cleanup.propertyIds.push(propId);
    unitId = await createUnit(propId);
  }, 90_000);

  // PATCH /units/:id
  it("PM → PATCH /units/:id → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/units/${unitId}`)
      .set("Authorization", `Bearer ${pmToken}`)
      .send({ bedrooms: 2 });
    expect(res.status).toBe(403);
  });

  it("TENANT → PATCH /units/:id → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/units/${unitId}`)
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({ bedrooms: 2 });
    expect(res.status).toBe(403);
  });

  it("MAINTENANCE → PATCH /units/:id → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/units/${unitId}`)
      .set("Authorization", `Bearer ${maintToken}`)
      .send({ bedrooms: 2 });
    expect(res.status).toBe(403);
  });

  // GET /units/:id
  it("PM → GET /units/:id → 403 (Admin-only read)", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/units/${unitId}`)
      .set("Authorization", `Bearer ${pmToken}`);
    expect(res.status).toBe(403);
  });

  it("TENANT → GET /units/:id → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/units/${unitId}`)
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(403);
  });

  it("MAINTENANCE → GET /units/:id → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/units/${unitId}`)
      .set("Authorization", `Bearer ${maintToken}`);
    expect(res.status).toBe(403);
  });

  // PATCH /units/:id/state
  it("PM → PATCH /units/:id/state → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/units/${unitId}/state`)
      .set("Authorization", `Bearer ${pmToken}`)
      .send({ state: "LISTED" });
    expect(res.status).toBe(403);
  });

  it("TENANT → PATCH /units/:id/state → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/units/${unitId}/state`)
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({ state: "LISTED" });
    expect(res.status).toBe(403);
  });

  it("MAINTENANCE → PATCH /units/:id/state → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/units/${unitId}/state`)
      .set("Authorization", `Bearer ${maintToken}`)
      .send({ state: "LISTED" });
    expect(res.status).toBe(403);
  });

  // POST /units/:id/retire
  it("PM → POST /units/:id/retire → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/units/${unitId}/retire`)
      .set("Authorization", `Bearer ${pmToken}`);
    expect(res.status).toBe(403);
  });

  it("TENANT → POST /units/:id/retire → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/units/${unitId}/retire`)
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(403);
  });

  it("MAINTENANCE → POST /units/:id/retire → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/units/${unitId}/retire`)
      .set("Authorization", `Bearer ${maintToken}`);
    expect(res.status).toBe(403);
  });

  // GET /properties/:propertyId/units
  it("TENANT → GET /properties/:id/units → 403", async () => {
    const propId = cleanup.propertyIds[cleanup.propertyIds.length - 1];
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/properties/${propId}/units`)
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(403);
  });

  it("MAINTENANCE → GET /properties/:id/units → 403", async () => {
    const propId = cleanup.propertyIds[cleanup.propertyIds.length - 1];
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/properties/${propId}/units`)
      .set("Authorization", `Bearer ${maintToken}`);
    expect(res.status).toBe(403);
  });

  // POST /properties/:propertyId/units
  it("TENANT → POST /properties/:id/units → 403", async () => {
    const propId = cleanup.propertyIds[cleanup.propertyIds.length - 1];
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${propId}/units`)
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({ unit_number: "HACK-01", bedrooms: 1, bathrooms: 1, monthly_rent_paise: 100000 });
    expect(res.status).toBe(403);
  });

  it("MAINTENANCE → POST /properties/:id/units → 403", async () => {
    const propId = cleanup.propertyIds[cleanup.propertyIds.length - 1];
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${propId}/units`)
      .set("Authorization", `Bearer ${maintToken}`)
      .send({ unit_number: "HACK-02", bedrooms: 1, bathrooms: 1, monthly_rent_paise: 100000 });
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// SECTION B — Users admin endpoints: MAINTENANCE + TENANT blocked
// (PM already covered by phase2-gaps; ADMIN baseline not repeated)
// ===========================================================================

describe("Section B — Users admin endpoints: MAINTENANCE/TENANT → 403", () => {
  let tenantToken: string;
  let maintToken: string;
  let targetUserId: string;

  beforeAll(async () => {
    const tenant = await createUser("TENANT", "usersB");
    tenantToken = tenant.token;
    const maint = await createUser("MAINTENANCE", "usersB");
    maintToken = maint.token;
    // We'll use the admin user's own id as target for admin-only endpoints
    // (just for the endpoint to exist; 403 fires before lookup)
    const meRes = await supertestFn(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${adminToken}`);
    targetUserId = meRes.body.id as string;
  }, 60_000);

  it("MAINTENANCE → GET /users/:id → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/users/${targetUserId}`)
      .set("Authorization", `Bearer ${maintToken}`);
    expect(res.status).toBe(403);
  });

  it("TENANT → GET /users/:id → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/users/${targetUserId}`)
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(403);
  });

  it("MAINTENANCE → PATCH /users/:id → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/users/${targetUserId}`)
      .set("Authorization", `Bearer ${maintToken}`)
      .send({ name: "HackAttempt" });
    expect(res.status).toBe(403);
  });

  it("TENANT → PATCH /users/:id → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/users/${targetUserId}`)
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({ name: "HackAttempt" });
    expect(res.status).toBe(403);
  });

  it("MAINTENANCE → POST /users/:id/deactivate → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/users/${targetUserId}/deactivate`)
      .set("Authorization", `Bearer ${maintToken}`);
    expect(res.status).toBe(403);
  });

  it("TENANT → POST /users/:id/deactivate → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/users/${targetUserId}/deactivate`)
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(403);
  });

  it("MAINTENANCE → POST /users/:id/activate → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/users/${targetUserId}/activate`)
      .set("Authorization", `Bearer ${maintToken}`);
    expect(res.status).toBe(403);
  });

  it("TENANT → POST /users/:id/activate → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/users/${targetUserId}/activate`)
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// SECTION C — Tenants module: MAINTENANCE + TENANT blocked
// ===========================================================================

describe("Section C — Tenants module: MAINTENANCE/TENANT → 403", () => {
  let tenantToken: string;
  let maintToken: string;
  // RolesGuard fires before PropertyScopeGuard, so fake UUIDs are fine for 403 tests.
  const propertyId = "00000000-0000-0000-0000-000000000001";
  const tenantRecordId = "00000000-0000-0000-0000-000000000002";

  beforeAll(async () => {
    const tenant = await createUser("TENANT", "tenantsC");
    tenantToken = tenant.token;
    const maint = await createUser("MAINTENANCE", "tenantsC");
    maintToken = maint.token;
  }, 60_000);

  it("MAINTENANCE → GET /tenants/:id → 403 (BL-19 scope: PM/Admin only)", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantRecordId}`)
      .set("Authorization", `Bearer ${maintToken}`);
    expect(res.status).toBe(403);
  });

  it("TENANT → GET /tenants/:id → 403 (only PM/Admin can read tenant records)", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/tenants/${tenantRecordId}`)
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(403);
  });

  it("MAINTENANCE → PATCH /tenants/:id → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/tenants/${tenantRecordId}`)
      .set("Authorization", `Bearer ${maintToken}`)
      .send({ phone: "9876543211" });
    expect(res.status).toBe(403);
  });

  it("TENANT → PATCH /tenants/:id → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/tenants/${tenantRecordId}`)
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({ phone: "9876543211" });
    expect(res.status).toBe(403);
  });

  it("MAINTENANCE → GET /properties/:id/tenants → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}/tenants`)
      .set("Authorization", `Bearer ${maintToken}`);
    expect(res.status).toBe(403);
  });

  it("TENANT → GET /properties/:id/tenants → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}/tenants`)
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// SECTION D — Leases: MAINTENANCE / TENANT blocked on create / renew / finalize
// ===========================================================================

describe("Section D — Leases: MAINTENANCE/TENANT blocked on write endpoints", () => {
  let tenantToken: string;
  let maintToken: string;
  let propertyId: string;
  let unitId: string;
  // @Roles check fires before DB lookup for MAINTENANCE/TENANT, so fake UUIDs are fine
  // for the lease-action endpoints. We DO need a real property+unit for the POST /leases
  // endpoint test to hit the RolesGuard (not the PropertyScopeGuard which needs real data).
  const leaseId = "00000000-0000-0000-0000-000000000000";

  beforeAll(async () => {
    const pm = await createUser("PROPERTY_MANAGER", "leasesD");
    const tenant = await createUser("TENANT", "leasesD");
    tenantToken = tenant.token;
    const maint = await createUser("MAINTENANCE", "leasesD");
    maintToken = maint.token;

    const { propertyId: pid } = await createPropertyWithPm(pm.id);
    propertyId = pid;
    unitId = await createUnit(propertyId);
    // No lease creation needed — role 403 fires before DB lookup
  }, 90_000);

  // POST /properties/:p/units/:u/leases — MAINTENANCE + TENANT blocked
  it("MAINTENANCE → POST /properties/:p/units/:u/leases → 403", async () => {
    const now = new Date();
    const startDate = now.toISOString().slice(0, 10);
    const endDateObj = new Date(now);
    endDateObj.setFullYear(endDateObj.getFullYear() + 1);
    const endDate = endDateObj.toISOString().slice(0, 10);
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/units/${unitId}/leases`)
      .set("Authorization", `Bearer ${maintToken}`)
      .send({
        startDate,
        endDate,
        monthlyRentPaise: 1_500_000,
        securityDepositPaise: 3_000_000,
        tenants: [{ name: "Hack Tenant", email: "hack@test.local", phone: "9000000001", is_primary: true }],
      });
    expect(res.status).toBe(403);
  });

  it("TENANT → POST /properties/:p/units/:u/leases → 403", async () => {
    const now = new Date();
    const startDate = now.toISOString().slice(0, 10);
    const endDateObj = new Date(now);
    endDateObj.setFullYear(endDateObj.getFullYear() + 1);
    const endDate = endDateObj.toISOString().slice(0, 10);
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/units/${unitId}/leases`)
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({
        startDate,
        endDate,
        monthlyRentPaise: 1_500_000,
        securityDepositPaise: 3_000_000,
        tenants: [{ name: "Hack Tenant", email: "hack2@test.local", phone: "9000000002", is_primary: true }],
      });
    expect(res.status).toBe(403);
  });

  // GET /leases/:id — MAINTENANCE blocked (TENANT already in phase6-role-leakage)
  it("MAINTENANCE → GET /leases/:id → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/leases/${leaseId}`)
      .set("Authorization", `Bearer ${maintToken}`);
    expect(res.status).toBe(403);
  });

  it("TENANT → GET /leases/:id → 403 (BL: tenant uses own portal, not leases endpoint)", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/leases/${leaseId}`)
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(403);
  });

  // POST /leases/:id/renew — MAINTENANCE + TENANT blocked
  it("MAINTENANCE → POST /leases/:id/renew → 403", async () => {
    const newEnd = new Date();
    newEnd.setFullYear(newEnd.getFullYear() + 2);
    const newEndDate = newEnd.toISOString().slice(0, 10);
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/renew`)
      .set("Authorization", `Bearer ${maintToken}`)
      .send({ newEndDate, monthlyRentPaise: 1_500_000 });
    expect(res.status).toBe(403);
  });

  it("TENANT → POST /leases/:id/renew → 403", async () => {
    const newEnd = new Date();
    newEnd.setFullYear(newEnd.getFullYear() + 2);
    const newEndDate = newEnd.toISOString().slice(0, 10);
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/renew`)
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({ newEndDate, monthlyRentPaise: 1_500_000 });
    expect(res.status).toBe(403);
  });

  // POST /leases/:id/finalize-termination — MAINTENANCE + TENANT blocked
  it("MAINTENANCE → POST /leases/:id/finalize-termination → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/finalize-termination`)
      .set("Authorization", `Bearer ${maintToken}`);
    expect(res.status).toBe(403);
  });

  it("TENANT → POST /leases/:id/finalize-termination → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/finalize-termination`)
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(403);
  });

  // POST /leases/:id/terminate-approve — MAINTENANCE blocked
  // (PM blocked already in phase3-security-fixes; TENANT→200 path tested in phase3)
  it("MAINTENANCE → POST /leases/:id/terminate-approve → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-approve`)
      .set("Authorization", `Bearer ${maintToken}`)
      .send({ tenantId: "00000000-0000-0000-0000-000000000000", vote: "APPROVED" });
    expect(res.status).toBe(403);
  });

  // POST /leases/:id/terminate-withdraw — MAINTENANCE blocked
  it("MAINTENANCE → POST /leases/:id/terminate-withdraw → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/terminate-withdraw`)
      .set("Authorization", `Bearer ${maintToken}`)
      .send({ requestedByTenantId: "00000000-0000-0000-0000-000000000000" });
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// SECTION E — Deposit refunds: MAINTENANCE + TENANT blocked
// ===========================================================================

describe("Section E — Deposit refunds: MAINTENANCE/TENANT → 403", () => {
  let tenantToken: string;
  let maintToken: string;

  beforeAll(async () => {
    const tenant = await createUser("TENANT", "refundE");
    tenantToken = tenant.token;
    const maint = await createUser("MAINTENANCE", "refundE");
    maintToken = maint.token;
  }, 60_000);

  it("MAINTENANCE → POST /deposit-refunds → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/deposit-refunds")
      .set("Authorization", `Bearer ${maintToken}`)
      .send({
        leaseId: "00000000-0000-0000-0000-000000000000",
        amountPaise: 1_000_000,
        notes: "Hack attempt",
      });
    expect(res.status).toBe(403);
  });

  it("TENANT → POST /deposit-refunds → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/deposit-refunds")
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({
        leaseId: "00000000-0000-0000-0000-000000000000",
        amountPaise: 1_000_000,
        notes: "Hack attempt",
      });
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// SECTION F — Rent-periods: MAINTENANCE blocked on GET list + GET by-id
// ===========================================================================

describe("Section F — Rent-periods: MAINTENANCE → 403", () => {
  let maintToken: string;
  // MAINTENANCE is blocked by @Roles on both GET /rent-periods and GET /rent-periods/:id.
  // RolesGuard fires before any DB lookup, so fake UUIDs are fine.
  const rentPeriodId = "00000000-0000-0000-0000-000000000000";

  beforeAll(async () => {
    const maint = await createUser("MAINTENANCE", "rentF");
    maintToken = maint.token;
  }, 30_000);

  it("MAINTENANCE → GET /rent-periods → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/rent-periods")
      .set("Authorization", `Bearer ${maintToken}`);
    expect(res.status).toBe(403);
  });

  it("MAINTENANCE → GET /rent-periods/:id → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/rent-periods/${rentPeriodId}`)
      .set("Authorization", `Bearer ${maintToken}`);
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// SECTION G — Void payment: TENANT + MAINTENANCE blocked
// ===========================================================================

describe("Section G — Void payment: TENANT/MAINTENANCE → 403", () => {
  let tenantToken: string;
  let maintToken: string;

  beforeAll(async () => {
    const tenant = await createUser("TENANT", "voidG");
    tenantToken = tenant.token;
    const maint = await createUser("MAINTENANCE", "voidG");
    maintToken = maint.token;
  }, 60_000);

  it("TENANT → POST /payments/:id/void → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/payments/00000000-0000-0000-0000-000000000000/void")
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({ reason: "Hack attempt" });
    expect(res.status).toBe(403);
  });

  it("MAINTENANCE → POST /payments/:id/void → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/payments/00000000-0000-0000-0000-000000000000/void")
      .set("Authorization", `Bearer ${maintToken}`)
      .send({ reason: "Hack attempt" });
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// SECTION H — Jobs: role-gating
//   PM/TENANT/MAINTENANCE → POST /jobs/rent-accrual/run → 403
//   PM/TENANT             → POST /jobs/maintenance-alert/run → 403
//   (MAINTENANCE already covered in phase5-integration)
// ===========================================================================

describe("Section H — Jobs endpoints: non-Admin roles → 403", () => {
  let pmToken: string;
  let tenantToken: string;
  let maintToken: string;

  beforeAll(async () => {
    const pm = await createUser("PROPERTY_MANAGER", "jobsH");
    pmToken = pm.token;
    const tenant = await createUser("TENANT", "jobsH");
    tenantToken = tenant.token;
    const maint = await createUser("MAINTENANCE", "jobsH");
    maintToken = maint.token;
  }, 60_000);

  // POST /jobs/rent-accrual/run
  it("PM → POST /jobs/rent-accrual/run → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/jobs/rent-accrual/run")
      .set("Authorization", `Bearer ${pmToken}`);
    expect(res.status).toBe(403);
  });

  it("TENANT → POST /jobs/rent-accrual/run → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/jobs/rent-accrual/run")
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(403);
  });

  it("MAINTENANCE → POST /jobs/rent-accrual/run → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/jobs/rent-accrual/run")
      .set("Authorization", `Bearer ${maintToken}`);
    expect(res.status).toBe(403);
  });

  // POST /jobs/rent-accrual/schedule
  it("PM → POST /jobs/rent-accrual/schedule → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/jobs/rent-accrual/schedule")
      .set("Authorization", `Bearer ${pmToken}`);
    expect(res.status).toBe(403);
  });

  it("TENANT → POST /jobs/rent-accrual/schedule → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/jobs/rent-accrual/schedule")
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(403);
  });

  it("MAINTENANCE → POST /jobs/rent-accrual/schedule → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/jobs/rent-accrual/schedule")
      .set("Authorization", `Bearer ${maintToken}`);
    expect(res.status).toBe(403);
  });

  // POST /jobs/maintenance-alert/run
  it("PM → POST /jobs/maintenance-alert/run → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/jobs/maintenance-alert/run")
      .set("Authorization", `Bearer ${pmToken}`);
    expect(res.status).toBe(403);
  });

  it("TENANT → POST /jobs/maintenance-alert/run → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/jobs/maintenance-alert/run")
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// SECTION I — Tenant data-scope cross-isolation
//   TENANT-A cannot read TENANT-B's lease / rent-period / maintenance-request
//   (per Phase 6 spec: cross-tenant isolation)
// ===========================================================================

describe("Section I — Tenant cross-data-scope isolation (BL-19 data plane)", () => {
  let tenantAToken: string;
  let tenantBLeaseId: string;
  let tenantBRentPeriodId: string;
  let tenantBRequestId: string;
  let pmId: string;
  let pmToken: string;

  beforeAll(async () => {
    // Create a PM and property
    const pm = await createUser("PROPERTY_MANAGER", "scopeI");
    pmId = pm.id;
    pmToken = pm.token;

    const { propertyId } = await createPropertyWithPm(pmId);

    // Unit A: for Tenant-A's lease
    const unitA = await createUnit(propertyId);
    // Unit B: for Tenant-B's lease
    const unitB = await createUnit(propertyId);

    const ts = Date.now();
    const tenantAEmail = `matrix-tenant-a-scope-i-${ts}@test.local`;
    const tenantBEmail = `matrix-tenant-b-scope-i-${ts + 1}@test.local`;

    // Pre-create tenant users with a known password so we can log in reliably
    const userARes = await supertestFn(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Scope Tenant A", email: tenantAEmail, role: "TENANT", password: TEST_PASSWORD });
    expect(userARes.status).toBe(201);
    cleanup.userIds.push(userARes.body.id as string);

    const userBRes = await supertestFn(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Scope Tenant B", email: tenantBEmail, role: "TENANT", password: TEST_PASSWORD });
    expect(userBRes.status).toBe(201);
    cleanup.userIds.push(userBRes.body.id as string);

    // Create leases
    const now = new Date();
    const startDate = now.toISOString().slice(0, 10);
    const endDateObj = new Date(now);
    endDateObj.setFullYear(endDateObj.getFullYear() + 1);
    const endDate = endDateObj.toISOString().slice(0, 10);

    const leaseARes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/units/${unitA}/leases`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        startDate,
        endDate,
        monthlyRentPaise: 1_500_000,
        securityDepositPaise: 3_000_000,
        tenants: [{ name: "Scope Tenant A", email: tenantAEmail, is_primary: true }],
      });
    expect(leaseARes.status).toBe(201);
    cleanup.leaseIds.push(leaseARes.body.lease.id as string);
    tenantAToken = await loginAs(tenantAEmail, TEST_PASSWORD);

    const leaseBRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/units/${unitB}/leases`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        startDate,
        endDate,
        monthlyRentPaise: 1_500_000,
        securityDepositPaise: 3_000_000,
        tenants: [{ name: "Scope Tenant B", email: tenantBEmail, is_primary: true }],
      });
    expect(leaseBRes.status).toBe(201);
    tenantBLeaseId = leaseBRes.body.lease.id as string;
    cleanup.leaseIds.push(tenantBLeaseId);
    const tenantBToken = await loginAs(tenantBEmail, TEST_PASSWORD);

    // Tenant-B raises a maintenance request
    const maintRes = await supertestFn(app.getHttpServer())
      .post("/api/v1/maintenance-requests")
      .set("Authorization", `Bearer ${tenantBToken}`)
      .send({
        unitId: unitB,
        title: "Tenant B request for isolation test",
        description: "This is Tenant B request desc with thirty+ chars here.",
        priority: "NORMAL",
      });
    expect(maintRes.status).toBe(201);
    tenantBRequestId = maintRes.body.id as string;
    cleanup.requestIds.push(tenantBRequestId);

    // Get a rent-period for Tenant-B
    const periodsRes = await supertestFn(app.getHttpServer())
      .get(`/api/v1/rent-periods?leaseId=${tenantBLeaseId}&limit=1`)
      .set("Authorization", `Bearer ${pmToken}`);
    if (periodsRes.status === 200 && (periodsRes.body.data as unknown[]).length > 0) {
      tenantBRentPeriodId = ((periodsRes.body.data as Array<{ id: string }>)[0] as { id: string }).id;
    } else {
      tenantBRentPeriodId = "00000000-0000-0000-0000-000000000000";
    }
  }, 120_000);

  it("TENANT-A → GET /leases/<B's-id> → 403 (role not allowed on /leases endpoint)", async () => {
    // TENANT role is excluded from GET /leases/:id (controller @Roles)
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/leases/${tenantBLeaseId}`)
      .set("Authorization", `Bearer ${tenantAToken}`);
    expect(res.status).toBe(403);
  });

  it("TENANT-A → GET /rent-periods/<B's-period-id> → 403 PERIOD_ACCESS_DENIED", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/rent-periods/${tenantBRentPeriodId}`)
      .set("Authorization", `Bearer ${tenantAToken}`);
    // Tenant access check: 403 with PERIOD_ACCESS_DENIED if not their lease
    expect(res.status).toBe(403);
    const code = res.body.error?.code ?? res.body.code;
    expect(code).toBe("PERIOD_ACCESS_DENIED");
  });

  it("TENANT-A → GET /maintenance-requests/<B's-request-id> → 403 NOT_YOUR_REQUEST", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/maintenance-requests/${tenantBRequestId}`)
      .set("Authorization", `Bearer ${tenantAToken}`);
    expect(res.status).toBe(403);
    const code = res.body.error?.code ?? res.body.code;
    expect(code).toBe("NOT_YOUR_REQUEST");
  });

  it("TENANT-A → POST /maintenance-requests/<B's-request-id>/close → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/maintenance-requests/${tenantBRequestId}/close`)
      .set("Authorization", `Bearer ${tenantAToken}`);
    // TENANT-A gets 403: the close endpoint first checks role (TENANT only), then
    // ownership. Since the request is in OPEN state, the transition check
    // may fire before the ownership check. Either 403 or 409 is acceptable; 200 is NOT.
    expect([403, 409]).toContain(res.status);
  });
});

// ===========================================================================
// SECTION J — Properties: PM blocked (belt-and-suspenders, BL-19/BL-20)
// Existing phase2-gaps covers most of these. Adding the ones missing:
//   PM → GET /properties/:id → 403
//   PM → DELETE /properties/:id → 403
// ===========================================================================

describe("Section J — Properties: PM blocked on remaining Admin-only endpoints", () => {
  let pmToken: string;
  let propertyId: string;

  beforeAll(async () => {
    const pm = await createUser("PROPERTY_MANAGER", "propJ");
    pmToken = pm.token;

    // Need a property id; create one as admin
    const propRes = await supertestFn(app.getHttpServer())
      .post("/api/v1/properties")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: `SectJ-Prop-${Date.now()}`,
        address: "J Road",
        city: "Delhi",
        state: "Delhi",
        pincode: "110001",
      });
    expect(propRes.status).toBe(201);
    propertyId = propRes.body.id as string;
    cleanup.propertyIds.push(propertyId);
  }, 60_000);

  it("PM → GET /properties/:id → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${pmToken}`);
    expect(res.status).toBe(403);
  });

  it("PM → DELETE /properties/:id → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .delete(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${pmToken}`);
    expect(res.status).toBe(403);
  });

  it("MAINTENANCE → GET /properties/:id → 403", async () => {
    // Create a maintenance user inside this describe
    const maint = await createUser("MAINTENANCE", "propJ");
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${maint.token}`);
    expect(res.status).toBe(403);
  });

  it("TENANT → GET /properties/:id → 403", async () => {
    const tenant = await createUser("TENANT", "propJ-t");
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}`)
      .set("Authorization", `Bearer ${tenant.token}`);
    expect(res.status).toBe(403);
  });
});

// ===========================================================================
// SECTION K — Maintenance: TENANT blocked on assign / in-progress / resolve
// ===========================================================================

describe("Section K — Maintenance: TENANT blocked on workflow-transition endpoints", () => {
  let tenantToken: string;
  let pmId: string;
  let maintId: string;
  let requestId: string;

  beforeAll(async () => {
    const pm = await createUser("PROPERTY_MANAGER", "maintK");
    pmId = pm.id;
    const maint = await createUser("MAINTENANCE", "maintK");
    maintId = maint.id;
    const { propertyId } = await createPropertyWithPm(pmId);
    const unitId = await createUnit(propertyId);

    const tenantEmail = `matrix-tenant-k-${Date.now()}@test.local`;

    // Pre-create tenant user with a known password
    const userRes = await supertestFn(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Maint K Tenant", email: tenantEmail, role: "TENANT", password: TEST_PASSWORD });
    expect(userRes.status).toBe(201);
    cleanup.userIds.push(userRes.body.id as string);

    const now = new Date();
    const startDate = now.toISOString().slice(0, 10);
    const endDateObj = new Date(now);
    endDateObj.setFullYear(endDateObj.getFullYear() + 1);
    const endDate = endDateObj.toISOString().slice(0, 10);

    const leaseRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/units/${unitId}/leases`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        startDate,
        endDate,
        monthlyRentPaise: 1_500_000,
        securityDepositPaise: 3_000_000,
        tenants: [{ name: "Maint K Tenant", email: tenantEmail, is_primary: true }],
      });
    expect(leaseRes.status).toBe(201);
    cleanup.leaseIds.push(leaseRes.body.lease.id as string);
    tenantToken = await loginAs(tenantEmail, TEST_PASSWORD);

    // Tenant raises a request
    const maintRes = await supertestFn(app.getHttpServer())
      .post("/api/v1/maintenance-requests")
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({
        unitId,
        title: "Leak K",
        description: "There is a serious water leak in the kitchen area.",
        priority: "NORMAL",
      });
    expect(maintRes.status).toBe(201);
    requestId = maintRes.body.id as string;
    cleanup.requestIds.push(requestId);
  }, 120_000);

  it("TENANT → POST /maintenance-requests/:id/assign → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/maintenance-requests/${requestId}/assign`)
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({ assignedToUserId: maintId });
    expect(res.status).toBe(403);
  });

  it("TENANT → POST /maintenance-requests/:id/in-progress → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/maintenance-requests/${requestId}/in-progress`)
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(403);
  });

  it("TENANT → POST /maintenance-requests/:id/resolve → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/maintenance-requests/${requestId}/resolve`)
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({ resolutionNotes: "Tenant trying to self-resolve — should be forbidden." });
    expect(res.status).toBe(403);
  });

  it("TENANT → POST /maintenance-requests/dismiss-alert → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/maintenance-requests/dismiss-alert")
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({ unitId: "00000000-0000-0000-0000-000000000000", month: "2026-05" });
    expect(res.status).toBe(403);
  });

  it("MAINTENANCE → POST /maintenance-requests/dismiss-alert → 403 (Admin/PM only)", async () => {
    const maint = await createUser("MAINTENANCE", "maintK-dm");
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/maintenance-requests/dismiss-alert")
      .set("Authorization", `Bearer ${maint.token}`)
      .send({ unitId: "00000000-0000-0000-0000-000000000000", month: "2026-05" });
    expect(res.status).toBe(403);
  });
});
