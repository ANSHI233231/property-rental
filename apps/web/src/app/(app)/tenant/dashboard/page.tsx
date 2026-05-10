"use client";

/**
 * Tenant dashboard stub — Phase 1.
 */

import { useAuth } from "@/lib/auth/context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function TenantDashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login?next=/tenant/dashboard");
    } else if (!loading && user && user.role !== "TENANT") {
      if (user.role === "ADMIN") router.replace("/admin/dashboard");
      else if (user.role === "PROPERTY_MANAGER") router.replace("/pm/dashboard");
      else router.replace("/maintenance/dashboard");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-off-white">
        <div className="text-slate font-poppins">Loading…</div>
      </main>
    );
  }

  if (!user || user.role !== "TENANT") return null;

  return (
    <main className="min-h-screen bg-off-white p-8">
      <h1 className="font-poppins font-bold text-navy text-3xl mb-2">
        Tenant Dashboard
      </h1>
      <p className="text-slate mb-6">
        Welcome, <strong>{user.name}</strong>. Role:{" "}
        <span className="font-poppins font-semibold text-status-prepaid uppercase text-sm">
          {user.role}
        </span>
      </p>
      <p className="text-slate text-sm mb-8">
        Phase 3+ will show your lease summary, rent history, and maintenance
        requests.
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
