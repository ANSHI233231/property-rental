"use client";

/**
 * Admin Rent Overview — Phase 4.
 * 1:1 with prototype/admin/rent.html.
 *
 * KPI cards: Collected, Overdue, Partial, Prepaid.
 * Overdue tenants table with property link.
 * "Recompute Accruals Now" button — POST /jobs/rent-accrual/run.
 *
 * Aggregates are computed client-side from the paginated overdue list
 * (backend does not expose a dedicated aggregate endpoint in Phase 4).
 */

import { useState, useEffect } from "react";
import { parseISO, format, differenceInCalendarDays } from "date-fns";
import { useAuth } from "@/lib/auth/context";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SkeletonKpi } from "@/components/ui/Skeleton";
import { SkeletonTableRows } from "@/components/ui/Skeleton";
import { paiseStringToINR, parseBigPaise } from "@/lib/rent/format";
import { friendlyError } from "@/lib/api/errors";
import { ApiError } from "@/lib/api/client";
import type { RentStatusValue } from "@gharsetu/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Payment {
  id: string;
  amountPaise: string;
  isVoided: boolean;
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
  payments?: Payment[];
  lease?: {
    id: string;
    unit?: { id: string; name: string; property?: { id: string; name: string } };
    tenants?: { id: string; name: string }[];
  };
}

interface RentPeriodsResponse {
  data?: RentPeriod[];
  items?: RentPeriod[];
  meta?: { total?: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
}

function formatPeriodMonth(): string {
  return format(new Date(), "MMM yyyy");
}

function sumPaiseStrings(strs: string[]): number {
  return strs.reduce((acc, s) => acc + parseBigPaise(s), 0);
}

// ---------------------------------------------------------------------------
// Recompute modal
// ---------------------------------------------------------------------------

interface RecomputeModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  running: boolean;
}

function RecomputeModal({ open, onClose, onConfirm, running }: RecomputeModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Recompute Accruals" maxWidth="max-w-[420px]">
      <p className="text-sm muted mt-2 mb-6">
        This will run the rent accrual job immediately — flipping overdue statuses and
        recalculating late fees for all active periods. The job is idempotent; running it
        multiple times on the same day is safe.
      </p>
      <div className="flex justify-end gap-3">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={running}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={running}>
          {running ? "Running…" : "Recompute Now"}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  meta,
  color,
}: {
  label: string;
  value: React.ReactNode;
  meta?: string;
  color?: string;
}) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value" style={color ? { color } : undefined}>
        {value}
      </div>
      {meta && <div className="kpi-meta">{meta}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminRentPage() {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  const [overduePeriods, setOverduePeriods] = useState<RentPeriod[]>([]);
  const [allPeriods, setAllPeriods] = useState<RentPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputeOpen, setRecomputeOpen] = useState(false);
  const [recomputeRunning, setRecomputeRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        // Fetch overdue periods (for table + aggregate)
        const [overdueRes, partialRes, paidRes, prepaidRes] = await Promise.allSettled([
          apiFetch<RentPeriodsResponse>("/rent-periods?status=OVERDUE&limit=100"),
          apiFetch<RentPeriodsResponse>("/rent-periods?status=PARTIAL&limit=100"),
          apiFetch<RentPeriodsResponse>("/rent-periods?status=PAID&limit=100"),
          apiFetch<RentPeriodsResponse>("/rent-periods?status=PREPAID&limit=100"),
        ]);

        if (!cancelled) {
          const overdue =
            overdueRes.status === "fulfilled"
              ? overdueRes.value.data ?? overdueRes.value.items ?? []
              : [];
          const partial =
            partialRes.status === "fulfilled"
              ? partialRes.value.data ?? partialRes.value.items ?? []
              : [];
          const paid =
            paidRes.status === "fulfilled"
              ? paidRes.value.data ?? paidRes.value.items ?? []
              : [];
          const prepaid =
            prepaidRes.status === "fulfilled"
              ? prepaidRes.value.data ?? prepaidRes.value.items ?? []
              : [];

          setOverduePeriods(overdue);
          setAllPeriods([...overdue, ...partial, ...paid, ...prepaid]);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchData();
    return () => { cancelled = true; };
  }, [apiFetch]);

  async function handleRecompute() {
    setRecomputeRunning(true);
    try {
      await apiFetch("/jobs/rent-accrual/run", { method: "POST" });
      const now = format(new Date(), "dd/MM/yyyy HH:mm");
      setLastRun(now);
      toast("Accrual job completed. Statuses and late fees have been updated.", "success");
      setRecomputeOpen(false);
      // Refresh data
      setLoading(true);
      const res = await apiFetch<RentPeriodsResponse>("/rent-periods?status=OVERDUE&limit=100");
      setOverduePeriods(res.data ?? res.items ?? []);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : friendlyError(err);
      toast(`Accrual failed: ${msg}`, "error");
    } finally {
      setRecomputeRunning(false);
      setLoading(false);
    }
  }

  // Aggregate computation (client-side, Phase 4 — no aggregate endpoint)
  const collectedPaise = sumPaiseStrings(
    allPeriods
      .filter((p) => p.status === "PAID" || p.status === "PREPAID")
      .map((p) => p.paidPaise),
  );
  const overdueTotalPaise = sumPaiseStrings(
    overduePeriods.map((p) => p.outstandingPaise),
  );
  const partialCount = allPeriods.filter((p) => p.status === "PARTIAL").length;
  const prepaidCount = allPeriods.filter((p) => p.status === "PREPAID").length;

  // Unique tenant count from overdue (by leaseId)
  const tenantsInArrears = new Set(overduePeriods.map((p) => p.leaseId)).size;

  const today = new Date();

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">Rent Overview</h1>
          <div className="page-subtitle">
            {formatPeriodMonth()} · All properties
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastRun && (
            <span className="text-xs muted hidden md:inline">Last recomputed: {lastRun}</span>
          )}
          <button
            type="button"
            className="btn btn-secondary !py-2 !text-sm"
            onClick={() => setRecomputeOpen(true)}
          >
            Recompute Accruals Now
          </button>
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
              <KpiCard
                label="Collected"
                value={paiseStringToINR(String(collectedPaise))}
                meta="PAID + PREPAID periods"
                color="var(--color-status-paid)"
              />
              <KpiCard
                label="Overdue"
                value={paiseStringToINR(String(overdueTotalPaise))}
                meta={`${overduePeriods.length} unit${overduePeriods.length !== 1 ? "s" : ""} · 5+ days late`}
                color="var(--color-status-overdue)"
              />
              <KpiCard
                label="Partial"
                value={partialCount}
                meta="Units · partial payment"
                color={partialCount > 0 ? "var(--color-status-partial)" : undefined}
              />
              <KpiCard
                label="Prepaid"
                value={prepaidCount}
                meta="Excess auto-applied next period"
                color={prepaidCount > 0 ? "var(--color-status-prepaid)" : undefined}
              />
            </>
          )}
        </div>
      </section>

      {/* Overdue tenants table */}
      <section className="section">
        <h3 className="section-title">
          Overdue Tenants — {formatPeriodMonth()}
        </h3>
        <div className="card p-0 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Unit</th>
                <th>Property</th>
                <th>Due Date</th>
                <th>Outstanding</th>
                <th>Late Fee</th>
                <th>Days Late</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonTableRows rows={3} cols={7} />}

              {!loading && overduePeriods.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center muted py-8">
                    No overdue tenants.
                  </td>
                </tr>
              )}

              {!loading &&
                overduePeriods.map((period) => {
                  const tenants =
                    period.lease?.tenants?.map((t) => t.name).join(" + ") ??
                    "—";
                  const unitName = period.lease?.unit?.name ?? "—";
                  const propertyName =
                    period.lease?.unit?.property?.name ?? "—";
                  const daysLate = differenceInCalendarDays(
                    today,
                    parseISO(period.dueDate),
                  );

                  return (
                    <tr key={period.id}>
                      <td className="font-poppins font-semibold text-charcoal">
                        {tenants}
                      </td>
                      <td>{unitName}</td>
                      <td>{propertyName}</td>
                      <td>{formatDate(period.dueDate)}</td>
                      <td>{paiseStringToINR(period.outstandingPaise)}</td>
                      <td style={{ color: "var(--color-status-overdue)" }}>
                        {parseBigPaise(period.lateFeePaise) > 0
                          ? paiseStringToINR(period.lateFeePaise)
                          : "—"}
                      </td>
                      <td>{daysLate > 0 ? daysLate : "—"}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <p className="text-xs muted mt-3">
          Late fee = 2% of outstanding × full weeks overdue. Calculated automatically — PMs do not enter it manually.
        </p>
        {tenantsInArrears > 0 && (
          <p className="text-xs muted mt-1">
            <strong>{tenantsInArrears}</strong> unique lease{tenantsInArrears !== 1 ? "s" : ""} in arrears.
          </p>
        )}
      </section>

      {/* Recompute modal */}
      <RecomputeModal
        open={recomputeOpen}
        onClose={() => setRecomputeOpen(false)}
        onConfirm={handleRecompute}
        running={recomputeRunning}
      />
    </>
  );
}
