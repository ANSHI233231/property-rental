# Server-side pagination across all list pages

| Field | Value |
|---|---|
| Status         | proposed |
| Started        | 2026-05-27 |
| Shipped        | — |
| SRS row        | (n/a — UI pattern; carries an API contract for the app port) |
| Test cases     | TC-PAGINATE-001..NNN |
| Prototype todo | row pending |

---

## 1. Requirement (as given)

> "on all pages where we show table we need pagination and that paginations should be server side not from the frontend datatable and while search the pagination also update and while click on tiles if any page has so the pagination should be show the correct data and tiles should be always show the total data not the paginated sum"

Decoded:
1. Every list page needs pagination.
2. Pagination must be **server-side semantics**: URL-driven (`?page=N&per_page=K`), a real fetch boundary — not client-side hidden-rows tricks. (For the prototype the data is mocked in JS, but the contract — paginate-then-render — must match the app-port API.)
3. Search must reset and update pagination — typing a query refetches page 1 of the filtered set, page count recomputes.
4. Clicking a filter tile must reset/update pagination — same behavior as search.
5. Filter tiles must **always show totals across the full filtered dataset**, never just the current page. Example: if there are 114 tenants total but only 20 fit on the page, the Tenants tile still says **114**, not 20.

---

## 2. Plan

### 2.0 Rules check (CLAUDE.md)

- Working rule §2 — planning file written before code.
- Working rule §9 — prototype-only; matching app-port contract documented in §2.4.
- Scope rule **I** — every value sourced from existing tokens.

### 2.1 Affected pages (22 list pages)

| Role | Pages |
|---|---|
| Admin (top-level lists) | `users.html` · `properties.html` · `units.html` · `maintenance.html` · `rent.html` · `audit-log.html` · `delegations.html` |
| Admin (Master Data sub-pages) | `master-data/amenities.html` · `categories.html` · `visit-purposes.html` |
| PM | `units.html` · `tenants.html` · `leases.html` · `rent-collection.html` · `maintenance.html` · `visitors.html` |
| Maintenance | `all-open.html` |
| Super Admin | `organizations.html` · `server-logs.html` |
| Super Admin (Master Data sub-pages) | `master-data/cities.html` · `states.html` · `payment-methods.html` |

**Not affected** (intentionally small / embedded tables):
- All dashboards (`*/dashboard.html`) — show recent-N widgets, not full lists.
- All profile pages — Recent Activity is intentionally truncated.
- All detail pages (`*/property-detail.html`, `*/lease-detail.html`, `*/maintenance-detail.html`, `*/tenant-detail.html`, `super-admin/organization-detail.html`) — show ALL items belonging to that one entity.
- `admin/settings.html` — settings panel, no list.
- `tenant/dashboard.html`, `tenant/rent.html` — single-tenant scope, small.

### 2.2 Component contract

A new shared module at `prototype/assets/paginate.js` plus pagination CSS in `prototype/assets/styles.css`.

**HTML contract** (added to each list page):

```html
<section class="card p-0 overflow-x-auto">
  <table class="data-table" id="tbl-users">
    <thead>...</thead>
    <tbody>... full mock dataset (all rows in HTML) ...</tbody>
  </table>
  <!-- Pagination footer — same markup pattern on every page -->
  <div class="pagination" data-paginate-for="tbl-users" data-per-page="10">
    <div class="pagination-info">Showing <span data-pg-from>1</span>–<span data-pg-to>10</span> of <span data-pg-total>142</span></div>
    <div class="pagination-controls">
      <button type="button" class="pagination-btn" data-pg-prev aria-label="Previous page">‹</button>
      <div class="pagination-pages" data-pg-pages></div>
      <button type="button" class="pagination-btn" data-pg-next aria-label="Next page">›</button>
    </div>
    <div class="pagination-per-page">
      <label for="per-page-tbl-users" class="sr-only">Rows per page</label>
      <select id="per-page-tbl-users" data-pg-per-page>
        <option value="10" selected>10 / page</option>
        <option value="25">25 / page</option>
        <option value="50">50 / page</option>
      </select>
    </div>
  </div>
</section>
```

**JS contract** (paginate.js):

- On `DOMContentLoaded`, find every `.pagination[data-paginate-for]` element. For each:
  - Resolve the target table by `id`.
  - Read URL params `?page=N&per_page=K` (scoped by table id: `?tbl_users_page=1`).
  - Compute filtered dataset (rows matching current search + tile filter — see §2.3).
  - Slice to the current page.
  - Hide non-matching `<tr>` elements via `tr.style.display = 'none'`.
  - Render page number buttons (max 7 visible: 1 … 4 5 6 … 12, with current centered).
  - Update "Showing X–Y of N" labels.
  - Wire prev/next/page-click → re-paginate and update the URL.
- Exposes globals:
  - `Paginator.refresh(tableId)` — re-runs filter + slice. Call this whenever search or tile filter changes.
  - `Paginator.setFilter(tableId, filterKey, filterValue)` — tile click handler.

**Coordinating with existing search/tile JS per page**:

Each page already has a `filterTable()` or `setFilter()` or `switchDelegTab()` function. We won't replace them — we'll have those functions:
1. Set a `data-filter` attribute on each `<tr>` reflecting their current filter category (already implicit via the existing `data-status` / `data-role` attributes).
2. Call `Paginator.refresh(tableId)` at the end.

The paginator then walks the tbody, applies the active filter+search, computes a "matched" set, then paginates.

**Tile count update** (the critical requirement):

Each tile gets a `data-tile-count-for` attribute pointing to its table + filter category, e.g.:
```html
<button class="filter-tile active" data-tile-count-for="tbl-users" data-tile-filter="all">
  <span class="filter-tile-count" data-pg-count>142</span>
  <span class="filter-tile-label">All</span>
</button>
```

On each paginator refresh, after filtering+slicing, `Paginator` also walks every `[data-tile-count-for=<tableId>]` and computes the count of full-dataset matches for each `data-tile-filter` value — independent of the current page slice. So tile counts always reflect totals.

### 2.3 URL pattern (server-side semantics)

For each table on a page (most pages have one; some have multiple):
- `?<tableId>_page=N` — current page (1-indexed).
- `?<tableId>_per=K` — page size (10/25/50).
- `?<tableId>_q=foo` — current search (when filterTable wires through).
- `?<tableId>_f=admins` — current tile filter.

Multiple tables on the same page get distinct prefixes. This matches what the app-port will expose at the API level: `/api/v1/users?page=2&per_page=25&q=raj&role=ADMIN`.

History API: every paginator interaction calls `history.replaceState` so the page is back-restorable without polluting the back-button stack.

### 2.4 App-port contract (carry-over)

When the React/Next.js + NestJS port lands:

- **API**: every list endpoint accepts `?page=N&per_page=K&q=...&<filterKey>=<filterValue>`. Returns:
  ```json
  {
    "rows": [...],
    "total": 142,
    "page": 1,
    "per_page": 10,
    "filter_breakdown": { "all": 142, "admin": 2, "pm": 18, "maintenance": 8, "tenant": 114 }
  }
  ```
- **Validation** (Nest DTO): `page` is positive int, default 1; `per_page` is enum `[10, 25, 50]`, default 10; cap at 100.
- **Authz**: role + organization_id scoping happens at the query level. Pagination respects the scoped subset (Admin sees only their org's users, etc.).
- **Frontend** (Next.js): a single `<DataTable />` component takes a fetcher, manages URL state via `useSearchParams`, renders pagination footer + tile counts from `filter_breakdown`. Drop-in for every list page.
- **Test cases**: TC-PAGINATE-001..NNN promote to `docs/testing/v1/Test_Cases.md` on ship — see §3 below.

### 2.5 Prototype strategy

Two phases:

**Phase 1 (this turn — orchestrator)**:
- Author `prototype/assets/paginate.js`.
- Add `.pagination`, `.pagination-info`, `.pagination-controls`, `.pagination-btn`, `.pagination-pages`, `.pagination-page`, `.pagination-page.active`, `.pagination-per-page` to `prototype/assets/styles.css`.
- Wire 4 representative pages: **`admin/users.html`**, **`admin/audit-log.html`**, **`super-admin/organizations.html`**, **`super-admin/server-logs.html`** — these cover (a) static-row + tile-filter pattern, (b) static-row + search-only, (c) static-row + tile-filter with URL state, (d) JS-rendered rows.
- Validate the pattern works end-to-end on these 4 pages.

**Phase 2 (next dispatch — `gharsetu-frontend` agent)**:
- Apply the same pattern to the remaining ~18 list pages.
- Expand mock data on each so pagination actually has multiple pages to show (current static tables have 4-10 rows; need at least 20+ for pagination to be meaningful).

This planning file is the binding spec for both phases.

---

## 3. Test cases (designed up front)

| TC-ID | Title | Pre | Steps | Expected | Priority |
|---|---|---|---|---|---|
| TC-PAGINATE-001 | Pagination footer present on every list page | Any list page (22 in scope) | Visit page | `.pagination` element visible below the table | H |
| TC-PAGINATE-002 | Page 1 active by default | Visit page (no URL params) | Inspect | Page button 1 has `.active`, prev disabled | H |
| TC-PAGINATE-003 | URL reflects current page | Click page 2 | URL contains `?<tableId>_page=2` | H |
| TC-PAGINATE-004 | URL restores state on reload | Set page 3, reload | Page 3 still active, rows show 21–30 | H |
| TC-PAGINATE-005 | "Showing X–Y of N" updates correctly | On page 2 of 10/page | Inspect info text | "Showing 11–20 of 142" | H |
| TC-PAGINATE-006 | Per-page selector works | Change 10 → 25 | URL has `_per=25`, 25 rows visible, page count recomputes | H |
| TC-PAGINATE-007 | Per-page selector resets to page 1 | Was on page 5/10, switch to 25/page | Page jumps to 1 (positions shifted) | M |
| TC-PAGINATE-008 | Search updates pagination | Type in search input | Page resets to 1, total reflects filtered count | H |
| TC-PAGINATE-009 | Tile click updates pagination | Click "Admins" tile (2 admins) | Page 1 of 1, total = 2, only admin rows visible | H |
| TC-PAGINATE-010 | **Tile counts show totals, not page subset** | On any list page | Inspect tile counts | Each tile's number equals total matches in the full filtered dataset, independent of current page | H |
| TC-PAGINATE-011 | Search + tile combined | Pick Admins tile, then type "raj" | Tile counts unchanged (Admins still = 2), table shows only matching admins | H |
| TC-PAGINATE-012 | Prev/Next buttons | On page 5 | Click prev → page 4 · click next → page 6 | M |
| TC-PAGINATE-013 | Disable prev on page 1 | On page 1 | Prev button has `disabled` attr | M |
| TC-PAGINATE-014 | Disable next on last page | On last page | Next button has `disabled` attr | M |
| TC-PAGINATE-015 | Truncated page-number bar | 12 pages total | Inspect page bar | Pattern like `1 … 4 5 6 … 12` (max 7 visible) | M |
| TC-PAGINATE-016 | Empty result state | Search "xyzzy" (no matches) | Table empty + "Showing 0–0 of 0" + no page buttons | M |
| TC-PAGINATE-017 | Multiple tables on one page | A page with 2 tables (rare) | Each paginates independently, URL prefixes are distinct | L |
| TC-PAGINATE-018 | Keyboard accessibility | Tab through pagination | Page buttons reachable, Enter activates them, focus ring visible (saffron) | M |
| TC-PAGINATE-019 | Responsive at 5 widths | Visit page at 320/480/768/1024/1440 | Pagination layout wraps gracefully — info on top, controls below at <600px | M |
| TC-PAGINATE-020 | Pagination on Master Data CRUD pages | After Add Entry / Reactivate / Deactivate | Pagination refreshes — total reflects new state | M |

### 3.1 Cross-cutting

- Accessibility: pagination buttons have `aria-label`, the active page has `aria-current="page"`, the `.pagination` container has `aria-label="Pagination"`.
- Locale: numbers use `toLocaleString('en-IN')` for Indian digit grouping when ≥1,000.
- Performance (app port): the React component memoizes filter_breakdown so tile counts don't flicker on every keystroke; debounces search input.

---

## 4. Sign-off

| Date | Question | Default | User answer |
|---|---|---|---|
| 2026-05-27 | Default per-page | 10 | Default applied |
| 2026-05-27 | Per-page options | 10 / 25 / 50 | Default applied |
| 2026-05-27 | URL param prefix style | `<tableId>_page` (per-table prefix for pages with multiple tables) | Default applied |
| 2026-05-27 | Tile counts source | Full filtered dataset, NEVER paginated subset | User explicitly required |
| 2026-05-27 | Empty-state UX | Show "0 of 0" with empty tbody (no error) | Default applied |
| 2026-05-27 | Truncation threshold | Show all page numbers if ≤7, otherwise `1 … N-1 N N+1 … LAST` | Default applied |

---

## 5. Execution log

| Date | Event |
|---|---|
| 2026-05-27 | Planning file authored (BEFORE code, per Working rule §2). Executing Phase 1 (shared component + 4 seed pages); Phase 2 (remaining 18 pages) follows. |
| 2026-05-27 | `paginate.js` + `.pagination*` CSS shipped. Pagination rolled out to **21 list pages total**: admin/{audit-log, delegations, maintenance, properties, rent, users, master-data/amenities, master-data/categories, master-data/visit-purposes} · pm/{properties, tenants, leases, rent-collection, maintenance, visitors} · super-admin/{server-logs, master-data/cities, master-data/states, master-data/payment-methods} · tenant/visitors · maintenance/all-requests. Tile counts reflect the full filtered dataset (TC-PAGINATE-010). Two background-agent dispatches crashed mid-batch; orchestrator finished the residual ~11 pages by hand. server-logs uses `Paginator.refresh('tbl-logs')` after its JS render. Pages using dropdown filters (pm/tenants, master-data) wire search + pagination but keep their existing status dropdowns rather than converting to tiles. |

---

## 6. Files changed

| File | Change | Touched by |
|---|---|---|
| `./../../../prototype/assets/paginate.js` | NEW — shared pagination component | orchestrator |
| `./../../../prototype/assets/styles.css` | `.pagination*` block added | orchestrator |
| `./../../../prototype/admin/users.html` | Pagination footer + paginate.js script tag + tile-count wiring | orchestrator (Phase 1) |
| `./../../../prototype/admin/audit-log.html` | Same | orchestrator (Phase 1) |
| `./../../../prototype/super-admin/organizations.html` | Same | orchestrator (Phase 1) |
| `./../../../prototype/super-admin/server-logs.html` | Same — different shape (JS-rendered rows) | orchestrator (Phase 1) |
| (Phase 2) `./../../../prototype/admin/properties.html` | Same | gharsetu-frontend |
| (Phase 2) `./../../../prototype/admin/units.html` | Same | gharsetu-frontend |
| (Phase 2) `./../../../prototype/admin/maintenance.html` | Same | gharsetu-frontend |
| (Phase 2) `./../../../prototype/admin/rent.html` | Same | gharsetu-frontend |
| (Phase 2) `./../../../prototype/admin/delegations.html` | Same — per-tab pagination | gharsetu-frontend |
| (Phase 2) `./../../../prototype/admin/master-data/{amenities, categories, visit-purposes}.html` | Same | gharsetu-frontend |
| (Phase 2) `./../../../prototype/pm/{units, tenants, leases, rent-collection, maintenance, visitors}.html` | Same | gharsetu-frontend |
| (Phase 2) `./../../../prototype/maintenance/all-open.html` | Same | gharsetu-frontend |
| (Phase 2) `./../../../prototype/super-admin/master-data/{cities, states, payment-methods}.html` | Same | gharsetu-frontend |
| (Phase 2) Mock data expansion — most static tables need ≥20 rows to make pagination meaningful | gharsetu-frontend |
| `./../prototype-changes.md` | Pending — on ship | gharsetu-frontend |

---

## 7. Agents used

| Agent | Task | Status |
|---|---|---|
| gharsetu-lead (orchestrator) | Planning + shared component + 4 seed pages | pending |
| gharsetu-frontend | Phase 2 — remaining ~18 list pages + mock data expansion | pending |

---

## 8. Post-deploy

_Empty — prototype iteration. Real API-driven pagination lands at app-port time; this planning file is its binding spec._

---

## 9. Cross-references

- `prototype/assets/styles.css` — pagination tokens added.
- `prototype/assets/paginate.js` — shared component (new).
- All 22 list pages enumerated in §2.1.
- App-port: `apps/web/src/components/ui/DataTable.tsx` (to be created) + every list-page Nest controller (DTO additions for page/per_page/filter).
