"use client";

/**
 * Tenant Dashboard — Phase 3.
 * - My Lease summary
 * - Co-tenant termination approval card
 * - Withdraw termination (if current tenant is requester)
 * - Initiate termination link
 * Matches prototype/tenant/dashboard.html.
 */

import { useAuth } from "@/lib/auth/context";
import { useEffect, useState, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { formatINR } from "@gharsetu/shared";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { useForm } from "react-hook-form";
import { friendlyError } from "@/lib/api/errors";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeaseTenant {
  id: string;
  name: string;
  email: string;
  is_primary: boolean;
}

interface TerminationApproval {
  tenant_id: string;
  tenant_name: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  note?: string | null;
}

interface LeaseTermination {
  id: string;
  requested_by_tenant_id: string;
  effective_date: string;
  reason?: string | null;
  approvals: TerminationApproval[];
}

interface ActiveLease {
  id: string;
  status: string;
  start_date: string;
  end_date: string;
  monthly_rent_paise: string | number;
  security_deposit_paise: string | number;
  unit?: { name: string };
  property?: { name: string; address: string };
  tenants?: LeaseTenant[];
  property_manager?: { name: string };
  termination?: LeaseTermination | null;
}

interface PaginatedLeaseResponse {
  data?: ActiveLease[];
  items?: ActiveLease[];
  meta?: { total?: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try { return format(parseISO(iso), "dd/MM/yyyy"); } catch { return iso ?? "—"; }
}

function formatPaise(paise: string | number | null | undefined): string {
  if (paise === null || paise === undefined) return "—";
  const val = typeof paise === "string" ? parseInt(paise, 10) : paise;
  return isNaN(val) ? "—" : formatINR(val);
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

// ---------------------------------------------------------------------------
// Termination approval / reject modal
// ---------------------------------------------------------------------------

interface ApprovalFormValues {
  note?: string;
}

function ApprovalModal({
  open,
  onClose,
  decision,
  leaseId,
  tenantId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  decision: "APPROVED" | "REJECTED";
  leaseId: string;
  tenantId: string;
  onSuccess: () => void;
}) {
  const { apiFetch } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
    reset,
  } = useForm<ApprovalFormValues>();
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => { if (open) { reset(); setSubmitError(null); } }, [open, reset]);

  async function onSubmit(data: ApprovalFormValues) {
    setSubmitError(null);
    try {
      await apiFetch(`/leases/${leaseId}/terminate-approve`, {
        method: "POST",
        body: JSON.stringify({ tenantId, decision, note: data.note || undefined }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setSubmitError(friendlyError(err));
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={decision === "APPROVED" ? "Approve Termination" : "Reject Termination"}
    >
      <p className="text-sm muted mt-1 mb-4">
        {decision === "APPROVED"
          ? "By approving, you consent to the early termination of this lease on the effective date."
          : "By rejecting, the termination request will remain open until the requester withdraws it or all tenants respond."}
      </p>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <Field id="note" label="Note (optional)" error={undefined}>
          <textarea className="input" rows={3} placeholder="Add a comment…" {...register("note")} />
        </Field>
        {submitError && <div className="field-error show mt-3">{submitError}</div>}
        <div className="flex justify-end gap-3 mt-6">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            className={decision === "APPROVED" ? "btn btn-primary" : "btn btn-danger !py-2 !text-sm"}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? decision === "APPROVED" ? "Approving…" : "Rejecting…"
              : decision === "APPROVED" ? "Approve" : "Reject"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Initiate termination modal
// ---------------------------------------------------------------------------

interface InitTermForm {
  effectiveDate: string;
  reason?: string;
}

function InitiateTerminationModal({
  open,
  onClose,
  leaseId,
  tenantId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  leaseId: string;
  tenantId: string;
  onSuccess: () => void;
}) {
  const { apiFetch } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<InitTermForm>();
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => { if (open) { reset(); setSubmitError(null); } }, [open, reset]);

  async function onSubmit(data: InitTermForm) {
    setSubmitError(null);
    try {
      await apiFetch(`/leases/${leaseId}/terminate-request`, {
        method: "POST",
        body: JSON.stringify({
          requestedByTenantId: tenantId,
          effectiveDate: data.effectiveDate,
          reason: data.reason || undefined,
        }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setSubmitError(friendlyError(err));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Request Early Termination">
      <p className="text-sm muted mt-1 mb-4">
        All co-tenants must approve. No automatic timeout — the request stays open until everyone responds or you withdraw it.
      </p>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <div className="space-y-4">
          <Field id="effectiveDate" label="Effective Date (YYYY-MM-DD)" error={errors.effectiveDate?.message}>
            <input
              className="input"
              type="text"
              placeholder="YYYY-MM-DD"
              {...register("effectiveDate", {
                required: "Effective date is required",
                pattern: { value: /^\d{4}-\d{2}-\d{2}$/, message: "Format: YYYY-MM-DD" },
              })}
            />
          </Field>
          <Field id="reason" label="Reason (optional)" error={errors.reason?.message}>
            <textarea className="input" rows={3} placeholder="Job relocation, family reasons…" {...register("reason")} />
          </Field>
        </div>
        {submitError && <div className="field-error show mt-3">{submitError}</div>}
        <div className="flex justify-end gap-3 mt-6">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-danger !py-2 !text-sm" disabled={isSubmitting}>
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

export default function TenantDashboardPage() {
  const { user, apiFetch } = useAuth();

  const [lease, setLease] = useState<ActiveLease | null>(null);
  const [loading, setLoading] = useState(true);
  // Phase 5: open maintenance count
  const [openMaintCount, setOpenMaintCount] = useState<number | null>(null);

  const [approvalModal, setApprovalModal] = useState<{
    open: boolean;
    decision: "APPROVED" | "REJECTED";
  } | null>(null);
  const [showInitTermModal, setShowInitTermModal] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const APPROVAL_BADGE: Record<string, string> = {
    PENDING: "badge-open",
    APPROVED: "badge-paid",
    REJECTED: "badge-overdue",
  };

  const fetchLease = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiFetch<PaginatedLeaseResponse>(
        `/leases?tenantId=${user.id}&status=ACTIVE&limit=1`,
      );
      const leases = res.data ?? res.items ?? [];
      setLease(leases[0] ?? null);
    } catch {
      setLease(null);
    } finally {
      setLoading(false);
    }
  }, [user, apiFetch]);

  useEffect(() => { void fetchLease(); }, [fetchLease]);

  // Phase 5: fetch open maintenance count
  useEffect(() => {
    if (!user) return;
    apiFetch<{ data?: { status: string }[]; items?: { status: string }[] }>(
      `/maintenance-requests?limit=50`,
    )
      .then((res) => {
        const items = res.data ?? res.items ?? (Array.isArray(res) ? (res as { status: string }[]) : []);
        const open = items.filter((r) => ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(r.status));
        setOpenMaintCount(open.length);
      })
      .catch(() => setOpenMaintCount(null));
  }, [user, apiFetch]);

  async function handleWithdrawTermination() {
    if (!lease) return;
    setActionLoading("withdraw");
    setActionError(null);
    try {
      await apiFetch(`/leases/${lease.id}/terminate-withdraw`, { method: "POST" });
      await fetchLease();
    } catch (err) {
      setActionError(friendlyError(err));
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-slate font-poppins">Loading…</div>
      </div>
    );
  }

  const termination = lease?.termination ?? null;
  const tenants = lease?.tenants ?? [];
  const myTenantId = tenants.find((t) => t.email === user?.email)?.id ?? null;
  const myApproval = termination
    ? termination.approvals.find((a) => a.tenant_id === myTenantId)
    : null;
  const isRequester = termination?.requested_by_tenant_id === myTenantId;

  const firstNameOnly = user?.name?.split(" ")[0] ?? user?.name ?? "";

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">My Lease</h1>
          <div className="page-subtitle">Welcome back, {firstNameOnly}</div>
        </div>
        <div className="topbar-user">
          <span className="hidden md:inline">{user?.name}</span>
          <span className="avatar" aria-hidden="true">
            {user?.name ? initials(user.name) : "—"}
          </span>
        </div>
      </header>

      {/* Lease summary */}
      {lease ? (
        <section className="card mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-poppins font-semibold text-charcoal text-lg">
                {lease.unit?.name ? `Unit ${lease.unit.name}` : "—"}
                {lease.property?.name ? ` · ${lease.property.name}` : ""}
                {lease.property?.address ? `, ${lease.property.address}` : ""}
              </h3>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 mt-3 text-sm">
                <div><span className="muted">Lease start:</span> <strong className="text-charcoal">{formatDate(lease.start_date)}</strong></div>
                <div><span className="muted">Lease end:</span> <strong className="text-charcoal">{formatDate(lease.end_date)}</strong></div>
                <div><span className="muted">Monthly rent:</span> <strong className="text-charcoal">{formatPaise(lease.monthly_rent_paise)}</strong></div>
                <div><span className="muted">Security deposit:</span> <strong className="text-charcoal">{formatPaise(lease.security_deposit_paise)}</strong></div>
                {tenants.filter((t) => t.email !== user?.email).map((t) => (
                  <div key={t.id}><span className="muted">Co-tenant:</span> <strong className="text-charcoal">{t.name}</strong></div>
                ))}
                {lease.property_manager && (
                  <div><span className="muted">Property Manager:</span> <strong className="text-charcoal">{lease.property_manager.name}</strong></div>
                )}
              </div>
            </div>
            <span className="badge badge-paid text-base">Active</span>
          </div>
        </section>
      ) : (
        <section className="card mb-6">
          <p className="text-charcoal font-poppins">No active lease found.</p>
          <p className="text-sm muted mt-1">Contact your Property Manager to sign a lease agreement.</p>
        </section>
      )}

      {/* Termination approval card */}
      {lease && termination && (
        <section className="card mb-6">
          <h3 className="section-title">Termination Request</h3>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="font-poppins font-semibold text-charcoal text-lg">
                Unit {lease.unit?.name ?? "—"} — Termination requested
                {termination.reason ? ` · ${termination.reason}` : ""}
              </div>
              <p className="text-sm muted mt-1">
                Effective date: {formatDate(termination.effective_date)}
              </p>
              <div className="mt-4 grid sm:grid-cols-3 gap-3">
                {termination.approvals.map((a) => (
                  <div key={a.tenant_id} className="p-3 rounded border border-mid-gray">
                    <div className="text-xs muted">
                      {a.tenant_name}
                      {a.tenant_id === termination.requested_by_tenant_id ? " (requester)" : ""}
                    </div>
                    <span className={`badge ${APPROVAL_BADGE[a.status] ?? "badge-open"} mt-1`}>
                      {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                    </span>
                    {a.note && <div className="text-xs muted mt-1">{a.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <hr className="divider" />
          <p className="text-sm muted">
            All co-tenants must approve before this termination can be finalised. There is{" "}
            <strong>no automatic timeout</strong> — the request stays pending until everyone responds, or the requester withdraws it.
          </p>

          {actionError && <div className="field-error show mt-2">{actionError}</div>}

          {/* Actions for this tenant */}
          <div className="flex gap-3 mt-4 flex-wrap">
            {/* Approve / Reject if my approval is PENDING */}
            {myApproval?.status === "PENDING" && myTenantId && (
              <>
                <button
                  type="button"
                  className="btn btn-primary !py-2 !text-sm"
                  onClick={() => setApprovalModal({ open: true, decision: "APPROVED" })}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn btn-danger !py-2 !text-sm"
                  onClick={() => setApprovalModal({ open: true, decision: "REJECTED" })}
                >
                  Reject
                </button>
              </>
            )}
            {/* Withdraw if I am the requester */}
            {isRequester && (
              <button
                type="button"
                className="btn btn-secondary !py-2 !text-sm"
                onClick={() => void handleWithdrawTermination()}
                disabled={actionLoading === "withdraw"}
              >
                {actionLoading === "withdraw" ? "Withdrawing…" : "Withdraw Request"}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Initiate termination (only if active lease + no open termination) */}
      {lease && !termination && myTenantId && (
        <section className="section">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card role-card flex items-center justify-between">
              <div>
                <div className="font-poppins font-semibold text-charcoal">Rent status</div>
                <div className="text-sm muted mt-1">View your payment history</div>
              </div>
              <Link href="/tenant/rent" className="text-saffron text-2xl">→</Link>
            </div>
            <div className="card role-card flex items-center justify-between">
              <div>
                <div className="font-poppins font-semibold text-charcoal">Request early termination</div>
                <div className="text-sm muted mt-1">Requires all co-tenants to approve</div>
              </div>
              <button
                type="button"
                className="text-saffron text-2xl"
                onClick={() => setShowInitTermModal(true)}
              >
                →
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Quick actions when no termination */}
      {lease && !termination && (
        <section className="section mt-2">
          <div className="grid sm:grid-cols-2 gap-4">
            <Link href="/tenant/maintenance" className="card role-card flex items-center justify-between">
              <div>
                <div className="font-poppins font-semibold text-charcoal">Raise a maintenance request</div>
                <div className="text-sm muted mt-1">Plumbing · Electrical · Carpentry · Appliances</div>
              </div>
              <span className="text-saffron text-2xl">→</span>
            </Link>
            <Link href="/tenant/maintenance" className="card role-card flex items-center justify-between">
              <div>
                <div className="font-poppins font-semibold text-charcoal">My maintenance requests</div>
                <div className="text-sm muted mt-1">
                  {openMaintCount !== null && openMaintCount > 0
                    ? `${openMaintCount} open request${openMaintCount !== 1 ? "s" : ""}`
                    : "View open requests"}
                </div>
              </div>
              <span className="text-saffron text-2xl">→</span>
            </Link>
          </div>
        </section>
      )}

      {/* Modals */}
      {approvalModal && lease && myTenantId && (
        <ApprovalModal
          open={approvalModal.open}
          onClose={() => setApprovalModal(null)}
          decision={approvalModal.decision}
          leaseId={lease.id}
          tenantId={myTenantId}
          onSuccess={() => void fetchLease()}
        />
      )}

      {showInitTermModal && lease && myTenantId && (
        <InitiateTerminationModal
          open={showInitTermModal}
          onClose={() => setShowInitTermModal(false)}
          leaseId={lease.id}
          tenantId={myTenantId}
          onSuccess={() => void fetchLease()}
        />
      )}
    </>
  );
}
