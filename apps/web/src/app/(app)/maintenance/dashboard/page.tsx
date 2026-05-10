"use client";

/**
 * Maintenance staff dashboard stub — Phase 1.
 */

import { useAuth } from "@/lib/auth/context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function MaintenanceDashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login?next=/maintenance/dashboard");
    } else if (!loading && user && user.role !== "MAINTENANCE") {
      if (user.role === "ADMIN") router.replace("/admin/dashboard");
      else if (user.role === "PROPERTY_MANAGER") router.replace("/pm/dashboard");
      else router.replace("/tenant/dashboard");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-off-white">
        <div className="text-slate font-poppins">Loading…</div>
      </main>
    );
  }

  if (!user || user.role !== "MAINTENANCE") return null;

  return (
    <main className="min-h-screen bg-off-white p-8">
      <h1 className="font-poppins font-bold text-navy text-3xl mb-2">
        Maintenance Dashboard
      </h1>
      <p className="text-slate mb-6">
        Welcome, <strong>{user.name}</strong>. Role:{" "}
        <span className="font-poppins font-semibold text-status-prepaid uppercase text-sm">
          {user.role}
        </span>
      </p>
      <p className="text-slate text-sm mb-8">
        Phase 5+ will populate open tickets and assignment queue.
      </p>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => void logout()}
      >
        Sign out
      </button>
    </main>
  );
}
