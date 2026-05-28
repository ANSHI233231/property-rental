# Searchable Property / Unit dropdowns (rule #18)

| Field | Value |
|---|---|
| Status         | **shipped (prototype)** |
| Started        | 2026-05-27 |
| Shipped        | 2026-05-27 |
| Rule           | CLAUDE.md technical convention **#18** |
| SRS row        | UI/UX contract (presentation) |
| Test cases     | TC-SDD-001..012 |

## 1. Requirement (as given)

> "If we have a properties or unit dropdown we need to show it as a **searchable dropdown**, not a default select dropdown. Add this rule, plan it, and find all the places where we have a properties or unit dropdown so we can change it."

Every `<select>` that lists **properties** or **units** becomes a **type-to-filter combobox**. Other selects (status, role, category, plan, master types, per-page, expected-count ranges) stay native.

## 2. Component design — `assets/searchable-select.js` (+ CSS in `styles.css`)

A small **vanilla, accessible** combobox that **progressively enhances** a native `<select data-searchable>` (no external library — consistent with the prototype's no-dependency approach).

- **Native `<select>` stays the source of truth** — it's hidden (visually), keeps the form value, and `validation.js` keeps working against it (errors still render below the field). The component mirrors selection back into the native select and dispatches a `change` event so existing `onchange` handlers (e.g. `Paginator.setAttrFilter`, the maintenance cascade) fire unchanged.
- **Rendered UI:** a text input (the combobox) + a filtered listbox panel. Type → filter options (case-insensitive, substring). Click / Enter selects; Esc closes; ↑/↓ moves; typing reopens.
- **ARIA combobox pattern:** `role="combobox"` + `aria-expanded` + `aria-controls`; listbox `role="listbox"`, options `role="option"` + `aria-selected`; `aria-activedescendant` for keyboard focus. Label association preserved.
- **Design tokens:** reuse `.input` styling for the box; panel uses card surface + `--color-mid-gray` border + royal-blue active row; respects reduced-motion; ≥44px touch targets; mobile = full-width panel.
- **Dynamic options (critical):** cascading unit lists (maintenance Property→Unit) and JS-rendered options (`locations.js`, `property-types.js`) repopulate the native `<select>`. The component exposes **`SearchableSelect.refresh(idOrEl)`** and also watches via `MutationObserver` so it rebuilds its list when `<option>`s change. The maintenance cascade calls `refresh('flt-unit')` after repopulating.
- **Init:** `SearchableSelect.initAll()` on DOMContentLoaded enhances every `[data-searchable]`. Idempotent (guard flag).
- **Fallback:** if JS fails, the native `<select>` still works (progressive enhancement).

## 3. Audit — every Property / Unit dropdown (16 + 1 borderline)

Found via `/tmp/claude/dropdown_audit.py` (classifies each `<select>` by label + options; excludes property-**type**, per-page, plan caps, expected-unit-count ranges, manager).

| # | File | Sel id | Kind | Context |
|---|------|--------|------|---------|
| 1 | `admin/create-lease.html` | `cl-property` | Property | Create-lease property |
| 2 | `admin/create-lease.html` | `cl-unit` | Unit | Create-lease unit |
| 3 | `admin/leases.html` | `propertyFilter` | Property | Leases list property filter |
| 4 | `admin/maintenance-detail.html` | `ra-prop` | Property | Reassign → property |
| 5 | `admin/maintenance-detail.html` | `ra-unit` | Unit | Reassign → unit |
| 6 | `admin/maintenance.html` | `flt-prop` | Property | Maintenance filter (cascade source) |
| 7 | `admin/maintenance.html` | `flt-unit` | Unit | Maintenance filter (cascade, dynamic) |
| 8 | `admin/maintenance.html` | `req-prop` | Property | Raise-request property |
| 9 | `admin/maintenance.html` | `req-unit` | Unit | Raise-request unit |
| 10 | `admin/property-detail.html` | `cl-unit` | Unit | Unit picker |
| 11 | `pm/leases.html` | `unit` | Unit | Lease unit |
| 12 | `pm/maintenance.html` | `flt-prop` | Property | Maintenance filter (cascade source) |
| 13 | `pm/maintenance.html` | `flt-unit` | Unit | Maintenance filter (cascade, dynamic) |
| 14 | `pm/maintenance.html` | `req-unit` | Unit | Raise-request unit |
| 15 | `pm/rent-collection.html` | `unit-select` | Unit | Rent period unit |
| 16 | (PM raise modal has unit only — no property field) | | | |
| — | `admin/rent.html` | `ap-lease` | **Borderline** | A *lease* picker whose options read "tenant · unit · property". Not strictly a property/unit picker; **propose** making it searchable too (long list) — confirm. |

Dynamic/cascade ones needing `refresh()`: `flt-unit` on `admin/maintenance.html` + `pm/maintenance.html`. Options rendered by JS: `cl-property`/`cl-unit` style forms, any `renderPropertyTypeOptions`/`locations.js` (those are type/city, out of scope).

## 4. Rollout steps
1. Build `assets/searchable-select.js` + append `.gs-combobox*` CSS to `styles.css`.
2. Add `data-searchable` to the 16 selects above; ensure each page loads `searchable-select.js` (after `paginate.js`).
3. Maintenance cascade: call `SearchableSelect.refresh('flt-unit')` at the end of `onMaintPropChange` (both pages).
4. Confirm the borderline `ap-lease` (include or skip).
5. Verify (§5) + sync `prototype-changes.md` + change-log.

## 5. Test cases
| TC-ID | Title | Expected |
|---|---|---|
| TC-SDD-001 | Enhance | each of the 16 renders as a combobox, not a native select |
| TC-SDD-002 | Filter | typing filters options (case-insensitive substring) |
| TC-SDD-003 | Select (mouse) | click sets value + closes + native select updated + `change` fired |
| TC-SDD-004 | Keyboard | ↑/↓ move, Enter selects, Esc closes |
| TC-SDD-005 | Filter wiring intact | maintenance Property/Unit/Priority/Assignee still filter the table |
| TC-SDD-006 | Cascade refresh | choosing a property repopulates Unit combobox; its searchable list refreshes |
| TC-SDD-007 | Validation | required property/unit still errors below field (no native tooltip) |
| TC-SDD-008 | a11y | combobox/listbox/option roles + aria-expanded/activedescendant; label association |
| TC-SDD-009 | Mobile | full-width panel; ≥44px targets |
| TC-SDD-010 | Reduced motion | no animation when `prefers-reduced-motion` |
| TC-SDD-011 | Fallback | native select still usable without JS |
| TC-SDD-012 | Tag balance | all touched pages balanced; `searchable-select.js` `node --check` clean |

## 6. App-port carry-over
In `apps/web`, property/unit pickers use a searchable Combobox component (e.g. headless combobox) bound to the same options; the rule (#18) holds. Non-property/unit selects stay plain.

## 7. Open decisions
| # | Decision | Resolution |
|---|---|---|
| OD-1 | `admin/rent.html` `ap-lease` (lease picker w/ unit·property) | **Included** (user: "build all + include ap-lease") |
| OD-2 | Make the component opt-in (`data-searchable`) vs auto-detect | **Opt-in** via `data-searchable` |

## 8. Shipped
`assets/searchable-select.js` + `.gs-combobox*` CSS in `styles.css`. `data-searchable` applied to **17** selects across 9 pages (the 16 audited + a **new Property dropdown added to the PM raise-request modal** `pm/maintenance.html#req-prop` per follow-up). Component loaded on all 9 pages; maintenance Property→Unit cascade calls `SearchableSelect.refresh('flt-unit')`. **Verify:** `node --check` clean; 17 `data-searchable`; 9 pages load the script; 2 cascade-refresh calls; 65/65 HTML tag-balanced.
