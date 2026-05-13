"use client";

/**
 * Tenant Rent — Phase 4.
 * 1:1 with prototype/tenant/rent.html.
 *
 * Read-only — no record payment button (BL-10).
 * Shows current period, KPI summary, payment history table.
 * Late-fee breakdown when period is OVERDUE.
 */

import { useState, useEffect } from "react";
import { parseISO, format } from "date-fns";
import { formatDateOnlyIST } from "@/lib/locale";
import { useAuth } from "@/lib/auth/context";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SkeletonKpi } from "@/components/ui/Skeleton";
import { SkeletonTableRows } from "@/components/ui/Skeleton";
import { Pagination } from "@/components/ui/Pagination";
import { usePaginatedList } from "@/lib/pagination/usePaginatedList";
import { paiseStringToINR, parseBigPaise, daysOverdue, weeksOverdue } from "@/lib/rent/format";
import { computeLateFeePaise, RentPeriodStatusEnum } from "@gharsetu/shared";
import { RentChangeBanner } from "@/components/tenant/RentChangeBanner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Payment {
  id: string;
  rentPeriodId: string;
  amountPaise: string;
  method: string;
  reference?: string | null;
  paidOn: string;
  isVoided: boolean;
}

interface RentPeriod {
  id: number | string;
  leaseId: number | string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amountDuePaise: string | number;
  lateFeePaise: string | number;
  paidPaise: string | number;
  outstandingPaise: string | number;
  // API returns SMALLINT after Step 1 migration; accept string for legacy
  status: number | string;
  lastAccruedAt: string | null;
  payments?: Payment[];
}

interface RentPeriodsResponse {
  data?: RentPeriod[];
  items?: RentPeriod[];
}

interface LeaseInfo {
  id: string;
  monthly_rent_paise?: string;
  security_deposit_paise?: string;
  rent_due_day?: number;
  unit?: { id?: number | string; name?: string; property?: { name?: string } };
  tenants?: { id: string; name: string }[];
}

interface LeasesResponse {
  data?: LeaseInfo[];
  items?: LeaseInfo[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  return formatDateOnlyIST(iso);
}

function formatPeriodLabel(periodStart: string): string {
  try {
    return format(parseISO(periodStart), "MMM yyyy");
  } catch {
    return periodStart;
  }
}

/**
 * Late fee breakdown component per BL-13 worked example.
 * "Late fee = 2% × ₹{rent} × {weeks} weeks overdue = ₹{fee}"
 *
 * Also performs a defensive check against the API value.
 */
function LateFeeBreakdown({
  amountDuePaise,
  lateFeePaise,
  dueDate,
}: {
  amountDuePaise: string | number;
  lateFeePaise: string | number;
  dueDate: string;
}) {
  const amountDuePaiseStr = String(amountDuePaise);
  const lateFeePaiseStr = String(lateFeePaise);
  const today = new Date();
  const dueDateObj = parseISO(dueDate);
  const days = daysOverdue(dueDateObj, today);
  const weeks = weeksOverdue(dueDateObj, today);

  if (weeks === 0) return null;

  const amountDue = parseBigPaise(amountDuePaiseStr);
  const lateFeeAPI = parseBigPaise(lateFeePaiseStr);

  // Defensive check — compute expected and compare
  const expected = computeLateFeePaise(BigInt(amountDue), days);
  if (expected !== BigInt(lateFeeAPI)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[GharSetu] Late fee mismatch: API says ${lateFeeAPI} paise, computed ${expected.toString()} paise for ${days} days overdue.`,
    );
  }

  return (
    <p className="text-sm mt-2" style={{ color: "var(--color-status-overdue)" }}>
      Late fee = 2% × {paiseStringToINR(amountDuePaiseStr)} × {weeks} week{weeks !== 1 ? "s" : ""} overdue = {paiseStringToINR(lateFeePaiseStr)}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Status border colour helper
// ---------------------------------------------------------------------------

function statusBorderColor(status: number | string): string {
  // Accept both numeric codes (new API) and legacy strings
  if (typeof status === "number") {
    switch (status) {
      case RentPeriodStatusEnum.OVERDUE: return "var(--color-status-overdue)";
      case RentPeriodStatusEnum.DUE: return "var(--color-status-prepaid)";
      case RentPeriodStatusEnum.PARTIAL: return "var(--color-status-partial)";
      case RentPeriodStatusEnum.PAID:
      case RentPeriodStatusEnum.PREPAID: return "var(--color-status-paid)";
      default: return "var(--color-mid-gray)";
    }
  }
  switch (status) {
    case "OVERDUE": return "var(--color-status-overdue)";
    case "DUE": return "var(--color-status-prepaid)";
    case "PARTIAL": return "var(--color-status-partial)";
    case "PAID":
    case "PREPAID": return "var(--color-status-paid)";
    default: return "var(--color-mid-gray)";
  }
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

export default function TenantRentPage() {
  const { user, apiFetch } = useAuth();

  // Fetch tenant's active lease for KPI context
  const [lease, setLease] = useState<LeaseInfo | null>(null);
  const [leaseLoading, setLeaseLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchLease() {
      setLeaseLoading(true);
      try {
        const res = await apiFetch<LeasesResponse>("/leases?status=ACTIVE&limit=1");
        const items = res.data ?? res.items ?? [];
        if (!cancelled) setLease(items[0] ?? null);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLeaseLoading(false);
      }
    }
    void fetchLease();
    return () => { cancelled = true; };
  }, [apiFetch]);

  // Paginated rent periods for the history table
  const historyExtraQuery: Record<string, string | undefined> = {};
  if (lease?.id) historyExtraQuery.leaseId = String(lease.id);

  const {
    items: periods,
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
    extraQuery: lease?.id ? historyExtraQuery : undefined,
    pageSize: 10,
  });

  // Separate lightweight fetch for KPI aggregation (current period + totals)
  // Using a larger limit since a tenant typically has <24 periods per year
  const [allPeriods, setAllPeriods] = useState<RentPeriod[]>([]);
  useEffect(() => {
    if (!lease?.id) return;
    let cancelled = false;
    apiFetch<{ data?: RentPeriod[]; items?: RentPeriod[] }>(
      `/rent-periods?leaseId=${String(lease.id)}&limit=100`
    )
      .then((res) => {
        if (!cancelled) {
          setAllPeriods(res.data ?? res.items ?? []);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiFetch, lease?.id]);

  const loading = leaseLoading;

  function initials(name: string): string {
    return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  }

  // Helpers for status comparison (numeric or string)
  function isStatus(s: number | string, ...names: string[]): boolean {
    if (typeof s === "number") {
      const codeMap: Record<string, number> = {
        OVERDUE: RentPeriodStatusEnum.OVERDUE, PARTIAL: RentPeriodStatusEnum.PARTIAL,
        DUE: RentPeriodStatusEnum.DUE, PAID: RentPeriodStatusEnum.PAID,
        PREPAID: RentPeriodStatusEnum.PREPAID, UPCOMING: RentPeriodStatusEnum.UPCOMING,
      };
      return names.some((n) => s === codeMap[n]);
    }
    return names.includes(s as string);
  }

  // Identify the current (most recent open) period from all-periods fetch
  const currentPeriod = allPeriods.find(
    (p) => isStatus(p.status, "OVERDUE", "PARTIAL", "DUE"),
  ) ?? allPeriods[0] ?? null;

  // Aggregate KPIs from all periods
  const paidTotal = allPeriods
    .filter((p) => isStatus(p.status, "PAID", "PREPAID"))
    .reduce((acc, p) => acc + parseBigPaise(String(p.paidPaise)), 0);
  const paidPeriods = allPeriods.filter(
    (p) => isStatus(p.status, "PAID", "PREPAID"),
  ).length;
  const monthlyRent = lease?.monthly_rent_paise
    ? parseBigPaise(lease.monthly_rent_paise)
    : null;
  const secDeposit = lease?.security_deposit_paise
    ? parseBigPaise(lease.security_deposit_paise)
    : null;
  const outstanding = currentPeriod ? parseBigPaise(String(currentPeriod.outstandingPaise)) : 0;

  const today = new Date();

  if (loading) {
    return (
      <>
        <header className="topbar">
          <div>
            <h1 className="page-title">My Rent</h1>
            <div className="page-subtitle">Loading…</div>
          </div>
        </header>
        <section className="section">
          <div className="kpi-grid">
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="page-title">My Rent</h1>
          <div className="page-subtitle">
            {lease?.unit?.name ? `Unit ${lease.unit.name}` : ""}
            {lease?.unit?.property?.name ? ` · ${lease.unit.property.name}` : ""}
            {lease?.rent_due_day
              ? ` · Due on the ${lease.rent_due_day}${
                  lease.rent_due_day === 1
                    ? "st"
                    : lease.rent_due_day === 2
                    ? "nd"
                    : lease.rent_due_day === 3
                    ? "rd"
                    : "th"
                } of each month`
              : ""}
          </div>
        </div>
        <div className="topbar-user">
          <span className="hidden md:inline">{user?.name}</span>
          <span className="avatar" aria-hidden="true">
            {user?.name ? initials(user.name) : "—"}
          </span>
        </div>
      </header>

      {/* Rent-change notice — only shown if there's a pending schedule. */}
      {lease?.unit?.id !== undefined && <RentChangeBanner unitId={lease.unit.id} />}

      {/* Current period */}
      {currentPeriod && (
        <section className="section">
          <h3 className="section-title">Current Period</h3>
          <div
            className="card border-l-4"
            style={{ borderLeftColor: statusBorderColor(currentPeriod.status) }}
          >
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <div className="flex gap-2 items-center mb-2">
                  <StatusBadge status={currentPeriod.status} />
                  <span className="text-sm muted">
                    Period: {formatPeriodLabel(currentPeriod.periodStart)} · Due {formatDate(currentPeriod.dueDate)}
                  </span>
                </div>
                <div className="font-poppins font-bold text-2xl text-charcoal">
                  {paiseStringToINR(String(currentPeriod.outstandingPaise))} due
                </div>

                {isStatus(currentPeriod.status, "OVERDUE") && (
                  <>
                    <p className="text-sm mt-1" style={{ color: "var(--color-status-overdue)" }}>
                      Includes {paiseStringToINR(String(currentPeriod.lateFeePaise))} late fee
                      {" · "}
                      {daysOverdue(parseISO(currentPeriod.dueDate), today)} calendar days past due date
                    </p>
                    {parseBigPaise(String(currentPeriod.lateFeePaise)) > 0 && (
                      <LateFeeBreakdown
                        amountDuePaise={currentPeriod.amountDuePaise}
                        lateFeePaise={currentPeriod.lateFeePaise}
                        dueDate={currentPeriod.dueDate}
                      />
                    )}
                  </>
                )}

                <p className="text-sm muted mt-3">
                  Payment is recorded by your Property Manager after you pay them. Pay via UPI / NEFT / Cash / Cheque as usual.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {!currentPeriod && !loading && (
        <div className="alert mb-6">
          <div>No active rent period found. Contact your Property Manager if you expect one.</div>
        </div>
      )}

      {/* KPI summary */}
      <section className="section">
        <div className="kpi-grid">
          <KpiCard
            label="Monthly Rent"
            value={monthlyRent !== null ? paiseStringToINR(String(monthlyRent)) : "—"}
            meta="Locked at signing"
          />
          <KpiCard
            label="Security Deposit"
            value={secDeposit !== null ? paiseStringToINR(String(secDeposit)) : "—"}
            meta="Refunded at lease end"
          />
          <KpiCard
            label="Outstanding"
            value={
              outstanding > 0
                ? paiseStringToINR(String(outstanding))
                : currentPeriod
                ? "₹0"
                : "—"
            }
            meta={outstanding > 0 ? "Incl. late fee" : "All paid up"}
            color={outstanding > 0 ? "var(--color-status-overdue)" : "var(--color-status-paid)"}
          />
          <KpiCard
            label="Paid this year"
            value={paidTotal > 0 ? paiseStringToINR(String(paidTotal)) : "—"}
            meta={paidPeriods > 0 ? `${paidPeriods} of ${allPeriods.length} periods` : "No payments yet"}
            color={paidTotal > 0 ? "var(--color-status-paid)" : undefined}
          />
        </div>
      </section>

      {/* Payment history */}
      <section className="section">
        <h3 className="section-title">Payment History</h3>
        <div className="card p-0 overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Amount</th>
                <th>Paid On</th>
                <th>Method</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {periodsLoading && <SkeletonTableRows rows={4} cols={7} />}

              {!periodsLoading && periods.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center muted py-8">
                    No payment history yet.
                  </td>
                </tr>
              )}

              {!periodsLoading && periods.map((period) => {
                // Active (non-voided) payments
                const activePays = (period.payments ?? []).filter((p) => !p.isVoided);
                const latestPay = activePays[activePays.length - 1];

                const showLateFee =
                  parseBigPaise(String(period.lateFeePaise)) > 0 && isStatus(period.status, "OVERDUE");

                return (
                  <tr key={period.id}>
                    <td className="font-poppins font-semibold text-charcoal">
                      {formatPeriodLabel(period.periodStart)}
                    </td>
                    <td>
                      <StatusBadge status={period.status} />
                    </td>
                    <td>{formatDate(period.dueDate)}</td>
                    <td>
                      {parseBigPaise(String(period.paidPaise)) > 0 ? (
                        <>
                          {paiseStringToINR(String(period.paidPaise))}
                          {showLateFee && (
                            <span className="text-xs muted ml-1">(+ late fee)</span>
                          )}
                        </>
                      ) : isStatus(period.status, "OVERDUE") ? (
                        <>
                          {paiseStringToINR(String(period.outstandingPaise))}{" "}
                          <span className="text-xs muted">(+ late fee)</span>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {latestPay ? (
                        formatDate(latestPay.paidOn)
                      ) : isStatus(period.status, "PAID") && period.payments?.length === 0 ? (
                        <span className="muted">applied from prepay</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {latestPay ? (
                        latestPay.method
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {latestPay?.reference ? (
                        latestPay.reference
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

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
          itemsOnPage={periods.length}
          loading={periodsLoading}
        />

        <p className="text-xs muted mt-3">
          Periods turn <span className="badge badge-overdue">Overdue</span> 5 calendar days after the due date. Late fees are calculated automatically (2% of outstanding × full weeks overdue).
        </p>
      </section>
    </>
  );
}
