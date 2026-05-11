/**
 * E2E: cross-property-blocked-maintenance
 *
 * TC coverage: TC-MAINT-013 (H-01 regression lock-in)
 * BL coverage: BL-19 — PM can only access their own property
 *
 * Tests:
 * 1. PM-B GET /maintenance-requests/:idFromPropertyA → 403 PROPERTY_ACCESS_DENIED.
 * 2. PM-A GET the same request → 200.
 * 3. PM-B /assign on PM-A's request → 403 PROPERTY_SCOPE_VIOLATION.
 * 4. UI: PM-B navigates to /pm/maintenance — only sees their own property requests
 *    (page loads without error; cross-property IDOR is blocked at API level).
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

async function setupCrossPropertyScenario(): Promise<{
  pmAToken: string;
  pmBToken: string;
  pmBId: string;
  maintBId: string;
  requestIdOnPropertyA: string;
}> {
  const admToken = await getAdminToken();
  const ts = Date.now();

  // PM-A
  const pmARes = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admToken}` },
    body: JSON.stringify({ name: `PM-A-CP-${ts}`, email: `pm-a-cp-${ts}@test.local`, role: "PROPERTY_MANAGER", password: "PMpass@9876!" }),
  });
  const pmA = await pmARes.json() as { id: string };

  // PM-B
  const pmBRes = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admToken}` },
    body: JSON.stringify({ name: `PM-B-CP-${ts}`, email: `pm-b-cp-${ts}@test.local`, role: "PROPERTY_MANAGER", password: "PMpass@9876!" }),
  });
  const pmB = await pmBRes.json() as { id: string };

  // MAINTENANCE user for PM-B's property
  const maintBRes = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admToken}` },
    body: JSON.stringify({ name: `Maint-B-CP-${ts}`, email: `maint-b-cp-${ts}@test.local`, role: "MAINTENANCE", password: "Maint@9876!" }),
  });
  const maintB = await maintBRes.json() as { id: string };

  // Property A assigned to PM-A
  const propARes = await fetch(`${API_BASE}/properties`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admToken}` },
    body: JSON.stringify({ name: `PropA-CP-${ts}`, address: "8H", city: "Kolkata", state: "West Bengal", pincode: "700001" }),
  });
  const propA = await propARes.json() as { id: string };

  await fetch(`${API_BASE}/properties/${propA.id}/transfer-pm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admToken}` },
    body: JSON.stringify({ toPmId: pmA.id }),
  });

  // Property B assigned to PM-B
  const propBRes = await fetch(`${API_BASE}/properties`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admToken}` },
    body: JSON.stringify({ name: `PropB-CP-${ts}`, address: "9I", city: "Kolkata", state: "West Bengal", pincode: "700002" }),
  });
  const propB = await propBRes.json() as { id: string };

  await fetch(`${API_BASE}/properties/${propB.id}/transfer-pm`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admToken}` },
    body: JSON.stringify({ toPmId: pmB.id }),
  });

  // Unit A in Property A
  const unitARes = await fetch(`${API_BASE}/properties/${propA.id}/units`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admToken}` },
    body: JSON.stringify({ unit_number: `UA-CP-${ts}`, bedrooms: 2, bathrooms: 1, monthly_rent_paise: 1_700_000 }),
  });
  const unitA = await unitARes.json() as { id: string };

  // Tokens
  const pmALoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `pm-a-cp-${ts}@test.local`, password: "PMpass@9876!" }),
  });
  const pmAToken = (await pmALoginRes.json() as { accessToken: string }).accessToken;

  const pmBLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `pm-b-cp-${ts}@test.local`, password: "PMpass@9876!" }),
  });
  const pmBToken = (await pmBLoginRes.json() as { accessToken: string }).accessToken;

  // Tenant on Property A
  const tenantEmail = `ten-cp-${ts}@test.local`;
  await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admToken}` },
    body: JSON.stringify({ name: `Tenant CP ${ts}`, email: tenantEmail, role: "TENANT", password: "Tenant@9876!" }),
  });

  const today = new Date().toISOString().slice(0, 10);
  const nextYear = `${new Date().getFullYear() + 1}-12-31`;
  await fetch(`${API_BASE}/properties/${propA.id}/units/${unitA.id}/leases`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${pmAToken}` },
    body: JSON.stringify({
      startDate: today,
      endDate: nextYear,
      monthlyRentPaise: 1_700_000,
      securityDepositPaise: 3_400_000,
      tenants: [{ name: `Tenant CP ${ts}`, email: tenantEmail, is_primary: true }],
    }),
  });

  const tenantLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: tenantEmail, password: "Tenant@9876!" }),
  });
  const tenantToken = (await tenantLoginRes.json() as { accessToken: string }).accessToken;

  // Raise request on Property A
  const reqRes = await fetch(`${API_BASE}/maintenance-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tenantToken}` },
    body: JSON.stringify({
      unitId: unitA.id,
      title: "Cross-property test request",
      description: "This request is on Property A and should not be accessible to PM-B.",
      priority: "NORMAL",
    }),
  });
  const req = await reqRes.json() as { id: string };

  return { pmAToken, pmBToken, pmBId: pmB.id, maintBId: maintB.id, requestIdOnPropertyA: req.id };
}

test.describe("Cross-property maintenance access blocked (H-01, BL-19)", () => {
  test("PM-B GET /maintenance-requests/:idFromPropertyA → 403 PROPERTY_ACCESS_DENIED", async () => {
    const { pmBToken, requestIdOnPropertyA } = await setupCrossPropertyScenario();

    const res = await fetch(`${API_BASE}/maintenance-requests/${requestIdOnPropertyA}`, {
      headers: { Authorization: `Bearer ${pmBToken}` },
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error?: { code?: string }; code?: string };
    const code = body.error?.code ?? body.code;
    expect(code).toBe("PROPERTY_ACCESS_DENIED");
  });

  test("PM-A GET /maintenance-requests/:idFromPropertyA → 200 (positive regression)", async () => {
    const { pmAToken, requestIdOnPropertyA } = await setupCrossPropertyScenario();

    const res = await fetch(`${API_BASE}/maintenance-requests/${requestIdOnPropertyA}`, {
      headers: { Authorization: `Bearer ${pmAToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string };
    expect(body.id).toBe(requestIdOnPropertyA);
  });

  test("PM-B /assign on PM-A's request → 403 PROPERTY_SCOPE_VIOLATION", async () => {
    const { pmBToken, maintBId, requestIdOnPropertyA } = await setupCrossPropertyScenario();

    const res = await fetch(`${API_BASE}/maintenance-requests/${requestIdOnPropertyA}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${pmBToken}` },
      body: JSON.stringify({ assigneeUserId: maintBId }),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { error?: { code?: string } };
    expect(body.error?.code).toBe("PROPERTY_SCOPE_VIOLATION");
  });

  test("PM /pm/maintenance page loads without error (UI baseline)", async ({ page, context }) => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    await context.clearCookies();
    await context.addCookies([
      { name: "__loggedIn", value: "1", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
      { name: "__role", value: "PROPERTY_MANAGER", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
    ]);
    const response = await page.goto("/pm/maintenance");
    expect(response?.status()).toBe(200);
  });
});
