/**
 * E2E: bl-10-tenant-blocked
 *
 * Tenant attempts POST /payments directly (via page.evaluate fetch).
 * Verifies 403 surfaces (the API correctly blocks BL-10).
 *
 * TC coverage: TC-ROLE-009 (BL-10 API), TC-RENT-014
 * BL coverage: BL-10
 *
 * Note: We use page.evaluate to make a fetch call from the browser context
 * carrying a tenant JWT (obtained via direct API call). This mirrors what a
 * malicious tenant would do if they tried to bypass the UI.
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

test.describe("BL-10: Tenant direct POST /payments → 403", () => {
  /**
   * TC-ROLE-009 (BL-10): Tenant calls POST /payments with their own JWT.
   * Expects 403 with error code BL_10_TENANT_CANNOT_RECORD_PAYMENT.
   */
  test("Tenant JWT on POST /payments → 403 BL_10_TENANT_CANNOT_RECORD_PAYMENT", async ({ page }) => {
    const adminJwt = await getAdminToken();
    const ts = Date.now();

    // Setup: PM + property + unit + lease (all via direct API)
    const pmRes = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminJwt}` },
      body: JSON.stringify({ name: `PM-BL10e2e-${ts}`, email: `pm-bl10e2e-${ts}@test.local`, role: "PROPERTY_MANAGER", password: "PMpass@9876!" }),
    });
    const pm = await pmRes.json() as { id: string };

    const propRes = await fetch(`${API_BASE}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminJwt}` },
      body: JSON.stringify({ name: `BL10e2e Prop ${ts}`, address: "D", city: "Delhi", state: "Delhi", pincode: "110001", active_pm_id: pm.id }),
    });
    const prop = await propRes.json() as { id: string };

    const unitRes = await fetch(`${API_BASE}/properties/${prop.id}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminJwt}` },
      body: JSON.stringify({ unit_number: `UBL10e-${ts}`, bedrooms: 1, bathrooms: 1, monthly_rent_paise: 1_800_000 }),
    });
    const unit = await unitRes.json() as { id: string };

    const pmLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `pm-bl10e2e-${ts}@test.local`, password: "PMpass@9876!" }),
    });
    const pmJwt = (await pmLoginRes.json() as { accessToken: string }).accessToken;

    const leaseRes = await fetch(`${API_BASE}/properties/${prop.id}/units/${unit.id}/leases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${pmJwt}` },
      body: JSON.stringify({
        startDate: "2026-12-01",
        endDate: "2027-11-30",
        monthlyRentPaise: 1_800_000,
        securityDepositPaise: 3_600_000,
        tenants: [{ name: "BL10e2e Tenant", email: `bl10e2e-ten-${ts}@test.local`, is_primary: true }],
      }),
    });
    const leaseBody = await leaseRes.json() as {
      lease: { id: string };
      tenants: Array<{ tempPassword: string }>;
    };

    const tenantTempPw = leaseBody.tenants[0]?.tempPassword ?? "";
    const tenantLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `bl10e2e-ten-${ts}@test.local`, password: tenantTempPw }),
    });
    const tenantJwt = (await tenantLoginRes.json() as { accessToken: string }).accessToken;

    const periodsRes = await fetch(`${API_BASE}/rent-periods?leaseId=${leaseBody.lease.id}`, {
      headers: { Authorization: `Bearer ${pmJwt}` },
    });
    const periodsBody = await periodsRes.json() as { data?: Array<{ id: string }> };
    const periodId = periodsBody.data?.[0]?.id ?? "unknown";

    // Navigate to any authenticated page (so we have a page context)
    await page.goto("http://localhost:3000/login");

    // Use page.evaluate to simulate the tenant calling POST /payments directly
    // This mirrors what a malicious tenant would do from the browser console.
    const result = await page.evaluate(
      async ({ apiBase, jwt, pId }: { apiBase: string; jwt: string; pId: string }) => {
        const res = await fetch(`${apiBase}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({ rentPeriodId: pId, amountPaise: 1_800_000, method: "UPI", paidOn: "2026-12-01" }),
        });
        const body = await res.json();
        return { status: res.status, body };
      },
      { apiBase: API_BASE, jwt: tenantJwt, pId: periodId },
    );

    // Must be 403 — tenant is blocked by BL-10
    expect(result.status).toBe(403);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorBody = result.body as { error?: { code?: string } };
    expect(errorBody.error?.code).toBe("BL_10_TENANT_CANNOT_RECORD_PAYMENT");
  });

  /**
   * TC-ROLE-009 variant: MAINTENANCE token on POST /payments → 403.
   */
  test("MAINTENANCE JWT on POST /payments → 403", async ({ page }) => {
    const adminJwt = await getAdminToken();
    const ts = Date.now() + 1;

    // Create maintenance user
    const maintRes = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminJwt}` },
      body: JSON.stringify({ name: `Maint-BL10e-${ts}`, email: `maint-bl10e-${ts}@test.local`, role: "MAINTENANCE", password: "Maint@9876!" }),
    });
    expect(maintRes.status).toBe(201);
    const maintUser = await maintRes.json() as { email: string };

    const maintLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: maintUser.email, password: "Maint@9876!" }),
    });
    const maintJwt = (await maintLoginRes.json() as { accessToken: string }).accessToken;

    await page.goto("http://localhost:3000/login");

    const result = await page.evaluate(
      async ({ apiBase, jwt }: { apiBase: string; jwt: string }) => {
        const res = await fetch(`${apiBase}/payments`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({ rentPeriodId: "any-period-id", amountPaise: 100_000, method: "CASH", paidOn: "2026-12-01" }),
        });
        return { status: res.status };
      },
      { apiBase: API_BASE, jwt: maintJwt },
    );

    expect(result.status).toBe(403);
  });
});
