# Per-Room Leasing — Properties, Units, Leases & Tenants, Maintenance (v8)

| Field | Value |
|---|---|
| Status         | proposed |
| Started        | 2026-05-26 |
| Shipped        | — |
| SRS row        | (n/a — prototype-only; v8 feature, SRS row added later) |
| Test cases     | TC-PROOM-PROP-001..008 · TC-PROOM-UNIT-001..008 · TC-PROOM-LEASE-001..010 · TC-PROOM-TENANT-001..007 · TC-PROOM-MAINT-001..009 (designed in §3, prototype-scope) |
| Prototype todo | row to be added to `./../prototype-changes.md` on ship |

## 1. Requirement (as given)

> "Per-Room Leasing is a v8 (Solution Overview v8 §New Features) extension to three existing modules — Properties & Units, Leases & Tenants, and Maintenance visibility — allowing a single unit to carry up to one active lease per room rather than one active lease per unit. Key behaviors:
>
> - **Room-based at creation** — when an Admin creates a property, they select a Leasing mode: Unit-based (default) or Room-based. Room-based mode means every unit in the property is subdivided into rooms; each room carries its own active lease, its own rent, its own deposit, and its own tenants. A 4-BHK unit can therefore hold up to 4 simultaneous active leases (one per bedroom).
> - **NR-1 mode locks on active lease** — once any room in a Room-based unit has an active lease the Leasing mode field on the property becomes permanently read-only. The UI renders it as a disabled select with the helper text "Locked — one or more active leases exist on this property."
> - **Shared common-area visibility** — maintenance requests tagged Shared are visible to all tenants in the property. Room-specific requests are private to the raising tenant.
> - **Room-specific privacy (NR-2)** — a tenant on a Room-based property sees: (a) their own room-specific maintenance issues and (b) all Shared common-area issues. They do NOT see another tenant's room-specific issues even within the same unit.
>
> Prototype pages targeted:
>
> 1. `prototype/admin/properties.html` — Properties list + Add Property modal
> 2. `prototype/admin/property-detail.html` — Property detail page
> 3. `prototype/admin/units.html` + `prototype/pm/units.html` — Units list with expandable Rooms sub-table
> 4. `prototype/pm/leases.html` + `prototype/pm/lease-detail.html` — Lease creation modal (property → unit → room) and lease detail scope header
> 5. `prototype/tenant/dashboard.html` + `prototype/pm/maintenance.html` + `prototype/tenant/maintenance.html` — Unit+Room label and Scope filter
>
> Read first: Solution Overview v8 §New Features → Leases & Tenants — Per-Room Leasing · NR-1 (mode locks once any active lease exists) · NR-2 (Shared vs Room-specific maintenance visibility) · UIUX Design Document §4 IA · §5 Page Layout Templates · §6 Wireframes · §7 Components · §8 Interaction Patterns · §9 Accessibility."

## 2. Plan

### 2.0 Intent

Per-Room Leasing is a v8 (Solution Overview v8 §New Features) extension that lets an Admin configure a property so each room within a unit can hold its own independent active lease, rent, deposit, and tenant set. This planning iteration is **prototype-only** — it modifies ten existing static HTML prototype pages across three modules; no new routes are added, no `apps/api` or `apps/web` code is written. The design contract is derived from Solution Overview v8 §New Features → Leases & Tenants — Per-Room Leasing, business rules NR-1 and NR-2, and the UIUX Design Document §4–§9. Two new business rules govern this feature:

- **NR-1 (mode lock)**: Once any room in any unit on a property has ever had an active lease, the Leasing mode for that property is permanently read-only. This prevents mode-switching that would invalidate existing data. "Locked" state persists even if all active leases are subsequently terminated — the mode has been established.
- **NR-2 (maintenance visibility)**: On a Room-based property, each tenant sees only their own room-specific maintenance issues plus all Shared (common-area) issues for their property. No cross-room visibility.

No backend work, no migrations, no API changes, and no sidebar/tabbar navigation changes are in scope for this prototype iteration.

### 2.1 Routing model

No new routes are added. Per-Room Leasing is an in-page augmentation of existing pages:

| Page | Prototype path | Change |
|---|---|---|
| Properties list | `prototype/admin/properties.html` | Leasing mode column + creation modal radio group |
| Property detail | `prototype/admin/property-detail.html` | Leasing mode row + NR-1 lock state |
| Admin units | `prototype/admin/units.html` | Rooms sub-table expand on Room-based units |
| PM units | `prototype/pm/units.html` | Rooms sub-table expand on Room-based units |
| PM leases | `prototype/pm/leases.html` | Room column in list + room step in New Lease modal |
| PM lease detail | `prototype/pm/lease-detail.html` | Lease scope header line |
| Tenant dashboard | `prototype/tenant/dashboard.html` | Unit+Room label in header card |
| PM maintenance | `prototype/pm/maintenance.html` | Scope column in table |
| Tenant maintenance | `prototype/tenant/maintenance.html` | Scope filter chips + Scope field in New Request modal |
| PM tenant detail | `prototype/pm/tenant-detail.html` | Room column in lease summary (minor) |

### 2.2 Navigation updates

**No sidebar changes. No tabbar changes.** Per-Room Leasing is entirely in-page. The Admin and PM sidebar nav blocks remain identical to their current state. The Tenant tabbar's 4 slots (Lease · Rent · Maint. · Profile · Logout) are also unchanged. Per-Room Leasing introduces no new top-level section requiring a nav entry.

### 2.3 Leasing-mode field semantics

**Leasing mode** is a property-level field with two values:

| Value | Wire enum | Behavior |
|---|---|---|
| Unit-based | `UNIT` | Default. One lease per unit. Existing behavior unchanged. |
| Room-based | `ROOM` | Each unit subdivided into rooms; each room carries its own active lease. |

**At creation:** The Add Property modal renders a radio group with two options — "Unit-based (default)" and "Room-based". Default selection is Unit-based. The field label is "Leasing mode" (`.label` — Poppins 500 13px uppercase, `--color-slate`, styles.css line 161–170).

**Lock state (NR-1):** Once any room in the property's units has an active lease, the Leasing mode field transitions to a locked read-only state on the property detail page. The UI renders this as:

- A `<select class="input" disabled>` with the current value pre-selected (styles.css line 123 — `.input` min-height 44px, 1px `--color-mid-gray` border, 6px radius).
- Immediately below the select: `<p class="text-xs muted">Locked — one or more active leases exist on this property.</p>` (styles.css line 501 — `.muted` uses `--color-slate #546E7A`).
- The disabled select receives `opacity: 0.6` via Tailwind `opacity-60` to signal it is non-interactive; no separate `.input.disabled` class exists in styles.css, so this opacity is applied inline or via Tailwind utility.

**Lock persistence:** NR-1 states the lock is permanent once triggered — it does NOT unlock when all active leases end. The helper text must therefore read "Locked — one or more active leases exist on this property" (present tense reflecting the historical fact), not "no active leases remain."

### 2.4 Status / scope badge taxonomy

All badges re-use existing classes verified in `prototype/assets/styles.css`. No new badge classes are introduced.

| Visual element | Badge class | styles.css line | Display text |
|---|---|---|---|
| Property Leasing mode — Unit-based | `badge badge-closed` | 74 | Unit-based |
| Property Leasing mode — Room-based | `badge badge-prepaid` | 67 | Room-based |
| Maintenance scope — Shared | `badge badge-prepaid` | 67 | Shared |
| Maintenance scope — Room-specific | `badge badge-partial` | 65 | Room-specific |
| Lease scope — Per-Room | `badge badge-prepaid` | 67 | Per-Room |
| Lease scope — Entire unit | `badge badge-closed` | 74 | Entire unit |
| Room status — Available | `badge badge-paid` | 64 | Available |
| Room status — Occupied | `badge badge-prepaid` | 67 | Occupied |

Rationale for token reuse: `badge-prepaid` (blue tone, `--bg-prepaid #E3F2FD` on `--color-status-prepaid #0277BD`) consistently signals an informational/active scoped state throughout the prototype; `badge-closed` (neutral gray, `--bg-closed #ECEFF1` on `--color-slate #546E7A`) signals default/baseline modes.

---

## 2. Plan — Page-by-page detail (sub-sections 5.1 – 5.8)

### 5.1 admin/properties.html — Properties list + Add Property modal

**Zone-by-zone layout**

| Zone | Content | Tokens / classes |
|---|---|---|
| Properties table | Add "Leasing Mode" column between "Type" and "Units". Each row shows: Unit-based → `<span class="badge badge-closed">Unit-based</span>`; Room-based → `<span class="badge badge-prepaid">Room-based</span>`. | `.data-table` (styles.css line 449), `.badge.badge-closed` (line 74), `.badge.badge-prepaid` (line 67) |
| Filter bar | No change to existing filters. | — |
| Add Property modal — Leasing mode field | New `<div class="mt-4">` block appended before the Amenities field. Label: `<label class="label">Leasing mode</label>`. Two `<label class="flex items-center gap-2 text-sm">` radio inputs: first "Unit-based (default)", second "Room-based". First is `checked` by default. Helper below: `<p class="text-xs muted mt-1">Room-based splits each unit into rooms, each with its own lease. Cannot be changed after the first active lease is created.</p>` | `.label` (line 161), `.input` not used (radio; styled via Tailwind flex), `.muted` (line 501), `--space-md` (24px gap, line 31) |

**Copy direction**

- Column header: "Leasing Mode"
- Badge text: "Unit-based" / "Room-based"
- Modal section label: "Leasing mode"
- Radio option 1: "Unit-based (default)"
- Radio option 2: "Room-based"
- Helper: "Room-based splits each unit into rooms, each with its own lease. Cannot be changed after the first active lease is created."

**Design tokens (verified line numbers)**

- `.data-table` — styles.css line 449 (`width: 100%; border-collapse: collapse; background: #fff`)
- `.data-table thead th` — styles.css line 451–456 (`background: var(--color-light-gray)`, Poppins 600 13px, `--color-slate`, uppercase)
- `.badge` — styles.css lines 53–63
- `.badge-closed` — styles.css line 74 (`background: var(--bg-closed) #ECEFF1; color: var(--color-slate) #546E7A`)
- `.badge-prepaid` — styles.css line 67 (`background: var(--bg-prepaid) #E3F2FD; color: var(--color-status-prepaid) #0277BD`)
- `.label` — styles.css line 161 (Poppins 500 13px, uppercase, `--color-slate`, `margin-bottom: 6px`)
- `.muted` — styles.css line 501 (`color: var(--color-slate)`)
- `.modal` — styles.css line 479–483 (`background: #fff; border-radius: 12px; padding: 32px; max-width: 480px`)

**Interaction sequences**

1. User opens "Add Property" modal (existing `onclick` trigger — `document.getElementById('addPropertyModal').classList.add('open')`).
2. User scrolls through the form; sees the new "Leasing mode" radio group after "Assign Manager / Floors" row.
3. Default: "Unit-based (default)" is pre-selected. No validation error state needed for the radio group (always has a value).
4. User selects "Room-based" — visual check (radio dot fills). No other in-modal change.
5. On submit, modal closes (existing `onsubmit` behavior preserved).

**Empty / edge states**

- Properties list with all Unit-based rows: "Leasing Mode" column shows only `badge badge-closed` "Unit-based" across every row. No empty-state handling required — the column always has a value.
- Properties list with at least one Room-based property: that row shows `badge badge-prepaid` "Room-based".

---

### 5.2 admin/property-detail.html — Property detail

**Zone-by-zone layout**

| Zone | Content | Tokens / classes |
|---|---|---|
| Property Details card — `data-table tbody` | Insert a new row after "Total units": `<tr><td class="muted">Leasing mode</td><td class="text-right"><span class="badge badge-prepaid">Room-based</span></td></tr>`. For a Unit-based property: `<span class="badge badge-closed">Unit-based</span>`. | `.data-table` (line 449), `.muted` (line 501), `.badge.badge-prepaid` (line 67), `.badge.badge-closed` (line 74) |
| NR-1 lock state (Room-based only, any active lease exists) | Below the Leasing mode row, insert a locked-field block: `<tr><td colspan="2" class="pt-0"><select class="input opacity-60" disabled><option selected>Room-based</option></select><p class="text-xs muted mt-1">Locked — one or more active leases exist on this property.</p></td></tr>`. Shown only when the property is Room-based AND NR-1 has triggered. | `.input` (line 123 — min-height 44px), `.muted` (line 501), Tailwind `opacity-60` |
| NR-1 unlocked state (Room-based, no active lease yet) | No lock row; the Leasing mode row is read-only but the select is not shown — only the badge value is displayed. The property was just created as Room-based; mode is still in principle changeable (server would allow it), but since the prototype does not wire a real edit flow, this state shows the badge with no disabled select. | `.badge.badge-prepaid` (line 67) |

**Copy direction**

- Table row label: "Leasing mode"
- Lock helper text: "Locked — one or more active leases exist on this property."
- For Unit-based property: no lock state ever renders; badge shows "Unit-based" as read-only information.

**Design tokens (verified line numbers)**

- `.card` — styles.css line 111 (white, 1px `--color-mid-gray #CFD8DC`, radius 8px, shadow `0 2px 8px rgba(0,0,0,0.04)`, padding 24px)
- `.section-title` — styles.css line 499 (`color: var(--color-royal-blue) #1565C0`, Poppins 600 18px, uppercase, `letter-spacing: 0.5px`)
- `.input` (disabled) — styles.css line 123 (min-height 44px, border 1px `--color-mid-gray`, radius 6px)
- `.muted` — styles.css line 501 (`color: var(--color-slate) #546E7A`)

**Interaction sequences**

1. Admin navigates to property-detail.html.
2. Property Details card renders the "Leasing mode" row — badge only (read-only display).
3. If Room-based and NR-1 triggered: below the badge, a disabled `<select>` and the lock helper paragraph are visible.
4. If Room-based and NR-1 not yet triggered (no active leases): badge only, no disabled select, no helper.
5. No user action possible on this field from this page — it is informational.

**Empty / edge states**

- Unit-based property: "Leasing mode" row shows `badge badge-closed` "Unit-based"; no lock UI ever appears (lock is a Room-based concept only).
- Room-based property with zero active leases: badge shows "Room-based"; no lock row.
- Room-based property with one or more historical active leases (even if now terminated): badge shows "Room-based" + lock row with disabled select + helper text — NR-1 is permanent.

---

### 5.3 admin/units.html — Units list with Rooms sub-table

**Zone-by-zone layout**

| Zone | Content | Tokens / classes |
|---|---|---|
| Units table header | Add "Leasing" column between "Bedrooms" and "Monthly Rent": value is `badge badge-closed "Unit-based"` or `badge badge-prepaid "Room-based"` per unit's parent property. Add an expand affordance column as the last column (empty header; shows chevron button for Room-based rows). | `.data-table` (line 449), `.badge.badge-closed` (line 74), `.badge.badge-prepaid` (line 67) |
| Unit row — Unit-based | Normal row; expand column shows "—" (muted dash). No sub-table. | `.muted` (line 501) |
| Unit row — Room-based | Expand column shows `<button class="btn btn-secondary !py-1 !px-2 !text-xs">▾ Rooms</button>`. On click, a `<tr class="rooms-sub-row">` is inserted immediately below containing a nested `<table>` (Rooms sub-table). Button text toggles to "▲ Hide" when expanded. | `.btn.btn-secondary` (line 95), `!py-1 !px-2 !text-xs` Tailwind overrides |
| Rooms sub-table | Indented 24px left. Columns: Room # · Current Lease · Tenant · Status · Rent · End date. Status badge: `badge badge-paid "Available"` or `badge badge-prepaid "Occupied"`. Rent uses `₹` with Indian digit grouping. End date in DD/MM/YYYY. | `.data-table` (line 449), `.badge.badge-paid` (line 64), `.badge.badge-prepaid` (line 67), `--space-md` (line 31) |
| Rooms sub-table — empty state | When a Room-based unit has no rooms defined yet: `<tr><td colspan="6" class="text-center muted py-4">No rooms defined yet. Rooms are added when the first lease is created for this unit.</td></tr>` | `.muted` (line 501) |

**Copy direction**

- Column header: "Leasing"
- Expand button: "▾ Rooms" / "▲ Hide"
- Sub-table column headers: "Room", "Current Lease", "Tenant", "Status", "Rent", "Lease End"
- Seed data example row: Room 1 · #L-2201 · Rohan Mehta · Occupied · ₹8,000 · 31/03/2027
- Empty-room message: "No rooms defined yet. Rooms are added when the first lease is created for this unit."

**Design tokens (verified line numbers)**

- `.data-table` — styles.css line 449
- `.data-table tbody tr` — styles.css line 457 (`border-bottom: 1px solid var(--color-light-gray)`)
- `.data-table tbody tr:hover` — styles.css line 458 (`background: rgba(21,101,192,0.03)`)
- `.badge.badge-paid` — styles.css line 64 (`background: var(--bg-paid) #E8F5E9; color: var(--color-status-paid) #2E7D32`)
- `.badge.badge-prepaid` — styles.css line 67
- `.btn.btn-secondary` — styles.css line 95 (`transparent bg, 2px solid --color-royal-blue border, padding: 8px 22px`)
- `.muted` — styles.css line 501

**Interaction sequences**

1. Admin lands on admin/units.html. All rows visible; the "Leasing" column shows badges.
2. For a Room-based unit row: admin clicks "▾ Rooms" button.
3. A `<tr class="rooms-sub-row">` slides in (or toggles `display`) immediately below the parent row. The Rooms sub-table is visible with a light `--color-light-gray #ECEFF1` background to visually distinguish nesting.
4. Admin clicks "▲ Hide" — the sub-row collapses. Focus returns to the expand button.
5. Multiple rows can be expanded simultaneously (no accordion constraint required by the prototype).

**Empty / edge states**

- Unit-based unit rows: "Leasing" column shows "Unit-based" badge; expand column shows "—"; no sub-table interaction.
- Room-based unit with no rooms yet: sub-table shows the empty state message row.
- Room-based unit with all rooms available (no active leases): each room row shows `badge badge-paid "Available"`, Current Lease shows "—", Tenant shows "—", End date shows "—".

---

### 5.4 pm/units.html — PM Units list with Rooms sub-table

**Zone-by-zone layout**

Identical to §5.3 for the Rooms sub-table. PM chrome is used (PM sidebar block, PM tabbar, PM MoreSheet). The PM-scoped version does not have the Property filter (PM sees only their property). The Leasing mode badge and Rooms sub-table behave identically to the Admin view.

| Zone | Content | Tokens / classes |
|---|---|---|
| Units table | Add "Leasing" column between "Type" and "Tenant". Expand affordance column last. | Same as §5.3 |
| Rooms sub-table | Same columns and badges as §5.3. PM also sees a "View" action link per occupied room row: `<a href="tenant-detail.html" class="text-royal-blue font-poppins font-semibold text-sm">View</a>` | `.data-table` (line 449), Tailwind `text-royal-blue` |
| Rooms sub-table — empty state | Same text as §5.3. | `.muted` (line 501) |

**Copy direction**

Same as §5.3 with the addition of the "View" action on occupied room rows.

**Design tokens (verified line numbers)**

Same as §5.3. Additionally:

- `--color-royal-blue #1565C0` — styles.css line 7 (for "View" link color)
- `.font-poppins` / `font-semibold` — Tailwind utilities matching the existing PM units table link style (`text-royal-blue font-poppins font-semibold text-sm`)

**Interaction sequences**

Same expand/collapse as §5.3. The "View" link on occupied room rows navigates to `tenant-detail.html` (existing prototype target).

**Empty / edge states**

Same as §5.3.

---

### 5.5 pm/leases.html — Lease list + New Lease modal (Room-based flow)

**Zone-by-zone layout**

| Zone | Content | Tokens / classes |
|---|---|---|
| Leases table | Add "Room" column between "Unit" and "Start". For a Unit-based lease: the Room column shows "—" (muted). For a Room-based lease: the Room column shows "Room 2" (or the room label). Additionally, the Unit column value reads "Unit 3A" for Unit-based, "Unit 3A · Room 2" for Room-based. | `.data-table` (line 449), `.muted` (line 501) |
| New Lease modal — step 1 (Unit selection) | Existing unit `<select>`. If the selected unit belongs to a Room-based property, a new "Room" select appears below it (conditional show/hide). | `.input` (line 123), `.label` (line 161) |
| New Lease modal — Room select (conditional) | `<div id="roomSelectGroup" class="mt-4" style="display:none;">` (hidden by default; shown when a Room-based unit is selected). Label: `<label class="label">Room</label>`. Select options: "Room 1 — Available", "Room 2 — Available", "Room 3 — Occupied (no lease possible)". Occupied rooms show `disabled` on their `<option>` to prevent selection. Helper: `<p class="text-xs muted mt-1">Only available rooms appear here. Occupied rooms cannot receive a new lease.</p>` | `.input` (line 123), `.label` (line 161), `.muted` (line 501) |
| Lease scope badge in table | Add a narrow "Scope" column after "Room": `<span class="badge badge-prepaid">Per-Room</span>` for Room-based leases; `<span class="badge badge-closed">Entire unit</span>` for Unit-based. | `.badge.badge-prepaid` (line 67), `.badge.badge-closed` (line 74) |

**Copy direction**

- Table column header: "Room"
- Table column header: "Scope"
- Modal room label: "Room"
- Modal room helper: "Only available rooms appear here. Occupied rooms cannot receive a new lease."
- Scope badge: "Per-Room" / "Entire unit"
- Occupied option text pattern: "Room 3 — Occupied (no lease possible)"
- Available option text pattern: "Room 1 — Available"

**Design tokens (verified line numbers)**

- `.input` select — styles.css line 123 (width 100%, min-height 44px, Inter 400 15px)
- `.label` — styles.css line 161
- `.muted` — styles.css line 501
- `.badge.badge-prepaid` — styles.css line 67
- `.badge.badge-closed` — styles.css line 74
- `.modal` — styles.css line 479 (white, 12px radius, 32px padding, max-width 480px; already overridden to 560px by inline style in the prototype)

**Interaction sequences**

1. PM clicks "+ New Lease". Modal opens (`document.getElementById('newLeaseModal').classList.add('open')`).
2. PM selects a Unit-based unit from the Unit select → the Room select group (`#roomSelectGroup`) stays hidden.
3. PM selects a Room-based unit → JavaScript toggles `#roomSelectGroup` to `display:block`.
4. Room select renders available rooms as selectable options; occupied rooms render as `<option disabled>`.
5. PM completes the rest of the form (rent, start date, end date, deposit, tenants) — these are per-room values independent of other rooms' leases on the same unit.
6. On submit: modal closes, lease appears in the table with "Unit 3A · Room 2" in the Unit column and "Room 2" in the Room column.

**Overlapping room lease attempt:** If the server returns a conflict error (HTTP 409) because the room already has an active lease, the modal re-opens with an inline `.field-error.show` below the Room select: "This room already has an active lease. Choose a different room." (styles.css line 142 — `.field-error` color `--color-status-overdue #C62828`, ⚠ glyph via `::before`).

**Empty / edge states**

- Unit-based property: Room column in the table shows "—" for every row; Room select never appears in the modal.
- Room-based unit with all rooms occupied: all options in the Room select are `disabled`; the submit button remains disabled. Helper text: "No available rooms in this unit."
- Lease list with no Room-based leases: Room column shows only "—" entries; Scope column shows only "Entire unit" badges.

---

### 5.6 pm/lease-detail.html — Lease detail scope header

**Zone-by-zone layout**

| Zone | Content | Tokens / classes |
|---|---|---|
| Topbar subtitle | Add lease scope to the existing `.page-subtitle` line. Current: `"Unit 1A · Green Valley, Dwarka · <span class='badge badge-active'>Active</span>"`. Update to: for Unit-based lease → `"Lease scope: Unit 1A (entire unit) · Green Valley, Dwarka · <span class='badge badge-active'>Active</span>"`. For Room-based lease → `"Lease scope: Unit 3A · Room 2 · Green Valley, Dwarka · <span class='badge badge-active'>Active</span>"`. | `.page-subtitle` (styles.css line 495 — `color: var(--color-slate); font-size: 14px`), `.badge.badge-active` (line 68) |
| Lease Summary card — Scope row | Insert new row in the `grid md:grid-cols-2` summary: `<div class="flex justify-between"><span class="muted">Lease scope</span><strong class="text-charcoal">Unit 3A · Room 2</strong></div>` for Room-based, or `<strong class="text-charcoal">Unit 1A (entire unit)</strong>` for Unit-based. | `.muted` (line 501), Tailwind `text-charcoal` matching `--color-charcoal #212121` (styles.css line 9) |
| Scope badge in subtitle | Optional inline badge adjacent to the scope text: `<span class="badge badge-prepaid">Per-Room</span>` for Room-based. Improves scanability. | `.badge.badge-prepaid` (line 67) |

**Copy direction**

- Subtitle (Unit-based): "Lease scope: Unit 1A (entire unit) · Green Valley, Dwarka"
- Subtitle (Room-based): "Lease scope: Unit 3A · Room 2 · Green Valley, Dwarka"
- Summary row label: "Lease scope"
- Summary row value (Unit-based): "Unit 1A (entire unit)"
- Summary row value (Room-based): "Unit 3A · Room 2"

**Design tokens (verified line numbers)**

- `.page-subtitle` — styles.css line 495 (`color: var(--color-slate) #546E7A; font-size: 14px; margin-top: 4px`)
- `.page-title` — styles.css line 494 (`color: var(--color-navy) #1A237E; Poppins 700; font-size: 32px`)
- `.card` — styles.css line 111
- `.muted` — styles.css line 501
- `.badge.badge-active` — styles.css line 68 (`background: var(--bg-paid) #E8F5E9; color: var(--color-status-paid) #2E7D32`)
- `.badge.badge-prepaid` — styles.css line 67

**Interaction sequences**

This page is read-only with respect to the scope field — no user action changes the lease scope after creation. The scope is displayed as static text.

**Empty / edge states**

- Unit-based lease: scope line reads "entire unit"; no Per-Room badge shown.
- Room-based lease: scope line reads "Unit 3A · Room 2" with the Per-Room badge.

---

### 5.7 tenant/dashboard.html — Tenant dashboard Unit+Room label

**Zone-by-zone layout**

| Zone | Content | Tokens / classes |
|---|---|---|
| Lease summary card — heading | Current: `<h3>Unit 1A · Green Valley Apartments, Dwarka</h3>`. For a Room-based lease: change to `<h3>Unit 3A, Room 2 · Green Valley Apartments, Dwarka</h3>`. For Unit-based: keep existing "Unit 1A · Green Valley Apartments" format. | `h3` (styles.css line 50 — Poppins 600 20px, `--color-charcoal #212121`) |
| Sidebar footer | Current: `"Tenant · Rohan Mehta\nUnit 1A, Green Valley"`. For Room-based: `"Tenant · Rohan Mehta\nUnit 3A, Room 2 · Green Valley"`. | `.sidebar-footer` (styles.css line 232–236 — Inter 12px, `rgba(255,255,255,0.6)`) |
| Topbar subtitle | Current: `"Welcome back, Rohan"`. No change needed — this is a personal greeting, not a location label. | `.page-subtitle` (line 495) |

**Copy direction**

- Heading (Unit-based): "Unit 1A · Green Valley Apartments, Dwarka"
- Heading (Room-based): "Unit 3A, Room 2 · Green Valley Apartments, Dwarka"
- Sidebar footer (Unit-based): "Unit 1A, Green Valley"
- Sidebar footer (Room-based): "Unit 3A, Room 2 · Green Valley"

**Design tokens (verified line numbers)**

- `h3` — styles.css line 50 (Poppins 600 20px, `--color-charcoal #212121`)
- `.sidebar-footer` — styles.css line 232 (`padding: 16px 24px; font-size: 12px; color: rgba(255,255,255,0.6); border-top: 1px solid rgba(255,255,255,0.08)`)
- `.card` — styles.css line 111

**Interaction sequences**

No interactions on this section — purely display logic driven by whether the tenant's active lease is Room-based.

**Empty / edge states**

- Unit-based lease: label uses "Unit 1A" format throughout; no Room suffix.
- Room-based lease: label uses "Unit 3A, Room 2" format in the heading and sidebar footer; uses the same format in the tabbar tooltip if applicable (though the existing tabbar has no tooltip).

---

### 5.8 Shared-vs-room-specific maintenance visibility (NR-2)

This sub-section touches four zones across two pages: `pm/maintenance.html` and `tenant/maintenance.html`.

#### 5.8a pm/maintenance.html — Scope column

| Zone | Content | Tokens / classes |
|---|---|---|
| Requests table header | Add "Scope" column between "Unit" and "Property". | `.data-table` (line 449) |
| Scope column values | For each row: `<span class="badge badge-prepaid">Shared</span>` if the request was raised as a common-area issue; `<span class="badge badge-partial">Room-specific</span>` if it belongs to a specific tenant's room. Unit-based property requests always show `<span class="badge badge-closed">Unit</span>` (the concept of room-scope doesn't apply). | `.badge.badge-prepaid` (line 67), `.badge.badge-partial` (line 65), `.badge.badge-closed` (line 74) |
| Filter chips | Add two new chips to the existing filter row: `<button class="btn btn-secondary !py-2 !text-sm">Shared</button>` and `<button class="btn btn-secondary !py-2 !text-sm">Room-specific</button>`. Active chip uses `btn-primary`. | `.btn.btn-primary` (line 93), `.btn.btn-secondary` (line 95) |

**Copy direction**

- Column header: "Scope"
- Chip labels: "Shared" / "Room-specific"
- Badge texts: "Shared" / "Room-specific" / "Unit"

**Design tokens (verified line numbers)**

- `.badge.badge-prepaid` — styles.css line 67 (`--bg-prepaid #E3F2FD; --color-status-prepaid #0277BD`)
- `.badge.badge-partial` — styles.css line 65 (`--bg-partial #FFF8E1; --color-status-partial #F57F17`)
- `.badge.badge-closed` — styles.css line 74 (`--bg-closed #ECEFF1; --color-slate #546E7A`)
- `.btn.btn-primary` — styles.css line 93 (`--color-saffron #FF6F00` bg, white fg)
- `.btn.btn-secondary` — styles.css line 95 (transparent bg, `--color-royal-blue` 2px border)

#### 5.8b tenant/maintenance.html — Scope filter chips + New Request modal Scope field

| Zone | Content | Tokens / classes |
|---|---|---|
| Scope filter chips | For tenants on a Room-based property only: add a chip row above the request cards: `<div class="flex gap-2 flex-wrap mb-4">`. Chips: `All · Shared · Room-specific`. Default active chip: "All" (`btn-primary`). "Shared" chip shows common-area issues; "Room-specific" shows only the tenant's own room requests. On a Unit-based property: chip row is hidden entirely (not rendered). | `.btn.btn-primary` (line 93), `.btn.btn-secondary` (line 95), `--space-md` (line 31) |
| Request cards — Scope badge | Each card gains a `<span class="badge badge-prepaid">Shared</span>` or `<span class="badge badge-partial">Room-specific</span>` badge in the existing badge row at the top of the card, adjacent to Priority and Status badges. | `.badge.badge-prepaid` (line 67), `.badge.badge-partial` (line 65) |
| New Request modal — Scope field (Room-based only) | After Category and Priority in the modal form grid, insert a new full-width `<div class="mt-4">`: `<label class="label" for="scope">Scope</label>` then `<select id="scope" class="input">` with options "Room-specific (default)" (selected) and "Shared (common area)". Helper: `<p class="text-xs muted mt-1">Room-specific issues are private to you. Shared issues (e.g. corridor light, lift) are visible to all tenants in the building.</p>`. On a Unit-based property: this field is hidden. | `.label` (line 161), `.input` (line 123), `.muted` (line 501) |
| Tenant visibility rule (NR-2) reminder | Tenant sees only: (a) their own Room-specific cards and (b) all Shared cards for their property. The prototype seeds this correctly — no other tenant's Room-specific cards are included in the HTML seed data for this tenant. | n/a (data seeding) |

**Copy direction**

- Filter chip labels: "All" / "Shared" / "Room-specific"
- Modal Scope label: "Scope"
- Modal Scope options: "Room-specific (default)" / "Shared (common area)"
- Modal Scope helper: "Room-specific issues are private to you. Shared issues (e.g. corridor light, lift) are visible to all tenants in the building."

**Design tokens (verified line numbers)**

- `.btn.btn-primary` — styles.css line 93
- `.btn.btn-secondary` — styles.css line 95
- `.label` — styles.css line 161 (Poppins 500 13px uppercase, `--color-slate`, `margin-bottom: 6px`)
- `.input` select — styles.css line 123 (min-height 44px, 1px `--color-mid-gray` border, 6px radius)
- `.muted` — styles.css line 501
- `.badge.badge-prepaid` — styles.css line 67
- `.badge.badge-partial` — styles.css line 65
- `.modal` — styles.css line 479 (max-width 480px; existing override `style="max-width:560px;"` already applied in the tenant maintenance modal)
- `.field-error` — styles.css line 142 (display none; `.field-error.show` adds display flex + ⚠ glyph via `::before`)

**Interaction sequences**

1. Tenant lands on tenant/maintenance.html on a Room-based property.
2. Scope filter chips row is visible. Default chip "All" is active (`btn-primary`).
3. Tenant clicks "Shared" chip — only Shared-scoped cards remain visible; the tenant's own Room-specific cards are hidden.
4. Tenant clicks "Room-specific" chip — only the tenant's own Room-specific cards are visible.
5. Tenant clicks "+ Raise New Request" — modal opens. The Scope select is visible with "Room-specific (default)" pre-selected.
6. Tenant changes Scope to "Shared (common area)" — no other modal field changes (category, priority, and description fields remain the same).
7. Tenant submits — new card appears with the Scope badge matching the selected scope.

**Empty / edge states**

- Tenant on Unit-based property: no Scope filter chips; no Scope field in modal; existing behavior unchanged.
- Tenant on Room-based property with no Shared issues: "Shared" chip click results in an empty state: centered `.card` with text "No shared maintenance requests at this time." (uses `.muted` line 501).
- Tenant on Room-based property with no Room-specific issues of their own: "Room-specific" chip click shows: "No room-specific requests raised yet." with a `+ Raise New Request` CTA (`btn-primary`, line 93).

---

## 3. Test cases (designed up front)

Same shape as `./../../testing/v1/Test_Cases.md`. Five namespaces. Priority: H = High, M = Medium, L = Low.

### TC-PROOM-PROP — Properties module

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-PROOM-PROP-001 | Add Property modal shows Leasing mode radio group | Admin on `admin/properties.html` | 1. Click "+ Add Property" | Modal opens; a "Leasing mode" radio group is visible with two options: "Unit-based (default)" (pre-selected) and "Room-based" | H |
| TC-PROOM-PROP-002 | Default leasing mode is Unit-based | Admin has Add Property modal open | 1. Inspect the radio group without interacting | "Unit-based (default)" radio is `checked`; "Room-based" radio is unchecked | H |
| TC-PROOM-PROP-003 | Properties list shows Leasing Mode column | Admin on `admin/properties.html` | 1. Inspect the `data-table` | A "Leasing Mode" column is present; rows with Unit-based show `badge badge-closed "Unit-based"`; rows with Room-based show `badge badge-prepaid "Room-based"` | H |
| TC-PROOM-PROP-004 | Room-based property is identifiable at a glance | Admin on `admin/properties.html` with at least one Room-based property in the seed data | 1. Scan the Leasing Mode column | The Room-based row displays `badge badge-prepaid` (blue tone, `--bg-prepaid #E3F2FD`); clearly distinct from the closed-gray Unit-based badge | M |
| TC-PROOM-PROP-005 | Property detail shows Leasing mode row | Admin on `admin/property-detail.html` for a Room-based property | 1. Read the Property Details card | A "Leasing mode" row is present in the `data-table tbody`; its value is `badge badge-prepaid "Room-based"` | H |
| TC-PROOM-PROP-006 | NR-1 lock state renders correctly | Admin on `admin/property-detail.html` for a Room-based property that has at least one historical active lease | 1. Read the Property Details card below the Leasing mode row | A disabled `<select class="input opacity-60">` with value "Room-based" is visible; below it the helper text "Locked — one or more active leases exist on this property." renders in `.muted` styling | H |
| TC-PROOM-PROP-007 | NR-1 lock persists even when all leases terminated | Admin on property-detail for a Room-based property whose leases are all now Terminated | 1. Read the Leasing mode row | Disabled select + lock helper still visible — the lock is permanent per NR-1 | H |
| TC-PROOM-PROP-008 | Role-scope — PM cannot access admin/property-detail mode-switch | Production scope (noted here; prototype does not enforce role routing) | 1. PM signs in; attempts to navigate to `/admin/property-detail` | Production server returns 403 (Admin-only endpoint); prototype records the requirement but cannot enforce it | L |

### TC-PROOM-UNIT — Units module

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-PROOM-UNIT-001 | Rooms sub-table renders for Room-based units | Admin on `admin/units.html`; at least one Room-based unit in seed data | 1. Locate a Room-based unit row 2. Click "▾ Rooms" | A sub-table row appears immediately below with columns: Room, Current Lease, Tenant, Status, Rent, Lease End | H |
| TC-PROOM-UNIT-002 | Expand button toggles correctly | Admin on `admin/units.html`; Room-based unit row visible | 1. Click "▾ Rooms" 2. Click "▲ Hide" | Sub-table appears on first click; disappears on second click; button text toggles between "▾ Rooms" and "▲ Hide" | H |
| TC-PROOM-UNIT-003 | Unit-based units do not show expand affordance | Admin on `admin/units.html` | 1. Inspect a Unit-based unit row's last column | No expand button; the cell shows "—" (muted dash) | H |
| TC-PROOM-UNIT-004 | Empty rooms state renders correct message | Admin on `admin/units.html`; Room-based unit with no rooms defined | 1. Click "▾ Rooms" on the unit | Sub-table shows single row with colspan 6: "No rooms defined yet. Rooms are added when the first lease is created for this unit." | M |
| TC-PROOM-UNIT-005 | Room status badges use correct classes | Admin expands a Room-based unit with 2 occupied and 1 available room | 1. Read the Status column in the Rooms sub-table | Occupied rooms: `badge badge-prepaid "Occupied"` (blue); Available rooms: `badge badge-paid "Available"` (green) | H |
| TC-PROOM-UNIT-006 | PM units page shows same Rooms sub-table | PM on `pm/units.html`; at least one Room-based unit | 1. Click "▾ Rooms" on a Room-based unit | Identical sub-table structure; "View" action link present for Occupied room rows | H |
| TC-PROOM-UNIT-007 | Responsive — sub-table scrolls horizontally on narrow viewport | Admin on `admin/units.html` in 320px viewport; Room-based sub-table expanded | 1. Check horizontal overflow | Sub-table is wrapped in `overflow-x-auto`; no content is clipped; page does not scroll horizontally at the page level | M |
| TC-PROOM-UNIT-008 | Accessibility — expand button reachable by keyboard | Admin on `admin/units.html` | 1. Tab to the expand button 2. Press Enter | Saffron 2px focus ring visible on button (styles.css line 490); Enter triggers expand; sub-table announces via `aria-expanded` attribute toggle | M |

### TC-PROOM-LEASE — Lease creation and list

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-PROOM-LEASE-001 | New Lease modal shows Room select when Room-based unit selected | PM on `pm/leases.html`; at least one Room-based unit in the Unit select | 1. Click "+ New Lease" 2. Select a Room-based unit | The Room select group (`#roomSelectGroup`) becomes visible below the Unit select | H |
| TC-PROOM-LEASE-002 | Room select is hidden when Unit-based unit selected | PM has New Lease modal open | 1. Select a Unit-based unit | The Room select group remains hidden (display:none); only the standard Unit select is visible | H |
| TC-PROOM-LEASE-003 | Occupied rooms are not selectable in the Room dropdown | PM has New Lease modal open with Room-based unit selected; at least one room is occupied | 1. Inspect the Room select options | Occupied rooms render as `<option disabled>` with label pattern "Room N — Occupied (no lease possible)"; they cannot be selected | H |
| TC-PROOM-LEASE-004 | Overlapping room lease surfaced as inline error | Server returns 409 Conflict for an attempt to create a lease on an already-occupied room | 1. Submit the New Lease form for an occupied room (simulated) | `.field-error.show` appears below the Room select: "This room already has an active lease. Choose a different room." with ⚠ glyph in `--color-status-overdue #C62828` | H |
| TC-PROOM-LEASE-005 | Lease list shows Room column and Scope badge | PM on `pm/leases.html` with at least one Room-based lease in seed data | 1. Read the leases table | A "Room" column is present; Room-based rows show the room label ("Room 2"); Unit-based rows show "—"; a "Scope" column shows `badge badge-prepaid "Per-Room"` for Room-based and `badge badge-closed "Entire unit"` for Unit-based | H |
| TC-PROOM-LEASE-006 | Lease detail shows per-room scope header (Room-based) | PM on `pm/lease-detail.html` for a Room-based lease | 1. Read the topbar subtitle and Lease Summary card | Subtitle reads "Lease scope: Unit 3A · Room 2 · Green Valley, Dwarka"; Summary card has a "Lease scope" row reading "Unit 3A · Room 2" | H |
| TC-PROOM-LEASE-007 | Lease detail shows entire-unit scope header (Unit-based) | PM on `pm/lease-detail.html` for a Unit-based lease | 1. Read the topbar subtitle and Lease Summary card | Subtitle reads "Lease scope: Unit 1A (entire unit) · Green Valley, Dwarka"; Summary card has a "Lease scope" row reading "Unit 1A (entire unit)" | H |
| TC-PROOM-LEASE-008 | 4-BHK unit can hold 4 simultaneous Per-Room leases | PM on `pm/leases.html`; seed data includes a 4-BHK Room-based unit with 4 occupied rooms | 1. Filter leases by the 4-BHK unit | Four distinct lease rows each showing a different Room (Room 1, Room 2, Room 3, Room 4), all with `badge badge-prepaid "Per-Room"` scope | M |
| TC-PROOM-LEASE-009 | Locale — End dates in DD/MM/YYYY throughout lease list | PM on `pm/leases.html` | 1. Read all End date values | Every End date is formatted DD/MM/YYYY; no ISO or MM/DD/YYYY formats | H |
| TC-PROOM-LEASE-010 | Rent uses ₹ with Indian digit grouping | PM on `pm/leases.html` and `pm/lease-detail.html` | 1. Read all monetary values | Rent values formatted as ₹8,000 or ₹1,20,000 (Indian grouping); no comma after thousands in the Western style (₹1,200,000 is wrong; ₹12,00,000 is correct) | H |

### TC-PROOM-TENANT — Tenant dashboard

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-PROOM-TENANT-001 | Tenant on Room-based lease sees "Unit 3A, Room 2" label | Tenant on `tenant/dashboard.html`; tenant has a Room-based lease on Room 2 of Unit 3A | 1. Read the lease summary card heading | Heading reads "Unit 3A, Room 2 · Green Valley Apartments, Dwarka" | H |
| TC-PROOM-TENANT-002 | Tenant on Unit-based lease sees "Unit 1A" label (no room) | Tenant on `tenant/dashboard.html`; tenant has a Unit-based lease | 1. Read the lease summary card heading | Heading reads "Unit 1A · Green Valley Apartments, Dwarka" — no room suffix | H |
| TC-PROOM-TENANT-003 | Sidebar footer shows Room label for Room-based tenant | Tenant on `tenant/dashboard.html`; Room-based lease | 1. Read the `.sidebar-footer` | Footer reads "Tenant · Rohan Mehta" on line 1 and "Unit 3A, Room 2 · Green Valley" on line 2 | M |
| TC-PROOM-TENANT-004 | Lease summary card scope badge visible | Tenant on `tenant/dashboard.html`; Room-based lease | 1. Read the lease summary card | `badge badge-active "Active"` is present (existing); additionally the heading structure correctly labels Unit + Room | H |
| TC-PROOM-TENANT-005 | Responsive — Unit+Room label does not overflow at 320px | Tenant on `tenant/dashboard.html` in 320px viewport | 1. Resize to 320px and read the heading | "Unit 3A, Room 2 · Green Valley Apartments, Dwarka" wraps gracefully; no horizontal scroll; no text clipped | M |
| TC-PROOM-TENANT-006 | Locale — all dates in lease summary are DD/MM/YYYY | Tenant on `tenant/dashboard.html` | 1. Read all dates in the lease summary card | Lease start, Lease end, and payment history dates are all DD/MM/YYYY | H |
| TC-PROOM-TENANT-007 | Monetary values use ₹ with Indian digit grouping | Tenant on `tenant/dashboard.html` | 1. Read Monthly rent and Security deposit | Correct format: ₹8,000 (room-level rent); no Western grouping | H |

### TC-PROOM-MAINT — Maintenance visibility (NR-2)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-PROOM-MAINT-001 | PM maintenance list shows Scope column | PM on `pm/maintenance.html` | 1. Read the `data-table` header row | A "Scope" column is present between Unit and Property columns | H |
| TC-PROOM-MAINT-002 | PM Scope column values use correct badges | PM on `pm/maintenance.html` with seed data containing Shared and Room-specific tickets | 1. Read the Scope column values | Shared tickets: `badge badge-prepaid "Shared"` (blue); Room-specific tickets: `badge badge-partial "Room-specific"` (amber); Unit-based property tickets: `badge badge-closed "Unit"` (gray) | H |
| TC-PROOM-MAINT-003 | PM Scope filter chips work | PM on `pm/maintenance.html` | 1. Click "Shared" chip 2. Click "Room-specific" chip 3. Click "All" chip | Each click filters the table to show only the matching Scope rows; "All" restores all rows; the active chip uses `btn-primary`, inactive chips use `btn-secondary` | H |
| TC-PROOM-MAINT-004 | Tenant sees Scope filter chips only on Room-based property | Tenant on `tenant/maintenance.html`; Room-based lease | 1. Read the page above the cards | Scope filter chips row is visible: "All · Shared · Room-specific" | H |
| TC-PROOM-MAINT-005 | Tenant on Unit-based property sees no Scope filter chips | Tenant on `tenant/maintenance.html`; Unit-based lease | 1. Read the page above the cards | No Scope filter chips row; page renders exactly as the existing prototype with no new UI elements | H |
| TC-PROOM-MAINT-006 | Tenant Scope filter — "Shared" shows only common-area issues | Tenant on `tenant/maintenance.html`; Room-based lease; seed data includes 1 Shared and 2 Room-specific cards | 1. Click "Shared" chip | Only the 1 Shared card is visible; the 2 Room-specific cards are hidden | H |
| TC-PROOM-MAINT-007 | Tenant Scope filter — "Room-specific" shows only own room issues; no cross-room visibility | Tenant (Rohan, Room 2) on `tenant/maintenance.html`; seed includes a Room-specific card for Room 3 (another tenant) | 1. Check visible cards on page load and on "Room-specific" chip | Rohan's own Room-specific cards are shown; Room 3's room-specific card is never included in the page's seed HTML (NR-2 enforced by data scoping, not front-end filter alone) | H |
| TC-PROOM-MAINT-008 | New Request modal on Room-based property includes Scope field | Tenant on Room-based property; new request modal open | 1. Click "+ Raise New Request" 2. Inspect modal form | A "Scope" `<select class="input">` is present with options "Room-specific (default)" and "Shared (common area)"; "Room-specific (default)" is pre-selected | H |
| TC-PROOM-MAINT-009 | New Request modal on Unit-based property excludes Scope field | Tenant on Unit-based property; new request modal open | 1. Click "+ Raise New Request" 2. Inspect modal form | No Scope select visible; form contains only Category, Priority, and Description — identical to the existing prototype | H |

---

## 4. Sign-off

Pre-implementation questions worth confirming before any HTML is authored.

| Date | Question | Proposed default | User answer |
|---|---|---|---|
| 2026-05-26 | NR-1 permanent lock — does "any active lease ever existed" include leases that have since been Terminated or Renewed, or only currently-Active ones? | Permanent: the lock triggers on the first creation of any active lease and never releases, regardless of subsequent terminations. | — pending — |
| 2026-05-26 | Rooms sub-table expand behavior — accordion (only one expanded at a time) or independent (multiple units can be expanded simultaneously)? | Independent — multiple units can be expanded at once. Simpler JS, matches the prototype's existing patterns. | — pending — |
| 2026-05-26 | Shared maintenance — can a tenant raise a Shared request, or is Shared a PM-only raise scope? | Both can raise Shared. Tenant sees the Scope select in the New Request modal defaulting to Room-specific; they can switch to Shared. | — pending — |
| 2026-05-26 | Room labeling convention — sequential integers "Room 1 / Room 2 / Room 3" or custom names (e.g. "Master BR / Room B")? | Sequential integers for the prototype. Custom names are a post-v8 enhancement. | — pending — |
| 2026-05-26 | 4-BHK maximum — is the 4-room/4-lease cap enforced by unit bedroom count or is it configurable? | Enforced by the unit's bedroom count field (existing `bedrooms` column). A 3-BHK unit has 3 rooms, a 4-BHK has 4 rooms. No separate room-cap field needed. | — pending — |

## 5. Execution log

| Date | Event |
|---|---|
| 2026-05-26 | Planning file drafted by gharsetu-frontend. Status: `proposed`. Awaiting gharsetu-lead review and user sign-off on §4 questions before dispatching HTML iteration. |

## 6. Files changed

| File | Change | Touched by |
|---|---|---|
| `docs/planning/features/2026-05-26-per-room-leasing.md` | This planning file | gharsetu-frontend |
| `prototype/admin/properties.html` | Add Leasing Mode column to table; add Leasing mode radio group to Add Property modal (pending — HTML iteration) | gharsetu-frontend |
| `prototype/admin/property-detail.html` | Add Leasing mode row to Property Details card; render NR-1 lock state with disabled select + helper (pending — HTML iteration) | gharsetu-frontend |
| `prototype/admin/units.html` | Add Leasing column; add Rooms sub-table expand affordance for Room-based units (pending — HTML iteration) | gharsetu-frontend |
| `prototype/pm/units.html` | Same as admin/units.html with PM chrome and "View" action on occupied room rows (pending — HTML iteration) | gharsetu-frontend |
| `prototype/pm/leases.html` | Add Room and Scope columns to lease table; add Room select (conditional) to New Lease modal (pending — HTML iteration) | gharsetu-frontend |
| `prototype/pm/lease-detail.html` | Update subtitle and Lease Summary card with lease scope line (pending — HTML iteration) | gharsetu-frontend |
| `prototype/pm/maintenance.html` | Add Scope column to requests table; add Shared + Room-specific filter chips (pending — HTML iteration) | gharsetu-frontend |
| `prototype/pm/tenant-detail.html` | Minor: add Room label to lease summary section (pending — HTML iteration) | gharsetu-frontend |
| `prototype/tenant/dashboard.html` | Update heading and sidebar footer to show "Unit 3A, Room 2" on Room-based leases (pending — HTML iteration) | gharsetu-frontend |
| `prototype/tenant/maintenance.html` | Add Scope filter chips (Room-based only); add Scope badges to cards; add Scope select to New Request modal (pending — HTML iteration) | gharsetu-frontend |
| `docs/testing/v1/Test_Cases.md` | Promote §3 rows under a new "Per-Room Leasing" module (pending — on ship) | gharsetu-tester |
| `./../prototype-changes.md` | New row recording the Per-Room Leasing prototype changes (pending — on ship) | gharsetu-frontend |

## 7. Agents used

| Agent | Task | Status |
|---|---|---|
| gharsetu-lead     | Initial planning + delegation brief                         | accepted |
| gharsetu-frontend | Per-Room Leasing planning file (this file)                 | accepted |
| gharsetu-frontend | Prototype HTML iteration (all 10 pages + nav rollout)       | — pending — |
| gharsetu-tester   | TC-PROOM-PROP/UNIT/LEASE/TENANT/MAINT execution             | — pending — |

## 8. Post-deploy

No issues yet — feature is at `proposed` status. This section stays open indefinitely once shipped; new issues append as dated entries.

## 9. Cross-references

- Solution Overview v8 → §New Features → Leases & Tenants — Per-Room Leasing
- Solution Overview v8 → Business Rules NR-1 (mode locks once any active lease exists) and NR-2 (Shared vs Room-specific maintenance visibility)
- UIUX Design Document → §4 IA (Per-Room Leasing as a property-mode within the Leases & Tenants module), §5 Page Layout Templates, §6 Wireframes (Units sub-table expand, lease-detail scope header, tenant dashboard heading), §7 Components (badge taxonomy, disabled select lock state), §8 Interaction Patterns (expand/collapse, conditional form field show/hide, filter chip toggle), §9 Accessibility (focus ring, keyboard navigation, `aria-expanded` on expand button)
- TEST_CASES — TC-PROOM-PROP-001..008, TC-PROOM-UNIT-001..008, TC-PROOM-LEASE-001..010, TC-PROOM-TENANT-001..007, TC-PROOM-MAINT-001..009 (promoted from §3 on ship)
- `./../prototype-changes.md` — row to be added on ship
- `product/CHANGELOG` — bullet on ship
- Visitor Management planning file (`./2026-05-26-visitor-management.md`) — style exemplar; Per-Room Leasing follows the same §2 zone-table / token-table / interaction-sequence / edge-state depth
