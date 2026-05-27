# GharSetu — claude-progress.md

> **Rolling cross-session memory.** Updated at session exit. Pair this human-readable file with the machine-readable [feature_list.json](feature_list.json) — when they disagree, the JSON wins. See [.claude/skills/harness-engineering/SKILL.md](.claude/skills/harness-engineering/SKILL.md) for the contract.

**Last updated:** 2026-05-27 · Homepage redesign + public-chrome unification + Super Admin/plans/master polish · maintained by `gharsetu-lead`

---

## 1. Current phase / engagement

| Stream | Status | Notes |
|---|---|---|
| **v1** | ✅ **RELEASE-READY** pending user sign-off | Phase 8 closeout dated 2026-05-11 — all MUST-FIX closed, 967/967 unit+integration green, 74/74 Playwright green (serial), 23/23 BLs locked in [bl-traceability-matrix.md](docs/testing/v1/bl-traceability-matrix.md). |
| **Current engagement** (was v3.1 / v6.5) | 🟢 **PROTOTYPE BUILT — application port pending** | v8 prototype now covers all 7 new features and the 6 module gap closures. Application port to `apps/web` + `apps/api` not yet started. Per the [Solution_Overview.docx](docs/product/Solution_Overview.docx) v8 (final-close 2026-05-26): 6 module gap closures + 7 new features (**per-room leasing** [planning only — HTML iteration deferred], **Admin Impersonation**, **Admin Task Delegation**, **Visitor Management**, **Master Data Administration**, **Settings**, **Organization Management / SAAS layer**) + **new Super Admin role** + 6 new business rules. Timeline lives in [Timeline.xlsx](docs/product/Timeline.xlsx). |
| **Deferred** (post-current) | ⏸ **DEFERRED** | After all the scope pulls, only two items remain deferred (per [Solution_Overview.docx §Out of Scope](docs/product/Solution_Overview.docx) + [feature_list.json](feature_list.json) `deferred_post_engagement`): **subscription billing integration** (manual invoicing only) and **custom domains + per-organization branding**. |

---

## 2. Last session summary (2026-05-27 — Homepage redesign + public-chrome unification + Super Admin/plans/master polish)

**Scope.** Continued the screen-by-screen prototype review. Shipped the planned homepage redesign, unified the public-page chrome behind a single source, and landed a batch of Super Admin / master-data / plans refinements. Prototype-only — no app code, no business-rule changes.

**Shipped this session:**
1. **Homepage redesign** (`prototype/index.html`) — built to `docs/planning/features/2026-05-27-homepage-redesign.md` (now **shipped**): glass nav (white→navy on scroll), navy-gradient hero + browser-framed dashboard mock + factual stats strip (120+/18/4), 4 alternating capability rows, 3-step "how it works", bento role grid (Admin emphasized), plans on light-gray + popular-card glow, merged navy CTA, `IntersectionObserver` scroll-reveal + reduced-motion + skip link. OD-1..5 resolved to the richer Option A; **OD-6 → A (Register pill)** overriding the documented default B (rationale logged in plan §4/§5). Hero mock URL set to `anshika.tlitech.net`; footer About link removed.
2. **CTA/footer separation** — footer stepped to deep navy `#0D1757` + hairline top border so it no longer merges with the navy CTA band.
3. **Public-chrome single source** — new `prototype/assets/public-chrome.js` renders one identical sticky glass nav + deep-navy Company/Legal footer into `#gs-public-nav` / `#gs-public-footer` placeholders. Wired into `index.html` (refactored off its inline chrome + glass-scroll JS), `contact.html`, `privacy.html`, `terms.html`. Auth pages (login/signup) intentionally stay chrome-free.
4. **Profile pages** — removed the **Role** detail row on all 5 roles; role stays only as the `.profile-role` badge by the name.
5. **Server Logs** — dropped the **Lines** column (header + cell); `lines` data kept for the file-preview modal.
6. **Super Admin sidebar consistency** — `master-data/payment-methods.html` was missing the **Business Types** sublink; added. All 13 Super Admin surfaces now share an identical sidebar item sequence.
7. **Master-data deactivate reason → tooltip** — across all 6 masters (4 platform: cities/states/payment-methods/business-types + org: amenities/categories) moved the in-cell "Cannot deactivate — currently used by N record(s)…" note (27 total) into the disabled Deactivate button's `title` attribute (dropped the now-dangling `aria-describedby`).
8. **Plans "Most Popular" control** — Super Admin `plans.html` now sets which plan is the public highlight (★ badge + saffron top-border on the featured card; "Set as Most Popular" on the others; exclusive; auto-cleared on deactivate). Signup helper de-hardcoded ("Pick the one marked Most Popular" — no plan name) + signup tile badge "Popular"→"Most Popular". All read the shared `popular` flag in `plans.js`.

**Earlier in the same session:** added a real **Edit-Profile modal** (Name + Mobile editable; Email + Role locked) across all 5 profile pages, replacing the old JS `alert()`.

**Docs:** homepage planning file → `shipped` + OD log; `docs/planning/prototype-changes.md` **created** (Working rule §9) and seeded with this session's rows; change-log `agent-team-change-logs/gharsetu-frontend-2026-05-27.md` (tasks 1–10). No `feature_list.json` change — prototype polish, not a new app feature.

**Prototype-only caveat (carry-over for app port):** the "Most Popular" choice and all plan CRUD are session-only in the static prototype (no persistence) — the homepage's default featured plan stays **Standard** via `plans.js`. In the live app this becomes a saved setting / PATCH.

---

## 2a. Earlier session summary (2026-05-26 / 27 — v8 prototype build-out)

**Scope.** Implement v8 across the static prototype: ship the 7 new features (with Per-Room Leasing as planning-only this pass) and the 6 module gap closures from Solution Overview v8. Public auth pages refreshed; sidebar pattern updated to a compact account menu.

**Planning files added** (all under `docs/planning/features/2026-05-26-*.md`):
- `super-admin-pages.md` (544 lines, 148 TCs)
- `admin-module-additions.md` (585 lines, 90 TCs — master data + settings + delegations)
- `visitor-management.md` (278 lines, 35 TCs)
- `admin-impersonation.md` (349 lines, 28 TCs)
- `v8-module-gap-closures.md` (415 lines, 62 TCs across 6 modules)
- `per-room-leasing.md` (589 lines, 42 TCs across 5 namespaces) — HTML iteration deferred
- `public-auth-pages-refresh.md` — implemented this session

**Prototype implementation delivered**:
- **Super Admin** — all 5 pages (`dashboard`, `organizations`, `organization-detail`, `plans`, `profile`) shipped earlier in session
- **Visitor Management** — `pm/visitors.html` + `tenant/visitors.html` + nav rollout
- **Admin Module Additions** — `master-data.html`, `settings.html`, `delegations.html` (3 new pages) + new MoreSheet mobile-overflow pattern across all 12 admin pages
- **Admin Impersonation** — `assets/impersonation.js` (273 lines) + 153 lines of CSS appended to `styles.css` (520–673) + `<script>` tag injected on 29 role pages + Start affordance in 2 places
- **v8 Module Gap Closures** — all 6 modules: 2 new maintenance-detail pages, 8 existing pages edited (Add-User restricted, amenities multi-select, Reassign-PM + Create-Lease, Renewal Drawer, 3-step Termination, cross-property Reassign, Record-Payment modal, 8-KPI grids, daily-queue dashboard, tenant rent+payments+maintenance summary)
- **Sidebar account-menu refactor** — name/role removed; `.account-trigger` + `.account-menu` (popup containing "Sign out") replaces the old footer text across 37 prototype pages

**Public auth pages refreshed**: `prototype/forgot-password.html` + `prototype/reset-password.html` — stripped HTML5 native validation, added custom inline validators, aligned to register-org link pattern.

**Token sources extended once**: `prototype/assets/styles.css` grew from 519 → 730 lines (impersonation block 520–673 + sidebar account-menu block ~677–730). All other tokens unchanged. No new colors or radii were invented; only existing tokens were composed.

**Orchestration footnote**: three of six background-agent dispatches stalled at the 600-second watchdog. Outputs were verified intact and recovery patches applied by the orchestrator (nav consistency on 9 admin pages, planning-log entries on 2 plans, modules 4–6 delivered on a continuation dispatch).

**Carry-over**:
- Per-Room Leasing HTML iteration (10 prototype files identified in §6 of its planning file)
- `prototype-changes.md` ledger entries (deferred to ship per Working rule §9)
- `feature_list.json` rows for the 7 v8 features (pending creation by `gharsetu-lead` after verification command exits 0)
- Application port from prototype to `apps/web` + `apps/api`
- 5 open decisions on Per-Room Leasing · 2 on Impersonation (active-org gate, nested-impersonation backend block)

---

## 2c. Earlier session summary (2026-05-26 — CLAUDE.md overhaul + Feature Planning template)

**CLAUDE.md rewrite.** Fixed: stale 2026-05-25 header; the Rule #2 vs Rule #12 contradiction on public sign-up (the v1 "No public sign-up" framing never updated for v8 SAAS scope); UIUX_Design_Document.docx missing from source-of-truth table; prototype page count (19 → actual 29). Restructured into clear bands: **Working rules** (11 process rules — never-commit-without-instruction, plan-first, lead-orchestrates, worker≠checker, per-task change log, submodule discipline, relative paths, CONTEXT.md mirror, prototype sync, JS-source-of-truth for binaries, line caps) + **Technical conventions** (6 code conventions — snake_case DB, no FK constraints with relations declared in Prisma, Prisma migrations append-only, audit_log on every mutation, FE/BE validation parity with no HTML5 native, sensitive files never in git) + renamed **Hard rules → Scope rules** (11 business/scope rules A–K). Added a Conflict-resolution section (JSON wins over markdown, CONTEXT.md wins over CLAUDE.md, ask user when working vs scope rules conflict). All internal links converted to relative `./` paths. Final size: 134 lines (under the 200 cap).

**New artifact**: `docs/planning/FEATURE_PLANNING.md` (159 lines). Documents the per-feature planning file workflow: location (`docs/planning/features/<YYYY-MM-DD>-<short-slug>.md`), lifecycle (`proposed → in-progress → shipped` with four ship criteria — SRS row, test cases promoted, CHANGELOG bullet, prototype-changes row), the full 9-section template, and the reactivation discipline (grep before coding; extend existing files rather than fix silently). 9 sections: Requirement (verbatim) · Plan · Test cases up front · Sign-off · Execution log · **Files changed** · **Agents used** · Post-deploy · Cross-references.

**Old session summaries** retained below for the audit trail of the v8 final-close and the UIUX Design Document delivery.

---

## 2d. Earlier session summary (2026-05-26 — UIUX Design Document delivered)

This session continued past the earlier "final close" with a substantial new artifact and several scope refinements.

**UIUX Design Document delivered** — new file at [docs/product/UIUX_Design_Document.docx](docs/product/UIUX_Design_Document.docx) (35.5 KB), generated by [doc-assets/templates/generate_design_document.js](doc-assets/templates/generate_design_document.js). 10 sections:
1. Design Principles · 2. Design Tokens (brand + status + typography desktop+mobile + spacing + radius/shadow + readability + color usage rules) · 3. Layout Foundations (breakpoint contract + sidebar + tabbar + MoreSheet + responsive transformations) · 4. Information Architecture (Public · Platform · Org-scoped pages) · 5. Page Layout Templates · 6. Wireframes (7 zone-tables) · 7. Components · 8. Interaction Patterns · 9. Accessibility · 10. Launch Checklist (grouped by Area).

**Routing model finalised**: three classes — Org-scoped (`/:org/...`), Platform (Super Admin, no prefix), Public (no prefix, no auth). The downstream `apps/web/src/app/(app)/<role>/...` route restructure is deferred to the v8 build phase.

**Solution Overview polish**: rent-collection jargon removed ("overnight job" → plain language), Admin + PM dashboard incomplete (both mentioned), visitor pre-approval captures date + time, Master Data sourcing bullet removed (in NR-3), "Another Admin" row dropped from impersonation scope table, new fix bullet for the 5+ alert on Admin dashboard.

**Spelling standardisation**: American English everywhere. Sed sweep across 10 active files: Organisation → Organization. All three artifacts regenerated. Old `/organisation-signup` URL → `/organization-signup`.

**Colour audit**: every hex value in the UIUX doc verified against `prototype/assets/styles.css`. 13 invented values caught and replaced with prototype-accurate values. Final hex allow-list (18 colours) matches the prototype exactly. Focus ring corrected from navy to saffron; primary button from navy to saffron; modal radius 16→12 px; card radius 10→12 px; etc.

**Visual / readability fixes**: §6 Wireframes refactored from ASCII art (fragile in Word) to structured Zone / Content tables. §10 Launch Checklist refactored from one big 25-row table to 7 per-Area sub-tables.

**Old session summary (2026-05-26 — final-close)** — moved below for reference:

Solution Overview was iterated end-to-end (v6.5 → v8) over a long single session. Major moves:

- **Structural rewrite**: dropped the Before/After table, all v1 feature restatements, the full ROLE_CAPABILITIES table, the Subscription Plans matrix-as-callout, Assumptions (later re-added focused), §What We Heard, and the §Updated Business Rules subsection. Removed duplicate BRs that just restated v1 BLs.
- **Scope decisions**: SAAS layer + Super Admin pulled forward (was v2). Master Data Administration + Settings reframed twice (gap → feature → gap → feature again — landed in §New Features). Per-room leasing reframed under "Leases & Tenants — Per-Room Leasing" to show it's an extension, not a standalone module. Admin Impersonation + Task Delegation reversed from deferred → in scope.
- **New artifacts**: created `harness-engineering` skill ([.claude/skills/harness-engineering/SKILL.md](.claude/skills/harness-engineering/SKILL.md)), `feature_list.json` (this state file's sibling), `Timeline.xlsx` + its generator ([doc-assets/templates/generate_timeline.js](doc-assets/templates/generate_timeline.js); installed `exceljs` for it), and split-out timeline that previously lived in the Solution Overview.
- **Audit pass** caught: one "Day 1" timeline leak, the Master Data deactivation contradiction (NR-4 vs feature bullet), word-for-word duplication of NR-7/NR-8 in the Impersonation + Delegation feature rows, NR-5 every-user-except-Super-Admin paradox, and a fabricated "overdue" concept in the Maintenance dashboard fix (overdue is rent-only per BL-12). All resolved.
- **Cover**: dropped the long subtitle and version number; cover now reads title + saffron rule + bold-italic saffron "DRAFT" + date + Prepared by (with contact) + Prepared for.
- **Final v8 section flow** (cover + 8 banners): Fixes · New Roles · New Features · Business Rules · Details · Assumptions · Out of Scope · Next Steps.
- **Reconciled at final-close**: this file, `feature_list.json`, `AGENTS.md`, `CLAUDE.md`, `README.md`.
- **Change logs written retroactively** in [agent-team-change-logs/](agent-team-change-logs/) for `gharsetu-lead-2026-05-26.md` and `document-agent-2026-05-26.md` — flagged as a process violation; rule requires per-task append, was done at session close instead.

---

## 3. What's in flight

**v8 prototype is built.** All 7 new features and 6 module gap closures are live in `prototype/`. Application port to `apps/web` + `apps/api` is the next major phase.

| Stream | Status |
|---|---|
| Super Admin pages (5) | ✅ shipped |
| Public landing + org sign-up + auth refresh | ✅ shipped |
| Visitor Management | ✅ shipped |
| Admin Module Additions (Master Data + Settings + Delegations) | ✅ shipped |
| Admin Impersonation | ✅ shipped |
| v8 Module Gap Closures (all 6 modules) | ✅ shipped |
| Sidebar account-menu refactor + common UI cleanup | ✅ shipped (37 pages) |
| Homepage redesign (modern landing) | ✅ shipped |
| Public-chrome single source (nav + footer on 4 public pages) | ✅ shipped |
| Plans "Most Popular" Super Admin control + signup de-hardcode | ✅ shipped |
| Master-data deactivate reason → button tooltip (6 masters) | ✅ shipped |
| Profile Role-as-badge · Server Logs Lines column removed · Edit-Profile modal | ✅ shipped |
| Master Data restructure + platform/org ownership split | ✅ shipped |
| Server Logs (Super Admin) · Delegations 3-col modal · filter pills→tiles | ✅ shipped |
| Visitor pages card→table + tiles | ✅ shipped (PM + tenant) |
| Tenant My Leases + Tenant Lease Detail | ✅ shipped |
| Units IA refactor → per-role Unit Detail | ✅ shipped |
| PM Properties + multi-property + read-only tenure history | ✅ shipped (retires one-PM-per-property — see amendment below) |
| 4 maintenance-detail pages + Lease/Property context card + progress timeline + role-based actions | ✅ shipped |
| Maintenance role assigned-only + no self-assign · all-open→all-requests | ✅ shipped |
| Server-side pagination component on all 21 list pages | ✅ shipped |
| **Per-Room Leasing — HTML iteration** | 🟡 planned (10 files identified in §6 of its planning file) — still NOT built |
| Application port (prototype → apps/web + apps/api) | ⏸ not started |
| `feature_list.json` row creation for the v8 features | ⏸ pending lead pass |
| `prototype-changes.md` ledger | 🟢 started 2026-05-27 (homepage + this session's rows); backfill earlier v8 rows on next pass |
| SRS amendments (one-PM-per-property retired · maintenance assign/close authz · lease-anchored-to-unit) | ⏸ to fold in at next SRS pass — see `docs/planning/features/2026-05-27-ia-restructure-*.md` §2.0 |

---

## 4. Blockers

| Item | Type | Why blocked | Unblock criteria |
|---|---|---|---|
| **CARRY-01** — NestJS 10 → 11 migration | Carry-over | Awaiting user decision on N-1 vs latest dependency policy | User clarifies preference. No exploitable code path per VAPT, so not release-blocking. |
| **CARRY-05** — Password min 10 → 12 | Carry-over | Deferred by user; SRS §10.2 deviation documented in VAPT report | Reopen only on explicit user request. |

No BL or current-engagement feature is currently blocked.

---

## 5. Next session priority

Prototype is now feature-rich across all 5 roles. Viable starting points — user picks:

1. **Implement Per-Room Leasing prototype HTML** — the last unbuilt prototype feature. Planning file complete (`docs/planning/features/2026-05-26-per-room-leasing.md`, 589 lines, 42 TCs, 5 open questions). 10 prototype files identified in §6.
2. **Fold SRS amendments + regenerate Solution Overview** — three business-rule changes landed in the prototype this session that the SRS/Solution Overview don't yet reflect: (a) one-PM-per-property retired → multi-property + tenure history; (b) maintenance role cannot self-assign or close; (c) lease anchored to unit not property. Plus Master Data platform/org split + Server Logs as new Super Admin surfaces. Edit `doc-assets/templates/generate_solution_overview.js` + SRS §5/§2.
3. **Begin application port.** Pick highest-leverage first: ENG-F06 Org Management/SAAS + Super Admin (gates user-scoping) or ENG-F01 Per-Room Leasing (biggest schema change). Create `feature_list.json` rows. The 4 planning files dated 2026-05-27 (pagination · master-data-ownership-split · server-logs · ia-restructure) are binding specs for the port.
4. **Sign off on open decisions** still pending: 5 Per-Room Leasing questions · 2 Impersonation (active-org gate, nested guard) · PM tenure-window data-scope confirmation.

If the user has none in mind: surface this list and ask which to start.

---

## 6. Carry-over / known issues

From [docs/testing/v1/phase-8-closeout.md](docs/testing/v1/phase-8-closeout.md) §Carry-over — none release-blocking:

| ID | Item | Source | Status |
|---|---|---|---|
| CARRY-01 | NestJS 10 → 11 (clears `@nestjs/core` GHSA-36xv) | VAPT | blocked (user decision) |
| CARRY-02 | Next.js CSP header via `next.config.mjs` | VAPT | not_started |
| CARRY-03 | Extract `formatDateIST` / locale helpers to `@gharsetu/shared` | BUG-BL22-001 fix | not_started |
| CARRY-04 | Playwright spec isolation (or commit to `--workers=1` in CI) | Phase 8 closeout | not_started |
| CARRY-05 | Password min 10 → 12 (ASVS L2) | OWASP ASVS L1 | blocked (user deferred) |

All five are tracked in `feature_list.json` under `carry_over_v1_post_release`.

---

## 7. Session log (recent only — keep ≤10 entries)

| Date | HEAD | Agent | What changed |
|---|---|---|---|
| 2026-05-27 | _pending_ | orchestrator + gharsetu-frontend | Homepage redesign shipped (glass nav, hero+dashboard-mock+stats strip, alternating capability rows, how-it-works, bento roles, popular-glow plans, merged navy CTA, scroll-reveal) · footer deep-navy `#0D1757` separation · **`public-chrome.js` single source** for nav+footer across index/contact/privacy/terms (auth pages chrome-free) · profile Role row → badge only (5 roles) + Edit-Profile modal (Name+Mobile only) · Server Logs Lines column removed · Super Admin sidebar fixed (payment-methods missing Business Types) · master-data deactivate reason → disabled-button `title` tooltip (6 masters, 27 notes) · Plans Super-Admin "Set as Most Popular" control + signup helper de-hardcoded ("Most Popular", no plan name). `prototype-changes.md` created. |
| 2026-05-27 | _pending_ | gharsetu-lead + gharsetu-frontend | Super Admin review pass + 2 new features: org slugs (`?org=<slug>` everywhere) · org-detail redesign (status simulator + conditional actions + 3 tabs incl. Subscription Plan History) · Plans full CRUD + 9-feature flag catalogue · single-source `plans.js` (home + signup + super-admin render same ✓/✗ list) · Business Types platform master + signup wiring · Legal+Contact feature (privacy/terms/contact public pages + Super Admin Legal editor + Contact Inbox, record-only per Scope-K) · favicon on all 62 pages · removed all helper captions + detail-page back-links. Homepage redesign PLANNED (awaiting sign-off). |
| 2026-05-27 | _pending_ | gharsetu-lead + gharsetu-frontend | IA restructure: deleted standalone Units pages (admin+pm) → created per-role `unit-detail.html` wired from property-detail · `tenant/lease-detail.html` (full payment/co-tenant/maintenance/terminate actions) · `pm/properties.html` + `pm/property-detail.html` with multi-property + read-only tenure-history (retires one-PM-per-property) · created `tenant/maintenance-detail.html` + `maintenance/maintenance-detail.html` (4 role detail pages now complete, each with progress timeline + role-based action card) · maintenance role scoped to assigned-only, self-assign removed, all-open→all-requests · server-side pagination component (`paginate.js`) on **21 list pages** (URL-driven, search/tile reset, tile counts = full dataset). 3 agent dispatches crashed at socket watchdog; orchestrator finished residual by hand. |
| 2026-05-27 | _pending_ | gharsetu-lead | Server Logs (Super Admin diagnostics) + Delegations modal fix: new `prototype/super-admin/server-logs.html` with 10 mock daily log files · View modal with dark-theme JetBrains Mono log viewer + colored levels · real Blob download for `.log` files · sidebar entry rolled out to 9 Super Admin pages · planning file `2026-05-27-server-logs-page.md` authored BEFORE code (documents app-port carry-over: `apps/api/logs/api-YYYY-MM-DD.log` Pino convention, Super-Admin-only `/api/v1/platform/logs` endpoints, `VIEW_SERVER_LOG`/`DOWNLOAD_SERVER_LOG` audit actions, 90-day retention) · Delegations create modal widened 560→960px and `.checkbox-group` flipped from column to 3-col grid (responsive 3/2/1) so page doesn't get too long. |
| 2026-05-27 | _pending_ | gharsetu-lead | Master Data ownership split (platform vs org): Cities/States/Payment Methods moved from Admin to Super Admin · `prototype/super-admin/master-data/` subfolder created with 3 sub-pages (Super Admin chrome — Dashboard/Orgs/Plans sidebar + Aayush/Super Admin/AK identity + 4-tab tabbar) · new `super-admin/master-data.html` 3-card landing · Master Data sub-menu added to 5 Super Admin sidebar pages · Admin sub-menu trimmed from 6→3 (Amenities, Categories, Visit Purposes) across 16 admin files · `admin/master-data.html` rewritten as 3-card landing · 3 platform pages deleted from admin · planning file `2026-05-27-master-data-ownership-split.md` authored BEFORE code per Working rule §2 · documents schema model carry-over for app port (platform tables WITHOUT `organization_id`, org tables WITH NOT-NULL `organization_id`). |
| 2026-05-27 | _pending_ | gharsetu-lead + gharsetu-frontend | Master Data restructure + Visit Purposes master: split `master-data.html` into 6 entity pages under `prototype/admin/master-data/` (Amenities, Categories, Payment Methods, Cities, States, Visit Purposes — NEW) · 6-card landing replaces the old tabbed page · expandable Master Data sub-menu in sidebar + More-sheet rolled out to all 12 admin pages · `tenant/visitors.html` purpose select wired to the 6 master values + "managed in Master Data" helper + "Other" free-text reveal · planning file `2026-05-27-master-data-restructure.md` authored BEFORE code (per Working rule §2). Agent stalled mid-task; orchestrator delivered 2 missing sub-pages + landing + sidebar sweep + visitor wiring. |
| 2026-05-27 | _pending_ | gharsetu-lead + gharsetu-frontend | Common UI cleanup: 11 cleanup categories across 37 prototype pages · planning file `2026-05-26-common-ui-cleanup.md` (47 TCs across 7 namespaces, authored retroactively as binding spec for app port) · sidebar logo → role dashboard · topbar-user removed (12 pages) · account-menu v2 with avatar+name+role header · mobile bottom-sheet · `My Profile` moved into account menu · `Logout`→`Sign out` rename · subtitles removed (37) · profile pages standardized + Recent Activity table · tenant identity unified · `Dashboard` label uniform across all roles. |
| 2026-05-27 | _pending_ | gharsetu-lead + gharsetu-frontend | v8 prototype build-out: Per-Room Leasing planning (589 lines, 42 TCs) · Visitor Management + Admin Module Additions + Admin Impersonation + v8 6-module gap closures all implemented across prototype/ · sidebar account-menu refactor (37 pages) · impersonation.js + 153 lines CSS in styles.css (520-673) + new MoreSheet mobile pattern · 12 admin pages + 29 role pages updated. Three agent stalls recovered manually. |
| 2026-05-26 | _pending_ | gharsetu-lead                  | CLAUDE.md overhaul: Working rules + Technical conventions sections added · Hard rules renamed to Scope rules · UIUX doc in source-of-truth · stale rule #2 fixed · Conflict-resolution rules · prototype count 19→29 · new docs/planning/FEATURE_PLANNING.md (template + lifecycle + reactivation discipline) |
| 2026-05-26 | _pending_ | gharsetu-lead + document-agent | UIUX Design Document v3 delivered (10 sections, responsive transformations, structured wireframes) · Solution Overview polish · routing model finalised (three classes) · American spelling sweep · prototype-color audit |
| 2026-05-26 | `f26752f` | gharsetu-lead + document-agent | Solution Overview v6.5 → v8 final-close · Timeline split into Timeline.xlsx · harness-engineering skill rolled out · sibling files reconciled · agent change logs written |

> Older milestones (2026-05-25 harness rollout · 2026-05-22 v6.5 draft · 2026-05-11 Phase 8 closeout `d0805bc` + final regression `02d6a53`) trimmed per the ≤10-entry cap; see git history + `docs/testing/v1/phase-8-closeout.md`.

---

## 8. Cross-session decisions (durable — do NOT delete)

- **N-1 dependency policy** in force (per user) — NestJS stays at 10, NOT upgraded to 11 until explicit reversal.
- **Password minimum length stays at 10** (SRS §10.2) — ASVS L2 12-char recommendation explicitly deferred.
- **Playwright runs `--runInBand` / serial** in CI today — known limitation, not a bug.
- **N+1 dependency overrides** in root `package.json` (`multer`, `file-type`, `path-to-regexp`, `lodash`, `postcss`, `uuid`) — keep these; they patch known CVEs without bumping majors.
- **Submodule layout** (`apps/api`, `apps/web` as git submodules pointing at separate GitHub repos) — keep; see [MULTI_REPO_SETUP.md](docs/planning/v1/MULTI_REPO_SETUP.md).
- **SAAS data isolation** locked to `shared schema + organization_id + Postgres RLS` (2026-05-24).
- **Billing** locked to manual / out-of-scope. No payment gateway, ever.
- **Sequencing pivot (2026-05-26)**: SAAS layer, Super Admin role, Admin Impersonation and Admin Task Delegation all pulled forward into the current engagement (originally deferred). Only subscription billing integration and custom domains + per-org branding remain deferred — see [Solution_Overview.docx §Out of Scope](docs/product/Solution_Overview.docx) and [feature_list.json](feature_list.json) `deferred_post_engagement`.
- **Routing model (2026-05-26)**: three route classes — Org-scoped (`/:org/...`), Platform (Super Admin only, no prefix), Public (no prefix). When the Next.js app is updated for v8, the existing `apps/web/src/app/(app)/<role>/...` folders need to collapse to shared paths under these three classes.
- **Spelling (2026-05-26)**: American English everywhere — "Organization" (not Organisation). Locked across all 10 active files. Both display labels and URLs use American spelling.
- **UIUX Design Document philosophy**: this is a UI/UX-only document — the spec the prototype builds against. Engineering / system design lives elsewhere. Every colour, radius, shadow, focus ring, font and spacing token in the doc must verify against `prototype/assets/styles.css` — never invent values.
- **CLAUDE.md is partitioned into three rule bands (2026-05-26)**: Working rules (process — how we work), Technical conventions (code-level — DB / validation / audit), Scope rules (business — what the product is). Never let a Working / Scope rule contradict — if they appear to, the user is asked, not picked silently.
- **Feature planning files (2026-05-26)**: every new feature gets `docs/planning/features/<YYYY-MM-DD>-<short-slug>.md` BEFORE coding. Lifecycle `proposed → in-progress → shipped`; `shipped` is terminal. Reactivation discipline = grep before coding, extend existing file rather than fix silently. Full template + process in [docs/planning/FEATURE_PLANNING.md](docs/planning/FEATURE_PLANNING.md).
- **Solution Overview structure (final, v8)**: cover (DRAFT marker, no version number) + 8 banners — Fixes, New Roles, New Features, Business Rules, Details, Assumptions, Out of Scope, Next Steps. No timeline content in the .docx — that lives in `Timeline.xlsx`.
- **Timeline lives in Excel**: [docs/product/Timeline.xlsx](docs/product/Timeline.xlsx), regenerated from [doc-assets/templates/generate_timeline.js](doc-assets/templates/generate_timeline.js). The Solution Overview should NOT mention `Timeline.xlsx` by name in customer-facing copy.
- **Single-source shared assets (2026-05-27)**: cross-page prototype UI is driven from shared modules in `prototype/assets/` to prevent drift — `plans.js` (plan catalogue + marketing/signup/super-admin cards, incl. the `popular` "Most Popular" flag), `legal.js` (privacy/terms content), `business-types.js`, and now `public-chrome.js` (public nav + footer for index/contact/privacy/terms). When porting, these become real components/config, not per-page copies. Public marketing/legal pages share one header+footer; auth pages (login/signup) are deliberately chrome-free.

---

## How to update this file

At session exit:

1. Update section 2 (Last session summary) — replace it with this session's 5–10 bullets.
2. Move section 2's previous content into section 7 (one row).
3. Update section 3 (in flight) — mirror what's `in_progress` in `feature_list.json`.
4. Update section 4 (blockers) — mirror `state: "blocked"` rows from `feature_list.json`.
5. Update section 5 (next priority) — top 1–3 things.
6. If a durable decision was made, add it to section 8.
7. Keep this file under ~300 lines. If it grows, trim section 7.
