"use client";

/**
 * Tenant Dashboard — Phase 6 (replaces Phase 3 stub).
 * 1:1 with prototype/tenant/dashboard.html.
 *
 * Cards (in order per prototype):
 *   1. My Lease — start/end dates, monthly rent, security deposit, co-tenant, PM, days remaining.
 *   2. Current Period — period range, due date, amount due, paid, outstanding, status badge.
 *      If OVERDUE, renders late-fee breakdown using computeLateFeePaise (BL-13).
 *   3. Open Maintenance — count + 2 most recent rows. Link to /tenant/maintenance.
 *   4. Co-tenant Termination Approval Card (Phase 3) — kept in place.
 *
 * Loading: skeleton cards (not spinner).
 * Empty state: "No active lease — contact your Property Manager."
 * 403: inline friendly error + logout link.
 */

import { useAuth } from "@/lib/auth/context";
import { useEffect, useState, useCallback } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { formatDateOnlyIST } from "@/lib/locale";
import { formatINR, computeLateFeePaise } from "@gharsetu/shared";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { useForm } from "react-hook-form";
import { friendlyError } from "@/lib/api/errors";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Link from "next/link";
import type { RentStatusValue } from "@gharsetu/shared";
import { paiseStringToINR, parseBigPaise, daysOverdue as calcDaysOverdue } from "@/lib/rent/format";

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
}

interface RentPeriod {
  id: string;
  leaseId: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amountDuePaise: string;
  lateFeePaise: string;
  paidPaise: string;
  outstandingPaise: string;
  status: RentStatusValue;
  lastAccruedAt: string | null;
}

interface RentPeriodsResponse {
  data?: RentPeriod[];
  items?: RentPeriod[];
}

interface MaintenanceRequest {
  id: string;
  title: string;
  status: string;
  priority: string;
  created_at: string;
  unit?: { name?: string } | null;
}

interface MaintenanceListResponse {
  data?: MaintenanceRequest[];
  items?: MaintenanceRequest[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  return formatDateOnlyIST(iso);
}

function formatPaise(paise: string | number | null | undefined): string {
  if (paise === null || paise === undefined) return "—";
  const val = typeof paise === "string" ? parseInt(paise, 10) : paise;
  return isNaN(val) ? "—" : formatINR(val);
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function daysRemaining(endDate: string): number {
  try {
    const end = parseISO(endDate);
    const today = new Date();
    const diff = differenceInCalendarDays(end, today);
    return diff > 0 ? diff : 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Late-fee breakdown (BL-13)
// ---------------------------------------------------------------------------

function LateFeeBreakdown({
  amountDuePaise,
  lateFeePaise,
  dueDate,
}: {
  amountDuePaise: string;
  lateFeePaise: string;
  dueDate: string;
}) {
  const today = new Date();
  let dueDateObj: Date;
  try { dueDateObj = parseISO(dueDate); } catch { return null; }

  const days = calcDaysOverdue(dueDateObj, today);
  const weeks = Math.floor(days / 7);

  if (weeks === 0) return null;

  const amountDue = parseBigPaise(amountDuePaise);
  const lateFeeAPI = parseBigPaise(lateFeePaise);

  // Defensive check
  const expected = computeLateFeePaise(BigInt(amountDue), days);
  if (expected !== BigInt(lateFeeAPI)) {
    console.warn(
      `[GharSetu] Late fee mismatch: API says ${lateFeeAPI} paise, computed ${expected.toString()} paise for ${days} days overdue.`,
    );
  }

  return (
    <p className="text-sm mt-2" style={{ color: "var(--color-status-overdue)" }}>
      Late fee = 2% × {paiseStringToINR(amountDuePaise)} × {weeks} week{weeks !== 1 ? "s" : ""} overdue = {paiseStringToINR(lateFeePaise)}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Current Period Card
// ---------------------------------------------------------------------------

function CurrentPeriodCard({ period }: { period: RentPeriod }) {
  const outstanding = parseBigPaise(period.outstandingPaise);
  const paid = parseBigPaise(period.paidPaise);
  const amountDue = parseBigPaise(period.amountDuePaise);

  const borderColor: Record<string, string> = {
    OVERDUE: "var(--color-status-overdue)",
    DUE: "var(--color-status-prepaid)",
    PARTIAL: "var(--color-status-partial)",
    PAID: "var(--color-status-paid)",
    PREPAID: "var(--color-status-paid)",
    UPCOMING: "var(--color-mid-gray)",
  };

  return (
    <section
      className="card mb-6 border-l-4"
      style={{ borderLeftColor: borderColor[period.status] ?? "var(--color-mid-gray)" }}
    >
      <h3 className="section-title">Current Period</h3>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex-1">
          <div className="flex gap-2 items-center mb-3">
            <StatusBadge status={period.status} />
            <span className="text-sm muted">
              {formatDate(period.periodStart)} — {formatDate(period.periodEnd)}
            </span>
          </div>

          <div className="grid sm:grid-cols-3 gap-x-8 gap-y-2 text-sm">
            <div><span className="muted">Due date:</span> <strong className="text-charcoal">{formatDate(period.dueDate)}</strong></div>
            <div><span className="muted">Amount due:</span> <strong className="text-charcoal">{formatINR(amountDue)}</strong></div>
            <div><span className="muted">Paid:</span> <strong className="text-charcoal">{formatINR(paid)}</strong></div>
            <div>
              <span className="muted">Outstanding:</span>{" "}
              <strong
                className="text-charcoal"
                style={outstanding > 0 ? { color: "var(--color-status-overdue)" } : undefined}
              >
                {formatINR(outstanding)}
              </strong>
            </div>
          </div>

          {period.status === "OVERDUE" && (
            <LateFeeBreakdown
              amountDuePaise={period.amountDuePaise}
              lateFeePaise={period.lateFeePaise}
              dueDate={period.dueDate}
            />
          )}

          <p className="text-sm muted mt-3">
            Payment is recorded by your Property Manager after you pay them. Pay via UPI / NEFT / Cash / Cheque as usual.
          </p>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Open Maintenance Card
// ---------------------------------------------------------------------------

function OpenMaintenanceCard({
  requests,
  totalOpen,
}: {
  requests: MaintenanceRequest[];
  totalOpen: number;
}) {
  return (
    <section className="card mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="section-title mb-0">Open Maintenance</h3>
        <Link href="/tenant/maintenance" className="text-sm text-saffron font-poppins font-semibold hover:underline focus-visible:outline-none">
          View all →
        </Link>
      </div>
      {totalOpen === 0 ? (
        <p className="text-sm muted">No open maintenance requests.</p>
      ) : (
        <>
          <p className="text-sm muted mb-3">{totalOpen} open request{totalOpen !== 1 ? "s" : ""}</p>
          <div className="grid gap-2">
            {requests.slice(0, 2).map((req) => (
              <div key={req.id} className="flex items-center justify-between py-2 border-b border-light-gray last:border-0">
                <div>
                  <span className="text-sm font-poppins font-semibold text-charcoal">
                    {req.unit?.name ? `Unit ${req.unit.name} — ` : ""}
                    {req.title}
                  </span>
                  <span className="text-xs muted ml-2">
                    {formatDate(req.created_at)}
                  </span>
                </div>
                <span className={`badge badge-${req.priority === "EMERGENCY" ? "emergency" : "open"} text-xs`}>
                  {req.priority === "EMERGENCY" ? "Emergency" : req.status}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Termination approval modal
// ---------------------------------------------------------------------------

interface ApprovalFormValues { note?: string; }

function ApprovalModal({
  open, onClose, decision, leaseId, tenantId, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  decision: "APPROVED" | "REJECTED";
  leaseId: string;
  tenantId: string;
  onSuccess: () => void;
}) {
  const { apiFetch } = useAuth();
  const { register, handleSubmit, formState: { isSubmitting }, reset } = useForm<ApprovalFormValues>();
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
    } catch (err) { setSubmitError(friendlyError(err)); }
  }

  return (
    <Modal open={open} onClose={onClose} title={decision === "APPROVED" ? "Approve Termination" : "Reject Termination"}>
      <p className="text-sm muted mt-1 mb-4">
        {decision === "APPROVED"
          ? "By approving, you consent to the early termination of this lease on the effective date."
          : "By rejecting, the termination request will remain open until the requester withdraws it or all tenants respond."}
      </p>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <Field id="note" label="Note (optional)" error={undefined}>
          <textarea className="input" rows={3} placeholder="Add a comment…" {...register("note")} />
        </Field>
        {submitError && <div className="field-error show mt-3" role="alert">{submitError}</div>}
        <div className="flex justify-end gap-3 mt-6">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            className={decision === "APPROVED" ? "btn btn-primary" : "btn btn-danger !py-2 !text-sm"}
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (decision === "APPROVED" ? "Approving…" : "Rejecting…") : (decision === "APPROVED" ? "Approve" : "Reject")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Initiate termination modal
// ---------------------------------------------------------------------------

interface InitTermForm { effectiveDate: string; reason?: string; }

function InitiateTerminationModal({
  open, onClose, leaseId, tenantId, onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  leaseId: string;
  tenantId: string;
  onSuccess: () => void;
}) {
  const { apiFetch } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<InitTermForm>();
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => { if (open) { reset(); setSubmitError(null); } }, [open, reset]);

  async function onSubmit(data: InitTermForm) {
    setSubmitError(null);
    try {
      await apiFetch(`/leases/${leaseId}/terminate-request`, {
        method: "POST",
        body: JSON.stringify({ requestedByTenantId: tenantId, effectiveDate: data.effectiveDate, reason: data.reason || undefined }),
      });
      onSuccess();
      onClose();
    } catch (err) { setSubmitError(friendlyError(err)); }
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
        {submitError && <div className="field-error show mt-3" role="alert">{submitError}</div>}
        <div className="flex justify-end gap-3 mt-6">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-danger !py-2 !text-sm" disabled={isSubmitting} aria-busy={isSubmitting}>
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
  const { user, apiFetch, logout } = useAuth();

  const [lease, setLease] = useState<ActiveLease | null>(null);
  const [currentPeriod, setCurrentPeriod] = useState<RentPeriod | null>(null);
  const [openRequests, setOpenRequests] = useState<MaintenanceRequest[]>([]);
  const [totalOpenCount, setTotalOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [approvalModal, setApprovalModal] = useState<{ open: boolean; decision: "APPROVED" | "REJECTED" } | null>(null);
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
    setLoadError(null);
    try {
      const res = await apiFetch<PaginatedLeaseResponse>(
        `/leases?tenantId=${user.id}&status=ACTIVE&limit=1`,
      );
      const leases = res.data ?? res.items ?? [];
      const activeLease = leases[0] ?? null;
      setLease(activeLease);

      if (activeLease) {
        // Fetch current rent period
        try {
          const periodsRes = await apiFetch<RentPeriodsResponse>(
            `/rent-periods?leaseId=${activeLease.id}&limit=5`,
          );
          const periods = periodsRes.data ?? periodsRes.items ?? [];
          // Find the most recent non-UPCOMING period, or the first UPCOMING
          const current = periods.find((p) => ["DUE", "OVERDUE", "PARTIAL", "PAID", "PREPAID"].includes(p.status))
            ?? periods[0]
            ?? null;
          setCurrentPeriod(current);
        } catch {
          setCurrentPeriod(null);
        }
      }
    } catch (err) {
      setLoadError(friendlyError(err));
      setLease(null);
    } finally {
      setLoading(false);
    }
  }, [user, apiFetch]);

  useEffect(() => { void fetchLease(); }, [fetchLease]);

  // Fetch open maintenance requests
  useEffect(() => {
    if (!user) return;
    apiFetch<MaintenanceListResponse>(`/maintenance-requests?limit=50`)
      .then((res) => {
        const items = res.data ?? res.items ?? (Array.isArray(res) ? (res as MaintenanceRequest[]) : []);
        const open = items.filter((r) => ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(r.status));
        setTotalOpenCount(open.length);
        setOpenRequests(open.slice(0, 2));
      })
      .catch(() => {
        setTotalOpenCount(0);
        setOpenRequests([]);
      });
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

  const firstNameOnly = user?.name?.split(" ")[0] ?? user?.name ?? "";

  if (loading) {
    return (
      <>
        <header className="topbar">
          <div>
            <h1 className="page-title">My Lease</h1>
            <div className="page-subtitle">Loading…</div>
          </div>
        </header>
        <SkeletonCard />
        <div className="mt-6"><SkeletonCard /></div>
        <div className="mt-6"><SkeletonCard /></div>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <header className="topbar">
          <div>
            <h1 className="page-title">My Lease</h1>
          </div>
        </header>
        <section className="card">
          <p className="text-charcoal font-poppins font-semibold">Unable to load your lease.</p>
          <p className="text-sm muted mt-1">{loadError}</p>
          <button
            type="button"
            className="btn btn-secondary mt-4 !py-2 !text-sm"
            onClick={() => void logout()}
          >
            Sign out
          </button>
        </section>
      </>
    );
  }

  const termination = lease?.termination ?? null;
  const tenants = lease?.tenants ?? [];
  const myTenantId = tenants.find((t) => t.email === user?.email)?.id ?? null;
  const myApproval = termination
    ? termination.approvals.find((a) => a.tenant_id === myTenantId)
    : null;
  const isRequester = termination?.requested_by_tenant_id === myTenantId;
  const leaseEndDays = lease ? daysRemaining(lease.end_date) : 0;

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

      {/* 1. Lease summary card */}
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
                {leaseEndDays > 0 && (
                  <div><span className="muted">Days remaining:</span> <strong className="text-charcoal">{leaseEndDays} days</strong></div>
                )}
              </div>
            </div>
            <span className="badge badge-active text-base" aria-label="Active">Active</span>
          </div>
        </section>
      ) : (
        <EmptyState
          heading="No active lease"
          body="Contact your Property Manager to sign a lease agreement."
        />
      )}

      {/* 2. Current Period card */}
      {lease && currentPeriod && (
        <CurrentPeriodCard period={currentPeriod} />
      )}

      {/* 3. Open Maintenance card */}
      {lease && (
        <OpenMaintenanceCard requests={openRequests} totalOpen={totalOpenCount} />
      )}

      {/* 4. Termination approval card (Phase 3) */}
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
                    <span className={`badge ${APPROVAL_BADGE[a.status] ?? "badge-open"} mt-1`} aria-label={a.status}>
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
          {actionError && <div className="field-error show mt-2" role="alert">{actionError}</div>}
          <div className="flex gap-3 mt-4 flex-wrap">
            {myApproval?.status === "PENDING" && myTenantId && (
              <>
                <button
                  type="button"
                  className="btn btn-primary !py-2 !text-sm"
                  onClick={() => setApprovalModal({ open: true, decision: "APPROVED" })}
                  aria-label="Approve termination request"
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn btn-danger !py-2 !text-sm"
                  onClick={() => setApprovalModal({ open: true, decision: "REJECTED" })}
                  aria-label="Reject termination request"
                >
                  Reject
                </button>
              </>
            )}
            {isRequester && (
              <button
                type="button"
                className="btn btn-secondary !py-2 !text-sm"
                onClick={() => void handleWithdrawTermination()}
                disabled={actionLoading === "withdraw"}
                aria-busy={actionLoading === "withdraw"}
              >
                {actionLoading === "withdraw" ? "Withdrawing…" : "Withdraw Request"}
              </button>
            )}
          </div>
        </section>
      )}

      {/* Quick actions when no termination */}
      {lease && !termination && myTenantId && (
        <section className="section">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card role-card flex items-center justify-between">
              <div>
                <div className="font-poppins font-semibold text-charcoal">Rent status</div>
                <div className="text-sm muted mt-1">View your payment history</div>
              </div>
              <Link href="/tenant/rent" className="text-saffron text-2xl" aria-label="View rent status">→</Link>
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
                aria-label="Request early lease termination"
              >
                →
              </button>
            </div>
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
