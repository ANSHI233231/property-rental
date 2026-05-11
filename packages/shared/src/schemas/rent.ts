/**
 * Zod schemas for Rent Periods, Payments, and related helpers — Phase 4.
 *
 * Business rules reflected here:
 *   BL-10: only PM/Admin may record payments (enforced at endpoint; schema is role-agnostic).
 *   BL-11: concurrent-payment reconciliation in Serializable transaction (service layer).
 *   BL-12: overdue = 5 calendar days past due_date (worker).
 *   BL-13: late fee = floor(amount_due_paise * 0.02 * floor(daysOverdue / 7)).
 *          computeLateFeePaise is the single source of truth for this calculation.
 *   BL-22/23: dates transmitted as ISO strings; rendered DD/MM/YYYY by FE.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Rent period status enum
// ---------------------------------------------------------------------------

export const RentStatusEnum = z.enum(["UPCOMING", "DUE", "PARTIAL", "PAID", "OVERDUE", "PREPAID"]);
export type RentStatusValue = z.infer<typeof RentStatusEnum>;

// ---------------------------------------------------------------------------
// Payment method enum
// ---------------------------------------------------------------------------

export const PaymentMethodEnum = z.enum(["CASH", "BANK_TRANSFER", "UPI", "CHEQUE", "OTHER"]);
export type PaymentMethodValue = z.infer<typeof PaymentMethodEnum>;

// ---------------------------------------------------------------------------
// Record payment schema (POST /payments)
// BL-10: role check is at endpoint level; schema validates shape only.
// ---------------------------------------------------------------------------

export const RecordPaymentSchema = z.object({
  /** The rent period this payment applies to. */
  rentPeriodId: z.string().min(1, "rentPeriodId is required"),
  /** Amount paid, in paise. Must be positive. */
  amountPaise: z
    .number()
    .int("Amount must be an integer (paise)")
    .positive("Amount must be positive"),
  method: PaymentMethodEnum,
  /** Optional reference: UPI ID, cheque number, NEFT UTR, etc. */
  reference: z.string().max(500).optional(),
  /** Date the tenant physically paid (YYYY-MM-DD). May be before recorded_at. */
  paidOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "paidOn must be YYYY-MM-DD"),
});

export type RecordPaymentInput = z.infer<typeof RecordPaymentSchema>;

// ---------------------------------------------------------------------------
// Void payment schema (POST /payments/:id/void)
// ---------------------------------------------------------------------------

export const VoidPaymentSchema = z.object({
  reason: z.string().min(5, "Void reason must be at least 5 characters").max(1000),
});

export type VoidPaymentInput = z.infer<typeof VoidPaymentSchema>;

// ---------------------------------------------------------------------------
// Rent period filter schema (GET /rent-periods query params)
// ---------------------------------------------------------------------------

export const RentPeriodFilterSchema = z.object({
  leaseId: z.string().optional(),
  unitId: z.string().optional(),
  status: RentStatusEnum.optional(),
  cursor: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(parseInt(v, 10), 100) : 20)),
});

export type RentPeriodFilter = z.infer<typeof RentPeriodFilterSchema>;

// ---------------------------------------------------------------------------
// computeLateFeePaise — BL-13 single source of truth
//
// Late fee = floor(amount_due_paise × 0.02 × floor(daysOverdue / 7))
//
// Rules:
//   - Non-compounded: always calculated on the original amount_due_paise, never on
//     an already-accrued balance. The "current outstanding" mentioned in the SRS is
//     the original principal × weeks (not the prior week's outstanding × 2%).
//   - Floor at both levels: floor(days/7) for full weeks, then floor the final result.
//   - Zero if daysOverdue < 7 (must complete at least 1 full week overdue).
//
// Example (BL-13 worked example from master plan):
//   ₹18,000 rent → amount_due_paise = 1_800_000n
//   17 days overdue → floor(17/7) = 2 full weeks
//   late_fee = floor(1_800_000 × 0.02 × 2) = floor(72_000) = 72_000 paise (₹720)
// ---------------------------------------------------------------------------

export function computeLateFeePaise(
  amountDuePaise: bigint,
  daysOverdue: number,
): bigint {
  if (daysOverdue < 7) return 0n;
  const fullWeeks = Math.floor(daysOverdue / 7);
  // Multiply as integer arithmetic: 2% = 2/100, so avoid floating point
  // result = floor(amount_due × 2 × fullWeeks / 100)
  const raw = amountDuePaise * BigInt(2) * BigInt(fullWeeks);
  return raw / 100n; // BigInt division truncates (floors for positive values)
}
