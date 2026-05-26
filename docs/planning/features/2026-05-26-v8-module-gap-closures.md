# v8 Module Gap Closures — fixes to existing 6 modules

| Field | Value |
|---|---|
| Status         | proposed |
| Started        | 2026-05-26 |
| Shipped        | — |
| SRS row        | (refines existing v1 rows for Modules 1–6; no new BLs) |
| Test cases     | TC-GAP-USER-001..004 · TC-GAP-PROP-001..006 · TC-GAP-LEASE-001..012 · TC-GAP-MAINT-001..018 · TC-GAP-RENT-001..006 · TC-GAP-DASH-001..016 |
| Prototype todo | row to be added on ship (covers ~14 pages) |

## 1. Requirement (as given)

> Plan the gap-closure UI changes for all 6 existing modules in a single planning file. These are fixes to existing prototype pages, NOT new features. Today is 2026-05-26.
>
> Per `docs/product/Solution_Overview.docx` v8 §Fixes in Existing Modules:
>
> **Module 1 — Users & Access**: Create-User role dropdown restricts to Property Manager + Maintenance Team only (no Admin / Tenant / Super Admin).
>
> **Module 2 — Properties & Units**: property reassignment completes end-to-end (modal → confirm → success) on `prototype/admin/property-detail.html`; property creation form on `prototype/admin/properties.html` "+ New" gets an amenities multi-select sourced from Master Data.
>
> **Module 3 — Leases & Tenants** (Per-Room Leasing handled separately): Admin gets a lease-creation UI path; lease renewal flow on `prototype/pm/lease-detail.html` allows adding/removing tenants on the new lease; early-termination flow on `prototype/pm/lease-detail.html` completes end-to-end (request → per-co-tenant consent panel → finalize).
>
> **Module 4 — Maintenance Requests**: per-request detail view (admin + PM) showing full timeline; close/reopen workflow exposed per BL-15 + UR-3; Admin can reassign across properties; active-lease gate + maintenance category sourced from Master Data on request creation; PM-raised requests on a tenant's unit appear on the tenant's portal; 5+ maintenance requests alert on the Admin dashboard when a single lease (or single room in shared accommodation) raises 5+ requests in one calendar month.
>
> **Module 5 — Rent Collection**: Admin-facing record-payment surface; late-fee + outstanding balance refresh live (no "as of last calc" indicator).
>
> **Module 6 — Dashboards**: Admin gets rent collection %, overdue tenant count, open maintenance by priority, upcoming lease expirations; PM dashboard mirrors the same metrics scoped to assigned properties; Maintenance Team dashboard replaced with a daily-queue dashboard (assigned tickets by priority and status); Tenant dashboard gets rent status, outstanding, recent payments, and active maintenance in one place.

Constraints from the user brief:
- Do not include Per-Room Leasing (separate file: `2026-05-26-per-room-leasing.md`).
- Do not include Master Data / Settings / Delegations work (already in `2026-05-26-admin-module-additions.md`).
- Output is the planning file only — no prototype HTML edits in this task.

## 2. Plan

### 2.0 Rules check (CLAUDE.md)

| Rule | Bearing on this plan |
|---|---|
| Scope rule **B** — public Org sign-up is in scope; Tenant accounts auto-create at lease signing; PM/Maintenance created by Admin | Drives Module 1 — the Create-User dropdown drops Admin/Tenant/Super Admin from the role options. |
| Scope rule **D** — only PM/Admin record payments (BL-10) | Drives Module 5 — the new Admin record-payment surface lives on Admin's `rent.html`; Tenant and Maintenance must not see it. |
| Scope rule **E** — no auto-approval timers (BL-08/BL-09) | Drives Module 3 — termination UI must surface every co-tenant's consent explicitly; finalize button stays disabled until all responses are recorded. |
| Scope rule **I** — prototype is the design contract | Every token cited below maps to a line in `prototype/assets/styles.css`. No new tokens. |
| Scope rule **J** — DD/MM/YYYY · ₹ Indian grouping · Asia/Kolkata | All dates rendered DD/MM/YYYY; all money via `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })`. |
| Working rule **9** — prototype kept in sync with live app | All edits land in `prototype/` first, then ported to `apps/web/` in a later feature; `prototype-changes.md` gets one row per page on ship. |
| `gharsetu-ui` skill, hard rule **No hamburger menus** | No new tabbar tabs introduced; any Admin-overflow goes through the existing MoreSheet (`prototype/admin/users.html:261`). |
| `gharsetu-ui` skill, hard rule **Form validation contract** | Every new form (Admin lease-create, termination consent, record-payment) uses `.label` / `.input` / `.field-error.show` per `prototype/assets/styles.css:122-170`. |

### 2.1 Module 1 — Users & Access

| Page | Current state | Fix |
|---|---|---|
| `prototype/admin/users.html` | Create-User role `<select>` (`prototype/admin/users.html:133-138`) offers four options: `PROPERTY_MANAGER`, `MAINTENANCE`, `ADMIN`, `TENANT`. | Reduce to two options only: `PROPERTY_MANAGER` (default) and `MAINTENANCE`. Update the helper copy directly under the heading (`prototype/admin/users.html:130`) to read "Add a Property Manager or Maintenance Team member. Admins are created during organization sign-up; tenants are auto-created at lease signing." Keep the existing `onchange` toggle that reveals the Maintenance "Speciality" row. |
| `prototype/admin/users.html` filter chips at lines 46-49 | Show "Admins · 2", "Property Managers · 18", "Maintenance · 8", "Tenants · 114". | No change — these are filters across **existing** users, not the create-form role list. Admins exist (created via Org sign-up) and Tenants exist (lease signing); they remain filterable. |

Design tokens cited:
- Form input + label: `prototype/assets/styles.css:122-170` (`.input`, `.label`, `.field-error`).
- Modal: `prototype/assets/styles.css:470-483` (`.modal-backdrop`, `.modal`).
- Helper-copy muted text: `prototype/assets/styles.css:501` (`.muted`).

Role boundaries:
- Super Admin never appears in any of these dropdowns (platform role, never inside an org's user list).
- Admin never appears (created during org sign-up → already on the list, never re-created here).
- Tenant never appears (auto-created at lease signing).

### 2.2 Module 2 — Properties & Units

| Page | Current state | Fix |
|---|---|---|
| `prototype/admin/property-detail.html` | "Amenities" rendered as a static read-only row at line 68. No reassignment action visible. | Add a "Reassign Property Manager" `btn btn-secondary` in the Property header action cluster. Clicking it opens a modal (`.modal-backdrop` / `.modal`) with: (a) read-only property name, (b) current PM, (c) `<select class="input">` of eligible PMs from the org, (d) optional reason `<textarea class="input">`, (e) Cancel + Confirm buttons (`btn-secondary` + `btn-primary`). On Confirm → success toast / inline `.alert badge-paid` banner replaces the modal. |
| `prototype/admin/properties.html` (+ New form) | Line 195-196: amenities is a free-text `<input class="input" placeholder="e.g. Lift, Power backup, …">`. | Replace with a multi-select chip pattern: a `<select class="input" multiple size="6">` listing amenities sourced from the Master Data Amenities entity, plus a help line below in `.muted text-sm` reading "Sourced from Master Data → Amenities. Manage list under Settings." On selection, render selected items as removable chips above the select. Each chip = `.badge.badge-prepaid` plus a small × button (`aria-label="Remove {amenity}"`). The underlying `<select>` stays visible for screen-reader navigation. |

Design tokens cited:
- Modal: `prototype/assets/styles.css:470-483`.
- Buttons: `prototype/assets/styles.css:77-100` (`.btn`, `.btn-primary`, `.btn-secondary`).
- Alert / success banner: `prototype/assets/styles.css:461-468` (`.alert`).
- Chip rendering reuses `.badge.badge-prepaid` (`prototype/assets/styles.css:53-67`).
- Form: `prototype/assets/styles.css:122-170`.

Master-data dependency: the Amenities list is owned by `2026-05-26-admin-module-additions.md`. This planning file consumes it; it does not specify the master-data UI itself.

### 2.3 Module 3 — Leases & Tenants

Pages touched: `prototype/admin/property-detail.html` (new "Create Lease" action), `prototype/pm/lease-detail.html` (renewal + termination flows), and the existing `prototype/pm/leases.html` listing.

#### 2.3.1 Admin lease-creation path — decision

**Chosen path: action on `prototype/admin/property-detail.html`** (add "+ Create Lease" `btn btn-primary` in the page header, opening a multi-step drawer). Rationale:
- Admin already lands on the unit from `property-detail.html` to see vacancy.
- A standalone `prototype/admin/leases.html` page would duplicate the PM `leases.html` listing scoped to one property and add a sidebar item, which violates the Admin tabbar already at its 5-tab cap.
- Drawer pattern matches existing flows (termination, co-tenant add) and keeps the user in context.

Open question for sign-off in §4: should the Admin drawer route to the same backend endpoint as PM lease creation, or should it carry an `actor: ADMIN` audit context? (Proposed default: same endpoint, audit log captures `actor_role = ADMIN`.)

#### 2.3.2 Lease renewal — add/remove tenants on the new lease

Current state: `prototype/pm/lease-detail.html:60-61` has an "+ Add Co-tenant" button on the **active** lease only.

Fix: when PM (or Admin) clicks "Renew Lease" (existing button in the lease detail's renewal section), open a drawer with:
1. Pre-filled new lease term (start date defaults to current end + 1 day; end date defaults to start + tenure).
2. Editable rent (subject to BL-11 — see §2.3.4).
3. **Tenants on the new lease** — a card showing every current primary + co-tenant with a `Remove` link (`btn-secondary` small variant), plus an "+ Add Tenant" row that opens an inline form (full-name, phone, email, primary/co flag).
4. Submit button = `btn btn-primary` "Create Renewal" — disabled until at least one primary tenant remains.

Design tokens: `.card`, `.btn-primary`, `.btn-secondary` (lines 78-119), `.label`/`.input` (122-170).

#### 2.3.3 Early-termination — per-co-tenant consent panel

Current state: `prototype/pm/lease-detail.html:136-140` — a single `btn btn-danger` "Terminate Early" wired to `confirm('Terminate this lease early? …')` then `alert('Termination recorded. …')`. No consent capture.

Fix: replace the alert chain with a three-step inline flow on the same page:

**Step 1 — Request**: clicking "Terminate Early" replaces the button with an inline section (`.card`) titled "Termination request" containing:
- Termination reason `<textarea class="input">` (required, ≥ 20 chars — re-use the `.counter` pattern at `prototype/assets/styles.css:486-487`).
- Proposed effective date — date input, defaults to today + 30 days, must be ≥ today.
- Submit `btn btn-danger` "Submit termination request" → moves to Step 2.

**Step 2 — Per-co-tenant consent panel**: a `.card` listing every tenant on the lease in a table with columns "Tenant · Role · Consent". Each row has three radio choices: Pending / Approved / Declined. Pending state shows `.badge.badge-partial`; Approved → `.badge.badge-paid`; Declined → `.badge.badge-overdue`. Finalize button stays `:disabled` (Tailwind `.btn:disabled` from line 99) until every tenant row is non-Pending.

**Step 3 — Finalize**: Finalize button (`btn btn-danger` "Finalize termination") becomes enabled. On click → confirm modal (`.modal`) summarizing: number of approvals, number of declines, effective date. Confirming writes a success banner (`.alert` with `badge-paid` tone) and replaces the lease's status badge with `badge-terminated`. If any tenant declined, the page shows a blocking `.alert.alert-emergency` with copy "One or more co-tenants declined termination. The lease remains active. Open a new request after addressing concerns." per BL-08 / BL-09.

Design tokens:
- Card: `prototype/assets/styles.css:111-120`.
- Counter: `prototype/assets/styles.css:486-487`.
- Badges: lines 53-75.
- Alert variants: lines 461-468.
- Disabled button: line 99.

#### 2.3.4 BL-11 cross-cutting visual contract

The renewal drawer's "Rent" input must show a 60-day notice banner whenever the new rent differs from current. Reuse `.alert` (line 461) with `role="status" aria-live="polite"` and copy "Tenants must be notified by DD/MM/YYYY before this rent takes effect. Effective date: DD/MM/YYYY (60 days from today)." Effective date input is clamped via the validator (no native `min` per `gharsetu-ui` hard rule 6).

### 2.4 Module 4 — Maintenance Requests

Pages touched: `prototype/admin/maintenance.html`, `prototype/pm/maintenance.html`, `prototype/tenant/maintenance.html`, `prototype/maintenance/dashboard.html`, **two new pages** `prototype/admin/maintenance-detail.html` + `prototype/pm/maintenance-detail.html`, and `prototype/admin/dashboard.html` for the 5+ alert.

#### 2.4.1 Per-request detail view (Admin + PM)

New pages: `prototype/admin/maintenance-detail.html` and `prototype/pm/maintenance-detail.html`. Page layout:

1. **Header**: request ID, unit reference, current `badge-open` / `badge-progress` / `badge-resolved` / `badge-closed`, priority chip, raised-by line.
2. **Summary card**: description, category, photos (text-only stub — "No file uploads" per scope rule K).
3. **Timeline card** (`.card`, `.section-title` "Timeline"): a vertical list of events — created · assigned · status changes · notes · close/reopen — each with a slate timestamp in DD/MM/YYYY HH:mm and an author. Use `.divider` between events. Each event uses a 10px coloured dot keyed to status colour tokens (lines 16-26).
4. **Actions card** (right-rail on desktop, stacked below on ≤1023px):
   - Admin variant: Reassign (across properties), Reassign technician, Change priority, Close, Reopen.
   - PM variant: Reassign technician, Change priority, Close, Reopen. PM cannot reassign across properties.

#### 2.4.2 Close / reopen workflow (BL-15 + UR-3)

State machine surfaced in UI:
- `RESOLVED` → Tenant sees "Confirm close" `btn-primary`; PM/Admin see "Close on behalf of tenant" `btn-secondary` (audit logs the actor).
- `RESOLVED` or any open state → Tenant / PM / Admin can hit "Reopen" `btn-secondary` from the detail page or the listing row.
- `CLOSED` → no Reopen affordance is rendered anywhere (the action is removed from the action card).

Copy contract: when an open request has not been touched in 7 days, surface an inline `.alert badge-partial` "No activity in 7 days. Consider checking in with the technician." (BL-15 follow-up nudge, UI-only.)

#### 2.4.3 Admin cross-property reassignment

On `prototype/admin/maintenance.html` (listing) and the new Admin detail page, the "Reassign" action opens a modal with two `<select class="input">` rows — Property and Unit (Unit options re-fetch on Property change), then optional technician picker. Confirm button = `btn-primary`. PM's listing does **not** show this action.

#### 2.4.4 Active-lease gate + Master Data category

On every "New Request" surface (PM, Tenant, Admin), the form:
- Pulls the unit list filtered to units with an active lease only. Each option's `data-active-lease` attribute drives a visible warning if a unit becomes inactive while the form is open.
- Replaces the existing free-text "Category" input with a `<select class="input">` sourced from Master Data Maintenance Categories (owned by `2026-05-26-admin-module-additions.md`). Empty list → form shows `.alert badge-partial` "Maintenance categories not configured. Contact your Admin."
- Submit `btn-primary` stays `:disabled` until an active-lease unit is selected and a category is chosen.

#### 2.4.5 PM-raised requests visible on tenant portal

`prototype/tenant/maintenance.html` currently filters by `requested_by_id = current_user.id`. Fix: filter by `unit_id IN (active tenant's units)` so PM-raised tickets for the tenant's unit appear in the list. Each row adds a small slate label "Raised by Property Manager" or "Raised by you" under the request title, font 12px Inter.

#### 2.4.6 5+ requests Admin dashboard alert (single lease / single room)

On `prototype/admin/dashboard.html`, insert a new `.alert` section above the KPI grid when, in the current calendar month, any one lease (or any one room under shared accommodation) has produced 5 or more requests. Copy: "{N} lease(s) have raised 5+ maintenance requests this month — review for systemic issues."

- Alert variant: `.alert` (`prototype/assets/styles.css:461`) with `border-left-color: var(--color-status-partial)` (already default for `.alert`); use `.alert-emergency` only when N ≥ 10.
- Clicking the alert links to `maintenance.html?filter=high-frequency`.
- Shared-accommodation rule depends on Per-Room Leasing (separate planning file). Until that ships, the count is computed at the lease level only. Documented as **carry-over** in §6.

### 2.5 Module 5 — Rent Collection

| Page | Current state | Fix |
|---|---|---|
| `prototype/admin/rent.html` | Listing of leases with paid/overdue tones; no record-payment button (see grep above). | Add a "Record Payment" `btn btn-primary` in the page header. Clicking opens a modal mirroring PM's existing modal: lease picker, amount (paise input but displayed `₹` formatted), payment date, method (Cash / Bank transfer / UPI / Cheque), reference (optional), notes (optional). On submit → success banner + table row updates inline. Admin variant must show every lease across the org (not scoped to a single PM). |
| `prototype/admin/rent.html`, `prototype/pm/rent-collection.html`, `prototype/tenant/rent.html` | "Outstanding" + "Late fee" columns / values may carry an "as of {last calc}" indicator from earlier iterations. | Remove any "as of …" muted hint. Numbers are recomputed on render. If a backend recompute is in-flight, surface a `role="status"` spinner inline next to the number — `border-radius: 50%; width: 12px; height: 12px;` using `.muted` colour. Once resolved, replace with the value. |

Role boundary: TENANT and MAINTENANCE never see the Record Payment button on any page. Verified at template level — the button block is wrapped behind the role guard.

Design tokens: `.btn-primary` (line 93), `.modal` (lines 470-483), `.alert` (461), `.muted` (501).

### 2.6 Module 6 — Dashboards

Each dashboard is fully redesigned within the existing token system. No new components beyond `.kpi-grid` and `.card`.

#### 2.6.1 Admin dashboard (`prototype/admin/dashboard.html`)

Current KPI row: Properties · Total Units · Occupied · Overdue (₹).

Fix — KPI grid grows to **8 cards**:
- Properties (existing)
- Total Units (existing)
- Occupancy % (existing, rephrased to "Occupancy")
- **Rent collection %** — current calendar month: collected / billed × 100. KPI value 32px Poppins 700; meta shows "₹X collected of ₹Y billed".
- **Overdue tenants** — count of tenants with at least one overdue invoice. Meta: total overdue amount ₹.
- **Open maintenance by priority** — three small chips inside one card (Emergency · High · Normal). Use `.badge-overdue` / `.badge-partial` / `.badge-prepaid` respectively.
- **Upcoming lease expirations** — count of leases ending within 60 days. Meta: clickable "View list".
- **5+ requests this month** (existing alert from §2.4.6 above sits over the grid).

Add a section below the grid: "Lease expirations in the next 60 days" — `.data-table` (lines 449-459) with columns Lease · Property · Unit · End date (DD/MM/YYYY) · Days remaining · PM. Empty state: `.muted` text "No expirations in the next 60 days."

#### 2.6.2 PM dashboard (`prototype/pm/dashboard.html`)

Mirror Admin's 8-KPI layout but scope every number to assigned properties only:
- Properties (assigned)
- Units (across assigned properties)
- Occupancy %
- Rent collection % (assigned)
- Overdue tenants (assigned)
- Open maintenance by priority (assigned)
- Upcoming lease expirations (assigned)
- 5+ requests this month (assigned) — same alert pattern as Admin.

#### 2.6.3 Maintenance Team dashboard (`prototype/maintenance/dashboard.html`)

Current state per the user brief: "errors / unusable". Quick inspection shows it exists at 142 lines. Replace whatever's there with a daily-queue layout:

- **Today's queue** card at the top: `.data-table` of tickets assigned to the current technician, sorted by priority then created-at. Columns: Priority badge · Title · Unit · Created · Status badge · Action ("Open"). Priority badge uses `.badge-overdue` (Emergency), `.badge-partial` (High), `.badge-prepaid` (Normal).
- **KPI strip** (3 cards): Assigned today · In progress · Resolved (this week).
- **All open** link below the table → `all-open.html` (already exists).
- No rent · no lease · no financial data anywhere (BL-21).
- 4-tab tabbar from the gharsetu-ui skill remains: My Requests · All Open · Profile · Logout. No MoreSheet.

#### 2.6.4 Tenant dashboard (`prototype/tenant/dashboard.html`)

Current state: basic lease snapshot. Fix — single-page summary with four sections stacked (vertical rhythm via `.section`):

1. **Lease snapshot** — existing card with unit, rent, end date.
2. **Rent status** — large badge (`.badge-paid` / `.badge-partial` / `.badge-overdue`) plus "Next due: DD/MM/YYYY" and "Outstanding: ₹X". If overdue, append the BL-04/BL-05 late-fee line.
3. **Recent payments** — `.data-table` of last 5 payments. Columns: Date · Amount · Method · Reference.
4. **Active maintenance** — list of the tenant's open requests with status badges. Each item links to the tenant maintenance detail.

Tabbar stays 5 tabs per the skill: My Lease · Rent · Maintenance · Visitors · Profile.

### 2.7 Files to touch (this feature, when implementation begins)

| Path | Change | Owner |
|---|---|---|
| prototype/admin/users.html | Role dropdown → 2 options; helper copy | gharsetu-frontend |
| prototype/admin/property-detail.html | Reassign-PM modal · Admin "Create Lease" action | gharsetu-frontend |
| prototype/admin/properties.html | Amenities multi-select replaces free-text input | gharsetu-frontend |
| prototype/pm/lease-detail.html | Renewal drawer (add/remove tenants) · 3-step termination flow | gharsetu-frontend |
| prototype/admin/maintenance.html | Cross-property Reassign action | gharsetu-frontend |
| prototype/admin/maintenance-detail.html | New page — Admin per-request detail | gharsetu-frontend |
| prototype/pm/maintenance-detail.html | New page — PM per-request detail | gharsetu-frontend |
| prototype/pm/maintenance.html | Link rows to new detail page; close/reopen actions | gharsetu-frontend |
| prototype/tenant/maintenance.html | Filter widened to `unit_id`; "Raised by" label | gharsetu-frontend |
| prototype/admin/dashboard.html | 5+ requests alert · 8-KPI grid · expirations table | gharsetu-frontend |
| prototype/pm/dashboard.html | 8-KPI grid scoped to assigned properties | gharsetu-frontend |
| prototype/maintenance/dashboard.html | Replace with daily-queue dashboard | gharsetu-frontend |
| prototype/tenant/dashboard.html | Rent + outstanding + recent payments + active maintenance | gharsetu-frontend |
| prototype/admin/rent.html | Admin Record-Payment action + modal · remove "as of last calc" | gharsetu-frontend |
| prototype/pm/rent-collection.html · prototype/tenant/rent.html | Remove any "as of last calc" indicator | gharsetu-frontend |

### 2.8 Open decisions for user sign-off (§4)

1. **Admin lease-creation entry point** — recommended path is an action button on `property-detail.html` opening a drawer (not a new `admin/leases.html` page). Confirm? (proposed default: yes.)
2. **Reassign-PM audit context** — same backend endpoint as PM creation with `actor_role = ADMIN` in audit log, or a separate endpoint? (proposed default: same endpoint, audit captures actor.)
3. **5+ requests window** — calendar month (1st → end-of-month) or rolling 30 days? Brief says "one calendar month"; we'll use calendar month. Confirm.
4. **Maintenance category list** — if Master Data → Categories is empty when this ships, do we block new request creation or fall back to a hard-coded short list? (proposed default: block + show alert; the Admin-additions plan ships Categories on day one.)
5. **Tenant dashboard ordering** — Rent status above or below Active maintenance? (proposed default: Lease → Rent → Recent payments → Maintenance.)

## 3. Test cases (designed up front)

Conventions used: H = High, M = Medium, L = Low. "Five widths" = 360 / 414 / 768 / 1024 / 1440 px. WCAG AA = axe-clean (no critical) + keyboard reachable + visible focus + colour contrast ≥ 4.5:1 body / 3:1 large.

### 3.1 Module 1 — Users & Access (TC-GAP-USER-NNN)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-GAP-USER-001 | Role dropdown lists only PM + Maintenance | Logged in as Admin | Open Create User modal · inspect role `<select>` | Exactly two options visible: "Property Manager" (default selected) + "Maintenance Staff". No Admin / Tenant / Super Admin. | H |
| TC-GAP-USER-002 | Helper copy reflects new policy | Logged in as Admin | Open Create User modal | Helper line reads "Admins are created during organization sign-up; tenants are auto-created at lease signing." | M |
| TC-GAP-USER-003 | PM / Maintenance / Tenant roles 403 on /users POST UI | Logged in as PM (or Tenant or Maintenance) | Attempt to reach Create-User surface | UI does not expose the button; if URL hit directly, 403 page shown. | H |
| TC-GAP-USER-004 | Maintenance Speciality row reveals only for MAINTENANCE | Admin opens modal | Select Property Manager, then Maintenance Staff | Speciality row hidden for PM, visible for Maintenance. | M |

### 3.2 Module 2 — Properties & Units (TC-GAP-PROP-NNN)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-GAP-PROP-001 | Reassign PM modal opens & submits | Admin on property-detail.html with a property assigned to PM "A" | Click Reassign PM · choose PM "B" · enter reason · Confirm | Modal closes · inline `.alert badge-paid` "Reassigned to PM B" · header now shows PM B · audit log row created (covered by BE tests, here we assert the UI). | H |
| TC-GAP-PROP-002 | Reassign cancels cleanly | Admin · same start | Open modal · Cancel | Modal closes · no change · focus returns to Reassign button. | M |
| TC-GAP-PROP-003 | Reassign forbidden to PM/Maintenance/Tenant | Logged in as PM | Visit property-detail.html for an unassigned property | Reassign button not rendered. | H |
| TC-GAP-PROP-004 | Amenities multi-select populated from master data | Admin · Add Property | Open + New modal | Select shows the active Amenities list (alphabetical). | H |
| TC-GAP-PROP-005 | Amenity chips render + remove | Admin · Add Property | Select 3 amenities · click × on one | Chip removed · `<select>` option re-selectable. | M |
| TC-GAP-PROP-006 | Amenity multi-select keyboard-accessible | Admin · Add Property | Tab into `<select multiple>`, use Space / arrows | Selection updates; `aria-label` on each × chip announces "Remove {amenity}". | H |

### 3.3 Module 3 — Leases & Tenants (TC-GAP-LEASE-NNN)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-GAP-LEASE-001 | Admin sees "Create Lease" on property-detail | Logged in as Admin · vacant unit visible | Open property-detail.html | "+ Create Lease" `btn-primary` rendered in header. | H |
| TC-GAP-LEASE-002 | Admin lease create end-to-end | Admin · vacant unit | Open drawer · fill tenant + dates + rent · Submit | Lease appears in lease list · success banner · drawer closes. | H |
| TC-GAP-LEASE-003 | PM / Tenant / Maintenance do not see Admin Create-Lease | Logged in as PM | Visit property-detail.html | "+ Create Lease" not rendered (PM has its own create flow elsewhere). | M |
| TC-GAP-LEASE-004 | Renewal drawer lists current tenants | PM on lease-detail · active lease has 2 co-tenants | Click Renew Lease | Drawer shows both tenants with Remove links. | H |
| TC-GAP-LEASE-005 | Renewal: add tenant | PM · renewal drawer open | Click + Add Tenant · fill name/phone/email · Save | New tenant appears in the list. | H |
| TC-GAP-LEASE-006 | Renewal: cannot remove last primary | PM · renewal drawer with 1 primary + 1 co | Remove primary | Remove link disabled with tooltip-equivalent inline note "At least one primary tenant is required." | H |
| TC-GAP-LEASE-007 | Renewal: 60-day rent banner | PM · change rent value | Type new rent in drawer | Banner appears with effective date = today + 60 days · `role="status" aria-live="polite"`. | H |
| TC-GAP-LEASE-008 | Termination Step 1 — request submits | PM on lease-detail · active lease | Click Terminate Early · enter reason ≥ 20 chars · pick date | Step 2 (consent panel) appears with one row per tenant. | H |
| TC-GAP-LEASE-009 | Termination Step 1 — reason <20 chars blocks submit | PM | Enter "Too short" (9 chars) | Submit `:disabled` · `.counter.error` shown. | M |
| TC-GAP-LEASE-010 | Termination Step 2 — finalize stays disabled while any tenant pending | PM | Leave one tenant on Pending · click Finalize | Button is `:disabled` · no action. | H |
| TC-GAP-LEASE-011 | Termination Step 3 — all approvals finalize lease | PM | Mark all approved · Finalize · confirm modal · Confirm | Lease badge becomes `badge-terminated` · success banner shown. | H |
| TC-GAP-LEASE-012 | Termination — any decline blocks finalize | PM | Mark one tenant Declined | Finalize remains disabled · `.alert.alert-emergency` rendered explaining BL-08/BL-09. | H |

### 3.4 Module 4 — Maintenance Requests (TC-GAP-MAINT-NNN)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-GAP-MAINT-001 | Admin detail page renders timeline | Admin · request with 3 events | Open maintenance-detail.html | Timeline lists 3 events in chronological order with DD/MM/YYYY HH:mm. | H |
| TC-GAP-MAINT-002 | PM detail page renders timeline | PM | Same | Same. | H |
| TC-GAP-MAINT-003 | Tenant confirms close on resolved request | Tenant · request status RESOLVED | Click Confirm Close | Status moves to CLOSED · Close button removed · Reopen no longer offered. | H |
| TC-GAP-MAINT-004 | Reopen from CLOSED is not possible | Tenant · CLOSED request | View detail | No Reopen button rendered. | H |
| TC-GAP-MAINT-005 | PM closes on behalf of tenant | PM · RESOLVED request | Click Close on behalf | Status → CLOSED · audit row shows PM actor. | M |
| TC-GAP-MAINT-006 | Admin cross-property reassign | Admin · OPEN request on Property A | Reassign · choose Property B · Unit · Confirm | Request now scoped to Property B Unit; PM filter for Property A no longer shows it. | H |
| TC-GAP-MAINT-007 | PM cannot reassign across properties | PM | Open detail | Cross-property reassign action not rendered (only reassign technician within own property). | H |
| TC-GAP-MAINT-008 | Active-lease gate blocks request on inactive unit | Tenant whose lease was terminated | Visit new-request form | Submit disabled · alert "This unit has no active lease". | H |
| TC-GAP-MAINT-009 | Category list sourced from Master Data | Admin has 5 categories configured | Tenant opens new-request form | Category `<select>` lists 5 active categories. | H |
| TC-GAP-MAINT-010 | Empty category list blocks creation | Master Data → Categories empty | Tenant opens new-request form | `.alert badge-partial` rendered · submit disabled. | M |
| TC-GAP-MAINT-011 | PM-raised request appears on tenant portal | PM raises request for tenant's unit | Tenant opens tenant/maintenance.html | Row visible with "Raised by Property Manager" label. | H |
| TC-GAP-MAINT-012 | Tenant request shows "Raised by you" | Tenant raises a request | Refresh listing | Row shows "Raised by you". | M |
| TC-GAP-MAINT-013 | 5+ requests alert on Admin dashboard | Lease has 5 requests in current month | Open admin/dashboard.html | `.alert` rendered above KPIs · count = 1 · clicking links to filtered listing. | H |
| TC-GAP-MAINT-014 | Alert escalates to emergency tone at ≥10 | Lease has 10 | Open dashboard | `.alert.alert-emergency` variant rendered. | M |
| TC-GAP-MAINT-015 | Alert not shown when below threshold | Highest lease has 4 | Open dashboard | Alert section not rendered. | M |
| TC-GAP-MAINT-016 | Maintenance role sees no rent/lease columns on detail | Maintenance technician on detail page | Inspect cards | No rent · no lease · no payment data visible (BL-21). | H |
| TC-GAP-MAINT-017 | Timeline keyboard navigable | Any role | Tab through events | Each event focusable · focus ring visible (saffron 2px). | H |
| TC-GAP-MAINT-018 | Detail page responsive at 360/414/768/1024/1440 | Any role | Inspect at each width | At ≤1023px action card stacks below timeline · tabbar visible · no horizontal scroll. | H |

### 3.5 Module 5 — Rent Collection (TC-GAP-RENT-NNN)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-GAP-RENT-001 | Admin Record-Payment button visible | Logged in as Admin · rent.html | Open page | `btn-primary` "Record Payment" rendered in header. | H |
| TC-GAP-RENT-002 | Admin records payment end-to-end | Admin | Click Record Payment · choose lease across orgs's PMs · enter ₹18,000 · today · Cash · Submit | Modal closes · row in table updates inline · `.alert badge-paid` banner. | H |
| TC-GAP-RENT-003 | Tenant cannot see Record Payment (BL-10) | Tenant · rent.html | Open page | Button not rendered; direct POST → 403 on backend (covered by BE tests). | H |
| TC-GAP-RENT-004 | Maintenance cannot see Record Payment | Maintenance · attempts /rent | No access — sidebar/tabbar omit the link · direct URL → 403. | H |
| TC-GAP-RENT-005 | Late fee + outstanding refresh live | PM · overdue lease | Mark a payment via Record Payment | Outstanding number updates inline · no "as of …" hint visible anywhere on the row. | H |
| TC-GAP-RENT-006 | "as of last calc" string absent on all rent pages | Any role | grep rent pages | No occurrence of "as of" / "last calc" / "last computed" in user-facing copy. | M |

### 3.6 Module 6 — Dashboards (TC-GAP-DASH-NNN)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-GAP-DASH-001 | Admin dashboard 8-KPI grid | Logged in as Admin | Open dashboard.html | 8 KPI cards rendered · responsive collapses to single column at 360px (KPI grid min 180px per `prototype/assets/styles.css:439`). | H |
| TC-GAP-DASH-002 | Rent collection % accurate | Billed ₹10,00,000 · collected ₹8,50,000 this month | Open Admin dashboard | KPI shows 85% · meta "₹8,50,000 collected of ₹10,00,000 billed". | H |
| TC-GAP-DASH-003 | Overdue tenants count clickable | Admin · 8 overdue tenants | Click KPI | Navigates to `rent.html?filter=overdue`. | M |
| TC-GAP-DASH-004 | Open maintenance-by-priority chips render | Admin · 3 emergency · 7 high · 12 normal | Open dashboard | Three badges with counts · `.badge-overdue` / `.badge-partial` / `.badge-prepaid`. | H |
| TC-GAP-DASH-005 | Upcoming expirations table renders | Admin · 4 leases expiring in 60d | Open dashboard | Table lists 4 rows · dates DD/MM/YYYY · days-remaining numeric. | H |
| TC-GAP-DASH-006 | Empty expirations state | Admin · 0 leases expiring | Open dashboard | `.muted` empty-state copy rendered. | M |
| TC-GAP-DASH-007 | PM dashboard scoped to assigned properties | PM assigned to 3 properties out of 18 | Open pm/dashboard.html | Every KPI is computed from those 3 properties only. | H |
| TC-GAP-DASH-008 | PM dashboard excludes unassigned data | PM | Inspect KPIs | None of the 15 other properties' overdue, expirations, or maintenance influences any number. | H |
| TC-GAP-DASH-009 | Maintenance daily-queue renders | Technician with 5 tickets assigned today | Open maintenance/dashboard.html | Today's-queue table renders sorted by priority. | H |
| TC-GAP-DASH-010 | Maintenance dashboard has no rent/lease (BL-21) | Same | Inspect DOM | No rent, lease, or payment word in user-facing copy. | H |
| TC-GAP-DASH-011 | Maintenance KPI strip accurate | Same | Inspect | "Assigned today" "In progress" "Resolved this week" reflect real counts. | M |
| TC-GAP-DASH-012 | Tenant dashboard renders all 4 sections | Tenant with active lease | Open tenant/dashboard.html | Lease snapshot · Rent status · Recent payments · Active maintenance — all four cards visible. | H |
| TC-GAP-DASH-013 | Tenant overdue rendering | Tenant 8 days overdue | Open dashboard | `.badge-overdue` shown · inline copy "Includes ₹X late fee" per BL-04/BL-05. | H |
| TC-GAP-DASH-014 | All dashboards responsive at 5 widths | Each role | Inspect at 360/414/768/1024/1440 | KPI grid wraps · tabbar visible ≤1023px · sidebar visible ≥1024px · no horizontal scroll. | H |
| TC-GAP-DASH-015 | All dashboards axe-clean | Each role | Run axe-core | No critical or serious violations. | H |
| TC-GAP-DASH-016 | All dashboards en-IN locale | Each role | Inspect numbers / dates | Dates DD/MM/YYYY · money via Indian grouping (₹1,80,000 style) · no MM/DD/YYYY. | H |

### 3.7 Cross-cutting coverage notes

- Role boundaries explicitly tested in TC-GAP-USER-003, TC-GAP-PROP-003, TC-GAP-LEASE-003, TC-GAP-MAINT-007, TC-GAP-MAINT-016, TC-GAP-RENT-003 / 004, TC-GAP-DASH-008 / 010.
- Accessibility floor in TC-GAP-PROP-006, TC-GAP-MAINT-017, TC-GAP-DASH-015 (the rest get an axe sweep when promoted to `Test_Cases.md`).
- Responsive at five widths in TC-GAP-MAINT-018 and TC-GAP-DASH-014.
- Locale + currency in TC-GAP-MAINT-001, TC-GAP-DASH-005, TC-GAP-DASH-013, TC-GAP-DASH-016.
- Super Admin is intentionally not exercised here — none of these six modules surface on the platform role; org-scoped only.

## 4. Sign-off

Open questions (proposed defaults shown in §2.8) — awaiting user response before promoting status to `in-progress`:

1. Admin lease-create entry point (drawer on property-detail vs new page) — _pending_.
2. Reassign-PM audit context (same endpoint vs separate) — _pending_.
3. 5+ requests window (calendar month vs rolling 30 days) — _pending_.
4. Master-Data empty-category fallback (block vs hard-coded list) — _pending_.
5. Tenant dashboard section order — _pending_.

## 5. Execution log

| Date | Agent | Task | Result |
|---|---|---|---|
| 2026-05-26 | gharsetu-frontend | Modules 4, 5, 6 prototype implementation | 10 files edited / 2 new files created — see §6 |

## 6. Files changed

_Running ledger — to be populated once a specialist edits files._

| File | Change | Touched by |
|---|---|---|

## 7. Agents used

| Agent | Task | Status |
|---|---|---|
| gharsetu-lead | Planning file authored | accepted (this commit) |

## 8. Post-deploy

_Empty._

## 9. Cross-references

- `docs/product/Solution_Overview.docx` v8 §Fixes in Existing Modules
- `docs/planning/features/2026-05-26-admin-module-additions.md` (owns Master Data → Amenities + Categories)
- `docs/planning/features/2026-05-26-per-room-leasing.md` (separate; informs the shared-accommodation portion of TC-GAP-MAINT-013)
- `prototype/assets/styles.css` (lines cited inline)
- `gharsetu-ui` skill
- `harness-engineering` skill (worker ≠ checker — implementation will land via gharsetu-frontend; tester verifies; lead flips state)
