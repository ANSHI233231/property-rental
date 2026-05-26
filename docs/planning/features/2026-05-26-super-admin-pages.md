# Super Admin — five prototype pages (Dashboard · Organizations · Organization Detail · Plans · Profile)

| Field | Value |
|---|---|
| Status         | proposed |
| Started        | 2026-05-26 |
| Shipped        | — |
| SRS row        | (prototype-only — SRS rows added when backend ships under ENG-F06 SAAS + ENG-F07 Super Admin) |
| Test cases     | TC-SADMIN-DASH-001..025 · TC-SADMIN-ORG-001..030 · TC-SADMIN-ORGDETAIL-001..045 · TC-SADMIN-PLANS-001..030 · TC-SADMIN-PROF-001..018 (designed up front in §3) |
| Prototype todo | row to be added to `docs/planning/prototype-changes.md` on ship (one row covering all five files) |

## 1. Requirement (as given)

> "Plan all 5 Super Admin prototype pages in a single planning file. Today is 2026-05-26.
>
> Pages: `prototype/super-admin/dashboard.html`, `organizations.html`, `organization-detail.html`, `plans.html`, `profile.html` — all platform-scoped, no `/:org/` prefix. Sidebar = Dashboard · Organizations · Plans · Profile (4 items, no MoreSheet). One coherent feature, one planning file at `docs/planning/features/2026-05-26-super-admin-pages.md` with all 9 sections per FEATURE_PLANNING template. Test cases namespaced per page. American English. No invented tokens — verify against `prototype/assets/styles.css`."

Backed by `Solution_Overview.docx` v8 §New Roles (Super Admin) + §New Features (Organization Management / SAAS layer) + §Details / Subscription Plans matrix, and `UIUX_Design_Document.docx` §4 Information Architecture / Platform pages table (lines 269–276 of `doc-assets/templates/generate_design_document.js`). NR-5 / NR-6 / NR-7 from Solution Overview §Business Rules anchor the scope rules these pages must reflect.

## 2. Plan

### 2.0 Cross-cutting structure for all 5 pages

#### 2.0.1 Routing class — Platform

All five pages live in `prototype/super-admin/` as a sibling of `prototype/admin/`. Per UIUX Design Document §4 they are **Platform** pages — no `:org` slug, Super Admin role only. The prototype's folder-per-role layout is a design-time convenience; the live Next.js app collapses this into the `/dashboard`, `/organizations`, `/organizations/:id`, `/plans`, `/profile` Platform paths (UIUX §4 lines 269–276). All cross-links between the five files use relative hrefs (e.g. `organizations.html`, `organization-detail.html?id=42`) and the brand mark links back to `../index.html` (matches `prototype/admin/dashboard.html` line 17).

#### 2.0.2 Sidebar (≥ 1024 px) — 4 items, identical on all 5 pages

Per the user requirement and UIUX Design Document §4 Platform pages table — only Dashboard, Organizations, Plans, Profile. The Super Admin does **not** need an Audit Log sidebar entry in v8 scope (the UIUX doc lists `/audit-log` as a Platform page but the user requirement explicitly caps the sidebar at 4 items — defer Audit Log to a follow-up). All five pages render the same `.sidebar` block; only the `.sidebar-link.active` row changes.

| Order | Label | Href | Icon (matches existing prototype convention) |
|---|---|---|---|
| 1 | Dashboard | `dashboard.html` | Home arrow — same SVG as `prototype/admin/dashboard.html` line 20 |
| 2 | Organizations | `organizations.html` | Building / city — same SVG as `prototype/admin/properties.html` line 20 (rect + window lines) |
| — | (divider — `.sidebar-divider`) | — | — |
| 3 | Plans | `plans.html` | Tag / pricing — new icon: outlined tag, 2 px stroke, same `viewBox="0 0 24 24"` family as the other sidebar icons (no new color token, uses inherited `currentColor`) |
| — | (divider — `.sidebar-divider`) | — | — |
| 4 | My Profile | `profile.html` | Person — same SVG as `prototype/admin/dashboard.html` line 28 |

Sidebar footer: `Super Admin · <Name>` on top line, saffron `Logout` link to `../login.html` on second line. **Distinct from Admin** — the role label reads "Super Admin", not "Admin".

#### 2.0.3 Tab bar (≤ 1023 px) — 4 items, no MoreSheet

Same 4 items, in the same order, as the sidebar. Per UIUX Design Document §3 / Bottom Tab Bar Spec (`generate_design_document.js` lines 222–230): "Max 5; equal width. If a role has more than 4 contextual items, item 5 is 'More'." Super Admin has exactly 4 — **no MoreSheet, no `.tab-more` button, no `.more-sheet` markup** (matches the Tenant + Maintenance precedent in UIUX §6 Wireframes: "5 items, no MoreSheet" / "3 items, no MoreSheet"). Also drop the `.more-sheet-backdrop` and `.more-sheet` divs from the body — they exist on every Admin and PM file but Super Admin must not carry that dead markup.

| Slot | Label | Href | Active when |
|---|---|---|---|
| 1 | Home | `dashboard.html` | on dashboard.html |
| 2 | Orgs | `organizations.html` | on organizations.html OR organization-detail.html |
| 3 | Plans | `plans.html` | on plans.html |
| 4 | Profile | `profile.html` | on profile.html |

Drawer (slide-in sidebar on mobile) still works the same — `.drawer-toggle` button in the topbar, `.drawer-backdrop`, `.drawer-close` X button inside the sidebar. Same JS (`openDrawer()` / `closeDrawer()`) inline; same `validation.js` include.

#### 2.0.4 Topbar — identical chrome on all 5 pages

`.topbar` element with: drawer toggle (left, mobile-only), `.page-title` + `.page-subtitle` (center-ish), and `.topbar-user` block on the right containing `.notif-bell` + role/name label (`hidden md:inline`) + `.avatar` linking to `profile.html`. Same pattern as `prototype/admin/profile.html` lines 33–47. Notification dot is decorative on the prototype (no live data).

#### 2.0.5 Design tokens — exhaustive verification against `prototype/assets/styles.css`

Every value used across all five pages must come from the existing tokens. **No invented colors, radii, shadows, fonts, or spacings.**

| Use | Token / class | CSS source (verified in styles.css) |
|---|---|---|
| Page background | `body { background: var(--color-off-white) }` | line 39 (`#F8F9FA`) |
| App shell, sidebar (240 px navy), main (margin-left 240 px / 32 px / 48 px padding) | `.app-shell`, `.sidebar`, `.app-main` | lines 173–240 |
| Sidebar active row left border | `.sidebar-link.active { border-left: 4px solid var(--color-saffron) }` | line 217 |
| Sidebar role label color | `.sidebar-footer { color: rgba(255,255,255,0.6) }` | line 235 |
| Topbar avatar | `.avatar` 38 × 38 royal-blue circle | lines 249–257 |
| Notification bell | `.notif-bell` + `.notif-dot` (saffron 8 × 8 dot, 2 px white border) | lines 258–274 |
| Page title (h1) | `.page-title` Poppins 700 32 px navy (24 px on mobile) | lines 494–496 |
| Section title | `.section-title` royal-blue Poppins 600 18 px UPPERCASE | line 499 |
| KPI grid | `.kpi-grid` (auto-fit minmax 180 px) | line 439 |
| KPI card | `.kpi` white card · mid-gray border · 8 px radius · `0 2px 8px rgba(0,0,0,0.04)` · 20 px padding | lines 440–446 |
| KPI label / value / meta | `.kpi-label` (slate 12 px UPPERCASE) · `.kpi-value` (Poppins 700 32 px navy) · `.kpi-meta` (slate 12 px) | lines 444–446 |
| Card (containers around tables, lists, donut) | `.card` white · 1 px mid-gray · 8 px radius · `0 2px 8px rgba(0,0,0,0.04)` | lines 111–119 |
| Data table | `.data-table` (header row `.light-gray` bg, hover `rgba(21,101,192,0.03)`, 14/16 cell padding) | lines 449–459 |
| Status badges (Active / Pending / Deactivated etc.) | `.badge .badge-active` (paid green) · `.badge .badge-partial` (saffron — repurposed for Pending) · `.badge .badge-closed` (slate — for Deactivated / Retired) | lines 64–75 |
| Primary CTA (Approve, Save) | `.btn .btn-primary` (saffron `#FF6F00`) | lines 93–94 |
| Secondary CTA (View, Export, Cancel) | `.btn .btn-secondary` (royal-blue 2 px outline) | line 95 |
| Danger CTA (Deactivate Organization) | `.btn .btn-danger` (overdue red `#C62828`) | lines 97–98 |
| Form inputs | `.input` (44 px min-height, 6 px radius, mid-gray border; royal-blue focus; overdue error) | lines 123–139 |
| Field validation error | `.field-error.show` (red 13 px Inter, `⚠` prefix) | lines 142–160 |
| Modal | `.modal-backdrop` + `.modal` (12 px radius, max-width 480 px, `0 12px 40px rgba(0,0,0,0.2)`) | lines 471–483 |
| Drawer (toggle, backdrop, close) | `.drawer-toggle`, `.drawer-backdrop`, `.drawer-close` | lines 326–369 |
| Profile cards (used on profile.html + on organization-detail.html for org info card) | `.profile-card`, `.profile-row`, `.profile-grid` | lines 277–294 |
| Focus ring (everywhere) | `*:focus-visible { outline: 2 px solid var(--color-saffron); offset 2 px }` | line 490 |
| Alert (used on dashboard for pending sign-ups warning) | `.alert` (saffron warning) | lines 461–467 |
| Profile role pill | `.profile-role` (royal-blue prepaid pill) — **override copy to "Super Admin"** but reuse the existing pill style | line 293 |

**Notes on token reuse / no invention:**

- "Pending" status for organizations and sign-ups uses `.badge-partial` (saffron bg `#FFF8E1`, fg `#F57F17`) — same pill we use for partial-payment in v1. **Does not invent a new badge variant.**
- "Active" organizations use `.badge-active` (paid green, `#E8F5E9` / `#2E7D32`).
- "Deactivated" organizations use `.badge-closed` (slate, `#ECEFF1` / `#546E7A`).
- "Plan: Basic / Standard / Premium" rendered as plain text inside table cells — not as colored pills (UIUX rule: badges are reserved for state, not for plan tier). **Does not invent plan-color tokens.**
- The donut chart for "Plan distribution" on the dashboard uses inline SVG arcs filled with `var(--color-navy)`, `var(--color-royal-blue)`, `var(--color-saffron)` for Basic / Standard / Premium respectively. **No new colors** — these three are already the brand triplet (styles.css lines 5–7).

#### 2.0.6 Responsive transformation — single 1024 px breakpoint

Per UIUX Design Document §3 (single split at 1024 px). The CSS already takes care of: sidebar collapse to drawer (line 311), `.app-main` margin removal + tabbar visibility (lines 321–323), `.kpi-grid` auto-fits (`minmax(180px, 1fr)` collapses naturally), `.data-table` allows horizontal scroll via parent `overflow-x-auto`. No per-page mobile CSS needed beyond what already exists.

| Viewport | All 5 pages |
|---|---|
| 320 px | Sidebar collapsed → drawer (open via `.drawer-toggle`). Tabbar at bottom (4 items, equal width). KPIs stack 1-col. Tables scroll horizontally inside `.card.overflow-x-auto`. `.page-title` shrinks to 24 px (line 496). Tap targets ≥ 44 px (input min-height + button mobile padding from line 103). |
| 360 px (common Android) | Same as 320; slight breathing room. |
| 768 px (tablet portrait) | Still mobile layout (`max-width: 1023px` rule triggers). Card-content has more horizontal room — KPIs go 2-col naturally via `auto-fit`. |
| 1024 px | Sidebar fixed at 240 px navy. `.app-main` margin-left 240 px, padding 32/48 px. KPIs 4-col on dashboard. Tabbar hidden. |
| 1440 px | Same as 1024 — `.app-main` capped at `max-width: 1440px` (line 240). Sidebar still 240 px navy. |

#### 2.0.7 Accessibility (UIUX Design Document §9)

Applies uniformly:

- Every page has `<html lang="en-IN">` and explicit landmarks: `<aside class="sidebar">`, `<header class="topbar">`, `<main class="app-main">`, `<nav class="tabbar">`.
- All interactive controls keyboard-reachable via Tab in source order. Focus ring 2 px saffron (line 490) never removed.
- Drawer toggle and drawer-close button carry `aria-label`; tabbar has `aria-label="Super Admin navigation (mobile)"`.
- Status badges include `aria-label` spelling out the state (e.g. `aria-label="Status: Pending"`).
- Confirm-destructive modals (deactivate org, change plan) make Cancel the default focus target.
- Tables use proper `<thead>` / `<tbody>` and the column header texts are sentence case + role-of-data; numerics are right-aligned via inline Tailwind `text-right`.
- Form labels use the existing `.label` class which is real `<label for>` markup, not placeholder-as-label.
- DD/MM/YYYY for all dates (BL-23). ₹ Indian digit grouping for all amounts (BL-23). Times in IST (BL-22).

---

### 2.1 `prototype/super-admin/dashboard.html` — Platform overview

#### 2.1.1 Intent

The Super Admin's home. Cross-organization KPIs across the platform — organizations active, pending sign-ups, plan distribution, total active users. Pending sign-ups get a prominent saffron alert with a direct CTA into `organizations.html?filter=pending`. No org-scoped data anywhere on this page (NR-5).

#### 2.1.2 Zone-by-zone layout (top to bottom)

| Zone | Content | Components / classes |
|---|---|---|
| Z1. Sidebar | The 4-item sidebar from §2.0.2 with Dashboard active | `.sidebar` + `.sidebar-link.active` on Dashboard |
| Z2. Topbar | Drawer toggle (mobile) · `.page-title` "Platform Dashboard" + `.page-subtitle` "All organizations · 26/05/2026" · `.topbar-user` with `.notif-bell` (with saffron `.notif-dot`) + "Super Admin · Aayush Kumar" + `.avatar` initials "AK" linking to profile | `.topbar`, `.page-title`, `.notif-bell`, `.avatar` |
| Z3. KPI strip | 4 `.kpi` cards in `.kpi-grid`: (1) **Organizations** value 12 · meta "10 active · 2 deactivated"; (2) **Pending Sign-ups** value 3 · meta "Oldest: 5 days waiting" — saffron value color via inline `style="color: var(--color-status-partial)"` when count > 0; (3) **Total Active Users** value 187 · meta "Across all orgs"; (4) **Plan Coverage** value "87 %" · meta "Active-user caps utilization" (sum of active users ÷ sum of caps; "Unlimited" plans count their actual user count as the cap). | `.kpi-grid`, `.kpi`, `.kpi-label`, `.kpi-value`, `.kpi-meta` |
| Z4. Pending alert (conditional — only if pending > 0) | `.alert` (saffron) with strong "3 organizations awaiting your review" + "Oldest: Saffron Stays Pvt Ltd · submitted 21/05/2026" + saffron CTA "Review pending →" linking to `organizations.html?filter=pending` | `.alert` |
| Z5. Two-column section | Left: **Plan Distribution** card — donut chart (inline SVG, 200 × 200, segments navy / royal-blue / saffron for Basic / Standard / Premium) + legend below with counts (Basic: 4 · Standard: 5 · Premium: 1 — totals match Z3.org count). Right: **Recently Approved** card — `.data-table` with 4 rows showing Org name · Plan · Approved on (DD/MM/YYYY) · `.badge-active` "Active". | `.section`, `.card`, `.data-table`, `.badge-active` |
| Z6. Activity feed | `.section` with `.section-title` "RECENT PLATFORM ACTIVITY" + `.card.p-0` containing `.data-table` (5 rows): timestamp DD/MM/YYYY HH:mm · Action · Actor (Super Admin name) · Target org. Examples: "26/05/2026 09:14 · Approved organization · Aayush Kumar · Saffron Stays Pvt Ltd"; "25/05/2026 17:02 · Changed plan Basic → Standard · Aayush Kumar · Green Valley Co-living". | `.section`, `.section-title`, `.data-table` |
| Z7. Tab bar (mobile only) | The 4-item tab bar from §2.0.3 with Home active | `.tabbar`, `.tab.active` |

#### 2.1.3 Interactions

- "Review pending →" CTA in Z4 navigates to `organizations.html?filter=pending` (querystring is honored by JS on that page — see §2.2.4).
- "Recently Approved" rows: clicking the org name navigates to `organization-detail.html?id=<id>`.
- Notification bell click: opens nothing in the prototype (decorative; `alert('No new platform notifications')` placeholder).
- Drawer toggle behaves identically to Admin pages (existing `openDrawer()` / `closeDrawer()`).

#### 2.1.4 Out of scope for this page

No org-scoped data (no per-property, per-unit, per-tenant, per-lease, per-payment). No subscription billing data (defer DEF-01). No system health / uptime widgets (would need backend signals not in v8 scope).

---

### 2.2 `prototype/super-admin/organizations.html` — List of all organizations

#### 2.2.1 Intent

Cross-platform list of every organization. Filter by status (Pending / Active / Deactivated). Search by name. Each row links to `organization-detail.html?id=<id>`. The "Pending" tab is where Super Admin starts an approval review.

#### 2.2.2 Zone-by-zone layout

| Zone | Content | Components / classes |
|---|---|---|
| Z1. Sidebar | 4-item sidebar, Organizations active | `.sidebar` + `.sidebar-link.active` on Organizations |
| Z2. Topbar | `.page-title` "Organizations" + `.page-subtitle` "12 total · 3 pending review" · primary action **none** (orgs are created via public sign-up, not by Super Admin) | `.topbar`, `.page-title` |
| Z3. Status filter tabs (segmented control) | Row of 4 pill buttons: `All · 12` (default selected) · `Pending · 3` (saffron text via `.text-saffron` Tailwind utility when count > 0) · `Active · 8` · `Deactivated · 1`. Selected uses `.btn-primary`; others `.btn-secondary`. Matches the existing pattern from `prototype/admin/users.html` lines 44–51. | `.section`, `.btn` family |
| Z4. Search + secondary filters | `.card` containing 2-column grid: (a) text search input (label "Search", placeholder "Organization name, contact"), (b) Plan filter select ("All plans / Basic / Standard / Premium"). Matches `prototype/admin/properties.html` lines 46–71. | `.card`, `.label`, `.input` |
| Z5. Table | `.card.p-0.overflow-x-auto` wrapping `.data-table` with columns: **Organization** (bold charcoal) · **Plan** (plain text) · **Active Users** (e.g. "12 / 20" — used / cap; renders "12 / ∞" for Premium) · **Status** (badge: Pending = `.badge-partial`, Active = `.badge-active`, Deactivated = `.badge-closed`) · **Created** (DD/MM/YYYY) · (right) `View` link (royal-blue Poppins 600). 4–8 example rows covering all three statuses. | `.data-table`, `.badge-*` |
| Z6. Pagination footer | "Showing 1–8 of 12" + `‹` / `›` buttons. Matches `prototype/admin/properties.html` lines 120–126. | `.btn .btn-secondary` |
| Z7. Tab bar | 4-item, Orgs active | `.tabbar` |

#### 2.2.3 Approval CTA placement decision

The "Approve" / "Reject" action does **not** live on this list page — it lives on the detail page (§2.3). Rationale: Super Admin must see the full application (contact, plan request, sample size) before approving; one-click approval from a list row would be too easy to misclick. The list page only surfaces a "Pending" badge + `View` link. Acceptable since most prospects are reviewed once each.

#### 2.2.4 URL filter param

On page load, JS reads `window.location.search` for `?filter=pending|active|deactivated|all`. If present, applies the matching pill as selected. Used by the Dashboard alert deep-link (§2.1.3).

#### 2.2.5 Interactions

- Status pill click: filter the table client-side; rewrite URL via `history.replaceState` so deep links survive.
- Plan filter select change: same client-side filter.
- Search input: debounce 300 ms (UIUX Interaction Patterns §8 — "search filters debounce 300 ms before firing"), case-insensitive `includes()` over Organization name + primary contact name.
- Row `View` link: `organization-detail.html?id=<id>`.

#### 2.2.6 Empty state

If the active filter yields 0 rows, show a `.card` centered with an icon + headline "No organizations match" + helper "Try a different filter or clear the search." + secondary CTA "Show all". Pattern from UIUX Design Document §7 Empty state.

---

### 2.3 `prototype/super-admin/organization-detail.html` — Single organization

#### 2.3.1 Intent

One organization's full record. Surfaces approve/reject (if pending), deactivate/reactivate, change plan, view org users (read-only directory), and the audit trail of platform-level actions taken on this org. The widest of the five pages by zone count.

#### 2.3.2 Zone-by-zone layout

| Zone | Content | Components / classes |
|---|---|---|
| Z1. Sidebar | 4-item, Organizations active (no nested active state for detail page) | `.sidebar` |
| Z2. Topbar | `.page-title` "Saffron Stays Pvt Ltd" + `.page-subtitle` "Submitted 21/05/2026 · Awaiting review" (when Pending) / "Active since 03/04/2026 · Standard plan" (when Active). Right-side: **primary action varies by status** — `.btn-primary` "Approve" (Pending) · `.btn-secondary` "Change Plan" + `.btn-danger` "Deactivate" (Active) · `.btn-secondary` "Reactivate" (Deactivated). All buttons open modals; never inline. | `.topbar`, `.page-title`, `.btn-primary`, `.btn-secondary`, `.btn-danger` |
| Z3. Status strip | A horizontal `.card` containing 4 inline-stacked meta blocks: **Status** (badge) · **Plan** (text + small "Change" royal-blue link → opens Change Plan modal) · **Created** (DD/MM/YYYY) · **Primary contact** (name + email mailto:). Matches the UIUX §5 "Detail view" template ("meta strip at top"). | `.card` (with `display: flex` Tailwind utility), `.badge-*` |
| Z4. Two-column section: Organization details + Subscription | Left card "ORGANIZATION DETAILS" — uses `.profile-card` style for visual consistency, showing rows: Name · Type of business · Expected unit count · City + State · Created on. Right card "SUBSCRIPTION" — showing rows: Plan (Basic / Standard / Premium) · Active-user cap (5 / 20 / Unlimited) · Active users (e.g. 12 of 20) · Utilization bar (inline `<div>` with mid-gray bg + saffron fg, width % inline-styled). | `.profile-card`, `.profile-row` |
| Z5. Organization users (read-only) | `.section` with `.section-title` "ORGANIZATION USERS" + helper "Read-only. Manage users from within the organization." + `.card.p-0.overflow-x-auto` + `.data-table` columns: Name · Role (Admin / PM / Maintenance / Tenant) · Email · Status badge · Last seen (DD/MM/YYYY). 4–6 example rows. Footer "Showing 6 of 12 · View all" link triggers an in-page expand (no separate page). | `.section`, `.data-table` |
| Z6. Audit trail | `.section` with `.section-title` "PLATFORM-LEVEL AUDIT" + helper "Actions Super Admin has taken on this organization." + `.card.p-0` + `.data-table` columns: When (DD/MM/YYYY HH:mm IST) · Action · By (Super Admin name) · Notes. 4–5 example rows: "26/05/2026 09:14 · Approved · Aayush Kumar · —"; "26/05/2026 09:14 · Provisioned · Aayush Kumar · First Admin: contact@saffronstays.in"; "—". For a Pending org show only the "Submitted" entry. | `.section`, `.data-table` |
| Z7. Modals (off-screen until triggered) | (a) **Approve modal** — title "Approve Saffron Stays?" + body "Provisions the organization and emails Admin credentials to contact@saffronstays.in. Cannot be undone — only deactivation reverses this." + Cancel (default focus) / Approve (`.btn-primary`). (b) **Change Plan modal** — 3 radio tiles (Basic / Standard / Premium) + Cancel / Save. (c) **Deactivate modal** — title "Deactivate Saffron Stays Pvt Ltd?" + body explaining users can't log in until reactivated · type-confirm input ("Type the organization name to confirm") + Cancel / Deactivate (`.btn-danger`, disabled until name matches exactly). Type-confirm pattern matches UIUX §8 "Destructive confirmations". | `.modal-backdrop`, `.modal`, `.btn-*` family |
| Z8. Tab bar | 4-item, Orgs active | `.tabbar` |

#### 2.3.3 Plan-change behaviour (NR-6)

Per Solution Overview NR-6: the new cap applies immediately to subsequent user additions. The modal helper text spells this out: "The new cap applies to new users immediately. Existing users above the new cap stay active until they're individually deactivated."

#### 2.3.4 Approval behaviour

Approve modal → on confirm, prototype simulates with a green toast (`alert('Organization approved. Admin credentials sent to contact@saffronstays.in.')`) and `window.location.reload()`. Live app routes: POST `/api/v1/super-admin/organizations/:id/approve`.

#### 2.3.5 Deactivate behaviour

Type-confirm enables the Deactivate button only when the typed string exactly matches the org name. On confirm, simulate toast and reload. Audit row gets prepended client-side for the demo.

#### 2.3.6 No DELETE endpoint surface

Per Scope rule C: no DELETE. The page never offers "Delete organization" — only "Deactivate". UIUX banner copy reinforces this in the deactivate modal: "Deactivation is reversible; deletion is not supported."

---

### 2.4 `prototype/super-admin/plans.html` — Subscription Plans catalogue

#### 2.4.1 Intent

Manage the catalogue: edit each plan's active-user cap and feature scope. Three plans only — Basic, Standard, Premium (NR-6) — and the prototype enforces that **adding/removing a plan is out of scope** (the catalogue is fixed; only attributes are editable).

#### 2.4.2 Zone-by-zone layout

| Zone | Content | Components / classes |
|---|---|---|
| Z1. Sidebar | 4-item, Plans active | `.sidebar` |
| Z2. Topbar | `.page-title` "Subscription Plans" + `.page-subtitle` "3 plans · applied to 11 organizations" · no primary action button (catalogue is fixed) | `.topbar`, `.page-title` |
| Z3. Info banner | `.alert` (saffron) "Plans are platform-wide. Cap changes take effect immediately for new user additions; existing users above the cap are not removed." Matches UIUX §7 Banner spec. | `.alert` |
| Z4. Plan cards (3-up on desktop, 1-up on mobile via CSS grid) | Three `.card` blocks side-by-side, each containing: (a) plan name as h2 (Poppins 600 royal-blue 28 px from styles.css line 49); (b) **Active-user cap** value (Poppins 700 32 px navy — reuses `.kpi-value` scale); (c) feature bullets (3–5 short bullets sourced from Solution Overview §New Features → Organization Management — e.g. Basic: "Up to 5 active users · 1 property · Core rent + maintenance flows · Manual visitor management"; Standard: "Up to 20 active users · Unlimited properties · Per-room leasing · Admin Impersonation · Delegations"; Premium: "Unlimited active users · All Standard features · Master Data customization · Settings tuning · Priority support"); (d) **Organizations using this plan** count + small "View list" link → `organizations.html?plan=basic` (etc); (e) `.btn-secondary` "Edit cap" linking via JS to open Z5 modal. | `.card`, `.kpi-value` scale, `.btn-secondary` |
| Z5. Edit Cap modal (per plan) | Title "Edit Basic plan cap"; field "Active-user cap" — for Basic/Standard a numeric `.input` (min 1, max 999); for Premium a `.input[disabled]` showing "Unlimited" with helper "Premium is uncapped — change requires platform-level engineering review." Footer: Cancel (default focus) / Save (`.btn-primary`). Field validation: cap ≥ 1 + cap must be ≥ the highest current active-user count for any org on this plan (helper text shows "Current highest: 12 users on Saffron Stays Pvt Ltd"). | `.modal-backdrop`, `.modal`, `.input`, `.label`, `.field-error` |
| Z6. Edit Features (deferred — out of scope for prototype) | A muted footer row "Feature scope per plan is a v8 design decision and not editable from the catalogue in this prototype." Matches the proposal-stage tone. | `.muted` |
| Z7. Tab bar | 4-item, Plans active | `.tabbar` |

#### 2.4.3 Interaction notes

- Edit Cap modal validates on blur of the numeric input. Save button stays `.btn-disabled` until value is valid AND differs from the current cap.
- Save simulates with toast and updates the card's cap inline via JS (`document.querySelector(...).textContent = newCap`).
- "View list" link uses the same `?plan=basic` querystring pattern as the status filter on `organizations.html` (§2.2.4).

#### 2.4.4 No plan add/remove

The prototype renders exactly 3 plans. No "Add plan" button, no delete affordance. NR-6 says "exactly one Subscription Plan (Basic / Standard / Premium)" — the catalogue is closed.

---

### 2.5 `prototype/super-admin/profile.html` — Super Admin's profile

#### 2.5.1 Intent

Mirrors `prototype/admin/profile.html` structure (Account card + Security card + Recent Activity) but scoped to the Super Admin. Differences: role label reads "Super Admin", scope row reads "All organizations · Platform-level", role pill copy is "Super Admin", and the recent-activity table shows platform-level actions (approve org / change plan / deactivate / impersonation NOT applicable — Super Admin cannot impersonate per NR-7).

#### 2.5.2 Zone-by-zone layout

| Zone | Content | Components / classes |
|---|---|---|
| Z1. Sidebar | 4-item, Profile active | `.sidebar` |
| Z2. Topbar | `.page-title` "My Profile" + `.page-subtitle` "Account and security" · `.notif-bell` + name + `.avatar` (linking to self) | `.topbar` |
| Z3. Profile grid (2 cards) | Identical to `prototype/admin/profile.html` lines 49–99. **Account card**: profile header (avatar + name + `.profile-role` pill reading **"Super Admin"** instead of "Admin"); rows for Name · Email · Phone · **Role: Super Admin · Platform** · **Scope: All organizations** · Member since (DD/MM/YYYY) · Account status. "Edit details" secondary button (read-only in prototype). **Security card**: Current / New / Confirm password inputs (min 10 chars — matches v1; CARRY-05 12-char bump still deferred) · `.btn-primary` "Change password" · `.divider` · `.btn-danger` "Sign out" link to `../login.html`. | `.profile-grid`, `.profile-card`, `.profile-header`, `.profile-avatar-lg`, `.profile-row`, `.input`, `.label`, `.btn-*` family |
| Z4. Recent Activity table | `.section.mt-8` with `.section-title` "RECENT ACTIVITY" + `.card.p-0` + `.data-table` columns: When (DD/MM/YYYY HH:mm) · Action · Resource (org name or —) · IP. Examples reflect platform actions: "26/05/2026 09:14 · Approved organization · Saffron Stays Pvt Ltd · 106.51.xx.xx"; "25/05/2026 17:02 · Changed plan Basic → Standard · Green Valley Co-living · 106.51.xx.xx"; "24/05/2026 09:00 · Signed in · — · 106.51.xx.xx". | `.section`, `.section-title`, `.card`, `.data-table` |
| Z5. Tab bar | 4-item, Profile active | `.tabbar` |

#### 2.5.3 Differences vs Admin profile (line-by-line)

| Aspect | Admin profile (`prototype/admin/profile.html`) | Super Admin profile (this page) |
|---|---|---|
| `.profile-role` text | "Admin" | "Super Admin" |
| Role row value | "Admin · Top Management" | "Super Admin · Platform" |
| Scope row value | "All 18 properties" | "All organizations · Platform-level" |
| Recent Activity actions | "Created Property Manager · Anil Kapoor" | "Approved organization · Saffron Stays Pvt Ltd" |
| Tabbar | 5 items + MoreSheet | 4 items, no MoreSheet (per §2.0.3) |
| Sidebar | 8 items + divider + Profile | 4 items (per §2.0.2) |

#### 2.5.4 Password rules

Min 10 chars (matches v1; CARRY-05 12-char bump deferred). Confirm field validates equality on blur. **No HTML5 native popups** — use `assets/validation.js` + `.field-error` for inline messages (per Working rule #16). The existing `admin/profile.html` uses `minlength="10"` + `required` which triggers HTML5 native — **this prototype must do better** and route through `validation.js` instead, but match the visual format the existing files achieve.

---

## 3. Test cases (designed up front)

Cases are namespaced per page. All cases are prototype-scope (interaction + visual + accessibility + responsive) until backend ships.

### 3.1 TC-SADMIN-DASH — `dashboard.html`

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-SADMIN-DASH-001 | Page loads on the Platform route | Browser at `prototype/super-admin/dashboard.html` | Open the file in Chrome | Page renders with `.page-title` "Platform Dashboard", sidebar shows 4 items, Dashboard active | H |
| TC-SADMIN-DASH-002 | Sidebar has exactly 4 items, no MoreSheet | Page loaded | Count sidebar links between brand and footer | 4 items: Dashboard · Organizations · Plans · My Profile (with one divider between Orgs and Plans, one between Plans and Profile) | H |
| TC-SADMIN-DASH-003 | No `/:org/` slug appears anywhere in href attributes | Page loaded | `document.querySelectorAll('a').forEach(a => assert no /:org/ pattern)` | No anchor href contains an org slug | H |
| TC-SADMIN-DASH-004 | KPI strip renders 4 cards with expected labels | Page loaded | Inspect `.kpi-grid > .kpi` count and labels | 4 cards: Organizations · Pending Sign-ups · Total Active Users · Plan Coverage | H |
| TC-SADMIN-DASH-005 | Pending Sign-ups KPI is saffron when > 0 | Page loaded with mock pending=3 | Inspect computed style on the Pending KPI value | `color: rgb(245, 127, 23)` (`#F57F17` saffron-status) | M |
| TC-SADMIN-DASH-006 | Pending alert is visible when pending > 0 | Page loaded | Visually verify `.alert` containing "3 organizations awaiting your review" | Saffron alert visible above the two-column section | H |
| TC-SADMIN-DASH-007 | "Review pending →" CTA deep-links to filtered list | Click CTA | window.location | Navigates to `organizations.html?filter=pending` | H |
| TC-SADMIN-DASH-008 | Plan distribution donut renders 3 segments | Page loaded | Inspect inline SVG | 3 arc segments in navy / royal-blue / saffron | M |
| TC-SADMIN-DASH-009 | Recently Approved table has 4 rows | Page loaded | Count rows in the Recently Approved card | Exactly 4 example rows | M |
| TC-SADMIN-DASH-010 | Recent Activity table shows IST DD/MM/YYYY HH:mm | Page loaded | Inspect the timestamp column | All timestamps render `DD/MM/YYYY HH:mm` (no `YYYY-MM-DD`, no `MM/DD`, no 24:00) | H |
| TC-SADMIN-DASH-011 | Tabbar shows 4 items, no More button | Resize to ≤ 1023 px | Inspect `.tabbar` children | 4 `<a class="tab">` elements; no `.tab-more` button | H |
| TC-SADMIN-DASH-012 | Sidebar collapses to drawer at ≤ 1023 px | Resize to 800 px wide | Inspect computed `transform` on `.sidebar` | `translateX(-100%)` (matches styles.css line 314) | H |
| TC-SADMIN-DASH-013 | Drawer opens via toggle on mobile | At 360 px, click `.drawer-toggle` | Sidebar slides in | `.sidebar.open` class applied; `transform: translateX(0)` | H |
| TC-SADMIN-DASH-014 | `.more-sheet` markup is NOT present | Page loaded | `document.querySelectorAll('.more-sheet').length` | 0 (Super Admin has no MoreSheet) | H |
| TC-SADMIN-DASH-015 | All design tokens come from styles.css | Inspect computed styles | Verify against styles.css | No inline color outside the navy/royal-blue/saffron/charcoal/slate/off-white/light-gray/mid-gray + status palette | H |
| TC-SADMIN-DASH-016 | Tab order matches reading order | Tab through page | Focus moves logically | Drawer toggle → topbar elements → KPIs → alert CTA → cards → activity rows → tabbar items | H |
| TC-SADMIN-DASH-017 | Focus ring is 2 px saffron with 2 px offset | Tab to any focusable | Inspect outline | `outline: 2px solid #FF6F00; outline-offset: 2px` | H |
| TC-SADMIN-DASH-018 | Skip-to-content link is first focusable (when added) | Open page, press Tab once | First focusable | Sidebar brand link OR a skip-to-content link if implemented per UIUX §9 | M |
| TC-SADMIN-DASH-019 | Page is readable at 320 × 640 with no horizontal scroll | Resize to 320 × 640 | Inspect document.documentElement.scrollWidth | ≤ 320 px (no horizontal scrollbar on body) | H |
| TC-SADMIN-DASH-020 | Page is readable at 360 × 640 | Resize to 360 × 640 | Visual check | KPIs stack 1-col cleanly, tabbar visible | H |
| TC-SADMIN-DASH-021 | Page is readable at 768 × 1024 | Resize to 768 × 1024 | Visual check | Still mobile layout (drawer + tabbar); KPIs may go 2-col via auto-fit | M |
| TC-SADMIN-DASH-022 | Page is readable at 1024 × 768 | Resize to 1024 × 768 | Visual check | Sidebar fixed; tabbar hidden; KPIs 4-col | M |
| TC-SADMIN-DASH-023 | Page is readable at 1440 × 900 | Resize to 1440 × 900 | Visual check | Identical to 1024 px (content capped at 1440) | M |
| TC-SADMIN-DASH-024 | American English everywhere | Search page DOM text | Inspect | "Organization" not "Organisation"; "Authorized" not "Authorised" | H |
| TC-SADMIN-DASH-025 | Locale `en-IN` declared | View source | `<html lang="en-IN">` present | Locale attribute set | M |

### 3.2 TC-SADMIN-ORG — `organizations.html`

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-SADMIN-ORG-001 | Page loads, Organizations sidebar item active | Direct browser load | Open the file | `.sidebar-link.active` is on Organizations | H |
| TC-SADMIN-ORG-002 | Status filter pills present (All / Pending / Active / Deactivated) | Page loaded | Count pills | 4 pills in that order with counts | H |
| TC-SADMIN-ORG-003 | Pending pill shows saffron text when count > 0 | Mock count 3 | Inspect computed color | Saffron `#FF6F00` or status-partial `#F57F17` | M |
| TC-SADMIN-ORG-004 | "All" is the default selection | Page loaded with no query param | Inspect which pill has `.btn-primary` | The "All" pill | H |
| TC-SADMIN-ORG-005 | URL `?filter=pending` selects Pending pill on load | Load `organizations.html?filter=pending` | Inspect | Pending pill carries `.btn-primary`; table shows only Pending rows | H |
| TC-SADMIN-ORG-006 | URL updates as pills are clicked | Click Active pill | window.location | URL becomes `organizations.html?filter=active` (replaceState) | M |
| TC-SADMIN-ORG-007 | Plan filter changes the table | Select "Standard" from plan filter | Inspect rows | Only rows with Plan = Standard remain | M |
| TC-SADMIN-ORG-008 | Search input filters by org name (debounced 300 ms) | Type "saffron" | Wait 300 ms | Only rows whose Org name includes "saffron" remain | M |
| TC-SADMIN-ORG-009 | Status badge mapping is correct | Inspect badges | Pending → `.badge-partial`; Active → `.badge-active`; Deactivated → `.badge-closed` | All three statuses use the right class | H |
| TC-SADMIN-ORG-010 | Active Users column shows "12 / 20" format | Inspect rows | Verify shape | Each row shows `<used> / <cap>` with Premium rendered as `<used> / ∞` | H |
| TC-SADMIN-ORG-011 | Created column shows DD/MM/YYYY | Inspect rows | Verify format | All dates DD/MM/YYYY | H |
| TC-SADMIN-ORG-012 | Row "View" link navigates to detail page | Click View on a row | window.location | Navigates to `organization-detail.html?id=<id>` | H |
| TC-SADMIN-ORG-013 | No "Approve" button on the list page | Inspect all rows | Verify no inline approve | No `.btn-primary` reading "Approve" anywhere in the table | H |
| TC-SADMIN-ORG-014 | No DELETE-style affordances anywhere | Inspect | Verify | No "Delete" copy on the page | H |
| TC-SADMIN-ORG-015 | Empty state renders when filter yields 0 rows | Type random string in search | Inspect | Empty state card with icon + helper + "Show all" CTA | M |
| TC-SADMIN-ORG-016 | Pagination footer shows "Showing X–Y of Z" | Page loaded | Inspect | Format matches `Showing 1–8 of 12` | M |
| TC-SADMIN-ORG-017 | Tab bar present, Orgs active (mobile) | At 360 px | Inspect | `.tabbar` visible; Orgs tab has `.active` | H |
| TC-SADMIN-ORG-018 | No MoreSheet markup | Inspect DOM | Count `.more-sheet` | 0 elements | H |
| TC-SADMIN-ORG-019 | Drawer opens on mobile | At 360 px, click toggle | Verify | Sidebar slides in | H |
| TC-SADMIN-ORG-020 | All KPI / table cells use proper semantic tags | Inspect HTML | Verify | `<thead>`, `<tbody>`, `<th>`, `<td>` correctly used | H |
| TC-SADMIN-ORG-021 | Tab order keyboard-navigable end-to-end | Tab through page | Verify | Reaches every pill, search input, plan filter, every row's View link, pagination, tabbar | H |
| TC-SADMIN-ORG-022 | Focus rings visible on all focusables | Tab through | Inspect | 2 px saffron outline appears | H |
| TC-SADMIN-ORG-023 | Renders at 320, 360, 768, 1024, 1440 without horizontal scroll | Resize each | Inspect | `scrollWidth <= viewport` at every breakpoint | H |
| TC-SADMIN-ORG-024 | `<html lang="en-IN">` set | View source | Inspect | Locale attribute correct | M |
| TC-SADMIN-ORG-025 | American spelling | Search DOM text | Verify | "Organization", "Authorized", "Recognized" | H |
| TC-SADMIN-ORG-026 | Currency (where shown) renders ₹ Indian grouping | Inspect | Verify | "₹3,00,000" not "₹300,000" — applies if any currency appears in the list | M |
| TC-SADMIN-ORG-027 | Table row hover tint is royal-blue 3% | Hover a row | Inspect | `background: rgba(21,101,192,0.03)` | L |
| TC-SADMIN-ORG-028 | Plan filter offers exactly 4 options (All / Basic / Standard / Premium) | Open the select | Inspect | 4 options | M |
| TC-SADMIN-ORG-029 | Counts in filter pills equal the actual row counts | Page loaded | Sum rows per status, compare to pill counts | Counts match | M |
| TC-SADMIN-ORG-030 | `?plan=basic` querystring selects Basic in plan filter | Load with `?plan=basic` | Inspect | Plan select shows Basic; table filtered to Basic | M |

### 3.3 TC-SADMIN-ORGDETAIL — `organization-detail.html`

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-SADMIN-ORGDETAIL-001 | Page loads via `?id=<id>` | Browser load with `?id=42` | Inspect | Page title shows that org's name | H |
| TC-SADMIN-ORGDETAIL-002 | Sidebar Organizations item active (not Profile) | Page loaded | Inspect | `.sidebar-link.active` on Organizations | H |
| TC-SADMIN-ORGDETAIL-003 | Pending org shows "Approve" primary button | Mock status=Pending | Inspect topbar right | `.btn-primary` "Approve" present; no Deactivate button | H |
| TC-SADMIN-ORGDETAIL-004 | Active org shows "Change Plan" + "Deactivate" | Mock status=Active | Inspect | `.btn-secondary` "Change Plan" + `.btn-danger` "Deactivate" present; no Approve | H |
| TC-SADMIN-ORGDETAIL-005 | Deactivated org shows "Reactivate" | Mock status=Deactivated | Inspect | `.btn-secondary` "Reactivate" present; no Approve or Deactivate | H |
| TC-SADMIN-ORGDETAIL-006 | Status strip shows Status / Plan / Created / Primary contact | Page loaded | Inspect | 4 meta blocks visible | M |
| TC-SADMIN-ORGDETAIL-007 | "Change" link next to plan opens Change Plan modal | Click the link | Inspect | `.modal-backdrop.open` class applied to Change Plan modal | H |
| TC-SADMIN-ORGDETAIL-008 | Organization Details card lists Name · Type · Expected unit count · City + State · Created | Page loaded | Inspect rows | 5 rows present | M |
| TC-SADMIN-ORGDETAIL-009 | Subscription card shows utilization bar | Page loaded | Inspect | Inline `<div>` width % reflects used/cap ratio | M |
| TC-SADMIN-ORGDETAIL-010 | Premium plan renders "∞" cap | Mock plan=Premium | Inspect | Cap row shows ∞ or "Unlimited" | M |
| TC-SADMIN-ORGDETAIL-011 | Org Users table has Role column with 4 roles supported | Page loaded | Inspect | Role column shows Admin / PM / Maintenance / Tenant across example rows | M |
| TC-SADMIN-ORGDETAIL-012 | Org Users table shows Status badge + Last seen | Inspect | Verify columns | Status badge + DD/MM/YYYY date for Last seen | M |
| TC-SADMIN-ORGDETAIL-013 | "View all" link expands the org users list inline | Click View all | Inspect | All org users now visible (no nav) | L |
| TC-SADMIN-ORGDETAIL-014 | Audit trail timestamps render DD/MM/YYYY HH:mm IST | Inspect | Verify format | Format matches; no `T` ISO format leaking through | H |
| TC-SADMIN-ORGDETAIL-015 | Audit trail "By" column shows Super Admin name | Inspect | Verify | All "By" values reference a Super Admin user | M |
| TC-SADMIN-ORGDETAIL-016 | Pending org audit shows only "Submitted" row | Mock Pending | Inspect | One row in audit table | M |
| TC-SADMIN-ORGDETAIL-017 | Approve modal opens on button click | Click "Approve" | Inspect | Modal visible with title "Approve Saffron Stays?" | H |
| TC-SADMIN-ORGDETAIL-018 | Approve modal Cancel has default focus | Open Approve modal | Inspect `document.activeElement` | Cancel button is focused | H |
| TC-SADMIN-ORGDETAIL-019 | Approve confirm fires simulated success | Click Approve in modal | Wait | Toast/alert fires; page reloads | M |
| TC-SADMIN-ORGDETAIL-020 | Change Plan modal shows 3 radio tiles | Open modal | Inspect | 3 radio inputs for Basic / Standard / Premium | H |
| TC-SADMIN-ORGDETAIL-021 | Change Plan modal helper text explains immediate cap behaviour | Inspect modal body | Verify copy | Helper "The new cap applies to new users immediately…" present | M |
| TC-SADMIN-ORGDETAIL-022 | Change Plan Save disabled until selection differs from current | Open modal, leave current plan selected | Inspect | Save button has `.btn-disabled` | M |
| TC-SADMIN-ORGDETAIL-023 | Deactivate modal requires typing the org name to enable Confirm | Open modal, type wrong name | Inspect | Confirm button still `.btn-disabled` | H |
| TC-SADMIN-ORGDETAIL-024 | Deactivate modal enables Confirm only on exact name match | Type exact name | Inspect | Confirm button enables; class no longer disabled | H |
| TC-SADMIN-ORGDETAIL-025 | Deactivate button is `.btn-danger` styling | Inspect | Verify class | `.btn-danger` applied (red bg) | M |
| TC-SADMIN-ORGDETAIL-026 | Page has no "Delete" copy anywhere | Search DOM text | Verify | No occurrence of "Delete" or "Remove permanently" | H |
| TC-SADMIN-ORGDETAIL-027 | Page has no SMS / WhatsApp notification copy | Search | Verify | No occurrence | H |
| TC-SADMIN-ORGDETAIL-028 | Modal closes on backdrop click | Open any modal, click backdrop | Inspect | `.modal-backdrop.open` removed | M |
| TC-SADMIN-ORGDETAIL-029 | Modal closes on Escape key | Open any modal, press Esc | Inspect | Modal closed | M |
| TC-SADMIN-ORGDETAIL-030 | Tab order inside modal traps focus | Tab inside modal | Inspect | Focus cycles within modal (loop) | M |
| TC-SADMIN-ORGDETAIL-031 | Reading flow without JS — basic info still legible | Disable JS | Reload | Page still readable; modals just don't open | L |
| TC-SADMIN-ORGDETAIL-032 | No org slug in any href | Inspect anchors | Verify | All hrefs are flat — `organizations.html`, `organization-detail.html?...` | H |
| TC-SADMIN-ORGDETAIL-033 | Tab bar present, Orgs active | At 360 px | Inspect | `.tabbar` with Orgs `.active` | H |
| TC-SADMIN-ORGDETAIL-034 | Renders at 320 / 360 / 768 / 1024 / 1440 without horizontal scroll | Resize each | Inspect | scrollWidth ≤ viewport | H |
| TC-SADMIN-ORGDETAIL-035 | Modals at 360 px take near-full screen with internal scroll | Resize to 360 px, open Approve modal | Inspect | Modal width ≈ viewport - 32 px | M |
| TC-SADMIN-ORGDETAIL-036 | All tokens sourced from styles.css | Inspect computed styles | Verify | No invented colors | H |
| TC-SADMIN-ORGDETAIL-037 | Buttons have ≥ 44 × 44 px tap targets on mobile | At 360 px, inspect button bounding box | Verify | All buttons ≥ 44 × 44 px | H |
| TC-SADMIN-ORGDETAIL-038 | `<html lang="en-IN">` | View source | Inspect | Correct locale | M |
| TC-SADMIN-ORGDETAIL-039 | American spelling everywhere | Search DOM text | Inspect | "Organization", "Authorized" etc. | H |
| TC-SADMIN-ORGDETAIL-040 | DD/MM/YYYY everywhere | Inspect dates | Verify | All dates formatted DD/MM/YYYY | H |
| TC-SADMIN-ORGDETAIL-041 | Audit times in IST (no UTC offsets in display) | Inspect | Verify | No `+00:00` or `Z` suffix in displayed times | H |
| TC-SADMIN-ORGDETAIL-042 | Type-confirm input has `.label` + error styling when wrong | Type wrong then check | Inspect | Field stays neutral until submit attempted; on attempt, `.input.error` applied | M |
| TC-SADMIN-ORGDETAIL-043 | Reactivate flow on a Deactivated org confirms via modal | Click Reactivate | Inspect | Modal opens with single Confirm button (no type-confirm) | M |
| TC-SADMIN-ORGDETAIL-044 | No impersonation affordance offered for Super Admin | Inspect | Verify | No "Impersonate" / "Login as" button (NR-7) | H |
| TC-SADMIN-ORGDETAIL-045 | Audit trail does NOT show Tenant-level audit (out of scope) | Inspect | Verify | Only platform-level entries (approve / deactivate / change plan / provisioned) | M |

### 3.4 TC-SADMIN-PLANS — `plans.html`

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-SADMIN-PLANS-001 | Page loads, Plans sidebar item active | Browser load | Inspect | `.sidebar-link.active` on Plans | H |
| TC-SADMIN-PLANS-002 | Page renders exactly 3 plan cards | Page loaded | Count `.card` blocks in the plan grid | 3 cards: Basic · Standard · Premium | H |
| TC-SADMIN-PLANS-003 | Plans are in the order Basic → Standard → Premium | Page loaded | Inspect order | Cards in that order | M |
| TC-SADMIN-PLANS-004 | Basic plan shows cap "5 users" | Inspect Basic card | Verify | Cap value "5" or "5 users" | H |
| TC-SADMIN-PLANS-005 | Standard plan shows cap "20 users" | Inspect Standard card | Verify | Cap value "20" or "20 users" | H |
| TC-SADMIN-PLANS-006 | Premium plan shows cap "Unlimited" | Inspect Premium card | Verify | Cap value "Unlimited" or "∞" | H |
| TC-SADMIN-PLANS-007 | Info banner explains immediate cap behaviour | Inspect | Verify | `.alert` with NR-6 copy | M |
| TC-SADMIN-PLANS-008 | No "Add plan" button | Inspect | Verify | No CTA suggesting plan creation | H |
| TC-SADMIN-PLANS-009 | No "Delete plan" affordance | Inspect | Verify | No delete copy | H |
| TC-SADMIN-PLANS-010 | Each card has "Edit cap" secondary button | Inspect 3 cards | Verify | 3 `.btn-secondary` buttons titled "Edit cap" | H |
| TC-SADMIN-PLANS-011 | Each card shows "Organizations using this plan" count | Inspect | Verify | All 3 cards include the count line | M |
| TC-SADMIN-PLANS-012 | "View list" link deep-links to filtered orgs | Click Basic's View list | window.location | Navigates to `organizations.html?plan=basic` | M |
| TC-SADMIN-PLANS-013 | Edit cap modal opens on Basic | Click Basic's Edit cap | Inspect | Modal visible with title "Edit Basic plan cap" | H |
| TC-SADMIN-PLANS-014 | Premium Edit cap modal shows "Unlimited" disabled input | Click Premium's Edit cap | Inspect | Input has `disabled` attribute, value "Unlimited" | H |
| TC-SADMIN-PLANS-015 | Cap input validates min 1 | Enter 0 | Inspect | `.field-error` shows "Cap must be at least 1" | H |
| TC-SADMIN-PLANS-016 | Cap input validates ≥ current highest user count | Mock highest=12 on Basic, enter 5 | Inspect | `.field-error` shows "Cap must be ≥ 12 (current highest on Saffron Stays Pvt Ltd)" | H |
| TC-SADMIN-PLANS-017 | Save button disabled until value differs and is valid | Open modal, leave current value | Inspect | Save has `.btn-disabled` | M |
| TC-SADMIN-PLANS-018 | Save updates card cap inline on confirm | Change cap to 8, save | Inspect | Card now shows "8" | M |
| TC-SADMIN-PLANS-019 | Modal Cancel default focus | Open modal | document.activeElement | Cancel button | H |
| TC-SADMIN-PLANS-020 | Modal closes on Esc | Open + Esc | Inspect | Modal closed | M |
| TC-SADMIN-PLANS-021 | Tab bar shows 4 items, Plans active | At 360 px | Inspect | `.tab.active` on Plans | H |
| TC-SADMIN-PLANS-022 | No MoreSheet markup | DOM | Count `.more-sheet` | 0 | H |
| TC-SADMIN-PLANS-023 | Plan cards stack 1-col at 360 px | Resize | Inspect | Cards stack vertically | H |
| TC-SADMIN-PLANS-024 | Plan cards 3-col at 1024 px | Resize | Inspect | Cards side by side | M |
| TC-SADMIN-PLANS-025 | Tokens from styles.css only | Computed styles | Verify | No invented colors/radii | H |
| TC-SADMIN-PLANS-026 | Focus rings present on Edit cap buttons | Tab | Inspect | 2 px saffron outline | H |
| TC-SADMIN-PLANS-027 | American spelling | Search DOM | Verify | "Organization", "Customize" | H |
| TC-SADMIN-PLANS-028 | `<html lang="en-IN">` | View source | Inspect | Correct locale | M |
| TC-SADMIN-PLANS-029 | No `/:org/` paths | Inspect anchors | Verify | All hrefs flat | H |
| TC-SADMIN-PLANS-030 | Cap input keyboard-navigable, supports up/down arrows | Focus + arrow keys | Verify | Numeric input behaves normally; no native popup tooltips | M |

### 3.5 TC-SADMIN-PROF — `profile.html`

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-SADMIN-PROF-001 | Page loads, Profile sidebar item active | Browser load | Inspect | `.sidebar-link.active` on My Profile | H |
| TC-SADMIN-PROF-002 | Role pill reads "Super Admin" (not "Admin") | Inspect `.profile-role` | Verify text | "Super Admin" | H |
| TC-SADMIN-PROF-003 | Role row value reads "Super Admin · Platform" | Inspect Account card rows | Verify | Matches exactly | H |
| TC-SADMIN-PROF-004 | Scope row value reads "All organizations · Platform-level" | Inspect | Verify | Matches exactly | H |
| TC-SADMIN-PROF-005 | Member since date renders DD/MM/YYYY | Inspect | Verify | Format matches | H |
| TC-SADMIN-PROF-006 | Security card password fields validate min 10 chars | Type 9 chars in New password | Inspect | `.field-error` "At least 10 characters" via `validation.js`, not HTML5 tooltip | H |
| TC-SADMIN-PROF-007 | Confirm password validates equality | Mismatch | Inspect | `.field-error` "Passwords don't match" | H |
| TC-SADMIN-PROF-008 | Submit disabled until both passwords valid + match | Inspect | Verify | Button has `.btn-disabled` until valid | H |
| TC-SADMIN-PROF-009 | No HTML5 native validation popups | Submit invalid form | Inspect | Browser does not show its own popup; `.field-error` text used instead | H |
| TC-SADMIN-PROF-010 | Sign out link returns to login | Click Sign out | window.location | Navigates to `../login.html` | M |
| TC-SADMIN-PROF-011 | Recent Activity shows platform-level actions | Inspect | Verify rows | Actions like "Approved organization", "Changed plan", "Signed in" (no org-level actions like "Created PM") | H |
| TC-SADMIN-PROF-012 | Tab bar shows 4 items, Profile active | At 360 px | Inspect | `.tab.active` on Profile | H |
| TC-SADMIN-PROF-013 | No MoreSheet markup | DOM | Count `.more-sheet` | 0 | H |
| TC-SADMIN-PROF-014 | Profile grid renders 2 cards on desktop | At 1024 px | Inspect | Two cards side by side via `.profile-grid` | M |
| TC-SADMIN-PROF-015 | Profile grid stacks 1-col on mobile | At 360 px | Inspect | Two cards stacked | M |
| TC-SADMIN-PROF-016 | All dates DD/MM/YYYY | Inspect | Verify | No US format leaks | H |
| TC-SADMIN-PROF-017 | American spelling | Search DOM | Verify | "Organization", "Customize" | H |
| TC-SADMIN-PROF-018 | `<html lang="en-IN">` | View source | Inspect | Correct locale | M |

---

## 4. Sign-off

### 4.1 Decisions taken in-plan (auto mode — proceeding with the reasonable call)

| # | Decision | Reasoning |
|---|---|---|
| D1 | Audit Log is **not** in the Super Admin sidebar (4 items only, per user requirement) | UIUX Design Document §4 lists an Audit Log Platform page, but user requirement explicitly caps sidebar at 4 items. Per-org audit lives inside `organization-detail.html` Z6. A standalone cross-org `/audit-log` page can be a follow-up; not in this prototype. |
| D2 | Plan-tier "Basic / Standard / Premium" rendered as plain text, not colored badges | UIUX Design Document tokens reserve badges for state. Inventing a plan-color trio would violate "no invented values". The dashboard donut chart uses the existing brand triplet (navy / royal-blue / saffron) as the encoded mapping. |
| D3 | Approve / Reject lives on the detail page only, not on list rows | UIUX §8 destructive-confirmations + "modals for short confirmations" — and approval is enough of a commitment to require the full record review first. |
| D4 | Plan add/remove **not** in scope | NR-6 fixes the 3-plan catalogue. Plans page edits only the cap (and feature scope is muted-deferred). |
| D5 | Super Admin has **no** impersonation affordance anywhere | NR-7 — Admin cannot impersonate Super Admin, but the **converse is also not in scope**. Super Admin operates only via approve / deactivate / change-plan. No "login as" button anywhere on org-detail. |
| D6 | "Pending" status uses `.badge-partial` (saffron warning) | Reuses existing token. Could have been `.badge-prepaid` (royal-blue info) but warning conveys "needs your attention" more accurately. |
| D7 | Sidebar uses two `.sidebar-divider` separators (between Orgs/Plans and Plans/Profile) | Visually groups Dashboard+Orgs (operational), Plans (catalogue), Profile (personal). Matches the divider-before-Profile pattern in `prototype/admin/profile.html` line 26. |
| D8 | Password rules stay at min 10 (matches v1, defers CARRY-05 12-char bump) | CARRY-05 explicitly user-deferred per `feature_list.json`. Don't bump in a prototype that hasn't been told to. |
| D9 | No public-side `<head>` SEO meta tags | These are authenticated pages — no Open Graph, no canonical, no description. Matches the existing `prototype/admin/*.html` pattern. |
| D10 | Forms use `assets/validation.js` (not HTML5 native) even where `admin/profile.html` regressed to `required` + `minlength` | Working rule #16 + UIUX §1 Design Principle "Errors live below the field" — this prototype must do better than the v1 file. |

### 4.2 Questions for the user (none blocking)

None. Auto-mode active and proceeding with the above decisions. If the user wants Audit Log added to the sidebar (D1) or plan-colored badges introduced (D2), that's a follow-up — surface on review.

## 5. Execution log

| Date | Milestone | By |
|---|---|---|
| 2026-05-26 | Planning file created (this file) | gharsetu-lead (planning only — no HTML written per user instruction) |
| 2026-05-26 | All 5 HTML files implemented: dashboard.html · organizations.html · organization-detail.html · plans.html · profile.html — all per §2.1–§2.5. 4-item sidebar (no MoreSheet), donut SVG, status-filter JS + URL params, type-confirm deactivate, plan-cap validation, password equality check via validation.js contract. | gharsetu-frontend |

(TC-SADMIN-DASH / -ORG / -ORGDETAIL / -PLANS / -PROF batches to be executed by gharsetu-tester.)

## 6. Files changed

| File | Change | Touched by |
|---|---|---|
| `prototype/super-admin/dashboard.html` | NEW — platform dashboard per §2.1 | gharsetu-frontend · 2026-05-26 |
| `prototype/super-admin/organizations.html` | NEW — org list with status filter + URL params + empty state per §2.2 | gharsetu-frontend · 2026-05-26 |
| `prototype/super-admin/organization-detail.html` | NEW — org detail with approve / change-plan / deactivate / reactivate modals per §2.3 | gharsetu-frontend · 2026-05-26 |
| `prototype/super-admin/plans.html` | NEW — plans catalogue with edit-cap modal + inline cap update per §2.4 | gharsetu-frontend · 2026-05-26 |
| `prototype/super-admin/profile.html` | NEW — Super Admin profile with custom JS password validation per §2.5 | gharsetu-frontend · 2026-05-26 |
| `docs/planning/features/2026-05-26-super-admin-pages.md` | §5 execution log + §6 files ledger populated | gharsetu-frontend · 2026-05-26 |
| `docs/planning/prototype-changes.md` | append a single row covering the 5 new Super Admin pages | gharsetu-lead on ship |
| `prototype/login.html` | append "Super Admin" to the role-button row so testers can reach the new pages | gharsetu-frontend on ship |

## 7. Agents used

| Agent | Task | Status |
|---|---|---|
| gharsetu-lead | Planning (this file) — §§1–9, all 5 page layouts, design-token verification, test-case design | ✅ accepted |
| gharsetu-frontend | Implement the 5 prototype HTML files per §2.1 – §2.5 | ⏳ pending dispatch |
| gharsetu-tester | Execute TC-SADMIN-DASH / -ORG / -ORGDETAIL / -PLANS / -PROF batches against the shipped HTML at 5 viewport widths | ⏳ pending after FE delivery |

(No backend or security work — prototype-only.)

## 8. Post-deploy

(Empty — file stays open for any issues surfaced after the prototype ships.)

## 9. Cross-references

- UIUX Design Document §4 Platform pages table — `doc-assets/templates/generate_design_document.js` lines 269–276
- UIUX Design Document §3 Layout Foundations — breakpoint contract, sidebar spec, tabbar spec (`generate_design_document.js` lines 209–249)
- Solution Overview v8 §New Roles — `doc-assets/templates/generate_solution_overview.js` lines 624–648
- Solution Overview v8 §New Features → Organization Management (SAAS layer) — `generate_solution_overview.js` lines 382–388
- Solution Overview v8 §Details / Subscription Plans matrix — `generate_solution_overview.js` lines 416–421
- Solution Overview v8 §Business Rules NR-5 (org boundaries), NR-6 (plans + caps), NR-7 (impersonation scope) — `generate_solution_overview.js` lines 401–404
- `feature_list.json` rows ENG-F06 (SAAS layer) + ENG-F07 (Super Admin role) — both `state: "not_started"`
- Sibling planning files: `docs/planning/features/2026-05-26-landing-page-saas.md` (landing page that links into Super Admin's domain) and `docs/planning/features/2026-05-26-organization-signup.html.md` (public sign-up form that feeds Pending into `organizations.html`)
- Existing prototype patterns reused: `prototype/admin/dashboard.html` (KPI strip + 2-col + activity), `prototype/admin/properties.html` (filter card + table + modal + pagination), `prototype/admin/users.html` (segmented tab control), `prototype/admin/profile.html` (Account + Security + Activity)
- Design tokens authority: `prototype/assets/styles.css` lines 1–520 — every token referenced in §2.0.5 verified by line number
