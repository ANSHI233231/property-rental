# GharSetu — claude-progress.md

> **Rolling cross-session memory.** Updated at session exit. Pair this human-readable file with the machine-readable [feature_list.json](feature_list.json) — when they disagree, the JSON wins. See [.claude/skills/harness-engineering/SKILL.md](.claude/skills/harness-engineering/SKILL.md) for the contract.

**Last updated:** 2026-06-01 (cont.) · **Rent collection overhaul** (full-page Record Payment + late-fee allocation, Month/period filter, Lease-wise / Property-wise view tabs, combined Property·Unit·Room cell, Lease-type + Lease-status filters) + **Leases↔Rent↔Lease-detail data reconciliation** (one canonical 24-lease roster; rent roll = 20 active subset) + lease-detail month-by-month Rent Collection schedule · earlier same day: Prototype listing enhancements + Organizations pagination unified + **NEW Security Guard role (role 6)** · maintained by orchestrator + `gharsetu-lead`

> **Rent collection session (2026-06-01, cont.).** All in `prototype/` (`admin/rent.html`, `admin/leases.html`, `admin/lease-detail.html`, NEW `admin/record-payment.html`, `assets/styles.css` `.view-tabs`). Record Payment is now a full page with month-by-month allocation; the rent page is period-aware (Month filter, cumulative default) with **Lease-wise** (per-lease) and **Property-wise** (aggregated) view tabs, a bold combined **Property · Unit (· Room)** lead cell, and **Lease-type** + **Lease-status** filters; lease-detail gained a month-by-month Rent Collection schedule (Month·Rent·Collected·Late Fee·Status). **Leases page rebuilt from a canonical 24-lease roster** (20 active = the rent roll + 2 upcoming/1 ended/1 terminated) so Leases / Rent / Lease-detail are mutually consistent; Leases defaults to Active. Plan: [`docs/planning/features/2026-06-01-rent-views-and-lease-collection-schedule.md`](docs/planning/features/2026-06-01-rent-views-and-lease-collection-schedule.md). NOTE: a parallel session's **public-pages-redesign-v2** work is uncommitted in shared files (`styles.css`, `prototype-changes.md`, change-log) — left untouched in this commit.

---

## 1. Current phase / engagement

| Stream | Status | Notes |
|---|---|---|
| **v1** | ✅ **RELEASE-READY** pending user sign-off | Phase 8 closeout dated 2026-05-11 — all MUST-FIX closed, 967/967 unit+integration green, 74/74 Playwright green (serial), 23/23 BLs locked in [bl-traceability-matrix.md](docs/testing/v1/bl-traceability-matrix.md). |
| **Current engagement** (was v3.1 / v6.5) | 🟢 **PROTOTYPE BUILT — application port pending** | v8 prototype now covers all 7 new features and the 6 module gap closures. Application port to `apps/web` + `apps/api` not yet started. Per the [Solution_Overview.docx](docs/product/Solution_Overview.docx) v8 (final-close 2026-05-26): 6 module gap closures + 7 new features (**per-room leasing** [planning only — HTML iteration deferred], **Admin Impersonation**, **Admin Task Delegation**, **Visitor Management**, **Master Data Administration**, **Settings**, **Organization Management / SAAS layer**) + **new Super Admin role** + 6 new business rules. Timeline lives in [Timeline.xlsx](docs/product/Timeline.xlsx). |
| **Deferred** (post-current) | ⏸ **DEFERRED** | After all the scope pulls, only two items remain deferred (per [Solution_Overview.docx §Out of Scope](docs/product/Solution_Overview.docx) + [feature_list.json](feature_list.json) `deferred_post_engagement`): **subscription billing integration** (manual invoicing only) and **custom domains + per-organization branding**. |

---

## 2. Last session summary (2026-06-01 — admin lease/unit feature pass + auth email-only + PM property/lease clone)

**Scope.** Opus orchestrator-direct session. All work in `prototype/` + `docs/`. No app code.

**Shipped (prototype + docs):**
1. **Solution Overview** client-review refinements + **Timeline** full rebuild (parallel multi-AI-agent, **8 working days**, relative days "Day 1…N", no prototype phase, mirrors SO order). Committed separately (`39125f1`, `3a2c53e`).
2. Admin **dashboard** — removed the Emergency (Unit 7C) water-leak alert banner.
3. **Maintenance priority labels** standardized system-wide to **Low · Medium · High · Emergency** ("Normal" → "Medium").
4. **Org detail** (admin + super-admin) — **Type of business** multi-value comma-separated; **Primary Contact** (name·email·mobile) added to the details card. SRS §4 updated.
5. **Auth = email only** — `login.html` + `forgot-password.html` de-phoned; validator email-only; SRS §3 updated. Login "Prototype Shortcuts" strip centered.
6. **Super Admin Contact Inbox** bug fix — mark read/replied wrote to the Subject cell instead of the Status cell (nth-child 5 → 6).
7. Admin **unit-detail** — create-lease buttons gated hidden on Retired/Under-Maintenance; Leases **Type** column added + section moved after Rooms.
8. Admin **lease-detail** — **Renew** → Create Lease wizard renew mode; top terminate button replaced with end-of-page **Early Termination** per-co-tenant-consent section (+ Terminated read-only view); tenant "View profile" removed.
9. **PM property + lease clone (assigned-scoped)** — NEW `pm/create-lease.html` (scoped to Green Valley / Sai Heights / Mayur Vihar, renew mode); `pm/leases.html` re-cloned to admin filter-tile layout; `pm/unit-detail` + `pm/lease-detail` at admin parity. Plan: `docs/planning/features/2026-05-29-pm-property-lease-clone.md`.
10. **Lease status labels** standardized to **Active / Upcoming / Ended / Terminated** across admin + PM (no Closed/Expired/Renewed).

**Docs:** change-logs `gharsetu-frontend-2026-06-01.md` + `document-agent-2026-05-29.md`; many rows in `docs/planning/prototype-changes.md`; SRS updated (login, business-type, priority); CLAUDE.md Timeline row updated.

**Continuation (same day, uncommitted at time of writing):**
11. **Prototype listing enhancements** — shared infra `Paginator.setPredicate` (range/predicate filter) + `data-search` hidden-token search + `a.kpi` clickable cards. Across roles: clickable dashboard cards → filtered pages; Admin Properties (Total Rooms + Property-Type/Room-Status/Manager filters + clickable tiles), Leases (Lease-Type + wired Property filter), Maintenance (room cascade + raise-form room), Rent (Room column + 5 filters + record-payment room), Settings (Field+Date), Organization (invoice Status/Plan/Date), Delegations All-tab + **new `admin/delegation-activity.html`**; "Specializations" → "Maintenance Specializations" (25 files); PM dashboard/properties/leases filters. Plan: `2026-06-01-prototype-listing-enhancements.md`.
12. **Organizations pagination unified** — the one bespoke right-aligned footer migrated to the shared centered `.pagination` component (one constant design everywhere).
13. **NEW Security Guard role (`SECURITY_GUARD=5`)** — gate-level, assigned-properties, Visitor-Management-only. New `prototype/security/` (dashboard + gate console + profile); tenant "Pending approvals"; admin Users role + property assignment; login shortcut (5→6); admin/PM visitors "Awaiting tenant" tile + gate rows. **Gate-initiated flow**: guard logs a walk-in → routes approval to the tenant by lease type (any one co-tenant approves; common area = staff approves; no code). SRS synced (6 roles, matrix, enum, Module 8). Plan: `2026-06-01-security-guard-role.md`.
14. **Visitor tables (all roles)** — Type column (Pre-approved / Gate), Visitor-type filter, search-by-visitor-code (hidden `data-search`), Property/Unit filters.
15. **Solution Overview** updated for the new role (Security Guard bullet + tenant approve + guard check-in/out), via `gharsetu-lead`.

**Docs (cont.):** `gharsetu-frontend-2026-06-01.md` Tasks 5–6 + `gharsetu-lead-2026-06-01.md`; ~16 rows in `prototype-changes.md`; SRS roles 5→6 + Module 8; two new feature plans.

**Carry-over:** App port to `apps/web` / `apps/api` for all v8 features still pending (incl. the Security Guard backend: `security_guard_properties` join, `visitor_requests` columns, RBAC, new enums). No blockers.

---

## 2a. Last session summary (2026-05-30 — Create Lease wizard overhaul + date-picker rollout)

**Scope.** Single Opus session (with one `gharsetu-frontend` dispatch for the modernization pass). All work in `prototype/` + `CLAUDE.md` + docs. No app code.

**Shipped (10 tasks, all in `agent-team-change-logs/gharsetu-frontend-2026-05-30.md`):**
1. **Create Lease modernization pass** (`gharsetu-frontend` agent) — 32 px step circles with saffron glow ring, `aria-current="step"`, `panelFadeIn` (180 ms, reduced-motion-aware), 5-step `step-heading`/`step-subheading`, saffron-tinted selected-card states with checkmark badge, 44 px colored card bands (initials, hashed-from-id navy/blue palette), promoted conflict error to `cl-conflict-banner`, live sticky 268 px summary rail from Step 2 onward, `wizard-shell` two-column grid, "Step N of 5" bottom counter, accordion context panels with chevron-rotate toggle.
2. **Step 5 restructure** (same agent dispatch) — 4 sub-sections (Lease term / Rent & charges / Rules / Notes) under `.step5-section-label`; new fields (Lock-in, Maintenance, Escalation, Notes); right column replaced with Selected-tenants panel; lease-history panels relocated to a 6:6 `step5-history-grid` below the form.
3. **Step 5 trim — user-driven** (orchestrator-direct) — Lock-in, Rent escalation, Notes, the entire Rules section (Late fee, Notice period, Rent due day) all removed; tenant lease history rows enriched with property/unit/room/rent; Selected-tenants panel given `max-height: 520px + overflow-y: auto` so adding many tenants no longer destabilises the layout.
4. **History card relocated + combined** — moved outside the wizard panel, below the action bar, wrapped in `<section class="card" id="step5-history-card">`; unit-wise + room-wise leases collapsed into one Unit Lease History card with scope chips; empty-state tenants skipped; **bug fix**: `UNIT_LEASES` rows added for `gv-1A`/`gv-2B`/`pg202-C` (units were Occupied but had no record), two date mismatches corrected.
5. **Step indicator stretched** to full card width via `flex: 1 1 0` connectors.
6. **Mock-data refactor to numeric ids** (`create-lease.html`) — `PROPERTIES`/`UNITS`/`ROOMS`/`TENANTS`/`UNIT_LEASES` all flat arrays keyed by numeric `id`, relations via numeric FK; ~20 onclick handlers updated; helpers added (`findPropertyById`, `findUnitById`, etc.); `dataset` string-coercion bug fixed; Step 2 stale-grid bug fixed.
7. **Quick-create-lease deep-link flow** — `+ Create Lease for this Unit` (top) and `+ Create Lease` (per-room rows) added to admin `unit-detail.html`; wizard reads `?unitId=<n>&roomId=<m>`, validates, seeds state, jumps to Step 4. PM equivalent intentionally not added (cross-folder Admin link would surround the wizard with the PM sidebar).
8. **Step 5 context strip** — saffron-tinted card at top of Step 5: lease-type chip (`UNIT-WISE LEASE` / `ROOM-WISE LEASE`) + breadcrumb `Property › Unit (› Room)`. Required because the summary rail is hidden on Step 5.
9. **NEW `prototype/assets/date-picker.js`** — vanilla JS DD/MM/YYYY calendar picker, no deps. `data-min-date="today"|D/M/Y|ISO`, `data-max-date=…`, `data-pair-min`/`data-pair-max` for range sync. `GsDatePicker.initAll(root?)`/`refresh(root?)` API. Mon-start week (Indian convention). **Bulk-rolled to 12 prototype files / 20 inputs.** **5 range pairs wired**: `cl-start↔cl-end`, `start↔end` (pm/leases), `from-date↔to-date` (audit-log), `delegStart↔delegEnd`, `rl-start↔rl-end`.
10. **CLAUDE.md rule #19 strengthened** — extended from "PK = id INTEGER auto-increment" to also bind cross-table relations and prototype mock data: every relation references numeric `id` only (no slug/email/name); Prisma `@relation` always at the integer PK; mock arrays must use numeric ids and reference each other via those ids so the prototype teaches the right pattern.

**Docs:** Change-log appended to [agent-team-change-logs/gharsetu-frontend-2026-05-30.md](./agent-team-change-logs/gharsetu-frontend-2026-05-30.md) (tasks 1–10). 8 rows appended to [docs/planning/prototype-changes.md](./docs/planning/prototype-changes.md). CLAUDE.md rule #19 rewritten.

**Carry-over:** PM `unit-detail.html` quick-create-lease affordance is deferred (needs a `pm/create-lease.html` mirror first). `app-port` note in prototype-changes: do not migrate the Lock-in/Escalation/Notes columns from earlier ledger entry — those are removed; only Maintenance stays as a per-lease column.

---

## 2b. Earlier session summary (2026-05-29 — anchor-day billing + Admin Organization page + plans polish)

**Scope.** Single Opus session, orchestrator-direct (no specialist agents). All work in `prototype/` + `docs/`. No app code.

**Shipped:**
1. **Anchor-day billing model** introduced as a first-class concept. Each org now carries its own `billing_anchor_day` (1–28), set at approval (default = approval day, operator-overridable). The 00:00 IST cron now runs **every day** and issues invoices for orgs whose anchor day matches today. Period = `[anchor of this month, anchor − 1 of next month]`. Five UI surfaces re-anchored (super-admin/invoices.html × 25 rows across 8 orgs with distinct anchor days · super-admin/invoice-detail.html · admin/organization.html × 4 rows · admin/invoice-detail.html · super-admin/organization-detail.html Subscription card gained an anchor-day row). **SRS NR-13 and NR-14 rewritten**; planning doc `docs/planning/features/2026-05-28-plans-and-billing.md` §2.2.2/2.2.3/NR-13 row aligned.
2. **Approve modal** redesigned — 720 px review surface with (A) Organization summary table, (B) Primary Contact card (read-only by default, "Change contact" toggle, **email-collision detection** with red banner + Approve-button gate), (C) Billing anchor day picker (1–28, default today, "today (recommended)" marker, live first-invoice preview that pro-rates if anchor ≠ approval day), (E) Cancel · `Approve & Provision Admin`. Email-collision simulator toggle inside the modal lets reviewers see both happy-path and conflict-resolve flows. (An earlier "Initial password" override block was added then removed per user feedback — password reset already lives in the Users page.)
3. **Admin `billing.html` absorbed into a full `admin/organization.html`** mirroring the Super Admin org-detail layout, read-only. Sections: status strip · Organization Details + Subscription cards (Plan · Plan price · Billing anchor day with next-invoice date · Active-user cap · Active users · Features available chips) · Subscription Plan History · Invoices. **Sidebar + more-sheet "Billing" → "Organization" rolled out across 20 admin top-level pages + 5 master-data sub-pages** (label + icon swap). `admin/invoice-detail.html` back-link updated. Old `billing.html` deleted.
4. **Admin `invoice-detail.html` page** created (previously the admin reused `super-admin/invoice-detail.html?admin=1`, leaking the `/super-admin/` URL into the Admin's address bar). Now lives entirely under `/admin/`. Read-only — no Mark Paid / Cancel buttons. Simulator limited to Issued / Paid / Cancelled (drafts are internal-only).
5. **Mark Paid wired to Payment Methods master.** New `prototype/assets/payment-methods.js` (canonical UPI / NEFT / Cash / Cheque / IMPS list with `refLabel` + `refPlaceholder` per method). The Mark Paid modal now opens with a Payment Method dropdown; the Payment Reference field's label and placeholder **swap based on the selected method** (UPI → "UPI transaction ID · e.g. 412345678901"; Cheque → "Cheque number · e.g. 000456"). Both required. Header card gained a "Payment Method" row; Status Timeline meta includes the method name.
6. **Plan-related polish across four surfaces** — `super-admin/plans.html` plan cards redesigned with 6 strict blocks (header / price / caps / features / org usage / actions); marketing cards + sign-up tiles + Super Admin cards now use one shared `gsCombinedFeatureList` helper rendering a flat 2-column feature list (no Core/Optional labels on the cards). **Sign-up plan tile fully redesigned** — floating "Most Popular" badge above the card, big centred price (30 px), two grey-tinted cap KPI chips, divider, 2-col feature list (single col < 640 px). `?plan=<id>` URL param auto-checks the matching radio. **New `GHARSETU_CORE_FEATURES` constant** (Properties · Units · Rooms · Tenants · Leases · Users — always included, never toggleable). **Removed Priority Support** (no defined deliverable). **Removed Task Delegation from Standard** (now Premium-only). **Removed Generate Invoice button** from super-admin/invoices.html (was a disabled v2 placeholder).
7. **`super-admin/organization-detail.html` Subscription card** — replaced the redundant Utilization bar (it duplicated the row above it) with a **Features available** chip row driven by `GHARSETU_PLANS[].features` + `GHARSETU_CORE_FEATURES` (saffron-green pills, no ✓ ticks). Added a Billing anchor day row. Cleaned up data inconsistencies — removed a future-dated 02/06/2026 Premium row from Subscription Plan History and a spurious "Plan changed Basic → Standard" audit entry.
8. **Delegation New form** expanded from 10 tasks to **30 admin tasks across 8 capability groups** (Property & Inventory · Leases · Rent & Payments · Maintenance · Visitors · Users & Team · Master Data · Audit & Reports). Each group: header + "X / N" count badge + "Select all" toggle (with indeterminate state). Top chips-preview box shows total selected count + chips. Submit validator scoped to `name="tasks"` so per-group Select-all controls don't masquerade as task selections.
9. **`SearchableSelect.refresh` bug fix** — `prototype/assets/searchable-select.js` was silently no-op'ing because `sel.previousElementSibling` returned the `<ul>` instead of the wrap (post-enhancement the native `<select>` lives **inside** the wrap). Switched to `sel.parentNode`. This is why the signup City picker wasn't showing options after state was picked (its `disabled` state wasn't being synced). Other call sites coincidentally still worked.

**Docs:** Change-log [agent-team-change-logs/gharsetu-frontend-2026-05-29.md](./agent-team-change-logs/gharsetu-frontend-2026-05-29.md) written. 11 rows appended to [docs/planning/prototype-changes.md](./docs/planning/prototype-changes.md). SRS NR-13 + NR-14 rewritten. Planning doc `2026-05-28-plans-and-billing.md` §2.2.2/§2.2.3/NR-13 aligned.

**Carry-over:** Backend dispatch still pending for the anchor-day cron switch and the `organizations.billing_anchor_day SMALLINT CHECK BETWEEN 1 AND 28 NOT NULL` migration. No new blockers.

---

## 2c. Earlier session summary (2026-05-27 PM — Admin role build-out + Property Types master + global success toast)

**Scope.** Continued the screen-by-screen review, focused on the **Admin role** plus two cross-cutting features (Property Types master, global toast). Prototype-only — no app code, no business-rule changes. (The morning's homepage redesign + public-chrome work is committed in `994bfa4`; see §7.)

**Shipped:**
1. **Property Types master** (org-level, Admin) — new `admin/master-data/property-types.html` + single-source `assets/property-types.js`; landing card; **Property Types** sublink rolled out to all 17 admin nav surfaces; Add Property **Type** dropdown rendered from it. Plan: `2026-05-27-property-types-master.md` (shipped).
2. **Admin dashboard** — "Overdue Tenants" → **"Overdue Leases"**; "Property Snapshot" → **"Recent Open Maintenance Requests"** (latest 4 open).
3. **Property listing** — property-type filter tiles → **read-only summary tiles** (Available Units / Total Active Leases / Upcoming Leases); **Edit Property** per row via a shared add/edit modal (Assign Manager hidden in edit — that's the Reassign-PM action on the detail page).
4. **Property detail** — manager phone unmasked (Admin can see it); "Active Leases" section removed (lives on unit detail); Units table gained a **Current Tenant** column + **Add/Edit Unit** modal (status locked while occupied; "Occupied" not manually selectable) + **Retire** (row action, reason required, blocked while occupied — a soft status, not a delete); **Edit Property** + **Create Lease** buttons removed.
5. **Admin Leases page** — NEW `admin/leases.html`, org-wide list (Tenant · Property · Unit · Start · End · Rent · Status · Actions) + New Lease modal + co-tenant consent + pagination; row View → unit-detail; **Leases** added to admin sidebar + more-sheet across 17 pages. Plan: `2026-05-27-admin-leases-page.md`.
6. **Add/Edit Property — Amenities** → checkbox list (was a Ctrl/Cmd multi-select).
7. **Signup form** — State → City **cascade** dropdowns from new single-source `assets/locations.js` (NCR states only) + **Pincode** field (6-digit).
8. **Global success toast** — `assets/toast.js` + CSS (top-right, auto-dismiss 4s, pause-on-hover, `aria-live`, reduced-motion). **Rolled out to all 64 pages**: 38 success `alert()` → `gsToast`, 12 master `announce()` routed, `property-detail` `showSuccess` → toast, signup + contact toast on success. Placeholders ("…form opened", export, PDF) left as `alert()`. Plan: `2026-05-27-global-success-toast.md`.
9. **Visit Purposes** deactivate note → button `title` tooltip (the earlier 6-master sweep had missed it; all 8 masters now consistent).
10. **Create Lease → full page** — new `admin/create-lease.html` (Unit · Lease terms · Primary tenant · repeatable Co-tenants); the Leases-page "+ New Lease" navigates there (modal removed); flash-toast on return. Unit-detail "+ Create Lease" + property-detail "+ Create Lease"/"Edit Property" buttons removed.
11. **Org detail — Reject action** — Super Admin can now **Reject** a pending org (red action + reason modal + new `Rejected` status/badge), alongside Approve.
12. **Properties Export → real CSV** download (was a placeholder alert) + success toast.
13. **Unit detail unified + occupancy-aware** (admin + PM identical): combined Active/Past leases into one **Leases** table with a Status column; **Current Tenant(s)** card; **Bathrooms** added (modal + table); KPI strip reworked (Monthly Rent moved into the top context card; lease KPIs = Active Lease/Outstanding/Lease-ends-in). **Prototype status simulator** (Available/Listed/Occupied/Under-Maintenance/Retired) moved to the top; when not occupied it hides the tenant card, lease KPI strip, the active-lease row, and (except under Maintenance) the Open Maintenance section. Open Maintenance **section removed** from unit detail.
14. **Property detail — Open Maintenance** rows got View-detail links; "Active Leases" section removed; Units table gained Current Tenant + **Bathrooms** columns + Add/Edit Unit modal (status locked while occupied) + **Retire** (reason, soft status); manager phone unmasked.
15. **PM parity mirror** (`gharsetu-frontend` agent) — PM property-detail + unit-detail brought to the same display/lease/preview behaviour as admin, **without** structural CRUD (PM stays operations-scoped).

**Config:** `gharsetu-frontend` agent model pinned `sonnet` → `claude-sonnet-4-6` (user request).

**Docs:** 3 new planning files (property-types, admin-leases, global-toast); `prototype-changes.md` + frontend change-log updated. No `feature_list.json` change (prototype polish).

**Carry-over:** an orphaned (unreachable) Create-Lease drawer remains on `admin/property-detail.html` — harmless dead code, strip later. Toast / Most-Popular / plan + property + unit CRUD are session-only (no persistence) in the static prototype.

---

## 2d. Earlier session summary (2026-05-26 / 27 — v8 prototype build-out)

**Scope.** Implement v8 across the static prototype: ship the 7 new features (with Per-Room Leasing as planning-only this pass) and the 6 module gap closures from Solution Overview v8. Public auth pages refreshed; sidebar pattern updated to a compact account menu.

**Planning files added** (all under `docs/planning/features/2026-05-26-*.md`):
- `super-admin-pages.md` (544 lines, 148 TCs)
- `admin-module-additions.md` (585 lines, 90 TCs — master data + settings + delegations)
- `visitor-management.md` (278 lines, 35 TCs)
- `admin-impersonation.md` (349 lines, 28 TCs)
- `v8-module-gap-closures.md` (415 lines, 62 TCs across 6 modules)
- `per-room-leasing.md` (589 lines, 42 TCs across 5 namespaces) — HTML iteration deferred
- `public-auth-pages-refresh.md` — implemented this session

**Prototype implementation delivered**:
- **Super Admin** — all 5 pages (`dashboard`, `organizations`, `organization-detail`, `plans`, `profile`) shipped earlier in session
- **Visitor Management** — `pm/visitors.html` + `tenant/visitors.html` + nav rollout
- **Admin Module Additions** — `master-data.html`, `settings.html`, `delegations.html` (3 new pages) + new MoreSheet mobile-overflow pattern across all 12 admin pages
- **Admin Impersonation** — `assets/impersonation.js` (273 lines) + 153 lines of CSS appended to `styles.css` (520–673) + `<script>` tag injected on 29 role pages + Start affordance in 2 places
- **v8 Module Gap Closures** — all 6 modules: 2 new maintenance-detail pages, 8 existing pages edited (Add-User restricted, amenities multi-select, Reassign-PM + Create-Lease, Renewal Drawer, 3-step Termination, cross-property Reassign, Record-Payment modal, 8-KPI grids, daily-queue dashboard, tenant rent+payments+maintenance summary)
- **Sidebar account-menu refactor** — name/role removed; `.account-trigger` + `.account-menu` (popup containing "Sign out") replaces the old footer text across 37 prototype pages

**Public auth pages refreshed**: `prototype/forgot-password.html` + `prototype/reset-password.html` — stripped HTML5 native validation, added custom inline validators, aligned to register-org link pattern.

**Token sources extended once**: `prototype/assets/styles.css` grew from 519 → 730 lines (impersonation block 520–673 + sidebar account-menu block ~677–730). All other tokens unchanged. No new colors or radii were invented; only existing tokens were composed.

**Orchestration footnote**: three of six background-agent dispatches stalled at the 600-second watchdog. Outputs were verified intact and recovery patches applied by the orchestrator (nav consistency on 9 admin pages, planning-log entries on 2 plans, modules 4–6 delivered on a continuation dispatch).

**Carry-over**:
- Per-Room Leasing HTML iteration (10 prototype files identified in §6 of its planning file)
- `prototype-changes.md` ledger entries (deferred to ship per Working rule §9)
- `feature_list.json` rows for the 7 v8 features (pending creation by `gharsetu-lead` after verification command exits 0)
- Application port from prototype to `apps/web` + `apps/api`
- 5 open decisions on Per-Room Leasing · 2 on Impersonation (active-org gate, nested-impersonation backend block)

---

## 2e. Earlier session summary (2026-05-26 — CLAUDE.md overhaul + Feature Planning template)

**CLAUDE.md rewrite.** Fixed: stale 2026-05-25 header; the Rule #2 vs Rule #12 contradiction on public sign-up (the v1 "No public sign-up" framing never updated for v8 SAAS scope); UIUX_Design_Document.docx missing from source-of-truth table; prototype page count (19 → actual 29). Restructured into clear bands: **Working rules** (11 process rules — never-commit-without-instruction, plan-first, lead-orchestrates, worker≠checker, per-task change log, submodule discipline, relative paths, CONTEXT.md mirror, prototype sync, JS-source-of-truth for binaries, line caps) + **Technical conventions** (6 code conventions — snake_case DB, no FK constraints with relations declared in Prisma, Prisma migrations append-only, audit_log on every mutation, FE/BE validation parity with no HTML5 native, sensitive files never in git) + renamed **Hard rules → Scope rules** (11 business/scope rules A–K). Added a Conflict-resolution section (JSON wins over markdown, CONTEXT.md wins over CLAUDE.md, ask user when working vs scope rules conflict). All internal links converted to relative `./` paths. Final size: 134 lines (under the 200 cap).

**New artifact**: `docs/planning/FEATURE_PLANNING.md` (159 lines). Documents the per-feature planning file workflow: location (`docs/planning/features/<YYYY-MM-DD>-<short-slug>.md`), lifecycle (`proposed → in-progress → shipped` with four ship criteria — SRS row, test cases promoted, CHANGELOG bullet, prototype-changes row), the full 9-section template, and the reactivation discipline (grep before coding; extend existing files rather than fix silently). 9 sections: Requirement (verbatim) · Plan · Test cases up front · Sign-off · Execution log · **Files changed** · **Agents used** · Post-deploy · Cross-references.

**Old session summaries** retained below for the audit trail of the v8 final-close and the UIUX Design Document delivery.

---

## 2f. Earlier session summary (2026-05-26 — UIUX Design Document delivered)

This session continued past the earlier "final close" with a substantial new artifact and several scope refinements.

**UIUX Design Document delivered** — new file at [docs/product/UIUX_Design_Document.docx](docs/product/UIUX_Design_Document.docx) (35.5 KB), generated by [doc-assets/templates/generate_design_document.js](doc-assets/templates/generate_design_document.js). 10 sections:
1. Design Principles · 2. Design Tokens (brand + status + typography desktop+mobile + spacing + radius/shadow + readability + color usage rules) · 3. Layout Foundations (breakpoint contract + sidebar + tabbar + MoreSheet + responsive transformations) · 4. Information Architecture (Public · Platform · Org-scoped pages) · 5. Page Layout Templates · 6. Wireframes (7 zone-tables) · 7. Components · 8. Interaction Patterns · 9. Accessibility · 10. Launch Checklist (grouped by Area).

**Routing model finalised**: three classes — Org-scoped (`/:org/...`), Platform (Super Admin, no prefix), Public (no prefix, no auth). The downstream `apps/web/src/app/(app)/<role>/...` route restructure is deferred to the v8 build phase.

**Solution Overview polish**: rent-collection jargon removed ("overnight job" → plain language), Admin + PM dashboard incomplete (both mentioned), visitor pre-approval captures date + time, Master Data sourcing bullet removed (in NR-3), "Another Admin" row dropped from impersonation scope table, new fix bullet for the 5+ alert on Admin dashboard.

**Spelling standardisation**: American English everywhere. Sed sweep across 10 active files: Organisation → Organization. All three artifacts regenerated. Old `/organisation-signup` URL → `/organization-signup`.

**Colour audit**: every hex value in the UIUX doc verified against `prototype/assets/styles.css`. 13 invented values caught and replaced with prototype-accurate values. Final hex allow-list (18 colours) matches the prototype exactly. Focus ring corrected from navy to saffron; primary button from navy to saffron; modal radius 16→12 px; card radius 10→12 px; etc.

**Visual / readability fixes**: §6 Wireframes refactored from ASCII art (fragile in Word) to structured Zone / Content tables. §10 Launch Checklist refactored from one big 25-row table to 7 per-Area sub-tables.

**Old session summary (2026-05-26 — final-close)** — moved below for reference:

Solution Overview was iterated end-to-end (v6.5 → v8) over a long single session. Major moves:

- **Structural rewrite**: dropped the Before/After table, all v1 feature restatements, the full ROLE_CAPABILITIES table, the Subscription Plans matrix-as-callout, Assumptions (later re-added focused), §What We Heard, and the §Updated Business Rules subsection. Removed duplicate BRs that just restated v1 BLs.
- **Scope decisions**: SAAS layer + Super Admin pulled forward (was v2). Master Data Administration + Settings reframed twice (gap → feature → gap → feature again — landed in §New Features). Per-room leasing reframed under "Leases & Tenants — Per-Room Leasing" to show it's an extension, not a standalone module. Admin Impersonation + Task Delegation reversed from deferred → in scope.
- **New artifacts**: created `harness-engineering` skill ([.claude/skills/harness-engineering/SKILL.md](.claude/skills/harness-engineering/SKILL.md)), `feature_list.json` (this state file's sibling), `Timeline.xlsx` + its generator ([doc-assets/templates/generate_timeline.js](doc-assets/templates/generate_timeline.js); installed `exceljs` for it), and split-out timeline that previously lived in the Solution Overview.
- **Audit pass** caught: one "Day 1" timeline leak, the Master Data deactivation contradiction (NR-4 vs feature bullet), word-for-word duplication of NR-7/NR-8 in the Impersonation + Delegation feature rows, NR-5 every-user-except-Super-Admin paradox, and a fabricated "overdue" concept in the Maintenance dashboard fix (overdue is rent-only per BL-12). All resolved.
- **Cover**: dropped the long subtitle and version number; cover now reads title + saffron rule + bold-italic saffron "DRAFT" + date + Prepared by (with contact) + Prepared for.
- **Final v8 section flow** (cover + 8 banners): Fixes · New Roles · New Features · Business Rules · Details · Assumptions · Out of Scope · Next Steps.
- **Reconciled at final-close**: this file, `feature_list.json`, `AGENTS.md`, `CLAUDE.md`, `README.md`.
- **Change logs written retroactively** in [agent-team-change-logs/](agent-team-change-logs/) for `gharsetu-lead-2026-05-26.md` and `document-agent-2026-05-26.md` — flagged as a process violation; rule requires per-task append, was done at session close instead.

---

## 3. What's in flight

**v8 prototype is built.** All 7 new features and 6 module gap closures are live in `prototype/`. Application port to `apps/web` + `apps/api` is the next major phase.

| Stream | Status |
|---|---|
| Super Admin pages (5) | ✅ shipped |
| Public landing + org sign-up + auth refresh | ✅ shipped |
| Visitor Management | ✅ shipped |
| Admin Module Additions (Master Data + Settings + Delegations) | ✅ shipped |
| Admin Impersonation | ✅ shipped |
| v8 Module Gap Closures (all 6 modules) | ✅ shipped |
| Sidebar account-menu refactor + common UI cleanup | ✅ shipped (37 pages) |
| Homepage redesign (modern landing) | ✅ shipped |
| Public-chrome single source (nav + footer on 4 public pages) | ✅ shipped |
| Plans "Most Popular" Super Admin control + signup de-hardcode | ✅ shipped |
| Master-data deactivate reason → button tooltip (6 masters) | ✅ shipped |
| Profile Role-as-badge · Server Logs Lines column removed · Edit-Profile modal | ✅ shipped |
| Property Types master (org-level) + Add-Property dropdown wired | ✅ shipped |
| Admin Leases page (org-wide) + Leases nav across 17 admin pages | ✅ shipped |
| Property listing Edit + summary tiles · property-detail unit add/edit/retire · amenities checkboxes | ✅ shipped |
| Signup State→City cascade (`locations.js`) + Pincode | ✅ shipped |
| Global success toast (`toast.js`) rolled out to all 64 pages | ✅ shipped |
| Master Data restructure + platform/org ownership split | ✅ shipped |
| Server Logs (Super Admin) · Delegations 3-col modal · filter pills→tiles | ✅ shipped |
| **Anchor-day billing model** (Approve modal anchor picker · 5 surfaces re-anchored · SRS NR-13/14 rewritten · planning doc aligned) | ✅ shipped 2026-05-29 |
| **Admin Organization page** (absorbed billing.html; 25 admin files updated; new admin/invoice-detail.html) | ✅ shipped 2026-05-29 |
| **Payment Methods master** (`assets/payment-methods.js`) + Mark Paid dropdown with dynamic ref label | ✅ shipped 2026-05-29 |
| **Plan UI polish** (Core/Optional unified flat list across 4 surfaces · signup tile redesign · ?plan URL auto-select · Priority Support + Task Delegation/Standard removed) | ✅ shipped 2026-05-29 |
| **Delegation New** (30 tasks × 8 groups · per-group Select all · chips preview with count) | ✅ shipped 2026-05-29 |
| **SearchableSelect.refresh** wrap-lookup bug fix (signup City cascade) | ✅ shipped 2026-05-29 |
| **Create Lease wizard overhaul** (modernization · Step 5 restructure · trim · history-card relocate+combine · step-strip · numeric-id mock-data refactor · quick-create deep-link from unit-detail) | ✅ shipped 2026-05-30 |
| **NEW `assets/date-picker.js`** (DD/MM/YYYY, Mon-start, range-pair sync) + bulk rollout to 12 pages / 20 inputs + 5 range pairs wired | ✅ shipped 2026-05-30 |
| **CLAUDE.md rule #19 strengthened** (numeric-id PKs + relations via id only — applies to prototype mock data too) | ✅ shipped 2026-05-30 |
| Visitor pages card→table + tiles | ✅ shipped (PM + tenant) |
| Tenant My Leases + Tenant Lease Detail | ✅ shipped |
| Units IA refactor → per-role Unit Detail | ✅ shipped |
| PM Properties + multi-property + read-only tenure history | ✅ shipped (retires one-PM-per-property — see amendment below) |
| 4 maintenance-detail pages + Lease/Property context card + progress timeline + role-based actions | ✅ shipped |
| Maintenance role assigned-only + no self-assign · all-open→all-requests | ✅ shipped |
| Server-side pagination component on all 21 list pages | ✅ shipped |
| **Per-Room Leasing — HTML iteration** | 🟡 planned (10 files identified in §6 of its planning file) — still NOT built |
| Application port (prototype → apps/web + apps/api) | ⏸ not started |
| `feature_list.json` row creation for the v8 features | ⏸ pending lead pass |
| `prototype-changes.md` ledger | 🟢 started 2026-05-27 (homepage + this session's rows); backfill earlier v8 rows on next pass |
| SRS amendments (one-PM-per-property retired · maintenance assign/close authz · lease-anchored-to-unit) | ⏸ to fold in at next SRS pass — see `docs/planning/features/2026-05-27-ia-restructure-*.md` §2.0 |

---

## 4. Blockers

| Item | Type | Why blocked | Unblock criteria |
|---|---|---|---|
| **CARRY-01** — NestJS 10 → 11 migration | Carry-over | Awaiting user decision on N-1 vs latest dependency policy | User clarifies preference. No exploitable code path per VAPT, so not release-blocking. |
| **CARRY-05** — Password min 10 → 12 | Carry-over | Deferred by user; SRS §10.2 deviation documented in VAPT report | Reopen only on explicit user request. |

No BL or current-engagement feature is currently blocked.

---

## 5. Next session priority

Prototype is now feature-rich across all 5 roles AND the SAAS/billing layer (anchor-day billing, invoicing, plans). Viable starting points — user picks:

1. **Backend dispatch for anchor-day billing.** Prototype + SRS + planning doc are all aligned on the new model (NR-13/14 rewritten 2026-05-29). Next: `organizations.billing_anchor_day SMALLINT CHECK BETWEEN 1 AND 28 NOT NULL` migration · daily 00:00 IST cron with `WHERE billing_anchor_day = EXTRACT(DAY FROM CURRENT_DATE)` filter · Approve endpoint captures the anchor day · invoice generation cycle = `[anchor of this month, anchor − 1 of next month]`.
2. **Backend dispatch for invoicing module.** Schema + 00:00/00:05 cron transitions + Mark Paid endpoint (with Payment Methods FK) + Cancel Invoice endpoint + audit trail per NR-15 (append-only once issued). Planning file `docs/planning/features/2026-05-28-plans-and-billing.md` is the binding spec.
3. **Implement Per-Room Leasing prototype HTML** — the last unbuilt prototype feature. Planning file complete (`docs/planning/features/2026-05-26-per-room-leasing.md`, 589 lines, 42 TCs, 5 open questions). 10 prototype files identified in §6.
4. **Fold SRS amendments + regenerate Solution Overview** — pending business-rule changes from earlier sessions not yet reflected in the docx: (a) one-PM-per-property retired → multi-property + tenure history; (b) maintenance role cannot self-assign or close; (c) lease anchored to unit not property. Plus Master Data platform/org split + Server Logs as new Super Admin surfaces. NR-13/14 already updated in the SRS this session — Solution Overview docx hasn't been regenerated yet.
5. **Begin application port.** Pick highest-leverage first: ENG-F06 Org Management/SAAS + Super Admin (gates user-scoping) or ENG-F01 Per-Room Leasing (biggest schema change). Create `feature_list.json` rows. The 4 planning files dated 2026-05-27 + the plans-and-billing file dated 2026-05-28 are binding specs.
6. **Sign off on open decisions** still pending: 5 Per-Room Leasing questions · 2 Impersonation (active-org gate, nested guard) · PM tenure-window data-scope confirmation.
7. **Smaller follow-ups from 2026-05-30:** (a) build a `pm/create-lease.html` mirror so the PM `unit-detail.html` can also surface the quick-create-lease buttons; (b) extend the numeric-id mock-data pattern to the remaining prototype pages whose mock arrays still key by slug (sweep candidates: `admin/leases.html`, `admin/tenants.html`, `pm/properties.html`).

If the user has none in mind: surface this list and ask which to start.

---

## 6. Carry-over / known issues

From [docs/testing/v1/phase-8-closeout.md](docs/testing/v1/phase-8-closeout.md) §Carry-over — none release-blocking:

| ID | Item | Source | Status |
|---|---|---|---|
| CARRY-01 | NestJS 10 → 11 (clears `@nestjs/core` GHSA-36xv) | VAPT | blocked (user decision) |
| CARRY-02 | Next.js CSP header via `next.config.mjs` | VAPT | not_started |
| CARRY-03 | Extract `formatDateIST` / locale helpers to `@gharsetu/shared` | BUG-BL22-001 fix | not_started |
| CARRY-04 | Playwright spec isolation (or commit to `--workers=1` in CI) | Phase 8 closeout | not_started |
| CARRY-05 | Password min 10 → 12 (ASVS L2) | OWASP ASVS L1 | blocked (user deferred) |

All five are tracked in `feature_list.json` under `carry_over_v1_post_release`.

---

## 7. Session log (recent only — keep ≤10 entries)

| Date | HEAD | Agent | What changed |
|---|---|---|---|
| 2026-05-30 | _pending_ | orchestrator (Opus) + gharsetu-frontend | **Create Lease wizard end-to-end overhaul** — modernization pass (gharsetu-frontend agent: 32 px step circles + saffron glow ring, `panelFadeIn`, card colored bands, conflict banner, sticky 268 px summary rail, `wizard-shell`, "Step N of 5", accordion context panels) · Step 5 restructure → trim → history-card relocate+combine+wrap+fix-empty-state → wizard step indicator stretched full-width → Step 5 **context strip** (`UNIT-WISE LEASE` chip + Property › Unit › Room breadcrumb) → **mock-data refactor to numeric ids** (`PROPERTIES`/`UNITS`/`ROOMS`/`TENANTS`/`UNIT_LEASES` flat arrays with numeric `id` + numeric FKs; ~20 onclick handlers + 9 helper lookups + dataset string-coercion fix + Step 2 stale-grid bug fix) → **quick-create-lease deep-link flow** (admin `unit-detail.html` + Create Lease for Unit + per-room + Create Lease buttons; wizard reads `?unitId=<n>&roomId=<m>` and jumps to Step 4 pre-seeded). **NEW `prototype/assets/date-picker.js`** (DD/MM/YYYY, Mon-start, `data-min-date`/`-max-date`/`-pair-min`/`-pair-max`) + **bulk rollout to 12 prototype files / 20 inputs** + **5 date-range pairs wired** (`cl-start↔cl-end`, `start↔end` pm/leases, `from-date↔to-date` audit-log, `delegStart↔delegEnd`, `rl-start↔rl-end`). **CLAUDE.md rule #19 strengthened** to bind cross-table relations and prototype mock data to numeric ids only. |
| 2026-05-29 | _pending_ | orchestrator (Opus) | **Anchor-day billing** introduced: per-org `billing_anchor_day`, daily cron, 5 surfaces re-anchored, SRS NR-13/14 rewritten, planning doc aligned. **Approve modal redesigned** — org summary table + Primary Contact editable + email-collision detection + billing anchor day picker with live preview. **Admin `billing.html` → `admin/organization.html`** (full org-detail page, 25 admin files updated, new `admin/invoice-detail.html`). **Mark Paid wired to Payment Methods master** (`assets/payment-methods.js`, dynamic ref label per method). **Plan UI polish** — Core/Optional unified flat 2-col feature list across 4 surfaces · signup tile redesign (floating badge, big price, KPI chips) · `?plan=<id>` auto-select · Priority Support removed · Task Delegation removed from Standard · Generate Invoice button removed. **Delegation New** 30 tasks × 8 groups. **`SearchableSelect.refresh`** wrap-lookup bug fix. Change-log + prototype-changes ledger + claude-progress sections 2/3/5/7 updated. |
| 2026-05-27 | _pending_ | orchestrator | Admin role build-out + 2 cross-cutting features. **Property Types master** (org-level: `property-types.html` + `property-types.js` + Add-Property dropdown + sublink ×17). **Admin Leases page** (`admin/leases.html`, org-wide + Leases nav ×17). Property detail: Current-Tenant column, **Add/Edit Unit** modal (status locked while occupied) + **Retire** (reason, soft status), removed Active-Leases/Edit-Property/Create-Lease, unmasked PM phone. Property listing: **Edit Property** (shared modal, manager hidden in edit) + read-only summary tiles. Add/Edit Property amenities → checkboxes. Dashboard: Overdue-Leases + Recent-Open-Maintenance. **Signup State→City cascade** (`locations.js`) + Pincode. **Global success toast** (`toast.js`) across all 64 pages (38 alerts + 12 announce + signup/contact). Visit-Purposes note→tooltip. `gharsetu-frontend` model → `claude-sonnet-4-6`. 3 planning files added. |
| 2026-05-27 | `994bfa4` | orchestrator + gharsetu-frontend | Homepage redesign shipped (glass nav, hero+dashboard-mock+stats strip, alternating capability rows, how-it-works, bento roles, popular-glow plans, merged navy CTA, scroll-reveal) · footer deep-navy `#0D1757` separation · **`public-chrome.js` single source** for nav+footer across index/contact/privacy/terms (auth pages chrome-free) · profile Role row → badge only (5 roles) + Edit-Profile modal (Name+Mobile only) · Server Logs Lines column removed · Super Admin sidebar fixed (payment-methods missing Business Types) · master-data deactivate reason → disabled-button `title` tooltip (6 masters, 27 notes) · Plans Super-Admin "Set as Most Popular" control + signup helper de-hardcoded ("Most Popular", no plan name). `prototype-changes.md` created. |
| 2026-05-27 | _pending_ | gharsetu-lead + gharsetu-frontend | Super Admin review pass + 2 new features: org slugs (`?org=<slug>` everywhere) · org-detail redesign (status simulator + conditional actions + 3 tabs incl. Subscription Plan History) · Plans full CRUD + 9-feature flag catalogue · single-source `plans.js` (home + signup + super-admin render same ✓/✗ list) · Business Types platform master + signup wiring · Legal+Contact feature (privacy/terms/contact public pages + Super Admin Legal editor + Contact Inbox, record-only per Scope-K) · favicon on all 62 pages · removed all helper captions + detail-page back-links. Homepage redesign PLANNED (awaiting sign-off). |
| 2026-05-27 | _pending_ | gharsetu-lead + gharsetu-frontend | IA restructure: deleted standalone Units pages (admin+pm) → created per-role `unit-detail.html` wired from property-detail · `tenant/lease-detail.html` (full payment/co-tenant/maintenance/terminate actions) · `pm/properties.html` + `pm/property-detail.html` with multi-property + read-only tenure-history (retires one-PM-per-property) · created `tenant/maintenance-detail.html` + `maintenance/maintenance-detail.html` (4 role detail pages now complete, each with progress timeline + role-based action card) · maintenance role scoped to assigned-only, self-assign removed, all-open→all-requests · server-side pagination component (`paginate.js`) on **21 list pages** (URL-driven, search/tile reset, tile counts = full dataset). 3 agent dispatches crashed at socket watchdog; orchestrator finished residual by hand. |
| 2026-05-27 | _pending_ | gharsetu-lead | Server Logs (Super Admin diagnostics) + Delegations modal fix: new `prototype/super-admin/server-logs.html` with 10 mock daily log files · View modal with dark-theme JetBrains Mono log viewer + colored levels · real Blob download for `.log` files · sidebar entry rolled out to 9 Super Admin pages · planning file `2026-05-27-server-logs-page.md` authored BEFORE code (documents app-port carry-over: `apps/api/logs/api-YYYY-MM-DD.log` Pino convention, Super-Admin-only `/api/v1/platform/logs` endpoints, `VIEW_SERVER_LOG`/`DOWNLOAD_SERVER_LOG` audit actions, 90-day retention) · Delegations create modal widened 560→960px and `.checkbox-group` flipped from column to 3-col grid (responsive 3/2/1) so page doesn't get too long. |
| 2026-05-27 | _pending_ | gharsetu-lead | Master Data ownership split (platform vs org): Cities/States/Payment Methods moved from Admin to Super Admin · `prototype/super-admin/master-data/` subfolder created with 3 sub-pages (Super Admin chrome — Dashboard/Orgs/Plans sidebar + Aayush/Super Admin/AK identity + 4-tab tabbar) · new `super-admin/master-data.html` 3-card landing · Master Data sub-menu added to 5 Super Admin sidebar pages · Admin sub-menu trimmed from 6→3 (Amenities, Categories, Visit Purposes) across 16 admin files · `admin/master-data.html` rewritten as 3-card landing · 3 platform pages deleted from admin · planning file `2026-05-27-master-data-ownership-split.md` authored BEFORE code per Working rule §2 · documents schema model carry-over for app port (platform tables WITHOUT `organization_id`, org tables WITH NOT-NULL `organization_id`). |
| 2026-05-27 | _pending_ | gharsetu-lead + gharsetu-frontend | Master Data restructure + Visit Purposes master: split `master-data.html` into 6 entity pages under `prototype/admin/master-data/` (Amenities, Categories, Payment Methods, Cities, States, Visit Purposes — NEW) · 6-card landing replaces the old tabbed page · expandable Master Data sub-menu in sidebar + More-sheet rolled out to all 12 admin pages · `tenant/visitors.html` purpose select wired to the 6 master values + "managed in Master Data" helper + "Other" free-text reveal · planning file `2026-05-27-master-data-restructure.md` authored BEFORE code (per Working rule §2). Agent stalled mid-task; orchestrator delivered 2 missing sub-pages + landing + sidebar sweep + visitor wiring. |
| 2026-05-27 | _pending_ | gharsetu-lead + gharsetu-frontend | Common UI cleanup: 11 cleanup categories across 37 prototype pages · planning file `2026-05-26-common-ui-cleanup.md` (47 TCs across 7 namespaces, authored retroactively as binding spec for app port) · sidebar logo → role dashboard · topbar-user removed (12 pages) · account-menu v2 with avatar+name+role header · mobile bottom-sheet · `My Profile` moved into account menu · `Logout`→`Sign out` rename · subtitles removed (37) · profile pages standardized + Recent Activity table · tenant identity unified · `Dashboard` label uniform across all roles. |
> Older milestones (2026-05-27 v8 prototype build-out · 2026-05-26 CLAUDE.md overhaul · 2026-05-26 UIUX Design Document v3 · 2026-05-26 `f26752f` Solution Overview v8 close · 2026-05-25 harness rollout · 2026-05-22 v6.5 draft · 2026-05-11 Phase 8 closeout `d0805bc` + final regression `02d6a53`) trimmed per the ≤10-entry cap; see git history + `agent-team-change-logs/` + `docs/testing/v1/phase-8-closeout.md`.

---

## 8. Cross-session decisions (durable — do NOT delete)

- **N-1 dependency policy** in force (per user) — NestJS stays at 10, NOT upgraded to 11 until explicit reversal.
- **Password minimum length stays at 10** (SRS §10.2) — ASVS L2 12-char recommendation explicitly deferred.
- **Playwright runs `--runInBand` / serial** in CI today — known limitation, not a bug.
- **N+1 dependency overrides** in root `package.json` (`multer`, `file-type`, `path-to-regexp`, `lodash`, `postcss`, `uuid`) — keep these; they patch known CVEs without bumping majors.
- **Submodule layout** (`apps/api`, `apps/web` as git submodules pointing at separate GitHub repos) — keep; see [MULTI_REPO_SETUP.md](docs/planning/v1/MULTI_REPO_SETUP.md).
- **SAAS data isolation** locked to `shared schema + organization_id + Postgres RLS` (2026-05-24).
- **Billing** locked to manual / out-of-scope. No payment gateway, ever.
- **Sequencing pivot (2026-05-26)**: SAAS layer, Super Admin role, Admin Impersonation and Admin Task Delegation all pulled forward into the current engagement (originally deferred). Only subscription billing integration and custom domains + per-org branding remain deferred — see [Solution_Overview.docx §Out of Scope](docs/product/Solution_Overview.docx) and [feature_list.json](feature_list.json) `deferred_post_engagement`.
- **Routing model (2026-05-26)**: three route classes — Org-scoped (`/:org/...`), Platform (Super Admin only, no prefix), Public (no prefix). When the Next.js app is updated for v8, the existing `apps/web/src/app/(app)/<role>/...` folders need to collapse to shared paths under these three classes.
- **Spelling (2026-05-26)**: American English everywhere — "Organization" (not Organisation). Locked across all 10 active files. Both display labels and URLs use American spelling.
- **UIUX Design Document philosophy**: this is a UI/UX-only document — the spec the prototype builds against. Engineering / system design lives elsewhere. Every colour, radius, shadow, focus ring, font and spacing token in the doc must verify against `prototype/assets/styles.css` — never invent values.
- **CLAUDE.md is partitioned into three rule bands (2026-05-26)**: Working rules (process — how we work), Technical conventions (code-level — DB / validation / audit), Scope rules (business — what the product is). Never let a Working / Scope rule contradict — if they appear to, the user is asked, not picked silently.
- **Feature planning files (2026-05-26)**: every new feature gets `docs/planning/features/<YYYY-MM-DD>-<short-slug>.md` BEFORE coding. Lifecycle `proposed → in-progress → shipped`; `shipped` is terminal. Reactivation discipline = grep before coding, extend existing file rather than fix silently. Full template + process in [docs/planning/FEATURE_PLANNING.md](docs/planning/FEATURE_PLANNING.md).
- **Solution Overview structure (final, v8)**: cover (DRAFT marker, no version number) + 8 banners — Fixes, New Roles, New Features, Business Rules, Details, Assumptions, Out of Scope, Next Steps. No timeline content in the .docx — that lives in `Timeline.xlsx`.
- **Timeline lives in Excel**: [docs/product/Timeline.xlsx](docs/product/Timeline.xlsx), regenerated from [doc-assets/templates/generate_timeline.js](doc-assets/templates/generate_timeline.js). The Solution Overview should NOT mention `Timeline.xlsx` by name in customer-facing copy.
- **Single-source shared assets (2026-05-27)**: cross-page prototype UI is driven from shared modules in `prototype/assets/` to prevent drift — `plans.js` (plan catalogue + marketing/signup/super-admin cards, incl. the `popular` "Most Popular" flag), `legal.js` (privacy/terms content), `business-types.js`, and now `public-chrome.js` (public nav + footer for index/contact/privacy/terms). When porting, these become real components/config, not per-page copies. Public marketing/legal pages share one header+footer; auth pages (login/signup) are deliberately chrome-free.

---

## How to update this file

At session exit:

1. Update section 2 (Last session summary) — replace it with this session's 5–10 bullets.
2. Move section 2's previous content into section 7 (one row).
3. Update section 3 (in flight) — mirror what's `in_progress` in `feature_list.json`.
4. Update section 4 (blockers) — mirror `state: "blocked"` rows from `feature_list.json`.
5. Update section 5 (next priority) — top 1–3 things.
6. If a durable decision was made, add it to section 8.
7. Keep this file under ~300 lines. If it grows, trim section 7.
