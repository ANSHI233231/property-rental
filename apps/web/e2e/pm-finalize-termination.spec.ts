/**
 * E2E: pm-finalize-termination
 *
 * Multi-tenant: PM cannot finalize until all tenants approve;
 * once all approve, finalize succeeds; unit returns to AVAILABLE in PM view.
 *
 * TC coverage: TC-TERM-001, TC-TERM-002, TC-LEASE-011 (BL-09)
 * BL coverage: BL-04, BL-08, BL-09
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

test.describe("PM — Finalize termination flow", () => {
  test("PM /pm/leases accessible with PROPERTY_MANAGER role", async ({ page, context }) => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    await context.clearCookies();
    await context.addCookies([
      { name: "__loggedIn", value: "1", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
      { name: "__role", value: "PROPERTY_MANAGER", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
    ]);
    const response = await page.goto("/pm/leases");
    expect(response?.status()).toBe(200);
  });

  test("PM blocked from finalize until all co-tenants approve", async () => {
    const adminToken = await getAdminToken();
    const ts = Date.now();

    const propRes = await fetch(`${API_BASE}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `FinalizeProp${ts}`, address: "1 Rd", city: "Delhi", state: "Delhi", pincode: "110001" }),
    });
    const prop = await propRes.json() as { id: string };

    const unitRes = await fetch(`${API_BASE}/properties/${prop.id}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ unit_number: `FU${ts}`, bedrooms: 2, bathrooms: 1, monthly_rent_paise: 1_800_000 }),
    });
    const unit = await unitRes.json() as { id: string };

    const lr = await fetch(`${API_BASE}/properties/${prop.id}/units/${unit.id}/leases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        startDate: "2026-06-01",
        endDate: "2027-05-31",
        monthlyRentPaise: 1_800_000,
        securityDepositPaise: 3_600_000,
        tenants: [
          { name: "TA", email: `ta-fin-${ts}@test.local`, is_primary: true },
          { name: "TB", email: `tb-fin-${ts}@test.local`, is_primary: false },
        ],
      }),
    });
    const lrBody = await lr.json() as {
      lease: { id: string };
      tenants: Array<{ tenantId: string; isPrimary: boolean }>;
    };
    const leaseId = lrBody.lease.id;
    const tenantA = lrBody.tenants.find((t) => t.isPrimary)!;
    const tenantB = lrBody.tenants.find((t) => !t.isPrimary)!;

    // Tenant A requests
    await fetch(`${API_BASE}/leases/${leaseId}/terminate-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ requestedByTenantId: tenantA.tenantId, effectiveDate: "2026-07-01" }),
    });

    // PM tries to finalize — blocked (B still PENDING)
    const block = await fetch(`${API_BASE}/leases/${leaseId}/finalize-termination`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    });
    expect(block.status).toBe(409);
    const blockBody = await block.json() as { error: { code: string } };
    expect(blockBody.error.code).toBe("TERMINATION_NOT_FULLY_APPROVED");

    // Tenant B approves
    await fetch(`${API_BASE}/leases/${leaseId}/terminate-approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ tenantId: tenantB.tenantId, decision: "APPROVED" }),
    });

    // PM finalizes — now succeeds
    const finalRes = await fetch(`${API_BASE}/leases/${leaseId}/finalize-termination`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    });
    expect(finalRes.status).toBe(200);
    const finalBody = await finalRes.json() as { unit_state: string };

    // BL-04: unit returns to AVAILABLE
    expect(finalBody.unit_state).toBe("AVAILABLE");
  });

  test("Single-tenant: finalize immediately after terminate-request succeeds", async () => {
    const adminToken = await getAdminToken();
    const ts = Date.now();

    const propRes = await fetch(`${API_BASE}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `FinalSingleProp${ts}`, address: "1 Rd", city: "Delhi", state: "Delhi", pincode: "110001" }),
    });
    const prop = await propRes.json() as { id: string };

    const unitRes = await fetch(`${API_BASE}/properties/${prop.id}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ unit_number: `FSU${ts}`, bedrooms: 1, bathrooms: 1, monthly_rent_paise: 1_200_000 }),
    });
    const unit = await unitRes.json() as { id: string };

    const lr = await fetch(`${API_BASE}/properties/${prop.id}/units/${unit.id}/leases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        startDate: "2026-06-01",
        endDate: "2027-05-31",
        monthlyRentPaise: 1_200_000,
        securityDepositPaise: 2_400_000,
        tenants: [{ name: "Single T", email: `single-${ts}@test.local`, is_primary: true }],
      }),
    });
    const lrBody = await lr.json() as {
      lease: { id: string };
      tenants: Array<{ tenantId: string }>;
    };
    const leaseId = lrBody.lease.id;
    const tenantId = lrBody.tenants[0]!.tenantId;

    await fetch(`${API_BASE}/leases/${leaseId}/terminate-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ requestedByTenantId: tenantId, effectiveDate: "2026-07-01" }),
    });

    const finalRes = await fetch(`${API_BASE}/leases/${leaseId}/finalize-termination`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    });
    expect(finalRes.status).toBe(200);
    const body = await finalRes.json() as { unit_state: string };
    expect(body.unit_state).toBe("AVAILABLE");
  });
});
