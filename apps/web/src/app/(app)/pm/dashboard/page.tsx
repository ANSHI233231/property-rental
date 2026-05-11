"use client";

/**
 * PM Dashboard — Phase 3.
 * KPI shell per prototype/pm/dashboard.html.
 * Active Tenants, Active Leases, Leases Ending Soon (within 30 days).
 */

import { useAuth } from "@/lib/auth/context";
import { usePmProperty } from "@/lib/pm/context";
import { useEffect, useState } from "react";
import { format, parseISO, isWithinInterval, addDays } from "date-fns";
import { SkeletonKpi } from "@/components/ui/Skeleton";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaginatedMeta {
  total?: number;
  count?: number;
}

interface Lease {
  id: string;
  status: string;
  end_date: string;
  unit?: { name?: string };
  tenants?: { name: string }[];
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  meta,
  color,
}: {
  label: string;
  value: React.ReactNode;
  meta?: string;
  color?: string;
}) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={color ? { color } : undefined}>
        {value}
      </div>
      {meta && <div className="kpi-meta">{meta}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PmDashboardPage() {
  const { user, apiFetch } = useAuth();
  const { property, propertyId, loading: propertyLoading } = usePmProperty();

  const today = format(new Date(), "dd/MM/yyyy");

  const [tenantsTotal, setTenantsTotal] = useState<number | null>(null);
  const [activeLeasesTotal, setActiveLeasesTotal] = useState<number | null>(null);
  const [endingSoonCount, setEndingSoonCount] = useState<number | null>(null);
  const [endingSoonLeases, setEndingSoonLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;

    async function fetchKpis() {
      setLoading(true);
      try {
        const [tenantsRes, leasesRes] = await Promise.allSettled([
          apiFetch<{ meta?: PaginatedMeta }>(`/properties/${propertyId}/tenants?limit=1`),
          apiFetch<{ meta?: PaginatedMeta; data?: Lease[] }>(
            `/leases?propertyId=${propertyId}&status=ACTIVE&limit=100`,
          ),
        ]);

        if (!cancelled) {
          if (tenantsRes.status === "fulfilled") {
            const total =
              tenantsRes.value?.meta?.total ?? null;
            setTenantsTotal(typeof total === "number" ? total : null);
          }
          if (leasesRes.status === "fulfilled") {
            const meta = leasesRes.value?.meta;
            const total = meta?.total ?? null;
            setActiveLeasesTotal(typeof total === "number" ? total : null);

            // Filter ending within 30 days client-side
            const leases = leasesRes.value?.data ?? [];
            const now = new Date();
            const cutoff = addDays(now, 30);
            const ending = leases.filter((l) => {
              try {
                const endDate = parseISO(l.end_date);
                return isWithinInterval(endDate, { start: now, end: cutoff });
              } catch {
                return false;
              }
            });
            setEndingSoonLeases(ending);
            setEndingSoonCount(ending.length);
          }
        }
      } catch {
        // Silently fail — KPIs show "—"
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchKpis();
    return () => { cancelled = true; };
  }, [apiFetch, propertyId]);

  function initials(name: string): string {
    return name
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }

  const isKpiLoading = loading || propertyLoading;

  return (
    <>
      {/* Top bar */}
      <header className="topbar">
        <div>
          <h1 className="page-title">{property?.name ?? "Dashboard"}</h1>
          <div className="page-subtitle">
            {property ? `${property.address} · Property Manager: ${user?.name ?? "—"}` : today}
          </div>
        </div>
        <div className="topbar-user">
          <span className="hidden md:inline">{user?.name}</span>
          <span className="avatar" aria-hidden="true">
            {user?.name ? initials(user.name) : "—"}
          </span>
        </div>
      </header>

      {/* KPIs */}
      <section className="section">
        <div className="kpi-grid">
          {isKpiLoading ? (
            <>
              <SkeletonKpi />
              <SkeletonKpi />
              <SkeletonKpi />
              <SkeletonKpi />
            </>
          ) : (
            <>
              <KpiCard
                label="Active Tenants"
                value={tenantsTotal ?? "—"}
                meta="Current occupants"
                color="var(--color-status-paid)"
              />
              <KpiCard
                label="Active Leases"
                value={activeLeasesTotal ?? "—"}
                meta="Currently active"
              />
              <KpiCard
                label="Leases Ending Soon"
                value={endingSoonCount ?? "—"}
                meta="Within 30 days"
                color={endingSoonCount ? "var(--color-status-partial)" : undefined}
              />
              <KpiCard
                label="Rent Overview"
                value="—"
                meta="Fills in Phase 4"
              />
            </>
          )}
        </div>
      </section>

      {/* Lease expiry alert */}
      {endingSoonCount !== null && endingSoonCount > 0 && (
        <div className="alert mb-6">
          <strong className="font-poppins">
            Leases expiring in 30 days: {endingSoonCount}
          </strong>
          <div>
            {endingSoonLeases.slice(0, 3).map((l, i) => (
              <span key={l.id}>
                {i > 0 && " · "}
                {l.unit?.name ?? "Unit"} ends {format(parseISO(l.end_date), "dd/MM/yyyy")}
              </span>
            ))}
            {endingSoonLeases.length > 3 && ` · and ${endingSoonLeases.length - 3} more`}
            {"  "}
            <Link href="/pm/leases" className="text-royal-blue font-poppins font-semibold">
              Review →
            </Link>
          </div>
        </div>
      )}

      {/* Two column */}
      <section className="grid lg:grid-cols-2 gap-6 section">
        {/* Maintenance queue stub */}
        <div className="card">
          <h3 className="section-title">Maintenance Queue</h3>
          <p className="text-sm muted">
            Maintenance data available in Phase 5. Navigate to{" "}
            <Link href="/pm/maintenance" className="text-royal-blue font-poppins font-semibold">
              Maintenance
            </Link>
            .
          </p>
        </div>

        {/* Recent payments stub */}
        <div className="card">
          <h3 className="section-title">Recent Payments</h3>
          <p className="text-sm muted">
            Payment tracking available in Phase 4. Navigate to{" "}
            <Link href="/pm/rent-collection" className="text-royal-blue font-poppins font-semibold">
              Rent Collection
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
