"use client";

/**
 * Admin Audit Log Viewer — Phase 7.
 *
 * Table columns: When (DD/MM/YYYY HH:mm IST), Actor (name + role),
 *   Action (property.create, lease.create, auth.login.success, etc.),
 *   Entity (type:id), Before/After (expandable JSON diff).
 *
 * Filters: date range, actor, action prefix, entity type.
 * Export: CSV of current page data (client-side).
 *
 * TODO (Phase 8 / BE integration):
 *   - Wire to GET /audit-log?actorId=&action=&entityType=&from=&to=&cursor=&limit=50
 *     when the backend endpoint lands. Current code uses placeholder data
 *     and shows a "Backend endpoint pending" toast on first load.
 *   - Remove PLACEHOLDER_DATA and the useEffect "pending" toast once the
 *     real endpoint is available.
 *   - Uncomment the fetchAuditLog() call in useEffect.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth/context";
import { useToast } from "@/components/ui/Toast";
import { formatDateIST } from "@/lib/locale";
import { SkeletonTableRows } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { usePaginatedList } from "@/lib/pagination/usePaginatedList";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  createdAt: string;         // ISO UTC — displayed in IST
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;            // e.g. "property.create", "auth.login.success"
  entityType: string | null; // e.g. "Property", "Lease", "Payment"
  entityId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

interface AuditLogResponse {
  data: AuditLogEntry[];
  meta?: { cursor?: string | null; hasMore?: boolean; total?: number };
}

// ---------------------------------------------------------------------------
// Placeholder data (shown while BE endpoint is pending — Phase 7 TODO)
// ---------------------------------------------------------------------------

const PLACEHOLDER_DATA: AuditLogEntry[] = [
  {
    id: "placeholder-1",
    createdAt: "2026-05-11T07:30:00.000Z",
    actorId: "admin-1",
    actorName: "Raj Singh",
    actorRole: "ADMIN",
    action: "property.create",
    entityType: "Property",
    entityId: "prop-001",
    before: null,
    after: { name: "Sai Heights", address: "Lajpat Nagar" },
  },
  {
    id: "placeholder-2",
    createdAt: "2026-05-11T08:15:00.000Z",
    actorId: "pm-1",
    actorName: "Priya Sharma",
    actorRole: "PROPERTY_MANAGER",
    action: "lease.create",
    entityType: "Lease",
    entityId: "lease-042",
    before: null,
    after: { unitId: "unit-7", monthlyRentPaise: 2000000, status: "active" },
  },
  {
    id: "placeholder-3",
    createdAt: "2026-05-11T09:00:00.000Z",
    actorId: "pm-1",
    actorName: "Priya Sharma",
    actorRole: "PROPERTY_MANAGER",
    action: "payment.create",
    entityType: "Payment",
    entityId: "pay-119",
    before: { status: "PARTIAL" },
    after: { status: "PAID", paidPaise: 2000000 },
  },
  {
    id: "placeholder-4",
    createdAt: "2026-05-10T18:00:00.000Z",
    actorId: "admin-1",
    actorName: "Raj Singh",
    actorRole: "ADMIN",
    action: "auth.login.success",
    entityType: "User",
    entityId: "admin-1",
    before: null,
    after: null,
  },
];

const ENTITY_TYPES = [
  "All",
  "Property",
  "Unit",
  "User",
  "Lease",
  "Payment",
  "MaintenanceRequest",
  "MaintenanceAlert",
  "RentPeriod",
];

// ---------------------------------------------------------------------------
// JSON Diff renderer
// ---------------------------------------------------------------------------

function JsonDiffPanel({
  label,
  data,
}: {
  label: string;
  data: Record<string, unknown> | null;
}) {
  if (!data) {
    return (
      <div className="flex-1">
        <div className="text-xs font-poppins font-semibold text-slate mb-1">{label}</div>
        <div className="text-xs muted italic">—</div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0">
      <div className="text-xs font-poppins font-semibold text-slate mb-1">{label}</div>
      <pre className="text-xs bg-light-gray rounded p-2 overflow-x-auto max-h-40 text-charcoal">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function JsonDiff({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  if (!before && !after) {
    return <p className="text-xs muted">No field-level diff available.</p>;
  }

  // Identify changed keys
  const allKeys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);

  const changedKeys = Array.from(allKeys).filter(
    (k) => JSON.stringify((before ?? {})[k]) !== JSON.stringify((after ?? {})[k]),
  );

  return (
    <div>
      {changedKeys.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-poppins font-semibold text-charcoal mb-1">
            Changed keys
          </div>
          <div className="flex flex-wrap gap-1">
            {changedKeys.map((k) => (
              <span
                key={k}
                className="badge"
                style={{ background: "var(--color-saffron)", color: "#fff", fontSize: "11px" }}
              >
                {k}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-3">
        <JsonDiffPanel label="Before" data={before} />
        <JsonDiffPanel label="After" data={after} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit row (collapsible diff)
// ---------------------------------------------------------------------------

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasDiff = entry.before !== null || entry.after !== null;

  return (
    <>
      <tr
        className={hasDiff ? "cursor-pointer hover:bg-light-gray" : ""}
        onClick={() => hasDiff && setExpanded((e) => !e)}
        aria-expanded={hasDiff ? expanded : undefined}
      >
        <td className="whitespace-nowrap text-sm">{formatDateIST(entry.createdAt)}</td>
        <td>
          <div className="font-poppins font-semibold text-charcoal text-sm">
            {entry.actorName ?? "System"}
          </div>
          {entry.actorRole && (
            <div className="text-xs muted">{entry.actorRole.replace("_", " ")}</div>
          )}
        </td>
        <td>
          <code className="text-xs bg-light-gray px-1 py-0.5 rounded text-royal-blue">
            {entry.action}
          </code>
        </td>
        <td className="text-sm">
          {entry.entityType && entry.entityId ? (
            <span className="font-mono text-xs">
              {entry.entityType}:{entry.entityId.slice(0, 8)}…
            </span>
          ) : (
            <span className="muted">—</span>
          )}
        </td>
        <td className="text-sm">
          {hasDiff ? (
            <button
              type="button"
              className="btn btn-secondary !py-1 !px-2 !text-xs"
              aria-label={`${expanded ? "Collapse" : "Expand"} diff for ${entry.action}`}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
            >
              {expanded ? "Hide" : "Show"}
            </button>
          ) : (
            <span className="muted text-xs">—</span>
          )}
        </td>
      </tr>
      {expanded && hasDiff && (
        <tr>
          <td colSpan={5} className="bg-off-white px-4 py-3 border-t border-mid-gray">
            <JsonDiff before={entry.before} after={entry.after} />
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// CSV export (client-side, current page data only)
// ---------------------------------------------------------------------------

function exportCSV(entries: AuditLogEntry[]) {
  const headers = ["When (IST)", "Actor", "Role", "Action", "Entity Type", "Entity ID"];
  const rows = entries.map((e) => [
    formatDateIST(e.createdAt),
    e.actorName ?? "System",
    e.actorRole ?? "",
    e.action,
    e.entityType ?? "",
    e.entityId ?? "",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `gharsetu-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Audit log page size
// ---------------------------------------------------------------------------

const AUDIT_PAGE_SIZE = 10;

export default function AdminAuditLogPage() {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  // Filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("All");
  const [actorFilter, setActorFilter] = useState("");

  // Committed filter values (applied on Search click)
  const [committedFrom, setCommittedFrom] = useState("");
  const [committedTo, setCommittedTo] = useState("");
  const [committedAction, setCommittedAction] = useState("");
  const [committedEntity, setCommittedEntity] = useState("All");
  const [committedActor, setCommittedActor] = useState("");

  const pendingToastShown = useRef(false);

  // When the BE endpoint ships, swap this to usePaginatedList with url="/audit-log"
  // For now: use placeholder data and show a developer notice
  const extraQuery: Record<string, string | undefined> = {};
  if (committedFrom) extraQuery.from = committedFrom;
  if (committedTo) extraQuery.to = committedTo;
  if (committedAction) extraQuery.action = committedAction;
  if (committedEntity !== "All") extraQuery.entityType = committedEntity;
  if (committedActor) extraQuery.actor = committedActor;

  const {
    items: apiEntries,
    page,
    totalPages: apiTotalPages,
    total: apiTotal,
    pageSize: apiPageSize,
    hasNext,
    hasPrev,
    loading: apiLoading,
    next,
    prev,
    goToPage,
    refresh,
  } = usePaginatedList<AuditLogEntry>({
    url: "/audit-log",
    extraQuery,
    pageSize: AUDIT_PAGE_SIZE,
  });

  // Track whether we got a real response or not
  const [usePlaceholder, setUsePlaceholder] = useState(false);
  const [entries, setEntries] = useState<AuditLogEntry[]>(PLACEHOLDER_DATA);
  const loading = apiLoading;

  useEffect(() => {
    // If apiEntries come back empty but the call succeeded (i.e. no network error),
    // fall back to placeholder only if endpoint returns 404/not-found.
    if (!apiLoading) {
      if (apiEntries.length > 0) {
        setEntries(apiEntries);
        setUsePlaceholder(false);
      } else {
        // Keep placeholder visible while endpoint is pending
        setUsePlaceholder(true);
      }
    }
  }, [apiEntries, apiLoading]);

  useEffect(() => {
    // Show one-time toast that the endpoint may be pending
    if (!pendingToastShown.current) {
      pendingToastShown.current = true;
      setTimeout(() => {
        toast(
          "Audit log: backend endpoint (GET /audit-log) is pending. Showing placeholder data.",
          "info",
        );
      }, 800);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Display entries: real API data if available, else filtered placeholder
  const displayEntries = usePlaceholder
    ? entries.filter((e) => {
        if (committedAction && !e.action.startsWith(committedAction)) return false;
        if (committedEntity !== "All" && e.entityType !== committedEntity) return false;
        if (committedActor && !(e.actorName ?? "").toLowerCase().includes(committedActor.toLowerCase())) return false;
        return true;
      })
    : entries;

  // Client-side pagination for placeholder data
  const placeholderPage = usePlaceholder
    ? displayEntries.slice((page - 1) * AUDIT_PAGE_SIZE, page * AUDIT_PAGE_SIZE)
    : displayEntries;
  const placeholderHasNext = usePlaceholder ? page * AUDIT_PAGE_SIZE < displayEntries.length : hasNext;
  const placeholderHasPrev = usePlaceholder ? page > 1 : hasPrev;
  const [placeholderPageNum, setPlaceholderPageNum] = useState(1);

  const filtered = usePlaceholder ? placeholderPage : displayEntries;
  const effectivePage = usePlaceholder ? placeholderPageNum : page;
  const effectiveHasNext = usePlaceholder ? placeholderPageNum * AUDIT_PAGE_SIZE < displayEntries.length : hasNext;
  const effectiveHasPrev = usePlaceholder ? placeholderPageNum > 1 : hasPrev;
  const effectiveTotalPages = usePlaceholder
    ? Math.max(1, Math.ceil(displayEntries.length / AUDIT_PAGE_SIZE))
    : apiTotalPages;
  const effectiveTotal = usePlaceholder ? displayEntries.length : apiTotal;
  const effectivePageSize = usePlaceholder ? AUDIT_PAGE_SIZE : apiPageSize;
  const effectiveGoToPage = usePlaceholder
    ? (n: number) => setPlaceholderPageNum(Math.max(1, Math.min(n, effectiveTotalPages)))
    : goToPage;

  const handleSearch = useCallback(() => {
    setCommittedFrom(fromDate);
    setCommittedTo(toDate);
    setCommittedAction(actionFilter);
    setCommittedEntity(entityTypeFilter);
    setCommittedActor(actorFilter);
    if (usePlaceholder) setPlaceholderPageNum(1);
    else refresh();
  }, [fromDate, toDate, actionFilter, entityTypeFilter, actorFilter, usePlaceholder, refresh]);

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Audit Log</h1>
          <div className="page-subtitle">All admin actions across the platform</div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="btn btn-secondary !py-2 !text-sm"
            onClick={() => exportCSV(filtered)}
            disabled={filtered.length === 0}
            aria-label="Export current page data as CSV"
          >
            Export CSV
          </button>
        </div>
      </header>

      {/* Filters */}
      <section className="card mb-6" aria-label="Audit log filters">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="label" htmlFor="al-from">From (DD/MM/YYYY)</label>
            <input
              id="al-from"
              className="input"
              type="text"
              placeholder="01/05/2026"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="al-to">To (DD/MM/YYYY)</label>
            <input
              id="al-to"
              className="input"
              type="text"
              placeholder="31/05/2026"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="al-action">Action (prefix)</label>
            <input
              id="al-action"
              className="input"
              type="text"
              placeholder="lease."
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="al-entity">Entity type</label>
            <select
              id="al-entity"
              className="input"
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-end gap-3 mt-4">
          <div className="flex-1">
            <label className="label" htmlFor="al-actor">Actor name</label>
            <input
              id="al-actor"
              className="input"
              type="text"
              placeholder="Search by actor name…"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary !py-2 !text-sm"
            onClick={handleSearch}
            aria-label="Apply audit log filters"
          >
            Search
          </button>
          <button
            type="button"
            className="btn btn-secondary !py-2 !text-sm"
            onClick={() => {
              setFromDate("");
              setToDate("");
              setActionFilter("");
              setEntityTypeFilter("All");
              setActorFilter("");
              setCommittedFrom("");
              setCommittedTo("");
              setCommittedAction("");
              setCommittedEntity("All");
              setCommittedActor("");
              if (usePlaceholder) setPlaceholderPageNum(1);
            }}
            aria-label="Clear all filters"
          >
            Clear
          </button>
        </div>
      </section>

      {/* Table */}
      <section className="card p-0 overflow-x-auto">
        <table className="data-table" aria-label="Audit log entries">
          <caption className="sr-only">Admin audit log — all platform actions</caption>
          <thead>
            <tr>
              <th scope="col">When (IST)</th>
              <th scope="col">Actor</th>
              <th scope="col">Action</th>
              <th scope="col">Entity</th>
              <th scope="col">Diff</th>
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonTableRows rows={5} cols={5} />}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center muted py-10">
                  No audit entries match the current filters.
                </td>
              </tr>
            )}

            {!loading && filtered.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}

          </tbody>
        </table>
      </section>

      {/* Pagination */}
      <Pagination
        page={effectivePage}
        totalPages={effectiveTotalPages}
        total={effectiveTotal}
        pageSize={effectivePageSize}
        hasPrev={effectiveHasPrev}
        hasNext={effectiveHasNext}
        onPrev={() => {
          if (usePlaceholder) setPlaceholderPageNum((p) => Math.max(1, p - 1));
          else prev();
        }}
        onNext={() => {
          if (usePlaceholder) setPlaceholderPageNum((p) => p + 1);
          else next();
        }}
        onGoToPage={effectiveGoToPage}
        itemsOnPage={filtered.length}
        loading={loading}
      />

      <p className="text-xs muted mt-4">
        Times displayed in Asia/Kolkata (IST). Audit log is append-only; entries cannot be deleted.
      </p>

      {/* BE integration note — visible to developers in dev mode only */}
      {process.env.NODE_ENV === "development" && (
        <div className="mt-4 p-3 rounded border border-mid-gray bg-light-gray text-xs">
          <strong className="font-poppins">Developer note:</strong> Wire to{" "}
          <code>GET /audit-log?actorId=&amp;action=&amp;entityType=&amp;from=&amp;to=&amp;cursor=&amp;limit=50</code>
          {" "}when BE ships. See TODO comments in this file.
        </div>
      )}
    </>
  );
}
