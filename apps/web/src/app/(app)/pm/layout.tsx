"use client";

/**
 * PM layout — sidebar (desktop/tablet) + bottom tab bar (mobile).
 * Wraps all /pm/* pages. Redirects non-PM roles to their own dashboard.
 */

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PmSidebar, PmTabBar } from "@/components/pm/PmSidebar";
import { PmPropertyProvider } from "@/lib/pm/context";
import { ToastProvider } from "@/components/ui/Toast";

export default function PmLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "PROPERTY_MANAGER") {
      if (user.role === "ADMIN") router.replace("/admin/dashboard");
      else if (user.role === "MAINTENANCE") router.replace("/maintenance/dashboard");
      else router.replace("/tenant/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-off-white">
        <div className="text-slate font-poppins text-sm">Loading…</div>
      </div>
    );
  }

  if (!user || user.role !== "PROPERTY_MANAGER") return null;

  return (
    <ToastProvider>
      <PmPropertyProvider>
        <div className="app-shell">
          <PmSidebar />
          <main className="app-main">
            {children}
          </main>
        </div>
        <PmTabBar />
      </PmPropertyProvider>
    </ToastProvider>
  );
}
