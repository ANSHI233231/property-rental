"use client";

/**
 * PM Maintenance — Request queue + assign flow.
 * 1:1 with prototype/pm/maintenance.html.
 *
 * BL-21: No Close button — only tenants can close.
 * EmergencyBanner active for OPEN/ASSIGNED/IN_PROGRESS EMERGENCY requests.
 */

import { useAuth } from "@/lib/auth/context";
import { usePmProperty } from "@/lib/pm/context";
import { useCallback, useEffect, useState } from "react";
import { Pagination } from "@/components/ui/Pagination";
import { usePaginatedList } from "@/lib/pagination/usePaginatedList";
import { formatDateOnlyIST, formatDateIST } from "@/lib/locale";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { MaintenanceStatusBadge } from "@/components/maintenance/MaintenanceStatusBadge";
import { PriorityBadge } from "@/components/maintenance/PriorityBadge";
import { EmergencyBanner } from "@/components/maintenance/EmergencyBanner";
import { friendlyError } from "@/lib/api/errors";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AssignMaintenanceSchema, MaintenanceStatusCodes, MaintenancePriorityCodes, maintenanceStatusName, maintenancePriorityName, CreateMaintenanceRequestSchema } from "@gharsetu/shared";
import type { AssignMaintenanceInput, CreateMaintenanceRequestInput } from "@gharsetu/shared";
import { EmptyState } from "@/components/ui/EmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MaintenanceRequest {
  id: number | string;
  title: string;
  description: string;
  // API returns SMALLINT codes after Step 1 migration; accept string for legacy
  priority: number | string;
  status: number | string;
  unit?: { name?: string } | null;
  raised_by?: { name?: string } | null;
  assigned_to?: { id?: number | string; name?: string } | null;
  assigned_at?: string | null;
  in_progress_at?: string | null;
  resolved_at?: string | null;
  created_at: string;
}

interface RequestsResponse {
  data?: MaintenanceRequest[];
  items?: MaintenanceRequest[];
  meta?: { total?: number };
}

interface MaintenanceUser {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
}

interface UsersResponse {
  data?: MaintenanceUser[];
  items?: MaintenanceUser[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  return formatDateOnlyIST(iso);
}

function formatDateTime(iso: string | null | undefined): string {
  return formatDateIST(iso);
}

// Sort priority: EMERGENCY(3) first → LOW(0) last
// Numeric: higher code = higher priority (EMERGENCY=3) → invert for sort ascending
function prioritySortKey(p: number | string): number {
  if (typeof p === "number") return 3 - p; // EMERGENCY=3 → 0, LOW=0 → 3
  const m: Record<string, number> = { EMERGENCY: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
  return m[p as string] ?? 99;
}

type PriorityFilter = "ALL" | "EMERGENCY" | "HIGH" | "NORMAL" | "LOW";
type StatusFilter = "ALL" | "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

// Helper to match a request's priority against a string filter value
function matchesPriority(p: number | string, filter: PriorityFilter): boolean {
  if (filter === "ALL") return true;
  if (typeof p === "number") {
    const map: Record<PriorityFilter, number | undefined> = {
      ALL: undefined, EMERGENCY: MaintenancePriorityCodes.EMERGENCY, HIGH: MaintenancePriorityCodes.HIGH, NORMAL: MaintenancePriorityCodes.NORMAL, LOW: MaintenancePriorityCodes.LOW,
    };
    return p === map[filter];
  }
  return p === filter;
}

// Helper to match a request's status against a string filter value
function matchesStatus(s: number | string, filter: StatusFilter): boolean {
  if (filter === "ALL") return true;
  if (typeof s === "number") {
    const map: Record<StatusFilter, number | undefined> = {
      ALL: undefined, OPEN: MaintenanceStatusCodes.OPEN, ASSIGNED: MaintenanceStatusCodes.ASSIGNED, IN_PROGRESS: MaintenanceStatusCodes.IN_PROGRESS, RESOLVED: MaintenanceStatusCodes.RESOLVED, CLOSED: MaintenanceStatusCodes.CLOSED,
    };
    return s === map[filter];
  }
  return s === filter;
}

// ---------------------------------------------------------------------------
// Assign Modal
// ---------------------------------------------------------------------------

function AssignModal({
  open,
  onClose,
  requestId,
  requestTitle,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  requestId: string;
  requestTitle: string;
  onSuccess: () => void;
}) {
  const { apiFetch } = useAuth();
  const [staffList, setStaffList] = useState<MaintenanceUser[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<AssignMaintenanceInput>({
    resolver: zodResolver(AssignMaintenanceSchema),
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    reset();
    setSubmitError(null);
    setLoadingStaff(true);

    apiFetch<UsersResponse>("/users?role=MAINTENANCE&is_active=true&limit=50")
      .then((res) => {
        const items = res.data ?? res.items ?? (Array.isArray(res) ? (res as MaintenanceUser[]) : []);
        setStaffList(items);
      })
      .catch(() => setStaffList([]))
      .finally(() => setLoadingStaff(false));
  }, [open, apiFetch, reset]);

  async function onSubmit(data: AssignMaintenanceInput) {
    setSubmitError(null);
    try {
      await apiFetch(`/maintenance-requests/${requestId}/assign`, {
        method: "POST",
        body: JSON.stringify({ assigneeUserId: data.assigneeUserId }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setSubmitError(friendlyError(err));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Assign Staff" maxWidth="max-w-[480px]">
      <p className="text-sm muted mt-1 mb-4">
        <strong className="text-charcoal">{requestTitle}</strong>
        <br />
        Select a maintenance staff member to assign this request to.
      </p>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        {loadingStaff ? (
          <div className="text-slate text-sm">Loading staff…</div>
        ) : staffList.length === 0 ? (
          <div className="field-error show">No active maintenance staff found.</div>
        ) : (
          <Field id="assigneeUserId" label="Maintenance Staff" error={errors.assigneeUserId?.message}>
            <select className="input" {...register("assigneeUserId")}>
              <option value="">— Select staff member —</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
        )}
        {submitError && <div className="field-error show mt-3">{submitError}</div>}
        <div className="flex justify-end gap-3 mt-6">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            className="btn btn-primary !py-2 !text-sm"
            disabled={isSubmitting || loadingStaff || staffList.length === 0}
          >
            {isSubmitting ? "Assigning…" : "Assign"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Detail Drawer (slide-in panel)
// ---------------------------------------------------------------------------

function RequestDetail({
  request,
  onClose,
  onAssign,
}: {
  request: MaintenanceRequest;
  onClose: () => void;
  onAssign: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex justify-end"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative z-50 bg-white w-full max-w-md shadow-2xl overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Request details"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-poppins font-semibold text-charcoal text-lg">Request Details</h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close details"
              className="text-slate hover:text-charcoal"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex gap-2 mb-3 flex-wrap">
            <PriorityBadge priority={request.priority} />
            <MaintenanceStatusBadge status={request.status} />
          </div>

          <h4 className="font-poppins font-semibold text-charcoal mb-1">
            {request.unit?.name ? `Unit ${request.unit.name} — ` : ""}
            {request.title}
          </h4>

          <p className="text-sm text-charcoal mt-3">{request.description}</p>

          <hr className="divider" />

          <dl className="text-sm space-y-2">
            <div className="flex justify-between">
              <dt className="muted">Raised by</dt>
              <dd className="text-charcoal font-medium">{request.raised_by?.name ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="muted">Raised at</dt>
              <dd className="text-charcoal">{formatDateTime(request.created_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="muted">Assigned to</dt>
              <dd className="text-charcoal">{request.assigned_to?.name ?? "Unassigned"}</dd>
            </div>
            {request.assigned_at && (
              <div className="flex justify-between">
                <dt className="muted">Assigned at</dt>
                <dd className="text-charcoal">{formatDateTime(request.assigned_at)}</dd>
              </div>
            )}
            {request.in_progress_at && (
              <div className="flex justify-between">
                <dt className="muted">In progress since</dt>
                <dd className="text-charcoal">{formatDateTime(request.in_progress_at)}</dd>
              </div>
            )}
            {request.resolved_at && (
              <div className="flex justify-between">
                <dt className="muted">Resolved at</dt>
                <dd className="text-charcoal">{formatDateTime(request.resolved_at)}</dd>
              </div>
            )}
          </dl>

          {/* Actions */}
          {matchesStatus(request.status, "OPEN") && (
            <div className="mt-6">
              <button
                type="button"
                className="btn btn-primary !py-2 !text-sm w-full"
                onClick={onAssign}
              >
                Assign Staff
              </button>
            </div>
          )}
          {/* No Close button — BL-21 */}
          {matchesStatus(request.status, "RESOLVED") && (
            <p className="text-xs muted mt-6">
              Tenant closes the request. PMs cannot auto-close. Closed requests cannot be reopened.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PmMaintenancePage() {
  const { apiFetch } = useAuth();
  const { property, propertyId } = usePmProperty();

  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [assignModal, setAssignModal] = useState<{ requestId: string; requestTitle: string } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refetchKey, setRefetchKey] = useState(0);

  const extraQuery: Record<string, string | undefined> = {};
  if (propertyId) extraQuery.propertyId = propertyId;
  if (priorityFilter !== "ALL") extraQuery.priority = priorityFilter;
  if (statusFilter !== "ALL") extraQuery.status = statusFilter;

  const {
    items: filtered,
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
    refresh,
  } = usePaginatedList<MaintenanceRequest>({
    url: "/maintenance-requests",
    extraQuery: propertyId ? extraQuery : undefined,
    pageSize: 10,
    refetchKey,
  });

  // Sort fetched page by priority
  const sortedFiltered = [...filtered].sort((a, b) => prioritySortKey(a.priority) - prioritySortKey(b.priority));

  // For chip counts, we fetch a summary without pagination (limit=200 for counts only)
  const [allRequests, setAllRequests] = useState<MaintenanceRequest[]>([]);
  const fetchAllForCounts = useCallback(async () => {
    if (!propertyId) return;
    try {
      const res = await apiFetch<RequestsResponse>(`/maintenance-requests?propertyId=${propertyId}&limit=200`);
      const items = res.data ?? res.items ?? (Array.isArray(res) ? (res as MaintenanceRequest[]) : []);
      setAllRequests(items);
    } catch {
      // swallow
    }
  }, [propertyId, apiFetch]);

  useEffect(() => { void fetchAllForCounts(); }, [fetchAllForCounts]);

  const counts: Record<PriorityFilter, number> = {
    ALL: allRequests.length,
    EMERGENCY: allRequests.filter((r) => matchesPriority(r.priority, "EMERGENCY")).length,
    HIGH: allRequests.filter((r) => matchesPriority(r.priority, "HIGH")).length,
    NORMAL: allRequests.filter((r) => matchesPriority(r.priority, "NORMAL")).length,
    LOW: allRequests.filter((r) => matchesPriority(r.priority, "LOW")).length,
  };

  const priorityChips: { label: string; value: PriorityFilter }[] = [
    { label: `All · ${counts.ALL}`, value: "ALL" },
    { label: `Emergency · ${counts.EMERGENCY}`, value: "EMERGENCY" },
    { label: `High · ${counts.HIGH}`, value: "HIGH" },
    { label: `Normal · ${counts.NORMAL}`, value: "NORMAL" },
    { label: `Low · ${counts.LOW}`, value: "LOW" },
  ];

  const openCount = allRequests.filter((r) =>
    matchesStatus(r.status, "OPEN") || matchesStatus(r.status, "ASSIGNED") || matchesStatus(r.status, "IN_PROGRESS")
  ).length;

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Maintenance</h1>
          <div className="page-subtitle">
            {property?.name ?? ""} · {openCount} open request{openCount !== 1 ? "s" : ""}
          </div>
        </div>
        {/* BL-16 deviation (user-approved 2026-05-13): PM may raise on
            behalf for units in their assigned property. */}
        {propertyId && (
          <button
            type="button"
            className="btn btn-primary !py-2 !text-sm"
            onClick={() => setShowCreateModal(true)}
          >
            + New Request
          </button>
        )}
      </header>

      {/* Emergency banner — PM view */}
      <EmergencyBanner requests={allRequests} />

      {error && <div className="field-error show mb-4">{error}</div>}

      {/* Priority filter chips */}
      <div className="flex gap-2 flex-wrap mb-4" role="group" aria-label="Filter by priority">
        {priorityChips.map((chip) => (
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

      {/* Status filter */}
      <div className="mb-6">
        <select
          className="input"
          style={{ width: "auto", minWidth: 180 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by status"
        >
          <option value="ALL">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="IN_PROGRESS">In-Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="grid lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-light-gray rounded w-2/3 mb-3" />
              <div className="h-4 bg-light-gray rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : sortedFiltered.length === 0 ? (
        <EmptyState
          heading="No requests"
          body="No maintenance requests match the current filters."
        />
      ) : (
        <section className="grid lg:grid-cols-2 gap-4">
          {sortedFiltered.map((req) => {
            const isEmergency = matchesPriority(req.priority, "EMERGENCY");

            return (
              <div
                key={req.id}
                className={`card${isEmergency ? " card-emergency" : ""} cursor-pointer hover:shadow-md`}
                onClick={() => setSelectedRequest(req)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedRequest(req); }}
                aria-label={`View details for ${req.title}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex gap-2 items-center mb-2">
                      <PriorityBadge priority={req.priority} />
                      <MaintenanceStatusBadge status={req.status} />
                    </div>
                    <div className="font-poppins font-semibold text-charcoal text-lg">
                      {req.unit?.name ? `Unit ${req.unit.name} — ` : ""}
                      {req.title}
                    </div>
                    <p className="text-sm muted mt-1">
                      Raised by {req.raised_by?.name ?? "tenant"} · {formatDateTime(req.created_at)}
                    </p>
                  </div>
                  {req.assigned_to?.name && (
                    <span className="avatar" style={{ background: "#1565C0", flexShrink: 0 }}>
                      {req.assigned_to.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                    </span>
                  )}
                </div>

                <hr className="divider" />

                <p className="text-sm">{req.description.slice(0, 120)}{req.description.length > 120 ? "…" : ""}</p>

                <div className="flex gap-2 mt-4 flex-wrap">
                  {matchesStatus(req.status, "OPEN") && (
                    <button
                      type="button"
                      className="btn btn-primary !py-2 !text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssignModal({ requestId: String(req.id), requestTitle: req.title });
                      }}
                      aria-label={`Assign staff to "${req.title}"`}
                    >
                      Assign Staff
                    </button>
                  )}
                  {(matchesStatus(req.status, "ASSIGNED") || matchesStatus(req.status, "IN_PROGRESS")) && (
                    <button
                      type="button"
                      className="btn btn-secondary !py-2 !text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssignModal({ requestId: String(req.id), requestTitle: req.title });
                      }}
                      aria-label={`Reassign "${req.title}"`}
                    >
                      Reassign
                    </button>
                  )}
                  {matchesStatus(req.status, "RESOLVED") && (
                    <p className="text-xs muted self-center">
                      Awaiting tenant to close · PMs cannot close
                    </p>
                  )}
                </div>
                {/* No Close button — BL-21 */}
              </div>
            );
          })}
        </section>
      )}

      {/* Pagination */}
      {!loading && sortedFiltered.length > 0 && (
        <div className="mt-4">
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
            itemsOnPage={sortedFiltered.length}
            loading={loading}
          />
        </div>
      )}

      {/* Detail drawer */}
      {selectedRequest && !assignModal && (
        <RequestDetail
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onAssign={() => {
            setAssignModal({ requestId: String(selectedRequest.id), requestTitle: selectedRequest.title });
            setSelectedRequest(null);
          }}
        />
      )}

      {/* Assign modal */}
      {assignModal && (
        <AssignModal
          open={true}
          onClose={() => setAssignModal(null)}
          requestId={assignModal.requestId}
          requestTitle={assignModal.requestTitle}
          onSuccess={() => {
            setAssignModal(null);
            setRefetchKey((k) => k + 1);
            void fetchAllForCounts();
          }}
        />
      )}

      {/* Raise New Request — PM acts on behalf of tenants on their property. */}
      {showCreateModal && propertyId && (
        <PmCreateRequestModal
          open={true}
          onClose={() => setShowCreateModal(false)}
          propertyId={String(propertyId)}
          onSuccess={() => {
            setShowCreateModal(false);
            setRefetchKey((k) => k + 1);
            void fetchAllForCounts();
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// PM Create Request Modal — BL-16 deviation (user-approved 2026-05-13)
// ---------------------------------------------------------------------------

interface PmUnitOption {
  id: number | string;
  unit_number: string;
}

function PmCreateRequestModal({
  open,
  onClose,
  propertyId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  propertyId: string;
  onSuccess: () => void;
}) {
  const { apiFetch } = useAuth();
  const [units, setUnits] = useState<PmUnitOption[]>([]);
  const [serverError, setServerError] = useState<string>("");

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<CreateMaintenanceRequestInput>({
    resolver: zodResolver(CreateMaintenanceRequestSchema),
    defaultValues: { priority: "NORMAL", unitId: "" },
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<{ data?: PmUnitOption[]; items?: PmUnitOption[] }>(
          `/properties/${propertyId}/units?limit=200`,
        );
        if (cancelled) return;
        setUnits(res.data ?? res.items ?? []);
      } catch {
        if (!cancelled) setUnits([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, propertyId, apiFetch]);

  const description = watch("description") ?? "";

  async function onSubmit(data: CreateMaintenanceRequestInput) {
    setServerError("");
    try {
      await apiFetch("/maintenance-requests", {
        method: "POST",
        body: JSON.stringify({
          unitId: Number(data.unitId),
          title: data.title,
          description: data.description,
          priority: data.priority,
        }),
      });
      reset();
      onSuccess();
    } catch (err) {
      setServerError(friendlyError(err));
    }
  }

  const errorList: string[] = [];
  if (errors.unitId?.message) errorList.push(errors.unitId.message);
  if (errors.title?.message) errorList.push(errors.title.message);
  if (errors.description?.message) errorList.push(errors.description.message);
  if (errors.priority?.message) errorList.push(errors.priority.message);
  const showErrors = isSubmitted && (errorList.length > 0 || !!serverError);

  return (
    <Modal open={open} onClose={onClose} title="Raise New Maintenance Request" maxWidth="max-w-[600px]">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
        {showErrors && (
          <div role="alert" className="field-error show">
            <strong>Please fix the following:</strong>
            <ul className="list-disc pl-5 mt-1">
              {errorList.map((m, i) => <li key={i}>{m}</li>)}
              {serverError && <li>{serverError}</li>}
            </ul>
          </div>
        )}

        <Field id="pm-create-unitId" label="Unit" error={errors.unitId?.message}>
          <select id="pm-create-unitId" className="input" disabled={units.length === 0} {...register("unitId")}>
            <option value="">
              {units.length === 0 ? "— No units on this property —" : "— Select unit —"}
            </option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>Unit {u.unit_number}</option>
            ))}
          </select>
        </Field>

        <Field id="pm-create-title" label="Title" error={errors.title?.message}>
          <input
            id="pm-create-title"
            className="input"
            type="text"
            maxLength={120}
            placeholder="Leaking tap in kitchen"
            {...register("title")}
          />
        </Field>

        <div>
          <Field id="pm-create-description" label="Description (min 30 chars)" error={errors.description?.message}>
            <textarea
              id="pm-create-description"
              className="input"
              rows={4}
              placeholder="Describe the issue in at least 30 characters…"
              {...register("description")}
            />
          </Field>
          <div className={`text-xs mt-1 ${description.length < 30 ? "text-status-overdue" : "muted"}`}>
            {description.length} / 30 minimum
          </div>
        </div>

        <Field id="pm-create-priority" label="Priority">
          <select id="pm-create-priority" className="input" {...register("priority")}>
            <option value="LOW">LOW — cosmetic</option>
            <option value="NORMAL">NORMAL — needs fixing</option>
            <option value="HIGH">HIGH — affects daily use</option>
            <option value="EMERGENCY">EMERGENCY — water leak, electrical, security risk</option>
          </select>
        </Field>

        <div className="flex gap-3 justify-end mt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Raise Request"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
