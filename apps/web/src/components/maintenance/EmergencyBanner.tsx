"use client";

/**
 * EmergencyBanner — shown on PM and Admin views when at least one
 * OPEN/ASSIGNED/IN_PROGRESS request with priority=EMERGENCY exists.
 *
 * Per prototype/pm/maintenance.html and prototype/admin/maintenance.html,
 * the banner uses the .alert.alert-emergency class.
 *
 * This component is intentionally omitted from tenant and maintenance-staff views.
 *
 * Accepts both numeric codes (new API) and legacy strings.
 */

import { MaintenanceStatusCodes, MaintenancePriorityCodes, maintenanceStatusName } from "@gharsetu/shared";

export interface EmergencyRequestSummary {
  id: number | string;
  title: string;
  unit?: { name?: string } | null;
  // API returns SMALLINT codes; accept string for legacy
  status: number | string;
  priority: number | string;
}

interface EmergencyBannerProps {
  requests: EmergencyRequestSummary[];
}

function isActiveStatus(s: number | string): boolean {
  if (typeof s === "number") {
    return s === MaintenanceStatusCodes.OPEN || s === MaintenanceStatusCodes.ASSIGNED || s === MaintenanceStatusCodes.IN_PROGRESS;
  }
  return s === "OPEN" || s === "ASSIGNED" || s === "IN_PROGRESS";
}

function isEmergencyPriority(p: number | string): boolean {
  return typeof p === "number" ? p === MaintenancePriorityCodes.EMERGENCY : p === "EMERGENCY";
}

function statusLabel(s: number | string): string {
  if (typeof s === "number") return maintenanceStatusName(s as MaintenanceStatusCodes).toLowerCase().replace("_", "-");
  return String(s).replace("_", "-").toLowerCase();
}

export function EmergencyBanner({ requests }: EmergencyBannerProps) {
  const emergencies = requests.filter(
    (r) => isEmergencyPriority(r.priority) && isActiveStatus(r.status),
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
              <span className="opacity-75">({statusLabel(r.status)})</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
