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
import { format, parseISO } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { MaintenanceStatusBadge } from "@/components/maintenance/MaintenanceStatusBadge";
import { PriorityBadge } from "@/components/maintenance/PriorityBadge";
import { EmergencyBanner } from "@/components/maintenance/EmergencyBanner";
import { friendlyError } from "@/lib/api/errors";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DismissAlertSchema } from "@gharsetu/shared";
import type { DismissAlertInput, MaintenancePriorityValue, MaintenanceStatusValue } from "@gharsetu/shared";
import { SkeletonKpi } from "@/components/ui/Skeleton";

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
  property?: { name?: string } | null;
  raised_by?: { name?: string } | null;
  assigned_to?: { name?: string } | null;
  created_at: string;
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
  if (!iso) return "—";
  try { return format(parseISO(iso), "dd/MM/yyyy HH:mm"); } catch { return iso; }
}

type PriorityFilter = MaintenancePriorityValue | "ALL";
type StatusFilter = MaintenanceStatusValue | "ALL";

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

  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [alerts, setAlerts] = useState<MaintenanceAlert[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [propertyFilter, setPropertyFilter] = useState<string>("ALL");

  const [dismissAlert, setDismissAlert] = useState<MaintenanceAlert | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqRes, alertRes, propRes] = await Promise.allSettled([
        apiFetch<RequestsResponse>("/maintenance-requests?limit=200"),
        apiFetch<AlertsResponse>("/maintenance-requests/alerts"),
        apiFetch<PropertiesResponse>("/properties?limit=100"),
      ]);

      if (reqRes.status === "fulfilled") {
        const items = reqRes.value.data ?? reqRes.value.items ?? (Array.isArray(reqRes.value) ? (reqRes.value as MaintenanceRequest[]) : []);
        setRequests(items);
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
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const filtered = requests.filter((r) => {
    if (priorityFilter !== "ALL" && r.priority !== priorityFilter) return false;
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (propertyFilter !== "ALL" && r.property?.name !== propertyFilter) return false;
    return true;
  });

  // KPI counts
  const emergencyCount = requests.filter((r) => r.priority === "EMERGENCY" && ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(r.status)).length;
  const highCount = requests.filter((r) => r.priority === "HIGH" && ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(r.status)).length;
  const openTotal = requests.filter((r) => ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(r.status)).length;
  const resolved7d = requests.filter((r) => {
    if (r.status !== "RESOLVED") return false;
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
      <EmergencyBanner requests={requests} />

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
      {loading ? (
        <div className="card animate-pulse h-48" />
      ) : filtered.length === 0 ? (
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
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => (
                <tr key={req.id}>
                  <td className="font-poppins font-semibold text-charcoal whitespace-nowrap">
                    {req.unit?.name ?? "—"}
                    {req.property?.name ? ` · ${req.property.name}` : ""}
                  </td>
                  <td>{req.title}</td>
                  <td><PriorityBadge priority={req.priority} /></td>
                  <td><MaintenanceStatusBadge status={req.status} /></td>
                  <td className="whitespace-nowrap">{formatDateTime(req.created_at)}</td>
                  <td>{req.assigned_to?.name ?? <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
    </>
  );
}
