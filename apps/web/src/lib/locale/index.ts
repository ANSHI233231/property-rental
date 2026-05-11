/**
 * Locale helpers — Phase 7.
 *
 * BL-22: All timestamps rendered in Asia/Kolkata (IST).
 * BL-23: Date display format is DD/MM/YYYY everywhere.
 *
 * These functions are the ONLY sanctioned way to render dates in the app.
 * Do NOT use date-fns format() with 'PP' or toLocaleDateString() directly
 * in page code — import from here instead.
 */

/**
 * Format an ISO/UTC timestamp as "DD/MM/YYYY HH:mm" in Asia/Kolkata.
 *
 * Example:
 *   formatDateIST("2026-05-11T07:30:00.000Z")
 *   → "11/05/2026 13:00"  (UTC+5:30)
 */
export function formatDateIST(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "—";

    // Format in IST using Intl.DateTimeFormat
    const dtf = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    // en-IN returns e.g. "11/05/2026, 13:00" — normalise.
    // Node 20's Intl.DateTimeFormat with hour12:false emits "24" for the midnight
    // hour under some locales; coerce back to "00" so consumers see the canonical
    // 24-hour wrap (BUG-BL22-001).
    const parts = dtf.formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
    const hour = get("hour") === "24" ? "00" : get("hour");

    return `${get("day")}/${get("month")}/${get("year")} ${hour}:${get("minute")}`;
  } catch {
    return "—";
  }
}

/**
 * Format an ISO/UTC timestamp (or date-only string) as "DD/MM/YYYY" in Asia/Kolkata.
 *
 * Example:
 *   formatDateOnlyIST("2026-05-11")
 *   → "11/05/2026"
 *
 *   formatDateOnlyIST("2026-05-10T20:30:00.000Z")
 *   → "11/05/2026"  (UTC+5:30 shifts the date)
 */
export function formatDateOnlyIST(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    // If it's a date-only string (YYYY-MM-DD) treat it as local midnight
    const date = iso.length === 10 ? new Date(`${iso}T00:00:00+05:30`) : new Date(iso);
    if (isNaN(date.getTime())) return "—";

    const dtf = new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const parts = dtf.formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";

    return `${get("day")}/${get("month")}/${get("year")}`;
  } catch {
    return "—";
  }
}

/**
 * Format the current date as "DD/MM/YYYY" in Asia/Kolkata.
 * Convenience wrapper for the "today" subtitle in dashboard topbars.
 */
export function todayIST(): string {
  return formatDateOnlyIST(new Date().toISOString());
}
