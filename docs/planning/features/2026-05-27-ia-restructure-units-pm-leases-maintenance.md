# IA restructure — Units→detail, PM multi-property, Tenant Lease Detail, Maintenance-detail role coverage

| Field | Value |
|---|---|
| Status         | shipped (prototype) |
| Started        | 2026-05-27 |
| Shipped        | 2026-05-27 (prototype only; app port pending) |
| SRS row        | (amendments noted in §2.0 — to fold into SRS at app-port time) |
| Test cases     | TC-UNIT-*, TC-PMPROP-*, TC-TLEASE-*, TC-MDET-* (defined in §3) |
| Prototype todo | row pending |

This file documents the IA restructure batch executed across the 2026-05-27 session. The prototype work is complete; this file is the **binding spec for the React/Next.js + NestJS port** and records the business-rule amendments the restructure implies.

---

## 1. Requirement (as given)

Quoted from the user across the session:

> "i don't find a good way to keep units page seperately … unit is part of any property … keep it into the property detail page only and need a detail page for unit so all of the active lease are against the unit not the property so lease can also be moved into unit detail page … open maintence request is looks good on the detail page and also need this on the unit detail page to show only the current selected unit maintence detail and add one button view detail on each maintence request"

> "for tenant page lease should has a detail page that will show more detail like payment detail, co tenant, maintence request, add termination request all of the actions should be on detail page"

> "We can assign multiple properties to a Property manager so we need properties page on pm role not a unit page … show only their assigned property and also show those property that are not assigned to them yet but in past they were assigned to them so they can view the past data for that tenure … only that tenure data will be show to them based not the current live data"

> "everywhere it has maintence request table and row they will has a detail page that clearly show the content about the request with the full progress detail how it started the request when it assigned when it closed … and other action show like change priority, assigned tasks, mark as resolved mark as close based on the roles … a clear card that show which lease and property this request belongs"

> "only admin, pm can assign the request to a maintence role they can not self assigned and only their assigned request will be show to them not all"

> "on the maintence role page change all-open page to all-request"

---

## 2. Plan

### 2.0 Business-rule amendments (carry into SRS at app-port time)

1. **One-PM-per-property is RETIRED.** A PM can hold multiple concurrent property assignments, plus a history of past assignments. New model:
   - `pm_property_assignments` table — `pm_user_id` · `property_id` · `assigned_at` · `unassigned_at` (NULL = active). Many rows per PM.
   - Runtime scoping: a PM sees live data for properties where `unassigned_at IS NULL`, and **read-only tenure-window data** for properties where `unassigned_at IS NOT NULL` (filter every child query — leases, payments, maintenance — to `action_timestamp BETWEEN assigned_at AND unassigned_at`).
2. **Maintenance role cannot self-assign and cannot close.** Assignment is an Admin/PM-only action. The Maintenance role sees only requests where `assigned_to = current_user.id`. Closing a request is Admin/PM/Tenant only.
3. **A lease is against a unit, not a property.** The unit is the anchor for leases + maintenance. Property detail aggregates across its units; unit detail is the per-unit view.

### 2.1 Units IA refactor

- DELETE the standalone Units list pages — `admin/units.html`, `pm/units.html`. Units are managed inside Property Detail's Units table and drilled via Unit Detail.
- Strip the "Units" sidebar/tabbar/more-sheet entry from every admin + pm page (25 files).
- NEW `admin/unit-detail.html` + `pm/unit-detail.html` — per-role, flat URL `unit-detail.html?unit=<id>&property=<slug>`. Sections: Lease/Property context card · KPIs · Active lease (→ lease-detail) · Past leases · Open maintenance (each row → maintenance-detail).
- `admin/property-detail.html` Units table: each row gets a "View detail" link → unit-detail; "View all units" replaced with "+ Add Unit".

### 2.2 PM Properties page + multi-property + tenure history

- NEW `pm/properties.html` — Active/Past filter tiles + table + pagination. Active rows → property-detail (live). Past rows → property-detail with `?tenure=<from>..<to>` (read-only).
- NEW `pm/property-detail.html` — mirrors admin/property-detail with PM chrome. A "Historical view" banner appears when `?tenure=` is present, and all write actions are disabled with a tooltip.
- "Properties" sidebar entry + tabbar tab rolled out across all PM pages (Properties becomes the 2nd sidebar item; PM tabbar = Dashboard · Properties · Tenants · Rent · More).
- `pm/profile.html`: "Assigned property" → "Assigned properties" (comma list) + a "Past assignments" row.

### 2.3 Tenant Lease Detail

- NEW `tenant/lease-detail.html` (flat URL `?id=L-NNNN`). Two-column layout. Left: lease summary · co-tenant card · this-month status · payment history table · maintenance requests (→ maintenance-detail). Right: sticky Actions card — Pay rent · Raise maintenance · Initiate termination (3-field modal with BL-08 co-tenant-consent alert) · Download lease agreement · Request renewal (disabled until 30 days before end). PM contact card.
- `tenant/leases.html`: every lease card (active + past) gets a "View detail" → lease-detail.

### 2.4 Maintenance-detail role coverage + progress timeline + role-based actions

Four per-role detail pages, each with: Lease/Property context card (3-col; admin gets a 4th rent column) · request header · progress timeline (Raised → Acknowledged → Assigned → Started → [Paused/Resumed] → Resolved → Closed; filled dot = past, hollow = pending) · role-based action card.

| Page | Actions | Sees |
|---|---|---|
| admin/maintenance-detail | Change priority · Reassign · Cross-property reassign · Resolve · Close · Internal note | Everything incl. rent |
| pm/maintenance-detail | Change priority · Assign/Reassign · Resolve · Close · Internal note | Everything for their property |
| maintenance/maintenance-detail | Acknowledge · Start · Pause · Resume · Resolve · Internal note · **NO Close** | Property/unit/reporter; no lease #, no financial; sees internal notes |
| tenant/maintenance-detail | Close (when Resolved) · Issue-not-fixed (when Resolved) · public comment | Public timeline + messages; **no internal notes**, no cost |

Wired list→detail across all maintenance lists (admin, pm, tenant cards, maintenance dashboard + all-requests).

### 2.5 Maintenance role scoping + rename

- `maintenance/all-open.html` → `maintenance/all-requests.html` (label + title + all hrefs).
- Removed Self-assign affordance + "pick up open work" alert + the 6 unassigned rows. Page now shows only the technician's assigned requests + a note "Only Admin or Property Manager can assign new requests."
- `maintenance/profile.html` audit row "Self-assigned request" → "Acknowledged assignment".

---

## 3. Test cases (designed up front)

### 3.1 Units (TC-UNIT-*)
| TC | Title | Expected |
|---|---|---|
| TC-UNIT-001 | No standalone Units page | `admin/units.html` + `pm/units.html` return 404; no Units nav entry anywhere |
| TC-UNIT-002 | Unit detail reachable from property detail | Property-detail Units row → unit-detail with correct unit param |
| TC-UNIT-003 | Unit detail shows active + past leases | Both tables present; active lease → lease-detail |
| TC-UNIT-004 | Unit detail shows unit-scoped maintenance | Only this unit's requests; each → maintenance-detail |

### 3.2 PM Properties + tenure (TC-PMPROP-*)
| TC | Title | Expected |
|---|---|---|
| TC-PMPROP-001 | PM Properties page lists active + past | Active tile + Past tile; counts correct |
| TC-PMPROP-002 | Past property opens read-only | `?tenure=` banner shown; write actions disabled |
| TC-PMPROP-003 | Tenure-window data scope | (App port) child queries filtered to assigned_at..unassigned_at |
| TC-PMPROP-004 | PM profile multi-property | "Assigned properties" list + "Past assignments" row |
| TC-PMPROP-005 | Tabbar/​sidebar Properties present | Properties is 2nd sidebar item + tabbar tab on all PM pages |

### 3.3 Tenant Lease Detail (TC-TLEASE-*)
| TC | Title | Expected |
|---|---|---|
| TC-TLEASE-001 | Lease detail reachable from My Leases | Each lease card → lease-detail?id=… |
| TC-TLEASE-002 | Payment history + maintenance + co-tenant present | All three sections render |
| TC-TLEASE-003 | Initiate termination modal | BL-08 co-tenant-consent alert; reason + date fields |
| TC-TLEASE-004 | Renewal gated | Request-renewal disabled until 30 days before lease end |

### 3.4 Maintenance detail (TC-MDET-*)
| TC | Title | Expected |
|---|---|---|
| TC-MDET-001 | 4 role detail pages exist | admin/pm/tenant/maintenance maintenance-detail all present |
| TC-MDET-002 | Lease/Property context card on all 4 | Property · Unit · Lease (admin +rent) |
| TC-MDET-003 | Progress timeline on all 4 | Lifecycle events with timestamps + actor |
| TC-MDET-004 | Role-based actions | Per the §2.4 table; maintenance has no Close; tenant has no internal notes |
| TC-MDET-005 | Maintenance sees assigned-only | all-requests shows only current tech's requests; no self-assign button |
| TC-MDET-006 | Assign is Admin/PM only | (App port) `POST /maintenance/:id/assign` → 403 for MAINTENANCE |

---

## 4. Sign-off

| Date | Question | User answer |
|---|---|---|
| 2026-05-27 | Remove both Units pages? | Yes (default) |
| 2026-05-27 | Keep pm/leases.html as property-wide list? | Yes (default) |
| 2026-05-27 | Per-role unit-detail? | Yes (explicit) |
| 2026-05-27 | Flat URL pattern? | Yes (default) |
| 2026-05-27 | Single-PM rule reversal binding? | Yes (default) |
| 2026-05-27 | Past-tenure read-only across all sections? | Yes (default) |
| 2026-05-27 | "every page separately to keep prototype clean" | Confirmed — explicit per-role HTML, no shared/dynamic files |

---

## 5. Execution log

| Date | Event |
|---|---|
| 2026-05-27 | Units IA refactor executed (orchestrator): deleted 2 Units pages, stripped nav on 25 pages, created 2 unit-detail pages, wired property-detail. |
| 2026-05-27 | Tenant Lease Detail created + wired from leases.html. |
| 2026-05-27 | PM Properties + property-detail + multi-property profile delivered by gharsetu-frontend (agent crashed at socket watchdog after this; nav rollout confirmed across all PM pages). |
| 2026-05-27 | 4 maintenance-detail pages completed (tenant + maintenance created fresh; admin + pm already had timeline; Lease/Property context card added to all 4). List→detail wiring done. |
| 2026-05-27 | Maintenance role scoped to assigned-only; self-assign removed; all-open→all-requests rename. |
| 2026-05-27 | Planning file authored (this file) at session close — documents the binding spec + the 3 business-rule amendments for the app port. |

---

## 6. Files changed

See `agent-team-change-logs/gharsetu-frontend-2026-05-26.md` Task 7 for the full file ledger. High level: 9 new pages, 3 deletions, ~30 edited pages, `paginate.js` + styles.css/validation.js additions.

---

## 7. Agents used

| Agent | Task | Status |
|---|---|---|
| gharsetu-lead (orchestrator) | Planning + Units IA + Tenant Lease Detail + maintenance-detail completion + context cards + residual paginate | accepted |
| gharsetu-frontend | PM Properties + property-detail + profile + paginate seed pages (crashed mid-batch ×3; partial deliverables verified + completed by orchestrator) | partial |

---

## 8. Post-deploy

_Empty — prototype only. The app port must implement §2.0 amendments in the Prisma schema + authz layer before this UI is wired to real data._

---

## 9. Cross-references

- `docs/planning/features/2026-05-27-server-side-pagination.md` — pagination component (sibling deliverable).
- `docs/planning/features/2026-05-27-master-data-ownership-split.md` — Master Data platform/org split.
- `docs/planning/features/2026-05-26-common-ui-cleanup.md` — sidebar/account/profile patterns this builds on.
- SRS amendments needed: retire one-PM-per-property; maintenance assign/close authz; lease-anchored-to-unit. Fold in at next SRS pass.
- `prototype/assets/paginate.js`, `prototype/assets/styles.css` (.pagination, .filter-tile, .account-*, .progress-timeline), `prototype/assets/validation.js` (account-sheet, sidebar-section toggles).
