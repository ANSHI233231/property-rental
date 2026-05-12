/**
 * Numeric enum constants matching the SMALLINT columns baked into the DB
 * after the Step 1 migration. Values are fixed — never change them.
 *
 * UnitState:                  AVAILABLE=0  LISTED=1  OCCUPIED=2  MAINTENANCE=3
 * LeaseStatus:                ACTIVE=0     EXPIRED=1 RENEWED=2   TERMINATED=3
 * RentPeriodStatus:           UPCOMING=0   DUE=1     PARTIAL=2   PAID=3     OVERDUE=4 PREPAID=5
 * MaintenanceStatus:          OPEN=0       ASSIGNED=1 IN_PROGRESS=2 RESOLVED=3 CLOSED=4
 * MaintenancePriority:        LOW=0        NORMAL=1  HIGH=2      EMERGENCY=3
 * PaymentMethod:              CASH=0       BANK_TRANSFER=1 UPI=2 CHEQUE=3   OTHER=4
 * TerminationApprovalStatus:  PENDING=0    APPROVED=1 REJECTED=2
 * Role:                       ADMIN=0      PROPERTY_MANAGER=1 MAINTENANCE=2 TENANT=3
 */

// ---------------------------------------------------------------------------
// Role
// ---------------------------------------------------------------------------

export const RoleEnum = {
  ADMIN: 0,
  PROPERTY_MANAGER: 1,
  MAINTENANCE: 2,
  TENANT: 3,
} as const;
export type RoleEnum = (typeof RoleEnum)[keyof typeof RoleEnum];

export const ROLE_LABEL: Record<RoleEnum, string> = {
  [RoleEnum.ADMIN]: "Admin",
  [RoleEnum.PROPERTY_MANAGER]: "Property Manager",
  [RoleEnum.MAINTENANCE]: "Maintenance",
  [RoleEnum.TENANT]: "Tenant",
};

export function roleName(code: RoleEnum): string {
  return ROLE_LABEL[code] ?? "Unknown";
}

// ---------------------------------------------------------------------------
// UnitState
// ---------------------------------------------------------------------------

export const UnitStateEnum = {
  AVAILABLE: 0,
  LISTED: 1,
  OCCUPIED: 2,
  MAINTENANCE: 3,
} as const;
export type UnitStateEnum = (typeof UnitStateEnum)[keyof typeof UnitStateEnum];

export const UNIT_STATE_LABEL: Record<UnitStateEnum, string> = {
  [UnitStateEnum.AVAILABLE]: "Available",
  [UnitStateEnum.LISTED]: "Listed",
  [UnitStateEnum.OCCUPIED]: "Occupied",
  [UnitStateEnum.MAINTENANCE]: "Maintenance",
};

export function unitStateName(code: UnitStateEnum): string {
  return UNIT_STATE_LABEL[code] ?? "Unknown";
}

// ---------------------------------------------------------------------------
// LeaseStatus
// ---------------------------------------------------------------------------

export const LeaseStatusEnum = {
  ACTIVE: 0,
  EXPIRED: 1,
  RENEWED: 2,
  TERMINATED: 3,
} as const;
export type LeaseStatusEnum = (typeof LeaseStatusEnum)[keyof typeof LeaseStatusEnum];

export const LEASE_STATUS_LABEL: Record<LeaseStatusEnum, string> = {
  [LeaseStatusEnum.ACTIVE]: "Active",
  [LeaseStatusEnum.EXPIRED]: "Expired",
  [LeaseStatusEnum.RENEWED]: "Renewed",
  [LeaseStatusEnum.TERMINATED]: "Terminated",
};

export function leaseStatusName(code: LeaseStatusEnum): string {
  return LEASE_STATUS_LABEL[code] ?? "Unknown";
}

// ---------------------------------------------------------------------------
// RentPeriodStatus
// ---------------------------------------------------------------------------

export const RentPeriodStatusEnum = {
  UPCOMING: 0,
  DUE: 1,
  PARTIAL: 2,
  PAID: 3,
  OVERDUE: 4,
  PREPAID: 5,
} as const;
export type RentPeriodStatusEnum = (typeof RentPeriodStatusEnum)[keyof typeof RentPeriodStatusEnum];

export const RENT_PERIOD_STATUS_LABEL: Record<RentPeriodStatusEnum, string> = {
  [RentPeriodStatusEnum.UPCOMING]: "Upcoming",
  [RentPeriodStatusEnum.DUE]: "Due",
  [RentPeriodStatusEnum.PARTIAL]: "Partial",
  [RentPeriodStatusEnum.PAID]: "Paid",
  [RentPeriodStatusEnum.OVERDUE]: "Overdue",
  [RentPeriodStatusEnum.PREPAID]: "Prepaid",
};

export function rentPeriodStatusName(code: RentPeriodStatusEnum): string {
  return RENT_PERIOD_STATUS_LABEL[code] ?? "Unknown";
}

// ---------------------------------------------------------------------------
// MaintenanceStatus
// (Named MaintenanceStatusCodes to avoid collision with the zod schema
//  MaintenanceStatusEnum exported from schemas/maintenance.ts)
// ---------------------------------------------------------------------------

export const MaintenanceStatusCodes = {
  OPEN: 0,
  ASSIGNED: 1,
  IN_PROGRESS: 2,
  RESOLVED: 3,
  CLOSED: 4,
} as const;
export type MaintenanceStatusCodes = (typeof MaintenanceStatusCodes)[keyof typeof MaintenanceStatusCodes];

export const MAINTENANCE_STATUS_LABEL: Record<MaintenanceStatusCodes, string> = {
  [MaintenanceStatusCodes.OPEN]: "Open",
  [MaintenanceStatusCodes.ASSIGNED]: "Assigned",
  [MaintenanceStatusCodes.IN_PROGRESS]: "In-Progress",
  [MaintenanceStatusCodes.RESOLVED]: "Resolved",
  [MaintenanceStatusCodes.CLOSED]: "Closed",
};

export function maintenanceStatusName(code: MaintenanceStatusCodes): string {
  return MAINTENANCE_STATUS_LABEL[code] ?? "Unknown";
}

// ---------------------------------------------------------------------------
// MaintenancePriority
// (Named MaintenancePriorityCodes to avoid collision with the zod schema
//  MaintenancePriorityEnum exported from schemas/maintenance.ts)
// ---------------------------------------------------------------------------

export const MaintenancePriorityCodes = {
  LOW: 0,
  NORMAL: 1,
  HIGH: 2,
  EMERGENCY: 3,
} as const;
export type MaintenancePriorityCodes = (typeof MaintenancePriorityCodes)[keyof typeof MaintenancePriorityCodes];

export const MAINTENANCE_PRIORITY_LABEL: Record<MaintenancePriorityCodes, string> = {
  [MaintenancePriorityCodes.LOW]: "Low",
  [MaintenancePriorityCodes.NORMAL]: "Normal",
  [MaintenancePriorityCodes.HIGH]: "High",
  [MaintenancePriorityCodes.EMERGENCY]: "Emergency",
};

export function maintenancePriorityName(code: MaintenancePriorityCodes): string {
  return MAINTENANCE_PRIORITY_LABEL[code] ?? "Unknown";
}

// ---------------------------------------------------------------------------
// PaymentMethod
// (Named PaymentMethodCodes to avoid collision with the zod schema
//  PaymentMethodEnum exported from schemas/rent.ts)
// ---------------------------------------------------------------------------

export const PaymentMethodCodes = {
  CASH: 0,
  BANK_TRANSFER: 1,
  UPI: 2,
  CHEQUE: 3,
  OTHER: 4,
} as const;
export type PaymentMethodCodes = (typeof PaymentMethodCodes)[keyof typeof PaymentMethodCodes];

export const PAYMENT_METHOD_LABEL: Record<PaymentMethodCodes, string> = {
  [PaymentMethodCodes.CASH]: "Cash",
  [PaymentMethodCodes.BANK_TRANSFER]: "Bank Transfer",
  [PaymentMethodCodes.UPI]: "UPI",
  [PaymentMethodCodes.CHEQUE]: "Cheque",
  [PaymentMethodCodes.OTHER]: "Other",
};

export function paymentMethodName(code: PaymentMethodCodes): string {
  return PAYMENT_METHOD_LABEL[code] ?? "Unknown";
}

// ---------------------------------------------------------------------------
// TerminationApprovalStatus
// ---------------------------------------------------------------------------

export const TerminationApprovalStatusEnum = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
} as const;
export type TerminationApprovalStatusEnum = (typeof TerminationApprovalStatusEnum)[keyof typeof TerminationApprovalStatusEnum];

export const TERMINATION_APPROVAL_STATUS_LABEL: Record<TerminationApprovalStatusEnum, string> = {
  [TerminationApprovalStatusEnum.PENDING]: "Pending",
  [TerminationApprovalStatusEnum.APPROVED]: "Approved",
  [TerminationApprovalStatusEnum.REJECTED]: "Rejected",
};

export function terminationApprovalStatusName(code: TerminationApprovalStatusEnum): string {
  return TERMINATION_APPROVAL_STATUS_LABEL[code] ?? "Unknown";
}
