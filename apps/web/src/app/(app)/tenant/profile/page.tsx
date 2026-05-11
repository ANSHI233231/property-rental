"use client";

/** Tenant Profile — stub for Phase 6. */

import { useAuth } from "@/lib/auth/context";

export default function TenantProfilePage() {
  const { user } = useAuth();
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">My Profile</h1>
          <div className="page-subtitle">Tenant</div>
        </div>
      </header>
      <section className="card">
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div><span className="muted">Name:</span> <strong className="text-charcoal">{user?.name ?? "—"}</strong></div>
          <div><span className="muted">Email:</span> <strong className="text-charcoal">{user?.email ?? "—"}</strong></div>
        </div>
        <p className="text-sm muted mt-4">Full profile editing available in Phase 6.</p>
      </section>
    </>
  );
}
