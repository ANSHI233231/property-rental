# Feature plan — Record Payment: period-first billing model

| Field | Value |
|---|---|
| Status         | proposed |
| Started        | 2026-06-02 |
| Shipped        | — |
| SRS row        | BL-10, BL-11, BL-12, BL-13 (rent/late-fee) — no rule change; period-first is a UI/data-model rework |
| Test cases     | TC-RP-PF-01..14 (below) |
| Prototype todo | row in `docs/planning/prototype-changes.md` on ship |

---

## 1. Requirement (as given)
> "On rent collection / Record Payment, we need to collect against a **billing period** — without it, how do we collect? Based on that period and the payment date we show the **late fee**, and that billing period keeps showing until the month's amount is received." (Reference: a period-first Record Payment screen from another portal.)

**Decisions locked with the user (2026-06-02):**
- **Plan first, no code yet.**
- **Late-fee rule stays BL-13 as-is** — 2% × outstanding × **full weeks** overdue, **non-compounded**, **NO month-end cap** (the reference screenshot's "capped at month-end" is **dropped**; BL-13 is sacrosanct).

## 2. Plan

### 2.1 Shift: amount-first → period-first
Today `admin/record-payment.html` is **amount-first**: type an amount → it auto-allocates oldest-due-first across months (rent + late fee per overdue month) in an allocation table. We rework it so the **billing period is the primary input** (you can't record a payment without choosing the month it's for); the late fee and amount derive from the chosen period + payment date. The existing allocation/late-fee maths is reused under the hood.

### 2.2 Data model — per-lease billing periods
Each lease carries `periods[]`, one per month from lease start → current month (and the next upcoming due). Each period:
```
{ key: '2026-02', label: 'February 2026',
  dueDate: '01/02/2026',          // due day from the lease
  rent: 22000,                    // rent in force for that period (honours rent-change schedule)
  paid: 0,                        // collected so far against this period
  // derived (never stored):
  //   outstandingRent = max(0, rent - paid)
  //   lateFee(paymentDate) = BL-13: 2% × outstandingRent × fullWeeksOverdue(dueDate+grace → paymentDate)
  //   status = settled | partial | outstanding | overdue | upcoming  (computed at query time)
}
```
- **Settled** = `paid ≥ rent + lateFee(today)`. Settled periods drop out of the "unsettled" picker (shown greyed "Settled" if searched).
- A period **remains in the unsettled list until fully settled** — partial payments leave it `partial` and still selectable.
- Late fee is **always derived** (BL-13), never stored — consistent with the rent-page status model we already adopted.

### 2.3 Layout (mirrors the reference, in GharSetu tokens)
**Context cards (top, 4):**
1. **Tenant** — name · unit · property.
2. **Lease details** — Lease ID · Start · End · Due day.
3. **Rent & Fees** — Current rent · Grace period (5 days, BL-12) · Late-fee rate (**2% per full week**, BL-13). *No "Capped At" row* (we don't cap — per the locked decision).
4. **Unsettled** — # unsettled periods · total outstanding rent · total accrued fee · last payment date.

**Step 1 — Billing Period & Payment Date:**
- **Billing Period** = searchable combobox (rule #18-style) listing **unsettled periods** with their state — e.g. *"February 2026 · ₹0 rent + ₹360 fee outstanding"*; settled months appear greyed *"Settled."* Required.
- **Payment Date** (native date / `date-picker.js`, max = today).

**Step 2 — Amount, Method, Notes:**
- **Amount** — auto-fills to the selected period's total due (`outstandingRent + lateFee(paymentDate)`), editable; helper "Max payable for this lease (all periods through lease end): ₹X."
- **Payment Method** — from single-source `payment-methods.js`; **reference field method-aware** and hidden when the method's `refRequired:false` (Cash) — reuse the pattern already wired on invoice-detail.
- **Notes** (optional, 255).

**Live Payment Summary (right rail):** Selected Period · Payment Date · **Rent Allocated** · **Late Fee Allocated** · **Amount** · **Periods Affected** · a "Late fee rule: 2% per full week after a 5-day grace (BL-13)" note.

**Payment History** table (kept).

### 2.4 Behaviour
- Selecting a period fills the summary with **that period's** rent due + late fee (computed from its due date vs the payment date) and auto-fills Amount to its total due.
- Changing **Payment Date** **recomputes the late fee** (more full weeks late → higher fee), live in the summary.
- **Allocation:** the payment applies to the selected period first (rent then fee, oldest-first within the period). If Amount > the period's due, the surplus **rolls to the next unsettled period(s)** oldest-first; any excess beyond all dues becomes **advance/prepaid** (BL-11). "Periods Affected" reflects how many periods the payment touched.
- **Partial** payment → the period stays `partial`/`outstanding` and remains in the picker. **Full** → `settled`, removed from the picker.
- **Record-only** (BL-10 — Admin/PM; tenant/maintenance can't reach this). No edit/adjust; corrections are new payments.

### 2.5 Reuse / tokens
`payment-methods.js` (method + `refRequired`), `searchable-select.js` (period combobox), `date-picker.js`, `toast.js`, existing `.kpi`/`.card`/`.badge`/`.data-table`. The dark context-card band + summary rail from the reference are rebuilt with our navy/charcoal tokens — no new colours.

## 3. Test cases (designed up front)
| TC-ID | Title | Expected |
|----------|-------|----------|
| TC-RP-PF-01 | Period required | Can't save without a billing period selected |
| TC-RP-PF-02 | Period list shows state | Unsettled periods show "₹rent + ₹fee outstanding"; settled show "Settled" |
| TC-RP-PF-03 | Late fee from date | Selecting a period + payment date shows BL-13 fee (2% × outstanding × full weeks after 5-day grace) |
| TC-RP-PF-04 | Fee recomputes on date change | Later payment date → more weeks → higher fee, live in summary |
| TC-RP-PF-05 | No month-end cap | Fee grows with weeks; never capped at month-end (BL-13) |
| TC-RP-PF-06 | Amount auto-fill | Amount pre-fills to selected period's total due (rent + fee), editable |
| TC-RP-PF-07 | Full payment settles | Paying full due marks the period Settled; it leaves the picker |
| TC-RP-PF-08 | Partial keeps period | Partial leaves the period outstanding/partial, still selectable |
| TC-RP-PF-09 | Surplus rolls over | Amount > period due rolls oldest-first into next unsettled period(s); Periods Affected updates |
| TC-RP-PF-10 | Overpayment → prepaid | Excess beyond all dues → advance/prepaid (BL-11) |
| TC-RP-PF-11 | Summary live | Rent Allocated / Late Fee Allocated / Amount / Periods Affected update as the form changes |
| TC-RP-PF-12 | Unsettled card | Count + totals + last payment match the period data |
| TC-RP-PF-13 | Method ref gating | Cash hides the reference field (refRequired:false); others require it |
| TC-RP-PF-14 | Record-only | No edit/adjust; only new payments; logged against Admin (BL-10) |

## 4. Sign-off
- [x] Plan-first (no code). — user
- [x] BL-13 unchanged, no month-end cap. — user
- [ ] Confirm: **rework the existing `admin/record-payment.html`** into period-first (replacing amount-first as the primary flow)? Or keep amount-first and add the period picker on top?
- [ ] Confirm single-period select + auto surplus-rollover (vs multi-select periods).
- [ ] Awaiting go-ahead to build.

## 5. Execution log
- 2026-06-02 — plan authored after analysing the reference screenshot vs the current amount-first `record-payment.html`. Decisions: plan-first; BL-13 no cap.

## 6. Files changed (planned)
| File | Change |
|------|--------|
| prototype/admin/record-payment.html | rework to period-first: context cards, Billing Period combobox, per-period state, late-fee-by-date, live Payment Summary; reuse allocation maths + history |
| prototype/admin/rent.html | (no change — Record Payment entry button already links here) |
| docs/planning/prototype-changes.md | ledger row on ship |

## 7. App-port
Server returns each lease's billing periods with per-period `outstanding_rent` and a **derived** late fee (BL-13) for a given payment date; the payment posts against a `period_id` (or allocates oldest-first across periods). BL-10 (Admin/PM only), BL-11 (overpayment → prepaid credit), BL-12 (overdue at due+5), BL-13 (2%×outstanding×full weeks, non-compounded, no cap) all enforced server-side. Status is computed, never stored.

## 9. Cross-references
- `admin/record-payment.html` (current amount-first page), `admin/rent.html` (rent roll), `admin/lease-detail.html` Rent Collection schedule.
- `assets/payment-methods.js` (method + refRequired), `assets/searchable-select.js`, `assets/date-picker.js`.
- BL-10/11/12/13 (SRS §5). Rent-page query-time status model (`2026-06-01-rent-collection-completion.md`) — same "status is derived, not stored" principle.
