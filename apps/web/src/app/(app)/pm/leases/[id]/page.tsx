"use client";

/**
 * PM Lease Detail — Phase 3.
 * Per-status actions: Renew, Request Termination, Finalize Termination,
 * Withdraw Termination, Issue Deposit Refund.
 */

import { useAuth } from "@/lib/auth/context";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDateOnlyIST } from "@/lib/locale";
import { formatINR, rupeesToPaise, LeaseStatusEnum, TerminationApprovalStatusEnum, terminationApprovalStatusName, leaseStatusName } from "@gharsetu/shared";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { useForm } from "react-hook-form";
import { friendlyError } from "@/lib/api/errors";
import Link from "next/link";
import { RentScheduleSection } from "./RentScheduleSection";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeaseTenant {
  id: number | string;
  name: string;
  email: string;
  is_primary: boolean;
}

interface TerminationApproval {
  tenant_id: number | string;
  tenant_name: string;
  // API returns SMALLINT (0=PENDING, 1=APPROVED, 2=REJECTED) or legacy string
  status: number | string;
  note?: string | null;
}

interface LeaseTermination {
  id: number | string;
  requested_by_tenant_id: number | string;
  requested_by_name?: string;
  effective_date: string;
  reason?: string | null;
  approvals: TerminationApproval[];
}

interface DepositRefund {
  id: number | string;
  amount_paise: string | number;
  deductions_paise?: string | number | null;
  deduction_reason?: string | null;
  paid_to_tenant_id: number | string;
}

interface LeaseDetail {
  id: number | string;
  // API returns SMALLINT (0=ACTIVE, 1=EXPIRED, 2=RENEWED, 3=TERMINATED) or legacy string
  status: number | string;
  start_date: string;
  end_date: string;
  monthly_rent_paise: string | number;
  security_deposit_paise: string | number;
  unit?: { id: number | string; name: string };
  tenants?: LeaseTenant[];
  termination?: LeaseTermination | null;
  deposit_refund?: DepositRefund | null;
  successor_lease_id?: number | string | null;
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

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

// Status badge helper — handles both numeric codes and legacy strings
function leaseStatusBadgeClass(s: number | string): string {
  if (typeof s === "number") {
    switch (s) {
      case LeaseStatusEnum.ACTIVE: return "badge-paid";
      case LeaseStatusEnum.EXPIRED: return "badge-open";
      case LeaseStatusEnum.RENEWED: return "badge-renewed";
      case LeaseStatusEnum.TERMINATED: return "badge-terminated";
      default: return "badge-open";
    }
  }
  const map: Record<string, string> = { ACTIVE: "badge-paid", EXPIRED: "badge-open", RENEWED: "badge-renewed", TERMINATED: "badge-terminated" };
  return map[s as string] ?? "badge-open";
}

function leaseStatusDisplayLabel(s: number | string): string {
  if (typeof s === "number") return leaseStatusName(s as LeaseStatusEnum);
  return String(s).charAt(0) + String(s).slice(1).toLowerCase();
}

function approvalStatusBadgeClass(s: number | string): string {
  if (typeof s === "number") {
    switch (s) {
      case TerminationApprovalStatusEnum.APPROVED: return "badge-paid";
      case TerminationApprovalStatusEnum.REJECTED: return "badge-overdue";
      default: return "badge-open"; // PENDING
    }
  }
  const map: Record<string, string> = { PENDING: "badge-open", APPROVED: "badge-paid", REJECTED: "badge-overdue" };
  return map[s as string] ?? "badge-open";
}

function approvalStatusLabel(s: number | string): string {
  if (typeof s === "number") return terminationApprovalStatusName(s as TerminationApprovalStatusEnum);
  return String(s).charAt(0) + String(s).slice(1).toLowerCase();
}

function isLeaseStatus(s: number | string, name: string): boolean {
  if (typeof s === "number") {
    const codeMap: Record<string, number> = { ACTIVE: LeaseStatusEnum.ACTIVE, EXPIRED: LeaseStatusEnum.EXPIRED, RENEWED: LeaseStatusEnum.RENEWED, TERMINATED: LeaseStatusEnum.TERMINATED };
    return s === codeMap[name];
  }
  return s === name;
}

function isApprovalStatus(s: number | string, name: string): boolean {
  if (typeof s === "number") {
    const codeMap: Record<string, number> = { PENDING: TerminationApprovalStatusEnum.PENDING, APPROVED: TerminationApprovalStatusEnum.APPROVED, REJECTED: TerminationApprovalStatusEnum.REJECTED };
    return s === codeMap[name];
  }
  return s === name;
}

// ---------------------------------------------------------------------------
// Renew modal
// ---------------------------------------------------------------------------

interface RenewFormValues {
  newEndDate: string;
  newRentRupees?: number;
  newDepositRupees?: number;
}

function RenewModal({
  open,
  onClose,
  leaseId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  leaseId: string;
  onSuccess: () => void;
}) {
  const { apiFetch } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<RenewFormValues>();
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { reset(); setSubmitError(null); }
  }, [open, reset]);

  async function onSubmit(data: RenewFormValues) {
    setSubmitError(null);
    try {
      const body: Record<string, unknown> = { newEndDate: data.newEndDate };
      if (data.newRentRupees && data.newRentRupees > 0) {
        body.monthlyRentPaise = rupeesToPaise(data.newRentRupees);
      }
      if (data.newDepositRupees !== undefined && data.newDepositRupees >= 0) {
        body.securityDepositPaise = rupeesToPaise(data.newDepositRupees);
      }
      await apiFetch(`/leases/${leaseId}/renew`, { method: "POST", body: JSON.stringify(body) });
      onSuccess();
      onClose();
    } catch (err) {
      setSubmitError(friendlyError(err));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Renew Lease">
      <p className="text-sm muted mt-1 mb-4">A new lease record will be created. The existing lease remains Active until its end date, then transitions to Renewed.</p>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <div className="space-y-4">
          <Field id="newEndDate" label="New End Date (YYYY-MM-DD)" error={errors.newEndDate?.message}>
            <input
              className="input"
              type="text"
              placeholder="YYYY-MM-DD"
              {...register("newEndDate", {
                required: "New end date is required",
                pattern: { value: /^\d{4}-\d{2}-\d{2}$/, message: "Format: YYYY-MM-DD" },
              })}
            />
          </Field>
          <Field id="newRentRupees" label="New Monthly Rent ₹ (leave blank to keep current)" error={errors.newRentRupees?.message}>
            <input className="input" type="number" min="0" placeholder="Optional" {...register("newRentRupees", { valueAsNumber: true })} />
          </Field>
          <Field id="newDepositRupees" label="New Security Deposit ₹ (leave blank to keep current)" error={errors.newDepositRupees?.message}>
            <input className="input" type="number" min="0" placeholder="Optional" {...register("newDepositRupees", { valueAsNumber: true })} />
          </Field>
        </div>
        {submitError && <div className="field-error show mt-3">{submitError}</div>}
        <div className="flex justify-end gap-3 mt-6">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Renewing…" : "Renew Lease"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Termination request modal (PM side)
// ---------------------------------------------------------------------------

interface TerminationRequestForm {
  requestedByTenantId: string;
  effectiveDate: string;
  reason?: string;
}

function TerminationRequestModal({
  open,
  onClose,
  leaseId,
  tenants,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  leaseId: string;
  tenants: LeaseTenant[];
  onSuccess: () => void;
}) {
  const { apiFetch } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<TerminationRequestForm>();
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { reset(); setSubmitError(null); }
  }, [open, reset]);

  async function onSubmit(data: TerminationRequestForm) {
    setSubmitError(null);
    try {
      await apiFetch(`/leases/${leaseId}/terminate-request`, {
        method: "POST",
        body: JSON.stringify({
          requestedByTenantId: data.requestedByTenantId,
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
    <Modal open={open} onClose={onClose} title="Request Early Termination" maxWidth="max-w-[560px]">
      <p className="text-sm muted mt-1 mb-4">All co-tenants must approve before the termination can be finalised. No automatic timeout — the request stays open until everyone responds or is withdrawn.</p>
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <div className="space-y-4">
          <Field id="requestedByTenantId" label="Requested on behalf of" error={errors.requestedByTenantId?.message}>
            <select
              className="input"
              {...register("requestedByTenantId", { required: "Please select a tenant" })}
            >
              <option value="">— Select tenant —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_primary ? " (primary)" : ""}
                </option>
              ))}
            </select>
          </Field>
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
            {isSubmitting ? "Submitting…" : "Submit Termination Request"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Deposit Refund modal
// ---------------------------------------------------------------------------

interface DepositRefundForm {
  amountRupees: number;
  deductionsRupees: number;
  deductionReason?: string;
  paidToTenantId: string;
}

function DepositRefundModal({
  open,
  onClose,
  leaseId,
  tenants,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  leaseId: string;
  tenants: LeaseTenant[];
  onSuccess: () => void;
}) {
  const { apiFetch } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<DepositRefundForm>({ defaultValues: { deductionsRupees: 0 } });
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open) { reset({ deductionsRupees: 0 }); setSubmitError(null); }
  }, [open, reset]);

  async function onSubmit(data: DepositRefundForm) {
    setSubmitError(null);
    try {
      await apiFetch("/deposit-refunds", {
        method: "POST",
        body: JSON.stringify({
          leaseId,
          amountPaise: rupeesToPaise(data.amountRupees),
          deductionsPaise: rupeesToPaise(data.deductionsRupees ?? 0),
          deductionReason: data.deductionReason || undefined,
          paidToTenantId: data.paidToTenantId,
        }),
      });
      onSuccess();
      onClose();
    } catch (err) {
      setSubmitError(friendlyError(err));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Issue Deposit Refund" maxWidth="max-w-[560px]">
      <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <div className="space-y-4">
          <Field id="amountRupees" label="Refund Amount (₹)" error={errors.amountRupees?.message}>
            <input
              className="input"
              type="number"
              min="0"
              {...register("amountRupees", {
                required: "Refund amount is required",
                valueAsNumber: true,
                validate: (v) => v >= 0 || "Amount cannot be negative",
              })}
            />
          </Field>
          <Field id="deductionsRupees" label="Deductions (₹)" error={errors.deductionsRupees?.message}>
            <input
              className="input"
              type="number"
              min="0"
              {...register("deductionsRupees", { valueAsNumber: true })}
            />
          </Field>
          <Field id="deductionReason" label="Deduction Reason" error={errors.deductionReason?.message}>
            <textarea className="input" rows={2} placeholder="Damage to property, unpaid dues… (optional)" {...register("deductionReason")} />
          </Field>
          <Field id="paidToTenantId" label="Paid to Tenant" error={errors.paidToTenantId?.message}>
            <select
              className="input"
              {...register("paidToTenantId", { required: "Please select a tenant" })}
            >
              <option value="">— Select tenant —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_primary ? " (primary)" : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {submitError && <div className="field-error show mt-3">{submitError}</div>}
        <div className="flex justify-end gap-3 mt-6">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Issuing…" : "Issue Refund"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PmLeaseDetailPage() {
  const { apiFetch } = useAuth();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [lease, setLease] = useState<LeaseDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const [showRenewModal, setShowRenewModal] = useState(false);
  const [showTermModal, setShowTermModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchLease = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<LeaseDetail>(`/leases/${id}`);
      setLease(res);
    } catch {
      setLease(null);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, id]);

  useEffect(() => { void fetchLease(); }, [fetchLease]);

  async function handleWithdraw() {
    if (!lease?.termination) return;
    setActionLoading("withdraw");
    setActionError(null);
    try {
      await apiFetch(`/leases/${id}/terminate-withdraw`, { method: "POST" });
      await fetchLease();
    } catch (err) {
      setActionError(friendlyError(err));
    } finally {
      setActionLoading(null);
    }
  }

  async function handleFinalize() {
    setActionLoading("finalize");
    setActionError(null);
    try {
      await apiFetch(`/leases/${id}/finalize-termination`, { method: "POST" });
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

  if (!lease) {
    return (
      <div className="card">
        <p className="font-poppins text-charcoal">Lease not found.</p>
        <button type="button" className="btn btn-secondary mt-4" onClick={() => router.back()}>
          Go back
        </button>
      </div>
    );
  }

  const statusCls = leaseStatusBadgeClass(lease.status);
  const tenants = lease.tenants ?? [];
  const termination = lease.termination ?? null;
  const allApproved = termination?.approvals.every((a) => isApprovalStatus(a.status, "APPROVED")) ?? false;

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Lease — Unit {lease.unit?.name ?? "—"}</h1>
          <div className="page-subtitle">
            {formatDate(lease.start_date)} → {formatDate(lease.end_date)}
          </div>
        </div>
        <button type="button" className="btn btn-secondary !py-2 !text-sm" onClick={() => router.back()}>
          ← Back
        </button>
      </header>

      {/* Lease meta */}
      <section className="card mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div><span className="muted">Unit:</span> <strong className="text-charcoal">{lease.unit?.name ?? "—"}</strong></div>
              <div><span className="muted">Status:</span> <span className={`badge ${statusCls} ml-1`}>{leaseStatusDisplayLabel(lease.status)}</span></div>
              <div><span className="muted">Start:</span> <strong className="text-charcoal">{formatDate(lease.start_date)}</strong></div>
              <div><span className="muted">End:</span> <strong className="text-charcoal">{formatDate(lease.end_date)}</strong></div>
              <div><span className="muted">Monthly Rent:</span> <strong className="text-charcoal">{formatPaise(lease.monthly_rent_paise)}</strong></div>
              <div><span className="muted">Security Deposit:</span> <strong className="text-charcoal">{formatPaise(lease.security_deposit_paise)}</strong></div>
            </div>
          </div>
        </div>

        {/* Tenants list */}
        <div className="mt-4">
          <div className="font-poppins font-semibold text-charcoal mb-2">Tenants</div>
          <div className="space-y-2">
            {tenants.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                {t.is_primary && <span className="badge badge-prepaid text-xs">Primary</span>}
                <span className="text-charcoal font-medium">{t.name}</span>
                <span className="muted">{t.email}</span>
                <Link href={`/pm/tenants/${t.id}`} className="text-royal-blue font-poppins font-semibold hover:underline ml-auto">
                  View Tenant →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rent Change Schedule — only meaningful while the lease is ACTIVE */}
      {isLeaseStatus(lease.status, "ACTIVE") && lease.unit?.id !== undefined && (
        <RentScheduleSection
          unitId={lease.unit.id}
          currentRentPaise={lease.monthly_rent_paise}
          onChange={() => void fetchLease()}
        />
      )}

      {/* Actions by status */}
      {isLeaseStatus(lease.status, "ACTIVE") && !termination && (
        <section className="card mb-6">
          <h3 className="section-title">Actions</h3>
          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              className="btn btn-secondary !py-2 !text-sm"
              onClick={() => setShowRenewModal(true)}
            >
              Renew Lease
            </button>
            <button
              type="button"
              className="btn btn-danger !py-2 !text-sm"
              onClick={() => setShowTermModal(true)}
            >
              Request Early Termination
            </button>
          </div>
        </section>
      )}

      {/* Termination status card */}
      {termination && (
        <section className="card mb-6">
          <h3 className="section-title">Termination Request</h3>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-sm muted">
                Requested by {termination.requested_by_name ?? tenants.find((t) => String(t.id) === String(termination.requested_by_tenant_id))?.name ?? "—"}
                {termination.reason ? ` · Reason: ${termination.reason}` : ""}
                {" · Effective: "}{formatDate(termination.effective_date)}
              </p>
              <div className="mt-4 grid sm:grid-cols-3 gap-3">
                {termination.approvals.map((a) => (
                  <div key={a.tenant_id} className="p-3 rounded border border-mid-gray">
                    <div className="text-xs muted">
                      {a.tenant_name}
                      {String(a.tenant_id) === String(termination.requested_by_tenant_id) ? " (requester)" : ""}
                    </div>
                    <span className={`badge ${approvalStatusBadgeClass(a.status)} mt-1`}>
                      {approvalStatusLabel(a.status)}
                    </span>
                    {a.note && <div className="text-xs muted mt-1">{a.note}</div>}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <hr className="divider" />
          <p className="text-sm muted">All co-tenants must approve before this termination can be finalised. There is <strong>no automatic timeout</strong>.</p>
          {actionError && <div className="field-error show mt-2">{actionError}</div>}
          <div className="flex gap-3 mt-4 flex-wrap">
            {allApproved && (
              <button
                type="button"
                className="btn btn-danger !py-2 !text-sm"
                onClick={() => void handleFinalize()}
                disabled={actionLoading === "finalize"}
              >
                {actionLoading === "finalize" ? "Finalising…" : "Finalise Termination"}
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary !py-2 !text-sm"
              onClick={() => void handleWithdraw()}
              disabled={actionLoading === "withdraw"}
            >
              {actionLoading === "withdraw" ? "Withdrawing…" : "Withdraw Request"}
            </button>
          </div>
        </section>
      )}

      {/* Terminated status — deposit refund */}
      {isLeaseStatus(lease.status, "TERMINATED") && (
        <section className="card mb-6">
          <h3 className="section-title">Deposit Refund</h3>
          {lease.deposit_refund ? (
            <div className="text-sm">
              <p className="text-charcoal font-medium">Refund issued</p>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 mt-2">
                <div><span className="muted">Amount:</span> <strong>{formatPaise(lease.deposit_refund.amount_paise)}</strong></div>
                <div><span className="muted">Deductions:</span> <strong>{formatPaise(lease.deposit_refund.deductions_paise)}</strong></div>
                {lease.deposit_refund.deduction_reason && (
                  <div className="col-span-2"><span className="muted">Reason:</span> <strong>{lease.deposit_refund.deduction_reason}</strong></div>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm muted mb-4">No deposit refund issued yet.</p>
              <button
                type="button"
                className="btn btn-primary !py-2 !text-sm"
                onClick={() => setShowRefundModal(true)}
              >
                Issue Deposit Refund
              </button>
            </>
          )}
        </section>
      )}

      {/* Renewed / Expired — successor link */}
      {(isLeaseStatus(lease.status, "RENEWED") || isLeaseStatus(lease.status, "EXPIRED")) && lease.successor_lease_id && (
        <section className="card mb-6">
          <p className="text-sm text-charcoal">
            This lease has been renewed.{" "}
            <Link href={`/pm/leases/${lease.successor_lease_id}`} className="text-royal-blue font-poppins font-semibold">
              View successor lease →
            </Link>
          </p>
        </section>
      )}

      {/* Modals */}
      <RenewModal
        open={showRenewModal}
        onClose={() => setShowRenewModal(false)}
        leaseId={id}
        onSuccess={() => void fetchLease()}
      />
      <TerminationRequestModal
        open={showTermModal}
        onClose={() => setShowTermModal(false)}
        leaseId={id}
        tenants={tenants}
        onSuccess={() => void fetchLease()}
      />
      <DepositRefundModal
        open={showRefundModal}
        onClose={() => setShowRefundModal(false)}
        leaseId={id}
        tenants={tenants}
        onSuccess={() => void fetchLease()}
      />
    </>
  );
}
