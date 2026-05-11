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
import { paiseStringToINR, parseBigPaise, daysOverdue, weeksOverdue } from "@/lib/rent/format";
import { computeLateFeePaise } from "@gharsetu/shared";
import type { RentStatusValue } from "@gharsetu/shared";

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
  unit?: { name?: string; property?: { name?: string } };
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
  amountDuePaise: string;
  lateFeePaise: string;
  dueDate: string;
}) {
  const today = new Date();
  const dueDateObj = parseISO(dueDate);
  const days = daysOverdue(dueDateObj, today);
  const weeks = weeksOverdue(dueDateObj, today);

  if (weeks === 0) return null;

  const amountDue = parseBigPaise(amountDuePaise);
  const lateFeeAPI = parseBigPaise(lateFeePaise);

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
      Late fee = 2% × {paiseStringToINR(amountDuePaise)} × {weeks} week{weeks !== 1 ? "s" : ""} overdue = {paiseStringToINR(lateFeePaise)}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Status border colour helper
// ---------------------------------------------------------------------------

function statusBorderColor(status: RentStatusValue): string {
  switch (status) {
    case "OVERDUE":
      return "var(--color-status-overdue)";
    case "DUE":
      return "var(--color-status-prepaid)";
    case "PARTIAL":
      return "var(--color-status-partial)";
    case "PAID":
    case "PREPAID":
      return "var(--color-status-paid)";
    default:
      return "var(--color-mid-gray)";
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

  const [lease, setLease] = useState<LeaseInfo | null>(null);
  const [periods, setPeriods] = useState<RentPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        // Tenant's own lease (token-scoped)
        const leasesRes = await apiFetch<LeasesResponse>("/leases?status=ACTIVE&limit=1");
        const leaseItems = leasesRes.data ?? leasesRes.items ?? [];
        const myLease = leaseItems[0] ?? null;

        if (!cancelled) setLease(myLease);

        if (myLease) {
          const periodsRes = await apiFetch<RentPeriodsResponse>(
            `/rent-periods?leaseId=${myLease.id}&limit=50`,
          );
          if (!cancelled) {
            const items = periodsRes.data ?? periodsRes.items ?? [];
            setPeriods(items);
          }
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchData();
    return () => { cancelled = true; };
  }, [apiFetch]);

  function initials(name: string): string {
    return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  }

  // Identify the current (most recent open) period
  const currentPeriod = periods.find(
    (p) =>
      p.status === "OVERDUE" ||
      p.status === "PARTIAL" ||
      p.status === "DUE",
  ) ?? periods[0] ?? null;

  // Aggregate KPIs
  const paidTotal = periods
    .filter((p) => p.status === "PAID" || p.status === "PREPAID")
    .reduce((acc, p) => acc + parseBigPaise(p.paidPaise), 0);
  const paidPeriods = periods.filter(
    (p) => p.status === "PAID" || p.status === "PREPAID",
  ).length;
  const monthlyRent = lease?.monthly_rent_paise
    ? parseBigPaise(lease.monthly_rent_paise)
    : null;
  const secDeposit = lease?.security_deposit_paise
    ? parseBigPaise(lease.security_deposit_paise)
    : null;
  const outstanding = currentPeriod ? parseBigPaise(currentPeriod.outstandingPaise) : 0;

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
                  {paiseStringToINR(currentPeriod.outstandingPaise)} due
                </div>

                {currentPeriod.status === "OVERDUE" && (
                  <>
                    <p className="text-sm mt-1" style={{ color: "var(--color-status-overdue)" }}>
                      Includes {paiseStringToINR(currentPeriod.lateFeePaise)} late fee
                      {" · "}
                      {daysOverdue(parseISO(currentPeriod.dueDate), today)} calendar days past due date
                    </p>
                    {parseBigPaise(currentPeriod.lateFeePaise) > 0 && (
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
            meta={paidPeriods > 0 ? `${paidPeriods} of ${periods.length} periods` : "No payments yet"}
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
              {periods.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center muted py-8">
                    No payment history yet.
                  </td>
                </tr>
              )}

              {periods.map((period) => {
                // Active (non-voided) payments
                const activePays = (period.payments ?? []).filter((p) => !p.isVoided);
                const latestPay = activePays[activePays.length - 1];

                const showLateFee =
                  parseBigPaise(period.lateFeePaise) > 0 && period.status === "OVERDUE";

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
                      {parseBigPaise(period.paidPaise) > 0 ? (
                        <>
                          {paiseStringToINR(period.paidPaise)}
                          {showLateFee && (
                            <span className="text-xs muted ml-1">(+ late fee)</span>
                          )}
                        </>
                      ) : period.status === "OVERDUE" ? (
                        <>
                          {paiseStringToINR(period.outstandingPaise)}{" "}
                          <span className="text-xs muted">(+ late fee)</span>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {latestPay ? (
                        formatDate(latestPay.paidOn)
                      ) : period.status === "PAID" && period.payments?.length === 0 ? (
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
        <p className="text-xs muted mt-3">
          Periods turn <span className="badge badge-overdue">Overdue</span> 5 calendar days after the due date. Late fees are calculated automatically (2% of outstanding × full weeks overdue).
        </p>
      </section>
    </>
  );
}
