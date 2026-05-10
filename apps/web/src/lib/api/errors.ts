/**
 * Server-error code → friendly UI message mapping — Phase 2.
 * Backend returns { error: { code, message } }; we map known codes
 * to context-appropriate strings. Unknown codes fall back to a safe default.
 */

const ERROR_MAP: Record<string, string> = {
  PM_ALREADY_ASSIGNED:
    "This Property Manager is already assigned to another property.",
  UNIT_RENT_LOCKED:
    "Rent can only be changed while the unit is Available or Listed.",
  LAST_ADMIN_PROTECTED:
    "At least one Admin must remain. Promote another user first.",
  PM_HAS_PROPERTY:
    "This PM is currently assigned to a property. Transfer the property first.",
  INVALID_PM_ROLE: "Selected user is not a Property Manager.",
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
