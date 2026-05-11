/**
 * BL-22 / BL-23 locale lock-ins — Phase 7 acceptance gap fill
 *
 * BL-22: All times stored & displayed in Asia/Kolkata (IST).
 *        Verified here via formatDateIST on representative UTC samples:
 *        IST midnight, month boundary, new-year boundary, no-DST confirmation.
 *
 * BL-23: Dates rendered DD/MM/YYYY everywhere.
 *        Verified via formatDateOnlyIST on representative samples including
 *        date-shift (UTC date-only vs. UTC datetime near IST midnight).
 *
 * These tests are the primary web-layer lock-ins for BL-22 and BL-23.
 * The API-layer lock-in lives in test/bl22-bl23-audit-ist.spec.ts.
 */

import { describe, it, expect } from "vitest";
import { formatDateIST, formatDateOnlyIST, todayIST } from "../lib/locale";

// ===========================================================================
// formatDateIST — IST midnight and boundary cases (BL-22)
// ===========================================================================

/**
 * BUG-BL22-001 (P1): formatDateIST returns "24:00" for IST midnight timestamps
 * instead of "00:00". Root cause: Intl.DateTimeFormat with hour12:false + en-IN
 * locale on Node 20 renders midnight as "24:00" not "00:00". This violates
 * BL-22 display requirements and will confuse users viewing midnight timestamps.
 *
 * Affected: formatDateIST in apps/web/src/lib/locale/index.ts
 * Repro: formatDateIST("2026-05-10T18:30:00.000Z")  // IST midnight
 *        → returns "11/05/2026 24:00"  (wrong)
 *        → should return "11/05/2026 00:00"  (correct)
 *
 * Failing tests: TC-BL22-WEB-001, TC-BL22-WEB-003, TC-BL22-WEB-004, TC-BL22-WEB-006
 * These tests are written to assert the CORRECT expected value. They will FAIL
 * until the production code is fixed. Do NOT change the expected values — they
 * define the contract. Hand to FE for fix.
 *
 * Fix direction: normalize the hour value — if hour === "24", return "00".
 * Example: const normalHour = get("hour") === "24" ? "00" : get("hour");
 */
describe("formatDateIST — IST midnight boundary (BL-22) [BUG-BL22-001 regression]", () => {
  it("TC-BL22-WEB-001: [FAILING — BUG-BL22-001] 2026-05-10T18:30:00Z → 11/05/2026 00:00 (IST midnight exact)", () => {
    // REGRESSION TEST: this test must fail until BUG-BL22-001 is fixed in locale/index.ts
    // Expected correct output: "11/05/2026 00:00"
    // Current buggy output:    "11/05/2026 24:00"
    const result = formatDateIST("2026-05-10T18:30:00.000Z");
    // Assert date part is correct (always passes)
    expect(result).toMatch(/^11\/05\/2026 /);
    // Assert time part — this FAILS until bug is fixed
    expect(result).toBe("11/05/2026 00:00");
  });

  it("TC-BL22-WEB-002: 1 minute before IST midnight → still 10/05/2026 23:59", () => {
    // 2026-05-10T18:29:00Z = 2026-05-10T23:59:00+05:30
    expect(formatDateIST("2026-05-10T18:29:00.000Z")).toBe("10/05/2026 23:59");
  });

  it("TC-BL22-WEB-003: [FAILING — BUG-BL22-001] 2025-12-31T18:30:00Z → 01/01/2026 00:00 (IST New Year midnight)", () => {
    const result = formatDateIST("2025-12-31T18:30:00.000Z");
    expect(result).toMatch(/^01\/01\/2026 /);
    expect(result).toBe("01/01/2026 00:00");
  });

  it("TC-BL22-WEB-004: [FAILING — BUG-BL22-001] 2026-02-28T18:30:00Z → 01/03/2026 00:00 (IST crosses month boundary)", () => {
    const result = formatDateIST("2026-02-28T18:30:00.000Z");
    expect(result).toMatch(/^01\/03\/2026 /);
    expect(result).toBe("01/03/2026 00:00");
  });

  it("TC-BL22-WEB-005: IST has no DST — same offset in summer (May 1) and winter (Jan 1)", () => {
    // Both 2026-MM-01T00:00:00Z should give 05:30 IST
    const may = formatDateIST("2026-05-01T00:00:00.000Z");
    const jan = formatDateIST("2026-01-01T00:00:00.000Z");
    // Both should show 05:30 on the respective date (no DST shift)
    expect(may).toContain("05:30");
    expect(jan).toContain("05:30");
  });

  it("TC-BL22-WEB-006: [FAILING — BUG-BL22-001] 2026-03-31T18:30:00Z → 01/04/2026 00:00 (IST April 1 midnight)", () => {
    const result = formatDateIST("2026-03-31T18:30:00.000Z");
    expect(result).toMatch(/^01\/04\/2026 /);
    expect(result).toBe("01/04/2026 00:00");
  });
});

describe("formatDateIST — error/null/invalid cases (BL-22)", () => {
  it("TC-BL22-WEB-007: null returns —", () => {
    expect(formatDateIST(null)).toBe("—");
  });

  it("TC-BL22-WEB-008: undefined returns —", () => {
    expect(formatDateIST(undefined)).toBe("—");
  });

  it("TC-BL22-WEB-009: empty string returns —", () => {
    expect(formatDateIST("")).toBe("—");
  });

  it("TC-BL22-WEB-010: 'not-a-date' returns —", () => {
    expect(formatDateIST("not-a-date")).toBe("—");
  });

  it("TC-BL22-WEB-011: arbitrary valid ISO → matches DD/MM/YYYY HH:mm pattern", () => {
    const result = formatDateIST("2026-05-11T07:30:00.000Z");
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  });

  it("TC-BL22-WEB-012: year is 2026 for 2026-05-11T00:00:00Z (no off-by-one year)", () => {
    // 2026-05-11T00:00:00Z = 2026-05-11T05:30+05:30 — still 2026
    expect(formatDateIST("2026-05-11T00:00:00.000Z")).toContain("2026");
  });
});

// ===========================================================================
// formatDateOnlyIST — date-shift and month boundary (BL-23)
// ===========================================================================

describe("formatDateOnlyIST — IST date-only boundaries (BL-23)", () => {
  it("TC-BL23-WEB-001: date-only '2026-05-11' → 11/05/2026 (no shift — midnight IST)", () => {
    expect(formatDateOnlyIST("2026-05-11")).toBe("11/05/2026");
  });

  it("TC-BL23-WEB-002: 2026-05-10T20:00:00Z → 11/05/2026 (UTC 20:00 = IST 01:30 next day)", () => {
    expect(formatDateOnlyIST("2026-05-10T20:00:00.000Z")).toBe("11/05/2026");
  });

  it("TC-BL23-WEB-003: 2026-05-10T17:00:00Z → 10/05/2026 (UTC 17:00 = IST 22:30 same day)", () => {
    expect(formatDateOnlyIST("2026-05-10T17:00:00.000Z")).toBe("10/05/2026");
  });

  it("TC-BL23-WEB-004: 2025-12-31T19:00:00Z → 01/01/2026 (IST New Year date shift)", () => {
    expect(formatDateOnlyIST("2025-12-31T19:00:00.000Z")).toBe("01/01/2026");
  });

  it("TC-BL23-WEB-005: 2026-02-28T19:00:00Z → 01/03/2026 (IST crosses Feb→Mar)", () => {
    expect(formatDateOnlyIST("2026-02-28T19:00:00.000Z")).toBe("01/03/2026");
  });

  it("TC-BL23-WEB-006: 2026-03-08 (Women's Day) → 08/03/2026 (date-only, no shift)", () => {
    expect(formatDateOnlyIST("2026-03-08")).toBe("08/03/2026");
  });

  it("TC-BL23-WEB-007: null returns —", () => {
    expect(formatDateOnlyIST(null)).toBe("—");
  });

  it("TC-BL23-WEB-008: undefined returns —", () => {
    expect(formatDateOnlyIST(undefined)).toBe("—");
  });

  it("TC-BL23-WEB-009: result always matches DD/MM/YYYY pattern", () => {
    const samples = [
      "2026-01-01",
      "2026-12-31",
      "2026-05-11T07:30:00.000Z",
      "2026-03-31T20:00:00.000Z",
    ];
    for (const s of samples) {
      expect(formatDateOnlyIST(s)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    }
  });
});

// ===========================================================================
// todayIST — dynamic convenience helper (BL-23)
// ===========================================================================

describe("todayIST — current IST date (BL-23)", () => {
  it("TC-BL23-WEB-010: todayIST() returns a string matching DD/MM/YYYY", () => {
    expect(todayIST()).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it("TC-BL23-WEB-011: todayIST() contains current IST year", () => {
    // Get current year in IST
    const year = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
    }).format(new Date());
    expect(todayIST()).toContain(year);
  });

  it("TC-BL23-WEB-012: todayIST() result is parseable back to a valid date", () => {
    const [day, month, year] = todayIST().split("/");
    const reconstructed = new Date(`${year}-${month}-${day}T00:00:00+05:30`);
    expect(isNaN(reconstructed.getTime())).toBe(false);
  });
});

// ===========================================================================
// BL-23 — no ISO or MM/DD/YYYY format leaks in locale output
// ===========================================================================

describe("BL-23 — format never leaks ISO or MM/DD/YYYY", () => {
  const isoSamples = [
    "2026-05-11T07:30:00.000Z",
    "2026-01-01T00:00:00.000Z",
    "2026-12-31T18:30:00.000Z",
  ];

  for (const iso of isoSamples) {
    it(`formatDateIST('${iso}') does not return YYYY-MM-DD or MM/DD/YYYY`, () => {
      const result = formatDateIST(iso);
      if (result === "—") return; // sentinel is ok
      // Must NOT start with a 4-digit year (ISO format)
      expect(result).not.toMatch(/^\d{4}-/);
      // Must NOT start with month/day (MM/DD/YYYY pattern — US format)
      // DD/MM/YYYY: day is 01-31, month is 01-12, year is 4 digits
      // We assert the year is in position 3 (after two slashes)
      const parts = result.split("/");
      expect(parts).toHaveLength(3);
      const yearPart = parts[2]?.split(" ")[0];
      expect(yearPart).toMatch(/^\d{4}$/);
      // The year must be >= 2025 (not a day or month value in year position)
      expect(parseInt(yearPart ?? "0", 10)).toBeGreaterThanOrEqual(2025);
    });
  }
});
