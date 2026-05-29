# Lease Feature — End-to-End Plan (rooms as sub-entities · 5-step wizard · conflict validation · multi-lease tenants)

| Field | Value |
|---|---|
| Status         | proposed |
| Started        | 2026-05-28 |
| Shipped        | — |
| SRS row        | §4 Module 2 (Properties & Units) · §4 Module 3 (Leases & Tenants) · §5 BL-01 · §5 NR-9, NR-10, NR-11 (new) — pending SRS amendment on ship |
| Test cases     | TC-LEASE-NEW-ROOMS-001..010 · TC-LEASE-NEW-WIZARD-001..018 · TC-LEASE-NEW-CONFLICT-001..011 · TC-LEASE-NEW-STATUS-001..008 · TC-LEASE-NEW-LIST-001..011 · TC-LEASE-NEW-TENANT-001..006 (~63 cases) |
| Prototype todo | row to be added to `./../prototype-changes.md` on ship |

> **Revision history (2026-05-28):**
> - **Revision 1** (earlier today): per-unit `leasing_mode` + property-level default model **withdrawn**. Lease scope is decided at lease-create time, encoded on the lease itself (no property/unit field).
> - **Revision 2** (this revision, late 2026-05-28): **`renewed` status dropped.** Renewal now creates a brand-new `upcoming` lease; the original lease expires naturally to `expired`. The status enum collapses from 5 to 4 values. NR-10 cron simplified. NR-9 conflict filter simplified. UI "Ended" tile now maps to `expired` only (no merge). Test cases for `renewed` dropped. The user's reasoning: "When we renew a lease, we only create a new lease — we never change details on the existing lease. So there's no meaning of renewed status."
> - **Revision 3** (later same day, 2026-05-28): **`admin/leases.html` listing refactor refined.** Table column structure rewritten: drop the existing separate Property + Unit columns; add a **Lease Type** column (Unit-wise / Room-wise) and a **combined Property · Unit · Room** cell (property on top, unit beneath as muted sub-text — and for room-wise leases, unit + room beneath). The Actions column collapses to a single **View detail** link — all status-driven actions (Cancel-before-start / Renew / Terminate / Process-refund) move to the lease-detail page (separate, deferred build). Per user convention `property-unit-combined-cell.md`.

## 1. Requirement (as given)

> Final model agreed in chat (2026-05-28):
>
> 1. **Lease type is NOT a property or unit setting.** No "Default leasing mode" field on Add Property. No `leasing_mode` toggle on the Unit. Lease scope (unit-wise vs room-wise) is determined at lease creation time, implicit from what the user picks in the wizard.
> 2. **Rooms are sub-entities of a Unit.** Admin/PM can create rooms inside any unit from the Unit Detail page (`admin/unit-detail.html` gets a Rooms section, same UX pattern as Units inside `admin/property-detail.html`). Each room: label, monthly rent, status, optional notes. Rooms can be added/removed only while the unit has zero active or upcoming leases.
> 3. **Create Lease is a 5-step wizard with card grids (not dropdowns)** for property and unit selection — Step 1 Lease Type · Step 2 Select Property · Step 3 Select Unit (+ Room if room-wise) · Step 4 Tenants & Co-tenants · Step 5 Lease Details. Real-time conflict validation on Step 5 dates against any existing active/upcoming lease on the same unit (unit-wise) or same room (room-wise).
> 4. **Lease statuses** — four wire-stable smallint enums: `upcoming=1 · active=2 · expired=3 · terminated=4`. (No `renewed` — renewal creates a new lease; the prior lease expires naturally.) Listing UI shows exactly these four behind tiles `All · Upcoming · Active · Ended · Terminated`, where `Ended` = `status = 3 (expired)`. Two daily cron jobs auto-transition.
> 5. **Conflict rule (NR-9)** — pure date-range overlap on the same unit (unit-wise) or same room (room-wise). Closed on both ends — same-day handoff is a conflict. Only `upcoming` and `active` participate; `expired/terminated` are ignored. DB-level guard + API 409 + real-time UI check.
> 6. **Co-tenants on room leases** carry over unchanged from BL-04 / BL-08.
> 7. **Tenants may hold N active leases simultaneously** — system does not block. The wizard shows context panels for both the unit/room's lease history and the selected tenants' lease history so the creator can see the picture without being blocked.

## 2. Plan

### 2.1 The model — rooms as sub-entities of a unit; lease scope decided at create-time

The earlier-draft `leasing_mode` enum on units (and a `default_leasing_mode` field on properties) is **removed entirely** from this plan. A unit no longer carries a leasing-mode field. A property no longer carries a default. The Add Property modal is **untouched** (no field added, no field removed, no Edit affordance for leasing mode anywhere).

Instead:

- A `rooms` table is added as a sub-entity of `units`. A unit has zero or more rooms.
- A lease carries a `room_id` column. If `room_id IS NULL` the lease is unit-wise; if `room_id IS NOT NULL` the lease is room-wise. There is no separate `scope` enum needed — the presence of `room_id` is the scope marker. (Trade-off: a denormalized `scope` SMALLINT was proposed in the earlier draft as an index aid; this revision drops it. If query performance ever demands it, it can be added later as a generated/computed column without rewriting application logic.)
- A unit may carry both unit-wise leases (historically — i.e. `room_id IS NULL` rows) and, **at different times**, room-wise leases. Both shapes are not allowed to be simultaneously active or upcoming (that case is caught by the conflict rule NR-9 because a unit-wise lease overlaps every room of the unit; see §2.3 below).
- A lease optionally carries `renewed_from_lease_id` (FK-style, nullable) on a successor created via the Renewal flow F4. This is **metadata for lineage/reporting only** — it has no status implications and is not consulted by the auto-transition cron.

This shape matches the user's mental model: "rooms are stuff inside a unit, same as units are stuff inside a property". The IA mirrors `property → units` table-on-detail-page; the new `unit → rooms` table sits on the unit detail page.

**Implications for the Admin pages in scope:**

- `admin/properties.html` — **no changes.** No leasing-mode field anywhere.
- `admin/property-detail.html` — **no changes.** The existing Units sub-table stays as-is.
- `admin/unit-detail.html` — **gets a Rooms section** between the Leases section and the bottom of the page. Same visual pattern as the Units sub-table on property-detail (table + "+ Add Room" button + Edit/Retire per row, all gated by the lock rule in §2.5). Also: the Leases table itself stays visible across all unit statuses — `upcoming` rows must render even when the unit is currently Available / Listed / Under Maintenance; only the **active** row is gated to occupied (see §2.8).
- `admin/create-lease.html` — **fully replaced** by the 5-step wizard (§2.6).
- `admin/leases.html` — **status taxonomy + filter tiles updated** (§2.2).

### 2.2 Lease statuses — the four-status taxonomy

The SRS currently lists `active · expired · renewed · terminated` (§4 Module 3). After the 2026-05-28 user clarification on Renewal flow F4 (Revision 2 above), the model collapses to four values: `upcoming · active · expired · terminated`. The `renewed` value is gone — when a renewal happens, the operator creates a brand-new lease (with `start_date = old.end_date + 1` and, optionally, `renewed_from_lease_id` set for lineage). The original lease is not mutated; it simply runs out its term and the end-of-day cron transitions it to `expired`.

| Value (smallint — wire-stable) | Status | Semantics | How it's reached |
|---|---|---|---|
| 1 | upcoming | Lease saved with `start_date > today`. Tenant accounts created; unit/room not yet `occupied`. | Created directly with a future start date. |
| 2 | active | `start_date ≤ today ≤ end_date`. Unit (or room) is `occupied`. | Auto-transition from `upcoming` when start arrives; created directly when start = today. |
| 3 | expired | `end_date < today`. | Auto-transition on end-of-day cron. |
| 4 | terminated | Early termination via Flow F5 (single-tenant) or F6 (co-tenant consent). | Manual via PM/Admin action. |

**Numbering choice (Scope rule G — wire-stable, never renumber).** The plan is still pre-code (no shipped row uses any value yet), so renumbering `terminated` from the prior draft's `5` down to `4` is acceptable. We are choosing to **renumber `terminated → 4`** (no gap) because:

- The enum is brand-new on the wire (the older v1 build's status set is a different code path and is being superseded by this taxonomy).
- A contiguous 1–4 is easier to reason about than a 1–3 + 5 gap.
- The wire-stability rule binds once any client / API / DB row carries the value; it does not bind during pre-code planning iteration.

If preference shifts to leaving a gap (`terminated = 5`, slot `4` left reserved for a future status), the only place this affects in the build is the prototype's `data-status` attribute strings on `admin/leases.html` — and the prototype uses status **names** in the data attribute, not numbers, so even that is unaffected. **The frontend brief uses status names only; numeric codes ship later in the backend dispatch.**

**Auto-transition (NR-10, see §2.4):** two daily crons at 00:05 IST and 00:10 IST. `upcoming → active` at 00:05; `active → expired` at 00:10. Unit/room status follows in the same transaction. Audit log written actor = `system`.

### 2.3 Conflict rule — NR-9

> Two leases with `status IN (upcoming, active)` on the **same unit** (when both are unit-wise — i.e. `room_id IS NULL`) or the **same room** (when both are room-wise — i.e. share `room_id`) **must not** have overlapping `[start_date, end_date]` ranges. Intervals are closed on both ends — `new.start_date = old.end_date` is a conflict. Leases with status `expired` or `terminated` are excluded from the check.
>
> Cross-scope conflict: a unit-wise lease on Unit U **conflicts with every room-wise lease on every room of Unit U** in the same range. Equivalently — if any active/upcoming lease exists on Unit U (whether `room_id IS NULL` or any of U's rooms), no new unit-wise lease may overlap, AND if any active/upcoming **unit-wise** lease exists on U, no new room-wise lease on any of U's rooms may overlap. (This is the natural reading: leasing the whole unit out occupies every room.)

**Implementation surface** (for the eventual backend port — out of scope for this prototype build):

- DB level: Postgres `EXCLUDE USING gist` on `leases (unit_id WITH =, daterange(start_date, end_date, '[]') WITH &&) WHERE room_id IS NULL AND status IN (1,2)` for the unit-wise case; a second exclusion constraint on `(room_id, daterange…)` for the room-wise case; and a cross-check (DB constraint or service layer) that no unit-wise overlap exists when a room-wise lease is being created on the same unit (and vice-versa).
- API level: `LeaseConflictChecker` runs at `POST /api/v1/leases` and `PATCH /api/v1/leases/:id` and returns HTTP 409 with body `{ conflictingLeaseId, conflictingRange, conflictScope: "unit"|"room" }`.
- BL-01 stays — it's the live-only sub-case ("no two `active` leases on the same unit") and is now subsumed by NR-9.

**UI rendering of a conflict** (Step 5 of the wizard, real-time):

- Field-level error below the relevant date pickers:
  - Unit-wise: `Conflict: Lease #L-2204 (Rohan Mehta) occupies this unit from 01/04/2026 to 31/03/2027. Choose dates outside this range or terminate the existing lease first.`
  - Room-wise: `Conflict: Lease #L-2204 (Rohan Mehta) occupies Room A from 01/04/2026 to 31/03/2027. Choose a different room, choose dates outside this range, or terminate the existing lease first.`
- Submit button is **disabled** while a conflict exists. Re-enables the instant the dates clear the conflict (debounced 250 ms after date edits).

### 2.4 Auto-transition cron — NR-10

> A daily 00:05 IST job flips leases with `status = 1 (upcoming) AND start_date ≤ today` to `status = 2 (active)` and sets the corresponding unit (or room) to `occupied`. A daily 00:10 IST job flips leases with `status = 2 (active) AND end_date < today` to `status = 3 (expired)` and sets the corresponding unit (or room) back to `available` (unless a separate active lease exists on the same unit/room — possible in the room-wise + unit-wise overlap-of-history case across non-overlapping windows). Both jobs are idempotent. `status = 4 (terminated)` is only reachable via Flow F5/F6.

Note the simplification from Revision 1: the 00:10 cron no longer consults `renewed_from_lease_id` to choose between `expired` and `renewed`. Every active lease past its end date becomes `expired`. If the operator created a successor renewal lease, that successor moves `upcoming → active` independently via the 00:05 cron on its own start date. The renewal lineage is informational only.

### 2.5 Lock rules — when room/unit edit is forbidden

| Action | Locks when |
|---|---|
| Add/remove rooms on a unit | Unit has **any** lease with status in `{upcoming, active}` — whether unit-wise or on any of its rooms. |
| Edit a specific room (label, monthly rent, notes) | That room has any lease with status in `{upcoming, active}`. |
| Edit unit fields that affect lease economics (bedrooms, area, floor, default monthly rent for unit-wise) | Unit has any lease with status in `{upcoming, active}`, OR any of its rooms has any lease with status in `{upcoming, active}`. Status / tenant-display / address-style fields are still editable. |
| Create a new lease (any scope) | Only blocked if the proposed dates overlap an existing active/upcoming lease per NR-9. There is no other lock. |

**Why a unit-level lock for room CRUD even though the room itself may be vacant:** rooms are derivative of the unit they sit in. If the whole unit is rented out (unit-wise), adding or removing rooms changes the substance of what was leased. The simplest correct rule is "rooms only mutate while the unit is fully vacant of active/upcoming leases".

### 2.6 The Create Lease wizard — 5 steps

Replaces `prototype/admin/create-lease.html` end-to-end. The page is a single full-screen flow with a step progress indicator at the top, Back / Next buttons at the bottom (Next disabled until the current step is valid), and a Cancel link to `admin/leases.html`.

#### Step 1 — Lease Type

| Element | Content |
|---|---|
| Heading | "What kind of lease is this?" |
| Two radio cards | **Unit-wise** (icon + "The tenant leases the entire unit. Common for whole apartments and family homes.") and **Room-wise** (icon + "The tenant leases a single room within a unit. Common for PG-style and shared accommodations.") |
| Default | Unit-wise selected on first arrival; user can change freely until Next is clicked on Step 2 (changing the lease type after Step 2 resets the property + unit selection). |
| Validation | One must be selected. |

Implementation note: cards are large click-targets (≈160×140), keyboard-focusable, with a saffron border + check icon when selected (reuse the existing `.card.is-selected` pattern if present, else add a one-off class inline-scoped to this page).

#### Step 2 — Select Property

| Element | Content |
|---|---|
| Heading | "Which property?" |
| Layout | Card grid (3 columns desktop · 2 columns tablet · 1 column mobile per the single ≤1023px breakpoint). Each card: property name (Poppins semibold), address (small muted), badge row with unit count, badge row with room count (only when Step 1 = Room-wise — "12 rooms across 4 units"). Click selects. |
| Filtering | Step 1 = Unit-wise → all properties shown. Step 1 = Room-wise → only properties where at least one unit has at least one room. Properties that don't qualify are not rendered at all (not dimmed); a separate empty-state message reads "No properties have rooms yet. Create rooms from a unit's detail page first." |
| Validation | One card must be selected before Next enables. |
| Search | Inline search input at the top of the card grid (filters by name or address; existing `data-searchable` pattern is dropdown-only — needs a card-grid search variant, simple substring match is enough for the prototype). |

#### Step 3 — Select Unit (and Room if room-wise)

| Element | Content |
|---|---|
| Heading | "Which unit?" (and if Step 1 = Room-wise, after the unit is picked: "Which room?") |
| Unit card grid | Cards within the property selected on Step 2. Each card: unit number (e.g. "3A"), floor + bedrooms + area, monthly rent (unit-wise) or "Rooms: 4" (room-wise), and a status badge derived from the unit's current occupancy. Filtered by Step 1: Room-wise → only units with at least one room. Units with no rooms (when Step 1 = Room-wise) do not appear. |
| Unit card disabled state | A unit appears as a dimmed card with a reason badge in three cases: (Unit-wise) the unit already has an `upcoming` or `active` lease; (Room-wise) all rooms are already occupied/upcoming-occupied AND no proposed-range hint is available yet (conflict is the authoritative check, which lives on Step 5 — Step 3 only filters for trivially-disqualified units). Dimmed cards are not clickable. |
| Room card grid | Appears only when Step 1 = Room-wise, **after** a unit is picked. Cards: room label (e.g. "Room A"), monthly rent (room-level), status badge (Available / Occupied — Occupied rooms appear dimmed and unclickable). |
| Validation | Unit must be selected. When Step 1 = Room-wise, the room must also be selected. |

#### Step 4 — Tenants & Co-tenants

| Element | Content |
|---|---|
| Heading | "Who's renting?" |
| Layout | A vertical list of tenant rows. The first row is always present. Each row has: an input that doubles as **autocomplete search** ("Type a name, phone, or email to find an existing tenant — or type a new name to create one"), three secondary fields (Name · Mobile · Email — auto-filled and locked when an existing tenant is picked; editable when creating new), a Primary radio at the far right, and a Remove (×) affordance (hidden for the first row when it is the only row). |
| Search behavior | The autocomplete searches the org's existing tenants by name / phone / email substring. Results appear as a dropdown beneath the input — each result row shows name + phone + a small subtext "On lease #L-XXXX, ends DD/MM/YYYY" (or "No active leases"). Selecting a result snaps the row into "existing tenant" mode and auto-fills the three locked fields. |
| New-tenant mode | If the user keeps typing past the autocomplete (or no result matches), the row stays in "create new" mode. Name + Mobile become required; Email is optional. |
| Informational badge on existing tenants | When an existing tenant is selected, a small **badge** appears under the row reading e.g. `On 2 active leases · #L-2103, #L-1985`. This is **never** blocking — it is purely informational so the creator knows the picture (a tenant with two active leases is common for landlords leasing multiple PG rooms to the same person across buildings). |
| Primary radio | Exactly one tenant per lease must be marked Primary. The first row is Primary by default. Switching the radio to a different row demotes the previous one. |
| Add affordance | A `+ Add another tenant` button at the bottom of the list. Repeatable; no fixed cap in the prototype (the BL-04 co-tenant cap, if any, is a backend concern). |
| Validation | At least one tenant. Primary radio must be set. Each row: either a selected existing tenant (the search has resolved), or a complete new-tenant set (Name + Mobile valid). |

#### Step 5 — Lease Details

| Element | Content |
|---|---|
| Heading | "Lease terms" |
| Layout | Two-column on desktop: the left column is the form, the right column is the context panels (one above the other). |
| Form fields | **Start date** (DD/MM/YYYY, validated), **End date** (DD/MM/YYYY, validated, must be > start), **Monthly rent (₹)** auto-filled from Step 3's selected room/unit rent (editable), **Security deposit (₹)** auto-filled = 2 × monthly rent (editable), **Rent due day** (defaults from Settings — typically 5th), **Notice period (days)** (defaults from Settings — typically 30), **Late fee %** (defaults from Settings — typically 2%). All defaults are editable. |
| Conflict validation | Runs in real time on Start/End edits, debounced 250 ms. Hits the conflict-check endpoint (in prototype: a stub that consults the in-memory mock dataset). On conflict, renders the field-level error (§2.3 wording). Submit disabled while in conflict. |
| Context panel A — "Lease history for this unit/room" | Compact list of past + current + upcoming leases on the selected unit (unit-wise) or room (room-wise). Each item: lease number · tenant primary · date range · status badge. Sorted descending by start date. Helps the operator spot conflicts visually before the validator fires. |
| Context panel B — "Lease history for the selected tenant(s)" | One sub-panel per selected tenant. Each lists that tenant's leases across the entire org (all properties, all units/rooms). Sorted descending. Helps the operator confirm the tenant's footprint. |
| Submit | "Create Lease" primary button; disabled while any validation (including conflict) fails. On submit: lease is created and the operator is redirected to `admin/leases.html` with a `toast` confirming creation. |

**Across all steps:**

- Step progress indicator (1 / 5, 2 / 5, …) and step titles visible at the top.
- Back button on Steps 2–5 (returns to the prior step; selections preserved unless an upstream step is mutated, in which case downstream state is reset).
- Cancel link returns to `admin/leases.html` with no confirmation prompt (the page is a prototype-only flow; no destructive write happens until the final Step 5 submit).

### 2.7 The Leases listing — filter tiles + columns + actions

Updates to `prototype/admin/leases.html` only (PM clone is deferred per scope).

**Filter tiles (in this order, unchanged from Revision 2):**

| Tile | Filter logic |
|---|---|
| All | no filter |
| Upcoming | `status = 1 (upcoming)` |
| Active | `status = 2 (active)` |
| Ended | `status = 3 (expired)` |
| Terminated | `status = 4 (terminated)` |

Replaces the current four-tile arrangement (All · Active · Renewed · Terminated). The "Renewed" tile is gone (no renewed status exists). "Upcoming" is added between All and Active. "Ended" maps purely to `expired`.

**Table column structure (Revision 3 — applies to the refactor below):**

| # | Column | Content |
|---|---|---|
| 1 | # | Paginator serial (`data-pg-serial`). |
| 2 | Lease # | Clickable monospace link (`#L-XXXX`) → opens the lease-detail page when it ships; in this build the link routes to a stub `lease-detail.html?id=L-XXXX` (the file does not exist yet — see §2.9 / the dispatch note below). Until the stub is wired, the link can fall back to `unit-detail.html?lease=L-XXXX` so it doesn't 404 during click-through. |
| 3 | Lease Type | **Unit-wise** or **Room-wise.** Rendered as a small subtle badge (reuse `badge badge-renewed` for Room-wise blue tone, `badge badge-closed` for Unit-wise neutral tone — or plain muted text if the frontend agent judges the badges too visually loud given there are already Status + Lease# badges in adjacent cells). The frontend agent decides between badge vs plain text; document the choice in the return summary. |
| 4 | Property · Unit | **Combined cell** per the user convention [`property-unit-combined-cell.md`](../../../../.claude/projects/-Users-aayushsaini-projects-property-rental/memory/property-unit-combined-cell.md). Property name (or "Property, locality") on top in default text colour; unit + (for room-wise leases) room beneath as `<div class="text-xs muted">`. Examples: `Green Valley, Dwarka` / `Unit 3A` for a unit-wise lease; `Sai Heights, Lajpat Nagar` / `Unit PG-101 · Room A` for a room-wise lease. Replaces the prior separate Property and Unit columns. |
| 5 | Tenant(s) | Primary tenant name; if co-tenants exist, a small `+N` muted suffix. |
| 6 | Rent | `₹18,000` with Indian grouping. |
| 7 | Status | Badge per the table below. |
| 8 | Action | **View detail link only.** Plain `text-royal-blue font-poppins font-semibold text-sm` anchor reading `View detail` → routes to the lease-detail page (same target as the Lease # link). **No inline buttons.** No Cancel / Renew / Terminate / Process-refund anywhere in this cell. |

**Status badge taxonomy in the Status column (unchanged from Revision 2):**

| Status | Badge class | Label |
|---|---|---|
| upcoming | `badge badge-prepaid` (blue) | Upcoming |
| active | `badge badge-active` (green) | Active |
| expired | `badge badge-closed` (gray) | Ended |
| terminated | `badge badge-terminated` (red) | Terminated |

(No parenthetical "Ended (expired)" disambiguation — that was a relic of the merge-behind-Ended pattern that no longer applies.)

**Row actions are gone from this listing.** Cancel-before-start (for upcoming leases), Renew, Terminate, and Process-refund all now live on the **lease-detail page** — a separate file (`prototype/admin/lease-detail.html`) that does not exist yet and is **deferred** to a later planning file + dispatch. The user will likely ask for that build next; this plan does not cover it.

Two consequences of this decision the frontend agent must respect:

1. The Actions cell renders exactly `View detail` for every status. No conditional rendering by status. No placeholder buttons. No `gsToast.info(...)` stubs.
2. The Lease # column becomes meaningful — it must be clickable to the same target as `View detail`. (Two click-targets to the same destination per row is fine and matches the pattern already used elsewhere — e.g. tenants table on `admin/users.html`.)

If the lease-detail page does not exist when the frontend agent runs this build, the link targets `lease-detail.html?id=L-XXXX` and the agent ALSO leaves a small comment in the HTML noting the target file is pending. A `404` on click during prototype review is acceptable — the user has been told the detail page is a separate build.

### 2.8 The unit-detail page — adding the Rooms section + lease-table visibility fix

Updates to `prototype/admin/unit-detail.html` only (PM mirror has already been updated separately by the user — note it in the change log).

**(a) Rooms section** — a new section is inserted between the existing **Leases** table and the bottom of the page. Visual pattern mirrors the Units sub-table on `admin/property-detail.html`:

| Element | Content |
|---|---|
| Section header | `<h3 class="section-title m-0">Rooms in this unit</h3>` |
| Button | "+ Add Room" (top right of section header) — disabled with a tooltip when the unit has any active/upcoming lease (per §2.5). |
| Table columns | Label · Monthly rent · Status (Available / Occupied / Retired) · Current tenant (when Occupied) · Notes (truncated) · Actions (Edit · Retire) |
| Edit row action | Opens a modal with Label, Monthly rent, Notes (and a status dropdown that locks to non-Occupied options if the room is Occupied — see §2.5). |
| Retire row action | Same pattern as Retire-Unit on property-detail — required reason, soft status, blocked while the room has an active/upcoming lease. |
| Empty state | When the unit has no rooms yet: a small inset card reading "No rooms yet. Add rooms here if you plan to lease this unit room by room (PG style)." with the "+ Add Room" button as the single CTA. |

Mock data: seed three rooms on Unit 3A (Room A available, Room B occupied by a current tenant, Room C available) for demo continuity with the Leases page mock dataset.

**(b) Leases table visibility across all unit statuses** — the existing Leases table on `admin/unit-detail.html` (and the PM mirror) must remain visible regardless of the unit's current status. Specifically:

- Past leases (expired / terminated) are always visible — already correct.
- `upcoming` lease rows must be visible even when the unit's current status is Available / Listed / Under Maintenance / Retired. (A unit can have a signed-but-not-started future lease while currently vacant — the operator needs to see this row at all times.)
- Only the **active** lease row stays gated to `occupied` status — i.e. when the simulator flips out of `occupied`, only the active-lease row hides; upcoming/expired/terminated rows stay rendered.

The user has already applied the equivalent fix to both `admin/unit-detail.html` and `pm/unit-detail.html` (adding a 4th sample row `#L-2245 · Aditi Joshi · Upcoming · 01/04/2026 → 31/03/2027`). The frontend agent should preserve that work and only verify the simulator's show/hide JS targets only the active row (not the entire table). This is a verification step, not a re-implementation.

### 2.9 Files the implementation will touch — Admin only this build

| File | Change | Touched by |
|---|---|---|
| `prototype/admin/unit-detail.html` | Add Rooms section (table + Add/Edit/Retire room modals + lock states). Verify upcoming-row visibility across all unit statuses (user already fixed; preserve). | gharsetu-frontend |
| `prototype/admin/create-lease.html` | Full rewrite to 5-step wizard | gharsetu-frontend |
| `prototype/admin/leases.html` | Filter tiles → All · Upcoming · Active · Ended · Terminated; status badges (no renewed); **new column structure: # · Lease # · Lease Type · Property · Unit · Tenant(s) · Rent · Status · Action**; combined Property·Unit·Room cell; Action collapsed to single `View detail` link; seed at least one room-wise row so the Lease Type + combined-cell rendering is exercisable | gharsetu-frontend |
| `prototype/admin/lease-detail.html` | **Scoped to a spin-out planning file:** [`./2026-05-28-lease-detail-page.md`](./2026-05-28-lease-detail-page.md). Build is **planned** (not deferred-indefinite) — next dispatch after this build's listing delta returns. Renew + Early-Terminate flows are placeholder toasts on the page; the actual flows are deferred to their own planning sessions. Until the page ships, the leases-listing `Lease #` link + `View detail` link target `lease-detail.html?id=L-XXXX` and will 404 — acceptable. | gharsetu-lead (planned) → gharsetu-frontend (next build) |
| `prototype/admin/properties.html` | NO CHANGES — confirm no field is added or removed | gharsetu-frontend (verify only) |
| `prototype/admin/property-detail.html` | NO CHANGES — confirm no field is added or removed | gharsetu-frontend (verify only) |
| `prototype/assets/styles.css` | No new tokens expected (audit only — if a new class is needed, justify in PR comment) | gharsetu-frontend |
| `docs/planning/prototype-changes.md` | (deferred to ship) | gharsetu-frontend |

**Out of scope for this build (deferred to later sessions):**

- All PM pages (`pm/leases.html`, `pm/lease-detail.html`, `pm/unit-detail.html`, `pm/property-detail.html`) — PM clone is a separate dispatch. (PM unit-detail's lease-table visibility fix is already applied by the user; that is the only PM touch in this session.)
- Tenant pages and Maintenance pages.
- Super Admin pages.
- Backend (`apps/api`) work — schema + migration + service + cron + conflict checker. Deferred to a backend dispatch after the user signs off the prototype.

### 2.10 BL / NR rules — adds and amendments

| Rule | Status | Statement |
|---|---|---|
| BL-01 | unchanged | A unit can never have two `active` leases simultaneously. (Now subsumed by NR-9, which is broader.) |
| **NR-1** | **superseded by this plan's model** | The earlier "per-unit leasing_mode with property default + lock" formulation is **withdrawn**. Replacement statement: *Lease scope (unit-wise or room-wise) is determined at lease creation time and recorded on the lease itself via `lease.room_id` (NULL = unit-wise, non-NULL = room-wise). It is not a property setting and not a unit setting.* The lock framing moves to room-CRUD (§2.5), not lease-scope. |
| **NR-9 (new)** | **new** | Two leases on the same unit (both unit-wise) or the same room (both room-wise) with status in `{upcoming, active}` must not have overlapping date ranges, closed on both ends. Additionally: a unit-wise lease and a room-wise lease on the same unit are in conflict if their date ranges overlap. Rejected at create and edit time with HTTP 409. |
| **NR-10 (new)** | **new** | A lease's `status` auto-transitions on daily IST jobs: `upcoming → active` at 00:05 when `start_date ≤ today`; `active → expired` at 00:10 when `end_date < today`. `terminated` is only reachable via Flow F5/F6. There is no `renewed` status — renewal creates a new lease independently. |
| **NR-11 (new)** | **new** | A tenant may simultaneously hold multiple leases with status in `{upcoming, active}` — across the same property, across properties, on the same unit's different rooms, anywhere. The system does not restrict this. The Create Lease wizard surfaces a tenant's existing leases informationally (Step 4 badge + Step 5 context panel B), but never blocks. |

(Rule IDs respect Scope rule G — wire-stable IDs, never renumber. NR-9..NR-11 are new and take the next free integers after the existing NR-1..NR-8 in the SRS.)

### 2.11 Open dependencies before code starts

1. Confirm the unit-level lock for room CRUD (§2.5) is the right granularity. Proposed default: yes.
2. Confirm the cross-scope conflict in NR-9 (a unit-wise lease blocks all room-wise leases on the same unit in the same range, and vice-versa). Proposed default: yes.
3. Confirm that Step 4's tenant search hits org-scoped tenants only (no cross-org search). Proposed default: yes.
4. Confirm Step 5 auto-fill of security-deposit = 2 × monthly rent. Proposed default: yes, editable.
5. Confirm the default tile selection on `admin/leases.html` after the refactor — currently All. Proposed default: keep All as the default tile (no change).
6. Confirm the `terminated` status enum value is `4` (no gap) rather than `5` (with `4` reserved). Proposed default: `4` (contiguous). The prototype build is unaffected either way — names, not numbers, drive the data-status attributes.

---

## 3. Test cases (designed up front)

Six namespaces, ~62 cases total. Priority: H = High, M = Medium, L = Low.

### TC-LEASE-NEW-ROOMS — Rooms management on unit-detail (§2.8)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-LEASE-NEW-ROOMS-001 | Rooms section present on unit-detail | Admin on `admin/unit-detail.html` for a unit with no rooms | Open page | Section "Rooms in this unit" visible with empty-state card + "+ Add Room" button | H |
| TC-LEASE-NEW-ROOMS-002 | Add Room modal | Click "+ Add Room" on a vacant unit | Open modal | Modal shows Label · Monthly rent · Status · Notes; Save adds a row to the table | H |
| TC-LEASE-NEW-ROOMS-003 | Rooms table shape | Unit with 3 seeded rooms | Open page | Table with columns Label · Rent · Status · Current tenant · Notes · Actions | H |
| TC-LEASE-NEW-ROOMS-004 | Add Room disabled while unit has active lease | Unit has 1 active lease | Open page | "+ Add Room" button disabled with title tooltip "Cannot add rooms — unit has an active or upcoming lease." | H |
| TC-LEASE-NEW-ROOMS-005 | Add Room disabled while unit has upcoming lease | Unit has 1 upcoming lease | Open page | Same as -004 | H |
| TC-LEASE-NEW-ROOMS-006 | Edit Room available for vacant room | Room A is Available | Click Edit on Room A | Modal opens prefilled; Save updates the row | H |
| TC-LEASE-NEW-ROOMS-007 | Edit Room disabled for occupied room | Room B has active lease | Click Edit on Room B | Edit affordance disabled with tooltip "Cannot edit — room has an active or upcoming lease." | H |
| TC-LEASE-NEW-ROOMS-008 | Retire Room requires reason | Room A vacant | Click Retire on Room A | Modal opens with required reason textarea; submit without reason → field error | H |
| TC-LEASE-NEW-ROOMS-009 | Retire Room blocked while occupied | Room B occupied | Click Retire on Room B | Button disabled with tooltip | H |
| TC-LEASE-NEW-ROOMS-010 | Retire is soft — row stays with Retired badge | Retire Room A | Inspect table | Row remains with `badge-closed` "Retired"; no further actions; row is excluded from the create-lease wizard | M |

### TC-LEASE-NEW-WIZARD — 5-step create-lease wizard (§2.6)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-LEASE-NEW-WIZARD-001 | Step 1 renders two radio cards | Open `admin/create-lease.html` | Inspect Step 1 | Two cards visible: Unit-wise (default selected), Room-wise. Next disabled until one is selected (Unit-wise pre-selected so Next is enabled on arrival). | H |
| TC-LEASE-NEW-WIZARD-002 | Step 1 → Step 2 advances on Next | Click Next on Step 1 | Inspect | Step 2 visible; step indicator shows 2 / 5 | H |
| TC-LEASE-NEW-WIZARD-003 | Step 2 shows all properties for Unit-wise | Step 1 = Unit-wise; 4 seeded properties | Inspect grid | All 4 property cards visible | H |
| TC-LEASE-NEW-WIZARD-004 | Step 2 filters to properties with rooms for Room-wise | Step 1 = Room-wise; 2 of 4 properties have rooms | Inspect grid | Only those 2 property cards visible; others not rendered | H |
| TC-LEASE-NEW-WIZARD-005 | Step 2 empty state when Room-wise + no rooms | Step 1 = Room-wise; no property has rooms | Inspect grid | Empty-state message: "No properties have rooms yet…" | M |
| TC-LEASE-NEW-WIZARD-006 | Step 2 search filters cards | Type "Green" into the search input | Inspect grid | Only matching cards visible | M |
| TC-LEASE-NEW-WIZARD-007 | Step 3 unit grid filtered by Step 2 selection | Selected property has 8 units | Inspect grid | All 8 unit cards visible | H |
| TC-LEASE-NEW-WIZARD-008 | Step 3 disabled-state for occupied unit (Unit-wise) | Unit 3A has active lease; Step 1 = Unit-wise | Inspect grid | Unit 3A card dimmed with badge "Occupied"; not clickable | H |
| TC-LEASE-NEW-WIZARD-009 | Step 3 hides units without rooms when Room-wise | Step 1 = Room-wise; property has 3 units, 1 with rooms | Inspect grid | Only the 1 unit with rooms is visible | H |
| TC-LEASE-NEW-WIZARD-010 | Step 3 room grid appears after unit pick (Room-wise) | Step 1 = Room-wise; pick a unit with 3 rooms | Inspect | Room card grid renders below the unit grid; 3 room cards | H |
| TC-LEASE-NEW-WIZARD-011 | Step 3 room disabled-state | Selected unit's Room B is Occupied | Inspect | Room B card dimmed with "Occupied" badge; not clickable | H |
| TC-LEASE-NEW-WIZARD-012 | Step 4 first row is Primary by default | Arrive at Step 4 | Inspect | First tenant row's Primary radio is checked | H |
| TC-LEASE-NEW-WIZARD-013 | Step 4 autocomplete finds existing tenants | Type "Rohan" in the search | Inspect dropdown | Dropdown shows matching tenant; selecting locks the row's Name/Phone/Email fields | H |
| TC-LEASE-NEW-WIZARD-014 | Step 4 informational badge on existing tenant with active lease | Pick a tenant with 1 active lease | Inspect row | Badge "On 1 active lease · #L-XXXX" — NOT a blocker | H |
| TC-LEASE-NEW-WIZARD-015 | Step 4 supports new-tenant create | Don't pick a dropdown; type Name + Mobile in the row's locked fields | Submit | Row validates as new-tenant create | H |
| TC-LEASE-NEW-WIZARD-016 | Step 4 + Add another tenant | Click "+ Add another tenant" 3× | Inspect | 4 tenant rows visible; only the first has Primary | M |
| TC-LEASE-NEW-WIZARD-017 | Step 4 Primary radio is exclusive | Toggle Primary onto row 2 | Inspect | Row 1's Primary clears; row 2's Primary is set | H |
| TC-LEASE-NEW-WIZARD-018 | Step 5 auto-fills rent + deposit | Step 3 selected Unit 3A (₹20,000) for Unit-wise | Arrive at Step 5 | Monthly rent = 20000; Security deposit = 40000; both editable | H |

### TC-LEASE-NEW-CONFLICT — Conflict validation (§2.3 → NR-9)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-LEASE-NEW-CONFLICT-001 | Same-unit unit-wise overlap rejected | Unit 3A has active lease 01/04/2025 – 31/03/2026 | Step 5 with start 01/01/2026 end 31/12/2026 | Field error renders; Submit disabled | H |
| TC-LEASE-NEW-CONFLICT-002 | Same-unit upcoming-vs-upcoming rejected | Unit 3A upcoming lease 01/06/2026 – 31/05/2027 | Step 5 with start 15/06/2026 | Field error; Submit disabled | H |
| TC-LEASE-NEW-CONFLICT-003 | Same-day handoff is a conflict (closed interval) | Unit 3A active ends 31/05/2026 | Step 5 start 31/05/2026 | Field error | H |
| TC-LEASE-NEW-CONFLICT-004 | Next-day handoff is allowed | Same | Step 5 start 01/06/2026 | No error; Submit enabled (subject to other validations) | H |
| TC-LEASE-NEW-CONFLICT-005 | Terminated lease ignored | Unit 3A had a terminated lease overlapping the proposed range | Step 5 in the overlap window | No error | H |
| TC-LEASE-NEW-CONFLICT-006 | Expired lease ignored | Unit 3A had an expired lease overlapping | Step 5 in the overlap window | No error | H |
| TC-LEASE-NEW-CONFLICT-007 | Room-wise same-room overlap rejected | Unit 5B Room A active 01/04/2025 – 31/03/2026 | Step 5 start 01/01/2026 on Room A | Field error referencing Room A | H |
| TC-LEASE-NEW-CONFLICT-008 | Room-wise different-room non-conflict | Unit 5B Room A occupied; Step 3 picks Room C (vacant) | Step 5 in the overlap window | No error | H |
| TC-LEASE-NEW-CONFLICT-009 | Cross-scope: unit-wise blocks new room-wise | Unit 5B has an active unit-wise lease | Step 1 Room-wise; Step 3 Unit 5B + Room A; Step 5 in overlap | Field error citing the unit-wise lease | H |
| TC-LEASE-NEW-CONFLICT-010 | Cross-scope: room-wise blocks new unit-wise | Unit 5B Room A has an active room-wise lease | Step 1 Unit-wise; Step 3 Unit 5B; Step 5 in overlap | Field error citing Room A's lease | H |
| TC-LEASE-NEW-CONFLICT-011 | Conflict re-checks on date edit | Conflict present; user edits End to a non-overlapping date | Inspect | Error clears; Submit re-enables within ~250 ms | M |

### TC-LEASE-NEW-STATUS — Status taxonomy in the prototype (§2.2)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-LEASE-NEW-STATUS-001 | Upcoming badge on listing | Mock data has at least 1 upcoming lease | View `admin/leases.html` | Row shows `badge-prepaid` "Upcoming" | H |
| TC-LEASE-NEW-STATUS-002 | Active badge on listing | Mock has active leases | View page | `badge-active` "Active" | H |
| TC-LEASE-NEW-STATUS-003 | Ended badge | Mock has 1 expired lease | View page | `badge-closed` with label "Ended" | H |
| TC-LEASE-NEW-STATUS-004 | Terminated badge | Mock has 1 terminated lease | View page | `badge-terminated` "Terminated" | H |
| TC-LEASE-NEW-STATUS-005 | Listing tiles in correct order | View page | Inspect filter row | Tiles: All · Upcoming · Active · Ended · Terminated | H |
| TC-LEASE-NEW-STATUS-006 | Ended tile filters to expired only | Click Ended tile | Inspect rows | All rows with `data-status="expired"` visible; no other rows | H |
| TC-LEASE-NEW-STATUS-007 | Upcoming tile filters to upcoming only | Click Upcoming | Inspect rows | Only upcoming rows visible | H |
| TC-LEASE-NEW-STATUS-008 | All tile is default | Open page fresh | Inspect | All tile has `is-active`; all rows visible | M |

### TC-LEASE-NEW-LIST — Column structure + actions (§2.7, Revision 3)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-LEASE-NEW-LIST-001 | Column order matches spec | Open `admin/leases.html` | Read table headers left-to-right | Headers: `# · Lease # · Lease Type · Property · Unit · Tenant(s) · Rent · Status · Action` (the combined cell is headed `Property · Unit`; the combined header label may also read `Property · Unit · Room` — agent's choice, document it) | H |
| TC-LEASE-NEW-LIST-002 | Lease Type cell — Unit-wise rendering | Row representing a unit-wise lease (any non-room-wise mock row) | Inspect Lease Type cell | Renders either a `Unit-wise` badge or plain muted text reading `Unit-wise`. Distinguishable from room-wise rows. | H |
| TC-LEASE-NEW-LIST-003 | Lease Type cell — Room-wise rendering | Row representing a room-wise lease (at least one such row must exist in the seeded mock — see TC-LEASE-NEW-LIST-005) | Inspect cell | Renders either a `Room-wise` badge or plain muted text reading `Room-wise`. | H |
| TC-LEASE-NEW-LIST-004 | Property · Unit combined cell — unit-wise | A unit-wise row | Inspect cell | Cell shows the property name (with locality) on top, and `Unit 3A` (or equivalent) beneath as muted sub-text (e.g. `<div class="text-xs muted">`). No separate Property column exists. | H |
| TC-LEASE-NEW-LIST-005 | Property · Unit combined cell — room-wise | A room-wise row | Inspect cell | Cell shows the property name on top, and `Unit PG-101 · Room A` (or equivalent) beneath as muted sub-text. The room label is concatenated with the unit number via a middle dot. | H |
| TC-LEASE-NEW-LIST-006 | Action cell is `View detail` only | Any row, any status | Inspect Action cell | Exactly one element: a `View detail` anchor. No `<button>` elements; no `Cancel` / `Renew` / `Terminate` / `Process refund` text anywhere in the cell. | H |
| TC-LEASE-NEW-LIST-007 | Lease # is a clickable link | Any row | Click the `#L-XXXX` cell | Navigates to the same target as the row's `View detail` link (e.g. `lease-detail.html?id=L-XXXX` or the stub fallback). | H |
| TC-LEASE-NEW-LIST-008 | "+ New Lease" navigates to wizard | Click button at top of leases.html | Navigate | Lands on `admin/create-lease.html` Step 1 | H |
| TC-LEASE-NEW-LIST-009 | Wizard submit toasts and returns | Complete wizard; click Create Lease | Inspect | Toast "Lease created"; URL returns to `admin/leases.html` | H |
| TC-LEASE-NEW-LIST-010 | Locale — dates DD/MM/YYYY · Currency — ₹ Indian grouping | Inspect all dates + amounts | Read | All dates DD/MM/YYYY (BL-23); all amounts `₹18,000` / `₹1,20,000` | H |
| TC-LEASE-NEW-LIST-011 | Negative-assertion sweep | Open the file in a text grep | Run `grep -E "(Cancel|Renew|Terminate|Process refund)" admin/leases.html` | Zero matches in the rendered `<tbody>` (the substrings may legitimately appear elsewhere on the page — e.g. in a sidebar tooltip; bound the assertion to the leases table tbody). Additionally: zero matches for `Renewed` / `data-status="renewed"` / `badge-renewed` on the page (carry-over from Revision 2). | H |

### TC-LEASE-NEW-TENANT — Multi-lease tenants + context (NR-11, §2.6 Step 4 + Step 5)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-LEASE-NEW-TENANT-001 | Tenant with 2 active leases is selectable | Existing tenant Anita has 2 active leases | Step 4 — search "Anita" | Result row shows "On 2 active leases · #L-…"; selection succeeds; no blocker | H |
| TC-LEASE-NEW-TENANT-002 | Step 5 context panel A — unit/room lease history | Step 3 selected Unit 3A | Inspect right column on Step 5 | Panel A lists past + current + upcoming leases for Unit 3A | H |
| TC-LEASE-NEW-TENANT-003 | Step 5 context panel B — tenant lease history | Step 4 selected an existing tenant | Inspect | Panel B lists every lease for that tenant across the org | H |
| TC-LEASE-NEW-TENANT-004 | Step 5 panel B updates when tenants change | Add a second tenant on Step 4; return to Step 5 | Inspect | Panel B now has two sub-panels, one per tenant | M |
| TC-LEASE-NEW-TENANT-005 | New-tenant rows show no history badge | Add a brand-new tenant in Step 4 | Inspect | No "On N leases" badge; placeholder "New tenant" pill | M |
| TC-LEASE-NEW-TENANT-006 | Primary radio default + exclusivity | Add 3 tenants | Toggle Primary across rows | Always exactly one Primary; first is default | H |

---

## 4. Sign-off

Pre-implementation questions surfaced during planning. Each has a proposed default; user can override before code starts.

| Date | Question | Proposed default | User answer |
|---|---|---|---|
| 2026-05-28 | §2.1 — confirm lease scope is encoded **only** by `lease.room_id IS NULL`-vs-not, with no denormalized `scope` enum column. | Yes — keep the schema minimal. Add `scope` later only if a query plan demands it. | — pending — |
| 2026-05-28 | §2.5 — confirm the unit-level lock for room CRUD (signing a unit-wise lease on U freezes the Rooms section on U; same for upcoming). | Yes — unit-level lock is the simplest correct rule. | — pending — |
| 2026-05-28 | §2.3 — confirm cross-scope conflict in NR-9 (a unit-wise lease on U conflicts with any room-wise lease on any room of U in the same range, and vice-versa). | Yes — leasing the whole unit out occupies every room. | — pending — |
| 2026-05-28 | §2.6 Step 4 — confirm tenant search is **org-scoped only** (no cross-org search; preserves NR-5 tenant isolation). | Yes — org-scoped. | — pending — |
| 2026-05-28 | §2.6 Step 5 — confirm security deposit auto-fills to 2 × monthly rent, editable. | Yes. | — pending — |
| 2026-05-28 | §2.10 — confirm NR-11 explicitly states "a tenant may hold N active leases simultaneously" (no system block). | Yes — preserves the real-world case where a landlord rents multiple PG rooms to the same person. | — pending — |
| 2026-05-28 | §2.7 — confirm `admin/leases.html` filter tiles after refactor are exactly: All · Upcoming · Active · Ended · Terminated. | Yes. | ✅ **confirmed** (Revision 2). |
| 2026-05-28 | §2.2 — confirm the `renewed` status is dropped entirely (renewal creates a new lease; original lease expires naturally). | Yes — drop. | ✅ **confirmed** (Revision 2). |
| 2026-05-28 | §2.2 — confirm `terminated` enum value is `4` (contiguous, no gap) vs `5` (with `4` reserved). | `4` — contiguous, pre-code. | — pending — (prototype is unaffected; flag for backend dispatch) |
| 2026-05-28 | §2.9 — confirm PM clone + tenant pages + maintenance pages + backend + super-admin are explicitly deferred. PM clone is the most likely follow-up. | Yes — defer. | ✅ **confirmed**. |

## 5. Execution log

| Date | Event |
|---|---|
| 2026-05-28 | Revision 1 of this file: per-unit `leasing_mode` + property default model **withdrawn**; rooms-as-sub-entities model adopted; 5-step wizard spec drafted; NR-11 added. |
| 2026-05-28 | Revision 2 (this revision): **`renewed` status dropped**. Enum collapses 5→4. NR-10 cron simplified to a single `active → expired` end-of-day flip. UI "Ended" tile maps to `expired` only (no merge, no parenthetical disambiguation). Unit-detail Leases table visibility fix recorded (user already applied to both admin + PM). Status: `proposed`. Dispatch brief to `gharsetu-frontend` regenerated. |

## 6. Files changed

| File | Change | Touched by |
|---|---|---|
| `docs/planning/features/2026-05-28-lease-feature-plan.md` | This planning file (rewritten twice on 2026-05-28 — first to drop the leasing-mode toggle, then to drop the `renewed` status) | gharsetu-lead |
| `prototype/admin/unit-detail.html` | (pending — Rooms section + Add/Edit/Retire room modals + lock states; verify upcoming-row visibility across statuses) | gharsetu-frontend |
| `prototype/admin/create-lease.html` | (pending — full rewrite to 5-step wizard) | gharsetu-frontend |
| `prototype/admin/leases.html` | (pending — All · Upcoming · Active · Ended · Terminated tiles; no Renewed; row actions) | gharsetu-frontend |
| `prototype/admin/properties.html` | (verify-only — no field added or removed) | gharsetu-frontend |
| `prototype/admin/property-detail.html` | (verify-only — no field added or removed) | gharsetu-frontend |
| `prototype/pm/unit-detail.html` | (already updated by user — upcoming-row visibility fix; not in this dispatch's scope but recorded for completeness) | user |
| `agent-team-change-logs/gharsetu-lead-2026-05-28.md` | This session's change-log entry (Task 2 + Task 3 + Task 4 delta) | gharsetu-lead |
| `docs/planning/prototype-changes.md` | (deferred to ship) | gharsetu-frontend |
| **Deferred** | PM pages (other than the unit-detail fix already done) · Tenant pages · Maintenance pages · Super Admin pages · apps/api schema/migration/service/cron · apps/web | — |

## 7. Agents used

| Agent | Task | Status |
|---|---|---|
| gharsetu-lead     | Plan rewrites (Revisions 1 + 2) + Admin-only dispatch brief                                              | ✅ accepted |
| gharsetu-frontend | Admin prototype iteration: unit-detail Rooms section, 5-step wizard, leases listing refactor             | — pending — |
| gharsetu-tester   | TC-LEASE-NEW-ROOMS/WIZARD/CONFLICT/STATUS/LIST/TENANT execution (~62 cases)                              | — pending — |
| gharsetu-backend  | Schema + migration + LeaseConflictChecker + status cron (deferred — separate dispatch)                   | — deferred — |
| gharsetu-security | VAPT on /leases create/edit/cancel surface; role-scope leak audit (deferred — separate dispatch)         | — deferred — |

## 8. Post-deploy

No issues yet — feature is at `proposed` status. Stays open indefinitely once shipped; dated entries append.

## 9. Cross-references

- SRS §4 Module 2 (Properties & Units), §4 Module 3 (Leases & Tenants), §5 BL-01, §5 NR-9 + NR-10 + NR-11 (to add). SRS §4 Module 3 status list will need to be amended to drop `renewed` on ship.
- [`./2026-05-26-per-room-leasing.md`](./2026-05-26-per-room-leasing.md) — prior planning file (proposal of property-scope leasing-mode + lock). **Superseded in spirit by this file.**
- [`./2026-05-27-admin-leases-page.md`](./2026-05-27-admin-leases-page.md) — Admin Leases page skeleton (in-progress); this file extends it with the new wizard + status taxonomy.
- Solution Overview v8 → §New Features → Leases & Tenants — Per-Room Leasing (statement to amend on SRS pass — drop the "leasing_mode toggle" framing; drop "renewed" from any status copy).
- UIUX Design Document → §4 IA · §5 Page Layout Templates · §6 Wireframes · §7 Components · §8 Interaction Patterns · §9 Accessibility (card-grid pattern + step-progress pattern verify here).
- TEST_CASES — TC-LEASE-NEW-ROOMS-001..010, TC-LEASE-NEW-WIZARD-001..018, TC-LEASE-NEW-CONFLICT-001..011, TC-LEASE-NEW-STATUS-001..008, TC-LEASE-NEW-LIST-001..010, TC-LEASE-NEW-TENANT-001..006 (promoted from §3 on ship).
- [`./../prototype-changes.md`](./../prototype-changes.md) — row to be added on ship.
