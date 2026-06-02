/* ============================================================================
 * rent-engine.js — single-source rent-collection logic (prototype contract)
 * ----------------------------------------------------------------------------
 * Period-aware, allocator-driven money-in model. Status is ALWAYS computed at
 * read time, never stored. Mirrors docs/planning/RENT_COLLECTION_CONTEXT.md.
 *
 * Late fee (BL-13, month-end-capped variant — decision 2026-06-02):
 *   2% × period-outstanding × full weeks overdue, NON-compounded,
 *   effective_date = min(paymentDate, period_last_day)  ← cap at month-end,
 *   so each period maxes at ~4 weeks ≈ 8% of its outstanding.
 *
 * No frameworks. Attaches window.RentEngine. All money in whole rupees (₹).
 * Dates are DD/MM/YYYY strings on the wire; internally UTC ms at day start.
 * Every lease/payment references the other by numeric id (CLAUDE.md rule #19).
 * ========================================================================== */
(function (global) {
  'use strict';

  // --- Settings (fetched from the Settings page via rent-settings.js) -------
  // Ultimate fallbacks if rent-settings.js hasn't loaded.
  var LATE_FEE_RATE_PERCENT = 2;   // late_fee_rate_percent
  var GRACE_DAYS            = 5;   // late_fee_grace_days
  // Resolve the live values at call time so a Settings change takes effect everywhere.
  function cfgRate() {
    var s = (typeof window !== 'undefined' && window.GHARSETU_RENT_SETTINGS) || null;
    return s && s.lateFeeRatePercent != null ? Number(s.lateFeeRatePercent) : LATE_FEE_RATE_PERCENT;
  }
  function cfgGrace() {
    var s = (typeof window !== 'undefined' && window.GHARSETU_RENT_SETTINGS) || null;
    return s && s.graceDays != null ? Number(s.graceDays) : GRACE_DAYS;
  }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAY_MS = 86400000;

  // --- Date helpers ---------------------------------------------------------
  // Parse 'DD/MM/YYYY' (also tolerant of 'YYYY-MM-DD') → UTC ms at day start.
  function parseDate(s) {
    if (!s) return NaN;
    if (s instanceof Date) return Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
    var m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s))) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
    return NaN;
  }
  function fmtDate(ms) {
    if (isNaN(ms)) return '';
    var d = new Date(ms);
    return String(d.getUTCDate()).padStart(2, '0') + '/' +
           String(d.getUTCMonth() + 1).padStart(2, '0') + '/' + d.getUTCFullYear();
  }
  function daysInMonth(year, month /*1..12*/) { return new Date(Date.UTC(year, month, 0)).getUTCDate(); }
  function periodFirstMs(year, month) { return Date.UTC(year, month - 1, 1); }
  function periodLastMs(year, month) { return Date.UTC(year, month, 0); }
  function periodLabel(year, month) { return MONTHS[month - 1] + ' ' + year; }
  function periodKey(year, month) { return year + '-' + String(month).padStart(2, '0'); }
  function ymCompare(aY, aM, bY, bM) { return aY !== bY ? aY - bY : aM - bM; }
  function nextYM(year, month) { return month >= 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }; }

  function dueDateMs(lease, year, month) {
    var due = Math.min(lease.rentDueDay || 1, daysInMonth(year, month));
    return Date.UTC(year, month - 1, due);
  }

  // --- Money helpers --------------------------------------------------------
  function rupee(n) { return '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN'); }
  function round2(n) { return Math.round(n * 100) / 100; }

  // --- Rent in force for a given period (walks rent-change history) ---------
  // rentChanges: [{ previousRent, newRent, effectiveDate, status }] status 1=Scheduled 2=Applied 3=Cancelled
  function rentForPeriod(lease, year, month) {
    var pFirst = periodFirstMs(year, month);
    var changes = (lease.rentChanges || []).filter(function (c) { return c.status !== 3; }); // not Cancelled
    var applicable = changes
      .filter(function (c) { return parseDate(c.effectiveDate) <= pFirst; })
      .sort(function (a, b) { return parseDate(b.effectiveDate) - parseDate(a.effectiveDate); });
    if (applicable.length) return Number(applicable[0].newRent);
    var earliest = changes.slice().sort(function (a, b) { return parseDate(a.effectiveDate) - parseDate(b.effectiveDate); });
    if (earliest.length) return Number(earliest[0].previousRent);
    return Number(lease.rentAmount);
  }

  // --- Per-period paid totals from the payment history ----------------------
  function paidForPeriod(lease, year, month) {
    var rent = 0, fee = 0, last = NaN;
    (lease.payments || []).forEach(function (p) {
      if (p.periodYear === year && p.periodMonth === month) {
        rent += Number(p.amount) || 0;
        fee += Number(p.lateFee) || 0;
        var pd = parseDate(p.paymentDate);
        if (isNaN(last) || pd > last) last = pd;
      }
    });
    return { rent: rent, fee: fee, lastPaymentMs: last };
  }

  /* Canonical late-fee formula — month-end capped (see header). */
  function computeFeeForPeriod(rentOfPeriod, rentPaidSoFar, year, month, asofMs, lease, rate, grace) {
    rate = rate == null ? cfgRate() : rate;
    grace = grace == null ? cfgGrace() : grace;
    var rentOutstanding = Math.max(0, rentOfPeriod - rentPaidSoFar);
    if (rentOutstanding <= 0) return 0;
    var lastDay = periodLastMs(year, month);
    var effective = Math.min(asofMs, lastDay);          // CAP AT MONTH-END
    var due = dueDateMs(lease, year, month);
    var daysAfterDue = Math.floor((effective - due) / DAY_MS);
    if (daysAfterDue <= grace) return 0;                 // strictly > grace to charge
    var fullWeeks = Math.floor(daysAfterDue / 7);
    if (fullWeeks <= 0) return 0;
    return round2(fullWeeks * (rentOutstanding * rate / 100));
  }

  /* Fee owed for a period at a given moment. If rent is fully paid the fee
     freezes at the last rent-clearing payment date (doc §3.3). */
  function feeOwedAtTime(lease, year, month, asofMs, rate, grace) {
    var rentP = rentForPeriod(lease, year, month);
    var paid = paidForPeriod(lease, year, month);
    if (paid.rent < rentP) return computeFeeForPeriod(rentP, paid.rent, year, month, asofMs, lease, rate, grace);
    var frozenAsof = isNaN(paid.lastPaymentMs) ? asofMs : paid.lastPaymentMs;
    // fee is computed against the pre-final-payment outstanding → use rentPaid minus this period's own rent? No:
    // freeze the meter at the moment rent cleared, on the rent that WAS outstanding then. We approximate with
    // full period rent as the base (the obligation that accrued), capped at month-end, asof = freeze date.
    return computeFeeForPeriod(rentP, 0, year, month, frozenAsof, lease, rate, grace);
  }

  // --- Build every period from lease start → asof (inclusive) ---------------
  function buildPeriods(lease, asofMs, rate, grace) {
    var out = [];
    var startMs = parseDate(lease.startDate);
    var endMs = parseDate(lease.endDate);
    var sY = new Date(startMs).getUTCFullYear(), sM = new Date(startMs).getUTCMonth() + 1;
    var aY = new Date(asofMs).getUTCFullYear(), aM = new Date(asofMs).getUTCMonth() + 1;
    var y = sY, m = sM, guard = 0;
    while (ymCompare(y, m, aY, aM) <= 0 && guard++ < 600) {
      if (!isNaN(endMs) && periodFirstMs(y, m) > endMs) break; // past lease end
      var rentP = rentForPeriod(lease, y, m);
      var paid = paidForPeriod(lease, y, m);
      var rentOut = Math.max(0, rentP - paid.rent);
      var feeOwed = feeOwedAtTime(lease, y, m, asofMs, rate, grace);
      var feeOut = Math.max(0, feeOwed - paid.fee);
      out.push({
        periodYear: y, periodMonth: m, key: periodKey(y, m), label: periodLabel(y, m),
        dueDate: fmtDate(dueDateMs(lease, y, m)),
        rentForPeriod: rentP, rentPaid: paid.rent, rentOutstanding: rentOut,
        feeOwedAsOf: feeOwed, feePaid: paid.fee, feeOutstanding: feeOut,
        settled: rentOut <= 0 && feeOut <= 0
      });
      var nx = nextYM(y, m); y = nx.y; m = nx.m;
    }
    return out;
  }

  function unsettledPeriods(lease, asofMs, rate, grace) {
    return buildPeriods(lease, asofMs, rate, grace).filter(function (p) { return !p.settled; });
  }

  // --- Current-month status (the listing's per-lease row) -------------------
  function computeRentStatus(lease, asofMs, rate, grace) {
    rate = rate == null ? cfgRate() : rate;
    grace = grace == null ? cfgGrace() : grace;
    if (asofMs == null) asofMs = TODAY_MS;
    var aY = new Date(asofMs).getUTCFullYear(), aM = new Date(asofMs).getUTCMonth() + 1;
    var rentCur = rentForPeriod(lease, aY, aM);
    var paidCur = paidForPeriod(lease, aY, aM);
    var outstanding = Math.max(0, rentCur - paidCur.rent);
    var due = dueDateMs(lease, aY, aM);
    var effective = Math.min(asofMs, periodLastMs(aY, aM));
    var daysAfterDue = Math.max(0, Math.floor((effective - due) / DAY_MS));
    var lateFee = computeFeeForPeriod(rentCur, paidCur.rent, aY, aM, asofMs, lease, rate, grace);

    var status;
    if (outstanding <= 0 && paidCur.rent > rentCur) status = 'Prepaid';
    else if (outstanding <= 0) status = 'Paid';
    else if (daysAfterDue > grace && paidCur.rent > 0) status = 'Partial Paid';
    else if (daysAfterDue > grace) status = 'Overdue';
    else if (paidCur.rent > 0) status = 'Partial';
    else status = 'Outstanding';

    var lifetimePaid = 0, count = 0, lastPay = NaN, collectedThisMonth = 0;
    (lease.payments || []).forEach(function (p) {
      lifetimePaid += Number(p.amount) || 0; count++;
      var pd = parseDate(p.paymentDate);
      if (isNaN(lastPay) || pd > lastPay) lastPay = pd;
      // money actually received THIS calendar month (rent + late fee), by payment date
      var pdt = new Date(pd);
      if (!isNaN(pd) && pdt.getUTCFullYear() === aY && pdt.getUTCMonth() + 1 === aM) {
        collectedThisMonth += (Number(p.amount) || 0) + (Number(p.lateFee) || 0);
      }
    });
    var unsettled = unsettledPeriods(lease, asofMs, rate, grace);
    var totalOutstanding = unsettled.reduce(function (s, p) { return s + p.rentOutstanding + p.feeOutstanding; }, 0);
    var feeOutstandingTotal = unsettled.reduce(function (s, p) { return s + p.feeOutstanding; }, 0);

    /* displayStatus — the badge shown in the LISTING. Reflects the lease's
       worst unsettled state across all periods (arrears-aware), not just the
       current month, so an unpaid March still reads "Overdue" on June 2. */
    var displayStatus;
    if (totalOutstanding <= 0) {
      var hasAdvance = (lease.payments || []).some(function (p) {
        return ymCompare(p.periodYear, p.periodMonth, aY, aM) > 0;
      });
      displayStatus = (paidCur.rent > rentCur || hasAdvance) ? 'Prepaid' : 'Paid';
    } else {
      var oldest = unsettled[0];
      var oDue = dueDateMs(lease, oldest.periodYear, oldest.periodMonth);
      var oEff = Math.min(asofMs, periodLastMs(oldest.periodYear, oldest.periodMonth));
      var oOverdue = Math.floor((oEff - oDue) / DAY_MS) > grace;
      var anyPaid = unsettled.some(function (p) { return p.rentPaid > 0 || p.feePaid > 0; });
      if (oOverdue) displayStatus = anyPaid ? 'Partial Paid' : 'Overdue';
      else displayStatus = anyPaid ? 'Partial' : 'Outstanding';
    }

    return {
      leaseId: lease.id, leaseCode: lease.leaseCode,
      tenantName: lease.tenantName, coTenantCount: (lease.coTenants || []).length,
      unitLabel: lease.unitLabel, propertyId: lease.propertyId, propertyName: lease.propertyName,
      pmName: lease.pmName, leaseType: lease.leaseType, roomLabel: lease.roomLabel || '',
      rentAmount: rentCur, rentDueDay: lease.rentDueDay,
      leaseStart: lease.startDate, leaseEnd: lease.endDate, leaseStatus: lease.status,
      securityDeposit: Number(lease.depositAmount) || 0,
      dueDate: fmtDate(due), daysAfterDue: daysAfterDue,
      outstanding: outstanding, lateFee: lateFee, lateFeePaid: paidCur.fee,
      totalPaid: paidCur.rent, lifetimePaid: lifetimePaid, collectedThisMonth: collectedThisMonth, paymentCount: count,
      lastPaymentDate: isNaN(lastPay) ? null : fmtDate(lastPay),
      totalOutstanding: totalOutstanding, feeOutstandingTotal: feeOutstandingTotal,
      status: status, displayStatus: displayStatus, unsettledPeriods: unsettled
    };
  }

  /* Oldest-first allocator. Distributes `amount` across periods from lease
     start, skipping fully-settled ones, overflowing forward to advance
     periods until cash runs out or lease end is passed. Selected period is
     NOT an allocation directive — it only seeds the form's default amount. */
  function allocate(lease, paymentDateStr, amount, rate, grace) {
    rate = rate == null ? cfgRate() : rate;
    grace = grace == null ? cfgGrace() : grace;
    var asof = parseDate(paymentDateStr);
    var cash = Math.max(0, Number(amount) || 0);
    var endMs = parseDate(lease.endDate);
    var startMs = parseDate(lease.startDate);
    var y = new Date(startMs).getUTCFullYear(), m = new Date(startMs).getUTCMonth() + 1;
    var rows = [], overflow = false, guard = 0;

    function periodState(yy, mm) {
      var rentP = rentForPeriod(lease, yy, mm);
      var paid = paidForPeriod(lease, yy, mm);
      var rentOut = Math.max(0, rentP - paid.rent);
      var feeOwed = feeOwedAtTime(lease, yy, mm, asof, rate, grace);
      var feeOut = Math.max(0, feeOwed - paid.fee);
      return { rentOut: rentOut, feeOut: feeOut };
    }

    // skip-forward past fully settled periods
    while (guard++ < 600) {
      if (!isNaN(endMs) && periodFirstMs(y, m) > endMs) { return done(); }
      var st = periodState(y, m);
      if (st.rentOut <= 0 && st.feeOut <= 0) { var nx0 = nextYM(y, m); y = nx0.y; m = nx0.m; continue; }
      break;
    }

    while (cash > 0 && guard++ < 600) {
      if (!isNaN(endMs) && periodFirstMs(y, m) > endMs) { overflow = true; break; }
      var s = periodState(y, m);
      var payRent = Math.min(cash, s.rentOut); cash = round2(cash - payRent);
      var payFee = Math.min(cash, s.feeOut); cash = round2(cash - payFee);
      if (payRent > 0 || payFee > 0) {
        rows.push({
          periodYear: y, periodMonth: m, key: periodKey(y, m), label: periodLabel(y, m),
          dueDate: fmtDate(dueDateMs(lease, y, m)),
          amount: round2(payRent), lateFee: round2(payFee), totalDue: round2(s.rentOut + s.feeOut),
          rentDue: round2(s.rentOut), feeDue: round2(s.feeOut),
          rentRemaining: round2(s.rentOut - payRent), feeRemaining: round2(s.feeOut - payFee)
        });
      }
      if (cash <= 0) break;
      var nx = nextYM(y, m); y = nx.y; m = nx.m;
    }
    return done();

    function done() {
      var totalRent = rows.reduce(function (a, r) { return a + r.amount; }, 0);
      var totalFee = rows.reduce(function (a, r) { return a + r.lateFee; }, 0);
      return {
        rows: rows, overflowedPastLeaseEnd: overflow,
        totalRent: round2(totalRent), totalFee: round2(totalFee),
        totalAllocated: round2(totalRent + totalFee),
        unallocated: round2(cash)
      };
    }
  }

  // Ceiling a single Save can apply for this lease at this date.
  function maxPayable(lease, paymentDateStr, rate, grace) {
    var r = allocate(lease, paymentDateStr, Number.MAX_SAFE_INTEGER, rate, grace);
    return r.totalAllocated;
  }

  // Default amount for a chosen period = that period's own rent + fee outstanding.
  function periodDue(lease, year, month, paymentDateStr, rate, grace) {
    var asof = parseDate(paymentDateStr);
    var rentP = rentForPeriod(lease, year, month);
    var paid = paidForPeriod(lease, year, month);
    var rentOut = Math.max(0, rentP - paid.rent);
    var feeOwed = feeOwedAtTime(lease, year, month, asof, rate, grace);
    var feeOut = Math.max(0, feeOwed - paid.fee);
    return { rentOutstanding: rentOut, feeOutstanding: feeOut, totalDue: round2(rentOut + feeOut) };
  }

  /* Cumulative amount needed to SETTLE everything from the oldest period up to
     AND INCLUDING (year, month). Because allocation is oldest-first, choosing a
     later month means clearing every earlier unpaid month too — this is what the
     Amount Received field defaults to (then the user can edit it). */
  function cumulativeDueThrough(lease, year, month, paymentDateStr, rate, grace) {
    var asof = parseDate(paymentDateStr);
    var startMs = parseDate(lease.startDate);
    var endMs = parseDate(lease.endDate);
    var y = new Date(startMs).getUTCFullYear(), m = new Date(startMs).getUTCMonth() + 1;
    var total = 0, guard = 0;
    while (ymCompare(y, m, year, month) <= 0 && guard++ < 600) {
      if (!isNaN(endMs) && periodFirstMs(y, m) > endMs) break;
      var rentP = rentForPeriod(lease, y, m);
      var paid = paidForPeriod(lease, y, m);
      var rentOut = Math.max(0, rentP - paid.rent);
      var feeOwed = feeOwedAtTime(lease, y, m, asof, rate, grace);
      var feeOut = Math.max(0, feeOwed - paid.fee);
      total += rentOut + feeOut;
      var nx = nextYM(y, m); y = nx.y; m = nx.m;
    }
    return round2(total);
  }

  // Group a lease's payments into transactions by parentId (for history view).
  function groupTransactions(lease) {
    var byId = {}, parents = [];
    (lease.payments || []).forEach(function (p) { byId[p.id] = p; });
    var groups = {};
    (lease.payments || []).forEach(function (p) {
      var pid = p.parentId == null ? p.id : p.parentId;
      (groups[pid] = groups[pid] || []).push(p);
    });
    Object.keys(groups).forEach(function (pid) {
      var rows = groups[pid].slice().sort(function (a, b) {
        return ymCompare(a.periodYear, a.periodMonth, b.periodYear, b.periodMonth);
      });
      var head = byId[pid] || rows[0];
      parents.push({
        parentId: Number(pid),
        payNo: '#PAY-' + String(pid).padStart(4, '0'),
        paymentDate: head.paymentDate, methodName: head.methodName, reference: head.reference || '',
        rows: rows,
        periodsCovered: rows.map(function (r) { return periodLabel(r.periodYear, r.periodMonth); }),
        totalRent: rows.reduce(function (a, r) { return a + (Number(r.amount) || 0); }, 0),
        totalFee: rows.reduce(function (a, r) { return a + (Number(r.lateFee) || 0); }, 0)
      });
    });
    return parents.sort(function (a, b) { return parseDate(b.paymentDate) - parseDate(a.paymentDate); });
  }

  // Fixed "today" for the prototype's worked examples (Asia/Kolkata 2026-06-02).
  var TODAY_MS = Date.UTC(2026, 5, 2);

  global.RentEngine = {
    LATE_FEE_RATE_PERCENT: LATE_FEE_RATE_PERCENT,
    GRACE_DAYS: GRACE_DAYS,
    TODAY_MS: TODAY_MS,
    MONTHS: MONTHS,
    parseDate: parseDate, fmtDate: fmtDate, rupee: rupee,
    periodLabel: periodLabel, periodKey: periodKey, dueDateMs: dueDateMs,
    rentForPeriod: rentForPeriod, paidForPeriod: paidForPeriod,
    computeFeeForPeriod: computeFeeForPeriod, feeOwedAtTime: feeOwedAtTime,
    buildPeriods: buildPeriods, unsettledPeriods: unsettledPeriods,
    computeRentStatus: computeRentStatus, allocate: allocate, maxPayable: maxPayable,
    periodDue: periodDue, cumulativeDueThrough: cumulativeDueThrough, groupTransactions: groupTransactions
  };
})(typeof window !== 'undefined' ? window : this);
