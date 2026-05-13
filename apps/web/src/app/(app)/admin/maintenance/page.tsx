"use client";

/**
 * Admin Maintenance overview — All properties, BL-17 alert surface.
 * 1:1 with prototype/admin/maintenance.html.
 *
 * BL-17: Shows alerts for tenants with 5+ requests in calendar month.
 * EmergencyBanner active.
 * Admin close-button policy: NOT rendered — backend returns 403 from BL-21,
 * and the prototype shows no close button on admin view. Omitted entirely per
 * "don't render greyed-out controls for actions a role cannot perform" rule.
 */

import { useAuth } from "@/lib/auth/context";
import { useCallback, useEffect, useState } from "react";
import { parseISO } from "date-fns";
import { Pagination } from "@/components/ui/Pagination";
import { usePaginatedList } from "@/lib/pagination/usePaginatedList";
import { formatDateIST } from "@/lib/locale";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { MaintenanceStatusBadge } from "@/components/maintenance/MaintenanceStatusBadge";
import { PriorityBadge } from "@/components/maintenance/PriorityBadge";
import { EmergencyBanner } from "@/components/maintenance/EmergencyBanner";
import { friendlyError } from "@/lib/api/errors";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DismissAlertSchema, MaintenanceStatusCodes, MaintenancePriorityCodes, CreateMaintenanceRequestSchema } from "@gharsetu/shared";
import type { DismissAlertInput, CreateMaintenanceRequestInput } from "@gharsetu/shared";
import { SkeletonKpi } from "@/components/ui/Skeleton";

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
  // API returns Unit with unit_number; legacy responses used `name`.
  unit?: { unit_number?: string; name?: string } | null;
  property?: { name?: string } | null;
  raised_by?: { name?: string } | null;
  assigned_to?: { name?: string } | null;
  created_at: string;
}

interface MaintenanceStaff {
  id: number | string;
  name: string;
  email?: string;
}

interface StaffResponse {
  data?: MaintenanceStaff[];
  items?: MaintenanceStaff[];
}

interface RequestsResponse {
  data?: MaintenanceRequest[];
  items?: MaintenanceRequest[];
  meta?: { total?: number };
}

interface MaintenanceAlert {
  id: string;
  tenant?: { name?: string } | null;
  unit?: { name?: string } | null;
  property?: { name?: string } | null;
  request_count: number;
  month?: string | null;
  dismissed_at?: string | null;
}

interface AlertsResponse {
  data?: MaintenanceAlert[];
  items?: MaintenanceAlert[];
}

interface Property {
  id: string;
  name: string;
}

interface PropertiesResponse {
  data?: Property[];
  items?: Property[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string | null | undefined): string {
  return formatDateIST(iso);
}

type PriorityFilter = "ALL" | "EMERGENCY" | "HIGH" | "NORMAL" | "LOW";
type StatusFilter = "ALL" | "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

function isActiveOpenStatus(s: number | string): boolean {
  return typeof s === "number"
    ? s === MaintenanceStatusCodes.OPEN || s === MaintenanceStatusCodes.ASSIGNED || s === MaintenanceStatusCodes.IN_PROGRESS
    : s === "OPEN" || s === "ASSIGNED" || s === "IN_PROGRESS";
}

function matchesPriorityAdmin(p: number | string, f: PriorityFilter): boolean {
  if (f === "ALL") return true;
  if (typeof p === "number") {
    const map: Record<string, number> = { EMERGENCY: MaintenancePriorityCodes.EMERGENCY, HIGH: MaintenancePriorityCodes.HIGH, NORMAL: MaintenancePriorityCodes.NORMAL, LOW: MaintenancePriorityCodes.LOW };
    return p === map[f];
  }
  return p === f;
}

function matchesStatusAdmin(s: number | string, f: StatusFilter): boolean {
  if (f === "ALL") return true;
  if (typeof s === "number") {
    const map: Record<string, number> = { OPEN: MaintenanceStatusCodes.OPEN, ASSIGNED: MaintenanceStatusCodes.ASSIGNED, IN_PROGRESS: MaintenanceStatusCodes.IN_PROGRESS, RESOLVED: MaintenanceStatusCodes.RESOLVED, CLOSED: MaintenanceStatusCodes.CLOSED };
    return s === map[f];
  }
  return s === f;
}

// ---------------------------------------------------------------------------
// Dismiss Alert Modal
// ---------------------------------------------------------------------------

function DismissAlertModal({
  open,
  onClose,
  alert,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  alert: MaintenanceAlert;
  onSuccess: () => void;
}) {
  const { apiFetch } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
    reset,
  } = useForm<DismissAlertInput>({
    resolver: zodResolver(DismissAlertSchema),
    defaultValues: { alertId: alert.id },
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { reset({ alertId: alert.id }); setSubmitError(null); }
  }, [open, reset, alert.id]);

  async function onSubmit(data: DismissAlertInput) {
    setSubmitError(null);
    try {
      await apiFetch("/maintenance-requests/dismiss-alert", {
        method: "POST",
        body: JSON.stringify({ alertId: data.alertId, note: data.note || undefined }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setSubmitError(friendlyError(err));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Dismiss Alert" maxWidth="max-w-[480px]">
      <p className="text-sm muted mt-1 mb-4">
        <strong className="text-charcoal">
          {alert.tenant?.name ?? "Tenant"} · {alert.unit?.name ? `Unit ${alert.unit.name}` : "—"}
        </strong>
        <br />
        {alert.request_count} requests
        {alert.month ? ` in ${alert.month}` : " this month"}.
        This alert will be marked as dismissed.
      </p>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <input type="hidden" {...register("alertId")} />
        <Field id="dismiss-note" label="Note (optional)" error={undefined}>
          <textarea
            className="input"
            rows={3}
            placeholder="Add a note about why this is being dismissed…"
            {...register("note")}
          />
        </Field>
        {submitError && <div className="field-error show mt-3">{submitError}</div>}
        <div className="flex justify-end gap-3 mt-6">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary !py-2 !text-sm" disabled={isSubmitting}>
            {isSubmitting ? "Dismissing…" : "Dismiss Alert"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminMaintenancePage() {
  const { apiFetch } = useAuth();

  // KPI data — separate fetch for aggregates/counts
  const [allRequests, setAllRequests] = useState<MaintenanceRequest[]>([]);
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [propertyFilter, setPropertyFilter] = useState<string>("ALL");
  const [tableRefetchKey, setTableRefetchKey] = useState(0);

  const [dismissAlert, setDismissAlert] = useState<MaintenanceAlert | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [assignFor, setAssignFor] = useState<{ id: string; title: string } | null>(null);

  // KPI + alerts + properties fetch
  const fetchData = useCallback(async () => {
    setKpiLoading(true);
    setError(null);
    try {
      const [reqRes, alertRes, propRes] = await Promise.allSettled([
        apiFetch<RequestsResponse>("/maintenance-requests?limit=200"),
        apiFetch<AlertsResponse>("/maintenance-requests/alerts"),
        apiFetch<PropertiesResponse>("/properties?limit=100"),
      ]);

      if (reqRes.status === "fulfilled") {
        const items = reqRes.value.data ?? reqRes.value.items ?? (Array.isArray(reqRes.value) ? (reqRes.value as MaintenanceRequest[]) : []);
        setAllRequests(items);
      }
      if (alertRes.status === "fulfilled") {
        const items = alertRes.value.data ?? alertRes.value.items ?? (Array.isArray(alertRes.value) ? (alertRes.value as MaintenanceAlert[]) : []);
        setAlerts(items.filter((a) => !a.dismissed_at));
      }
      if (propRes.status === "fulfilled") {
        const items = propRes.value.data ?? propRes.value.items ?? (Array.isArray(propRes.value) ? (propRes.value as Property[]) : []);
        setProperties(items);
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setKpiLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  // Paginated table
  const tableExtraQuery: Record<string, string | undefined> = {};
  if (priorityFilter !== "ALL") tableExtraQuery.priority = priorityFilter;
  if (statusFilter !== "ALL") tableExtraQuery.status = statusFilter;
  if (propertyFilter !== "ALL") tableExtraQuery.property = propertyFilter;

  const {
    items: tableRequests,
    page,
    totalPages,
    total,
    pageSize: activePageSize,
    hasNext,
    hasPrev,
    loading: tableLoading,
    next,
    prev,
    goToPage,
  } = usePaginatedList<MaintenanceRequest>({
    url: "/maintenance-requests",
    extraQuery: tableExtraQuery,
    pageSize: 10,
    refetchKey: tableRefetchKey,
  });

  const loading = kpiLoading;

  // KPI counts from allRequests (full dataset)
  const emergencyCount = allRequests.filter((r) => matchesPriorityAdmin(r.priority, "EMERGENCY") && isActiveOpenStatus(r.status)).length;
  const highCount = allRequests.filter((r) => matchesPriorityAdmin(r.priority, "HIGH") && isActiveOpenStatus(r.status)).length;
  const openTotal = allRequests.filter((r) => isActiveOpenStatus(r.status)).length;
  const resolved7d = allRequests.filter((r) => {
    if (!matchesStatusAdmin(r.status, "RESOLVED")) return false;
    try {
      const d = parseISO(r.created_at);
      const diff = (Date.now() - d.getTime()) / 86400000;
      return diff <= 7;
    } catch { return false; }
  }).length;

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Maintenance</h1>
          <div className="page-subtitle">All requests across {properties.length} properties</div>
        </div>
        {/* BL-16: Admin can raise on behalf (backend @Roles('TENANT', 'ADMIN')). */}
        <button
          type="button"
          className="btn btn-primary !py-2 !text-sm"
          onClick={() => setShowCreateModal(true)}
        >
          + New Request
        </button>
      </header>

      {/* KPIs */}
      <section className="section">
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
              <div className="kpi">
                <div className="kpi-label">Emergency</div>
                <div className="kpi-value" style={{ color: "var(--color-status-overdue)" }}>{emergencyCount}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">High</div>
                <div className="kpi-value">{highCount}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Open total</div>
                <div className="kpi-value">{openTotal}</div>
              </div>
              <div className="kpi">
                <div className="kpi-label">Resolved (7d)</div>
                <div className="kpi-value" style={{ color: "var(--color-status-paid)" }}>{resolved7d}</div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* BL-17 Alert surface */}
      {alerts.length > 0 && (
        <section className="mb-6">
          <h2 className="section-title">Abuse Alerts (BL-17)</h2>
          <div className="grid gap-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="alert"
                role="alert"
              >
                <div className="flex-1">
                  <strong className="font-poppins">
                    {alert.tenant?.name ?? "Tenant"} · {alert.unit?.name ? `Unit ${alert.unit.name}` : "—"}
                  </strong>
                  <div>
                    {alert.request_count} maintenance requests
                    {alert.month ? ` in ${alert.month}` : " this calendar month"}.
                    {alert.property?.name ? ` · ${alert.property.name}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary !py-2 !text-sm flex-shrink-0"
                  onClick={() => setDismissAlert(alert)}
                  aria-label={`Dismiss alert for ${alert.tenant?.name ?? "tenant"}`}
                >
                  Dismiss
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Emergency banner */}
      <EmergencyBanner requests={allRequests} />

      {error && <div className="field-error show mb-4">{error}</div>}

      {/* Filters */}
      <section className="card mb-6">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="label" htmlFor="admin-prop-filter">Property</label>
            <select
              id="admin-prop-filter"
              className="input"
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              {properties.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="admin-prio-filter">Priority</label>
            <select
              id="admin-prio-filter"
              className="input"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
            >
              <option value="ALL">Any</option>
              <option value="EMERGENCY">Emergency</option>
              <option value="HIGH">High</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="admin-stat-filter">Status</label>
            <select
              id="admin-stat-filter"
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="ALL">Any</option>
              <option value="OPEN">Open</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In-Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
        </div>
      </section>

      {/* Requests table */}
      {tableLoading ? (
        <div className="card animate-pulse h-48" />
      ) : tableRequests.length === 0 ? (
        <div className="card">
          <p className="text-charcoal font-poppins font-semibold">No requests match the current filters.</p>
        </div>
      ) : (
        <section className="card p-0 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Unit</th>
                <th>Issue</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Raised</th>
                <th>Assigned</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableRequests.map((req) => {
                const unitLabel = req.unit?.unit_number ?? req.unit?.name ?? "—";
                const isOpenStatus = isActiveOpenStatus(req.status);
                const canAssign =
                  typeof req.status === "number"
                    ? req.status === MaintenanceStatusCodes.OPEN
                    : req.status === "OPEN";
                return (
                  <tr key={req.id}>
                    <td className="font-poppins font-semibold text-charcoal whitespace-nowrap">
                      {unitLabel !== "—" ? `Unit ${unitLabel}` : "—"}
                      {req.property?.name ? ` · ${req.property.name}` : ""}
                    </td>
                    <td>{req.title}</td>
                    <td><PriorityBadge priority={req.priority} /></td>
                    <td><MaintenanceStatusBadge status={req.status} /></td>
                    <td className="whitespace-nowrap">{formatDateTime(req.created_at)}</td>
                    <td>{req.assigned_to?.name ?? <span className="muted">—</span>}</td>
                    <td className="text-right whitespace-nowrap">
                      {canAssign ? (
                        <button
                          type="button"
                          className="btn btn-secondary !py-1 !px-3 !text-xs"
                          onClick={() => setAssignFor({ id: String(req.id), title: req.title })}
                        >
                          Assign
                        </button>
                      ) : isOpenStatus ? (
                        <span className="muted text-xs">In progress</span>
                      ) : (
                        <span className="muted text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
            itemsOnPage={tableRequests.length}
            loading={tableLoading}
          />
        </section>
      )}

      <p className="text-xs muted mt-4">
        Maintenance staff can <strong>read and update</strong> existing requests but cannot create them. Closed requests cannot be reopened.
      </p>

      {/* Dismiss alert modal */}
      {dismissAlert && (
        <DismissAlertModal
          open={true}
          onClose={() => setDismissAlert(null)}
          alert={dismissAlert}
          onSuccess={() => {
            setDismissAlert(null);
            void fetchData();
          }}
        />
      )}

      {/* Create request modal — Admin can raise on behalf of tenants. */}
      {showCreateModal && (
        <CreateRequestModal
          open={true}
          onClose={() => setShowCreateModal(false)}
          properties={properties}
          onSuccess={() => {
            setShowCreateModal(false);
            void fetchData();
            setTableRefetchKey((k) => k + 1);
          }}
        />
      )}

      {/* Assign-staff modal — Admin assigns OPEN requests to maintenance staff. */}
      {assignFor && (
        <AssignStaffModal
          open={true}
          onClose={() => setAssignFor(null)}
          requestId={assignFor.id}
          requestTitle={assignFor.title}
          onSuccess={() => {
            setAssignFor(null);
            void fetchData();
            setTableRefetchKey((k) => k + 1);
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Assign Staff Modal (Admin only — POST /maintenance-requests/:id/assign)
// ---------------------------------------------------------------------------

function AssignStaffModal({
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
  const [staff, setStaff] = useState<MaintenanceStaff[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [assigneeUserId, setAssigneeUserId] = useState<string>("");
  const [serverError, setServerError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingStaff(true);
    setAssigneeUserId("");
    setServerError("");
    apiFetch<StaffResponse>("/users?role=MAINTENANCE&is_active=true&limit=100")
      .then((res) => {
        const items = res.data ?? res.items ?? (Array.isArray(res) ? (res as MaintenanceStaff[]) : []);
        setStaff(items);
      })
      .catch(() => setStaff([]))
      .finally(() => setLoadingStaff(false));
  }, [open, apiFetch]);

  async function handleAssign() {
    setServerError("");
    if (!assigneeUserId) {
      setServerError("Pick a maintenance staff member.");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/maintenance-requests/${requestId}/assign`, {
        method: "POST",
        body: JSON.stringify({ assigneeUserId: Number(assigneeUserId) }),
      });
      onSuccess();
    } catch (err) {
      setServerError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Assign Maintenance Staff" maxWidth="max-w-[480px]">
      <p className="text-sm muted mt-1 mb-4">
        <strong className="text-charcoal">{requestTitle}</strong>
        <br />
        Select a maintenance staff member to assign this request to.
      </p>
      {loadingStaff ? (
        <div className="text-slate text-sm">Loading staff…</div>
      ) : staff.length === 0 ? (
        <div className="field-error show">No active maintenance staff found. Add one in Users.</div>
      ) : (
        <Field id="assigneeUserId" label="Maintenance Staff">
          <select
            id="assigneeUserId"
            className="input"
            value={assigneeUserId}
            onChange={(e) => setAssigneeUserId(e.target.value)}
          >
            <option value="">— Select staff member —</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.email ? ` (${s.email})` : ""}
              </option>
            ))}
          </select>
        </Field>
      )}
      {serverError && <div className="field-error show mt-3">{serverError}</div>}
      <div className="flex justify-end gap-3 mt-6">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={submitting || loadingStaff || staff.length === 0}
          onClick={() => void handleAssign()}
        >
          {submitting ? "Assigning…" : "Assign"}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Create Request Modal (Admin only — BL-16 backend allows ADMIN on-behalf)
// ---------------------------------------------------------------------------

interface UnitOption {
  id: number | string;
  unit_number: string;
  state?: number | string;
}

interface CreateRequestModalProps {
  open: boolean;
  onClose: () => void;
  properties: Property[];
  onSuccess: () => void;
}

function CreateRequestModal({ open, onClose, properties, onSuccess }: CreateRequestModalProps) {
  const { apiFetch } = useAuth();
  const [propertyId, setPropertyId] = useState<string>("");
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [serverError, setServerError] = useState<string>("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting, isSubmitted },
  } = useForm<CreateMaintenanceRequestInput>({
    resolver: zodResolver(CreateMaintenanceRequestSchema),
    defaultValues: { priority: "NORMAL", unitId: "" },
  });

  // Keep unitId in sync with the form (registered) so zod validation can see it
  const unitId = watch("unitId");

  // Fetch units for the selected property
  useEffect(() => {
    if (!propertyId) {
      setUnits([]);
      setValue("unitId", "");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<{ data?: UnitOption[]; items?: UnitOption[] }>(
          `/properties/${propertyId}/units?limit=200`,
        );
        if (cancelled) return;
        const items = res.data ?? res.items ?? [];
        setUnits(items);
        // Reset chosen unit whenever property changes
        setValue("unitId", "");
      } catch {
        if (!cancelled) setUnits([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId, apiFetch, setValue]);

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
      setPropertyId("");
      onSuccess();
    } catch (err) {
      setServerError(friendlyError(err));
    }
  }

  // Summary of all visible validation errors — shown at the top of the form
  // so the admin can't miss them when the unit dropdown obscures fields.
  const errorList: string[] = [];
  if (!propertyId) errorList.push("Pick a property.");
  if (errors.unitId?.message) errorList.push(errors.unitId.message);
  if (errors.title?.message) errorList.push(errors.title.message);
  if (errors.description?.message) errorList.push(errors.description.message);
  if (errors.priority?.message) errorList.push(errors.priority.message);
  const hasErrors = isSubmitted && (errorList.length > 0 || !!serverError);

  return (
    <Modal open={open} onClose={onClose} title="Raise New Maintenance Request" maxWidth="max-w-[640px]">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
        {/* Form-level error summary so missing fields are never hidden
            behind an open dropdown. */}
        {hasErrors && (
          <div role="alert" className="field-error show">
            <strong>Please fix the following:</strong>
            <ul className="list-disc pl-5 mt-1">
              {errorList.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
              {serverError && <li>{serverError}</li>}
            </ul>
          </div>
        )}

        <Field id="propertyId" label="Property">
          <select
            id="propertyId"
            className="input"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
          >
            <option value="">— Select property —</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field id="unitId" label="Unit" error={errors.unitId?.message}>
          <select
            id="unitId"
            className="input"
            disabled={!propertyId || units.length === 0}
            {...register("unitId")}
          >
            <option value="">
              {propertyId
                ? units.length === 0
                  ? "— No units on this property —"
                  : "— Select unit —"
                : "— Pick a property first —"}
            </option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                Unit {u.unit_number}
              </option>
            ))}
          </select>
        </Field>

        <Field id="title" label="Title" error={errors.title?.message}>
          <input
            id="title"
            className="input"
            type="text"
            maxLength={120}
            placeholder="Leaking tap in kitchen"
            {...register("title")}
          />
        </Field>

        <div>
          <Field id="description" label="Description (min 30 chars)" error={errors.description?.message}>
            <textarea
              id="description"
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

        <Field id="priority" label="Priority">
          <select id="priority" className="input" {...register("priority")}>
            <option value="LOW">LOW — cosmetic</option>
            <option value="NORMAL">NORMAL — needs fixing</option>
            <option value="HIGH">HIGH — affects daily use</option>
            <option value="EMERGENCY">EMERGENCY — water leak, electrical, security risk</option>
          </select>
        </Field>

        {serverError && (
          <div role="alert" className="field-error show">{serverError}</div>
        )}

        <div className="flex gap-3 justify-end mt-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? "Submitting…" : "Raise Request"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
