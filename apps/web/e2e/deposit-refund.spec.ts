/**
 * E2E: deposit-refund
 *
 * After a terminated lease:
 *   - PM issues refund → 201
 *   - Re-attempt → 409 DEPOSIT_REFUND_EXISTS
 *
 * Also covers the LEASE_NOT_TERMINATED guard (refund on active lease).
 *
 * TC coverage: TC-REFUND-001, TC-REFUND-002
 * BL coverage: BL-19 (property scope on refund)
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

test.describe("Deposit refund — end-to-end flow", () => {
  test("PM issues refund on terminated lease → 201; re-attempt → 409 DEPOSIT_REFUND_EXISTS", async () => {
    const adminToken = await getAdminToken();
    const ts = Date.now();

    // Setup
    const propRes = await fetch(`${API_BASE}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `RefundProp${ts}`, address: "R Rd", city: "Delhi", state: "Delhi", pincode: "110001" }),
    });
    const prop = await propRes.json() as { id: string };

    const unitRes = await fetch(`${API_BASE}/properties/${prop.id}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ unit_number: `RU${ts}`, bedrooms: 2, bathrooms: 1, monthly_rent_paise: 1_800_000 }),
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
        tenants: [{ name: "Refund T", email: `refund-t-${ts}@test.local`, is_primary: true }],
      }),
    });
    const lrBody = await lr.json() as {
      lease: { id: string };
      tenants: Array<{ tenantId: string }>;
    };
    const leaseId = lrBody.lease.id;
    const tenantId = lrBody.tenants[0]!.tenantId;

    // Terminate
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

    const refundPayload = {
      leaseId,
      amountPaise: 3_500_000,
      deductionsPaise: 100_000,
      deductionReason: "Minor cleaning",
      paidToTenantId: tenantId,
    };

    // First refund → 201
    const r1 = await fetch(`${API_BASE}/deposit-refunds`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(refundPayload),
    });
    expect(r1.status).toBe(201);
    const r1Body = await r1.json() as { lease_id: string; amount_paise: string };
    expect(r1Body.lease_id).toBe(leaseId);
    expect(r1Body.amount_paise).toBe("3500000");

    // Second refund → 409 DEPOSIT_REFUND_EXISTS
    const r2 = await fetch(`${API_BASE}/deposit-refunds`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(refundPayload),
    });
    expect(r2.status).toBe(409);
    const r2Body = await r2.json() as { error: { code: string } };
    expect(r2Body.error.code).toBe("DEPOSIT_REFUND_EXISTS");
  });

  test("TC-REFUND-001: Refund on ACTIVE (not terminated) lease → 409 LEASE_NOT_TERMINATED", async () => {
    const adminToken = await getAdminToken();
    const ts = Date.now();

    const propRes = await fetch(`${API_BASE}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: `ActiveRefundProp${ts}`, address: "AR Rd", city: "Delhi", state: "Delhi", pincode: "110001" }),
    });
    const prop = await propRes.json() as { id: string };

    const unitRes = await fetch(`${API_BASE}/properties/${prop.id}/units`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ unit_number: `ARU${ts}`, bedrooms: 1, bathrooms: 1, monthly_rent_paise: 1_200_000 }),
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
        tenants: [{ name: "Active T", email: `active-t-${ts}@test.local`, is_primary: true }],
      }),
    });
    const lrBody = await lr.json() as {
      lease: { id: string };
      tenants: Array<{ tenantId: string }>;
    };
    const leaseId = lrBody.lease.id;
    const tenantId = lrBody.tenants[0]!.tenantId;

    // Lease is ACTIVE — refund should fail
    const refundRes = await fetch(`${API_BASE}/deposit-refunds`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        leaseId,
        amountPaise: 2_000_000,
        deductionsPaise: 0,
        paidToTenantId: tenantId,
      }),
    });
    expect(refundRes.status).toBe(409);
    const body = await refundRes.json() as { error: { code: string } };
    expect(body.error.code).toBe("LEASE_NOT_TERMINATED");
  });
});
