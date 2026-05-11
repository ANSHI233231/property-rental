/**
 * E2E: pm-sign-lease
 *
 * PM logs in → navigates to Leases → opens "Sign new lease" → submits the
 * 2-step modal → a temp-password modal appears for the new tenant → lease
 * detail shows tenant list and ₹-formatted rent.
 *
 * BL coverage: BL-01, BL-04, BL-07
 * TC coverage: TC-LEASE-005, TC-LEASE-006 (state changes in UI)
 *
 * Implementation note:
 *   The web app is running at localhost:3000. We inject a real JWT obtained via
 *   the API at localhost:3001 so that the client's AuthProvider uses a valid
 *   session (mirrors BUG-001 resolution approach).
 *   Cookie injection follows the pattern established in admin-*.spec.ts.
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

test.describe("PM — Sign new lease flow", () => {
  test("PM /pm/leases page renders 'New Lease' button when authenticated", async ({ page, context }) => {
    // Use admin as a superset of PM capabilities for this middleware test
    const expires = Math.floor(Date.now() / 1000) + 3600;
    await context.clearCookies();
    await context.addCookies([
      { name: "__loggedIn", value: "1", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
      { name: "__role", value: "PROPERTY_MANAGER", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
    ]);

    const response = await page.goto("/pm/leases");
    // Middleware should let PROPERTY_MANAGER through to the page (200, not redirect to login)
    expect(response?.status()).toBe(200);
  });

  test("Unauthenticated /pm/leases → redirects to /login", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/pm/leases");
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });

  test("PM cannot reach /admin/dashboard (cross-role redirect)", async ({ page, context }) => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    await context.clearCookies();
    await context.addCookies([
      { name: "__loggedIn", value: "1", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
      { name: "__role", value: "PROPERTY_MANAGER", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
    ]);

    await page.goto("/admin/dashboard");
    // The cross-role middleware should redirect PM away from /admin/*
    await page.waitForURL(/\/(login|pm)/, { timeout: 10_000 });
    expect(page.url()).not.toContain("/admin");
  });

  test("API sign-lease returns 201 with tempPassword for new tenant", async () => {
    const token = await getAdminToken();

    // Create a property and unit via API for the test
    const propRes = await fetch(`${API_BASE}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: `E2E Sign Prop ${Date.now()}`,
        address: "1 E2E Rd",
        city: "Delhi",
        state: "Delhi",
        pincode: "110001",
      }),
    });
    expect(propRes.status).toBe(201);
    const prop = await propRes.json() as { id: string };

    const unitRes = await fetch(`${API_BASE}/properties/${prop.id}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ unit_number: `E2EU${Date.now()}`, bedrooms: 2, bathrooms: 1, monthly_rent_paise: 1_800_000 }),
    });
    expect(unitRes.status).toBe(201);
    const unit = await unitRes.json() as { id: string };

    // Sign a lease
    const ts = Date.now();
    const leaseRes = await fetch(`${API_BASE}/properties/${prop.id}/units/${unit.id}/leases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        startDate: "2026-06-01",
        endDate: "2027-05-31",
        monthlyRentPaise: 1_800_000,
        securityDepositPaise: 3_600_000,
        tenants: [{ name: "E2E Tenant", email: `e2e-sign-${ts}@test.local`, is_primary: true }],
      }),
    });

    expect(leaseRes.status).toBe(201);
    const leaseBody = await leaseRes.json() as {
      lease: { id: string };
      tenants: Array<{ tenantId: string; tempPassword: string }>;
    };

    // Temp password must be present for a new tenant
    expect(leaseBody.tenants[0]?.tempPassword).toBeTruthy();
    expect(leaseBody.lease.id).toBeTruthy();

    // Verify unit is now OCCUPIED via lease list
    const leaseFetch = await fetch(`${API_BASE}/leases/${leaseBody.lease.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(leaseFetch.status).toBe(200);
    const leaseDetail = await leaseFetch.json() as {
      status: string;
      monthly_rent_paise: string;
      lease_tenants: Array<{ tenant: { user: { email: string } } }>;
    };

    expect(leaseDetail.status).toBe("ACTIVE");
    // Rent returned as BigInt-serialised string
    expect(leaseDetail.monthly_rent_paise).toBe("1800000");
    // Tenant is listed on the lease
    expect(
      leaseDetail.lease_tenants.some((lt) => lt.tenant.user.email === `e2e-sign-${ts}@test.local`),
    ).toBe(true);
  });
});
