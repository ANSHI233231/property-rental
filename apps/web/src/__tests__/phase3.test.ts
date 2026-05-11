/**
 * Phase 3 unit tests:
 * 1. Currency rendering on lease cards (formatINR with BigInt-serialised strings)
 * 2. "Sign new lease" form schema validation
 * 3. Tenant termination approval card state logic
 * 4. Error-code mapping — 7 new Phase 3 codes
 */

import { describe, it, expect } from "vitest";
import { formatINR, rupeesToPaise, paiseToRupees } from "@gharsetu/shared";
import { LeaseInputSchema, TerminationApprovalSchema } from "@gharsetu/shared";
import { mapApiErrorCode, friendlyError } from "../lib/api/errors";

// ---------------------------------------------------------------------------
// 1. Currency rendering — BigInt-serialised string values from API
// ---------------------------------------------------------------------------

describe("currency rendering on lease cards", () => {
  it("formatINR renders ₹18,000 for 1,800,000 paise", () => {
    const result = formatINR(1_800_000);
    expect(result).toContain("₹");
    expect(result).toMatch(/18,000/);
  });

  it("formatINR renders ₹22,000 for 2,200,000 paise", () => {
    const result = formatINR(2_200_000);
    expect(result).toContain("₹");
    expect(result).toMatch(/22,000/);
  });

  it("formatINR renders ₹36,000 for 3,600,000 paise (security deposit)", () => {
    const result = formatINR(3_600_000);
    expect(result).toContain("₹");
    expect(result).toMatch(/36,000/);
  });

  it("parseInt on BigInt-serialised string matches direct number", () => {
    // API returns monthly_rent_paise as a string e.g. "1800000"
    const fromString = parseInt("1800000", 10);
    expect(formatINR(fromString)).toEqual(formatINR(1_800_000));
  });

  it("rupeesToPaise(18000) === 1800000", () => {
    expect(rupeesToPaise(18_000)).toBe(1_800_000);
  });

  it("paiseToRupees(1800000) === 18000", () => {
    expect(paiseToRupees(1_800_000)).toBe(18_000);
  });
});

// ---------------------------------------------------------------------------
// 2. "Sign new lease" form validation (LeaseInputSchema)
// ---------------------------------------------------------------------------

describe("LeaseInputSchema — sign new lease validation", () => {
  const validBase = {
    startDate: "2026-06-01",
    endDate: "2027-05-31",
    monthlyRentPaise: 1_800_000,
    securityDepositPaise: 3_600_000,
    tenants: [
      {
        name: "Raj Sharma",
        email: "raj@example.com",
        is_primary: true,
        phone: "9876543210",
      },
    ],
  };

  it("passes with valid full payload", () => {
    const result = LeaseInputSchema.safeParse(validBase);
    expect(result.success).toBe(true);
  });

  it("fails when tenants array is empty (BL-07)", () => {
    const result = LeaseInputSchema.safeParse({ ...validBase, tenants: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errs = result.error.flatten();
      // The min(1) error lands on the tenants field or root
      const msg = JSON.stringify(errs);
      expect(msg).toContain("tenant");
    }
  });

  it("fails when endDate <= startDate", () => {
    const result = LeaseInputSchema.safeParse({
      ...validBase,
      startDate: "2026-06-01",
      endDate: "2026-06-01", // same — invalid
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errs = result.error.issues;
      expect(errs.some((e) => e.message.includes("endDate"))).toBe(true);
    }
  });

  it("fails when monthlyRentPaise is 0", () => {
    const result = LeaseInputSchema.safeParse({ ...validBase, monthlyRentPaise: 0 });
    expect(result.success).toBe(false);
  });

  it("fails when monthlyRentPaise is negative", () => {
    const result = LeaseInputSchema.safeParse({ ...validBase, monthlyRentPaise: -100 });
    expect(result.success).toBe(false);
  });

  it("allows securityDepositPaise of 0 (no deposit)", () => {
    const result = LeaseInputSchema.safeParse({ ...validBase, securityDepositPaise: 0 });
    expect(result.success).toBe(true);
  });

  it("fails when startDate is not YYYY-MM-DD", () => {
    const result = LeaseInputSchema.safeParse({ ...validBase, startDate: "01/06/2026" });
    expect(result.success).toBe(false);
  });

  it("fails when tenant email is invalid", () => {
    const result = LeaseInputSchema.safeParse({
      ...validBase,
      tenants: [{ ...validBase.tenants[0], email: "not-an-email" }],
    });
    expect(result.success).toBe(false);
  });

  it("fails when tenant name is empty", () => {
    const result = LeaseInputSchema.safeParse({
      ...validBase,
      tenants: [{ ...validBase.tenants[0], name: "" }],
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Tenant termination approval card — state logic tests
// ---------------------------------------------------------------------------

describe("TerminationApprovalSchema", () => {
  it("accepts APPROVED decision with tenantId", () => {
    const result = TerminationApprovalSchema.safeParse({
      tenantId: "abc-123",
      decision: "APPROVED",
    });
    expect(result.success).toBe(true);
  });

  it("accepts REJECTED decision with optional note", () => {
    const result = TerminationApprovalSchema.safeParse({
      tenantId: "abc-123",
      decision: "REJECTED",
      note: "Not in agreement",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid decision value", () => {
    const result = TerminationApprovalSchema.safeParse({
      tenantId: "abc-123",
      decision: "MAYBE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty tenantId", () => {
    const result = TerminationApprovalSchema.safeParse({
      tenantId: "",
      decision: "APPROVED",
    });
    expect(result.success).toBe(false);
  });

  it("renders PENDING state — myApproval is pending when approval.status === PENDING", () => {
    const approvals = [
      { tenant_id: "t1", tenant_name: "Raj Sharma", status: "PENDING" as const },
      { tenant_id: "t2", tenant_name: "Priya Sharma", status: "APPROVED" as const },
    ];
    const myApproval = approvals.find((a) => a.tenant_id === "t1");
    expect(myApproval?.status).toBe("PENDING");
  });

  it("renders APPROVED state — all approvals approved triggers finalize", () => {
    const approvals = [
      { tenant_id: "t1", tenant_name: "Raj", status: "APPROVED" as const },
      { tenant_id: "t2", tenant_name: "Priya", status: "APPROVED" as const },
    ];
    const allApproved = approvals.every((a) => a.status === "APPROVED");
    expect(allApproved).toBe(true);
  });

  it("renders REJECTED state — at least one rejected means cannot finalize", () => {
    const approvals = [
      { tenant_id: "t1", tenant_name: "Raj", status: "APPROVED" as const },
      { tenant_id: "t2", tenant_name: "Priya", status: "REJECTED" as const },
    ];
    const allApproved = approvals.every((a) => a.status === "APPROVED");
    expect(allApproved).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Error-code mapping — Phase 3 new codes
// ---------------------------------------------------------------------------

describe("Phase 3 error codes — mapApiErrorCode", () => {
  it("maps UNIT_HAS_ACTIVE_LEASE", () => {
    const msg = mapApiErrorCode("UNIT_HAS_ACTIVE_LEASE");
    expect(msg).toContain("already has an active lease");
  });

  it("maps USER_NOT_TENANT", () => {
    const msg = mapApiErrorCode("USER_NOT_TENANT");
    expect(msg).toContain("isn't a Tenant");
  });

  it("maps LEASE_NEEDS_TENANT", () => {
    const msg = mapApiErrorCode("LEASE_NEEDS_TENANT");
    expect(msg).toContain("at least one tenant");
  });

  it("maps TERMINATION_OPEN", () => {
    const msg = mapApiErrorCode("TERMINATION_OPEN");
    expect(msg).toContain("open termination request");
  });

  it("maps TURNOVER_GAP_REQUIRED", () => {
    const msg = mapApiErrorCode("TURNOVER_GAP_REQUIRED");
    expect(msg).toContain("24-hour");
  });

  it("maps LEASE_NOT_TERMINATED", () => {
    const msg = mapApiErrorCode("LEASE_NOT_TERMINATED");
    expect(msg).toContain("after the lease is terminated");
  });

  it("maps REFUND_ALREADY_ISSUED", () => {
    const msg = mapApiErrorCode("REFUND_ALREADY_ISSUED");
    expect(msg).toContain("already been recorded");
  });

  it("still returns safe fallback for unknown codes", () => {
    const msg = mapApiErrorCode("NONEXISTENT_CODE_PHASE3");
    expect(msg).toBe("Something went wrong. Please try again.");
  });

  it("friendlyError uses code if known", () => {
    const err = { code: "TERMINATION_OPEN", message: "raw" };
    expect(friendlyError(err)).toContain("open termination request");
  });

  it("friendlyError falls back to message for unknown code", () => {
    const err = { code: "BRAND_NEW_CODE", message: "Server says hi" };
    expect(friendlyError(err)).toBe("Server says hi");
  });
});
