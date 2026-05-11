/**
 * @gharsetu/shared — Phase 2 update
 *
 * Single source of truth for cross-app types, enums, and constants.
 * Built with tsup → consumed as compiled output (dist/) by apps/web and apps/api.
 */

export const APP_NAME = "GharSetu" as const;
export const SHARED_PACKAGE_VERSION = "0.4.1" as const;

export { Role, ROLES, isRole } from "./role.js";
export type { RoleValue } from "./role.js";
export { BusinessRules } from "./business-rules.js";

// Auth schemas (Phase 1)
export {
  LoginInputSchema,
  ForgotPasswordInputSchema,
  ResetPasswordInputSchema,
  ChangePasswordInputSchema,
  UpdateProfileInputSchema,
  RoleSchema,
} from "./schemas/auth.js";
export type {
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
  UpdateProfileInput,
  RoleInput,
} from "./schemas/auth.js";

// Properties & Units schemas (Phase 2)
export {
  UnitStateSchema,
  PropertyInputSchema,
  PropertyUpdateSchema,
  TransferPmInputSchema,
  UnitInputSchema,
  UnitUpdateSchema,
  UnitStateChangeSchema,
} from "./schemas/properties.js";
export type {
  UnitStateValue,
  PropertyInput,
  PropertyUpdate,
  TransferPmInput,
  UnitInput,
  UnitUpdate,
  UnitStateChange,
} from "./schemas/properties.js";

// Users admin schemas (Phase 2)
export {
  AdminRoleSchema,
  UserCreateSchema,
  UserAdminUpdateSchema,
} from "./schemas/users-admin.js";
export type { AdminRoleValue, UserCreateInput, UserAdminUpdateInput } from "./schemas/users-admin.js";

// Currency helpers (Phase 2)
export {
  paiseToRupees,
  rupeesToPaise,
  formatINR,
  formatINRFallback,
} from "./utils/currency.js";

// Lease, Tenant, Termination, Deposit schemas (Phase 3)
export {
  LeaseStatusSchema,
  TerminationApprovalStatusSchema,
  TenantInputSchema,
  TenantUpdateSchema,
  LeaseInputSchema,
  LeaseRenewSchema,
  TerminationRequestSchema,
  TerminationApprovalSchema,
  DepositRefundSchema,
} from "./schemas/leases.js";
export type {
  LeaseStatusValue,
  TerminationApprovalStatusValue,
  TenantInput,
  TenantUpdate,
  LeaseInput,
  LeaseRenew,
  TerminationRequest,
  TerminationApproval,
  DepositRefundInput,
} from "./schemas/leases.js";

// Rent, Payments, Late-fee schemas + helpers (Phase 4)
export {
  RentStatusEnum,
  PaymentMethodEnum,
  RecordPaymentSchema,
  VoidPaymentSchema,
  RentPeriodFilterSchema,
  computeLateFeePaise,
} from "./schemas/rent.js";
export type {
  RentStatusValue,
  PaymentMethodValue,
  RecordPaymentInput,
  VoidPaymentInput,
  RentPeriodFilter,
} from "./schemas/rent.js";
