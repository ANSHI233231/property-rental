"use client";

/**
 * Admin Profile stub — Phase 1 profile; Phase 6 will polish.
 */

import { useAuth } from "@/lib/auth/context";

export default function AdminProfilePage() {
  const { user } = useAuth();

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">My Profile</h1>
          <div className="page-subtitle">Account settings</div>
        </div>
      </header>
      <div className="card">
        <div className="profile-header">
          <div className="profile-avatar-lg">
            {user?.name
              .split(" ")
              .slice(0, 2)
              .map((n) => n[0])
              .join("")
              .toUpperCase() ?? "—"}
          </div>
          <div className="profile-name">{user?.name ?? "—"}</div>
          <span className="profile-role">Admin</span>
        </div>
        <div className="profile-row">
          <span className="field">Email</span>
          <span className="value">{user?.email ?? "—"}</span>
        </div>
        <div className="profile-row">
          <span className="field">Role</span>
          <span className="value">Administrator</span>
        </div>
      </div>
    </>
  );
}
