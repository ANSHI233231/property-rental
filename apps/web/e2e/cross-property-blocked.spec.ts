/**
 * E2E: cross-property-blocked
 *
 * PM-B navigates to /pm/leases/<PA-lease-id> via direct URL manipulation
 * (or issues an API call from the page) → 403 surfaces.
 *
 * This is the H-02 + PropertyScopeGuard E2E lock-in.
 *
 * TC coverage: TC-ROLE-003 (BL-19), H-02 security fix
 * BL coverage: BL-19
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

test.describe("H-02 + PropertyScopeGuard — cross-property blocked", () => {
  test("PM-B GET /leases/:idFromPropertyA → 403", async () => {
    const adminToken = await getAdminToken();
    const ts = Date.now();

    // Create Property A and lease on it
    const propARes = await fetch(`${API_BASE}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `CrossPropA${ts}`, address: "A Rd", city: "Delhi", state: "Delhi", pincode: "110001" }),
    });
    const propA = await propARes.json() as { id: string };

    const unitARes = await fetch(`${API_BASE}/properties/${propA.id}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ unit_number: `CAU${ts}`, bedrooms: 2, bathrooms: 1, monthly_rent_paise: 1_800_000 }),
    });
    const unitA = await unitARes.json() as { id: string };

    const lr = await fetch(`${API_BASE}/properties/${propA.id}/units/${unitA.id}/leases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        startDate: "2026-06-01",
        endDate: "2027-05-31",
        monthlyRentPaise: 1_800_000,
        securityDepositPaise: 3_600_000,
        tenants: [{ name: "Cross T", email: `cross-t-${ts}@test.local`, is_primary: true }],
      }),
    });
    const lrBody = await lr.json() as { lease: { id: string } };
    const leaseIdFromPropA = lrBody.lease.id;

    // Create Property B and PM-B
    const propBRes = await fetch(`${API_BASE}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `CrossPropB${ts}`, address: "B Rd", city: "Delhi", state: "Delhi", pincode: "110002" }),
    });
    const propB = await propBRes.json() as { id: string };

    const pmBCreateRes = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ email: `pmb-cross-${ts}@test.local`, name: "PM-B Cross", role: "PROPERTY_MANAGER" }),
    });
    expect(pmBCreateRes.status).toBe(201);
    const pmB = await pmBCreateRes.json() as { id: string; temp_password: string };

    await fetch(`${API_BASE}/properties/${propB.id}/transfer-pm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ toPmId: pmB.id }),
    });

    const tokenPmB = await loginWithCreds(`pmb-cross-${ts}@test.local`, pmB.temp_password);

    // PM-B tries GET /leases/:leaseIdFromPropA → 403
    const getRes = await fetch(`${API_BASE}/leases/${leaseIdFromPropA}`, {
      headers: { Authorization: `Bearer ${tokenPmB}` },
    });
    expect(getRes.status).toBe(403);
  });

  test("PM-B POST /leases/:idFromPropertyA/renew → 403", async () => {
    const adminToken = await getAdminToken();
    const ts = Date.now();

    const propARes = await fetch(`${API_BASE}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `CrossPropA2-${ts}`, address: "A2 Rd", city: "Delhi", state: "Delhi", pincode: "110001" }),
    });
    const propA = await propARes.json() as { id: string };

    const unitARes = await fetch(`${API_BASE}/properties/${propA.id}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ unit_number: `CAU2${ts}`, bedrooms: 1, bathrooms: 1, monthly_rent_paise: 1_200_000 }),
    });
    const unitA = await unitARes.json() as { id: string };

    const lr = await fetch(`${API_BASE}/properties/${propA.id}/units/${unitA.id}/leases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        startDate: "2026-06-01",
        endDate: "2027-05-31",
        monthlyRentPaise: 1_200_000,
        securityDepositPaise: 2_400_000,
        tenants: [{ name: "Cross T2", email: `cross-t2-${ts}@test.local`, is_primary: true }],
      }),
    });
    const lrBody = await lr.json() as { lease: { id: string } };
    const leaseId = lrBody.lease.id;

    const propBRes = await fetch(`${API_BASE}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `CrossPropB2-${ts}`, address: "B2 Rd", city: "Delhi", state: "Delhi", pincode: "110002" }),
    });
    const propB = await propBRes.json() as { id: string };

    const pmBRes = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ email: `pmb2-cross-${ts}@test.local`, name: "PM-B2 Cross", role: "PROPERTY_MANAGER" }),
    });
    const pmB = await pmBRes.json() as { id: string; temp_password: string };

    await fetch(`${API_BASE}/properties/${propB.id}/transfer-pm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ toPmId: pmB.id }),
    });

    const tokenPmB = await loginWithCreds(`pmb2-cross-${ts}@test.local`, pmB.temp_password);

    const renewRes = await fetch(`${API_BASE}/leases/${leaseId}/renew`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenPmB}` },
      body: JSON.stringify({ newEndDate: "2028-05-31" }),
    });
    expect(renewRes.status).toBe(403);
  });

  test("H-02: PM-B POST /deposit-refunds for Property A terminated lease → 403", async () => {
    const adminToken = await getAdminToken();
    const ts = Date.now();

    // Create Property A + unit + lease + terminate it
    const propARes = await fetch(`${API_BASE}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `H02PropA${ts}`, address: "HA Rd", city: "Delhi", state: "Delhi", pincode: "110001" }),
    });
    const propA = await propARes.json() as { id: string };

    const unitARes = await fetch(`${API_BASE}/properties/${propA.id}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ unit_number: `H02AU${ts}`, bedrooms: 1, bathrooms: 1, monthly_rent_paise: 1_200_000 }),
    });
    const unitA = await unitARes.json() as { id: string };

    const lr = await fetch(`${API_BASE}/properties/${propA.id}/units/${unitA.id}/leases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        startDate: "2026-06-01",
        endDate: "2027-05-31",
        monthlyRentPaise: 1_200_000,
        securityDepositPaise: 2_400_000,
        tenants: [{ name: "H02 T", email: `h02t-${ts}@test.local`, is_primary: true }],
      }),
    });
    const lrBody = await lr.json() as {
      lease: { id: string };
      tenants: Array<{ tenantId: string }>;
    };
    const leaseId = lrBody.lease.id;
    const tenantId = lrBody.tenants[0]!.tenantId;

    // Terminate the lease
    await fetch(`${API_BASE}/leases/${leaseId}/terminate-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ requestedByTenantId: tenantId, effectiveDate: "2026-07-01" }),
    });
    await fetch(`${API_BASE}/leases/${leaseId}/finalize-termination`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
    });

    // Create Property B + PM-B
    const propBRes = await fetch(`${API_BASE}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `H02PropB${ts}`, address: "HB Rd", city: "Delhi", state: "Delhi", pincode: "110002" }),
    });
    const propB = await propBRes.json() as { id: string };

    const pmBRes = await fetch(`${API_BASE}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ email: `pmb-h02-${ts}@test.local`, name: "PM-B H02", role: "PROPERTY_MANAGER" }),
    });
    const pmB = await pmBRes.json() as { id: string; temp_password: string };

    await fetch(`${API_BASE}/properties/${propB.id}/transfer-pm`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ toPmId: pmB.id }),
    });

    const tokenPmB = await loginWithCreds(`pmb-h02-${ts}@test.local`, pmB.temp_password);

    // PM-B tries to issue refund for Property A's terminated lease → 403
    const refundRes = await fetch(`${API_BASE}/deposit-refunds`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenPmB}` },
      body: JSON.stringify({
        leaseId,
        amountPaise: 2_000_000,
        deductionsPaise: 0,
        paidToTenantId: tenantId,
      }),
    });
    expect(refundRes.status).toBe(403);
  });
});
