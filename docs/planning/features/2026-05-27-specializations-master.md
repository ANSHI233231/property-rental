# Maintenance Specializations Master (org-level, Admin-owned)

| Field | Value |
|---|---|
| Status         | in progress (prototype) |
| Started        | 2026-05-27 |
| Shipped        | — |
| SRS row        | Module 7 (Master Data) — add Specializations to the org-master list |
| Test cases     | TC-SPEC-001..012 (designed §3, prototype-scope) |
| Prototype todo | row to be added to `docs/planning/prototype-changes.md` on ship |

## 1. Requirement (as given)

> "we have a Specialization dropdown while adding the user of maintenance role but we don't have any master of it. we need to plan for a master for this and also make this a dropdown to a checkbox list so one person can have multiple Specialization."

The Admin **Add User** form (`prototype/admin/users.html`) shows a hardcoded **Specialization** `<select>` (Plumber / Electrician / Carpenter / HVAC / Cleaner / General) only when role = Maintenance. There is no master managing those values, and the single-select limits a worker to one trade. We need (a) a **Specializations master** (org-level), and (b) the Add-User field to become a **multi-checkbox** so a maintenance user can hold several specializations.

---

## 2. Plan

### 2.1 Ownership decision — org-level (Admin)

**Decision: org-level master, owned by Admin**, alongside Property Types / Amenities / Categories / Visit Purposes. The consuming surface (Add User → Maintenance) is Admin-scoped, and the trade list is org-tailorable (a society vs a PG operator curate different trades). Same rationale as Property Types (`2026-05-27-property-types-master.md` §2.1).

### 2.2 Single-source data (mirrors property-types.js)

New `prototype/assets/specializations.js`:

```js
window.GHARSETU_SPECIALIZATIONS = [ { id, name, staff, status }, … ];
window.renderSpecializationCheckboxes = function (containerId, selected) { … active → <label><input type=checkbox name="specializations">…</label> … };
```

- Add-User field becomes `<div id="specCheckboxes">` populated by `renderSpecializationCheckboxes('specCheckboxes')` — **`name="specializations"` (plural), multi-select** via checkboxes, styled like the Add-Property Amenities list (saffron `accent-color`, Inter 14px).
- Master page keeps table rows in sync with the array (same convention as the other masters).

Seed values (grounded in the specializations the prototype already shows on maintenance rows + sensible additions):

| Specialization | Staff using | Status |
|---|---|---|
| Plumber | 1 | active |
| Electrician | 1 | active |
| Carpenter | 1 | active |
| HVAC | 1 | active |
| Cleaner | 0 | active |
| General | 0 | active |
| Painter | 0 | deactivated |

In-use rows (staff > 0) get the **disabled** Deactivate button + `title` tooltip ("Cannot deactivate — currently used by N staff member(s). Reassign them first."). Zero-use active rows get a live Deactivate (confirm modal). Deactivated row shows Reactivate.

### 2.3 New master page

`prototype/admin/master-data/specializations.html` — clone of `master-data/amenities.html` (org-level Admin chrome). Title **"Specializations"**, primary button **"+ Add Specialization"**. Columns **Name · Staff · Status · Actions**. Search + Status filter + pagination + serial `#` column (per `2026-05-27-listing-serial-numbers.md`). Add/Edit modal (name, custom validator, no native tooltip) + Deactivate/Reactivate confirm modal. **No helper caption** under the title.

### 2.4 Landing + navigation rollout

- `prototype/admin/master-data.html` — add a **Specializations** card (after Amenities; icon + name, no caption).
- **Sidebar Master Data sub-menu** — insert a `Specializations` sublink **after Amenities** (Property Types · Amenities · Specializations · Categories · Visit Purposes) across **all admin pages** carrying the sub-menu (incl. the new page, where it is `active`).
- **More-sheet Master Data sub-menu** — same insert across all admin main pages' more-sheets.

Consistency is mandatory — every admin surface must carry the sublink in the same position.

### 2.5 App-port carry-over

- New table `specializations` — **org-level**: `id` int PK autoincrement, `organization_id` NOT NULL, `name`, `status` smallint (0=active,1=deactivated), audit columns. Prisma relation (no SQL FK). Every mutation → `audit_log` row.
- A maintenance user ↔ specializations is **many-to-many** → join table `maintenance_user_specializations (user_id, specialization_id)`. (Today the prototype/maintenance model implied one trade; this migrates to N.)
- Deactivate blocked while `staff_count > 0` — soft-retire only, never DELETE.
- Unique `(organization_id, lower(name))`.

### 2.6 Files to touch

| File | Change |
|---|---|
| `prototype/assets/specializations.js` | **NEW** — list + `renderSpecializationCheckboxes()` |
| `prototype/admin/master-data/specializations.html` | **NEW** — master page (clone of amenities) |
| `prototype/admin/master-data.html` | + Specializations card |
| `prototype/admin/users.html` | Add-User Specialization → checkbox list rendered from master; load `specializations.js`; + sublink in sidebar & more-sheet |
| all other admin pages w/ Master Data sub-menu | + Specializations sublink (sidebar; + more-sheet where present) |

**Not touched:** any `apps/*`; platform `super-admin/master-data/*`; other roles.

---

## 3. Test cases (prototype-scope)

| TC-ID | Title | Expected |
|---|---|---|
| TC-SPEC-001 | Add-User checkboxes render from master | `#specCheckboxes` = active `GHARSETU_SPECIALIZATIONS`; `name="specializations"`; no hardcoded `<select>` |
| TC-SPEC-002 | Multi-select | two trades checkable simultaneously |
| TC-SPEC-003 | Deactivated trade absent | "Painter" not offered in Add User |
| TC-SPEC-004 | Shown only for Maintenance role | spec block hidden for Property Manager |
| TC-SPEC-005 | Master lists seed | 7 rows; staff counts + status correct |
| TC-SPEC-006 | Search by name | "plumb" → Plumber only |
| TC-SPEC-007 | Status filter | Deactivated → Painter only |
| TC-SPEC-008 | Add | modal → new active row; validates name below field |
| TC-SPEC-009 | Deactivate (0 staff) | confirm → Deactivated + Reactivate |
| TC-SPEC-010 | Deactivate blocked (in use) | Plumber/Electrician/Carpenter/HVAC disabled Deactivate + `title` count |
| TC-SPEC-011 | Sidebar + more-sheet sub-menu | Specializations after Amenities on every admin surface; active on its page |
| TC-SPEC-012 | a11y | modal focus-trap + Esc; checkbox labels clickable; no helper caption |

---

## 4. Open decisions

| # | Decision | Resolution |
|---|---|---|
| OD-1 | Org-level vs platform | **Org-level (Admin)** — §2.1 |
| OD-2 | Position in Master Data | **After Amenities** (between Amenities and Categories) |
| OD-3 | Single vs multi specialization | **Multi** (checkbox + M2M join in app) — per user request |
| OD-4 | Seed list | 7 (the 4 trades already on maintenance rows + Cleaner/General + Painter deactivated) |

---

## 5. Execution log

| Date | Agent | Entry |
|------|-------|-------|
| 2026-05-27 | (orchestrator) | Plan authored. `specializations.js` + Add-User checkbox list + users.html nav sublink done in main session; master page + remaining nav rollout delegated to `gharsetu-frontend`. |

## 6. Cross-references
- `2026-05-27-property-types-master.md` — sibling org master this mirrors.
- `2026-05-27-master-data-ownership-split.md` — platform vs org ownership.
- `2026-05-27-listing-serial-numbers.md` — the master page table carries the `#` column.
