"use client";

/**
 * Maintenance Staff — All Open Requests (read-only).
 * 1:1 with prototype/maintenance/all-open.html.
 *
 * Read-only view across all properties. Filter by priority.
 * Row click shows detail only — no actions.
 * BL-16: no "New Request" button anywhere.
 */

import { useAuth } from "@/lib/auth/context";
import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { MaintenanceStatusBadge } from "@/components/maintenance/MaintenanceStatusBadge";
import { PriorityBadge } from "@/components/maintenance/PriorityBadge";
import { friendlyError } from "@/lib/api/errors";
import type { MaintenancePriorityValue, MaintenanceStatusValue } from "@gharsetu/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  priority: MaintenancePriorityValue;
  status: MaintenanceStatusValue;
  unit?: { name?: string } | null;
  property?: { name?: string; address?: string } | null;
  assigned_to?: { id?: string; name?: string } | null;
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
  if (!iso) return "—";
  try { return format(parseISO(iso), "dd/MM/yyyy HH:mm"); } catch { return iso; }
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

const PRIORITY_ORDER: Record<MaintenancePriorityValue, number> = {
  EMERGENCY: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

type PriorityFilter = MaintenancePriorityValue | "ALL";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MaintenanceAllOpenPage() {
  const { user, apiFetch } = useAuth();

  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<ListResponse>(
        `/maintenance-requests?scope=all-open&limit=100`,
      );
      const items = res.data ?? res.items ?? (Array.isArray(res) ? (res as MaintenanceRequest[]) : []);
      items.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99));
      setRequests(items);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { void fetchRequests(); }, [fetchRequests]);

  const filtered = priorityFilter === "ALL"
    ? requests
    : requests.filter((r) => r.priority === priorityFilter);

  // Count per priority for filter chips
  const counts: Record<PriorityFilter, number> = {
    ALL: requests.length,
    EMERGENCY: requests.filter((r) => r.priority === "EMERGENCY").length,
    HIGH: requests.filter((r) => r.priority === "HIGH").length,
    NORMAL: requests.filter((r) => r.priority === "NORMAL").length,
    LOW: requests.filter((r) => r.priority === "LOW").length,
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
            Across all properties · {requests.length} open · sorted by priority
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
                const isYou = req.assigned_to?.id === user?.id;
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

      <p className="text-xs muted mt-4">
        Cannot see: <strong>Rent</strong> · <strong>Leases</strong> · <strong>Tenant financial data</strong> · <strong>Payment history</strong>
      </p>
    </>
  );
}
