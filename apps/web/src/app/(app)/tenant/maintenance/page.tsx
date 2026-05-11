"use client";

/**
 * Tenant Maintenance — My requests + raise new request.
 * 1:1 with prototype/tenant/maintenance.html.
 *
 * BL-16: only TENANT can raise; backend enforces, no Assign/In-Progress/Resolve buttons.
 * BL-21: only TENANT who raised can close. "Close Request" button on RESOLVED requests.
 */

import { useAuth } from "@/lib/auth/context";
import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { MaintenanceStatusBadge } from "@/components/maintenance/MaintenanceStatusBadge";
import { PriorityBadge } from "@/components/maintenance/PriorityBadge";
import { CharCounter } from "@/components/maintenance/CharCounter";
import { friendlyError } from "@/lib/api/errors";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateMaintenanceRequestSchema } from "@gharsetu/shared";
import type { CreateMaintenanceRequestInput, MaintenancePriorityValue, MaintenanceStatusValue } from "@gharsetu/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActiveLease {
  id: string;
  unit?: { id?: string; name?: string } | null;
  unit_id?: string;
}

interface LeasesResponse {
  data?: ActiveLease[];
  items?: ActiveLease[];
}

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  priority: MaintenancePriorityValue;
  status: MaintenanceStatusValue;
  resolution_notes?: string | null;
  assigned_to?: { name?: string } | null;
  created_at: string;
  resolved_at?: string | null;
  closed_at?: string | null;
}

interface RequestsResponse {
  data?: MaintenanceRequest[];
  items?: MaintenanceRequest[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try { return format(parseISO(iso), "dd/MM/yyyy"); } catch { return iso; }
}

const PRIORITY_OPTIONS: { value: MaintenancePriorityValue; label: string }[] = [
  { value: "LOW", label: "LOW — cosmetic" },
  { value: "NORMAL", label: "NORMAL — needs fixing" },
  { value: "HIGH", label: "HIGH — affects daily use" },
  { value: "EMERGENCY", label: "EMERGENCY — water leak, electrical, security risk" },
];

// ---------------------------------------------------------------------------
// Raise New Request Modal
// ---------------------------------------------------------------------------

interface RaiseRequestModalProps {
  open: boolean;
  onClose: () => void;
  defaultUnitId: string;
  unitName?: string;
  onSuccess: () => void;
}

function RaiseRequestModal({
  open,
  onClose,
  defaultUnitId,
  unitName,
  onSuccess,
}: RaiseRequestModalProps) {
  const { apiFetch } = useAuth();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CreateMaintenanceRequestInput>({
    resolver: zodResolver(CreateMaintenanceRequestSchema),
    defaultValues: {
      unitId: defaultUnitId,
      priority: "NORMAL",
    },
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const descriptionValue = watch("description") ?? "";

  useEffect(() => {
    if (open) {
      reset({ unitId: defaultUnitId, priority: "NORMAL" });
      setSubmitError(null);
    }
  }, [open, reset, defaultUnitId]);

  async function onSubmit(data: CreateMaintenanceRequestInput) {
    setSubmitError(null);
    try {
      await apiFetch("/maintenance-requests", {
        method: "POST",
        body: JSON.stringify({
          unitId: data.unitId,
          title: data.title,
          description: data.description,
          priority: data.priority,
        }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setSubmitError(friendlyError(err));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Raise New Request" maxWidth="max-w-[560px]">
      <p className="text-sm muted mt-1 mb-5">
        Tell us what&apos;s wrong. Your Property Manager will see it immediately.
      </p>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        {/* Unit display (auto-filled, read-only for single-lease tenants) */}
        <div className="mb-4">
          <label className="label" htmlFor="raise-unit">Unit</label>
          <input
            id="raise-unit"
            className="input"
            value={unitName ?? defaultUnitId}
            readOnly
            aria-readonly="true"
          />
          <input type="hidden" {...register("unitId")} />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field id="raise-title" label="Title" error={errors.title?.message}>
            <input
              className="input"
              type="text"
              placeholder="e.g. Water leakage in kitchen"
              maxLength={120}
              {...register("title")}
            />
          </Field>

          <div>
            <label className="label" htmlFor="raise-priority">Priority</label>
            <select
              id="raise-priority"
              className="input"
              {...register("priority")}
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {errors.priority && (
              <div className="field-error show">{errors.priority.message}</div>
            )}
          </div>
        </div>

        <Field
          id="raise-description"
          label="Describe the issue (min 30 characters)"
          error={errors.description?.message}
        >
          <textarea
            className="input"
            rows={4}
            placeholder="e.g. The kitchen tap has been leaking since yesterday morning. Water is collecting on the floor."
            {...register("description")}
          />
        </Field>
        <CharCounter current={descriptionValue.length} min={30} />

        <p className="text-xs muted mt-2">
          A clear description helps the maintenance team come prepared with the right tools.
        </p>

        {submitError && <div className="field-error show mt-3">{submitError}</div>}

        <div className="flex justify-end gap-3 mt-6">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || descriptionValue.length < 30}
          >
            {isSubmitting ? "Submitting…" : "Submit Request"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TenantMaintenancePage() {
  const { user, apiFetch } = useAuth();

  const [lease, setLease] = useState<ActiveLease | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [closeLoading, setCloseLoading] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [leasesRes, requestsRes] = await Promise.allSettled([
        apiFetch<LeasesResponse>(`/leases?tenantId=${user.id}&status=ACTIVE&limit=1`),
        apiFetch<RequestsResponse>(`/maintenance-requests?limit=50`),
      ]);

      if (leasesRes.status === "fulfilled") {
        const leases = leasesRes.value.data ?? leasesRes.value.items ?? [];
        setLease(leases[0] ?? null);
      }
      if (requestsRes.status === "fulfilled") {
        const items = requestsRes.value.data ?? requestsRes.value.items ?? (Array.isArray(requestsRes.value) ? requestsRes.value as MaintenanceRequest[] : []);
        // Sort: open first, then by created_at desc
        items.sort((a, b) => {
          const STATUS_ORDER: Record<MaintenanceStatusValue, number> = {
            IN_PROGRESS: 0, ASSIGNED: 1, OPEN: 2, RESOLVED: 3, CLOSED: 4,
          };
          const diff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
          if (diff !== 0) return diff;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setRequests(items);
      }
    } finally {
      setLoading(false);
    }
  }, [user, apiFetch]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  async function handleClose(requestId: string) {
    setCloseLoading(requestId);
    setCloseError(null);
    try {
      await apiFetch(`/maintenance-requests/${requestId}/close`, { method: "POST" });
      await fetchData();
    } catch (err) {
      setCloseError(friendlyError(err));
    } finally {
      setCloseLoading(null);
    }
  }

  const unitId = lease?.unit?.id ?? lease?.unit_id ?? "";
  const unitName = lease?.unit?.name ? `Unit ${lease.unit.name}` : undefined;
  const propertySubtitle = unitName ?? "No active lease";

  if (loading) {
    return (
      <>
        <header className="topbar">
          <div>
            <h1 className="page-title">My Maintenance Requests</h1>
            <div className="page-subtitle">Loading…</div>
          </div>
        </header>
        <div className="grid gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-light-gray rounded w-2/3 mb-3" />
              <div className="h-4 bg-light-gray rounded w-1/2" />
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">My Maintenance Requests</h1>
          <div className="page-subtitle">{propertySubtitle}</div>
        </div>
        {/* Raise new request — TENANT only; BL-16 enforced by backend too */}
        {unitId && (
          <button
            type="button"
            className="btn btn-primary !py-2 !text-sm"
            onClick={() => setShowRaiseModal(true)}
          >
            + Raise New Request
          </button>
        )}
      </header>

      {closeError && <div className="field-error show mb-4">{closeError}</div>}

      {requests.length === 0 ? (
        <div className="card">
          <p className="text-charcoal font-poppins font-semibold">No maintenance requests yet.</p>
          <p className="text-sm muted mt-1">
            {unitId
              ? "Raise a new request using the button above."
              : "You need an active lease before you can raise maintenance requests."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map((req) => {
            const isEmergency = req.priority === "EMERGENCY";

            return (
              <section
                key={req.id}
                className={`card${isEmergency ? " card-emergency" : ""} mb-4`}
              >
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex gap-2 mb-2 flex-wrap">
                      <PriorityBadge priority={req.priority} />
                      <MaintenanceStatusBadge status={req.status} />
                    </div>
                    <h3>{req.title}</h3>
                    <p className="text-sm muted mt-1">
                      Raised {formatDate(req.created_at)}
                      {req.resolved_at ? ` · Resolved ${formatDate(req.resolved_at)}` : ""}
                      {req.closed_at ? ` · Closed ${formatDate(req.closed_at)}` : ""}
                    </p>
                    {req.assigned_to?.name && (
                      <p className="text-sm mt-3">
                        Assigned to: <strong className="text-charcoal">{req.assigned_to.name}</strong>
                      </p>
                    )}
                    {req.status === "RESOLVED" && req.resolution_notes && (
                      <p className="text-sm mt-3">
                        <strong className="text-charcoal">Resolution:</strong> {req.resolution_notes}
                      </p>
                    )}
                    {req.status === "CLOSED" && (
                      <p className="text-sm mt-3">
                        No further action available. Closed requests cannot be reopened — if the same issue returns, please raise a new request.
                      </p>
                    )}
                  </div>
                </div>

                {/* BL-21: Close only for RESOLVED requests, TENANT only */}
                {req.status === "RESOLVED" && (
                  <>
                    <hr className="divider" />
                    <p className="text-sm muted mb-3">
                      Are you happy with the resolution? Closing the request confirms the issue is fixed.
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-primary !py-2 !text-sm"
                        onClick={() => void handleClose(req.id)}
                        disabled={closeLoading === req.id}
                        aria-label={`Close request "${req.title}"`}
                      >
                        {closeLoading === req.id ? "Closing…" : "Close Request"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary !py-2 !text-sm"
                        onClick={() => setShowRaiseModal(true)}
                        disabled={!unitId}
                      >
                        Issue not fully fixed
                      </button>
                    </div>
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}

      {showRaiseModal && unitId && (
        <RaiseRequestModal
          open={showRaiseModal}
          onClose={() => setShowRaiseModal(false)}
          defaultUnitId={unitId}
          unitName={unitName}
          onSuccess={() => void fetchData()}
        />
      )}
    </>
  );
}
