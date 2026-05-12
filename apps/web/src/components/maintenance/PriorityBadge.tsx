"use client";

/**
 * PriorityBadge — maps numeric maintenance priority code to badge.
 *
 * The API returns priority as a SMALLINT (0–3) after the Step 1 migration.
 * Accepts both numeric codes (from API) and legacy string values for
 * backward compatibility during the transition period.
 *
 * Priority codes per MaintenancePriorityCodes in @gharsetu/shared/enums:
 *   0 LOW       → badge-closed    (slate — low priority, muted)
 *   1 NORMAL    → badge-prepaid   (teal/blue)
 *   2 HIGH      → badge-partial   (amber)
 *   3 EMERGENCY → badge-emergency (red with white text)
 */

import { MaintenancePriorityCodes, maintenancePriorityName } from "@gharsetu/shared";

const PRIORITY_CLASS: Record<number, string> = {
  [MaintenancePriorityCodes.LOW]: "badge badge-closed",
  [MaintenancePriorityCodes.NORMAL]: "badge badge-prepaid",
  [MaintenancePriorityCodes.HIGH]: "badge badge-partial",
  [MaintenancePriorityCodes.EMERGENCY]: "badge badge-emergency",
};

// Legacy string-value fallback
const STRING_PRIORITY_CLASS: Record<string, string> = {
  LOW: "badge badge-closed",
  NORMAL: "badge badge-prepaid",
  HIGH: "badge badge-partial",
  EMERGENCY: "badge badge-emergency",
};

const STRING_PRIORITY_LABEL: Record<string, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  EMERGENCY: "Emergency",
};

interface PriorityBadgeProps {
  /** Numeric code (0–3) or legacy string value. */
  priority: number | string;
  className?: string;
}

export function PriorityBadge({
  priority,
  className = "",
}: PriorityBadgeProps) {
  let label: string;
  let badgeClass: string;

  if (typeof priority === "number") {
    label = maintenancePriorityName(priority as MaintenancePriorityCodes);
    badgeClass = PRIORITY_CLASS[priority] ?? "badge";
  } else {
    // Legacy string path
    label = STRING_PRIORITY_LABEL[priority] ?? priority;
    badgeClass = STRING_PRIORITY_CLASS[priority] ?? "badge";
  }

  return (
    <span className={[badgeClass, className].filter(Boolean).join(" ")}>
      {label}
    </span>
  );
}
