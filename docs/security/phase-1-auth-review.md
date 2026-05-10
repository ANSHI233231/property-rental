# Phase 1 — Auth Backend Security Review
**Reviewer:** gharsetu-security
**Date:** 2026-05-10
**Backend commits in scope:** c6996b3 → 6b362cb

---

## Summary

FAIL — 2 HIGH findings block the tester. The rate-limit enforcement is entirely absent at runtime (ThrottlerGuard registered but never applied as a guard), and the reset-password plaintext token is emitted unconditionally via NestJS Logger even in production because there is no NODE_ENV guard. Additionally, 3 HIGH-severity CVEs are confirmed in the API dependency tree (multer ×3, path-to-regexp, lodash — multer and path-to-regexp are transitive via @nestjs/platform-express). One MEDIUM and two LOW findings complete the picture. The Argon2id implementation, refresh-token storage, cookie flags, JWT configuration, anti-enumeration, account lockout, password policy, public-signup absence, and env hygiene all pass.

---

## Findings

### HIGH

#### H-01 · A07 · Rate-limit decorator has no active guard — throttling is unenforced

**Evidence:** `apps/api/src/auth/auth.module.ts:18-26` — `ThrottlerModule.forRootAsync` is imported, which registers the throttler configuration. `apps/api/src/auth/auth.controller.ts:41,120` — `@Throttle({ default: { limit: 100, ttl: 60000 } })` decorators are applied to `/auth/login` and `/auth/forgot-password`. However, no file in the entire API source tree contains `ThrottlerGuard`, `APP_GUARD`, or `@UseGuards(ThrottlerGuard)`. The `@Throttle()` decorator is pure NestJS metadata; without a guard reading that metadata and enforcing the limit, it is a no-op. Grep evidence:

```
grep -rn "APP_GUARD|ThrottlerGuard" apps/api/src/  → zero results
```

**Impact:** CVSS 3.1 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H). Unlimited requests to `/auth/login` enable brute-force against any account; the in-code lockout (5 attempts per account) is the only remaining defence, but that does not protect against credential-stuffing across many accounts. `/auth/forgot-password` is similarly unthrottled, enabling bulk enumeration timing attacks and SMTP-flood risk once Phase 7 wires email delivery.

**Recommendation:** Register `ThrottlerGuard` as a global `APP_GUARD` in `AppModule` (preferred — protects all present and future endpoints by default), or at minimum add `@UseGuards(ThrottlerGuard)` to `AuthController`. The module-level `ThrottlerModule.forRootAsync` config is correct and does not need to change.

**Owner:** gharsetu-backend

**Refs:** SRS §11.2, Phase 1 spec check #7, OWASP A07

---

#### H-02 · A09 · Plaintext reset token written to logs unconditionally — no NODE_ENV guard

**Evidence:** `apps/api/src/auth/auth.service.ts:205-206`:

```typescript
const resetUrl = `/reset-password/${rawToken}`;
this.logger.log(`[DEV] Password reset URL for ${email}: ${resetUrl}`);
```

`rawToken` is the 32-byte cryptographically random opaque token before hashing. It is the exact credential that authorises a password reset. The `Logger.log()` call is unconditional — it fires in every environment including production. NestJS `Logger` writes to stdout, which is captured by any logging aggregator (CloudWatch, Loki, Datadog, etc.). Any party with read access to production logs gains a working reset link for any user who requests a password reset.

**Impact:** CVSS 3.1 8.1 (AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N). The token is single-use and 30-minute TTL, which limits the window, but an automated log-scraping attacker can act within that window to take over any account.

**Recommendation:** Wrap the logger call with an explicit `NODE_ENV !== 'production'` check, or remove it entirely and rely on the Phase 7 SMTP path. A TODO comment is not sufficient protection. Example fix shape (do not implement — for BE reference):

```
if (this.configService.get('NODE_ENV') !== 'production') {
  this.logger.log(`[DEV] Password reset URL for ${email}: ${resetUrl}`);
}
```

**Owner:** gharsetu-backend

**Refs:** OWASP A09, Phase 1 spec check #10

---

#### H-03 · A06 · multer 1.4.4-lts.1 — three HIGH CVEs (DoS) in API dependency tree

**Evidence:** `pnpm audit --prod` output; multer is a transitive dependency via `apps/api > @nestjs/platform-express@10.4.15 > multer@1.4.4-lts.1`.

| GHSA | Title | Patched |
|---|---|---|
| GHSA-4pg4-qvpc-4q3h | DoS from maliciously crafted requests | >=2.0.0 |
| GHSA-g5hg-p3ph-g8qg | DoS via unhandled exception | >=2.0.1 |
| GHSA-fjgf-rc76-4x9p | DoS via malformed request | >=2.0.2 |

Phase 1 auth endpoints (`/auth/login`, `/auth/forgot-password`, `/auth/reset-password`) accept only `application/json` bodies via NestJS validation pipe — they do not invoke multer. The risk is latent but real: any future multipart endpoint, or a crafted multipart `Content-Type` sent to any express route, could trigger the vulnerable code path.

**Impact:** CVSS 3.1 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H). Latent DoS risk; not immediately exploitable against Phase 1 auth routes.

**Recommendation:** Upgrade `@nestjs/platform-express` to a release that pulls in multer ≥ 2.0.2, or apply a pnpm override. Track against the NestJS 10 → 11 upgrade roadmap.

**Owner:** gharsetu-backend

**Refs:** OWASP A06, Phase 1 spec check #13

---

### MEDIUM

#### M-01 · A06 · path-to-regexp 0.1.12 — ReDoS via multiple route parameters

**Evidence:** `pnpm audit --prod`, GHSA-37ch-88jc-xwx2. Transitive path: `apps/api > @nestjs/platform-express > express@4.21.2 > path-to-regexp@0.1.12`. Patched in ≥ 0.1.13.

**Impact:** CVSS 3.1 5.9 (AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:H). A crafted request URL with many route parameters can cause catastrophic backtracking in the regex, blocking the event loop. Requires attacker to reach a route with multiple parameterised segments.

**Recommendation:** Apply a pnpm override: `"path-to-regexp": ">=0.1.13"`, or upgrade express to a release that pins a fixed version.

**Owner:** gharsetu-backend

**Refs:** OWASP A06

---

### LOW

#### L-01 · A07 · Account lockout counter does not reset after lockout expiry without a successful login

**Evidence:** `apps/api/src/auth/auth.service.ts:72-93`. When `locked_until` is in the past, the code proceeds with password verification. If the password is still wrong, `failed_login_count` increments further from its pre-lockout value (e.g. 5 → 6 → 7 …) and `locked_until` is set again. The counter only resets to 0 on a successful login (line 99) or password reset (line 243). This is architecturally sound for the threat model but creates a permanently escalating lockout cycle if an attacker keeps probing after the 15-minute window — the account can never self-unlock via correct password if the attacker always fires one bad request first after expiry.

**Impact:** CVSS 3.1 3.1 (AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:L). Low exploitability; requires coordinated timing. Noted as a design decision to revisit.

**Recommendation:** On lockout expiry (when `locked_until < now` at line 72), reset `failed_login_count` to 0 before proceeding with password verification, regardless of whether the password is correct. This is a BE design decision.

**Owner:** gharsetu-backend (Phase 7 backlog acceptable)

---

#### L-02 · A05 · Helmet middleware absent — no secure HTTP response headers

**Evidence:** `apps/api/src/main.ts` — `helmet` is not imported or applied. `apps/api/package.json` — `helmet` is not listed in dependencies. No `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, or removal of `X-Powered-By` is configured anywhere in the source.

**Impact:** CVSS 3.1 3.1 (AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N). The API is JSON-only in Phase 1 (no HTML rendered), so the XSS-class of headers is less critical here than on the web app. The absence of `X-Powered-By` removal reveals the Express/NestJS stack, reducing targeted-attack cost.

**Recommendation:** Add `helmet` to API dependencies and call `app.use(helmet())` in `main.ts` before `app.listen()`. This should be done before the API is exposed to any non-local environment.

**Owner:** gharsetu-backend

---

#### L-03 · A06 · lodash 4.17.21 — code injection via `_.template` (GHSA-r5fr-rjxr-66jc)

**Evidence:** `pnpm audit --prod`; path: `apps/api > @nestjs/config@3.3.0 > lodash@4.17.21`. The vulnerable surface is `_.template()` with attacker-controlled `imports` keys. No GharSetu API source code calls `_.template` (verified by grep). The vulnerability is in a transitive dependency used internally by `@nestjs/config`.

**Impact:** CVSS 3.1 2.5 (AV:L/AC:H/PR:L/UI:N/S:U/C:N/I:L/A:N). Not reachable via any external request path in Phase 1.

**Recommendation:** Monitor for a `@nestjs/config` release that updates lodash. Apply a pnpm override to `lodash@>=4.18.0` if a pinned release is not available within the next sprint.

**Owner:** gharsetu-backend (backlog)

---

## Checks performed (with status)

| # | Check | Status | Evidence |
|---|---|---|---|
| 1 | Argon2id params (memoryCost ≥ 19456, timeCost ≥ 2, parallelism ≥ 1, Algorithm.Argon2id) | PASS | `hashing.service.ts:16-21` — all four params hardcoded as const, matching spec exactly |
| 2 | bcrypt absent from all dependencies | PASS | `grep -r bcrypt apps/api/src` returns only a comment; pnpm-lock.yaml contains no bcrypt entry |
| 3 | Refresh token stored as sha256hex, never plaintext | PASS | `auth.service.ts:30-32,126,269` — sha256hex applied before every DB write; schema comment confirms |
| 4 | Refresh token rotation on refresh (old revoked atomically) | PASS | `auth.service.ts:141-145` — `revoked_at` set on old record before new token is issued in same request |
| 5 | Refresh tokens revoked on password reset | PASS | `auth.service.ts:249-252` — `updateMany` inside transaction, `revoked_at: new Date()` for all active tokens |
| 6 | Refresh tokens revoked on password change | PASS | `users.service.ts:89-93` — `updateMany` inside transaction |
| 7 | Cookie flags: HttpOnly + Secure + SameSite=Strict + Path=/api/v1/auth | PASS | `auth.controller.ts:23-28` — all four flags set in COOKIE_OPTIONS const |
| 8 | Cookie maxAge matches 7-day refresh TTL | PASS | `auth.controller.ts:29` — `7 * 24 * 60 * 60 * 1000` ms = 7 days; matches `REFRESH_TOKEN_TTL_DAYS` |
| 9 | JWT access TTL ≤ 15 min | PASS | `auth.module.ts:33` — default "15m"; env override `JWT_ACCESS_TTL` documented as 15m in .env.example |
| 10 | JWT claims minimal (sub, role, iat, exp only) | PASS | `auth.service.ts:265` — only `{sub, role}` passed to sign; NestJS JWT adds iat/exp automatically |
| 11 | JWT_SECRET read from env via ConfigService.getOrThrow | PASS | `auth.module.ts:31` — `configService.getOrThrow<string>('JWT_SECRET')` throws at startup if absent |
| 12 | JWT_SECRET in .env.example is a placeholder | PASS | `.env.example:19` — value is `replace_with_at_least_32_random_chars` |
| 13 | JWT algorithm explicitly pinned | MEDIUM-RISK / INFO | No explicit `algorithm: 'HS256'` in JwtModule signOptions or verifyOptions; relies on @nestjs/jwt default (HS256). The "none" algorithm attack is mitigated by @nestjs/jwt >= 9 rejecting it, but explicit pinning is best practice. Not raised as a numbered finding; handed off as advisory. |
| 14 | Anti-enumeration on /auth/forgot-password (same response body) | PASS | `auth.service.ts:182-184` returns void silently; controller always returns same string `auth.controller.ts:124-126` |
| 15 | Anti-enumeration on /auth/login (generic error, no account-existence leak) | PASS | `auth.service.ts:65,67-68` — same `invalidCreds` thrown for missing user AND inactive user |
| 16 | Account lockout: 5 failures triggers lock | PASS | `auth.service.ts:16,79-88` — MAX_FAILED_ATTEMPTS=5, lock set on count ≥ 5 |
| 17 | Account lockout: duration 15 min | PASS | `auth.service.ts:18,87` — LOCKOUT_MINUTES=15 |
| 18 | Lockout message differs from generic creds error | ADVISORY | `auth.service.ts:73` — "Account temporarily locked" vs "Invalid credentials". This difference reveals account existence to an attacker who triggers lockout. Acceptable per SRS; noted for awareness. |
| 19 | Rate limit on /auth/login and /auth/forgot-password | FAIL | `auth.controller.ts:41,120` — @Throttle decorator present but ThrottlerGuard never registered as APP_GUARD or UseGuards; enforcement is absent. See H-01. |
| 20 | Password policy ≥ 10 chars + letter + number, server-side | PASS | `reset-password.dto.ts:7-11` — MinLength(10) + two Matches regexes. `packages/shared/src/schemas/auth.ts:17-21` — identical Zod schema for shared use. `change-password.dto.ts` delegates to shared schema via class-validator. |
| 21 | No POST /auth/register or POST /users (public signup) | PASS | Only POST routes are: login, refresh, logout, forgot-password, reset-password (all in AuthController) and `POST /users/me/change-password` (behind JwtAuthGuard). No unauthenticated user-creation endpoint exists. |
| 22 | No plaintext passwords or full JWTs logged | PASS (with caveat) | No password or JWT logged anywhere. However, the raw reset token (which IS a credential) is logged unconditionally — see H-02. |
| 23 | .env hygiene — only .env.example tracked by git | PASS | `git ls-files | grep -i env` returns only `.env.example` and `apps/web/next-env.d.ts`. `apps/api/.env` is correctly gitignored. |
| 24 | apps/api/.env contains no real production secrets | PASS (dev placeholder) | JWT_SECRET value is `dev_jwt_secret_replace_this_in_production_min32chars_xxxx` — clearly a placeholder. Passwords are dev-only values. |
| 25 | JWT_SECRET not hardcoded in source | PASS | `auth.module.ts:31` reads from ConfigService; no string literal secret in any .ts file |
| 26 | Multiple secrets separated (JWT vs cookie) | PASS | Cookie is not separately signed (httpOnly + SameSite=Strict provides sufficient protection without a signing secret). JWT_SECRET is the only required secret for Phase 1. |
| 27 | pnpm audit --prod (API) — HIGH/CRITICAL | FAIL | 3 HIGH CVEs in multer (transitive), 1 HIGH in path-to-regexp (transitive), 1 HIGH in lodash (transitive via @nestjs/config). No CRITICAL in API scope (two CRITICAL are apps/web next.js — out of scope). See H-03, M-01, L-03. |
| 28 | @nestjs/passport and passport-jwt unused | CONFIRMED UNUSED | Grep of all `apps/api/src/**/*.ts` finds zero import of `@nestjs/passport` or `passport-jwt`. Both are listed in `package.json` dependencies and resolve in lockfile. Recommend removal. |
| 29 | Lockfile committed | PASS | `pnpm-lock.yaml` present in repo root and tracked by git |
| 30 | Helmet middleware | FAIL (LOW) | Not present; see L-02 |
| 31 | Dynamic checks (live API curl probes) | NOT RUN | API is not running in the audit environment. Checks #19 (rate-limit), #14/#15 (anti-enumeration response byte-equality), and #16 (lockout curl sequence) must be re-run by the tester against a live instance. Static evidence is conclusive for H-01 and H-02 regardless. |

---

## Recommended removal — unused dependencies

`@nestjs/passport` (10.0.3), `passport` (0.7.0), `passport-jwt` (4.0.1), `@types/passport-jwt` (4.0.1), `@types/passport` (1.0.17), `@types/passport-strategy` (0.2.38) are installed but zero imports exist in any source file. They increase the attack surface without providing any function. The custom `JwtAuthGuard` and `JwtTokenService` replace them entirely.

Action: remove from `apps/api/package.json` dependencies and devDependencies, then run `pnpm install` to prune the lockfile.

Owner: gharsetu-backend

---

## Remediation Timeline

| Severity | Deadline |
|---|---|
| HIGH (H-01, H-02, H-03) | Must fix before tester begins Phase 1 test run. H-01 (no throttle guard) and H-02 (raw token in logs) are code changes; H-03 (multer CVE) is a dependency override. |
| MEDIUM (M-01) | Within 14 days; apply pnpm override immediately as a stopgap. |
| LOW (L-01, L-02, L-03) | Phase 7 backlog acceptable. |

---

## Follow-up Tests Required (after fixes)

After H-01 fix: re-run `curl`-based rate-limit test — issue 101 requests to `/auth/login` in under 60 seconds from same IP, confirm the 101st returns HTTP 429.

After H-02 fix: confirm `logger.log` line is either removed or guarded; re-run `forgotPassword` in dev and confirm token appears in logs; set NODE_ENV=production in test and confirm no token in logs.

After H-03 fix: re-run `pnpm audit --prod` and confirm multer HIGH CVEs no longer appear.

After unused-dependency removal: confirm `pnpm build` still passes; `grep -r "passport" apps/api/src` should return zero results.

---

## Sign-off

**FAIL** — must fix H-01 (throttle guard absent) and H-02 (reset token in production logs) before the tester runs Phase 1. H-03 (multer CVE) should be resolved concurrently via dependency override. After those three items are addressed, re-engage gharsetu-security for delta review, then hand off to gharsetu-tester.
