# GharSetu — Test Case Document
**Version:** 1.0 · **Date:** May 2026
**Refers to:** [SRS_Document.md](../../product/SRS_Document.md) (business rules BL-01 → BL-23)

---

## 1. Scope & Conventions

This document covers functional, UI, and business-rule tests for the GharSetu prototype and the eventual Next.js implementation. Tests that depend on backend behaviour are marked **(server)** — for the static prototype, those are visual / structural assertions only.

### Test ID format
`TC-{AREA}-{NNN}` — e.g. `TC-AUTH-002`. Areas: `AUTH`, `USR`, `PROP`, `LEASE`, `MAIN`, `RENT`, `PROFILE`, `UI`, `NAV`, `ROLE`.

### Priority
- **P0** — Blocker. Money or data integrity at risk.
- **P1** — Critical user flow.
- **P2** — Important but not blocking.
- **P3** — Cosmetic / nice-to-have.

### Test data baseline
| Entity | Value |
|---|---|
| Admin | Raj Singh · raj@gharsetu.in · joined 15/03/2024 |
| Property Manager | Sunita Arora · Green Valley, Dwarka · joined 02/06/2024 |
| Maintenance Staff | Raju Kumar · joined 11/09/2024 |
| Tenant (primary) | Raj Sharma · Unit 3A · joined 01/04/2025 |
| Co-tenant | Priya Sharma · same lease as Raj Sharma |
| Lease | 01/04/2025 → 31/03/2026 · ₹18,000/mo · ₹36,000 deposit |
| Today's date (for tests) | 09/05/2026 |

### Environment
- **Prototype:** static HTML opened from `prototype/index.html` in Chrome / Firefox / Safari (last 2 versions) and Chrome on Android, iOS Safari 12+.
- **Viewports:** 320, 480, 768, 1024, 1440px.
- **Locale:** `en-IN`, timezone `Asia/Kolkata`, dates DD/MM/YYYY, ₹ Indian digit grouping.

---

## 2. Authentication & Sessions

| ID | Title | Steps | Expected | Pri |
|---|---|---|---|---|
| TC-AUTH-001 | Login form renders | Open `prototype/login.html` | Card centered on Navy gradient. Brand "GharSetu" visible. Email and Password fields visible with labels. Login CTA in Saffron. "Forgot password?" link visible. Four demo role buttons fit on one line each. | P1 |
| TC-AUTH-002 | Login with empty fields shows custom errors below each field | On login.html, click **Login** without typing | Browser does **not** show native tooltip. Both fields turn red border + red background. Below each: red message *"⚠ This field is required."* | P0 |
| TC-AUTH-003 | Password too short shows minlength error | Type `raj@gharsetu.in` and password `1234` (4 chars), submit | Below password field: *"⚠ Please enter at least 8 characters (you have 4)."* Email field has no error. | P1 |
| TC-AUTH-004 | Error clears as user types | After TC-AUTH-002, start typing in email field | The error message under email disappears immediately on first keystroke; the red border clears. Password error remains until user types in password. | P2 |
| TC-AUTH-005 | Submit with valid input redirects | Type any email and password ≥ 8 chars → click **Login** | Page navigates to `admin/dashboard.html` (demo redirect). | P1 |
| TC-AUTH-006 | Demo role buttons jump to dashboard | Click "Property Manager" demo button | Navigates to `pm/dashboard.html`. Same for Admin / Maintenance / Tenant buttons. | P2 |
| TC-AUTH-007 | "Forgot password?" link is wired | Click it from login page | Navigates to `forgot-password.html`. | P1 |
| TC-AUTH-008 | Brand on login links home | Click "GharSetu" logo on login | Navigates to `index.html`. | P2 |
| TC-AUTH-009 | "Back to home" link works on login | Click "← Back to home" | Navigates to `index.html`. | P3 |
| TC-AUTH-010 | Public sign-up is absent | Inspect login.html and any other public page | No "Sign up", "Register", "Create account" link anywhere. Footnote on login states accounts are admin/PM-created. | P0 |

### Forgot-password flow
| ID | Title | Steps | Expected | Pri |
|---|---|---|---|---|
| TC-AUTH-011 | Request step renders | Open `forgot-password.html` | Brand visible (linked to index). Tagline "Reset your password". Info box explains 30-min validity. Single email/phone input. "Send reset link" CTA. "← Back to login" link. | P1 |
| TC-AUTH-012 | Empty submit shows custom error | Click "Send reset link" with empty input | *"⚠ This field is required."* below the input. No browser tooltip. | P0 |
| TC-AUTH-013 | Submit reveals "sent" step | Type any value → submit | Form hides; success card appears with green checkmark, "Reset link sent · expires in 30 minutes", troubleshooting list, "Try a different email / phone" button, "Back to login" link. | P1 |
| TC-AUTH-014 | "Try a different email" returns to step 1 | From sent step, click "Try a different email / phone" | Sent step hides; request step reappears with the input still pre-filled (browser default). | P2 |
| TC-AUTH-015 | Account-existence is not leaked | Submit a known-bad email | The system shows the same "If an account exists…" message — does **not** reveal whether the account exists. **(server)** | P0 |
| TC-AUTH-016 | Reset link is single-use & expires | (server) Use the reset link once → success. Use it again or after 30 min → reject. | Second use returns "link expired or already used". **(server)** | P0 |

---

## 3. Role-Scoped Access (Cross-Role Isolation)

These cover the four-role boundary. The UI must not even *show* features the role can't use, per Design Decision (no greyed-out items).

| ID | Title | Steps | Expected | Pri | BL |
|---|---|---|---|---|---|
| TC-ROLE-001 | Admin sees all properties | Login as Admin → dashboard | KPI shows 18 properties / 120 units / 94% occupancy. Property snapshot lists multiple buildings. | P1 | — |
| TC-ROLE-002 | PM sees only assigned property | Login as Sunita Arora → dashboard | Header reads "Green Valley Apartments". KPI: 40 units only. **No** dropdown to switch property. Sidebar has no "Properties" multi-list link. | P0 | BL-19 |
| TC-ROLE-003 | PM cannot reach another property's URL | (server) GET `/properties/sai-heights` as Sunita | 403 Forbidden. **(server)** | P0 | BL-19 |
| TC-ROLE-004 | Maintenance sees zero financial data | Login as Raju Kumar | Dashboard shows only request cards. No "Rent" link in sidebar. No "Leases", no payment data, no tenant balances. Footer note: "Cannot see: Rent · Leases · Tenant financial data". | P0 | — |
| TC-ROLE-005 | Maintenance cannot create requests | Login as Raju → My Requests / All Open | No "+ New Request" button anywhere. | P0 | BL-16 |
| TC-ROLE-006 | Maintenance API rejects POST /requests | (server) POST a new maintenance request as Raju | 403 Forbidden. **(server)** | P0 | BL-16 |
| TC-ROLE-007 | Tenant sees only own lease | Login as Raj Sharma | Single lease card for Unit 3A. No list of other tenants. No payment-recording UI. | P0 | — |
| TC-ROLE-008 | Tenant cannot record payments | Open any tenant page | No "Record Payment" / "+ Add Payment" button. Rent status shown as read-only with note "Payment is recorded by your Property Manager". | P0 | BL-10 |
| TC-ROLE-009 | Tenant API rejects payment write | (server) POST /payments as tenant | 403 Forbidden. **(server)** | P0 | BL-10 |
| TC-ROLE-010 | Previous PM has read-only after transfer | (server) Property reassigned to new PM. Old PM logs in. | Old PM can view historical data but every write endpoint returns 403. UI hides write buttons. **(server)** | P1 | BL-20 |

---

## 4. Users & Access (Module 1)

| ID | Title | Steps | Expected | Pri | BL |
|---|---|---|---|---|---|
| TC-USR-001 | Admin opens Users page | Login as Admin → Users | Tabs: All · Admins · PMs · Maintenance · Tenants. Table lists Raj Singh (Admin), Sunita Arora (PM), Manoj Verma (PM), Raju Kumar (Maintenance), Raj + Priya Sharma (tenants). | P1 | — |
| TC-USR-002 | Add User modal opens | Click "+ Add User" | Modal shows Role select (PM/Maintenance/Admin only — no public Tenant option). Name, Phone, Email, Assigned property fields. | P1 | — |
| TC-USR-003 | Add User — required fields | Click "Create Account" with empty form | Below "Full name" field: *"⚠ This field is required."*. Below "Phone": same. | P0 | — |
| TC-USR-004 | Phone pattern validation | Enter phone "98123" (5 digits) → submit | Below phone: *"⚠ 10-digit Indian mobile number"*. | P1 | — |
| TC-USR-005 | Co-tenants get individual logins linked to one lease | Create lease with 2 tenants → check Users list | Two rows for Raj + Priya, each with own phone, both showing "Unit 3A · Green Valley" scope, "(co-tenant)" tag on second. | P1 | — |
| TC-USR-006 | Property transfer reassigns scope | (server) Reassign Green Valley to new PM | Previous PM's `scope` becomes read-only audit; new PM is now write-owner. Both visible in Users page. **(server)** | P1 | BL-20 |
| TC-USR-007 | Cannot demote the last Admin | (server) Try to delete or downgrade the only Admin account | Operation rejected: "At least one Admin must remain". **(server)** | P0 | — |

---

## 5. Properties & Units (Module 2)

| ID | Title | Steps | Expected | Pri | BL |
|---|---|---|---|---|---|
| TC-PROP-001 | Properties list filters | On admin/properties.html, change Type / Manager / Occupancy selects | Table updates. **(server)** | P2 | — |
| TC-PROP-002 | Unit state legend visible | Scroll to bottom of properties page | Five badges: Available, Occupied, In-Maintenance, Listed, Retired. Footnote: "Retired units are permanent". | P2 | — |
| TC-PROP-003 | Cannot mark occupied unit for maintenance | (server) State transition occupied → in-maintenance while lease active | 422 Unprocessable: "End the lease first". **(server)** | P0 | BL-04 |
| TC-PROP-004 | Cannot edit rent on occupied unit | (server) PATCH `/units/3A` rent while occupied | 422: "Rent locked during active lease". **(server)** | P0 | BL-02, BL-03 |
| TC-PROP-005 | Rent edit on listed unit propagates | (server) PATCH rent on listed unit | New rent appears on public listing within next request. **(server)** | P1 | BL-06 |
| TC-PROP-006 | Retired unit cannot be reactivated | (server) PATCH state retired → available | 422: "Retired is permanent. Create a fresh unit." | P0 | BL-05 |
| TC-PROP-007 | Hard-delete is impossible | (server) DELETE `/units/3A` | 405 Method Not Allowed. Use retire instead. | P0 | BL-05 |

---

## 6. Leases & Tenants (Module 3)

### Create / renew / terminate
| ID | Title | Steps | Expected | Pri | BL |
|---|---|---|---|---|---|
| TC-LEASE-001 | New Lease modal pre-populates due day | PM → Leases → "+ New Lease" → choose unit, set start = 15/06/2026 | "Rent due day" auto-shows "15th of each month". | P1 | — |
| TC-LEASE-002 | Listed/Available units only in dropdown | Open New Lease unit dropdown | Only units with state `available` or `listed` appear. Occupied units are absent. | P1 | — |
| TC-LEASE-003 | Cannot create overlapping lease | (server) POST `/leases` for unit 3A while existing lease active | 422: "Unit has an active lease." **(server)** | P0 | BL-01 |
| TC-LEASE-004 | Rent locked at signing | After lease created, view lease detail | Rent field is read-only with lock icon; tooltip "Locked at signing". | P0 | BL-02 |
| TC-LEASE-005 | Renewal creates new lease record | Click "Renew" on an active lease ending 31/03/2026 | New lease starts 01/04/2026; old lease still shown as **Active** (not Renewed). | P1 | — |
| TC-LEASE-006 | Old lease auto-transitions on end date | (server) Day after old end_date | Status changes Active → Renewed. **(server)** | P1 | — |
| TC-LEASE-007 | Early termination requires reason | Click "Early Terminate" → submit empty reason | *"⚠ This field is required."* below reason field. | P1 | — |
| TC-LEASE-008 | Termination + refund are two steps | After terminating | Lease status → Terminated. Separate "Process Refund" button appears, takes amount + reason. | P1 | — |
| TC-LEASE-009 | Partial deposit refund supported | Refund ₹20,000 of ₹36,000 deposit | Refund record stores amount + reason. No "full only" restriction. | P2 | — |

### Co-tenant rules
| ID | Title | Steps | Expected | Pri | BL |
|---|---|---|---|---|---|
| TC-LEASE-010 | One co-tenant cannot terminate alone | Tenant A submits termination; check status | Lease shows "Pending co-tenant consent" panel listing all co-tenants and their approval state (Approved / Pending). | P0 | BL-08, BL-09 |
| TC-LEASE-011 | All co-tenants must approve | Tenant A and B approve, C still pending | "Finalize Termination" CTA stays disabled. | P0 | BL-09 |
| TC-LEASE-012 | No silent timeout | Wait 30 days without C responding | Termination request still pending. No auto-approval. **(server)** | P0 | BL-09 |
| TC-LEASE-013 | Requester can withdraw | Tenant A clicks "Withdraw request" | Termination request closes; lease back to normal Active state. | P1 | BL-09 |
| TC-LEASE-014 | Co-tenants jointly liable | (server) One co-tenant defaults; balance shown to all | All co-tenants see same outstanding balance on their tenant view. | P1 | BL-07 |

### Turnover gap
| ID | Title | Steps | Expected | Pri | BL |
|---|---|---|---|---|---|
| TC-LEASE-015 | Friday move-out → Monday move-in | Lease A ends Fri 30/05/2026; Lease B starts Mon 02/06/2026 | Sat–Sun shown as "no-lease period". Unit not flagged overdue. **Cannot** create a Lease C overlapping. | P1 | BL-18 |

---

## 7. Maintenance Requests (Module 4)

### Raising & description
| ID | Title | Steps | Expected | Pri | BL |
|---|---|---|---|---|---|
| TC-MAIN-001 | Tenant raises a request | Tenant → Maintenance → "+ Raise New Request" | Modal with category, priority radios, description textarea showing live counter `0/30`. | P1 | — |
| TC-MAIN-002 | Description below 30 chars blocks submit | Type "Tap leaks" (10 chars) → Submit | Submit button stays disabled OR validator shows *"⚠ Please enter at least 30 characters (you have 10)."* | P0 | BL-14 |
| TC-MAIN-003 | Counter turns from red to grey at 30 chars | Type 30+ chars | Counter `30/30` no longer red. Submit becomes enabled. | P2 | — |
| TC-MAIN-004 | PM can also raise on tenant's behalf | PM → Maintenance → "+ Raise Request" | Modal opens with same description ≥30 rule. | P2 | — |
| TC-MAIN-005 | Maintenance role has no "Raise" button | Login as Raju → Maintenance | "+ Raise" / "+ New Request" absent on every page. | P0 | BL-16 |

### Lifecycle
| ID | Title | Steps | Expected | Pri | BL |
|---|---|---|---|---|---|
| TC-MAIN-006 | Statuses progress correctly | Open → Assigned → In-Progress → Resolved → Closed | Each transition records actor + timestamp. Statuses non-skippable. **(server)** | P1 | — |
| TC-MAIN-007 | Maintenance can move to In-Progress | Raju → "Move to In-Progress" on Assigned request | Status updates. Resolution-notes textarea + "Mark Resolved" appear. | P1 | — |
| TC-MAIN-008 | "Mark Resolved" disabled below 20 chars | Type "ok" in resolution notes (2 chars) | Counter `2/20` red, button disabled. | P0 | BL-14 |
| TC-MAIN-009 | Resolution notes ≥ 20 enables button | Type 20+ char note | Button enables, counter goes neutral. | P1 | BL-14 |
| TC-MAIN-010 | Tenant — and only tenant — can close | After Resolved, login as PM/Admin | No "Close Request" button visible to non-tenants. Tenant view has it. | P0 | BL-21 |
| TC-MAIN-011 | Closed cannot be reopened | (server) PATCH a Closed request to In-Progress | 422: "Closed requests are immutable." **(server)** | P0 | BL-15 |
| TC-MAIN-012 | "Closed" UI offers "Raise New Request" instead | Tenant views a Closed request | No reopen button. Helpful note: "If the same issue returns, please raise a new request". | P1 | BL-15 |

### Emergency & alerts
| ID | Title | Steps | Expected | Pri | BL |
|---|---|---|---|---|---|
| TC-MAIN-013 | Emergency request shows red banner on PM dashboard | Tenant submits emergency at 23:42 | PM dashboard shows red-bordered card immediately. Alert at top of admin dashboard. | P0 | — |
| TC-MAIN-014 | Emergency badge in Admin maintenance view | Admin → Maintenance | "Emergency" badge in solid red on those rows. | P1 | — |
| TC-MAIN-015 | Times shown in Asia/Kolkata | Submitted 23:42 IST → resolved 02:00 IST | Both timestamps display in IST regardless of viewer's browser TZ. **(server)** | P1 | BL-22 |
| TC-MAIN-016 | 5+ requests in calendar month triggers admin alert | Tenant raises 5 requests on Unit 4B between 1–31 May | Admin dashboard shows alert "Unit 4B — 5+ maintenance requests in May 2026". | P1 | BL-17 |
| TC-MAIN-017 | Counter resets on calendar month boundary | 4 requests in May, 1 in June | No alert in May (under threshold). Alert evaluated against June calendar month, not rolling 30 days. | P1 | BL-17 |

---

## 8. Rent Collection (Module 5)

### Recording payments
| ID | Title | Steps | Expected | Pri | BL |
|---|---|---|---|---|---|
| TC-RENT-001 | Record Payment opens modal | PM → Rent Collection → click Record Payment on May 2026 row | Modal shows due ₹18,000 + late fee ₹360. Amount, Date, Method, Reference fields. Recorded-by auto-filled "Sunita Arora (auto)". | P1 | — |
| TC-RENT-002 | Amount required + numeric | Submit blank | *"⚠ This field is required."* below Amount field. | P0 | — |
| TC-RENT-003 | Amount = due → period Paid | Pay ₹18,000 (no late fee scenario) | Period status badge → **Paid**. Outstanding clears. | P1 | — |
| TC-RENT-004 | Amount < due → period Partial | Pay ₹10,000 of ₹18,000 due | Status → **Partial**. Outstanding shows ₹8,000. | P1 | — |
| TC-RENT-005 | Amount > due → next period Prepaid | Pay ₹36,000 against ₹18,000 due | Current period **Paid**. Next period auto-marked **Prepaid** with ₹18,000 credit. | P0 | — |
| TC-RENT-006 | Tenant prepay scenario (real example) | Tenant pays 2 months together upfront | Month 1 = Paid · Month 2 = Prepaid. Recent overpayment bug **does not** recur. | P0 | — |

### Overdue & late fees
| ID | Title | Steps | Expected | Pri | BL |
|---|---|---|---|---|---|
| TC-RENT-007 | Overdue triggers exactly day 6 | Period due 05/05/2026; system clock 10/05/2026 (5 days past) | Status flips Pending → **Overdue**. **(server)** | P0 | BL-12 |
| TC-RENT-008 | Late fee = 2% × outstanding × full weeks | Outstanding ₹18,000 · 1 week overdue | Late fee = ₹360 added automatically. UI shows "Late Fee: ₹360" line. | P0 | BL-13 |
| TC-RENT-009 | Late fee per full week, not compounded retroactively | 2 weeks overdue on ₹18,000 + ₹360 already added | Week-2 fee = 2% × current outstanding (`₹18,360`) = ₹367 (not 4% on original). **(server)** | P1 | BL-13 |
| TC-RENT-010 | Calendar days counted (incl. weekends) | Due Fri; current Wed (5 calendar days later) | Marked Overdue. Weekend not skipped. | P1 | BL-12 |
| TC-RENT-011 | Late fee included in next payment | Tenant pays ₹18,360 | Period Paid. Late-fee balance cleared atomically. | P1 | BL-13 |

### Edge cases
| ID | Title | Steps | Expected | Pri | BL |
|---|---|---|---|---|---|
| TC-RENT-012 | 31st-of-month start in February | Lease starts 31/01/2026; Feb 2026 has 28 days | Feb period due date = 28/02/2026. No skipped period. **(server)** | P0 | — |
| TC-RENT-013 | Co-tenant simultaneous payment race | (server) Both pay ₹18,000 within 100ms | First request → period Paid. Second → Prepaid for next period. No double-credit. **(server)** | P0 | BL-11 |
| TC-RENT-014 | Tenant cannot record payments via UI | Login as tenant | No "Record Payment" button anywhere. Period rows show status only. | P0 | BL-10 |

---

## 9. Profile & Security

| ID | Title | Steps | Expected | Pri |
|---|---|---|---|---|
| TC-PROFILE-001 | Profile shows Member-since | Login as any role → click avatar | Profile page shows "Member since" with the role's join date in DD/MM/YYYY. | P1 |
| TC-PROFILE-002 | Avatar in topbar links to Profile | Click avatar circle | Navigates to `<role>/profile.html`. | P2 |
| TC-PROFILE-003 | Profile sidebar entry exists on every role page | Visit Admin / PM / Maintenance / Tenant pages | Sidebar shows "My Profile" with person icon, separated by a divider from the main nav. | P1 |
| TC-PROFILE-004 | Change-password — all 3 fields required | Submit empty | Three errors below the fields: *"⚠ This field is required."* on Current, New, Confirm. | P0 |
| TC-PROFILE-005 | New password min 10 chars | Type 6 chars in New | *"⚠ Please enter at least 10 characters (you have 6)."* | P1 |
| TC-PROFILE-006 | Confirm-password mismatch | Type different values in New and Confirm | (server) Server returns mismatch error after submit. UI surfaces it below Confirm. | P0 |
| TC-PROFILE-007 | "Sign out" returns to login | Click red Sign out button | Navigates to `../login.html`. | P1 |
| TC-PROFILE-010 | Admin recent activity log visible | Admin profile | Table lists created users, alert reviews, lease/payment writes with timestamps in DD/MM/YYYY HH:MM. | P2 |
| TC-PROFILE-012 | Tenant cannot edit unit / lease via profile | Tenant → Profile → "Edit phone / email" | Only contact fields editable. Unit, Lease, Co-tenant rows are read-only. Footnote names the PM (Sunita Arora) as the contact for changes. | P1 |
| TC-PROFILE-013 | PM cannot reassign their own property | PM → Profile | Assigned property displayed read-only. No "Change property" control. | P1 |

> **Note:** TC-PROFILE-008 (sign-out-all-sessions), TC-PROFILE-009 (last sign-in display), and TC-PROFILE-011 (2FA setup) were **removed** in the v1 reconciliation. Multi-session UI and 2FA are out of scope for v1 — see [SRS §11.3](../../product/SRS_Document.md#113-endpoints-explicitly-removed-from-the-v1-plan). IDs are not reassigned (leave gaps) so existing references stay traceable.

---

## 10. Form Validation (UI-level)

These tests assert that **the validator suppresses native tooltips and shows messages below the field** (`.field-error`). They apply to every form on every page.

| ID | Title | Steps | Expected | Pri |
|---|---|---|---|---|
| TC-UI-001 | No browser-native validation tooltip | On any form with empty required field, click submit | The grey/yellow native popup ("Please fill out this field") **does not appear**. Custom red message renders **below** the field instead. | P0 |
| TC-UI-002 | Error has ⚠ glyph | Trigger any error | Message starts with "⚠" character. | P3 |
| TC-UI-003 | Error message colour matches Overdue red | Visual check | Text is `#C62828`. Input border becomes 2px `#C62828` with `#FFEBEE` background. | P2 |
| TC-UI-004 | Error clears on input | Trigger error → start typing | Error message and red border disappear on first keystroke. | P1 |
| TC-UI-005 | Error re-appears on blur if still invalid | Type invalid value, tab away | Error returns below field on blur. | P2 |
| TC-UI-006 | First invalid field gets focus | Submit a form with multiple invalid fields | Browser focus jumps to the first invalid field (top of form). | P1 |
| TC-UI-007 | Submit succeeds when valid | Fill required fields correctly → submit | Existing onsubmit redirects (e.g. login → dashboard) still work. | P0 |
| TC-UI-008 | aria-invalid is set | Inspect invalid input in DevTools | Element has `aria-invalid="true"` while error is showing; attribute removed when cleared. | P2 |
| TC-UI-009 | Validator script loaded on every page | Open DevTools network tab | `assets/validation.js` requested on every page that contains a form. | P3 |

### Pattern-based validation (Add User)
| ID | Title | Steps | Expected | Pri |
|---|---|---|---|---|
| TC-UI-010 | Phone pattern accepts 10 digits | Enter `9812345670` | No error; field passes. | P1 |
| TC-UI-011 | Phone pattern rejects letters | Enter `98abc12345` | Error below: *"⚠ 10-digit Indian mobile number"* (uses `title` attribute). | P1 |
| TC-UI-012 | Phone pattern rejects 9 digits | Enter `981234567` | Same error message. | P1 |

---

## 11. Navigation & Linking

| ID | Title | Steps | Expected | Pri |
|---|---|---|---|---|
| TC-NAV-001 | Brand on any role page → home | Click "GharSetu" in sidebar of admin/PM/maintenance/tenant pages | Navigates to `../index.html` (the landing page). | P1 |
| TC-NAV-002 | Brand on login → home | Click "GharSetu" on login.html | Navigates to `index.html`. | P2 |
| TC-NAV-003 | Brand on forgot-password → home | Click "GharSetu" on forgot-password.html | Navigates to `index.html`. | P2 |
| TC-NAV-004 | Sidebar items have icons | Open any role page | Each link has SVG icon left of label. Active link's icon is Saffron-tinted. | P2 |
| TC-NAV-005 | Active link gets Saffron left border | Visit each sidebar item | Active item: 4px Saffron left border + light background. | P2 |
| TC-NAV-006 | Mobile bottom tab bar visible <1024px | Resize to 768px / 480px | Sidebar hides; bottom tabbar appears with up to 5 icons. | P1 |
| TC-NAV-007 | No hamburger menu on mobile | At 320px width | Confirm absence of hamburger icon anywhere. | P2 |
| TC-NAV-008 | Maintenance "All Open" navigates correctly | Maintenance dashboard → click "All Open" in sidebar or tabbar | Loads `maintenance/all-open.html`. | P1 |
| TC-NAV-009 | Tenant "Rent" link navigates to dedicated page | Tenant dashboard → Rent | Loads `tenant/rent.html` (separate page, not anchor scroll). Active sidebar item is "Rent". | P1 |
| TC-NAV-010 | All 19 internal HTML hrefs resolve | Run a link checker over `prototype/` | Zero broken links. | P1 |

---

## 12. Visual / Design System

| ID | Title | Steps | Expected | Pri |
|---|---|---|---|---|
| TC-VIS-001 | Date format DD/MM/YYYY everywhere | Visit dashboards, leases, payments, profile | Every date renders in DD/MM/YYYY. No ISO (YYYY-MM-DD) and no MM/DD/YYYY. | P0 |
| TC-VIS-002 | Currency formatted with Indian grouping | Visit Admin Rent overview | "₹12,00,000" not "₹1,200,000". | P1 |
| TC-VIS-003 | Saffron used only for CTAs / accents | Visual scan | No large saffron text blocks. CTA buttons, brand mark, active-state accents only. | P2 |
| TC-VIS-004 | Status badges use correct background + foreground | Visual check on all status occurrences | Paid green / Partial amber / Overdue red / Prepaid blue · Active green · Renewed blue · Terminated red · Open amber · In-Progress blue · Resolved green · Closed grey · Emergency solid red. | P1 |
| TC-VIS-005 | Emergency cards have red 4px left border | Visit PM dashboard / Maintenance | Border-left visible on emergency-priority cards. | P1 |
| TC-VIS-006 | WCAG AA contrast passes | Run axe DevTools on each page | No contrast violations on text. Navy/white = 15:1, Slate/off-white = 8.4:1. | P1 |
| TC-VIS-007 | 320px minimum width holds | Resize to 320px | No horizontal scroll. Tap targets ≥ 44px. | P1 |
| TC-VIS-008 | Focus outline is Saffron 2px | Tab through any page | Visible Saffron outline on every focusable element. | P2 |
| TC-VIS-009 | Skeleton screens on load (where applicable) | Throttle network → reload data view | Grey skeleton placeholders, no blank flash. **(server)** | P3 |
| TC-VIS-010 | Tables paginate at 20 rows | Properties / Users with > 20 rows | Pagination controls appear; only 20 rows per page. | P2 |

---

## 13. Negative & Boundary Tests (cross-cutting)

| ID | Title | Steps | Expected | Pri | BL |
|---|---|---|---|---|---|
| TC-NEG-001 | Cannot submit lease with end < start | New Lease modal: end 01/01/2025, start 01/06/2025 | Validation error below End-date field. **(server)** | P0 | — |
| TC-NEG-002 | Negative payment amount blocked | Record Payment: amount = -100 | *"⚠ Value must be at least 1."* (HTML5 min=1). | P0 | — |
| TC-NEG-003 | Late fee never negative | (server) Edge: outstanding becomes 0 then payment late | Late fee = 0. Never negative. **(server)** | P1 | BL-13 |
| TC-NEG-004 | Cannot delete payment record | (server) DELETE /payments/123 | 405. Payments are append-only. Use reversal entry instead. **(server)** | P0 | — |
| TC-NEG-005 | Maintenance staff cannot DELETE requests | (server) DELETE /requests/4 as Raju | 403 Forbidden. **(server)** | P0 | BL-16 |
| TC-NEG-006 | Tenant cannot raise on a different unit | (server) POST request with unit=other tenant's unit | 403 Forbidden. **(server)** | P0 | — |
| TC-NEG-007 | XSS in description field | Type `<script>alert(1)</script>` in description | Saved as text. Rendered escaped. No alert fires. | P0 | — |
| TC-NEG-008 | Long input does not break layout | Paste 5,000-char description into textarea | Textarea scrolls; surrounding layout intact. | P2 | — |
| TC-NEG-009 | Concurrent state transition | (server) Two PMs (admin override) approve and reject same termination same instant | One wins, other gets 409 Conflict with current state. **(server)** | P1 | BL-09 |

---

## 14. Accessibility Spot Checks

| ID | Title | Steps | Expected | Pri |
|---|---|---|---|---|
| TC-A11Y-001 | All forms reachable via Tab | Tab through login, forgot-password, modals | Every input + button reachable in logical order. | P1 |
| TC-A11Y-002 | Errors announced to screen reader | Trigger validation error with NVDA / VoiceOver | Screen reader announces the error text on focus. (`aria-invalid` + adjacent text node.) | P1 |
| TC-A11Y-003 | Icon-only buttons have aria-label | Inspect notification bell | `aria-label="Notifications"` present. | P2 |
| TC-A11Y-004 | Heading hierarchy intact | View any page | H1 → H2 → H3, no skipped levels. | P2 |
| TC-A11Y-005 | Status colours are not the only signal | Color-blind simulator on rent table | Status text labels accompany every coloured badge. | P1 |

---

## 15. Traceability Matrix — Business Rules → Tests

| Rule | Description | Covering tests |
|---|---|---|
| BL-01 | No two active leases on same unit | TC-LEASE-003 |
| BL-02 | Rent locked at signing | TC-LEASE-004, TC-PROP-004 |
| BL-03 | Rent edits only when available/listed | TC-PROP-004 |
| BL-04 | Occupied unit can't move to maintenance | TC-PROP-003 |
| BL-05 | Retired = permanent | TC-PROP-006, TC-PROP-007 |
| BL-06 | Listed unit rent change → listing updates | TC-PROP-005 |
| BL-07 | Co-tenants jointly liable | TC-LEASE-014 |
| BL-08 | One co-tenant can't end alone | TC-LEASE-010 |
| BL-09 | Termination needs all consent · no timeout | TC-LEASE-011, TC-LEASE-012, TC-LEASE-013, TC-NEG-009 |
| BL-10 | Only PM records payments | TC-ROLE-008, TC-ROLE-009, TC-RENT-014 |
| BL-11 | Concurrent co-tenant payment handling | TC-RENT-013 |
| BL-12 | Overdue at exactly day 6 | TC-RENT-007, TC-RENT-010 |
| BL-13 | Late fee = 2% × outstanding × full weeks | TC-RENT-008, TC-RENT-009, TC-RENT-011, TC-NEG-003 |
| BL-14 | Description ≥ 30 / Resolution ≥ 20 | TC-MAIN-002, TC-MAIN-008, TC-MAIN-009 |
| BL-15 | Closed requests cannot be reopened | TC-MAIN-011, TC-MAIN-012 |
| BL-16 | Maintenance staff: read+update only | TC-ROLE-005, TC-ROLE-006, TC-MAIN-005, TC-NEG-005 |
| BL-17 | 5+ requests in calendar month → admin alert | TC-MAIN-016, TC-MAIN-017 |
| BL-18 | Turnover gap is normal no-lease period | TC-LEASE-015 |
| BL-19 | One PM = one property | TC-ROLE-002, TC-ROLE-003 |
| BL-20 | Old PM read-only after transfer | TC-ROLE-010, TC-USR-006 |
| BL-21 | Tenant closes their own resolved requests | TC-MAIN-010 |
| BL-22 | Times in property local time (Asia/Kolkata) | TC-MAIN-015 |
| BL-23 | Dates DD/MM/YYYY everywhere | TC-VIS-001 |

---

## 16. Test Execution Notes

- **Prototype scope:** test cases tagged `(server)` are deferred until backend exists. For the static prototype, run all UI / visual / navigation / form-validation tests.
- **Suggested order:** AUTH → UI → NAV → ROLE → VIS, then per-module. Run negative and a11y last.
- **Pre-flight:** clear browser cache; reset localStorage; open DevTools console (must stay clean of errors during a normal session).
- **Logging:** record actual vs expected, browser+version, viewport. Attach screenshots for failed visual / responsive cases.
- **Sign-off:** all P0 must pass. P1 ≤ 1 known defect with mitigation noted. P2/P3 tracked but non-blocking for the prototype handoff.
