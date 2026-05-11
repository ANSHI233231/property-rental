/**
 * E2E: tenant-approve-termination
 *
 * Tenant B (co-tenant) approves termination request via API, and the
 * tenant dashboard shows the updated card state.
 *
 * TC coverage: TC-TERM-002 (BL-08/09 multi-tenant happy path)
 * BL coverage: BL-08, BL-09
 *
 * Note: tests the API flows directly (API E2E pattern) since the real
 * tenant dashboard requires a live tenant JWT + authenticated session.
 * The middleware/cookie tests verify the routing layer.
 */

import { test, expect } from "@playwright/test";

const API_BASE = "http://localhost:3001/api/v1";

async function getAdminToken(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@gharsetu.local", password: "Admin@gharsetu2026!" }),
  });
  const body = await res.json() as { accessToken: string };
  return body.accessToken;
}

async function loginWithCreds(email: string, password: string): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status}`);
  const body = await res.json() as { accessToken: string };
  return body.accessToken;
}

test.describe("Tenant — approve termination flow", () => {
  test("Tenant /tenant/dashboard accessible with TENANT role cookie", async ({ page, context }) => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    await context.clearCookies();
    await context.addCookies([
      { name: "__loggedIn", value: "1", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
      { name: "__role", value: "TENANT", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
    ]);
    const response = await page.goto("/tenant/dashboard");
    expect(response?.status()).toBe(200);
  });

  test("Unauthenticated /tenant/dashboard → redirects to /login", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/tenant/dashboard");
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });

  test("Tenant B approves termination via API: approval row → APPROVED", async () => {
    const adminToken = await getAdminToken();
    const ts = Date.now();

    // Create prop + unit
    const propRes = await fetch(`${API_BASE}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `ApproveTermProp${ts}`, address: "1 Rd", city: "Delhi", state: "Delhi", pincode: "110001" }),
    });
    const prop = await propRes.json() as { id: string };

    const unitRes = await fetch(`${API_BASE}/properties/${prop.id}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ unit_number: `ATU${ts}`, bedrooms: 2, bathrooms: 1, monthly_rent_paise: 1_800_000 }),
    });
    const unit = await unitRes.json() as { id: string };

    // Create 2-tenant lease
    const lr = await fetch(`${API_BASE}/properties/${prop.id}/units/${unit.id}/leases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        startDate: "2026-06-01",
        endDate: "2027-05-31",
        monthlyRentPaise: 1_800_000,
        securityDepositPaise: 3_600_000,
        tenants: [
          { name: "Tenant A", email: `ta-at-${ts}@test.local`, is_primary: true },
          { name: "Tenant B", email: `tb-at-${ts}@test.local`, is_primary: false },
        ],
      }),
    });
    expect(lr.status).toBe(201);
    const lrBody = await lr.json() as {
      lease: { id: string };
      tenants: Array<{ tenantId: string; userId: string; isPrimary: boolean; tempPassword: string }>;
    };

    const leaseId = lrBody.lease.id;
    const tenantA = lrBody.tenants.find((t) => t.isPrimary)!;
    const tenantB = lrBody.tenants.find((t) => !t.isPrimary)!;

    // Tenant A requests termination (using admin token for simplicity)
    const tReq = await fetch(`${API_BASE}/leases/${leaseId}/terminate-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ requestedByTenantId: tenantA.tenantId, effectiveDate: "2026-07-01" }),
    });
    expect(tReq.status).toBe(201);
    const tReqBody = await tReq.json() as { termination: { pending_approvals: number } };
    expect(tReqBody.termination.pending_approvals).toBe(1);

    // Tenant B logs in and approves their own approval
    const tokenB = await loginWithCreds(`tb-at-${ts}@test.local`, tenantB.tempPassword);

    const approveRes = await fetch(`${API_BASE}/leases/${leaseId}/terminate-approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ tenantId: tenantB.tenantId, decision: "APPROVED" }),
    });

    expect(approveRes.status).toBe(200);
    const approveBody = await approveRes.json() as { approval: { status: string } };
    expect(approveBody.approval.status).toBe("APPROVED");

    // Now finalize should succeed (all approved)
    const finalRes = await fetch(`${API_BASE}/leases/${leaseId}/finalize-termination`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    });
    expect(finalRes.status).toBe(200);
    const finalBody = await finalRes.json() as { unit_state: string };
    expect(finalBody.unit_state).toBe("AVAILABLE");
  });
});
