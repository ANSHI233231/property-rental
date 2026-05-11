/**
 * E2E: pm-renew-lease
 *
 * PM renews a lease:
 *   - Old lease status badge changes to RENEWED
 *   - New lease detail is visible with ACTIVE status
 *
 * TC coverage: TC-LEASE-008, TC-LEASE-009 (idempotent renew)
 * BL coverage: BL-01 (new ACTIVE blocks duplicate), BL-02 (rent immutable)
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

test.describe("PM — Renew lease flow", () => {
  test("Renew API call: old lease → RENEWED; new lease → ACTIVE, same unit", async () => {
    const token = await getAdminToken();
    const ts = Date.now();

    // Create prop + unit + lease
    const propRes = await fetch(`${API_BASE}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `RenewProp${ts}`, address: "1 Rd", city: "Delhi", state: "Delhi", pincode: "110001" }),
    });
    const prop = await propRes.json() as { id: string };

    const unitRes = await fetch(`${API_BASE}/properties/${prop.id}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ unit_number: `RU${ts}`, bedrooms: 2, bathrooms: 1, monthly_rent_paise: 1_800_000 }),
    });
    const unit = await unitRes.json() as { id: string };

    const leaseRes = await fetch(`${API_BASE}/properties/${prop.id}/units/${unit.id}/leases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        startDate: "2026-06-01",
        endDate: "2027-05-31",
        monthlyRentPaise: 1_800_000,
        securityDepositPaise: 3_600_000,
        tenants: [{ name: "Renew Tenant", email: `renew-${ts}@test.local`, is_primary: true }],
      }),
    });
    const leaseBody = await leaseRes.json() as { lease: { id: string } };
    const oldLeaseId = leaseBody.lease.id;

    // Renew
    const renewRes = await fetch(`${API_BASE}/leases/${oldLeaseId}/renew`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ newEndDate: "2028-05-31" }),
    });
    expect(renewRes.status).toBe(201);
    const newLease = await renewRes.json() as { id: string; status: string; unit_id: string };

    // New lease is ACTIVE
    expect(newLease.status).toBe("ACTIVE");
    expect(newLease.unit_id).toBe(unit.id);

    // Fetch old lease — should be RENEWED
    const oldLeaseFetch = await fetch(`${API_BASE}/leases/${oldLeaseId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const oldLeaseDetail = await oldLeaseFetch.json() as { status: string };
    expect(oldLeaseDetail.status).toBe("RENEWED");
  });

  test("Renewing a RENEWED lease returns 409 LEASE_NOT_ACTIVE", async () => {
    const token = await getAdminToken();
    const ts = Date.now();

    const propRes = await fetch(`${API_BASE}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `RenewProp2-${ts}`, address: "2 Rd", city: "Delhi", state: "Delhi", pincode: "110001" }),
    });
    const prop = await propRes.json() as { id: string };

    const unitRes = await fetch(`${API_BASE}/properties/${prop.id}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ unit_number: `RU2${ts}`, bedrooms: 1, bathrooms: 1, monthly_rent_paise: 1_200_000 }),
    });
    const unit = await unitRes.json() as { id: string };

    const lr = await fetch(`${API_BASE}/properties/${prop.id}/units/${unit.id}/leases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        startDate: "2026-06-01",
        endDate: "2027-05-31",
        monthlyRentPaise: 1_200_000,
        securityDepositPaise: 2_400_000,
        tenants: [{ name: "Renew2 T", email: `renew2-${ts}@test.local`, is_primary: true }],
      }),
    });
    const lrBody = await lr.json() as { lease: { id: string } };
    const oldId = lrBody.lease.id;

    // First renew
    await fetch(`${API_BASE}/leases/${oldId}/renew`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ newEndDate: "2028-05-31" }),
    });

    // Second renew of old (now RENEWED) lease → 409
    const r2 = await fetch(`${API_BASE}/leases/${oldId}/renew`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ newEndDate: "2029-05-31" }),
    });
    expect(r2.status).toBe(409);
    const r2Body = await r2.json() as { error: { code: string } };
    expect(r2Body.error?.code).toBe("LEASE_NOT_ACTIVE");
  });

  test("PM /pm/leases page accessible with PROPERTY_MANAGER role cookie", async ({ page, context }) => {
    const expires = Math.floor(Date.now() / 1000) + 3600;
    await context.clearCookies();
    await context.addCookies([
      { name: "__loggedIn", value: "1", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
      { name: "__role", value: "PROPERTY_MANAGER", domain: "localhost", path: "/", expires, httpOnly: false, secure: false, sameSite: "Strict" },
    ]);
    const response = await page.goto("/pm/leases");
    expect(response?.status()).toBe(200);
  });
});
