# Rent Collection — Concept & Implementation Reference

**Audience.** A senior developer / AI agent on a different project who needs to understand or rebuild the rent-collection feature of the Property Rental Management platform from scratch. The reader has TypeScript, Postgres, REST, and React fluency but **zero** familiarity with this repo. Everything load-bearing is inlined below; repo paths are given for reference only.

**Date for worked examples.** 2026-06-02 (June 2nd, 2026).

**Currency.** Indian Rupees (INR / ₹) throughout. **Never** USD / `$`.

---

## 0. TL;DR

Rent collection on this platform is a **period-aware, allocator-driven money-in workflow.** A property manager (or admin) selects a lease, types an amount and a payment date, and the backend distributes the rupees across one or more billing periods (months) in the order the lease owes them — **oldest unsettled first** — writing one DB row per period touched, plus one audit row, plus issuing a PDF receipt that covers the whole transaction.

### What makes it non-trivial

- **Rent status is computed at read time, never stored.** Every `GET /rent` request recomputes Paid / Partial / Outstanding / Overdue / Prepaid for every active lease from the payment history + rent-change history + Settings (rate + grace).
- **Late fee is per period, recomputed against the payment date, capped at month-end.** A payment dated today can settle a period 6 months in the past *without* using "today" as the late-fee asof — it uses `min(paymentDate, periodLastDay)` for that period's own fee.
- **A single Save can write 1..N `rent_payments` rows.** ₹50,000 against a 5-month arrears creates 5 rows (one per period), each with its own period-specific rent + late-fee split, all inside one Prisma transaction, all sharing a self-referential `parent_id` so the receipt service can reconstruct the transaction from any sibling.
- **Allocator is oldest-first regardless of user's "selected period."** The Billing Period dropdown only biases the form's default amount; the actual allocation always begins at the lease's oldest unsettled period and overflows forward.
- **Late-fee Settings values are SNAPSHOTTED onto every row at write time** (`late_fee_rate_percent`, `late_fee_grace_days`). Future Settings tweaks never retroactively re-cost a historical payment.
- **`scopeWhere` vs `filterWhere` split.** Tile stats (Total Due / Collected / Outstanding / Overdue) are computed over the user's role scope only — UI filters narrow the table but never shrink the tiles.
- **PM data scope includes past-tenure overlap, not just current assignments.** A PM that managed a property Jan–Mar can still view payments dated in that window after being reassigned.
- **No hard deletes anywhere.** Payments, leases, rent changes, deposits — every mutation is a CREATE, a soft-cancel, or an UPDATE. The audit table is the source of truth for "what changed when".
- **Rent frequency is monthly only.** Weekly was explicitly removed from the product.
- **Tenants never see other tenants' rent**, even co-tenants on the same lease share an outstanding number, but the data scope is "leases they're a row on", not "all tenants".

**Sources for this section:** `backend/src/rent/rent.service.ts`, `docs/planning/features/2026-05-15-rent-collection-redesign.md`, `docs/product/SRS.md` §5.6, `CLAUDE.md` (Rules 1, 2, 5, 13, 20, 22, 24).

---

## 1. Domain model & vocabulary

### Entities

```
Property ─┬─< Unit ─┬─< Lease ─┬─< LeaseTenant >─ Tenant ── User
          │         │          │
          │         │          ├─< LeaseRentChange     (scheduled / applied / cancelled)
          │         │          ├─< RentPayment         (the money-in rows)
          │         │          └─< SecurityDepositRefund
          │         │
          │         └─< MaintenanceRequest             (not in scope here)
          │
          └─< PmAssignment >─ User  (role = property_manager)

RentPayment ─┐
             ├─> PaymentMethod   (Cash / UPI / NEFT / RTGS / IMPS / Cheque / DD)
             └─> RentPayment     (self-ref: parent_id → first row of the same transaction)

Settings (key-value, by `key`)
  late_fee_rate_percent              default 2
  late_fee_grace_days                default 5
  rent_change_effective_offset_min_days  default 60

AuditLog (immutable; every mutation appends one row)
```

### Glossary

| Term | Definition |
|---|---|
| **Lease** | A rental agreement between a unit and 1..N tenants. `Lease.status` enum (Upcoming / Active / Expired / Closed Early / Renewed). Carries `rentAmount` (the *current* rent post-changes), `depositAmount`, `rentDueDay` (1..31), `startDate`, `endDate`. |
| **Unit** | A rentable space within a property. Has its own `rentAmount` (the asking rent — used as a template when creating a lease, NOT used by rent collection after creation). Rent collection always reads `lease.rentAmount`. |
| **Tenant** | A `Tenant` row joins one `User` (role=tenant) to leases via the `LeaseTenant` join table. `LeaseTenant.isPrimary` flags one tenant per lease as primary (used for receipt addressing). |
| **Rent amount** | Decimal(10,2) on each lease. Live amount, may differ from `unit.rentAmount` if rent changes have been applied. |
| **Rent due day** | Integer 1..31 stored on the lease (`Lease.rentDueDay`). The day-of-month rent is due each period. Clamped to month length: a lease with `rentDueDay = 31` falls back to the 28th in non-leap February. |
| **Rent frequency** | **Monthly only.** A weekly mode was prototyped early and intentionally dropped. There is no `frequency` column on the lease. |
| **Period** | A calendar month identified by `(periodYear, periodMonth)`. Every `RentPayment` row carries the period it pays *for*. |
| **Outstanding** | For the *current* period: `rentForPeriod − sum(rent_payments.amount for this period)`, floored at 0. For multi-period balance: sum of outstanding across every period from lease start to today. |
| **Late fee** | Per-period money owed beyond rent itself when the payment moment is more than `late_fee_grace_days` past the period's due date. Non-compounding (always against the period's rent, not against a running balance). Capped at the period's own month-end. |
| **Overdue** | A period whose `outstanding > 0` AND `daysAfterDue > grace_days` (strictly greater, not ≥). |
| **Prepaid** | A period whose paid total exceeds `rentForPeriod` (advance credit). Status string returned by `computeRentStatus`. |
| **Payment method** | Master entity (Cash / UPI / NEFT / etc.) with a `refRequired` boolean controlling whether the user must enter a Transaction/UTR reference. Only `status: 1` (Active) methods appear in the form's dropdown. |
| **Payment reference** | Free-text up to ~255 chars: UTR / cheque number / transaction id. Required when `paymentMethod.refRequired = true`. |
| **Receipt** | Server-rendered PDF (pdfkit) covering the entire transaction (parent + every child row), addressed `#PAY-NNNN` where NNNN = parent row id zero-padded. |
| **Rent change** | A scheduled or applied delta to `lease.rentAmount`. Lives in `lease_rent_changes`, status Scheduled (1) / Applied (2) / Cancelled (3). Daily cron (00:05) applies any Scheduled rows whose `effective_date <= today`. |
| **Advance payment** | A row written for a period strictly later than the current one. The allocator only creates these when prior periods are fully settled and `cash > 0` remains. |
| **Deposit** | Security deposit (`Lease.depositAmount`). Lives outside rent collection — read by the UI for context but never touched by `RentPayment`. Refunds are a separate table (`security_deposit_refunds`). |

**Sources:** `backend/prisma/schema.prisma`, `docs/product/SRS.md` §3 Definitions, `docs/planning/features/2026-05-15-rent-collection-redesign.md` §1.

---

## 2. Business rules (formal)

### 2.1 Late-fee formula (canonical)

The single source of truth lives in `backend/src/rent/rent.service.ts:851 computeFeeForPeriod`. Pseudo-code:

```
period_first_day = Date.UTC(year, month-1, 1)
period_last_day  = Date.UTC(year, month, 0)
days_in_month    = period_last_day.getDate()
due_day          = min(lease.rentDueDay, days_in_month)
due_date         = Date.UTC(year, month-1, due_day)

rate_percent     = Settings('late_fee_rate_percent', default 2)
grace_days       = Settings('late_fee_grace_days',    default 5)

asof             = startOfDayUTC(paymentDate)         // moment we're scoring
effective_date   = min(asof, period_last_day)         // CAP AT MONTH-END

rent_paid_so_far = sum(rent_payments.amount  WHERE leaseId AND periodMonth AND periodYear)
rent_outstanding = max(0, rentForPeriod − rent_paid_so_far)

if rent_outstanding <= 0:
    return 0                                          // nothing owed → no fee

days_after_due = floor((effective_date − due_date) / 86_400_000)
if days_after_due <= grace_days:
    return 0                                          // within grace window

full_weeks = floor(days_after_due / 7)
total_fee  = full_weeks * (rent_outstanding * rate_percent / 100)
return round(total_fee * 100) / 100                   // 2-decimal-place rounding
```

**Critical exact values** (every constant a reader needs):
- `grace_days = 5` ⇒ a payment landing exactly on `due_date + 5d` is ON-TIME. `daysAfterDue = 5`; `5 > 5` is false, so no fee. The first overdue day is `due_date + 6d`.
- `rate_percent = 2` ⇒ 2% per full week. Two weeks late ⇒ 4%, three weeks ⇒ 6%, etc. Non-compounding.
- `full_weeks = floor(daysAfterDue / 7)` ⇒ 0..6 days past due+grace yields fee=0, day 7..13 yields 1 week of fee, etc.
- Cap: `effective_date = min(paymentDate, periodLastDay)`. A 30-day month with due-day 1 caps `days_after_due` at 30 ⇒ `floor(30/7) = 4` full weeks ⇒ max fee = **8% of `rent_outstanding`** for that period. Periods can never accrue more than ~6–8% in fee. Predictable.
- **Paise precision rule (v2.106).** Rounding is applied ONCE on the total, not per-week. `₹5,432.50 × 2% × 4 weeks = ₹434.60`, not `4 × Math.round(108.65) = ₹436`. See `computeFeeForPeriod` comment at `rent.service.ts:880`.

### 2.2 `outstandingBase` (legacy prototype helper — superseded)

The static HTML prototype encoded the simpler rule:
```js
// prototype/admin/record-payment.html:577
outstandingBase = lease.outstanding > 0 ? lease.outstanding : lease.rent
```

i.e., "if there's anything left from past periods, charge fee on that; otherwise on a full period of rent." This was the v1 rule. **The live backend has moved on**: it computes the fee per-period from `rent_outstanding` for that specific period, not against a single `lease.outstanding` aggregate.

The prototype constants are still useful as the design contract:
```js
const OVERDUE_DAYS  = 5      // → late_fee_grace_days
const LATE_FEE_RATE = 0.02   // → late_fee_rate_percent / 100
```

### 2.3 Rent-status computation (used by `GET /rent`)

`backend/src/rent/rent.service.ts:552 computeRentStatus` walks one lease and returns:

```ts
{
  // identity
  leaseId, unitNumber, propertyName, propertyId,
  tenantName, coTenantCount,
  // rent + dates
  rentAmount: number,        // current/live rent post-change
  rentDueDay: number,
  leaseStart: 'YYYY-MM-DD' | null,
  leaseEnd: 'YYYY-MM-DD' | null,
  // current-period summary
  outstanding: number,       // current month's rent_outstanding
  status: 'Paid' | 'Partial' | 'Outstanding' | 'Overdue' | 'Partial Overdue' | 'Prepaid',
  dueDate: 'YYYY-MM-DD',
  daysAfterDue: number,      // days past current-period's due date (clamped ≥ 0)
  lateFee: number,           // currently-owed fee on CURRENT outstanding
  lateFeePaid: number,       // sum of lateFee collected against current period
  // lifetime aggregates
  totalPaid: number,         // current-period only — sum(amount) where period = today
  lifetimePaid: number,      // sum(amount) over entire payment history
  paymentCount: number,
  lastPaymentDate: 'YYYY-MM-DD' | null,
  // deposit pass-through (for UI banner only)
  securityDeposit: number,
  // dropdown driver (for Record Payment)
  unsettledPeriods: UnsettledPeriod[]
}
```

`UnsettledPeriod` shape per period:
```ts
{
  periodMonth: number,        // 1..12
  periodYear:  number,        // e.g. 2026
  label:       string,        // "Jan 2026"
  rentForPeriod:    number,   // what rent applied (rent-change history aware)
  rentPaid:         number,   // sum(amount) recorded for this period
  rentOutstanding:  number,   // rentForPeriod − rentPaid
  feeOwedAsOf:      number,   // fee owed at today/payDate (frozen if rent fully paid)
  feePaid:          number,   // sum(lateFee) recorded for this period
  feeOutstanding:   number    // feeOwedAsOf − feePaid
}
```

Status decision tree (verbatim from `rent.service.ts:604`):
```
if outstanding ≤ 0 AND totalPaid > rentForCurrent:    status = 'Prepaid'
elif outstanding ≤ 0:                                  status = 'Paid'
elif daysAfterDue > graceDays AND totalPaid > 0:       status = 'Partial Overdue'
elif daysAfterDue > graceDays:                         status = 'Overdue'
elif totalPaid > 0:                                    status = 'Partial'
else:                                                   status = 'Outstanding'
```

### 2.4 Rent for a period (`rentForPeriod`)

Backend helper at `rent.service.ts:801`. Walks `lease.rentChanges`:

```
active = rentChanges where status != Cancelled                            // Applied + Scheduled both count
applicable = active where effectiveDate <= periodFirstDay,
             sorted by effectiveDate desc
if applicable: return applicable[0].newRent
earliest  = active sorted by effectiveDate asc
if earliest: return earliest.previousRent      // pre-history era
return lease.rentAmount
```

Two consequences:
- **Mid-month effective dates apply starting the FOLLOWING period.** A change with `effective_date = Apr 15` returns `newRent` only for periods whose `period_first_day >= Apr 15` — i.e. May onwards. April still bills at `previousRent`.
- **Scheduled (not-yet-applied) changes are honoured for future periods.** Filter is `status != Cancelled`, not `status == Applied`, so a future-dated catch-up payment for an upcoming period uses the new rate. The cron applies these automatically when their effective date passes (see §11).

### 2.5 Rent due date

`due_day = min(lease.rentDueDay, days_in_month)`. So a lease with `rentDueDay = 31` is due:
- 31st in Jan/Mar/May/Jul/Aug/Oct/Dec,
- 30th in Apr/Jun/Sep/Nov,
- 28th in non-leap Feb (29th in leap Feb).

### 2.6 Frequency, prepayment, deposit

- **Frequency:** monthly only. There is no weekly/quarterly/yearly mode.
- **Prepayment:** if the payment date is BEFORE the period's due date, `effective_date < due_date` ⇒ `daysAfterDue ≤ 0` ⇒ no late fee. Falls out of the formula; no special case in code.
- **Deposit:** `Lease.depositAmount` is set at lease creation, never touched by rent flow. Refunded via `POST /leases/:id/deposit-refunds` (separate endpoint, separate table).

### 2.7 Scheduled rent change validation (60-day lead time)

`backend/src/leases/rent-changes/rent-changes.service.ts:42 create`:
- Lease must be **Active** (status = 2). Upcoming / Closed reject 422.
- `newRent != lease.rentAmount` (422 "New rent must differ").
- `effectiveDate > today` (422).
- Lead time: `effectiveDate >= today + Settings('rent_change_effective_offset_min_days', 60)` (422 "Effective date must be at least N days from today").
- Upper cap: `effectiveDate <= min(today + 5 years, lease.endDate)` (422).
- **At most one Scheduled change per lease.** Second POST while one is Scheduled returns **409 Conflict** ("A rent change is already scheduled for this lease. Cancel it before scheduling another.").
- **Cancel** is a status flip (status → Cancelled, sets `cancelledAt`, `cancelledByUserId`). Never a hard DELETE.
- **Closing a lease auto-cancels any pending Scheduled row** in the same transaction.

**Sources:** `backend/src/rent/rent.service.ts` (computeFeeForPeriod, computeRentStatus, rentForPeriod), `docs/planning/features/2026-05-15-rent-collection-redesign.md` §2.2–§2.3, `docs/product/SRS.md` §5.6 FR-RC-04..20.

---

## 3. Status computation (the heart of the feature)

**Rent status is never persisted.** Every `GET /rent` call walks every in-scope active lease, joins its `rent_payments` + `rent_changes`, and recomputes Paid/Partial/Outstanding/Overdue/Prepaid for the **current calendar month** plus an `unsettledPeriods[]` array for every month from lease start to today.

### 3.1 Where "today" comes from

```ts
const today = new Date();   // server clock
```

**Timezone caveat (SRS v2.118).** `Date()` is server-local; cron + tests run in UTC, IST users see ~5.5h lag if you compare against UTC midnight. The fix at the validation layer for `paymentDate` is a string compare:

```ts
// rent.service.ts:373
const paymentDateIso = dto.paymentDate.slice(0, 10);
const todayIso       = todayCalendarISO();    // IST calendar day
if (paymentDateIso > todayIso) throw 422 'Payment date cannot be in the future';
```

For the listing's "current month" rollup, `today.getMonth()` / `today.getFullYear()` are read server-local. The platform runs in Asia/Kolkata; production cron + business logic agree on the same wall-clock calendar.

### 3.2 Worked examples (against today = 2026-06-02)

Lease: ₹10,000/mo, due day = 1, start = 2026-01-01, no rent changes. `rate_percent = 2`, `grace_days = 5`.

| Scenario | Payment so far for Jun | `outstanding` | `daysAfterDue` | `lateFee` | `status` |
|---|---|---|---|---|---|
| Due today, no payment | 0 | 10,000 | 1 (1st was yesterday; today is 2nd) | 0 (within grace) | Outstanding |
| Day 5 (June 6th) unpaid | 0 | 10,000 | 5 | 0 (5 is NOT > 5) | Outstanding |
| Day 6 (June 7th) unpaid | 0 | 10,000 | 6 | 0 (floor(6/7)=0 weeks) | **Overdue** |
| Day 12 (June 13th) unpaid | 0 | 10,000 | 12 | floor(12/7)=1 × 2% × 10,000 = **₹200** | Overdue |
| Day 26, ₹4,000 paid | 4,000 | 6,000 | 26 | floor(26/7)=3 × 2% × 6,000 = **₹360** | Partial Overdue |
| Same day, ₹10,000 paid | 10,000 | 0 | 26 | 0 (live), `lateFeePaid` from the row | Paid |
| ₹20,000 paid (covers Jun + Jul advance) | 10,000 (Jun row) + 10,000 (Jul row) | 0 | 26 | 0 | **Prepaid** |

The same logic runs for every historical period, building `unsettledPeriods[]`. A period drops off only when **both** rent and fee outstanding are 0 (the "frozen fee" rule in §3.3).

### 3.3 The "frozen fee" rule (`feeOwedForPeriodAtTime`)

If rent is still outstanding for a period, fee accrues live. The moment rent is fully paid down, the late-fee meter **freezes at the value it had on the date of the final rent-clearing payment**. So a period whose rent was paid but whose late fee was never collected stays in the dropdown forever until the fee is also paid.

```ts
// rent.service.ts:926
function feeOwedForPeriodAtTime(rentForPeriod, payments, year, month, asof, rate, grace, dueDay) {
  if (rentPaid < rentForPeriod) return computeFeeForPeriod(asof);   // live accrual
  const last = lastPaymentForPeriod;
  const frozenRate  = last.lateFeeRatePercent ?? rate;
  const frozenGrace = last.lateFeeGraceDays   ?? grace;
  return computeFeeForPeriod(asof = last.paymentDate, snapshot rate + grace);
}
```

**Why frozen-rate/grace snapshot?** Every `rent_payments` row carries `late_fee_rate_percent` + `late_fee_grace_days` columns (NULLable, for legacy rows pre-v2.106). The row stores the Settings values that were in effect when it was written. If a year later an admin changes the rate, historical periods stay priced at their original rate. The freeze-on-final-payment uses that row's snapshot, not the current Settings.

**Sources:** `backend/src/rent/rent.service.ts:552, 801, 926`, `docs/planning/features/2026-05-15-rent-collection-redesign.md` §1 rule 9 + §2.2.

---

## 4. Database schema slice

Postgres with Prisma ORM. `relationMode = "prisma"` — **no DB-level foreign-key constraints**; integrity is enforced application-side (CLAUDE.md Rule 13.2).

### 4.1 The five tables that drive rent collection

```prisma
// backend/prisma/schema.prisma

model Lease {
  id            Int       @id @default(autoincrement())
  unitId        Int       @map("unit_id")
  startDate     DateTime  @map("start_date") @db.Date
  endDate       DateTime  @map("end_date")   @db.Date
  rentAmount    Decimal   @map("rent_amount")    @db.Decimal(10, 2)   // current/live rent
  depositAmount Decimal   @map("deposit_amount") @db.Decimal(10, 2)
  depositStatus Int       @default(1) @map("deposit_status")
  status        Int       @default(1)                                  // 1=Upcoming 2=Active 3=Expired 4=Closed Early 5=Renewed
  rentDueDay    Int       @default(1) @map("rent_due_day")             // 1..31
  closedAt      DateTime? @map("closed_at")
  closedReason  String?   @map("closed_reason")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt       @map("updated_at")
  leaseTenants  LeaseTenant[]
  rentPayments  RentPayment[]
  rentChanges   LeaseRentChange[]
  unit          Unit      @relation(fields: [unitId], references: [id])
  // …deposit refunds + maintenance — not in rent scope
  @@index([unitId])
  @@map("leases")
}

model RentPayment {
  id                 Int       @id @default(autoincrement())
  leaseId            Int       @map("lease_id")
  paymentMethodId    Int       @map("payment_method_id")
  amount             Decimal   @db.Decimal(10, 2)                      // rent portion (rupees)
  lateFee            Decimal   @default(0) @map("late_fee") @db.Decimal(10, 2)
  // SETTINGS SNAPSHOT — frozen at moment of write (SRS v2.106). NULL for legacy rows.
  lateFeeRatePercent Int?      @map("late_fee_rate_percent")
  lateFeeGraceDays   Int?      @map("late_fee_grace_days")
  paymentDate        DateTime  @map("payment_date") @db.Date          // when the money came in
  referenceNumber    String?   @map("reference_number")                // UTR / cheque no.
  periodMonth        Int       @map("period_month")                    // 1..12 — the period this row pays for
  periodYear         Int       @map("period_year")
  notes              String?
  // TRANSACTION GROUPING (SRS v2.107). First row of a Save: parent_id = NULL.
  // Every subsequent row in the SAME allocator transaction: parent_id = firstRow.id.
  parentId           Int?      @map("parent_id")
  parent             RentPayment?  @relation("RentPaymentChildren", fields: [parentId], references: [id], onDelete: Restrict, onUpdate: Restrict)
  children           RentPayment[] @relation("RentPaymentChildren")
  createdAt          DateTime  @default(now()) @map("created_at")
  lease              Lease         @relation(fields: [leaseId],         references: [id])
  paymentMethod      PaymentMethod @relation(fields: [paymentMethodId], references: [id])
  @@index([leaseId])
  @@index([paymentMethodId])
  @@index([parentId])
  @@map("rent_payments")
}

model LeaseRentChange {
  id                Int      @id @default(autoincrement())
  leaseId           Int      @map("lease_id")
  previousRent      Decimal  @map("previous_rent") @db.Decimal(10, 2)
  newRent           Decimal  @map("new_rent")      @db.Decimal(10, 2)
  effectiveDate     DateTime @map("effective_date") @db.Date
  status            Int      @default(1)                                // 1=Scheduled 2=Applied 3=Cancelled
  notes             String?
  scheduledByUserId Int      @map("scheduled_by_user_id")
  scheduledAt       DateTime @default(now())     @map("scheduled_at")
  appliedAt         DateTime? @map("applied_at")
  cancelledByUserId Int?     @map("cancelled_by_user_id")
  cancelledAt       DateTime? @map("cancelled_at")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt       @map("updated_at")
  lease             Lease    @relation(fields: [leaseId], references: [id])
  scheduledByUser   User     @relation("RentChangeScheduledBy", fields: [scheduledByUserId], references: [id])
  cancelledByUser   User?    @relation("RentChangeCancelledBy", fields: [cancelledByUserId], references: [id])
  @@index([leaseId])
  @@index([status])
  @@index([effectiveDate])
  @@map("lease_rent_changes")
}

model PaymentMethod {
  id          Int           @id @default(autoincrement())
  name        String        @unique             // "Cash" | "UPI" | "Bank Transfer (NEFT)" | …
  refRequired Boolean       @default(false) @map("ref_required")
  status      Int           @default(1)         // 1=Active, 0=Inactive (filtered out of form)
  createdAt   DateTime      @default(now()) @map("created_at")
  payments    RentPayment[]
  @@map("payment_methods")
}

model AuditLog {
  id        Int      @id @default(autoincrement())
  userId    Int?     @map("user_id")            // NULL = SYSTEM actor (cron, AUTO_APPLY)
  action    String                              // 'CREATE' | 'UPDATE' | 'CANCEL' | 'AUTO_APPLY'
  entity    String                              // PascalCase model name
  entityId  Int?     @map("entity_id")
  oldData   Json?    @map("old_data")
  newData   Json?    @map("new_data")
  createdAt DateTime @default(now()) @map("created_at")
  user      User?    @relation(fields: [userId], references: [id])
  @@index([userId])
  @@map("audit_log")
}
```

**Conventions in play (CLAUDE.md Rule 13):**
- All column names snake_case in DB, camelCase in TS via `@map(...)`.
- Every FK-equivalent gets an `@@index([fk])` (no DB-level FK constraint to lean on the index for).
- Purposeful column names: `rent_outstanding` not `balance`, `late_fee` not `fee`, `scheduled_by_user_id` not `user_id`.
- Decimal money: `@db.Decimal(10, 2)`. Frontend coerces via `Number(...)` because Prisma serialises Decimal as string.

### 4.2 Why no FOREIGN KEY constraints?

Verified: `SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type='FOREIGN KEY'` returns 0. Trade-offs:
- ✅ Soft-deletes (`users.status = 0`) don't need cascade rules.
- ✅ Bulk seeding doesn't deadlock on FK locks.
- ⚠ Orphan rows are possible — application code must clean up dependents on cascading deletes.

### 4.3 Settings table

```prisma
model Setting {
  key         String   @id                       // "late_fee_rate_percent"
  value       String                              // stored as string; parsed by `type`
  type        String                              // "int" | "string" | "bool"
  category    String                              // "rent" | "dates" | …
  label       String                              // human label for admin UI
  description String?
  unit        String?                              // "days" | "%" | "₹"
  minValue    Int?     @map("min_value")           // inclusive bounds (v2.120)
  maxValue    Int?     @map("max_value")
  updatedAt   DateTime @updatedAt @map("updated_at")
  updatedById Int?     @map("updated_by_user_id")
  @@map("settings")
}
```

`SettingsService.getInt(key, fallback)` is called by `RentService` once per request, with a 30s in-memory TTL. Falls back to the literal default if the row is missing (e.g., dev DB hasn't run the migration).

**Sources:** `backend/prisma/schema.prisma:155-258, 346-362`, CLAUDE.md Rule 13.

---

## 5. API contract

All endpoints live under `/api` (NestJS global prefix). Auth is JWT via httpOnly cookie `access_token`; every endpoint below is decorated with `@UseGuards(JwtAuthGuard, RolesGuard)`.

### 5.1 Endpoint table

| Method | Path | Roles allowed | Body / Query DTO | Returns | Audit row |
|---|---|---|---|---|---|
| GET | `/rent` | admin, property_manager, tenant | `FindRentQueryDto` (query) | `{ data: RentStatus[], meta: PaginationMeta<RentListStats> }` | – |
| POST | `/rent/payments` | admin, property_manager | `CreatePaymentDto` (body) | `{ data: RentPayment, distribution: AllocationRow[], rowsCreated: N }` | **CREATE RentPayment** |
| GET | `/rent/leases/:leaseId/history` | admin, property_manager, tenant | (none) | `{ data: RentPayment[] }` desc by paymentDate | – |
| GET | `/rent/payments/:id/receipt[?inline=1]` | admin, property_manager, tenant | (path + optional `inline`) | `application/pdf` (stream) | – |
| GET | `/leases/:leaseId/rent-changes` | admin, property_manager, tenant | – | `{ data: LeaseRentChange[] }` desc by effectiveDate | – |
| POST | `/leases/:leaseId/rent-changes` | admin, property_manager | `CreateRentChangeDto` | `{ data: LeaseRentChange }` | **CREATE LeaseRentChange** |
| DELETE | `/leases/:leaseId/rent-changes/:changeId` | admin, property_manager | – | `{ data: LeaseRentChange }` (status flipped to Cancelled) | **CANCEL LeaseRentChange** |

There is **no** `/rent/export` endpoint today (the prototype shows a CSV/PDF export button but the live app has not implemented it).

### 5.2 DTOs

```ts
// backend/src/rent/dto/find-rent-query.dto.ts
class FindRentQueryDto extends PaginationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() propertyId?: number;
  @IsOptional() @Type(() => Number) @IsInt() leaseId?: number;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsString() @MaxLength(20)  status?: string;       // 'Paid'|'Partial'|'Outstanding'|'Overdue'|'Prepaid'
  // inherited: page?: number; pageSize?: number  (defaults 1 / 20)
}
```

```ts
// backend/src/rent/dto/create-payment.dto.ts  (SRS v2.104: NO `lateFee` field — backend authoritative)
class CreatePaymentDto {
  @IsInt() @Type(() => Number)
  leaseId: number;

  @IsNumber() @Min(0) @Type(() => Number)
  amount: number;                               // rupees, > 0 (additional service-level check)

  @IsDateString()
  paymentDate: string;                          // 'YYYY-MM-DD'

  @IsInt() @Type(() => Number)
  paymentMethodId: number;

  @IsOptional() @IsString()
  referenceNumber?: string;                     // server validates required when method.refRequired

  @IsInt() @Min(1)    @Max(12) @Type(() => Number)
  periodMonth: number;                          // user-selected default period (bias only)

  @IsInt() @Min(2000) @Type(() => Number)
  periodYear: number;

  @IsOptional() @IsString() @MaxLength(255)
  notes?: string;
}
```

```ts
// backend/src/leases/rent-changes/dto/create-rent-change.dto.ts
class CreateRentChangeDto {
  @IsNumber() @Min(0) @Type(() => Number)
  newRent: number;

  @IsDateString()
  effectiveDate: string;                        // 'YYYY-MM-DD'

  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}
```

### 5.3 Response shapes

**`GET /rent` response** (truncated example):

```json
{
  "data": [
    {
      "leaseId": 17,
      "unitNumber": "B-205",
      "propertyName": "Green Valley Towers",
      "propertyId": 2,
      "tenantName": "Arjun Sharma",
      "coTenantCount": 0,
      "rentAmount": 15000,
      "rentDueDay": 1,
      "leaseStart": "2026-02-01",
      "leaseEnd": "2027-01-31",
      "totalPaid": 0,
      "lifetimePaid": 30000,
      "paymentCount": 2,
      "lastPaymentDate": "2026-04-05",
      "securityDeposit": 30000,
      "outstanding": 15000,
      "status": "Overdue",
      "dueDate": "2026-06-01",
      "daysAfterDue": 1,
      "lateFee": 0,
      "lateFeePaid": 0,
      "unsettledPeriods": [
        {
          "periodMonth": 3, "periodYear": 2026, "label": "Mar 2026",
          "rentForPeriod": 15000, "rentPaid": 10000, "rentOutstanding": 5000,
          "feeOwedAsOf": 1500, "feePaid": 0, "feeOutstanding": 1500
        },
        { "periodMonth": 4, "periodYear": 2026, "label": "Apr 2026",
          "rentForPeriod": 15000, "rentPaid": 0, "rentOutstanding": 15000,
          "feeOwedAsOf": 600,  "feePaid": 0, "feeOutstanding": 600 },
        { "periodMonth": 5, "periodYear": 2026, "label": "May 2026",
          "rentForPeriod": 15000, "rentPaid": 0, "rentOutstanding": 15000,
          "feeOwedAsOf": 0,    "feePaid": 0, "feeOutstanding": 0   },
        { "periodMonth": 6, "periodYear": 2026, "label": "Jun 2026",
          "rentForPeriod": 15000, "rentPaid": 0, "rentOutstanding": 15000,
          "feeOwedAsOf": 0,    "feePaid": 0, "feeOutstanding": 0   }
      ]
    }
  ],
  "meta": {
    "page": 1, "pageSize": 20, "total": 47, "totalPages": 3,
    "stats": {
      "leasesActive":  47,
      "totalDue":      745000,
      "totalPaid":     6324500,
      "outstanding":    62800,
      "overdue":        3
    }
  }
}
```

`meta.stats` is the canonical place every tile reads from (see §9).

**`POST /rent/payments` response** (a 3-period catch-up example):
```json
{
  "data": {                                  // first row, fully hydrated for backwards compat
    "id": 124, "leaseId": 17, "amount": "15000.00", "lateFee": "0.00",
    "paymentDate": "2026-06-02", "periodMonth": 3, "periodYear": 2026,
    "paymentMethod": { "id": 5, "name": "UPI" },
    "lease": { "unit": { "unitNumber": "B-205", "property": { "name": "Green Valley Towers" } } }
  },
  "distribution": [
    { "period": "2026-03", "periodMonth": 3, "periodYear": 2026, "amount": 5000,  "lateFee": 1500 },
    { "period": "2026-04", "periodMonth": 4, "periodYear": 2026, "amount": 15000, "lateFee": 600  },
    { "period": "2026-05", "periodMonth": 5, "periodYear": 2026, "amount": 15000, "lateFee": 0    }
  ],
  "rowsCreated": 3
}
```

### 5.4 Validation rules + error codes

| Condition | HTTP | Message |
|---|---|---|
| Missing JWT | 401 | (auth-guard default) |
| Wrong role | 403 | `"Access denied"` |
| PM not currently assigned to property (for POST `/rent/payments`) | 403 | `"Access denied: not currently assigned to this property"` |
| Lease not found | 404 | `"Lease not found"` |
| Payment method not found | 400 | `"Payment method not found"` |
| Payment method inactive | 400 | `"Payment method is not active"` |
| Amount ≤ 0 | 400 | `"Amount must be greater than zero"` |
| paymentDate < lease.startDate | 422 | `"Payment date before lease start"` |
| paymentDate > today (IST) | 422 | `"Payment date cannot be in the future"` |
| selectedPeriod precedes lease start | 422 | `"Billing period precedes lease start"` |
| selectedPeriod after lease end | 422 | `"Billing period is after lease end"` |
| Allocator overflows past lease.endDate | 422 | `"Amount exceeds remaining lease term"` |
| Nothing to allocate (lease fully settled) | 400 | `"Nothing to allocate — lease has no unsettled period for this amount"` |
| Rent change: newRent == current | 422 | `"New rent must differ from current rent."` |
| Rent change: effectiveDate ≤ today | 422 | `"Effective date must be after today."` |
| Rent change: lead time too short | 422 | `"Effective date must be at least N days from today."` |
| Rent change: cap exceeded | 422 | `"Effective date must be on or before <5 years from today / the lease end date>."` |
| Rent change: another Scheduled exists | 409 | `"A rent change is already scheduled for this lease. Cancel it before scheduling another."` |
| Rent change: cancel non-Scheduled | 422 | `"Only scheduled rent changes can be cancelled."` |
| Rent change: cancel past-effective | 422 | `"Cannot cancel a change whose effective date has passed."` |

Validation pipe runs with `whitelist: true, forbidNonWhitelisted: true` — any query/body key not declared on the DTO is rejected with 400 `"property X should not exist"`. This is why `FindRentQueryDto` extends `PaginationQueryDto` rather than relying on a bare `@Query('page')` decorator (CLAUDE.md Rule 21).

**Sources:** `backend/src/rent/rent.controller.ts`, `backend/src/rent/rent.service.ts:322 createPayment`, `backend/src/leases/rent-changes/rent-changes.controller.ts`, `backend/src/leases/rent-changes/rent-changes.service.ts`.

---

## 6. Role-by-role behaviour

The Property Rental Management platform has four user roles. Their rent-collection surface area:

| Role | Can see `/rent`? | Can record payment? | Can see receipts? | Can schedule rent change? |
|---|---|---|---|---|
| **admin** | Yes — all properties | Yes — all leases | Yes — all | Yes — all leases |
| **property_manager** | Yes — assigned + past-tenure | Yes — currently assigned only | Yes — currently assigned + past-tenure with payment-date overlap | Yes — currently assigned only |
| **tenant** | Redirected to `/payments` (own page) | **No** | Yes — own leases | No |
| **maintenance team** | **No** (no link in sidebar; route returns 403) | No | No | No |

### 6.1 Admin

- **Route:** `/rent` → `frontend/src/app/(portal)/rent/page.tsx` → renders `RentPage.tsx`.
- **Page title:** "Rent Collection" / subtitle "Portfolio overview — `<Month Year>`".
- **KPI tiles (top of page, 4 cards):**
  | Tile | Source field | Meaning |
  |---|---|---|
  | Total Due | `meta.stats.totalDue` | Sum of current-period `rentAmount` across every active lease in scope |
  | Collected | `meta.stats.totalPaid` | Sum of `lifetimePaid` across every active lease in scope |
  | Outstanding | `meta.stats.outstanding` | Sum of current-period `outstanding` across every active lease in scope |
  | Overdue | `meta.stats.overdue` (count, not rupees) | Count of leases with `outstanding > 0 AND daysAfterDue > 5` |
- **Tabs:** `By Lease` (default), `By Building`, **`Portfolio`** (admin-only).
  - `By Lease`: paginated rent table (one row per active lease).
  - `By Building`: groups the current page's leases by property, shows per-property totals + a "Collection Rate" progress bar (≥80% green, ≥60% amber, else red).
  - `Portfolio`: portfolio-level summary card + month-by-month trend table (currently a stub — "Historical month trend data will be available once the analytics endpoint is implemented").
- **Filters bar** (above table):
  - `<select>` Status (server-pushed): All / Paid / Partial / Outstanding / Overdue / Prepaid (filter applied post-computation in the service).
  - Search box (debounced 300ms, server-side): matches `tenantName | unitNumber | propertyName` via `contains` insensitive.
  - In prototype: a SearchableDropdown for property + month selector. The live frontend's RentPage doesn't currently render a property picker on the filter bar (it's set internally by the "See Leases" action in the By Building tab). The Record Payment page uses a SearchableDropdown for the lease picker.
- **Table columns (By Lease):** Lease (`#0042` zero-padded), Tenant(s) (with `+N co-tenants` badge when applicable), Unit, Property, Due Date (current month), Amount Due, Paid, Outstanding, Late Fee, Status (badge), Action (`View Detail` link → `/leases/:id` + `Record Payment` button for non-paid statuses).
- **Empty state:** "No rent records found".
- **Primary actions:** "Record Payment" button in the page header (links to `/rent/record`).
- **Data scope rule (Rule 24 scopeWhere):** `{ status: LeaseStatus.active }` (every active lease, every property).
- **Hidden/disabled:** Nothing.

### 6.2 Property Manager

- **Route:** same `/rent` route. Backend `findAll` checks role and applies scope.
- **Page title + tiles + table:** same as admin EXCEPT the `Portfolio` tab is hidden (`...(isAdmin ? ['portfolio'] : [])`).
- **Data scope rule (the most complex of the four):**
  ```ts
  // rent.service.ts:166
  currentIds = pmAssignments where unassignedAt is null
  pastIds    = pmAssignments minus currentIds      // tenure-ended assignments
  scopeWhere = {
    status: active,
    OR: [
      { unit: { propertyId: { in: currentIds } } },              // every active lease on currently-assigned property
      ...pastIds.flatMap(pId => ({                              // past-tenure: only leases whose start/end window overlaps a PM tenure interval
        AND: [{ unit: { propertyId: pId } }, tenureOverlapWhere(intervals)]
      }))
    ]
  }
  ```
  The helper `getPmTenureIntervals(prisma, userId, propertyId)` returns the list of `{from, to}` ranges the PM was assigned to that property. `tenureOverlapWhere` builds a Prisma OR over those ranges.
  
  **Past-tenure filtering of `rentPayments`:** when reading payments for a lease the PM is currently NOT assigned to but WAS, the service additionally filters the lease's payments to those collected during the PM's tenure intervals (`filterPaymentsByTenure` at `rent.service.ts:1126`). FR-PM-13 parity.
- **Record Payment (POST):** PM must be **currently** assigned to the lease's property (mutation gate is stricter than the read gate). Past-tenure PMs see history but cannot record new payments.
- **Hidden:** Portfolio tab, "All Properties Portfolio" view.

### 6.3 Tenant

- **Route:** `/payments` → `frontend/src/app/(portal)/payments/page.tsx` → renders `PaymentsPage.tsx`. The `/rent` route redirects tenants to `/payments` (so the staff view never leaks).
- **Page title:** "Rent & Payments".
- **KPI tiles (top, 4 cards, cumulative across ALL of the tenant's active leases):**
  - Monthly Rent (sum of `rentAmount` across active leases)
  - Total Paid (sum of `lifetimePaid`)
  - Security Deposit (sum of `depositAmount`)
  - Outstanding (sum of current-period `outstanding`)
- **"Current Month" cards:** one per active lease. Shows `propertyName/unitNumber`, current-month rent, due date, and:
  - if paid → green "Paid on DD MMM YYYY" pill + Download Receipt button.
  - else → status badge (Outstanding / Overdue / Partial).
- **Payment History table:** merged across all active leases, newest-first. Columns: Payment ID (`#PAY-NNNN`), Unit/Property, Period, Amount, Late Fee, Paid On, Mode, Reference, Status, Receipt actions (View · Download). FR-RC-16.
- **Data scope:** `where.leaseTenants = { some: { tenantId } }` — only leases the tenant is a row on. A tenant with multiple active leases (e.g., a sub-let across two units) sees a merged view (FR-LT-14, TC-LT-14).
- **Hidden:** Record Payment button (tenants cannot record), the Rent Collection staff view, Portfolio tab, all per-lease tabs.

### 6.4 Maintenance Team

- **Route:** `/rent` returns 403 (`'Access denied'`). The MT sidebar does not include a Rent Collection link at all.
- **Their entire scope:** maintenance requests assigned to them. They cannot see leases, units, or rent.

**Sources:** `backend/src/rent/rent.service.ts:96 findAll`, `frontend/src/app/(portal)/rent/page.tsx`, `frontend/src/app/(portal)/payments/page.tsx`, `frontend/src/components/features/rent/RentPage.tsx`, `frontend/src/components/features/rent/PaymentsPage.tsx`, `docs/product/SRS.md` §5 Feature-Access Matrix, prototype `prototype/admin/rent-collection.html`, `prototype/pm/rent-collection.html`, `prototype/tenant/payments.html`.

---

## 7. Record-payment flow

The most complex screen in the platform. Lives at `/rent/record` for admin + PM. Tenant can't reach it (route check + RolesGuard).

### 7.1 The form (top-down)

```
┌───── Dark hero banner (navy #16213E) ─────────────────────────────┐
│   "Record Payment"                                                 │
│   Lease selector (SearchableDropdown)  ─────────────────────────  │
│   ↓ once a lease is selected, 4 info cards appear:                │
│   [Tenant]   [Lease Details]   [Rent & Fees]   [Unsettled]        │
└────────────────────────────────────────────────────────────────────┘
┌───── Section 1: Billing Period & Payment Date ────────────────────┐
│   Billing Period (SearchableDropdown — every unsettled period +   │
│                   next period for advance)                         │
│   Payment Date  (HTML date input, clamped min=leaseStart max=today)│
└────────────────────────────────────────────────────────────────────┘
┌───── Section 2: Payment Details ──────────────────────────────────┐
│   Amount Received (₹) — clamped to maxPayable                      │
│   Payment Method  (<select>; only status=1 / Active methods)      │
│   Reference / Transaction No. — shown only when method.refRequired│
│   Notes (textarea, maxLength 255)                                  │
└────────────────────────────────────────────────────────────────────┘
┌───── Section 3: Allocation Preview (live as user types) ──────────┐
│   Table of rows: Period · Rent applied · Fee applied · Status     │
│                   · Remaining                                       │
│   Footer: Total / Unallocated / Overflow warning                   │
└────────────────────────────────────────────────────────────────────┘
        ┌────── Sticky right rail: Payment Summary ─────┐
        │   Selected Period │ Payment Date │ Rent       │
        │   Allocated │ Fee Allocated │ Amount         │
        │   Periods Affected │ Unallocated              │
        │   Late Fee Rule footer (rate + grace)         │
        └────────────────────────────────────────────────┘

┌───── Payment History (grouped by parent_id transaction) ──────────┐
│   #PAY-NNNN · Periods Covered · Total Rent · Fee · Total Paid     │
│   · Payment Date · Method · Reference · View | Download           │
└────────────────────────────────────────────────────────────────────┘
```

### 7.2 The Zod schema

```ts
// frontend/src/components/features/rent/RecordPaymentPage.tsx:113
const schema = z.object({
  leaseId:         z.number().positive('Please select a lease'),
  paymentDate:     z.string().min(1, 'Payment date is required'),
  amount:          z.number().positive('Amount must be greater than 0'),
  periodMonth:     z.number().int().min(1).max(12),
  periodYear:      z.number().int().min(2020).max(2100),
  paymentMethodId: z.number().positive('Please select a payment method'),
  reference:       z.string().optional(),                              // server enforces required-when-refRequired
  notes:           z.string().max(255, 'Notes can be at most 255 characters.').optional(),
})
```

The DTO mirrors this 1:1 (CLAUDE.md Rule 1 — frontend validation mirrors backend). The `lateFee` field is intentionally NOT in the DTO: the backend recomputes it from `(period, paymentDate, current outstanding, Settings rate + grace)` and the `forbidNonWhitelisted: true` validation pipe would reject any client attempt to send it.

### 7.3 PAYMENT_METHODS (prototype contract)

Prototype hard-codes:
```js
// prototype/admin/record-payment.html:430
const PAYMENT_METHODS = [
  { name: 'Cash',                 refRequired: false, status: 'Active' },
  { name: 'Cheque',               refRequired: true,  status: 'Active' },
  { name: 'Bank Transfer (NEFT)', refRequired: true,  status: 'Active' },
  { name: 'RTGS',                 refRequired: true,  status: 'Active' },
  { name: 'UPI',                  refRequired: true,  status: 'Active' },
  { name: 'IMPS',                 refRequired: true,  status: 'Active' },
  { name: 'Demand Draft',         refRequired: true,  status: 'Active' },
];
```

Live app: these live in the `payment_methods` DB table (seeded by `seed.ts`). Frontend fetches `/masters/payment-methods` and filters `status === 1`. `refRequired` drives whether the "Reference / Transaction No." input renders.

### 7.4 Live distribution preview (the "what will happen?" panel)

A pure-function `simulateDistribution(lease, paymentDate, amount, rate, grace)` runs in a `useMemo` in `RecordPaymentPage.tsx:201`. It mirrors the backend `allocate()` algorithm:
1. Sort `lease.unsettledPeriods` oldest-first.
2. For each, compute `feeOwed = computeFeeForPeriod(rentForPeriod, rentPaid, year, month, paymentDate, rate, grace, rentDueDay)` (local mirror at `RecordPaymentPage.tsx:170`).
3. Drain cash into `rentOut` then `feeOut` for that period.
4. Cursor advances; if `cash > 0` after the last unsettled period, project up to 12 future months (advance credit), bounded by `lease.endDate` (overflow triggers a `⚠ Amount exceeds remaining lease term — backend will reject` banner).
5. Returns `{ rows, totalRent, totalFee, totalAllocated, unallocated, overflowedPastLeaseEnd }`.

A second probe runs `simulateDistribution(lease, paymentDate, MAX_SAFE_INTEGER, ...)` to compute `maxPayable` — the rupee ceiling for this lease at this paymentDate, used as the input's `max=` attribute. An `onChange` handler clamps any typed value back to the ceiling.

### 7.5 The allocator (server-side authoritative)

```
// rent.service.ts:660 RentService.allocate()
1. Group existing rent_payments by (year, month) → sumByPeriod
2. cursorYear, cursorMonth = lease.startDate's year/month
3. Skip-forward: advance cursor past every (year, month) that is fully settled
                 (rentOutstanding ≤ 0 AND feeOutstanding ≤ 0). Stops at lease end.
4. while cash > 0:
       compute rentOutstanding + feeOwedForPeriod(asof=paymentDate)
       payRent = min(cash, rentOut); cash -= payRent
       payFee  = min(cash, feeOut);  cash -= payFee
       if payRent > 0 OR payFee > 0:
           rows.push({ periodMonth, periodYear, amount: payRent, lateFee: payFee })
       if cash == 0: break
       advance cursor
       if cursor.first > lease.endDate: overflowedPastLeaseEnd = true; break
5. Return { rows, overflowedPastLeaseEnd }
```

**Selected period is ignored as an allocation directive** — it only seeds the form's default `amount` value. The allocator always starts at the oldest unsettled period.

### 7.6 The 2-phase write (parent_id resolution)

```ts
// rent.service.ts:420
await prisma.$transaction(async tx => {
  let parentId: number | null = null;
  const insertedRows: RentPayment[] = [];
  for (let i = 0; i < allocation.rows.length; i++) {
    const row = allocation.rows[i];
    const written = await tx.rentPayment.create({
      data: {
        leaseId, amount: row.amount, lateFee: row.lateFee,
        lateFeeRatePercent: rateP,           // snapshot
        lateFeeGraceDays:   graceDays,       // snapshot
        paymentDate, paymentMethodId, referenceNumber,
        periodMonth: row.periodMonth, periodYear: row.periodYear,
        notes, parentId,
      },
    });
    if (i === 0) parentId = written.id;       // first row becomes parent; siblings reference it
    insertedRows.push(written);
  }

  await tx.auditLog.create({
    data: {
      userId: user.id,
      action: 'CREATE',
      entity: 'RentPayment',
      entityId: insertedRows[0].id,
      newData: { selectedPeriod, paymentDate, amountReceived, distribution: [...] },
    },
  });
});
```

A single click-Save produces:
- **1..N rows in `rent_payments`** (one per period the cash touched).
- Row 1 has `parent_id = NULL` and IS the parent.
- Rows 2..N have `parent_id = row1.id`.
- **One row in `audit_log`** with `newData.distribution` listing every period + amount + lateFee.

Single-period transactions naturally end with one row whose `parent_id = NULL` — indistinguishable from legacy pre-v2.107 rows, which is intentional.

### 7.7 Success state

On success the form replaces the bottom-bar buttons with a green inline card:

```
✓  Payment recorded · #PAY-0124
   View or download the receipt — or record another payment.
   [View Receipt]   [Download]   [Record another]   [Done]
```

`Record another` calls `reset()` and (if the page had been opened with `?leaseId=…`) clears the URL via `router.replace('/rent/record', { scroll: false })`. `Done` navigates to `/rent`.

### 7.8 Admin-vs-PM differences

The Record Payment page is identical for admin and PM. The only difference is the lease dropdown contents:
- Admin: every active lease in the system.
- PM: only leases whose property is currently or formerly assigned to that PM (with past-tenure scope applied).

The PM submission is also rejected at the service if the PM is not currently assigned to the property (403). Past-tenure scope is read-only.

**Sources:** `frontend/src/components/features/rent/RecordPaymentPage.tsx`, `backend/src/rent/rent.service.ts:322 createPayment`, `prototype/admin/record-payment.html:570-588`, `docs/planning/features/2026-05-15-rent-collection-redesign.md` §2.5–§2.6.

---

## 8. Receipts

PDF receipts are streamed on demand. Stored nowhere on disk. Generated at `GET /api/rent/payments/:id/receipt` by `ReceiptService.generateReceiptPdf` using **pdfkit**.

### 8.1 Generation flow

```
1. loadPayment(id)        — full join graph (lease + unit + property + city + leaseTenants + user)
2. checkAccess(payment, user)
   - admin: always allowed
   - PM:    must be currently assigned OR past-tenure with paymentDate inside an interval
   - tenant: must be on the lease's leaseTenants
3. resolveTransaction(payment) — if requestedRow.parentId is set, hop to parent;
                                  then findMany(parentId = parent.id) for all children;
                                  return { parent, rows: sorted-by-period }
4. Render via pdfkit:
   - A4 page, 50pt margins
   - Header band (purple #5B52D6), "PropManage" + #PAY-NNNN + System Received Date
   - PAID stamp (green)
   - Property + Unit block
   - 2-col Billed To / Lease block
   - PAYMENT DETAILS table (Payment Date, Payment Mode, Reference, Periods Covered)
   - ALLOCATION table — one row per period: Period · Due Date · Rent · Late Fee · Subtotal
                         Total row with grand total in primary purple
   - Optional NOTES section
   - Footer: legal notice + view/download timestamp + PropManage logo
5. Stream buffer with Content-Type: application/pdf
                       Content-Disposition: attachment (default) or inline (?inline=1)
                       filename "receipt-PAY-NNNN.pdf"
```

### 8.2 Numbering scheme

- `#PAY-NNNN` where NNNN is the parent row's id, zero-padded to 4 digits.
- `#LM-NNNN` for lease ids (referenced in the Lease block).

### 8.3 Access matrix

| User | When the receipt is for a payment they own | Other |
|---|---|---|
| Admin | Always 200 | Always 200 |
| PM | 200 if currently assigned to the property | 200 if past-tenure AND `paymentDate` falls inside an interval, else 403 |
| Tenant | 200 if on the lease's `leaseTenants` | 403 |

The 403 message is uniform (`"Access denied to this receipt"`) — never leaks existence beyond that.

### 8.4 Inline vs download

- `GET /api/rent/payments/123/receipt` → `Content-Disposition: attachment`. Browser saves.
- `GET /api/rent/payments/123/receipt?inline=1` → `Content-Disposition: inline`. Browser opens in a new tab.

Frontend has two helpers (`downloadReceipt` and `viewReceipt`) in `frontend/src/lib/api/rent.ts`. Both use `fetch + blob + URL.createObjectURL + a.click()`, never `window.open(noopener)` (regression test TC-RC-46 covers the Chrome `null` return bug).

**Sources:** `backend/src/rent/receipt.service.ts`, `frontend/src/lib/api/rent.ts:9-79`.

---

## 9. Tile stats & money totals

CLAUDE.md Rule 20 + Rule 24 in action.

### 9.1 Exact shape of `meta.stats` returned from `GET /rent`

```ts
interface RentListStats {
  leasesActive: number    // count of leases in role scope (no UI filters)
  totalDue:     number    // sum(lease.rentAmount)  over role scope
  totalPaid:    number    // sum(lifetimePaid)      over role scope
  outstanding:  number    // sum(current-period outstanding) over role scope
  overdue:      number    // COUNT of leases with outstanding>0 AND daysAfterDue>graceDays
}
```

Field-by-field meaning:
- `leasesActive` — never shrinks when the user filters by status. Always = "how many active leases am I scoped to right now."
- `totalDue` — total current-month rent the user's portfolio is supposed to collect.
- `totalPaid` — lifetime collected across all those leases. (Note: NOT only "this month's collections" — the prototype called it "Collected" but it's actually cumulative; this is a known nuance.)
- `outstanding` — sum of current-month outstanding only.
- `overdue` — a *count* (not rupees), of leases currently overdue.

### 9.2 The `scopeWhere` vs `filterWhere` split (Rule 24)

```ts
// rent.service.ts:128
const scopeWhere: any = { status: LeaseStatus.active };
const where:      any = { status: LeaseStatus.active };
// scopeWhere collects: role-based access (PM assignments / tenant leases / admin all)
// where      collects: scope + UI filters (search, status, propertyId, leaseId)

const [data, total, _stats] = await Promise.all([
  prisma.lease.findMany({ where: filterWhere, ... }),   // table rows (paged after)
  /* `total` is derived from `rentStatuses.length` post-status-filter */
  prisma.lease.findMany({ where: scopeWhere, ... })     // for tile stats
])
// then run computeRentStatus over both, status-filter the table set,
// page-slice the table set, compute stats from the scope set.
```

So when the user clicks the "Overdue" status pill:
- The **table** shrinks to just overdue leases.
- The **`overdue` tile** still counts every overdue lease in scope (which is the same set in this case — but the tile would not have shrunk had the user clicked, say, "Property = Sunrise").

### 9.3 Tenant page: client-side cumulative

The tenant `/payments` page does NOT use server stats. It fetches `/rent` (which the tenant scope reduces to just their own leases) and reduces locally:
```ts
// PaymentsPage.tsx:73
const summary = rentStatuses.reduce((acc, r) => ({
  rentAmount:      acc.rentAmount      + r.rentAmount,
  totalPaid:       acc.totalPaid       + r.totalPaid,
  outstanding:     acc.outstanding     + r.outstanding,
  securityDeposit: acc.securityDeposit + r.securityDeposit,
  paymentCount:    acc.paymentCount    + r.paymentCount,
}), {...zeros...})
```
This is fine because the tenant always sees their full lease set on one page (no pagination on tenant view).

**Sources:** `backend/src/rent/rent.service.ts:262-315`, `frontend/src/components/features/rent/RentPage.tsx:170-198`, `CLAUDE.md` Rules 20 + 24.

---

## 10. Search, filter, pagination

CLAUDE.md Rules 21, 22, 23 applied.

### 10.1 What the search box matches against on `/rent`

Server-side, case-insensitive `contains` on three fields joined into one OR:
```ts
// rent.service.ts:132
where.AND = [{
  OR: [
    { leaseTenants: { some: { tenant: { user: { name:        { contains: q, mode: 'insensitive' } } } } } },
    { unit:                              { unitNumber:        { contains: q, mode: 'insensitive' } } },
    { unit:        { property:           { name:              { contains: q, mode: 'insensitive' } } } },
  ]
}]
```

So a search for `"Sunrise"` matches by property name, `"A-301"` by unit number, `"Arjun"` by tenant name. Co-tenants are searched too (the join walks every tenant on the lease).

### 10.2 Server-side vs client-side filters

| Filter | Server-side? | Notes |
|---|---|---|
| `propertyId` | Yes | Admin filter applies to `where.unit.propertyId`; for PM also implicit in scope |
| `leaseId` | Yes | Used by Record Payment URL preselect (`?leaseId=N`) |
| `search` | Yes | 300ms debounce via `useDebouncedValue` |
| `status` | Yes (post-computation) | Service computes statuses, then filters; `meta.total` reflects filtered count |
| Tabs (`By Lease` / `By Building`) | Client-side rollup | `By Building` groups the current data page into properties on the frontend |
| "Expiring Soon" (virtual) | Client-side | `lease.endDate ≤ today + 30d` — no stored column |

### 10.3 Property picker

Per Rule 23, every property dropdown in the app uses `<SearchableDropdown>`, never a native `<select>` (option counts can grow). Status dropdowns stay native (fixed 5-option enum).

### 10.4 Pagination

Default `pageSize = 20` (from `PAGE_SIZE_DEFAULT` in `frontend/src/lib/types/pagination.ts`). `<Pagination>` auto-hides when `totalPages === 1`. `By Building` and `Portfolio` tabs don't paginate.

**Sources:** `backend/src/rent/rent.service.ts:132-156`, `backend/src/rent/dto/find-rent-query.dto.ts`, `frontend/src/components/features/rent/RentPage.tsx:128-163`.

---

## 11. Cron / scheduled work

Exactly **one** rent-related cron in the system.

### 11.1 Daily rent-change applier (00:05 server time)

```ts
// backend/src/leases/rent-changes/rent-changes.cron.ts
@Cron('5 0 * * *')
async applyDueRentChanges() {
  const count = await this.service.applyAllDue();
}
```

`applyAllDue` (rent-changes.service.ts:324):
1. Find every `LeaseRentChange` where `status = Scheduled AND effective_date <= today`.
2. For each, run `applyOne(id, actorUserId=null)` in a Prisma transaction:
   - Re-check lease is still Active (auto-cancel the change with reason `lease_not_active_at_apply_time` if not).
   - `update lease.rentAmount = change.newRent`.
   - `update change.status = Applied; appliedAt = now()`.
   - Write audit row: `action='AUTO_APPLY' entity='LeaseRentChange'`, `userId = NULL` (SYSTEM actor).

### 11.2 Lazy fallback

Every `GET /rent` call also runs `rentChangesService.applyDueForLease(leaseId)` (or `applyAllDue` if no leaseId is filtered) before computing rent statuses. So if the cron is missed or delayed, the next read self-heals. Catches its own errors so a stuck rent-change can't break the listing:
```ts
// rent.service.ts:109
try {
  if (filters.leaseId) await rentChangesService.applyDueForLease(filters.leaseId);
  else                  await rentChangesService.applyAllDue();
} catch {/* never fail rent listing */}
```

### 11.3 There is no "rent collection cron"

Rent **status** isn't a stored field, so there's no nightly job to flip leases to Overdue. The status is recomputed at every read.

**Sources:** `backend/src/leases/rent-changes/rent-changes.cron.ts`, `backend/src/leases/rent-changes/rent-changes.service.ts:324, 225`, `backend/src/rent/rent.service.ts:109-117`.

---

## 12. Settings keys that govern rent

| Key | Default | Min | Max | Type | Unit | Label | Read by |
|---|---|---|---|---|---|---|---|
| `late_fee_rate_percent` | `2` | 0 | 100 | int | percent | "Late fee rate" | `RentService.findAll`, `createPayment`; mirrored to `rent_payments.late_fee_rate_percent` snapshot |
| `late_fee_grace_days` | `5` | 0 | 30 | int | days | "Late fee grace period" | Same as above, snapshot column `late_fee_grace_days` |
| `rent_change_effective_offset_min_days` | `60` | 0 | 365 | int | days | "Minimum lead time for rent changes" | `RentChangesService.create` (CreateRentChangeDto validator) |

**Migration history:**
- `backend/prisma/migrations/20260514163005_seed_default_settings/migration.sql` — seeds `rent_change_effective_offset_min_days` (originally in `seed.ts`; moved to migration in SRS v2.96 to make production deploys 1-command).
- `backend/prisma/migrations/20260515120000_add_rent_late_fee_settings/migration.sql` — seeds `late_fee_rate_percent` + `late_fee_grace_days` (SRS v2.105).
- `backend/prisma/migrations/20260515140000_add_late_fee_snapshot_to_rent_payments/migration.sql` — adds the two snapshot columns to `rent_payments` + backfills NULL → defaults (SRS v2.106).
- `backend/prisma/migrations/20260515160000_add_parent_id_to_rent_payments/migration.sql` — adds `parent_id` self-ref (SRS v2.107).
- `backend/prisma/migrations/20260515180000_add_setting_bounds/migration.sql` — adds `min_value` / `max_value` columns + populates bounds for the three settings (SRS v2.120).

**Idempotency convention (CLAUDE.md Rule 2):** every seed migration uses `INSERT … ON CONFLICT (key) DO NOTHING` so re-running never overwrites admin-tuned production values.

**Cache:** `SettingsService.getInt(key, fallback)` has a 30-second in-memory TTL. Changes via the Settings page are effective on the next `findAll` request once the TTL expires (≤30s).

**Sources:** `backend/prisma/migrations/20260515120000_add_rent_late_fee_settings/migration.sql`, `backend/prisma/migrations/20260515180000_add_setting_bounds/migration.sql`, `backend/src/settings/settings.service.ts`, CLAUDE.md Rule 2.

---

## 13. Audit trail

CLAUDE.md Rule 5: every mutation writes one audit row. Rent collection mutations and their audit shape:

| Endpoint | Action | Entity | entityId | oldData | newData |
|---|---|---|---|---|---|
| `POST /rent/payments` | `CREATE` | `RentPayment` | first row id | `null` | `{ leaseId, selectedPeriod, paymentDate, amountReceived, distribution: AllocationRow[] }` |
| `POST /leases/:id/rent-changes` | `CREATE` | `LeaseRentChange` | new row id | `null` | `{ leaseId, newRent, effectiveDate, previousRent }` |
| `DELETE /leases/:id/rent-changes/:id` (soft-cancel) | `CANCEL` | `LeaseRentChange` | row id | `{ status: Scheduled }` | `{ status: Cancelled }` |
| Cron applies a Scheduled change | `AUTO_APPLY` | `LeaseRentChange` | row id | `{ rentAmount: <old> }` | `{ rentAmount: <new>, leaseId }` **(userId = NULL — SYSTEM)** |
| Cron auto-cancels (lease no longer active) | `CANCEL` | `LeaseRentChange` | row id | `null` | `{ reason: 'lease_not_active_at_apply_time', status: Cancelled }` **(userId = NULL)** |

**Audit body example for a 3-period catch-up:**
```json
{
  "leaseId": 17,
  "selectedPeriod": "2026-03",
  "paymentDate": "2026-06-02",
  "amountReceived": 35000,
  "distribution": [
    { "period": "2026-03", "amount": 5000,  "lateFee": 1500 },
    { "period": "2026-04", "amount": 15000, "lateFee": 600 },
    { "period": "2026-05", "amount": 15000, "lateFee": 0 }
  ]
}
```

One audit row even when the allocator wrote 3 `rent_payments` rows. The `entityId` is the first (parent) row's id; the full split lives in `newData.distribution`.

**Sources:** `backend/src/rent/rent.service.ts:447-466`, `backend/src/leases/rent-changes/rent-changes.service.ts:136-148, 208-217, 278-290`.

---

## 14. Edge cases & gotchas

The list of "we've already paid the tax on this" items — each was a real bug at some point. Every one is covered by a test case (cross-reference in §15).

### 14.1 Day 5 is on-time

`daysAfterDue > graceDays` is **strictly** greater. With `graceDays = 5`, day 5 yields `5 > 5 = false`, so no fee. Day 6 is the first overdue day. Don't write `>=`. (TC-RC-10, TC-RC-11)

### 14.2 Late fee non-compounding

Always against `rent_outstanding` for the period, never against `rent_outstanding + previously_accrued_fee`. Three weeks late on ₹18,000 ⇒ ₹1,080, NOT `18000 × 1.02³ − 18000 ≈ ₹1,102`. (TC-RC-15)

### 14.3 Late fee capped at the period's own month-end

`effective_date = min(paymentDate, period_last_day)`. A payment dated June 2nd against an unpaid January period uses Jan-31 as the cap, not June 2nd. Predictable max: 4 weeks per period ⇒ max 8% of the period's rent_outstanding. (TC-RC-65)

### 14.4 Rent status is NEVER persisted

There is no `lease.status_for_period` column. Every read recomputes it. So a partial paid on day 4 that becomes overdue on day 6 will show `Partial` on day 4 and `Partial Overdue` on day 6 without any update job firing. (Source: `computeRentStatus`.)

### 14.5 Closed leases excluded from active-rent scope

Every rent query hard-codes `status: LeaseStatus.active`. Closed / Expired leases are invisible to `/rent`. To see their payment history, go through `/leases/:id` (which doesn't filter by status).

### 14.6 Soft-delete only — no hard DELETE on payments

There is **no** `DELETE /rent/payments/:id` endpoint. Once a payment is written, it stays. A future "void payment" feature is deferred (§16). If a payment was a mistake, admin can record a compensating entry, or fix it via SQL in the audit-logged way (with an `UPDATE` audit row).

### 14.7 Currency is INR (₹) everywhere

All money in the schema, services, DTOs, prototype, frontend, and PDFs is INR. The `formatCurrency` helpers use `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`. There is **no** USD/$. (User memory feedback.)

### 14.8 PM scope includes past-tenure overlap

`scopeWhere` for a PM unions current-assignments AND past-assignments whose tenure interval overlaps a lease's date range (`tenureOverlapWhere`). So a PM who managed Sunrise Jan–Mar can still see leases that were active during Jan–Mar even after being reassigned. Mutations (`POST /rent/payments`) require **currently** assigned. (TC-RC-77)

### 14.9 Tile stats don't shrink when filters narrow the table

`scopeWhere` (role scope only) drives tile stats; `filterWhere` (scope + UI filters) drives table rows + paginator total. Clicking "Overdue" status pill narrows the table to the 3 overdue leases; the "Total Due" tile still shows ₹745,000 across all 47 active leases. (Rule 24, TC-PA-14, TC-RC-79)

### 14.10 Search is server-side

`useDebouncedValue(search, 300)` debounces 300ms; backend filters via `Prisma.contains`. **Never** re-filter the page slice client-side via `data.filter(name.includes(q))` — that would scatter "John Doe matches" across 3 pages with 1 visible. (Rule 22)

### 14.11 Allocator is oldest-first regardless of selected period

The `Billing Period` dropdown only seeds the default `amount`. The actual allocation always begins at the oldest unsettled period. User picks "May 2026" while Jan is unpaid ⇒ Jan gets the money first. (TC-RC-60)

### 14.12 Period stays in dropdown until BOTH rent AND fee are 0

A period with rent fully paid but late fee unpaid is still unsettled. `feeOwedForPeriodAtTime` freezes the fee at the date of the final rent-clearing payment so the obligation persists. (TC-RC-59)

### 14.13 Mid-month effective_date applies starting the FOLLOWING period

`effective_date = Apr 15` ⇒ April still uses `previousRent`, May uses `newRent`. Comparison is `change.effective_date <= period_first_day`. (TC-RC-84)

### 14.14 Scheduled rent changes are honoured for future periods

The filter is `status != Cancelled` (not `status == Applied`), so a not-yet-applied Scheduled change priced for July correctly bills July's rent at the new rate if you do a forward advance payment for July before the cron applies it. (TC-RC-70)

### 14.15 Cancelled rent changes are excluded from `rentForPeriod`

A change cancelled before applying never re-prices any period — `lease.rentAmount` was never updated by the cron, and `rentForPeriod` filters out Cancelled rows. (TC-RC-82)

### 14.16 Late-fee Settings are snapshotted onto each row

`rent_payments.late_fee_rate_percent` + `late_fee_grace_days` capture the values in effect at write time. Future Settings tweaks never retroactively re-cost a historical payment. The receipt's caption ("Late fee rule at time of payment: 2%/wk capped at month-end") uses the snapshot. (TC-RC-80)

### 14.17 Multi-row write is atomic

The `for` loop over allocation rows + the audit-row write all live inside `prisma.$transaction()`. A DB error mid-loop rolls back every preceding row and the audit. Either all rows + audit exist or none. (TC-RC-76)

### 14.18 Receipts resolve from any sibling row

Pass the id of any row (parent or child) to `GET /rent/payments/:id/receipt` — `resolveTransaction` hops to the parent via `parentId` then fetches all siblings. Receipt is always the same PDF, addressed `#PAY-<parentId>`. (SRS v2.107)

### 14.19 Date-clamped to IST today

The "future date" rejection (`paymentDate > today`) compares ISO strings in Asia/Kolkata, not UTC. Without this fix, IST users between 18:30 IST and midnight UTC (= 5:30am IST next day) couldn't pick "today" because UTC's calendar day lagged. (SRS v2.118)

### 14.20 maxPayable input clamp

Without it, a user could type `₹50,000,000` (typo'd extra zero), see a frontend warning, and still hit Save → backend rejects with 422. The `maxPayable` ceiling is computed by running `simulateDistribution` with `Number.MAX_SAFE_INTEGER` and summing the actually-allocated amount; the input's `max=` + `onChange` clamps to it. (SRS v2.110)

**Sources:** all of `backend/src/rent/rent.service.ts`, `docs/planning/features/2026-05-15-rent-collection-redesign.md` §6, CLAUDE.md Rules 20/22/24.

---

## 15. Test coverage map

From `docs/testing/TEST_CASES.md`. Each TC-ID is a single test row with title / pre-condition / steps / expected.

### 15.1 TC-RC-* (Rent Collection module — 84 cases as of June 2026)

| TC-ID | One-line description |
|---|---|
| TC-RC-01 | Record full payment ⇒ status Paid |
| TC-RC-02 | Partial payment ⇒ status Partially Paid |
| TC-RC-03 | Advance payment ⇒ status Prepaid |
| TC-RC-04 | Payment method dropdown only shows Active methods |
| TC-RC-05 | Reference field appears when refRequired=true (UPI) |
| TC-RC-06 | Same for Bank Transfer (NEFT) |
| TC-RC-07 | Reference hidden for Cash (refRequired=false) |
| TC-RC-08 | Reference field toggles on method change |
| TC-RC-09 | Day 4 unpaid ⇒ Outstanding, no fee |
| TC-RC-10 | **Day 5 = NOT overdue** (5 is not > 5) |
| TC-RC-11 | Day 6 = Overdue |
| TC-RC-12 | First 7 days late ⇒ 0 full weeks ⇒ no fee |
| TC-RC-13 | 1 full week ⇒ fee = 2% × outstanding × 1 |
| TC-RC-14 | 2 full weeks ⇒ × 2 |
| TC-RC-15 | **Late fee is non-compounding** |
| TC-RC-16 | Prepaid detection |
| TC-RC-17 | Rent due date — short-month edge (lease starts 31st, Feb=28) |
| TC-RC-18 | Co-tenants appear as single row in By Lease |
| TC-RC-19 | Co-tenant outstanding balance is shared |
| TC-RC-20 | PM scope: only assigned properties |
| TC-RC-21 | Admin sees Portfolio tab |
| TC-RC-22 | Full payment history per lease |
| TC-RC-23..36 | Record Payment hero cards / live preview / tenant Rent & Payments page |
| TC-RC-37..53 | Receipt endpoint correctness + access matrix + PDF content + frontend buttons |
| TC-RC-56..70 | Period-aware redesign — dropdown contents, allocator oldest-first, overflow, underflow, default amount sum, live distribution, fee cap, prepayment fee=0, grace fee=0, Settings-driven, rent change applied/scheduled |
| TC-RC-71 | paymentDate < leaseStart ⇒ 422 |
| TC-RC-72 | paymentDate in future ⇒ 422 |
| TC-RC-73 | Overflow past leaseEnd ⇒ 422 |
| TC-RC-74 | Server-side fee always recomputed; client value ignored |
| TC-RC-75 | Audit row contains full distribution in newData |
| TC-RC-76 | Multi-row write is atomic |
| TC-RC-77 | PM forbidden when not currently assigned |
| TC-RC-78 | Tenant role cannot record payment |
| TC-RC-79 | `meta.stats` over full filtered set (Rule 20) |
| TC-RC-80 | Settings changes immediately visible to next save |
| TC-RC-81 | Two rent changes across lease — each period at its own era |
| TC-RC-82 | Cancelled rent change excluded from `rentForPeriod` |
| TC-RC-83 | Catch-up payment crossing change boundary |
| TC-RC-84 | Mid-month effective_date applies the following period |

### 15.2 TC-PA-* (Pagination module — touches rent)

- TC-PA-07 — Filter + pagination together (rent endpoint inherits)
- TC-PA-08..13 — Server-side search assertions on all 6 paginated pages including /rent
- TC-PA-14 — Tiles unchanged when filters narrow the table (scopeWhere vs filterWhere snapshot test)

### 15.3 TC-LT-36..* (Lease module rent-touching cases)

- TC-LT-36 — Admin schedules rent change ⇒ 201 + Scheduled row + audit
- TC-LT-37 — Currently-assigned PM schedules rent change
- TC-LT-38 — Past PM cannot schedule rent change ⇒ 403
- TC-LT-39 — Tenant cannot schedule rent change ⇒ 403
- TC-LT-40 — MT cannot schedule rent change ⇒ 403
- (and follow-on cases for cancel + auto-apply via cron)

**Sources:** `docs/testing/TEST_CASES.md` Modules 6 (Rent), 8 (Pagination), 3 (Leases).

---

## 16. Open questions / known TBDs

Items the planning file or SRS explicitly defers:

- **`/rent/export`** — Prototype shows a CSV/PDF Export button on the Rent Collection page; live app has not implemented it. SRS does not yet have a planning file for it.
- **Void / undo payment** — A click-Save can produce 1..N rows. No `transaction_id` column today (the `parent_id` self-ref groups them, but there's no DELETE endpoint). Deferred to v2; for now admin can fix mistakes via SQL with an `UPDATE` audit row.
- **Historical Underpayments panel / Mark-as-Historical / Write-off / Final Settle button** — User explicitly excluded these in 2026-05-15 sign-off ("No Separate Button for settle. no final settle write-off for now."). Will be a separate planning file when the time comes.
- **Multi-month historical trend** on the admin Portfolio tab — currently a stub ("Historical month trend data will be available once the analytics endpoint is implemented").
- **Receipt batch download** — no endpoint exists for downloading a zip of multiple receipts. Each receipt is requested individually.
- **Email notifications on overdue / rent change** — FR-LT-16 mandates in-app banner for rent change; no email currently sent for either. Deferred.
- **Frequency other than monthly** — explicitly out of scope.
- **Stats: "Collected this month" vs "lifetime collected"** — `meta.stats.totalPaid` is `lifetimePaid` summed across leases; admin tile label says "Collected" but it's cumulative, not month-bounded. Documented quirk; would need a `collectedThisMonth` stat to fix.

**Sources:** `docs/planning/features/2026-05-15-rent-collection-redesign.md` §2.10, `docs/product/SRS.md` §14 changelog.

---

## 17. File index (where to look in the repo)

Repo-relative paths only (CLAUDE.md Rule 30).

### 17.1 Specification + planning

- `docs/product/SRS.md` (§5.6 Rent Collection, §8 Page Specifications, §14 Change Log v2.84–v2.130)
- `docs/product/CHANGELOG.md` (condensed user-visible summary)
- `docs/planning/features/2026-05-15-rent-collection-redesign.md` (period-aware redesign — the source of truth for behaviour)
- `docs/testing/TEST_CASES.md` (Module 6 Rent: TC-RC-01..84; Module 8 Pagination: TC-PA-*; Module 3 Leases: TC-LT-*)

### 17.2 Prototype

- `prototype/admin/rent-collection.html` — admin listing page (Portfolio tab + 4-KPI tiles + By Lease/By Building/Portfolio tabs + filter bar)
- `prototype/admin/record-payment.html` — admin Record Payment form (the `PAYMENT_METHODS` array, `OVERDUE_DAYS`, `LATE_FEE_RATE` constants live here at lines 430–571)
- `prototype/pm/rent-collection.html` — PM listing page (no Portfolio tab; sky-blue accent `#0EA5E9`)
- `prototype/pm/record-payment.html` — PM Record Payment form (parallel to admin's; lacks Orchid Heights leases by design)
- `prototype/tenant/payments.html` — tenant Rent & Payments page (cumulative tiles + per-lease Current Month cards + merged Payment History)
- `prototype/tenant/dashboard.html` — tenant dashboard with per-lease cards showing rent + outstanding

### 17.3 Backend

```
backend/prisma/schema.prisma                       — Lease, RentPayment, LeaseRentChange, PaymentMethod, Setting, AuditLog
backend/prisma/migrations/
  20260514163005_seed_default_settings/             — rent_change_effective_offset_min_days
  20260515120000_add_rent_late_fee_settings/        — late_fee_rate_percent + late_fee_grace_days
  20260515140000_add_late_fee_snapshot_to_rent_payments/   — snapshot columns on rent_payments
  20260515160000_add_parent_id_to_rent_payments/    — transaction grouping
  20260515180000_add_setting_bounds/                — min/max bounds for the 3 settings
backend/src/rent/
  rent.module.ts                                    — imports SettingsModule + LeasesModule
  rent.controller.ts                                — 4 endpoints (GET /rent, POST /rent/payments, GET history, GET receipt)
  rent.service.ts                                   — findAll, createPayment, allocate, computeRentStatus,
                                                       rentForPeriod, computeFeeForPeriod, feeOwedForPeriodAtTime,
                                                       buildUnsettledPeriods, getLeasePaymentHistory
  rent.service.spec.ts                              — 22 unit tests covering allocator + late-fee maths
  receipt.service.ts                                — pdfkit-based PDF generation + access gate + transaction resolution
  dto/find-rent-query.dto.ts                        — paginated listing query
  dto/create-payment.dto.ts                         — POST body (NO lateFee field — backend authoritative)
backend/src/leases/rent-changes/
  rent-changes.controller.ts                        — GET / POST / DELETE /leases/:id/rent-changes/:id?
  rent-changes.service.ts                           — create / list / cancel / applyOne / applyDueForLease / applyAllDue
  rent-changes.cron.ts                              — Cron('5 0 * * *') daily apply
  dto/create-rent-change.dto.ts                     — newRent + effectiveDate + notes
backend/src/common/helpers/
  pm-tenure.helper.ts                               — getPmTenureIntervals / tenureOverlapWhere / isCurrentlyAssigned
  pm-scope.helper.ts                                — getAssignedPropertyIds
  dates.helper.ts                                   — todayCalendarISO, dateToCalendarISO (IST-aware)
  pagination.helper.ts                              — resolvePagination, paginateMeta, shouldPaginate
backend/src/settings/
  settings.service.ts                               — getInt(key, fallback) with 30s TTL
```

### 17.4 Frontend

```
frontend/src/app/(portal)/rent/page.tsx             — admin/PM route; tenant redirected to /payments
frontend/src/app/(portal)/rent/record/page.tsx      — Record Payment route (admin/PM only)
frontend/src/app/(portal)/payments/page.tsx         — Tenant Rent & Payments route
frontend/src/components/features/rent/
  RentPage.tsx                                      — admin/PM listing (4 tiles + 3 tabs + table + filters)
  RecordPaymentPage.tsx                             — the full Record Payment form (hero + 3 sections + live preview + sticky summary + history)
  PaymentsPage.tsx                                  — tenant Rent & Payments
frontend/src/lib/api/
  rent.ts                                           — rentApi.list / recordPayment / getHistory / downloadReceipt / viewReceipt
  settings.ts                                       — settingsApi.list, readIntSetting
frontend/src/lib/hooks/
  useDebouncedValue.ts                              — 300ms debounce for search box
frontend/src/lib/types/
  pagination.ts                                     — PaginationMeta, PAGE_SIZE_DEFAULT
frontend/src/components/ui/
  SearchableDropdown.tsx                            — used for lease picker + period dropdown (Rule 23)
  StatusBadge.tsx                                   — Paid / Partial / Outstanding / Overdue / Prepaid pill
  Pagination.tsx                                    — auto-hides at totalPages=1
```

### 17.5 Cross-cutting rules (CLAUDE.md sections that govern rent collection)

- Rule 1 — Frontend Zod must mirror backend DTO validation (mirrored 6 server validations on Record Payment)
- Rule 2 — Tunable rules go in Settings (late-fee rate + grace + lead-time live there)
- Rule 5 — Every mutation writes an audit row (POST /rent/payments + rent-change CRUD)
- Rule 13 — DB conventions (snake_case columns, no FK constraints, `@@index` on every FK-equivalent)
- Rule 19 — Table layout (`<table className="w-full table-fixed">` + explicit column widths on all rent tables)
- Rule 20 — Tile stats over unpaginated query (`meta.stats` populated from full filtered set)
- Rule 21 — One DTO per paginated endpoint (`FindRentQueryDto extends PaginationQueryDto`)
- Rule 22 — Server-side search (300ms debounce, Prisma contains across 3 fields)
- Rule 23 — Property dropdowns are SearchableDropdown (also: lease picker on Record Payment)
- Rule 24 — `scopeWhere` vs `filterWhere` split (tile stats from scope, table from scope + filters)

---

## 18. Glossary

| Term | Definition |
|---|---|
| **Admin** | User role 1 (numeric). Full system access. Sees Portfolio tab. |
| **Allocation row** | One DB row in `rent_payments`. A single Save can produce N. |
| **Allocator** | The oldest-first cash-distribution loop in `RentService.allocate()`. |
| **Asof date** | The moment the late-fee meter is "frozen" against — usually the payment date. |
| **Audit row** | Insert into `audit_log`. Every mutation writes exactly one. |
| **Billing period** | A specific `(year, month)` a payment is recorded against. |
| **By Lease tab** | Default tab on Rent Collection — one row per active lease. |
| **By Building tab** | Groups page rows into properties + per-property totals. |
| **Catch-up payment** | A single payment that settles multiple arrears periods. |
| **Co-tenant** | Additional `LeaseTenant` rows on a lease (non-primary). All share outstanding. |
| **DTO** | Data Transfer Object — NestJS class with class-validator decorators. |
| **Effective date** | (1) On a rent change: when `newRent` takes effect. (2) Inside the fee formula: `min(paymentDate, period_last_day)`. |
| **Filter where** | Scope where + UI filters (search, status, etc.). Drives the table set. |
| **FK** | Foreign Key. This codebase has none at the DB level (`relationMode = "prisma"`). |
| **Grace days** | Settings `late_fee_grace_days`, default 5. Days after due before fee starts accruing. |
| **JWT** | JSON Web Token. Auth cookie name = `access_token`, httpOnly. |
| **KPI tile** | The 4 top-of-page cards on every rent listing (Total Due, Collected, Outstanding, Overdue). |
| **Lease tenure** | A PM's `assignedAt`..`unassignedAt` window on a property. Multiple windows possible. |
| **maxPayable** | The rupee ceiling for a single Save = sum of allocatable cash up to lease end. |
| **MT** | Maintenance Team (user role 4). No rent visibility. |
| **Outstanding** | `rentForPeriod − sum(amount for this period)`, floored at 0. |
| **Overdue** | A period with `outstanding > 0 AND daysAfterDue > grace_days`. |
| **Paid** | A period with `outstanding ≤ 0`. |
| **Parent row** | The first row written by a single Save. `parent_id = NULL`. |
| **Partial** | Within grace, `0 < totalPaid < rentForPeriod`. |
| **Partial Overdue** | Past grace, `0 < totalPaid < rentForPeriod`. |
| **Payment method** | Cash / UPI / Cheque / NEFT / RTGS / IMPS / DD. Master entity. |
| **PM** | Property Manager (user role 2). Scoped to assigned properties + past-tenure. |
| **Prepaid** | A period where `totalPaid > rentForPeriod` (advance credit). |
| **Receipt** | PDF stream at `GET /rent/payments/:id/receipt`. Addressed `#PAY-NNNN`. |
| **Reference number** | Free-text UTR / cheque number / transaction id. Required when `paymentMethod.refRequired`. |
| **Rent change** | Scheduled or applied delta to `lease.rentAmount`. |
| **Rent due day** | `lease.rentDueDay` 1..31. Clamped to month length. |
| **Rent for period** | Walks rent-change history to find the rent in effect for a given period's first day. |
| **`rent_payments`** | The DB table that holds money-in rows. snake_case in SQL, `RentPayment` in Prisma. |
| **Scope where** | Role-based access clause only (no UI filters). Drives tile stats. |
| **Settings table** | Generic key-value config table. Stores `late_fee_rate_percent`, `late_fee_grace_days`, etc. |
| **SearchableDropdown** | Shared frontend component for typeahead-search dropdowns. Used for lease + period pickers. |
| **Snapshot columns** | `rent_payments.late_fee_rate_percent` + `.late_fee_grace_days`. Frozen at write time. |
| **SRS** | Software Requirements Specification — `docs/product/SRS.md`. Authoritative spec + changelog. |
| **System actor** | Audit row with `userId = NULL` — written by cron jobs / lazy auto-apply. |
| **TC-RC-NN** | Test case ID under Module 6 (Rent Collection) in `docs/testing/TEST_CASES.md`. |
| **Tenant** | User role 3. Sees only their own leases. Cannot record payments. |
| **Tenure interval** | A `{from, to}` window during which a PM was assigned to a property. |
| **Today (IST)** | `Asia/Kolkata` calendar day. Backend uses `todayCalendarISO()` for paymentDate guards. |
| **Transaction (rent)** | All `rent_payments` rows from one click-Save, grouped via `parent_id`. |
| **Unsettled period** | A period where `rentOutstanding > 0 OR feeOutstanding > 0`. |

---

**End of Reference Document.**

This document was produced 2026-06-02 by reading the production codebase at branch `main` of `property_rental_management`. For deep-dive on any topic, the file paths in §17 carry the live source of truth.
