/**
 * E2E: maintenance-staff-resolve
 *
 * TC coverage: TC-MAIN-006 (ASSIGNED→IN_PROGRESS→RESOLVED), TC-MAIN-007, TC-MAIN-008, TC-MAIN-009
 * BL coverage: BL-14 (resolution notes >= 20), BL-21 (no close on maintenance view)
 *
 * Tests maintenance staff view:
 * 1. Staff can access /maintenance/dashboard.
 * 2. /maintenance/all-open accessible.
 * 3. ASSIGNED→IN_PROGRESS via /in-progress API.
 * 4. Mark resolved API with valid notes (>= 20 chars) → RESOLVED.
 * 5. Mark resolved with notes < 20 chars → 400 (BL-14 service validation).
 * 6. Staff cannot call /close (BL-21 guard).
 */

import { test, expect } from "@playwright/test";

const API_BASE = "http://localhost:3001/api/v1";

async function getAdminToken(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@gharsetu.local", password: "Admin@gharsetu2026!" }),
    });
    const body = await res.json() as { accessToken?: string; error?: { code?: string } };
    if (body.accessToken) return body.accessToken;
    if (body.error?.code === "TOO_MANY_REQUESTS") {
      await new Promise(r => setTimeout(r, 15000));
      continue;
    }
    throw new Error(`Admin login failed: ${JSON.stringify(body)}`);
  }
  throw new Error("Admin login failed after 5 attempts (rate limit)");
}

async function setupAssignedRequest(): Promise<{
  maintToken: string;
  maintId: string;
  pmToken: string;
  requestId: string;
}> {
  const token = await getAdminToken();
  const ts = Date.now();

  const pmRes = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `PM-Res-${ts}`, email: `pm-res-${ts}@test.local`, role: "PROPERTY_MANAGER", password: "PMpass@9876!" }),
  });
  const pm = await pmRes.json() as { id: string };

  const propRes = await fetch(`${API_BASE}/properties`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `Res Prop ${ts}`, address: "2B", city: "Mumbai", state: "Maharashtra", pincode: "400001" }),
  });
  const prop = await propRes.json() as { id: string };

  await fetch(`${API_BASE}/properties/${prop.id}/transfer-pm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ toPmId: pm.id }),
  });

  const unitRes = await fetch(`${API_BASE}/properties/${prop.id}/units`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ unit_number: `URes-${ts}`, bedrooms: 1, bathrooms: 1, monthly_rent_paise: 1_500_000 }),
  });
  const unit = await unitRes.json() as { id: string };

  const pmLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `pm-res-${ts}@test.local`, password: "PMpass@9876!" }),
  });
  const pmToken = (await pmLoginRes.json() as { accessToken: string }).accessToken;

  const tenantEmail = `ten-res-${ts}@test.local`;
  await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `Tenant Res ${ts}`, email: tenantEmail, role: "TENANT", password: "Tenant@9876!" }),
  });

  const today = new Date().toISOString().slice(0, 10);
  const nextYear = `${new Date().getFullYear() + 1}-12-31`;
  await fetch(`${API_BASE}/properties/${prop.id}/units/${unit.id}/leases`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${pmToken}` },
    body: JSON.stringify({
      startDate: today,
      endDate: nextYear,
      monthlyRentPaise: 1_500_000,
      securityDepositPaise: 3_000_000,
      tenants: [{ name: `Tenant Res ${ts}`, email: tenantEmail, is_primary: true }],
    }),
  });

  const tenantLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: tenantEmail, password: "Tenant@9876!" }),
  });
  const tenantToken = (await tenantLoginRes.json() as { accessToken: string }).accessToken;

  const maintRes = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `Maint Res ${ts}`, email: `maint-res-${ts}@test.local`, role: "MAINTENANCE", password: "Maint@9876!" }),
  });
  const maint = await maintRes.json() as { id: string };

  const maintLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `maint-res-${ts}@test.local`, password: "Maint@9876!" }),
  });
  const maintToken = (await maintLoginRes.json() as { accessToken: string }).accessToken;

  const reqRes = await fetch(`${API_BASE}/maintenance-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tenantToken}` },
    body: JSON.stringify({
      unitId: unit.id,
      title: "Broken light fixture E2E",
      description: "The bedroom ceiling light has stopped working, needs an electrician.",
      priority: "NORMAL",
    }),
  });
  const req = await reqRes.json() as { id: string };

  // Assign to maint
  await fetch(`${API_BASE}/maintenance-requests/${req.id}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${pmToken}` },
    body: JSON.stringify({ assigneeUserId: maint.id }),
  });

  return { maintToken, maintId: maint.id, pmToken, requestId: req.id };
}

test.describe("Maintenance staff resolve flow (BL-14, BL-21)", () => {
  test("Maintenance /maintenance/dashboard page loads", async ({ page, context }) => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    await context.clearCookies();
    await context.addCookies([
      { name: "__loggedIn", value: "1", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
      { name: "__role", value: "MAINTENANCE", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
    ]);
    const response = await page.goto("/maintenance/dashboard");
    expect(response?.status()).toBe(200);
  });

  test("Maintenance /maintenance/all-open route exists in build (TC-NAV-008)", async ({ page, context }) => {
    /**
     * BUG-004 fixed: added `export const dynamic = "force-dynamic"` to
     * apps/web/src/app/(app)/maintenance/all-open/page.tsx.
     *
     * Root cause: Next.js statically pre-rendered the page during build;
     * useAuth() returns null at build time, producing a corrupt static asset
     * that the running server served as 404. force-dynamic opts the route out
     * of static generation so it is always rendered on-demand.
     */
    const expires = Math.floor(Date.now() / 1000) + 3600;
    await context.clearCookies();
    await context.addCookies([
      { name: "__loggedIn", value: "1", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
      { name: "__role", value: "MAINTENANCE", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
    ]);
    const response = await page.goto("/maintenance/all-open");
    const status = response?.status() ?? 0;
    expect(status).not.toBe(404);
    const finalUrl = page.url();
    expect(
      finalUrl.includes("/maintenance/all-open") || finalUrl.includes("/login")
    ).toBe(true);
  });

  test("TC-MAIN-007: ASSIGNED→IN_PROGRESS via /in-progress API", async () => {
    const { maintToken, requestId } = await setupAssignedRequest();

    const res = await fetch(`${API_BASE}/maintenance-requests/${requestId}/in-progress`, {
      method: "POST",
      headers: { Authorization: `Bearer ${maintToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe("IN_PROGRESS");
  });

  test("TC-MAIN-008 (BL-14): resolve with notes < 20 chars → 400", async () => {
    const { maintToken, requestId } = await setupAssignedRequest();

    // Move to IN_PROGRESS first
    await fetch(`${API_BASE}/maintenance-requests/${requestId}/in-progress`, {
      method: "POST",
      headers: { Authorization: `Bearer ${maintToken}` },
    });

    const res = await fetch(`${API_BASE}/maintenance-requests/${requestId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${maintToken}` },
      body: JSON.stringify({ resolutionNotes: "Too short" }), // 9 chars
    });
    expect(res.status).toBe(400);
  });

  test("TC-MAIN-009 (BL-14): resolve with notes >= 20 chars → RESOLVED", async () => {
    const { maintToken, requestId } = await setupAssignedRequest();

    await fetch(`${API_BASE}/maintenance-requests/${requestId}/in-progress`, {
      method: "POST",
      headers: { Authorization: `Bearer ${maintToken}` },
    });

    const res = await fetch(`${API_BASE}/maintenance-requests/${requestId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${maintToken}` },
      body: JSON.stringify({ resolutionNotes: "Replaced the bulb and tested for 10 minutes." }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe("RESOLVED");
  });

  test("BL-21 (API): maintenance staff cannot call /close → 403", async () => {
    const { maintToken, requestId } = await setupAssignedRequest();

    // Drive to RESOLVED
    await fetch(`${API_BASE}/maintenance-requests/${requestId}/in-progress`, {
      method: "POST",
      headers: { Authorization: `Bearer ${maintToken}` },
    });
    await fetch(`${API_BASE}/maintenance-requests/${requestId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${maintToken}` },
      body: JSON.stringify({ resolutionNotes: "Fixed and verified over 30 minutes of testing." }),
    });

    // Maintenance tries to close — must fail
    const closeRes = await fetch(`${API_BASE}/maintenance-requests/${requestId}/close`, {
      method: "POST",
      headers: { Authorization: `Bearer ${maintToken}` },
    });
    expect(closeRes.status).toBe(403);
    const body = await closeRes.json() as { error?: { code?: string } };
    expect(body.error?.code).toBe("BL_21_ONLY_TENANT_CAN_CLOSE_MAINTENANCE");
  });
});
