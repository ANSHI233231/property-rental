/**
 * Zod schemas for Leases, Tenants, Terminations, and Deposit Refunds — Phase 3.
 *
 * Business rules reflected here:
 *   BL-01: lease creation requires unit_id — the partial unique index at DB level
 *          ensures no two ACTIVE leases share a unit.
 *   BL-07: tenants array must have at least one entry.
 *   BL-08/09: termination flows require explicit approval from every co-tenant.
 *   BL-22/23: dates transmitted as ISO strings; the API renders them as DD/MM/YYYY
 *             or lets the FE format from ISO.
 */

import { z } from "zod";
import { passwordSchema } from "./users-admin.js";

// ---------------------------------------------------------------------------
// Lease status enum
// ---------------------------------------------------------------------------

export const LeaseStatusSchema = z.enum(["ACTIVE", "EXPIRED", "RENEWED", "TERMINATED"]);
export type LeaseStatusValue = z.infer<typeof LeaseStatusSchema>;

// ---------------------------------------------------------------------------
// Termination approval status enum
// ---------------------------------------------------------------------------

export const TerminationApprovalStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type TerminationApprovalStatusValue = z.infer<typeof TerminationApprovalStatusSchema>;

// ---------------------------------------------------------------------------
// Tenant input (embedded in lease creation payload)
// ---------------------------------------------------------------------------

export const TenantInputSchema = z.object({
  name: z.string().min(1, "Tenant name is required").max(200),
  email: z.string().email("Valid email required"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Valid Indian mobile number required").optional(),
  is_primary: z.boolean().default(false),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
    .optional(),
  id_proof_type: z.string().max(50).optional(),
  id_proof_number: z.string().max(100).optional(),
  emergency_contact_name: z.string().max(200).optional(),
  emergency_contact_phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Valid Indian mobile number required")
    .optional(),
  /**
   * Initial password set by the PM at lease creation. Optional at the schema
   * level so existing-tenant rows (matched by email) don't have to provide
   * one — the API ignores it for existing accounts and uses it only when
   * creating a new user. The FE form should require it.
   */
  password: passwordSchema.optional(),
});

export type TenantInput = z.infer<typeof TenantInputSchema>;

// ---------------------------------------------------------------------------
// Tenant update schema (PATCH /tenants/:id — personal info only)
// ---------------------------------------------------------------------------

export const TenantUpdateSchema = z.object({
  // Accept "YYYY-MM-DD" or empty/null. ISO timestamps coming back from the
  // API are sliced to date-only on form populate (see /pm/tenants/[id]).
  dob: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Date must be YYYY-MM-DD")
    .transform((v) => (v === "" ? undefined : v))
    .optional()
    .nullable(),
  id_proof_type: z.string().trim().max(50).optional().nullable(),
  id_proof_number: z.string().trim().max(100).optional().nullable(),
  emergency_contact_name: z.string().trim().max(200).optional().nullable(),
  // 10-digit Indian mobile, optionally prefixed with +91 or 0. Whitespace
  // and dashes are stripped before the regex check so paste-friendly.
  emergency_contact_phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, "").replace(/^\+?91/, "").replace(/^0/, ""))
    .refine(
      (v) => v === "" || /^[6-9]\d{9}$/.test(v),
      "Valid Indian mobile number required (10 digits starting 6-9)",
    )
    .transform((v) => (v === "" ? undefined : v))
    .optional()
    .nullable(),
});

export type TenantUpdate = z.infer<typeof TenantUpdateSchema>;

// ---------------------------------------------------------------------------
// Lease creation schema
// ---------------------------------------------------------------------------

export const LeaseInputSchema = z
  .object({
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD"),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD"),
    /** Rent in paise. BL-02: immutable after creation. */
    monthlyRentPaise: z
      .number()
      .int("Rent must be an integer (paise)")
      .positive("Rent must be positive"),
    /** Security deposit in paise. BL-02: immutable after creation. */
    securityDepositPaise: z
      .number()
      .int("Deposit must be an integer (paise)")
      .nonnegative("Deposit cannot be negative"),
    /**
     * BL-07: at least one tenant required.
     * F-02: capped at 20 to prevent CPU-spike / array-bomb vector (VAPT phase-8).
     */
    tenants: z
      .array(TenantInputSchema)
      .min(1, "At least one tenant is required (BL-07)")
      .max(20, "A maximum of 20 tenants are allowed per lease"),
  })
  .refine((d) => d.startDate < d.endDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });

export type LeaseInput = z.infer<typeof LeaseInputSchema>;

// ---------------------------------------------------------------------------
// Lease renew schema
// ---------------------------------------------------------------------------

export const LeaseRenewSchema = z
  .object({
    newEndDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "newEndDate must be YYYY-MM-DD"),
    /** Optional: override rent for the new lease. BL-02 means we create a NEW lease. */
    monthlyRentPaise: z
      .number()
      .int()
      .positive()
      .optional(),
    /** Optional: override deposit for the new lease. */
    securityDepositPaise: z
      .number()
      .int()
      .nonnegative()
      .optional(),
    /**
     * Optional: subset of tenant IDs to carry over. If omitted, all current active tenants are retained.
     * F-02: capped at 20 to prevent CPU-spike / array-bomb vector (VAPT phase-8).
     */
    tenantIds: z.array(z.string()).max(20, "A maximum of 20 tenant IDs are allowed per renewal").optional(),
  });

export type LeaseRenew = z.infer<typeof LeaseRenewSchema>;

// ---------------------------------------------------------------------------
// Termination request schema
// ---------------------------------------------------------------------------

export const TerminationRequestSchema = z.object({
  /** The tenant who is initiating the request. Must be on the lease. */
  requestedByTenantId: z.string().min(1, "requestedByTenantId is required"),
  /** The calendar date the lease should end (effective date). */
  effectiveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "effectiveDate must be YYYY-MM-DD"),
  reason: z.string().max(1000).optional(),
});

export type TerminationRequest = z.infer<typeof TerminationRequestSchema>;

// ---------------------------------------------------------------------------
// Termination approval schema
// ---------------------------------------------------------------------------

export const TerminationApprovalSchema = z.object({
  /** The tenant casting the vote. Must have a PENDING approval row. */
  tenantId: z.string().min(1, "tenantId is required"),
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().max(500).optional(),
});

export type TerminationApproval = z.infer<typeof TerminationApprovalSchema>;

// ---------------------------------------------------------------------------
// Deposit refund schema
// ---------------------------------------------------------------------------

export const DepositRefundSchema = z.object({
  leaseId: z.string().min(1, "leaseId is required"),
  amountPaise: z
    .number()
    .int("Amount must be an integer (paise)")
    .nonnegative("Amount cannot be negative"),
  deductionsPaise: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .default(0),
  deductionReason: z.string().max(500).optional(),
  paidToTenantId: z.string().min(1, "paidToTenantId is required"),
});

export type DepositRefundInput = z.infer<typeof DepositRefundSchema>;
