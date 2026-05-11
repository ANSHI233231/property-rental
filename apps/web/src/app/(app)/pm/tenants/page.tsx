"use client";

/**
 * PM Tenants list — Phase 3.
 * 1:1 with prototype/pm/tenants.html.
 * Columns: Tenant(s), Unit, Lease, Rent, Phone, Status.
 * Row click → /pm/tenants/[id].
 */

import { useAuth } from "@/lib/auth/context";
import { usePmProperty } from "@/lib/pm/context";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDateOnlyIST } from "@/lib/locale";
import { formatINR } from "@gharsetu/shared";
import { SkeletonTableRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TenantRow {
  id: string;
  name: string;
  phone?: string;
  co_tenants?: { name: string }[];
  unit?: { id: string; name: string };
  lease?: {
    id: string;
    start_date: string;
    end_date: string;
    monthly_rent_paise: string | number;
    status: string;
  };
}

interface PaginatedResponse {
  data?: TenantRow[];
  items?: TenantRow[];
  meta?: {
    total?: number;
    count?: number;
    next_cursor?: string | null;
    hasMore?: boolean;
  };
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const normalised = status.toLowerCase();
  const badgeClass =
    normalised === "active"
      ? "badge-paid"
      : normalised === "overdue"
        ? "badge-overdue"
        : normalised === "partial"
          ? "badge-partial"
          : normalised === "prepaid"
            ? "badge-prepaid"
            : "badge-open";

  const label =
    normalised === "active"
      ? "Active"
      : normalised.charAt(0).toUpperCase() + normalised.slice(1);

  return <span className={`badge ${badgeClass}`}>{label}</span>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PmTenantsPage() {
  const { apiFetch } = useAuth();
  const { property, propertyId, loading: propertyLoading } = usePmProperty();
  const router = useRouter();

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Any");

  const fetchTenants = useCallback(
    async (cursor: string | null = null, append = false) => {
      if (!propertyId) return;
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams({ limit: "20" });
        if (cursor) params.set("cursor", cursor);
        if (search.trim()) params.set("search", search.trim());
        if (statusFilter !== "Any") params.set("status", statusFilter.toUpperCase());

        const res = await apiFetch<PaginatedResponse>(
          `/properties/${propertyId}/tenants?${params.toString()}`,
        );
        const rows: TenantRow[] = res.data ?? res.items ?? [];

        setTenants((prev) => (append ? [...prev, ...rows] : rows));
        setTotal(res.meta?.total ?? null);
        setNextCursor(res.meta?.next_cursor ?? null);
      } catch {
        if (!append) setTenants([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [apiFetch, propertyId, search, statusFilter],
  );

  useEffect(() => {
    if (!propertyLoading && propertyId) {
      void fetchTenants();
    } else if (!propertyLoading && !propertyId) {
      setLoading(false);
    }
  }, [fetchTenants, propertyLoading, propertyId]);

  const formatDate = (iso: string) => formatDateOnlyIST(iso);

  const formatRent = (paise: string | number) => {
    const val = typeof paise === "string" ? parseInt(paise, 10) : paise;
    return isNaN(val) ? "—" : `${formatINR(val)}/mo`;
  };

  const isEmpty = !loading && tenants.length === 0;

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Tenants</h1>
          <div className="page-subtitle">
            {property?.name ?? ""}
            {total != null ? ` · ${total} active tenant${total !== 1 ? "s" : ""}` : ""}
          </div>
        </div>
      </header>

      {/* Filters */}
      <section className="card mb-6">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="label" htmlFor="search">Search</label>
            <input
              id="search"
              className="input"
              placeholder="Tenant name, phone, unit"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void fetchTenants(); }}
            />
          </div>
          <div>
            <label className="label" htmlFor="status">Status</label>
            <select
              id="status"
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option>Any</option>
              <option>Active</option>
              <option>Notice given</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void fetchTenants()}
            >
              Search
            </button>
          </div>
        </div>
      </section>

      {/* Table */}
      <section className="card p-0 overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tenant(s)</th>
              <th>Unit</th>
              <th>Lease</th>
              <th>Rent</th>
              <th>Phone</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonTableRows rows={5} cols={7} />
            ) : isEmpty ? (
              <tr>
                <td colSpan={7} className="p-0">
                  <EmptyState
                    heading="No tenants yet."
                    body="Sign a new lease to onboard your first tenant."
                    cta={
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => router.push("/pm/leases")}
                      >
                        Go to Leases
                      </button>
                    }
                  />
                </td>
              </tr>
            ) : (
              tenants.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="font-poppins font-semibold text-charcoal">{t.name}</div>
                    {t.co_tenants && t.co_tenants.length > 0 && (
                      <div className="text-xs muted">
                        {t.co_tenants.length === 1
                          ? `+ ${t.co_tenants[0]!.name} (co-tenant)`
                          : `+ ${t.co_tenants.length} co-tenant${t.co_tenants.length > 1 ? "s" : ""}`}
                      </div>
                    )}
                  </td>
                  <td>{t.unit?.name ?? "—"}</td>
                  <td>
                    {t.lease
                      ? `${formatDate(t.lease.start_date)} → ${formatDate(t.lease.end_date)}`
                      : "—"}
                  </td>
                  <td>
                    {t.lease ? formatRent(t.lease.monthly_rent_paise) : "—"}
                  </td>
                  <td>{t.phone ?? "—"}</td>
                  <td>
                    {t.lease ? <StatusBadge status={t.lease.status} /> : <span className="muted text-sm">—</span>}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="text-royal-blue font-poppins font-semibold hover:underline"
                      onClick={() => router.push(`/pm/tenants/${t.id}`)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!loading && !isEmpty && (
          <div className="flex items-center justify-between p-4 border-t border-light-gray text-sm muted">
            <div>
              Showing {tenants.length}
              {total != null ? ` of ${total}` : ""}
            </div>
            {nextCursor && (
              <button
                type="button"
                className="btn btn-secondary !py-1 !px-3 !text-sm"
                onClick={() => void fetchTenants(nextCursor, true)}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            )}
          </div>
        )}
      </section>
    </>
  );
}
