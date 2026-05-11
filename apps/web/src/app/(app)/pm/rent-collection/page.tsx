"use client";

/**
 * PM Rent Collection — stub for Phase 4.
 */

import { usePmProperty } from "@/lib/pm/context";

export default function PmRentCollectionPage() {
  const { property } = usePmProperty();
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Rent Collection</h1>
          <div className="page-subtitle">{property?.name ?? ""}</div>
        </div>
      </header>
      <div className="alert">
        <strong className="font-poppins">Coming in Phase 4</strong>
        <div>Rent recording, payment history, and late-fee tracking will be available here.</div>
      </div>
    </>
  );
}
