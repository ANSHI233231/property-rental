/**
 * E2E: bl-16-non-tenant-cannot-raise
 *
 * TC coverage: TC-ROLE-005, TC-ROLE-006, TC-MAIN-005
 * BL coverage: BL-16 — Only TENANT (or ADMIN on-behalf) can raise maintenance requests.
 *
 * Tests:
 * 1. MAINTENANCE role token on POST /maintenance-requests → 403 BL_16
 * 2. PROPERTY_MANAGER token → 403 BL_16
 * 3. ADMIN token → 201 (on-behalf-of mode)
 * 4. UI: /maintenance/dashboard has no "Raise New Request" or New Request button
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

async function setupUnitForTest(): Promise<{ unitId: string }> {
  const token = await getAdminToken();
  const ts = Date.now();

  const pmRes = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `PM-BL16-${ts}`, email: `pm-bl16-${ts}@test.local`, role: "PROPERTY_MANAGER", password: "PMpass@9876!" }),
  });
  const pm = await pmRes.json() as { id: string };

  const propRes = await fetch(`${API_BASE}/properties`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `BL16 Prop ${ts}`, address: "4D", city: "Chennai", state: "Tamil Nadu", pincode: "600001" }),
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
    body: JSON.stringify({ unit_number: `UBL16-${ts}`, bedrooms: 1, bathrooms: 1, monthly_rent_paise: 1_200_000 }),
  });
  const unit = await unitRes.json() as { id: string };

  return { unitId: unit.id };
}

test.describe("BL-16: Only tenant can raise maintenance requests", () => {
  test("TC-ROLE-006 (BL-16): MAINTENANCE token → 403 BL_16_ONLY_TENANT_CAN_RAISE_MAINTENANCE", async () => {
    const { unitId } = await setupUnitForTest();

    const maintLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "maintenance.test@gharsetu.local", password: "Test@gharsetu2026!" }),
    });
    const maintToken = (await maintLoginRes.json() as { accessToken: string }).accessToken;

    const res = await fetch(`${API_BASE}/maintenance-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${maintToken}` },
      body: JSON.stringify({ unitId, title: "Maint trying to raise", description: "A".repeat(30), priority: "NORMAL" }),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error?: { code?: string } };
    expect(body.error?.code).toBe("BL_16_ONLY_TENANT_CAN_RAISE_MAINTENANCE");
  });

  test("TC-ROLE-006 (BL-16): PROPERTY_MANAGER token → 403 BL_16_ONLY_TENANT_CAN_RAISE_MAINTENANCE", async () => {
    const { unitId } = await setupUnitForTest();

    const pmLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "pm.test@gharsetu.local", password: "Test@gharsetu2026!" }),
    });
    const pmToken = (await pmLoginRes.json() as { accessToken: string }).accessToken;

    const res = await fetch(`${API_BASE}/maintenance-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${pmToken}` },
      body: JSON.stringify({ unitId, title: "PM trying to raise", description: "A".repeat(30), priority: "NORMAL" }),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error?: { code?: string } };
    expect(body.error?.code).toBe("BL_16_ONLY_TENANT_CAN_RAISE_MAINTENANCE");
  });

  test("BL-16: ADMIN token → 201 (on-behalf-of mode)", async () => {
    const { unitId } = await setupUnitForTest();
    const admToken = await getAdminToken();

    const res = await fetch(`${API_BASE}/maintenance-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${admToken}` },
      body: JSON.stringify({ unitId, title: "Admin on behalf", description: "A".repeat(30), priority: "LOW" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { priority: string };
    expect(body.priority).toBe("LOW");
  });

  test("TC-MAIN-005 UI: /maintenance/dashboard has no Raise New Request button", async ({ page, context }) => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    await context.clearCookies();
    await context.addCookies([
      { name: "__loggedIn", value: "1", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
      { name: "__role", value: "MAINTENANCE", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
    ]);
    await page.goto("/maintenance/dashboard");
    await page.waitForTimeout(1000);

    const raiseBtn = page.getByRole("button", { name: /raise new request/i });
    const newReqBtn = page.getByRole("button", { name: /\+ new request/i });
    await expect(raiseBtn).toHaveCount(0);
    await expect(newReqBtn).toHaveCount(0);
  });
});
