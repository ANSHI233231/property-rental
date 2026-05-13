/**
 * Rent-specific formatting helpers — Phase 4.
 *
 * All paise values from the API arrive as serialised BigInt strings.
 * We treat them as strings at the wire boundary and only convert to
 * a plain number for display via formatINR (safe because formatINR
 * operates in rupees, which fit comfortably in a JS double for any
 * realistic residential-rent amount).
 */

import { formatINR } from "@gharsetu/shared";
import { differenceInCalendarDays } from "date-fns";

// ---------------------------------------------------------------------------
// Wire-to-display helpers
// ---------------------------------------------------------------------------

/**
 * Convert a paise value (string or number, as serialised BigInt from the API)
 * to an INR string. Defensive: undefined/null/empty are treated as 0 so a
 * single missing field does not crash the page.
 * Example: "1800000" → "₹18,000"
 *
 * Safe up to ~₹90 crore (Number.MAX_SAFE_INTEGER in paise ≈ ₹90 lakh crore).
 * Residential rent never approaches this.
 */
export function paiseStringToINR(s: string | number | null | undefined): string {
  const n = parseBigPaise(s);
  return formatINR(n);
}

/**
 * Parse a paise value (string or number) to a regular JS number.
 * Defensive: undefined/null/empty/NaN-shaped strings return 0 instead of
 * throwing. This guards against partially-shaped API responses or fields the
 * client expected but the server omitted.
 * Example: "1800000" → 1800000 · undefined → 0 · "x" → 0
 */
export function parseBigPaise(s: string | number | null | undefined): number {
  if (s === undefined || s === null || s === "") return 0;
  const str = typeof s === "number" ? String(s) : s;
  // Strip any decimals — paise is integer by contract.
  const clean = str.split(".")[0]!.replace(/[^0-9-]/g, "");
  if (clean === "" || clean === "-") return 0;
  try {
    return Number(BigInt(clean));
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Overdue calculation helpers
// ---------------------------------------------------------------------------

/**
 * Number of calendar days a period is overdue.
 * Returns 0 if today is on or before dueDate.
 */
export function daysOverdue(dueDate: Date, today: Date): number {
  const diff = differenceInCalendarDays(today, dueDate);
  return diff > 0 ? diff : 0;
}

/**
 * Number of full weeks overdue (floor of daysOverdue / 7).
 * Example: 17 days → 2 full weeks.
 */
export function weeksOverdue(dueDate: Date, today: Date): number {
  return Math.floor(daysOverdue(dueDate, today) / 7);
}
