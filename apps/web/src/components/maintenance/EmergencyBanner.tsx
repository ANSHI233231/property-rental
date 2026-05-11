"use client";

/**
 * EmergencyBanner — shown on PM and Admin views when at least one
 * OPEN/ASSIGNED/IN_PROGRESS request with priority=EMERGENCY exists.
 *
 * Per prototype/pm/maintenance.html and prototype/admin/maintenance.html,
 * the banner uses the .alert.alert-emergency class.
 *
 * This component is intentionally omitted from tenant and maintenance-staff views.
 */

import type { MaintenancePriorityValue, MaintenanceStatusValue } from "@gharsetu/shared";

export interface EmergencyRequestSummary {
  id: string;
  title: string;
  unit?: { name?: string } | null;
  status: MaintenanceStatusValue;
  priority: MaintenancePriorityValue;
}

interface EmergencyBannerProps {
  requests: EmergencyRequestSummary[];
}

const ACTIVE_STATUSES: MaintenanceStatusValue[] = ["OPEN", "ASSIGNED", "IN_PROGRESS"];

export function EmergencyBanner({ requests }: EmergencyBannerProps) {
  const emergencies = requests.filter(
    (r) =>
      r.priority === "EMERGENCY" && ACTIVE_STATUSES.includes(r.status),
  );

  if (emergencies.length === 0) return null;

  return (
    <div className="alert alert-emergency mb-6" role="alert" aria-live="assertive">
      <div>
        <strong className="font-poppins">
          {emergencies.length === 1
            ? "1 emergency request"
            : `${emergencies.length} emergency requests`}
        </strong>
        <div className="mt-1">
          {emergencies.map((r, i) => (
            <span key={r.id}>
              {i > 0 && " · "}
              {r.unit?.name ? `Unit ${r.unit.name} — ` : ""}
              {r.title}
              {" "}
              <span className="opacity-75">({r.status.replace("_", "-").toLowerCase()})</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
