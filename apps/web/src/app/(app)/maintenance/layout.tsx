"use client";

/**
 * Maintenance staff layout — sidebar (desktop/tablet) + bottom tab bar (mobile).
 * Wraps all /maintenance/* pages. Redirects non-MAINTENANCE roles.
 */

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { MaintenanceSidebar, MaintenanceTabBar } from "@/components/maintenance/MaintenanceSidebar";
import { ToastProvider } from "@/components/ui/Toast";

export default function MaintenanceLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "MAINTENANCE") {
      if (user.role === "ADMIN") router.replace("/admin/dashboard");
      else if (user.role === "PROPERTY_MANAGER") router.replace("/pm/dashboard");
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

  if (!user || user.role !== "MAINTENANCE") return null;

  return (
    <ToastProvider>
      {/* Skip-to-main for keyboard users — visible only on focus */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[200] focus:bg-saffron focus:text-white focus:px-4 focus:py-2 focus:rounded focus:font-poppins focus:font-semibold focus:text-sm"
      >
        Skip to main content
      </a>
      <div className="app-shell">
        <MaintenanceSidebar />
        <main id="main-content" className="app-main">
          {children}
        </main>
      </div>
      <MaintenanceTabBar />
    </ToastProvider>
  );
}
