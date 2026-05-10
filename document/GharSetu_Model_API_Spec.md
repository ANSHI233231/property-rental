# GharSetu — Model & API Specification

**Property Rental Management Platform**
**Data Models · Business Rules · API Contracts**
**Version 1.0 · May 2026**

> Markdown rendition of `document/GharSetu_Model_API_Spec.docx` for searchability and agent consumption. The `.docx` remains the human-readable canonical source. If the two ever diverge, **the `.docx` wins for visual layout; this `.md` wins for code-level decisions** (since this is what agents will grep).

> **GharSetu reconciliation notes** (decisions made by the project lead after the spec was authored) are captured in [SRS_Document.md §11](../SRS_Document.md#11-api-contract-authority--spec-reconciliation). When the spec and the SRS conflict, the SRS reconciliation wins.

---

## 1. Overview & Architecture

GharSetu is a multi-tenant property rental management platform built for Indian landlords managing 50–500 rental units. This document specifies all data models, field-level business rules, REST API contracts, and access control logic required for backend implementation.

### System context

| Component | Technology | Notes |
|---|---|---|
| Backend API | REST/JSON over HTTPS | All endpoints versioned under `/api/v1/` |
| Authentication | JWT Bearer tokens | 15-min access token, 7-day refresh token |
| Date format | ISO 8601 (stored UTC) | Displayed as DD/MM/YYYY in all UI (IST) |
| Currency | Indian Rupee (INR, paise precision) | All amounts stored as integers (paise) |
| Locale | `en-IN` with Devanagari fallback | Primary language: English |
| Pagination | Cursor-based | Default page size: 20 rows |
| Timezone | Per-property (default `Asia/Kolkata`) | Emergency request times shown in property TZ |

### Four roles — hard boundaries

Every API response is filtered by role. **The backend enforces scope; the frontend never relies on hiding fields.**

| Role | Code | Scope |
|---|---|---|
| Admin | `ADMIN` | All properties, all users, all data. System-wide alerts. |
| Property Manager | `MANAGER` | Single assigned property only. Creates tenants, leases, payments. |
| Maintenance Staff | `MAINTENANCE` | Assigned maintenance requests only. No lease or payment data. |
| Tenant | `TENANT` | Own lease, own payment history, own maintenance requests. |

---

## 2. Data Models

### 2.1 User & Role Model

**Entity: `users`**

| Field | Type | Nullable | Description / Rule |
|---|---|---|---|
| `id` | UUID | No | Primary key, system-generated |
| `email` | VARCHAR(255) | No | Unique. Used as login identifier. |
| `phone` | VARCHAR(20) | Yes | E.164 format (`+91XXXXXXXXXX`). For future SMS. |
| `full_name` | VARCHAR(200) | No | Display name across all screens. |
| `role` | ENUM | No | `ADMIN` \| `MANAGER` \| `MAINTENANCE` \| `TENANT` |
| `password_hash` | VARCHAR(255) | No | **Argon2id** (per SRS reconciliation §11; spec originally said bcrypt cost 12). |
| `is_active` | BOOLEAN | No | Default true. Set false on deactivation (never delete). |
| `property_id` | UUID FK | Yes | Required for `MANAGER` and `MAINTENANCE` roles. Null for `ADMIN`. |
| `created_by` | UUID FK | No | ID of the Admin/Manager who created this account. |
| `created_at` | TIMESTAMPTZ | No | UTC. Set on insert, never updated. |
| `last_login_at` | TIMESTAMPTZ | Yes | Updated on each successful authentication. |

**Creation rules**

- No public sign-up. Only `ADMIN` or `MANAGER` can create accounts via `POST /api/v1/users`.
- `TENANT` accounts are auto-created when a lease is first created (`POST /api/v1/leases`).
- `MANAGER` and `MAINTENANCE` must have `property_id` set. `ADMIN` must have `property_id` null.

---

### 2.2 Property & Unit Model

**Entity: `properties`**

| Field | Type | Nullable | Description / Rule |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `name` | VARCHAR(200) | No | e.g. `Sharma Residency Block A` |
| `address_line1` | VARCHAR(300) | No | Street address |
| `address_line2` | VARCHAR(300) | Yes | Landmark, area |
| `city` | VARCHAR(100) | No | Default: `Delhi` |
| `state` | VARCHAR(100) | No | Default: `Delhi` |
| `pincode` | CHAR(6) | No | 6-digit Indian PIN |
| `property_type` | ENUM | No | `RESIDENTIAL` \| `COMMERCIAL` \| `MIXED` |
| `total_units` | INTEGER | No | Count of all unit records (incl. retired) |
| `amenities` | JSONB | Yes | Array of strings, e.g. `['Parking','CCTV','Lift']` |
| `manager_id` | UUID FK | No | Current assigned `MANAGER`. **One manager per property.** |
| `timezone` | VARCHAR(50) | No | IANA tz string. Default: `Asia/Kolkata` |
| `created_at` | TIMESTAMPTZ | No | UTC |
| `updated_at` | TIMESTAMPTZ | No | UTC. Updated on any field change. |

**Entity: `units`**

| Field | Type | Nullable | Description / Rule |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `property_id` | UUID FK | No | Parent property |
| `unit_number` | VARCHAR(20) | No | e.g. `3B`, `101`. Unique within property. |
| `floor` | SMALLINT | Yes | `0` = ground floor |
| `bedrooms` | SMALLINT | No | `0` = studio |
| `bathrooms` | SMALLINT | No | |
| `area_sqft` | DECIMAL(8,2) | Yes | Square feet |
| `monthly_rent_paise` | BIGINT | No | Stored in paise (1 INR = 100 paise). e.g. `1800000` = ₹18,000 |
| `status` | ENUM | No | `AVAILABLE` \| `OCCUPIED` \| `MAINTENANCE` \| `LISTED` \| `RETIRED` |
| `is_retired` | BOOLEAN | No | Default false. Set true on retire. **Never reactivated.** |
| `created_at` | TIMESTAMPTZ | No | UTC |
| `updated_at` | TIMESTAMPTZ | No | UTC |

**Unit status rules**

- `OCCUPIED` → cannot transition to `MAINTENANCE` or `LISTED` until the active lease is ended.
- `monthly_rent_paise` → can only be updated when status is `AVAILABLE` or `LISTED`. Locked when `OCCUPIED`.
- `RETIRED` → final state. No transitions out. If unit needed again, create a new unit record.
- Soft-delete only: `is_retired = true`. **No hard deletes on any unit record.**

---

### 2.3 Lease & Tenant Model

**Entity: `leases`**

| Field | Type | Nullable | Description / Rule |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `unit_id` | UUID FK | No | The rented unit |
| `start_date` | DATE | No | Lease start. Used to calculate monthly rent due day. |
| `end_date` | DATE | No | Contractual end date. |
| `monthly_rent_paise` | BIGINT | No | **Locked at signing.** Cannot be updated after status = `ACTIVE`. |
| `security_deposit_paise` | BIGINT | No | Held by landlord. Refunded on termination. |
| `status` | ENUM | No | `ACTIVE` \| `EXPIRED` \| `TERMINATED` \| `RENEWED` |
| `terminated_at` | DATE | Yes | Required if status = `TERMINATED`. |
| `termination_reason` | TEXT | Yes | Required if status = `TERMINATED`. Permanent record. |
| `renewed_by_lease_id` | UUID FK | Yes | Points to the new lease when status = `RENEWED`. |
| `created_by` | UUID FK | No | `MANAGER` who created the lease. |
| `created_at` | TIMESTAMPTZ | No | UTC |
| `updated_at` | TIMESTAMPTZ | No | UTC |

**Lease business rules**

- A unit cannot have two `ACTIVE` leases at the same time. Enforced by **unique partial index** on `(unit_id) WHERE status = 'ACTIVE'`.
- `monthly_rent_paise` is immutable after lease reaches `ACTIVE` status.
- **Renewal:** create a new lease (`ACTIVE`). Old lease status stays `ACTIVE` until `end_date` passes, then auto-transitions to `RENEWED`. `renewed_by_lease_id` is set on old lease.
- **Gap periods** between leases (e.g. tenant moves out Friday, new tenant moves in Monday) are normal — unit status = `AVAILABLE` during the gap. No overdue logic applies.
- **Early termination:** set `terminated_at` + `termination_reason` in one PATCH. Deposit refund is a separate API call (`POST /api/v1/leases/{id}/deposit-refunds`).

**Entity: `lease_tenants`** (join table — supports co-tenants)

| Field | Type | Nullable | Description / Rule |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `lease_id` | UUID FK | No | Parent lease |
| `user_id` | UUID FK | No | Tenant user account |
| `is_primary` | BOOLEAN | No | One primary tenant per lease. Others are co-tenants. |
| `joined_at` | DATE | No | Date this tenant was added to the lease. |

**Co-tenant rules**

- All co-tenants are jointly liable for unpaid rent.
- **Termination:** any co-tenant can initiate via `POST /api/v1/leases/{id}/termination-requests`. All other co-tenants must approve via `PATCH /api/v1/leases/{id}/termination-requests/{req_id}/consent`.
- **No timeout on consent.** Request stays `PENDING` until all consent or initiator withdraws.

**Entity: `deposit_refunds`**

| Field | Type | Nullable | Description / Rule |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `lease_id` | UUID FK | No | |
| `amount_paise` | BIGINT | No | Can be less than deposit (partial refund). |
| `refund_type` | ENUM | No | `FULL` \| `PARTIAL` |
| `reason` | TEXT | No | Required. Permanent audit record. |
| `refunded_by` | UUID FK | No | `MANAGER` who processed the refund. |
| `refunded_at` | TIMESTAMPTZ | No | UTC |

---

### 2.4 Maintenance Request Model

**Entity: `maintenance_requests`**

| Field | Type | Nullable | Description / Rule |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `unit_id` | UUID FK | No | Affected unit |
| `lease_id` | UUID FK | Yes | Active lease at time of creation. Null if raised by Manager. |
| `raised_by` | UUID FK | No | `TENANT` or `MANAGER` user ID. |
| `assigned_to` | UUID FK | Yes | `MAINTENANCE` staff user ID. Null until assigned. |
| `category` | ENUM | No | `PLUMBING` \| `ELECTRICAL` \| `CARPENTRY` \| `APPLIANCE` \| `STRUCTURAL` \| `OTHER` |
| `description` | TEXT | No | **Minimum 30 characters.** Validated server-side. |
| `priority` | ENUM | No | `LOW` \| `MEDIUM` \| `HIGH` \| `EMERGENCY` |
| `status` | ENUM | No | `OPEN` \| `ASSIGNED` \| `IN_PROGRESS` \| `RESOLVED` \| `CLOSED` |
| `resolution_notes` | TEXT | Yes | Required when transitioning to `RESOLVED`. **Minimum 20 characters.** |
| `is_emergency_flagged` | BOOLEAN | No | True when priority = `EMERGENCY`. Shown as alert to MANAGER. |
| `closed_by` | UUID FK | Yes | `TENANT` who closed the request. |
| `created_at_local` | TIMESTAMPTZ | No | Stored UTC, displayed in property timezone. |
| `resolved_at` | TIMESTAMPTZ | Yes | UTC timestamp of resolution. |
| `closed_at` | TIMESTAMPTZ | Yes | UTC timestamp of closure. |

**Maintenance business rules**

- `description` must be ≥ 30 characters. Reject with HTTP 422 if not.
- `resolution_notes` must be ≥ 20 characters when status transitions to `RESOLVED`.
- Status can only advance forward: `OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED`.
- `CLOSED` is terminal. **No re-open for any role, including `ADMIN`.** New issue = new request.
- `MAINTENANCE` staff: can read requests and transition to `IN_PROGRESS` only. **Cannot create.**
- `TENANT`: closes the request (`RESOLVED → CLOSED`) once satisfied.
- **5-request alert:** if a unit has ≥ 5 requests in the current calendar month, auto-create an `admin_alert` record.

---

### 2.5 Rent Collection Model

**Entity: `rent_periods`** (system-generated, one per lease per month)

| Field | Type | Nullable | Description / Rule |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `lease_id` | UUID FK | No | |
| `period_month` | DATE | No | First day of the period month. e.g. `2026-05-01` for May 2026. |
| `due_date` | DATE | No | Same day-of-month as lease `start_date`. See end-of-month rule below. |
| `amount_due_paise` | BIGINT | No | Equals `lease.monthly_rent_paise` at period creation. |
| `late_fee_paise` | BIGINT | No | Default 0. System-calculated. Updated nightly. |
| `total_payable_paise` | BIGINT | No | `amount_due_paise + late_fee_paise`. |
| `amount_paid_paise` | BIGINT | No | Running total of all payments for this period. |
| `status` | ENUM | No | `PAID` \| `PARTIAL` \| `OVERDUE` \| `PREPAID` |
| `overdue_since` | DATE | Yes | Set when status transitions to `OVERDUE`. |
| `weeks_overdue` | SMALLINT | No | Default 0. Updated nightly by scheduled job. |

**Rent period rules**

- **Due date calculation:** if lease `start_date` day > last day of current month, `due_date` = last day of that month (e.g. lease starts 31st → February due date = 28th/29th).
- **`OVERDUE`:** triggered automatically after **5 calendar days** past `due_date` (including weekends).
- **Late fee:** 2% of outstanding balance per full week overdue (week 1 starts on day 6 after `due_date`, i.e. after the 5-day grace). Recalculated nightly by scheduled job. **Never compounded retroactively.**
- **`PREPAID`:** when total payments exceed current period's `amount_due`. Excess auto-applied to next period via `prepaid_credits` table.

**Entity: `payments`**

| Field | Type | Nullable | Description / Rule |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `rent_period_id` | UUID FK | No | The period this payment applies to. |
| `lease_id` | UUID FK | No | Denormalised for query convenience. |
| `amount_paise` | BIGINT | No | Amount received. |
| `payment_date` | DATE | No | Date payment was received (not recorded date). |
| `payment_method` | ENUM | No | `UPI` \| `BANK_TRANSFER` \| `CASH` \| `CHEQUE` |
| `reference_number` | VARCHAR(100) | Yes | UPI ref, cheque number, etc. Recommended for non-cash. |
| `recorded_by` | UUID FK | No | `MANAGER` who entered this payment. **Immutable.** |
| `created_at` | TIMESTAMPTZ | No | UTC. Audit trail. |
| `is_voided` | BOOLEAN | No | Default false. Set true on correction. **Original record preserved.** |
| `voided_by` | UUID FK | Yes | `MANAGER` who voided. |
| `void_reason` | TEXT | Yes | Required when `is_voided = true`. |

**Payment rules**

- Only `MANAGER` can record payments (`POST /api/v1/payments`). `TENANT`: read-only.
- **Concurrent payment race condition:** if two payments arrive for the same period simultaneously, the first commits. The second auto-applies to the next period as `PREPAID`. Enforced via DB-level optimistic locking on `rent_period_id`.
- **Correction:** void original via `PATCH /api/v1/payments/{id}/void`, then create a new correct payment. Original record never deleted.

**Entity: `prepaid_credits`**

| Field | Type | Nullable | Description / Rule |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `lease_id` | UUID FK | No | |
| `amount_paise` | BIGINT | No | Excess amount held. |
| `source_payment_id` | UUID FK | No | Payment that generated this credit. |
| `applied_to_period_id` | UUID FK | Yes | Null = not yet applied. Set when auto-applied to next period. |
| `created_at` | TIMESTAMPTZ | No | UTC |
| `applied_at` | TIMESTAMPTZ | Yes | UTC. Set when applied. |

---

## 3. Business Rules Reference

All rules below are enforced server-side. Frontend validation is supplementary only.

| Rule ID | Area | Trigger | Action |
|---|---|---|---|
| BR-01 | Units | `PATCH unit status` to `MAINTENANCE` or `LISTED` | Reject if `unit.status = OCCUPIED` |
| BR-02 | Units | `PATCH unit monthly_rent_paise` | Reject if `unit.status = OCCUPIED` |
| BR-03 | Units | DELETE or retire unit | Set `is_retired = true`. Never hard delete. |
| BR-04 | Leases | `POST /leases` on occupied unit | Reject. Unit must be `AVAILABLE` or `LISTED`. |
| BR-05 | Leases | `PATCH lease.monthly_rent_paise` | Reject if `lease.status = ACTIVE`. |
| BR-06 | Leases | Duplicate active lease | Reject via unique partial index on `(unit_id, status='ACTIVE')`. |
| BR-07 | Leases | Termination by co-tenant | Require explicit consent from all other co-tenants. **No timeout.** |
| BR-08 | Maintenance | `POST maintenance_request` | Reject `description < 30` chars. |
| BR-09 | Maintenance | Transition to `RESOLVED` | Reject `resolution_notes < 20` chars. |
| BR-10 | Maintenance | Transition from `CLOSED` | Reject for all roles. `CLOSED` is terminal. |
| BR-11 | Maintenance | `MAINTENANCE` staff creates request | Reject. Role not permitted. |
| BR-12 | Maintenance | 5th request in calendar month for unit | Auto-create `admin_alert` record. |
| BR-13 | Rent | Nightly job — overdue check | Set status = `OVERDUE` if unpaid 5+ calendar days past `due_date`. |
| BR-14 | Rent | Nightly job — late fee | Add 2% of outstanding balance per full week overdue. |
| BR-15 | Rent | Payment exceeds current period | Excess auto-applied as `PREPAID` to next period. |
| BR-16 | Rent | Concurrent payments same period | Second payment redirected to next period via optimistic lock. |
| BR-17 | Rent | `TENANT` records payment | Reject. Only `MANAGER` permitted. |
| BR-18 | Rent | End-of-month due date | If day > month length, use last day of month. |
| BR-19 | Access | `MANAGER` accesses different property | Reject with HTTP 403. |
| BR-20 | Access | `TENANT` accesses another tenant's data | Reject with HTTP 403. |

> **Cross-reference:** see [SRS_Document.md §5](../SRS_Document.md#5-business-logic-rules-hard-rules) for the parent rule set BL-01 → BL-23 (which adds three additional rules: tenant-only close, IST timezone display, DD/MM/YYYY date format). The BR-NN rules above are a strict subset of BL-01 → BL-23.

---

## 4. API Endpoint Reference

All endpoints are prefixed with `/api/v1/`. All requests and responses use `Content-Type: application/json`. Authentication via `Authorization: Bearer {access_token}` header.

### 4.1 Authentication

| Method | Path | Purpose | Auth | Body | Responses |
|---|---|---|---|---|---|
| `POST` | `/auth/login` | Exchange email + password for tokens | Public | `{email, password}` | `200 {access_token, refresh_token, expires_in}` · `401` invalid · `403` inactive |
| `POST` | `/auth/refresh` | Rotate access token | Public (refresh in body) | `{refresh_token}` | `200 {access_token, expires_in}` · `401` expired/invalid |
| `POST` | `/auth/logout` | Invalidate refresh token | Bearer | — | `204` |

> Additional auth endpoints **`/auth/forgot-password`** and **`/auth/reset-password`** are added by SRS reconciliation (gap fill — prototype has the UI). See [SRS §11](../SRS_Document.md#11-api-contract-authority--spec-reconciliation).

### 4.2 Properties & Units

| Method | Path | Purpose | Auth | Body | Responses |
|---|---|---|---|---|---|
| `GET` | `/properties` | List properties (scope-filtered) | Any role | filters | `200 {data: [Property], meta}` |
| `POST` | `/properties` | Create new property | `ADMIN` | `{name, address_line1, city, pincode, property_type, manager_id, timezone?}` | `201 {Property}` · `422` · `403` |
| `GET` | `/properties/{id}` | Get single property | `ADMIN` · `MANAGER` (own) | — | `200 {Property}` · `403` · `404` |
| `PATCH` | `/properties/{id}` | Update or re-assign manager | `ADMIN` | `{name?, address_line1?, manager_id?}` | `200 {Property}` · `403` |
| `GET` | `/properties/{id}/units` | List units | `ADMIN` · `MANAGER` (own) | `?status=` | `200 {data: [Unit], meta}` |
| `POST` | `/properties/{id}/units` | Create unit | `ADMIN` · `MANAGER` (own) | `{unit_number, bedrooms, bathrooms, area_sqft?, monthly_rent_paise}` | `201 {Unit}` · `409` · `422` |
| `PATCH` | `/units/{id}` | Update unit. Rent locked if occupied (BR-02) | `ADMIN` · `MANAGER` (own) | `{monthly_rent_paise?, status?, floor?, area_sqft?}` | `200` · `409` BR-01/02 · `403` |
| `PATCH` | `/units/{id}/retire` | Retire unit. Irreversible. | `ADMIN` | `{reason}` | `200 {Unit}` · `409` if active lease |

### 4.3 Leases & Tenants

| Method | Path | Purpose | Auth | Body | Responses |
|---|---|---|---|---|---|
| `GET` | `/leases` | List leases (scoped) | All roles | `?unit_id=, ?status=, ?tenant_id=` | `200 {data: [Lease], meta}` |
| `POST` | `/leases` | Create lease. Auto-creates tenant accounts. Sets unit `OCCUPIED`. | `ADMIN` · `MANAGER` | `{unit_id, start_date, end_date, monthly_rent_paise, security_deposit_paise, tenants: [{email, full_name, phone?, is_primary}]}` | `201 {Lease, tenants}` · `409` BR-04/06 · `422` |
| `GET` | `/leases/{id}` | Get lease w/ co-tenants and payment summary | `ADMIN` · `MANAGER` (own) · `TENANT` (own) | — | `200 {Lease, tenants, payment_summary}` · `403` |
| `PATCH` | `/leases/{id}/terminate` | Terminate early. For co-tenants → creates a `termination_request` instead. | `ADMIN` · `MANAGER` | `{terminated_at, termination_reason}` | `200` direct · `202` request created · `409` already terminated |
| `GET` | `/leases/{id}/termination-requests` | Get pending request + consent status | All co-tenants · `MANAGER` · `ADMIN` | — | `200 {termination_request, consents: [{tenant_id, status}]}` |
| `PATCH` | `/leases/{id}/termination-requests/{req_id}/consent` | Co-tenant approves or withdraws | `TENANT` (co-tenant) | `{action: APPROVE \| WITHDRAW}` | `200` · `403` · `404` |
| `POST` | `/leases/{id}/renew` | Create renewal lease. Old lease keeps `ACTIVE` until `end_date`. | `ADMIN` · `MANAGER` | `{start_date, end_date, monthly_rent_paise?, security_deposit_paise?}` | `201 {new_lease}` · `409` |
| `POST` | `/leases/{id}/deposit-refunds` | Record deposit refund (separate from termination) | `ADMIN` · `MANAGER` | `{amount_paise, refund_type, reason}` | `201 {deposit_refund}` · `422` exceeds deposit |

### 4.4 Maintenance Requests

| Method | Path | Purpose | Auth | Body | Responses |
|---|---|---|---|---|---|
| `GET` | `/maintenance-requests` | List (scoped: `MAINTENANCE` sees only assigned) | All roles | `?status=, ?priority=, ?unit_id=, ?assigned_to=` | `200 {data, meta}` |
| `POST` | `/maintenance-requests` | Create request. `MAINTENANCE` blocked (BR-11). | `TENANT` · `MANAGER` · `ADMIN` | `{unit_id, category, description (≥30), priority}` | `201` · `403` MAINTENANCE blocked · `422` |
| `PATCH` | `/maintenance-requests/{id}/assign` | Assign staff. → `ASSIGNED`. | `MANAGER` · `ADMIN` | `{assigned_to: user_id}` | `200` · `409` not OPEN |
| `PATCH` | `/maintenance-requests/{id}/progress` | Move to `IN_PROGRESS` | `MANAGER` · `ADMIN` · `MAINTENANCE` (own) | `{notes?}` | `200` · `409` not ASSIGNED |
| `PATCH` | `/maintenance-requests/{id}/resolve` | Mark `RESOLVED`. `resolution_notes` required ≥ 20 chars (BR-09). | `MANAGER` · `ADMIN` · `MAINTENANCE` (own) | `{resolution_notes (≥20)}` | `200` · `422` · `409` not IN_PROGRESS |
| `PATCH` | `/maintenance-requests/{id}/close` | Tenant closes. Terminal — cannot reopen (BR-10). | `TENANT` (own unit) | — | `200` · `403` · `409` not RESOLVED |

### 4.5 Rent Collection

| Method | Path | Purpose | Auth | Body | Responses |
|---|---|---|---|---|---|
| `GET` | `/leases/{id}/rent-periods` | List periods w/ status, amount, late fees | `ADMIN` · `MANAGER` (own) · `TENANT` (own) | `?status=, ?from_month=, ?to_month=` | `200 {data, meta}` |
| `GET` | `/rent-periods/{id}` | Period detail incl. payments & prepaid credits | `ADMIN` · `MANAGER` · `TENANT` (own) | — | `200 {RentPeriod, payments, prepaid_credits}` |
| `POST` | `/payments` | Record payment. Tenant blocked (BR-17). Excess → `PREPAID` (BR-15). | `ADMIN` · `MANAGER` | `{rent_period_id, amount_paise, payment_date, payment_method, reference_number?}` | `201 {Payment, prepaid_credit?}` · `403` · `422` · `409` PAID |
| `PATCH` | `/payments/{id}/void` | Void erroneous payment. Original preserved with `is_voided=true`. | `ADMIN` · `MANAGER` | `{void_reason}` | `200` · `409` already voided |
| `GET` | `/properties/{id}/rent-summary` | Summary across all units | `ADMIN` · `MANAGER` (own) | — | `200 {total_units, paid, partial, overdue, prepaid, total_outstanding_paise}` |

---

## 5. Error Codes & Responses

All errors return a consistent JSON envelope. **Never expose raw database errors.**

```json
{
  "error": {
    "code": "LEASE_UNIT_OCCUPIED",
    "message": "Unit 3B already has an active lease.",
    "details": { "unit_id": "uuid", "active_lease_id": "uuid" }
  }
}
```

| HTTP Status | Error Code | When it occurs |
|---|---|---|
| 400 | `INVALID_REQUEST` | Malformed JSON, missing required field, wrong type |
| 401 | `TOKEN_EXPIRED` | JWT access token has expired |
| 401 | `TOKEN_INVALID` | JWT signature invalid or token not found |
| 403 | `ROLE_NOT_PERMITTED` | Role not allowed (e.g. `TENANT` creating payment) |
| 403 | `PROPERTY_SCOPE_VIOLATION` | `MANAGER` accessing different property |
| 403 | `TENANT_SCOPE_VIOLATION` | `TENANT` accessing another tenant's data |
| 404 | `RESOURCE_NOT_FOUND` | Entity ID does not exist |
| 409 | `LEASE_UNIT_OCCUPIED` | Trying to create lease on occupied unit (BR-04) |
| 409 | `DUPLICATE_ACTIVE_LEASE` | Unit already has `ACTIVE` lease (BR-06) |
| 409 | `RENT_LOCKED_ACTIVE_LEASE` | Updating unit rent while `OCCUPIED` (BR-02) |
| 409 | `UNIT_STATUS_BLOCKED` | Invalid status transition (BR-01) |
| 409 | `REQUEST_CLOSED` | Trying to transition `CLOSED` request (BR-10) |
| 409 | `PERIOD_ALREADY_PAID` | Adding payment to fully-paid period |
| 409 | `PAYMENT_ALREADY_VOIDED` | Payment already voided |
| 422 | `DESCRIPTION_TOO_SHORT` | Maintenance description < 30 chars (BR-08) |
| 422 | `RESOLUTION_NOTES_TOO_SHORT` | Resolution notes < 20 chars (BR-09) |
| 422 | `AMOUNT_EXCEEDS_DEPOSIT` | Refund > original deposit |
| 429 | `RATE_LIMIT_EXCEEDED` | More than 100 requests/minute per user |
| 500 | `INTERNAL_ERROR` | Unhandled server error. Logged, never exposed in detail. |

---

## 6. Role-Based Access Matrix

`✓` = permitted, `—` = blocked (HTTP 403). `MANAGER` scope is always limited to their assigned property. `TENANT` scope is always limited to their own lease and unit.

### Users

| Action | ADMIN | MANAGER | MAINT. | TENANT |
|---|:-:|:-:|:-:|:-:|
| Create any user account | ✓ | ✓ | — | — |
| View own profile | ✓ | ✓ | ✓ | ✓ |
| Deactivate any user | ✓ | — | — | — |

### Properties & Units

| Action | ADMIN | MANAGER | MAINT. | TENANT |
|---|:-:|:-:|:-:|:-:|
| View all properties | ✓ | — | — | — |
| View own property | ✓ | ✓ | ✓ | ✓ |
| Create / update property | ✓ | — | — | — |
| Create unit | ✓ | ✓ | — | — |
| Update unit (non-rent) | ✓ | ✓ | — | — |
| Update unit rent (not occupied) | ✓ | ✓ | — | — |
| Update unit rent (occupied) | — | — | — | — |
| Retire unit | ✓ | — | — | — |

### Leases

| Action | ADMIN | MANAGER | MAINT. | TENANT |
|---|:-:|:-:|:-:|:-:|
| Create lease | ✓ | ✓ | — | — |
| View lease (own property/lease) | ✓ | ✓ | — | ✓ |
| Terminate lease | ✓ | ✓ | — | — |
| Initiate co-tenant termination | ✓ | ✓ | — | ✓ |
| Consent to co-tenant termination | — | — | — | ✓ |
| Renew lease | ✓ | ✓ | — | — |
| Record deposit refund | ✓ | ✓ | — | — |

### Maintenance Requests

| Action | ADMIN | MANAGER | MAINT. | TENANT |
|---|:-:|:-:|:-:|:-:|
| Create request | ✓ | ✓ | — | ✓ |
| View request (own scope) | ✓ | ✓ | ✓ | ✓ |
| Assign request | ✓ | ✓ | — | — |
| Move to `IN_PROGRESS` | ✓ | ✓ | ✓ | — |
| Resolve request | ✓ | ✓ | ✓ | — |
| Close request | — | — | — | ✓ |
| View closed request | ✓ | ✓ | ✓ | ✓ |
| Reopen closed request | — | — | — | — |

### Payments & Rent

| Action | ADMIN | MANAGER | MAINT. | TENANT |
|---|:-:|:-:|:-:|:-:|
| Record payment | ✓ | ✓ | — | — |
| View payment history | ✓ | ✓ | — | ✓ |
| Void payment | ✓ | ✓ | — | — |
| View rent periods | ✓ | ✓ | — | ✓ |
| View rent summary dashboard | ✓ | ✓ | — | — |

---

*End of GharSetu Model & API Specification v1.0*
