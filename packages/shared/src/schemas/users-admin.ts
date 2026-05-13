/**
 * Zod schemas for Admin / PM user CRUD.
 *
 * Public sign-up is forbidden (SRS §9). Only ADMIN may create users of any
 * role; PROPERTY_MANAGER may create users with role MAINTENANCE or TENANT
 * (role-based authorization enforced server-side — see users.service.ts).
 *
 * `specialization` is only meaningful when role = "MAINTENANCE"; the service
 * rejects it for other roles.
 *
 * `name` is auto-derived from firstName + lastName by the service; callers
 * should send firstName + lastName.
 */

import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

/**
 * Admin "Reset Password" sub-form — used inside the Edit User modal.
 * Hits PATCH /users/:id/reset-password (ADMIN only). No email is sent to
 * the user; the admin shares the new password manually.
 */
export const AdminResetPasswordSchema = z.object({
  newPassword: passwordSchema,
});

export type AdminResetPasswordInput = z.infer<typeof AdminResetPasswordSchema>;

export const AdminRoleSchema = z.enum(["ADMIN", "PROPERTY_MANAGER", "MAINTENANCE", "TENANT"]);
export type AdminRoleValue = z.infer<typeof AdminRoleSchema>;

export const UserCreateSchema = z
  .object({
    email: z.string().email("Must be a valid email address").toLowerCase(),
    phone: z
      .string()
      .regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number")
      .optional(),
    /** Required. Concatenated with lastName → `name` on the server. */
    firstName: z.string().trim().min(1, "First name is required").max(100),
    /** Required. Concatenated with firstName → `name` on the server. */
    lastName: z.string().trim().min(1, "Last name is required").max(100),
    role: AdminRoleSchema,
    /** Admin/PM sets the initial password manually. */
    password: passwordSchema,
    /** Required when role === "MAINTENANCE"; rejected otherwise. */
    specialization: z.string().trim().min(1).max(100).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === "MAINTENANCE" && !data.specialization) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["specialization"],
        message: "Specialization is required for MAINTENANCE users",
      });
    }
    if (data.role !== "MAINTENANCE" && data.specialization) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["specialization"],
        message: "Specialization is only allowed when role is MAINTENANCE",
      });
    }
  });

export const UserAdminUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/)
    .nullable()
    .optional(),
  is_active: z.boolean().optional(),
  role: AdminRoleSchema.optional(),
  email: z
    .string()
    .email("Must be a valid email address")
    .max(254)
    .toLowerCase()
    .optional(),
  /** Editable for MAINTENANCE users; service rejects if user's role isn't MAINTENANCE. */
  specialization: z.string().trim().min(1).max(100).nullable().optional(),
});

export type UserCreateInput = z.infer<typeof UserCreateSchema>;
export type UserAdminUpdateInput = z.infer<typeof UserAdminUpdateSchema>;
