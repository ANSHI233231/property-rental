"use client";

/**
 * PriorityBadge — maps MaintenancePriorityValue to prototype badge classes.
 *
 * Priority → badge class mapping per prototype:
 *   LOW       → badge-closed    (slate — low priority, muted)
 *   NORMAL    → badge-prepaid   (teal/blue)
 *   HIGH      → badge-partial   (amber)
 *   EMERGENCY → badge-emergency (red with white text)
 */

import type { MaintenancePriorityValue } from "@gharsetu/shared";

const PRIORITY_CLASS: Record<MaintenancePriorityValue, string> = {
  LOW: "badge badge-closed",
  NORMAL: "badge badge-prepaid",
  HIGH: "badge badge-partial",
  EMERGENCY: "badge badge-emergency",
};

const PRIORITY_LABEL: Record<MaintenancePriorityValue, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  EMERGENCY: "Emergency",
};

interface PriorityBadgeProps {
  priority: MaintenancePriorityValue;
  className?: string;
}

export function PriorityBadge({
  priority,
  className = "",
}: PriorityBadgeProps) {
  return (
    <span
      className={[PRIORITY_CLASS[priority], className].filter(Boolean).join(" ")}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}
