# GharSetu — Phase 6 Pre-VAPT Walkthrough
**Reviewer:** gharsetu-security
**Date:** 2026-05-11
**Scope:** Backend API (`apps/api`) + auth flow + Phase 6 role-leakage matrix
**HEAD at audit time:** `7aa796b` (feat(web): tenant dashboard with lease + period + late-fee breakdown cards)
**Prior reviews in scope:** phase-1 through phase-5 security review docs

---

## Executive Summary

**Verdict: READY-FOR-PHASE-7 (with 2 carry-over HIGHs that are Phase-7-scheduled, no NEW blockers)**

The Phase 6 codebase is in a materially better state than any prior phase. All Phase 5 HIGHs that were open are confirmed resolved. Both open carry-over HIGH findings (Phase 4 H-01 on `GET /rent-periods/:id` and Phase 5 H-01 on `GET /maintenance-requests/:id`) are confirmed fixed in commits `29230de` and `dd5bb95` respectively. No new HIGH findings are introduced by Phase 6 code.

One new MEDIUM is raised: `POST /auth/reset-password` has no per-email or per-IP tight rate limit — the global 100 req/min applies, which is far too permissive for a password-reset endpoint. This was noted as a Phase 7 recommendation in Phase 1 but was never elevated; it is escalated here as a MEDIUM.

| Severity | New | Carry-over open | Total open |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| High | 0 | 0 | 0 |
| Medium | 1 | 4 | 5 |
| Low | 0 | 4 | 4 |
| Info | 3 | — | 3 |

**Phase 7 wins:** 5 concrete hardening items documented in §6.

---

## 1. OWASP Top 10 Cursory Check

| # | Category | Status | Notes |
|---|---|---|---|
| A01 | Broken Access Control | OK | Phase 4 H-01 (rent-period PM scope) fixed `29230de`; Phase 5 H-01 (maintenance GET/:id PM scope) fixed `dd5bb95`; Phase 3 H-01/H-02 fixed prior. Phase 6 role-leakage matrix spec (`phase6-role-leakage.spec.ts`) covers 12 high-value cells. 3 sampled endpoints (GET /rent-periods/:id, GET /maintenance-requests/:id, POST /payments) all confirmed correctly scoped. |
| A02 | Cryptographic Failures | OK | Argon2id confirmed (`hashing.service.ts`). JWT HS256 with `getOrThrow` on `JWT_SECRET`. Refresh token httpOnly + Secure + SameSite=Strict + `Path=/api/v1/auth` (`auth.controller.ts:23-28`). Reset tokens single-use + 30 min TTL + sha256hex stored. `.env.example` documents `openssl rand -hex 32` for production. No committed `.env` with real secrets (git-verified). |
| A03 | Injection | OK | All `$queryRaw` calls in `rent.service.ts` use tagged template literals (parameterized — lines 390-403, 573-584, 666-677, 689-695); no string concatenation. `health.service.ts:44` uses tagged template literal. No `$executeRawUnsafe` in `apps/api/src/`. `whitelist: true` on global `ValidationPipe` strips unknown fields. CSP deferred to Phase 7 (no HTML served from API). |
| A04 | Insecure Design | OK | All BL checks are server-enforced, not UI-only. BL-09 no-auto-approval confirmed (no scheduled job or TTL on `LeaseTerminationApproval` rows). BL-05 DB trigger confirmed. BL-15 DB trigger confirmed. BL-17 idempotency triple confirmed. Serializable isolation on high-risk write paths (create-lease, finalize-termination, recordPayment, voidPayment). |
| A05 | Security Misconfiguration | SPOT-CHECK FOUND: helmet absent | `apps/api/src/main.ts` — no `helmet()` call, no `X-Powered-By` removal, no `X-Content-Type-Options`, no `X-Frame-Options`, no `Strict-Transport-Security`. CORS is correctly restricted to `WEB_ORIGIN` env var with `credentials: true` and no wildcard. Error filter (`code-error.filter.ts:98-100`) guards stack trace in production. Debug endpoints absent. |
| A06 | Vulnerable Components | NEEDS PHASE-7 ATTENTION | `pnpm audit --prod`: **2 HIGH** (path-to-regexp 0.1.12, lodash 4.17.21 code-injection), **4 MODERATE** (lodash prototype-pollution ×2, postcss XSS in apps/web, @nestjs/core injection GHSA-36xv). All are carry-overs noted in prior reviews. The `@nestjs/core` advisory requires a NestJS v11 migration. See carry-over dashboard §5. |
| A07 | Authn Failures | SPOT-CHECK FOUND: reset-password unthrottled | Login throttled 100/min. forgot-password throttled 100/min. `POST /auth/reset-password` has **no** `@Throttle` decorator and no custom limit — it inherits only the global 100/min. This is too permissive for a password-reset consumption endpoint. Raised as M-01 below. Session fixation prevented: `issueTokens()` always creates a new refresh token on every login (`auth.service.ts:276`); old tokens are not reused. Refresh rotation confirmed at `auth.service.ts:142-145`. 2FA and multi-session UI are out of scope per SRS §11.3. |
| A08 | Software/Data Integrity | OK | Lockfile (`pnpm-lock.yaml`) committed and tracked. Payments append-only confirmed (`payments_no_delete` + `payments_restrict_update` triggers; zero `DISABLE TRIGGER` in `apps/api/src/`). Audit log append-only confirmed (zero `auditLog.update/delete` calls in source). Accrual idempotency via `rent_accrual_log_run_date_key` unique index. BL-17 alert idempotency via triple-unique constraint. No CDN scripts in use. |
| A09 | Logging & Monitoring | SPOT-CHECK FOUND: auth events not in audit_log | Auth service (`auth.service.ts`) has no `AuditService` injection — login, logout, failed-login, password-reset, and refresh events are NOT written to `audit_log`. All mutation endpoints in properties/units/users/leases/tenants/rent/maintenance DO write audit rows. Reset token correctly guarded behind NODE_ENV check (`auth.service.ts:207`). No PII (email, phone, DoB) in any logger call at info+ level (spot-checked `maintenance.service.ts:271`, `rent-accrual.processor.ts:131`, `leases.service.ts:539`). Error filter logs raw `exception.message + stack` via `this.logger.error` — stack trace stays in application log only, not in HTTP response in production. |
| A10 | SSRF | OK | No outbound HTTP calls from any `apps/api/src/` file based on user-supplied input. Health check uses internal Prisma `$queryRaw\`SELECT 1\`` and a direct TCP ping to Redis. No URL-fetching user-input paths exist in v1. |

---

## 2. Spot-Checks

### Security headers — `apps/api/src/main.ts`
- `helmet()` is not registered. Confirmed absent across all phases 1-6.
  - Missing headers: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `X-DNS-Prefetch-Control`, `Referrer-Policy`, `Permissions-Policy`, and removal of `X-Powered-By`.
  - The API is JSON-only so clickjacking and MIME-sniffing risk is reduced, but `X-Powered-By: Express` is broadcast, exposing the stack.
  - Fix: `pnpm add helmet -w --filter @gharsetu/api` and `app.use(helmet())` in `main.ts` before `app.listen()`. Phase 7 item.

### Rate limit coverage — Phase 4 + 5 routes
- Global `ThrottlerGuard` registered as `APP_GUARD` in `app.module.ts:55-57`. All Phase 4/5 routes inherit it. No `@SkipThrottle` annotations found on any endpoint in maintenance, rent, or jobs controllers.
- `POST /auth/login` — explicitly `@Throttle({ default: { limit: 100, ttl: 60000 } })` at `auth.controller.ts:41`.
- `POST /auth/forgot-password` — explicitly `@Throttle` same limit at `auth.controller.ts:120`.
- `POST /auth/reset-password` — **NO `@Throttle` decorator** at `auth.controller.ts:133`. Inherits global 100/min only. See M-01.
- `PATCH /users/me/change-password` — no explicit throttle; inherits global 100/min. Acceptable given account lockout backstop, but a tighter per-user limit is recommended.
- `POST /payments` — inherits global 100/min. Acceptable for a PM-only endpoint, but a Phase 7 idempotency key would provide better protection against double-submit than rate limiting alone.
- `POST /jobs/rent-accrual/run` and `/maintenance-alert/run` — ADMIN-only, inherits global 100/min. Acceptable.

### PII in logs — `apps/api/src/`
Grep result across all source files for `logger.*|console.log` showed no email addresses, phone numbers, dates of birth, or ID proof numbers logged at any level. Specific checks:
- `maintenance.service.ts:271` — EMERGENCY log emits only `requestId`, `unitId`, `raisedBy` (UUID), `title`. Clean.
- `rent-accrual.processor.ts:131` — logs IST date and period count only. Clean.
- `leases.service.ts:539` — logs idempotent renew lease UUID only. Clean.
- `auth.service.ts:209` — dev-only reset URL behind `NODE_ENV !== 'production'` guard. Clean.
- `main.ts:29` — startup `console.log` with host/port only. Clean.

### Test database disambiguation
- `apps/api/jest.config.cjs` — no `testEnvironment` override for `DATABASE_URL`. The jest config does not inject a separate test DB URL.
- `apps/api/.env` (dev) — `DATABASE_URL=postgresql://gharsetu:gharsetu_dev_pw@localhost:5433/gharsetu?schema=public`. No `TEST_DATABASE_URL` or `schema=test` variant found in any config file.
- **Assessment:** Tests run against the same DB schema as the dev environment. This is a Medium concern for production safety: if a developer runs the integration test suite against a staging DB by mistake, real data can be truncated by `afterAll` teardown blocks. There is no CI-enforced separation; CI relies on the docker-compose DB being a fresh container. Recommend a `TEST_DATABASE_URL` env var that defaults to `?schema=test` and is enforced in `jest.config.cjs` via `setupFiles`. Raised as M-02.

### Reset password rate limiting
- `POST /auth/reset-password` — no `@Throttle` decorator at `auth.controller.ts:133`. Inherits global 100 req/min. An attacker can consume 100 password-reset tokens per minute per IP. Combined with the dev-only token-in-log advisory, this is a meaningful concern once SMTP is wired in Phase 7. Raised as M-01 below.

### Session fixation
- On each `login()` call, `issueTokens()` creates a new `RefreshToken` DB row with a fresh `generateOpaqueToken()` value (`auth.service.ts:271-284`). Old refresh tokens are not revoked on login (multiple sessions are allowed). This is an intentional design choice per SRS §11.3 ("no sign-out-everywhere UI"). New access JWT is always freshly signed. Session fixation is not possible via this code path.

### Cookie scope
- `COOKIE_OPTIONS` at `auth.controller.ts:22-29`: `httpOnly: true`, `secure: true`, `sameSite: 'strict'`, **`path: '/api/v1/auth'`**, `maxAge: 7 days`. The `Path` is correctly narrowed to the auth prefix — cookie is not sent on non-auth routes. PASS.

### JWT secret strength
- `.env.example:20` — `JWT_SECRET=replace_with_at_least_32_random_chars` with inline comment `# HS256 secret — minimum 32 random bytes. Generate: openssl rand -hex 32`. Adequate guidance. Phase 1 finding carried-confirmation: the placeholder is documented and the production enforcement (`getOrThrow`) throws at startup if absent. Reconfirmed OK — no escalation.

---

## 3. Audit Log Coverage Gaps

The following mutation endpoints do NOT write an `audit_log` row:

| Endpoint | Service | Gap |
|---|---|---|
| `POST /auth/login` (successful) | `auth.service.ts` | Successful logins not audited. Actor + IP available in `meta` param but not forwarded to any write-log call. |
| `POST /auth/login` (failed / lockout) | `auth.service.ts` | Failed auth events (brute-force evidence) not in audit trail. |
| `POST /auth/logout` | `auth.service.ts:160-170` | Logout (token revocation) not audited. |
| `POST /auth/reset-password` (successful) | `auth.service.ts:217-260` | Password reset completion not audited. Refresh token revocation at line 253 has no audit row. |
| `POST /users/me/change-password` | `users.service.ts:117-143` | The `changePassword` method does not call `audit.writeLog`. The surrounding `$transaction` only does `user.update` + `refreshToken.updateMany` — no audit entry. |

Per SRS §4 and the Phase 7 spec (structured logging + pino), all five of these should log `auth.login`, `auth.login.failed`, `auth.logout`, `auth.password_reset`, and `user.change_password` events with `actor_id + timestamp + IP`.

---

## 4. Spot-Check Findings

### M-01 (NEW) · A07 · `POST /auth/reset-password` has no dedicated rate limit
**File:** `apps/api/src/auth/auth.controller.ts:133`
**Evidence:** No `@Throttle` decorator on the handler. Global 100 req/min applies.
**Impact:** CVSS 3.1 5.3 (AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N). Once Phase 7 SMTP is wired, an attacker can attempt 100 token guesses per minute per IP. Reset tokens are 32 random bytes (256-bit opaque), making brute-force infeasible, but the unthrottled surface means the endpoint can be used for scraping errors, testing token validity at scale, and SMTP flooding downstream. The SRS Phase 1 spec called for "very tight — recommend 5/hour per email or IP" but this was never implemented.
**Recommendation:** Add `@Throttle({ default: { limit: 5, ttl: 3600000 } })` to the `resetPassword` handler. Phase 7 action.
**Owner:** gharsetu-backend
**Refs:** SRS §11.2, Phase 1 spec check #7 (advisory upgraded to MEDIUM)

---

### M-02 (NEW) · A05 · No test database isolation — integration tests run against dev DB schema
**File:** `apps/api/jest.config.cjs`, `apps/api/.env`
**Evidence:** `jest.config.cjs` has no `setupFiles` injecting a `TEST_DATABASE_URL`. The `.env` at `apps/api/.env` contains `DATABASE_URL=...schema=public`. No `.env.test` or `TEST_DATABASE_URL` override exists. Test teardown blocks (`afterAll`) delete data from the dev-default DB.
**Impact:** CVSS 3.1 4.6 (AV:L/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N). If a developer misconfigures the env and runs the integration suite against a staging database, the `afterAll` blocks will truncate real data. CI is safe because it spins a fresh docker-compose container, but the risk exists in developer workflows and in any environment where `DATABASE_URL` is not explicitly set to a scratch DB.
**Recommendation:** Add a `jest.config.cjs` `setupFiles` entry that overrides `process.env.DATABASE_URL` to a `?schema=test` variant (or a separate `gharsetu_test` database). Alternatively, add a `globalSetup` script that creates the test schema and enforces it is not the production schema.
**Owner:** gharsetu-backend + gharsetu-tester
**Refs:** OWASP A05

---

### M-03 (CARRY-OVER from Phase 3) · A09 · PII in tenant.update audit log — `dob`, `id_proof_number`, `emergency_contact_phone`
**File:** `apps/api/src/tenants/tenants.service.ts:154-161`
**Status:** Confirmed still open. Phase 3 M-03 was deferred to Phase 7. Full TENANT_SELECT spread into `before`/`after` audit fields.
**Phase 7 action:** Redact `dob`, `id_proof_number`, `emergency_contact_phone` in the `before`/`after` snapshot. See Phase 3 M-03 for full repro.

---

### M-04 (CARRY-OVER from Phase 2) · A01 · `forbidNonWhitelisted: false` on global ValidationPipe
**File:** `apps/api/src/app.module.ts:62`
**Status:** Confirmed still open. `whitelist: true` is set (unknown fields are stripped), but `forbidNonWhitelisted` remains `false` — clients sending malformed payloads receive no 400 error.
**Phase 7 action:** Set `forbidNonWhitelisted: true`.

---

### M-05 (CARRY-OVER from Phase 2) · A04 / BL-03 · BL-03 rent-lock state check is outside the write transaction
**File:** `apps/api/src/units/units.service.ts:154-200` (Phase 2 M-01 reference)
**Status:** Confirmed still open. Not addressed in Phases 3-6. Race between `PATCH /units/:id` (rent change) and `PATCH /units/:id/state` (→OCCUPIED) still possible.
**Phase 7 action:** Move state check inside `$transaction` with `SELECT FOR UPDATE`.

---

## 5. Carry-Over Items Dashboard

| Finding | Severity | Source Phase | Current Status | Phase 7 Action |
|---|---|---|---|---|
| path-to-regexp 0.1.12 ReDoS (GHSA-37ch-88jc-xwx2) | HIGH (library-level) / LOW for GharSetu | Phase 1 M-01 | OPEN — no pnpm override applied | Apply `"path-to-regexp": ">=0.1.13"` pnpm override in root `package.json`. 30 min. |
| lodash 4.17.21 code injection via `_.template` (GHSA-r5fr-rjxr-66jc) | HIGH (library-level) / LOW for GharSetu (not called) | Phase 1 L-03 | OPEN — transitive via `@nestjs/config@3.3.0` | Apply `"lodash": ">=4.18.0"` pnpm override. Or wait for `@nestjs/config` update. 30 min. |
| lodash prototype-pollution ×2 (GHSA-xxjr-mmjv-4gpg, GHSA-f23m-r3pf-42rh) | MODERATE | Phase 6 new via audit | OPEN | Same override as above — `>=4.18.0` fixes all three lodash advisories. |
| postcss XSS via `</style>` unescaping (GHSA-qx2v-qp2m-jg93) | MODERATE | Phase 6 new via audit | OPEN — transitive via `next@15.5.18 > postcss@8.4.31` | Upgrade `postcss` to `>=8.5.10` via pnpm override or wait for Next.js patch. 30 min. |
| `@nestjs/core` injection GHSA-36xv-jgw5-4q75 | MODERATE (High at library; no direct attack path in v1) | Phase 3 I-11 | OPEN — requires NestJS v11 migration (`>=11.1.18`) | Plan NestJS v10 → v11 upgrade in Phase 7 or Phase 8. Confirm no breaking changes in NestJS 11 against current module set. 4-8h. |
| Helmet absent — no secure HTTP headers | LOW | Phase 1 L-02 | OPEN — confirmed absent at `main.ts` | Wire `helmet()` in Phase 7 hardening pass. 1h. |
| Account lockout counter not reset on expiry | LOW | Phase 1 L-01 | OPEN — Phase 7 backlog | Reset `failed_login_count` to 0 when `locked_until < now` before proceeding. 30 min. |
| BL-19 P2002 not translated in `transferPm` | MEDIUM | Phase 2 M-02 | OPEN — no try/catch around `transferPm` transaction | Add P2002 catch → `409 PM_ALREADY_ASSIGNED`. 30 min. |
| BL-03 rent-lock state check outside transaction | MEDIUM | Phase 2 M-01 | OPEN | Move read + check inside `$transaction` with `FOR UPDATE`. 1h. |
| PII in tenant.update audit log | MEDIUM | Phase 3 M-03 | OPEN | Redact `dob`, `id_proof_number`, `emergency_contact_phone` from before/after snapshot. 1h. |
| Termination tx missing Serializable isolation (3 paths) | MEDIUM | Phase 3 M-01 | OPEN (leases module not re-reviewed in Phases 4-6) | Add `{ isolationLevel: "Serializable" }` to terminate-request, terminate-approve, terminate-withdraw. Also move `allLeaseTenants` read inside tx. 2h. |
| `forbidNonWhitelisted: false` | MEDIUM | Phase 2 L-03 | OPEN | Set `forbidNonWhitelisted: true` in `AppModule`. 15 min. |
| Tenant unit-ID enumeration oracle on `POST /maintenance-requests` | LOW | Phase 5 L-04 | OPEN | Return generic 404 for both "unit not found" and "no active lease" when actor is TENANT. 30 min. |
| Auth events not in audit_log (login, logout, reset, change-password) | MEDIUM (Gap) | Phase 6 new (§3) | OPEN | Inject AuditService into AuthService + UsersService changePassword. Log auth.login, auth.login.failed, auth.logout, auth.password_reset, user.change_password. 2h. |
| `POST /auth/reset-password` unthrottled (M-01 above) | MEDIUM | Phase 6 new | OPEN | Add `@Throttle({ default: { limit: 5, ttl: 3600000 } })`. 15 min. |
| Test DB not isolated from dev/staging DB | MEDIUM | Phase 6 new (M-02) | OPEN | Add `TEST_DATABASE_URL` override in jest config. 1h. |

---

## 6. Top 5 Phase 7 Wins (Ranked by Impact ÷ Effort)

### W-01 · Wire `helmet()` with a production-safe CSP
**Effort:** 1h
**Rationale:** One call in `main.ts` eliminates the entire A05 bucket for the API. `X-Powered-By` removal stops advertising the stack. `Strict-Transport-Security` prepares the API for TLS termination at the load balancer. A `Content-Security-Policy` header on the Next.js frontend (`next.config.ts`) should be added in the same pass. This is the single highest-leverage, lowest-effort security action available.
**Owner:** gharsetu-backend (API) + gharsetu-frontend (Next.js)

### W-02 · Flush all carry-over pnpm overrides in one PR
**Effort:** 2h (including regression test run)
**Rationale:** Four advisories (`path-to-regexp`, `lodash` ×3, `postcss`) are each solvable with a single-line pnpm override. Batching them eliminates 4 of 6 open `pnpm audit --prod` findings before the Phase 8 VAPT. The remaining two (`@nestjs/core` injection requiring v11 upgrade) should be a separate, higher-effort PR.
**Owner:** gharsetu-backend

### W-03 · Tighten sensitive-endpoint rate limits (`reset-password`, `change-password`) and add server-side idempotency key on `POST /payments`
**Effort:** 3h
**Rationale:** `POST /auth/reset-password` currently inherits 100 req/min (M-01). Adding `@Throttle` with 5/hour per IP takes 15 minutes. `POST /users/me/change-password` deserves a similar per-user tighter limit. Adding an `Idempotency-Key` header check on `POST /payments` (Phase 4 L-04 advisory) prevents PM double-submit at the server level and is 4h work already estimated by Phase 4 review.
**Owner:** gharsetu-backend

### W-04 · Add auth events to audit_log (login, logout, change-password, reset-password)
**Effort:** 2h
**Rationale:** The audit trail currently has zero auth events — it shows property mutations, lease changes, and payments, but no evidence of who logged in when, which is the first thing any forensic review needs. Injecting `AuditService` into `AuthService` and `UsersService.changePassword` and adding five event writes covers the most critical actor-identification gap. This is required for the Phase 7 "full audit log viewer" deliverable to be meaningful.
**Owner:** gharsetu-backend

### W-05 · Close the three remaining MEDIUM race conditions (BL-03, BL-19 transferPm, termination isolation)
**Effort:** 4h total
**Rationale:** BL-03 rent-lock outside transaction (Phase 2 M-01), BL-19 `transferPm` P2002 unhandled (Phase 2 M-02), and termination transactions lacking Serializable isolation (Phase 3 M-01) are all correctness + security findings. Each is a 1-2 line fix (move query into `$transaction`, add isolationLevel, add P2002 catch). Clearing all three closes the remaining MEDIUM business-logic race-condition backlog before Phase 8 VAPT scrutinises the transaction model.
**Owner:** gharsetu-backend

---

## 7. Sign-Off

**READY-FOR-PHASE-7**

No new HIGH or CRITICAL findings are introduced by Phase 6 code. All Phase 5 HIGHs confirmed resolved. The two carry-over HIGH dependency advisories (`path-to-regexp`, `lodash`) are latent — not directly exploitable via any current code path — and are scheduled for Phase 7 override PRs.

The five new/carry-over MEDIUMs (`reset-password throttle`, `test DB isolation`, `PII in audit log`, `forbidNonWhitelisted`, `auth events gap`) do not block Phase 7 from starting. All are Phase 7 hardening sprint items already aligned with the MASTER_PLAN §Phase 7 deliverables list.

Dynamic curl probes were NOT run (API is not running in the audit environment). Static analysis is conclusive for all findings above. Tester should re-run: `GET /rent-periods/<cross-property-id>` as PM-B (should 403, verify fix is stable), `GET /maintenance-requests/<cross-property-id>` as PM-B (same), and `POST /auth/reset-password` burst test (expect 429 after Phase 7 rate-limit fix is applied).

**gharsetu-security · 2026-05-11**
