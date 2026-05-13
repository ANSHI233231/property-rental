"use client";

/**
 * PM Units — list of units in the PM's assigned property.
 *
 * Backed by GET /units?status=&page=&pageSize=. Backend auto-scopes the
 * caller to their property when actor.role === PROPERTY_MANAGER, so no
 * explicit property filter is required (or exposed) here.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { usePmProperty } from "@/lib/pm/context";
import { formatINR, unitStateName, UnitStateEnum } from "@gharsetu/shared";
import { Pagination } from "@/components/ui/Pagination";
import { usePaginatedList } from "@/lib/pagination/usePaginatedList";
import { SkeletonTableRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UnitRow {
  id: number | string;
  unit_number: string;
  floor?: number | null;
  bedrooms: number;
  monthly_rent_paise: number | string;
  state: number | string;
  is_retired: boolean;
}

type StatusFilter = "ALL" | "AVAILABLE" | "OCCUPIED" | "MAINTENANCE" | "LISTED" | "RETIRED";

// ---------------------------------------------------------------------------
// Helpers (mirror admin page so the same state → color/label mapping applies)
// ---------------------------------------------------------------------------

function stateBadgeClass(row: UnitRow): string {
  if (row.is_retired) return "badge badge-closed";
  const s = row.state;
  if (typeof s === "number") {
    switch (s) {
      case UnitStateEnum.AVAILABLE: return "badge badge-paid";
      case UnitStateEnum.OCCUPIED: return "badge badge-prepaid";
      case UnitStateEnum.MAINTENANCE: return "badge badge-partial";
      case UnitStateEnum.LISTED: return "badge badge-renewed";
      default: return "badge badge-closed";
    }
  }
  switch (s) {
    case "AVAILABLE": return "badge badge-paid";
    case "OCCUPIED": return "badge badge-prepaid";
    case "MAINTENANCE": return "badge badge-partial";
    case "LISTED": return "badge badge-renewed";
    default: return "badge badge-closed";
  }
}

function stateLabel(row: UnitRow): string {
  if (row.is_retired) return "Retired";
  const s = row.state;
  if (typeof s === "number") return unitStateName(s as UnitStateEnum) ?? "Unknown";
  return String(s);
}

function formatRent(paise: number | string): string {
  const n = typeof paise === "string" ? parseInt(paise, 10) : paise;
  return isNaN(n) ? "—" : formatINR(n);
}

function CountTile({ label, value, loading }: { label: string; value: number | null | undefined; loading?: boolean }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{loading || value === null ? "—" : value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PmUnitsPage() {
  const { apiFetch } = useAuth();
  const { property, loading: propertyLoading } = usePmProperty();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [counts, setCounts] = useState<Record<string, number | null>>({
    total: null, AVAILABLE: null, OCCUPIED: null, MAINTENANCE: null, LISTED: null, RETIRED: null,
  });
  const [countsLoading, setCountsLoading] = useState(true);

  // Summary counts — backend auto-scopes to this PM's property, no extra param.
  useEffect(() => {
    let cancelled = false;
    setCountsLoading(true);
    const reads = [
      apiFetch<{ meta?: { total?: number } }>(`/units?limit=1`).then((r) => ({ k: "total", v: r.meta?.total ?? 0 })),
      ...["AVAILABLE", "OCCUPIED", "MAINTENANCE", "LISTED", "RETIRED"].map((s) =>
        apiFetch<{ meta?: { total?: number } }>(`/units?limit=1&status=${s}`).then((r) => ({ k: s, v: r.meta?.total ?? 0 })),
      ),
    ];
    Promise.allSettled(reads).then((results) => {
      if (cancelled) return;
      const next: Record<string, number | null> = {
        total: null, AVAILABLE: null, OCCUPIED: null, MAINTENANCE: null, LISTED: null, RETIRED: null,
      };
      results.forEach((r) => {
        if (r.status === "fulfilled") next[r.value.k] = r.value.v;
      });
      setCounts(next);
      setCountsLoading(false);
    });
    return () => { cancelled = true; };
  }, [apiFetch]);

  const extraQuery: Record<string, string | undefined> = {};
  if (statusFilter !== "ALL") extraQuery.status = statusFilter;

  const {
    items: units,
    page,
    totalPages,
    total,
    hasNext,
    hasPrev,
    loading,
    next,
    prev,
    goToPage,
  } = usePaginatedList<UnitRow>({
    url: "/units",
    extraQuery,
    pageSize: 10,
  });

  const isEmpty = !loading && !propertyLoading && units.length === 0;

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Units</h1>
          <div className="page-subtitle">
            {property?.name ?? ""} · {total ?? 0} unit{total === 1 ? "" : "s"}
          </div>
        </div>
      </header>

      {/* Summary tiles */}
      <section className="section">
        <div className="kpi-grid">
          <CountTile label="Total Units" value={counts.total} loading={countsLoading} />
          <CountTile label="Available" value={counts.AVAILABLE} loading={countsLoading} />
          <CountTile label="Occupied" value={counts.OCCUPIED} loading={countsLoading} />
          <CountTile label="Maintenance" value={counts.MAINTENANCE} loading={countsLoading} />
          <CountTile label="Listed" value={counts.LISTED} loading={countsLoading} />
          <CountTile label="Retired" value={counts.RETIRED} loading={countsLoading} />
        </div>
      </section>

      {/* Filters — status only (no property filter; backend scopes for us) */}
      <section className="card mb-6">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="label" htmlFor="pm-unit-status-filter">Status</label>
            <select
              id="pm-unit-status-filter"
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="ALL">All</option>
              <option value="AVAILABLE">Available</option>
              <option value="OCCUPIED">Occupied</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="LISTED">Listed</option>
              <option value="RETIRED">Retired</option>
            </select>
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="card p-0 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Unit Number</th>
              <th>Floor</th>
              <th>Bedrooms</th>
              <th>Monthly Rent</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading || propertyLoading ? (
              <SkeletonTableRows rows={5} cols={5} />
            ) : isEmpty ? (
              <tr>
                <td colSpan={5} className="p-0">
                  <EmptyState
                    heading="No units in this property."
                    body="Ask an admin to add units, or change the status filter."
                  />
                </td>
              </tr>
            ) : (
              units.map((u) => (
                <tr key={u.id}>
                  <td className="font-poppins font-semibold text-charcoal whitespace-nowrap">
                    Unit {u.unit_number}
                  </td>
                  <td>{u.floor ?? "—"}</td>
                  <td>{u.bedrooms}</td>
                  <td>{formatRent(u.monthly_rent_paise)}</td>
                  <td><span className={stateBadgeClass(u)}>{stateLabel(u)}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loading && totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={10}
            itemsOnPage={units.length}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={prev}
            onNext={next}
            onGoToPage={goToPage}
          />
        )}
      </section>
    </>
  );
}
