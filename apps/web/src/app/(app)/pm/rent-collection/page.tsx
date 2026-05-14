"use client";

/**
 * PM Rent Collection — Phase 4.
 * 1:1 with prototype/pm/rent-collection.html.
 *
 * Filters: Unit selector + Period range + Status filter chips.
 * Table: Period | Due Date | Status | Amount Due | Paid | Late Fee | Action.
 * Record Payment modal: RHF + zod (RecordPaymentSchema from @gharsetu/shared).
 * Void modal: reason field, on success row shows strikethrough + "Voided by X on DATE".
 * Drawer: period detail with all payments for that period.
 */

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parse, parseISO } from "date-fns";
import { formatDateOnlyIST, todayIST } from "@/lib/locale";
import { useAuth } from "@/lib/auth/context";
import { usePmProperty } from "@/lib/pm/context";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SkeletonTableRows } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { usePaginatedList } from "@/lib/pagination/usePaginatedList";
import { paiseStringToINR, parseBigPaise, daysOverdue } from "@/lib/rent/format";
import {
  VoidPaymentSchema,
  PaymentMethodEnum,
  RentPeriodStatusEnum,
  type RentStatusValue,
  type RecordPaymentInput,
  type VoidPaymentInput,
} from "@gharsetu/shared";
import { rupeesToPaise } from "@gharsetu/shared";
import { mapApiErrorCode, friendlyError } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Lease {
  id: number | string;
  unit?: { id: number | string; name: string };
  monthly_rent_paise?: string;
  tenants?: { id: number | string; name: string }[];
  start_date: string;
  end_date: string;
  rent_due_day?: number;
}

interface Payment {
  id: number | string;
  rentPeriodId: number | string;
  leaseId: number | string;
  amountPaise: string;
  method: string;
  reference?: string | null;
  paidOn: string;
  recordedByUserId: number | string;
  recordedAt: string;
  isVoided: boolean;
  voidedByUserId?: number | string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  recordedByName?: string;
  voidedByName?: string;
}

interface RentPeriod {
  id: number | string;
  leaseId: number | string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amountDuePaise: string;
  lateFeePaise: string;
  paidPaise: string;
  outstandingPaise: string;
  status: number | string;
  lastAccruedAt: string | null;
  payments?: Payment[];
}

interface LeasesResponse {
  data?: Lease[];
  items?: Lease[];
}

// ---------------------------------------------------------------------------
// Form schema for UI (amount in rupees, paidOn as DD/MM/YYYY)
// ---------------------------------------------------------------------------

const RecordPaymentUISchema = z.object({
  amountRupees: z
    .number({ invalid_type_error: "Enter a valid amount" })
    .positive("Amount must be greater than zero"),
  method: PaymentMethodEnum,
  reference: z.string().max(500).optional(),
  paidOn: z
    .string()
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Enter date as DD/MM/YYYY"),
});

type RecordPaymentUIInput = z.infer<typeof RecordPaymentUISchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPeriodLabel(periodStart: string): string {
  try {
    return format(parseISO(periodStart), "MMM yyyy");
  } catch {
    return periodStart;
  }
}

function formatDate(iso: string): string {
  return formatDateOnlyIST(iso);
}

function methodPlaceholder(method: string): string {
  switch (method) {
    case "UPI":
      return "UPI ref / transaction ID";
    case "CHEQUE":
      return "Cheque number";
    case "BANK_TRANSFER":
      return "NEFT/RTGS UTR";
    case "CASH":
      return "Optional receipt note";
    default:
      return "Reference (optional)";
  }
}

// ---------------------------------------------------------------------------
// Record Payment Modal
// ---------------------------------------------------------------------------

interface RecordPaymentModalProps {
  open: boolean;
  period: RentPeriod | null;
  onClose: () => void;
  onSuccess: (updated: RentPeriod) => void;
}

function RecordPaymentModal({ open, period, onClose, onSuccess }: RecordPaymentModalProps) {
  const { apiFetch, user } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<RecordPaymentUIInput>({
    resolver: zodResolver(RecordPaymentUISchema),
    defaultValues: {
      method: "UPI",
      paidOn: todayIST(),
    },
  });

  const methodValue = watch("method");

  useEffect(() => {
    if (open) {
      reset({
        method: "UPI",
        paidOn: todayIST(),
        reference: "",
        amountRupees: undefined,
      });
      setServerError(null);
    }
  }, [open, reset]);

  async function onSubmit(values: RecordPaymentUIInput) {
    if (!period) return;
    setSubmitting(true);
    setServerError(null);

    try {
      // Convert rupees → paise and parse DD/MM/YYYY → YYYY-MM-DD
      const amountPaise = rupeesToPaise(values.amountRupees);
      const parsedDate = parse(values.paidOn, "dd/MM/yyyy", new Date());
      const paidOnISO = format(parsedDate, "yyyy-MM-dd");

      const body: RecordPaymentInput = {
        rentPeriodId: String(period.id),
        amountPaise,
        method: values.method,
        reference: values.reference || undefined,
        paidOn: paidOnISO,
      };

      // Phase 7: Idempotency-Key header — one UUID per submit attempt.
      // Backend deduplicates concurrent/retried submits using this key.
      const idempotencyKey = crypto.randomUUID();

      await apiFetch<{ rentPeriod: RentPeriod }>("/payments", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Idempotency-Key": idempotencyKey },
      });

      // Re-fetch the period to get updated status
      const updated = await apiFetch<RentPeriod>(`/rent-periods/${period.id}`);
      onSuccess(updated);

      const excess = parseBigPaise(updated.paidPaise) - parseBigPaise(updated.amountDuePaise);
      if (excess > 0) {
        toast(
          `Payment recorded. Excess of ${paiseStringToINR(String(excess))} recorded as prepaid credit.`,
          "info",
        );
      } else {
        toast("Payment recorded successfully.", "success");
      }

      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? mapApiErrorCode(err.code) !== "Something went wrong. Please try again."
            ? mapApiErrorCode(err.code)
            : err.message
          : friendlyError(err);
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!period) return null;

  const outstanding = parseBigPaise(period.outstandingPaise);
  const lateFee = parseBigPaise(period.lateFeePaise);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Record Payment — ${formatPeriodLabel(period.periodStart)}`}
      maxWidth="max-w-[520px]"
    >
      <p className="muted text-sm mt-1 mb-5">
        Outstanding: <strong className="text-charcoal">{paiseStringToINR(period.outstandingPaise)}</strong>
        {lateFee > 0 && (
          <> (incl. {paiseStringToINR(period.lateFeePaise)} late fee)</>
        )}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-2 gap-4">
          <Field id="pay-amt" label="Amount (₹)" error={errors.amountRupees?.message}>
            <input
              {...register("amountRupees", { valueAsNumber: true })}
              type="number"
              min="1"
              step="1"
              placeholder={String(Math.round(outstanding / 100))}
              className="input"
            />
          </Field>

          <Field id="pay-date" label="Date" error={errors.paidOn?.message}>
            <input
              {...register("paidOn")}
              type="text"
              placeholder="DD/MM/YYYY"
              className="input"
            />
          </Field>

          <Field id="pay-method" label="Method" error={errors.method?.message}>
            <select {...register("method")} className="input">
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CASH">Cash</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>

          <Field id="pay-ref" label="Reference no." error={errors.reference?.message}>
            <input
              {...register("reference")}
              type="text"
              placeholder={methodPlaceholder(methodValue)}
              className="input"
            />
          </Field>
        </div>

        <div className="mt-4">
          <label className="label">Recorded by</label>
          <input className="input" value={user?.name ?? "—"} disabled />
        </div>

        {outstanding > 0 && parseBigPaise(period.amountDuePaise) > 0 && (
          <div className="alert mt-5">
            <div>
              <strong className="font-poppins">Tip — Prepayment</strong>
              <div>
                If the tenant pays more than {paiseStringToINR(period.outstandingPaise)},
                the excess is automatically marked as{" "}
                <span className="badge badge-prepaid">Prepaid</span> for the next period.
              </div>
            </div>
          </div>
        )}

        {serverError && (
          <div className="field-error show mt-3">{serverError}</div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Save Payment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Void Payment Modal
// ---------------------------------------------------------------------------

interface VoidModalProps {
  open: boolean;
  payment: Payment | null;
  onClose: () => void;
  onSuccess: (periodId: number | string) => void;
}

function VoidPaymentModal({ open, payment, onClose, onSuccess }: VoidModalProps) {
  const { apiFetch } = useAuth();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<VoidPaymentInput>({
    resolver: zodResolver(VoidPaymentSchema),
  });

  useEffect(() => {
    if (open) {
      reset({ reason: "" });
      setServerError(null);
    }
  }, [open, reset]);

  async function onSubmit(values: VoidPaymentInput) {
    if (!payment) return;
    setSubmitting(true);
    setServerError(null);
    try {
      await apiFetch(`/payments/${payment.id}/void`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      toast("Payment voided successfully.", "success");
      onSuccess(payment.rentPeriodId);
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? mapApiErrorCode(err.code) !== "Something went wrong. Please try again."
            ? mapApiErrorCode(err.code)
            : err.message
          : friendlyError(err);
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Void Payment" maxWidth="max-w-[440px]">
      {payment && (
        <p className="text-sm muted mt-1 mb-4">
          Amount: <strong className="text-charcoal">{paiseStringToINR(payment.amountPaise)}</strong>
          {" · "}Paid {formatDate(payment.paidOn)} via {payment.method}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field id="void-reason" label="Reason for voiding" error={errors.reason?.message}>
          <textarea
            {...register("reason")}
            className="input"
            rows={3}
            placeholder="Enter a reason (min. 5 characters)…"
          />
        </Field>

        {serverError && (
          <div className="field-error show mt-3">{serverError}</div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-danger" disabled={submitting}>
            {submitting ? "Voiding…" : "Void Payment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Period Detail Drawer
// ---------------------------------------------------------------------------

interface PeriodDetailDrawerProps {
  open: boolean;
  period: RentPeriod | null;
  onClose: () => void;
  onVoidSuccess: (periodId: number | string) => void;
}

function PeriodDetailDrawer({ open, period, onClose, onVoidSuccess }: PeriodDetailDrawerProps) {
  const [voidTarget, setVoidTarget] = useState<Payment | null>(null);
  const [voidOpen, setVoidOpen] = useState(false);

  if (!open || !period) return null;

  const payments = period.payments ?? [];
  const activePayments = payments.filter((p) => !p.isVoided);
  const voidedPayments = payments.filter((p) => p.isVoided);

  function handleVoidClick(p: Payment) {
    setVoidTarget(p);
    setVoidOpen(true);
  }

  function handleVoidSuccess(pid: number | string) {
    onVoidSuccess(pid);
    setVoidOpen(false);
    setVoidTarget(null);
    onClose(); // close drawer to force re-open with fresh data
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-[90]"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer panel */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-[560px] bg-white shadow-[0_0_40px_rgba(0,0,0,0.15)] z-[95] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label={`Period detail — ${formatPeriodLabel(period.periodStart)}`}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-poppins font-semibold text-charcoal text-xl m-0">
                {formatPeriodLabel(period.periodStart)}
              </h3>
              <p className="text-sm muted mt-0.5">
                Period {formatDate(period.periodStart)} → {formatDate(period.periodEnd)} · Due {formatDate(period.dueDate)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-slate hover:text-charcoal"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Summary row */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="kpi">
              <div className="kpi-label">Amount Due</div>
              <div className="kpi-value text-[22px]">{paiseStringToINR(period.amountDuePaise)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Outstanding</div>
              <div
                className="kpi-value text-[22px]"
                style={{ color: parseBigPaise(period.outstandingPaise) > 0 ? "var(--color-status-overdue)" : "var(--color-status-paid)" }}
              >
                {paiseStringToINR(period.outstandingPaise)}
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Paid</div>
              <div className="kpi-value text-[22px]" style={{ color: "var(--color-status-paid)" }}>
                {paiseStringToINR(period.paidPaise)}
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Late Fee</div>
              <div
                className="kpi-value text-[22px]"
                style={{ color: parseBigPaise(period.lateFeePaise) > 0 ? "var(--color-status-overdue)" : undefined }}
              >
                {parseBigPaise(period.lateFeePaise) > 0 ? paiseStringToINR(period.lateFeePaise) : "—"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <StatusBadge status={period.status} />
          </div>

          {/* Payments list */}
          <h4 className="section-title">Payments</h4>

          {payments.length === 0 && (
            <p className="text-sm muted">No payments recorded for this period.</p>
          )}

          {activePayments.map((p) => (
            <div key={p.id} className="card mb-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-poppins font-semibold text-charcoal">
                    {paiseStringToINR(p.amountPaise)}
                  </div>
                  <div className="text-sm muted mt-0.5">
                    {p.method} · Paid {formatDate(p.paidOn)}
                    {p.reference && <> · Ref: {p.reference}</>}
                  </div>
                  <div className="text-xs muted mt-0.5">
                    Recorded {p.recordedByName ?? "by PM"} on {formatDate(p.recordedAt)}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary !py-1.5 !text-sm !px-3"
                  onClick={() => handleVoidClick(p)}
                >
                  Void
                </button>
              </div>
            </div>
          ))}

          {voidedPayments.map((p) => (
            <div key={p.id} className="card mb-3 p-4 opacity-50">
              <div className="font-poppins font-semibold text-charcoal line-through">
                {paiseStringToINR(p.amountPaise)}
              </div>
              <div className="text-sm muted mt-0.5">
                {p.method} · Paid {formatDate(p.paidOn)}
              </div>
              <div className="text-xs text-status-overdue mt-1">
                Voided{p.voidedByName ? ` by ${p.voidedByName}` : ""}{p.voidedAt ? ` on ${formatDate(p.voidedAt)}` : ""}
                {p.voidReason && <> · {p.voidReason}</>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <VoidPaymentModal
        open={voidOpen}
        payment={voidTarget}
        onClose={() => { setVoidOpen(false); setVoidTarget(null); }}
        onSuccess={handleVoidSuccess}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Status filter chips
// ---------------------------------------------------------------------------

type StatusFilterValue = RentStatusValue | "ALL";

const STATUS_OPTIONS: { label: string; value: StatusFilterValue }[] = [
  { label: "All", value: "ALL" },
  { label: "Due", value: "DUE" },
  { label: "Overdue", value: "OVERDUE" },
  { label: "Partial", value: "PARTIAL" },
  { label: "Paid", value: "PAID" },
  { label: "Prepaid", value: "PREPAID" },
];

function matchesRentStatus(status: number | string, filter: StatusFilterValue): boolean {
  if (filter === "ALL") return true;
  if (typeof status === "number") {
    const MAP: Record<StatusFilterValue, number | undefined> = {
      ALL: undefined,
      DUE: RentPeriodStatusEnum.DUE,
      OVERDUE: RentPeriodStatusEnum.OVERDUE,
      PARTIAL: RentPeriodStatusEnum.PARTIAL,
      PAID: RentPeriodStatusEnum.PAID,
      PREPAID: RentPeriodStatusEnum.PREPAID,
      UPCOMING: RentPeriodStatusEnum.UPCOMING,
    };
    return status === MAP[filter];
  }
  return status === filter;
}

function isPaidOrPrepaid(status: number | string): boolean {
  return status === RentPeriodStatusEnum.PAID || status === "PAID" ||
    status === RentPeriodStatusEnum.PREPAID || status === "PREPAID";
}

function isOverdue(status: number | string): boolean {
  return status === RentPeriodStatusEnum.OVERDUE || status === "OVERDUE";
}

function isOutstanding(status: number | string): boolean {
  return status === RentPeriodStatusEnum.OVERDUE || status === "OVERDUE" ||
    status === RentPeriodStatusEnum.DUE || status === "DUE" ||
    status === RentPeriodStatusEnum.PARTIAL || status === "PARTIAL";
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function PmRentCollectionPage() {
  const { apiFetch } = useAuth();
  const { property, propertyId, loading: propLoading } = usePmProperty();

  // Leases for the unit selector
  const [leases, setLeases] = useState<Lease[]>([]);
  const [leasesLoading, setLeasesLoading] = useState(true);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(null);

  // Status filter for rent periods
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("ALL");

  // Bump to force re-fetch after payment or void
  const [periodsRefetchKey, setPeriodsRefetchKey] = useState(0);

  // Modals / drawer state
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<RentPeriod | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerPeriod, setDrawerPeriod] = useState<RentPeriod | null>(null);

  // Load leases for property
  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;

    async function fetchLeases() {
      setLeasesLoading(true);
      try {
        const res = await apiFetch<LeasesResponse>(
          `/leases?propertyId=${propertyId}&status=ACTIVE&limit=50`,
        );
        if (!cancelled) {
          const items = res.data ?? res.items ?? [];
          setLeases(items);
          if (items.length > 0 && !selectedLeaseId) {
            const firstId = items[0]?.id;
            setSelectedLeaseId(firstId != null ? String(firstId) : null);
          }
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLeasesLoading(false);
      }
    }

    void fetchLeases();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiFetch, propertyId]);

  // Paginated rent periods for the selected lease
  const periodsExtraQuery: Record<string, string | undefined> = {};
  if (selectedLeaseId) periodsExtraQuery.leaseId = selectedLeaseId;
  if (statusFilter !== "ALL") periodsExtraQuery.status = statusFilter;

  const {
    items: filteredPeriods,
    page: periodsPage,
    totalPages: periodsTotalPages,
    total: periodsTotal,
    pageSize: periodsPageSize,
    hasNext: periodsHasNext,
    hasPrev: periodsHasPrev,
    loading: periodsLoading,
    next: periodsNext,
    prev: periodsPrev,
    goToPage: periodsGoToPage,
  } = usePaginatedList<RentPeriod>({
    url: "/rent-periods",
    extraQuery: selectedLeaseId ? periodsExtraQuery : undefined,
    pageSize: 10,
    refetchKey: periodsRefetchKey,
  });

  function handlePaymentSuccess(_updated: RentPeriod) {
    // Re-fetch current page to reflect updated period status
    setPeriodsRefetchKey((k) => k + 1);
  }

  function handleVoidSuccess(periodId: number | string) {
    setPeriodsRefetchKey((k) => k + 1);
    // If drawer is showing this period, refresh it
    if (drawerPeriod && String(drawerPeriod.id) === String(periodId)) {
      apiFetch<RentPeriod>(`/rent-periods/${periodId}`)
        .then((updated) => setDrawerPeriod(updated))
        .catch(() => {});
    }
  }

  async function openDrawer(period: RentPeriod) {
    setDrawerOpen(true);
    // Fetch full period detail (includes payments)
    try {
      const detail = await apiFetch<RentPeriod>(`/rent-periods/${period.id}`);
      setDrawerPeriod(detail);
    } catch {
      setDrawerPeriod(period);
    }
  }

  const selectedLease = leases.find((l) => String(l.id) === String(selectedLeaseId)) ?? null;
  const tenantNames = selectedLease?.tenants?.map((t) => t.name).join(" + ") ?? "";

  // Summary: fetch first outstanding period for context card (separate lightweight fetch)
  const [summaryPeriod, setSummaryPeriod] = useState<RentPeriod | null>(null);
  useEffect(() => {
    if (!selectedLeaseId) { setSummaryPeriod(null); return; }
    let cancelled = false;
    apiFetch<{ data?: RentPeriod[]; items?: RentPeriod[] }>(
      `/rent-periods?leaseId=${selectedLeaseId}&limit=10`
    )
      .then((res) => {
        if (cancelled) return;
        const items = res.data ?? res.items ?? [];
        const outstanding = items.find((p) => isOutstanding(p.status)) ?? null;
        setSummaryPeriod(outstanding);
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiFetch, selectedLeaseId, periodsRefetchKey]);

  const today = new Date();

  if (propLoading) {
    return (
      <>
        <header className="topbar">
          <div>
            <h1 className="page-title">Rent Collection</h1>
            <div className="page-subtitle">Loading…</div>
          </div>
        </header>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Rent Collection</h1>
          <div className="page-subtitle">{property?.name ?? ""}</div>
        </div>
      </header>

      {/* Filters */}
      <section className="card mb-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="unit-select">Unit / Tenant</label>
            <select
              id="unit-select"
              className="input"
              value={selectedLeaseId ?? ""}
              onChange={(e) => setSelectedLeaseId(e.target.value)}
              disabled={leasesLoading || leases.length === 0}
            >
              {leasesLoading && <option>Loading leases…</option>}
              {!leasesLoading && leases.length === 0 && (
                <option value="">No active leases</option>
              )}
              {leases.map((l) => (
                <option key={String(l.id)} value={String(l.id)}>
                  {l.unit?.name ?? "Unit"} —{" "}
                  {l.tenants?.map((t) => t.name).join(" + ") ?? "—"}{" "}
                  {l.monthly_rent_paise
                    ? `· ${paiseStringToINR(l.monthly_rent_paise)}`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="status-filter">Status</label>
            <select
              id="status-filter"
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilterValue)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Tenant context card */}
      {selectedLease && (
        <section className="card mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="m-0">
                Unit {selectedLease.unit?.name ?? "—"} · {tenantNames}
              </h3>
              <p className="text-sm muted mt-1">
                Lease: {formatDate(selectedLease.start_date)} → {formatDate(selectedLease.end_date)}
                {selectedLease.monthly_rent_paise
                  ? ` · Rent ${paiseStringToINR(selectedLease.monthly_rent_paise)}`
                  : ""}
                {selectedLease.rent_due_day
                  ? ` · Due on ${selectedLease.rent_due_day}${selectedLease.rent_due_day === 1 ? "st" : selectedLease.rent_due_day === 2 ? "nd" : selectedLease.rent_due_day === 3 ? "rd" : "th"} of each month`
                  : ""}
              </p>
            </div>
            {/* Current period outstanding badge */}
            {summaryPeriod && (
              <div className="flex gap-2 items-center">
                <StatusBadge status={summaryPeriod.status} />
                <span className="text-sm muted">
                  Outstanding:{" "}
                  <strong className="text-charcoal">
                    {paiseStringToINR(summaryPeriod.outstandingPaise)}
                  </strong>
                  {parseBigPaise(summaryPeriod.lateFeePaise) > 0 && (
                    <> (incl. {paiseStringToINR(summaryPeriod.lateFeePaise)} late fee)</>
                  )}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Periods table */}
      <section className="card p-0 overflow-x-auto mb-4">
        <table className="data-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Due (₹)</th>
              <th>Paid (₹)</th>
              <th>Late Fee (₹)</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {periodsLoading && <SkeletonTableRows rows={4} cols={7} />}

            {!periodsLoading && filteredPeriods.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center muted py-8">
                  {selectedLeaseId
                    ? "No rent periods found for this lease."
                    : "Select a lease to view rent periods."}
                </td>
              </tr>
            )}

            {!periodsLoading &&
              filteredPeriods.map((period) => {
                const overdueCount = daysOverdue(parseISO(period.dueDate), today);
                const canRecord = !isPaidOrPrepaid(period.status);

                return (
                  <tr key={period.id}>
                    <td className="font-poppins font-semibold text-charcoal">
                      {formatPeriodLabel(period.periodStart)}
                    </td>
                    <td>{formatDate(period.dueDate)}</td>
                    <td>
                      <StatusBadge status={period.status} />
                      {isOverdue(period.status) && overdueCount > 0 && (
                        <span className="text-xs muted ml-1">({overdueCount}d)</span>
                      )}
                    </td>
                    <td>{paiseStringToINR(period.amountDuePaise)}</td>
                    <td>
                      {parseBigPaise(period.paidPaise) > 0
                        ? paiseStringToINR(period.paidPaise)
                        : "—"}
                    </td>
                    <td
                      style={{
                        color:
                          parseBigPaise(period.lateFeePaise) > 0
                            ? "var(--color-status-overdue)"
                            : undefined,
                      }}
                    >
                      {parseBigPaise(period.lateFeePaise) > 0
                        ? paiseStringToINR(period.lateFeePaise)
                        : "—"}
                    </td>
                    <td className="flex gap-2">
                      {canRecord && (
                        <button
                          type="button"
                          className="btn btn-primary !py-2 !text-sm"
                          onClick={() => {
                            setSelectedPeriod(period);
                            setPayModalOpen(true);
                          }}
                        >
                          Record Payment
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary !py-2 !text-sm"
                        onClick={() => openDrawer(period)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </section>

      <Pagination
        page={periodsPage}
        totalPages={periodsTotalPages}
        total={periodsTotal}
        pageSize={periodsPageSize}
        hasPrev={periodsHasPrev}
        hasNext={periodsHasNext}
        onPrev={periodsPrev}
        onNext={periodsNext}
        onGoToPage={periodsGoToPage}
        itemsOnPage={filteredPeriods.length}
        loading={periodsLoading}
      />

      <p className="text-xs muted mt-3">
        A period becomes <strong>Overdue</strong> 5 calendar days past the due date. Late fee = 2% of outstanding balance per full week overdue, calculated automatically.
      </p>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        open={payModalOpen}
        period={selectedPeriod}
        onClose={() => { setPayModalOpen(false); setSelectedPeriod(null); }}
        onSuccess={handlePaymentSuccess}
      />

      {/* Period Detail Drawer */}
      <PeriodDetailDrawer
        open={drawerOpen}
        period={drawerPeriod}
        onClose={() => { setDrawerOpen(false); setDrawerPeriod(null); }}
        onVoidSuccess={handleVoidSuccess}
      />
    </>
  );
}
