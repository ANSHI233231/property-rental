/**
 * E2E: bl-21-non-tenant-cannot-close
 *
 * TC coverage: TC-MAIN-010
 * BL coverage: BL-21 — Only the TENANT who raised the request can close it.
 *
 * Tests:
 * 1. PM token on /close → 403 BL_21
 * 2. ADMIN token on /close → 403 BL_21
 * 3. MAINTENANCE token on /close → 403 BL_21
 * 4. UI: PM view has no "Close Request" button
 * 5. UI: Admin view has no "Close Request" button
 * 6. UI: Maintenance view has no "Close Request" button
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

async function setupResolvedRequest(): Promise<{
  resolvedRequestId: string;
  pmToken: string;
  maintToken: string;
  admToken: string;
}> {
  const admToken = await getAdminToken();
  const ts = Date.now();

  const pmRes = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admToken}` },
    body: JSON.stringify({ name: `PM-BL21-${ts}`, email: `pm-bl21-${ts}@test.local`, role: "PROPERTY_MANAGER", password: "PMpass@9876!" }),
  });
  const pm = await pmRes.json() as { id: string };

  const propRes = await fetch(`${API_BASE}/properties`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admToken}` },
    body: JSON.stringify({ name: `BL21 Prop ${ts}`, address: "5E", city: "Hyderabad", state: "Telangana", pincode: "500001" }),
  });
  const prop = await propRes.json() as { id: string };

  await fetch(`${API_BASE}/properties/${prop.id}/transfer-pm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admToken}` },
    body: JSON.stringify({ toPmId: pm.id }),
  });

  const unitRes = await fetch(`${API_BASE}/properties/${prop.id}/units`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admToken}` },
    body: JSON.stringify({ unit_number: `UBL21-${ts}`, bedrooms: 2, bathrooms: 1, monthly_rent_paise: 1_600_000 }),
  });
  const unit = await unitRes.json() as { id: string };

  const pmLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `pm-bl21-${ts}@test.local`, password: "PMpass@9876!" }),
  });
  const pmToken = (await pmLoginRes.json() as { accessToken: string }).accessToken;

  const tenantEmail = `ten-bl21-${ts}@test.local`;
  await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admToken}` },
    body: JSON.stringify({ name: `Tenant BL21 ${ts}`, email: tenantEmail, role: "TENANT", password: "Tenant@9876!" }),
  });

  const today = new Date().toISOString().slice(0, 10);
  const nextYear = `${new Date().getFullYear() + 1}-12-31`;
  await fetch(`${API_BASE}/properties/${prop.id}/units/${unit.id}/leases`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${pmToken}` },
    body: JSON.stringify({
      startDate: today,
      endDate: nextYear,
      monthlyRentPaise: 1_600_000,
      securityDepositPaise: 3_200_000,
      tenants: [{ name: `Tenant BL21 ${ts}`, email: tenantEmail, is_primary: true }],
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
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admToken}` },
    body: JSON.stringify({ name: `Maint BL21 ${ts}`, email: `maint-bl21-${ts}@test.local`, role: "MAINTENANCE", password: "Maint@9876!" }),
  });
  const maint = await maintRes.json() as { id: string };

  const maintLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `maint-bl21-${ts}@test.local`, password: "Maint@9876!" }),
  });
  const maintToken = (await maintLoginRes.json() as { accessToken: string }).accessToken;

  // Raise → Assign → In-Progress → Resolve
  const reqRes = await fetch(`${API_BASE}/maintenance-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tenantToken}` },
    body: JSON.stringify({
      unitId: unit.id,
      title: "Broken fan E2E BL21",
      description: "The ceiling fan in the living room has stopped working.",
      priority: "NORMAL",
    }),
  });
  const req = await reqRes.json() as { id: string };

  await fetch(`${API_BASE}/maintenance-requests/${req.id}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${pmToken}` },
    body: JSON.stringify({ assigneeUserId: maint.id }),
  });
  await fetch(`${API_BASE}/maintenance-requests/${req.id}/in-progress`, {
    method: "POST",
    headers: { Authorization: `Bearer ${maintToken}` },
  });
  await fetch(`${API_BASE}/maintenance-requests/${req.id}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${maintToken}` },
    body: JSON.stringify({ resolutionNotes: "Replaced capacitor; fan works perfectly now." }),
  });

  return { resolvedRequestId: req.id, pmToken, maintToken, admToken };
}

test.describe("BL-21: Non-tenant cannot close maintenance requests", () => {
  test("PM token on /close → 403 BL_21_ONLY_TENANT_CAN_CLOSE_MAINTENANCE", async () => {
    const { resolvedRequestId, pmToken } = await setupResolvedRequest();
    const res = await fetch(`${API_BASE}/maintenance-requests/${resolvedRequestId}/close`, {
      method: "POST",
      headers: { Authorization: `Bearer ${pmToken}` },
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error?: { code?: string } };
    expect(body.error?.code).toBe("BL_21_ONLY_TENANT_CAN_CLOSE_MAINTENANCE");
  });

  test("Admin token on /close → 403 BL_21_ONLY_TENANT_CAN_CLOSE_MAINTENANCE", async () => {
    const { resolvedRequestId, admToken } = await setupResolvedRequest();
    const res = await fetch(`${API_BASE}/maintenance-requests/${resolvedRequestId}/close`, {
      method: "POST",
      headers: { Authorization: `Bearer ${admToken}` },
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error?: { code?: string } };
    expect(body.error?.code).toBe("BL_21_ONLY_TENANT_CAN_CLOSE_MAINTENANCE");
  });

  test("MAINTENANCE token on /close → 403 BL_21_ONLY_TENANT_CAN_CLOSE_MAINTENANCE", async () => {
    const { resolvedRequestId, maintToken } = await setupResolvedRequest();
    const res = await fetch(`${API_BASE}/maintenance-requests/${resolvedRequestId}/close`, {
      method: "POST",
      headers: { Authorization: `Bearer ${maintToken}` },
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error?: { code?: string } };
    expect(body.error?.code).toBe("BL_21_ONLY_TENANT_CAN_CLOSE_MAINTENANCE");
  });

  test("PM /pm/maintenance page has no Close Request button", async ({ page, context }) => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    await context.clearCookies();
    await context.addCookies([
      { name: "__loggedIn", value: "1", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
      { name: "__role", value: "PROPERTY_MANAGER", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
    ]);
    await page.goto("/pm/maintenance");
    await page.waitForTimeout(1500);

    const closeBtn = page.getByRole("button", { name: /close request/i });
    await expect(closeBtn).toHaveCount(0);
  });

  test("Admin /admin/maintenance page has no Close Request button", async ({ page, context }) => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    await context.clearCookies();
    await context.addCookies([
      { name: "__loggedIn", value: "1", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
      { name: "__role", value: "ADMIN", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
    ]);
    await page.goto("/admin/maintenance");
    await page.waitForTimeout(1500);

    const closeBtn = page.getByRole("button", { name: /close request/i });
    await expect(closeBtn).toHaveCount(0);
  });

  test("Maintenance /maintenance/dashboard has no Close Request button", async ({ page, context }) => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    await context.clearCookies();
    await context.addCookies([
      { name: "__loggedIn", value: "1", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
      { name: "__role", value: "MAINTENANCE", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
    ]);
    await page.goto("/maintenance/dashboard");
    await page.waitForTimeout(1500);

    const closeBtn = page.getByRole("button", { name: /close request/i });
    await expect(closeBtn).toHaveCount(0);
  });
});
