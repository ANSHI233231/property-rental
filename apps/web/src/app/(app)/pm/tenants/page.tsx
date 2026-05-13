"use client";

/**
 * PM Tenants list — Phase 3.
 * 1:1 with prototype/pm/tenants.html.
 * Columns: Tenant(s), Unit, Lease, Rent, Phone, Status.
 * Row click → /pm/tenants/[id].
 */

import { usePmProperty } from "@/lib/pm/context";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatDateOnlyIST } from "@/lib/locale";
import { formatINR, LeaseStatusEnum } from "@gharsetu/shared";
import { SkeletonTableRows } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { usePaginatedList } from "@/lib/pagination/usePaginatedList";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TenantRow {
  id: number | string;
  name: string;
  phone?: string;
  co_tenants?: { name: string }[];
  unit?: { id: number | string; name: string };
  lease?: {
    id: number | string;
    start_date: string;
    end_date: string;
    monthly_rent_paise: string | number;
    status: number | string;
  };
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: number | string }) {
  if (typeof status === "number") {
    const NUM_CLASS: Record<number, string> = {
      [LeaseStatusEnum.ACTIVE]: "badge-paid",
      [LeaseStatusEnum.EXPIRED]: "badge-open",
      [LeaseStatusEnum.RENEWED]: "badge-renewed",
      [LeaseStatusEnum.TERMINATED]: "badge-terminated",
    };
    const NUM_LABEL: Record<number, string> = {
      [LeaseStatusEnum.ACTIVE]: "Active",
      [LeaseStatusEnum.EXPIRED]: "Expired",
      [LeaseStatusEnum.RENEWED]: "Renewed",
      [LeaseStatusEnum.TERMINATED]: "Terminated",
    };
    return <span className={`badge ${NUM_CLASS[status] ?? "badge-open"}`}>{NUM_LABEL[status] ?? String(status)}</span>;
  }
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
  const label = normalised.charAt(0).toUpperCase() + normalised.slice(1);
  return <span className={`badge ${badgeClass}`}>{label}</span>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PmTenantsPage() {
  const { property, propertyId, loading: propertyLoading } = usePmProperty();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Any");
  // Committed values (applied on Search button click or Enter)
  const [committedSearch, setCommittedSearch] = useState("");
  const [committedStatus, setCommittedStatus] = useState("Any");

  const extraQuery: Record<string, string | undefined> = {};
  if (committedSearch.trim()) extraQuery.search = committedSearch.trim();
  if (committedStatus !== "Any") extraQuery.status = committedStatus.toUpperCase();
  if (propertyId) extraQuery._propertyId = propertyId; // force-included for stable serialisation

  const {
    items: tenants,
    page,
    totalPages,
    total,
    pageSize: activePageSize,
    hasNext,
    hasPrev,
    loading,
    next,
    prev,
    goToPage,
  } = usePaginatedList<TenantRow>({
    url: propertyId ? `/properties/${propertyId}/tenants` : "/properties/0/tenants",
    extraQuery: propertyId ? extraQuery : undefined,
    pageSize: 10,
  });

  // Wait for property context
  const isReady = !propertyLoading && !!propertyId;

  function applyFilters() {
    setCommittedSearch(search);
    setCommittedStatus(statusFilter);
  }

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
              onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
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
              onClick={applyFilters}
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
            {loading || !isReady ? (
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
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={activePageSize}
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={prev}
            onNext={next}
            onGoToPage={goToPage}
            itemsOnPage={tenants.length}
            loading={loading}
          />
        )}
      </section>
    </>
  );
}
