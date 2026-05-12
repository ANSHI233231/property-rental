"use client";

/**
 * MaintenanceStatusBadge — maps numeric maintenance status code to badge.
 *
 * The API returns status as a SMALLINT (0–4) after the Step 1 migration.
 * Accepts both numeric codes (from API) and legacy string values for
 * backward compatibility during the transition period.
 *
 * Status codes per MaintenanceStatusCodes in @gharsetu/shared/enums:
 *   0 OPEN        → badge-open      (amber)
 *   1 ASSIGNED    → badge-open      (amber — same as open in prototype)
 *   2 IN_PROGRESS → badge-progress  (teal/blue)
 *   3 RESOLVED    → badge-resolved  (green)
 *   4 CLOSED      → badge-closed    (slate)
 */

import { MaintenanceStatusCodes, maintenanceStatusName } from "@gharsetu/shared";

const STATUS_CLASS: Record<number, string> = {
  [MaintenanceStatusCodes.OPEN]: "badge badge-open",
  [MaintenanceStatusCodes.ASSIGNED]: "badge badge-open",
  [MaintenanceStatusCodes.IN_PROGRESS]: "badge badge-progress",
  [MaintenanceStatusCodes.RESOLVED]: "badge badge-resolved",
  [MaintenanceStatusCodes.CLOSED]: "badge badge-closed",
};

// Legacy string-value fallback map (for any data still arriving as strings)
const STRING_STATUS_CLASS: Record<string, string> = {
  OPEN: "badge badge-open",
  ASSIGNED: "badge badge-open",
  IN_PROGRESS: "badge badge-progress",
  RESOLVED: "badge badge-resolved",
  CLOSED: "badge badge-closed",
};

const STRING_STATUS_LABEL: Record<string, string> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In-Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

interface MaintenanceStatusBadgeProps {
  /** Numeric code (0–4) or legacy string value. */
  status: number | string;
  className?: string;
}

export function MaintenanceStatusBadge({
  status,
  className = "",
}: MaintenanceStatusBadgeProps) {
  let label: string;
  let badgeClass: string;

  if (typeof status === "number") {
    label = maintenanceStatusName(status as MaintenanceStatusCodes);
    badgeClass = STATUS_CLASS[status] ?? "badge";
  } else {
    // Legacy string path
    label = STRING_STATUS_LABEL[status] ?? status;
    badgeClass = STRING_STATUS_CLASS[status] ?? "badge";
  }

  return (
    <span
      className={[badgeClass, className].filter(Boolean).join(" ")}
      aria-label={label}
    >
      {label}
    </span>
  );
}
