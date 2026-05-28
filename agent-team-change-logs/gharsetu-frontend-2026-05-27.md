# gharsetu-frontend — change log — 2026-05-27

## Task 1 — Profile "Edit details" form (all 5 roles)

**Request:** profile pages showed a JS `alert()` instead of a real edit form; need a form to update profile where **Email and Role are not editable** — only Name and Mobile.

**Done:**
- Wired the "Edit details" trigger on all five profile pages (super-admin / admin / pm / maintenance / tenant). Maintenance had no button — added one after the Account-status row. Tenant's "Edit phone / email" renamed to "Edit details".
- Injected an `#editProfileModal` + script into each page: `#ep-name` (editable), `#ep-phone` (editable, "Mobile number"), `#ep-email` (disabled, "Email (locked)"); **Role field omitted entirely**.
- `openEditProfile()` reads current Name/Phone/Email from the `.profile-row` spans; `saveProfile()` validates name non-empty + phone ≥10 digits, writes back to the rows + `.profile-name` header; Escape + backdrop-click close.
- Verified: all 5 pages `modal=1`, no `ep-role` field, email `disabled` + "Email (locked)" label present.

## Task 2 — Homepage redesign (`prototype/index.html`)

**Request:** "implement the home page new design plan" — modern, AI-era visual redesign per [`docs/planning/features/2026-05-27-homepage-redesign.md`](../docs/planning/features/2026-05-27-homepage-redesign.md).

**Done — full rewrite of `prototype/index.html`, sections A–H:**
- **Nav (A):** sticky white bar → navy glass-blur (`rgba(26,35,126,0.85)` + `backdrop-filter`) on scroll past 60px; logo "Ghar" + "Login" switch to white under glass for contrast; saffron **Register** pill added (hidden ≤1023px).
- **Hero (B):** navy gradient (`135deg #1A237E→#0D1757→#1565C0`) + 10% saffron radial mesh; 60px H1; copy left, browser-framed **dashboard product mock** right (KPIs + rent ledger built from `.badge` atoms); factual **stats strip** (120+ / 18 / 4) on hero bottom edge, hidden ≤480px.
- **Capabilities (C):** flat 4-card grid replaced with **4 alternating two-column feature rows** (mock + text), each with mock-lift hover.
- **How-it-works (D):** new 3-step section with saffron `01/02/03` pills + desktop dashed connector.
- **Roles (E):** **bento 2×2** with Admin emphasized (saffron left-border + navy icon + "Owner / Operator" pill).
- **Plans (F):** light-gray bg; popular card gets a saffron glow; `renderMarketingPlans("plansGrid")` **unchanged** (single source preserved).
- **CTA + Footer (G/H):** merged into one seamless navy band.
- **JS:** glass-nav scroll toggle + `IntersectionObserver` scroll-reveal; both reduced-motion aware. Skip link added for a11y bypass-blocks.

**Open-decision resolutions:** OD-1..OD-5 → A (richer options); **OD-6 → A (Register pill)**, overriding the plan's documented default B — rationale recorded in the planning file §4/§5 (nav CTA serves the "AI-era" goal; pill hidden on mobile). New CSS in an inline `<style>` (allowed by plan §2.5), not the shared `styles.css`.

**Verified:** `renderMarketingPlans("plansGrid")` present (1×); all `badge-*` classes used exist in `styles.css`; 6 sections in correct order; 9 `.reveal` hooks; no helper-caption subtitles under any `<h2>`; HTML tag balance clean (parser: 0 residual-open, 0 errors).

**Docs:** planning file status → shipped + OD log; `docs/planning/prototype-changes.md` created + row added.

## Task 3 — Homepage CTA/footer separation

Final CTA and footer both navy → read as one block. Stepped the footer down to deep navy `#0D1757` (the hero-gradient midpoint shade) + a `rgba(255,255,255,0.10)` hairline top border, so the CTA stays the primary band and the footer recedes.

## Task 4 — Profile pages: Role only as badge

Removed the **Role** `.profile-row` from super-admin / admin / pm / maintenance profiles (tenant never had one). Role stays as the `.profile-role` badge by the name. Edit-profile JS only touches Name/Phone/Email, so unaffected.

## Task 5 — Server Logs: removed Lines column

Dropped the **Lines** `<th>` + row `<td>` from `super-admin/server-logs.html`; header/cells rebalanced 5-for-5. Underlying `lines` data kept (file-preview modal still shows the count).

## Task 6 — Unified public-page header/footer (single source)

Public pages had drifted (homepage glass nav + rich footer vs. older simple nav/slim footer on contact/privacy/terms). Created **`assets/public-chrome.js`** — one source that injects an identical sticky glass nav (Login + Register pill) and the deep-navy Company/Legal footer into `#gs-public-nav` / `#gs-public-footer` placeholders. Wired into `index.html` (refactored — removed inline nav/footer markup, chrome CSS, glass-scroll JS), `contact.html`, `privacy.html`, `terms.html`. Auth pages (login, signup) stay chrome-free. Tag balance verified clean on all 4.

## Task 7 — Super Admin sidebar consistency

`super-admin/master-data/payment-methods.html` was missing the **Business Types** sublink (added to the other masters later, skipped here). Added it. Diffed all 9 Super Admin pages + 4 master subpages — sidebar item sequence now identical everywhere (only `active`/`../` differ, as expected).

## Task 8 — Master-data deactivate reason → button tooltip

Across all 6 masters (4 platform: cities/states/payment-methods/business-types; 2 org: amenities/categories) removed the in-cell `<p role="note">Cannot deactivate — currently used by N record(s)…</p>` line (27 total) and moved each message into the disabled Deactivate button's `title` attribute (dropped the now-dangling `aria-describedby`). Scripted; verified 0 leftover notes, 27 titled buttons.

## Task 9 — Plans: set "Most Popular" from Super Admin

The public "Most Popular" highlight was a fixed `popular:true` on Standard in `plans.js`. Added a Super Admin control on `super-admin/plans.html`: the featured card shows a saffron **★ Most Popular** badge + saffron top-border; every other active plan shows a **Set as Most Popular** button. `setPopular(id)` flips the flag exclusively (clears all others) and re-renders; deactivating the popular plan clears its flag (can't feature a deactivated plan). Reads/writes the shared `window.GHARSETU_PLANS` so home + sign-up cards stay in sync within the session. JS syntax-checked.

## Task 10 — Signup: de-hardcode the plan helper line

`organization-signup.html` helper read "Not sure? Pick **Standard** — you can change later." — brittle (wrong the moment Standard is renamed or another plan becomes featured). Changed to **"Not sure? Pick the one marked Most Popular — you can change later."** (no plan name). Also aligned the signup plan-tile badge in `plans.js` from "Popular" → "Most Popular" so the text matches the visible badge; both track the shared `popular` flag. `plans.js` re-checked.

---

### Session close (2026-05-27)
- Debug scan on all changed files: clean (no `console.log` / `debugger` / `FIXME`).
- `claude-progress.md` updated (§2 summary, §3 in-flight, §7 log row + trim, §8 single-source decision).
- `docs/planning/prototype-changes.md` rows added for this session.
- `pnpm build/test/lint/typecheck` not run — **no app code touched** (all changes are static `prototype/` + `docs/`; `apps/web` + `apps/api` submodules untouched).
- Commit/push NOT performed — awaiting explicit user authorization per CLAUDE.md Working rule §1.

---

## Task 11 — Admin dashboard copy/IA tweaks

- KPI **"Overdue Tenants" → "Overdue Leases"** (label + tooltip) — overdue is anchored to the lease, not the tenant.
- Replaced **"Property Snapshot"** section with **"Recent Open Maintenance Requests"** (latest 4 open; Request · Property·Unit · Issue · Priority · Reported · Status; emergency row matches the alert above). Tag-balanced.

## Task 12 — Property Types master (planned + shipped)

Plan-first: `docs/planning/features/2026-05-27-property-types-master.md` (org-level decision, seed, test cases). Shipped:
- NEW `assets/property-types.js` (single source + `renderPropertyTypeOptions`) and `admin/master-data/property-types.html` (clone of amenities; 5 seed types; deactivate-block tooltips).
- Landing card on `admin/master-data.html`; **Property Types sublink rolled out to all 17 admin nav surfaces** (sidebar + more-sheet, placed first) via script (32 inserts).
- Add Property **Type dropdown wired** to the master (`renderPropertyTypeOptions('add-prop-type')`).
- Verified: JS `node --check` OK; 17/17 sublink coverage both navs; 17/17 admin pages tag-balanced.

## Task 13 — Add Property: Amenities → checkbox list

Replaced the `<select multiple>` + chip-sync with an 8-item checkbox grid (`name="amenities"`); removed `syncAmenityChips`/`#amenityChips`. Helper trimmed. (Edit Property remains a placeholder `alert()` — flagged to user; no real form yet.)

## Task 14 — Visit Purposes deactivate note → tooltip

The 6-master tooltip sweep (Task 8) missed visit-purposes (different wording). Moved its 5 in-cell "Used by N visits…" notes to the disabled-button `title` (canonical wording); removed the `<p role="note">` lines. All 8 masters now consistent. Tag-balanced.

## Task 15 — Admin property detail polish

Manager phone unmasked (Admin scope; email already full). Removed "Active Leases" section (lives on unit detail). Units table: added **Current Tenant** column; **Add/Edit Unit** modal (status select locked while occupied + "Occupied" not manually selectable); **Retire** row action (reason required, blocked while occupied via disabled-button tooltip — soft status badge, not a delete). Removed **Edit Property** and **+ Create Lease** buttons. Tag-balanced, JS parses.

## Task 16 — Admin property listing: Edit + summary tiles

Type-filter tiles → read-only **summary tiles** (Available Units / Total Active Leases / Upcoming Leases) via a new `.is-static` modifier. **Edit Property** per row (14) via a shared add/edit modal (`openPropertyModal` / `editPropertyRow` / `saveProperty`); Assign-Manager field hidden in edit mode. Add/Edit Property **amenities** → checkbox grid (was multi-select).

## Task 17 — Signup State→City cascade + Pincode

New single-source `assets/locations.js` (5 states / 5 NCR cities mirroring the masters). State dropdown = states with cities; City cascades from State (disabled until chosen). Added **Pincode** (6-digit, digits-only). Validators + submit wiring updated. JS parses.

## Task 18 — Global success toast (all forms)

Plan `2026-05-27-global-success-toast.md`. Built `assets/toast.js` + CSS (top-right, auto-dismiss 4s, pause-on-hover, dismissable, `aria-live`, reduced-motion). Rolled out to **all 64 pages**: 38 success `alert()` → `gsToast`, 12 master `announce()` routed, `property-detail` `showSuccess` → toast, signup + contact toast on success. Placeholders left as `alert()`. 63/63 tag-balanced + sampled JS parses.

## Task 19 — Admin Leases page

Plan `2026-05-27-admin-leases-page.md`. NEW `admin/leases.html` (org-wide list + filter tiles + property filter + New Lease modal + co-tenant consent + pagination; View → unit-detail; gsToast). **Leases** sidebar + more-sheet link rolled out to all 17 admin pages (after Properties). 18/18 admin tag-balanced.

## Task 20 — Config

`gharsetu-frontend` agent model pinned `sonnet` → `claude-sonnet-4-6` (user request).

## Task 21 — PM property-detail + unit-detail: mirror Admin display changes

**Files changed:** `prototype/pm/property-detail.html`, `prototype/pm/unit-detail.html`

**pm/property-detail.html:**
- Removed the entire `<!-- Active leases -->` section (table with 2 rows + headers). Leases now live on unit-detail only.
- Units table: added `<th>Current Tenant</th>` between Status and Action. Occupied rows (1A→Rohan Mehta, 2B→Priya Patel) get the tenant name; Available/Listed rows (3A, 7C) get an empty `<td>`.
- Open Maintenance Action cell links changed from "View" → "View detail" (matching admin pattern; `text-royal-blue font-poppins font-semibold text-sm`).
- No CRUD controls added (no Add/Edit/Retire unit — PM is display-only for unit structure).

**pm/unit-detail.html (full rewrite):**
- Removed `<button class="btn btn-primary ...">Edit unit</button>` from topbar (and its wrapper `<div class="flex gap-3">`).
- Removed `<button class="btn btn-secondary ...">+ Create Lease</button>` from lease section header.
- Collapsed "Active Lease" + "Past Leases" into a single **"Leases"** table. Columns: Lease · Tenant · Co-tenant · Start · End · Rent · Status · Action. Active row first with `badge badge-active`; past rows with `badge badge-closed` (Ended) and `badge badge-terminated` (Terminated). Co-tenant shows `—` where none. No reason sub-notes under badges.
- Added `<section class="section" id="tenant-section">` "Current Tenant(s)" card: Rohan Mehta (Primary / `badge-active`) + Priya Mehta (Co-tenant / `badge-prepaid`); footer line links to `lease-detail.html?id=L-2103`.
- Added prototype status simulator (dashed card, 5 buttons `data-usim`, `setUnitSimStatus` JS, init to `occupied`). Status→badge map matches admin. `#tenant-section` visible only when `occupied`.
- `id="unit-status-badge"` on the context card badge.
- PM chrome (Sunita / PM / SA identity, PM sidebar, PM tabbar, more-sheet) unchanged throughout.
- All lease links → `lease-detail.html` (PM); maintenance links → `maintenance-detail.html` (PM).
- `assets/toast.js` script tag preserved.

**Verified:** HTML tag-balance OK (python html.parser); inline JS `node --check` OK; all 16 checks passed on both files (PM chrome, absent CRUD controls, required new elements).

---

### Session close (2026-05-27 PM)
- Debug scan clean (no console.log/debugger/FIXME); 64/64 HTML tag-balanced; all `assets/*.js` parse.
- `claude-progress.md` (§2/§3/§7), `prototype-changes.md`, this change-log updated.
- 3 new planning files (property-types, admin-leases, global-toast).
- `pnpm` gates N/A — prototype + docs only; `apps/*` submodules untouched.
- Commit/push pending user authorization (Working rule §1).

---

## Continuation (2026-05-27, after the first close — admin/PM unit-detail + create-lease + reject + export)

- **Create Lease → full page** `admin/create-lease.html` (Unit · Lease terms · Primary tenant · repeatable Co-tenants); Leases "+ New Lease" navigates there (modal removed); flash-toast on return. Removed "+ Create Lease" from unit-detail and property-detail.
- **Org detail — Reject** action for pending orgs (red button + required-reason modal + new `Rejected` status/badge) alongside Approve.
- **Properties Export → real CSV** download (Blob) + toast (was a placeholder alert).
- **Unit detail unified + occupancy-aware** (admin + PM identical): combined Active/Past leases → one **Leases** table + Status column; **Current Tenant(s)** card; **Bathrooms** attribute (modal + table); Monthly Rent → top context card; lease KPI strip; **prototype status simulator** moved to the top — when not occupied it hides the tenant card, lease KPI strip, active-lease row, and (except *Under Maintenance*) the Open Maintenance section. **Open Maintenance section removed** from unit detail.
- **Property detail**: Units table + **Bathrooms** column + **Add/Edit Unit** modal (status locked while occupied) + **Retire** (reason, soft status); Open Maintenance rows → View-detail; "Active Leases" section removed; manager phone unmasked.
- **PM parity mirror** (Task 21, via gharsetu-frontend agent): PM property/unit detail matched to admin display/lease/preview behaviour, **no** structural CRUD (PM operations-scoped).

### Session close (final, 2026-05-27)
- Debug scan clean; **65/65** HTML tag-balanced; all `assets/*.js` parse.
- `claude-progress.md` §2 (items 10–15) + `prototype-changes.md` (6 rows) updated.
- `pnpm` gates N/A — prototype + docs only; `apps/*` untouched.
- Commit/push pending explicit user authorization (Working rule §1).

---

## Continuation (2026-05-27, late — Admin Users overhaul + Specializations master + serial-# column)

**Admin Users page (`admin/users.html`):**
- Merged the Edit-User and Reset-Password forms into one (single Save; password optional). Email field **disabled** (immutable). Phones **unmasked** (Admin scope). **Admin self-row removed**. **Scope** column removed → `# · Name · Role · Phone · Status · Actions`.
- **Activate/Deactivate** per row with a confirmation modal (`openStatusToggle`/`confirmStatusToggle`/`closeStatusToggle`) — soft status, flips badge, hides Impersonate while inactive, toasts, refreshes paginator.
- **Role-aware Edit/Reset** (`openEditUser`): tenant rows read **Reset** and open a password-only modal; PM/Maintenance get full edit. `(co-tenant)` label removed.
- **Confirm-password** added to both Add-User (`saveAddUser`) and Edit/Reset (`saveEditUser`) with match validation. All below-input helper-caption sentences removed (per user rule).
- **Status filter = dropdown next to Search** (replaced Active/Inactive tiles); role tiles remain.
- Add-User **Specialization → multi-checkbox** rendered from `assets/specializations.js`.

**Specializations master (org-level):**
- NEW `assets/specializations.js` (`GHARSETU_SPECIALIZATIONS` 7 seed + `renderSpecializationCheckboxes`).
- NEW `admin/master-data/specializations.html` (clone of amenities; 7 rows, 4 in-use disabled-deactivate tooltips, Painter deactivated) — built by the gharsetu-frontend sub-agent (which crashed mid-run; orchestrator finished the rollouts).
- Landing **card** on `admin/master-data.html`; **sidebar + more-sheet sublink** (after Amenities) rolled out to all **19** admin surfaces.

**`#` serial column (all roles):**
- `assets/paginate.js`: stamps a running, pagination/filter-aware number into `[data-pg-serial]` cells; also added `Paginator.setAttrFilter()` (secondary dropdown filter, AND-combined, counts respect it).
- `#` header + `data-pg-serial` first cell rolled out to **26** paginated listing tables across Admin/PM/Maintenance/Super Admin + masters. `super-admin/server-logs.html` JS row template updated to emit the serial cell.
- `assets/styles.css`: + `.action-link.danger`.

**Verification:** 66/66 HTML tag-balanced; `paginate.js` / `specializations.js` / `toast.js` / `validation.js` + users.html & server-logs inline JS all `node --check` clean. Per-page sublink parity (Amenities == Specializations) confirmed on all 19 admin pages.

**Docs:** SRS §3 page map (+specializations), Module 1 (user edit/reset/activate + multi-specialization), Module 7 (Specializations master), NR-3 updated; `prototype-changes.md` +5 rows; 3 planning files added (users-page-overhaul, specializations-master, listing-serial-numbers).

`pnpm` gates N/A — prototype + docs only; `apps/*` untouched. Commit/push pending explicit user authorization (Working rule §1).

---

## Continuation (2026-05-27, late — PM Tenants → people directory + sidebar reorder)

- **PM sidebar reorder:** **Leases now precedes Tenants** on all 13 PM pages (active states preserved; mobile tabbar/more-sheet left as the deliberate mobile subset).
- **PM Tenants page rebuilt** (`pm/tenants.html`) as a lean Users-style people directory: `# · Tenant · Unit · Phone · Status`, **one row per person** (co-tenants expanded), Status = account Active/Inactive, Search + Status **dropdown** (`setAttrFilter`) + serial `#` + pagination. Removed "+ Add Tenant", the Sort control, and all lease/rent/deposit columns. 18 seed rows (16 active, 2 inactive former tenants).
- **`pm/tenant-detail.html` deleted** (user: "not worth it") — directory has **no View/actions column**; 0 remaining `tenant-detail` references repo-wide.
- **Docs:** SRS §3 PM page map updated (tenant-detail removed, Tenants reframed); `prototype-changes.md` +1 row; planning file `2026-05-27-pm-tenants-directory.md` written + marked shipped.
- **Verify:** `pm/tenants.html` tag-balanced; header 5 `<th>` == 5 `<td>`/row; 18 serial cells; `setAttrFilter` wired; 0 Add-Tenant / 0 View links. All 13 PM pages tag-balanced after reorder.

`pnpm` gates N/A — prototype + docs only; `apps/*` untouched. Commit/push pending explicit user authorization (Working rule §1).

---

## Continuation (2026-05-27, late — Maintenance listing rework: Admin + PM)

Reworked `admin/maintenance.html` then cloned the design to `pm/maintenance.html` (PM = own properties, Admin = all):
- **Tiles:** one row of **status** filter tiles — All · Open · In-Progress · Resolved · **Closed** (was 5 priority tiles + a redundant KPI grid; KPI grid removed → single tile row).
- **Tenant column removed** (any role can raise → often blank). **Unit + Property merged** into one **"Property · Unit"** column (property name + unit beneath — the standing convention, saved to memory `property-unit-combined-cell`).
- **One-row filter bar** (`md:grid-cols-5`): Property → Unit **cascade** (`setAttrFilter` on `data-property`/`data-unit`; Unit lists only units with ≥1 request) · **Priority** (`data-priority`) · **Assignee** (`data-assignee`, incl. Unassigned) · Search. Rows carry `data-status`/`data-priority`/`data-property`/`data-unit`/`data-assignee`.
- **Row action = View only** (Reassign removed from admin; PM Reopen/Close removed) — those move to the detail page.
- **"+ Raise Request"** now on **both** Admin and PM (Admin's modal also selects Property). Cross-property Reassign modal removed from admin.
- Status data: open 5 · in-progress 4 · resolved 1 · closed 2 (12 rows, identical dataset both pages).

**Verify:** both pages tag-balanced; header 9 `<th>` == 9 `<td>`/row × 12 rows; tiles = all/open/progress/resolved/closed; inline JS `node --check` clean; 65/65 HTML tag-balanced overall.

**Docs:** SRS Module 4 updated (raise by Tenant/PM/Admin, Closed workflow, listing filters, Property·Unit column); `prototype-changes.md` maintenance row revised; memory `property-unit-combined-cell` added.

`pnpm` gates N/A — prototype + docs only; `apps/*` untouched. Commit/push pending explicit user authorization (Working rule §1).

---

## Continuation (2026-05-27, late — Searchable Property/Unit dropdowns, rule #18)

- **New CLAUDE.md rule #18:** any Property or Unit `<select>` must be a searchable combobox. Saved to memory `searchable-property-unit-dropdowns`.
- **NEW `assets/searchable-select.js`** + `.gs-combobox*` CSS in `styles.css` — vanilla, accessible (combobox/listbox/option ARIA, ↑/↓/Enter/Esc), progressive enhancement of `<select data-searchable>`. Native select stays the value + validation source and re-dispatches `change` (filters/cascades unaffected). `SearchableSelect.refresh(id)` for dynamic/cascading lists; native-select focus forwards to the visible input (validation focus).
- **Audit + rollout (17 selects / 9 pages):** create-lease (cl-property, cl-unit), leases (propertyFilter), maintenance-detail (ra-prop, ra-unit), admin maintenance (flt-prop, flt-unit, req-prop, req-unit), property-detail (cl-unit), rent (ap-lease — included per user), pm/leases (unit), pm maintenance (flt-prop, flt-unit, req-unit **+ new req-prop Property field on the raise modal**), pm rent-collection (unit-select). Maintenance cascade wired to `refresh('flt-unit')`.
- Excluded (kept native): status/role/category/plan caps/property-type/per-page/expected-count selects.
- Planning file `2026-05-27-searchable-property-unit-dropdowns.md` (full audit table + component design + TC-SDD-001..012), marked shipped.

**Verify:** `searchable-select.js` `node --check` OK; 17 `data-searchable` across 9 pages; 2 cascade-refresh calls; 65/65 HTML tag-balanced.

`pnpm` gates N/A — prototype + docs only; `apps/*` untouched. Commit/push pending explicit user authorization (Working rule §1).

---

## Continuation (2026-05-27, late — Maintenance-role All Requests aligned to Admin/PM)

`maintenance/all-requests.html` brought in line with the Admin/PM maintenance design:
- **Combined "Property · Unit" column** (was separate Unit + Property).
- **Status filter tiles** (All · Assigned · In-Progress · Resolved · Closed) replace the old priority tiles; rows carry `data-status`.
- **One-row filter bar:** Property → Unit **cascade** (searchable, rule #18) · **Priority** dropdown (`data-priority`) · Search. No Assignee filter (role is self-scoped — every request is the staff's own).
- Sample dataset expanded 3 → **6** assigned requests so the status filter is meaningful (assigned 2 · in-progress 2 · resolved 1 · closed 1).
- Loaded `searchable-select.js`; cascade calls `SearchableSelect.refresh('flt-unit')`.

**Verify:** tag-balanced; header 7 `<th>` == 7 `<td>`/row × 6 rows; tiles all/assigned/progress/resolved/closed; 2 searchable selects; inline JS `node --check` clean; 65/65 HTML tag-balanced; 19 `data-searchable` prototype-wide.

`pnpm` gates N/A — prototype + docs only; `apps/*` untouched. Commit/push pending explicit user authorization (Working rule §1).

---

## Continuation (2026-05-27, late — Tenant My-Maintenance aligned to Admin/PM)

`tenant/maintenance.html`:
- Kept status tiles (All · Open · In-Progress · Resolved · Closed); added the **combined "Property · Unit" column** (rows carry `data-unit` + `data-priority`).
- Filter bar = **Unit only** (searchable, rule #18; options labelled **"Green Valley, Dwarka · Unit 3A"** etc.) + **Priority** + Search. **No Property filter** (per user — a tenant has only a few units).
- Raise-request modal gains a searchable **Unit** picker (property·unit labels); removed the two below-input modal caption sentences.
- Loaded `searchable-select.js`. 2 searchable selects on the page.

**Verify:** tag-balanced; header 9 `<th>` == 9 `<td>`/row × 4 rows; status tiles intact; unit filter present + property filter absent; 65/65 HTML tag-balanced; 21 `data-searchable` prototype-wide.

`pnpm` gates N/A — prototype + docs only; `apps/*` untouched. Commit/push pending explicit user authorization (Working rule §1).

---

## Continuation (2026-05-27, late — edit-form specializations + priority-input consistency)

- **Edit User form (`admin/users.html`):** added the **Specializations multi-checkbox** to the role-aware edit modal — shown only for Maintenance users (`#editSpecRow`/`#editSpecCheckboxes`), rendered from `specializations.js`, pre-checking the user's current trade(s) parsed from the row (e.g. "(Plumber)" → plumber). Hidden for PM/Tenant.
- **Priority input consistency:** the maintenance **Raise Request** modal used a radio list on Admin/PM but a `<select>` on Tenant. Standardised to the **radio list on all roles** (`tenant/maintenance.html` priority dropdown → radios). All 3 raise modals now identical (Low/Medium/High/Emergency radios, Medium default).

**Verify:** `admin/users.html` + `tenant/maintenance.html` tag-balanced; inline JS `node --check` clean; 3/3 raise modals use radio priority; 65/65 HTML tag-balanced.

`pnpm` gates N/A — prototype + docs only; `apps/*` untouched. Commit/push pending explicit user authorization (Working rule §1).

---

## Session close (2026-05-28)

### Late additions (same session, continued into 2026-05-28)

**Visitor lifecycle — complete overhaul:**
- `admin/visitors.html` **NEW** — org-wide visitor page (all 6 status tiles, Property→Unit cascade filters, 11 rows across 4 properties, full Approve/Deny/Check-in/Check-out actions).
- `pm/visitors.html` **fixed** — Property·Unit combined cell, Denied tile, `data-visitor-code` on each row, check-in modal now validates the VIS-XXXX code the visitor presents (PM types it; wrong code = error), fixed off-by-1 JS cell-index bugs, footer caption removed, pending-approvals alert removed.
- **Visitors added to all 21 admin sidebar + more-sheet nav surfaces** (after Maintenance, before Rent).
- Visitor code design decision: code is NOT shown to PM/Admin — it is a **gate validation token** (visitor shows it, PM enters it at check-in to confirm identity).

**Other fixes same session:**
- `searchable-select.js` — native `<select>` moved inside the wrapper (was a sibling → wrong positioned ancestor causing page horizontal scroll on all pages with searchable dropdowns); CSS override with `\!important` to beat `select.input` specificity.
- `admin/maintenance.html` + `pm/maintenance.html` raise-request: `req-prop` / `req-unit` blank-first placeholder + `required`; `req-unit` starts disabled and cascades from `req-prop` via new `REQ_UNITS` map + `onReqPropChange`.
- Title field added before Description on all 3 raise-request modals (Admin, PM, Tenant).
- `tenant/maintenance.html` — Priority radio list (was a `<select>`); aligned with Admin/PM pattern.

**Verify:** 66/66 HTML tag-balanced; all inline JS `node --check` clean.

`pnpm` gates N/A — prototype + docs only; `apps/*` untouched.
Commit/push pending explicit user authorization (Working rule §1).
