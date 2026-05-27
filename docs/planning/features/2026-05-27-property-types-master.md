# Property Types Master (org-level, Admin-owned)

| Field | Value |
|---|---|
| Status         | shipped (prototype) |
| Started        | 2026-05-27 |
| Shipped        | 2026-05-27 |
| SRS row        | (n/a — prototype-only; app-port carry-over noted in §2.5) |
| Test cases     | TC-PTYPE-001..014 (designed §3, prototype-scope) |
| Prototype todo | row to be added to `docs/planning/prototype-changes.md` on ship |

## 1. Requirement (as given)

> "in the add property form we have Type dropdown but it's not added in the master data — plan it and we need this to add."

The Admin **Add Property** form (`prototype/admin/properties.html`) has a hardcoded **Type** `<select>` (Apartment Complex / Independent Building / Villa). There is no master managing these values, so they can drift and an Admin can't add/retire a type. The properties **table** also shows a *Type* column and rows carry `data-category="apartment-complex" | "independent-building"`. We need a **Property Types master** and the form dropdown wired to it.

---

## 2. Plan

### 2.1 Ownership decision — org-level (Admin), not platform (Super Admin)

**Decision: Property Types is an org-level master, owned by Admin**, sitting alongside the existing Admin masters (Amenities, Maintenance Categories, Visit Purposes).

Rationale:
- It is consumed by an **Admin-scoped** form (Add Property), exactly like Amenities is consumed by Admin property/unit forms.
- The existing org masters (`prototype/admin/master-data/*`) are operational config each org tailors; Property Types fits that group.
- The platform masters (Cities, States, Payment Methods, **Business Types**) describe cross-org/global data. **Business Types** already covers the *organization's* classification (PG/Hostel, Housing Society…) at the platform level — Property Types is a different axis (the kind of *building*), used inside an org's own property creation. Keeping it org-level lets a PG operator and a society each curate their own list.

> Alternative considered: platform-level standard taxonomy (like Business Types). Rejected because the consuming surface is the Admin form and the values are org-tailorable. If the user prefers a platform-standard list later, the page + JS move under `super-admin/master-data/` with `organization_id` dropped — low cost.

### 2.2 Single-source data (mirrors Business Types)

New `prototype/assets/property-types.js` — canonical list + a `<select>` renderer, exactly mirroring `assets/business-types.js`:

```js
window.GHARSETU_PROPERTY_TYPES = [ { id, name, props, status }, … ];
window.renderPropertyTypeOptions = function (selectId) { … active types → <option> … };
```

- The **Add Property** Type `<select>` (`#add-prop-type`) renders via `renderPropertyTypeOptions('add-prop-type')` — no hardcoded options.
- The **master page** keeps hardcoded table rows kept in sync with the array (same convention as `business-types.html` ↔ `business-types.js`; the JS comment names the master page as the sync target).

Seed values (grounded in what the prototype already uses + sensible additions):

| Type | Used by (properties) | Status |
|---|---|---|
| Apartment Complex | 12 | active |
| Independent Building | 6 | active |
| Villa | 0 | active |
| Independent Floor | 0 | active |
| Plot / Land | 0 | deactivated |

In-use rows (count > 0) get the **disabled** Deactivate button + the `title` tooltip pattern shipped 2026-05-27 ("Cannot deactivate — currently used by N property(ies). Retire those references first."). Zero-use active rows get a live Deactivate (confirm modal). The deactivated row shows Reactivate.

### 2.3 New master page

`prototype/admin/master-data/property-types.html` — clone of `prototype/admin/master-data/amenities.html` (org-level Admin chrome: sidebar with Master Data sub-menu, topbar, mobile tabbar + More-sheet, account menu/sheet). Page title **"Property Types"**, primary button **"+ Add Property Type"**. Table columns: **Name · Used by (properties) · Status · Actions**. Search (`data-pg-search`) + Status filter + pagination (`paginate.js`). Add/Edit modal (name field, custom validator — no native tooltips) + Deactivate/Reactivate confirm modal. No helper-caption text under the title (per project rule).

### 2.4 Landing + navigation rollout

- `prototype/admin/master-data.html` — add a 4th card **Property Types** (icon + name, no caption), linking to `master-data/property-types.html`.
- **Sidebar Master Data sub-menu** — insert a `Property Types` sublink **first** (groups property config together: Property Types · Amenities · Categories · Visit Purposes) across **all 16 admin pages** carrying the sub-menu (the 13 main admin pages + the 3 master subpages incl. the new one). On the new page the sublink is `active`.
- **More-sheet Master Data sub-menu** — same insert across the 13 admin main pages' more-sheets.

This consistency is mandatory — a prior session shipped a sidebar that was inconsistent (payment-methods missing a sublink); the rollout must hit every file.

### 2.5 App-port carry-over (for the eventual `apps/api` / `apps/web`)

- New table `property_types` — **org-level**: `id` int PK autoincrement, `organization_id` NOT NULL, `name`, `status` smallint (0=active,1=deactivated), standard audit columns. Relation declared in Prisma (no SQL FK). Every mutation writes an `audit_log` row.
- Deactivate blocked while `usage_count > 0` (count of `properties` referencing the type) — soft-retire only, never DELETE.
- `properties.property_type_id` FK-by-relation. Add-Property dropdown loads active types for the org.
- Unique `(organization_id, lower(name))` to prevent duplicates within an org.

### 2.6 Files to touch

| File | Change |
|---|---|
| `prototype/assets/property-types.js` | **NEW** — canonical list + `renderPropertyTypeOptions()` |
| `prototype/admin/master-data/property-types.html` | **NEW** — master page (clone of amenities) |
| `prototype/admin/master-data.html` | + Property Types card (4th) |
| `prototype/admin/properties.html` | load `property-types.js`; render `#add-prop-type` via `renderPropertyTypeOptions`; add Property Types sublink to sidebar + more-sheet |
| 15 other admin pages w/ Master Data sub-menu | + Property Types sublink (sidebar; + more-sheet where present) |

**Not touched:** any `apps/*` (prototype-only); platform `super-admin/master-data/*`; other roles.

---

## 3. Test cases (designed up front, prototype-scope)

| TC-ID | Title | Expected |
|---|---|---|
| TC-PTYPE-001 | Add Property dropdown renders from master | `#add-prop-type` options = active `GHARSETU_PROPERTY_TYPES` (no hardcoded `<option>`) |
| TC-PTYPE-002 | Deactivated type absent from dropdown | "Plot / Land" not offered in Add Property |
| TC-PTYPE-003 | Master page lists all seed types | 5 rows; counts + status badges correct |
| TC-PTYPE-004 | Search filters by name | typing "villa" → only Villa row |
| TC-PTYPE-005 | Status filter | "Deactivated" → only Plot / Land |
| TC-PTYPE-006 | Add type | modal → new active row appended; validates non-empty name below field (no native tooltip) |
| TC-PTYPE-007 | Edit type | rename persists in row |
| TC-PTYPE-008 | Deactivate (0 usage) | confirm modal → row → Deactivated badge + Reactivate |
| TC-PTYPE-009 | Deactivate blocked (in use) | Apartment Complex/Independent Building show disabled Deactivate + `title` tooltip with count |
| TC-PTYPE-010 | Reactivate | Plot / Land → active |
| TC-PTYPE-011 | Pagination | per-page select + paginate works; tile/search reset |
| TC-PTYPE-012 | Sidebar sub-menu | Property Types appears first in Master Data on all 16 admin pages; active on its own page |
| TC-PTYPE-013 | More-sheet sub-menu | Property Types appears in More-sheet Master Data on the 13 main admin pages |
| TC-PTYPE-014 | a11y | modal traps focus + Esc; Add button ≥44px; no helper caption under title |

---

## 4. Open decisions

| # | Decision | Resolution |
|---|---|---|
| OD-1 | Org-level (Admin) vs platform (Super Admin) | **Org-level (Admin)** — see §2.1. Proceeding on this default; trivially movable if user prefers platform. |
| OD-2 | Sub-menu position | **First** in Master Data (Property Types · Amenities · Categories · Visit Purposes) — groups property config. |
| OD-3 | Seed list | 5 types (§2.2), grounded in the 3 the prototype already uses + Independent Floor + Plot/Land(deactivated). |

---

## 5. Execution log

| Date | Agent | Entry |
|------|-------|-------|
| 2026-05-27 | (orchestrator) | Plan authored before code per Working rule §2. Investigated: Categories master = Maintenance Categories (not property type), so Property Type genuinely unmastered. Ownership resolved org-level. Implementation next. |

## 6. Files changed

| File | Change |
|------|--------|
| `prototype/assets/property-types.js` | NEW — `GHARSETU_PROPERTY_TYPES` (5 seed) + `renderPropertyTypeOptions(selectId, selectedId)` |
| `prototype/admin/master-data/property-types.html` | NEW — org master page (clone of amenities); 5 rows; deactivate-block tooltips on in-use rows; Property Types sublink first + active |
| `prototype/admin/master-data.html` | + Property Types card (first); + sublink in sidebar & more-sheet |
| `prototype/admin/properties.html` | Add Property: Type `<select>` now rendered via `renderPropertyTypeOptions('add-prop-type')` (loads `property-types.js`); + sublink in sidebar & more-sheet |
| 15 other admin pages | + Property Types sublink (sidebar; + more-sheet where present) — 32 inserts via script, total 17 pages now carry it |

**Verification:** `property-types.js` `node --check` OK; 17/17 admin pages carry the sublink in both navs; 17/17 admin pages tag-balanced; Add form has 1 render call + `property-types.js` loaded, 0 leftover multi-select/chips.

### Related changes shipped same session (adjacent to this feature)
- **Add Property — Amenities → checkbox list** (user request): replaced the `<select multiple>` + chip sync with an 8-item checkbox grid (`name="amenities"`), removed `syncAmenityChips`/`#amenityChips`. Helper trimmed to "Managed in Master Data → Amenities."
- **Visit Purposes master — in-cell deactivate note → button `title`** (user: "we already decided to remove it"): the 6-master tooltip sweep had missed visit-purposes (different wording "Used by N visits…"); applied the same canonical tooltip + removed the 5 `<p role="note">` lines. All 8 masters now consistent.

## 7. Cross-references

- `prototype/assets/business-types.js` + `super-admin/master-data/business-types.html` — the analogous single-source master this mirrors.
- `docs/planning/features/2026-05-27-master-data-ownership-split.md` — platform vs org master ownership model.
- `docs/planning/features/2026-05-27-business-types-master.md` — sibling master.
- gharsetu-ui skill — master-page table/modal/validation patterns; no helper-caption rule.
