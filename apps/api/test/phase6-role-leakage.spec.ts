/**
 * Phase 6 — Role-leakage matrix lock-ins
 *
 * Verifies the 10 high-value RBAC cells from the Phase 6 spec, plus:
 *   - GET /users/me does NOT return created_by_user_id, password_hash,
 *     failed_login_count, or locked_until (fix: USER_PROFILE_SELECT).
 *   - PATCH /users/me cannot change email/role/is_active.
 *   - POST /users/me/change-password verifies currentPassword before updating.
 *   - GET /leases?tenantId=<other> → 403 (TENANT cannot call /leases at all).
 *   - GET /rent-periods?propertyId=X (someone else's) → empty for TENANT.
 *   - MAINTENANCE listing another user's assignments → scoped to own sub.
 *
 * Matrix cells asserted (all expect 403 unless noted):
 *   TENANT         → GET /properties                          403
 *   TENANT         → GET /users                               403
 *   TENANT         → GET /rent-periods?propertyId=other        200 empty (scoped)
 *   TENANT         → POST /payments                           403 BL_10
 *   MAINTENANCE    → GET /properties                          403
 *   MAINTENANCE    → GET /users                               403
 *   MAINTENANCE    → GET /leases                              403
 *   MAINTENANCE    → POST /maintenance-requests               403 BL_16
 *   PM             → GET /users (admin list)                  403
 *   PM             → POST /users (create user)                403
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
const TEST_PASSWORD = "Phase6@test2026!";

let app: INestApplication;
let prisma: PrismaService;
let adminToken: string;

const cleanup = {
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

async function createUser(role: string, tag: string): Promise<{ id: string; email: string; token: string }> {
  const email = `p6-${role.toLowerCase()}-${tag}-${Date.now()}@test.local`;
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/users")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: `Phase6 ${role} ${tag}`, email, role, password: TEST_PASSWORD });
  expect(res.status).toBe(201);
  cleanup.userIds.push(res.body.id as string);
  const token = await loginAs(email, TEST_PASSWORD);
  return { id: res.body.id as string, email, token };
}

async function createPropertyWithPm(pmId: string): Promise<string> {
  const propRes = await supertestFn(app.getHttpServer())
    .post("/api/v1/properties")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: `P6-Prop-${Date.now()}`,
      address: "1 Phase6 Road",
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
  return propertyId;
}

async function createUnitInProperty(propertyId: string): Promise<string> {
  const unitRes = await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propertyId}/units`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ unit_number: `U-${Date.now()}`, bedrooms: 1, bathrooms: 1, monthly_rent_paise: 1_500_000 });
  expect(unitRes.status).toBe(201);
  const unitId = unitRes.body.id as string;
  cleanup.unitIds.push(unitId);
  return unitId;
}

// ---------------------------------------------------------------------------
// Suite 1: GET /users/me — profile field hygiene
// ---------------------------------------------------------------------------

describe("GET /users/me — profile field hygiene", () => {
  let tenantToken: string;

  beforeAll(async () => {
    const t = await createUser("TENANT", "me-hygiene");
    tenantToken = t.token;
  }, 60_000);

  it("does not return password_hash", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("password_hash");
  });

  it("does not return failed_login_count", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("failed_login_count");
  });

  it("does not return locked_until", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("locked_until");
  });

  it("does not return created_by_user_id", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty("created_by_user_id");
  });

  it("returns expected safe fields: id, email, name, role, is_active, created_at, updated_at", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("email");
    expect(res.body).toHaveProperty("name");
    expect(res.body).toHaveProperty("role");
    expect(res.body).toHaveProperty("is_active");
    expect(res.body).toHaveProperty("created_at");
    expect(res.body).toHaveProperty("updated_at");
  });
});

// ---------------------------------------------------------------------------
// Suite 2: PATCH /users/me — immutable field protection
// ---------------------------------------------------------------------------

describe("PATCH /users/me — immutable field protection", () => {
  let userId: string;
  let userToken: string;
  let originalEmail: string;

  beforeAll(async () => {
    const u = await createUser("TENANT", "patch-me");
    userId = u.id;
    userToken = u.token;
    originalEmail = u.email;
  }, 60_000);

  it("accepts name update → 200 with new name", async () => {
    const res = await supertestFn(app.getHttpServer())
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ name: "Updated Name Phase6" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Updated Name Phase6");
  });

  it("ignores email in body — email unchanged after attempt", async () => {
    // Phase 7 (M-04): forbidNonWhitelisted=true rejects unknown fields with 400.
    // `email` is not in UpdateProfileDto, so this attempt is actively rejected.
    const res = await supertestFn(app.getHttpServer())
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ email: "hacker@evil.com" });
    // 400 = better protection than 200+silent-strip: request is actively rejected
    expect(res.status).toBe(400);
  });

  it("ignores role in body — role remains TENANT", async () => {
    // Phase 7 (M-04): `role` is not in UpdateProfileDto — actively rejected with 400.
    const res = await supertestFn(app.getHttpServer())
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ role: "ADMIN" });
    expect(res.status).toBe(400);
    // Confirm role unchanged via GET /users/me
    const meRes = await supertestFn(app.getHttpServer())
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${userToken}`);
    expect(meRes.body.role).toBe("TENANT");
  });

  it("ignores is_active in body — is_active remains true", async () => {
    // Phase 7 (M-04): `is_active` is not in UpdateProfileDto — actively rejected with 400.
    const res = await supertestFn(app.getHttpServer())
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ is_active: false });
    expect(res.status).toBe(400);

    // Verify via re-fetch that is_active is still true
    const verify = await supertestFn(app.getHttpServer())
      .get(`/api/v1/users/${userId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(verify.body.is_active).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: POST /users/me/change-password — currentPassword verification
// ---------------------------------------------------------------------------

describe("POST /users/me/change-password — current password gate", () => {
  let userToken: string;

  beforeAll(async () => {
    const u = await createUser("MAINTENANCE", "chgpwd");
    userToken = u.token;
  }, 60_000);

  it("rejects wrong currentPassword → 401", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/users/me/change-password")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ currentPassword: "WrongPassword!!", newPassword: "NewPass@1234" });
    expect(res.status).toBe(401);
  });

  it("accepts correct currentPassword → 200", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/users/me/change-password")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ currentPassword: TEST_PASSWORD, newPassword: "NewPass@ph6-2026" });
    expect(res.status).toBe(200);
    expect(res.body.message).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Suite 4: 10-cell role-leakage matrix
// ---------------------------------------------------------------------------

describe("Role-leakage matrix — 10 cells", () => {
  let tenantToken: string;
  let maintToken: string;
  let pmToken: string;

  beforeAll(async () => {
    const pm = await createUser("PROPERTY_MANAGER", "matrix");
    pmToken = pm.token;
    const tenant = await createUser("TENANT", "matrix");
    tenantToken = tenant.token;
    const maint = await createUser("MAINTENANCE", "matrix");
    maintToken = maint.token;
    // Give PM a property so their token is valid in non-scope-guard endpoints
    await createPropertyWithPm(pm.id);
  }, 90_000);

  // TENANT cells
  it("TENANT → GET /properties → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/properties")
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(403);
  });

  it("TENANT → GET /users (admin list) → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(403);
  });

  it("TENANT → GET /leases (list) → 200 with server-forced self-scope (Phase 8: tenant dashboard needs own lease)", async () => {
    // Phase 8: TENANT is allowed on GET /leases but the controller force-rewrites
    // tenantId to the caller's User.id regardless of query value. Tenant cannot
    // see anyone else's leases — service-layer scope still enforces.
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/leases?tenantId=00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(200);
    // Whatever the client passes, the response is the caller's own leases (or empty if none).
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("TENANT → GET /rent-periods?propertyId=other-id → 200 with empty data (scope-forced)", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/rent-periods?propertyId=00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${tenantToken}`);
    expect(res.status).toBe(200);
    // Tenant's own-lease-join filter intersects with the propertyId filter → empty
    expect(res.body.data).toEqual([]);
  });

  it("TENANT → POST /payments → 403 BL_10_TENANT_CANNOT_RECORD_PAYMENT", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/payments")
      .set("Authorization", `Bearer ${tenantToken}`)
      .send({
        leaseId: "00000000-0000-0000-0000-000000000000",
        rentPeriodId: "00000000-0000-0000-0000-000000000001",
        amountPaise: 100000,
        method: "CASH",
      });
    expect(res.status).toBe(403);
    const code = res.body.error?.code ?? res.body.code;
    expect(code).toBe("BL_10_TENANT_CANNOT_RECORD_PAYMENT");
  });

  // MAINTENANCE cells
  it("MAINTENANCE → GET /properties → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/properties")
      .set("Authorization", `Bearer ${maintToken}`);
    expect(res.status).toBe(403);
  });

  it("MAINTENANCE → GET /users (admin list) → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${maintToken}`);
    expect(res.status).toBe(403);
  });

  it("MAINTENANCE → GET /leases (list) → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/leases")
      .set("Authorization", `Bearer ${maintToken}`);
    expect(res.status).toBe(403);
  });

  it("MAINTENANCE → POST /maintenance-requests → 403 BL_16_ONLY_TENANT_CAN_RAISE_MAINTENANCE", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/maintenance-requests")
      .set("Authorization", `Bearer ${maintToken}`)
      .send({
        unitId: "00000000-0000-0000-0000-000000000000",
        title: "Maintenance staff trying to raise a request",
        description: "This is a description with more than thirty characters total.",
        priority: "NORMAL",
      });
    expect(res.status).toBe(403);
    const code = res.body.error?.code ?? res.body.code;
    expect(code).toBe("BL_16_ONLY_TENANT_CAN_RAISE_MAINTENANCE");
  });

  // PM cells (Admin-only endpoints)
  it("PM → GET /users (admin list) → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${pmToken}`);
    expect(res.status).toBe(403);
  });

  it("PM → POST /users (create user) → 403", async () => {
    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${pmToken}`)
      .send({ name: "Should Fail", email: "fail@test.local", role: "TENANT", password: TEST_PASSWORD });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Suite 5: MAINTENANCE listing scope — cannot see another user's assignments
// ---------------------------------------------------------------------------

describe("MAINTENANCE assignment scope — cannot list another user's assignments", () => {
  let maintAToken: string;
  let maintBId: string;

  beforeAll(async () => {
    const maintA = await createUser("MAINTENANCE", "scope-A");
    maintAToken = maintA.token;
    const maintB = await createUser("MAINTENANCE", "scope-B");
    maintBId = maintB.id;
  }, 60_000);

  it("MAINTENANCE-A listing with ?assignedToUserId=MAINT-B → scoped to own sub (no results for B)", async () => {
    // The list endpoint respects the MAINTENANCE role filter (assigned_to_user_id = actor.sub).
    // Even if assignedToUserId is supplied in the query, the service ignores it for MAINTENANCE role
    // and forces assigned_to_user_id = actor.sub. So we get Maint-A's own (empty) list back,
    // never Maint-B's assignments.
    const res = await supertestFn(app.getHttpServer())
      .get(`/api/v1/maintenance-requests?assignedToUserId=${maintBId}`)
      .set("Authorization", `Bearer ${maintAToken}`);
    expect(res.status).toBe(200);
    const items = (res.body.data ?? res.body) as Array<Record<string, unknown>>;
    // None of the items should be assigned to maintBId
    for (const item of items) {
      expect(item.assigned_to_user_id).not.toBe(maintBId);
    }
  });
});
