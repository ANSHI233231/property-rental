# Visitor Management — PM + Tenant prototype pages (v8)

| Field | Value |
|---|---|
| Status         | proposed |
| Started        | 2026-05-26 |
| Shipped        | — |
| SRS row        | (n/a — prototype-only; v8 SAAS feature, SRS row added on SAAS-layer integration pass) |
| Test cases     | TC-VISIT-PM-001..018 · TC-VISIT-TENANT-001..017 (designed in §3, prototype-scope) |
| Prototype todo | row to be added to `./../prototype-changes.md` on ship |

## 1. Requirement (as given)

> "Plan the 2 new Visitor Management prototype pages in a single planning file. Today is 2026-05-26."
>
> "1. `prototype/pm/visitors.html` — Property Manager's visitors view: list of pre-approved visitors awaiting check-in, currently-checked-in visitors, recent check-outs. PM approves / denies tenant pre-approvals, timestamps check-in / check-out arrivals."
>
> "2. `prototype/tenant/visitors.html` — Tenant's visitors view: pre-approve a visitor (name, phone, purpose, expected date & time), see status (Pending / Approved / Checked-in / Checked-out)."
>
> "Plan it as ONE feature. Visitor Management is a single feature with two role-scoped views. One planning file at `docs/planning/features/2026-05-26-visitor-management.md` with all 9 sections per the FEATURE_PLANNING template."
>
> "In §2 Plan, describe both pages as sub-sections (5.1 PM visitors · 5.2 Tenant visitors) with: zone-by-zone layout, sidebar/tabbar updates (PM and Tenant sidebars both gain Visitors), per-page interactions (PM: approve / deny / check-in / check-out · Tenant: raise pre-approval drawer with date+time picker, see status badges), design token references."
>
> "In §3 Test cases, namespace by page: TC-VISIT-PM-NNN, TC-VISIT-TENANT-NNN. Cover the pre-approval form (with expected date + time both required), status transitions (Pending → Approved → Checked-in → Checked-out), accessibility, responsive at 5 widths, locale (DD/MM/YYYY for the date, HH:mm IST for time)."

## 2. Plan

### 2.0 Intent

Visitor Management is a v8 (Solution Overview v8 §New Features) addition that gives Tenants the ability to pre-approve a visitor and Property Managers the ability to approve / deny those requests and timestamp arrivals + departures. This planning iteration is **prototype-only** — two new static HTML pages under `./../../../prototype/pm/visitors.html` and `./../../../prototype/tenant/visitors.html` plus sidebar / tabbar updates across the PM + Tenant prototype pages. No backend, no `apps/api`, no `apps/web` work in this iteration. The design contract is derived directly from the UIUX Design Document IA row (`/:org/visitors` for PM + Tenant) and the Solution Overview Visitor Management bullets (tenant pre-approval captures name + phone + purpose + expected date and time; PM approves / denies and arrival + departure are timestamped). The pages share status semantics — Pending / Approved / Denied / Checked-in / Checked-out — but render different chrome and different action affordances per role.

### 2.1 Routing model

- PM page: `/:org/visitors` rendered statically at `./../../../prototype/pm/visitors.html`.
- Tenant page: `/:org/visitors` rendered statically at `./../../../prototype/tenant/visitors.html`.
- Both org-scoped; no public route. Admin and Maintenance roles do **not** see a Visitors sidebar entry — out of scope for v8.

### 2.2 Navigation updates

| Role | Sidebar (≥1024) | Mobile tabbar (≤1023) | Overflow |
|---|---|---|---|
| PM    | Dashboard · Units · Tenants · Leases · Rent Collection · Maintenance · **Visitors (new)** · — divider — · My Profile | Home · Units · Tenants · Rent · More | MoreSheet gains **Visitors** (between Maintenance and My Profile) |
| Tenant | My Lease · Rent · Maintenance · **Visitors (new)** · — divider — · My Profile | My Lease · Rent · Maintenance · **Visitors (new)** · Profile | no MoreSheet (5 slots fit) |

- **PM sidebar**: insert `Visitors` link **after `Maintenance`** and **before the divider** (immediately before `My Profile`). Active state per `.sidebar-link.active` (saffron 4px left border + saffron icon).
- **PM mobile tabbar**: tabbar slot count is unchanged at 5 (`Home · Units · Tenants · Rent · More`). The `Visitors` link is added to the **MoreSheet overflow** (between the existing `Maintenance` and `My Profile` rows).
- **Tenant sidebar**: insert `Visitors` between `Maintenance` and the divider — matches the UIUX Design Document §6 tenant-dashboard wireframe row.
- **Tenant mobile tabbar — slot trade-off**: per the UIUX Design Document §6 wireframe row for the Tenant Dashboard tabbar, the new 5-slot tabbar is `My Lease · Rent · Maintenance · Visitors · Profile` (no MoreSheet). The previous tenant tabbar's 5th `Logout` button is **removed** to make room. Logout remains reachable from (a) the sidebar / drawer footer's `Logout` link and (b) the `My Profile` page. See §2.7 Risks for the explicit trade-off note.
- **PM tabbar order**: existing PM tabbar already overflows via MoreSheet, so no slot trade-off needed.
- **No new sidebar SVG icons invented** — pick the existing user-with-arrow / `users` family already used in tenants.html (two-figure outline) and recolour via active state. The exact icon SVG selection is finalised at HTML-authoring time (next iteration).

### 2.3 PM page — zone-by-zone (`./../../../prototype/pm/visitors.html`)

Mirror the PM `./../../../prototype/pm/maintenance.html` chrome verbatim — sidebar block, topbar with `.drawer-toggle`, `app-main` padding, `tabbar` + `drawer-backdrop` + `more-sheet` at the bottom of `<body>`, `assets/validation.js` script include.

Zones (top to bottom on desktop, stack vertically below 1024):

| Zone | Content | Tokens / classes |
|---|---|---|
| Top bar | `.drawer-toggle` (mobile-only, visible ≤1023) + `<h1 class="page-title">Visitors</h1>` + `<div class="page-subtitle">Green Valley Apartments · 3 awaiting check-in</div>` (no right-side CTA — PM does not raise pre-approvals) | `.topbar`, `.page-title`, `.page-subtitle` |
| Alert row (conditional) | If any Pending pre-approval is older than 24 hours: inline `<div class="alert">⚠ <strong>3 pre-approvals awaiting decision</strong> — oldest: Rohan Mehta requested 24h ago</div>` | `.alert` (uses `--bg-partial`) |
| Filter chips | `All · Pending · Approved · Checked-in · Checked-out` — each chip is a `<button class="btn btn-secondary !py-2 !text-sm">`; the active chip uses `.btn-primary`. Chips visibly toggle which sections / rows are visible. | `.btn`, `.btn-primary`, `.btn-secondary` |
| Section 1 — Pending pre-approvals | `<h2 class="section-title">Pending pre-approvals</h2>` → vertical card list. Each `.card` shows: visitor name (Poppins 600 18px), phone, purpose, expected date (DD/MM/YYYY), expected time (HH:mm), requesting tenant + unit, status `<span class="badge badge-partial">Pending</span>`. Two actions on the card: `<button class="btn btn-primary !py-2 !text-sm">Approve</button>` and `<button class="btn btn-secondary !py-2 !text-sm">Deny</button>`. Approve and Deny each open a confirm `.modal-backdrop` `.modal` (max-width 480px) with a tight confirmation message + Cancel / Confirm buttons; on Confirm the card's badge flips and the card moves to Section 2 (Approved) or to a hidden Denied bucket. | `.card`, `.section-title`, `.label`, `.badge.badge-partial`, `.btn`, `.modal-backdrop`, `.modal` |
| Section 2 — Approved (awaiting arrival) | `<h2 class="section-title">Approved — awaiting arrival</h2>` → striped `.data-table` columns: Visitor · Phone · Purpose · Expected · Tenant / Unit · Status (`badge badge-prepaid` "Approved") · Action `<button class="btn btn-primary !py-2 !text-sm">Check-in</button>`. On click → confirm modal then row badge flips to `badge badge-progress` "Checked-in" and the row moves to Section 3 with an arrival timestamp. | `.section-title`, `.data-table`, `.badge.badge-prepaid`, `.badge.badge-progress`, `.btn.btn-primary` |
| Section 3 — Currently checked-in | `<h2 class="section-title">Currently checked-in</h2>` → `.data-table` columns: Visitor · Tenant / Unit · Arrived (DD/MM/YYYY HH:mm) · Status (`badge badge-progress` "Checked-in") · Action `<button class="btn btn-secondary !py-2 !text-sm">Check-out</button>`. On click → confirm modal then badge flips to `badge badge-resolved` "Checked-out" and row moves to Section 4 with a departure timestamp + duration. | `.section-title`, `.data-table`, `.badge.badge-progress`, `.btn.btn-secondary` |
| Section 4 — Recent check-outs (last 7 days) | `<h2 class="section-title">Recent check-outs</h2>` → `.data-table` columns: Visitor · Tenant / Unit · Arrived · Departed · Duration · Status (`badge badge-resolved` "Checked-out"). Read-only. | `.section-title`, `.data-table`, `.badge.badge-resolved` |
| Footer note | `<p class="text-xs muted mt-4">Closed visits cannot be reopened. If the visitor returns, ask the tenant to pre-approve again.</p>` | `.muted` |

Body bottom: `.tabbar` (PM 5-slot), `.drawer-backdrop`, `.more-sheet-backdrop`, `.more-sheet` with the new `Visitors` link, `<script src="../assets/validation.js"></script>`.

**Status badge mapping** (every class verified in `./../../../prototype/assets/styles.css`):

| State | Class | Source line in styles.css |
|---|---|---|
| Pending  | `badge badge-partial`    | line 65 |
| Approved | `badge badge-prepaid`    | line 67 |
| Denied   | `badge badge-terminated` | line 70 |
| Checked-in  | `badge badge-progress`   | line 72 |
| Checked-out | `badge badge-resolved`   | line 73 |

### 2.4 Tenant page — zone-by-zone (`./../../../prototype/tenant/visitors.html`)

Mirror the `./../../../prototype/tenant/maintenance.html` chrome verbatim — same sidebar block (with `Visitors` link active + the new `Visitors` sidebar row inserted), same topbar with `.drawer-toggle`, same `.app-main` padding, same `.tabbar` (but with the new 5-slot layout from §2.2), same `.drawer-backdrop`, same `assets/validation.js` include. No MoreSheet on the tenant page.

Zones:

| Zone | Content | Tokens / classes |
|---|---|---|
| Top bar | `.drawer-toggle` (mobile-only) + `<h1 class="page-title">My Visitors</h1>` + `<div class="page-subtitle">Unit 3A · Green Valley Apartments</div>` + `<button class="btn btn-primary !py-2 !text-sm">+ Pre-approve Visitor</button>` (opens modal) | `.topbar`, `.page-title`, `.page-subtitle`, `.btn.btn-primary` |
| Section 1 — Active pre-approvals | Card list. Each `.card` shows: status chip(s) at top (`badge badge-partial` Pending / `badge badge-prepaid` Approved / `badge badge-progress` Checked-in), `<h3>` visitor name, `<p class="text-sm muted">` phone · purpose · expected DD/MM/YYYY HH:mm, italic status sub-note ("Awaiting Property Manager approval." for Pending · "Approved on DD/MM/YYYY by Sunita Arora." for Approved · "Checked-in at DD/MM/YYYY HH:mm" for Checked-in). Read-only — tenant has no transition actions. | `.card`, `.badge.badge-partial`, `.badge.badge-prepaid`, `.badge.badge-progress`, `.muted` |
| Section 2 — Past visits | Striped card list of checked-out + denied visits. Each `.card` shows the visitor name + final status badge (`badge badge-resolved` Checked-out, `badge badge-terminated` Denied), arrived + departed timestamps (Checked-out), or "Denied on DD/MM/YYYY by Sunita Arora" (Denied). Duration shown for Checked-out only. | `.card`, `.badge.badge-resolved`, `.badge.badge-terminated`, `.muted` |
| Empty state (when no rows in either section) | Centered block inside a `.card`: small SVG icon (re-use the existing `users` SVG from tenants.html) + `<h3>No visitors pre-approved yet.</h3>` + `<p class="muted">Your Property Manager will see your pre-approvals immediately and approve / deny them before your visitor arrives.</p>` + primary CTA `+ Pre-approve Visitor`. | `.card`, `.muted`, `.btn.btn-primary` |
| Pre-approve modal | `.modal-backdrop` → `.modal` (`style="max-width:560px;"` to match the maintenance request modal). Header: `<h3>Pre-approve a Visitor</h3>` + `<p class="muted text-sm">Tell your Property Manager who's coming. They'll see this immediately.</p>`. Form fields (all required, label-above-input, error-below-input via `.field-error.show` from `assets/validation.js` — NO native HTML5 tooltips): **Visitor name** (`.input`, min 2 chars), **Phone** (`.input`, `inputmode="tel"`, `pattern="[6-9][0-9]{9}"`, helper "10-digit Indian mobile"), **Purpose** (`<select class="input">`: Personal · Delivery · Maintenance vendor · Other), **Expected date** (`<input type="date" class="input">`; helper "Visit date — DD/MM/YYYY"), **Expected time** (`<input type="time" class="input">`; helper "Arrival time — HH:mm IST"). Footer (right-aligned): `<button class="btn btn-secondary">Cancel</button>` + `<button class="btn btn-primary" disabled>Pre-approve</button>` (Submit disabled until all fields validate). | `.modal-backdrop`, `.modal`, `.input`, `.label`, `.field-error`, `.btn.btn-primary`, `.btn.btn-secondary` |

Body bottom: `.tabbar` (Tenant 5-slot: My Lease · Rent · Maintenance · Visitors · Profile — no Logout, no MoreSheet), `.drawer-backdrop`, `<script src="../assets/validation.js"></script>`.

### 2.5 Status state machine (single source of truth for both pages)

```
[Tenant submits pre-approval]  ──▶  Pending
Pending     ──(PM Approve)──▶     Approved
Pending     ──(PM Deny)────▶     Denied        (terminal)
Approved    ──(PM Check-in)──▶   Checked-in    (arrival timestamp captured)
Checked-in  ──(PM Check-out)─▶   Checked-out   (departure timestamp + duration captured; terminal)
```

- All non-terminal transitions are **PM-only**. Tenant has no transition actions — read-only after submission.
- No DELETE; expired Pending requests (>72h past expected date+time) become `badge badge-closed` "Expired" via a future server job (out of scope for this prototype iteration — recorded as a backend follow-up item).
- Concurrent transitions assumed single-PM in the prototype (server enforces optimistic-lock on row state in the real implementation).

### 2.6 Design tokens — every value sourced from `./../../../prototype/assets/styles.css`

**No new tokens introduced.** Each row below maps a visual element to a token / class that already exists in `./../../../prototype/assets/styles.css`.

| Element | Token / class | styles.css line |
|---|---|---|
| Sidebar background | `--color-navy` (`#1A237E`) | 6 |
| Sidebar active link border | `--color-saffron` (`#FF6F00`) via `.sidebar-link.active` | 217 |
| Page title | `.page-title` (color `--color-navy`, Poppins 700, 32px) | 494 |
| Section heading | `.section-title` (color `--color-royal-blue`, Poppins 600, 18px, uppercase) | 499 |
| Card | `.card` (white, 1px `--color-mid-gray` border, radius 8px, shadow `0 2px 8px rgba(0,0,0,0.04)`) | 111 |
| Table | `.data-table` (white bg, `--color-light-gray` thead) | 449 |
| Pending badge | `.badge.badge-partial` (`--color-status-partial` `#F57F17` on `--bg-partial` `#FFF8E1`) | 65 |
| Approved badge | `.badge.badge-prepaid` (`--color-status-prepaid` `#0277BD` on `--bg-prepaid` `#E3F2FD`) | 67 |
| Denied badge | `.badge.badge-terminated` (`--color-status-overdue` `#C62828` on `--bg-overdue` `#FFEBEE`) | 70 |
| Checked-in badge | `.badge.badge-progress` (`--color-status-prepaid` `#0277BD` on `--bg-prepaid` `#E3F2FD`) | 72 |
| Checked-out badge | `.badge.badge-resolved` (`--color-status-paid` `#2E7D32` on `--bg-paid` `#E8F5E9`) | 73 |
| Expired badge (future) | `.badge.badge-closed` (`--color-slate` on `--bg-closed` `#ECEFF1`) | 74 |
| Primary CTA (Approve / Check-in / + Pre-approve / Submit) | `.btn.btn-primary` (`--color-saffron` `#FF6F00` bg, white fg) | 93 |
| Secondary CTA (Deny / Check-out / Cancel / filter chips) | `.btn.btn-secondary` (transparent bg, `--color-royal-blue` outline) | 95 |
| Alert (>24h pending) | `.alert` (`--bg-partial` bg, 4px `--color-status-partial` left border) | 461 |
| Input | `.input` (white bg, 1px `--color-mid-gray` border, 6px radius, min-height 44px) | 123 |
| Input on error | `.input.error` (2px `--color-status-overdue` border, `--bg-overdue` bg) | 139 |
| Field error | `.field-error.show` (`--color-status-overdue` text, ⚠ glyph) | 142 |
| Label | `.label` (Poppins 500 13px, uppercase, `--color-slate`) | 161 |
| Modal | `.modal-backdrop` + `.modal` (white card, 12px radius, 32px padding, max-width 480px or 560px override) | 471 / 479 |
| Tabbar (mobile) | `.tabbar` + `.tab` (white bg, 1px `--color-mid-gray` top border, active `--color-saffron`) | 296 / 302 |
| MoreSheet (PM only) | `.more-sheet` + `.more-sheet-link` (white card, slides up, saffron-active link) | 380 / 409 |
| Spacing — section gap | `--space-lg` (32px) between sections, `--space-md` (24px) inside cards | 32 / 31 |
| Focus ring | global `*:focus-visible` (2px saffron outline + 2px offset) | 490 |
| Page lang attribute | `<html lang="en-IN">` (already in every prototype page) | n/a (HTML) |
| Touch target floor | `.input` min-height 44px · `.btn` line-height satisfies 44px on mobile | 124 / 87-89 |

### 2.7 Risks / open questions

Each item has a proposed default; user is asked to confirm during sign-off (§4).

1. **Tenant tabbar Logout slot removed** — the new 5-slot tenant tabbar (`My Lease · Rent · Maintenance · Visitors · Profile`) drops the `Logout` tab. **Proposed default — proceed**: Logout remains reachable via the sidebar / drawer footer (`<a class="text-saffron font-poppins" href="../login.html">Logout</a>`) and via the `My Profile` page. The UIUX Design Document §6 already records this layout.
2. **Phone format** — **Proposed default**: 10-digit Indian mobile only, no `+91` prefix in the input (`pattern="[6-9][0-9]{9}"`, `inputmode="tel"`). Helper text: "10-digit Indian mobile, starting 6-9."
3. **Past-date / past-time guard** — **Proposed default**: expected date must be ≥ today; if today, expected time must be ≥ now + 15min. Server enforces in the real implementation; prototype just renders the helper hint and a `.field-error.show` inline message via `assets/validation.js`.
4. **Multi-visitor pre-approval (single request, multiple visitors)** — **Proposed default**: out of scope for v8 prototype; one visitor per request. Future work captures an "Add another" pattern below the form fields.
5. **Notifications to tenant on approve / deny** — **Out of scope** per CLAUDE.md Scope rule K (no SMS, no WhatsApp, no email). In-app status update only — the tenant sees the updated badge next time they open the page.
6. **Concurrent approve race (two PMs in this org act on the same Pending row)** — flagged as a backend concern; prototype assumes single-PM action. Real implementation uses an optimistic-lock on the row state (server returns 409 if the state has moved).
7. **Visitor identity proof (photo / ID upload)** — **Out of scope** per CLAUDE.md Scope rule K (no file uploads). If demanded later, opens a separate planning file.
8. **Visitor self-check-in (QR code on arrival)** — **Out of scope** for v8; tabled. PM remains the sole actor for arrival / departure timestamps.

### 2.8 Files this feature will touch on ship

| Path | Why |
|---|---|
| `./../../../prototype/pm/visitors.html`           | new page |
| `./../../../prototype/tenant/visitors.html`       | new page |
| `./../../../prototype/pm/dashboard.html`          | sidebar nav block — add `Visitors` link |
| `./../../../prototype/pm/units.html`              | sidebar nav block — add `Visitors` link |
| `./../../../prototype/pm/tenants.html`            | sidebar nav block — add `Visitors` link |
| `./../../../prototype/pm/tenant-detail.html`      | sidebar nav block — add `Visitors` link |
| `./../../../prototype/pm/leases.html`             | sidebar nav block + MoreSheet — add `Visitors` link |
| `./../../../prototype/pm/lease-detail.html`       | sidebar nav block + MoreSheet — add `Visitors` link |
| `./../../../prototype/pm/rent-collection.html`    | sidebar nav block + MoreSheet — add `Visitors` link |
| `./../../../prototype/pm/maintenance.html`        | sidebar nav block + MoreSheet — add `Visitors` link |
| `./../../../prototype/pm/profile.html`            | sidebar nav block + MoreSheet — add `Visitors` link |
| `./../../../prototype/tenant/dashboard.html`      | sidebar nav block + tabbar 5-slot rewrite (Logout slot dropped) |
| `./../../../prototype/tenant/rent.html`           | sidebar nav block + tabbar 5-slot rewrite |
| `./../../../prototype/tenant/maintenance.html`    | sidebar nav block + tabbar 5-slot rewrite |
| `./../../../prototype/tenant/profile.html`        | sidebar nav block + tabbar 5-slot rewrite |
| `./../prototype-changes.md`                       | new row recording the Visitor Management addition |

`docs/testing/v1/Test_Cases.md` rows are promoted from §3 of this file at ship time. No SRS edits in this iteration (v8 SAAS integration pass adds the row).

## 3. Test cases (designed up front)

Same shape as `./../../testing/v1/Test_Cases.md`. Two namespaces: `TC-VISIT-PM-NNN` and `TC-VISIT-TENANT-NNN` (3-digit zero-padded).

### 3.1 PM page — `TC-VISIT-PM-001..018`

| TC-ID            | Title | Pre-condition | Steps | Expected Result | Priority |
|------------------|-------|---------------|-------|-----------------|----------|
| TC-VISIT-PM-001  | Sidebar Visitors link active on visitors page | PM signed in; viewing `prototype/pm/visitors.html` at ≥1024px | 1. Open the page in a 1440px viewport | The `Visitors` sidebar link has `.sidebar-link.active` styling (saffron 4px left border + saffron icon); no other sidebar link is active | H |
| TC-VISIT-PM-002  | All four section headings render | PM on visitors page | 1. Scan the page top-to-bottom | Four `.section-title` headings present in order: "Pending pre-approvals", "Approved — awaiting arrival", "Currently checked-in", "Recent check-outs" | H |
| TC-VISIT-PM-003  | Filter chip switches visible set | PM on visitors page; chips visible | 1. Click `Pending` chip 2. Observe sections | Only the Pending pre-approvals section remains visible; other sections are hidden; the `Pending` chip uses `.btn-primary`, others `.btn-secondary` | H |
| TC-VISIT-PM-004  | Approve flips Pending → Approved | PM on visitors page; at least one Pending card exists | 1. Click `Approve` on a Pending card 2. Confirm in the modal | The confirm modal opens, the card disappears from Section 1, a new row appears in Section 2 with `badge badge-prepaid` "Approved" and the same visitor details | H |
| TC-VISIT-PM-005  | Deny flips Pending → Denied | PM on visitors page; at least one Pending card exists | 1. Click `Deny` 2. Confirm in the modal | The card disappears from Section 1; no new row in Section 2 / 3; the row appears in the past-visits hidden bucket with `badge badge-terminated` "Denied" (visible to tenant in their Section 2) | H |
| TC-VISIT-PM-006  | Check-in flips Approved → Checked-in with timestamp | PM on visitors page; at least one Approved row | 1. Click `Check-in` 2. Confirm in the modal | Row moves from Section 2 to Section 3 with `badge badge-progress` "Checked-in"; the Arrived column shows current IST timestamp in `DD/MM/YYYY HH:mm` (24-hour) | H |
| TC-VISIT-PM-007  | Check-out flips Checked-in → Checked-out with timestamp + duration | PM on visitors page; at least one Checked-in row | 1. Click `Check-out` 2. Confirm in the modal | Row moves from Section 3 to Section 4 with `badge badge-resolved` "Checked-out"; Departed column shows current IST timestamp; Duration column shows elapsed time (e.g. "2h 14m") | H |
| TC-VISIT-PM-008  | Confirm-modal Cancel keeps state | PM on visitors page; viewing Pending card | 1. Click `Approve` 2. Click `Cancel` in the modal | Modal closes; the card remains in Section 1 with `badge badge-partial` "Pending"; no row appears in Section 2 | M |
| TC-VISIT-PM-009  | Alert banner shown when Pending older than 24h | Seed data has at least one Pending row older than 24h | 1. Load the page | `.alert` row visible above the chips with text including the count and oldest tenant name | M |
| TC-VISIT-PM-010  | Mobile tabbar has 5 slots; Visitors is in the MoreSheet | PM on visitors page in ≤1023px viewport | 1. Resize viewport to 375px 2. Tap `More` | Tabbar shows 5 slots: Home · Units · Tenants · Rent · More. The MoreSheet opens and contains Leases, Maintenance, **Visitors**, My Profile, Logout in that order | H |
| TC-VISIT-PM-011  | Mobile sidebar drawer toggle works | PM on visitors page in ≤1023px viewport | 1. Tap the `.drawer-toggle` (top-left) | Sidebar slides in from the left over a `.drawer-backdrop`; Visitors link inside the drawer is active | M |
| TC-VISIT-PM-012  | Keyboard — Tab order traverses chips → cards → actions | PM on visitors page; keyboard focus on body | 1. Press Tab repeatedly | Focus visits: drawer-toggle (mobile) → filter chips left-to-right → Section 1 cards' Approve then Deny buttons → Section 2 Check-in buttons → Section 3 Check-out buttons. Each focused element shows the saffron focus ring | M |
| TC-VISIT-PM-013  | Keyboard — Escape closes confirm modal | PM has clicked Approve and the confirm modal is open | 1. Press Escape | Modal closes; focus returns to the originating Approve button; no state change | M |
| TC-VISIT-PM-014  | Accessibility — axe clean | PM on visitors page | 1. Run axe-core against the rendered page | Zero serious or critical violations; status badges co-render the text label (not colour-only) | M |
| TC-VISIT-PM-015  | Responsive at 5 widths | PM on visitors page | 1. Snapshot the page at 320 / 375 / 768 / 1024 / 1440 px | No horizontal scroll at any width; ≤1023px shows tabbar + drawer-toggle and hides the sidebar; ≥1024px shows the sidebar and hides the tabbar; touch targets ≥44×44px on mobile | M |
| TC-VISIT-PM-016  | Locale — DD/MM/YYYY + HH:mm IST | PM on visitors page | 1. Read every date / time on the page | Every date renders as `DD/MM/YYYY`; every time renders as `HH:mm` 24-hour IST; no ISO strings or 12-hour AM/PM displayed | H |
| TC-VISIT-PM-017  | Page lang attribute is en-IN | PM on visitors page | 1. View page source | `<html lang="en-IN">` | L |
| TC-VISIT-PM-018  | Role-scope (notional) — Tenant cannot reach this URL | Production scope only — note here, no prototype enforcement | 1. Tenant signs in, attempts to navigate to `/:org/visitors` under the PM route | Production server returns 403 per the BL-22 role-scope rule; prototype cannot enforce, but the planning file records the requirement | L |

### 3.2 Tenant page — `TC-VISIT-TENANT-001..017`

| TC-ID                | Title | Pre-condition | Steps | Expected Result | Priority |
|----------------------|-------|---------------|-------|-----------------|----------|
| TC-VISIT-TENANT-001  | Sidebar Visitors link active | Tenant signed in; viewing `prototype/tenant/visitors.html` at ≥1024px | 1. Open the page | The `Visitors` sidebar link has `.sidebar-link.active` styling; no other sidebar link is active | H |
| TC-VISIT-TENANT-002  | `+ Pre-approve Visitor` opens the modal | Tenant on visitors page | 1. Click the `+ Pre-approve Visitor` button in the topbar | `.modal-backdrop` gets `.open`; the modal is visible with all 5 form fields | H |
| TC-VISIT-TENANT-003  | All 5 fields render with correct labels + visual contract | Tenant has the modal open | 1. Inspect each field | Each field has a `.label` above, `.input` below, and an empty `.field-error` slot below the input. No browser-native tooltip / `:invalid` outline visible | H |
| TC-VISIT-TENANT-004  | Submit with empty Name shows inline error | Tenant has the modal open with Name blank | 1. Click `Pre-approve` | The Submit button stays disabled (form invalid); when the user blurs the Name input empty, the `.field-error` slot below Name gets `.show` with text "Visitor name is required" and the ⚠ glyph; the `.input` gets `.input.error` (red border + light-red bg) | H |
| TC-VISIT-TENANT-005  | Phone field rejects non-numeric | Tenant has the modal open | 1. Type `abc123` into Phone | The input strips letters (or shows the inline error "10-digit Indian mobile, starting 6-9"); only the digits `123` remain in the field | H |
| TC-VISIT-TENANT-006  | Phone accepts a valid 10-digit Indian mobile | Tenant has the modal open | 1. Type `9876543210` into Phone | The input accepts the value, no error rendered, no `.input.error` class | H |
| TC-VISIT-TENANT-007  | Expected date in the past is rejected | Tenant has the modal open | 1. Set Expected date to a date before today | `.field-error.show` below Expected date with text "Visit date must be today or later"; submit button stays disabled | H |
| TC-VISIT-TENANT-008  | Expected time required | Tenant has the modal open with all other fields valid but Expected time blank | 1. Click `Pre-approve` | Submit button stays disabled (form invalid); blurring the time field shows `.field-error.show` "Arrival time is required" | H |
| TC-VISIT-TENANT-009  | Successful submit closes modal + adds Pending card | Tenant has all 5 fields filled validly | 1. Click `Pre-approve` | Modal closes; a new `.card` appears at the top of Section 1 "Active pre-approvals" with `badge badge-partial` "Pending", the visitor name, phone, purpose, expected DD/MM/YYYY HH:mm, and italic muted sub-note "Awaiting Property Manager approval." | H |
| TC-VISIT-TENANT-010  | Seed rows demonstrate Pending → Approved → Checked-in over the static prototype | Tenant on visitors page; seed data carries three rows in three different states | 1. Scan Section 1 | Three distinct cards visible: one `badge badge-partial` Pending, one `badge badge-prepaid` Approved (sub-note "Approved on DD/MM/YYYY by Sunita Arora."), one `badge badge-progress` Checked-in (sub-note "Checked-in at DD/MM/YYYY HH:mm") | M |
| TC-VISIT-TENANT-011  | Past visits show Checked-out + Denied entries | Tenant on visitors page; seed data has at least one Checked-out and one Denied | 1. Scroll to Section 2 "Past visits" | Striped card list. Checked-out card shows `badge badge-resolved` plus arrived / departed / duration; Denied card shows `badge badge-terminated` plus "Denied on DD/MM/YYYY by Sunita Arora" | M |
| TC-VISIT-TENANT-012  | Mobile tabbar has the new 5-slot layout (no Logout) | Tenant on visitors page in 375px viewport | 1. Inspect the bottom `.tabbar` | Tabs in order: My Lease · Rent · Maintenance · Visitors · Profile. Visitors tab uses `.tab.active`. No Logout button in the tabbar. No MoreSheet trigger. | H |
| TC-VISIT-TENANT-013  | Logout still reachable from sidebar / drawer footer | Tenant on visitors page in 375px viewport | 1. Tap `.drawer-toggle` 2. Locate Logout | Sidebar drawer opens; the footer shows `Tenant · <name>` + a saffron `Logout` link that routes to `../login.html` | M |
| TC-VISIT-TENANT-014  | Keyboard navigation through the modal | Tenant has the modal open; focus on body | 1. Press Tab repeatedly | Focus visits: Name → Phone → Purpose → Expected date → Expected time → Cancel → Pre-approve. Each focused element has the saffron focus ring. Escape closes the modal | M |
| TC-VISIT-TENANT-015  | Accessibility — axe clean; error messages announced | Tenant on visitors page; an inline error is showing on Name | 1. Run axe-core 2. Inspect the `.field-error` element | Zero serious or critical violations; the error element is referenced from the input via `aria-describedby` (or wrapped in `aria-live="polite"`) so screen readers announce the message on blur | M |
| TC-VISIT-TENANT-016  | Responsive at 5 widths — modal stays centered | Tenant on visitors page; modal opened | 1. Snapshot the page + open modal at 320 / 375 / 768 / 1024 / 1440 px | At ≤767px the modal is full-width minus 16px gutter; at ≥768px it caps at 560px and is centered horizontally + vertically. No horizontal scroll at any width | M |
| TC-VISIT-TENANT-017  | Locale — DD/MM/YYYY + HH:mm IST + en-IN | Tenant on visitors page | 1. Read every date / time + view page source | Every rendered date is `DD/MM/YYYY`, every time is `HH:mm` 24-hour IST. `<html lang="en-IN">` | H |

Total: **18 PM cases + 17 Tenant cases = 35 cases designed**. On ship these promote verbatim into `./../../testing/v1/Test_Cases.md` under a new "Visitor Management" module.

## 4. Sign-off

| Date | Question | Proposed default | User answer |
|------|----------|------------------|-------------|
| 2026-05-26 | Tenant tabbar Logout slot trade-off — drop Logout tab to make room for Visitors? | Proceed (UIUX Design Document §6 records this) | — pending — |
| 2026-05-26 | Phone format — 10-digit Indian mobile, no `+91` prefix? | Yes (`pattern="[6-9][0-9]{9}"`) | — pending — |
| 2026-05-26 | Past-date / past-time guard — date ≥ today, time ≥ now+15min if today? | Yes (server enforces; prototype renders hint) | — pending — |
| 2026-05-26 | Multi-visitor pre-approval — defer to future work? | Yes (one visitor per request in v8) | — pending — |

File created by `gharsetu-lead`. Awaiting user review of §2.7 open questions (4 defaults proposed) before dispatching `gharsetu-frontend` to author the two prototype HTML files.

## 5. Execution log

| Date | Event |
|------|-------|
| 2026-05-26 | Planning file created; status `proposed`. Next: user sign-off on §2.7 defaults, then dispatch `gharsetu-frontend` to author `prototype/pm/visitors.html` and `prototype/tenant/visitors.html`, plus the sidebar / tabbar updates listed in §2.8. |
| 2026-05-26 | `gharsetu-frontend` implemented: `prototype/pm/visitors.html` (29 KB) + `prototype/tenant/visitors.html` (19 KB) authored; Visitors entry added to sidebar + tabbar across all PM pages and tenant pages (`dashboard`, `rent`, `maintenance`, `profile`). Status remains `proposed` pending §2.7 sign-off. |

## 6. Files changed

| File | Change | Touched by |
|------|--------|------------|
| `./../../../prototype/pm/visitors.html`           | new page (pending — on ship) | gharsetu-frontend |
| `./../../../prototype/tenant/visitors.html`       | new page (pending — on ship) | gharsetu-frontend |
| `./../../../prototype/pm/*.html`                  | sidebar + MoreSheet — add `Visitors` link (pending — on ship) | gharsetu-frontend |
| `./../../../prototype/tenant/*.html`              | sidebar + tabbar 5-slot rewrite — add `Visitors`, drop Logout tab (pending — on ship) | gharsetu-frontend |
| `./../prototype-changes.md`                       | new row recording the Visitor Management addition (pending — on ship) | gharsetu-frontend |
| `./../../testing/v1/Test_Cases.md`                | promote §3 rows under new "Visitor Management" module (pending — on ship) | gharsetu-tester |

## 7. Agents used

| Agent | Task | Status |
|-------|------|--------|
| gharsetu-lead     | Initial planning + delegation brief                         | accepted |
| gharsetu-frontend | Prototype HTML authoring (PM + Tenant pages + nav rollout)  | — pending — |
| gharsetu-tester   | TC-VISIT-PM-001..018 + TC-VISIT-TENANT-001..017 execution   | — pending — |

## 8. Post-deploy

No issues yet — feature is at `proposed` status. This section stays open indefinitely once shipped; new issues append as dated entries.

## 9. Cross-references

- SRS — n/a (v8 SAAS feature row added on integration pass)
- TEST_CASES — TC-VISIT-PM-001..018, TC-VISIT-TENANT-001..017 (promoted from §3 on ship)
- `./../prototype-changes.md` — row to be added on ship
- `product/CHANGELOG` — bullet on ship
- Solution Overview v8 → Visitor Management section (lines 365-369 of `./../../../doc-assets/templates/generate_solution_overview.js`)
- UIUX Design Document → §4 IA row "Visitors" (line 292), §6 Tenant Dashboard wireframe sidebar + tabbar (lines 378-379 of `./../../../doc-assets/templates/generate_design_document.js`)
