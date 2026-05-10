/**
 * @gharsetu/shared — Phase 0
 *
 * Single source of truth for cross-app types, enums, and constants.
 * Built with tsup → consumed as compiled output (dist/) by apps/web and apps/api.
 *
 * Phase 0 deliverables (per docs/MASTER_PLAN.md):
 *   - Role enum (ADMIN | MANAGER | MAINTENANCE | TENANT)
 *   - BusinessRules placeholder constants (real BL-XX wiring lands phase-by-phase)
 *
 * DO NOT add Phase 1+ surface here. This package is intentionally minimal.
 */

export const APP_NAME = "GharSetu" as const;
export const SHARED_PACKAGE_VERSION = "0.0.0" as const;

export { Role, ROLES, isRole } from "./role.js";
export type { RoleValue } from "./role.js";
export { BusinessRules } from "./business-rules.js";
