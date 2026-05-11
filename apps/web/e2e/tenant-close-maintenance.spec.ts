/**
 * E2E: tenant-close-maintenance
 *
 * TC coverage: TC-MAIN-010 (tenant closes resolved request), TC-MAIN-011 (non-tenant blocked)
 * BL coverage: BL-21
 *
 * Tests:
 * 1. Tenant calls /close on RESOLVED request → 200 CLOSED.
 * 2. PM cannot close → 403 BL_21.
 * 3. Admin cannot close → 403 BL_21.
 * 4. Tenant /tenant/maintenance page loads.
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
  tenantToken: string;
  pmToken: string;
  adminToken: string;
  requestId: string;
}> {
  const token = await getAdminToken();
  const ts = Date.now();

  const pmRes = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `PM-Close-${ts}`, email: `pm-close-${ts}@test.local`, role: "PROPERTY_MANAGER", password: "PMpass@9876!" }),
  });
  const pm = await pmRes.json() as { id: string };

  const propRes = await fetch(`${API_BASE}/properties`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `Close Prop ${ts}`, address: "3C", city: "Bangalore", state: "Karnataka", pincode: "560001" }),
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
    body: JSON.stringify({ unit_number: `UC-${ts}`, bedrooms: 2, bathrooms: 1, monthly_rent_paise: 2_000_000 }),
  });
  const unit = await unitRes.json() as { id: string };

  const pmLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `pm-close-${ts}@test.local`, password: "PMpass@9876!" }),
  });
  const pmToken = (await pmLoginRes.json() as { accessToken: string }).accessToken;

  const tenantEmail = `ten-close-${ts}@test.local`;
  await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `Tenant Close ${ts}`, email: tenantEmail, role: "TENANT", password: "Tenant@9876!" }),
  });

  const today = new Date().toISOString().slice(0, 10);
  const nextYear = `${new Date().getFullYear() + 1}-12-31`;
  await fetch(`${API_BASE}/properties/${prop.id}/units/${unit.id}/leases`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${pmToken}` },
    body: JSON.stringify({
      startDate: today,
      endDate: nextYear,
      monthlyRentPaise: 2_000_000,
      securityDepositPaise: 4_000_000,
      tenants: [{ name: `Tenant Close ${ts}`, email: tenantEmail, is_primary: true }],
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
    body: JSON.stringify({ name: `Maint Close ${ts}`, email: `maint-close-${ts}@test.local`, role: "MAINTENANCE", password: "Maint@9876!" }),
  });
  const maint = await maintRes.json() as { id: string };

  const maintLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `maint-close-${ts}@test.local`, password: "Maint@9876!" }),
  });
  const maintToken = (await maintLoginRes.json() as { accessToken: string }).accessToken;

  // Raise request
  const reqRes = await fetch(`${API_BASE}/maintenance-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tenantToken}` },
    body: JSON.stringify({
      unitId: unit.id,
      title: "Leaking tap E2E",
      description: "The kitchen tap has been dripping for three days, needs urgent repair.",
      priority: "NORMAL",
    }),
  });
  const req = await reqRes.json() as { id: string };

  // Drive to RESOLVED
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
    body: JSON.stringify({ resolutionNotes: "Replaced the washer, tested for 20 minutes, no drip." }),
  });

  return { tenantToken, pmToken, adminToken: token, requestId: req.id };
}

test.describe("Tenant close maintenance request (BL-21)", () => {
  test("Tenant /tenant/maintenance page loads", async ({ page, context }) => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    await context.clearCookies();
    await context.addCookies([
      { name: "__loggedIn", value: "1", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
      { name: "__role", value: "TENANT", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
    ]);
    const response = await page.goto("/tenant/maintenance");
    expect(response?.status()).toBe(200);
  });

  test("TC-MAIN-010 (BL-21): PM cannot close RESOLVED request → 403 BL_21", async () => {
    const { pmToken, requestId } = await setupResolvedRequest();

    const res = await fetch(`${API_BASE}/maintenance-requests/${requestId}/close`, {
      method: "POST",
      headers: { Authorization: `Bearer ${pmToken}` },
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error?: { code?: string } };
    expect(body.error?.code).toBe("BL_21_ONLY_TENANT_CAN_CLOSE_MAINTENANCE");
  });

  test("TC-MAIN-010 (BL-21): Admin cannot close RESOLVED request → 403 BL_21", async () => {
    const { adminToken: admToken, requestId } = await setupResolvedRequest();

    const res = await fetch(`${API_BASE}/maintenance-requests/${requestId}/close`, {
      method: "POST",
      headers: { Authorization: `Bearer ${admToken}` },
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error?: { code?: string } };
    expect(body.error?.code).toBe("BL_21_ONLY_TENANT_CAN_CLOSE_MAINTENANCE");
  });

  test("TC-MAIN-010 (BL-21): Original tenant closes RESOLVED request → 200 CLOSED", async () => {
    const { tenantToken, requestId } = await setupResolvedRequest();

    const res = await fetch(`${API_BASE}/maintenance-requests/${requestId}/close`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tenantToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; closed_at: string };
    expect(body.status).toBe("CLOSED");
    expect(body.closed_at).toBeTruthy();
  });

  test("TC-MAIN-011 (BL-15): CLOSED request cannot be reopened via API → 409 or trigger error", async () => {
    const { tenantToken, pmToken, requestId } = await setupResolvedRequest();

    // Close it
    await fetch(`${API_BASE}/maintenance-requests/${requestId}/close`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tenantToken}` },
    });

    // Try to assign (mutate) the closed request
    const maintRes = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getAdminToken()}` },
      body: JSON.stringify({ name: "Maint Reopen", email: `maint-reopen-${Date.now()}@test.local`, role: "MAINTENANCE", password: "Maint@9876!" }),
    });
    const maint = await maintRes.json() as { id: string };

    const res = await fetch(`${API_BASE}/maintenance-requests/${requestId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${pmToken}` },
      body: JSON.stringify({ assigneeUserId: maint.id }),
    });
    // Must not be 200
    expect(res.status).not.toBe(200);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
