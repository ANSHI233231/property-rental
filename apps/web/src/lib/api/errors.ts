/**
 * Server-error code → friendly UI message mapping — Phase 2.
 * Backend returns { error: { code, message } }; we map known codes
 * to context-appropriate strings. Unknown codes fall back to a safe default.
 */

const ERROR_MAP: Record<string, string> = {
  // Phase 2
  PM_ALREADY_ASSIGNED:
    "This Property Manager is already assigned to another property.",
  UNIT_RENT_LOCKED:
    "Rent can only be changed while the unit is Available or Listed.",
  LAST_ADMIN_PROTECTED:
    "At least one Admin must remain. Promote another user first.",
  PM_HAS_PROPERTY:
    "This PM is currently assigned to a property. Transfer the property first.",
  INVALID_PM_ROLE: "Selected user is not a Property Manager.",
  // Phase 3 — Leases + Tenants + Termination
  UNIT_HAS_ACTIVE_LEASE: "This unit already has an active lease.",
  USER_NOT_TENANT: "An account with this email exists but isn't a Tenant.",
  LEASE_NEEDS_TENANT: "A lease must have at least one tenant.",
  TERMINATION_OPEN:
    "There is already an open termination request for this lease.",
  TURNOVER_GAP_REQUIRED:
    "A 24-hour turnover period is required between tenants.",
  LEASE_NOT_TERMINATED:
    "Refund can only be issued after the lease is terminated.",
  REFUND_ALREADY_ISSUED:
    "A deposit refund has already been recorded for this lease.",
  // Phase 4 — Rent / Payments
  BL_10_TENANT_CANNOT_RECORD_PAYMENT:
    "Only the Property Manager can record payments.",
  PAYMENT_VOID_CASCADE_BLOCKED:
    "This payment can't be voided because a later payment used its credit.",
  RENT_PERIOD_NOT_FOUND: "Rent period not found.",
  INVALID_PAYMENT_AMOUNT: "Enter a payment amount greater than zero.",
  PERIOD_ALREADY_PAID: "This period is already fully paid.",
  // Phase 7 — Rate limiting (HTTP 429)
  HTTP_429: "Too many attempts. Try again shortly.",
  RATE_LIMIT_EXCEEDED: "Too many attempts. Try again shortly.",
  // Phase 5 — Maintenance
  // BL-16 deviation (2026-05-13): Tenant, Admin, and PM may raise. Only
  // MAINTENANCE staff are blocked from raising.
  BL_16_ONLY_TENANT_CAN_RAISE_MAINTENANCE:
    "Maintenance staff cannot raise requests. Ask a tenant, PM, or admin.",
  BL_21_ONLY_TENANT_CAN_CLOSE_MAINTENANCE:
    "Only the tenant who raised this request can close it.",
  NO_ACTIVE_LEASE_ON_UNIT:
    "You don't have an active lease on this unit.",
  INVALID_TRANSITION:
    "This request can't transition from its current status.",
  NOT_YOUR_ASSIGNMENT:
    "You can only act on requests assigned to you.",
  // Cross-property scope violation — surfaced when a PM tries to act on a
  // unit/property they don't manage.
  PROPERTY_ACCESS_DENIED:
    "You can only act on units in your assigned property.",
};

const DEFAULT_ERROR = "Something went wrong. Please try again.";

/**
 * Map a server error code to a display message.
 * Falls back to DEFAULT_ERROR for unmapped codes.
 */
export function mapApiErrorCode(code: string): string {
  return ERROR_MAP[code] ?? DEFAULT_ERROR;
}

/**
 * Extract a friendly message from an unknown thrown value.
 * Works with ApiError (from lib/api/client) and generic Error.
 */
export function friendlyError(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { code?: string; message?: string };
    if (e.code && ERROR_MAP[e.code]) return ERROR_MAP[e.code] as string;
    if (e.message && typeof e.message === "string") return e.message;
  }
  return DEFAULT_ERROR;
}
