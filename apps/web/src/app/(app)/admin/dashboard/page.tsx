"use client";

/**
 * Admin Dashboard — Phase 2.
 * KPI shell + real Properties count + PM count from API.
 * Matches prototype/admin/dashboard.html exactly.
 */

import { useAuth } from "@/lib/auth/context";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { SkeletonKpi } from "@/components/ui/Skeleton";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types (subset of API response shapes)
// ---------------------------------------------------------------------------

interface PaginatedMeta {
  total?: number;
  count?: number;
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  meta,
}: {
  label: string;
  value: React.ReactNode;
  meta?: string;
}) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {meta && <div className="kpi-meta">{meta}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminDashboardPage() {
  const { user, apiFetch } = useAuth();

  const today = format(new Date(), "dd/MM/yyyy");

  const [propertiesCount, setPropertiesCount] = useState<number | null>(null);
  const [pmCount, setPmCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchKpis() {
      try {
        const [propRes, pmRes] = await Promise.allSettled([
          apiFetch<{ meta?: PaginatedMeta; data?: unknown[] }>("/properties?limit=1"),
          apiFetch<{ meta?: PaginatedMeta; data?: unknown[] }>(
            "/users?role=PROPERTY_MANAGER&limit=1",
          ),
        ]);

        if (!cancelled) {
          if (propRes.status === "fulfilled") {
            const total = propRes.value?.meta?.total ?? propRes.value?.data?.length ?? null;
            setPropertiesCount(typeof total === "number" ? total : null);
          }
          if (pmRes.status === "fulfilled") {
            const total = pmRes.value?.meta?.total ?? pmRes.value?.data?.length ?? null;
            setPmCount(typeof total === "number" ? total : null);
          }
        }
      } catch {
        // Errors already handled per-request above
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchKpis();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  const initials = (name: string) =>
    name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();

  return (
    <>
      {/* Top bar */}
      <header className="topbar">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-subtitle">
            All {propertiesCount != null ? propertiesCount : "—"} properties · {today}
          </div>
        </div>
        <div className="topbar-user">
          <span className="hidden md:inline">Admin · {user?.name}</span>
          <span className="avatar" aria-hidden="true">
            {user?.name ? initials(user.name) : "—"}
          </span>
        </div>
      </header>

      {/* KPIs */}
      <section className="section">
        <div className="kpi-grid">
          {loading ? (
            <>
              <SkeletonKpi />
              <SkeletonKpi />
              <SkeletonKpi />
              <SkeletonKpi />
            </>
          ) : (
            <>
              <KpiCard
                label="Properties"
                value={propertiesCount ?? "—"}
                meta="Across Delhi NCR"
              />
              <KpiCard
                label="Active PMs"
                value={pmCount ?? "—"}
                meta="Property Managers"
              />
              <KpiCard label="Tenants" value="—" meta="Fills in Phase 3" />
              <KpiCard label="Open Maintenance" value="—" meta="Fills in Phase 5" />
            </>
          )}
        </div>
      </section>

      {/* Alerts placeholder */}
      <section className="section">
        <h3 className="section-title">Admin Alerts</h3>
        <div className="alert">
          <div>
            <strong className="font-poppins">Alerts</strong> will appear here
            once maintenance data is available (Phase 5).
          </div>
        </div>
      </section>

      {/* Two-column summary */}
      <section className="section grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="section-title">Rent Overview</h3>
          <table className="data-table">
            <tbody>
              <tr>
                <td className="muted">Collected this month</td>
                <td className="text-right font-poppins font-semibold text-charcoal">—</td>
              </tr>
              <tr>
                <td className="muted">Overdue</td>
                <td
                  className="text-right font-poppins font-semibold"
                  style={{ color: "var(--color-status-overdue)" }}
                >
                  —
                </td>
              </tr>
              <tr>
                <td className="muted">Partial payments</td>
                <td
                  className="text-right font-poppins font-semibold"
                  style={{ color: "var(--color-status-partial)" }}
                >
                  —
                </td>
              </tr>
              <tr>
                <td className="muted">Prepaid</td>
                <td
                  className="text-right font-poppins font-semibold"
                  style={{ color: "var(--color-status-prepaid)" }}
                >
                  —
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3 className="section-title">Maintenance</h3>
          <table className="data-table">
            <tbody>
              <tr>
                <td className="muted">Emergency open</td>
                <td className="text-right">—</td>
              </tr>
              <tr>
                <td className="muted">High priority</td>
                <td className="text-right font-poppins font-semibold text-charcoal">—</td>
              </tr>
              <tr>
                <td className="muted">Open total</td>
                <td className="text-right font-poppins font-semibold text-charcoal">—</td>
              </tr>
              <tr>
                <td className="muted">Resolved this week</td>
                <td
                  className="text-right font-poppins font-semibold"
                  style={{ color: "var(--color-status-paid)" }}
                >
                  —
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Property Snapshot */}
      <section className="section">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title m-0">Property Snapshot</h3>
          <Link href="/admin/properties" className="btn btn-secondary !py-2 !text-sm">
            View all →
          </Link>
        </div>
        <div className="card">
          <p className="text-sm muted">
            Navigate to{" "}
            <Link href="/admin/properties" className="text-royal-blue font-poppins font-semibold">
              Properties
            </Link>{" "}
            to see the full list.
          </p>
        </div>
      </section>
    </>
  );
}
