# GharSetu — Phase 8 Bug List
**Date:** 2026-05-11
**Run:** Phase 8 Pre-Release Regression Sweep

---

## BUG-008-001 (P0) — addMonthMinusOneDay overflows on 29/30/31-day starts

**TC:** TC-RENT-012
**BL ref:** SRS §4 Module 5 — "If start = 31st and month has no 31st, use last day of that month."
**Severity:** P0 — financial data integrity. Wrong period boundaries produce wrong overdue dates and wrong late-fee accrual.
**Affected role:** All (period dates affect all users on the lease).
**Component:** `apps/api/src/rent/rent.service.ts:834` — `addMonthMinusOneDay()`

**Root cause:**
```ts
private addMonthMinusOneDay(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);  // Jan 31 → Feb 31 → JS overflows to Mar 3
  d.setDate(d.getDate() - 1);    // Mar 3 - 1 = Mar 2  (WRONG)
  return d;
}
```
For a lease starting Jan 31:
- `setMonth(+1)` on Jan 31 → JavaScript overflows to March 3 (Feb has no 31st)
- `setDate(-1)` on March 3 → March 2

**Expected:** period_end = 2026-02-28 (last day of Feb)
**Actual:** period_end = 2026-03-02 (two days into March)

**Fix direction (for backend — do not implement here):**
Use `setDate(0)` on a date set to the next month's 1st:
```ts
private addMonthMinusOneDay(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 2, 0));
  return d; // setDate(0) = last day of previous month
}
```
Or equivalently: set day to 1, advance month by 1, set day to 0.

**Failing regression test:** `apps/api/test/phase8-gaps.spec.ts` — "TC-RENT-012: lease starting 2026-01-31 → first period_start = 2026-01-31"
**Repro steps:**
1. POST `/api/v1/properties/:id/units/:id/leases` with `startDate: "2026-01-31"`
2. Query the resulting rent_period — `period_end.toISOString()` returns `"2026-03-02"` instead of `"2026-02-28"`

**Status:** Open. Do NOT fix in this PR. Hand to `gharsetu-backend`.

---

## BUG-008-002 (P1) — Lease creation accepts endDate < startDate

**TC:** TC-NEG-001
**BL ref:** SRS §4 Module 3 — lease record: start date, end date. No explicit BL but basic date integrity.
**Severity:** P1 — data integrity. A lease with end before start is logically invalid; it will produce negative-duration rent periods and confuse the overdue/accrual logic.
**Affected role:** PM (creates leases).
**Component:** `apps/api/src/leases/dto/create-lease.dto.ts` + `apps/api/src/leases/leases.service.ts`

**Root cause:** The `CreateLeaseDto` validates that `startDate` and `endDate` match YYYY-MM-DD format but does NOT validate that `endDate >= startDate`. The service also has no such check before calling `prisma.lease.create()`.

**Expected:** POST with `startDate: "2026-06-01"`, `endDate: "2025-01-01"` → 400 or 422
**Actual:** 201 — lease created with `start_date > end_date`

**Failing regression test:** `apps/api/test/phase8-gaps.spec.ts` — "TC-NEG-001: endDate 2025-01-01 before startDate 2026-06-01 → 400 or 422"

**Fix direction (for backend — do not implement here):**
Add a cross-field validator to `CreateLeaseDto`:
```ts
@ValidateIf(o => o.startDate && o.endDate)
@IsDateString()
endDate!: string;
// + custom validator or @IsAfterDate('startDate') or service-level check
```
Or add an early guard in `leases.service.ts`:
```ts
if (new Date(dto.endDate) <= new Date(dto.startDate)) {
  throw new CodeError('INVALID_DATE_RANGE', 'endDate must be after startDate', 422);
}
```

**Status:** Open. Do NOT fix in this PR. Hand to `gharsetu-backend`.

---

## BUG-008-003 (P2) — color-contrast WCAG violation on all pages (placeholder text)

**TC:** TC-VIS-006 (WCAG AA contrast)
**BL ref:** SRS §10.5 "Accessibility target: WCAG AA on all text contrast"
**Severity:** P2 — accessibility regression. All pages fail axe `color-contrast` (SERIOUS) at all viewports.
**Affected role:** All (login page and all role-gated pages that redirect to login).
**Component:** `apps/web/src/app/globals.css` or browser default placeholder styling

**Root cause:** The `input` elements use browser-default placeholder text color (~`#a9a9a9` on Chrome) which is approximately 2.3:1 contrast ratio on white (`#FFFFFF`) background — below WCAG AA minimum of 4.5:1 for normal text (WCAG 2.1 §1.4.3 also applies to placeholder text per WCAG 2.2 §1.4.3 update). axe correctly flags this as SERIOUS.

The violation is consistent across 12 tests: `/login` at 3 viewports, tenant pages (4), maintenance pages (3), and the skip-to-main structural check.

**Expected:** 0 serious/critical violations on `/login` and all role pages.
**Actual:** 1 serious `color-contrast` violation on every page tested (12/13 tests fail).

**Repro:**
1. Start web server (`pnpm --filter @gharsetu/web start`)
2. Navigate to `/login`
3. Run axe scan → `color-contrast` SERIOUS on placeholder text in email/password inputs

**Fix direction (for frontend — do not implement here):**
Add explicit placeholder color with sufficient contrast in `globals.css`:
```css
.input::placeholder {
  color: #546E7A; /* text-slate — 5.15:1 on white, passes WCAG AA */
}
```
Or use Tailwind's `placeholder-slate` class on input elements.

**Failing regression tests:** `apps/web/e2e/a11y.spec.ts` — 12 tests all failing with `[SERIOUS] color-contrast`

**Status:** Open. Do NOT fix in this PR. Hand to `gharsetu-frontend`.

---

## BUG-008-004 (P1, carried from Phase 7) — formatDateIST renders midnight as "24:00"

**TC:** TC-VIS-001 (partially), TC-MAIN-015 (IST display)
**BL ref:** BL-22 — all times in Asia/Kolkata
**Severity:** P1 — display bug on all audit-log, maintenance, and rent timestamps that fall exactly at IST midnight (UTC 18:30).
**Component:** `apps/web/src/lib/locale/index.ts` — `formatDateIST()`
**Status:** Open from Phase 7 (BUG-BL22-001). Failing regression tests already written.
**Defer to:** `gharsetu-frontend`.

---

## DEFER-TO-VAPT-001 — No rate-limit header exposed on 429 responses

**Context:** During E2E run, observed that `429 RATE_LIMIT_EXCEEDED` responses do not include `Retry-After` header. This is a hardening gap relevant to VAPT's rate-limit assessment. Not filed as a functional bug — defer to `gharsetu-security` VAPT review.

---

## Summary

| Bug ID | TC | Severity | Component | Status |
|---|---|---|---|---|
| BUG-008-001 | TC-RENT-012 | **P0** | `rent.service.ts:834` `addMonthMinusOneDay` | Open |
| BUG-008-002 | TC-NEG-001 | **P1** | `create-lease.dto.ts` / `leases.service.ts` | Open |
| BUG-008-003 | TC-VIS-006 | **P2** | `globals.css` placeholder contrast | Open |
| BUG-008-004 | TC-MAIN-015/TC-VIS-001 | **P1** (Phase 7 carry) | `locale/index.ts` `formatDateIST` | Open |
| DEFER-TO-VAPT-001 | — | — | Throttler `Retry-After` header | VAPT |
