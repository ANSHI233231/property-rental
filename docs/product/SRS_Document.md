# Software Requirements Specification (SRS)
## GharSetu — Property Rental Management Platform

**Version:** 2.0 — current engagement (v8 scope)
**Date:** 27/05/2026
**Sources:** [Solution_Overview.docx](Solution_Overview.docx) (v8), [UIUX_Design_Document.docx](UIUX_Design_Document.docx), [GharSetu_Model_API_Spec.md](v1/GharSetu_Model_API_Spec.md), [Blueprint_Property_Rental_Application_v8](v1/Blueprint_Property_Rental_Application_v8.docx)

> **v2.0 reconciliation (27/05/2026).** Brought in line with the current engagement (v8) as built in the prototype: SAAS layer + **Super Admin** role, public Organization sign-up with approval gate, Subscription Plans, **per-room leasing**, **Visitor Management**, **Master Data Administration**, **Settings**, **Admin Impersonation**, **Task Delegation**. The v1 hard rules **BL-01 → BL-23 are preserved**; **BL-05** (retire is now a reversible status) and **BL-19** (a PM may manage multiple properties) are amended in place with notes, and **eight new rules NR-1 → NR-8** are added (§5). Items now in scope are removed from §9; only subscription-billing integration and custom domains / per-org branding remain deferred.

---

## 1. Project Overview

GharSetu replaces paper folders, spreadsheets, and WhatsApp groups. It centralizes properties, tenants, leases, rent collection, maintenance and visitors into a single role-scoped web/mobile app.

**Multi-tenant SAAS (v8).** GharSetu is a multi-organization platform: each organization registers (public sign-up → Super Admin approval), runs on a Subscription Plan, and operates in complete isolation from every other organization. The flagship reference deployment manages **120 rental units across 18 buildings** in Delhi; that scale is illustrative, not a system limit. A platform-level **Super Admin** sits above all organizations; every other role is scoped to exactly one organization (NR-5).

**Tagline:** *"Stop Losing Track. Start Running Smoothly."*
**Aesthetic:** Trustworthy · Simple · Delhi-First
**Target devices:** Mid-range Android phones (primary) + tablet + desktop.

---

## 2. Stakeholders & Roles

The platform has **five roles** — four operational roles inside each organization plus one platform-level role. **Public Organization sign-up is in scope** (Super Admin approval gate). Tenant self-signup is not in scope (tenant accounts auto-create at lease signing). Admin / PM / Maintenance accounts are created internally by Admin within an organization.

| Role | Scope | Can Do | Cannot Do |
|---|---|---|---|
| **Super Admin** | Platform-level — cross-organization | Approve / deactivate organizations · manage Subscription Plans (Basic / Standard / Premium) · view audit log across all organizations · only role that crosses organization boundaries | Operate inside any single organization · record payments · be impersonated · be assigned to a single org |
| **Admin** | All properties + users within own organization | Manage properties, users, settings, Master Data; view all alerts and reports; impersonate PM / Maintenance / Tenant within own organization; delegate tasks within a window | Cross-organization reads or writes · impersonate Super Admin or another Admin |
| **Property Manager (PM)** | Assigned properties within an organization | Create tenants & leases, record rent payments, raise and assign maintenance, manage visitors, manage day-to-day ops | View other PMs' properties · record payments outside their assigned scope · cross-organization access |
| **Maintenance Staff** | Their assigned requests only | Read + update existing maintenance requests; move to In-Progress; mark Resolved | Create new requests · see rent / lease / financial data · cross-property reads |
| **Tenant** | Their own lease + unit | View own lease, view payment history, raise maintenance requests, close own resolved requests, pre-approve visitors | Record payments · see other tenants/units · reopen closed requests |

---

## 3. Pages & Navigation Map

Three routing classes: **Public** (no auth) · **Platform** (Super Admin, no org prefix) · **Org-scoped** (`/:org/...` for Admin / PM / Maintenance / Tenant).

### Public
| Page | File | Purpose |
|---|---|---|
| Landing | `index.html` | Marketing homepage (hero, capabilities, plans, CTA) |
| Organization sign-up | `organization-signup.html` | Public registration → queues for Super Admin approval (business type, expected units, State→City, pincode, plan) |
| Login | `login.html` | Email/phone + password sign-in |
| Forgot / Reset password | `forgot-password.html`, `reset-password.html` | Self-service password reset |
| Contact | `contact.html` | Contact form (record-only; surfaced to Super Admin) |
| Privacy / Terms | `privacy.html`, `terms.html` | Legal pages (Super-Admin-managed content) |

### Super Admin (platform-level)
| Page | File | Purpose |
|---|---|---|
| Dashboard | `super-admin/dashboard.html` | Platform KPIs across organizations |
| Organizations | `super-admin/organizations.html` | All organizations (plan, status) |
| Organization detail | `super-admin/organization-detail.html` | Approve / **Reject** / Deactivate / Reactivate · Impersonate Admin · Change Plan · org users · platform audit · plan history |
| Plans | `super-admin/plans.html` | Subscription Plans CRUD + feature catalogue + "Most Popular" |
| Master Data (platform) | `super-admin/master-data.html` + `master-data/{cities,states,payment-methods,business-types}.html` | Platform-level masters (no `organization_id`) |
| Legal Pages | `super-admin/legal-pages.html` | Markdown editor for Privacy / Terms + section reorder |
| Contact Inbox | `super-admin/contact-inbox.html` | Contact submissions (record-only) |
| Server Logs | `super-admin/server-logs.html` | Diagnostic log files (view / download) |
| My Profile | `super-admin/profile.html` | Account (name + mobile editable; email + role locked) |

### Admin (own organization)
| Page | File | Purpose |
|---|---|---|
| Dashboard | `admin/dashboard.html` | Org KPIs, 5+-request alert, recent open maintenance |
| Properties | `admin/properties.html` | Properties list + Add/Edit Property + CSV export |
| Property detail | `admin/property-detail.html` | Units table (Add/Edit/Retire Unit), Reassign PM, open maintenance |
| Unit detail | `admin/unit-detail.html` | Unit facts + leases (current+past) + current tenant + status preview |
| Leases · Create Lease | `admin/leases.html`, `admin/create-lease.html` | Org-wide leases + co-tenant consent; full-page lease creation |
| Users | `admin/users.html` | Manage PM / Maintenance / Tenant accounts |
| Maintenance | `admin/maintenance.html` + `maintenance-detail.html` | All requests + detail |
| Visitors | `admin/visitors.html` | Org-wide visitor log — Approve / Deny / Check-in (code validation) / Check-out; Property → Unit filter |
| Rent | `admin/rent.html` | Collection overview, overdue leases |
| Master Data (org) | `admin/master-data.html` + `master-data/{property-types,amenities,specializations,categories,visit-purposes}.html` | Org-level masters (NOT-NULL `organization_id`) |
| Settings · Delegations · Audit Log | `admin/settings.html`, `delegations.html`, `audit-log.html` | Org settings · task delegation windows · audit trail |
| My Profile | `admin/profile.html` | Account (name + mobile editable; email + role locked) |

### Property Manager (assigned properties)
| Page | File | Purpose |
|---|---|---|
| Dashboard | `pm/dashboard.html` | Stats + maintenance queue + recent payments |
| Properties · detail · unit | `pm/properties.html`, `property-detail.html`, `unit-detail.html` | Assigned properties (**multi-property** + read-only tenure history) |
| Tenants | `pm/tenants.html` | People directory (one row per person) — name · property · unit · phone · status; no detail page (contracts live under Leases) |
| Leases · detail | `pm/leases.html`, `lease-detail.html` | Leases + renew / terminate |
| Rent Collection | `pm/rent-collection.html` | Per-period record-payment |
| Maintenance | `pm/maintenance.html` + `maintenance-detail.html` | Property maintenance |
| Visitors | `pm/visitors.html` | Visitor log — Approve / Deny / Check-in (code validation) / Check-out; Property · Unit combined view |
| My Profile | `pm/profile.html` | Account |

### Maintenance Staff (assigned requests only)
| Page | File | Purpose |
|---|---|---|
| My Requests | `maintenance/dashboard.html` | Assigned requests + status actions |
| All Requests | `maintenance/all-requests.html` | Read-only view of open requests (no rent/lease data) |
| Request detail | `maintenance/maintenance-detail.html` | Request detail + resolve (≥20-char notes) |
| My Profile | `maintenance/profile.html` | Account |

### Tenant (own lease only)
| Page | File | Purpose |
|---|---|---|
| My Lease · history | `tenant/dashboard.html`, `tenant/leases.html`, `tenant/lease-detail.html` | Lease summary + history |
| Rent | `tenant/rent.html` | Payment history, outstanding, late fee |
| Maintenance | `tenant/maintenance.html` + `maintenance-detail.html` | My requests + raise new + close resolved |
| Visitors | `tenant/visitors.html` | Pre-approve visitors |
| My Profile | `tenant/profile.html` | Account |

**Navigation:**
- **Desktop / tablet (≥1024px)** — fixed left sidebar (240px, Deep Navy, Saffron active accent); collapsible **Master Data** sub-menu.
- **Mobile (≤1023px)** — bottom tab bar (≤5 items) + **More** sheet for overflow nav + account. **No hamburger menus.**

---

## 4. Features by Module

### Module 1 — Users & Access
- **Every user belongs to exactly one Organization** — except the Super Admin (platform-level, NR-5). No role, including Admin, reads/writes outside its own organization.
- Admin creates PM / Maintenance / Tenant accounts; tenant accounts auto-create at lease signing. Organizations self-register publicly (Super Admin approval gate). The Admin's own account is **not** listed on the Users page (it is managed from My Profile); no new Admins are created there.
- **User editing:** Admin can edit a PM / Maintenance user's name + phone and **reset their password** (with confirmation) from a single form; **email and role are immutable** there (role change is a separate audited action). A **Tenant** row exposes **password reset only** (profile is lease-derived) — the row action reads *Reset*. New / reset passwords are shared privately; no email is sent.
- **User activation:** a user can be **Deactivated / Reactivated** (confirmation required) — a soft status that blocks login and revokes sessions while preserving all records; an inactive user cannot be impersonated. No DELETE (Scope rule C).
- Maintenance staff may hold **one or more Specializations** (from Master Data, Module 7).
- Co-tenants (couples, families) get individual logins linked to one shared lease; every such login is a Tenant and may be primary on another lease.
- Role-scoped views: maintenance staff never see rent / lease / financial data.
- Property reassignment: previous PM keeps **read-only** tenure history; new activity routes to the new PM (BL-20).
- **Admin Impersonation** and **Task Delegation** — see Module 9.

### Module 2 — Properties & Units
- Property: name, address, **property type (from Master Data)**, total units, amenities (from Master Data), pincode, assigned PM(s).
- Unit: number, floor, bedrooms, **bathrooms**, area (sq ft), monthly rent, status.
- Unit states: `available` · `listed` · `occupied` · `under-maintenance` · `retired`.
- **Retire is a reversible soft status** (amended — see BL-05): a retired unit no longer accepts new leases and is never hard-deleted, but can be set back to `available` when it has no active lease. Status is **lease-driven** — it cannot be changed manually while the unit is `occupied`.
- Unit **Add / Edit / Retire is an Admin action**; PM is operations-scoped (views units, does not create/retire them).
- **A PM may manage multiple properties** (amended — see BL-19), with read-only tenure history on reassignment.
- **Leasing mode** per property — Unit-based or Room-based (per-room leasing); the mode locks once any active lease exists (NR-1).

### Module 3 — Leases & Tenants
- A lease is anchored to a **unit** (or a **room**, under per-room leasing) — not to the property.
- Lease record: start date, end date, monthly rent, security deposit, status; primary tenant + optional co-tenants.
- Lease statuses: `active` · `expired` · `renewed` · `terminated`.
- Renewal creates a new lease record; old lease stays `active` until its end date, then transitions to `renewed`.
- Early termination = two steps: (1) record termination date + reason, (2) PM processes deposit refund (full or partial) with reason.
- Co-tenant termination requires explicit consent from **all** co-tenants — no timeout (BL-08, BL-09).
- Lease creation is a full-page Admin/PM flow; the tenant account is provisioned at signing.

### Module 4 — Maintenance Requests
- Raised by **Tenant, PM, or Admin** — maintenance staff cannot create (BL-16). PM and Admin share one **"+ Raise Request"** affordance on the maintenance listing.
- Maintenance staff **cannot self-assign and cannot close**: the PM/Admin assigns the request; the tenant (or PM/Admin) closes it after resolution (BL-21).
- Fields: unit (or room), category (from Master Data), description (≥30 chars), priority (low / medium / high / emergency).
- Workflow: `open` → `assigned` → `in-progress` → `resolved` → `closed` (Closed = resolved then closed out).
- **Listing** (Admin = all properties · PM = own): one row of **status** filter tiles (All · Open · In-Progress · Resolved · Closed) + a one-row filter bar — **Property → Unit cascade** (units shown = only those with ≥1 request), **Priority**, **Assignee** (incl. Unassigned), Search. Property + unit render together in one **"Property · Unit"** column. Assign / reassign / close / reopen happen on the request detail, not the list.
- **Visibility (per-room, NR-2):** a whole-unit (shared) request is visible to every room tenant on the unit + the PM + Maintenance; a room-specific request is visible only to that room's tenant + PM + Maintenance.
- Resolution notes ≥ 20 chars. Emergency = red badge, surfaced on the PM dashboard immediately. Times in Asia/Kolkata.

### Module 5 — Rent Collection
- Due date = same day each month from lease start. If start = 31st and month has no 31st, use the last day of that month.
- Payment fields: amount, date, **method (from Master Data Payment Methods — NR-3)**, reference number, recorded-by (auto-stamped).
- Period statuses: `paid` · `partial` · `overdue` · `prepaid`.
- **Overdue:** auto-set 5 calendar days past due date (BL-12). **Late fee:** 2% of outstanding × full weeks overdue (BL-13). **Prepaid:** excess auto-applied to next period (BL-11).
- **Only PROPERTY_MANAGER and ADMIN record payments** (BL-10); Tenant / Maintenance are view-only.

### Module 6 — Organizations & Subscriptions (SAAS)
- **Organization record** (captured at public sign-up): name, **business type** (from Business Types Master Data), expected unit count, **address (State → City from Master Data + pincode)**, contact person + email, chosen plan.
- **Public Organization sign-up** → status `Pending` → Super Admin **Approve** (provisions the workspace + emails Admin credentials) or **Reject** (with reason; no workspace). Active orgs can be Deactivated / Reactivated. Org lifecycle: `Pending → Active → Deactivated` (and `Pending → Rejected`).
- **Subscription Plans** — Basic / Standard / Premium (Super-Admin-managed CRUD: add / edit / deactivate). Each plan carries a **monthly price (₹)** (BIGINT paise), an **active-user cap**, a **property cap** (either may be unlimited), and **toggles a feature catalogue**. Exactly one plan per organization (NR-6), changeable any time (see NR-14 for the billing implication). Exactly one active plan is flagged **"Most Popular"** for the public site (shown identically on home, sign-up and the Super Admin screen from one source). **"Never below the 3 defaults" is operationalized as: at least 3 active plans must exist at all times** — deactivating a plan that would drop active_count < 3 is blocked at the UI and API. The plan `id` is assigned once at creation (slugified from name) and is **wire-stable thereafter**: renames do not re-derive the id; deactivations do not delete the id; existing invoice / audit references survive.
- **Plan feature catalogue** (toggled per plan): Rent Collection · Maintenance Requests · Visitor Management · Per-Room Leasing · Task Delegation · Admin Impersonation · Settings Customization · Data Export (CSV) · Priority Support. A plan's enabled features gate which modules an organization can use. **Audit log and Master Data are always-on for every plan** (the platform depends on them) and are not catalogue items.
- **Invoicing** — invoices live **in-platform**; **payment collection is external** (bank transfer / off-platform). Each Active organization gets one auto-generated `issued` invoice per calendar month (cron at 00:00 IST on the 1st), with a one-time **pro-rated approval-time invoice** covering the partial month from approval day to end-of-month. Status enum (wire-stable smallint): `draft (1) · issued (2) · paid (3) · cancelled (4)`. Super Admin records payment via **Mark Paid** (manual payment reference + paid-on); may **Cancel** an issued invoice with a required reason. Both transitions are audited. Issued invoices are **append-only** (NR-15); plan snapshot columns (`plan_id_snapshot`, `plan_name_snapshot`, `plan_price_inr_paise`) are frozen at issue time and survive plan renames / re-prices / deactivations. The org's Admin sees their own invoices read-only on a `Billing` page; cannot Mark Paid (Super Admin only).

### Module 7 — Master Data
- **Org-level (Admin-owned):** Property Types, Amenities, **Maintenance Specializations**, Maintenance Categories, Visit Purposes. **Platform-level (Super-Admin-owned):** Cities, States, Payment Methods, Business Types.
- **Maintenance Specializations** seed the trades a Maintenance user can be tagged with; a user may hold **several** (many-to-many). Used by the Add / Edit User form as a multi-select.
- Forms read the **active** list from Master Data at selection time — values are never hardcoded (NR-3).
- An entry **in use on active records cannot be deactivated** until it is no longer referenced; deactivation is a soft-retire (NR-4). The blocking reason is shown on the disabled control.

### Module 8 — Visitor Management
- **Lifecycle:** Tenant pre-approves (name · phone · unit · purpose · expected date/time) → system generates a **Visitor Code** (`VIS-XXXX`, 4-char alphanumeric) shared with the tenant → PM/Admin **Approves** or **Denies** → on arrival the visitor presents their code → PM/Admin **enters the code** in the check-in modal (validated against the stored code; mismatch is blocked) → **Checked-in** → on departure **Checked-out**. Statuses: `pending → approved → checked-in → checked-out` (or `denied`).
- **Visitor Code** is a gate-validation token — shown to the **tenant** (who shares it with their visitor) but **never displayed to PM/Admin**. PM/Admin enter it at check-in to confirm identity without any integration with physical gate hardware.
- **Roles:** Tenant = pre-approve only. PM = Approve/Deny/Check-in(validate)/Check-out for their assigned properties. Admin = same as PM but org-wide (all properties, with Property → Unit filter).
- Purpose sourced from **Visit Purposes Master Data** (NR-3). Unit picker shows property + unit label. No SMS / gate-hardware integration.

### Module 9 — Admin Impersonation & Task Delegation
- **Impersonation:** an Admin may impersonate a PM / Maintenance / Tenant **within their own organization**. Every action is recorded against the **Admin** in the audit log; the Admin cannot impersonate the Super Admin or anyone outside their org (NR-7).
- **Task Delegation:** an Admin delegates a task to a PM / Maintenance for a defined date window. Actions during the window are recorded against the **delegate**; outside the window the delegate has no extra rights (NR-8).

### Module 10 — Platform Administration (Super Admin)
- **Legal Pages** — Privacy Policy and Terms of Service content is editable by the Super Admin via a section-based **markdown editor** (bold/italic/list/link, reorder sections up/down, publish). The public Privacy/Terms pages render from this single source.
- **Contact Inbox** — public Contact-form submissions are **record-only** (no email is sent; follow-up is out-of-band per Scope rule K). Super Admin views/triages them (New / Read / Replied).
- **Server Logs** — read-only diagnostic log files, viewable and downloadable. *App-port carry-over:* Pino daily files under `apps/api/logs/`, Super-Admin-only `/platform/logs` endpoints, `VIEW_SERVER_LOG` / `DOWNLOAD_SERVER_LOG` audit actions, ~90-day retention.
- **Cross-org audit** — the Super Admin can view the platform-level audit trail across organizations.

### Module 11 — Settings (Admin, org-level)
- An Admin configures organization-wide operational parameters: **late-fee rate (%)**, **overdue grace period (days)**, and **rent-change notice window (days)**.
- These are the configurable values behind the rent rules — defaults: **2%** (BL-13 late fee), **5 days** (BL-12 overdue grace), **60 days** (BL-11 rent-change notice). The rule logic is unchanged; only the constant is org-configurable. Changes are audited and apply going forward (never retroactively).
- "Settings Customization" is a plan feature (Module 6) — an org whose plan lacks it uses the platform defaults.

---

## 5. Business Logic Rules (Hard Rules)

These rules **must be enforced by the backend**, not just the UI:

| # | Rule | Why |
|---|---|---|
| BL-01 | A unit can never have two `active` leases simultaneously | Prevents double-booking |
| BL-02 | Monthly rent is locked at lease signing; cannot be changed mid-lease | Protects tenants from arbitrary hikes |
| BL-03 | Rent on a unit can only be edited when state is `available` or `listed` | Same as BL-02, enforcement layer |
| BL-04 | An `occupied` unit cannot be moved to `in-maintenance` or `listed` until lease is properly ended | State integrity |
| BL-05 | Records are never deleted. `retired` is a **reversible soft-retire** status — a retired unit accepts no new leases but is never hard-deleted, and may be set back to `available` when it has no active lease. *(v2.0 amendment: v1 treated retire as permanent; reactivation is now allowed.)* | Audit trail / lifecycle |
| BL-06 | Listed unit rent change instantly updates the public listing | Pricing consistency |
| BL-07 | All co-tenants are jointly liable for unpaid rent | Legal clarity |
| BL-08 | One co-tenant cannot end the lease alone — all must consent | Joint tenancy law |
| BL-09 | Termination request stays pending until all co-tenants respond OR requester withdraws (no silent approvals, no auto-timeout) | Explicit consent |
| BL-10 | Only PMs record payments; tenants cannot self-record | Prevents fake records |
| BL-11 | Concurrent co-tenant payment for same period → first closes the period, second auto-marked `prepaid` for next period | No lost money, no double-credit |
| BL-12 | Period becomes `overdue` exactly 5 calendar days past due date | Predictable, simple |
| BL-13 | Late fee = 2% of outstanding × full weeks overdue, added to payable amount automatically | No manual math |
| BL-14 | Maintenance description ≥ 30 chars; resolution notes ≥ 20 chars | Forces real records |
| BL-15 | Closed requests cannot be reopened by anyone (incl. Admin) | Clean history |
| BL-16 | Maintenance staff: `read + update` only — cannot `create`, **cannot self-assign** (the PM/Admin assigns), and **cannot close** (the tenant closes, per BL-21) | Role separation |
| BL-17 | If a tenant raises ≥5 maintenance requests for the same unit in one **calendar month** (1st → end of month), an Admin alert fires | Catches problem units / frivolous requests |
| BL-18 | Tenant turnover gap (e.g., Fri move-out → Mon move-in) is a normal no-lease period — not overdue, not double-bookable | Edge case clarity |
| BL-19 | **A PM may be assigned to multiple properties**; on reassignment the previous PM keeps read-only tenure history. *(v2.0 amendment: v1 enforced exactly one property per PM — that one-PM-per-property constraint is retired.)* | Scope clarity |
| BL-20 | After property transfer, previous PM keeps read-only access; writes go to new PM | Audit + continuity |
| BL-21 | Tenant closes their own resolved requests (PMs/Admins do not auto-close) | Tenant satisfaction signal |
| BL-22 | All times stored & displayed in property local time (Asia/Kolkata) | Avoid timezone confusion |
| BL-23 | Dates rendered DD/MM/YYYY everywhere (Delhi convention) | Local norms |

### New rules added in v8 (NR-1 → NR-8)

These extend the hard rules for the current engagement and are enforced at the API/DB level alongside BL-01 → BL-23.

| # | Rule | Why |
|---|---|---|
| NR-1 | Leasing mode (Unit-based or Room-based) **locks** once any active lease exists on a property; switching requires terminating all active leases first | Per-room leasing integrity |
| NR-2 | Shared (whole-unit) maintenance requests are visible to every room tenant on the unit, the PM and Maintenance; room-specific requests are visible only to that room's tenant, the PM and Maintenance | Per-room privacy |
| NR-3 | Amenities, Maintenance Categories, Payment Methods (and Property Types, **Maintenance Specializations**, Visit Purposes, Cities, States, Business Types) are sourced from **Master Data**; forms read the active list at selection time — never hardcoded | Single source of truth |
| NR-4 | Master Data entries **in use on active records cannot be deactivated** until no longer referenced | Referential safety |
| NR-5 | Every user belongs to **exactly one Organization**, except the Super Admin (platform-level). No other role — including Admin — reads/writes outside its own organization; enforced on every request | Tenant isolation |
| NR-6 | Each Organization has **exactly one Subscription Plan** (Basic / Standard / Premium); the plan caps active users (and properties); Super Admin may change it any time and the new cap applies to subsequent additions | Subscription model |
| NR-7 | During Admin impersonation, **every action is recorded against the Admin** — never the impersonated user; Admin cannot impersonate the Super Admin or anyone outside their organization | Accountability |
| NR-8 | A delegated task runs under the **delegate** (PM / Maintenance) inside the Admin-defined date window; actions are recorded against the delegate; outside the window the delegate has no extra rights | Scoped delegation |
| NR-13 | **Billing is anchored to each organization, not to the calendar.** Every Organization carries a `billing_anchor_day` (1–28) set when the Super Admin approves the sign-up (default = approval day, operator-overridable; values 29/30/31 are excluded because they would skip February). A 00:00 IST cron runs **every day** and issues an invoice for any Active org whose `billing_anchor_day` equals today, covering `[anchor of this month, anchor − 1 of next month]`. The first invoice (issued at approval) covers either a full cycle (if anchor = approval day) or a pro-rated partial cycle (if the operator overrode the anchor). Each org has at most one open `issued` invoice per cycle. | Anchored billing matches the org's signup experience and spreads the billing load across the calendar month |
| NR-14 | On mid-cycle plan change: the new plan's **cap and features take effect immediately**; the **current cycle's invoice is not amended**; **billing changes from the next cycle** — no proration debit/credit on the current invoice. (A cycle is the org's `billing_anchor_day → anchor − 1` window per NR-13.) | Simplest correct invoicing model; matches industry default; keeps NR-15 clean |
| NR-15 | Invoices are append-only once `issued`. Only mutation paths: `issued → paid` (via Mark Paid; records `payment_reference` + `paid_on`) and `issued → cancelled` (via Cancel Invoice; records `cancellation_reason` + `cancelled_on`). `paid` and `cancelled` are terminal. Plan snapshot columns are frozen at issue time. | Audit integrity; legal/regulatory survivability of historical invoices |

> **Configurable constants (v8).** The numeric constants in **BL-11** (60-day rent-change notice), **BL-12** (5-day overdue grace) and **BL-13** (2% late-fee rate) are **org-configurable via Settings** (Module 11); the values shown are the platform defaults. The rule logic (notice required, overdue trigger, late-fee formula) is unchanged.

---

## 6. User Flows

### Flow F1 — Sign Lease & Onboard Tenant
1. PM logs in → **Tenants** → "Add Tenant" → enters tenant + co-tenant details.
2. PM → **Leases** → "New Lease" → selects unit (must be `available` or `listed`), enters dates + rent + deposit.
3. System creates lease (status `active`), creates tenant logins, transitions unit to `occupied`.
4. System auto-generates first rent period with due date = lease start day.

### Flow F2 — Record Rent Payment
1. PM → **Rent Collection** → selects unit → sees periods table.
2. Clicks **Record Payment** on a period.
3. Modal: amount, date (DD/MM/YYYY), method, reference. Recorded-by auto-filled.
4. System reconciles:
   - amount = due → period `paid`.
   - amount < due → period `partial`, balance carries.
   - amount > due → period `paid`, excess → next period `prepaid`.

### Flow F3 — Tenant Raises Maintenance
1. Tenant → **Maintenance** → "Raise New Request".
2. Selects category, priority, types description (counter shows N/30 chars).
3. Submit → request `open`. PM sees it on dashboard; if priority = emergency, red banner.
4. PM assigns staff → status `assigned`.
5. Staff → **My Requests** → "Move to In-Progress".
6. Staff types resolution notes (counter N/20) → "Mark Resolved".
7. Tenant sees `resolved` → "Close Request" → status `closed` (final, irreversible).

### Flow F4 — Lease Renewal
1. PM → **Leases** → existing lease → "Renew".
2. New lease created with start = old end + 1 day, rent editable (because new lease).
3. Old lease keeps `active` until end date, then auto-transitions to `renewed`.

### Flow F5 — Early Termination (Single Tenant)
1. PM → **Leases** → "Early Terminate" → enters termination date + reason → confirm.
2. Lease status → `terminated`. Unit → `available`.
3. Separate step: PM → **Deposit Refund** → enters refund amount + reason → save.

### Flow F6 — Early Termination (Co-Tenant Lease)
1. Tenant A requests termination.
2. System creates pending termination → notifies co-tenants in-app.
3. Each co-tenant explicitly **Approves** or **Rejects**.
4. Only when **all** approve → PM can finalize termination + refund.
5. Until then, request stays pending. Tenant A can withdraw at any time.

### Flow F7 — Overdue & Late Fee Auto-calculation
1. Day 1–5 past due: status stays `partial` or remains current.
2. Day 5+: status → `overdue` automatically.
3. End of week 1: late fee = 2% × outstanding added to balance.
4. End of week 2: another 2% × current outstanding added. (Not compounded retroactively — applied per full week.)
5. When PM records payment, late fee is collected as part of the amount.

---

## 7. Use Cases

| ID | Actor | Use Case | Pre-condition | Success Criteria |
|---|---|---|---|---|
| UC-01 | Admin | View occupancy across all 18 properties | Logged in as Admin | Dashboard shows totals + per-property drill-down |
| UC-02 | Admin | Add new Property Manager | New PM info ready | Account created, can be assigned to a property |
| UC-03 | Admin | Receive 5+ maintenance request alert | Tenant raised 5th request in month | Alert appears on Admin dashboard with unit + tenant link |
| UC-04 | PM | Record a rent payment | Lease active, period exists | Period status updates correctly (paid/partial/prepaid) |
| UC-05 | PM | Renew an expiring lease | Lease in active state, end date approaching | New lease record exists, old transitions to `renewed` on end |
| UC-06 | PM | Process partial deposit refund | Lease terminated | Refund recorded with amount + reason; no full-only restriction |
| UC-07 | Maintenance | Mark request resolved with notes | Request assigned, in-progress | Status `resolved`; tenant can now close |
| UC-08 | Maintenance | Try to create a new request | Logged in as Maintenance | UI does not show "New Request" button (BL-16) |
| UC-09 | Tenant | View current month's rent status | Active lease | Status badge + amount + late fee (if any) visible |
| UC-10 | Tenant | Close a resolved maintenance request | Request `resolved` | Status → `closed`, no further action button |
| UC-11 | Tenant | Try to reopen a closed request | Request `closed` | UI offers "Raise New Request" instead — original stays closed |
| UC-12 | Co-tenant | Approve another co-tenant's termination | Pending termination exists | All approvals recorded; PM can now terminate |
| UC-13 | Public | Register an organization | On the public sign-up page | Org created as `Pending`; appears in Super Admin's queue |
| UC-14 | Super Admin | Approve or reject a pending org | Org is `Pending` | Approve → workspace provisioned + Admin credentials emailed; Reject → declined with reason, no workspace (NR-5/NR-6) |
| UC-15 | Admin | Impersonate a PM to troubleshoot | Admin in own org | Acts as the PM; every action logged against the Admin (NR-7); cannot target Super Admin or other orgs |
| UC-16 | Admin | Switch a property to per-room leasing | Property has no active lease | Mode set to room-based; locked while any active lease exists (NR-1) |
| UC-17 | Admin | Deactivate a Master Data entry in use | Entry referenced by active records | Blocked with a reason on the control until references are retired (NR-4) |

---

## 8. Do's and Don'ts

### Design — Do
- Use **Deep Navy (#1A237E)** for header/sidebar; **Saffron (#FF6F00)** for CTAs only.
- Render dates as **DD/MM/YYYY** everywhere.
- Show **N/30** or **N/20** character counters on description fields.
- Use **status badges** (Paid green, Partial amber, Overdue red, Prepaid blue) consistently.
- Keep cards 8px radius, 1px `#CFD8DC` border, soft shadow; emergency cards get a 4px red left border.
- Mobile-first: 44px minimum tap target, generous whitespace, single-column on phones.
- Hindi-friendly typography: Poppins (headings) + Inter (body) — both load via Google Fonts.

### Design — Don't
- Don't use Saffron for body text or large filled blocks (small CTAs/accents only).
- Don't show greyed-out features the user can't access — **omit them entirely** for the role.
- Don't use hamburger menus; use bottom tab bar on mobile.
- Don't show MM/DD/YYYY or ISO dates in the UI.
- Don't use stock-photo "classifieds-site" reds, yellow-greens, or teals (those are competitor palettes — NoBroker, 99acres, MagicBricks, Housing).
- Don't blank-flash on data load — use skeleton screens.

### Engineering — Do
- Enforce **all hard rules (BL-01 → BL-23 + NR-1 → NR-8) at the API/DB level**, not just in the UI. The UI is the second line of defence.
- Keep payments append-only — every recorded payment is immutable; corrections happen via reversing entries with a reason.
- Treat `retired` and `closed` as terminal states. No code path should resurrect them.
- Use property-local timezone (Asia/Kolkata) for display; store UTC.
- Paginate any table over 50 rows at 20 rows/page.
- Use semantic HTML (`<header>`, `<nav>`, `<main>`, `<table><caption>`) — required for screen readers and the WCAG AA target.

### Engineering — Don't
- Don't allow tenants to write payments — even via API. **BL-10 is a hard rule** (only PM + Admin record payments).
- Public **Organization** sign-up **is** in scope (Super Admin approval gate, NR-5/NR-6). **Tenant self-signup is not** — tenant accounts auto-create at lease signing; PM/Maintenance are Admin-created.
- Don't compound late fees retroactively. 2% × outstanding × full-weeks-overdue, evaluated per period.
- Don't auto-approve co-tenant terminations after a timeout. **BL-09: no silent approvals.**
- Don't introduce SMS/email/WhatsApp **business** notifications — out of scope (transactional auth emails like password reset are allowed).
- Don't accept file uploads (lease scans, ID copies, damage photos) — out of scope.
- Don't expose data outside a PM's **assigned properties**, and never across organizations. A PM may hold multiple properties, but only those assigned (NR-5).

---

## 9. Out of Scope

Still out of scope for the current engagement. (Features that *were* out in v1 but are now **in** scope — Super Admin / SAAS, public org sign-up, Subscription Plans, per-room leasing, Visitor Management, Master Data Administration, Settings, Admin Impersonation, Task Delegation — are covered in §2, §4 and §5.)

| Feature | Reason |
|---|---|
| Online payment gateway (UPI/cards inside the app) | Tenants pay via their existing methods; PMs record after receipt |
| SMS / Email / WhatsApp business notifications | View-on-login only for v1. Transactional auth emails (password reset) **are** in scope. |
| File uploads (scanned leases, ID, damage photos) | Text-only records for v1 |
| Visual reports / charts (occupancy graphs, trend dashboards) | Tabular data only for v1 |
| Owner / Landlord login | Internal management only |
| Tenant application & screening (pre-lease) | System starts at lease signing |
| External vendor login (third-party plumbers/electricians) | Internal staff only |
| Two-factor authentication (2FA / TOTP) | Deferred — single-factor (email + password) for v1 |
| Multi-session management UI | No "sign out all other sessions", no session list, no last-sign-in display in profile. Server still issues short-lived access tokens + revocable refresh tokens; the UI is just simpler. |
| Subscription **payment gateway** | Invoicing **data** is now in-platform (auto-generated monthly + Mark Paid by Super Admin) but **payment collection is external** (bank transfer / off-platform). No payment gateway integration in v1. |
| Custom domains + per-organization branding | All organizations share the GharSetu domain and brand; no per-org theming or vanity domains. |

---

## 10. Technology Stack

The stack below is **fixed**. Any deviation requires explicit user approval.

### 10.1 Frontend
| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 15+** | App Router, React Server Components, Server Actions, Turbopack |
| Language | **TypeScript** (strict mode) | `noImplicitAny`, `strictNullChecks` on |
| Styling | **Tailwind CSS** | `tailwind.config.ts` ports design tokens from [prototype/assets/styles.css](prototype/assets/styles.css) verbatim — same color names, same scale |
| Forms | **React Hook Form + zod** | Schemas shared with backend where practical; visual contract = the prototype's `.field-error` pattern (no native tooltips, errors below field, ⚠ glyph) |
| Server state | **TanStack Query** | Caching + invalidation for API responses |
| Component library | **shadcn/ui** (sparingly) | Only where it saves real time; GharSetu identity stays dominant |
| Date handling | **date-fns** with `en-IN` locale | DD/MM/YYYY everywhere |
| Icons | **Inline SVG** (matches prototype) | No external icon font |
| Test runner | **Vitest** + **Playwright** | Vitest for hooks/utilities, Playwright for E2E + a11y (axe) |

### 10.2 Backend
| Layer | Choice | Notes |
|---|---|---|
| Framework | **NestJS (N-1)** | Latest stable major minus one — chosen for ecosystem stability |
| Runtime | **Node.js 22 LTS** | `engines.node` pinned in `package.json` |
| Language | **TypeScript** (strict mode) | Same compiler settings as frontend |
| ORM | **Prisma** | `prisma migrate` for schema changes; `prisma generate` for types |
| Validation | **class-validator + class-transformer** | DTO-level validation; mirrors zod schemas where shared |
| Auth | **JWT** (access 15 min) + httpOnly refresh cookie | `SameSite=Strict`, `Secure`, opaque refresh tokens stored server-side for revocation |
| Password hashing | **Argon2id** | Never bcrypt+legacy; never MD5/SHA1 anywhere |
| Background jobs | **`@nestjs/schedule`** (in-process cron) | Daily overdue check (BL-12), late-fee accrual (BL-13), 5+ maintenance alert (BL-17). Single-instance deployment — for horizontal scaling, revisit by introducing a Redis-backed queue. |
| Test runner | **Jest** + **Supertest** | Unit + integration |

### 10.3 Database
| Layer | Choice | Notes |
|---|---|---|
| Engine | **PostgreSQL 18** | Latest major; uses native JSONB, partial indexes, `GENERATED ALWAYS AS` for computed columns |
| Migrations | **Prisma Migrate** | Append-only history, reviewed in PRs |
| Time/locale | UTC timestamps in DB; `Asia/Kolkata` rendered at API/UI boundary |
| **Multi-tenancy** | **Shared schema + `organization_id`** on every org-scoped table + **Postgres Row-Level Security** to enforce NR-5 isolation at the DB. Platform masters (cities / states / payment-methods / business-types) carry no `organization_id`. |
| Critical indexes | Partial unique on `leases(unit_id) WHERE status='active'` (BL-01); a **`property_managers(property_id, pm_id)`** join for multi-property PM assignment (BL-19 amended — the single-PM partial-unique is removed); `organization_id` composite indexes on org-scoped tables; index on `audit_log(actor_id, created_at)` |
| Append-only tables | `audit_log`, `payments` — no UPDATE/DELETE triggers |

### 10.4 Tooling & Ops (working defaults)
| Concern | Choice |
|---|---|
| Package manager | **pnpm** (workspace-friendly; lockfile committed) |
| Monorepo layout | `apps/web` (Next.js) · `apps/api` (NestJS) · `packages/shared` (zod schemas, types, business-rule constants) |
| Linting | ESLint + Prettier + `@typescript-eslint` |
| Pre-commit | `lint-staged` + `husky` |
| CI | GitHub Actions: typecheck → lint → unit → integration → E2E → build |
| Container | Docker (Node 22 alpine) for both apps |
| Secrets | `.env` not committed; production via host's secret store (e.g. AWS Secrets Manager / similar) |

### 10.5 Constraints carried over from earlier sections
- **Locale:** `en-IN` strings, `Asia/Kolkata` timezone, DD/MM/YYYY dates, ₹ with Indian digit grouping (₹1,20,000).
- **Accessibility target:** WCAG AA on all text contrast; full keyboard reachability; 2px Saffron focus outline.
- **Browser support:** Chrome / Firefox / Safari / Edge — last 2 versions; iOS Safari 12+; Chrome Android. Tested at 320px minimum width.
- **Mobile-first**: 44px minimum tap target; bottom tab bar (no hamburger).

---

## 11. Glossary

| Term | Meaning |
|---|---|
| Active Lease | Lease whose `start_date ≤ today ≤ end_date` and not terminated |
| Co-Tenant | One of multiple tenants on a single shared lease |
| Listed Unit | Unit currently advertised for rent (no active lease) |
| Period | One calendar month of rent for one lease |
| Prepaid | Payment exceeding what's due — auto-applied to next period |
| Retired | Soft-retired unit — accepts no new leases; reversible (BL-05) |
| PM | Property Manager |
| Organization | A tenant of the SAAS platform; the isolation boundary for all org-scoped data |
| Super Admin | Platform-level role above all organizations (approves orgs, manages plans) |
| Subscription Plan | Basic / Standard / Premium — caps an organization's active users + properties and toggles features |
| Leasing mode | Whole-unit vs per-room leasing for a property; locks once an active lease exists (NR-1) |
| Master Data | Admin/Super-Admin-managed reference lists that forms read from (NR-3) |
| Impersonation | An Admin acting as a PM/Maintenance/Tenant in their org; actions logged against the Admin (NR-7) |
| Delegation | A task an Admin grants a PM/Maintenance for a date window; actions logged against the delegate (NR-8) |

---

## 12. API Contract Authority & Spec Reconciliation

The detailed REST API contract — entities, fields, endpoints, error codes, role-based access matrix — lives in **[v1/GharSetu_Model_API_Spec.md](v1/GharSetu_Model_API_Spec.md)** (markdown rendition of the canonical `.docx` in the same folder).

That spec is the **authoritative source** for backend implementation: field types, endpoint paths, error codes, and the role-based access matrix.

### 12.1 Spec ↔ SRS reconciliation (decided 10/05/2026)

When the API spec and this SRS conflict, the resolutions below apply. The API spec markdown has been annotated with these decisions inline.

| Topic | Spec said | Resolved as |
|---|---|---|
| **Password hashing** | `bcrypt`, cost factor 12 | **`Argon2id`** (per [Section 10.2](#102-backend); OWASP modern default; memory-hard) |
| **Business rule numbering** | `BR-01 → BR-20` | This SRS keeps **`BL-01 → BL-23`** as primary identifiers (adds tenant-only close, IST display, DD/MM/YYYY). The `BR-NN` set is a strict subset and remains valid for backend implementation references. |
| **Status flag duplication on units** | `status=RETIRED` AND `is_retired=true` | **Keep both.** `is_retired` enables the trivial partial-index query for retire checks. |

### 12.2 Endpoints added by this reconciliation (gap fill)

The original spec did not list these, but the prototype already shows the UI. They are **in scope for v1**:

| Method | Path | Purpose | Auth |
|---|---|---|---|
| `POST` | `/api/v1/auth/forgot-password` | Send reset link if account exists. Response is the same regardless of whether the account exists (no leak). | Public |
| `POST` | `/api/v1/auth/reset-password` | Confirm reset with single-use token + new password. Token TTL: 30 minutes. | Public (with reset token) |
| `PATCH` | `/api/v1/users/me` | Tenant / PM updates own phone or email. | Any role |
| `POST` | `/api/v1/users/me/change-password` | Authenticated user changes own password. | Any role |
| `GET` | `/api/v1/audit-log` | Admin views the audit trail. | `ADMIN` |
| `POST` | `/api/v1/alerts/{id}/dismiss` | Admin dismisses an alert (e.g. 5+ maintenance). | `ADMIN` |

Transactional auth emails (password reset link only) are in scope. **General business notifications (rent due, lease expiry, maintenance status changes) remain out of scope** per Section 9.

### 12.3 Endpoints explicitly removed from the v1 plan

The original plan included these; user has descoped them. **Do not implement for v1:**

- `POST /api/v1/auth/2fa/setup`, `/verify`, `/disable` — Two-factor authentication
- `GET /api/v1/users/me/sessions`
- `DELETE /api/v1/users/me/sessions` — "Sign out all other sessions"
- Any "last sign-in" metadata display in the profile UI

The server still issues short-lived access tokens + revocable refresh tokens for security, but there is no user-facing session-management UI.

### 12.4 Conventions adopted from the API spec

- **Currency: paise as `BIGINT`** (1 INR = 100 paise; ₹18,000 stored as `1800000`). No floating-point math.
- **Error envelope:** `{ error: { code, message, details? } }` on every error response.
- **Error codes:** use the named codes from API spec §5 verbatim (`LEASE_UNIT_OCCUPIED`, `DUPLICATE_ACTIVE_LEASE`, etc.).
- **Pagination:** cursor-based, default 20 rows, `?cursor=` + `meta: { next_cursor, has_more }`.
- **Rate limit:** 100 requests / minute per authenticated user → `429 RATE_LIMIT_EXCEEDED`.
- **Role enum (uppercase):** `ADMIN | MANAGER | MAINTENANCE | TENANT` (v1 spec). **v8 uses five wire-stable smallint roles:** `ADMIN=0 · PROPERTY_MANAGER=1 · MAINTENANCE=2 · TENANT=3 · SUPER_ADMIN=4` (`MANAGER` → `PROPERTY_MANAGER`). Never renumber; new states take the next free integer.
- **Voided payments:** `is_voided = true` flag with `voided_by` + `void_reason`. Original record never deleted (append-only).
- **Prepaid credits:** stored in a separate `prepaid_credits` table, not inline on `rent_periods`.
- **Property timezone:** stored per-property (default `Asia/Kolkata`). Allows future expansion to other Indian cities.

> **v8 API surface.** The v8 endpoint families — `organizations` (+ approve / reject / deactivate), `subscription-plans`, `master-data/*` (org + platform), `visitors`, `impersonation` sessions, and `delegations` — extend the v1 contract above. They live in the v8 API spec; the conventions here (error envelope, paise BIGINT, append-only audit, `organization_id` + RLS scoping) apply to them unchanged.
