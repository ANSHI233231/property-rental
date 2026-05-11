/**
 * E2E: tenant-impersonation-blocked
 *
 * Tenant A attempts to approve as Tenant B → API must return 403
 * with FORBIDDEN_TENANT_ACTION code.
 *
 * This is the H-01 lock-in at the E2E layer (per security fix commit 19cbb67).
 *
 * TC coverage: TC-LEASE-010 (H-01 impersonation)
 * BL coverage: BL-09
 * Security: H-01 remediation verification
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

test.describe("H-01 — Tenant impersonation blocked at E2E layer", () => {
  test("Tenant A token + body tenantId=B on terminate-approve → 403 FORBIDDEN_TENANT_ACTION", async () => {
    const adminToken = await getAdminToken();
    const ts = Date.now();

    // Setup: create prop, unit, 2-tenant lease
    const propRes = await fetch(`${API_BASE}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `H01PropE2E${ts}`, address: "1 Rd", city: "Delhi", state: "Delhi", pincode: "110001" }),
    });
    const prop = await propRes.json() as { id: string };

    const unitRes = await fetch(`${API_BASE}/properties/${prop.id}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ unit_number: `H01U${ts}`, bedrooms: 2, bathrooms: 1, monthly_rent_paise: 1_800_000 }),
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
          { name: "Tenant A", email: `ta-h01e2e-${ts}@test.local`, is_primary: true },
          { name: "Tenant B", email: `tb-h01e2e-${ts}@test.local`, is_primary: false },
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

    // Tenant A requests termination
    const tReq = await fetch(`${API_BASE}/leases/${leaseId}/terminate-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ requestedByTenantId: tenantA.tenantId, effectiveDate: "2026-07-01" }),
    });
    expect(tReq.status).toBe(201);

    // Tenant A logs in
    const tokenA = await loginWithCreds(`ta-h01e2e-${ts}@test.local`, tenantA.tempPassword);

    // Tenant A tries to approve as Tenant B (H-01 impersonation attack)
    const impersonateRes = await fetch(`${API_BASE}/leases/${leaseId}/terminate-approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ tenantId: tenantB.tenantId, decision: "APPROVED" }),
    });

    // H-01 fix: must be 403
    expect(impersonateRes.status).toBe(403);
    const body = await impersonateRes.json() as { error: { code: string } };
    expect(body.error?.code).toBe("FORBIDDEN_TENANT_ACTION");
  });

  test("Tenant A cannot withdraw Tenant B's termination request (H-01 withdraw path)", async () => {
    const adminToken = await getAdminToken();
    const ts = Date.now();

    const propRes = await fetch(`${API_BASE}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `H01W PropE2E${ts}`, address: "1 Rd", city: "Delhi", state: "Delhi", pincode: "110001" }),
    });
    const prop = await propRes.json() as { id: string };

    const unitRes = await fetch(`${API_BASE}/properties/${prop.id}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ unit_number: `H01WU${ts}`, bedrooms: 2, bathrooms: 1, monthly_rent_paise: 1_800_000 }),
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
          { name: "Tenant A", email: `ta-h01w-${ts}@test.local`, is_primary: true },
          { name: "Tenant B", email: `tb-h01w-${ts}@test.local`, is_primary: false },
        ],
      }),
    });
    const lrBody = await lr.json() as {
      lease: { id: string };
      tenants: Array<{ tenantId: string; isPrimary: boolean; tempPassword: string }>;
    };

    const leaseId = lrBody.lease.id;
    const tenantA = lrBody.tenants.find((t) => t.isPrimary)!;
    const tenantB = lrBody.tenants.find((t) => !t.isPrimary)!;

    // Tenant B requests termination (so B is the requester)
    await fetch(`${API_BASE}/leases/${leaseId}/terminate-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ requestedByTenantId: tenantB.tenantId, effectiveDate: "2026-07-01" }),
    });

    // Tenant A logs in and tries to withdraw Tenant B's request (claiming to be B)
    const tokenA = await loginWithCreds(`ta-h01w-${ts}@test.local`, tenantA.tempPassword);

    const withdrawRes = await fetch(`${API_BASE}/leases/${leaseId}/terminate-withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ requestedByTenantId: tenantB.tenantId }),
    });

    // H-01 fix: must be 403
    expect(withdrawRes.status).toBe(403);
    const body = await withdrawRes.json() as { error: { code: string } };
    expect(body.error?.code).toBe("FORBIDDEN_TENANT_ACTION");
  });

  test("Tenant A cannot submit terminate-request claiming to be Tenant B (H-01 request path)", async () => {
    const adminToken = await getAdminToken();
    const ts = Date.now();

    const propRes = await fetch(`${API_BASE}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `H01R PropE2E${ts}`, address: "1 Rd", city: "Delhi", state: "Delhi", pincode: "110001" }),
    });
    const prop = await propRes.json() as { id: string };

    const unitRes = await fetch(`${API_BASE}/properties/${prop.id}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ unit_number: `H01RU${ts}`, bedrooms: 2, bathrooms: 1, monthly_rent_paise: 1_800_000 }),
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
          { name: "Tenant A", email: `ta-h01r-${ts}@test.local`, is_primary: true },
          { name: "Tenant B", email: `tb-h01r-${ts}@test.local`, is_primary: false },
        ],
      }),
    });
    const lrBody = await lr.json() as {
      lease: { id: string };
      tenants: Array<{ tenantId: string; isPrimary: boolean; tempPassword: string }>;
    };

    const leaseId = lrBody.lease.id;
    const tenantA = lrBody.tenants.find((t) => t.isPrimary)!;
    const tenantB = lrBody.tenants.find((t) => !t.isPrimary)!;

    // Tenant A logs in and tries to send terminate-request claiming to be Tenant B
    const tokenA = await loginWithCreds(`ta-h01r-${ts}@test.local`, tenantA.tempPassword);

    const reqRes = await fetch(`${API_BASE}/leases/${leaseId}/terminate-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ requestedByTenantId: tenantB.tenantId, effectiveDate: "2026-07-01" }),
    });

    // H-01 fix: must be 403
    expect(reqRes.status).toBe(403);
    const body = await reqRes.json() as { error: { code: string } };
    expect(body.error?.code).toBe("FORBIDDEN_TENANT_ACTION");
  });
});
