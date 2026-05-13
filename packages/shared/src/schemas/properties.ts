/**
 * Zod schemas for Properties, Units, and PM Transfer — Phase 2.
 * Monetary values at the API boundary use paise (integer).
 * BL-03: monthly_rent_paise is locked once state = OCCUPIED.
 * BL-05: is_retired is one-way — only the retire endpoint sets it.
 * BL-19: toPmId validated as non-blank when transferring.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Unit state enum
// ---------------------------------------------------------------------------

export const UnitStateSchema = z.enum(["AVAILABLE", "LISTED", "OCCUPIED", "MAINTENANCE"]);
export type UnitStateValue = z.infer<typeof UnitStateSchema>;

// ---------------------------------------------------------------------------
// Property schemas
// ---------------------------------------------------------------------------

export const PropertyInputSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  address: z.string().min(1, "Address is required").max(500),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
  pincode: z
    .string()
    .regex(/^\d{6}$/, "Pincode must be exactly 6 digits"),
  timezone: z.string().default("Asia/Kolkata"),
  /** If provided must be a valid PROPERTY_MANAGER user ID. */
  active_pm_id: z.string().cuid().nullable().optional(),
});

export const PropertyUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().min(1).max(500).optional(),
  city: z.string().min(1).max(100).optional(),
  state: z.string().min(1).max(100).optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  timezone: z.string().optional(),
  // active_pm_id is NOT updatable via PATCH /properties/:id — use transfer-pm
});

export const TransferPmInputSchema = z.object({
  /**
   * New PM user ID (int after the BL int-ID refactor).
   * Accepts the string the HTML <select> emits and coerces it; the empty
   * string from the "Unassign" option becomes null.
   */
  toPmId: z.preprocess(
    (v) => {
      if (v === "" || v === null || v === undefined) return null;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : v;
    },
    z.number().int().positive().nullable(),
  ),
  note: z.string().max(500).optional(),
});

export type PropertyInput = z.infer<typeof PropertyInputSchema>;
export type PropertyUpdate = z.infer<typeof PropertyUpdateSchema>;
export type TransferPmInput = z.infer<typeof TransferPmInputSchema>;

// ---------------------------------------------------------------------------
// Unit schemas
// ---------------------------------------------------------------------------

export const UnitInputSchema = z.object({
  unit_number: z.string().min(1, "Unit number is required").max(20),
  floor: z.number().int().nullable().optional(),
  bedrooms: z.number().int().min(0, "Bedrooms cannot be negative"),
  bathrooms: z.number().int().min(0, "Bathrooms cannot be negative"),
  area_sqft: z.number().int().positive().nullable().optional(),
  /** Rent stored in paise. ₹18,000 = 1_800_000 paise. */
  monthly_rent_paise: z
    .number()
    .int("Rent must be an integer (paise)")
    .positive("Rent must be positive"),
});

export const UnitUpdateSchema = z.object({
  unit_number: z.string().min(1).max(20).optional(),
  floor: z.number().int().nullable().optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  area_sqft: z.number().int().positive().nullable().optional(),
  /** If included, BL-03 enforcement: rejected if unit state = OCCUPIED or MAINTENANCE. */
  monthly_rent_paise: z
    .number()
    .int("Rent must be an integer (paise)")
    .positive("Rent must be positive")
    .optional(),
});

export const UnitStateChangeSchema = z.object({
  state: UnitStateSchema,
});

export type UnitInput = z.infer<typeof UnitInputSchema>;
export type UnitUpdate = z.infer<typeof UnitUpdateSchema>;
export type UnitStateChange = z.infer<typeof UnitStateChangeSchema>;
