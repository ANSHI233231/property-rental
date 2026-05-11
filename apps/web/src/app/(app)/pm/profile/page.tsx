"use client";

/**
 * PM Profile page — Phase 3 stub.
 */

import { useAuth } from "@/lib/auth/context";

export default function PmProfilePage() {
  const { user } = useAuth();
  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">My Profile</h1>
          <div className="page-subtitle">Property Manager</div>
        </div>
      </header>
      <section className="card">
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div><span className="muted">Name:</span> <strong className="text-charcoal">{user?.name ?? "—"}</strong></div>
          <div><span className="muted">Email:</span> <strong className="text-charcoal">{user?.email ?? "—"}</strong></div>
          <div><span className="muted">Role:</span> <strong className="text-charcoal">Property Manager</strong></div>
        </div>
        <p className="text-sm muted mt-4">Full profile editing available in a future phase.</p>
      </section>
    </>
  );
}
