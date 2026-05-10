# Phase 2 — Admin Backend Security Review
**Reviewer:** gharsetu-security
**Date:** 2026-05-10
**Backend commits in scope:** 63e891d → 87cae2d
**Prior review:** Phase 1 auth review (c6996b3 → 6b362cb)

---

## Summary

PASS-WITH-FINDINGS — No finding independently blocks Phase 2 testing, but two HIGH findings require fixes before Phase 3 begins, and two MEDIUMs should be tracked. The Phase 1 blockers (H-01 ThrottlerGuard, H-02 reset-token log, H-03 multer CVEs, unused passport packages) are all resolved. New Phase 2 code introduces a last-admin deactivation bypass via `PATCH /users/:id` (`is_active: false`), a new HIGH CVE in `@nestjs/common` 10.4.15, and two race conditions in BL-03 and BL-19 that are currently mitigated by DB-level guards but lack clean error surfacing. The DB-level invariants (BL-05 trigger, BL-19 partial unique index) are correctly implemented. Audit log integrity, temp password generation, role-scope guards, CORS, and soft-delete behaviour all pass.

---

## Findings

### HIGH

#### H-01 · A04 / A01 · Last-admin deactivation bypass via `PATCH /users/:id { is_active: false }`

**Evidence:** `apps/api/src/users/users.service.ts:238` — the `LAST_ADMIN_PROTECTED` guard fires only when `dto.role !== undefined && dto.role !== before.role`. The `is_active` field is handled unconditionally at line 277 with no corresponding admin-count guard. A request body of `{ "is_active": false }` sent to `PATCH /users/<last-admin-id>` will set the last admin inactive, leaving the system with zero active admins — a complete lockout.

By contrast, `adminDeactivateUser` (line 327) does run the `adminCount` guard before deactivating. The problem is that `adminUpdateUser` at line 277 accepts `is_active` changes without that same guard, creating a second and unguarded deactivation path for the same operation.

**Repro (static):**
```
PATCH /api/v1/users/<sole-admin-id>
Authorization: Bearer <admin-jwt>
{ "is_active": false }
→ 200 OK (expected: 409 LAST_ADMIN_PROTECTED)
```

**Impact:** CVSS 3.1 7.6 (AV:N/AC:L/PR:H/UI:N/S:C/C:N/I:H/A:H). An Admin acting in error or under social engineering can lock out the entire system. Recovery requires direct DB access.

**Recommendation:** In `adminUpdateUser`, add an admin-count guard inside the `dto.is_active !== undefined && dto.is_active === false` branch, mirroring the check already present in `adminDeactivateUser`. Also guard against self-deactivation when the actor is the sole Admin.

**Owner:** gharsetu-backend

**Refs:** SRS §5 (no explicit BL, but SRS §2 requires Admin always exists), OWASP A04

---

#### H-02 · A06 · `@nestjs/common` 10.4.15 — arbitrary code execution via Content-Type header (GHSA-cj7v-w2c7-cp7c)

**Evidence:** `apps/api/package.json:20` — `"@nestjs/common": "10.4.15"`. Vulnerable range: `< 10.4.16`. Patched: `>= 10.4.16`. The advisory describes a crafted `Content-Type` header that allows a remote unauthenticated attacker to execute arbitrary code. All Phase 2 endpoints process `application/json` bodies but express middleware parses Content-Type before NestJS guards run, meaning this vector is reachable before authentication.

`pnpm audit --prod` evidence:
```
│ high │ nest allows a remote attacker to execute arbitrary code via the Content-Type header │
│ Package │ @nestjs/common │
│ Vulnerable versions │ <10.4.16 │
│ Patched versions │ >=10.4.16 │
│ Paths │ apps/api > @nestjs/common@10.4.15 │
│ More info │ https://github.com/advisories/GHSA-cj7v-w2c7-cp7c │
```

**Impact:** CVSS 3.1 8.1 (AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H). Pre-auth RCE; severity is rated HIGH rather than CRITICAL because the attack requires a specific crafted request but requires no authentication.

**Recommendation:** Upgrade `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` to `>=10.4.16` in lockstep (they are a matched set). Run `pnpm install` and re-run `pnpm audit --prod` to confirm the advisory disappears.

**Owner:** gharsetu-backend

**Refs:** OWASP A06, GHSA-cj7v-w2c7-cp7c

---

### MEDIUM

#### M-01 · A04 / BL-03 · Rent-lock state check is outside the write transaction (race condition)

**Evidence:** `apps/api/src/units/units.service.ts:157-208`. The BL-03 enforcement logic reads the current unit state via `findById` (line 157), performs the state check (line 170-181), then opens a `$transaction` (line 183) and executes `tx.unit.update` (line 184). The state check and the update are not atomic. A concurrent `PATCH /units/:id/state` (e.g., AVAILABLE → OCCUPIED) can succeed between the check and the update, allowing `monthly_rent_paise` to be written while the unit is OCCUPIED — directly violating BL-03.

**Attack sequence (concurrent):**
```
T1: GET unit → state=AVAILABLE → check passes (rent can change)
T2: PATCH /units/:id/state { state: "OCCUPIED" } → succeeds
T1: tx.unit.update({ monthly_rent_paise: X }) → writes, no error
Result: OCCUPIED unit has updated rent — BL-03 violated.
```

The DB-level trigger (BL-05) does not help here; there is no DB constraint protecting BL-03's state precondition. The unit's `is_retired` service guard at line 160 is also outside the transaction.

**Impact:** CVSS 3.1 5.3 (AV:N/AC:H/PR:H/UI:N/S:U/C:N/I:H/A:N). Requires two concurrent Admin requests; unlikely in a single-admin environment but a genuine race in multi-admin setups.

**Recommendation:** Move `findById` and the state check inside the `$transaction` callback and use `SELECT FOR UPDATE` locking (`$queryRaw` with a row-level lock, or Prisma's `$transaction` with isolation level SERIALIZABLE) to make the read-check-write atomic. Alternatively, add a Postgres `CHECK` constraint on the unit table that enforces the rent-state rule at the DB level.

**Owner:** gharsetu-backend

**Refs:** SRS BL-03, OWASP A04

---

#### M-02 · A04 / BL-19 · Partial unique constraint violation in `transferPm` leaks a raw 500 (Prisma P2002)

**Evidence:** `apps/api/src/properties/properties.service.ts:200-238`. `validatePmAvailability` (line 205) runs a `findFirst` check outside the transaction. The `$transaction` begins at line 208 and the `property.update` (setting `active_pm_id`) executes at line 222. There is no `try/catch` anywhere in `transferPm` or its transaction. The DB-level partial unique index (`properties_active_pm_id_partial_unique`) is the correct backstop, but when it fires (on concurrent concurrent transfer requests for the same PM), Prisma throws a raw `P2002` error which NestJS converts to an unhandled `500 Internal Server Error` with a Prisma stack trace visible to the caller.

The Phase 2 review spec (item 4) called this out explicitly. The DB constraint is correct; the missing piece is the error translation layer.

**Impact:** CVSS 3.1 5.3 (AV:N/AC:H/PR:H/UI:N/S:U/C:L/I:N/A:N). The race is hard to trigger naturally (requires two concurrent Admin transfer requests for the same PM); when it does occur the client receives a 500 with a Prisma error message that may disclose internal table and column names.

**Recommendation:** Wrap the `$transaction` body in `transferPm` with a `try/catch` that detects Prisma error code `P2002` and re-throws as `ConflictException({ error: { code: 'PM_ALREADY_ASSIGNED', … } })`, mirroring the pattern already used in `UnitsService.create` (line 109-117).

**Owner:** gharsetu-backend

**Refs:** SRS BL-19, OWASP A04

---

#### M-03 · A04 · Last-admin race condition — count check is outside the write transaction

**Evidence:** `apps/api/src/users/users.service.ts:241-244` (in `adminUpdateUser`) and lines 327-330 (in `adminDeactivateUser`). In both cases, the admin count query (`prisma.user.count`) runs before the `$transaction` that performs the `user.update`. Two concurrent deactivate/demote requests targeting two different admins can both read `adminCount = 2`, both pass the `<= 1` guard, and both commit — leaving zero active admins.

Mitigation status: the window is small and requires two simultaneous Admin-level requests, making exploitation unlikely in practice. However, the fix requires a `SELECT … FOR UPDATE` row lock or `SERIALIZABLE` isolation inside the transaction.

**Impact:** CVSS 3.1 4.4 (AV:N/AC:H/PR:H/UI:N/S:U/C:N/I:N/A:H). Hard to exploit; noted as a design concern.

**Recommendation:** Pull the `adminCount` query inside the `$transaction` callback and execute with `$queryRaw<[{count: string}]>\`SELECT count(*) FROM users WHERE role='ADMIN' AND is_active=true FOR UPDATE\`` — or use `$transaction` with `isolationLevel: Prisma.TransactionIsolationLevel.Serializable`. Fix should be done in conjunction with H-01 above.

**Owner:** gharsetu-backend

**Refs:** SRS §2 (Admin always exists), OWASP A04

---

### LOW

#### L-01 · A04 / BL-19 · `validatePmAvailability` does not exclude `deleted_at` when checking if PM is assigned

**Evidence:** `apps/api/src/properties/properties.service.ts:277-283`. The `findFirst` query that checks whether a PM is already assigned uses `where: { active_pm_id: pmId, deleted_at: null }` — this correctly excludes soft-deleted properties. On close inspection this is `where.deleted_at: null`, so soft-deleted properties are excluded. This is PASS; noted only for completeness.

**Status:** PASS — confirmed correct.

---

#### L-02 · A05 · Helmet middleware still absent — no secure HTTP response headers

**Evidence:** `apps/api/src/main.ts` — no `helmet` import or `app.use(helmet())` call. Carried forward from Phase 1 L-02. `X-Powered-By`, `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` headers are absent.

**Impact:** CVSS 3.1 3.1 (AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N). Advisory for Phase 7.

**Recommendation:** Add `helmet` to `apps/api` dependencies and call `app.use(helmet())` in `main.ts` before `app.listen()`. Planned for Phase 7 hardening pass.

**Owner:** gharsetu-backend (Phase 7 backlog)

---

#### L-03 · A04 · `forbidNonWhitelisted: false` — unknown request fields silently stripped, not rejected

**Evidence:** `apps/api/src/app.module.ts:44` — `ValidationPipe` is instantiated with `whitelist: true` (strips undecorated fields) but `forbidNonWhitelisted: false` (does not return a 400 when extra fields are present). The spec called for `forbidNonWhitelisted: true`.

**Mass-assignment impact:** `whitelist: true` is the protective layer — `id`, `password_hash`, `created_at`, and any other non-DTO field are stripped before they reach the service. Mass-assignment is NOT possible in the current code because no DTO exposes dangerous fields and undecorated fields are silently dropped. The `forbidNonWhitelisted: false` setting means the API accepts garbage payloads without a 400 response, which is a usability gap (clients sending wrong field names get no error) but not a direct security hole in the current DTO set.

**Impact:** CVSS 3.1 2.6 (AV:N/AC:H/PR:L/UI:R/S:U/C:N/I:L/A:N). Advisory.

**Recommendation:** Change `forbidNonWhitelisted: false` to `forbidNonWhitelisted: true` in `AppModule`. Verify `TransferPmDto.toPmId` still works: `@Allow()` is a valid class-validator decorator so the field is considered decorated and is not stripped or rejected by whitelist mode. The null-transform `@Transform` fires before validation, so `toPmId=undefined → null` still works.

**Owner:** gharsetu-backend

---

#### L-04 · A06 · path-to-regexp 0.1.12 — ReDoS (GHSA-37ch-88jc-xwx2) — carried from Phase 1 M-01

**Evidence:** `pnpm audit --prod`: `apps/api > @nestjs/platform-express > express > path-to-regexp@0.1.12`. This finding was raised as Phase 1 M-01. No pnpm override has been applied.

**Impact:** CVSS 3.1 5.9 (AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:H). Carried over; severity remains medium at library level but LOW for this application because Phase 2 routes use simple single-parameter paths (`:id`, `:propertyId`), which limit backtracking risk. Patched in `>=0.1.13`.

**Recommendation:** Apply `"path-to-regexp": ">=0.1.13"` pnpm override in `package.json`.

**Owner:** gharsetu-backend

---

#### L-05 · A09 · Monthly rent stored as `INTEGER` (int4) instead of `BIGINT` (int8) — overflow risk for Phase 3

**Evidence:** `apps/api/prisma/migrations/20260510170024_phase_2_props_units_users/migration.sql:31` — `"monthly_rent_paise" INTEGER NOT NULL`. Prisma schema (`schema.prisma:174`) maps this to `Int`. PostgreSQL `INTEGER` max is 2,147,483,647 paise = ₹21,47,483.47. The MASTER_PLAN §3 cross-cutting workstream explicitly specifies `BIGINT paise`. For residential rents in Delhi this is unlikely to overflow, but a high-end commercial unit exceeding ₹2.15 crore/month would cause silent truncation or a Prisma runtime error rather than a clean validation error.

**Impact:** CVSS 3.1 1.9 (AV:L/AC:H/PR:H/UI:N/S:U/C:N/I:L/A:N). Low likelihood for current properties; must be fixed before Phase 3 when lease amounts and payments also use paise arithmetic.

**Recommendation:** Issue a migration to alter `units.monthly_rent_paise` to `BIGINT`. Update Prisma schema to `BigInt`. Add a `@Max(999_999_999_99)` DTO guard (₹1,00,00,000 ceiling is a reasonable business cap). Fix should land as a Phase 3 preparatory migration.

**Owner:** gharsetu-backend

---

### INFO

#### I-01 · Phase 1 H-01 fix — ThrottlerGuard registered as APP_GUARD — CONFIRMED RESOLVED

`apps/api/src/app.module.ts:37-39` — `{ provide: APP_GUARD, useClass: ThrottlerGuard }` is present. All Phase 2 endpoints inherit global 100-req/60s throttling.

---

#### I-02 · Phase 1 H-02 fix — reset-token log guarded by NODE_ENV — CONFIRMED RESOLVED

`apps/api/src/auth/auth.service.ts:207` — `if (this.configService.get<string>("NODE_ENV") !== "production")` wraps the logger call. Raw token no longer emitted in production.

---

#### I-03 · Phase 1 H-03 fix — multer upgraded to 2.1.1 via pnpm override — CONFIRMED RESOLVED

`pnpm-lock.yaml` — `multer: '>=2.0.2'` override; resolved version `multer@2.1.1`. All three Phase 1 multer CVEs (GHSA-4pg4, GHSA-g5hg, GHSA-fjgf) are resolved.

---

#### I-04 · Phase 1 unused passport packages — CONFIRMED REMOVED

`apps/api/package.json` contains no `@nestjs/passport`, `passport`, `passport-jwt`, or their `@types` counterparts.

---

#### I-05 · Cursor-based pagination uses raw CUID as next_cursor

`apps/api/src/properties/properties.service.ts:60` and `apps/api/src/users/users.service.ts:143` — the `next_cursor` value is the raw CUID `id` of the last returned record. CUIDs are opaque (not sequential integers) and are not predictable from the outside, but they do confirm the existence of a record to any Admin who can observe the cursor. Since these endpoints are Admin-only (Admin can see all records by definition), cursor-based enumeration is not a meaningful attack surface here. This is an INFO note; if these endpoints are ever scoped to non-Admin roles in a later phase, signed cursors should be evaluated.

---

#### I-06 · Swagger / OpenAPI not present — no docs leak risk

No `@nestjs/swagger`, `SwaggerModule`, or `DocumentBuilder` found in any source file. No Swagger endpoint is exposed.

---

#### I-07 · Audit log tamper-resistance — no UPDATE/DELETE paths found

`grep -rn "auditLog.update|auditLog.delete"` across `apps/api/src/` returns zero results. `AuditService.writeLog` uses only `tx.auditLog.create`. The Postgres schema has no trigger or RLS policies restricting direct DB access (a Phase 7 concern), but at the application layer the log is append-only.

---

#### I-08 · DB-level BL-05 trigger verified present and correct

`apps/api/prisma/migrations/20260510170100_phase_2_db_level_guards/migration.sql:30-50` — `prevent_unit_unretire()` BEFORE UPDATE trigger fires on `is_retired: TRUE → FALSE` attempts and raises `EXCEPTION` with `ERRCODE = 'P0001'`. The service-layer guard (line 160, 218, 268) provides application-level defence-in-depth; the DB trigger is the backstop.

---

#### I-09 · DB-level BL-19 partial unique index verified present and correct

`apps/api/prisma/migrations/20260510170100_phase_2_db_level_guards/migration.sql:22-24` — `CREATE UNIQUE INDEX "properties_active_pm_id_partial_unique" ON "properties"("active_pm_id") WHERE "active_pm_id" IS NOT NULL`. The preceding first migration (`20260510170024`) creates a full unique index `properties_active_pm_id_key` which the guards migration immediately drops and replaces. This correctly allows multiple properties with `active_pm_id = NULL` while preventing PM duplication. CONFIRMED CORRECT.

---

#### I-10 · Temp password generation uses CSPRNG — PASS

`apps/api/src/users/users.service.ts:43-45` — `generateTempPassword` uses `crypto.randomBytes(6)` (48 bits entropy, 12 hex chars) prefixed with `Tmp@`, yielding 16-character output. `Math.random` is not used. The password is hashed with Argon2id before DB write. The plaintext is returned to the Admin once in the HTTP response body only when `isTempPassword === true` (line 203) and is NOT written to any log or the audit log (audit `after` field is built from `USER_SAFE_SELECT` which excludes `password_hash`). PASS. Advisory note: a 16-char hex password meets length requirements but the charset is limited to `[0-9a-fA-F]`; the `Tmp@` prefix adds an uppercase, lowercase, and symbol to satisfy the password policy validator but expanding the hex range to `base64url` would double the character set entropy for the same length.

---

#### I-11 · CORS configuration — no wildcard regression

`apps/api/src/main.ts:22-25` — `origin: config.get('WEB_ORIGIN') ?? 'http://localhost:3000'`, `credentials: true`. No `origin: '*'`. Phase 2 routes inherit the app-level CORS config.

---

## Checks performed

| # | Check | Status | Evidence |
|---|---|---|---|
| 1 | GET /properties — @Roles('ADMIN') class-level | PASS | `properties.controller.ts:38` — `@Roles("ADMIN")` at class level; all methods inherit |
| 2 | POST /properties — @Roles('ADMIN') | PASS | Inherited from class-level |
| 3 | PATCH /properties/:id — @Roles('ADMIN') | PASS | Inherited from class-level |
| 4 | DELETE /properties/:id — @Roles('ADMIN') | PASS | Inherited; no method-level override — backend's flagged concern is REFUTED |
| 5 | POST /properties/:id/transfer-pm — @Roles('ADMIN') | PASS | Inherited from class-level |
| 6 | POST /properties/:propertyId/units — @Roles('ADMIN') | PASS | `units.controller.ts:110` — `@Roles("ADMIN")` on `PropertyUnitsController` |
| 7 | PATCH /units/:id — @Roles('ADMIN') | PASS | `units.controller.ts:44` — class-level guard |
| 8 | PATCH /units/:id/state — @Roles('ADMIN') | PASS | Inherited from class-level |
| 9 | POST /units/:id/retire — @Roles('ADMIN') | PASS | Inherited from class-level |
| 10 | GET /users — @Roles('ADMIN') | PASS | `users.controller.ts:78-79` — method-level `@UseGuards(RolesGuard) @Roles("ADMIN")` |
| 11 | POST /users — @Roles('ADMIN') | PASS | `users.controller.ts:93-95` |
| 12 | GET /users/:id — @Roles('ADMIN') | PASS | `users.controller.ts:108-110` |
| 13 | PATCH /users/:id — @Roles('ADMIN') | PASS | `users.controller.ts:119-121` |
| 14 | POST /users/:id/deactivate — @Roles('ADMIN') | PASS | `users.controller.ts:134-136` |
| 15 | POST /users/:id/activate — @Roles('ADMIN') | PASS | `users.controller.ts:149-151` |
| 16 | DELETE /properties/:id role guard (backend concern) | REFUTED | See check #4 — class-level @Roles("ADMIN") covers all methods including DELETE |
| 17 | DB partial unique on properties(active_pm_id) WHERE NOT NULL | PASS | Migration `20260510170100` lines 22-24 |
| 18 | DB BEFORE-UPDATE trigger on units blocking is_retired→false | PASS | Migration `20260510170100` lines 30-50 |
| 19 | BL-03 rent-change check inside transaction | FAIL (M-01) | `units.service.ts:157` — findById outside tx; tx begins at line 183 |
| 20 | BL-19 transferPm constraint violation translated to PM_ALREADY_ASSIGNED | FAIL (M-02) | No try/catch in `transferPm`; P2002 leaks as 500 |
| 21 | Audit log — every mutation in same transaction | PASS | All service methods pass `tx` to `audit.writeLog`; writes are inside `$transaction` |
| 22 | Audit log — no UPDATE/DELETE in code | PASS | Grep returns zero results |
| 23 | Audit log — password_hash / token_hash absent from before/after | PASS | All audit writes use `USER_SAFE_SELECT` (excludes password_hash) or explicit field subsets |
| 24 | Mass-assignment — whitelist strips undecorated fields | PASS | `app.module.ts:43` — `whitelist: true`; id/password_hash have no DTO decorators |
| 25 | forbidNonWhitelisted setting | FAIL (L-03) | `app.module.ts:44` — `forbidNonWhitelisted: false`; spec required `true` |
| 26 | TransferPmDto @Allow() with whitelist mode | PASS | `@Allow()` is a valid class-validator decorator; whitelist mode keeps decorated fields |
| 27 | Last-admin protection — role demotion path | PASS | `users.service.ts:240-251` |
| 28 | Last-admin protection — deactivate path via POST /users/:id/deactivate | PASS | `users.service.ts:327-335` |
| 29 | Last-admin protection — deactivate bypass via PATCH /users/:id is_active:false | FAIL (H-01) | `users.service.ts:238` — is_active change has no last-admin guard |
| 30 | Last-admin race condition (two concurrent demote/deactivate ops) | FAIL (M-03) | adminCount query outside $transaction; no row lock |
| 31 | Temp password — CSPRNG | PASS | `users.service.ts:44` — `crypto.randomBytes(6)` |
| 32 | Temp password — length ≥ 12 chars | PASS | `Tmp@` + 12 hex chars = 16 total |
| 33 | Temp password — Argon2id hash, not plaintext in DB | PASS | `users.service.ts:176` — `hashPassword` called before `tx.user.create` |
| 34 | Temp password — not in audit log | PASS | Audit `after` from USER_SAFE_SELECT; temp_password appended after audit write |
| 35 | Cursor-based pagination cursor content | INFO (I-05) | Raw CUID used as cursor; Admin-only scope means no IDOR risk |
| 36 | Soft-delete: GET /properties filters deleted_at IS NOT NULL | PASS | `properties.service.ts:48` — `where: { deleted_at: null }` |
| 37 | Swagger / OpenAPI docs exposure | PASS | No @nestjs/swagger or SwaggerModule anywhere in source |
| 38 | CORS — credentials:true, no wildcard regression | PASS | `main.ts:22-25` |
| 39 | ThrottlerGuard covers Phase 2 endpoints (Phase 1 H-01 fix) | PASS | `app.module.ts:37-38` — `APP_GUARD` with `ThrottlerGuard`; global |
| 40 | pnpm audit — @nestjs/common GHSA-cj7v-w2c7-cp7c | FAIL (H-02) | Version 10.4.15; patched >=10.4.16 |
| 41 | pnpm audit — multer CVEs (Phase 1 H-03) | PASS | multer overridden to 2.1.1 |
| 42 | pnpm audit — path-to-regexp (Phase 1 M-01) | OPEN (L-04) | Still 0.1.12; no override applied |
| 43 | pnpm audit — lodash code injection | OPEN (carried) | lodash 4.17.21 via @nestjs/config; not directly called |
| 44 | monthly_rent_paise column type | INFO (L-05) | INTEGER (int4); should be BIGINT per MASTER_PLAN |
| 45 | Dynamic curl checks (live API) | NOT RUN | API not running in audit environment. Checks #4, #16, #29 above must be re-run dynamically by tester |
| 46 | BL-05 DB trigger: audit of all un-retire attempt paths | PASS | Service guard + DB trigger dual-layer; trigger fires for direct SQL too |
| 47 | git secrets / committed .env | PASS | `git ls-files | grep env` returns only `.env.example`; apps/api/.env is gitignored |

---

## Phase 1 carry-forward status

| Phase 1 Finding | Status in Phase 2 |
|---|---|
| H-01: ThrottlerGuard not registered | RESOLVED — `APP_GUARD` in `app.module.ts` |
| H-02: Reset token logged unconditionally | RESOLVED — NODE_ENV guard at `auth.service.ts:207` |
| H-03: multer 1.4.4-lts.1 CVEs | RESOLVED — pnpm override to multer 2.1.1 |
| M-01: path-to-regexp ReDoS | OPEN — carried as L-04 |
| L-01: Lockout counter reset | OPEN — Phase 7 backlog |
| L-02: Helmet absent | OPEN — carried as L-02 |
| L-03: lodash _.template CVE | OPEN — carried |
| Advisory: Unused passport packages | RESOLVED — removed from package.json |

---

## Remediation Timeline

| Severity | Finding | Deadline |
|---|---|---|
| HIGH | H-01: last-admin deactivation bypass | Fix before Phase 3 begins |
| HIGH | H-02: @nestjs/common 10.4.15 RCE CVE | Fix before Phase 3 begins (single `pnpm up @nestjs/*`) |
| MEDIUM | M-01: BL-03 rent-lock race (state check outside tx) | Fix within 14 days; Phase 2 testing can proceed with awareness |
| MEDIUM | M-02: BL-19 P2002 error not translated | Fix within 14 days; tester should verify the 500 repro first |
| MEDIUM | M-03: Last-admin count outside tx | Fix concurrently with H-01; add row lock |
| LOW | L-01 – L-05 | Phase 7 hardening sprint |

---

## Follow-up Tests Required (after fixes)

After H-01 fix: tester runs `PATCH /users/<sole-admin-id> { "is_active": false }` with an admin token → must receive `409 LAST_ADMIN_PROTECTED`.

After H-02 fix: re-run `pnpm audit --prod` → GHSA-cj7v-w2c7-cp7c must no longer appear in the API dependency path.

After M-01 fix: tester runs concurrent `PATCH /units/:id` (rent change) and `PATCH /units/:id/state` (→OCCUPIED) requests with a race harness → rent change must fail with `409 UNIT_RENT_LOCKED` even when requests are simultaneous.

After M-02 fix: tester sends two concurrent `POST /properties/:id/transfer-pm` with the same PM ID against two different properties → both should return `409 PM_ALREADY_ASSIGNED`, never `500`.

After L-03 fix: re-run a request to any Phase 2 endpoint with an extra unknown body field (e.g., `"foo": "bar"`) → must receive `400 Bad Request` listing the unknown field.

---

## Sign-off

**PASS-WITH-FINDINGS** — Phase 2 testing may proceed. Dynamic curl checks are NOT RUN (API unavailable in audit environment) and must be completed by the tester. H-01 (last-admin bypass) and H-02 (NestJS CVE) must be resolved before Phase 3 work begins. The DB-level BL-05 and BL-19 invariants are correctly implemented. No finding discovered constitutes a complete bypass of authentication or role scope at the Phase 2 endpoint surface.

**gharsetu-security · 2026-05-10**
