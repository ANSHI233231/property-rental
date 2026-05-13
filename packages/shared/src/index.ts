/**
 * @gharsetu/shared — Phase 2 update
 *
 * Single source of truth for cross-app types, enums, and constants.
 * Built with tsup → consumed as compiled output (dist/) by apps/web and apps/api.
 */

export const APP_NAME = "GharSetu" as const;
export const SHARED_PACKAGE_VERSION = "0.6.0" as const;

export { Role, ROLES, isRole } from "./role.js";
export type { RoleValue } from "./role.js";

// Numeric enums + label helpers (Step 3 — post SMALLINT migration)
export {
  RoleEnum,
  ROLE_LABEL,
  roleName,
  UnitStateEnum,
  UNIT_STATE_LABEL,
  unitStateName,
  LeaseStatusEnum,
  LEASE_STATUS_LABEL,
  leaseStatusName,
  RentPeriodStatusEnum,
  RENT_PERIOD_STATUS_LABEL,
  rentPeriodStatusName,
  // Note: MaintenanceStatusCodes / MaintenancePriorityCodes / PaymentMethodCodes
  // avoid name-collision with the existing zod schemas.
  MaintenanceStatusCodes,
  MAINTENANCE_STATUS_LABEL,
  maintenanceStatusName,
  MaintenancePriorityCodes,
  MAINTENANCE_PRIORITY_LABEL,
  maintenancePriorityName,
  PaymentMethodCodes,
  PAYMENT_METHOD_LABEL,
  paymentMethodName,
  TerminationApprovalStatusEnum,
  TERMINATION_APPROVAL_STATUS_LABEL,
  terminationApprovalStatusName,
} from "./enums.js";
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
  AdminResetPasswordSchema,
  passwordSchema,
} from "./schemas/users-admin.js";
export type {
  AdminRoleValue,
  UserCreateInput,
  UserAdminUpdateInput,
  AdminResetPasswordInput,
} from "./schemas/users-admin.js";

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

// Maintenance schemas + enums (Phase 5)
export {
  MaintenancePriorityEnum,
  MaintenanceStatusEnum,
  CreateMaintenanceRequestSchema,
  AssignMaintenanceSchema,
  ResolveMaintenanceSchema,
  DismissAlertSchema,
  MaintenanceRequestFilterSchema,
} from "./schemas/maintenance.js";
export type {
  MaintenancePriorityValue,
  MaintenanceStatusValue,
  CreateMaintenanceRequestInput,
  AssignMaintenanceInput,
  ResolveMaintenanceInput,
  DismissAlertInput,
  MaintenanceRequestFilter,
} from "./schemas/maintenance.js";

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
