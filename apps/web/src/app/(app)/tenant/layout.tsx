"use client";

/**
 * Tenant layout — sidebar (desktop/tablet) + bottom tab bar (mobile).
 * Wraps all /tenant/* pages. Redirects non-tenant roles to their own dashboard.
 */

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { TenantSidebar, TenantTabBar } from "@/components/tenant/TenantSidebar";
import { ToastProvider } from "@/components/ui/Toast";

export default function TenantLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "TENANT") {
      if (user.role === "ADMIN") router.replace("/admin/dashboard");
      else if (user.role === "PROPERTY_MANAGER") router.replace("/pm/dashboard");
      else router.replace("/maintenance/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-off-white">
        <div className="text-slate font-poppins text-sm">Loading…</div>
      </div>
    );
  }

  if (!user || user.role !== "TENANT") return null;

  return (
    <ToastProvider>
      <div className="app-shell">
        <TenantSidebar />
        <main className="app-main">
          {children}
        </main>
      </div>
      <TenantTabBar />
    </ToastProvider>
  );
}
