/**
 * Phase 2 — Properties, Units, Users (Admin CRUD) Integration Tests
 *
 * Covers:
 *   BL-03: monthly_rent_paise change blocked when state=OCCUPIED → 409 UNIT_RENT_LOCKED
 *   BL-05: cannot un-retire a unit (DB trigger fires) → integration test
 *   BL-19: assigning a PM already assigned → 409 PM_ALREADY_ASSIGNED
 *   BL-20: rent change to a unit emits an AuditLog row with before/after
 *   Last-admin protection → 409 LAST_ADMIN_PROTECTED
 *   PM-with-property cannot be deactivated → 409 PM_HAS_PROPERTY
 *   405 on DELETE /units/:id and DELETE /users/:id
 *   Property transfer-pm happy path
 *   Cursor pagination on GET /properties
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
// Helpers
// ---------------------------------------------------------------------------

function extractRefreshCookie(headers: Record<string, unknown>): string | undefined {
  const setCookie = headers["set-cookie"];
  if (!setCookie) return undefined;
  const cookies: string[] = Array.isArray(setCookie)
    ? (setCookie as string[])
    : [setCookie as string];
  const rtCookie = cookies.find((c) => typeof c === "string" && c.startsWith("refreshToken="));
  if (!rtCookie) return undefined;
  return rtCookie.split(";")[0]?.replace("refreshToken=", "");
}

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

  // Reset any locked seeded users to prevent 401 cascades from prior test runs
  await prisma.user.updateMany({
    where: { email: { in: [ADMIN_EMAIL, "pm.test@gharsetu.local"] } },
    data: { failed_login_count: 0, locked_until: null, is_active: true },
  });

  // Login as admin to get token
  const loginRes = await supertestFn(app.getHttpServer())
    .post("/api/v1/auth/login")
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

  adminToken = loginRes.body.accessToken as string;
}, 60000);

afterAll(async () => {
  await app.close();
}, 30000);

// ---------------------------------------------------------------------------
// Clean up test data between runs
// ---------------------------------------------------------------------------

let createdPropertyIds: number[] = [];
let createdUnitIds: number[] = [];
let createdUserIds: number[] = [];

afterEach(async () => {
  // Clean up in dependency order:
  // 1. audit_log rows for these entities
  // 2. units (children of properties)
  // 3. property_transfer_logs (FK to properties + users)
  // 4. properties
  // 5. users (test-created non-seed users)

  if (createdUnitIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entity_type: "Unit", entity_id: { in: createdUnitIds.map(String) } } });
    // Force-update is_retired to false so deleteMany doesn't hit trigger (no soft-delete for tests)
    // Actually, we just delete the rows — the trigger only fires on UPDATE, not DELETE.
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
    await prisma.auditLog.deleteMany({ where: { entity_type: "User", entity_id: { in: createdUserIds.map(String) } } });
    await prisma.refreshToken.deleteMany({ where: { user_id: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    createdUserIds = [];
  }
});

// ---------------------------------------------------------------------------
// Helper: create a property and track it for cleanup
// ---------------------------------------------------------------------------

async function createTestProperty(overrides: object = {}) {
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/properties")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: "Test Property",
      address: "123 Test Street",
      city: "Delhi",
      state: "Delhi",
      pincode: "110001",
      ...overrides,
    });
  if (res.body?.id) createdPropertyIds.push(res.body.id as number);
  return res;
}

async function createTestUnit(propertyId: string, overrides: object = {}) {
  const res = await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propertyId}/units`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      unit_number: `U${Date.now()}`,
      bedrooms: 2,
      bathrooms: 1,
      monthly_rent_paise: 1_800_000, // ₹18,000
      ...overrides,
    });
  if (res.body?.id) createdUnitIds.push(res.body.id as number);
  return res;
}

const PM_CREATE_PASSWORD = "TestPass@2026!";

async function createTestPM(emailPrefix: string) {
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      email: `${emailPrefix}-${Date.now()}@test.local`,
      firstName: "Test",
      lastName: "PM",
      role: "PROPERTY_MANAGER",
      password: PM_CREATE_PASSWORD,
    });
  if (res.body?.id) createdUserIds.push(res.body.id as number);
  return res;
}

// ===========================================================================
// PROPERTIES
// ===========================================================================

describe("Properties CRUD", () => {
  it("POST /properties → 201 with required fields", async () => {
    const res = await createTestProperty({ name: "Sharma Residency" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe("Sharma Residency");
    expect(res.body.timezone).toBe("Asia/Kolkata");
  });

  it("GET /properties → 200 with pagination meta", async () => {
    await createTestProperty({ name: "Prop A" });
    await createTestProperty({ name: "Prop B" });

    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/properties")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
    expect(typeof res.body.meta.has_more).toBe("boolean");
  });

  it("GET /properties/:id → 200 for existing property", async () => {
    const created = await createTestProperty();
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/properties/${created.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  it("GET /properties/:id → 404 for unknown ID", async () => {
    // IDs are now BIGSERIAL ints; a non-numeric string returns 400, not 404.
    // Use a valid numeric ID that does not exist.
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/properties/999999999")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("PATCH /properties/:id → 200 updates metadata", async () => {
    const created = await createTestProperty({ name: "Old Name" });
    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/properties/${created.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "New Name" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("New Name");
  });

  it("PATCH /properties/:id writes AuditLog (BL-20)", async () => {
    const created = await createTestProperty({ name: "Before" });
    await supertestFn(app.getHttpServer())
      .patch(`/api/v1/properties/${created.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "After" });

    const log = await prisma.auditLog.findFirst({
      where: { entity_type: "Property", entity_id: String(created.body.id), action: "property.update" },
    });
    expect(log).not.toBeNull();
    expect(log?.before).toBeDefined();
    expect(log?.after).toBeDefined();
  });

  it("DELETE /properties/:id → 200 soft-delete (sets deleted_at)", async () => {
    const created = await createTestProperty();
    const res = await supertestFn(app.getHttpServer())
      .delete(`/api/v1/properties/${created.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    // Should no longer appear in list
    const found = await prisma.property.findFirst({
      where: { id: created.body.id, deleted_at: null },
    });
    expect(found).toBeNull();
  });
});

// ===========================================================================
// PROPERTIES — PM Transfer (BL-19, BL-20)
// ===========================================================================

describe("Properties PM Transfer", () => {
  it("POST /properties/:id/transfer-pm → 200 assigns a PM", async () => {
    const prop = await createTestProperty();
    const pm = await createTestPM("pm-assign");

    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${prop.body.id}/transfer-pm`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ toPmId: pm.body.id });

    expect(res.status).toBe(200);
    expect(res.body.active_pm_id).toBe(pm.body.id);

    // Cleanup: unassign before afterEach deletes property/user
    await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${prop.body.id}/transfer-pm`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ toPmId: null });
  });

  it("BL-19: assigning PM already assigned → 409 PM_ALREADY_ASSIGNED", async () => {
    const prop1 = await createTestProperty({ name: "Property 1" });
    const prop2 = await createTestProperty({ name: "Property 2" });
    const pm = await createTestPM("pm-bl19");

    // Assign PM to prop1
    await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${prop1.body.id}/transfer-pm`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ toPmId: pm.body.id });

    // Try to assign same PM to prop2 → should fail
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${prop2.body.id}/transfer-pm`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ toPmId: pm.body.id });

    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe("PM_ALREADY_ASSIGNED");

    // Cleanup: unassign from prop1
    await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${prop1.body.id}/transfer-pm`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ toPmId: null });
  });

  it("BL-19: non-PM user as toPmId → 400 INVALID_PM_ROLE", async () => {
    const prop = await createTestProperty();
    const maint = await supertestFn(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: `maint-${Date.now()}@test.local`, firstName: "Staff", lastName: "User", role: "MAINTENANCE", password: PM_CREATE_PASSWORD, specialization: "general" });
    if (maint.body?.id) createdUserIds.push(maint.body.id as number);

    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${prop.body.id}/transfer-pm`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ toPmId: maint.body.id });

    expect(res.status).toBe(400);
    expect(res.body.error?.code).toBe("INVALID_PM_ROLE");
  });

  it("POST /properties/:id/transfer-pm writes PropertyTransferLog (BL-20)", async () => {
    const prop = await createTestProperty();
    const pm = await createTestPM("pm-transfer-log");

    await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${prop.body.id}/transfer-pm`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ toPmId: pm.body.id, note: "Initial assignment" });

    const log = await prisma.propertyTransferLog.findFirst({
      where: { property_id: prop.body.id },
    });
    expect(log).not.toBeNull();
    expect(log?.to_pm_id).toBe(pm.body.id);
    expect(log?.note).toBe("Initial assignment");

    // Cleanup
    await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${prop.body.id}/transfer-pm`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ toPmId: null });
  });
});

// ===========================================================================
// UNITS
// ===========================================================================

describe("Units CRUD", () => {
  it("POST /properties/:id/units → 201 with AVAILABLE state", async () => {
    const prop = await createTestProperty();
    const res = await createTestUnit(prop.body.id, { unit_number: "1A" });
    expect(res.status).toBe(201);
    expect(res.body.state).toBe(0); // UnitState.AVAILABLE = 0
    expect(res.body.is_retired).toBe(false);
    expect(res.body.monthly_rent_paise).toBe(1_800_000);
  });

  it("GET /units/:id → 200 returns unit", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.body.id, { unit_number: "2A" });

    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/units/${unit.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(unit.body.id);
  });

  it("Duplicate unit_number within property → 409", async () => {
    const prop = await createTestProperty();
    await createTestUnit(prop.body.id, { unit_number: "DUP" });
    const res = await createTestUnit(prop.body.id, { unit_number: "DUP" });
    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe("UNIT_NUMBER_DUPLICATE");
  });

  it("DELETE /units/:id → 405 (BL-05)", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.body.id, { unit_number: "DEL" });

    const res = await supertestFn(app.getHttpServer())
      .delete(`/api/v1/units/${unit.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(405);
  });
});

// ===========================================================================
// UNITS — BL-03: Rent lock when state = OCCUPIED / MAINTENANCE
// ===========================================================================

describe("BL-03: Unit rent lock", () => {
  it("PATCH /units/:id with monthly_rent_paise when AVAILABLE → 200 (allowed)", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.body.id, { unit_number: "BL03A" });

    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/units/${unit.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ monthly_rent_paise: 2_000_000 }); // ₹20,000

    expect(res.status).toBe(200);
    expect(res.body.monthly_rent_paise).toBe(2_000_000);
  });

  it("PATCH /units/:id with monthly_rent_paise when OCCUPIED → 409 UNIT_RENT_LOCKED (BL-03)", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.body.id, { unit_number: "BL03B" });

    // Transition to LISTED then OCCUPIED
    await supertestFn(app.getHttpServer())
      .patch(`/api/v1/units/${unit.body.id}/state`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ state: "LISTED" });

    await supertestFn(app.getHttpServer())
      .patch(`/api/v1/units/${unit.body.id}/state`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ state: "OCCUPIED" });

    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/units/${unit.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ monthly_rent_paise: 2_000_000 });

    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe("UNIT_RENT_LOCKED");
  });

  it("PATCH /units/:id with monthly_rent_paise when MAINTENANCE → 409 UNIT_RENT_LOCKED (BL-03)", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.body.id, { unit_number: "BL03C" });

    // Transition to MAINTENANCE
    await supertestFn(app.getHttpServer())
      .patch(`/api/v1/units/${unit.body.id}/state`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ state: "MAINTENANCE" });

    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/units/${unit.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ monthly_rent_paise: 2_000_000 });

    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe("UNIT_RENT_LOCKED");
  });

  it("BL-20: rent change emits AuditLog with before/after", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.body.id, { unit_number: "BL20A" });

    await supertestFn(app.getHttpServer())
      .patch(`/api/v1/units/${unit.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ monthly_rent_paise: 2_500_000 });

    const log = await prisma.auditLog.findFirst({
      where: { entity_type: "Unit", entity_id: String(unit.body.id), action: "unit.update" },
    });
    expect(log).not.toBeNull();
    const before = log?.before as Record<string, unknown>;
    const after = log?.after as Record<string, unknown>;
    expect(before?.monthly_rent_paise).toBe(1_800_000);
    expect(after?.monthly_rent_paise).toBe(2_500_000);
  });
});

// ===========================================================================
// UNITS — BL-05: Retirement is one-way
// ===========================================================================

describe("BL-05: Unit retirement is one-way", () => {
  it("POST /units/:id/retire → 200 sets is_retired=true", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.body.id, { unit_number: "RET1" });

    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/units/${unit.body.id}/retire`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.is_retired).toBe(true);
    expect(res.body.retired_at).not.toBeNull();
  });

  it("Attempting to un-retire via PATCH → DB trigger rejects it (BL-05)", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.body.id, { unit_number: "RET2" });

    // Retire the unit
    await supertestFn(app.getHttpServer())
      .post(`/api/v1/units/${unit.body.id}/retire`)
      .set("Authorization", `Bearer ${adminToken}`);

    // Try to directly un-retire via the DB — expect DB trigger to fire
    // We test this by calling $queryRaw directly (bypasses service layer)
    await expect(
      prisma.$queryRaw`UPDATE units SET is_retired = false WHERE id = ${unit.body.id}`
    ).rejects.toThrow();
  });

  it("Retiring already-retired unit → 409 UNIT_ALREADY_RETIRED", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.body.id, { unit_number: "RET3" });

    await supertestFn(app.getHttpServer())
      .post(`/api/v1/units/${unit.body.id}/retire`)
      .set("Authorization", `Bearer ${adminToken}`);

    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/units/${unit.body.id}/retire`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe("UNIT_ALREADY_RETIRED");
  });

  it("PATCH /units/:id after retirement → 409 UNIT_RETIRED (service-level guard)", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.body.id, { unit_number: "RET4" });

    await supertestFn(app.getHttpServer())
      .post(`/api/v1/units/${unit.body.id}/retire`)
      .set("Authorization", `Bearer ${adminToken}`);

    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/units/${unit.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ bedrooms: 3 });

    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe("UNIT_RETIRED");
  });
});

// ===========================================================================
// UNITS — State machine (BL-04)
// ===========================================================================

describe("Unit state machine (BL-04)", () => {
  it("Illegal transition → 409 UNIT_STATUS_BLOCKED", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.body.id, { unit_number: "SM1" });

    // AVAILABLE → OCCUPIED is not a legal direct transition
    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/units/${unit.body.id}/state`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ state: "OCCUPIED" });

    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe("UNIT_STATUS_BLOCKED");
  });

  it("Legal transition AVAILABLE → LISTED → 200", async () => {
    const prop = await createTestProperty();
    const unit = await createTestUnit(prop.body.id, { unit_number: "SM2" });

    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/units/${unit.body.id}/state`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ state: "LISTED" });

    expect(res.status).toBe(200);
    expect(res.body.state).toBe(1); // UnitState.LISTED = 1
  });
});

// ===========================================================================
// USERS — Admin CRUD
// ===========================================================================

describe("Users Admin CRUD", () => {
  it("POST /users → 201 creates user (no public sign-up path)", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: `newuser-${Date.now()}@test.local`,
        firstName: "New",
        lastName: "User",
        role: "MAINTENANCE",
        password: PM_CREATE_PASSWORD,
        specialization: "Plumbing",
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    if (res.body?.id) createdUserIds.push(res.body.id as number);
  });

  it("GET /users → 200 with pagination", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("GET /users?role=ADMIN → filters by role", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/users?role=ADMIN")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((u: { role: number }) => u.role === 0)).toBe(true); // Role.ADMIN = 0
  });

  it("DELETE /users/:id → 405 (BL-05 analog for users)", async () => {
    const created = await supertestFn(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: `del-${Date.now()}@test.local`, firstName: "Del", lastName: "User", role: "MAINTENANCE", password: PM_CREATE_PASSWORD, specialization: "general" });
    if (created.body?.id) createdUserIds.push(created.body.id as number);

    const res = await supertestFn(app.getHttpServer())
      .delete(`/api/v1/users/${created.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(405);
  });

  it("POST /users/:id/deactivate → 200 deactivates user", async () => {
    const created = await supertestFn(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: `deact-${Date.now()}@test.local`, firstName: "Deact", lastName: "User", role: "MAINTENANCE", password: PM_CREATE_PASSWORD, specialization: "general" });
    if (created.body?.id) createdUserIds.push(created.body.id as number);

    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/users/${created.body.id}/deactivate`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.is_active).toBe(false);
  });

  it("POST /users/:id/activate → 200 reactivates user", async () => {
    const created = await supertestFn(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: `react-${Date.now()}@test.local`, firstName: "React", lastName: "User", role: "MAINTENANCE", password: PM_CREATE_PASSWORD, specialization: "general" });
    if (created.body?.id) createdUserIds.push(created.body.id as number);

    await supertestFn(app.getHttpServer())
      .post(`/api/v1/users/${created.body.id}/deactivate`)
      .set("Authorization", `Bearer ${adminToken}`);

    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/users/${created.body.id}/activate`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.is_active).toBe(true);
  });
});

// ===========================================================================
// USERS — Last-admin protection (H-01 security fix coverage)
// ===========================================================================

describe("Last-admin protection", () => {
  it("PATCH /users/:id with role change on last Admin → 409 LAST_ADMIN_PROTECTED", async () => {
    // Count current admins first
    const admins = await prisma.user.findMany({ where: { role: 0, is_active: true } });
    if (admins.length > 1) {
      // Can't test last-admin with multiple admins — skip gracefully
      return;
    }

    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/users/${admins[0]!.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "MAINTENANCE" });

    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe("LAST_ADMIN_PROTECTED");
  });

  it("POST /users/:id/deactivate on last Admin → 409 LAST_ADMIN_PROTECTED", async () => {
    const admins = await prisma.user.findMany({ where: { role: 0, is_active: true } });
    if (admins.length > 1) return;

    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/users/${admins[0]!.id}/deactivate`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe("LAST_ADMIN_PROTECTED");
  });

  // H-01 fix: PATCH with is_active=false on last Admin must also be blocked
  it("H-01: PATCH /users/:id { is_active: false } on last Admin → 409 LAST_ADMIN_PROTECTED", async () => {
    const admins = await prisma.user.findMany({ where: { role: 0, is_active: true } });
    if (admins.length > 1) {
      // Deactivate down to one admin first, then test the guard
      // Sort to preserve the seeded admin (which we use for auth)
      const toDeactivate = admins.filter((a) => a.email !== ADMIN_EMAIL);
      for (const a of toDeactivate) {
        await prisma.user.update({ where: { id: a.id }, data: { is_active: false } });
      }
    }

    const soleAdmin = await prisma.user.findFirst({ where: { role: 0, is_active: true } });
    expect(soleAdmin).not.toBeNull();

    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/users/${soleAdmin!.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ is_active: false });

    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe("LAST_ADMIN_PROTECTED");
  });

  // H-01 fix: with two admins, deactivating one succeeds; then the second is blocked
  it("H-01: two admins — deactivate one succeeds, deactivate second → 409 LAST_ADMIN_PROTECTED", async () => {
    // Create a second admin
    const secondAdmin = await supertestFn(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        email: `secondadmin-${Date.now()}@test.local`,
        firstName: "Second",
        lastName: "Admin",
        role: "ADMIN",
        password: PM_CREATE_PASSWORD,
      });
    expect(secondAdmin.status).toBe(201);
    if (secondAdmin.body?.id) createdUserIds.push(secondAdmin.body.id as number);

    // Deactivate the second admin via PATCH is_active=false — should succeed
    const deact1 = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/users/${secondAdmin.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ is_active: false });
    expect(deact1.status).toBe(200);
    expect(deact1.body.is_active).toBe(false);

    // Now only one admin remains — trying to deactivate via PATCH must fail
    const soleAdmin = await prisma.user.findFirst({ where: { role: 0, is_active: true } });
    expect(soleAdmin).not.toBeNull();

    const deact2 = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/users/${soleAdmin!.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ is_active: false });
    expect(deact2.status).toBe(409);
    expect(deact2.body.error?.code).toBe("LAST_ADMIN_PROTECTED");

    // Re-activate secondAdmin so cleanup doesn't leave a dangling inactive user
    await prisma.user.update({ where: { id: secondAdmin.body.id }, data: { is_active: true } });
  });

  // H-01 regression: role-change path still protected (prior behavior preserved)
  it("H-01 regression: role demotion guard still fires after is_active fix", async () => {
    const admins = await prisma.user.findMany({ where: { role: 0, is_active: true } });
    if (admins.length > 1) return; // Only meaningful with one admin

    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/users/${admins[0]!.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "MAINTENANCE" });

    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe("LAST_ADMIN_PROTECTED");
  });

  // H-01: POST /users/:id/deactivate also uses serializable guard
  it("H-01: POST /deactivate on last Admin → 409 (separate code path, serializable tx)", async () => {
    const admins = await prisma.user.findMany({ where: { role: 0, is_active: true } });
    if (admins.length > 1) return;

    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/users/${admins[0]!.id}/deactivate`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe("LAST_ADMIN_PROTECTED");
  });
});

// ===========================================================================
// USERS — PM with active property cannot be deactivated
// ===========================================================================

describe("PM-has-property guards", () => {
  it("POST /users/:id/deactivate on PM with active property → 409 PM_HAS_PROPERTY", async () => {
    const prop = await createTestProperty({ name: "PM Guard Test" });
    const pm = await createTestPM("pmguard");

    // Assign PM to property
    await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${prop.body.id}/transfer-pm`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ toPmId: pm.body.id });

    // Try to deactivate the PM while assigned
    const res = await supertestFn(app.getHttpServer())
      .post(`/api/v1/users/${pm.body.id}/deactivate`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe("PM_HAS_PROPERTY");

    // Cleanup: unassign
    await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${prop.body.id}/transfer-pm`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ toPmId: null });
  });

  it("PATCH /users/:id changing PM role while assigned → 409 PM_HAS_PROPERTY", async () => {
    const prop = await createTestProperty({ name: "PM Role Change Test" });
    const pm = await createTestPM("pmrole");

    await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${prop.body.id}/transfer-pm`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ toPmId: pm.body.id });

    const res = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/users/${pm.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "MAINTENANCE" });

    expect(res.status).toBe(409);
    expect(res.body.error?.code).toBe("PM_HAS_PROPERTY");

    // Cleanup
    await supertestFn(app.getHttpServer())
      .post(`/api/v1/properties/${prop.body.id}/transfer-pm`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ toPmId: null });
  });
});

// ===========================================================================
// ROLE GUARD — non-admin cannot access admin endpoints
// ===========================================================================

describe("Role guard — admin endpoints blocked for non-admin", () => {
  let pmToken: string;

  beforeAll(async () => {
    // Login as the seed PM user
    const loginRes = await supertestFn(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: "pm.test@gharsetu.local", password: "Password#123" });
    pmToken = loginRes.body.accessToken as string;
  });

  it("GET /properties as PROPERTY_MANAGER → 200 (PM sees own property)", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/properties")
      .set("Authorization", `Bearer ${pmToken}`);
    // PM role is allowed on GET /properties (@Roles("ADMIN","PROPERTY_MANAGER"))
    expect(res.status).toBe(200);
  });

  it("GET /users as PROPERTY_MANAGER → 200 (PM allowed per @Roles('ADMIN','PROPERTY_MANAGER'))", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${pmToken}`);
    expect(res.status).toBe(200);
  });
});
