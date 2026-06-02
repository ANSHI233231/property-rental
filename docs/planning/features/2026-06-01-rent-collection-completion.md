# Feature plan — Rent Collection page completion

| Field | Value |
|---|---|
| Status         | in-progress |
| Started        | 2026-06-01 |
| Shipped        | — |
| SRS row        | BL-10/11/12/13 (rent), §4 Rent module — payment-status model added to NR set |
| Test cases     | TC-RENT-COMP-01..14 |
| Prototype todo | rows in `docs/planning/prototype-changes.md` |

---

## 1. Requirement (as given, across several messages + reference screenshots)

> "Complete the rent collection page first. Show **Total Due · Collected · Outstanding · Overdue** on the top tiles. Add one more tab — a **Portfolio summary** tab (the reference screenshots — By Lease / By Building / Portfolio, Portfolio Summary card + Month-by-Month Trend — are the target we want to achieve). Payment status of a lease must be one of **Paid / Partially Paid / Outstanding / Overdue / Prepaid**, and these are **never stored** — they are **calculated at query time from the collected amount** (vs amount due and due date)."

Reference screenshots also exposed a bug to avoid: **Collection Rate 507%** (collected ₹1,77,599 vs due ₹35,000) — collected summed across all-time while "due" was a single month.

## 2. Plan

### 2.1 Top KPI tiles — DONE
`Total Due · Collected · Outstanding · Overdue` where **Total Due = Collected + Outstanding** (reconciles by construction); Overdue is a **count** of leases past due (+ "N leases past due" meta), not a ₹ amount. Computed from the same `ROSTER × MONTHS` data as the table for the active scope.

### 2.2 Payment-status model (query-time, never stored) — CORE
A lease's status **for a billing period** is derived from `due` (period rent), `collected` (Σ payments allocated to that period), the period **due date**, and **today** (+ grace = 5 days, BL-12). Precedence (mutually exclusive):

| # | Condition | Status | Badge |
|---|-----------|--------|-------|
| 1 | collected > due | **Prepaid** | `badge-prepaid` (blue) |
| 2 | collected === due | **Paid** | `badge-paid` (green) |
| 3 | collected < due **and** today > dueDate + grace | **Overdue** | `badge-overdue` (red) |
| 4 | collected === 0 (and within grace) | **Outstanding** | `badge-closed` (grey) |
| 5 | 0 < collected < due (and within grace) | **Partially Paid** | `badge-partial` (amber) |

- Implemented as `computeStatus(due, collected, dueDateISO, todayISO, graceDays)` — pure function, no stored status.
- The mock `ROSTER` stores only **collected (`mp`)** + a **due day (`dd`)** per lease; the old stored `ms` status field is removed (status is computed). This teaches the right pattern for the app port (status is a *derivation*, never a column).
- Prototype clock aligned to **June 2026** (matches reference + global `currentDate` 2026-06-01); `TODAY` set mid-month so the dataset exhibits all five statuses. Past months render Paid (collected in full).

### 2.3 Tabs — add Portfolio (3rd view)
Current view tabs: **Lease-wise** (= reference "By Lease") and **Property-wise** (= reference "By Building"). Add a third **Portfolio** tab:
- **Portfolio Summary card** — Total Properties · Active Leases · Monthly Due · **Collection Rate** (collected ÷ due for the *same* period; capped/clamped so it can't read 507% — Prepaid excess does not inflate the rate above 100% of due).
- **Month-by-Month Trend** table — Month · Due · Collected · Outstanding · Rate, one row per month in `MONTHS`, each computed over that month only (so Due and Collected are the *same* period → rate sane).
- Shares the Month filter; tabs reset filters on switch (existing behaviour).
- (Tab labels: keeping Lease-wise/Property-wise; optional rename to By Lease/By Building to match the reference is a 1-line change — flagged, not done unless asked.)

### 2.4 Reconciliation / 507% fix
- Collection Rate everywhere = `collected / due` computed over the **same scope/period**; never collected(all-time) ÷ due(one-month).
- Prepaid advance is shown as a separate signal (Standing "In advance" / Prepaid status), not folded into a >100% rate.

### 2.5 Filter tiles
Single-month view tiles become **All · Paid · Partially Paid · Outstanding · Overdue · Prepaid** (match the status model). Cumulative view keeps All · Cleared · Due · In advance. Tiles call `Paginator.setFilter` against the computed `data-status`.

### 2.6 Tokens / data
Reuse existing badges (no new tokens). `ROSTER`/`MONTHS` stay the single source feeding rows + KPIs + portfolio so all figures reconcile. Numeric-id discipline unchanged.

## 3. Test cases

| TC-ID | Title | Expected |
|----------|-------|----------|
| TC-RENT-COMP-01 | Tiles set | Total Due · Collected · Outstanding · Overdue; Total Due = Collected + Outstanding |
| TC-RENT-COMP-02 | Overdue tile is a count | Shows N + "N leases past due" |
| TC-RENT-COMP-03 | Paid status | collected === due → Paid (green) |
| TC-RENT-COMP-04 | Partially Paid | 0<collected<due, within grace → Partially Paid (amber) |
| TC-RENT-COMP-05 | Outstanding | collected 0, within grace → Outstanding (grey) |
| TC-RENT-COMP-06 | Overdue | collected<due, past dueDate+5 → Overdue (red) |
| TC-RENT-COMP-07 | Prepaid | collected>due → Prepaid (blue) |
| TC-RENT-COMP-08 | Status not stored | No `ms`/status field in ROSTER; statuses derived by `computeStatus` |
| TC-RENT-COMP-09 | Filter tiles | All/Paid/Partially Paid/Outstanding/Overdue/Prepaid filter the rows |
| TC-RENT-COMP-10 | Portfolio tab exists | Third tab renders Portfolio Summary + Month-by-Month Trend |
| TC-RENT-COMP-11 | Collection Rate sane | Rate = collected/due same-period; never >100% from cross-period |
| TC-RENT-COMP-12 | Trend reconciles | Each month row: Due, Collected, Outstanding=Due−Collected, Rate |
| TC-RENT-COMP-13 | KPIs reconcile with rows | Σ row Billed = Total Due; Σ Collected = Collected tile |
| TC-RENT-COMP-14 | Month switch | KPIs + rows + portfolio re-scope to the chosen month |

## 4. Sign-off (assumptions — flag if wrong)
- Status precedence as in §2.2 (Overdue wins over Partially Paid/Outstanding once past grace). **Assumed.**
- Current month = **June 2026**; `TODAY` mid-June for status variety. **Assumed.**
- Keep tab labels Lease-wise/Property-wise (don't rename to By Lease/By Building). **Assumed.**
- Outstanding badge = grey (`badge-closed`) to distinguish from amber Partially Paid. **Assumed.**

## 5. Execution log
- 2026-06-01 — top tiles done (Total Due/Collected/Outstanding/Overdue).
- 2026-06-01 — **status model implemented**: `computeStatus(due, collected, dueDay)` derives Paid/Partially Paid/Outstanding/Overdue/Prepaid at query time (precedence §2.2); ROSTER now stores only `mp` (collected) + `dd` (due day) — stored `ms` removed; months aligned to June 2026 (`TODAY_DAY=12`, `GRACE_DAYS=5`); badge map + monthly filter tiles updated. Verified: all 5 statuses present (paid 10/partial 2/overdue 4/outstanding 1/prepaid 3), Total Due ₹5,08,500 = Collected ₹4,06,000 + Outstanding ₹1,02,500, Overdue count 4.
- 2026-06-01 — **Portfolio tab added**: 3rd view tab → Portfolio Summary card (Total Properties 4 · Active Leases 20 · Monthly Due · Collection Rate, with progress bar) + Month-by-Month Trend table (Due/Collected/Outstanding/Rate). `monthAgg(key)` computes Due & Collected over the **same** month so the rate is sane — June 80%, past months 100% (**507% cross-period bug avoided**; rate clamped ≤100%, advance shown separately). `render()` toggles table/tiles/filters vs the portfolio cards. Inline script parses OK. **Done; no commit.**

## 6. Files changed (planned)
| File | Change |
|------|--------|
| prototype/admin/rent.html | KPI tiles (done); `computeStatus` query-time model; `cellFor`/`badge`/tiles; ROSTER → collected+dueDay (drop stored status); current month → June; NEW Portfolio tab (summary + trend); collection-rate reconciliation |
| docs/planning/prototype-changes.md | ledger rows |
| docs/product/SRS_Document.md | add payment-status-is-derived rule (NR) on ship |

## 7. App-port
Status is computed in the query/serializer from `SUM(payments for period)` vs the period's `amount_due` and due date (+ grace) — never a stored column. Collection rate = collected/due per the requested scope. Portfolio = group-by-org rollup + per-month aggregate. BL-10..13 unchanged.

## 8. Cross-references
- `admin/rent.html` (this page), `admin/leases.html` (lease-status filter — distinct from payment status), `admin/record-payment.html` (allocation oldest-due-first).
- BL-12 (overdue at +5 days), BL-13 (late fee), `2026-06-01-rent-views-and-lease-collection-schedule.md`.
