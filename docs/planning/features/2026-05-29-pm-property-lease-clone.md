# Feature Plan — Clone Admin Property & Lease pages for Property Manager (assigned-scoped)

- **Date:** 2026-05-29
- **Owner:** document/prototype work (admin-parity for PM role)
- **Status:** ✅ Built (2026-05-29) — see `agent-team-change-logs/gharsetu-frontend-2026-05-29.md`
- **Related:** `prototype/admin/{create-lease,unit-detail,lease-detail,leases,properties,property-detail}.html`, SRS §3 (PM page set) + role matrix, BL-19 (PM multi-property), BL-08/BL-09 (termination consent)

## Context
The Admin property & lease pages now carry a full feature set we just built: the Create-Lease wizard with **renew mode**, unit-detail with a **Leases "Type" column + Rooms-first ordering + status-gated create-lease buttons**, and lease-detail with the **per-tenant-consent Early Termination** flow (+ terminated preview view). The Property Manager role has older, smaller, divergent versions, **no `create-lease.html`**, and only stub lease creation (a "New Lease" modal on `pm/leases.html`) and stub renewal (`alert()`).

PM is permitted by the SRS role matrix to **create tenants & leases, renew, terminate (with consent), and manage day-to-day ops** — but only on its **assigned properties**, never cross-property or cross-org (BL-19 amended: a PM may manage multiple properties). Goal: bring every PM property/lease page to Admin feature parity, wire a real PM create-lease wizard, and ensure **everything is scoped to the PM's assigned properties only**.

**Assigned scope (mock):** current = **Green Valley Apartments (id 1) · Sai Heights (id 2) · Mayur Vihar Residency (id 3)**. Past tenure (read-only history only) = Rohini Greens, Dwarka West. The create-lease wizard must offer only the 3 current properties.

## Approach
Clone the Admin pages' content/behaviour into the PM pages, swapping the **role chrome** (sidebar / bottom tabbar / more-sheet / account menu) for PM's existing chrome (copy verbatim from an existing PM page, e.g. `pm/leases.html`), keeping all links inside `pm/` (relative `../assets/...` paths are identical — both dirs are one level deep). Drop **admin-only** affordances (Reassign Property Manager; anything cross-property). Scope every mock array to the 3 assigned properties.

## Files & changes

### 1. `pm/create-lease.html` — NEW (clone of `admin/create-lease.html`)
- Copy the whole wizard (Steps 1–5, renew mode, conflict check, tenant rows, summary rail).
- Swap chrome to PM's; **Cancel** → `leases.html`; `<title>` → PM.
- **Scope `PROPERTIES` to ids 1,2,3** (remove Rohini Greens + others); keep only `UNITS`/`ROOMS`/`UNIT_LEASE`/`TENANTS` rows for those properties so unassigned inventory never appears.
- Keep deep-link `?unitId=<n>&roomId=<m>` → Step 4, and **renew mode** `?renew=<leaseId>` (title "Renew Lease", locked to Steps 4–5, tenants + rent + deposit prefilled). Seed `RENEWALS` for the PM lease(s) on `pm/lease-detail.html`.

### 2. `pm/unit-detail.html` — Admin parity
- Port the **Rooms-in-this-unit** section + **Leases table with a "Type" column**, **Leases after Rooms**.
- Add **"+ Create Lease for this Unit"** + per-room **"+ Create Lease"** → `create-lease.html?unitId=<n>[&roomId=<m>]`.
- Gate those buttons in `setUnitSimStatus`: **hidden when Retired or Under Maintenance**.

### 3. `pm/lease-detail.html` — Admin parity
- Replace renewal drawer with **Renew Lease** → `create-lease.html?renew=<leaseId>`.
- Replace old terminate flow with the **Early Termination section** (per-tenant consent table → live progress → Early Terminate disabled until all requested → reason modal min 5 chars). Wire `applyTermViewForStatus()` into the status simulator; `data-status-show="upcoming,active,terminated"` (Terminated = read-only record).
- Remove any **"View profile"** tenant links.

### 4. `pm/leases.html` — re-sync + real wizard
- Align list with `admin/leases.html`, **scoped to assigned-property leases**.
- "+ New Lease" → `create-lease.html`; row **Renew** → `create-lease.html?renew=<leaseId>` (replace modal + `alert()` stubs).

### 5. `pm/properties.html` — re-sync, keep assigned + past-tenure structure (no admin-only actions).

### 6. `pm/property-detail.html` — re-sync, scoped, **exclude "Reassign Property Manager"** and cross-property controls; unit rows → `pm/unit-detail.html`.

### 7. Lease status label standardization (all roles, not just PM)
Lease status **titles differ across pages**; the canonical source is `admin/lease-detail.html` (`setLeaseSimStatus` badgeMap + Status badge):

| State | Canonical label | Badge class |
|---|---|---|
| active | **Active** | `badge-active` |
| upcoming | **Upcoming** | `badge-prepaid` |
| expired/ended | **Ended** | `badge-closed` |
| terminated | **Terminated** | `badge-terminated` |

- **Only four lease statuses exist: Active · Upcoming · Ended · Terminated.** There is **no "Renewed"** status, and **"Closed" / "Expired" both mean "Ended"**.
- Normalize every lease-status badge across **`admin/`, `pm/`, and `tenant/`** (leases lists, lease-detail, unit-detail leases tables, dashboards, tenant pages): **"Closed" → "Ended"**, **"Expired" → "Ended"**, **"Renewed" → "Ended"** (drop the renewed concept). Also rename the `admin/lease-detail.html` status-simulator button label **"Expired" → "Ended"** so the control matches the badge (internal state key `expired` may stay).
- Do **not** touch non-lease badges that share colour classes (unit status, lease *type* "Unit/Room-wise", payment/invoice status, maintenance, etc.).

## Reuse (don't reinvent)
- Wizard / renew / `prepareStep5` / tenant-row / conflict: `admin/create-lease.html`.
- `setUnitSimStatus` create-lease gating: `admin/unit-detail.html`.
- `raiseTermRequest` / `updateTermState` / `applyTermViewForStatus` / reason modal: `admin/lease-detail.html`.
- PM chrome: copy from an existing PM page. Shared assets unchanged.

## Sync & housekeeping (Rule #9)
- Append `docs/planning/prototype-changes.md` rows per page; verify SRS §3 + role matrix wording; append a change-log entry under `agent-team-change-logs/`.

## Verification
- `node --check` extracted inline JS of the three JS-heavy PM pages.
- **Scope check:** grep each PM page — only Green Valley / Sai Heights / Mayur Vihar in active data (no other org properties; Rohini/Dwarka only as read-only history).
- Click-through: create-lease lists only the 3 assigned properties; unit-detail create-lease hides on Retired/Under-Maintenance; lease-detail Renew opens renew mode (locked + prefilled); Early Termination enables only after all tenants request, then reason modal terminates; Terminated preview shows the read-only record.
