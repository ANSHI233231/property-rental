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
 * Convert a paise string (as serialised BigInt from the API) to an INR string.
 * Example: "1800000" → "₹18,000"
 *
 * Safe up to ~₹90 crore (Number.MAX_SAFE_INTEGER in paise ≈ ₹90 lakh crore).
 * Residential rent never approaches this.
 */
export function paiseStringToINR(s: string): string {
  const n = parseBigPaise(s);
  return formatINR(n);
}

/**
 * Parse a paise string to a regular number.
 * Use BigInt internally then convert, so we don't lose precision on large
 * values accidentally passed as floating-point strings.
 * Example: "1800000" → 1800000
 */
export function parseBigPaise(s: string): number {
  // BigInt parse handles any integer string without floating-point errors.
  return Number(BigInt(s));
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
