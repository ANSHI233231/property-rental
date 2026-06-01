# Feature Plan — Prototype listing enhancements (filters, clickable tiles, pagination, columns)

- **Date:** 2026-06-01
- **Status:** Built (all listed items done) — pending commit/push

> **Build note (2026-06-01):** All items in the table below are implemented. Two reusable upgrades underpin them: `Paginator.setPredicate` (range filters) and `a.kpi` clickable-card styling. New page `admin/delegation-activity.html` added + linked from Delegations. "Specializations" renamed to "Maintenance Specializations" across 25 files. All changed inline JS passes `node --check`. PM additions stay assigned-scoped. **Interpretation notes:** Properties "Room Status" = Has rooms / No rooms; Properties clickable tiles route to create-lease (Available Units) and filtered Leases (Active/Upcoming) since there is no per-unit listing; per-feature room mock data is illustrative.
- **Scope:** prototype/ only (design contract). Cross-page consistency via shared `assets/paginate.js` + `searchable-select.js`.

## Context
A batch of UX enhancements requested across Super Admin, Admin and PM. Three **global standards** must hold everywhere, not just the named pages:
1. **Pagination** on every listing table (shared `Paginator`, `data-paginate-for` + `data-per-page` + pagination controls).
2. **Correct filters** on every listing (search + relevant tile/dropdown filters). Property/Unit selects must be searchable comboboxes (CLAUDE.md #18).
3. **Clickable tiles/metric cards** → link to the related listing **with the matching filter pre-applied** (via `?filter=<key>` / attr-param the target page reads on load and applies through `Paginator`). Cards that are pure counts route to the filtered list showing exactly those records.

## Shared mechanics (reuse — don't reinvent)
- `Paginator.setFilter(tableId, key, btn)` — tile filter; `Paginator.setAttrFilter(tableId, attr, value)` — dropdown attr filter; `data-pg-search`, `data-pg-count`, `getUrlParam/setUrlParam` in `assets/paginate.js`.
- On load, target pages must **read the URL param and apply the filter** so cross-page tile links land filtered. Add an init hook where missing.
- Date filters: a from/to pair using `assets/date-picker.js` (`data-pair-min/max`), filtering rows by a `data-date` attribute (add where missing).

## Items

### Super Admin
| Page | Change |
|---|---|
| Dashboard | Every metric/card clickable → related page/section (org counts → `organizations.html?filter=…`; pending approvals → orgs filtered pending; invoices → `invoices.html?…`; contact queries → `contact-inbox.html`). |
| Organizations (`organizations.html`) | Add **Contact** column (primary contact name + email). Add **Created date** filter (from/to). Add pagination (currently missing). |
| Contact Inbox | Add a **date filter** (single date or from/to range) on the received date; rows get `data-date`. |

### Admin
| Page | Change |
|---|---|
| Dashboard | Every metric/card clickable → related filtered page/section. |
| Properties | Add **Total Rooms** column. Add **Property Type** + **Room Status** filters. Make the summary tiles clickable → Properties with the matching filter (e.g. **Active Units**). |
| Leases | Add **Lease Type** filter (unit-wise / room-wise). |
| Delegation Activity | **NEW page** — delegation activity track (who did what under which delegation, when); link from Delegations. |
| Maintenance | Add **Room** filter; add a **Room** field in the Raise Request form (shown for room-based units). |
| Rent | Add **Room** to Record Payment + a **Room** column in the table. Add filters: **Tenant, Property, Unit, Room, Property Manager**. |
| Master Data | Rename **"Specializations" → "Maintenance Specializations"** (label/nav/title; keep file/route). |
| Settings | Add **Date** + **field** filter (audit/history of settings changes). |
| Organization | Add invoice filters: **Date, Status, Plan**. |
| Delegations | Add an **all-Status** filter (Active / Upcoming / Expired / Revoked). |

### Property Manager
| Page | Change |
|---|---|
| Dashboard | Every metric/card clickable → related filtered page/section (assigned-scoped). |
| Properties | Add **Room** to property view + **Room** filter + **Total Rooms** column (mirror admin Properties, assigned-scoped). |

## Global sweep (all roles)
- Audit every listing table for pagination; add where missing (e.g. `super-admin/organizations.html`).
- Ensure each listing has a search + the sensible filter set; property/unit selects are searchable.
- Make existing count tiles link to their filtered list.

## Verification
- `node --check` any page whose inline JS changes.
- Click-through: each dashboard card navigates to the right filtered list; each new filter narrows rows + updates tile counts + pagination; cross-page tile links land pre-filtered.
- Scope: PM additions stay assigned-scoped.
- Housekeeping: prototype-changes.md rows; SRS only if behaviour/page-set changes (e.g. new Delegation Activity page, Maintenance Specializations rename); change-log.
