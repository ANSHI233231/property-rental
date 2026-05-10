# BUG-001 CORS Verification

**Date:** 2026-05-10
**Commit:** 2b77a2f59e0e1cf40f5216e57a67dc8783205a38
**Verified by:** gharsetu-backend agent (fresh stack: `docker compose down -v && docker compose up -d`, migrate deploy, db seed)

## Preflight (OPTIONS) output

```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE
Access-Control-Allow-Headers: content-type
```

## Login (POST /api/v1/auth/login) output

```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
Set-Cookie: refreshToken=<token>; Max-Age=604800; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Strict
```

## Refresh (POST /api/v1/auth/refresh) output

```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true
Set-Cookie: refreshToken=<rotated-token>; Max-Age=604800; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Strict
```
Body: `{"accessToken":"<new-jwt>"}` — new token confirmed.

## Verdict: NOT REPRODUCIBLE

The CORS configuration at `apps/api/src/main.ts:22-23` is correct and the preflight succeeds in a fresh stack. Cookie attributes (`HttpOnly`, `Secure`, `SameSite=Strict`) are present on both login and refresh responses.

## Recommendation

Phase 2 tester should re-run their Playwright suite with the API process restarted post-migrate-and-seed. The most likely cause of the tester's failure is a stale API process running against an old or uninitialized database (no `Set-Cookie` header would be issued if the auth route returned a 500 before the token was written). A second possibility is the tester's browser blocked the cookie because the Playwright test origin did not match `WEB_ORIGIN=http://localhost:3000`.
