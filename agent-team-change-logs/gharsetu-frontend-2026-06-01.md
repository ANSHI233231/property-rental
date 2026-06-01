# Agent Change Log

Agent: gharsetu-frontend (orchestrator-direct)
Project: GharSetu
Date: 2026-06-01

> Prototype-only session. Full per-change detail lives in `docs/planning/prototype-changes.md`; this is the summary. No app code touched. Solution Overview + Timeline doc work this session is in `document-agent-2026-05-29.md` and was committed separately (`39125f1`, `3a2c53e`).

---

## Task 1 — Admin prototype feature pass
- **Status:** ✅ Completed
- Admin **dashboard**: removed the standalone Emergency (Unit 7C water-leak) alert banner.
- **Maintenance priority labels** standardized system-wide to the 4 canonical levels **Low · Medium · High · Emergency** — the stray "Normal" badge (admin/pm/maintenance dashboards) renamed to "Medium". Matches SRS.
- **Organization detail** (admin + super-admin): **Type of business** now multi-value comma-separated (signup is already multi-select); **Primary Contact** (name · email · mobile) added to the Organization Details card. SRS §4 org-record line updated.
- Admin **unit-detail**: unit-level + per-room **Create Lease** buttons gated hidden when status = Retired or Under Maintenance; Leases table gained a **Type** column and was moved to **after** the Rooms section.
- Admin **lease-detail**: **Renew** opens the Create Lease wizard in renew mode (`create-lease.html?renew=2103`); removed the top "Early Terminate" button and added an end-of-page **Early Termination** section — per-co-tenant consent table → "Early Terminate" enables only when all tenants request → reason modal (min 5 chars). `applyTermViewForStatus()` shows a read-only record when previewing Terminated (`data-status-show="upcoming,active,terminated"`). Removed tenant "View profile" links.

## Task 2 — Auth = email only
- **Status:** ✅ Completed
- `login.html` + `forgot-password.html`: removed all "Email or Phone" wording; `validateIdentifier()` accepts email only (dropped the 10-digit-mobile branch). Phone stays as profile/contact data only. SRS §3 Login row updated.
- Login **"Prototype Shortcuts — Preview as Role"** strip centered under the auth card (`max-width:480px; margin:32px auto 0`).

## Task 3 — Super Admin Contact Inbox bug fix
- **Status:** ✅ Completed
- "Mark as read / replied" wrote the status badge to `td:nth-child(5)` (Subject) instead of `td:nth-child(6)` (Status), clobbering the subject. Fixed the column index.

## Task 4 — PM property + lease clone (assigned-scoped) — finish + status labels
- **Status:** ✅ Completed (with prior-session work logged in `gharsetu-frontend-2026-05-29.md`)
- **NEW `pm/create-lease.html`** — cloned from `admin/create-lease.html` (full wizard + renew mode), PM chrome swapped in, `PROPERTIES`/`UNITS`/`TENANTS` scoped to the 3 assigned properties (Green Valley id1, Sai Heights id2, Mayur Vihar id3); Rohini Greens removed. Cancel → `leases.html`; title → Property Manager.
- **`pm/leases.html`** — re-cloned to the admin filter-tile listing layout (filter tiles, searchable Property filter, Lease Type column), chrome-swapped (Leases active), Rohini removed from filter, "+ New Lease" → `create-lease.html`, rows → `lease-detail.html?id=…`.
- **`pm/unit-detail.html` + `pm/lease-detail.html`** — at admin parity (Rooms + Leases Type + gated create-lease; renew + Early-Termination consent + no view-profile). PM chrome; assigned-scoped.
- **Lease status labels** standardized to **Active / Upcoming / Ended / Terminated** across admin + PM (no Closed/Expired/Renewed); lease-detail simulator button "Expired" → "Ended".
- Feature plan: `docs/planning/features/2026-05-29-pm-property-lease-clone.md`.

### Verification
- `node --check` on extracted inline JS of `pm/create-lease.html`, `pm/unit-detail.html`, `pm/lease-detail.html`, `admin/create-lease.html`, `admin/lease-detail.html` — all pass.
- Scope grep: PM active data shows only Green Valley / Sai Heights / Mayur Vihar; no other-org property names.
- PM lease status badges: only Active/Upcoming/Ended/Terminated.

### Sync
- `docs/planning/prototype-changes.md` — multiple rows appended.
- SRS updated: login email-only (§3), business-type multi-value (§4), priority levels (already low/medium/high/emergency).

### Notes
- App port to `apps/web` / `apps/api` for all v8 features remains pending (prototype is the design contract).

---

## Task 5 — Prototype listing enhancements (filters · clickable cards · pagination)
- **Status:** ✅ Completed · Plan: `docs/planning/features/2026-06-01-prototype-listing-enhancements.md`
- **Shared infra:** `assets/paginate.js` gained **`Paginator.setPredicate(tableId, fn)`** (custom/range row predicate, AND-combined with search/tile/attr; powers all date-range filters) and later **`data-search`** support in `trMatchesSearch` (scan a hidden attr so the visitor code stays hidden but searchable). `assets/styles.css` gained **`a.kpi`** clickable-card styling (hover/focus, reduced-motion).
- **Super Admin:** dashboard cards clickable → filtered pages; Organizations **Contact column + Created-date range filter** + contact search **and migrated to the shared Paginator** (fixing a bespoke right-aligned footer → one constant pagination design); Contact Inbox **received-date range filter**.
- **Admin:** dashboard cards clickable; **Properties** Total-Rooms column + Property-Type/Room-Status filters + Manager filter wired + clickable tiles; **Leases** Lease-Type filter + wired the dead Property filter; **Delegations** All-status tab + **new `delegation-activity.html`**; **Maintenance** room cascade filter + room field in raise form; **Rent** Room column + 5 filters (Tenant/Property/Unit/Room/PM) + room in Record Payment; **Settings** Field+Date filter; **Organization** invoice Status/Plan/Date filters; **Master Data** "Specializations" → "Maintenance Specializations" (25 files).
- **PM:** dashboard cards clickable; Properties Rooms column + Room-status filter; Leases Property + Lease-Type filters wired.

## Task 6 — NEW ROLE: Security Guard + gate-initiated visitor approvals
- **Status:** ✅ Completed (prototype) · Plan: `docs/planning/features/2026-06-01-security-guard-role.md`
- **`SECURITY_GUARD=5`** — org-scoped, assigned properties, Visitor-Management-only, email login.
- **New `prototype/security/`**: `dashboard.html` (gate KPIs, clickable), `visitors.html` (gate console — "Log Gate Arrival" routes an approval request to the tenant by lease type; common-area = guard approves directly, no code; approve/deny/check-in/out), `profile.html`; guard-only nav.
- **`tenant/visitors.html`**: "Pending approvals" section (any one co-tenant approves/denies; section hides when none).
- **`admin/users.html`**: Security Guard role option + assigned-properties checkboxes. **`login.html`**: guard preview shortcut (grid 5→6). **`admin/visitors.html` + `pm/visitors.html`**: "Awaiting tenant" tile + gate rows.
- **All visitor tables (admin/pm/security/tenant):** added a **Type** column (Pre-approved / Gate), a **Visitor-type filter**, **search-by-visitor-code** (hidden `data-search`), and **Property/Unit filters** (admin cascade; pm/security selects; tenant single-unit → type+code only).
- **SRS synced:** roles 5→6, matrix (Guard row + amended Tenant), enum `SECURITY_GUARD=5`, Module 8 gate flow + `awaiting_tenant_approval`, page map.
- **Solution Overview** (with `gharsetu-lead`): added the Security Guard role bullet to Visitor Management; tenant bullet now "register + approve gate visitor requests"; check-in/out bullet now includes Security Guard. (See `gharsetu-lead-2026-06-01.md`.)

### Bug fixes this session
- Super Admin Organizations pagination was a bespoke right-aligned footer → migrated to the shared centered `.pagination` component (one constant design).
- Broken HTML comments `<\!--` → `<!--` on `security/dashboard.html` + `admin/delegation-activity.html` (zsh mangled `!` in a heredoc; they were rendering as visible text).

### Verification
- `node --check` on all changed inline JS + `assets/paginate.js` — all pass.
- Scope: PM/Security pages assigned-scoped; Guard pages carry no other-module links.
- python-docx round-trip on `Solution_Overview.docx` after each bullet edit.

---
