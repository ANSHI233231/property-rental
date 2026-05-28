# Serial-number (#) column on listing tables — pagination-aware

| Field | Value |
|---|---|
| Status         | in progress (prototype) |
| Started        | 2026-05-27 |
| Shipped        | — |
| SRS row        | (n/a — presentation-only) |
| Test cases     | TC-SERIAL-001..006 |
| Prototype todo | row to be added to `docs/planning/prototype-changes.md` on ship |

## 1. Requirement (as given)

> "add # column on every table on the main listing pages to show the Serial number, and this should work on pagination — so if we are on page 2 the number should not start at 1, it starts from the last serial number that was on the first page, kept incrementally."

Every **main listing table** (the paginated tables driven by `assets/paginate.js`) gets a leading **`#`** column showing a **running serial number** that is continuous across pages and filters: page 2 (with per-page 10) starts at 11, etc.

## 2. Plan

### 2.1 Mechanism (single change in paginate.js)

The serial is computed from the **filtered** index, so it stays correct under search + tile filters and across pages. In `paginate()` step 5 (render the current page slice), for each visible row stamp its 1-based filtered index into a `[data-pg-serial]` cell:

```js
for (var i = from - 1; i < to; i++) {
  filtered[i].style.display = '';
  var serialCell = filtered[i].querySelector('[data-pg-serial]');
  if (serialCell) serialCell.textContent = fmtNum(i + 1);   // en-IN grouping
}
```

No new config: a table opts in simply by (a) adding `<th class="w-12">#</th>` as the first header and (b) giving each row a first cell `<td data-pg-serial class="muted"></td>`. Tables without serial cells are unaffected.

### 2.2 Rollout surface

All tables that already carry a `.pagination[data-paginate-for]` block — i.e. the **main listing tables** across every role (Admin, PM, Maintenance, Super Admin) and the master-data pages. Detail-page mini-tables (units-in-property, lease lists on a detail page, co-tenant lists) are **not** listing pages and are left alone unless they already paginate.

For each such table:
- `thead`: prepend `<th class="w-12">#</th>`.
- each `tbody` row: prepend `<td data-pg-serial class="muted"></td>`.
- account for any `colspan` on empty-state rows (bump by 1).

### 2.3 App-port carry-over

The serial is a pure presentation index = `(page-1)*per_page + rowIndex + 1`, computed client-side from the server's `page`/`per_page`. No API/DB change. In `apps/web`, the list/table component renders the ordinal column from the pagination offset.

## 3. Test cases

| TC-ID | Title | Expected |
|---|---|---|
| TC-SERIAL-001 | Page 1 numbering | rows show 1..10 (per-page 10) |
| TC-SERIAL-002 | Page 2 continuity | first row on page 2 shows 11, not 1 |
| TC-SERIAL-003 | Per-page change | switch to 25/page → 1..25 then 26.. |
| TC-SERIAL-004 | Filter tile applied | numbering restarts at 1 over the filtered set, continuous across its pages |
| TC-SERIAL-005 | Search applied | numbering tracks the searched set |
| TC-SERIAL-006 | Tag balance | every touched page tag-balanced; header/body column counts match |

## 4. Files
- `prototype/assets/paginate.js` — serial stamping in `paginate()` (done).
- Every listing-table page — `#` header + `data-pg-serial` first cell (admin/users.html done; remainder rolled out by `gharsetu-frontend`).

## 5. Execution log
| Date | Agent | Entry |
|------|-------|-------|
| 2026-05-27 | (orchestrator) | paginate.js change + admin/users.html reference impl done; remaining listing pages delegated to `gharsetu-frontend`. |
