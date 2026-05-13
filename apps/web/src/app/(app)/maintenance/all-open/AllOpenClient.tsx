"use client";

/**
 * Maintenance Staff — All Open Requests (read-only) — CLIENT COMPONENT.
 * 1:1 with prototype/maintenance/all-open.html.
 *
 * Read-only view across all properties. Filter by priority.
 * Row click shows detail only — no actions.
 * BL-16: no "New Request" button anywhere.
 *
 * This file is the interactive shell. Route config (dynamic = "force-dynamic")
 * lives in the server-component wrapper page.tsx (BUG-004 fix).
 */

import { useAuth } from "@/lib/auth/context";
import { useCallback, useEffect, useState } from "react";
import { formatDateIST } from "@/lib/locale";
import { Pagination } from "@/components/ui/Pagination";
import { usePaginatedList } from "@/lib/pagination/usePaginatedList";
import { MaintenanceStatusBadge } from "@/components/maintenance/MaintenanceStatusBadge";
import { PriorityBadge } from "@/components/maintenance/PriorityBadge";
import { friendlyError } from "@/lib/api/errors";
import { MaintenancePriorityCodes, MaintenanceStatusCodes } from "@gharsetu/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MaintenanceRequest {
  id: number | string;
  title: string;
  description: string;
  priority: number | string;
  status: number | string;
  unit?: { name?: string } | null;
  property?: { name?: string; address?: string } | null;
  assigned_to?: { id?: number | string; name?: string } | null;
  created_at: string;
}

interface ListResponse {
  data?: MaintenanceRequest[];
  items?: MaintenanceRequest[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  return formatDateIST(iso);
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// Numeric priority sort order (lower = higher priority)
const PRIORITY_ORDER_NUM: Record<number, number> = {
  [MaintenancePriorityCodes.EMERGENCY]: 0,
  [MaintenancePriorityCodes.HIGH]: 1,
  [MaintenancePriorityCodes.NORMAL]: 2,
  [MaintenancePriorityCodes.LOW]: 3,
};
const PRIORITY_ORDER_STR: Record<string, number> = {
  EMERGENCY: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

function prioritySortKey(p: number | string): number {
  if (typeof p === "number") return PRIORITY_ORDER_NUM[p] ?? 99;
  return PRIORITY_ORDER_STR[p] ?? 99;
}

type PriorityFilter = "ALL" | "EMERGENCY" | "HIGH" | "NORMAL" | "LOW";

function matchesPriority(p: number | string, filter: PriorityFilter): boolean {
  if (filter === "ALL") return true;
  if (typeof p === "number") {
    const map: Record<PriorityFilter, number | undefined> = {
      ALL: undefined,
      EMERGENCY: MaintenancePriorityCodes.EMERGENCY,
      HIGH: MaintenancePriorityCodes.HIGH,
      NORMAL: MaintenancePriorityCodes.NORMAL,
      LOW: MaintenancePriorityCodes.LOW,
    };
    return p === map[filter];
  }
  return p === filter;
}

// Open statuses (OPEN, ASSIGNED, IN_PROGRESS)
function isOpenStatus(s: number | string): boolean {
  if (typeof s === "number") {
    return s === MaintenanceStatusCodes.OPEN || s === MaintenanceStatusCodes.ASSIGNED || s === MaintenanceStatusCodes.IN_PROGRESS;
  }
  return s === "OPEN" || s === "ASSIGNED" || s === "IN_PROGRESS";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MaintenanceAllOpenPage() {
  const { user, apiFetch } = useAuth();

  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");

  const extraQuery: Record<string, string | undefined> = {
    scope: "all-open",
  };
  if (priorityFilter !== "ALL") extraQuery.priority = priorityFilter;

  const {
    items: rawItems,
    page,
    totalPages,
    total,
    pageSize: activePageSize,
    hasNext,
    hasPrev,
    loading,
    error,
    next,
    prev,
    goToPage,
  } = usePaginatedList<MaintenanceRequest>({
    url: "/maintenance-requests",
    extraQuery,
    pageSize: 10,
  });

  // Filter to open statuses only and sort by priority
  const filtered = rawItems
    .filter((r) => isOpenStatus(r.status))
    .sort((a, b) => prioritySortKey(a.priority) - prioritySortKey(b.priority));

  // For chip counts, fetch a summary separately
  const [allOpenRequests, setAllOpenRequests] = useState<MaintenanceRequest[]>([]);
  useEffect(() => {
    let cancelled = false;
    apiFetch<{ data?: MaintenanceRequest[]; items?: MaintenanceRequest[] }>(
      "/maintenance-requests?scope=all-open&limit=200"
    )
      .then((res) => {
        if (!cancelled) {
          const items = res.data ?? res.items ?? [];
          setAllOpenRequests(items.filter((r) => isOpenStatus(r.status)));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [apiFetch]);

  const counts: Record<PriorityFilter, number> = {
    ALL: allOpenRequests.length,
    EMERGENCY: allOpenRequests.filter((r) => matchesPriority(r.priority, "EMERGENCY")).length,
    HIGH: allOpenRequests.filter((r) => matchesPriority(r.priority, "HIGH")).length,
    NORMAL: allOpenRequests.filter((r) => matchesPriority(r.priority, "NORMAL")).length,
    LOW: allOpenRequests.filter((r) => matchesPriority(r.priority, "LOW")).length,
  };

  const filterChips: { label: string; value: PriorityFilter }[] = [
    { label: `All · ${counts.ALL}`, value: "ALL" },
    { label: `Emergency · ${counts.EMERGENCY}`, value: "EMERGENCY" },
    { label: `High · ${counts.HIGH}`, value: "HIGH" },
    { label: `Normal · ${counts.NORMAL}`, value: "NORMAL" },
    { label: `Low · ${counts.LOW}`, value: "LOW" },
  ];

  if (loading) {
    return (
      <>
        <header className="topbar">
          <div>
            <h1 className="page-title">All Open Requests</h1>
            <div className="page-subtitle">Loading…</div>
          </div>
        </header>
        <div className="card animate-pulse h-48" />
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">All Open Requests</h1>
          <div className="page-subtitle">
            Across all properties · {counts.ALL} open · sorted by priority
          </div>
        </div>
        <div className="topbar-user">
          <span className="hidden md:inline">{user?.name}</span>
          <span className="avatar" aria-hidden="true">
            {user?.name ? initials(user.name) : "—"}
          </span>
        </div>
      </header>

      {/* Read-only info banner */}
      <div className="alert mb-6" role="note">
        <div>
          <strong className="font-poppins">Read-only view.</strong>
          <div>You can see what&apos;s coming, but new assignments are made by the Property Manager. You cannot create new requests.</div>
        </div>
      </div>

      {error && <div className="field-error show mb-4">{error}</div>}

      {/* Priority filter chips */}
      <div className="flex gap-2 flex-wrap mb-6" role="group" aria-label="Filter by priority">
        {filterChips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            className={chip.value === priorityFilter ? "btn btn-primary !py-2 !text-sm" : "btn btn-secondary !py-2 !text-sm"}
            onClick={() => setPriorityFilter(chip.value)}
            aria-pressed={chip.value === priorityFilter}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card">
          <p className="text-charcoal font-poppins font-semibold">No requests match this filter.</p>
          <p className="text-sm muted mt-1">Try a different priority filter or check back later.</p>
        </div>
      ) : (
        <section className="card p-0 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Property</th>
                <th>Issue</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Raised</th>
                <th>Assigned</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => {
                const isYou = req.assigned_to?.id != null && user?.id != null &&
                  String(req.assigned_to.id) === String(user.id);
                const assignedName = req.assigned_to?.name ?? null;

                return (
                  <tr key={req.id}>
                    <td className="font-poppins font-semibold text-charcoal">
                      {req.unit?.name ?? "—"}
                    </td>
                    <td>{req.property?.name ?? "—"}</td>
                    <td>{req.title}</td>
                    <td><PriorityBadge priority={req.priority} /></td>
                    <td><MaintenanceStatusBadge status={req.status} /></td>
                    <td className="whitespace-nowrap">{formatDate(req.created_at)}</td>
                    <td>
                      {assignedName ? (
                        <>
                          {assignedName}
                          {isYou && (
                            <span className="text-xs muted"> (you)</span>
                          )}
                        </>
                      ) : (
                        <span className="muted">Unassigned</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

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
        itemsOnPage={filtered.length}
        loading={loading}
      />

      <p className="text-xs muted mt-4">
        Cannot see: <strong>Rent</strong> · <strong>Leases</strong> · <strong>Tenant financial data</strong> · <strong>Payment history</strong>
      </p>
    </>
  );
}
