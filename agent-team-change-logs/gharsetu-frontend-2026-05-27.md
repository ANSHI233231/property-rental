# gharsetu-frontend — change log — 2026-05-27

## Task 1 — Profile "Edit details" form (all 5 roles)

**Request:** profile pages showed a JS `alert()` instead of a real edit form; need a form to update profile where **Email and Role are not editable** — only Name and Mobile.

**Done:**
- Wired the "Edit details" trigger on all five profile pages (super-admin / admin / pm / maintenance / tenant). Maintenance had no button — added one after the Account-status row. Tenant's "Edit phone / email" renamed to "Edit details".
- Injected an `#editProfileModal` + script into each page: `#ep-name` (editable), `#ep-phone` (editable, "Mobile number"), `#ep-email` (disabled, "Email (locked)"); **Role field omitted entirely**.
- `openEditProfile()` reads current Name/Phone/Email from the `.profile-row` spans; `saveProfile()` validates name non-empty + phone ≥10 digits, writes back to the rows + `.profile-name` header; Escape + backdrop-click close.
- Verified: all 5 pages `modal=1`, no `ep-role` field, email `disabled` + "Email (locked)" label present.

## Task 2 — Homepage redesign (`prototype/index.html`)

**Request:** "implement the home page new design plan" — modern, AI-era visual redesign per [`docs/planning/features/2026-05-27-homepage-redesign.md`](../docs/planning/features/2026-05-27-homepage-redesign.md).

**Done — full rewrite of `prototype/index.html`, sections A–H:**
- **Nav (A):** sticky white bar → navy glass-blur (`rgba(26,35,126,0.85)` + `backdrop-filter`) on scroll past 60px; logo "Ghar" + "Login" switch to white under glass for contrast; saffron **Register** pill added (hidden ≤1023px).
- **Hero (B):** navy gradient (`135deg #1A237E→#0D1757→#1565C0`) + 10% saffron radial mesh; 60px H1; copy left, browser-framed **dashboard product mock** right (KPIs + rent ledger built from `.badge` atoms); factual **stats strip** (120+ / 18 / 4) on hero bottom edge, hidden ≤480px.
- **Capabilities (C):** flat 4-card grid replaced with **4 alternating two-column feature rows** (mock + text), each with mock-lift hover.
- **How-it-works (D):** new 3-step section with saffron `01/02/03` pills + desktop dashed connector.
- **Roles (E):** **bento 2×2** with Admin emphasized (saffron left-border + navy icon + "Owner / Operator" pill).
- **Plans (F):** light-gray bg; popular card gets a saffron glow; `renderMarketingPlans("plansGrid")` **unchanged** (single source preserved).
- **CTA + Footer (G/H):** merged into one seamless navy band.
- **JS:** glass-nav scroll toggle + `IntersectionObserver` scroll-reveal; both reduced-motion aware. Skip link added for a11y bypass-blocks.

**Open-decision resolutions:** OD-1..OD-5 → A (richer options); **OD-6 → A (Register pill)**, overriding the plan's documented default B — rationale recorded in the planning file §4/§5 (nav CTA serves the "AI-era" goal; pill hidden on mobile). New CSS in an inline `<style>` (allowed by plan §2.5), not the shared `styles.css`.

**Verified:** `renderMarketingPlans("plansGrid")` present (1×); all `badge-*` classes used exist in `styles.css`; 6 sections in correct order; 9 `.reveal` hooks; no helper-caption subtitles under any `<h2>`; HTML tag balance clean (parser: 0 residual-open, 0 errors).

**Docs:** planning file status → shipped + OD log; `docs/planning/prototype-changes.md` created + row added.

## Task 3 — Homepage CTA/footer separation

Final CTA and footer both navy → read as one block. Stepped the footer down to deep navy `#0D1757` (the hero-gradient midpoint shade) + a `rgba(255,255,255,0.10)` hairline top border, so the CTA stays the primary band and the footer recedes.

## Task 4 — Profile pages: Role only as badge

Removed the **Role** `.profile-row` from super-admin / admin / pm / maintenance profiles (tenant never had one). Role stays as the `.profile-role` badge by the name. Edit-profile JS only touches Name/Phone/Email, so unaffected.

## Task 5 — Server Logs: removed Lines column

Dropped the **Lines** `<th>` + row `<td>` from `super-admin/server-logs.html`; header/cells rebalanced 5-for-5. Underlying `lines` data kept (file-preview modal still shows the count).

## Task 6 — Unified public-page header/footer (single source)

Public pages had drifted (homepage glass nav + rich footer vs. older simple nav/slim footer on contact/privacy/terms). Created **`assets/public-chrome.js`** — one source that injects an identical sticky glass nav (Login + Register pill) and the deep-navy Company/Legal footer into `#gs-public-nav` / `#gs-public-footer` placeholders. Wired into `index.html` (refactored — removed inline nav/footer markup, chrome CSS, glass-scroll JS), `contact.html`, `privacy.html`, `terms.html`. Auth pages (login, signup) stay chrome-free. Tag balance verified clean on all 4.

## Task 7 — Super Admin sidebar consistency

`super-admin/master-data/payment-methods.html` was missing the **Business Types** sublink (added to the other masters later, skipped here). Added it. Diffed all 9 Super Admin pages + 4 master subpages — sidebar item sequence now identical everywhere (only `active`/`../` differ, as expected).

## Task 8 — Master-data deactivate reason → button tooltip

Across all 6 masters (4 platform: cities/states/payment-methods/business-types; 2 org: amenities/categories) removed the in-cell `<p role="note">Cannot deactivate — currently used by N record(s)…</p>` line (27 total) and moved each message into the disabled Deactivate button's `title` attribute (dropped the now-dangling `aria-describedby`). Scripted; verified 0 leftover notes, 27 titled buttons.

## Task 9 — Plans: set "Most Popular" from Super Admin

The public "Most Popular" highlight was a fixed `popular:true` on Standard in `plans.js`. Added a Super Admin control on `super-admin/plans.html`: the featured card shows a saffron **★ Most Popular** badge + saffron top-border; every other active plan shows a **Set as Most Popular** button. `setPopular(id)` flips the flag exclusively (clears all others) and re-renders; deactivating the popular plan clears its flag (can't feature a deactivated plan). Reads/writes the shared `window.GHARSETU_PLANS` so home + sign-up cards stay in sync within the session. JS syntax-checked.

## Task 10 — Signup: de-hardcode the plan helper line

`organization-signup.html` helper read "Not sure? Pick **Standard** — you can change later." — brittle (wrong the moment Standard is renamed or another plan becomes featured). Changed to **"Not sure? Pick the one marked Most Popular — you can change later."** (no plan name). Also aligned the signup plan-tile badge in `plans.js` from "Popular" → "Most Popular" so the text matches the visible badge; both track the shared `popular` flag. `plans.js` re-checked.

---

### Session close (2026-05-27)
- Debug scan on all changed files: clean (no `console.log` / `debugger` / `FIXME`).
- `claude-progress.md` updated (§2 summary, §3 in-flight, §7 log row + trim, §8 single-source decision).
- `docs/planning/prototype-changes.md` rows added for this session.
- `pnpm build/test/lint/typecheck` not run — **no app code touched** (all changes are static `prototype/` + `docs/`; `apps/web` + `apps/api` submodules untouched).
- Commit/push NOT performed — awaiting explicit user authorization per CLAUDE.md Working rule §1.
