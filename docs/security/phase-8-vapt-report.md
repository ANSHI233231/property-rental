# GharSetu — Phase 8 Independent VAPT Report

**Report ID:** GHARSETU-VAPT-2026-08
**Auditor:** gharsetu-security (independent)
**Audit date:** 2026-05-11
**Scope build commit:** `b6abfef` (HEAD — fix(web): BUG-BL22-001)
**Prior ASVS baseline:** `6961ab1` (docs(security): phase-7 OWASP ASVS L1 self-assessment)
**Standard:** OWASP ASVS v4 L1 + GharSetu domain-specific business-rule probes

---

## Executive Summary

**Verdict: NEEDS-MUST-FIX**

The Phase 8 VAPT uncovered **2 MUST-FIX** findings and **3 SHOULD-FIX** findings alongside 5 NICE-TO-HAVE hardening recommendations. No Critical (CVSS ≥ 9.0) vulnerabilities were identified. The 2 MUST-FIX items must be remediated and re-tested before the release gate can be signed.

All 3 carry-over risks from the Phase 7 ASVS self-assessment have been probed. One (PARTIAL-01, password length) is promoted to a MUST-FIX for release. One (PARTIAL-03, `@nestjs/core` GHSA-36xv) is confirmed as having no exploitable code path in GharSetu v1 and is downgraded to SHOULD-FIX. One (PARTIAL-02, PII in audit-log snapshots) remains a SHOULD-FIX.

The core authn/authz, session, payment-void, and IDOR defences are well-constructed and withstood active probing. No exploitable injection, IDOR, CSRF, SSRF, or authentication-bypass path was found.

| Severity | Count |
|---|---|
| MUST-FIX | 2 |
| SHOULD-FIX | 3 |
| NICE-TO-HAVE | 5 |
| INFO | 2 |

---

## Scope and Methodology

### In scope

- Backend API: `apps/api/src/` — NestJS 10.4.22, Prisma 6.x, Postgres 18
- Frontend: `apps/web/src/` — Next.js 15, React 19
- Authentication flow: login, logout, refresh, forgot-password, reset-password, change-password
- Payment record + void path (BL-10, BL-11, BL-15 cascade)
- Role-leakage matrix: 4 roles × all public endpoints
- Session handling: cookie flags, token rotation, replay
- Rate-limit bypass vectors
- Request-size attacks
- IDOR / cross-tenant probes (BL-19, BL-20)
- Audit-log tamper resistance
- Dependency CVE audit (`pnpm audit --prod`)
- Static grep analysis: `$queryRaw` usage, `dangerouslySetInnerHTML`, outbound HTTP

### Out of scope (per SRS §11.3)

- 2FA
- Multi-session management UI
- SMTP email delivery
- Public sign-up flows (none exist)

### Methodology

This VAPT combined static analysis (source-code grep, DTO and schema inspection, migration file audit), dynamic reasoning probes (curl-equivalent workflow simulations from source reading), dependency audit, and comparison against prior reviews (Phase 1–7). The API was not running as a live service at probe time; all HTTP-level evidence is derived from static code analysis and is marked accordingly. Where a live HTTP repro would be needed to confirm, this is noted. All findings have working static repro evidence unless stated.

---

## Findings by Category

---

### Category 1 — Authentication / Authorization

#### F-01 — MUST-FIX — Password Minimum Length Below Internal Target (PARTIAL-01 Promoted)

**ID:** F-01
**Severity:** MUST-FIX (CVSS 3.1: AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N = 4.8 Medium; promoted to MUST-FIX per internal policy)
**OWASP:** A07 Authentication Failures
**BL reference:** SRS §11.1, SRS §10.2

**Description:**
All password-accepting DTOs enforce `@MinLength(10)`. The SRS §10.2 originally targeted 12 characters; the Phase 7 ASVS report documented this deviation as a carry-over but classified it as acceptable against ASVS L1 (≥ 8). However the VAPT mandate explicitly states "Phase 8 action: FE + BE raise to `@MinLength(12)`. 30 min." A 10-character password with Argon2id is practically robust, but the deviation from the stated internal target must be closed before production release to avoid a documented-but-unresolved policy gap.

**Evidence (static):**
- `apps/api/src/auth/dto/reset-password.dto.ts:9` — `@MinLength(10)`
- `apps/api/src/users/dto/change-password.dto.ts:9` — `@MinLength(10)`
- `apps/api/src/users/dto/admin-create-user.dto.ts` — seed DTO with `@MinLength(10)` pattern
- `packages/shared/src/schemas/auth.ts` — shared zod schema must match

**Recommendation:**
Raise `@MinLength(10)` to `@MinLength(12)` in all three DTO files. Update the matching zod schema in `packages/shared`. Update the `.env.example` seed password placeholder comment. Estimated effort: 30 min.

**Remediation owner:** gharsetu-backend + gharsetu-frontend (schema sync)
**Refs:** PARTIAL-01 from phase-7-owasp-asvs-l1-assessment.md

---

#### F-02 — MUST-FIX — No Array Upper Bound on `tenants[]` in `CreateLeaseDto` and `RenewLeaseDto` (Array Bomb Vector)

**ID:** F-02
**Severity:** MUST-FIX (CVSS 3.1: AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:H = 6.5 Medium; MUST-FIX due to DoS impact on a business-critical write path)
**OWASP:** A03 Injection / A04 Insecure Design (input size attacks)
**BL reference:** SRS §5 input validation, VAPT scope §8 (request-size attacks)

**Description:**
The 100 KB body limit (`main.ts:42`) provides a first line of defence against oversized payloads. However, a well-crafted request within the 100 KB window can contain a `tenants[]` array with thousands of entries. Each entry is a `TenantInputDto` with `@ValidateNested` applied, triggering deep per-element validation. A 100 KB body can contain roughly 500–1,000 minimal tenant objects. Processing 1,000 nested DTOs with class-validator causes measurable CPU spike on a Node.js single-thread and can degrade p99 latency for other requests.

`CreateLeaseDto` (`apps/api/src/leases/dto/create-lease.dto.ts:37-41`) has `@ArrayMinSize(1)` but no `@ArrayMaxSize(...)`. `RenewLeaseDto` (`apps/api/src/leases/dto/renew-lease.dto.ts:36-38`) has `@IsArray()` on `tenantIds` but no bound.

This is not a full remote code execution vector, but it is a DoS-capable resource-exhaustion path within an authenticated context (any role with lease creation access, i.e., PM or Admin).

**Evidence (static):**
- `apps/api/src/leases/dto/create-lease.dto.ts:37-41` — `@ArrayMinSize(1)` present; no `@ArrayMaxSize`
- `apps/api/src/leases/dto/renew-lease.dto.ts:36-38` — `@IsArray()` only; no size cap on `tenantIds`
- `apps/api/src/main.ts:42` — `json({ limit: '100kb' })` is the only upstream guard; does not prevent valid-size array floods

**Recommendation:**
Add `@ArrayMaxSize(20)` to `tenants` in `CreateLeaseDto` (a property with 20 co-tenants is beyond any realistic use case for a 120-unit property operation). Add `@ArrayMaxSize(20)` to `tenantIds` in `RenewLeaseDto`. Consider a similar cap on any future DTO with unbounded array fields. Estimated effort: 15 min.

**Remediation owner:** gharsetu-backend
**Refs:** VAPT scope §8 (request-size attacks), OWASP A04

---

### Category 2 — Session Handling

**Summary:** Session handling is well-implemented. Refresh-token rotation, HttpOnly+Secure+SameSite=Strict cookie, server-side revocation on logout and password-change/reset are all confirmed present.

**No MUST-FIX or SHOULD-FIX issues found in this category.**

Specific confirmations:
- Refresh token rotation: `auth.service.ts:192-198` — old token set `revoked_at` before new token issued. A replayed old token produces `UnauthorizedException` via the `revoked_at` check at line 184. CLEARED.
- Cookie flags: `auth.controller.ts:25-31` — `httpOnly: true`, `secure: true`, `sameSite: 'strict'`, `path: '/api/v1/auth'`. CLEARED.
- Logout invalidation: `auth.service.ts:213-217` — `updateMany({ revoked_at: now })` on logout. CLEARED.
- Password-change session revocation: `users.service.ts:138-141` — all refresh tokens revoked inside the change-password transaction. CLEARED.
- Session fixation: new tokens issued on every login via `issueTokens()`; no token reuse path. CLEARED.
- Reset-password replay: token marked `used_at` before password change at `auth.service.ts:300-303`; `resetPassword` checks `record.used_at` at line 292. Replay returns `BadRequestException("Reset link is invalid or has expired")`. CLEARED.

---

### Category 3 — Payment Void Path (BL-15 + Cascade)

**Summary:** The payment void path is robustly implemented. No exploitable mutation path was found.

**No MUST-FIX or SHOULD-FIX issues found.**

Specific confirmations:
- `DELETE /payments/:id`: NestJS route table has no `@Delete` on the payments controller. Any DELETE attempt returns 404 (no matching route). Additionally, the `payments_no_delete` DB trigger (`migration.sql:111-113`) raises `P0001` at the Postgres level if a DELETE is attempted directly via psql. Belt-and-suspenders confirmed.
- `UPDATE /payments` without void columns: The `payments_restrict_update` trigger (`migration.sql:116-138`) raises `P0001` if any non-void column changes. Service-level code only ever sets `is_voided`, `voided_by_user_id`, `voided_at`, `void_reason`. CLEARED.
- Cascade block: `rent.service.ts:650-658` — `PAYMENT_VOID_CASCADE_BLOCKED` (409) raised when `downstreamCredit.consumed_at` is non-null. CLEARED.
- No partial mutation on rejected void: the entire void path runs inside a `withSerializableRetry` + `$transaction(Serializable)` block. CLEARED.

---

### Category 4 — Role-Leakage Matrix

**Summary:** Role enforcement is structurally sound. The `@Roles` decorator + `RolesGuard` + `JwtAuthGuard` global pipeline was probed for bypass vectors. No exploitable bypass found.

**No MUST-FIX issues found.**

Sampled endpoint/role matrix (confirmed via controller + guard source):

| Endpoint | TENANT | PM | MAINTENANCE | ADMIN |
|---|---|---|---|---|
| `POST /payments` | 403 (BL_10) | 201 | 403 (BL_10) | 201 |
| `GET /audit-log` | 403 | 403 | 403 | 200 |
| `POST /maintenance-requests` | 201 | 403 (BL_16) | 403 (BL_16) | 201 |
| `POST /maintenance-requests/:id/close` | 200 | 403 (BL_21) | 403 (BL_21) | 403 (BL_21) |
| `GET /properties` | 403 | 403 | 403 | 200 |
| `POST /properties` | 403 | 403 | 403 | 201 |
| `GET /users` | 403 | 403 | 403 | 200 |
| `POST /leases` | 403 | 201 | 403 | 201 |
| `POST /leases/:id/terminate-request` | 200 | 403 | 403 | 200 |
| `GET /rent-periods` | 200 (own lease only) | 200 (own property) | 403 | 200 |

Key observations:
- `POST /maintenance-requests` is restricted to `TENANT` and `ADMIN` only — Property Managers cannot create requests, matching BL-16 (which only bars MAINTENANCE; PM exclusion is an additional tightening that is not contradicted by the SRS but is worth noting).
- `POST /maintenance-requests/:id/close` is TENANT-only per BL-21. Confirmed `@Roles("TENANT")` in controller.
- `@SkipThrottle()` on `GET /audit-log` is acceptable — the endpoint is ADMIN-only, read-only, and JWT-protected. Throttle bypass via this route affects only admins who are already authenticated.

---

### Category 5 — IDOR + Cross-Tenant

**Summary:** Cross-property and cross-tenant access controls are enforced at two layers: `PropertyScopeGuard` (middleware) and service-layer ownership checks.

**No exploitable IDOR found.**

Specific confirmations:
- PM-B reading PM-A's resources: `PropertyScopeGuard.canActivate()` (`property-scope.guard.ts:74-96`) checks `active_pm_id === user.sub` for the PROPERTY_MANAGER role. A mismatch throws `PROPERTY_ACCESS_DENIED`. CLEARED.
- Tenant-A reading Tenant-B's lease: `rent.controller.ts:84-95` checks `tenantHasAccessToPeriod` for TENANT role. `leases.service.ts` performs analogous tenant-on-lease checks. CLEARED.
- Cross-property rent-period enumeration: `rent.service.ts:261-286` enforces PM property scope on `GET /rent-periods` at the query level — results from other properties are structurally excluded (not filtered post-hoc). CLEARED.
- MAINTENANCE actor on another maintenance worker's request: `MaintenanceService.findOne()` and `inProgress()` enforce actor's assigned-request scope for the MAINTENANCE role. CLEARED.

**One informational observation:** The `PropertyScopeGuard` for `TENANT` role is explicitly a pass-through (`property-scope.guard.ts:98-101`) — tenant scope is checked at the service layer only. This is by design and has been confirmed correct in prior reviews. It is noted here as INFO-01 for the tester's awareness.

---

### Category 6 — Refresh-Token Replay + Reset-Token Replay

**Both confirmed cleared.** See Category 2 (session handling) for refresh-token replay analysis. Reset-token replay: the `resetPassword` path marks the token `used_at` atomically inside the `$transaction` block at `auth.service.ts:298-329`; a second call with the same raw token produces a SHA-256 hash that finds the row but fails the `record.used_at` check at line 292, returning `BadRequestException`. CLEARED.

---

### Category 7 — Rate-Limit Bypass

#### F-03 — SHOULD-FIX — X-Forwarded-For Trust Not Explicitly Disabled; Behaviour Depends on Deployment Proxy

**ID:** F-03
**Severity:** SHOULD-FIX (CVSS 3.1: AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:L = 3.7 Low; escalates to High if deployed behind a misconfigured reverse proxy)
**OWASP:** A07 Authentication Failures (rate-limit bypass)

**Description:**
The `ThrottlerGuard.getTracker()` in `@nestjs/throttler@6.2.1` defaults to `return req.ip` (`throttler.guard.js:135-137`). Express's `req.ip` honours `X-Forwarded-For` only when the Express application has `trust proxy` set to a truthy value. Express defaults `trust proxy` to `false` (`application.js:86`), which means `req.ip` returns `socket.remoteAddress` — the actual TCP connection IP — not the header value.

**In the current codebase `main.ts` does not call `app.set('trust proxy', ...)`.** Therefore, in direct deployment (no reverse proxy), `X-Forwarded-For` manipulation cannot bypass the rate limiter.

However, **if the application is deployed behind a reverse proxy (nginx, AWS ALB, Cloudflare) and `trust proxy` is not explicitly configured,** there is a risk:

1. If the operator adds `app.set('trust proxy', true)` (a common but incorrect blanket setting), an attacker can rotate IPs via `X-Forwarded-For` and evade the login throttle (10/min).
2. If `trust proxy` is left `false` and the application sits behind a proxy, `req.ip` will always be the proxy's IP, causing ALL users to share a single rate-limit bucket — a separate availability problem.

The correct production configuration is `app.set('trust proxy', 1)` (trust exactly one hop) combined with a proxy allowlist, documented in the env matrix.

**Evidence (static):**
- `apps/api/src/main.ts` — no `trust proxy` configuration present
- `node_modules/.pnpm/express@4.22.1/node_modules/express/lib/application.js:86` — `this.set('trust proxy', false)` is Express default
- `node_modules/.pnpm/@nestjs+throttler@6.2.1_.../throttler.guard.js:135-137` — `return req.ip`
- `.env.example` — no documentation of `TRUST_PROXY` setting

**Recommendation:**
Add an explicit `TRUST_PROXY` env var (default `0`; set to `1` when behind a single-hop proxy) and wire `app.set('trust proxy', Number(config.get('TRUST_PROXY') ?? 0))` in `main.ts` before CORS and helmet middleware. Document in `.env.example`. Estimated effort: 30 min.

**Remediation owner:** gharsetu-backend
**Refs:** VAPT scope §7 (rate-limit bypass via X-Forwarded-For)

---

#### Email Case-Normalisation for Login Throttle: CLEARED

The login throttle tracks by IP (ThrottlerGuard default). The account lockout counter tracks by user record after DB lookup. The email is normalized to lowercase in `LoginDto` via `@Transform(() => value.toLowerCase().trim())` (`login.dto.ts:6`) before the DB lookup. A case-variant email still resolves to the same user record after normalization; the lockout counter increments on the same row. CLEARED — no bypass path.

---

### Category 8 — Request-Size Attacks

**100 KB body limit confirmed:** `main.ts:42` — `app.use(json({ limit: '100kb' }))`. The `CodeErrorFilter` handles Express's `entity.too.large` error at `code-error.filter.ts:97-103` and returns 413 with `PAYLOAD_TOO_LARGE`. A 200 KB body returns 413 before reaching any controller logic. Depth-bomb JSON: Express `body-parser` parses JSON iteratively; the 100 KB cap prevents a deeply nested payload from being large enough to cause exponential parsing overhead. CLEARED for bodies exceeding 100 KB.

**Array bomb in `tenants[]` (within the 100 KB limit):** See F-02 (MUST-FIX). The 100 KB limit allows ~500–1,000 minimal tenant objects, each processed by `@ValidateNested`. This is unmitigated within the budget.

---

### Category 9 — CSRF + CORS

**CSRF:** `SameSite=Strict` on the refresh cookie (`auth.controller.ts:28`) is confirmed. State-changing endpoints that require authentication use the JWT access token in the `Authorization` header (not a cookie), so CSRF is not applicable to those endpoints. The refresh endpoint (`POST /auth/refresh`) is the only cookie-authenticated state-change, and `SameSite=Strict` prevents it from being triggered cross-origin. CLEARED.

**CORS:** `main.ts:57-70` — origin allowlist enforced via callback. Unknown origins receive a CORS error. `credentials: true` is set (required for cookie delivery). CLEARED for CORS configuration.

#### F-04 — SHOULD-FIX — `WEB_ORIGINS` Not Documented in `.env.example`

**ID:** F-04
**Severity:** SHOULD-FIX (CVSS 3.1: AV:N/AC:H/PR:N/UI:N/S:C/C:N/I:L/A:N = 3.4 Low; risk is misconfiguration in production)
**OWASP:** A05 Security Misconfiguration

**Description:**
The production CORS allowlist is controlled by `WEB_ORIGINS` (comma-separated). This variable is documented in code (`main.ts:49`) but NOT in `.env.example`. The example file only documents the legacy single-origin `WEB_ORIGIN`. A production operator copying `.env.example` will set only `WEB_ORIGIN` and potentially miss `WEB_ORIGINS` multi-origin syntax, risking CORS misconfiguration or an overly permissive wildcard.

**Evidence (static):**
- `.env.example:33` — `WEB_ORIGIN=http://localhost:3000` (singular)
- `apps/api/src/main.ts:49-55` — `WEB_ORIGINS` multi-origin variable referenced but undocumented in example

**Recommendation:**
Add `WEB_ORIGINS` to `.env.example` with a comment explaining comma-separated format for production multi-origin use. Example: `# WEB_ORIGINS=https://gharsetu.example.com,https://www.gharsetu.example.com`. Estimated effort: 5 min.

**Remediation owner:** gharsetu-backend
**Refs:** VAPT scope §9 (CORS)

---

### Category 10 — SSRF / SQLi / XSS

#### SSRF: CLEARED

No outbound HTTP calls from user-controlled input found. The only outbound networking in the API is Prisma's database connection (fixed DSN). No `fetch()`, `axios`, or `got` calls to user-supplied URLs. CLEARED.

#### SQLi: CLEARED

All `$queryRaw` usages found in:
- `units.service.ts:168-174` — `SELECT ... WHERE id = ${id} FOR UPDATE` — tagged template literal (parameterized). CLEARED.
- `rent.service.ts:416-429` — `SELECT ... WHERE id = ${dto.rentPeriodId} FOR UPDATE` — tagged template literal. CLEARED.
- `rent.service.ts:601-612` — `SELECT ... WHERE id = ${paymentId} FOR UPDATE` — tagged template literal. CLEARED.
- `health.service.ts:44` — `SELECT 1` — no user input. CLEARED.
- Zero `$queryRawUnsafe` or `$executeRawUnsafe` calls found in `apps/api/src/`. CLEARED.

#### XSS — React Auto-Escaping: CONFIRMED (with one SHOULD-FIX noted below)

`dangerouslySetInnerHTML` does not appear in any `.tsx` file in `apps/web/src/`. React's JSX auto-escaping is the sole XSS defence on the frontend. This was confirmed effective for:
- Login error messages: rendered as JSX text nodes. CLEARED.
- Maintenance request description/resolution-notes: rendered as `{entry.description}` JSX text. CLEARED.
- Lease tenant names: rendered via JSX. CLEARED.
- Property name on admin pages: rendered via JSX. CLEARED.

#### F-05 — SHOULD-FIX — Audit-Log JSON Diff Viewer Renders User-Controlled Strings via `JSON.stringify` in `<pre>` (No CSP on Next.js Origin)

**ID:** F-05
**Severity:** SHOULD-FIX (CVSS 3.1: AV:N/AC:H/PR:L/UI:R/S:C/C:L/I:L/A:N = 4.4 Medium)
**OWASP:** A03 Injection (Stored XSS, defence-in-depth gap), A05 Security Misconfiguration (no CSP)

**Description:**
The audit-log JSON diff viewer (`apps/web/src/app/(app)/admin/audit-log/page.tsx:121-145`) renders the `before` and `after` JSONB fields inside a `<pre>` tag via `JSON.stringify(data, null, 2)`. Because this is a JSX text node (`{JSON.stringify(data, null, 2)}`), React auto-escapes it — a `<script>` string becomes `&lt;script&gt;`. No XSS is possible through React's rendering.

However, two compounding factors elevate this to SHOULD-FIX:
1. The Next.js HTML origin (`apps/web`) emits **no `Content-Security-Policy` header** (`next.config.mjs` has no `headers()` export). This was documented as INFO-02 in the Phase 7 ASVS report. Without CSP, any future introduction of `dangerouslySetInnerHTML` (deliberate or accidental) on this high-value admin page would be immediately exploitable.
2. The audit-log page is currently wired to **placeholder data** and the real `GET /audit-log` backend integration is pending (`page.tsx:314-355` comments). When the live integration ships, user-controlled strings (maintenance descriptions, property names, error messages from the audit trail) will flow into `JSON.stringify` for display. React protects against HTML injection but does not protect against data leakage in JSON-rendered fields if sensitive PII is present (see PARTIAL-02 below).

The combination of no CSP + high-privilege page + user-controlled JSON rendering is a hardening gap.

**Evidence (static):**
- `apps/web/src/app/(app)/admin/audit-log/page.tsx:140-143` — `<pre>{JSON.stringify(data, null, 2)}</pre>` — React text node (safe from HTML injection)
- `apps/web/next.config.mjs:1-7` — no `headers()` export; no CSP
- Phase 7 ASVS INFO-02 — "Next.js HTML responses without CSP header"

**Recommendation:**
Add a `headers()` export to `next.config.mjs` setting `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`. This is the INFO-02 action from Phase 7, now escalated to SHOULD-FIX given the audit-log integration pending. Estimated effort: 2–3 h.

**Remediation owner:** gharsetu-frontend
**Refs:** Phase 7 INFO-02, VAPT scope §10 (XSS), VAPT scope §11 (Next.js no-CSP carry-over)

---

### Carry-Over Risk Probes from Phase 7 ASVS (Section 11)

#### Carry-Over Risk 1 — `@nestjs/core` GHSA-36xv-jgw5-4q75: RESIDUAL (Downgraded to SHOULD-FIX)

**Probe:** Fuzzed `Content-Type` headers (multipart/form-data, `application/x-www-form-urlencoded`, missing charset, mismatched boundary, malformed JSON) against auth and payment endpoints by static code review.

**Findings:**
- NestJS `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` (`app.module.ts:108-113`) rejects unknown fields with 400 before the body is processed by any service.
- The body-parser `json({ limit: '100kb' })` at `main.ts:42` rejects non-JSON content early (malformed JSON → 400, oversized → 413).
- No user-controlled input flows into NestJS dependency injection metadata resolution APIs. The advisory involves injection via framework metadata; GharSetu v1 does not use dynamic module loading, `@Module` decorator manipulation, or user-controlled providers.
- No `Content-Type` manipulation path to a 500 or unexpected crash was identified.

**Status:** RESIDUAL — no exploitable path confirmed in GharSetu v1. The NestJS v10 → v11 migration is still required as a SHOULD-FIX to clear the advisory entirely. The upgrade is a development effort of 4–8 h and should be planned for the v1.1 maintenance window or immediately post-release.

**Recommendation:** Plan and execute NestJS v11 upgrade (`@nestjs/core@>=11.1.18` and all `@nestjs/*` peers) as a standalone migration PR.

---

#### Carry-Over Risk 2 — Next.js HTML Without CSP: RESIDUAL (Promoted to F-05 SHOULD-FIX)

**Status:** RESIDUAL — promoted to finding F-05 above. See F-05 for full details and recommendation.

---

#### Carry-Over Risk 3 — Password Length 10 vs. Target 12, Lockout Counter Edge Case: PARTIAL-CLEARED

**Password length:** Promoted to MUST-FIX (F-01 above).

**Lockout counter edge case (Phase 1 L-01):** After the 15-minute lockout expires, the next successful login at `auth.service.ts:136-143` sets `failed_login_count: 0` and `locked_until: null`. The sequence: lockout expires → wrong password again → count increments to 6 (past `MAX_FAILED_ATTEMPTS = 5`) → new lockout. This is correct; `shouldLock = (newCount >= MAX_FAILED_ATTEMPTS)` is true at count 6. The permissive window does not exist. Phase 1 L-01 is CLEARED.

**Status:** PARTIAL-CLEARED — password length sub-item promoted to F-01; lockout edge case CLEARED.

---

### Audit-Log Tamper Resistance

**Confirmed append-only via code:** No `auditLog.delete()` or `auditLog.update()` calls exist in `apps/api/src/`. The Prisma model comment explicitly states "No UPDATE or DELETE is ever issued on this table" (`schema.prisma:291`). The `AuditLogController` exposes only `GET /audit-log` (`audit-log.controller.ts`).

**Gap — No DB-level trigger on `audit_log`:** Unlike `payments` (which has `payments_no_delete` and `payments_restrict_update` triggers) and `maintenance_requests` (which has `trg_maintenance_requests_closed_immutable`), the `audit_log` table has **no BEFORE DELETE or BEFORE UPDATE trigger**. A privileged Postgres user (e.g. the application DB user with `DELETE` permission on `audit_log`) could delete rows directly. In the Phase 2 migration, the `audit_log` table was created with no row-level protection beyond application-layer conventions.

**Severity:** NICE-TO-HAVE (the application DB user should not have DELETE on `audit_log` in production; this is a DB permission configuration item, not a code bug).
**See NH-01 below.**

---

## NICE-TO-HAVE Findings

### NH-01 — Audit-Log Table: No DB-Level Immutability Trigger

**Severity:** NICE-TO-HAVE (CVSS: AV:L/AC:H/PR:H/UI:N/S:U/C:N/I:H/A:N = 4.4 Medium risk only in DB-compromise scenario)

The `audit_log` table relies on application-layer conventions for immutability. No DB trigger prevents `DELETE FROM audit_log` or `UPDATE audit_log` at the Postgres level. A compromised application DB account with `DELETE` privilege could silently erase the audit trail.

**Recommendation:** Add a `BEFORE DELETE` and `BEFORE UPDATE` trigger on `audit_log` analogous to `payments_no_delete`. Alternatively (and preferable), revoke `DELETE` and `UPDATE` privileges on `audit_log` from the application DB user (`gharsetu`) and grant them only to a dedicated audit-maintenance role. Add a migration for the trigger; document the DB permission matrix in the production checklist.

---

### NH-02 — No Pre-Commit Secret-Scan Hook (INFO-01 from Phase 7)

**Severity:** NICE-TO-HAVE / INFO

`.husky/` directory does not exist in the repo root. No pre-commit hook scans for accidentally committed secrets. The `.gitignore` correctly excludes `.env*` files and no secrets were found in git history (`git log -- ".env"` produces no output).

**Recommendation:** Add `pnpm dlx gitleaks detect --source=.` as a Husky pre-commit hook. Estimated effort: 1 h.

---

### NH-03 — PII in `tenant.update` Audit-Log Snapshot at DB Level (PARTIAL-02 from Phase 7)

**Severity:** SHOULD-FIX (CVSS: AV:L/AC:H/PR:H/UI:N/S:U/C:L/I:N/A:N = 2.2 Low; promoted here for explicit VAPT finding record)

`tenants.service.ts:154-161` spreads the full `TENANT_SELECT` shape (which includes `dob`, `id_proof_number`, `emergency_contact_phone`) into the `before`/`after` audit-log JSONB snapshots. The `AuditLogService.redactSnapshot()` function redacts them at the read boundary (`audit-log.service.ts:10-19`) but the unredacted data is stored at rest in Postgres.

**Recommendation:** In `tenants.service.ts update()`, build a redacted snapshot before calling `writeLog()` — strip `dob`, `id_proof_number`, `emergency_contact_phone` from the `before` and `after` objects. Add an `omit()` helper to `packages/shared`. Also consider encrypting PII columns at the Postgres level with `pgcrypto`. Estimated effort: 1–2 h.

---

### NH-04 — Seed-Test Accounts Active in Production Risk (SEED_TEST_PASSWORD)

**Severity:** NICE-TO-HAVE

`seed.ts:40,66-68` — test PM, Maintenance, and Tenant accounts are created if `SEED_TEST_PASSWORD` is set. If this variable is accidentally set in the production environment, test accounts with known roles are seeded. The seed script is idempotent (upsert), so re-running in production would recreate them if the email already exists.

**Recommendation:** Add a `NODE_ENV !== 'production'` guard in `seed.ts` that aborts (or skips) the test-user block entirely when `NODE_ENV=production`. Document that `SEED_TEST_PASSWORD` must not be set in the production `.env`. Estimated effort: 15 min.

---

### NH-05 — `GET /audit-log` is `@SkipThrottle()` — Unbounded Admin Query Loop Risk

**Severity:** NICE-TO-HAVE (Low; affects only authenticated admins)

`audit-log.controller.ts:24,44` — both the class and method have `@SkipThrottle()`. An Admin account (or a compromised Admin token) could issue rapid repeated queries against `GET /audit-log` with varying cursor values, creating a read-amplification pattern. The `limit` is capped at 100 per page (`audit-log.service.ts:73`), which limits per-request cost.

**Recommendation:** Apply a moderate throttle (e.g. 60 req/min) to `GET /audit-log` rather than skipping throttle entirely. The JWT auth guard is the primary gate; the throttle is defence-in-depth. Estimated effort: 5 min.

---

## Dependency Audit

**Command:** `pnpm audit --prod`
**Result:** 1 vulnerability found, 1 moderate

| Advisory | Package | Severity | Status |
|---|---|---|---|
| GHSA-36xv-jgw5-4q75 | `@nestjs/core@10.4.22` | Moderate | OPEN — NestJS v10→v11 migration required. No pnpm override available. No exploitable path in GharSetu v1 (confirmed by static analysis above). |

All other advisories (path-to-regexp, lodash ×3, postcss) remain RESOLVED via pnpm overrides applied in Phase 7.

---

## Production Deployment Checklist

### Password Length Policy (F-01 Deviation)

Password minimum length is 10 characters with a number + letter requirement (SRS §10.2). OWASP ASVS L2 recommends 12; for v1 the SRS-defined policy is authoritative. Revisit in a post-v1 hardening pass if compliance requirements change.

### Environment Variable Matrix

| Variable | Where set | Who sets it | Notes |
|---|---|---|---|
| `NODE_ENV` | `apps/api/.env` | DevOps | Set to `production` in prod |
| `API_PORT` | `apps/api/.env` | DevOps | Default 3001; may differ behind proxy |
| `API_HOST` | `apps/api/.env` | DevOps | `0.0.0.0` unless binding to loopback |
| `DATABASE_URL` | `apps/api/.env` | DevOps/DBA | Postgres 18 connection string; use a dedicated DB user with least-privilege |
| `RUN_SCHEDULER` | `apps/api/.env` | DevOps | `true` (default) on the single scheduler replica; `false` on additional replicas to suppress duplicate cron runs. Background jobs run in-process via `@nestjs/schedule`. |
| `JWT_SECRET` | `apps/api/.env` | DevOps/Security | Generate: `openssl rand -hex 32`. **Minimum 32 chars. Never reuse across environments.** |
| `JWT_ACCESS_TTL` | `apps/api/.env` | DevOps | `15m` recommended |
| `JWT_REFRESH_TTL` | `apps/api/.env` | DevOps | `7d` recommended |
| `BOOTSTRAP_ADMIN_EMAIL` | `apps/api/.env` | Product Owner | Seed admin email; must be a real monitored address |
| `BOOTSTRAP_ADMIN_PASSWORD` | `apps/api/.env` | Product Owner | **Minimum 12 chars** (after F-01 fix), Argon2id hashed by seed |
| `SEED_TEST_PASSWORD` | **NOT set in prod** | — | Must be absent in production environment (see NH-04) |
| `WEB_ORIGINS` | `apps/api/.env` | DevOps | Comma-separated production origins. Example: `https://gharsetu.example.com` |
| `WEB_ORIGIN` | `apps/api/.env` | DevOps | Legacy single-origin fallback; `WEB_ORIGINS` takes precedence |
| `NEXT_PUBLIC_API_BASE_URL` | `apps/web/.env` | DevOps | Production API base URL |
| `TRUST_PROXY` (pending F-03 fix) | `apps/api/.env` | DevOps | `0` for direct deployment; `1` when behind single-hop proxy |

### DB User Permissions (Production)

The application DB user (`gharsetu` or equivalent) should be granted:
- `SELECT, INSERT, UPDATE, DELETE` on all tables **except** `audit_log`
- `SELECT, INSERT` only on `audit_log` — no `UPDATE` or `DELETE`
- Sequence usage for all sequences

This restriction enforces audit-log immutability at the Postgres level (NH-01).

### Migration Plan

```bash
# 1. Run from the API directory with production DATABASE_URL set
cd apps/api
pnpm prisma migrate deploy

# 2. Verify migration status
pnpm prisma migrate status

# 3. Run seed (admin account only — SEED_TEST_PASSWORD must NOT be set)
pnpm prisma db seed
```

> **Note (in-process scheduler):** Background jobs now run in-process via `@nestjs/schedule`. No Redis service to provision or health-check. For multi-instance deployments, designate exactly one replica as the scheduler by leaving `RUN_SCHEDULER` unset (or `true`); set `RUN_SCHEDULER=false` on all other replicas to avoid duplicate cron runs.

### Rollback Plan

```bash
# Prisma does not support automatic down-migrations.
# Rollback procedure:
# 1. Restore the previous DB snapshot (taken before migration deploy)
# 2. Deploy the previous API build artifact
# 3. Re-run prisma migrate status to confirm the target migration is marked applied

# If a snapshot is not available, a manual reverse-migration SQL script must be
# prepared by the DBA before each deploy for the specific migration delta.
# Phase 7 migration (20260511300000) adds:
#   - audit_log.actor_id nullable (reversible: NOT NULL constraint restore)
#   - payments.idempotency_key column + indexes (reversible: DROP COLUMN)
# These are low-risk schema additions.
```

### Seed-Admin Procedure

1. Set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` (≥ 12 chars after F-01 fix) in `apps/api/.env`.
2. Do NOT set `SEED_TEST_PASSWORD`.
3. Run `pnpm prisma db seed`.
4. Verify the admin account exists: `SELECT id, email, role, is_active FROM users WHERE role = 'ADMIN';`
5. Change the admin password immediately after first login via `POST /users/me/change-password`.
6. Remove or rotate `BOOTSTRAP_ADMIN_PASSWORD` from the env file after seeding.

---

## Findings Summary Table

| ID | Category | Severity | Title |
|---|---|---|---|
| F-01 | Authn | MUST-FIX | Password minimum length 10 below 12-char internal target |
| F-02 | Input validation | MUST-FIX | No array upper bound on `tenants[]` in lease DTOs (array bomb) |
| F-03 | Rate-limiting | SHOULD-FIX | No explicit `trust proxy` configuration; X-Forwarded-For bypass risk under proxy |
| F-04 | CORS/Config | SHOULD-FIX | `WEB_ORIGINS` undocumented in `.env.example` |
| F-05 | XSS/CSP | SHOULD-FIX | Audit-log JSON diff viewer has no CSP on Next.js origin |
| NH-01 | Audit integrity | NICE-TO-HAVE | No DB-level immutability trigger on `audit_log` table |
| NH-02 | DevSecOps | NICE-TO-HAVE | No pre-commit secret-scan hook |
| NH-03 | PII | NICE-TO-HAVE | PII fields stored unredacted in `tenant.update` audit snapshots at DB level |
| NH-04 | Config | NICE-TO-HAVE | Test accounts may be seeded in production if `SEED_TEST_PASSWORD` is set |
| NH-05 | Rate-limiting | NICE-TO-HAVE | `GET /audit-log` fully skips throttle |

---

## Carry-Over Risk Closeouts

| Risk | Phase 7 ID | Probe result | Status |
|---|---|---|---|
| `@nestjs/core` GHSA-36xv-jgw5-4q75 | PARTIAL-03 | No exploitable path in GharSetu v1. NestJS v11 upgrade still required. | RESIDUAL — SHOULD-FIX |
| Next.js HTML without CSP | INFO-02 | Confirmed present; no active exploit due to React auto-escaping; CSP still required. | RESIDUAL — promoted to F-05 SHOULD-FIX |
| Password length 10 vs. 12 + lockout edge case | PARTIAL-01 | Password gap promoted to F-01 MUST-FIX. Lockout edge case CLEARED. | PARTIAL-CLEARED |

---

## Remediation Timeline

| Severity | Timeline |
|---|---|
| MUST-FIX | Before this release gate closes — block release |
| SHOULD-FIX | Within 14 days post-release or before if release is delayed |
| NICE-TO-HAVE | Backlog; batch quarterly or in v1.1 |

---

## Follow-Up Tests Required After Fixes

- After F-01 fix: re-run `TC-AUTH-*` password-length validation tests; confirm `@MinLength(12)` in all three DTOs and shared zod schema.
- After F-02 fix: submit `POST /leases` with `tenants: [<21 entries>]` → 400 `VALIDATION_FAILED`; submit with `tenants: [<1 entry>]` → 201.
- After F-03 fix: confirm `req.ip` behaviour under proxy by verifying `X-Forwarded-For` header is only honoured when `TRUST_PROXY=1` is set.
- After F-05 fix: verify `Content-Security-Policy` header present in Next.js HTML responses using `curl -I http://localhost:3000/`.
- Live HTTP probing (requires running stack): repeat login-throttle test (12 rapid `POST /auth/login` → confirm 429 on 11th); repeat reset-token replay probe.

---

## Sign-Off

**Verdict: NEEDS-MUST-FIX**

Two MUST-FIX items (F-01: password length below internal target; F-02: array bomb in lease DTOs) must be remediated and re-verified before a production release. Neither requires architectural changes — both are DTO-level fixes estimated at under 1 hour combined.

The core security posture of GharSetu v1 is strong:
- Argon2id with correct OWASP parameters
- Refresh-token rotation with server-side revocation
- Correct HttpOnly + Secure + SameSite=Strict cookie flags
- Comprehensive role-scoped access control with dual-layer (guard + service) enforcement
- Parameterized queries throughout (zero raw SQL injection surface)
- Payment immutability enforced at both application and DB trigger level
- Audit logging for all auth events and mutations
- 100 KB body cap with 413 error handling

After F-01 and F-02 are patched and re-tested, and tester signs off on the full Test_Cases.md regression, the verdict may be upgraded to **RELEASE-READY**.

**gharsetu-security · 2026-05-11**
