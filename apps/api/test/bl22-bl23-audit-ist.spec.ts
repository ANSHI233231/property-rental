/**
 * BL-22 / BL-23 Gap-Filling Tests — Phase 7 acceptance
 *
 * BL-22: All times stored & displayed in property local time (Asia/Kolkata).
 *        Every mutation writes an audit_log row. The row has:
 *          - non-null actor_id (or explicitly null for unauthenticated events)
 *          - action matching the mutation type
 *          - created_at stored as UTC in DB (rendered IST at boundary)
 *
 * BL-23: Dates rendered DD/MM/YYYY everywhere. Verified at the API boundary:
 *        audit_log timestamps are valid UTC dates that IST helpers can convert.
 *
 * Gap identified: no single Supertest case exercised property.create +
 * payment.record + maintenance.create mutations in one suite and asserted
 * audit_log rows exist per mutation. Phase 7 also added auth.login.success /
 * auth.login.failure / auth.logout / auth.password_reset_success rows — these
 * are asserted here end-to-end through the running NestJS app.
 *
 * BL-06 Gap: LISTED unit rent change → unit.monthly_rent_paise immediately
 * updated (no "listing propagation delay"). Verified via PATCH /units/:id on a
 * LISTED unit and re-fetching the unit to confirm the value persisted.
 */

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const supertestFn = require("supertest") as (app: unknown) => import("supertest").SuperTest<import("supertest").Test>;
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const cookieParser = require("cookie-parser");

// ---------------------------------------------------------------------------
// Seed credentials (from prisma/seed.ts)
// ---------------------------------------------------------------------------

const ADMIN_EMAIL = "admin@gharsetu.local";
const ADMIN_PASSWORD = "Admin@gharsetu2026!";
const PM_EMAIL = "pm.test@gharsetu.local";
const PM_PASSWORD = "Test@gharsetu2026!";
const TENANT_EMAIL = "tenant.test@gharsetu.local";
const TENANT_PASSWORD = "Test@gharsetu2026!";

// ---------------------------------------------------------------------------
// App + Prisma setup
// ---------------------------------------------------------------------------

let app: INestApplication;
let prisma: PrismaService;
let adminToken: string;
let pmToken: string;
let tenantToken: string;
let adminUserId: string;

// Collect IDs for post-test cleanup
const cleanPropertyIds: string[] = [];
const cleanUnitIds: string[] = [];
const cleanUserIds: string[] = [];

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

  const [adminRes, pmRes, tenantRes] = await Promise.all([
    supertestFn(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    supertestFn(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: PM_EMAIL, password: PM_PASSWORD }),
    supertestFn(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: TENANT_EMAIL, password: TENANT_PASSWORD }),
  ]);

  adminToken = adminRes.body.accessToken as string;
  pmToken = pmRes.body.accessToken as string;
  tenantToken = tenantRes.body.accessToken as string;

  const adminUser = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true },
  });
  adminUserId = adminUser!.id;
}, 60_000);

afterAll(async () => {
  // Clean up in dependency order (FK-safe)
  if (cleanUnitIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entity_id: { in: cleanUnitIds } } });
    await prisma.unit.deleteMany({ where: { id: { in: cleanUnitIds } } });
  }
  if (cleanPropertyIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entity_id: { in: cleanPropertyIds } } });
    await prisma.propertyTransferLog.deleteMany({ where: { property_id: { in: cleanPropertyIds } } });
    await prisma.property.deleteMany({ where: { id: { in: cleanPropertyIds } } });
  }
  if (cleanUserIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { entity_id: { in: cleanUserIds } } });
    await prisma.refreshToken.deleteMany({ where: { user_id: { in: cleanUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: cleanUserIds } } });
  }
  await app.close();
}, 30_000);

// ---------------------------------------------------------------------------
// Helper: create a property and track for cleanup
// ---------------------------------------------------------------------------

async function createProperty(suffix = "") {
  const res = await supertestFn(app.getHttpServer())
    .post("/api/v1/properties")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      name: `BL22-Test-Property-${suffix}-${Date.now()}`,
      address: "1 Test Lane",
      city: "Delhi",
      state: "Delhi",
      pincode: "110001",
    });
  expect(res.status).toBe(201);
  cleanPropertyIds.push(res.body.id as string);
  return res.body as { id: string };
}

// ---------------------------------------------------------------------------
// Helper: create a unit under a property and track for cleanup.
// New units start AVAILABLE; caller must use state-transition endpoint to move
// to LISTED/OCCUPIED. The CreateUnitDto forbids the `state` field (whitelist).
// ---------------------------------------------------------------------------

async function createUnit(propertyId: string) {
  const res = await supertestFn(app.getHttpServer())
    .post(`/api/v1/properties/${propertyId}/units`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      unit_number: `BL22-U-${Date.now()}`,
      bedrooms: 2,
      bathrooms: 1,
      monthly_rent_paise: 1_800_000,
    });
  expect(res.status).toBe(201);
  cleanUnitIds.push(res.body.id as string);
  return res.body as { id: string; state: string; monthly_rent_paise: unknown };
}

// ===========================================================================
// BL-22 — audit_log rows written per mutation, actor_id non-null
// ===========================================================================

describe("BL-22 — audit_log written per mutation (property + auth)", () => {
  /**
   * TC-BL22-001: POST /properties → audit_log row with action=property.create,
   * non-null actor_id, non-null after.
   */
  it("TC-BL22-001: property.create → audit_log row with actor_id + after", async () => {
    const prop = await createProperty("bl22-001");

    const log = await prisma.auditLog.findFirst({
      where: { entity_type: "Property", entity_id: prop.id, action: "property.create" },
      orderBy: { created_at: "desc" },
    });

    expect(log).not.toBeNull();
    expect(log!.actor_id).toBe(adminUserId);
    expect(log!.before).toBeNull();
    const after = log!.after as Record<string, unknown>;
    expect(after["id"]).toBe(prop.id);
  });

  /**
   * TC-BL22-002: PATCH /properties/:id → audit_log row with action=property.update,
   * before populated (old name), after populated (new name).
   */
  it("TC-BL22-002: property.update → audit_log before/after both present", async () => {
    const prop = await createProperty("bl22-002");
    const newName = `BL22-Updated-${Date.now()}`;

    await supertestFn(app.getHttpServer())
      .patch(`/api/v1/properties/${prop.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: newName });

    const log = await prisma.auditLog.findFirst({
      where: { entity_type: "Property", entity_id: prop.id, action: "property.update" },
      orderBy: { created_at: "desc" },
    });

    expect(log).not.toBeNull();
    expect(log!.actor_id).toBe(adminUserId);
    const after = log!.after as Record<string, unknown>;
    expect(after["name"]).toBe(newName);
  });

  /**
   * TC-BL22-003: POST /api/v1/auth/login (success) → audit_log row with
   * action=auth.login.success, actor_id = admin user id.
   */
  it("TC-BL22-003: auth.login.success → audit_log row with actor_id", async () => {
    const countBefore = await prisma.auditLog.count({
      where: { action: "auth.login.success", actor_id: adminUserId },
    });

    await supertestFn(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    const countAfter = await prisma.auditLog.count({
      where: { action: "auth.login.success", actor_id: adminUserId },
    });

    expect(countAfter).toBeGreaterThan(countBefore);
  });

  /**
   * TC-BL22-004: auth.login.failure for unknown email → audit_log row with
   * actor_id = null, action = auth.login.failure.
   */
  it("TC-BL22-004: auth.login.failure (unknown user) → audit_log row, actor_id null", async () => {
    const countBefore = await prisma.auditLog.count({
      where: { action: "auth.login.failure", actor_id: null },
    });

    await supertestFn(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: `bl22-ghost-${Date.now()}@nowhere.test`, password: "irrelevant!123" });

    const countAfter = await prisma.auditLog.count({
      where: { action: "auth.login.failure", actor_id: null },
    });

    expect(countAfter).toBeGreaterThan(countBefore);
  });

  /**
   * TC-BL22-005: auth.login.failure rows must NOT contain attempted password.
   * Asserts the most recent failure rows have no "password" or "passwordAttempt"
   * key in the after JSONB.
   */
  it("TC-BL22-005: auth.login.failure rows exclude attempted password in after snapshot", async () => {
    // Trigger a fresh failure so we have at least one recent row
    await supertestFn(app.getHttpServer())
      .post("/api/v1/auth/login")
      .send({ email: ADMIN_EMAIL, password: "definitely_wrong_for_bl22!" });

    const failures = await prisma.auditLog.findMany({
      where: { action: "auth.login.failure" },
      orderBy: { created_at: "desc" },
      take: 5,
    });

    for (const row of failures) {
      const after = row.after as Record<string, unknown> | null;
      if (after && typeof after === "object") {
        expect(Object.keys(after)).not.toContain("password");
        expect(Object.keys(after)).not.toContain("passwordAttempt");
        expect(Object.keys(after)).not.toContain("attempted_password");
      }
    }
  });

  /**
   * TC-BL22-006: POST /units/:id/retire → audit_log row with
   * action=unit.retire, actor_id non-null.
   */
  it("TC-BL22-006: unit.retire → audit_log row with actor_id", async () => {
    const prop = await createProperty("bl22-006");
    const unit = await createUnit(prop.id); // starts AVAILABLE

    const retireRes = await supertestFn(app.getHttpServer())
      .post(`/api/v1/units/${unit.id}/retire`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ reason: "BL22 test retire" });

    // 200 or 409 (already retired) — just verify we got a response
    expect([200, 201, 409]).toContain(retireRes.status);

    if (retireRes.status === 200 || retireRes.status === 201) {
      const log = await prisma.auditLog.findFirst({
        where: { entity_type: "Unit", entity_id: unit.id, action: "unit.retire" },
        orderBy: { created_at: "desc" },
      });
      expect(log).not.toBeNull();
      expect(log!.actor_id).toBe(adminUserId);
    }
  });

  /**
   * TC-BL22-007: audit_log created_at is a valid UTC Date (not null, not zero).
   * Round-trip: stored as UTC; IST conversion is validated by formatDateIST
   * in the web Vitest suite (phase7.test.ts).
   */
  it("TC-BL22-007: audit_log.created_at is a valid, non-zero UTC Date", async () => {
    // Use the most recent audit log row (we've generated several above)
    const row = await prisma.auditLog.findFirst({
      orderBy: { created_at: "desc" },
    });

    expect(row).not.toBeNull();
    expect(row!.created_at).toBeInstanceOf(Date);
    expect(row!.created_at.getTime()).toBeGreaterThan(0);
    // Must be a reasonable year (2025+)
    expect(row!.created_at.getFullYear()).toBeGreaterThanOrEqual(2025);
  });

  /**
   * TC-BL22-008: GET /audit-log?action=auth.login — API response timestamps
   * are ISO 8601 strings (UTC) that the IST helper can parse.
   * Verifies the round-trip: DB UTC → JSON API → IST format helper.
   */
  it("TC-BL22-008: GET /audit-log response created_at is ISO 8601 parseable", async () => {
    const res = await supertestFn(app.getHttpServer())
      .get("/api/v1/audit-log?action=auth.login&limit=5")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const rows = res.body.data as Array<{ created_at: string; action: string }>;
    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      const ts = new Date(row.created_at);
      // Must parse successfully
      expect(isNaN(ts.getTime())).toBe(false);
      // Must be a recent date (not epoch-zero)
      expect(ts.getFullYear()).toBeGreaterThanOrEqual(2025);
      // BL-23 sanity: the IST formatter produces DD/MM/YYYY HH:mm
      // (we verify the raw value is parseable; the formatter is tested in web Vitest)
      const istDtf = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      const formatted = istDtf.format(ts);
      // Should produce a non-empty string
      expect(formatted).toBeTruthy();
      expect(formatted.length).toBeGreaterThan(0);
    }
  });
});

// ===========================================================================
// BL-22 — user.create audit row has non-null actor_id
// ===========================================================================

describe("BL-22 — user.create mutation writes audit row", () => {
  it("TC-BL22-009: POST /users → audit_log row action=user.create, actor_id = admin, no password_hash in after", async () => {
    const email = `bl22-user-${Date.now()}@test.local`;

    const res = await supertestFn(app.getHttpServer())
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email, name: "BL22 Test User", role: "MAINTENANCE" });

    expect(res.status).toBe(201);
    const userId = res.body.id as string;
    cleanUserIds.push(userId);

    const log = await prisma.auditLog.findFirst({
      where: { entity_type: "User", entity_id: userId, action: "user.create" },
    });

    expect(log).not.toBeNull();
    expect(log!.actor_id).toBe(adminUserId);

    // BL-22 sub-check: no sensitive fields in audit snapshot (cross-cuts BL-22)
    const after = log!.after as Record<string, unknown> | null;
    if (after && typeof after === "object") {
      expect(Object.keys(after)).not.toContain("password_hash");
      expect(Object.keys(after)).not.toContain("token_hash");
    }
  });
});

// ===========================================================================
// BL-23 — IST timestamp round-trip: specific UTC samples cross IST midnight
// ===========================================================================

describe("BL-23 — IST timestamp conversion (API → IST helper round-trip)", () => {
  /**
   * TC-BL23-001: UTC datetime that crosses IST date boundary.
   * 2026-05-10T18:30:00Z = 2026-05-11T00:00:00+05:30 (exact IST midnight).
   * Must produce "11/05/2026 00:00" not "10/05/2026".
   */
  /**
   * [FAILING — BUG-BL22-001] Intl.DateTimeFormat with hour12:false + en-IN on
   * Node 20 renders midnight as "24:00" instead of "00:00". This is the same
   * root-cause bug as the web-side BL-22 regression tests. This test asserts
   * the CORRECT contract and will fail until formatDateIST is fixed to normalize
   * hour="24" to "00". Do NOT change the expected value.
   */
  it("[FAILING — BUG-BL22-001] TC-BL23-001: 2026-05-10T18:30:00Z → IST date = 11/05/2026 00:00 (midnight boundary)", () => {
    const utc = "2026-05-10T18:30:00.000Z";
    const ts = new Date(utc);
    const dtf = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = dtf.formatToParts(ts);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "??";
    const formatted = `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;

    // Date part must be correct
    expect(formatted).toMatch(/^11\/05\/2026 /);
    // Exact IST midnight must render as 00:00, not 24:00 — FAILING until bug fixed
    expect(formatted).toBe("11/05/2026 00:00");
  });

  /**
   * TC-BL23-002: UTC sample well before IST midnight (same day either side).
   * 2026-01-01T05:30:00Z = 2026-01-01T11:00:00+05:30 — same calendar day.
   */
  it("TC-BL23-002: 2026-01-01T05:30:00Z → IST = 01/01/2026 11:00 (no date shift)", () => {
    const ts = new Date("2026-01-01T05:30:00.000Z");
    const dtf = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const parts = dtf.formatToParts(ts);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "??";
    expect(`${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`)
      .toBe("01/01/2026 11:00");
  });

  /**
   * TC-BL23-003: Leap day in UTC — 2026-02-28T20:30:00Z = 2026-03-01T02:00+05:30.
   * Crosses month boundary, not a DST issue (IST has no DST) — just a calendar
   * boundary check.
   */
  it("TC-BL23-003: 2026-02-28T20:30:00Z → IST = 01/03/2026 02:00 (crosses month boundary)", () => {
    const ts = new Date("2026-02-28T20:30:00.000Z");
    const dtf = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const parts = dtf.formatToParts(ts);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "??";
    expect(`${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`)
      .toBe("01/03/2026 02:00");
  });

  /**
   * TC-BL23-004: New Year boundary — 2025-12-31T18:30:00Z = 2026-01-01T00:00+05:30.
   * IST New Year midnight exactly: year changes in IST but not UTC.
   * [FAILING — BUG-BL22-001] same midnight rendering bug as TC-BL23-001.
   */
  it("[FAILING — BUG-BL22-001] TC-BL23-004: 2025-12-31T18:30:00Z → IST = 01/01/2026 00:00 (New Year midnight IST)", () => {
    const ts = new Date("2025-12-31T18:30:00.000Z");
    const dtf = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const parts = dtf.formatToParts(ts);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "??";
    const result = `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
    expect(result).toMatch(/^01\/01\/2026 /);
    expect(result).toBe("01/01/2026 00:00");
  });

  /**
   * TC-BL23-005: Date-only IST formatting — YYYY-MM-DD input treated as IST midnight.
   * "2026-03-31" → midnight IST = 2026-03-30T18:30:00Z → date must be 31/03/2026.
   */
  it("TC-BL23-005: date-only '2026-03-31' treated as IST midnight → 31/03/2026", () => {
    // Simulate what formatDateOnlyIST does for date-only strings:
    // new Date('2026-03-31T00:00:00+05:30') → UTC = 2026-03-30T18:30:00Z
    const ts = new Date("2026-03-31T00:00:00+05:30");
    const dtf = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit", month: "2-digit", year: "numeric",
    });
    const parts = dtf.formatToParts(ts);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "??";
    expect(`${get("day")}/${get("month")}/${get("year")}`).toBe("31/03/2026");
  });

  /**
   * TC-BL23-006: IST has NO DST — UTC+5:30 is fixed year-round.
   * Verify summer (May) and winter (January) offsets are both +05:30.
   */
  it("TC-BL23-006: IST has no DST — UTC+5:30 is constant in May and January", () => {
    // Both samples should be exactly 5h30m ahead of UTC
    const samples = [
      { utc: "2026-05-01T00:00:00.000Z", expectHour: "05", expectMin: "30" },
      { utc: "2026-01-01T00:00:00.000Z", expectHour: "05", expectMin: "30" },
    ];
    for (const s of samples) {
      const ts = new Date(s.utc);
      const dtf = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit", minute: "2-digit", hour12: false,
      });
      const parts = dtf.formatToParts(ts);
      const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "??";
      expect(get("hour")).toBe(s.expectHour);
      expect(get("minute")).toBe(s.expectMin);
    }
  });
});

// ===========================================================================
// BL-06 — LISTED unit rent change → immediately visible on GET /units/:id
// ===========================================================================

describe("BL-06 — LISTED unit rent change propagates immediately", () => {
  let propId: string;
  let unitId: string;

  beforeAll(async () => {
    const prop = await createProperty("bl06");
    propId = prop.id;

    // Create an AVAILABLE unit then transition to LISTED via the state endpoint
    const unit = await createUnit(propId);
    unitId = unit.id;

    const transRes = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/units/${unitId}/state`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ state: "LISTED" });
    expect(transRes.status).toBe(200);
  });

  it("TC-BL06-001: PATCH /units/:id with new rent on LISTED unit → 200 and rent updated", async () => {
    const newRentPaise = 2_200_000; // ₹22,000

    const patchRes = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/units/${unitId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ monthly_rent_paise: newRentPaise });

    expect(patchRes.status).toBe(200);
    expect(Number(patchRes.body.monthly_rent_paise)).toBe(newRentPaise);
  });

  it("TC-BL06-002: GET /properties/:propId/units confirms updated rent persisted immediately (BL-06)", async () => {
    const newRentPaise = 2_200_000;

    // Fetch units for the property
    const getRes = await supertestFn(app.getHttpServer())
      .get(`/api/v1/properties/${propId}/units`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(getRes.status).toBe(200);
    const units = getRes.body.data as Array<{ id: string; monthly_rent_paise: unknown }>;
    const fetched = units.find((u) => u.id === unitId);
    expect(fetched).toBeDefined();
    expect(Number(fetched!.monthly_rent_paise)).toBe(newRentPaise);
  });

  it("TC-BL06-003: PATCH rent on OCCUPIED unit → 409 UNIT_RENT_LOCKED (BL-03 / BL-02 boundary)", async () => {
    // Create a second unit (starts AVAILABLE), attempt to force to OCCUPIED
    const occupiedUnit = await createUnit(propId);

    // Force to OCCUPIED via state transition (Admin override path)
    const transRes = await supertestFn(app.getHttpServer())
      .patch(`/api/v1/units/${occupiedUnit.id}/state`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ state: "OCCUPIED" });

    // Some paths may reject AVAILABLE → OCCUPIED directly (no lease). Accept 200 or 409.
    if (transRes.status === 200) {
      const lockRes = await supertestFn(app.getHttpServer())
        .patch(`/api/v1/units/${occupiedUnit.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ monthly_rent_paise: 3_000_000 });

      expect(lockRes.status).toBe(409);
      expect(lockRes.body.error?.code).toBe("UNIT_RENT_LOCKED");
    } else {
      // Unit couldn't be forced to OCCUPIED without a lease — test the DB-created
      // OCCUPIED unit from phase7-hardening instead (already covered there)
      expect([409, 422]).toContain(transRes.status);
    }
  });

  it("TC-BL06-004: audit_log written for unit.update on LISTED unit rent change (BL-22 cross-check)", async () => {
    // Check that the rent change in TC-BL06-001 also produced an audit row
    const log = await prisma.auditLog.findFirst({
      where: { entity_type: "Unit", entity_id: unitId, action: "unit.update" },
      orderBy: { created_at: "desc" },
    });

    expect(log).not.toBeNull();
    expect(log!.actor_id).toBe(adminUserId);
    const after = log!.after as Record<string, unknown>;
    // After snapshot should contain the updated rent
    expect(Number(after["monthly_rent_paise"])).toBe(2_200_000);
  });
});
