# gharsetu-frontend change log — 2026-05-30

| # | Status | Started | Completed | Task | Files changed | Notes |
|---|--------|---------|-----------|------|---------------|-------|
| 1 | Done | 2026-05-30 | 2026-05-30 | Create Lease wizard — design modernization pass | `prototype/admin/create-lease.html` | 10 concrete improvements shipped (see below). All 5-step model, JS handler signatures, mock data, tenant logic unchanged. |

## Changes shipped (task 1)

1. **Progress indicator** — Step-num circles enlarged to 32 px with `transform: scale(1.1)` + saffron glow ring on active step; connector width consistent; `aria-current="step"` on active step; connectors get `aria-hidden`; transitions on background/border-color (200 ms).
2. **Panel fade-in animation** — each step panel gets a `panelFadeIn` keyframe (opacity 0→1, translateY 6→0, 180 ms). Respects `prefers-reduced-motion`.
3. **Step headings** — All 5 steps get `step-heading` (Poppins 700 20 px) + `step-subheading` (Inter 14 px slate). Step 3 heading and subheading update dynamically in `showStep()` based on unit-wise vs room-wise mode.
4. **Selected card: checkmark badge + tint + lift** — `.sel-card.is-selected` gets saffron border (2.5 px), background tint `rgba(255,111,0,0.02)`, outer glow shadow. A white circle `sel-card-check` with a saffron check SVG appears in the band when selected. Same pattern on lease-type cards (CSS `::after` checkmark circle).
5. **Card header bands** — every property/unit/room card gets a 44 px colored band at the top (initials in white; consistent color hashed from the card's id using 6 navy/royal-blue tones). No placeholder images needed. Hover lift: `translateY(-3px)` + `box-shadow: 0 6px 20px rgba(0,0,0,0.1)`.
6. **Conflict error: promoted to a banner** — replaced the inline `.field-error` `cl-conflict-error` with a `cl-conflict-banner` panel (amber left-border, warning SVG icon, bold "Schedule conflict" title, detail text, resolution hint). `showConflict`/`clearConflict` updated accordingly.
7. **Live lease summary rail** — new `wizard-summary-rail` right-column panel (268 px, `position: sticky; top: 80px`) shows from Step 2 onward. Renders: type pill, property, unit, room (room-wise), primary tenant, start/end dates, rent, deposit. Updates on every selection/input change. Hidden on mobile (<1024 px).
8. **Wizard outer shell** — wraps `wizard-body + wizard-summary-rail` in a `wizard-shell` grid (`1fr 268px`; collapses to 1fr on mobile).
9. **Bottom bar step counter** — `wizard-step-counter` span between Cancel and Back/Next shows "Step N of 5". Updated by `renderProgress()`. Hidden at <600 px.
10. **Context panels: accordion** — Step 5 right-column context panels (Lease history + Tenant lease history) now have clickable headers with chevron-rotate toggle. Default state: Lease history open, Tenant history collapsed. `toggleContextPanel()` added. `aria-expanded` updates on toggle.

## What was intentionally not changed

- Step 5 two-column `.step5-layout` (3fr 2fr) — kept as-is; the right column now hosts accordion panels instead of flat panels which improves scannability without restructuring.
- Lease-type card layout (Step 1) — only cosmetic polish (::after checkmark, tint, glow); structure unchanged.
- All JS handler signatures (public-facing).
- All mock data.
- Tenant row logic (all three modes: search / existing / new).
- `unitStatusBadgeHtml` / `statusBadgeHtml` semantics.

---

| # | Status | Started | Completed | Task | Files changed | Notes |
|---|--------|---------|-----------|------|---------------|-------|
| 2 | Done | 2026-05-30 | 2026-05-30 | Step 5 restructure — more fields, selected-tenants panel, 6:6 history grid | `prototype/admin/create-lease.html` | All existing `cl-*` ids and `renderContextPanels()` body element ids preserved. |

## Changes shipped (task 2)

1. **Form grouped into 4 sub-sections** — Lease term / Rent & charges / Rules / Notes. Each sub-section headed by `.step5-section-label` (Poppins 700 / 11 px / uppercase / 2 px saffron bottom border). Conflict banner moved inside the Lease term section below the date row.
2. **3 new fields added**: Lock-in period (`cl-lockin`, default 6 months, inside Lease term), Maintenance charges (`cl-maintenance`, default ₹0/mo, inside Rent & charges), Rent escalation (`cl-escalation`, default 5%/yr, inside Rent & charges). Special terms textarea (`cl-notes`, optional, max 500 chars, inside Notes).
3. **Date + lock-in on a 3-column row** — Start / End / Lock-in side by side. Rent & charges on a 2×2 grid (rent + maintenance / escalation + deposit). Rules on a 3-column row (unchanged).
4. **Step 5 right column: selected-tenants panel** — `step5-tenants-panel` replaces the accordion context panels. For each tenant row: avatar (36 px circle, slate for new tenants), name + "Primary" saffron pill if primary, email/phone sub-line (existing: email only; new: typed name/email/phone), lease-history badge for existing tenants. Placeholder card for unfilled rows. Updates live as the user types new-tenant details (delegated `input` listener on `.t-name/.t-email/.t-phone`).
5. **6:6 history grid below the form** — `step5-history-grid` (`1fr 1fr`, collapses to 1fr at <1024 px). Left: unit/room lease history (`panel-unit-history`). Right: tenant lease history (`panel-tenant-history`). Both rendered as flat cards (`context-panel-flat`) — no accordion, always visible. Panel A title dynamically updates to "Room lease history" vs "Unit lease history" via `renderContextPanels()`.
6. **`renderSelectedTenants()` added** — called from `renderContextPanels()` (which fires from `prepareStep5`) and from `updateSummary()` when on step 5. Also fires on back-forward navigation.
7. **Summary rail updated** — now includes Maintenance (if > 0), Escalation, Lock-in rows in addition to Rent and Deposit. Deposit and Rent rows kept.
8. **`panel-unit-history-body` + `panel-tenant-history-body` ids preserved verbatim** — `renderContextPanels()` body unchanged except null-guards added for the moved elements.

---

| # | Status | Started | Completed | Task | Files changed | Notes |
|---|--------|---------|-----------|------|---------------|-------|
| 3 | Done | 2026-05-30 | 2026-05-30 | Step 5 trim — remove over-scoped fields (user-driven) | `prototype/admin/create-lease.html` | User flagged that Lock-in / Rent escalation / Notes / Late fee / Notice period / Rent due day were added without being asked; all removed. |

## Changes shipped (task 3)

1. **Rent escalation field removed** — start/end dates already define the term; an escalation column would be no-op in v1 (no annual-increment cron exists yet). Re-add when the cron lands.
2. **Special terms (Notes) field removed** — free-text terms aren't enforced anywhere; they were UI theatre.
3. **Lock-in period field removed** — user reasoning: start + end dates already define the lease window; lock-in only matters at termination time, which has its own consent flow (BL-08/BL-09). Will be re-introduced when termination penalties are modelled.
4. **Entire Rules section removed** (Late fee · Notice period · Rent due day):
   - **Late fee (%)** is a platform-level Setting, not per-lease.
   - **Notice period** is a platform-level Setting.
   - **Rent due day** derives from the lease start date (rent due on the same day-of-month every cycle).
   - **Grace period** is the existing global Setting applied at payment-collection time.
5. **Tenant Lease History enriched** — each tenant row now shows: Property → Unit (and Room when room-wise), monthly rent, status pill. Full width, not constrained to the right column.
6. **Selected Tenants overflow handled** — panel gets `max-height: 520px` + internal `overflow-y: auto` with a saffron scrollbar; adding many tenants no longer destabilises the Step 5 layout.
7. Summary rail rows for the removed fields also dropped (Lock-in / Escalation).

---

| # | Status | Started | Completed | Task | Files changed | Notes |
|---|--------|---------|-----------|------|---------------|-------|
| 4 | Done | 2026-05-30 | 2026-05-30 | Step 5 history grid — move below the action bar, wrap in a card, combine unit + room history | `prototype/admin/create-lease.html` | Reference-only content moved out of the wizard flow; user can scroll past Cancel/Back/Create Lease to consult it. |

## Changes shipped (task 4)

1. **History grid relocated** — `step5-history-grid` moved from inside the wizard panel to *outside* the wizard card (below the action bar). Wrapped in `<section class="card" id="step5-history-card">` so it presents as a separate reference surface. Visibility toggled in `showStep()` — visible only on Step 5.
2. **Combined Unit Lease History card** — `panel-unit-history` now shows all leases that touched the selected unit, whether unit-wise or room-wise. Each row carries a scope chip (`Unit-wise` / `Room A`, etc.) so a viewer can scan future/past usage of the unit as a whole. Sorted by start date desc.
3. **Empty-state cleanup** — tenants with zero lease history are skipped entirely from the tenant-history panel (no empty rows).
4. **Bug fix: empty Unit Lease History on occupied units** — `UNIT_LEASES` was missing rows for `gv-1A`, `gv-2B`, `pg202-C` (the units showed as Occupied on the picker but had no lease record); rows added with end dates matching `occupiedUntil`. Fixed two date mismatches: `gv-5B-A` (`31/03/2026 → 15/02/2027`) and `pg101-B` (`31/01/2027 → 31/12/2026`).

---

| # | Status | Started | Completed | Task | Files changed | Notes |
|---|--------|---------|-----------|------|---------------|-------|
| 5 | Done | 2026-05-30 | 2026-05-30 | Wizard step indicator stretched to card width | `prototype/admin/create-lease.html` | Cosmetic but improves visual hierarchy on wide screens. |

## Changes shipped (task 5)

1. `.wizard-progress` set to `width: 100%`.
2. `.wizard-connector` flex sizing changed to `flex: 1 1 0` with `min-width: 16px` so the connectors expand to absorb the available horizontal space.

---

| # | Status | Started | Completed | Task | Files changed | Notes |
|---|--------|---------|-----------|------|---------------|-------|
| 6 | Done | 2026-05-30 | 2026-05-30 | Mock-data refactor — numeric ids + relations by id (CLAUDE.md rule #19) | `prototype/admin/create-lease.html` | Same session as the **CLAUDE.md rule #19 strengthening**: every PK is `id INTEGER`; cross-table relations reference numeric ids only — applies to prototype mock data too. |

## Changes shipped (task 6)

1. **`PROPERTIES`** — `id: 1..4` + secondary `slug` column (kept only as a non-PK identifier).
2. **`UNITS`** — flat array with numeric `id` (101..401) and numeric `propertyId` FK. Replaced the per-property keyed dict (`UNITS['green-valley']`).
3. **`ROOMS`** — flat array with numeric `id` (10501..20203) and numeric `unitId` FK. Replaced the per-unit nested dict.
4. **`TENANTS`** — numeric `id: 1..5`; each tenant's `leases[]` references `propertyId`, `unitId`, `roomId` (all numeric).
5. **`UNIT_LEASES`** — flat array with `unitId`, optional `roomId`, optional `tenantId` (all numeric).
6. **Helper functions added**: `findPropertyById`, `findUnitById`, `findRoomById`, `findTenantById`, `unitsForProperty`, `roomsForUnit`, `leasesForUnit`, `unitWiseLeasesForUnit`, `leasesForRoom` — every lookup is by numeric id.
7. **All ~20 onclick handlers updated** to pass numeric ids: `selectProperty(1)`, `selectUnit(105)`, `selectRoom(10501)`, `selectExistingTenant(idx, 3)`.
8. **`dataset` string-coercion fixed** — `dataset.existingTenantId` is always a string; `findTenantById` now coerces via `Number(id)`, and `renderTenantDropdown`'s `takenIds` set uses `Number(r.dataset.existingTenantId)` so strict-equality lookups work.
9. **Step 2 stale-grid bug fixed** — `selectLeaseType()` now re-renders the property grid when the lease type actually changes (`if (prevType !== type) renderPropertyGrid('');`) so the grid stays in sync from the moment the user picks unit-wise vs room-wise.

---

| # | Status | Started | Completed | Task | Files changed | Notes |
|---|--------|---------|-----------|------|---------------|-------|
| 7 | Done | 2026-05-30 | 2026-05-30 | Quick-create-lease deep-link flow from unit-detail | `prototype/admin/unit-detail.html`, `prototype/admin/create-lease.html` (deep-link IIFE), `prototype/pm/unit-detail.html` (deferred comment only) | Cross-folder Admin link was *not* added to PM (would surround the Admin wizard with the PM sidebar). |

## Changes shipped (task 7)

1. **+ Create Lease for this Unit** button added at the top of admin unit-detail. Links to `create-lease.html?unitId=<n>` — wizard auto-advances to Step 4 (Tenants) with unit-wise lease + property + unit pre-selected.
2. **+ Create Lease** per-row button added to each room in the Rooms table (admin unit-detail). Links to `create-lease.html?unitId=<n>&roomId=<m>` — wizard lands on Step 4 with room-wise + property + unit + room pre-selected.
3. **Deep-link IIFE** appended at the bottom of `create-lease.html` — reads `?unitId=<n>&roomId=<m>`, validates the room belongs to the unit (else falls back to unit-wise), seeds `wizardState`, and calls `showStep(4)` after grid renders. Cancelling out and re-entering normally still works (params consumed on first arrival only).
4. **PM unit-detail not changed** — a comment placeholder was added explaining the deferral. PM has no own create-lease page; if PM needs this affordance later, a `pm/create-lease.html` mirror page is required.

---

| # | Status | Started | Completed | Task | Files changed | Notes |
|---|--------|---------|-----------|------|---------------|-------|
| 8 | Done | 2026-05-30 | 2026-05-30 | Step 5 context strip — show lease type + property/unit/room path | `prototype/admin/create-lease.html` | The summary rail is intentionally hidden on Step 5 (so the history card claims full width); without this strip the user had no on-screen reminder of *what* lease they were configuring. |

## Changes shipped (task 8)

1. **New `.step5-context-strip`** at the top of Step 5 — saffron-tinted background, 1 px tinted border.
2. **Lease-type chip** (`UNIT-WISE LEASE` / `ROOM-WISE LEASE`) — saffron-filled pill, uppercase, white text.
3. **Breadcrumb path** — `Property › Unit (› Room)` with the › separator dimmed to mid-grey.
4. **Populated by new `renderStep5ContextStrip()`** called from `prepareStep5()` — works for both manual entry and the deep-link path.
5. **`aria-live="polite"`** on the wrapper so the strip is announced on update for screen-reader users.

---

| # | Status | Started | Completed | Task | Files changed | Notes |
|---|--------|---------|-----------|------|---------------|-------|
| 9 | Done | 2026-05-30 | 2026-05-30 | Date calendar picker — new asset + bulk rollout + paired range sync | `prototype/assets/date-picker.js` (NEW), `prototype/assets/styles.css`, 12 prototype pages | Every DD/MM/YYYY date input in the prototype is now click-to-open. Range pairs (start/end) sync via `data-pair-min` / `data-pair-max`. |

## Changes shipped (task 9)

1. **NEW `prototype/assets/date-picker.js`** — vanilla JS calendar widget, no deps. Progressive enhancement: any `<input data-datepicker>` keeps being a real form field while the JS wraps it with a click-to-open calendar popover. Mon-start week (Indian convention). DD/MM/YYYY output.
2. **Supported data attributes**: `data-datepicker` (marker), `data-min-date="today"|D/M/Y|YYYY-MM-DD`, `data-max-date=…`, `data-pair-min="<partnerId>"`, `data-pair-max="<partnerId>"`.
3. **Pair-bound logic** — `pairBound(attr)` reads the partner input's value at render time; pair-min lifts the floor, pair-max lowers the ceiling. Only ever *tightens* the window — empty partner = own min/max attributes still apply.
4. **Public API** — `window.GsDatePicker.initAll(root?)` (idempotent — already-enhanced inputs are skipped) and `window.GsDatePicker.refresh(root?)` for dynamic markup (modals).
5. **Picker fires `input` + `change` events** on selection so existing `oninput` handlers (conflict checks, summary updates, validation) fire naturally.
6. **CSS appended to `prototype/assets/styles.css`** — `.gs-dp-wrap`, `.gs-dp-pop`, `.gs-dp-header`, `.gs-dp-nav`, `.gs-dp-grid`, `.gs-dp-dow`, `.gs-dp-day` (+ `:hover`, `-today`, `-selected`, `-disabled`). Mobile bottom-sheet at max-width:480px.
7. **Bulk rollout** — 12 prototype files touched, 20 date inputs enhanced with `data-datepicker` + `<script src="../assets/date-picker.js">` tag. Constraint table applied: `cl-start`, `cl-end`, `rl-start`, `rl-end`, `delegStart`, `delegEnd`, `rent-schedule-effective-date` → `data-min-date="today"`; `ap-date`, `paydate`, `paid-on-date`, `sm-date` → `data-max-date="today"`.
8. **5 date-range pairs wired with `data-pair-min` / `data-pair-max`** — End picker now greys out anything before chosen Start, Start picker greys out anything after chosen End:
   - `cl-start` ↔ `cl-end` ([admin/create-lease.html](../prototype/admin/create-lease.html))
   - `start` ↔ `end` ([pm/leases.html](../prototype/pm/leases.html))
   - `from-date` ↔ `to-date` ([admin/audit-log.html](../prototype/admin/audit-log.html))
   - `delegStart` ↔ `delegEnd` ([admin/delegation-new.html](../prototype/admin/delegation-new.html))
   - `rl-start` ↔ `rl-end` ([pm/lease-detail.html](../prototype/pm/lease-detail.html))

---

| # | Status | Started | Completed | Task | Files changed | Notes |
|---|--------|---------|-----------|------|---------------|-------|
| 10 | Done | 2026-05-30 | 2026-05-30 | CLAUDE.md rule #19 strengthened | `CLAUDE.md` | Coordinated with the create-lease mock-data refactor (task 6). |

## Changes shipped (task 10)

Rule #19 expanded from "every table's primary key is an `id INTEGER` auto-increment" to also bind cross-table relations and prototype mock data:

> Every cross-table relation references the target's numeric `id` only — never its slug, email, name, or any other column. Prisma `@relation` always points at the integer PK. This applies to the live schema **and** to prototype mock data — mock arrays must use numeric ids and reference each other via those ids so the prototype teaches the right pattern (the eventual port to `apps/api` shouldn't have to invent the relations from scratch).
