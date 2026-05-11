"use client";

/**
 * Maintenance Staff — My Assigned Requests.
 * 1:1 with prototype/maintenance/dashboard.html.
 *
 * BL-16: no "New Request" button anywhere on this page.
 * BL-21: no "Close" button — only tenants can close.
 * MAINTENANCE role can only act on their own assignments (NOT_YOUR_ASSIGNMENT guard on API).
 */

import { useAuth } from "@/lib/auth/context";
import { useCallback, useEffect, useState } from "react";
import { formatDateOnlyIST } from "@/lib/locale";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { MaintenanceStatusBadge } from "@/components/maintenance/MaintenanceStatusBadge";
import { PriorityBadge } from "@/components/maintenance/PriorityBadge";
import { CharCounter } from "@/components/maintenance/CharCounter";
import { friendlyError } from "@/lib/api/errors";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ResolveMaintenanceSchema } from "@gharsetu/shared";
import type { ResolveMaintenanceInput, MaintenanceStatusValue } from "@gharsetu/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "EMERGENCY";
  status: MaintenanceStatusValue;
  unit?: { name?: string } | null;
  property?: { name?: string; address?: string } | null;
  raised_by?: { name?: string } | null;
  assigned_to?: { name?: string } | null;
  assigned_at?: string | null;
  in_progress_at?: string | null;
  resolved_at?: string | null;
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
  return formatDateOnlyIST(iso);
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ---------------------------------------------------------------------------
// Resolve modal
// ---------------------------------------------------------------------------

function ResolveModal({
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
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ResolveMaintenanceInput>({
    resolver: zodResolver(ResolveMaintenanceSchema),
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const notesValue = watch("resolutionNotes") ?? "";

  useEffect(() => {
    if (open) { reset(); setSubmitError(null); }
  }, [open, reset]);

  async function onSubmit(data: ResolveMaintenanceInput) {
    setSubmitError(null);
    try {
      await apiFetch(`/maintenance-requests/${requestId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolutionNotes: data.resolutionNotes }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setSubmitError(friendlyError(err));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Mark Resolved" maxWidth="max-w-[560px]">
      <p className="text-sm muted mt-1 mb-4">
        <strong className="text-charcoal">{requestTitle}</strong>
        <br />
        Describe what was fixed and how it was tested.
      </p>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <Field id="resolutionNotes" label="Resolution notes (min 20 characters)" error={errors.resolutionNotes?.message}>
          <textarea
            className="input"
            rows={4}
            placeholder="Describe what was fixed and how it was tested."
            {...register("resolutionNotes")}
          />
        </Field>
        <CharCounter current={notesValue.length} min={20} />
        {submitError && <div className="field-error show mt-3">{submitError}</div>}
        <div className="flex justify-end gap-3 mt-6">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            className="btn btn-primary !py-2 !text-sm"
            disabled={isSubmitting || notesValue.length < 20}
          >
            {isSubmitting ? "Submitting…" : "Mark Resolved"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MaintenanceDashboardPage() {
  const { user, apiFetch } = useAuth();

  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resolveModal, setResolveModal] = useState<{
    requestId: string;
    requestTitle: string;
  } | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<ListResponse>(
        `/maintenance-requests?assignedToUserId=${user.id}&limit=50`,
      );
      const items = res.data ?? res.items ?? (Array.isArray(res) ? (res as MaintenanceRequest[]) : []);
      // Show non-closed requests sorted by priority
      const active = items.filter((r) => r.status !== "CLOSED");
      const PRIORITY_ORDER = { EMERGENCY: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
      active.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99));
      setRequests(active);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, [user, apiFetch]);

  useEffect(() => { void fetchRequests(); }, [fetchRequests]);

  async function handleStartRequest(requestId: string) {
    setActionLoading(requestId);
    setActionError(null);
    try {
      await apiFetch(`/maintenance-requests/${requestId}/in-progress`, { method: "POST" });
      await fetchRequests();
    } catch (err) {
      setActionError(friendlyError(err));
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <>
        <header className="topbar">
          <div>
            <h1 className="page-title">My Assigned Requests</h1>
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
          <h1 className="page-title">My Assigned Requests</h1>
          <div className="page-subtitle">
            {requests.length} active · sorted by priority
          </div>
        </div>
        <div className="topbar-user">
          <span className="hidden md:inline">{user?.name}</span>
          <span className="avatar" aria-hidden="true">
            {user?.name ? initials(user.name) : "—"}
          </span>
        </div>
      </header>

      {/* Role information banner — no new request allowed */}
      <div className="alert mb-6" role="note">
        <div>
          <strong className="font-poppins">You can read &amp; update existing requests.</strong>
          <div>You cannot create new requests, see rent or lease information, or view tenant financial data.</div>
        </div>
      </div>

      {error && <div className="field-error show mb-4">{error}</div>}
      {actionError && <div className="field-error show mb-4">{actionError}</div>}

      {requests.length === 0 ? (
        <div className="card">
          <p className="text-charcoal font-poppins font-semibold">No active assignments.</p>
          <p className="text-sm muted mt-1">When the PM assigns a request to you, it will appear here.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {requests.map((req) => {
            const isEmergency = req.priority === "EMERGENCY";
            const property = req.property?.name
              ? `${req.property.name}${req.property.address ? ", " + req.property.address : ""}`
              : null;

            return (
              <section
                key={req.id}
                className={`card${isEmergency ? " card-emergency" : ""}`}
              >
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex gap-2 mb-2 flex-wrap">
                      <PriorityBadge priority={req.priority} />
                      <MaintenanceStatusBadge status={req.status} />
                    </div>
                    <h3>
                      {req.unit?.name ? `Unit ${req.unit.name} — ` : ""}
                      {req.title}
                    </h3>
                    {property && (
                      <p className="text-sm muted mt-1">{property}</p>
                    )}
                    <p className="text-sm mt-3">{req.description}</p>
                    <p className="text-xs muted mt-3">
                      {req.status === "ASSIGNED" && req.assigned_at
                        ? `Assigned ${formatDate(req.assigned_at)}`
                        : req.status === "IN_PROGRESS" && req.in_progress_at
                        ? `In progress since ${formatDate(req.in_progress_at)}`
                        : `Raised ${formatDate(req.created_at)}`}
                    </p>
                  </div>
                </div>

                <hr className="divider" />

                {/* Actions per status */}
                {req.status === "ASSIGNED" && (
                  <button
                    type="button"
                    className="btn btn-primary !py-2 !text-sm"
                    onClick={() => void handleStartRequest(req.id)}
                    disabled={actionLoading === req.id}
                    aria-label={`Move request "${req.title}" to In-Progress`}
                  >
                    {actionLoading === req.id ? "Updating…" : "Move to In-Progress"}
                  </button>
                )}

                {req.status === "IN_PROGRESS" && (
                  <div className="space-y-3">
                    <button
                      type="button"
                      className="btn btn-primary !py-2 !text-sm"
                      onClick={() => setResolveModal({ requestId: req.id, requestTitle: req.title })}
                      aria-label={`Resolve request "${req.title}"`}
                    >
                      Mark Resolved
                    </button>
                  </div>
                )}

                {req.status === "RESOLVED" && (
                  <p className="text-sm muted">
                    Resolved {req.resolved_at ? formatDate(req.resolved_at) : ""} · Awaiting tenant to close.
                  </p>
                )}
                {/* No Close button — BL-21: TENANT only */}
              </section>
            );
          })}
        </div>
      )}

      <p className="text-xs muted text-center mt-8">
        Cannot see: <strong>Rent</strong> · <strong>Leases</strong> · <strong>Tenant financial data</strong> · <strong>Payment history</strong>
      </p>

      {resolveModal && (
        <ResolveModal
          open={true}
          onClose={() => setResolveModal(null)}
          requestId={resolveModal.requestId}
          requestTitle={resolveModal.requestTitle}
          onSuccess={() => void fetchRequests()}
        />
      )}
    </>
  );
}
