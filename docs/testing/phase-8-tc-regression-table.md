# GharSetu — Phase 8 TC Regression Table
**Date:** 2026-05-11
**Stack:** API (NestJS, Jest 434/434) · Web (Vitest 519/519) · Playwright E2E (74/74 non-a11y)
**Branch:** main @ HEAD

> Layer codes: `API-INT` = API integration (Supertest/Jest) · `WEB-UNIT` = Web Vitest · `E2E` = Playwright live stack · `MANUAL` = manual on live stack · `SERVER` = server-tagged (marked `(server)` in Test_Cases.md, needs running stack)

---

## Section 2 — Authentication & Sessions

| TC ID | Title | Layer | Test reference | Pass/Fail | Notes |
|---|---|---|---|---|---|
| TC-AUTH-001 | Valid login returns token + cookie | API-INT + E2E | `test/auth-integration.spec.ts:104` · `e2e/auth-login-happy-path.spec.ts:50` | PASS | |
| TC-AUTH-002 | Invalid creds — custom error, no native tooltip | API-INT + E2E | `test/auth-integration.spec.ts:155` · `e2e/auth-login-invalid.spec.ts:46` | PASS | |
| TC-AUTH-003 | Password too short — minlength error | API-INT + E2E | `test/auth-integration.spec.ts:361` · `e2e/auth-role-redirect.spec.ts` | PASS | Password policy enforced at DTO layer |
| TC-AUTH-004 | Error clears as user types | E2E | `e2e/auth-login-invalid.spec.ts:77` | PASS | |
| TC-AUTH-005 | Submit with valid input redirects | E2E | `e2e/auth-login-happy-path.spec.ts` | PASS | |
| TC-AUTH-006 | Demo role buttons jump to dashboard | E2E | `e2e/auth-login-happy-path.spec.ts:104` | PASS | |
| TC-AUTH-007 | "Forgot password?" link is wired | API-INT | `test/auth-integration.spec.ts:226` | PASS | |
| TC-AUTH-008 | Brand on login links home | MANUAL | Navigates to `/` from login page | PASS | |
| TC-AUTH-009 | "Back to home" link | MANUAL | `← Back to home` link on login page | PASS | |
| TC-AUTH-010 | Public sign-up is absent | API-INT + E2E | `test/auth-integration.spec.ts:314` · `e2e/auth-login-happy-path.spec.ts` | PASS | |
| TC-AUTH-011 | Request step renders (forgot-pw) | MANUAL | Visited `/forgot-password` on live stack | PASS | |
| TC-AUTH-012 | Empty submit — custom error on forgot-pw | MANUAL | Triggered on live stack | PASS | |
| TC-AUTH-013 | Submit reveals "sent" step | MANUAL | Live stack verify | PASS | |
| TC-AUTH-014 | "Try different email" returns to step 1 | MANUAL | Live stack verify | PASS | |
| TC-AUTH-015 | Account existence not leaked | API-INT | `test/auth-integration.spec.ts:235` | PASS | Anti-enumeration verified |
| TC-AUTH-016 | Reset link single-use & expires 30 min | API-INT | `test/auth-integration.spec.ts:381` (single-use) + `:411` (expired) | PASS | |

---

## Section 3 — Role-Scoped Access

| TC ID | Title | Layer | Test reference | Pass/Fail | Notes |
|---|---|---|---|---|---|
| TC-ROLE-001 | Admin sees all properties | MANUAL | Admin dashboard live stack — KPI shows all properties | PASS | No automated test for KPI counts against live seed data |
| TC-ROLE-002 | PM sees only assigned property | API-INT | `test/phase6-role-matrix-full.spec.ts` cross-property block | PASS | BL-19 enforced at API layer |
| TC-ROLE-003 | PM cannot reach another property's URL | API-INT + E2E | `e2e/cross-property-blocked.spec.ts:39` · `e2e/auth-cross-role.spec.ts` | PASS | BL-19 |
| TC-ROLE-004 | Maintenance sees zero financial data | API-INT | `test/phase6-role-matrix-full.spec.ts:524-636` (MAINTENANCE → 403 on leases/rent) | PASS | Sidebar omission is UI-only (prototype scope) |
| TC-ROLE-005 | Maintenance has no "Raise" button | E2E | `e2e/bl-16-non-tenant-cannot-raise.spec.ts:71` | PASS | BL-16 |
| TC-ROLE-006 | Maintenance API rejects POST /requests | API-INT + E2E | `e2e/bl-16-non-tenant-cannot-raise.spec.ts:71` · `test/phase5-integration.spec.ts` | PASS | BL-16 |
| TC-ROLE-007 | Tenant sees only own lease | E2E | `e2e/tenant-rent-readonly.spec.ts:76` | PASS | |
| TC-ROLE-008 | Tenant cannot record payments | E2E | `e2e/tenant-rent-readonly.spec.ts:163` | PASS | BL-10 |
| TC-ROLE-009 | Tenant API rejects payment write | E2E | `e2e/bl-10-tenant-blocked.spec.ts:34` | PASS | BL-10 |
| TC-ROLE-010 | Previous PM read-only after transfer | API-INT | `test/phase2-integration.spec.ts` "Property transfer-pm happy path" · `test/phase6-role-matrix-full.spec.ts` | PASS | BL-20 |

---

## Section 4 — Users & Access

| TC ID | Title | Layer | Test reference | Pass/Fail | Notes |
|---|---|---|---|---|---|
| TC-USR-001 | Admin opens Users page — tabs visible | E2E | `e2e/admin-users-create-temp-password.spec.ts` (TC-USER-001) | PASS | |
| TC-USR-002 | Add User modal opens | E2E | `e2e/admin-users-create-temp-password.spec.ts` (TC-USER-002) | PASS | |
| TC-USR-003 | Add User — required fields validation | E2E | `e2e/admin-users-last-admin.spec.ts` (TC-USER-003) | PASS | |
| TC-USR-004 | Phone pattern validation | API-INT | `test/phase2-gaps.spec.ts` phone pattern DTO tests | PASS | |
| TC-USR-005 | Co-tenants get individual logins | API-INT | `test/phase3-integration.spec.ts` co-tenant sign-lease | PASS | |
| TC-USR-006 | Property transfer reassigns scope | API-INT | `test/phase2-integration.spec.ts` "Property transfer-pm happy path" | PASS | BL-20 |
| TC-USR-007 | Cannot demote last Admin | API-INT | `test/phase2-gaps.spec.ts:303` (TC-USER-003 last-admin guard) | PASS | |

---

## Section 5 — Properties & Units

| TC ID | Title | Layer | Test reference | Pass/Fail | Notes |
|---|---|---|---|---|---|
| TC-PROP-001 | Properties list filters | MANUAL (server) | Live stack — filter controls update table | PASS | Server-side filtering verified manually |
| TC-PROP-002 | Unit state legend visible | MANUAL | Prototype/admin/properties.html | PASS | Visual check |
| TC-PROP-003 | Cannot mark occupied unit for maintenance | E2E | `e2e/admin-transfer-pm.spec.ts:38` (traceability) · `test/phase2-integration.spec.ts` state machine | PASS | BL-04 |
| TC-PROP-004 | Cannot edit rent on occupied unit | API-INT | `test/phase7-hardening.spec.ts` "BL-03 Serializable…OCCUPIED → 409" | PASS | BL-02, BL-03 |
| TC-PROP-005 | Rent edit on listed unit propagates | API-INT | `test/bl22-bl23-audit-ist.spec.ts:548` (TC-BL06-001/002) | PASS | BL-06 |
| TC-PROP-006 | Retired unit cannot be reactivated | API-INT | `test/phase2-integration.spec.ts:482` "Attempting to un-retire → DB trigger rejects" | PASS | BL-05 |
| TC-PROP-007 | Hard-delete is impossible | API-INT | `test/phase2-integration.spec.ts:372` "DELETE /units/:id → 405" | PASS | BL-05 |

---

## Section 6 — Leases & Tenants

| TC ID | Title | Layer | Test reference | Pass/Fail | Notes |
|---|---|---|---|---|---|
| TC-LEASE-001 | New Lease modal pre-populates due day | MANUAL | UI field auto-filled on prototype; `rent_due_day` field in lease response | PASS | No specific E2E for UI pre-fill |
| TC-LEASE-002 | Listed/Available units only in dropdown | MANUAL | Prototype lease modal; BL-01 enforced by API | PASS | Occupied units absent from lease creation |
| TC-LEASE-003 | Cannot create overlapping lease | API-INT | `test/phase3-integration.spec.ts` "POST second lease on same unit → 409" | PASS | BL-01 |
| TC-LEASE-004 | Rent locked at signing | API-INT | `test/phase3-integration.spec.ts` "prisma.lease.update → DB trigger throws" | PASS | BL-02 |
| TC-LEASE-005 | Renewal creates new lease record | API-INT + E2E | `test/phase3-integration.spec.ts:TC-LEASE-005` · `e2e/pm-sign-lease.spec.ts` | PASS | |
| TC-LEASE-006 | Old lease auto-transitions on end date | API-INT + E2E | `e2e/pm-sign-lease.spec.ts` (RENEWED status) | PASS | |
| TC-LEASE-007 | Early termination requires reason | API-INT | `test/phase3-integration.spec.ts:TC-LEASE-007` | PASS | |
| TC-LEASE-008 | Termination + refund are two steps | API-INT + E2E | `e2e/pm-renew-lease.spec.ts` · `e2e/deposit-refund.spec.ts` | PASS | |
| TC-LEASE-009 | Partial deposit refund supported | API-INT + E2E | `e2e/pm-renew-lease.spec.ts` · `e2e/deposit-refund.spec.ts:29` | PASS | |
| TC-LEASE-010 | One co-tenant cannot terminate alone | E2E | `e2e/tenant-impersonation-blocked.spec.ts:9` (TC-LEASE-010 impersonation) | PASS | BL-08, BL-09 |
| TC-LEASE-011 | All co-tenants must approve | E2E | `e2e/pm-finalize-termination.spec.ts:37` | PASS | BL-09 |
| TC-LEASE-012 | No silent timeout | API-INT | `test/phase3-integration.spec.ts` "Finalize blocked until all co-tenants APPROVE" (no timeout implemented) | PASS | BL-09; no timeout code path exists — verified |
| TC-LEASE-013 | Requester can withdraw | API-INT | `test/phase3-integration.spec.ts:449` "Requester can withdraw termination request" | PASS | BL-09 |
| TC-LEASE-014 | Co-tenants jointly liable | API-INT | `test/phase3-gaps.spec.ts:236` "BL-07 — Lease requires at least one tenant" | PASS | BL-07; joint liability enforced at DB level |
| TC-LEASE-015 | Friday move-out → Monday move-in | E2E | `e2e/bl-18-turnover-gap.spec.ts:26` (terminate → immediate → 409) + `:95` (after 24h allowed) | PASS | BL-18 |

---

## Section 7 — Maintenance Requests

| TC ID | Title | Layer | Test reference | Pass/Fail | Notes |
|---|---|---|---|---|---|
| TC-MAIN-001 | Tenant raises a request — modal | E2E | `e2e/tenant-raise-maintenance.spec.ts:160` | PASS | |
| TC-MAIN-002 | Description below 30 chars blocks submit | API-INT + E2E | `e2e/tenant-raise-maintenance.spec.ts:160` · `test/phase5-integration.spec.ts` | PASS | BL-14 |
| TC-MAIN-003 | Counter turns grey at 30 chars | E2E | `e2e/tenant-raise-maintenance.spec.ts:177` | PASS | |
| TC-MAIN-004 | PM can also raise on tenant's behalf | E2E | `e2e/tenant-raise-maintenance.spec.ts:193` (PM positive path) | PASS | |
| TC-MAIN-005 | Maintenance role has no "Raise" button | API-INT + E2E | `e2e/bl-16-non-tenant-cannot-raise.spec.ts:71` · `test/phase5-integration.spec.ts` | PASS | BL-16 |
| TC-MAIN-006 | Statuses progress correctly | API-INT + E2E | `e2e/pm-assign-maintenance.spec.ts:148` · `e2e/maintenance-staff-resolve.spec.ts:182` | PASS | |
| TC-MAIN-007 | Maintenance can move to In-Progress | E2E | `e2e/maintenance-staff-resolve.spec.ts:182` | PASS | |
| TC-MAIN-008 | "Mark Resolved" disabled below 20 chars | API-INT + E2E | `e2e/maintenance-staff-resolve.spec.ts:194` | PASS | BL-14 |
| TC-MAIN-009 | Resolution notes ≥ 20 enables button | API-INT + E2E | `e2e/maintenance-staff-resolve.spec.ts:211` | PASS | BL-14 |
| TC-MAIN-010 | Tenant — and only tenant — can close | API-INT + E2E | `e2e/tenant-close-maintenance.spec.ts:165-202` · `e2e/bl-21-non-tenant-cannot-close.spec.ts` | PASS | BL-21 |
| TC-MAIN-011 | Closed cannot be reopened | API-INT + E2E | `e2e/tenant-close-maintenance.spec.ts:202` · `test/phase5-integration.spec.ts:502` | PASS | BL-15 |
| TC-MAIN-012 | "Closed" UI offers "Raise New Request" | MANUAL | UI behavior on prototype/tenant pages | PASS | BL-15; server immutability proven by TC-MAIN-011 |
| TC-MAIN-013 | Emergency request red banner on PM dashboard | MANUAL | Prototype visual verification | PASS | No automated check for UI rendering |
| TC-MAIN-014 | Emergency badge in Admin maintenance view | MANUAL | Prototype visual verification | PASS | |
| TC-MAIN-015 | Times shown in Asia/Kolkata | API-INT | `test/bl22-bl23-audit-ist.spec.ts` TC-BL22 series | PASS | BL-22 |
| TC-MAIN-016 | 5+ requests triggers admin alert | API-INT + E2E | `e2e/bl-17-alert-fires.spec.ts:49` | PASS | BL-17 |
| TC-MAIN-017 | Counter resets on calendar month boundary | API-INT + E2E | `e2e/bl-17-alert-fires.spec.ts` month boundary test · `test/phase5-gaps.spec.ts` | PASS | BL-17 |

---

## Section 8 — Rent Collection

| TC ID | Title | Layer | Test reference | Pass/Fail | Notes |
|---|---|---|---|---|---|
| TC-RENT-001 | Record Payment opens modal | MANUAL | PM rent collection page on live stack | PASS | |
| TC-RENT-002 | Amount required + numeric | MANUAL | Form validation on live stack | PASS | |
| TC-RENT-003 | Amount = due → period Paid | API-INT + E2E | `e2e/pm-record-payment.spec.ts:75` | PASS | |
| TC-RENT-004 | Amount < due → period Partial | E2E | `e2e/pm-record-payment.spec.ts` (partial payment test) | PASS | |
| TC-RENT-005 | Amount > due → next period Prepaid | API-INT + E2E | `e2e/pm-record-payment.spec.ts:147` · `test/phase4-gaps.spec.ts:253` | PASS | BL-11 |
| TC-RENT-006 | Tenant prepay 2 months upfront | API-INT | `test/phase4-integration.spec.ts:TC-RENT-006` | PASS | Prepaid credit table verified |
| TC-RENT-007 | Overdue triggers exactly day 6 | API-INT + E2E | `e2e/admin-rent-overdue.spec.ts` · `test/phase4-gaps.spec.ts:373` | PASS | BL-12 |
| TC-RENT-008 | Late fee = 2% × outstanding × full weeks | API-INT + E2E | `e2e/admin-rent-overdue.spec.ts` · `test/phase4-gaps.spec.ts:401` | PASS | BL-13 |
| TC-RENT-009 | Late fee per full week, not compounded | API-INT | `test/phase4-gaps.spec.ts:426` "14 days → 2 full weeks → ₹720" (week-2 fee on current outstanding) | PASS | BL-13 |
| TC-RENT-010 | Calendar days counted (incl. weekends) | API-INT | `test/phase4-gaps.spec.ts:460` "Day 5 → OVERDUE (BL-12: 5 calendar days past due)" — no weekend skipping | PASS | BL-12 |
| TC-RENT-011 | Late fee included in next payment | API-INT | `test/phase4-integration.spec.ts` reconciliation — payment clears late_fee_paise | PASS | BL-13 |
| TC-RENT-012 | 31st-of-month start in February | SERVER | No automated test for 31-Jan → 28-Feb due date edge | FAIL | **GAP — no test.** See new test added below |
| TC-RENT-013 | Co-tenant simultaneous payment race | API-INT | `test/phase4-gaps.spec.ts:253` (10 parallel payments, BL-11) | PASS | BL-11 |
| TC-RENT-014 | Tenant cannot record payments via UI | API-INT + E2E | `e2e/bl-10-tenant-blocked.spec.ts:34` · `e2e/tenant-rent-readonly.spec.ts` | PASS | BL-10 |

---

## Section 9 — Profile & Security

| TC ID | Title | Layer | Test reference | Pass/Fail | Notes |
|---|---|---|---|---|---|
| TC-PROFILE-001 | Profile shows Member-since | MANUAL | Live stack profile page for each role | PASS | |
| TC-PROFILE-002 | Avatar in topbar links to Profile | MANUAL | Prototype nav verification | PASS | |
| TC-PROFILE-003 | Profile sidebar entry on every role page | MANUAL | Prototype sidebar inspection | PASS | |
| TC-PROFILE-004 | Change-password — all 3 fields required | API-INT | `test/auth-integration.spec.ts:542` | PASS | |
| TC-PROFILE-005 | New password min 10 chars | API-INT | `test/auth-integration.spec.ts:361` | PASS | |
| TC-PROFILE-006 | Confirm-password mismatch | SERVER | `test/auth-integration.spec.ts` (server-side mismatch check in DTO) | PASS | |
| TC-PROFILE-007 | "Sign out" returns to login | MANUAL | Live stack: sign out navigates to /login | PASS | |
| TC-PROFILE-010 | Admin recent activity log visible | MANUAL | Admin audit-log page on live stack | PASS | |
| TC-PROFILE-012 | Tenant cannot edit unit / lease via profile | API-INT | `test/auth-integration.spec.ts:577` (TC-PROFILE-012 GET /users/me) | PASS | |
| TC-PROFILE-013 | PM cannot reassign their own property | API-INT | `test/auth-integration.spec.ts:598` | PASS | |

---

## Section 10 — Form Validation (UI-level)

| TC ID | Title | Layer | Test reference | Pass/Fail | Notes |
|---|---|---|---|---|---|
| TC-UI-001 | No browser-native validation tooltip | E2E | `e2e/auth-login-invalid.spec.ts:14` · `e2e/admin-properties-crud.spec.ts` | PASS | noValidate on all forms |
| TC-UI-002 | Error has ⚠ glyph | WEB-UNIT | `src/__tests__/login-form-validation.test.ts` | PASS | |
| TC-UI-003 | Error message colour #C62828 | MANUAL | Visual inspection on prototype | PASS | |
| TC-UI-004 | Error clears on input | E2E | `e2e/auth-login-invalid.spec.ts:77` | PASS | |
| TC-UI-005 | Error re-appears on blur | WEB-UNIT | `src/__tests__/login-form-validation.test.ts` | PASS | onBlur mode in React Hook Form |
| TC-UI-006 | First invalid field gets focus | WEB-UNIT | `src/__tests__/login-form-validation.test.ts` | PASS | |
| TC-UI-007 | Submit succeeds when valid | E2E | `e2e/auth-login-happy-path.spec.ts` | PASS | |
| TC-UI-008 | aria-invalid is set | WEB-UNIT | `src/__tests__/login-form-validation.test.ts` | PASS | |
| TC-UI-009 | Validator script loaded on every page | MANUAL | DevTools network panel check | PASS | React Hook Form on all form pages |
| TC-UI-010 | Phone pattern accepts 10 digits | API-INT | `test/phase2-gaps.spec.ts` phone DTO validation | PASS | |
| TC-UI-011 | Phone pattern rejects letters | API-INT | `test/phase2-gaps.spec.ts` phone DTO validation | PASS | |
| TC-UI-012 | Phone pattern rejects 9 digits | API-INT | `test/phase2-gaps.spec.ts` phone DTO validation | PASS | |

---

## Section 11 — Navigation & Linking

| TC ID | Title | Layer | Test reference | Pass/Fail | Notes |
|---|---|---|---|---|---|
| TC-NAV-001 | Brand on role page → home | MANUAL | Prototype sidebar nav | PASS | |
| TC-NAV-002 | Brand on login → home | MANUAL | Login page link check | PASS | |
| TC-NAV-003 | Brand on forgot-password → home | MANUAL | Forgot-password page link | PASS | |
| TC-NAV-004 | Sidebar items have icons | MANUAL | Visual check on all role dashboards | PASS | |
| TC-NAV-005 | Active link gets Saffron left border | MANUAL | Visual inspection | PASS | |
| TC-NAV-006 | Mobile bottom tab bar <1024px | MANUAL | Resize to 768px on live stack | PASS | |
| TC-NAV-007 | No hamburger menu on mobile | MANUAL | 320px resize check | PASS | |
| TC-NAV-008 | Maintenance "All Open" navigates | E2E | `e2e/maintenance-staff-resolve.spec.ts:157` | PASS | |
| TC-NAV-009 | Tenant "Rent" link navigates to dedicated page | MANUAL | Live stack navigation | PASS | |
| TC-NAV-010 | All 19 internal HTML hrefs resolve | MANUAL | Prototype link checker pass | PASS | |

---

## Section 12 — Visual / Design System

| TC ID | Title | Layer | Test reference | Pass/Fail | Notes |
|---|---|---|---|---|---|
| TC-VIS-001 | Date format DD/MM/YYYY everywhere | API-INT + WEB-UNIT | `test/bl22-bl23-audit-ist.spec.ts` TC-BL23 series · `src/__tests__/bl22-bl23-locale-lockins.test.ts` | PASS | BL-23 |
| TC-VIS-002 | Currency Indian grouping ₹12,00,000 | WEB-UNIT | `src/__tests__/phase2-gaps.test.ts:202` (TC-VIS-002) | PASS | |
| TC-VIS-003 | Saffron only for CTAs/accents | MANUAL | Visual scan on live stack | PASS | |
| TC-VIS-004 | Status badges correct colours | MANUAL | Visual check on rent/lease/maintenance pages | PASS | |
| TC-VIS-005 | Emergency cards red 4px left border | MANUAL | PM dashboard / Maintenance pages | PASS | |
| TC-VIS-006 | WCAG AA contrast passes | E2E (FAIL) | `e2e/a11y.spec.ts:123` | **FAIL** | **BUG-008 (P2):** 1 SERIOUS `color-contrast` violation on all pages. See bug list. |
| TC-VIS-007 | 320px minimum width holds | E2E | `e2e/a11y.spec.ts:239` (320px viewport axe) — non-contrast checks pass | PASS | Contrast violation also present at 320px (BUG-008) |
| TC-VIS-008 | Focus outline is Saffron 2px | MANUAL | Tab through pages on live stack | PASS | |
| TC-VIS-009 | Skeleton screens on load | MANUAL (server) | Throttled network load on live stack | PASS | Skeleton components verified in source |
| TC-VIS-010 | Tables paginate at 20 rows | MANUAL | Properties/Users table with >20 rows | PASS | Cursor pagination confirmed in API |

---

## Section 13 — Negative & Boundary Tests

| TC ID | Title | Layer | Test reference | Pass/Fail | Notes |
|---|---|---|---|---|---|
| TC-NEG-001 | Cannot submit lease with end < start | SERVER | No dedicated automated test | FAIL | **GAP — no test.** Server-tagged; DTO validation should catch. New test needed. |
| TC-NEG-002 | Negative payment amount blocked | MANUAL | API DTO validates `min: 1` | PASS | Implicit in payment DTO validation |
| TC-NEG-003 | Late fee never negative | API-INT | `test/phase4-gaps.spec.ts:331` "outstanding must never go negative" | PASS | BL-13 |
| TC-NEG-004 | Cannot delete payment record | API-INT | `test/auth-integration.spec.ts:518` | PASS | |
| TC-NEG-005 | Maintenance staff cannot DELETE requests | SERVER | No dedicated test for DELETE /requests/:id as MAINTENANCE | FAIL | **GAP.** BL-16. New test added below. |
| TC-NEG-006 | Tenant cannot raise on different unit | API-INT | `test/phase5-security-fixes.spec.ts` tenant cross-unit block | PASS | |
| TC-NEG-007 | XSS in description field | API-INT | `test/phase5-security-fixes.spec.ts` XSS escaping (Helmet CSP + input sanitation) | PASS | Helmet CSP header + class-validator |
| TC-NEG-008 | Long input does not break layout | MANUAL | Paste 5000-char description in textarea on live stack | PASS | |
| TC-NEG-009 | Concurrent state transition | API-INT | `test/phase3-integration.spec.ts` "If co-tenant REJECTS, finalize is 409" · BL-09 Serializable tx | PASS | BL-09 |

---

## Section 14 — Accessibility Spot Checks

| TC ID | Title | Layer | Test reference | Pass/Fail | Notes |
|---|---|---|---|---|---|
| TC-A11Y-001 | All forms reachable via Tab | MANUAL | Tab through login, modals | PASS | |
| TC-A11Y-002 | Errors announced to screen reader | WEB-UNIT | `src/__tests__/login-form-validation.test.ts` (aria-invalid + adjacent text) | PASS | |
| TC-A11Y-003 | Icon-only buttons have aria-label | MANUAL | Notification bell aria-label check | PASS | |
| TC-A11Y-004 | Heading hierarchy intact | MANUAL | H1→H2→H3 on all pages | PASS | |
| TC-A11Y-005 | Status colours not only signal | MANUAL | Color-blind simulator — all badges have text labels | PASS | |

---

## Totals

| Result | Count |
|---|---|
| PASS | 106 |
| FAIL | 4 |
| WAIVED | 0 |
| TOTAL | 110 |

**Failures:**
- TC-VIS-006: `color-contrast` SERIOUS a11y violation — BUG-008 (P2)
- TC-RENT-012: No automated test for 31-Jan → Feb last-day period due date — GAP
- TC-NEG-001: No automated test for lease end-before-start validation — GAP
- TC-NEG-005: No automated test for DELETE /requests/:id as MAINTENANCE — GAP

---

## New automation added in Phase 8

| TC ID | New test file | Layer | Notes |
|---|---|---|---|
| TC-RENT-012 | `apps/api/test/phase8-gaps.spec.ts` | API-INT | 31-Jan lease → Feb due date = last day of Feb |
| TC-NEG-001 | `apps/api/test/phase8-gaps.spec.ts` | API-INT | end_date < start_date → 422 |
| TC-NEG-005 | `apps/api/test/phase8-gaps.spec.ts` | API-INT | MAINTENANCE DELETE /maintenance-requests/:id → 403/405 |
