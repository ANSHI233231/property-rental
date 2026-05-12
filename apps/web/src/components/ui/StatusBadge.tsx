"use client";

/**
 * StatusBadge — maps rent period status to the correct badge class.
 *
 * The API returns status as a SMALLINT (0–5) after the Step 1 migration.
 * Accepts both numeric codes (from API) and legacy string values for
 * backward compatibility during the transition period.
 *
 * Status codes per RentPeriodStatusEnum in @gharsetu/shared/enums:
 *   0 UPCOMING → badge-upcoming (slate)
 *   1 DUE      → badge-due      (royal-blue)
 *   2 PARTIAL  → badge-partial  (amber)
 *   3 PAID     → badge-paid     (green)
 *   4 OVERDUE  → badge-overdue  (red)
 *   5 PREPAID  → badge-prepaid  (teal/blue)
 *
 * Design tokens per prototype/assets/styles.css:
 *   paid    → #2E7D32 (green)
 *   partial → #F57F17 (amber)
 *   overdue → #C62828 (red)
 *   prepaid → #0277BD (teal/blue)
 *   due     → royal-blue #1565C0
 *   upcoming → slate #546E7A
 */

import { RentPeriodStatusEnum, rentPeriodStatusName } from "@gharsetu/shared";

const STATUS_CLASS: Record<number, string> = {
  [RentPeriodStatusEnum.UPCOMING]: "badge badge-upcoming",
  [RentPeriodStatusEnum.DUE]: "badge badge-due",
  [RentPeriodStatusEnum.PARTIAL]: "badge badge-partial",
  [RentPeriodStatusEnum.PAID]: "badge badge-paid",
  [RentPeriodStatusEnum.OVERDUE]: "badge badge-overdue",
  [RentPeriodStatusEnum.PREPAID]: "badge badge-prepaid",
};

// Legacy string-value fallback
const STRING_STATUS_CLASS: Record<string, string> = {
  PAID: "badge badge-paid",
  PARTIAL: "badge badge-partial",
  OVERDUE: "badge badge-overdue",
  PREPAID: "badge badge-prepaid",
  DUE: "badge badge-due",
  UPCOMING: "badge badge-upcoming",
};

const STRING_STATUS_LABEL: Record<string, string> = {
  PAID: "Paid",
  PARTIAL: "Partial",
  OVERDUE: "Overdue",
  PREPAID: "Prepaid",
  DUE: "Due",
  UPCOMING: "Upcoming",
};

interface StatusBadgeProps {
  /** Numeric code (0–5) or legacy string value. */
  status: number | string;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  let label: string;
  let badgeClass: string;

  if (typeof status === "number") {
    label = rentPeriodStatusName(status as RentPeriodStatusEnum);
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
