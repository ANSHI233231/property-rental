/**
 * Phase 5 — Security Fix Tests
 *
 * H-01: PM property-scope check on GET /maintenance-requests/:id
 *   - PM-B cannot read a request belonging to Property A (403 PROPERTY_ACCESS_DENIED)
 *   - PM-A can read a request belonging to Property A (200)
 *   - ADMIN can read any request (200)
 *   - TENANT who did not raise the request gets 403 NOT_YOUR_REQUEST (regression)
 *   - MAINTENANCE assigned to the request gets 200 (regression)
 *
 * M-01: lease_id stripped from scope=all-open MAINTENANCE list
 *   - GET /maintenance-requests?scope=all-open with MAINTENANCE token returns items
 *     where lease_id is null or absent
 *   - GET /maintenance-requests (PM scoped) still includes lease_id in response
 *   - GET /maintenance-requests (Admin scoped) still includes lease_id in response
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
const TENANT_PASSWORD = "Tenant@test2026!";
const VALID_DESC = "This is a valid maintenance description with thirty+ chars.";

let app: INestApplication;
let prisma: PrismaService;
let adminToken: string;

const cleanup = {
  requestIds: [] as string[],
  leaseIds: [] as string[],
  unitIds: [] as string[],
  propertyIds: [] as string[],
  userIds: [] as string[],
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
  await prisma.maintenanceRequest.deleteMany({ where: { id: { in: cleanup.requestIds } } });
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

async function createPM(tag: string): Promise<{ id: string; email: string; tempPassword: string }> {
  const email = `sec5-pm-${tag}-${Date.now()}@test.local`;
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: `PM ${tag}`, email, role: "PROPERTY_MANAGER" });
  expect(res.status).toBe(201);
  cleanup.userIds.push(res.body.id as string);
  return { id: res.body.id as string, email, tempPassword: res.body.temp_password as string };
}

async function createMaintenanceUser(tag: string): Promise<{ id: string; email: string; tempPassword: string }> {
  const email = `sec5-maint-${tag}-${Date.now()}@test.local`;
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: `Maint ${tag}`, email, role: "MAINTENANCE" });
  expect(res.status).toBe(201);
  cleanup.userIds.push(res.body.id as string);
  return { id: res.body.id as string, email, tempPassword: res.body.temp_password as string };
}

async function createPropertyWithUnit(pmId: string): Promise<{ propertyId: string; unitId: string }> {
  const propRes = await supertestFn(app.getHttpServer())
    .post("/api/v1/properties")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: `Sec5-Prop-${Date.now()}`,
      address: "1 Security St",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400001",
    });
  expect(propRes.status).toBe(201);
  const propertyId = propRes.body.id as string;
  cleanup.propertyIds.push(propertyId);

  await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propertyId}/transfer-pm`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ toPmId: pmId });

  const unitRes = await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propertyId}/units`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ unit_number: `U-${Date.now()}`, bedrooms: 2, bathrooms: 1, monthly_rent_paise: 1_800_000 });
  expect(unitRes.status).toBe(201);
  const unitId = unitRes.body.id as string;
  cleanup.unitIds.push(unitId);

  return { propertyId, unitId };
}

async function createLeaseWithTenant(
  propertyId: string,
  unitId: string,
  pmToken: string,
  tenantTag: string,
): Promise<{ leaseId: string; tenantUserId: string; tenantEmail: string }> {
  const tenantEmail = `sec5-tenant-${tenantTag.toLowerCase()}-${Date.now()}@test.local`;
  const today = new Date().toISOString().slice(0, 10);
  const nextYear = `${new Date().getFullYear() + 1}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}`;

  const userRes = await supertestFn(app.getHttpServer())
    .post("/api/v1/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: `Tenant ${tenantTag}`, email: tenantEmail, role: "TENANT", password: TENANT_PASSWORD });
  expect(userRes.status).toBe(201);
  cleanup.userIds.push(userRes.body.id as string);

  const res = await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propertyId}/units/${unitId}/leases`)
    .set("Authorization", `Bearer ${pmToken}`)
    .send({
      startDate: today,
      endDate: nextYear,
      monthlyRentPaise: 1_800_000,
      securityDepositPaise: 3_600_000,
      tenants: [{ name: `Tenant ${tenantTag}`, email: tenantEmail, is_primary: true }],
    });
  expect(res.status).toBe(201);
  cleanup.leaseIds.push(res.body.lease.id as string);
  const tenants = res.body.tenants as Array<{ userId: string }>;
  return {
    leaseId: res.body.lease.id as string,
    tenantUserId: tenants[0]!.userId,
    tenantEmail,
  };
}

// ---------------------------------------------------------------------------
// H-01: PM property-scope on GET /maintenance-requests/:id
// ---------------------------------------------------------------------------

describe("H-01: PM property-scope on GET /maintenance-requests/:id", () => {
  let requestIdFromPropertyA: string;
  let pmAToken: string;
  let pmBToken: string;
  let tenantAToken: string;
  let maintToken: string;

  beforeAll(async () => {
    // Create PM-A and Property A with tenant + request
    const pmA = await createPM("sec5-A");
    pmAToken = await loginAs(pmA.email, pmA.tempPassword);
    const { propertyId: propA, unitId: unitA } = await createPropertyWithUnit(pmA.id);
    const { tenantUserId: tenantAId, tenantEmail: tenantAEmail } = await createLeaseWithTenant(
      propA,
      unitA,
      pmAToken,
      "sec5-tenA",
    );
    tenantAToken = await loginAs(tenantAEmail, TENANT_PASSWORD);

    // Tenant A raises a maintenance request on Property A
    const reqRes = await supertestFn(app.getHttpServer())
      .post("/api/v1/maintenance-requests")
      .set("Authorization", `Bearer ${tenantAToken}`)
      .send({
        unitId: unitA,
        title: "Leaking pipe",
        description: VALID_DESC,
        priority: "NORMAL",
      });
    expect(reqRes.status).toBe(201);
    requestIdFromPropertyA = reqRes.body.id as string;
    cleanup.requestIds.push(requestIdFromPropertyA);

    // Create PM-B assigned to Property B (different property)
    const pmB = await createPM("sec5-B");
    pmBToken = await loginAs(pmB.email, pmB.tempPassword);
    // Give PM-B their own property so they have a valid assignment
    await createPropertyWithUnit(pmB.id);

    // Create a MAINTENANCE user and assign them to the request
    const maint = await createMaintenanceUser("sec5-maint");
    maintToken = await loginAs(maint.email, maint.tempPassword);
    const assignRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/maintenance-requests/${requestIdFromPropertyA}/assign`)
      .set("Authorization", `Bearer ${pmAToken}`)
      .send({ assigneeUserId: maint.id });
    expect(assignRes.status).toBe(200);

    // Suppress tenantAId unused warning
    void tenantAId;
  }, 120_000);

  it("PM-B token: GET /maintenance-requests/:idFromPropertyA → 403 PROPERTY_ACCESS_DENIED", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/maintenance-requests/${requestIdFromPropertyA}`)
      .set("Authorization", `Bearer ${pmBToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error?.code ?? res.body.code).toBe("PROPERTY_ACCESS_DENIED");
  });

  it("PM-A token: GET /maintenance-requests/:idFromPropertyA → 200", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/maintenance-requests/${requestIdFromPropertyA}`)
      .set("Authorization", `Bearer ${pmAToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(requestIdFromPropertyA);
  });

  it("ADMIN token: GET /maintenance-requests/:idFromPropertyA → 200", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/maintenance-requests/${requestIdFromPropertyA}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(requestIdFromPropertyA);
  });

  it("TENANT not-raiser token: → 403 NOT_YOUR_REQUEST (regression)", async () => {
    // Create a second tenant in a different property — they should not see Property A's request
    const pmC = await createPM("sec5-C");
    const pmCToken = await loginAs(pmC.email, pmC.tempPassword);
    const { propertyId: propC, unitId: unitC } = await createPropertyWithUnit(pmC.id);
    const { tenantEmail: tenantCEmail } = await createLeaseWithTenant(propC, unitC, pmCToken, "sec5-tenC");
    const tenantCToken = await loginAs(tenantCEmail, TENANT_PASSWORD);

    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/maintenance-requests/${requestIdFromPropertyA}`)
      .set("Authorization", `Bearer ${tenantCToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error?.code ?? res.body.code).toBe("NOT_YOUR_REQUEST");
  }, 60_000);

  it("MAINTENANCE assigned: GET /maintenance-requests/:idFromPropertyA → 200 (regression)", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/maintenance-requests/${requestIdFromPropertyA}`)
      .set("Authorization", `Bearer ${maintToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(requestIdFromPropertyA);
  });
});

// ---------------------------------------------------------------------------
// M-01: lease_id stripped from scope=all-open for MAINTENANCE role
// ---------------------------------------------------------------------------

describe("M-01: lease_id absent/null in MAINTENANCE scope=all-open response", () => {
  let maintToken: string;
  let pmToken: string;
  let requestId: string;

  beforeAll(async () => {
    const pm = await createPM("sec5-m01");
    pmToken = await loginAs(pm.email, pm.tempPassword);
    const { propertyId, unitId } = await createPropertyWithUnit(pm.id);
    const { tenantEmail } = await createLeaseWithTenant(propertyId, unitId, pmToken, "sec5-m01t");
    const tenantToken = await loginAs(tenantEmail, TENANT_PASSWORD);

    // Tenant raises a request (it will be OPEN — visible in all-open scope)
    const reqRes = await supertestFn(app.getHttpServer())
      .post("/api/v1/maintenance-requests")
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({
        unitId,
        title: "Broken window",
        description: VALID_DESC,
        priority: "LOW",
      });
    expect(reqRes.status).toBe(201);
    requestId = reqRes.body.id as string;
    cleanup.requestIds.push(requestId);

    const maint = await createMaintenanceUser("sec5-m01maint");
    maintToken = await loginAs(maint.email, maint.tempPassword);
  }, 120_000);

  it("MAINTENANCE scope=all-open: each item has lease_id null or absent", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/maintenance-requests?scope=all-open")
      .set("Authorization", `Bearer ${maintToken}`);
    expect(res.status).toBe(200);

    // Must return an array (data field)
    const items = (res.body.data ?? res.body) as Array<Record<string, unknown>>;
    expect(Array.isArray(items)).toBe(true);

    // Every returned item must have lease_id null or missing
    for (const item of items) {
      const leaseId = "lease_id" in item ? item.lease_id : undefined;
      expect(leaseId === null || leaseId === undefined).toBe(true);
    }
  });

  it("PM scope (no scope=all-open): lease_id present in response items (unchanged)", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/maintenance-requests")
      .set("Authorization", `Bearer ${pmToken}`);
    expect(res.status).toBe(200);

    const items = (res.body.data ?? res.body) as Array<Record<string, unknown>>;
    // PM's property has a request with a lease — at least one item should have lease_id populated
    const withLease = items.filter((i) => i.lease_id !== null && i.lease_id !== undefined);
    expect(withLease.length).toBeGreaterThan(0);
  });

  it("ADMIN scope: lease_id present in response items (unchanged)", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/maintenance-requests`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const items = (res.body.data ?? res.body) as Array<Record<string, unknown>>;
    const withLease = items.filter((i) => i.lease_id !== null && i.lease_id !== undefined);
    // There should be at least one request with a lease (created above)
    expect(withLease.length).toBeGreaterThan(0);
  });
});
