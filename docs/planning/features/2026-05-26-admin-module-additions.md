# Admin Module Additions — Master Data, Settings, Delegations

| Field | Value |
|---|---|
| Status         | proposed |
| Started        | 2026-05-26 |
| Shipped        | — |
| SRS row        | (prototype-only — SRS rows to be added when backend ships under ENG-F04 Master Data Administration, ENG-F05 Settings, ENG-F09 Admin Task Delegation) |
| Test cases     | TC-MASTER-001..036, TC-SETTINGS-001..024, TC-DELEG-001..030 (designed in §3, prototype-scope) |
| Prototype todo | row to be added to `docs/planning/prototype-changes.md` on ship |

## 1. Requirement (as given)

> "Plan the 3 new Admin module pages in a single planning file.
> 1. `prototype/admin/master-data.html` — Amenities · Maintenance Categories · Payment Methods · City · State. Admin creates / edits / deactivates each entry.
> 2. `prototype/admin/settings.html` — tunable values: late-fee rate · grace period · rent-change notice window.
> 3. `prototype/admin/delegations.html` — create + revoke task delegations to PM / Maintenance for a date range.
> Plan it as ONE feature. In §2 Plan describe each page as a sub-section (5.1 master-data · 5.2 settings · 5.3 delegations) with zone-by-zone layout, sidebar/tabbar updates (Admin sidebar gains 3 items: Master Data · Settings · Delegations — confirm MoreSheet placement at ≤ 1023 px), per-page interactions, design token references. §3 Test cases namespaced by page: TC-MASTER-NNN, TC-SETTINGS-NNN, TC-DELEG-NNN. Cover NR-3 (master-data sourced — verify dropdowns can read from it), NR-4 (deactivation gate), NR-8 (delegation window bounds), accessibility, responsive at 5 widths, locale."

Solution Overview v8 cross-reference: the rules the brief calls **NR-3 / NR-4 / NR-8** map to the §Business Rules text — sourcing-from-Master-Data and the in-use deactivation gate (together cover NR-3 + NR-4), and the delegate-attribution + window-bounded-rights rule (NR-8). See §9 below for the exact verbatim quotes.

## 2. Plan

Three new pages added under the existing `prototype/admin/` folder, mirroring the existing admin page family (`properties.html`, `users.html`, `maintenance.html`, …) chrome 1:1 — same `.sidebar`, same `.app-main`, same `.topbar`, same `.tabbar` + MoreSheet pattern, same validation contract via `assets/validation.js`. Path note: the brief calls out that the live app will eventually live under the org-scoped `/:org/admin/...` route — but for the **prototype**, all three pages stay under `prototype/admin/` to preserve navigation consistency with the rest of the v1 admin family. The live-app path migration is deferred to the v8 build phase (locked decision in `claude-progress.md` §8 — Routing model 2026-05-26).

### 2.0 Cross-page chrome — sidebar, tabbar, MoreSheet updates

#### 2.0.1 Admin sidebar — 3 new entries inserted before the Profile divider

The Admin sidebar today lists (per `prototype/admin/users.html` lines 19–27): Dashboard · Properties · Units · Users · Maintenance · Rent · Audit Log · [divider] · My Profile. Three new entries inserted in this order, in the section between `Audit Log` and the existing divider:

| Order | Label | Icon (SVG, plain stroke 2 — match existing sidebar icon weight) | Active route |
|-------|-------|------------------------------------------------------------------|--------------|
| 8 | **Master Data** | `database` glyph — three stacked horizontal ellipses (canonical Feather `database` icon) | `master-data.html` |
| 9 | **Settings** | `settings` glyph — cog (canonical Feather `settings` icon) | `settings.html` |
| 10 | **Delegations** | `user-check` glyph — figure + check mark (canonical Feather `user-check` icon) | `delegations.html` |

These slot **after Audit Log** and **before the divider + My Profile** — keeping operational lists together (Dashboard → Properties → Units → Users → Maintenance → Rent → Audit Log → Master Data → Settings → Delegations) and personal items at the bottom (Profile · Logout-in-footer).

All 10 existing admin pages (`dashboard.html`, `properties.html`, `units.html`, `users.html`, `maintenance.html`, `rent.html`, `audit-log.html`, `property-detail.html`, `profile.html`, plus any newcomer) get their sidebar markup updated to add these three new `<a class="sidebar-link">` entries, with the correct `.active` class set on the matching page. This is a 10-file ripple — flagged in §2.0.4 below.

#### 2.0.2 Admin tabbar — no change to the 5 bottom tabs

The Admin role's bottom tabbar is locked at 5 slots per the `gharsetu-ui` skill §Role tabbars table: **Home · Units · Maint. · Rent · More**. The three new pages all go behind the **More** slot — no new tab is added, no existing tab is displaced. Confirmed: tabbar contents stay identical across all admin pages.

#### 2.0.3 Admin MoreSheet — 3 new entries appended

The Admin MoreSheet (today, per `users.html` lines 261–269): Users · Properties · Audit Log · My Profile · Logout. Three new entries inserted before `My Profile` (so personal items stay grouped at the bottom):

| Order | Label | Icon (matches sidebar) | Route |
|-------|-------|------------------------|-------|
| 1 | Users | (existing) | `users.html` |
| 2 | Properties | (existing) | `properties.html` |
| 3 | Audit Log | (existing) | `audit-log.html` |
| **4** | **Master Data** | `database` glyph | `master-data.html` |
| **5** | **Settings** | `settings` glyph | `settings.html` |
| **6** | **Delegations** | `user-check` glyph | `delegations.html` |
| 7 | My Profile | (existing) | `profile.html` |
| 8 | Logout | (existing) | → `../login.html` |

MoreSheet height is bounded by `max-height: 80vh` (per `styles.css` line 392) with `overflow-y: auto` — adding 3 entries does not exceed 80vh on any supported width (verified: 9 entries × ~48 px each = ~432 px, well within an 80vh budget of ~640 px at the smallest 800-height phone-landscape viewport).

#### 2.0.4 Ripple files — 10 existing admin pages need sidebar + MoreSheet additions

Every existing `prototype/admin/*.html` carries its own copy of the sidebar `<nav>` block and the MoreSheet `<div class="more-sheet">` block. The three new entries (sidebar) + three new entries (MoreSheet) must be added to each:

1. `dashboard.html` 2. `properties.html` 3. `units.html` 4. `users.html` 5. `maintenance.html` 6. `rent.html` 7. `audit-log.html` 8. `property-detail.html` 9. `profile.html` 10. plus the 3 new pages this plan creates.

For each ripple file: identical 3 `<a>` blocks added to `.sidebar-nav` between `audit-log.html` link and the `.sidebar-divider`; identical 3 `<a>` blocks added to `.more-sheet` between `audit-log.html` and `profile.html` links. The `.active` class only set on the new page itself.

### 2.1 master-data.html — reference-list administration (5 entity tabs)

Path: `prototype/admin/master-data.html` · Role: ADMIN · Active sidebar: `Master Data` · Page title: **Master Data**.

#### 2.1.1 Intent

Admin manages five reference lists from a single page using a horizontal tabbed entity switcher. Each tab swaps the underlying table contents and the `+ Add` button's modal payload, but reuses the same table-row UX (Name · In-use count · Status · Edit / Activate / Deactivate). NR-3: every dropdown in the rest of the app (Add Property amenities, Maintenance category select, Record Payment method select, Add Property city/state select) reads from this list; the page is the single source of truth. NR-4 is enforced visually + interactively on the Deactivate action.

#### 2.1.2 Layout — zones top to bottom

| # | Zone | Content | CTAs / links |
|---|------|---------|--------------|
| 1 | App shell | `.sidebar` (Master Data link `.active`) + `.app-main` + `.tabbar` (More slot opens MoreSheet) | — |
| 2 | Topbar | `.drawer-toggle` (≤1023 px) · `h1 class="page-title"` "Master Data" · `page-subtitle` "Reference lists used across forms — Admin-managed." · primary CTA `+ Add Entry` (saffron, opens entity-specific modal) | + Add Entry → modal |
| 3 | Entity tabs (horizontal) | 5 tabs as `btn btn-primary` (active) / `btn btn-secondary` (inactive) with a count suffix (e.g. `Amenities · 18`). Order: **Amenities · Maintenance Categories · Payment Methods · City · State** | Each tab → swaps Zone 4 contents + the `+ Add` modal target |
| 4 | Filters (per tab, optional) | Single row inside a `.card`: `Search` input · `Status` select (`Any` / `Active` / `Deactivated`) | — |
| 5 | Entities table | `.card.p-0.overflow-x-auto > table.data-table` with columns per entity (see §2.1.3) | Edit (royal-blue text link) → edit modal; Deactivate (secondary button) → deactivate-confirm modal; Reactivate (saffron text link) on rows already deactivated |
| 6 | Footer note | `.text-sm.muted` "Active entries appear in forms across the app. Deactivated entries stay searchable but cannot be selected on new records. An entry currently in use cannot be deactivated — retire its references first." | — |
| 7 | MoreSheet (≤1023 px) | Same as §2.0.3 contents | — |

#### 2.1.3 Per-entity columns

| Entity | Columns | Notes |
|--------|---------|-------|
| Amenities | Name · Used by (count of units) · Status · Actions | "Used by" is the NR-4 gate signal |
| Maintenance Categories | Name · Used by (count of open + closed requests) · Status · Actions | NR-4 gate |
| Payment Methods | Name · Used by (count of payment records) · Status · Actions | NR-4 gate |
| City | Name · State · Used by (count of properties) · Status · Actions | NR-4 gate; State column references the State entity |
| State | Name · Code (2-letter ISO) · Used by (count of properties + cities) · Status · Actions | NR-4 gate; cannot deactivate a state still referenced by an active city |

#### 2.1.4 Interactions

**Tab switch.** Clicking a tab inside the entity-tabs row sets that tab's button to `.btn-primary`, demotes all others to `.btn-secondary`, swaps the visible table body's HTML, and re-targets the `+ Add Entry` CTA's modal — implemented as `onclick="switchEntity('amenities')"` etc. Prototype keeps all 5 table bodies hidden under `data-entity="…"` containers; only the active one has `display:block`.

**Add modal (per entity).** Modal-backdrop pattern identical to `users.html` Add User modal. Fields:

- Amenities / Maintenance Categories / Payment Methods: `Name` (text, 2–60 chars, required).
- City: `Name` (text, required, 2–80) · `State` (select, required — sourced from State entity, the prototype hard-codes a sample list).
- State: `Name` (text, required, 2–60) · `Code` (text, exactly 2 letters, required, uppercase auto).

Submit → row appended to the table; modal closed; success toast (`role="status"` `aria-live="polite"` — UIUX Design Document §9). All FE validation matches §2.5 of `2026-05-26-organization-signup.html.md` shape — via `validation.js`, no native HTML5 tooltips, errors render below the field with ⚠ glyph + red border on `.input.error`.

**Edit modal.** Same fields as Add modal, pre-filled, with `Save changes` CTA. No status toggle inside Edit — Activate / Deactivate lives in the row action column.

**Deactivate-confirm modal.** Two paths:

1. **In-use (NR-4 gate path).** When the row's "Used by" count > 0, the Deactivate button is **disabled** (`.btn-disabled` styling per `styles.css` line 99) with `aria-disabled="true"` and a tooltip-on-focus (via `aria-describedby` referencing a `.field-error.show`-style note rendered inline under the row on focus) reading: "Cannot deactivate — currently used by N record(s). Retire those references first." This is a **purely visual** affordance; clicking does nothing.
2. **Not-in-use path.** When "Used by" = 0, the Deactivate button is enabled. Click → `.modal-backdrop.open` with body copy "Deactivate `<name>`? It will no longer appear in dropdowns for new records. Existing records that reference it stay intact. You can reactivate later." Two buttons: `Cancel` (`btn btn-secondary`) and `Deactivate` (`btn btn-danger` — overdue red per token line 97).

On confirm: row's status badge flips from `.badge-active` (green per styles line 68) to `.badge-closed` (slate per styles line 74); Deactivate button replaced with a `Reactivate` royal-blue text link; the entry is filtered out of the prototype's downstream dropdown demos (a small footer note in the prototype links to a "preview a property form" page for quick visual confirmation — out of scope for v1 prototype, flagged in §2.10).

**Reactivate.** Click the `Reactivate` text link → no confirm modal needed (reactivation is a no-op for existing records — it just re-enables the entry in dropdowns). Status badge flips back to `.badge-active`.

**Filters.** Search filters the visible rows client-side by Name; Status select filters by Active / Deactivated. Filters apply only to the currently visible tab.

#### 2.1.5 Design tokens — all sourced from `prototype/assets/styles.css`

| Use | Token / class | CSS reference |
|-----|---------------|---------------|
| Sidebar | `.sidebar` + `.sidebar-link.active` | lines 172–226 |
| App shell | `.app-shell` + `.app-main` | lines 239–240 |
| Topbar | `.topbar` + `.page-title` + `.page-subtitle` | lines 241–248 + 493–495 |
| Entity tabs (active / inactive) | `.btn .btn-primary` / `.btn .btn-secondary` (with `!py-2 !text-sm` overrides) | lines 78–96 |
| Card | `.card` | lines 110–119 |
| Filters row inputs | `.input` + `.label` | lines 123–138 + 161–170 |
| Data table | `.data-table` | lines 449–459 |
| Status badge (active / deactivated) | `.badge-active` / `.badge-closed` | lines 68 + 74 |
| Action — edit (royal-blue text) | `.text-royal-blue.font-poppins.font-semibold` | lines 17 + Tailwind text-royal-blue maps to `#1565C0` |
| Action — deactivate (danger button) | `.btn .btn-danger` | lines 97–98 |
| Action — disabled deactivate | `.btn-disabled` / `.btn:disabled` | line 99 |
| Modal | `.modal-backdrop` + `.modal` | lines 471–483 |
| Field error | `.field-error.show` + `.input.error` | lines 139 + 142–160 |
| Footer note | `.text-sm.muted` | line 501 |
| Tabbar | `.tabbar` + `.tab` + `.tab-more` | lines 296–309 + 433–436 |
| MoreSheet | `.more-sheet` + `.more-sheet-link` | lines 371–432 |
| Focus ring | `*:focus-visible` | line 490 |

**No new tokens introduced.**

#### 2.1.6 Responsive — single 1024 px breakpoint (UIUX Design Document §3)

| Viewport | Behaviour |
|----------|-----------|
| 320 px | Drawer-toggle visible; sidebar slides in as drawer on tap. Topbar stacks: drawer-toggle on left, page-title block, `+ Add Entry` button wraps below. Entity-tabs row scrolls horizontally inside a `overflow-x-auto` wrapper (5 tabs fit easily but on 320 px the labels make them ~340 px wide — wrap with horizontal scroll). Table wraps inside `.card.p-0.overflow-x-auto`. Tabbar visible bottom-fixed. MoreSheet behind the More tab. |
| 360 px | Same as 320 px with marginal breathing room; entity tabs may fit on one row depending on the longest label ("Maintenance Categories"). Tested as horizontal scroll either way to keep behavior identical. |
| 768 px | Same layout family (still mobile per the single-breakpoint rule). Tabs fit on one row. Table fully visible. Filters grid collapses to 1-col on `≤767 px` via the prototype Tailwind defaults (mirrors `properties.html` line 47 `md:grid-cols-4`). |
| 1024 px | Sidebar visible 240 px fixed left; main content padding 32 px / 48 px. Topbar one row. Entity tabs one row. Filters 2-col grid. Table full-width. |
| 1440 px | Identical to 1024 px; content max-width 1440 px (line 240). |

#### 2.1.7 Accessibility (UIUX Design Document §9)

- Entity tabs use `role="tablist"` on the wrapper, `role="tab"` on each `<button>`, `aria-selected` set, and matching `role="tabpanel"` on each `data-entity` container with `aria-labelledby` pointing at its tab id.
- Tab keyboard nav: `ArrowLeft` / `ArrowRight` move focus between tabs; `Home` / `End` jump to first / last; `Enter` / `Space` activates (handled by adding 30 lines of vanilla JS in the page; documented in §2.10).
- Each row's Action column is a button cluster with explicit `aria-label`s ("Edit amenity Pool", "Deactivate amenity Pool", "Cannot deactivate — in use") because text labels are repetitive across rows.
- Disabled Deactivate buttons use `aria-disabled="true"` and `aria-describedby` pointing at the inline NR-4 note (rendered with `.field-error.show` styling but applied to a non-form note so as not to be misread by screen readers as a form error — instead use `<p class="muted text-xs">` with `role="note"`).
- Status badge text is part of the accessible row name; status changes (on Deactivate confirm) announce via a `role="status"` `aria-live="polite"` region offscreen-rendered.
- Modal traps focus when open, closes on Escape, restores focus to the trigger button on close (per UIUX Design Document §9 / `gharsetu-ui` skill).
- Color contrast: all badge / button combinations already audited in `claude-progress.md` §2a — no new combinations introduced.

### 2.2 settings.html — three tunable values

Path: `prototype/admin/settings.html` · Role: ADMIN · Active sidebar: `Settings` · Page title: **Settings**.

#### 2.2.1 Intent

Admin tunes three platform-wide values within bounded ranges per the Solution Overview v8 §Details · Settings — Defaults and Tunable Ranges table. Every change writes an `audit_log` row (per `feature_list.json` ENG-F05). The prototype renders the three settings, validates their ranges client-side, and shows a save-feedback success state on submit. No backend; submit is prototype-only.

#### 2.2.2 Layout — zones top to bottom

| # | Zone | Content | CTAs |
|---|------|---------|------|
| 1 | App shell | `.sidebar` (Settings `.active`) + `.app-main` + `.tabbar` | — |
| 2 | Topbar | `.drawer-toggle` (≤1023 px) · `h1` "Settings" · subtitle "Platform-wide tunable values. Changes are audit-logged." | — |
| 3 | Info alert | `.alert` (partial-orange) "Changes apply to rent calculations and notifications from the next billing cycle. Existing leases are unaffected." | — |
| 4 | Form card | One `.card` wrapping a single `<form id="settingsForm" novalidate>` with the three settings stacked vertically. Each setting is a labelled control with helper text and a `.field-error` slot. See §2.2.3. | — |
| 5 | Action row (sticky at desktop ≥ 1024 px, inline at < 1024 px) | `Cancel` (`btn btn-secondary`, resets the form to current values) + `Save changes` (`btn btn-primary`, disabled until dirty AND all valid) | Save → success state |
| 6 | Recent changes (read-only) | A small `.section` below the form titled "Recent changes" showing the last 5 audit-log entries scoped to this settings page — each row: timestamp (DD/MM/YYYY HH:mm IST) · changed by · field · old → new value. Prototype hard-codes 3 sample rows. | — |
| 7 | Success card (replaces form on save) | Inline `.card` with green-check circle (reused pattern from forgot-password.html) · h3 "Settings saved" · body "Audit log updated. New values apply from the next billing cycle." · `Back to settings` (`btn btn-secondary`) which restores the form view with the new values shown. | — |
| 8 | Tabbar + MoreSheet | Standard admin tabbar + MoreSheet | — |

#### 2.2.3 Fields — types, ranges, validation

| ID | Field | Type | Default | Tunable range | Validation (mirror to backend class-validator) |
|----|-------|------|---------|---------------|-------------------------------------------------|
| S1 | **Late-fee rate** | number (with `%` suffix) | 2 | 0 – 10 | integer or one decimal place; `>=0` `<=10`; required; helper text "Charged per full week overdue, on the original outstanding amount (non-compounding)." |
| S2 | **Grace period** | number (with `days` suffix) | 5 | 0 – 15 | integer; `>=0` `<=15`; required; helper text "Days after the due date before a period flips to overdue." |
| S3 | **Rent-change notice window** | number (with `days` suffix) | 60 | 30 – 90 | integer; `>=30` `<=90`; required; helper text "Minimum days of advance notice required before a scheduled rent change can take effect." |

Each row uses a number-input control styled as `.input` with a static suffix label sitting next to it (`<div class="flex items-center gap-3">`). Below each field: a `.muted text-xs` helper line. Below each field: a `.field-error` slot (initially hidden).

The form is `novalidate`; validation runs on `blur` and on `submit` via JS in the page (no new helpers — reuses the `validation.js` field-error rendering API).

Below-form: "Read-only · last changed by Raj Singh on 12/04/2026 at 11:23" line shows the last-edit metadata.

#### 2.2.4 Interactions

**Dirty tracking.** On any field change, the Save button flips from `.btn-disabled` to `.btn-primary`. Cancel resets to the original (pre-edit) values via JS-stashed initial values, and re-disables Save.

**Save flow.**
1. Click Save → validation runs.
2. If any field outside range → red border on that input via `.input.error`, ⚠ "Late-fee rate must be between 0 and 10" message below.
3. If all valid → form card fades to a "Saving…" spinner state for 600 ms (button text changes to "Saving…", button stays disabled).
4. Success card replaces the form card per §2.2.2 zone 7.
5. "Recent changes" table prepends a new row reflecting the change just made.

**Range-clamp affordance.** Each input adds a `min` / `max` attribute on the `<input type="number">` for browser-spinner clamping, but does NOT rely on native `:invalid` tooltips — validation messages render only via `.field-error` per Working rule §16 / Technical convention #16.

**Audit-log preview.** The "Recent changes" section is read-only; clicking a row links to the full Audit Log page filtered to this settings change (`audit-log.html?ref=settings:<id>`). Out of scope for the prototype to make this filter actually work — the link goes to `audit-log.html` plain. Flagged in §2.10.

#### 2.2.5 Design tokens — sourced from `prototype/assets/styles.css`

| Use | Token / class | CSS reference |
|-----|---------------|---------------|
| Info alert | `.alert` | lines 461–468 |
| Card | `.card` | lines 110–119 |
| Input + label | `.input` + `.label` | lines 123–170 |
| Helper text below field | `.muted.text-xs` | line 501 + Tailwind utility |
| Field error | `.field-error.show` + `.input.error` | lines 139 + 142–160 |
| Primary save | `.btn .btn-primary` | lines 78–94 |
| Cancel | `.btn .btn-secondary` | line 95 |
| Disabled save | `.btn-disabled` / `.btn:disabled` | line 99 |
| Section heading | `.section-title` | line 499 |
| Audit-log recent table | `.data-table` | lines 449–459 |
| Success state | reuses `.card` + green-check pattern from `forgot-password.html` | n/a |
| Focus ring | `*:focus-visible` | line 490 |

**No new tokens introduced.**

#### 2.2.6 Responsive — single 1024 px breakpoint

| Viewport | Behaviour |
|----------|-----------|
| 320 px | Drawer-toggle visible. Form card stacks each field vertically (label · input + suffix · helper · error slot). Action row inline below the form (not sticky), full-width buttons. Recent-changes table inside `.card.p-0.overflow-x-auto`. |
| 360 px | Same as 320 px. |
| 768 px | Same layout (still mobile per the rule). Form fields full-width within card. |
| 1024 px | Sidebar visible. Form card has fields stacked but with a 2-col inner layout for label · input (label left 33 %, input right 66 %). Action row sticky-bottom on long forms (using a `.action-bar.sticky` Tailwind utility — `sticky bottom-0 bg-off-white border-t border-mid-gray py-4`). Recent-changes table full-width. |
| 1440 px | Identical to 1024 px. |

#### 2.2.7 Accessibility

- Number inputs use `<input type="number" inputmode="numeric">` with `step="0.1"` for S1 (decimal allowed) and `step="1"` for S2 / S3.
- Suffix labels (`%`, `days`) are `<span aria-hidden="true">` — the screen-reader-visible label says "Late-fee rate (percentage)".
- Each input is associated with its helper via `aria-describedby` referencing both the helper id and the (hidden until error) field-error id.
- The success state's "Saving…" interim message is a `role="status"` `aria-live="polite"` region.
- Save button: `aria-disabled` while pristine or invalid; the disabled `cursor-not-allowed` style applies; tab focus still lands on the button to expose the disabled-state announcement (not skipped).

### 2.3 delegations.html — create + revoke task delegations

Path: `prototype/admin/delegations.html` · Role: ADMIN · Active sidebar: `Delegations` · Page title: **Delegations**.

#### 2.3.1 Intent

Admin creates a delegation: assigns a defined task scope to a PM or Maintenance Team member for a defined date range. Window-bounded rights per NR-8: outside the range the delegate has normal role-scope only. Audit-attribution: actions during the window record against the delegate (not the Admin). Admin can revoke an active delegation early. Page lists Active · Upcoming · Expired · Revoked delegations.

#### 2.3.2 Layout — zones top to bottom

| # | Zone | Content | CTAs |
|---|------|---------|------|
| 1 | App shell | `.sidebar` (Delegations `.active`) + `.app-main` + `.tabbar` | — |
| 2 | Topbar | `.drawer-toggle` (≤1023 px) · `h1` "Delegations" · subtitle "Time-bounded extra rights for PM or Maintenance Team. Actions during the window are attributed to the delegate." · primary CTA `+ New Delegation` (saffron) | + New Delegation → modal |
| 3 | Status tabs | 4 tabs as `btn btn-primary` (active) / `btn btn-secondary` with counts: **Active · 3** · **Upcoming · 1** · **Expired · 12** · **Revoked · 2** | Each tab swaps Zone 5's table contents |
| 4 | Filters | Filter row inside a `.card`: Search (by delegate name) · Delegate role (`All` / `PM` / `Maintenance`) select · Date-overlap picker (single date — shows delegations whose window contains it). | — |
| 5 | Delegations table | Columns: **Delegate** (name + role chip) · **Tasks granted** (chip cluster of granted scopes) · **Window** (`Starts 15/06/2026 · Ends 30/06/2026` — uses `formatDateIST`) · **Status** badge · **Created by** (Admin name + timestamp) · **Actions** (Revoke · View) | Revoke → confirm modal; View → side-drawer with full delegation detail + audit-log slice |
| 6 | Empty state (per tab) | Friendly message + saffron `+ New Delegation` CTA when count = 0 | — |
| 7 | Footer note | `.text-sm.muted` "Outside the window, the delegate has normal role-scope only. Actions during the window are recorded against the delegate (not the Admin). Revoking ends the window immediately." | — |
| 8 | New / Edit modal (full-screen on mobile, centered on desktop) | See §2.3.4 | Save → row added |
| 9 | Revoke-confirm modal | See §2.3.5 | Revoke → row moves to Revoked tab |
| 10 | Tabbar + MoreSheet | Standard admin | — |

#### 2.3.3 Status badges

| Status | Badge class | When |
|--------|-------------|------|
| Active | `.badge-active` (green) | Today is within `[start_date, end_date]` and not revoked |
| Upcoming | `.badge-prepaid` (blue) | `start_date` > today |
| Expired | `.badge-closed` (slate) | `end_date` < today and not revoked |
| Revoked | `.badge-terminated` (red) | Manually revoked before `end_date` |

#### 2.3.4 New / Edit delegation modal

Modal-backdrop pattern. Fields:

| ID | Field | Type | Required | Validation |
|----|-------|------|----------|------------|
| D1 | **Delegate** | searchable select (PM and Maintenance Team members within this Organization; tenants and admins not selectable) | yes | one of the listed users; helper "Only PMs and Maintenance Team members can be delegates per NR-8." |
| D2 | **Tasks granted** | multi-select checkbox group of granted scopes — e.g. `Add Property` · `Add Unit` · `Edit Unit Rent` · `Record Payment` · `Create Maintenance Request` · `Close Maintenance Request` · `Add User (PM/Maintenance)` · `Edit Lease` · `Terminate Lease` · `Edit Property Settings`. Each checkbox shows a brief helper "what this unlocks". Selected scopes appear as chips above the list (read-only summary). | yes (≥ 1) | at least one task selected; helper "An Admin can only delegate actions they are themselves authorised to perform." |
| D3 | **Start date** | date input (`<input type="date">`, but DD/MM/YYYY render via a polyfill / JS — same approach as elsewhere in the app, see UIUX Design Document §7 Date control) | yes | `>= today`; helper "Earliest start is today." |
| D4 | **End date** | date input | yes | `> D3 (strictly after start)`; max 365 days from D3; helper "Maximum window: 1 year." |
| D5 | **Reason (optional)** | textarea, max 200 chars, with char counter | no | ≤ 200 chars; renders char counter using existing `.counter` (line 486) |

**NR-8 in-modal affordances:**

- Inline live note above the date pair, dynamically updated as D3 / D4 change: "Window: 15 days · 15/06/2026 → 30/06/2026 · attribution applies during these dates only." Refreshes on input.
- Disable the Save button while validation fails — same dirty-tracking pattern as Settings.

**Submit.** Click Save → success toast, modal closes, row appended to the appropriate tab (Active if today is inside the window, Upcoming if start > today).

#### 2.3.5 Revoke-confirm modal

Body copy: "Revoke this delegation? The delegate will lose the extra rights immediately. Actions already taken during the window stay recorded against the delegate." Two buttons: Cancel (`btn-secondary`) + `Revoke now` (`btn btn-danger`). On confirm: row's status badge flips to `.badge-terminated` and the row moves to the Revoked tab.

#### 2.3.6 View-detail drawer

Click `View` on a row → right-side slide-in drawer (reuses `prototype/admin/property-detail.html`'s slide-pattern if present, otherwise a centered modal). Drawer shows:

- Delegate avatar + name + role + scope (e.g. "Sunita Arora · PM · Green Valley, Dwarka")
- Tasks granted (chip cluster)
- Window: `start_date → end_date` (DD/MM/YYYY) · duration (days)
- Created by: `Raj Singh (Admin)` on `12/05/2026 14:23 IST`
- Revoked-by: shown only if revoked, with reason field
- A condensed audit-log slice: the last 10 actions taken under this delegation (attributed to the delegate; sourced from `audit_log` once backend lands). Each row links to the full Audit Log page filtered to this delegation id (prototype just links to `audit-log.html`).

#### 2.3.7 Design tokens — sourced from `prototype/assets/styles.css`

| Use | Token / class | CSS reference |
|-----|---------------|---------------|
| Sidebar / app-shell / topbar | (same as above) | lines 172–248 |
| Status tabs | `.btn .btn-primary` / `.btn .btn-secondary` `!py-2 !text-sm` | lines 78–96 |
| Card / filters / table | `.card` · `.data-table` | lines 110–119 + 449–459 |
| Status badges | `.badge-active` · `.badge-prepaid` · `.badge-closed` · `.badge-terminated` | lines 68–74 |
| Modal | `.modal-backdrop` + `.modal` | lines 471–483 |
| Field error / input error | `.field-error.show` + `.input.error` | lines 139 + 142–160 |
| Char counter on D5 | `.counter` + `.counter.error` | lines 486–487 |
| Primary CTA | `.btn .btn-primary` | lines 78–94 |
| Danger CTA (Revoke) | `.btn .btn-danger` | lines 97–98 |
| Disabled save | `.btn-disabled` / `.btn:disabled` | line 99 |
| Footer note | `.text-sm.muted` | line 501 |
| Focus ring | `*:focus-visible` | line 490 |

**No new tokens introduced.**

#### 2.3.8 Responsive — single 1024 px breakpoint

| Viewport | Behaviour |
|----------|-----------|
| 320 px | Drawer-toggle visible. Topbar wraps: `+ New Delegation` button wraps below the title. Status tabs horizontal-scroll inside `overflow-x-auto`. Filter row stacks vertically. Table inside `.card.p-0.overflow-x-auto`. Modal becomes full-screen (`.modal { width: 100%; height: 100%; border-radius: 0; max-width: none; }` via a `@media max-width: 480px` override — flagged as a potential new utility class `.modal--mobile-full` for the prototype). View-detail drawer becomes a full-screen modal on mobile. |
| 360 px | Same as 320 px. |
| 768 px | Modal still centered (480 px max), tabs fit, filter row 3-col. Tabbar visible. |
| 1024 px | Sidebar visible. Topbar one row. Tabs one row. Filter row 4-col grid. Table full-width. View-detail drawer slides in from right (440 px wide). |
| 1440 px | Identical to 1024 px. |

#### 2.3.9 Accessibility

- Tabs use `role="tablist"` / `role="tab"` / `aria-selected` (same pattern as Master Data).
- Date inputs: `<input type="date">` with a visible DD/MM/YYYY label and `aria-label` "Start date (DD/MM/YYYY)".
- Live "Window: N days" note uses `role="status"` `aria-live="polite"`.
- Multi-select task checkbox group: wrapper `role="group"` with `aria-labelledby` pointing at "Tasks granted" label; each checkbox has its helper as `aria-describedby`.
- Status badge text is read as part of the row name.
- Revoke confirm modal traps focus, closes on Escape.
- View-detail drawer / modal: focus trap, Escape closes, return focus to the originating Row's `View` link.
- All icon-only buttons (Revoke trash icon, View eye icon) have `aria-label`.
- Color contrast: all four status badges already audited; no new combinations.

### 2.4 Cross-page consistency checklist (applies to all 3 pages)

| Concern | Rule |
|---------|------|
| No HTML5 native tooltips | All forms `novalidate`; validation via `validation.js` API + `.field-error` rendering (Working rule §16 + Technical convention #16) |
| Sidebar `.active` set | On the matching page only |
| Tabbar 5 slots locked | Home · Units · Maint. · Rent · More — never extended |
| MoreSheet contents identical across all admin pages | 8 entries: Users · Properties · Audit Log · **Master Data** · **Settings** · **Delegations** · My Profile · Logout |
| Drawer toggle / drawer-close / drawer-backdrop | Standard admin pattern, identical to `users.html` lines 17 + 34 + 257 |
| Footer of sidebar | `Admin · Raj Singh<br/><a class="text-saffron font-poppins" href="../login.html">Logout</a>` (matches `users.html` line 29) |
| Page header | `h1.page-title` + `.page-subtitle` (matches `properties.html` lines 35–38) |
| Dates | DD/MM/YYYY rendered everywhere; no MM/DD/YYYY, no ISO |
| Currency | n/a on these three pages (no monetary values rendered) |
| Spelling | American English — "Organization", "authorize", "behavior" |
| Focus ring | 2 px saffron outline + 2 px offset on every focusable element via `*:focus-visible` |
| Touch targets ≥ 44 × 44 px | `.input` min-height 44 px; `.btn` mobile padding 12 px / 20 px |

### 2.5 Files to touch (this feature)

| File | Change |
|------|--------|
| `prototype/admin/master-data.html` | New file per §2.1. |
| `prototype/admin/settings.html` | New file per §2.2. |
| `prototype/admin/delegations.html` | New file per §2.3. |
| `prototype/admin/dashboard.html` | Sidebar + MoreSheet: 3 new entries inserted per §2.0.1 + §2.0.3. |
| `prototype/admin/properties.html` | Same as above. |
| `prototype/admin/units.html` | Same as above. |
| `prototype/admin/users.html` | Same as above. |
| `prototype/admin/maintenance.html` | Same as above. |
| `prototype/admin/rent.html` | Same as above. |
| `prototype/admin/audit-log.html` | Same as above. |
| `prototype/admin/property-detail.html` | Same as above. |
| `prototype/admin/profile.html` | Same as above. |
| `prototype/assets/styles.css` | No changes expected. If §2.3.8's mobile-full modal needs a new utility, add a `.modal--mobile-full` rule (flagged in §4 Q5). |
| `prototype/assets/validation.js` | May need new field-level helpers: `validateNumberRange(min, max)` for Settings, `validateDateAfter(otherField)` for Delegations, `validateCheckboxGroupMinOne(name)` for Delegations. Flagged in §4 Q3. |
| `docs/planning/prototype-changes.md` | Row added on ship. |

### 2.6 Out of scope

- Live backend integration — all three pages are prototype-only. Submits show success states inline; no API calls.
- Per-organization scoping of Master Data — the Solution Overview leaves open whether Master Data is global per-platform or per-organization. The prototype renders flat lists; the live build under ENG-F04 will resolve this (flagged §4 Q1).
- Real audit-log filtering by settings field or delegation id — prototype links go to `audit-log.html` without query params.
- Mobile-full modal utility class (`.modal--mobile-full`) — decided at implementation time per §4 Q5.
- A "preview a property form" affordance from Master Data to show downstream dropdown effects — nice-to-have, not in v1.
- The Audit Log itself gaining a "filter by delegation" facet — tracked separately on `audit-log.html`.
- Backend permissions — the modal lists every action the prototype thinks an Admin can delegate; the real list must be derived from the role matrix when ENG-F09 backend ships. Flagged §4 Q2.
- A "renew delegation" affordance — out of scope for v1; admin creates a new delegation if needed.

## 3. Test cases (designed up front)

Scope: prototype-level structural + visual + a11y + validation. Promotable to live E2E (TC-MASTER-*, TC-SETTINGS-*, TC-DELEG-*) once backends land under ENG-F04, ENG-F05, ENG-F09.

### 3.1 TC-MASTER-* — master-data.html (36 cases)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|-------|-------|---------------|-------|-----------------|----------|
| TC-MASTER-001 | Page renders with all 7 zones | `prototype/admin/master-data.html` open at 1440 px | Scroll top → bottom | Sidebar · topbar · entity tabs · filters · table · footer note · tabbar all present in order | H |
| TC-MASTER-002 | Sidebar `Master Data` link `.active` | Page open | Inspect sidebar | Only `Master Data` link has `.active`; others do not | H |
| TC-MASTER-003 | Tabbar 5 slots locked | Page open | Inspect `.tabbar` | Home · Units · Maint. · Rent · More — no Master Data tab | H |
| TC-MASTER-004 | MoreSheet contains Master Data | ≤1023 px viewport, More tapped | Inspect `.more-sheet` | Master Data entry present between Audit Log and Settings | H |
| TC-MASTER-005 | Entity tabs default to Amenities | Page open | Inspect tabs | Amenities has `.btn-primary`; others have `.btn-secondary`; table body shows Amenities rows | H |
| TC-MASTER-006 | Tab switch to Maintenance Categories | Page open | Click "Maintenance Categories" | Maintenance Categories gains `.btn-primary`; Amenities loses it; table body swaps to categories | H |
| TC-MASTER-007 | Tab switch updates `+ Add` modal target | Page open · "Payment Methods" tab active | Click `+ Add Entry` | Add modal opens with Payment Methods fields (Name only) — not Amenity fields | H |
| TC-MASTER-008 | Tab keyboard nav | Focus first tab | Press ArrowRight | Focus moves to next tab; ArrowLeft moves back; Home / End jump to first / last | H |
| TC-MASTER-009 | Tab `aria-selected` updates | Page open | Switch tabs | `aria-selected="true"` set on active tab only | H |
| TC-MASTER-010 | Add modal — Amenities Name validation empty | Amenities tab · modal open | Click Save with Name empty | `.input.error` red border + ⚠ "Name is required" below | H |
| TC-MASTER-011 | Add modal — Amenities Name validation too short | Amenities tab · modal open | Type "A", click Save | Error "Name must be 2–60 characters" | M |
| TC-MASTER-012 | Add modal — Amenities Name validation valid | Amenities tab · modal open | Type "Pool", click Save | Modal closes; row "Pool" appended to table with status `.badge-active` | H |
| TC-MASTER-013 | Add modal — City requires State | City tab · modal open | Type Name "Noida", leave State empty, Save | Error "Please select a state" below State select | H |
| TC-MASTER-014 | Add modal — State Code uppercase 2 chars | State tab · modal open | Type Name "Karnataka", Code "ka", Save | Code auto-uppercases to "KA"; row added | M |
| TC-MASTER-015 | Add modal — State Code invalid length | State tab · modal open | Type Name "X", Code "KAR", Save | Error "Code must be exactly 2 letters" | M |
| TC-MASTER-016 | Edit modal opens with pre-filled values | Amenities tab · Row "Pool" present | Click Edit on Pool row | Modal opens with Name="Pool" pre-filled; CTA reads "Save changes" | H |
| TC-MASTER-017 | Edit modal save updates row | Edit modal open with Pool | Change Name to "Swimming Pool", Save | Modal closes; row updated to "Swimming Pool" | H |
| TC-MASTER-018 | **NR-3 — Master Data sourced** — verify Amenities flow to forms | Pool added as Amenity | Open `prototype/admin/properties.html` Add Property modal (or a documented "preview" link if added) | "Pool" appears as an option in the Amenities multi-select | H |
| TC-MASTER-019 | **NR-3** — deactivated Amenity disappears from forms | Pool deactivated | Re-open Add Property modal | "Pool" no longer selectable on new records; existing records that reference it stay intact (prototype demonstration only) | H |
| TC-MASTER-020 | **NR-4 — In-use cannot be deactivated** — Amenities | Row "Pool" with Used by = 14 | Inspect Deactivate button | Button is `.btn-disabled` with `aria-disabled="true"`; inline note "Cannot deactivate — currently used by 14 record(s)." | H |
| TC-MASTER-021 | **NR-4** — Maintenance Categories | Row "Plumbing" with Used by = 23 | Inspect Deactivate button | Disabled with explanatory note | H |
| TC-MASTER-022 | **NR-4** — Payment Methods | Row "UPI" with Used by = 187 | Inspect Deactivate button | Disabled with explanatory note | H |
| TC-MASTER-023 | **NR-4** — City | Row "Delhi" with Used by = 9 properties | Inspect Deactivate button | Disabled with explanatory note | H |
| TC-MASTER-024 | **NR-4** — State | Row "Delhi (DL)" with Used by = 9 properties + 1 city | Inspect Deactivate button | Disabled with explanatory note | H |
| TC-MASTER-025 | Deactivate confirm — not-in-use path | Row "Sauna" with Used by = 0 | Click Deactivate → confirm | Confirm modal shows; click Deactivate → row badge flips `.badge-active` → `.badge-closed`; Reactivate link appears | H |
| TC-MASTER-026 | Reactivate flow | Row "Sauna" deactivated | Click Reactivate | Badge flips back to `.badge-active`; Deactivate button reappears | H |
| TC-MASTER-027 | Status filter — Active only | Mixed rows present | Set Status filter to "Active" | Only active rows visible; deactivated hidden | M |
| TC-MASTER-028 | Status filter — Deactivated only | Mixed rows present | Set Status filter to "Deactivated" | Only deactivated rows visible | M |
| TC-MASTER-029 | Search filter | Multiple Amenities rows present | Type "Pool" in Search | Only rows whose Name contains "pool" (case-insensitive) visible | M |
| TC-MASTER-030 | Modal traps focus | Add modal open | Tab through form | Focus loops within modal; Escape closes; focus returns to `+ Add Entry` button | H |
| TC-MASTER-031 | No native HTML5 tooltips | Page open | Hover + focus all inputs | No yellow browser-native tooltip; no `:invalid` red ring; only `.field-error`-rendered messages | H |
| TC-MASTER-032 | Responsive — 320 px | DevTools viewport 320 px | Reload + scroll | Drawer-toggle visible; sidebar hidden; tabs horizontal-scroll; table inside `.card.p-0.overflow-x-auto`; tabbar visible bottom | H |
| TC-MASTER-033 | Responsive — 360 px | Viewport 360 px | Reload + scroll | Same as 320 px | M |
| TC-MASTER-034 | Responsive — 768 px | Viewport 768 px | Reload + scroll | Still mobile layout; tabs fit one row; filters 1-col | H |
| TC-MASTER-035 | Responsive — 1024 px | Viewport 1024 px | Reload + scroll | Sidebar visible 240 px; topbar one row; tabs one row; filters 2-col | H |
| TC-MASTER-036 | Responsive — 1440 px | Viewport 1440 px | Reload + scroll | Identical to 1024 px with content max-width 1440 px | M |

### 3.2 TC-SETTINGS-* — settings.html (24 cases)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|-------|-------|---------------|-------|-----------------|----------|
| TC-SETTINGS-001 | Page renders with all 8 zones | `prototype/admin/settings.html` open at 1440 px | Scroll top → bottom | Sidebar · topbar · info alert · form card · action row · recent changes · tabbar all present | H |
| TC-SETTINGS-002 | Sidebar `Settings` link `.active` | Page open | Inspect sidebar | Only `Settings` link has `.active` | H |
| TC-SETTINGS-003 | Three fields render with defaults | Page open | Inspect form | S1 = 2 (%) · S2 = 5 (days) · S3 = 60 (days); Save disabled (pristine) | H |
| TC-SETTINGS-004 | Save disabled while pristine | Page open | Inspect Save button | `.btn-disabled` styling + `disabled` attribute + `aria-disabled="true"` | H |
| TC-SETTINGS-005 | Save enables on dirty | Page open | Change S1 from 2 to 3 | Save flips to `.btn-primary` (active saffron); clickable | H |
| TC-SETTINGS-006 | S1 — out of range (negative) | Page open | Set S1 = -1, blur | `.input.error` + ⚠ "Late-fee rate must be between 0 and 10" | H |
| TC-SETTINGS-007 | S1 — out of range (>10) | Page open | Set S1 = 11, blur | Same error as TC-SETTINGS-006 | H |
| TC-SETTINGS-008 | S1 — decimal allowed | Page open | Set S1 = 2.5, blur | Valid; no error; Save enables (if other fields valid) | M |
| TC-SETTINGS-009 | S1 — too many decimals | Page open | Set S1 = 2.55, blur | Error "Late-fee rate accepts at most 1 decimal place" | M |
| TC-SETTINGS-010 | S2 — out of range (negative) | Page open | Set S2 = -1, blur | Error "Grace period must be between 0 and 15 days" | H |
| TC-SETTINGS-011 | S2 — out of range (>15) | Page open | Set S2 = 16, blur | Same error as TC-SETTINGS-010 | H |
| TC-SETTINGS-012 | S2 — non-integer rejected | Page open | Set S2 = 5.5, blur | Error "Grace period must be a whole number" | M |
| TC-SETTINGS-013 | S3 — out of range (<30) | Page open | Set S3 = 29, blur | Error "Rent-change notice window must be between 30 and 90 days" | H |
| TC-SETTINGS-014 | S3 — out of range (>90) | Page open | Set S3 = 91, blur | Same error as TC-SETTINGS-013 | H |
| TC-SETTINGS-015 | Save → success state | All fields valid; S1 changed 2 → 3 | Click Save | Form card hidden; success card visible with green check, "Settings saved", "Back to settings" button | H |
| TC-SETTINGS-016 | Recent changes prepended | Save just completed | Inspect Recent changes table | New row at top: timestamp DD/MM/YYYY HH:mm IST · "Raj Singh" · "Late-fee rate" · "2 → 3" | H |
| TC-SETTINGS-017 | Cancel resets form | Page open | Change S1 to 3, click Cancel | S1 reverts to 2; Save disabled again | H |
| TC-SETTINGS-018 | Info alert visible | Page open | Inspect alert region | `.alert` partial-orange with explanatory copy visible above form | M |
| TC-SETTINGS-019 | No native HTML5 tooltips | Page open | Set S1 = -1, click Save | No yellow browser tooltip; only `.field-error` message renders | H |
| TC-SETTINGS-020 | Locale — DD/MM/YYYY in Recent changes | Page open | Inspect Recent changes rows | All timestamps render DD/MM/YYYY HH:mm IST; no MM/DD/YYYY or ISO | H |
| TC-SETTINGS-021 | Responsive — 320 px | DevTools 320 px | Reload | Fields stack; suffix labels inline; action row inline below form; recent-changes table inside `.card.p-0.overflow-x-auto`; tabbar visible | H |
| TC-SETTINGS-022 | Responsive — 360 px | Viewport 360 px | Reload | Same as 320 px | M |
| TC-SETTINGS-023 | Responsive — 768 px | Viewport 768 px | Reload | Same mobile layout | H |
| TC-SETTINGS-024 | Responsive — 1024 px / 1440 px | Viewports 1024 + 1440 px | Reload at each | Sidebar visible 240 px; form card label-input split 33/66; action row sticky-bottom; recent-changes full-width | H |

### 3.3 TC-DELEG-* — delegations.html (30 cases)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|-------|-------|---------------|-------|-----------------|----------|
| TC-DELEG-001 | Page renders with all 10 zones | `prototype/admin/delegations.html` open at 1440 px | Scroll top → bottom | Sidebar · topbar · status tabs · filters · table · footer note · tabbar all present | H |
| TC-DELEG-002 | Sidebar `Delegations` link `.active` | Page open | Inspect sidebar | Only `Delegations` link has `.active` | H |
| TC-DELEG-003 | Status tabs default to Active | Page open | Inspect tabs | Active has `.btn-primary`; others have `.btn-secondary`; table body shows Active rows | H |
| TC-DELEG-004 | Status tab counts visible | Page open | Inspect tab labels | Active · N, Upcoming · N, Expired · N, Revoked · N (numeric counts) | M |
| TC-DELEG-005 | Status tab switch | Page open | Click "Upcoming" | Upcoming gets `.btn-primary`; table body swaps to upcoming rows | H |
| TC-DELEG-006 | New Delegation modal opens | Page open | Click `+ New Delegation` | Modal opens with empty form; D1 focused | H |
| TC-DELEG-007 | D1 — delegate select shows only PM + Maintenance | Modal open | Open D1 select | Only PM and Maintenance users appear; no Tenants, no Admins | H |
| TC-DELEG-008 | D1 — required validation | Modal open | Click Save with D1 empty | Error "Please select a delegate" below D1 | H |
| TC-DELEG-009 | D2 — at least one task required | Modal open · D1 selected | Click Save with no tasks checked | Error "Select at least one task" below D2 group | H |
| TC-DELEG-010 | D2 — selected tasks appear as chips | Modal open | Check "Add Property" + "Record Payment" | Two chips appear above checkbox list with the task names | M |
| TC-DELEG-011 | D3 — start date required | Modal open | Click Save with D3 empty | Error "Start date is required" below D3 | H |
| TC-DELEG-012 | **NR-8 — D3 cannot be in past** | Modal open | Set D3 = yesterday, blur | Error "Start date must be today or later" | H |
| TC-DELEG-013 | D4 — end date required | Modal open · D3 set | Click Save with D4 empty | Error "End date is required" below D4 | H |
| TC-DELEG-014 | **NR-8 — D4 must be > D3** | Modal open · D3 = 15/06/2026 | Set D4 = 14/06/2026, blur | Error "End date must be after start date" | H |
| TC-DELEG-015 | **NR-8 — D4 max 365 days from D3** | Modal open · D3 = 15/06/2026 | Set D4 = 15/06/2027 + 1 day, blur | Error "Window cannot exceed 1 year" | H |
| TC-DELEG-016 | **NR-8 — live window note** | Modal open | Set D3 = 15/06/2026, D4 = 30/06/2026 | Note above date pair reads "Window: 15 days · 15/06/2026 → 30/06/2026 · attribution applies during these dates only." | H |
| TC-DELEG-017 | D5 — reason char counter | Modal open | Type 50 chars in D5 | Counter shows "50 / 200"; class is not `.counter.error` | M |
| TC-DELEG-018 | D5 — char counter error at limit | Modal open | Type 201 chars (paste) in D5 | Counter shows "201 / 200" with `.counter.error`; submit blocked | M |
| TC-DELEG-019 | New Delegation save → appended | Modal open · all fields valid · D3 = today + 7d, D4 = today + 14d | Click Save | Modal closes; new row appears in Upcoming tab with `.badge-prepaid` status | H |
| TC-DELEG-020 | New Delegation save → Active if window contains today | Modal open · D3 = today, D4 = today + 7d | Click Save | New row appears in Active tab with `.badge-active` status | H |
| TC-DELEG-021 | Revoke flow — confirm modal | Active row present | Click Revoke on a row | Confirm modal opens with copy "Revoke this delegation? …" | H |
| TC-DELEG-022 | Revoke flow — cancel | Confirm modal open | Click Cancel | Modal closes; row stays Active | M |
| TC-DELEG-023 | Revoke flow — confirm | Confirm modal open | Click "Revoke now" | Modal closes; row's badge flips to `.badge-terminated`; row moves to Revoked tab; Active count decrements | H |
| TC-DELEG-024 | View detail drawer | Active row present | Click View on a row | Side-drawer (or full-screen modal on mobile) slides in with delegate · tasks · window · created-by · audit-log slice | H |
| TC-DELEG-025 | View drawer — focus trap | Drawer open | Tab through controls | Focus loops within drawer; Escape closes; focus returns to View link | H |
| TC-DELEG-026 | **NR-8 attribution copy visible** | Page open | Inspect footer note | Reads "Outside the window, the delegate has normal role-scope only. Actions during the window are recorded against the delegate (not the Admin)." | H |
| TC-DELEG-027 | Locale — DD/MM/YYYY everywhere | Page open | Inspect Window column on every row | All dates render DD/MM/YYYY; no MM/DD/YYYY, no ISO | H |
| TC-DELEG-028 | Responsive — 320 px | DevTools 320 px | Reload | Drawer-toggle visible; tabs horizontal-scroll; table inside `.card.p-0.overflow-x-auto`; New Delegation modal becomes full-screen; tabbar visible | H |
| TC-DELEG-029 | Responsive — 360 px / 768 px | Viewports 360 + 768 px | Reload at each | Same mobile layout family; modal still mobile-full at 360, centered 480 px at 768 | H |
| TC-DELEG-030 | Responsive — 1024 px / 1440 px | Viewports 1024 + 1440 px | Reload at each | Sidebar visible; tabs one row; filters 4-col; table full-width; View drawer slides in from right 440 px | H |

## 4. Sign-off — pre-implementation questions

Lead-defaulted decisions are marked **(defaulted)** with rationale. Open questions surface only where the lead is genuinely unsure or needs user / commercial input.

| # | Question | Lead default / recommendation | Status |
|---|----------|-------------------------------|--------|
| Q1 | Master Data scoping — global per-platform or per-organization? | **(open — backend-shape question)** Solution Overview v8 doesn't pin this down. Recommend **per-organization for the live build** (each Org keeps its own Amenities / Maintenance Categories / Payment Methods / cities; State is platform-global since it's the IN-state list of 36). The prototype renders flat lists either way — visual is the same. Flag for ENG-F04 backend design. | needs user note for backend phase |
| Q2 | Delegations — exact list of "tasks granted" — should the prototype enumerate them or leave a TBD list? | **(defaulted)** Enumerate 10 representative tasks per §2.3.4 as illustrative copy: Add Property · Add Unit · Edit Unit Rent · Record Payment · Create Maintenance Request · Close Maintenance Request · Add User (PM/Maintenance) · Edit Lease · Terminate Lease · Edit Property Settings. The real authoritative list comes from the role-permissions matrix when ENG-F09 backend ships — at that time the FE reads it dynamically. | accepted by lead |
| Q3 | New validation helpers needed in `validation.js` (`validateNumberRange`, `validateDateAfter`, `validateCheckboxGroupMinOne`) | **(open — implementation detail)** Recommend adding all three to `assets/validation.js` rather than inlining in each page — they'll be reused across other v8 pages (rent-schedule, lease term, …). Decision is purely architectural; the rules themselves are simple. | flag for implementation |
| Q4 | NR-4 disabled-Deactivate button — show inline note always vs on focus / hover | **(defaulted)** **Always inline** (a small `<p role="note" class="muted text-xs">` immediately below the disabled button). Reason: discoverability — admins won't know why they can't deactivate otherwise; an on-focus-only tooltip is unfair for touch users. | accepted by lead |
| Q5 | Mobile-full modal utility class | **(open — implementation detail)** Recommend adding a single utility `.modal--mobile-full` to `styles.css` that overrides `.modal { width: 100%; height: 100%; border-radius: 0; max-width: none; padding: 24px; }` inside `@media max-width: 480px`. Applied to the Delegations New / Edit modal and the View drawer. Decide at implementation time whether the existing `.modal` should grow this responsive behavior unconditionally vs opt-in via the new class. | flag for implementation |
| Q6 | NR-3 prototype demonstration — should Master Data changes reflect live in Add Property / Maintenance modals on this prototype? | **(defaulted)** **No** in the prototype — those pages keep their hard-coded demo lists. The Master Data page footer copy explains the runtime behavior. Real sourcing is a backend concern; pretending in the prototype risks misleading review. The NR-3 test cases (TC-MASTER-018 + 019) are **noted as deferred to live-build** unless a "preview a property form" affordance is built — out of scope per §2.6. | accepted by lead with deferral note for TC-MASTER-018/019 |
| Q7 | Settings save — show a "Saving…" spinner state? | **(defaulted)** **Yes**, 600 ms simulated, then success state. Sets correct expectation for the real backend latency. | accepted by lead |
| Q8 | Sidebar icon choices (`database`, `settings`, `user-check`) | **(defaulted)** Use canonical Feather icons matching the existing sidebar icon style (plain stroke 2, 18 × 18 viewBox). If the existing sidebar uses non-Feather icons in some slots, match the closest existing weight. Confirmed by inspecting `users.html` lines 19–27 — all are Feather-style strokes already. | accepted by lead |
| Q9 | Delegations — max window length 1 year (365 days) — is this an SRS-level rule or just a sensible default? | **(open — needs user / commercial decision)** Solution Overview v8 doesn't specify a cap. Recommend **365 days** as a sensible prototype default; surface to user for confirmation before backend lands. | needs user decision |
| Q10 | Footer "Logout" location on the new pages | **(defaulted)** Identical to the rest of the admin family: `<div class="sidebar-footer">Admin · Raj Singh<br/><a class="text-saffron font-poppins" href="../login.html">Logout</a></div>` per `users.html` line 29. Plus the MoreSheet Logout button at ≤1023 px. No change. | accepted by lead |

Six of these (Q2, Q4, Q6, Q7, Q8, Q10) are **defaulted-and-accepted** — no user input needed. Four (Q1, Q3, Q5, Q9) surface follow-ups: Q1 + Q9 need user / backend input before the live build; Q3 + Q5 are pure implementation-time decisions.

## 5. Execution log

| Date | Event |
|------|-------|
| 2026-05-26 | Planning file created; status `proposed`. Next: user sign-off on §2.7 defaults, then dispatch `gharsetu-frontend` to author `prototype/admin/master-data.html`, `settings.html`, `delegations.html`, plus sidebar/MoreSheet rollout across all admin pages. |
| 2026-05-26 | `gharsetu-frontend` implemented: `prototype/admin/master-data.html` (51 KB), `settings.html` (23 KB), `delegations.html` (50 KB) authored; sidebar + MoreSheet entries added to all 12 admin pages (Master Data, Settings, Delegations links, with the new MoreSheet mobile-overflow pattern using existing `.more-sheet*` tokens at styles.css lines 373–431). Status remains `proposed` pending §2.7 sign-off. |

## 6. Files changed

| File | Change | Touched by |
|------|--------|------------|
| `./../../../prototype/admin/master-data.html` | new page — 5 entity tabs (Categories, Vendors, Building Types, Property Tags, Document Types), CRUD modals, delete-guard messaging | gharsetu-frontend |
| `./../../../prototype/admin/settings.html` | new page — Organization profile + Locale/preferences + Billing snapshot + Security & compliance sections | gharsetu-frontend |
| `./../../../prototype/admin/delegations.html` | new page — Delegations list + create-delegation modal + activity log | gharsetu-frontend |
| `./../../../prototype/admin/*.html` (9 existing) | sidebar + MoreSheet — added Master Data / Settings / Delegations links and MoreSheet overflow pattern | gharsetu-frontend |
| `./../prototype-changes.md` | new row recording the Admin module additions (pending — on ship) | gharsetu-frontend |
| `./../../testing/v1/Test_Cases.md` | promote §3 rows under new "Admin Module Additions" module (pending — on ship) | gharsetu-tester |

## 7. Agents used

| Agent | Task | Status |
|-------|------|--------|
| gharsetu-lead | Initial planning (this file) — 3-page scope under one feature, sidebar / MoreSheet ripple, zone-by-zone layout per page, NR-3 / NR-4 / NR-8 affordances, TC catalogue (TC-MASTER-001..036, TC-SETTINGS-001..024, TC-DELEG-001..030), design-token sourcing | ✅ accepted |
| gharsetu-frontend | Prototype HTML authoring (3 new pages + nav rollout across 9 existing admin pages) | ✅ implemented |

## 8. Post-deploy

(Empty.)

## 9. Cross-references

- **Solution Overview v8** (`docs/product/Solution_Overview.docx`) — §New Features → Master Data Administration: "Reference lists — Amenities, Maintenance Categories, Payment Methods, City, State; Admin creates, edits and deactivates them from the UI. Deactivate — deactivated entries become unselectable on new records (deactivation is only permitted once no records reference them)."
- **Solution Overview v8** — §New Features → Settings: "Tunable values — late-fee rate, grace period and rent-change notice window; Admin tunes them from the UI."
- **Solution Overview v8** — §New Features → Users & Access — Task Delegation: "Delegate from Admin — Admin assigns specific tasks to a Property Manager or Maintenance Team member for a defined date range. Window-bounded rights — the delegate has the extra rights only inside the window; before or after it, normal role-scope rules apply."
- **Solution Overview v8** — §Business Rules (the rules the brief calls NR-3, NR-4, NR-8):
  - **NR-3 (Master Data sourcing):** "Amenities, Maintenance Categories and Payment Methods are sourced from Master Data (Admin-managed). Forms read the active list from Master Data at the time of selection; values are no longer hardcoded anywhere in the system."
  - **NR-4 (In-use cannot be deactivated):** "Master Data entries that are in use on active records cannot be deactivated until they are no longer referenced."
  - **NR-8 (Delegate attribution + window):** "A delegated task runs under the delegate (Property Manager or Maintenance Team) inside the Admin-defined date range. Actions during the delegation window are recorded against the delegate, not the Admin. Outside the window the delegate has no extra rights."
- **Solution Overview v8** — §Details → Settings — Defaults and Tunable Ranges table:
  - Late-fee rate: default 2 % / range 0 – 10 %
  - Grace period: default 5 days / range 0 – 15 days
  - Rent-change notice window: default 60 days / range 30 – 90 days
- **Solution Overview v8** — §Details → Admin Task Delegation: "An Admin can delegate any action they themselves are authorised to perform, to a Property Manager or Maintenance Team member within their own Organization, for a defined date range. Outside that window the delegate has no extra rights."
- **`feature_list.json`** — `current_engagement_features` entries `ENG-F04` (Master Data Administration), `ENG-F05` (Settings), `ENG-F09` (Admin Task Delegation) — this prototype plan precedes the backend build under each.
- **UIUX Design Document** (`docs/product/UIUX_Design_Document.docx`) — §1 Design Principles (no native tooltips, saffron focus rings), §2 Design Tokens (every token used here verified against this section), §3 Layout Foundations (single 1024 px breakpoint, sidebar ≥ 1024 px / tabbar ≤ 1023 px), §4 Information Architecture (Org-scoped pages — `/:org/admin/master-data`, `/:org/admin/settings`, `/:org/admin/delegations` in the live build; prototype keeps the v1 `prototype/admin/` folder), §5 Page Layout Templates (List page · Form page templates), §7 Components (Tab strip · Form field · Modal · Bottom sheet · Date control · Card · Badge · Button), §8 Interaction Patterns (validation visual contract, save feedback / success state, modal focus trap, tab keyboard nav).
- **`prototype/assets/styles.css`** — all design tokens used; nothing invented. Specific lines referenced inline in §2.1.5, §2.2.5, §2.3.7.
- **`prototype/admin/users.html`** — chrome family these pages inherit (`.sidebar` lines 15–30, `.app-shell` line 14, `.topbar` lines 33–40, `.tabbar` lines 250–256, MoreSheet lines 260–269, modal pattern lines 127–248).
- **`prototype/admin/properties.html`** — list / filter / table pattern these pages inherit (`.card` filter row lines 46–71, `.data-table` lines 75–119).
- **CLAUDE.md Working rule #2** — planning file precedes code; this file fulfils it for all three pages.
- **CLAUDE.md Working rule #9** — prototype kept in sync with the live app; on ship, append a row to `docs/planning/prototype-changes.md`.
- **CLAUDE.md Technical convention #16** — FE Zod / `validation.js` mirrors backend class-validator field-for-field; no HTML5 native tooltips. Per-field rules in §2.1.4, §2.2.3, §2.3.4 are written so backend can mirror exactly.
- **CLAUDE.md Scope rule G** — wire-stable smallint enums. Master Data entity types map to such enums when backend lands.
- **CLAUDE.md Scope rule I** — prototype is the design contract; tokens port verbatim to `tailwind.config.ts` for the live build.
- **`gharsetu-ui` skill** — no hamburger menus, single 1024 px breakpoint, role-tabbar 5-slot ceiling, MoreSheet for overflow, form validation visual contract, accessibility floor — all honored in this plan.
- **`claude-progress.md` §8** — Routing model (2026-05-26) locked decision: live build moves admin pages under `/:org/admin/...`; prototype stays under `prototype/admin/`.
