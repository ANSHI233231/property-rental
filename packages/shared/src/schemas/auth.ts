/**
 * Zod schemas for auth-related API inputs.
 * Consumed by both apps/api (DTOs) and apps/web (form validation).
 *
 * Password policy (SRS §11.1 + Phase 1 spec):
 *   - minimum 10 characters
 *   - must contain at least one letter
 *   - must contain at least one digit
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Password policy (shared regex)
// ---------------------------------------------------------------------------

const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

// ---------------------------------------------------------------------------
// Auth schemas
// ---------------------------------------------------------------------------

export const LoginInputSchema = z.object({
  email: z.string().email("Must be a valid email address").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export const ForgotPasswordInputSchema = z.object({
  email: z.string().email("Must be a valid email address").toLowerCase(),
});

export const ResetPasswordInputSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: passwordSchema,
});

export const ChangePasswordInputSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

// ---------------------------------------------------------------------------
// Profile schema
// ---------------------------------------------------------------------------

export const UpdateProfileInputSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long").optional(),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number")
    .nullable()
    .optional(),
});

// ---------------------------------------------------------------------------
// Role schema
// ---------------------------------------------------------------------------

export const RoleSchema = z.enum(["ADMIN", "PROPERTY_MANAGER", "MAINTENANCE", "TENANT"]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LoginInput = z.infer<typeof LoginInputSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;
export type RoleInput = z.infer<typeof RoleSchema>;
