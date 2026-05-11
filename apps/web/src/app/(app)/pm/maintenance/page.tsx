"use client";

/**
 * PM Maintenance — stub for Phase 5.
 */

import { usePmProperty } from "@/lib/pm/context";

export default function PmMaintenancePage() {
  const { property } = usePmProperty();
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Maintenance</h1>
          <div className="page-subtitle">{property?.name ?? ""}</div>
        </div>
      </header>
      <div className="alert">
        <strong className="font-poppins">Coming in Phase 5</strong>
        <div>Maintenance request lifecycle management will be available here.</div>
      </div>
    </>
  );
}
