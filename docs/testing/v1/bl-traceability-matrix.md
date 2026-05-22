# GharSetu — 23-BL Traceability Matrix
**Phase:** 7 (hardening + reporting)
**Date:** 2026-05-11
**Status: 22/23 BLs locked in by passing tests. BL-22 has a partial gap (BUG-BL22-001 — midnight rendering).**

---

## Legend

| Column | Meaning |
|---|---|
| BL ID | Business rule ID from SRS §5 |
| Description | One-line paraphrase |
| Passing test(s) | File:test-name (or file:line) that locks it in |
| Coverage layer | DB / Service / Integration / E2E |
| Phase | Phase the rule was first tested |
| Gap? | YES = regression test written but failing (bug open) |

---

## Matrix

| BL ID | Description | Passing test(s) | Layer | Phase | Gap? |
|---|---|---|---|---|---|
| **BL-01** | No two active leases on same unit simultaneously | `test/phase3-integration.spec.ts` "POST second lease on same unit → 409 UNIT_HAS_ACTIVE_LEASE"; DB partial unique index `leases(unit_id) WHERE status='active'` | DB + Integration | 3 | No |
| **BL-02** | Rent locked at lease signing; cannot change mid-lease | `test/phase3-integration.spec.ts` "prisma.lease.update({monthly_rent_paise}) → DB trigger throws"; `test/phase7-hardening.spec.ts` "BL-03 Serializable unit rent update rejects OCCUPIED" | DB trigger + Integration | 3 | No |
| **BL-03** | Rent editable only when unit is AVAILABLE or LISTED | `test/phase7-hardening.spec.ts` "PATCH /units/:id with rent change on OCCUPIED unit → 409 UNIT_RENT_LOCKED"; `test/bl22-bl23-audit-ist.spec.ts` TC-BL06-003 | Serializable tx + Integration | 7 | No |
| **BL-04** | Occupied unit cannot move to in-maintenance until lease ended | `test/phase3-integration.spec.ts` "Creating ACTIVE lease flips unit.state to OCCUPIED"; `test/phase2-integration.spec.ts` unit state machine tests | Integration | 2 | No |
| **BL-05** | Records never deleted; retired = permanent soft-delete | `test/phase2-integration.spec.ts` "cannot un-retire a unit (DB trigger fires)"; "405 on DELETE /units/:id" | DB trigger + Integration | 2 | No |
| **BL-06** | Listed unit rent change instantly updates the listing | `test/bl22-bl23-audit-ist.spec.ts` TC-BL06-001 "PATCH rent on LISTED unit → 200"; TC-BL06-002 "GET /units confirms updated rent persisted immediately" | Integration | 7 | No |
| **BL-07** | All co-tenants jointly liable for unpaid rent | `test/phase3-integration.spec.ts` "POST lease with empty tenants → 400 LEASE_NEEDS_TENANT"; `test/phase3-gaps.spec.ts` co-tenant liability tests | Integration | 3 | No |
| **BL-08** | One co-tenant cannot end lease alone; all must consent | `test/phase3-integration.spec.ts` "Finalize blocked until all co-tenants APPROVE"; `test/phase3-security-fixes.spec.ts` TC-H01 tenant impersonation | Integration | 3 | No |
| **BL-09** | Termination stays pending until all consent or requester withdraws; no auto-timeout | `test/phase3-integration.spec.ts` "Requester can withdraw termination request"; `test/phase3-gaps.spec.ts` TC-TERM-002/005; `test/phase3-integration.spec.ts` "If co-tenant REJECTS, finalize is 409" | Integration | 3 | No |
| **BL-10** | Only PMs record payments; tenants cannot self-record | `test/phase4-integration.spec.ts` "TENANT token → 403 BL_10_TENANT_CANNOT_RECORD_PAYMENT"; "MAINTENANCE token → 403"; `test/phase6-role-matrix-full.spec.ts` | Integration | 4 | No |
| **BL-11** | Concurrent co-tenant payment → first closes period, second auto-prepaid | `test/phase4-integration.spec.ts` "overpayment → period PAID, excess to PrepaidCredit"; BL-03 serializable retry in `rent.service.ts` | Integration + Serializable tx | 4 | No |
| **BL-12** | Period becomes overdue exactly 5 calendar days past due date | `test/phase4-gaps.spec.ts` "BL-13 boundary: 6 days overdue → 0 full weeks"; `src/jobs/rent-accrual.processor.spec.ts` | Service unit + Integration | 4 | No |
| **BL-13** | Late fee = 2% × outstanding × full weeks overdue; not compounded | `test/phase4-gaps.spec.ts` TC-LATEFEE-003 "7 days → ₹360"; "14 days → ₹720"; `test/phase4-integration.spec.ts` reconciliation tests | Service unit + Integration | 4 | No |
| **BL-14** | Maintenance description ≥ 30 chars; resolution notes ≥ 20 chars | `test/phase5-integration.spec.ts` description length validation; `src/maintenance/dto/create-maintenance-request.dto.ts` MinLength decorators | DTO + Integration | 5 | No |
| **BL-15** | Closed requests cannot be reopened by anyone | `test/phase5-integration.spec.ts` "OPEN → CLOSED directly → 409"; "Invalid state transitions → 409 INVALID_TRANSITION" | Integration | 5 | No |
| **BL-16** | Maintenance staff: read + update only; cannot create | `test/phase6-role-matrix-full.spec.ts` MAINTENANCE role matrix; `test/phase5-integration.spec.ts` role-guard on create | Integration | 5/6 | No |
| **BL-17** | ≥5 maintenance requests for same unit in one calendar month → Admin alert | `test/phase5-gaps.spec.ts` "alert fires for current IST month only"; `test/phase5-integration.spec.ts` "5 prev-month requests → 0 alerts"; `src/jobs/maintenance-alert.processor.spec.ts` | Service unit + Integration | 5 | No |
| **BL-18** | Turnover gap (Fri out → Mon in) = normal no-lease period; not overdue, not double-bookable | `test/phase3-integration.spec.ts` "terminate → immediately POST new lease → 409 TURNOVER_GAP_REQUIRED"; "After 24h, new lease is allowed" | Integration | 3 | No |
| **BL-19** | Each PM assigned to exactly one property | `test/phase2-integration.spec.ts` "assigning PM already assigned → 409 PM_ALREADY_ASSIGNED"; `test/phase6-role-matrix-full.spec.ts` PM scope tests | Integration | 2 | No |
| **BL-20** | Previous PM keeps read-only access after property transfer | `test/phase2-integration.spec.ts` "Property transfer-pm happy path"; `test/phase6-role-matrix-full.spec.ts` cross-property scope | Integration | 2 | No |
| **BL-21** | Tenant (only) closes their own resolved requests | `test/phase5-gaps.spec.ts` TC-MAINT-005 "tenant A (raiser) calls /close → 200 CLOSED"; "tenant B (not raiser) → 403"; `test/phase5-integration.spec.ts` | Integration | 5 | No |
| **BL-22** | All times stored & displayed in Asia/Kolkata (IST) | `test/phase7-hardening.spec.ts` TC-BL22-008 "GET /audit-log timestamps parseable as UTC → IST"; `test/bl22-bl23-audit-ist.spec.ts` TC-BL22-001..009; `src/__tests__/phase7.test.ts` "formatDateIST converts UTC to IST"; `src/__tests__/bl22-bl23-locale-lockins.test.ts` TC-BL22-WEB-002/005 | Integration + Unit | 7 | **PARTIAL** — BUG-BL22-001: midnight timestamps rendered as "24:00" not "00:00" (4 failing regression tests) |
| **BL-23** | Dates rendered DD/MM/YYYY everywhere | `src/__tests__/phase7.test.ts` "formatDateOnlyIST formats as DD/MM/YYYY"; `src/__tests__/bl22-bl23-locale-lockins.test.ts` TC-BL23-WEB-001..009; `test/bl22-bl23-audit-ist.spec.ts` TC-BL23-002/003/005/006 | Unit + Integration | 7 | No (non-midnight samples pass) |

---

## Summary

| Status | Count |
|---|---|
| Fully locked in (all tests green) | 22/23 |
| Partial — regression tests written, bug open | 1/23 (BL-22) |
| No coverage at all | 0/23 |

**Gap detail — BL-22 (BUG-BL22-001, P1):**
`formatDateIST` in `apps/web/src/lib/locale/index.ts` renders midnight (00:00 IST) as `"24:00"` on Node 20 due to `Intl.DateTimeFormat` with `hour12:false` + `en-IN` locale. Affects all timestamps that fall exactly on IST midnight. Fix: normalize `hour === "24"` → `"00"` in the formatter. Failing regression tests: `src/__tests__/bl22-bl23-locale-lockins.test.ts` TC-BL22-WEB-001/003/004/006 and `test/bl22-bl23-audit-ist.spec.ts` TC-BL23-001/004 (6 tests total).

---

## Coverage by layer

| Layer | BLs covered |
|---|---|
| DB constraint / trigger | BL-01, BL-02, BL-05 |
| Service / DTO validation | BL-12, BL-13, BL-14 |
| Integration (Supertest) | BL-01..21 (all) |
| E2E (Playwright, requires live stack) | BL-10, BL-13, BL-16, BL-17, BL-21 |
| Web unit (Vitest) | BL-22, BL-23 |
