/**
 * Zod schemas for Maintenance Requests and Alerts — Phase 5.
 *
 * Business rules reflected here:
 *   BL-14: description >= 30 chars, resolution_notes >= 20 chars (also enforced at DB level).
 *   BL-15: closed requests immutable (enforced at DB trigger + service layer).
 *   BL-16: MAINTENANCE role cannot create requests (enforced at endpoint @Roles guard).
 *   BL-17: 5+ requests in a calendar month triggers an alert (@nestjs/schedule cron).
 *   BL-21: only TENANT may close a request (enforced at endpoint @Roles guard).
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const MaintenancePriorityEnum = z.enum(["LOW", "NORMAL", "HIGH", "EMERGENCY"]);
export type MaintenancePriorityValue = z.infer<typeof MaintenancePriorityEnum>;

export const MaintenanceStatusEnum = z.enum([
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
]);
export type MaintenanceStatusValue = z.infer<typeof MaintenanceStatusEnum>;

// ---------------------------------------------------------------------------
// Create maintenance request (POST /maintenance-requests)
// BL-14: description must be >= 30 characters.
// BL-16: MAINTENANCE role blocked at endpoint level; schema is role-agnostic.
// ---------------------------------------------------------------------------

export const CreateMaintenanceRequestSchema = z.object({
  unitId: z.string().min(1, "unitId is required"),
  title: z
    .string()
    .min(1, "title is required")
    .max(120, "title must not exceed 120 characters"),
  /** BL-14: minimum 30 characters. */
  description: z
    .string()
    .min(30, "description must be at least 30 characters (BL-14)")
    .max(10_000, "description must not exceed 10,000 characters"),
  priority: MaintenancePriorityEnum,
});

export type CreateMaintenanceRequestInput = z.infer<typeof CreateMaintenanceRequestSchema>;

// ---------------------------------------------------------------------------
// Assign maintenance request (POST /maintenance-requests/:id/assign)
// ---------------------------------------------------------------------------

export const AssignMaintenanceSchema = z.object({
  assigneeUserId: z.string().min(1, "assigneeUserId is required"),
});

export type AssignMaintenanceInput = z.infer<typeof AssignMaintenanceSchema>;

// ---------------------------------------------------------------------------
// Resolve maintenance request (POST /maintenance-requests/:id/resolve)
// BL-14: resolution_notes must be >= 20 characters when provided.
// ---------------------------------------------------------------------------

export const ResolveMaintenanceSchema = z.object({
  /** BL-14: minimum 20 characters. */
  resolutionNotes: z
    .string()
    .min(20, "resolutionNotes must be at least 20 characters (BL-14)")
    .max(5_000, "resolutionNotes must not exceed 5,000 characters"),
});

export type ResolveMaintenanceInput = z.infer<typeof ResolveMaintenanceSchema>;

// ---------------------------------------------------------------------------
// Dismiss maintenance alert (POST /maintenance-requests/dismiss-alert)
// BL-17: Admin / PM may dismiss the 5+ alert.
// ---------------------------------------------------------------------------

export const DismissAlertSchema = z.object({
  alertId: z.string().min(1, "alertId is required"),
  note: z.string().max(1000).optional(),
});

export type DismissAlertInput = z.infer<typeof DismissAlertSchema>;

// ---------------------------------------------------------------------------
// List maintenance requests filter schema
// ---------------------------------------------------------------------------

export const MaintenanceRequestFilterSchema = z.object({
  unitId: z.string().optional(),
  propertyId: z.string().optional(),
  status: MaintenanceStatusEnum.optional(),
  assignedToUserId: z.string().optional(),
  /** Special scope for MAINTENANCE role: 'all-open' returns all OPEN/ASSIGNED/IN_PROGRESS. */
  scope: z.enum(["all-open"]).optional(),
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(parseInt(v, 10), 100) : 20)),
});

export type MaintenanceRequestFilter = z.infer<typeof MaintenanceRequestFilterSchema>;
