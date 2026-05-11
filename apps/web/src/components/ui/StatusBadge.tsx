"use client";

/**
 * StatusBadge — maps RentStatusValue to the correct badge class.
 * Extends prototype badge classes: badge-overdue, badge-paid, badge-partial,
 * badge-prepaid, badge-due, badge-upcoming.
 *
 * Design tokens per prototype/assets/styles.css:
 *   paid    → #2E7D32 (green)
 *   partial → #F57F17 (amber)
 *   overdue → #C62828 (red)
 *   prepaid → #0277BD (teal/blue)
 *   due     → royal-blue #1565C0
 *   upcoming → slate #546E7A
 */

import type { RentStatusValue } from "@gharsetu/shared";

const STATUS_CLASS: Record<RentStatusValue, string> = {
  PAID: "badge badge-paid",
  PARTIAL: "badge badge-partial",
  OVERDUE: "badge badge-overdue",
  PREPAID: "badge badge-prepaid",
  DUE: "badge badge-due",
  UPCOMING: "badge badge-upcoming",
};

const STATUS_LABEL: Record<RentStatusValue, string> = {
  PAID: "Paid",
  PARTIAL: "Partial",
  OVERDUE: "Overdue",
  PREPAID: "Prepaid",
  DUE: "Due",
  UPCOMING: "Upcoming",
};

interface StatusBadgeProps {
  status: RentStatusValue;
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const label = STATUS_LABEL[status];
  return (
    <span
      className={[STATUS_CLASS[status], className].filter(Boolean).join(" ")}
      aria-label={label}
    >
      {label}
    </span>
  );
}
