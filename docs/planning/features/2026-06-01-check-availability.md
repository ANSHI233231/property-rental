# Feature plan — Check Availability (search-and-lease) page

| Field | Value |
|---|---|
| Status         | in-progress (prototype built 2026-06-02) |
| Started        | 2026-06-01 |
| Shipped        | — |
| SRS row        | extends Leases/Units (no new business rule; BL-01/BL-18 availability rules reused) |
| Test cases     | TC-AVAIL-01..12 (designed below) |
| Prototype todo | row in `docs/planning/prototype-changes.md` (added on ship) |

---

## 1. Requirement (as given)

> "On the Properties page, alongside the Add Property button add one more button **Check Availability**. On this page we give many filters like date range, units, room, bedrooms, bathrooms, kitchen, prices, type — room or unit, ranges, amenities, properties, city, state and many other — whatever is added on the meta. Then show a card kind of layout that clearly tells which units / which unit is available. Filters will be in a sidebar and the cards in the center content. Clicking a card opens a popup that gives a full details summary about that unit or room, then a **Create Lease** button; clicking it carries the selected things and opens the Create Lease page pre-filled."

## 2. Plan

### 2.1 Entry point
- `admin/properties.html` topbar: add a **secondary** button **"Check Availability"** beside the existing actions → `Export · Check Availability · + Add Property`. Links to the new page `admin/check-availability.html`.

### 2.2 New page `admin/check-availability.html`
Standard admin chrome (sidebar nav — Properties active, topbar, tabbar, MoreSheet, account menu). Page title **"Check Availability"**. No back-link, no helper-caption text (saved UX prefs).

**Two-column body inside `.app-main`:**
- **Left — filter rail** (`.avail-filters`, sticky, ~280px). This is the in-content filter sidebar (distinct from the global nav sidebar).
- **Right — results** (`.avail-results`): a header line with the **live result count**, then a responsive **card grid** (3-col desktop → 2 → 1) of available units/rooms. *(Sort control deferred — not in the original ask; add later if wanted.)*

**Mobile (≤1023px):** the filter rail collapses behind a **"Filters" button** that opens a bottom sheet / slide-in panel (the global nav already owns the hamburger-drawer + bottom tabbar, so filters get their own toggle); results go full-width, 1 col.

### 2.3 Filters (left rail) — all master-data-driven where applicable
1. **Availability window** — From / To date-range (`date-picker.js` pair `data-pair-min/max`). Prototype rule (simple): a unit/room qualifies if `status` is available/listed AND `availableFrom ≤ From`. *(The full "no overlapping active/upcoming lease" check — BL-01/BL-18 — is server logic for the app port, not the static prototype; noted in §8, not built here.)*
2. **Looking for** — Unit / Room / Both (segmented). Drives result granularity — see the **no-double-count rule** in §2.4.
3. **Property** — searchable combobox (rule #18, `data-searchable`).
4. **State → City** — cascade from `assets/locations.js` (`GHARSETU_STATES` / `GHARSETU_CITIES`, same as signup). ✅ asset exists.
5. **Property type** — from `assets/property-types.js` (`GHARSETU_PROPERTY_TYPES`). ✅ asset exists.
6. **Bedrooms (BHK)** — min/exact, derived from unit `type` ("2 BHK" → 2). **Fallback:** non-BHK types (e.g. `PG Unit`) have no bedroom count → excluded from / ignored by this filter (treated as "—").
7. **Bathrooms** — min. *(net-new mock field — see §2.6.)*
8. **Kitchen** — Any / Yes / No. *(net-new mock field.)*
9. **Rent range** — min–max (₹, two numeric inputs; en-IN grouping).
10. **Area range** — min–max (sq ft). *(Optional — "ranges" in the ask; include if cheap, else drop.)*
11. **Amenities** — multi-checkbox, match-all. **⚠ Source gap:** there is **no `assets/amenities.js`** today — amenities are hard-coded checkboxes in `properties.html` (CCTV, Gym, Lift, Parking, Power backup, Security, Swimming pool, Water softener) and managed only as a page (`master-data/amenities.html`). **This feature will first create `assets/amenities.js`** as the single source (extract that list) so the filter, the property form, and the master page all read one array. *(Small refactor — flagged as added scope; alternative is to hard-code the same 8 values on this page.)*
12. **"…and many others whatever is on the meta"** — realistically this means the masters that actually describe a unit: **amenities, property type, city/state**. Those render from their shared assets so adding a value there auto-appears here. The other masters (Maintenance Categories, Visit Purposes, Specializations) do **not** relate to unit availability and are out of scope for these filters. *(Claim tightened from the first draft.)*
- **Clear all** link + a live **"N available"** count. Filtering is client-side over the mock `INVENTORY` (debounced); each control re-runs `applyFilters()`.

### 2.4 Result cards (`.avail-card`)
**Granularity / no-double-count rule (Looking for):**
- **Unit** → only whole-unit-leasable units (`hasRooms: false`) that are available.
- **Room** → only individually-available **rooms** inside room-based units (`hasRooms: true`).
- **Both** → the **union**: each non-room unit as a unit card + each available room as a room card. A room-based unit is represented by its **rooms only** (never also as a parent-unit card), so a 4-room unit can't appear as 1 unit + 4 rooms.

Each available unit/room renders a card:
- **Lead:** combined **Property · Unit (· Room)** in one bold cell (per `property-unit-combined-cell`), with a small type chip (**Unit-wise** / **Room-wise**).
- **Facts row:** BHK · bath · area (sq ft) · floor; **₹ rent/month** prominent.
- **Availability:** green **Available** badge + "Available from DD/MM/YYYY".
- **Amenities:** up to 3 chips + "+N".
- Whole card is a button → opens the **details popup** for that id.
- **Empty state:** "No available units or rooms match these filters."

### 2.5 Details popup (modal)
Opens on card click — a summary of the unit/room:
- **Header:** Property name · Unit (· Room) + **Available** badge.
- **Attribute grid:** Type / BHK · Bathrooms · Kitchen · Area · Floor · Monthly rent · Deposit · City · State · Available from · (room: parent unit).
- **Amenities:** full chip list.
- **Footer:** **Cancel** + **Create Lease** (primary).
- **Create Lease** → navigates to `create-lease.html?unitId=<n>` (unit) or `create-lease.html?unitId=<n>&roomId=<m>` (room). This reuses the **existing** wizard deep-link handler (`create-lease.html` already reads `?unitId/&roomId`, sets `leaseType` unit-/room-wise, pre-renders Steps 2/3, and lands on **Step 4 — Tenants**). No change to the wizard required.
  - *Optional enhancement (open decision 4):* also pass `&start=<From>` to prefill the lease start from the availability window. Deferred unless requested — the wizard's date step already handles this and BL conflict checks run there.

### 2.6 Data model (CLAUDE.md rule #19 — numeric ids, relations by id)
One mock `INVENTORY` for the page, extending the create-lease `UNITS`/`ROOMS` shape with the facets the filters need (kept consistent with `create-lease.html` ids so the deep-link resolves):
```
// units carry these extra facets; rooms inherit unit facets + own rent/availableFrom
{ id, kind:'unit'|'room', propertyId, unitId(room only), label, type:'2 BHK',
  bedrooms, bathrooms, kitchen:true, area, floor, rent, deposit,
  status:'available'|'listed', availableFrom:'DD/MM/YYYY',
  amenityIds:[…]  // → amenities master ids
}
// city/state derived from PROPERTIES (property → city/state)
```
- Only **available** inventory is searched (occupied/retired excluded). Numeric ids match `create-lease.html` so `?unitId/&roomId` deep-links resolve to the right wizard selection.
- **Net-new fields:** today's `UNITS` only carry `type · area · floor · rent · status · hasRooms`; `ROOMS` carry `rent · status · occupied`. So **`bedrooms`, `bathrooms`, `kitchen`, `amenityIds`, `deposit`, `availableFrom` are all new mock fields** added for this page (deposit currently exists only as a create-lease form input). Bedrooms is derived from `type` where parseable.
- Single source: property-types + cities/states come from existing `assets/*.js`; **amenities will get a new `assets/amenities.js`** (see §2.3 #11) — it is not a single source today.

### 2.7 Tokens / reuse
Reuse `.card`, `.btn*`, `.badge*`, `.label`, `.input`, `.task-chip`-style chips, `.modal*`, `searchable-select.js`, `date-picker.js`, `toast.js`. New layout CSS for `.avail-filters` / `.avail-results` / `.avail-card` (grid + sticky rail + mobile sheet) **composes existing tokens — no new colors/radii**. Added to `assets/styles.css` (shared) so the pattern is reusable.

### 2.8 Scope notes
- **Admin first.** A PM-scoped mirror (assigned properties only) is a follow-up, not this pass.
- Read-only search → the only write path is **Create Lease**, which hands off to the existing audited wizard. No availability data is persisted.

## 3. Test cases (designed up front)

| TC-ID | Title | Steps | Expected | Pri |
|----------|-------|-------|----------|-----|
| TC-AVAIL-01 | Entry button | Properties page → click **Check Availability** | Navigates to `check-availability.html` | H |
| TC-AVAIL-02 | Default list = available only | Load page, no filters | Only available/listed units+rooms shown; occupied excluded; count matches | H |
| TC-AVAIL-03 | Looking-for = Room | Set to Room | Only individual available **rooms** card-listed (room-based units expanded) | H |
| TC-AVAIL-04 | Looking-for = Unit | Set to Unit | Only **unit** cards; room-based units shown as a single unit card | M |
| TC-AVAIL-05 | Rent range | Set min 15000 max 20000 | Only cards with rent in range | H |
| TC-AVAIL-06 | Amenities match-all | Select 2 amenities | Only inventory having both | M |
| TC-AVAIL-07 | State→City cascade | Pick state, then city | City list scopes to state; results scope to city | M |
| TC-AVAIL-08 | Availability window | Set From in future | Excludes inventory not free for the window | M |
| TC-AVAIL-09 | Empty state | Over-constrain filters | "No available units or rooms match these filters." | M |
| TC-AVAIL-10 | Card → popup | Click a card | Popup shows full attribute summary + amenities + Create Lease | H |
| TC-AVAIL-11 | Create Lease (unit) | Popup → Create Lease on a unit | Opens `create-lease.html?unitId=<n>`; wizard lands on Step 4 with that unit pre-selected, unit-wise | H |
| TC-AVAIL-12 | Create Lease (room) | Popup → Create Lease on a room | Opens `…?unitId=<n>&roomId=<m>`; wizard Step 4, room-wise, room pre-selected | H |

## 4. Sign-off (open decisions)
- [ ] **D1 — page name** `admin/check-availability.html`. *(Recommended)*
- [ ] **D2 — mobile filters** collapse into a slide-in "Filters" sheet (vs an inline accordion at top). *(Recommended: sheet)*
- [ ] **D3 — "Looking for" default** = **Both**. *(Recommended)*
- [ ] **D4 — pass availability `From` into the wizard** as the lease start (`&start=`)? *(Recommended: no — keep deep-link to unit/room only; wizard owns dates.)*
- [ ] **D5 — Admin only this pass** (PM mirror later). *(Recommended)*
- [ ] Awaiting go-ahead to implement.

## 5. Execution log
- 2026-06-01 — plan authored (proposed). Grounded against `create-lease.html` deep-link handler (reads `?unitId/&roomId`, lands Step 4) and the `PROPERTIES/UNITS/ROOMS` numeric-id shape.
- 2026-06-02 — **BUILT** (recommended defaults D1–D6). NEW `admin/check-availability.html` (filter rail + result cards + details popup, `PROPERTIES/UNITS/ROOMS` numeric-id mock → flat `INVENTORY`); NEW `assets/amenities.js` single source (+ `amenityName`); `properties.html` got the **Check Availability** topbar button; `.avail-*` CSS appended (compose existing tokens, mobile filter sheet). Filters: looking-for (Both/Units/Rooms), availability-from, property (searchable), state→city, type, bedrooms/bathrooms (min), kitchen, rent/area ranges, amenities (match-all). Popup → Create Lease via existing `?unitId/&roomId` deep-link. Verified (DOM-stub): script parses, 5 unit + 7 room cards (12 in Both), every deep-link id resolves in `create-lease.html`, no-double-count holds (room-based units show rooms only). No commit.
- 2026-06-02 — **plan audited** (pre-build). Corrected: `assets/amenities.js` does **not** exist (was cited 3×) → feature now creates it; tightened the "any meta master auto-filters" claim to amenities/property-type/city-state only; flagged `bedrooms/bathrooms/kitchen/amenityIds/deposit/availableFrom` as **net-new mock fields** (not on `UNITS`/`ROOMS` today); added the **Looking-for no-double-count rule** (room-based units show rooms, not also the parent); added a **PG-Unit bedrooms fallback**; simplified the availability-window rule for the prototype (status+availableFrom only; lease-overlap is app-port); deferred the **sort** control and marked **area range** optional. Still awaiting go-ahead.

## 6. Files changed (planned)

| File | Change | Touched by |
|------|--------|------------|
| prototype/admin/check-availability.html | NEW page — filter rail + result cards + details popup; `INVENTORY` mock (with the net-new facet fields); deep-links to create-lease | gharsetu-frontend |
| prototype/assets/amenities.js | **NEW single-source amenity list** (extract the 8 hard-coded values) so the filter + property form + master page share one array | gharsetu-frontend |
| prototype/admin/properties.html | add **Check Availability** topbar button; (optionally) render the amenities checkboxes from the new asset | gharsetu-frontend |
| prototype/assets/styles.css | `.avail-filters`/`.avail-results`/`.avail-card` + mobile filter-sheet (compose existing tokens) | gharsetu-frontend |
| docs/planning/prototype-changes.md | ledger row on ship | gharsetu-frontend |

## 7. Agents used
| Agent | Task | Status |
|-------|------|--------|
| orchestrator (Opus) | Plan + prototype implementation (orchestrator-direct) | proposed |

## 8. Post-deploy / app-port
- Route `/admin/availability` (or a Properties tab). Server endpoint `GET /units/availability?from&to&type&propertyId&cityId&stateId&bedrooms&bathrooms&kitchen&rentMin&rentMax&areaMin&areaMax&amenityIds[]` returning only inventory free for the window (no overlapping active/upcoming lease — BL-01/BL-18), scoped by `organization_id` + role. Filter facets come from the same master tables that feed the masters UI. "Create Lease" routes to `/admin/leases/new?unitId=&roomId=` — the wizard owns dates + co-tenant/consent + conflict checks.

## 9. Cross-references
- `admin/create-lease.html` — deep-link handler (`?unitId/&roomId` → Step 4) this page hands off to.
- `assets/property-types.js` (`GHARSETU_PROPERTY_TYPES`) + `assets/locations.js` (`GHARSETU_STATES`/`GHARSETU_CITIES`) — existing filter facet sources. **`assets/amenities.js` does not exist yet** — created by this feature (amenities currently hard-coded in `properties.html` + `master-data/amenities.html`).
- `assets/searchable-select.js` (rule #18), `assets/date-picker.js` (range pair).
- BL-01 (one active lease per unit), BL-18 (turnover gap) — availability semantics.
- Saved UX prefs: combined Property·Unit cell; no helper captions; no back-link.
