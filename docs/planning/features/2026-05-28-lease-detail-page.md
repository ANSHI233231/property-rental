# Admin Lease Detail Page (`admin/lease-detail.html`)

| Field | Value |
|---|---|
| Status         | proposed |
| Started        | 2026-05-28 |
| Shipped        | — |
| SRS row        | §4 Module 3 (Leases & Tenants) — pending SRS amendment on ship |
| Test cases     | TC-LD-LAYOUT-001..006 · TC-LD-SUMMARY-001..005 · TC-LD-TENANTS-001..004 · TC-LD-RCS-001..010 · TC-LD-ACTIONS-001..006 · TC-LD-STATUS-001..005 (~36 cases) |
| Prototype todo | row to be added to `./../prototype-changes.md` on ship |
| Parent plan    | [`./2026-05-28-lease-feature-plan.md`](./2026-05-28-lease-feature-plan.md) — master Lease feature plan (Revision 3); this file is the lease-detail spin-out |

## 1. Requirement (as given)

> User's verbatim spec for `admin/lease-detail.html` (2026-05-28):
>
> - **Page title** at top reads `Lease #L-XXXX`.
> - **Renew button + Early Termination button** placed at the top right, alongside the title (right-of-title, NOT in a separate Actions card at the bottom).
> - **Lease Summary card** — clean read-only display of all lease facts: lease type, property/unit/room, start, end, status, rent, deposit, due day, notice period, late fee, created on, created by.
> - **Tenants card** — primary + co-tenants with name, phone, email, a "Primary" badge for the primary. Read-only. Each tenant clickable to their tenant profile (no admin tenant-detail page exists yet — placeholder href).
> - **Rent Change Schedule card** — THE ONLY editable section on the page. Admin can add / edit / remove future rent-change entries. Past entries (effective < today) are locked/historical.
> - **What is editable after lease creation: ONLY the Rent Change Schedule.** Verbatim: "Only Rent Schedule Change only this can be allowed after lease is created no other modification allowed it in no tenant change no lease details change."
> - **Renew + Early Termination buttons are placeholders only** — fire a toast saying the flow is coming soon. Both flows are deferred to separate planning sessions. The user explicitly flagged early termination as needing a separate design discussion because of BL-08 (per-co-tenant consent).

## 2. Plan

### 2.0 Where this page sits in the IA

The page is the **read-only-plus-rent-schedule** detail surface for any single lease. Two ways operators arrive:

1. From `admin/leases.html` — the listing's `Lease #` column and the row's `View detail` link both target `admin/lease-detail.html?id=L-XXXX` (per the master plan's Revision 3 §2.7). The listing's Action column carries no inline status-driven actions; everything moves here.
2. From `admin/unit-detail.html` — the existing Leases table's "View detail" link per row will target this page once it exists. Today those links point to `pm/lease-detail.html` as a stand-in (carry-over from before this build); they switch over to `admin/lease-detail.html` as a follow-up sweep, not in this build.
3. From `admin/users.html` (tenant detail flow) — eventually, "view this tenant's leases" will list-and-link here. Not in scope this build.

PM has its own `pm/lease-detail.html` (built earlier). This admin page **reuses its visual language verbatim** (cards, section titles, grid 2-col fact pairs, status badges, modal pattern for the Rent Change Schedule). The differences vs the PM page are intentional and narrow:

| Aspect | PM page (existing) | Admin page (this build) |
|---|---|---|
| Page title | `Lease #L-2103 — Rohan Mehta` (lease # + tenant name) | `Lease #L-XXXX` (lease # only, per user spec) |
| Renew + Terminate | Inline multi-step flows on the page (Renew drawer + 3-step termination consent flow built into the page) | Both are **placeholder buttons that fire toasts** — actual flows deferred |
| Co-tenants | Editable section with "Add Co-tenant" button | Read-only Tenants card; no edit |
| Lease Summary | Read-only | Read-only (same) |
| Rent Change Schedule | One pending change + an empty-state form | Multi-entry schedule (add / edit / remove), with past entries locked |
| Documents card | Present (placeholders) | **Omitted** — user spec did not list it; file uploads are out of scope (Scope rule K) |
| Renew + Terminate UI position | Bottom of page in their own cards | **Top right of page header**, alongside the title (per user spec) |

### 2.1 Page structure — the 5 blocks

In source order, top to bottom:

```
┌───────────────────────────────────────────────────────────────────────┐
│ <header class="topbar">                                                │
│   ☰ menu      Page title: Lease #L-2103          [Renew] [Terminate]  │
└───────────────────────────────────────────────────────────────────────┘

┌─ Lease Summary ──────────────────────────────────────────────────────┐
│  Lease type · Property · Unit (+ Room) · Start · End · Status        │
│  Monthly rent · Security deposit · Rent due day · Notice · Late fee  │
│  Created on · Created by                                              │
└──────────────────────────────────────────────────────────────────────┘

┌─ Tenants ────────────────────────────────────────────────────────────┐
│  Primary tenant card — Name [Primary] · phone · email                │
│  Co-tenant 1 card — Name [Co-tenant] · phone · email                  │
│  Co-tenant 2 card …                                                   │
└──────────────────────────────────────────────────────────────────────┘

┌─ Rent Change Schedule ───────────────────────────────────────────────┐
│  [+ Schedule rent change] (top right)                                 │
│  Table: Effective date · From rent → To rent · Scheduled on · Status  │
│        · Action (Edit / Remove for future; locked for past)           │
│  (Empty state when no entries: inline empty card with single CTA)     │
└──────────────────────────────────────────────────────────────────────┘
```

#### Block 1 — Page header

- Existing topbar with the standard `☰` drawer toggle on the left.
- Page title: `<h1 class="page-title">Lease #L-XXXX</h1>` — text only; no subtitle (no `— Rohan Mehta` suffix per user spec). The mock value: `Lease #L-2103`.
- Two buttons rendered to the **right of the title** inside the topbar (use a `flex items-center justify-between` wrapper inside the topbar): a primary "Renew Lease" button + a danger "Early Terminate" button. Order: Renew first (primary, saffron), Terminate second (danger, red). Both `\!py-2 \!text-sm`.
- Mobile (≤1023px): if the topbar gets cramped, the two buttons wrap below the title on a second line. Do NOT collapse into a kebab menu — the user wants both buttons visible.

#### Block 2 — Lease Summary card

A read-only `<section class="card mb-6">` mirroring the PM page's "Lease Summary" pattern (lines 64–78 of `pm/lease-detail.html`) but with the field set the user asked for. Rendered as a 2-column flex-justify-between grid of label/value pairs.

Fields, in order (12 rows, 6 per column on desktop):

| Label | Sample value | Source |
|---|---|---|
| Lease type | Unit-wise (or Room-wise) | derived from `lease.room_id IS NULL` vs not |
| Property · Unit | `Green Valley, Dwarka` / `Unit 3A` (combined-cell pattern) — for room-wise: `Sai Heights, Lajpat Nagar` / `Unit PG-101 · Room A` | listing-side convention reused; full-width row spanning both columns |
| Start date | 15/04/2026 | DD/MM/YYYY |
| End date | 14/04/2027 | DD/MM/YYYY |
| Status | `<span class="badge badge-active">Active</span>` (or appropriate badge) | per the 4-status taxonomy |
| Monthly rent | ₹18,000 | Indian grouping |
| Security deposit | ₹36,000 | Indian grouping |
| Rent due day | 5th of each month | from Settings at signing |
| Notice period | 30 days | from Settings at signing |
| Late fee | 2% | from Settings at signing |
| Created on | 14/04/2026 | DD/MM/YYYY |
| Created by | Raj Sharma · Admin | user name + role |

**Property · Unit** row is rendered as one full-width row inside the card (spans both columns of the grid) to accommodate the muted-sub-text pattern. All other rows are the standard `flex justify-between` label/value pair from the PM page (line 68 idiom).

**Card is fully read-only.** No "Edit" affordance anywhere. No inline editors. The user statement is verbatim: nothing on this card may change after lease creation.

#### Block 3 — Tenants card

A `<section class="card mb-6">`. Inside, a vertical stack of tenant blocks, one per tenant:

```html
<div class="flex items-center gap-3 py-3 border-b border-mid-gray last:border-b-0">
  <div class="avatar" style="width:44px;height:44px;font-size:16px;">RM</div>
  <div class="flex-1">
    <div class="font-poppins font-semibold text-charcoal">
      Rohan Mehta
      <span class="badge badge-active" style="vertical-align:middle;">Primary</span>
    </div>
    <div class="text-sm muted">+91 98765 43290 · rohan.mehta@example.com</div>
  </div>
  <a href="users.html?tenant=rohan-mehta" class="text-royal-blue font-poppins font-semibold text-sm">View profile</a>
</div>
```

Primary tenant carries a `badge badge-active` "Primary" badge inline with the name. Co-tenants carry `badge badge-prepaid` "Co-tenant". No co-tenant section if there are no co-tenants — just the primary block alone.

**Tenant profile link target:** the prototype admin scope does not yet have a `tenant/profile` or `admin/tenant-detail` page. Options:
1. Plain text (no link) — simplest, but loses the affordance.
2. Placeholder href to `users.html?tenant=<slug>` (the existing users page, scoped by query string) — link works visually but lands on a generic users list. Acceptable as a placeholder.
3. Stub HTML comment + visually-styled-as-link text that does nothing on click.

**Recommended default: option 2.** The `users.html` page already exists and listing-by-tenant is a natural fit; the user can refine later. Document the choice explicitly. (See §4 Q4.)

**No "Add Co-tenant" button** — the card is read-only per user spec. (PM's page has one; admin's does not.)

#### Block 4 — Rent Change Schedule card

The ONLY editable block on the page. Structure:

```
<section class="card mb-6">
  <div class="flex items-center justify-between mb-4">
    <h3 class="section-title m-0">Rent Change Schedule</h3>
    <button class="btn btn-primary \!py-2 \!text-sm" onclick="openScheduleModal()">+ Schedule Rent Change</button>
  </div>

  <\!-- Empty state shown when no entries exist -->
  <div id="rcs-empty-state" class="text-sm muted text-center py-6">
    No rent changes scheduled yet. Use "+ Schedule Rent Change" to add one.
  </div>

  <\!-- Table shown when entries exist -->
  <div id="rcs-table-wrap" class="p-0 overflow-x-auto">
    <table class="data-table">
      <thead>
        <tr><th>Effective date</th><th>From → To</th><th>Scheduled on</th><th>Scheduled by</th><th>Status</th><th>Action</th></tr>
      </thead>
      <tbody>
        ...rows...
      </tbody>
    </table>
  </div>
</section>
```

**Per-row content:**

| Column | Content | Notes |
|---|---|---|
| Effective date | `01/04/2027` | DD/MM/YYYY |
| From → To | `₹18,000 → ₹19,500` | "From" is the rent in force immediately before the effective date (computed from the lease's starting rent + any earlier schedule entries already applied) |
| Scheduled on | `14/05/2026` | when the entry was created |
| Scheduled by | `Raj Sharma · Admin` | who created it (audit) |
| Status | `<span class="badge badge-prepaid">Scheduled</span>` for future; `<span class="badge badge-paid">Applied</span>` for past | "Applied" = effective_date ≤ today; "Scheduled" = effective_date > today |
| Action | Future entry: `Edit` + `Remove` buttons. Past (Applied) entry: locked — `<span class="muted text-xs">Locked — applied</span>` | no Edit / Remove for past |

**Mock data for the prototype** — seed three entries on Lease #L-2103 to exercise every state:

- Past (Applied): Effective 01/05/2026 · From ₹17,000 → ₹18,000 · Scheduled 14/03/2026 · by Raj Sharma · Locked
- Future (Scheduled): Effective 01/04/2027 · From ₹18,000 → ₹19,500 · Scheduled 14/05/2026 · by Raj Sharma · Edit / Remove
- Future (Scheduled): Effective 01/10/2027 · From ₹19,500 → ₹21,000 · Scheduled 14/05/2026 · by Raj Sharma · Edit / Remove

**The locking rule (history is immutable):**

- A row whose `effective_date < today` is locked. No Edit. No Remove. Visually muted Action cell.
- A row whose `effective_date ≥ today` is editable until the day before its effective date. On the morning of the effective date, the row's status flips from Scheduled → Applied via the daily cron (NR-10 covers lease-status auto-transitions; rent-schedule application is an adjacent cron — see §2.5 / Q5).
- The `From → To` value on the next future row is **computed dynamically** from the chain of preceding entries (or the lease's starting rent if none precede). The frontend prototype mocks this with static strings; the live build computes it.

**Validation rules** (enforced by the Add / Edit modal — see §2.2):

- New / edited effective_date must be `≥ today + 60 days` (BL-11 — the existing PM page already enforces this; admin matches).
- New / edited effective_date must be `< lease.end_date` — you cannot schedule a rent change for after the lease ends.
- Two entries on the same lease cannot share the same effective_date.
- The `To rent` amount must be a positive integer in paise on the wire; the prototype uses ₹ input (whole rupees).
- The `To rent` amount must be strictly different from the immediately preceding rent (no no-op entries).

**Status-aware behavior of the whole card:**

- Lease status `upcoming` — RCS card is **visible but disabled** (entries cannot be added; the "+ Schedule" button is disabled with a `title` tooltip: "Schedule rent changes only on active leases. This lease starts on DD/MM/YYYY."). Rationale: the lease hasn't started; the entire rent-from-signing applies; pre-creating a rent change on an unstarted lease muddies the audit.
- Lease status `active` — full add / edit / remove available on future entries; past entries locked.
- Lease status `expired` or `terminated` — card is fully read-only. "+ Schedule" button is **hidden** (not disabled). Edit / Remove on any remaining future entries is hidden — they are all locked.

#### Block 5 — Renew + Terminate (NOT a card — buttons in the header)

Per user spec, the Renew and Early Terminate actions live in the **top-right of the page header**, NOT in their own cards at the bottom of the page. The Renew / Terminate cards from `pm/lease-detail.html` (lines 159–256) are **NOT** ported to the admin page.

Both buttons are placeholders this build:

```html
<button class="btn btn-primary \!py-2 \!text-sm" onclick="gsToast.info('Renewal flow — coming soon')">Renew Lease</button>
<button class="btn btn-danger \!py-2 \!text-sm" onclick="gsToast.info('Early termination flow — coming soon')">Early Terminate</button>
```

Add HTML comments above each `<button>` linking to the deferred planning files (when those exist) — `<\!-- TODO: replace placeholder once docs/planning/features/<date>-lease-renewal-flow.md ships -->` and similar for termination.

**Status-aware visibility of the action buttons:**

| Lease status | Renew button | Early Terminate button |
|---|---|---|
| upcoming | Hidden | Visible (terminating an upcoming lease is effectively a Cancel-before-start — but the user wants the same Terminate button to cover this case; the actual flow will distinguish later) |
| active | Visible | Visible |
| expired | Visible (back-dated renewal — rare but possible) | Hidden |
| terminated | Hidden | Hidden |

Add `data-status-show="upcoming,active,expired"` and `data-status-show="upcoming,active"` attributes on the two buttons respectively, and toggle their visibility via a small JS snippet at the bottom of the page based on the seeded lease status. The prototype includes a status simulator (mirroring `unit-detail.html`'s pattern) — see §2.3.

### 2.2 Rent Change Schedule — add / edit / remove modals

Three modal dialogs reuse the existing `.modal-backdrop` + `.modal` pattern from `pm/lease-detail.html` (modify-schedule modal lines 260–281; cancel-schedule modal 284–294).

**Schedule (Add) modal:**

| Field | Validation |
|---|---|
| New rent amount (₹) | positive integer; strictly different from the chain-resolved "from" amount |
| Effective date (DD/MM/YYYY) | ≥ today + 60 days; < lease.end_date; not equal to any existing entry's effective_date on this lease |
| (optional) Reason / note | free-text textarea; appended to audit trail in live build, mock-only in prototype |

Footer: Cancel (secondary) + "Schedule Rent Change" (primary, saffron). Validation errors render inline under each field per the FE / BE parity rule (no HTML5 native).

**Edit modal:**

Same form, prefilled with the row's current values. Same validation rules. The same-effective-date check excludes the row being edited from the duplicate detection.

**Remove confirmation modal:**

Single line: `Remove the scheduled rent change of ₹19,500 effective 01/04/2027? The rent will continue at the previous scheduled amount.` Two buttons: Keep schedule (secondary) + Remove (danger).

Successful save / remove fires `gsToast.success('Rent change scheduled')` / `'Rent change updated'` / `'Rent change removed'`.

### 2.3 Status simulator

Mirror the `setUnitSimStatus` simulator pattern from `prototype/admin/unit-detail.html` lines 67–78 + 226–251, but for **lease status**. Top of the page (or just under the header) renders a dashed "Preview status" card with four buttons: Upcoming / Active / Expired / Terminated. Clicking one:

- Updates the Status badge in the Lease Summary card.
- Toggles the Renew + Terminate header buttons per the visibility table in §2.1 Block 5.
- Toggles the RCS card behavior per the status-aware rules in §2.1 Block 4.

This is the prototype-only convenience for reviewers; it ships with `<\!-- prototype-only -->` comments around it so the app port knows to strip it.

### 2.4 Lock rules — what is editable

To restate the user's verbatim constraint in plan-language:

| Surface | Editable? | Why |
|---|---|---|
| Page title | No | Derived from lease # |
| Lease Summary card (any field) | No | "no lease details change" |
| Tenants card (add / remove tenants, edit names, phones, emails, swap primary) | No | "no tenant change" |
| Rent Change Schedule — entries with `effective_date < today` (Applied) | No | History is immutable; audit trail |
| Rent Change Schedule — entries with `effective_date ≥ today` (Scheduled) | YES | Only when lease status is `active` |
| Rent Change Schedule — empty state add | YES | Only when lease status is `active` |
| Header Renew button | Placeholder (no real edit yet) | Deferred flow |
| Header Early Terminate button | Placeholder (no real edit yet) | Deferred flow + BL-08 design discussion needed |

### 2.5 Cron interaction (NR-10 follow-on — informational only for this prototype build)

Two adjacent crons interact with this page in the live build (out of scope for the prototype HTML, recorded for the backend dispatch):

- 00:05 IST — the existing NR-10 cron flips lease status `upcoming → active` on `start_date ≤ today`. From that moment the RCS card on this page becomes interactive (per §2.1 Block 4).
- 00:15 IST (new — proposed) — a rent-change applier cron flips each RCS row with `effective_date = today` from `Scheduled → Applied`, writes the new `monthly_rent_paise` onto the lease, and writes an `audit_log` row. The lease's `monthly_rent_paise` field is therefore mutable post-signing **only** via this cron — never via a direct API. BL-11's 60-day-notice rule is enforced at schedule-creation time, not at apply time.

This cron is brand-new and not covered by NR-10 as currently written. **Proposed NR-12** (to add on ship): *"Scheduled rent changes auto-apply at 00:15 IST on their effective date. The lease's `monthly_rent_paise` is updated, the rent-schedule row's status flips to Applied (locked), and an audit_log row is written with actor = `system`. There is no manual 'apply now' API."*

### 2.6 Files the implementation will touch

| File | Change | Touched by |
|---|---|---|
| `prototype/admin/lease-detail.html` | NEW file — see §2.1 layout | gharsetu-frontend |
| `prototype/admin/leases.html` | (already pointed at `lease-detail.html?id=...` by Revision 3 of the master plan — no change needed) | — |
| `prototype/admin/unit-detail.html` | Switch the existing per-row "View detail" links in the Leases sub-table from `pm/lease-detail.html` to `admin/lease-detail.html` (carry-over sweep) | gharsetu-frontend (in this build) |
| `docs/planning/features/2026-05-28-lease-feature-plan.md` | Update §2.9 to mark `lease-detail.html` as scoped to this planning file (status: planned, not deferred-indefinite) | gharsetu-lead (already done in Task 6) |
| `docs/planning/prototype-changes.md` | (deferred to ship) | gharsetu-frontend |

**Out of scope this build (deferred):**

- The actual Renewal flow (Flow F4) UI + logic — separate planning file + dispatch. Until that ships, the "Renew Lease" button on this page is a toast placeholder.
- The actual Early Termination flow (Flow F5 / F6) UI + logic — separate planning file + dispatch. The user has flagged this for **separate design discussion before any HTML lands** (see §4 Q1).
- PM mirror — `pm/lease-detail.html` already exists; deciding whether to rebuild it to match the admin layout (or keep both) is a separate session.
- Backend (`apps/api`) work — schema for `rent_change_schedules` table + the 00:15 IST applier cron (NR-12) + audit-log entries. Deferred to a backend dispatch.

### 2.7 BL / NR rules touched

| Rule | Status | Statement |
|---|---|---|
| BL-08 | unchanged (this build) | Early termination requires per-co-tenant consent. **Touched by Renew/Terminate UI deferral** — the placeholder button does not yet enforce BL-08; the actual flow build will. |
| BL-11 | unchanged | Rent changes require ≥60 days notice. Enforced at schedule-creation time in the Add / Edit modal (BL-11 lives in the validation). |
| NR-10 | unchanged | Lease status auto-transitions (upcoming → active at 00:05; active → expired at 00:10). |
| **NR-12 (proposed — new)** | **proposed** | Scheduled rent changes auto-apply at 00:15 IST on their effective date. Updates `lease.monthly_rent_paise`, flips the schedule row to Applied (locked), writes an audit_log row with `actor = system`. No manual "apply now" API. (See §2.5.) |

NR-12 is a backend rule; it is included here because the page's Status column / lock-after-apply behavior depends on it. The actual cron lands in the backend dispatch. Wire-stable rule ID per Scope rule G — NR-12 is the next free integer.

---

## 3. Test cases (designed up front)

Six namespaces, ~36 cases total. Priority: H = High, M = Medium, L = Low.

### TC-LD-LAYOUT — page structure (§2.1)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-LD-LAYOUT-001 | Page title is `Lease #L-XXXX` only | Open `admin/lease-detail.html?id=L-2103` | Read `<h1 class="page-title">` | Reads exactly `Lease #L-2103`; no tenant-name suffix | H |
| TC-LD-LAYOUT-002 | Renew + Terminate buttons in header | Open page | Inspect topbar | Two buttons right of the title: "Renew Lease" (primary) + "Early Terminate" (danger), in that order | H |
| TC-LD-LAYOUT-003 | Card order top-to-bottom | Open page | Read section titles | Order: Lease Summary · Tenants · Rent Change Schedule. No Documents card, no inline Renew/Terminate cards | H |
| TC-LD-LAYOUT-004 | Mobile wrap behavior | Resize to ≤1023px | Inspect header | Renew + Terminate wrap below the title on a second line; no kebab menu collapse | M |
| TC-LD-LAYOUT-005 | Prototype status simulator present | Open page | Inspect | Dashed "Preview status" card with 4 buttons (Upcoming / Active / Expired / Terminated) | M |
| TC-LD-LAYOUT-006 | Page has no helper captions under titles | Open page | Scan all section titles | No descriptive sub-text under any `<h3 class="section-title">` (project rule `no-helper-caption-text.md`) | M |

### TC-LD-SUMMARY — Lease Summary card (§2.1 Block 2)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-LD-SUMMARY-001 | All 12 fields present | Open page on a unit-wise lease | Read the card | Fields: Lease type · Property·Unit · Start · End · Status · Monthly rent · Security deposit · Rent due day · Notice period · Late fee · Created on · Created by | H |
| TC-LD-SUMMARY-002 | Property·Unit row uses combined-cell convention | Same | Inspect the Property·Unit row | Property name + locality on top in default colour; `Unit 3A` muted beneath (`text-xs muted`) | H |
| TC-LD-SUMMARY-003 | Property·Unit row for room-wise | Open page on a room-wise lease | Inspect | Muted line reads `Unit PG-101 · Room A` (unit + middle dot + room label) | H |
| TC-LD-SUMMARY-004 | Card is read-only | Open page | Inspect | No Edit affordance, no inline editors, no input fields anywhere on the card | H |
| TC-LD-SUMMARY-005 | Dates DD/MM/YYYY · ₹ Indian grouping | Inspect all values | Read | All dates DD/MM/YYYY (BL-23); all amounts `₹18,000` / `₹36,000` Indian grouping | H |

### TC-LD-TENANTS — Tenants card (§2.1 Block 3)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-LD-TENANTS-001 | Primary tenant badge | Lease has 1 primary + 1 co-tenant | Open page | Primary row carries `badge badge-active` "Primary"; co-tenant carries `badge badge-prepaid` "Co-tenant" | H |
| TC-LD-TENANTS-002 | Co-tenants only when present | Lease has just a primary (no co-tenants) | Open page | Card shows only the primary block; no empty co-tenant placeholder | M |
| TC-LD-TENANTS-003 | Tenant profile link target | Inspect "View profile" link | Read `href` | `users.html?tenant=<slug>` (placeholder per §2.1 Block 3 default) | M |
| TC-LD-TENANTS-004 | No Add Co-tenant button | Open page | Inspect | No "+ Add Co-tenant" affordance; card is read-only | H |

### TC-LD-RCS — Rent Change Schedule (§2.1 Block 4 + §2.2)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-LD-RCS-001 | Empty state | Lease seeded with no RCS entries | Open page | Empty card reads "No rent changes scheduled yet. Use '+ Schedule Rent Change' to add one."; the button is the lone CTA | H |
| TC-LD-RCS-002 | Table renders 3 mock entries | Default mock data | Open page | Table shows 1 Applied (past) + 2 Scheduled (future) entries; columns: Effective date · From → To · Scheduled on · Scheduled by · Status · Action | H |
| TC-LD-RCS-003 | Past entry is locked | Inspect the past row's Action cell | Read | Reads `Locked — applied`; no Edit / Remove buttons | H |
| TC-LD-RCS-004 | Future entry exposes Edit + Remove | Inspect a future row | Read | Edit button + Remove button visible | H |
| TC-LD-RCS-005 | Schedule modal opens | Click "+ Schedule Rent Change" | Inspect | Modal opens with empty New rent + Effective date inputs | H |
| TC-LD-RCS-006 | Schedule modal validates 60-day rule | Enter effective_date = today + 30 days; submit | Inspect | Inline field error: "Effective date must be at least 60 days from today (BL-11)" | H |
| TC-LD-RCS-007 | Schedule modal validates < lease.end_date | Enter effective_date > lease.end_date | Submit | Inline field error: "Effective date must be before the lease ends on DD/MM/YYYY" | H |
| TC-LD-RCS-008 | Schedule modal validates no-duplicate effective date | Enter an effective_date that already has an entry | Submit | Inline field error: "A rent change is already scheduled for this date" | M |
| TC-LD-RCS-009 | Edit modal prefills + saves | Click Edit on a future row | Inspect / save | Modal prefills with row values; Save updates the row + fires `gsToast.success('Rent change updated')` | H |
| TC-LD-RCS-010 | Remove confirmation + delete | Click Remove on a future row | Confirm | Modal asks "Remove the scheduled rent change of ₹X effective DD/MM/YYYY?"; confirming removes the row + fires `gsToast.success('Rent change removed')` | H |

### TC-LD-ACTIONS — Renew + Terminate placeholders (§2.1 Block 5)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-LD-ACTIONS-001 | Renew button is a placeholder | Lease status active | Click "Renew Lease" | `gsToast.info('Renewal flow — coming soon')`; no other UI change | H |
| TC-LD-ACTIONS-002 | Terminate button is a placeholder | Lease status active | Click "Early Terminate" | `gsToast.info('Early termination flow — coming soon')` | H |
| TC-LD-ACTIONS-003 | Buttons have TODO comments | Inspect HTML source | Read | `<\!-- TODO: replace placeholder once <renewal-planning-file>.md ships -->` and equivalent for termination | M |
| TC-LD-ACTIONS-004 | Neither flow opens a modal | Click each button | Inspect | No modal appears; no drawer; no inline form expansion. Toast only. | H |
| TC-LD-ACTIONS-005 | No co-tenant consent UI exists on the page | Search the source for "consent" | Read | Zero matches (the PM page's 3-step termination consent flow is NOT ported) | H |
| TC-LD-ACTIONS-006 | No Renew drawer / form on the page | Search the source for "Renew Lease Drawer" or "rl-start" | Read | Zero matches (the PM page's renewal drawer is NOT ported) | M |

### TC-LD-STATUS — status-aware visibility (§2.1 Block 5 + §2.1 Block 4)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-LD-STATUS-001 | Status `upcoming` | Click "Upcoming" in the simulator | Inspect | Renew hidden; Terminate visible; RCS card shows the +Schedule button disabled with tooltip "Schedule rent changes only on active leases. This lease starts on DD/MM/YYYY." | H |
| TC-LD-STATUS-002 | Status `active` | Click "Active" | Inspect | Renew visible; Terminate visible; RCS fully interactive (add/edit/remove on future entries) | H |
| TC-LD-STATUS-003 | Status `expired` | Click "Expired" | Inspect | Renew visible (back-dated); Terminate hidden; RCS card read-only (no +Schedule button; Edit/Remove on any remaining future entries hidden) | H |
| TC-LD-STATUS-004 | Status `terminated` | Click "Terminated" | Inspect | Renew hidden; Terminate hidden; RCS card fully read-only | H |
| TC-LD-STATUS-005 | Status badge in Summary follows simulator | Click each simulator button | Inspect Status row in Lease Summary | Badge updates to match (badge-prepaid / badge-active / badge-closed / badge-terminated) | M |

---

## 4. Open questions

These need user input before downstream builds; the lease-detail prototype itself does not block on them (placeholders are explicit). Listed in priority order.

### Q1 — Early Termination flow (BLOCKING the termination dispatch, NOT this build)

The user explicitly flagged early termination as needing a separate design discussion before any HTML lands. BL-08 says "termination requires all co-tenants' explicit consent" — but the operational shape of that consent is unspecified. Questions to answer before the termination planning file is drafted:

1. **Who raises the request?** The PM, the Admin, the primary tenant, or any co-tenant?
2. **How is consent collected?** Each co-tenant logs in and clicks Approve/Decline (their own action), OR the PM records their consent on their behalf (with audit trail of who-said-what-when, possibly with a SMS/email verification step), OR a hybrid?
3. **Is there a deadline for consent?** E.g. "all co-tenants must respond within 14 days, after which the request auto-cancels" — but Scope rule E says "no auto-approval timers." Does that prohibit auto-cancel too, or just auto-approve? (Recommended reading: confirm with user — the scope rule's intent is approve, not cancel-on-no-response.)
4. **What happens if one co-tenant declines?** The PM page's current UI shows an emergency-alert banner and keeps the lease active. Confirm that's the rule: one decline kills the request, full stop. No partial / negotiated terminations.
5. **What is the audit trail format?** Per BL-08, every consent action writes `audit_log` (actor, action, target_lease_id, timestamp, consent_value, free-text reason). Confirm fields.
6. **What about the deposit refund?** Is it triggered by the termination, or is it a manual follow-up step the PM/Admin records? (PM page currently treats it as a separate step.)
7. **Effective date of termination** — at request time? at last consent? user-specified with a min/max window?
8. **Cross-flow conflict** — if a renewal is in flight and a termination request comes in, which wins? Or are they mutually exclusive (cannot start a termination on a lease that has an open renewal)?

**Recommended action:** schedule a separate 45-min planning session with the user on these eight questions. The output is a new planning file `docs/planning/features/<date>-early-termination-flow.md`. Until then, the admin lease-detail page ships with the placeholder toast.

### Q2 — Renewal flow (Renewal dispatch, NOT this build)

Less fraught than termination — the PM page already has a working renewal drawer (`pm/lease-detail.html` lines 297–340). Questions for the user before re-using / adapting that drawer for admin:

1. Does the admin renewal flow differ from the PM one? (Recommended default: same drawer, opened from the admin page's "Renew Lease" header button.)
2. Should the renewed lease's `renewed_from_lease_id` be set automatically (lineage marker — per the master plan's Revision 1 §2.1 note)? Recommended default: yes.
3. Should a renewal carry the existing RCS entries forward? Recommended default: no — the renewal is a new lease with a fresh schedule; the operator can re-create scheduled changes on it manually.

**Recommended action:** quick decision from the user; if "same as PM, lineage on, no RCS carry-forward", we can fast-track the renewal port without a separate planning file.

### Q3 — Rent Change Schedule UX (modal vs inline)

The current spec uses **modal-per-entry** for Add / Edit / Remove. The alternative is an **inline-editable table** (click a row to expand into an inline form). Trade-offs:

- **Modal (recommended)** — matches the PM page's existing rent-schedule pattern (consistency); cleaner for the prototype; one focused task at a time; works fine on mobile.
- **Inline** — fewer clicks; can see surrounding rows for context. But: validation feedback gets cramped; mobile is harder; loss of pattern consistency with PM page.

**Recommended default: modal**, matching the PM page. Document the choice; revisit if the user wants inline later.

### Q4 — Tenant profile link target

The Tenants card's "View profile" link on each row needs a destination. Three options listed in §2.1 Block 3. **Recommended default: option 2** — link to `users.html?tenant=<slug>` (placeholder; the users page exists). Confirm with user; if they prefer plain text until a real admin/tenant-detail page is built, switch to that.

### Q5 — NR-12 rent-change applier cron

The proposed NR-12 (auto-apply rent change at 00:15 IST on effective date) needs user sign-off before the backend dispatch. Two specific sub-questions:

1. Should the cron also handle a "missed apply" case (e.g. the cron didn't run for 2 days, then runs and finds entries that should have applied during the gap)? Recommended default: yes — apply in effective-date order; write one audit row per applied entry.
2. Should the cron send any notification to the tenant when their rent changes apply? Recommended default: no for v1 (no SMS / WhatsApp / email business notifications per Scope rule K — but a banner appears on the tenant dashboard on next login).

### Q6 — Documents card omission

The PM page has a Documents card with placeholder links (lease agreement / move-in checklist / KYC). The user's spec for admin did not list it. Confirm: omit Documents from admin? Recommended default: omit. If the user wants parity, add it as a read-only card with the same placeholder copy.

---

## 5. Execution log

| Date | Event |
|---|---|
| 2026-05-28 | Planning file drafted by gharsetu-lead. Status: `proposed`. The admin/lease-detail.html prototype build is the next dispatch — pending the current frontend agent (`a239c5fb19af7bc02`) finishing its listing-delta second pass. Renewal flow + Termination flow are explicitly deferred to separate planning sessions; this page surfaces both as placeholder toasts. |

## 6. Files changed

| File | Change | Touched by |
|---|---|---|
| `docs/planning/features/2026-05-28-lease-detail-page.md` | This planning file | gharsetu-lead |
| `docs/planning/features/2026-05-28-lease-feature-plan.md` | §2.9 lease-detail row updated to point here (planned, not deferred-indefinite) | gharsetu-lead |
| `agent-team-change-logs/gharsetu-lead-2026-05-28.md` | Task 6 entry | gharsetu-lead |
| `prototype/admin/lease-detail.html` | (pending — new file per §2.1) | gharsetu-frontend |
| `prototype/admin/unit-detail.html` | (pending — switch View-detail links from `pm/lease-detail.html` to `admin/lease-detail.html`) | gharsetu-frontend |
| `docs/planning/prototype-changes.md` | (deferred to ship) | gharsetu-frontend |
| **Deferred** | Renewal flow planning + build · Termination flow planning + build (after user discussion) · PM page rebuild · backend RCS schema + NR-12 applier cron · apps/web port | — |

## 7. Agents used

| Agent | Task | Status |
|---|---|---|
| gharsetu-lead     | Plan drafting + dispatch brief                                                                            | ✅ accepted |
| gharsetu-frontend | Build `prototype/admin/lease-detail.html` (next dispatch after listing delta returns)                     | — pending — |
| gharsetu-tester   | TC-LD-LAYOUT/SUMMARY/TENANTS/RCS/ACTIONS/STATUS execution (~36 cases)                                     | — pending — |
| gharsetu-backend  | RCS schema + NR-12 applier cron + audit-log integration (deferred — separate dispatch)                    | — deferred — |
| gharsetu-security | VAPT on the RCS edit surface (deferred — separate dispatch)                                               | — deferred — |

## 8. Post-deploy

No issues yet — feature is at `proposed` status.

## 9. Cross-references

- [`./2026-05-28-lease-feature-plan.md`](./2026-05-28-lease-feature-plan.md) — master Lease feature plan (Revision 3). The listing-side `Lease #` link + `View detail` link target this page (Revision 3 §2.7).
- [`../../../prototype/pm/lease-detail.html`](../../../prototype/pm/lease-detail.html) — PM mirror, the visual / layout reference. The admin page reuses its card patterns, the modify/cancel schedule modal markup, the status-badge tokens. **It does NOT reuse** the inline Renew drawer (lines 297–340) or the 3-step termination consent flow (lines 169–256) — both deferred.
- SRS §4 Module 3 (Leases & Tenants), §5 BL-08, BL-11, NR-10, **NR-12 (proposed)**.
- Solution Overview v8 → §New Features → Leases & Tenants — the lease-detail surface.
- TEST_CASES — TC-LD-LAYOUT-001..006, TC-LD-SUMMARY-001..005, TC-LD-TENANTS-001..004, TC-LD-RCS-001..010, TC-LD-ACTIONS-001..006, TC-LD-STATUS-001..005 (promoted from §3 on ship).
- User convention: [`property-unit-combined-cell.md`](../../../.claude/projects/-Users-aayushsaini-projects-property-rental/memory/property-unit-combined-cell.md) — Property·Unit row in the Summary card follows this convention.
- User convention: [`no-helper-caption-text.md`](../../../.claude/projects/-Users-aayushsaini-projects-property-rental/memory/no-helper-caption-text.md) — no descriptive sub-text under section titles.
- User convention: [`no-back-links-on-detail-pages.md`](../../../.claude/projects/-Users-aayushsaini-projects-property-rental/memory/no-back-links-on-detail-pages.md) — no "← Back to Leases" affordance.
- [`./../prototype-changes.md`](./../prototype-changes.md) — row to be added on ship.
