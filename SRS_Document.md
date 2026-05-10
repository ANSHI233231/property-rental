# Software Requirements Specification (SRS)
## GharSetu — Property Rental Management Platform

**Version:** 1.0
**Date:** May 2026
**Sources:** [Blueprint_Property_Rental_Application_v8](document/Blueprint_Property_Rental_Application_v8.docx), [GharSetu_UIUX_Design_Document_updated](document/GharSetu_UIUX_Design_Document_updated.docx)

---

## 1. Project Overview

GharSetu replaces paper folders, spreadsheets, and WhatsApp groups for a Delhi-based property management business operating **120 rental units across 18 buildings**. It centralizes properties, tenants, leases, rent collection, and maintenance into a single role-scoped web/mobile app.

**Tagline:** *"Stop Losing Track. Start Running Smoothly."*
**Aesthetic:** Trustworthy · Simple · Delhi-First
**Target devices:** Mid-range Android phones (primary) + tablet + desktop.

---

## 2. Stakeholders & Roles

The platform has **exactly four roles**. There is no public sign-up — accounts are created internally.

| Role | Scope | Can Do | Cannot Do |
|---|---|---|---|
| **Admin** | All properties, all users | Manage properties/users/settings, view all alerts, run reports | — |
| **Property Manager (PM)** | One assigned property | Create tenants & leases, record rent payments, raise maintenance requests, manage day-to-day ops | View other PMs' properties; record payments outside their property |
| **Maintenance Staff** | Their assigned requests only | Read + update existing maintenance requests; move to In-Progress; mark Resolved | Create new requests; see rent / lease / financial data |
| **Tenant** | Their own lease + unit | View own lease, view payment history, raise maintenance requests, close resolved requests | Record payments; see other tenants/units; reopen closed requests |

---

## 3. Pages & Navigation Map

### Public
| Page | File | Purpose |
|---|---|---|
| Landing / role picker | `prototype/index.html` | Marketing + role selection |
| Login | `prototype/login.html` | Email/phone + password sign-in |

### Admin
| Page | File | Purpose |
|---|---|---|
| Dashboard | `prototype/admin/dashboard.html` | KPIs, alerts, rent + maintenance overview |
| Properties | `prototype/admin/properties.html` | List of all 18 buildings + units |
| Users | `prototype/admin/users.html` | Manage Admin / PM / Maintenance / Tenant accounts |
| Maintenance | `prototype/admin/maintenance.html` | All requests across all properties |
| Rent | `prototype/admin/rent.html` | Collection overview, overdue tenants |
| My Profile | `prototype/admin/profile.html` | Account, member-since, password, sessions, 2FA, recent activity |

### Property Manager
| Page | File | Purpose |
|---|---|---|
| Dashboard | `prototype/pm/dashboard.html` | Property stats + maintenance queue + recent payments |
| Tenants | `prototype/pm/tenants.html` | Tenants in this property |
| Leases | `prototype/pm/leases.html` | Active / expired leases + renew / terminate |
| Rent Collection | `prototype/pm/rent-collection.html` | Per-unit rent periods + record payment modal |
| Maintenance | `prototype/pm/maintenance.html` | Property maintenance queue |
| My Profile | `prototype/pm/profile.html` | Account, assigned property, password, sessions, 2FA |

### Maintenance Staff
| Page | File | Purpose |
|---|---|---|
| My Requests | `prototype/maintenance/dashboard.html` | Assigned requests with status actions |
| All Open | `prototype/maintenance/all-open.html` | Read-only view of every open request across all properties |
| My Profile | `prototype/maintenance/profile.html` | Account, member-since, password, sessions, work stats |

### Tenant
| Page | File | Purpose |
|---|---|---|
| My Lease | `prototype/tenant/dashboard.html` | Lease summary + current rent status snapshot |
| Rent | `prototype/tenant/rent.html` | Full payment history, outstanding balance, late-fee breakdown |
| Maintenance | `prototype/tenant/maintenance.html` | My requests + raise new |
| My Profile | `prototype/tenant/profile.html` | Account, member-since, password, sessions, lease quick-view |

**Navigation:**
- **Desktop / tablet** — Fixed left sidebar (240px, Deep Navy, Saffron 4px left border on active item).
- **Mobile** — Bottom tab bar, max 5 icons. **No hamburger menus.**

---

## 4. Features by Module

### Module 1 — Users & Access
- Admins/PMs create accounts; tenants are created at lease signing.
- Co-tenants (couples, families) get individual logins linked to one shared lease.
- Role-scoped views: maintenance staff never see rent/lease data.
- Property transfer: previous PM keeps **read-only** audit access; new activity routes to new PM.

### Module 2 — Properties & Units
- Property: name, address, type, total units, amenities, assigned PM.
- Unit: number, floor, bedrooms, bathrooms, area (sq ft), monthly rent.
- Unit states: `available` · `occupied` · `in-maintenance` · `listed` · `retired`.
- **Retired = permanent.** Removed units never reactivate; a fresh unit must be created.

### Module 3 — Leases & Tenants
- Lease record: start date, end date, monthly rent, security deposit, status.
- Lease statuses: `active` · `expired` · `renewed` · `terminated`.
- Renewal creates a new lease record; old lease stays `active` until its end date, then transitions to `renewed`.
- Early termination = two steps: (1) record termination date + reason, (2) PM processes deposit refund (full or partial) with reason.
- Co-tenant termination requires explicit consent from **all** co-tenants (no timeout).

### Module 4 — Maintenance Requests
- Raised by Tenant or PM only. Maintenance staff cannot create.
- Fields: unit, category, description (≥30 chars), priority (low / medium / high / emergency).
- Workflow: `open` → `assigned` → `in-progress` → `resolved` → `closed`.
- Tenant closes the request after they're satisfied with the resolution.
- Resolution notes ≥ 20 chars (no one-word "done").
- Emergency flag: red badge, visible on PM dashboard immediately.
- Times stored in property's local time (Asia/Kolkata).

### Module 5 — Rent Collection
- Due date = same day each month from lease start. If start = 31st and month has no 31st, use last day of that month.
- Payment fields: amount, date, method (UPI / NEFT / Cash / Cheque), reference number, recorded-by (auto-stamped).
- Period statuses: `paid` · `partial` · `overdue` · `prepaid`.
- **Overdue:** automatically set 5 calendar days (incl. weekends) past due date.
- **Late fee:** 2% of outstanding balance per full week overdue, calculated by system.
- **Prepaid:** excess payment auto-applied to next period (no manual adjustment).
- **Only the PM** records payments; tenants view-only.

---

## 5. Business Logic Rules (Hard Rules)

These rules **must be enforced by the backend**, not just the UI:

| # | Rule | Why |
|---|---|---|
| BL-01 | A unit can never have two `active` leases simultaneously | Prevents double-booking |
| BL-02 | Monthly rent is locked at lease signing; cannot be changed mid-lease | Protects tenants from arbitrary hikes |
| BL-03 | Rent on a unit can only be edited when state is `available` or `listed` | Same as BL-02, enforcement layer |
| BL-04 | An `occupied` unit cannot be moved to `in-maintenance` or `listed` until lease is properly ended | State integrity |
| BL-05 | Records are never deleted — `retired` is the soft-delete; retired units never reactivate | Audit trail |
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
| BL-16 | Maintenance staff: `read + update` only — cannot `create` | Role separation |
| BL-17 | If a tenant raises ≥5 maintenance requests for the same unit in one **calendar month** (1st → end of month), an Admin alert fires | Catches problem units / frivolous requests |
| BL-18 | Tenant turnover gap (e.g., Fri move-out → Mon move-in) is a normal no-lease period — not overdue, not double-bookable | Edge case clarity |
| BL-19 | Each PM is assigned to exactly **one** property | Scope clarity |
| BL-20 | After property transfer, previous PM keeps read-only access; writes go to new PM | Audit + continuity |
| BL-21 | Tenant closes their own resolved requests (PMs/Admins do not auto-close) | Tenant satisfaction signal |
| BL-22 | All times stored & displayed in property local time (Asia/Kolkata) | Avoid timezone confusion |
| BL-23 | Dates rendered DD/MM/YYYY everywhere (Delhi convention) | Local norms |

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
- Enforce **all 23 business rules at the API/DB level**, not just in the UI. The UI is the second line of defence.
- Keep payments append-only — every recorded payment is immutable; corrections happen via reversing entries with a reason.
- Treat `retired` and `closed` as terminal states. No code path should resurrect them.
- Use property-local timezone (Asia/Kolkata) for display; store UTC.
- Paginate any table over 50 rows at 20 rows/page.
- Use semantic HTML (`<header>`, `<nav>`, `<main>`, `<table><caption>`) — required for screen readers and the WCAG AA target.

### Engineering — Don't
- Don't allow tenants to write payments — even via API. **BL-10 is a hard rule.**
- Don't add public sign-up. Accounts are admin/PM-created only.
- Don't compound late fees retroactively. 2% × outstanding × full-weeks-overdue, evaluated per period.
- Don't auto-approve co-tenant terminations after a timeout. **BL-09: no silent approvals.**
- Don't introduce SMS/email/WhatsApp notifications — explicitly **out of scope** for v1.
- Don't accept file uploads (lease scans, ID copies, damage photos) — **out of scope** for v1.
- Don't expose cross-property data to a PM, even read-only. Single property scope is hard.

---

## 9. Out of Scope (v1)

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
| Background jobs | **BullMQ** (Redis-backed) | For the daily overdue check (BL-12), late-fee accrual (BL-13), and the 5+ maintenance alert (BL-17) |
| Test runner | **Jest** + **Supertest** | Unit + integration |

### 10.3 Database
| Layer | Choice | Notes |
|---|---|---|
| Engine | **PostgreSQL 18** | Latest major; uses native JSONB, partial indexes, `GENERATED ALWAYS AS` for computed columns |
| Migrations | **Prisma Migrate** | Append-only history, reviewed in PRs |
| Time/locale | UTC timestamps in DB; `Asia/Kolkata` rendered at API/UI boundary |
| Critical indexes | Partial unique on `leases(unit_id) WHERE status='active'` (BL-01); partial unique on `properties(active_pm_id)` (BL-19); index on `audit_log(actor_id, created_at)` |
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
| Retired | Soft-deleted unit; permanently inactive |
| PM | Property Manager (Module 1, role 2) |

---

## 11. API Contract Authority & Spec Reconciliation

The detailed REST API contract — entities, fields, endpoints, error codes, role-based access matrix — lives in **[document/GharSetu_Model_API_Spec.md](document/GharSetu_Model_API_Spec.md)** (markdown rendition of the canonical `.docx` in the same folder).

That spec is the **authoritative source** for backend implementation: field types, endpoint paths, error codes, and the role-based access matrix.

### 11.1 Spec ↔ SRS reconciliation (decided 10/05/2026)

When the API spec and this SRS conflict, the resolutions below apply. The API spec markdown has been annotated with these decisions inline.

| Topic | Spec said | Resolved as |
|---|---|---|
| **Password hashing** | `bcrypt`, cost factor 12 | **`Argon2id`** (per [Section 10.2](#102-backend); OWASP modern default; memory-hard) |
| **Business rule numbering** | `BR-01 → BR-20` | This SRS keeps **`BL-01 → BL-23`** as primary identifiers (adds tenant-only close, IST display, DD/MM/YYYY). The `BR-NN` set is a strict subset and remains valid for backend implementation references. |
| **Status flag duplication on units** | `status=RETIRED` AND `is_retired=true` | **Keep both.** `is_retired` enables the trivial partial-index query for retire checks. |

### 11.2 Endpoints added by this reconciliation (gap fill)

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

### 11.3 Endpoints explicitly removed from the v1 plan

The original plan included these; user has descoped them. **Do not implement for v1:**

- `POST /api/v1/auth/2fa/setup`, `/verify`, `/disable` — Two-factor authentication
- `GET /api/v1/users/me/sessions`
- `DELETE /api/v1/users/me/sessions` — "Sign out all other sessions"
- Any "last sign-in" metadata display in the profile UI

The server still issues short-lived access tokens + revocable refresh tokens for security, but there is no user-facing session-management UI.

### 11.4 Conventions adopted from the API spec

- **Currency: paise as `BIGINT`** (1 INR = 100 paise; ₹18,000 stored as `1800000`). No floating-point math.
- **Error envelope:** `{ error: { code, message, details? } }` on every error response.
- **Error codes:** use the named codes from API spec §5 verbatim (`LEASE_UNIT_OCCUPIED`, `DUPLICATE_ACTIVE_LEASE`, etc.).
- **Pagination:** cursor-based, default 20 rows, `?cursor=` + `meta: { next_cursor, has_more }`.
- **Rate limit:** 100 requests / minute per authenticated user → `429 RATE_LIMIT_EXCEEDED`.
- **Role enum (uppercase):** `ADMIN | MANAGER | MAINTENANCE | TENANT`.
- **Voided payments:** `is_voided = true` flag with `voided_by` + `void_reason`. Original record never deleted (append-only).
- **Prepaid credits:** stored in a separate `prepaid_credits` table, not inline on `rent_periods`.
- **Property timezone:** stored per-property (default `Asia/Kolkata`). Allows future expansion to other Indian cities.
