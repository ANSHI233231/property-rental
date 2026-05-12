"use client";

/**
 * PM Dashboard — Phase 3.
 * KPI shell per prototype/pm/dashboard.html.
 * Active Tenants, Active Leases, Leases Ending Soon (within 30 days).
 */

import { useAuth } from "@/lib/auth/context";
import { usePmProperty } from "@/lib/pm/context";
import { useEffect, useState } from "react";
import { format, parseISO, isWithinInterval, addDays, startOfMonth, endOfMonth } from "date-fns";
import { todayIST, formatDateOnlyIST } from "@/lib/locale";
import { SkeletonKpi } from "@/components/ui/Skeleton";
import { paiseStringToINR, parseBigPaise } from "@/lib/rent/format";
import { MaintenanceStatusCodes, MaintenancePriorityCodes } from "@gharsetu/shared";
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

interface RentPeriod {
  id: string;
  leaseId: string;
  status: string;
  paidPaise: string;
  outstandingPaise: string;
}

interface RentPeriodsResponse {
  data?: RentPeriod[];
  items?: RentPeriod[];
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

  const today = todayIST();

  const [tenantsTotal, setTenantsTotal] = useState<number | null>(null);
  const [activeLeasesTotal, setActiveLeasesTotal] = useState<number | null>(null);
  const [endingSoonCount, setEndingSoonCount] = useState<number | null>(null);
  const [endingSoonLeases, setEndingSoonLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  // Phase 4 rent KPIs
  const [rentCollectedPaise, setRentCollectedPaise] = useState<number | null>(null);
  const [overdueCount, setOverdueCount] = useState<number | null>(null);
  // Phase 5 maintenance KPIs
  const [openMaintenanceCount, setOpenMaintenanceCount] = useState<number | null>(null);
  const [emergencyMaintenanceCount, setEmergencyMaintenanceCount] = useState<number | null>(null);

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;

    async function fetchKpis() {
      setLoading(true);
      try {
        const now = new Date();
        const periodStart = format(startOfMonth(now), "yyyy-MM-dd");
        const periodEnd = format(endOfMonth(now), "yyyy-MM-dd");

        const [tenantsRes, leasesRes, paidPeriodsRes, overduePeriodsRes, openMaintRes] = await Promise.allSettled([
          apiFetch<{ meta?: PaginatedMeta }>(`/properties/${propertyId}/tenants?limit=1`),
          apiFetch<{ meta?: PaginatedMeta; data?: Lease[] }>(
            `/leases?propertyId=${propertyId}&status=ACTIVE&limit=100`,
          ),
          // Phase 4: rent collected this month (PAID periods)
          apiFetch<RentPeriodsResponse>(
            `/rent-periods?propertyId=${propertyId}&status=PAID&periodStart=${periodStart}&limit=50`,
          ),
          // Phase 4: overdue count
          apiFetch<RentPeriodsResponse>(
            `/rent-periods?propertyId=${propertyId}&status=OVERDUE&limit=50`,
          ),
          // Phase 5: open maintenance requests
          apiFetch<{ data?: { priority: string; status: string }[]; items?: { priority: string; status: string }[]; meta?: { total?: number } }>(
            `/maintenance-requests?propertyId=${propertyId}&limit=100`,
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
          // Phase 4 — rent KPIs
          if (paidPeriodsRes.status === "fulfilled") {
            const items = paidPeriodsRes.value.data ?? paidPeriodsRes.value.items ?? [];
            const total = items.reduce((acc, p) => acc + parseBigPaise(p.paidPaise), 0);
            setRentCollectedPaise(total);
          } else {
            setRentCollectedPaise(0);
          }
          if (overduePeriodsRes.status === "fulfilled") {
            const items = overduePeriodsRes.value.data ?? overduePeriodsRes.value.items ?? [];
            setOverdueCount(items.length);
          } else {
            setOverdueCount(0);
          }
          // Phase 5 — maintenance KPIs
          if (openMaintRes.status === "fulfilled") {
            const items = openMaintRes.value.data ?? openMaintRes.value.items ?? [];
            const openReqs = items.filter((r) => {
              const s = r.status;
              return typeof s === "number"
                ? s === MaintenanceStatusCodes.OPEN || s === MaintenanceStatusCodes.ASSIGNED || s === MaintenanceStatusCodes.IN_PROGRESS
                : s === "OPEN" || s === "ASSIGNED" || s === "IN_PROGRESS";
            });
            setOpenMaintenanceCount(openReqs.length);
            setEmergencyMaintenanceCount(openReqs.filter((r) => {
              const p = r.priority;
              return typeof p === "number" ? p === MaintenancePriorityCodes.EMERGENCY : p === "EMERGENCY";
            }).length);
          } else {
            setOpenMaintenanceCount(0);
            setEmergencyMaintenanceCount(0);
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
                label="Rent Collected"
                value={
                  rentCollectedPaise !== null
                    ? paiseStringToINR(String(rentCollectedPaise))
                    : "—"
                }
                meta="This month (PAID)"
                color="var(--color-status-paid)"
              />
              <KpiCard
                label="Overdue Tenants"
                value={overdueCount ?? "—"}
                meta="5+ days past due"
                color={overdueCount ? "var(--color-status-overdue)" : undefined}
              />
              <KpiCard
                label="Open Maintenance"
                value={openMaintenanceCount ?? "—"}
                meta="Open / Assigned / In-Progress"
                color={openMaintenanceCount ? "var(--color-status-partial)" : undefined}
              />
              <KpiCard
                label="Emergency Requests"
                value={emergencyMaintenanceCount ?? "—"}
                meta="Needs urgent attention"
                color={emergencyMaintenanceCount ? "var(--color-status-overdue)" : undefined}
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
                {l.unit?.name ?? "Unit"} ends {formatDateOnlyIST(l.end_date)}
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
        {/* Maintenance queue — Phase 5 live */}
        <div className="card">
          <h3 className="section-title">Maintenance Queue</h3>
          {openMaintenanceCount !== null && openMaintenanceCount > 0 ? (
            <>
              <p className="text-sm muted mb-2">
                <strong className="text-charcoal">{openMaintenanceCount}</strong> open request{openMaintenanceCount !== 1 ? "s" : ""}
                {emergencyMaintenanceCount ? (
                  <span style={{ color: "var(--color-status-overdue)" }}>
                    {" "}— {emergencyMaintenanceCount} emergency
                  </span>
                ) : null}
              </p>
            </>
          ) : (
            <p className="text-sm muted mb-2">No open requests.</p>
          )}
          <Link href="/pm/maintenance" className="btn btn-primary mt-3 !text-sm !py-2 inline-flex">
            Open Maintenance →
          </Link>
        </div>

        {/* Recent payments — link to rent collection */}
        <div className="card">
          <h3 className="section-title">Rent Collection</h3>
          <p className="text-sm muted mb-3">
            Record payments, view payment history, and track late fees.
          </p>
          {overdueCount !== null && overdueCount > 0 && (
            <p className="text-sm" style={{ color: "var(--color-status-overdue)" }}>
              <strong>{overdueCount}</strong> overdue period{overdueCount !== 1 ? "s" : ""} require{overdueCount === 1 ? "s" : ""} attention.
            </p>
          )}
          <Link
            href="/pm/rent-collection"
            className="btn btn-primary mt-3 !text-sm !py-2 inline-flex"
          >
            Open Rent Collection →
          </Link>
        </div>
      </section>
    </>
  );
}
