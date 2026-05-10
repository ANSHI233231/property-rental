/**
 * Four-role model from SRS §10 + API Spec §6.
 * Phase 0: enum only (no auth wiring yet — that lands in Phase 1).
 */
export const Role = {
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  MAINTENANCE: "MAINTENANCE",
  TENANT: "TENANT",
} as const;

export type RoleValue = (typeof Role)[keyof typeof Role];

export const ROLES: readonly RoleValue[] = [
  Role.ADMIN,
  Role.MANAGER,
  Role.MAINTENANCE,
  Role.TENANT,
] as const;

export function isRole(value: unknown): value is RoleValue {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
