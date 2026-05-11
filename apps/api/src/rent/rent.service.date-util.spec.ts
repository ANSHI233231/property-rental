/**
 * Unit tests for the addMonthMinusOneDay date utility inside RentService.
 * BUG-008-001: the original implementation used setMonth(+1) then setDate(-1),
 * which overflows for month-end dates (e.g. Jan 31 → Mar 2 instead of Feb 28).
 *
 * Fixed algorithm: compute last day of next month; if date.day >= lastDay,
 * return lastDay (overflow case); else return same-day-next-month - 1 (normal case).
 *
 * These tests duplicate the private helper to avoid NestJS module wiring overhead.
 */

function addMonthMinusOneDay(date: Date): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const d = date.getUTCDate();

  // Last day of next month (UTC)
  const lastOfNextMonth = new Date(Date.UTC(y, m + 2, 0));
  const lastDay = lastOfNextMonth.getUTCDate();

  if (d >= lastDay) {
    // Overflow or exact boundary: period_end = last day of next month
    return lastOfNextMonth;
  }

  // Normal: period_end = same day next month - 1 day
  return new Date(Date.UTC(y, m + 1, d - 1));
}

describe("addMonthMinusOneDay — BUG-008-001 regression + edge cases", () => {
  function utc(year: number, month: number, day: number): Date {
    return new Date(Date.UTC(year, month - 1, day));
  }

  it("TC-RENT-012a: Jan 31 (non-leap 2026) → Feb 28 [overflow: d(31)>=lastDay(28)]", () => {
    const result = addMonthMinusOneDay(utc(2026, 1, 31));
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(1); // February (0-indexed)
    expect(result.getUTCDate()).toBe(28);
  });

  it("TC-RENT-012b: Jan 31 (leap year 2024) → Feb 29 [overflow: d(31)>=lastDay(29)]", () => {
    const result = addMonthMinusOneDay(utc(2024, 1, 31));
    expect(result.getUTCFullYear()).toBe(2024);
    expect(result.getUTCMonth()).toBe(1); // February
    expect(result.getUTCDate()).toBe(29); // 2024 is a leap year
  });

  it("TC-RENT-012c: Feb 28 (non-leap 2026) → Mar 27 [normal: d(28)<lastDay(31)]", () => {
    const result = addMonthMinusOneDay(utc(2026, 2, 28));
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(2); // March
    expect(result.getUTCDate()).toBe(27);
  });

  it("TC-RENT-012d: Feb 29 (leap 2024-02-29) → Mar 28 [normal: d(29)<lastDay(31)]", () => {
    const result = addMonthMinusOneDay(utc(2024, 2, 29));
    expect(result.getUTCFullYear()).toBe(2024);
    expect(result.getUTCMonth()).toBe(2); // March
    expect(result.getUTCDate()).toBe(28);
  });

  it("TC-RENT-012e: Mar 31 (2026) → Apr 30 [overflow: d(31)>=lastDay(30)]", () => {
    // April has 30 days; overflow → last day of Apr = Apr 30.
    const result = addMonthMinusOneDay(utc(2026, 3, 31));
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(3); // April
    expect(result.getUTCDate()).toBe(30);
  });

  it("TC-RENT-012f: Apr 30 (2026) → May 29 [normal: d(30)<lastDay(31)]", () => {
    const result = addMonthMinusOneDay(utc(2026, 4, 30));
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(4); // May
    expect(result.getUTCDate()).toBe(29);
  });

  it("TC-RENT-012g: Dec 31 (2026) → Jan 31 2027 [overflow: d(31)>=lastDay(31)]", () => {
    // Last day of January = 31; d(31) >= 31 → overflow → Jan 31.
    const result = addMonthMinusOneDay(utc(2026, 12, 31));
    expect(result.getUTCFullYear()).toBe(2027);
    expect(result.getUTCMonth()).toBe(0); // January
    expect(result.getUTCDate()).toBe(31);
  });

  it("TC-RENT-012h: Jun 15 (2026) → Jul 14 [normal: d(15)<lastDay(31)]", () => {
    const result = addMonthMinusOneDay(utc(2026, 6, 15));
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(6); // July
    expect(result.getUTCDate()).toBe(14);
  });
});
