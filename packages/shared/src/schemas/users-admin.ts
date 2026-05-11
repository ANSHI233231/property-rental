/**
 * Zod schemas for Admin user CRUD — Phase 2.
 * Public sign-up is forbidden (SRS §9). Only ADMIN may use POST /users.
 */

import { z } from "zod";

const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .regex(/[a-zA-Z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const AdminRoleSchema = z.enum(["ADMIN", "PROPERTY_MANAGER", "MAINTENANCE", "TENANT"]);
export type AdminRoleValue = z.infer<typeof AdminRoleSchema>;

export const UserCreateSchema = z.object({
  email: z.string().email("Must be a valid email address").toLowerCase(),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Must be a valid 10-digit Indian mobile number")
    .optional(),
  name: z.string().min(1, "Name is required").max(200),
  role: AdminRoleSchema,
  /** If omitted, a temporary password is generated and returned ONCE in the response. */
  password: passwordSchema.optional(),
});

export const UserAdminUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
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
});

export type UserCreateInput = z.infer<typeof UserCreateSchema>;
export type UserAdminUpdateInput = z.infer<typeof UserAdminUpdateSchema>;
