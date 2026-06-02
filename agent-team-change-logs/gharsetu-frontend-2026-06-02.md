# gharsetu-frontend — change log — 2026-06-02

## Task 1 — Rent Collection: 4-page engine-driven rework

**Status:** Completed
**Started:** 2026-06-02
**Completed:** 2026-06-02

**Changes:**
- `prototype/admin/rent.html` — full rework: replaced static mock data with engine-computed rows from `D.all()`. 4 KPI tiles (Total Due, Collected, Outstanding, Overdue) computed over full scope, never filtered. 3 tabs: By Lease (default, paginated table, status/search/property filters with searchable property dropdown), By Building (per-property groupings with collection-rate progress bars coloured green/amber/red), Portfolio (summary card + stub trend table). Combined Property·Unit(·Room) column (single cell). Status/action columns use `displayStatus` (arrears-aware). Record Payment links to `record-payment.html?lease={id}` for non-paid rows.
- `prototype/pm/rent-collection.html` — full rework: PM chrome (Sunita Arora), scope via `D.forPm([1,2,4])` (Green Valley + Sai Heights + Mayur Vihar Apartments). Same 4 KPI tiles, By Lease + By Building tabs (no Portfolio). PM Record Payment links point to `pm/record-payment.html?lease={id}`.
- `prototype/pm/record-payment.html` — NEW file: PM chrome cloned from pm/rent-collection.html. Lease dropdown scoped to `D.forPm([1,2,4])` only. Back-link and Cancel go to `rent-collection.html`. Success/audit copy says "Property Manager". Same period-first UX, allocation preview, sticky summary, and payment history as admin reference page. All engine calls identical to `admin/record-payment.html`.
- `prototype/tenant/rent.html` — full rework: Tenant chrome (Raj Sharma, tenantId=1, primary on L1 with co-tenant Priya Sharma). Scope via `D.forTenant(1)`. 4 cumulative KPI tiles (Monthly Rent, Total Paid, Security Deposit, Outstanding). Per-lease Current Month card with bordered status. Merged payment history table using `E.groupTransactions()` per lease plus pending/unsettled rows; 10 columns. No Record Payment button anywhere (read-only).

**Files Changed:**
- `/Users/aayushsaini/projects/property-rental/prototype/admin/rent.html` (reworked)
- `/Users/aayushsaini/projects/property-rental/prototype/pm/rent-collection.html` (reworked)
- `/Users/aayushsaini/projects/property-rental/prototype/pm/record-payment.html` (created)
- `/Users/aayushsaini/projects/property-rental/prototype/tenant/rent.html` (reworked)

**Syntax check:** All 4 files: ✓ — All inline scripts parse.

**Notes:**
- Do NOT edit: `rent-engine.js`, `rent-data.js`, `payment-methods.js`, `admin/record-payment.html` (verified as contract, untouched).
- PM scope: propertyIds [1,2,4] = Green Valley (L1,L2,L6), Sai Heights (L3,L7), Mayur Vihar Apartments (L5,L8). PM identity: Sunita Arora (consistent with existing pm/ pages).
- Tenant: Raj Sharma (tenantId=1), lease L1 (Unit 3A, Green Valley). Co-tenant: Priya Sharma.

---

## Task 2 — Rent engine + canonical data + admin Record Payment (orchestrator-built core)
**Status:** Completed · **Started/Completed:** 2026-06-02 · prototype-only, no commit. This is the foundation Task 1 builds on. Per `docs/planning/RENT_COLLECTION_CONTEXT.md` + `docs/planning/features/2026-06-02-record-payment-period-first.md`.
- **NEW `assets/rent-engine.js`** — single-source pure logic: `parseDate/fmtDate/rupee`, `rentForPeriod` (rent-change-history aware), `computeFeeForPeriod` (**month-end-capped** late fee — 2% × period-outstanding × full weeks after 5-day grace, `effective=min(payDate, monthEnd)` ⇒ ~8%/period max), `feeOwedAtTime` (frozen-fee), `buildPeriods`/`unsettledPeriods`, `computeRentStatus` (current-month status + arrears-aware `displayStatus` + `unsettledPeriods[]`), `allocate` (oldest-first, overflow-to-advance), `maxPayable`, `periodDue`, `groupTransactions`. Fixed `TODAY_MS` = 2026-06-02.
- **NEW `assets/rent-data.js`** — canonical 8-lease roster (numeric ids, both lease types), rich payment histories demonstrating every status (Overdue/Paid/Partial Overdue/Prepaid/Outstanding/Partial). Role-scope helpers `all/byId/forPm/forTenant/tenantsLabel`. Status/fees never stored — computed by the engine.
- **`admin/record-payment.html`** — reworked amount-first → **period-first**: lease selector → 4 context cards (Tenant / Lease details / Rent & fees / Unsettled) · Billing-Period searchable dropdown (unsettled periods + one advance) · Payment Date · Amount (clamped to `maxPayable`) · Method (payment-methods.js, refRequired gating) · live **Allocation preview** (oldest-first) · sticky **Payment summary** · grouped **Payment history** (`#PAY-NNNN` by transaction). Record-only (BL-10).
- **DECISION (user, 2026-06-02):** adopt the reference doc's **month-end cap** on late fee — this **changes BL-13** (was uncapped). SRS §5 BL-13 text + Settings "Late fee" copy still need re-sync (Working rule #9) — flagged, not yet done.
- **Verification (orchestrator):** Node harness over engine+data confirmed every displayStatus, oldest-first allocation (₹50k on L1 → Mar/Apr/May), 8%/period cap (L4), the doc's day-5/6/12 fee examples (0/0/₹200), prepaid + transaction grouping. All inline scripts parse.

---

## Task 3 — Security portal fixes (role label · single-source data · gate card)
**Status:** Completed · prototype-only, no commit. User-reported issues.
- **`security/profile.html`** — was a half-converted PM profile. Fixed identity to the Security Guard: avatar RG, **Ramesh Gupta**, role **Security Guard**, email ramesh@gharsetu.in; replaced "Assigned properties/Past assignments (PM)" with **Assigned gates** + **Shift**; helper line reworded to gate assignments; Recent Activity rows swapped from PM actions (recorded payment / closed maintenance / rent reminder) to gate actions (checked in / logged gate arrival / checked out / denied / signed in).
- **NEW `assets/security-visitors.js`** — single source for the gate portal: canonical 12-visitor `LIST` (status awaiting/pending/approved/checked-in/checked-out/denied; gate vs preapproved), `summary()` counts, `byStatus()`, property-label map.
- **`security/visitors.html`** — table body now rendered from the single source (was static rows); **fixed a pre-existing off-by-one** in the row-action cell indices (the leading serial cell had shifted when/status/actions to cells 6/7/8). Render runs at parse time so the Paginator's auto tile-counts are correct.
- **`security/dashboard.html`** — KPIs (Visitors in Log / Awaiting Tenant / Checked-in Now / Denied) + the "Awaiting tenant approval" table now computed from the same single source → dashboard and Visitors page can no longer diverge. **Removed** the "Visitor at the gate? … Open Gate Console" quick-action card per user request.
- Tidied stale "PM overflow nav" comments → "Security overflow nav" across the 3 pages.
- **Verification:** all 3 security pages + security-visitors.js parse; no PM-isms remain in `security/`.

---

## Task 4 — Late fee fetched from Settings (single source) + month-end cap copy
**Status:** Completed · prototype-only, no commit. User: "late fee … 2% and will be fetched from settings … calculated till the month end."
- **NEW `assets/rent-settings.js`** — single source for the tunable rent rules: `window.GHARSETU_RENT_SETTINGS = { lateFeeRatePercent: 2, graceDays: 5 }`, persisted to `localStorage` (prototype stand-in for the backend Settings table), plus `gsSaveRentSettings(rate, grace)`.
- **`assets/rent-engine.js`** — late-fee rate + grace now resolved at call time from `window.GHARSETU_RENT_SETTINGS` (`cfgRate()`/`cfgGrace()`), with the 2 / 5 constants as ultimate fallback. So a Settings change flows into every calculation. Month-end cap unchanged.
- **`admin/settings.html`** — includes `rent-settings.js`; hydrates the Late-fee-rate + Grace-period inputs from the shared source on load; **save persists** via `gsSaveRentSettings`; helper copy updated to "…up to the period's month-end. Applied across all rent calculations."
- **Rent pages** (admin record-payment + rent, pm rent-collection + record-payment, tenant rent) — `rent-settings.js` included before `rent-engine.js` so the engine reads the live rate/grace.
- **Verification:** Node harness confirms the fee scales with the Settings rate (2%→₹1,440, 3%→₹2,160, 4%→₹2,880 on L1 Mar) and stays month-end-capped; all touched pages + assets parse.

---

## Task 5 — Billing-period selection pre-fills CUMULATIVE due (oldest settles first)
**Status:** Completed · prototype-only, no commit. User: selecting a later month should put all months' remaining amount through it into Amount Received, then let the user edit.
- **`assets/rent-engine.js`** — NEW `cumulativeDueThrough(lease, year, month, paymentDate)` = Σ(rent + fee outstanding) for every period from the oldest up to and including the selected month (matches the oldest-first allocator).
- **`admin/record-payment.html` + `pm/record-payment.html`** — `setDefaultAmountFromPeriod()` now pre-fills Amount Received with `cumulativeDueThrough(selected)` instead of the single period's due; field stays editable; allocation preview + summary reflect the spread.
- **Verification (L1, Mar–Jun unpaid):** select Mar→₹19,440, Apr→₹38,880, May→₹58,320, Jun→₹76,320. Pages parse.

---

## Task 6 — Allocation preview: Remaining column + Total row + "Settled" + no-default method + cleanup
**Status:** Completed · prototype-only, no commit. Matches the reference Allocation Preview (doc §7.1: Period · Rent applied · Fee applied · Status · Remaining + Total footer).
- **`assets/rent-engine.js`** — allocator rows now also carry `rentDue/feeDue` and `rentRemaining/feeRemaining` (per-period still-owed after this payment).
- **`admin/record-payment.html` + `pm/record-payment.html`** — allocation table re-columned to **Period · Rent applied · Fee applied · Status · Remaining**; fee shown in overdue-red; **Total row** added (Σ rent, Σ fee); Status is **Settled** (both rent+fee cleared) vs **Partial**; Remaining shows "₹X rent + ₹Y fee still owed" (or — when settled). Removed the always-zero **Unallocated** row from the Payment Summary. Allocation status label **Covered → Settled**.
- **No payment method selected by default** — method `<select>` now starts on a "Select payment method" placeholder; `currentMethod()` returns null when unselected; submit validates a method is chosen (new `ap-method-err`); reference field stays hidden until a method is picked.
- **Removed BL-XX codes** from all client-facing copy (record-payment footnote deleted; `(BL-NN)` stripped from record-payment / lease-detail / delegation-new / property-detail — 12 refs across 6 pages). Remaining `BL-` only in invisible code comments.
- **Verification:** partial-pay (₹40,000 on L1) → Mar/Apr Settled (—), May Partial (₹16,880 rent + ₹1,440 fee still owed), Total rent ₹37,120 / fee ₹2,880. All pages parse.

---

## Task 7 — Rent listing "By Building": leases in a popup (See leases button)
**Status:** Completed · prototype-only, no commit. User: By-Building should have a "See leases" button opening a popup, not the leases dumped inline below each building.
- **`admin/rent.html` + `pm/rent-collection.html`** — each building card now shows only the summary (name · lease count · collection-rate bar · monthly due / collected / outstanding) + a **"See leases (N) →"** button. The per-building lease table moved into a reusable **modal** (`#buildingModal`, `bm-title`/`bm-sub`/`bm-body`) opened via `openBuilding(pid)` from `BUILDING_GROUPS`, closed by the Close button or Escape. Same columns (Lease · Tenant(s) · Unit · Amount Due · Outstanding · Status · Action); body scrolls at max-height 60vh.
- **Verification:** both pages parse; modal + open/close handlers present.

---

## Task 8 — Rent listing refinements (labels, tiles, filter, lease type, late-fee column)
**Status:** Completed · prototype-only, no commit. Admin + PM rent listings + engine.
- **By-Building "See leases" popup** now shows the **full building summary** in its header (Monthly rent · Collected · Outstanding · Rate), not just Outstanding.
- **By-Building "Collected" bug fix** — was `monthly due − all-period outstanding` (went **negative** for any building with arrears, e.g. Green Valley −₹14,320). Now uses **true lifetime collected** + a billed-based rate (`collected / (collected+outstanding)`); Green Valley 74%, Sai Heights 67%, Rohini Greens 19%, Mayur Vihar 57%.
- **"Amount Due"/"Total Due" → "Monthly Rent"** everywhere (KPI tile + By-Lease column + popup header + By-Building card stat) so the tile = sum of the column; "Outstanding" tile = sum of the Outstanding column. (Tenant page already used "Monthly Rent".)
- **"Collected" tile → "Collected this month"** — new engine field `collectedThisMonth` (Σ payments dated in the current month, rent+fee). The lifetime running total wasn't actionable (reference §16 quirk). By-Building card "Collected" stays lifetime (it's the collection-rate basis).
- **Sidebar label fix** — `admin/rent.html` + `admin/record-payment.html` sidebar said "Rent"; now "Rent collection" to match every other admin page (tabbar keeps the short "Rent").
- **Overdue tile vs filter** — tile counts past-due = `Overdue` + `Partial Overdue` (4). The status filter's "Overdue" option now matches **both** (so it returns 4, not 3); the redundant separate "Partial Overdue" option removed.
- **Lease type on each row** — every lease row (By-Lease table + popup) shows **Unit-wise / Room-wise** under the lease code.
- **"Unallocated" summary row removed** from Record Payment (always ₹0 after the max-payable clamp).
- **Late Fee column fix** — By-Lease "Late Fee" showed only the *current month's* fee (₹0 today for all), inconsistent with Outstanding (which includes arrears fees). New engine field `feeOutstandingTotal` (Σ unsettled feeOutstanding); column now shows the **total accrued fee** — L1 ₹4,320, L4 ₹6,240, L3 ₹1,200; within-grace leases (L7/L8) correctly ₹0.
- **Verification:** engine + both pages parse; per-lease Outstanding/accrued-fee table checked.

---

## Task 9 — Status rename + Portfolio tab real data
**Status:** Completed · prototype-only, no commit.
- **"Partial Overdue" → "Partial Paid"** across the engine + admin/pm/tenant rent listings (displayStatus value, current-month status, badge map, overdue-count + Overdue-filter checks, tenant overdue check). Still counted under Overdue; just relabelled.
- **Portfolio tab (admin)** — the "Historical month trend … analytics endpoint" stub was showing **twice** (a `<p>` + the table body) and carried no data. Removed the stub; replaced the trend card with a real **By Property** table (Property · Leases · Monthly Rent · Collected lifetime · Outstanding · Rate) computed from the data. Portfolio now shows the Summary card + a populated per-property table.
- **Verification:** all pages parse; per-property numbers checked (Green Valley 74%, Sai Heights 67%, Rohini Greens 19%, Mayur Vihar 57%).

---

## Task 10 — Cross-role consistency pass (PM + tenant up to date; sidebar labels)
**Status:** Completed · prototype-only, no commit.
- **By-Building "Collected" → this month** on admin + PM card **and** popup; rate is now collected-this-month ÷ monthly-rent (current-month collection progress). Building "Collection overview" header carries the current-month badge (Jun 2026), admin + PM.
- **Portfolio tab removed** from `admin/rent.html` (button + view markup + `renderPortfolio` + switchView wiring). Admin now mirrors PM (By Lease / By Building only).
- **Audit:** PM (rent-collection + record-payment) and tenant (rent) confirmed free of stale tokens (no "Partial Overdue"/"Amount Due"/"Total Due"/"Covered"/"Unallocated"/`(BL-)`); all three include rent-settings + rent-engine + rent-data; tenant uses displayStatus / "Partial Paid" / "Monthly Rent" / leaseType.
- **Sidebar label consistency** — audited all pages per role: Admin "Rent collection" ×23, PM "Rent Collection" ×14 (both internally consistent); fixed the tenant outlier — `tenant/rent.html` said "Rent & Payments" while the other 7 tenant pages said "Rent" → now "Rent" ×8.
- **Open (flagged to user):** tenant "Total Paid" stays lifetime (personal ledger) vs staff "Collected this month"; admin vs PM casing ("Rent collection" vs "Rent Collection") differ across roles though each is internally consistent.
