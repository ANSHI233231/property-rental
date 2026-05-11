"use client";

/**
 * MaintenanceStatusBadge — maps MaintenanceStatusValue to prototype badge classes.
 *
 * Status → badge class mapping per prototype/assets/styles.css:
 *   OPEN        → badge-open      (amber)
 *   ASSIGNED    → badge-open      (amber — same as open in prototype)
 *   IN_PROGRESS → badge-progress  (teal/blue)
 *   RESOLVED    → badge-resolved  (green)
 *   CLOSED      → badge-closed    (slate)
 */

import type { MaintenanceStatusValue } from "@gharsetu/shared";

const STATUS_CLASS: Record<MaintenanceStatusValue, string> = {
  OPEN: "badge badge-open",
  ASSIGNED: "badge badge-open",
  IN_PROGRESS: "badge badge-progress",
  RESOLVED: "badge badge-resolved",
  CLOSED: "badge badge-closed",
};

const STATUS_LABEL: Record<MaintenanceStatusValue, string> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In-Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

interface MaintenanceStatusBadgeProps {
  status: MaintenanceStatusValue;
  className?: string;
}

export function MaintenanceStatusBadge({
  status,
  className = "",
}: MaintenanceStatusBadgeProps) {
  return (
    <span
      className={[STATUS_CLASS[status], className].filter(Boolean).join(" ")}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
