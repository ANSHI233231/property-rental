# Admin Leases page (org-wide)

| Field | Value |
|---|---|
| Status   | in-progress |
| Started  | 2026-05-27 |
| Shipped  | — |

## 1. Requirement (as given)
> "remove create lease button on the property detail page and add a new page like we have for pm for lease in admin role."

## 2. Plan
- **Remove** the "+ Create Lease" button on `admin/property-detail.html` (done). Lease creation moves to the new Leases page.
- **New page** `admin/leases.html` — modeled on `pm/leases.html` but **org-wide** (all properties), with **admin chrome** (sidebar/tabbar/more-sheet/account = Raj/Admin/RS).
  - Topbar **+ New Lease** → modal (Property → Unit → rent/dates/deposit/tenants). Org-wide, so a **Property** select precedes Unit.
  - Table columns: **Tenant(s) · Property · Unit · Start · End · Rent · Status · Actions**. Rows span properties; data consistent with the dashboard "Lease Expirations" set (LS-1021 / 1044 / 1057 / 1063).
  - Row **View** → `unit-detail.html?unit=…&property=…` (the lease lives on the unit detail page, per the earlier decision — no separate admin lease-detail clone). Renew / Early Terminate / Process Refund per status, all via `gsToast`.
  - Expiring-soon banner + Pending Co-Tenant Consent section (BL-08, no auto-timeout) + pagination.
  - Loads `validation.js · paginate.js · impersonation.js · toast.js`.
- **Nav rollout**: add a **Leases** sidebar link (after Properties) + a Leases more-sheet entry across **all 17 admin pages** (13 top-level + 4 master-data subpages), depth-aware.

## 2a. Update (2026-05-27) — Create Lease promoted to a full page
Create Lease was a modal on `admin/leases.html`; promoted to a dedicated full page **`admin/create-lease.html`** (room for many fields). The Leases-page "+ New Lease" now navigates there; the modal is removed. Unit-detail "+ Create Lease" button removed (create happens from the Leases flow). Full page sections: Unit (property → unit), Lease terms (dates, rent, deposit, due day, BL-11 rent-lock note), Primary tenant, Co-tenants (repeatable, BL-08 consent note). Validates required fields; toast + back to leases on save.

## 3. Decisions
- View → unit-detail (not a new lease-detail) — consistent with "leases are on the unit detail page".
- Sidebar position: Dashboard · Properties · **Leases** · Users · Maintenance · Rent · Audit Log · Master Data · Settings · Delegations.
- Create-lease lives on the Leases page (org-wide), not the property detail page.

## 4. App-port carry-over
Admin Leases list = org-scoped query across all properties; PM list is property-scoped. Same lease entity, same BL-08 consent + BL-11 rent-lock rules. New Lease writes a lease + auto-creates tenant accounts at signing.

## 5. Files
- `admin/property-detail.html` — Create Lease button removed.
- `admin/leases.html` — NEW.
- 16 other admin pages — + Leases sidebar/more-sheet link.
- `docs/planning/prototype-changes.md` — row on ship.
