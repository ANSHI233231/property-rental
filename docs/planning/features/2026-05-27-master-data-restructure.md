# Master Data restructure — sidebar sub-menu + Visit Purposes master

| Field | Value |
|---|---|
| Status         | proposed |
| Started        | 2026-05-27 |
| Shipped        | — |
| SRS row        | (n/a — UI restructure of an existing module; the underlying Master Data feature is already in `admin-module-additions.md`) |
| Test cases     | TC-MASTER-RE-001..NNN (split-pages + sidebar + Visit Purposes) |
| Prototype todo | row pending |

---

## 1. Requirement (as given)

> "in the visitor we have purpose of visiting we need to create a master of it"
>
> "and in the admin we need to show master data sub menu as an sub menu and all of the master should be become part of it and remove the tabs from the master pages"

Two related changes:
1. Visit Purposes becomes a managed Master Data entity (admin-editable list, referenced by the visitor flow on tenant + PM pages).
2. The current `master-data.html` (which holds all 5 existing entities behind a tab UI) is split — each entity gets its own page, and the admin sidebar's flat **Master Data** link becomes an expandable **Master Data** section with one child per entity.

---

## 2. Plan

### 2.0 Rules check (CLAUDE.md)

- Working rule §2 — this planning file is written **before** the code change.
- Working rule §9 — prototype-only; a single `prototype-changes.md` row will cover the restructure on ship.
- Scope rule **I** — every value sourced from existing `prototype/assets/styles.css` tokens. Minor additions for the indented sub-link styling — no new colors.

### 2.1 New file layout

```
prototype/admin/master-data/
├── amenities.html          (was tab #1 in master-data.html — Amenities · 18)
├── categories.html         (was tab #2 — Maintenance Categories · 12)
├── payment-methods.html    (was tab #3 — Payment Methods · 6)
├── cities.html             (was tab #4 — City · 24)
├── states.html             (was tab #5 — State · 36)
└── visit-purposes.html     (NEW — Visit Purposes · 6 default seeds)
```

The old `prototype/admin/master-data.html` becomes a **landing page** showing all six masters as cards (name + count + brief description + "Manage →" link). This preserves the existing sidebar link target and avoids broken hrefs.

### 2.2 Sidebar sub-menu pattern

Replace the existing single `<a href="master-data.html" class="sidebar-link">Master Data</a>` entry across all 12 admin pages with an expandable section:

```
Master Data       ▾   ← header row, click to toggle collapse on mobile drawer (desktop always-expanded)
  Amenities
  Categories
  Payment Methods
  Cities
  States
  Visit Purposes
```

- Desktop (≥1024px): always expanded — the six children render indented below the heading.
- Mobile drawer: collapsed by default to save vertical space; chevron toggles.
- Active state: the child link for the current page gets `sidebar-link.active` styling; if any child is active, the parent "Master Data" row also highlights.

CSS additions (to `prototype/assets/styles.css`):
- `.sidebar-section-header` — non-link heading row, slightly muted, with optional chevron on mobile.
- `.sidebar-sublink` — variant of `.sidebar-link` with extra left padding (44px instead of 24px) and 13px font size.
- Optional `.sidebar-section.collapsed > .sidebar-sublink { display: none; }` for mobile collapse.

### 2.3 Each master page layout

Identical chrome across all 6 pages (sidebar / topbar / account menu / mobile tabbar / scripts). Main content:

```
<header class="topbar">
  <h1 class="page-title">{Entity name}</h1>
  <button class="btn btn-primary">+ Add {entity}</button>
</header>

<section class="card mb-6">          <!-- filter bar (same UX as today) -->
  <div class="grid md:grid-cols-2 gap-4">
    <input class="input" placeholder="Search…" />
    <select class="input"><option>All status</option><option>Active</option><option>Inactive</option></select>
  </div>
</section>

<section class="card p-0 overflow-x-auto">
  <table class="data-table">
    <thead><tr>{entity-specific columns}</tr></thead>
    <tbody>{entity-specific seed rows from the current tabs}</tbody>
  </table>
</section>
```

Tab buttons + JS `switchEntity()` are removed entirely. Add / Edit / Deactivate modals remain — one set per page, no entity-switching logic needed.

### 2.4 Visit Purposes master content

Seed rows (admin-editable):

| ID | Name | Description | Used by visits | Status |
|---|---|---|---|---|
| VP-01 | Personal visit | Friends / family · social | 23 | Active |
| VP-02 | Delivery | Food · parcel · courier | 47 | Active |
| VP-03 | Cab / Ride pickup | Cab arrival to pick the resident | 18 | Active |
| VP-04 | Maintenance vendor | External tradesperson called by PM or tenant | 9 | Active |
| VP-05 | Service / Utility | Electricity meter reader, plumber call, etc. | 12 | Active |
| VP-06 | Other | Free-text reason captured at entry | 4 | Active |

Columns: Name · Description · Used by (visits) · Status · Actions.

### 2.5 Visitor pages wiring

`tenant/visitors.html` + `pm/visitors.html`:
- Replace the hard-coded `<option>` list in the "Add visitor" / pre-approval modals with options matching the Visit Purposes master seed list (6 options).
- Below the `<select>`, add a small helper line: *"Purposes are managed by Admin in Master Data."*
- "Other" option auto-reveals a small free-text field for the specific reason.
- PM visitor list table rows that display purpose (lines that read "Personal visit" / "Delivery" / "Maintenance vendor") continue working — the values they show are now the canonical labels from the master, so they don't need to change.

### 2.6 master-data.html landing page

Old tab content goes; new content:

```
<header class="topbar">
  <h1 class="page-title">Master Data</h1>
</header>

<section class="grid md:grid-cols-3 gap-4">
  6 cards — each card shows:
    – Title (entity name, Poppins 600 18px)
    – Count badge ("18 entries · 2 inactive")
    – One-line description
    – "Manage →" link to the sub-page
</section>
```

This preserves the URL `/admin/master-data` as the index — sidebar's "Master Data" parent row routes here.

### 2.7 Files to touch

| Path | Change | Owner |
|---|---|---|
| `prototype/admin/master-data.html` | Rewrite as a 6-card landing page | gharsetu-frontend |
| `prototype/admin/master-data/amenities.html` | NEW — Amenities entity page | gharsetu-frontend |
| `prototype/admin/master-data/categories.html` | NEW — Maintenance Categories | gharsetu-frontend |
| `prototype/admin/master-data/payment-methods.html` | NEW — Payment Methods | gharsetu-frontend |
| `prototype/admin/master-data/cities.html` | NEW — Cities | gharsetu-frontend |
| `prototype/admin/master-data/states.html` | NEW — States | gharsetu-frontend |
| `prototype/admin/master-data/visit-purposes.html` | NEW — Visit Purposes (NEW master, 6 seeds) | gharsetu-frontend |
| `prototype/admin/*.html` (12 pages) | Sidebar nav: replace single Master Data link with expandable section + 6 sub-links · update active state per page | gharsetu-frontend |
| `prototype/admin/*.html` More-sheet (mobile overflow) | Master Data parent + 6 sub-rows added | gharsetu-frontend |
| `prototype/assets/styles.css` | Add `.sidebar-section-header`, `.sidebar-sublink`, optional collapse rules | gharsetu-frontend |
| `prototype/assets/validation.js` | `toggleSidebarSection()` for mobile collapse only (desktop is CSS-only always-expanded) | gharsetu-frontend |
| `prototype/tenant/visitors.html` | Purpose dropdown options aligned to Visit Purposes master + helper text + "Other" reveal | gharsetu-frontend |
| `prototype/pm/visitors.html` | Same — pre-approve modal | gharsetu-frontend |

Note: sub-pages live one folder deeper, so their asset paths become `../../assets/styles.css` and links to siblings become `../<page>.html` (e.g., the sidebar Dashboard link from a master-data sub-page is `../dashboard.html`). Account menu profile link is `../profile.html`. Logo brand href is `../dashboard.html`.

### 2.8 Open decisions for user sign-off

1. **Always-expanded vs click-to-expand on desktop** — proposed default: always expanded (clearer for an admin tool). Confirm.
2. **"Other" purpose behavior** — proposed: when user picks "Other", a small free-text field appears below. Confirm or just allow the dropdown alone.
3. **Sub-page URL style** — proposed: `prototype/admin/master-data/<entity>.html` (subfolder). Alternative: flat `prototype/admin/master-<entity>.html`. Subfolder default. Confirm.
4. **Landing page or first-master redirect** — proposed: landing page with 6 cards. Alternative: redirect `master-data.html` to `master-data/amenities.html`. Landing default (more discoverable).
5. **PM mobile More-sheet** — Master Data parent + 6 children adds 7 rows. Acceptable, or collapse the 6 children behind a single Master Data row? Default: expanded (consistency with sidebar).

---

## 3. Test cases (designed up front)

### 3.1 Sidebar sub-menu (TC-MASTER-RE-001..010)

| TC-ID | Title | Pre | Steps | Expected | Priority |
|---|---|---|---|---|---|
| TC-MASTER-RE-001 | Sub-menu renders on every admin page | Logged-in Admin | Visit any /admin page | Master Data section visible with 6 child links indented below | H |
| TC-MASTER-RE-002 | Active state on child link | On `amenities.html` | Inspect sidebar | Amenities row highlighted, parent Master Data row also subtly highlighted | H |
| TC-MASTER-RE-003 | All 6 child links present | Any /admin page | Inspect sidebar | Amenities · Categories · Payment Methods · Cities · States · Visit Purposes | H |
| TC-MASTER-RE-004 | Desktop always-expanded | ≥1024px | Visit /admin/dashboard | Children visible without click | H |
| TC-MASTER-RE-005 | Mobile drawer collapse | <1024px, open drawer | Tap Master Data parent | Sub-children toggle visibility; chevron rotates | M |
| TC-MASTER-RE-006 | More-sheet contains Master Data section on admin/PM | <1024px | Open More-sheet | Master Data section + 6 children + Settings + Delegations + Sign out | H |
| TC-MASTER-RE-007 | Brand link (logo) still routes to admin/dashboard | Any master sub-page | Click GharSetu wordmark | URL = /admin/dashboard | H |
| TC-MASTER-RE-008 | Account menu links work from sub-pages | Any master sub-page | Open account menu → My Profile | URL = /admin/profile | H |
| TC-MASTER-RE-009 | Asset paths (../../assets) load | Any master sub-page | Inspect Network tab | styles.css + validation.js + impersonation.js all 200 | H |
| TC-MASTER-RE-010 | Sidebar sub-menu absent for non-admin roles | Logged in PM/Tenant/Maintenance/Super Admin | Inspect sidebar | No Master Data section (master data is Admin-only) | M |

### 3.2 Each master page (TC-MASTER-RE-011..026)

For each of: amenities, categories, payment-methods, cities, states, visit-purposes — apply the same 3 checks:

| TC-ID | Title | Pre | Steps | Expected | Priority |
|---|---|---|---|---|---|
| TC-MASTER-RE-011..016 | Page renders with correct title | Visit each master sub-page | Inspect topbar | `<h1>` = entity name (Amenities / Categories / etc.) | H |
| TC-MASTER-RE-017..022 | Table has entity-specific columns | Each master sub-page | Inspect table headers | Columns match entity schema (e.g., Amenities: Name · Used by · Status) | H |
| TC-MASTER-RE-023 | No tab UI remains | Each master sub-page | Inspect main | No `<button role="tab">` or `role="tablist"` elements | H |
| TC-MASTER-RE-024 | Add/Edit/Deactivate modals work | Each sub-page | Click "+ Add" | Modal opens with entity-specific fields only | H |
| TC-MASTER-RE-025 | Master Data landing page renders 6 cards | Visit `/admin/master-data` | Inspect grid | 6 cards, each linking to its sub-page with count + description | H |
| TC-MASTER-RE-026 | Landing page card "Manage" link target correct | On landing | Click each Manage link | Navigates to the correct sub-page | H |

### 3.3 Visit Purposes master (TC-MASTER-RE-030..036)

| TC-ID | Title | Pre | Steps | Expected | Priority |
|---|---|---|---|---|---|
| TC-MASTER-RE-030 | 6 seed rows visible | Visit `/admin/master-data/visit-purposes` | Inspect table | Personal visit · Delivery · Cab/Ride pickup · Maintenance vendor · Service/Utility · Other | H |
| TC-MASTER-RE-031 | "Used by" column shows visit count | As above | Inspect Used by column | Numeric counts present | M |
| TC-MASTER-RE-032 | Add modal — name + description fields | Click + Add Purpose | Inspect modal | Name (required) + Description (optional) + Status toggle | H |
| TC-MASTER-RE-033 | Deactivate modal warns if Used by > 0 | Click row action for "Personal visit" → Deactivate | Inspect modal | Warning: "This purpose is used by 23 visits. Existing visits keep their label; new visits can't pick this purpose." | H |
| TC-MASTER-RE-034 | Status badge correct | Each row | Inspect Status column | Active = green badge; Inactive = muted | M |

### 3.4 Visitor wiring (TC-MASTER-RE-040..046)

| TC-ID | Title | Pre | Steps | Expected | Priority |
|---|---|---|---|---|---|
| TC-MASTER-RE-040 | Tenant pre-approve modal shows master purposes | Logged-in Tenant on /tenant/visitors → "+ Pre-approve Visitor" | Open Purpose select | 6 options matching the Visit Purposes master | H |
| TC-MASTER-RE-041 | PM pre-approve modal shows master purposes | Logged-in PM on /pm/visitors → pre-approve | Open Purpose select | Same 6 options | H |
| TC-MASTER-RE-042 | Helper text references Master Data | Either visitor pre-approve modal | Inspect helper below select | "Purposes are managed by Admin in Master Data." | M |
| TC-MASTER-RE-043 | "Other" reveals free-text field | Select Other in Purpose | Inspect modal | A small text input appears below the Purpose select for the specific reason | M |
| TC-MASTER-RE-044 | PM visitor list rows show purpose label | Logged-in PM on /pm/visitors | Inspect existing rows | Labels match the master canonical names (no "Cab" shorthand if master says "Cab / Ride pickup") | M |
| TC-MASTER-RE-045 | Form validation still works | Submit without picking Purpose | Inspect modal | Inline error: "Please pick a visit purpose" | H |
| TC-MASTER-RE-046 | Form validation when Other has empty text | Pick Other, leave free-text blank, submit | Inspect modal | Inline error: "Please describe the visit reason" | M |

### 3.5 Cross-cutting

- Responsive at 5 widths (320, 480, 768, 1024, 1440) — sidebar sub-menu and 6 master pages.
- Accessibility — `aria-expanded` on the sub-menu header (mobile), `aria-current="page"` on the active child link.
- Locale — counts use Indian number formatting if they cross 1,000 (none of the seed data does).

---

## 4. Sign-off

| Date | Question | Default | User answer |
|---|---|---|---|
| 2026-05-27 | Always-expanded vs click-to-expand on desktop? | Always-expanded | _pending_ |
| 2026-05-27 | "Other" purpose: reveal free-text field? | Yes | _pending_ |
| 2026-05-27 | Subfolder vs flat naming for sub-pages? | Subfolder (`master-data/<entity>.html`) | _pending_ |
| 2026-05-27 | Landing page (6 cards) or redirect to first master? | Landing page with 6 cards | _pending_ |
| 2026-05-27 | More-sheet treatment for the 6 sub-rows? | Expanded (7 rows total under Master Data) | _pending_ |

Implementation proceeds with defaults unless the user pushes back during execution.

---

## 5. Execution log

| Date | Event |
|---|---|
| 2026-05-27 | Planning file authored. Dispatching `gharsetu-frontend` to execute. |
| 2026-05-27 | `gharsetu-frontend` delivered: `prototype/admin/master-data/{amenities, categories, payment-methods, cities}.html` (4 of 6 sub-pages), styles.css additions (`.sidebar-section-header`, `.sidebar-sublink`, `.section-icon`, `.section-chev`, `.more-sheet-section-header`, `.more-sheet-sublink`), `validation.js` got `toggleSidebarSection()`. Agent stalled at the 600 s watchdog before finishing the last 2 pages, the landing rewrite, the sidebar sweep on the 11 other admin pages, and the visitor wiring. |
| 2026-05-27 | Orchestrator recovery: created `states.html` + `visit-purposes.html` (the 2 missing sub-pages); rewrote `master-data.html` as the 6-card landing; ran Python sweep to add the Master Data sub-menu to the sidebar AND mobile More-sheet on the 11 other admin pages; wired `tenant/visitors.html` purpose select to the 6 master values + helper text + "Other" reveal + free-text validation; PM visitors page needs no change (only displays purpose strings already aligned to the master). Stripped re-introduced `page-subtitle` paragraphs from 4 sub-pages. Verified: 6 sub-pages exist, 19 admin pages have `.sidebar-section-header`, 0 pages still link to old single Master Data sidebar-link, helper text present on tenant visitor purpose select. |

---

## 6. Files changed

| File | Change | Touched by |
|---|---|---|
| `./../../../prototype/admin/master-data.html` | Rewrite — 6-card landing | gharsetu-frontend |
| `./../../../prototype/admin/master-data/amenities.html` | NEW | gharsetu-frontend |
| `./../../../prototype/admin/master-data/categories.html` | NEW | gharsetu-frontend |
| `./../../../prototype/admin/master-data/payment-methods.html` | NEW | gharsetu-frontend |
| `./../../../prototype/admin/master-data/cities.html` | NEW | gharsetu-frontend |
| `./../../../prototype/admin/master-data/states.html` | NEW | gharsetu-frontend |
| `./../../../prototype/admin/master-data/visit-purposes.html` | NEW master | gharsetu-frontend |
| `./../../../prototype/admin/*.html` (12 files) | Sidebar nav + More-sheet update — Master Data sub-menu | gharsetu-frontend |
| `./../../../prototype/assets/styles.css` | `.sidebar-section-header`, `.sidebar-sublink`, mobile collapse | gharsetu-frontend |
| `./../../../prototype/assets/validation.js` | `toggleSidebarSection()` for mobile | gharsetu-frontend |
| `./../../../prototype/tenant/visitors.html` | Purpose options aligned to master + helper text + Other reveal | gharsetu-frontend |
| `./../../../prototype/pm/visitors.html` | Same | gharsetu-frontend |
| `./../prototype-changes.md` | Row pending — on ship | gharsetu-frontend |

---

## 7. Agents used

| Agent | Task | Status |
|---|---|---|
| gharsetu-lead (orchestrator) | Planning file + sign-off + dispatch | accepted |
| gharsetu-frontend | All implementation work | pending |

---

## 8. Post-deploy

_Empty — prototype only; will be populated when the React/Next.js port lands and any port-time issues surface._

---

## 9. Cross-references

- `docs/planning/features/2026-05-26-admin-module-additions.md` — original Master Data feature; this file is its UI restructure.
- `docs/planning/features/2026-05-26-visitor-management.md` — the visitor pre-approval flow that now pulls purposes from this master.
- `docs/planning/features/2026-05-26-common-ui-cleanup.md` — the sidebar pattern this builds on.
- `prototype/assets/styles.css` — token source for sidebar / card / table styling.
