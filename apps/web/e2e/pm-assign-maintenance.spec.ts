/**
 * E2E: pm-assign-maintenance
 *
 * TC coverage: TC-MAIN-006 (state machine OPEN→ASSIGNED), TC-MAIN-011 (assignee role check)
 * BL coverage: BL-16, TC-MAINT-011
 *
 * Tests PM assigns a maintenance request to a MAINTENANCE user:
 * 1. PM can access /pm/maintenance page when authenticated.
 * 2. OPEN→ASSIGNED transition via API succeeds (status=ASSIGNED, assigned_to_user_id set).
 * 3. Assigning a non-MAINTENANCE user returns 400 ASSIGNEE_NOT_MAINTENANCE_ROLE.
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
      // Throttle window — wait and retry
      await new Promise(r => setTimeout(r, 15000));
      continue;
    }
    throw new Error(`Admin login failed: ${JSON.stringify(body)}`);
  }
  throw new Error("Admin login failed after 5 attempts (rate limit)");
}

async function setupForAssign(): Promise<{
  pmToken: string;
  pmId: string;
  maintId: string;
  requestId: string;
}> {
  const token = await getAdminToken();
  const ts = Date.now();

  // PM
  const pmRes = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `PM-Assign-${ts}`, email: `pm-assign-${ts}@test.local`, role: "PROPERTY_MANAGER", password: "PMpass@9876!" }),
  });
  const pm = await pmRes.json() as { id: string };

  // Property + unit
  const propRes = await fetch(`${API_BASE}/properties`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `Assign Prop ${ts}`, address: "1A", city: "Delhi", state: "Delhi", pincode: "110001" }),
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
    body: JSON.stringify({ unit_number: `UA-${ts}`, bedrooms: 2, bathrooms: 1, monthly_rent_paise: 1_800_000 }),
  });
  const unit = await unitRes.json() as { id: string };

  const pmLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `pm-assign-${ts}@test.local`, password: "PMpass@9876!" }),
  });
  const pmToken = (await pmLoginRes.json() as { accessToken: string }).accessToken;

  // Tenant
  const tenantEmail = `ten-assign-${ts}@test.local`;
  await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `Tenant Assign ${ts}`, email: tenantEmail, role: "TENANT", password: "Tenant@9876!" }),
  });

  const today = new Date().toISOString().slice(0, 10);
  const nextYear = `${new Date().getFullYear() + 1}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`;
  const leaseRes = await fetch(`${API_BASE}/properties/${prop.id}/units/${unit.id}/leases`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${pmToken}` },
    body: JSON.stringify({
      startDate: today,
      endDate: nextYear,
      monthlyRentPaise: 1_800_000,
      securityDepositPaise: 3_600_000,
      tenants: [{ name: `Tenant Assign ${ts}`, email: tenantEmail, is_primary: true }],
    }),
  });
  const lease = await leaseRes.json() as { lease: { id: string } };
  void lease;

  const tenantLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: tenantEmail, password: "Tenant@9876!" }),
  });
  const tenantToken = (await tenantLoginRes.json() as { accessToken: string }).accessToken;

  // Maintenance user
  const maintRes = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `Maint Assign ${ts}`, email: `maint-assign-${ts}@test.local`, role: "MAINTENANCE", password: "Maint@9876!" }),
  });
  const maint = await maintRes.json() as { id: string };

  // Raise request
  const reqRes = await fetch(`${API_BASE}/maintenance-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tenantToken}` },
    body: JSON.stringify({
      unitId: unit.id,
      title: "Broken window frame E2E",
      description: "The window frame is broken and needs replacement urgently.",
      priority: "HIGH",
    }),
  });
  const req = await reqRes.json() as { id: string };

  return { pmToken, pmId: pm.id, maintId: maint.id, requestId: req.id };
}

test.describe("PM assigns maintenance request (BL-16, TC-MAINT-011)", () => {
  test("PM /pm/maintenance page loads without redirect", async ({ page, context }) => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    await context.clearCookies();
    await context.addCookies([
      { name: "__loggedIn", value: "1", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
      { name: "__role", value: "PROPERTY_MANAGER", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
    ]);
    const response = await page.goto("/pm/maintenance");
    expect(response?.status()).toBe(200);
  });

  test("TC-MAIN-006: OPEN→ASSIGNED via /assign API → status=ASSIGNED, assigned_to_user_id set", async () => {
    const { pmToken, maintId, requestId } = await setupForAssign();

    const res = await fetch(`${API_BASE}/maintenance-requests/${requestId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${pmToken}` },
      body: JSON.stringify({ assigneeUserId: maintId }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; assigned_to_user_id: string };
    expect(body.status).toBe("ASSIGNED");
    expect(body.assigned_to_user_id).toBe(maintId);
  });

  test("TC-MAINT-011: assign with PROPERTY_MANAGER user → 400 ASSIGNEE_NOT_MAINTENANCE_ROLE", async () => {
    const { pmToken, pmId, requestId } = await setupForAssign();

    const res = await fetch(`${API_BASE}/maintenance-requests/${requestId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${pmToken}` },
      body: JSON.stringify({ assigneeUserId: pmId }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { error?: { code?: string } };
    expect(body.error?.code).toBe("ASSIGNEE_NOT_MAINTENANCE_ROLE");
  });
});
