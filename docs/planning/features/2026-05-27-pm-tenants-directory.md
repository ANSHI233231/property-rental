# PM Tenants page → lean "Users-style" people directory (re-plan)

| Field | Value |
|---|---|
| Status         | **shipped (prototype)** |
| Started        | 2026-05-27 |
| Shipped        | 2026-05-27 |
| SRS row        | §3 PM page map updated; Module 1 (Users & Access) |
| Prototype todo | row added to `docs/planning/prototype-changes.md` |
| Supersedes     | the lease-clone version of `pm/tenants.html` |

> **Shipped note.** Built as planned. Additionally, per the user (*"no need for tenant detail page, it's not worth it"*), `pm/tenant-detail.html` was **deleted** and the directory carries **no View / actions column** — it is a flat people list. **OD-1 resolved:** Status = account **Active/Inactive** (`badge-active` / `badge-closed`). 18 seed rows (16 active occupants incl. expanded co-tenants, 2 inactive former tenants with no unit). Columns: `# · Tenant · Unit · Phone · Status`. Search + Status dropdown (`setAttrFilter`) + serial `#` + pagination; no "+ Add Tenant"; no captions.

## 1. Decision (as given)

> "just a users-like tenants page — no other details required to show, that's already enough."

The current `pm/tenants.html` list duplicates the **Leases** list (Tenant · Unit · Lease dates · Rent · Phone · Status). Decision: **repurpose it into a minimal people directory modelled on the Admin Users page**, and let `pm/tenant-detail.html` carry the depth (it already shows Contact · Lease Summary · Payment History · Maintenance History). Leases = contracts; Tenants = people.

## 2. Plan

### 2.1 Table — strip to a Users-style directory
Mirror the Admin Users table shape. New columns:

| # | Tenant | Unit | Phone | Status | _(action)_ |
|---|--------|------|-------|--------|------------|

- **One row per person.** Co-tenants are listed as their **own rows** (not `+ Priya (co-tenant)` sub-text) — every co-tenant is a full tenant who may be primary on another lease.
- **Unit** = the tenant's current unit (e.g. `3A · Green Valley`); blank if none active.
- **Status** = account status **Active / Inactive** (same badge vocabulary as Users — `badge-active` / `badge-closed`), **not** rent status. Rent status lives on Rent Collection / Leases.
- **Action** = a single **View** link → `tenant-detail.html`.

**Dropped from the list** (now only on Leases / Rent Collection / tenant-detail): Lease start/end dates, Rent amount, Deposit, rent-status badge.

### 2.2 Controls — match the Users pattern
- **Search** input (name · phone · unit) — `data-pg-search`.
- **Status dropdown** next to Search (All statuses / Active / Inactive) via `Paginator.setAttrFilter('tbl-pm-tenants','data-status', value)` — same mechanism just shipped on Users. Rows carry `data-status`.
- **Pagination** + the **`#` serial column** (already present) stay.
- **No filter tiles** (all rows are one role — tiles add nothing).
- **Remove the "+ Add Tenant" button** — PMs don't create tenants (auto-created at lease signing). The page is **read-only + View**; no Edit / Reset / Deactivate (those are Admin-scoped on the Users page; PM is operations-scoped).
- **No helper-caption text** anywhere on the page.

### 2.3 Untouched
- `pm/tenant-detail.html` (the person profile) — already sufficient; no change.
- `pm/leases.html`, `pm/rent-collection.html` — keep the contract/rent detail.
- Admin role — admin tenants already live in `admin/users.html`; no admin tenants page. PM-only change.

### 2.4 App-port carry-over
- PM Tenants = a **people directory** scoped to the PM's properties: one row per tenant user with current-unit + phone + account status; link to the person profile. Distinct from the lease list. No create/edit from PM (read + View only). Phone visibility per role policy.

## 3. Test cases
| TC-ID | Title | Expected |
|---|---|---|
| TC-PMTEN-001 | Columns | `# · Tenant · Unit · Phone · Status` + View only |
| TC-PMTEN-002 | One row per person | co-tenants appear as separate rows, no sub-text |
| TC-PMTEN-003 | No Add button | "+ Add Tenant" absent |
| TC-PMTEN-004 | Search | filters by name / phone / unit |
| TC-PMTEN-005 | Status dropdown | Active / Inactive filter via setAttrFilter; counts/pagination correct |
| TC-PMTEN-006 | Serial column | running #, pagination-aware |
| TC-PMTEN-007 | View | row → `tenant-detail.html` |
| TC-PMTEN-008 | No captions / tag-balance | no helper text; page tag-balanced |

## 4. Files to touch
| File | Change |
|------|--------|
| `prototype/pm/tenants.html` | rebuild the table (5 cols + View), one-row-per-person rows w/ `data-status`, Search + Status dropdown, remove "+ Add Tenant" + lease/rent/deposit columns |

## 5. Open decision
| # | Decision | Default |
|---|---|---|
| OD-1 | Status column meaning | **Account Active/Inactive** (mirrors Users). Swap to rent-status only if you'd rather — but that reintroduces "other details". |
