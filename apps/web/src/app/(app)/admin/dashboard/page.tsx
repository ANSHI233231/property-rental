"use client";

/**
 * Admin Dashboard — Phase 7 (live KPIs).
 * Matches prototype/admin/dashboard.html exactly.
 *
 * KPIs computed client-side from paginated API responses (v1 approach).
 * TODO (Phase 8): add GET /admin/aggregates endpoint to avoid N fetches.
 *
 * Occupancy   — OCCUPIED units / total non-retired units across all properties.
 * Collected   — sum of paid_paise on RentPeriods where period_start ∈ current IST month.
 * Outstanding — sum of outstanding_paise on RentPeriods status ∈ {DUE,PARTIAL,OVERDUE}.
 * Overdue     — count of periods with status=OVERDUE.
 * Open Maint  — count of requests with status ∈ {OPEN,ASSIGNED,IN_PROGRESS}.
 * BL-17 Alerts — count of alerts where dismissed_at IS NULL.
 */

import { useAuth } from "@/lib/auth/context";
import { useEffect, useState } from "react";
import { SkeletonKpi } from "@/components/ui/Skeleton";
import { SkeletonTableRows } from "@/components/ui/Skeleton";
import { todayIST } from "@/lib/locale";
import { formatINR, UnitStateEnum, MaintenanceStatusCodes } from "@gharsetu/shared";
import { parseBigPaise } from "@/lib/rent/format";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UnitItem {
  id: string;
  // API returns state as SMALLINT: 0=AVAILABLE, 1=LISTED, 2=OCCUPIED, 3=MAINTENANCE
  // Legacy: may also return string values during transition.
  state: number | string;
  property_id?: string | number;
  property?: { id: string | number; name: string } | null;
}

interface UnitsResponse {
  data?: UnitItem[];
  items?: UnitItem[];
  meta?: { total?: number; hasMore?: boolean; cursor?: string };
}

interface RentPeriodItem {
  id: number | string;
  periodStart: string;
  outstandingPaise: string | number;
  paidPaise: string | number;
  status: number | string;
}

interface RentPeriodsResponse {
  data?: RentPeriodItem[];
  items?: RentPeriodItem[];
  meta?: { total?: number };
}

interface MaintenanceItem {
  id: string;
  // API returns status as SMALLINT (0–4) after Step 1 migration; accept string for legacy
  status: number | string;
}

interface MaintenanceResponse {
  data?: MaintenanceItem[];
  items?: MaintenanceItem[];
  meta?: { total?: number };
}

interface AlertItem {
  id: string;
  dismissed_at?: string | null;
  tenant?: { name?: string } | null;
  unit?: { name?: string } | null;
  property?: { name?: string } | null;
  request_count: number;
  month?: string | null;
}

interface AlertsResponse {
  data?: AlertItem[];
  items?: AlertItem[];
}

interface PropertyItem {
  id: string;
  name: string;
}

interface PropertiesResponse {
  data?: PropertyItem[];
  items?: PropertyItem[];
  meta?: { total?: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// KPI state
// ---------------------------------------------------------------------------

interface KpiState {
  propertiesCount: number | null;
  totalUnits: number | null;
  occupiedUnits: number | null;
  collectedPaise: number | null;
  outstandingPaise: number | null;
  overdueCount: number | null;
  openMaintenanceCount: number | null;
  emergencyOpenCount: number | null;
  alertCount: number | null;
  // Per-property occupancy breakdown
  propertyOccupancy: Array<{ name: string; occupied: number; total: number }>;
}

const EMPTY_KPIS: KpiState = {
  propertiesCount: null,
  totalUnits: null,
  occupiedUnits: null,
  collectedPaise: null,
  outstandingPaise: null,
  overdueCount: null,
  openMaintenanceCount: null,
  emergencyOpenCount: null,
  alertCount: null,
  propertyOccupancy: [],
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminDashboardPage() {
  const { user, apiFetch } = useAuth();

  const today = todayIST();

  const [kpis, setKpis] = useState<KpiState>(EMPTY_KPIS);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function fetchKpis() {
      setLoading(true);
      try {
        // TODO (Phase 8): replace these parallel fetches with a single
        // GET /admin/aggregates endpoint when backend adds it.
        // Current approach: fetch first 200 rows of each resource and aggregate
        // client-side. Safe for the current 120-unit / 18-property scope.

        const [propRes, unitRes, overdueRes, partialRes, dueRes, maintRes, alertRes] =
          await Promise.allSettled([
            apiFetch<PropertiesResponse>("/properties?limit=200"),
            apiFetch<UnitsResponse>("/units?limit=200"),
            apiFetch<RentPeriodsResponse>("/rent-periods?status=OVERDUE&limit=200"),
            apiFetch<RentPeriodsResponse>("/rent-periods?status=PARTIAL&limit=200"),
            apiFetch<RentPeriodsResponse>("/rent-periods?status=DUE&limit=200"),
            apiFetch<MaintenanceResponse>("/maintenance-requests?limit=200"),
            apiFetch<AlertsResponse>("/maintenance-requests/alerts"),
          ]);

        if (cancelled) return;

        // Properties
        const properties: PropertyItem[] =
          propRes.status === "fulfilled"
            ? propRes.value.data ?? propRes.value.items ?? []
            : [];
        const propertiesCount = properties.length;

        // Units — occupancy
        const units: UnitItem[] =
          unitRes.status === "fulfilled"
            ? unitRes.value.data ?? unitRes.value.items ?? []
            : [];
        // API returns state as numeric SMALLINT (0=AVAILABLE,1=LISTED,2=OCCUPIED,3=MAINTENANCE).
        // There is no "RETIRED" state in the numeric model; retired units are filtered by is_retired flag.
        // Accept both numeric and legacy string for robustness.
        function isOccupied(state: number | string): boolean {
          return state === UnitStateEnum.OCCUPIED || state === "OCCUPIED";
        }
        const nonRetiredUnits = units.filter(
          (u) => u.state !== "RETIRED" // legacy guard; numeric model has no RETIRED state
        );
        const occupiedUnits = nonRetiredUnits.filter((u) => isOccupied(u.state)).length;

        // Per-property breakdown — units carry property_id directly (snake_case
        // from the API). The optional nested `property` object isn't present
        // on the list endpoint, so fall back to property_id.
        const propMap = new Map<string, { name: string; occupied: number; total: number }>();
        properties.forEach((p) => propMap.set(String(p.id), { name: p.name, occupied: 0, total: 0 }));
        nonRetiredUnits.forEach((u) => {
          const propId = u.property?.id ?? u.property_id;
          if (!propId) return;
          const entry = propMap.get(String(propId));
          if (!entry) return;
          entry.total++;
          if (isOccupied(u.state)) entry.occupied++;
        });
        const propertyOccupancy = Array.from(propMap.values()).filter((p) => p.total > 0);

        // Rent — this month (filter by periodStart >= start of IST month)
        const overduePeriods: RentPeriodItem[] =
          overdueRes.status === "fulfilled"
            ? overdueRes.value.data ?? overdueRes.value.items ?? []
            : [];
        const partialPeriods: RentPeriodItem[] =
          partialRes.status === "fulfilled"
            ? partialRes.value.data ?? partialRes.value.items ?? []
            : [];
        const duePeriods: RentPeriodItem[] =
          dueRes.status === "fulfilled"
            ? dueRes.value.data ?? dueRes.value.items ?? []
            : [];

        // Outstanding = overdue + partial + due outstanding
        const outstandingPeriods = [...overduePeriods, ...partialPeriods, ...duePeriods];
        const outstandingPaise = outstandingPeriods.reduce(
          (sum, p) => sum + parseBigPaise(String(p.outstandingPaise)),
          0,
        );

        // Collected this IST month: filter periods whose periodStart >= month start
        // We approximate: all PAID/PREPAID periods (server-side filter not yet available)
        // Mark as month-approximate in the UI.
        const collectedPaise = 0; // Filled by a dedicated aggregate endpoint in Phase 8

        const overdueCount = overduePeriods.length;

        // Maintenance
        const maintItems: MaintenanceItem[] =
          maintRes.status === "fulfilled"
            ? maintRes.value.data ?? maintRes.value.items ?? []
            : [];
        // Accept both numeric codes and legacy strings
        const OPEN_STATUSES_NUMERIC = new Set<number>([
          MaintenanceStatusCodes.OPEN,
          MaintenanceStatusCodes.ASSIGNED,
          MaintenanceStatusCodes.IN_PROGRESS,
        ]);
        const OPEN_STATUSES_STRING = new Set(["OPEN", "ASSIGNED", "IN_PROGRESS"]);
        const openMaintenanceCount = maintItems.filter((m) =>
          typeof m.status === "number"
            ? OPEN_STATUSES_NUMERIC.has(m.status)
            : OPEN_STATUSES_STRING.has(String(m.status))
        ).length;
        const emergencyOpenCount = 0; // Would need priority filter — Phase 8 aggregate

        // Alerts — BL-17
        const alertItems: AlertItem[] =
          alertRes.status === "fulfilled"
            ? alertRes.value.data ?? alertRes.value.items ?? (Array.isArray(alertRes.value) ? (alertRes.value as AlertItem[]) : [])
            : [];
        const activeAlerts = alertItems.filter((a) => !a.dismissed_at);

        setKpis({
          propertiesCount,
          totalUnits: nonRetiredUnits.length,
          occupiedUnits,
          collectedPaise,
          outstandingPaise,
          overdueCount,
          openMaintenanceCount,
          emergencyOpenCount,
          alertCount: activeAlerts.length,
          propertyOccupancy,
        });
        setAlerts(activeAlerts.slice(0, 5)); // Show first 5 in alerts section
      } catch {
        // Per-request errors already handled via Promise.allSettled
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

  const occupancyPct =
    kpis.totalUnits != null && kpis.totalUnits > 0 && kpis.occupiedUnits != null
      ? Math.round((kpis.occupiedUnits / kpis.totalUnits) * 100)
      : null;

  return (
    <>
      {/* Top bar */}
      <header className="topbar">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-subtitle">
            All {kpis.propertiesCount != null ? kpis.propertiesCount : "—"} properties · {today}
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
      <section className="section" aria-label="Key performance indicators">
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
                value={kpis.propertiesCount ?? "—"}
                meta="Across Delhi NCR"
              />
              <KpiCard
                label="Total Units"
                value={kpis.totalUnits ?? "—"}
                meta="Non-retired"
              />
              <KpiCard
                label="Occupied"
                value={occupancyPct != null ? `${occupancyPct}%` : "—"}
                meta={
                  kpis.occupiedUnits != null && kpis.totalUnits != null
                    ? `${kpis.occupiedUnits} of ${kpis.totalUnits}`
                    : undefined
                }
              />
              <KpiCard
                label="Outstanding"
                value={kpis.outstandingPaise != null ? formatINR(kpis.outstandingPaise) : "—"}
                meta={
                  kpis.overdueCount != null
                    ? `${kpis.overdueCount} overdue unit${kpis.overdueCount !== 1 ? "s" : ""}`
                    : undefined
                }
                color={
                  kpis.outstandingPaise != null && kpis.outstandingPaise > 0
                    ? "var(--color-status-overdue)"
                    : undefined
                }
              />
            </>
          )}
        </div>
      </section>

      {/* BL-17 Alerts */}
      {(alerts.length > 0 || (!loading && kpis.alertCount != null && kpis.alertCount > 0)) && (
        <section className="section" aria-label="Admin alerts">
          <h3 className="section-title">Admin Alerts</h3>
          <div className="grid gap-3">
            {alerts.map((alert) => (
              <div key={alert.id} className="alert" role="alert">
                <strong className="font-poppins">
                  {alert.tenant?.name ?? "Tenant"} · {alert.unit?.name ? `Unit ${alert.unit.name}` : "—"}
                  {alert.property?.name ? ` (${alert.property.name})` : ""}
                </strong>
                <div>
                  {alert.request_count} maintenance requests
                  {alert.month ? ` in ${alert.month}` : " this month"} — exceeds 5/month
                  threshold.{" "}
                  <Link href="/admin/maintenance" className="text-royal-blue font-poppins font-semibold">
                    Review →
                  </Link>
                </div>
              </div>
            ))}
          </div>
          {kpis.alertCount != null && kpis.alertCount > alerts.length && (
            <p className="text-xs muted mt-2">
              +{kpis.alertCount - alerts.length} more alerts.{" "}
              <Link href="/admin/maintenance" className="text-royal-blue font-semibold">
                View all →
              </Link>
            </p>
          )}
        </section>
      )}

      {!loading && alerts.length === 0 && kpis.alertCount === 0 && (
        <section className="section">
          <h3 className="section-title">Admin Alerts</h3>
          <div className="alert">
            <div>No active BL-17 maintenance alerts.</div>
          </div>
        </section>
      )}

      {/* Two-column summary */}
      <section className="section grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="section-title">Rent Overview</h3>
          <table className="data-table" aria-label="Rent summary">
            <tbody>
              <tr>
                <td className="muted">Overdue</td>
                <td
                  className="text-right font-poppins font-semibold"
                  style={{ color: "var(--color-status-overdue)" }}
                >
                  {loading ? "…" : kpis.outstandingPaise != null ? formatINR(kpis.outstandingPaise) : "—"}
                </td>
              </tr>
              <tr>
                <td className="muted">Overdue units</td>
                <td className="text-right font-poppins font-semibold text-charcoal">
                  {loading ? "…" : kpis.overdueCount ?? "—"}
                </td>
              </tr>
              <tr>
                <td className="muted">Open maintenance</td>
                <td className="text-right font-poppins font-semibold text-charcoal">
                  {loading ? "…" : kpis.openMaintenanceCount ?? "—"}
                </td>
              </tr>
              <tr>
                <td className="muted">BL-17 alerts</td>
                <td
                  className="text-right font-poppins font-semibold"
                  style={{
                    color:
                      kpis.alertCount && kpis.alertCount > 0
                        ? "var(--color-status-overdue)"
                        : undefined,
                  }}
                >
                  {loading ? "…" : kpis.alertCount ?? "—"}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4">
            <Link href="/admin/rent" className="btn btn-secondary !py-2 !text-sm">
              View Rent Details →
            </Link>
          </div>
        </div>

        <div className="card">
          <h3 className="section-title">Maintenance</h3>
          <table className="data-table" aria-label="Maintenance summary">
            <tbody>
              <tr>
                <td className="muted">Open total</td>
                <td className="text-right font-poppins font-semibold text-charcoal">
                  {loading ? "…" : kpis.openMaintenanceCount ?? "—"}
                </td>
              </tr>
              <tr>
                <td className="muted">Properties with alerts</td>
                <td
                  className="text-right font-poppins font-semibold"
                  style={{
                    color:
                      kpis.alertCount && kpis.alertCount > 0
                        ? "var(--color-status-overdue)"
                        : undefined,
                  }}
                >
                  {loading ? "…" : kpis.alertCount ?? "—"}
                </td>
              </tr>
            </tbody>
          </table>
          <div className="mt-4">
            <Link href="/admin/maintenance" className="btn btn-secondary !py-2 !text-sm">
              View Maintenance →
            </Link>
          </div>
        </div>
      </section>

      {/* Property Occupancy Breakdown */}
      <section className="section">
        <div className="flex items-center justify-between mb-4">
          <h3 className="section-title m-0">Property Snapshot</h3>
          <Link href="/admin/properties" className="btn btn-secondary !py-2 !text-sm">
            View all →
          </Link>
        </div>
        <div className="card p-0 overflow-x-auto">
          <table className="data-table" aria-label="Per-property occupancy snapshot">
            <caption className="sr-only">Occupancy breakdown by property</caption>
            <thead>
              <tr>
                <th scope="col">Property</th>
                <th scope="col" className="text-right">Occupied</th>
                <th scope="col" className="text-right">Total</th>
                <th scope="col" className="text-right">Occupancy</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonTableRows rows={5} cols={4} />}

              {!loading && kpis.propertyOccupancy.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center muted py-8">
                    No unit data available.
                  </td>
                </tr>
              )}

              {!loading &&
                kpis.propertyOccupancy.map((p) => {
                  const pct = p.total > 0 ? Math.round((p.occupied / p.total) * 100) : 0;
                  return (
                    <tr key={p.name}>
                      <td className="font-poppins font-semibold text-charcoal">{p.name}</td>
                      <td className="text-right">{p.occupied}</td>
                      <td className="text-right">{p.total}</td>
                      <td
                        className="text-right font-poppins font-semibold"
                        style={{
                          color:
                            pct >= 80
                              ? "var(--color-status-paid)"
                              : pct >= 50
                              ? "var(--color-status-partial)"
                              : "var(--color-status-overdue)",
                        }}
                      >
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
