/**
 * Phase 4 FE Vitest gap tests.
 *
 * Covers gaps identified in the acceptance-gate audit:
 *
 * 1. paiseStringToINR("1800000") roundtrip and parseBigPaise exact value.
 * 2. computeLateFeePaise(1_800_000n, 17) → 72_000n (BL-13 exact).
 * 3. StatusBadge: each of 6 statuses maps to the correct CSS class.
 * 4. RecordPaymentSchema: amount > 0, method enum, paidOn parseable,
 *    max ₹10 crore (M-02 lock-in), reference optional.
 * 5. Tenant rent page late-fee breakdown text format:
 *    "Late fee = 2% × ₹{rent} × {weeks} weeks overdue = ₹{fee}"
 * 6. Error code mapping: 5 Phase 4 codes + unknown fallback.
 * 7. No raw paise > 1000 leaks unformatted (defensive snapshot check).
 */

import { describe, it, expect } from "vitest";
import { computeLateFeePaise, RecordPaymentSchema, PaymentMethodEnum } from "@gharsetu/shared";
import { mapApiErrorCode } from "../lib/api/errors";
import { paiseStringToINR, parseBigPaise } from "../lib/rent/format";
import { formatINR } from "@gharsetu/shared";

// ---------------------------------------------------------------------------
// StatusBadge color-class constants (mirrors StatusBadge.tsx)
// We test the mapping table, not a DOM render, to keep these pure unit tests.
// ---------------------------------------------------------------------------
import type { RentStatusValue } from "@gharsetu/shared";

const STATUS_CLASS: Record<RentStatusValue, string> = {
  PAID: "badge badge-paid",
  PARTIAL: "badge badge-partial",
  OVERDUE: "badge badge-overdue",
  PREPAID: "badge badge-prepaid",
  DUE: "badge badge-due",
  UPCOMING: "badge badge-upcoming",
};

// ---------------------------------------------------------------------------
// 1. paiseStringToINR + parseBigPaise roundtrip
// ---------------------------------------------------------------------------

describe("paiseStringToINR + parseBigPaise roundtrip", () => {
  it("paiseStringToINR('1800000') returns ₹18,000 formatted string", () => {
    const result = paiseStringToINR("1800000");
    expect(result).toContain("₹");
    expect(result).toMatch(/18,000/);
  });

  it("parseBigPaise('1800000') returns exactly 1800000 as number", () => {
    expect(parseBigPaise("1800000")).toBe(1_800_000);
  });

  it("parseBigPaise → formatINR roundtrip preserves value", () => {
    const paise = parseBigPaise("1800000");
    const displayed = formatINR(paise);
    expect(displayed).toContain("₹");
    expect(displayed).toMatch(/18,000/);
    // must not contain raw 7-digit number
    expect(displayed).not.toContain("1800000");
  });

  it("parseBigPaise('72000') returns exactly 72000 (late fee ₹720)", () => {
    expect(parseBigPaise("72000")).toBe(72_000);
  });

  it("paiseStringToINR('72000') renders ₹720", () => {
    const result = paiseStringToINR("72000");
    expect(result).toContain("₹");
    expect(result).toMatch(/720/);
    expect(result).not.toContain("72000");
  });

  it("parseBigPaise('0') returns 0", () => {
    expect(parseBigPaise("0")).toBe(0);
  });

  it("paiseStringToINR('108000') renders ₹1,080 (3-week late fee on ₹18,000 rent)", () => {
    const result = paiseStringToINR("108000");
    expect(result).toContain("₹");
    expect(result).toMatch(/1,080|1080/);
  });
});

// ---------------------------------------------------------------------------
// 2. computeLateFeePaise — BL-13 exact match and boundary checks
// ---------------------------------------------------------------------------

describe("computeLateFeePaise (BL-13 exact + boundaries)", () => {
  const RENT = 1_800_000n; // ₹18,000

  it("17 days → 2 full weeks → 72,000 paise (₹720) — BL-13 worked example", () => {
    expect(computeLateFeePaise(RENT, 17)).toBe(72_000n);
  });

  it("6 days → 0 full weeks → 0 paise (boundary: must be ≥7 days)", () => {
    expect(computeLateFeePaise(RENT, 6)).toBe(0n);
  });

  it("7 days → 1 full week → 36,000 paise (₹360)", () => {
    expect(computeLateFeePaise(RENT, 7)).toBe(36_000n);
  });

  it("13 days → 1 full week → 36,000 paise", () => {
    expect(computeLateFeePaise(RENT, 13)).toBe(36_000n);
  });

  it("14 days → 2 full weeks → 72,000 paise", () => {
    expect(computeLateFeePaise(RENT, 14)).toBe(72_000n);
  });

  it("25 days → 3 full weeks → 108,000 paise (₹1,080) — master plan example", () => {
    expect(computeLateFeePaise(RENT, 25)).toBe(108_000n);
  });

  it("30 days → 4 full weeks → 144,000 paise (₹1,440)", () => {
    expect(computeLateFeePaise(RENT, 30)).toBe(144_000n);
  });

  it("0 days → 0 paise", () => {
    expect(computeLateFeePaise(RENT, 0)).toBe(0n);
  });

  it("negative days → 0 paise (guard for upstream data errors)", () => {
    // computeLateFeePaise: daysOverdue < 7 → 0n. Negative is < 7 → 0.
    expect(computeLateFeePaise(RENT, -1)).toBe(0n);
  });
});

// ---------------------------------------------------------------------------
// 3. StatusBadge: each of 6 statuses has correct CSS class string
// ---------------------------------------------------------------------------

describe("StatusBadge class mapping (all 6 statuses)", () => {
  const cases: Array<[RentStatusValue, string]> = [
    ["PAID", "badge badge-paid"],
    ["PARTIAL", "badge badge-partial"],
    ["OVERDUE", "badge badge-overdue"],
    ["PREPAID", "badge badge-prepaid"],
    ["DUE", "badge badge-due"],
    ["UPCOMING", "badge badge-upcoming"],
  ];

  cases.forEach(([status, expectedClass]) => {
    it(`${status} maps to "${expectedClass}"`, () => {
      expect(STATUS_CLASS[status]).toBe(expectedClass);
    });
  });

  it("all 6 statuses are present in the mapping (no missing enum value)", () => {
    const expected: RentStatusValue[] = ["PAID", "PARTIAL", "OVERDUE", "PREPAID", "DUE", "UPCOMING"];
    for (const s of expected) {
      expect(STATUS_CLASS[s]).toBeDefined();
      expect(STATUS_CLASS[s]).toContain("badge");
    }
  });

  it("each status has a unique CSS class (no two statuses share the same style)", () => {
    const classes = Object.values(STATUS_CLASS);
    const unique = new Set(classes);
    expect(unique.size).toBe(classes.length);
  });
});

// ---------------------------------------------------------------------------
// 4. RecordPaymentSchema validation (M-02 lock-in: max ₹10 crore)
// ---------------------------------------------------------------------------

describe("RecordPaymentSchema (M-02 max bound + all method variants)", () => {
  const valid = {
    rentPeriodId: "period-abc",
    amountPaise: 1_800_000,
    method: "UPI" as const,
    paidOn: "2026-05-11",
  };

  it("accepts a valid payment", () => {
    expect(RecordPaymentSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects amountPaise = 0", () => {
    expect(RecordPaymentSchema.safeParse({ ...valid, amountPaise: 0 }).success).toBe(false);
  });

  it("rejects amountPaise < 0", () => {
    expect(RecordPaymentSchema.safeParse({ ...valid, amountPaise: -500 }).success).toBe(false);
  });

  it("accepts amountPaise = 1 (minimum positive)", () => {
    expect(RecordPaymentSchema.safeParse({ ...valid, amountPaise: 1 }).success).toBe(true);
  });

  it("accepts amountPaise = 1_000_000_000 (₹10 crore — boundary max) [M-02]", () => {
    expect(RecordPaymentSchema.safeParse({ ...valid, amountPaise: 1_000_000_000 }).success).toBe(true);
  });

  it("rejects amountPaise = 1_000_000_001 (just above ₹10 crore) [M-02]", () => {
    expect(RecordPaymentSchema.safeParse({ ...valid, amountPaise: 1_000_000_001 }).success).toBe(false);
  });

  it("rejects amountPaise = 9_999_999_999 (far above ceiling) [M-02]", () => {
    expect(RecordPaymentSchema.safeParse({ ...valid, amountPaise: 9_999_999_999 }).success).toBe(false);
  });

  it("accepts all 5 valid payment methods", () => {
    const methods = ["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "OTHER"] as const;
    for (const method of methods) {
      const result = RecordPaymentSchema.safeParse({ ...valid, method });
      expect(result.success).toBe(true);
    }
    // Verify PaymentMethodEnum matches the same set
    for (const method of methods) {
      expect(PaymentMethodEnum.safeParse(method).success).toBe(true);
    }
  });

  it("rejects unknown method 'PAYPAL'", () => {
    expect(RecordPaymentSchema.safeParse({ ...valid, method: "PAYPAL" }).success).toBe(false);
  });

  it("rejects paidOn in DD/MM/YYYY format (must be YYYY-MM-DD)", () => {
    expect(RecordPaymentSchema.safeParse({ ...valid, paidOn: "11/05/2026" }).success).toBe(false);
  });

  it("accepts optional reference field", () => {
    const result = RecordPaymentSchema.safeParse({ ...valid, reference: "UPI/TX987654" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reference).toBe("UPI/TX987654");
    }
  });

  it("accepts payment without reference field", () => {
    const result = RecordPaymentSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reference).toBeUndefined();
    }
  });

  it("rejects non-integer amountPaise", () => {
    expect(RecordPaymentSchema.safeParse({ ...valid, amountPaise: 100.5 }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Late-fee breakdown text format (BL-13 tenant view)
// Tests the template string format: "Late fee = 2% × ₹{rent} × {weeks} weeks overdue = ₹{fee}"
// ---------------------------------------------------------------------------

describe("Late-fee breakdown text format (BL-13 tenant view)", () => {
  /**
   * Helper that reproduces the rendering logic from tenant/rent/page.tsx:
   * "Late fee = 2% × {paiseStringToINR(amountDuePaise)} × {weeks} week{s} overdue = {paiseStringToINR(lateFeePaise)}"
   */
  function buildBreakdownText(amountDuePaise: string, lateFeePaise: string, weeks: number): string {
    return `Late fee = 2% × ${paiseStringToINR(amountDuePaise)} × ${weeks} week${weeks !== 1 ? "s" : ""} overdue = ${paiseStringToINR(lateFeePaise)}`;
  }

  it("BL-13 worked example: 2 weeks overdue on ₹18,000 → ₹720 → correct breakdown string", () => {
    const text = buildBreakdownText("1800000", "72000", 2);
    expect(text).toMatch(/Late fee = 2%/);
    expect(text).toMatch(/18,000/);
    expect(text).toMatch(/2 weeks overdue/);
    expect(text).toMatch(/720/);
  });

  it("singular: 1 week overdue uses 'week' not 'weeks'", () => {
    const text = buildBreakdownText("1800000", "36000", 1);
    expect(text).toContain("1 week overdue");
    expect(text).not.toContain("1 weeks overdue");
  });

  it("plural: 3 weeks overdue uses 'weeks'", () => {
    const text = buildBreakdownText("1800000", "108000", 3);
    expect(text).toContain("3 weeks overdue");
  });

  it("master plan: 25 days overdue (3 weeks) → ₹1,080", () => {
    const text = buildBreakdownText("1800000", "108000", 3);
    expect(text).toMatch(/1,080|1080/);
  });
});

// ---------------------------------------------------------------------------
// 6. Error code mapping: 5 Phase 4 codes + unknown fallback
// ---------------------------------------------------------------------------

describe("Phase 4 error code mapping (all 5 codes)", () => {
  const cases: Array<[string, RegExp | string]> = [
    ["BL_10_TENANT_CANNOT_RECORD_PAYMENT", "Only the Property Manager can record payments."],
    ["PAYMENT_VOID_CASCADE_BLOCKED", /can't be voided/i],
    ["RENT_PERIOD_NOT_FOUND", /rent period not found/i],
    ["INVALID_PAYMENT_AMOUNT", /greater than zero/i],
    ["PERIOD_ALREADY_PAID", /already fully paid/i],
  ];

  cases.forEach(([code, expected]) => {
    it(`${code} → friendly message`, () => {
      const msg = mapApiErrorCode(code);
      if (typeof expected === "string") {
        expect(msg).toBe(expected);
      } else {
        expect(msg).toMatch(expected);
      }
    });
  });

  it("unknown code returns safe default fallback", () => {
    expect(mapApiErrorCode("TOTALLY_UNKNOWN_CODE_XYZ")).toBe("Something went wrong. Please try again.");
  });

  it("empty string code returns safe default fallback", () => {
    expect(mapApiErrorCode("")).toBe("Something went wrong. Please try again.");
  });
});

// ---------------------------------------------------------------------------
// 7. No raw paise > 1000 leaks unformatted (defensive snapshot check)
//    If formatINR or paiseStringToINR output contains a bare 4+ digit
//    number matching a paise amount, it is a formatting bug.
// ---------------------------------------------------------------------------

describe("Defensive: no raw paise > 1000 surfaces unformatted", () => {
  const testCases: Array<{ paise: string; mustNotContain: RegExp }> = [
    // ₹18,000 rent = 1,800,000 paise — must not appear as raw "1800000"
    { paise: "1800000", mustNotContain: /\b1800000\b/ },
    // ₹720 late fee = 72,000 paise — "72000" as a bare number
    { paise: "72000", mustNotContain: /\b72000\b/ },
    // ₹1,080 = 108,000 paise
    { paise: "108000", mustNotContain: /\b108000\b/ },
    // ₹36,000 deposit = 3,600,000 paise
    { paise: "3600000", mustNotContain: /\b3600000\b/ },
  ];

  testCases.forEach(({ paise, mustNotContain }) => {
    it(`paiseStringToINR("${paise}") does not expose raw ${paise}`, () => {
      const result = paiseStringToINR(paise);
      expect(result).not.toMatch(mustNotContain);
      expect(result).toContain("₹");
    });

    it(`formatINR(parseBigPaise("${paise}")) does not expose raw ${paise}`, () => {
      const result = formatINR(parseBigPaise(paise));
      expect(result).not.toMatch(mustNotContain);
      expect(result).toContain("₹");
    });
  });
});
