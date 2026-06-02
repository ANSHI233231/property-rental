# Agent Change Log

Agent: gharsetu-frontend (orchestrator-direct)
Project: GharSetu
Date: 2026-06-01

> Prototype-only session. Full per-change detail lives in `docs/planning/prototype-changes.md`; this is the summary. No app code touched. Solution Overview + Timeline doc work this session is in `document-agent-2026-05-29.md` and was committed separately (`39125f1`, `3a2c53e`).

---

## Task 1 — Admin prototype feature pass
- **Status:** ✅ Completed
- Admin **dashboard**: removed the standalone Emergency (Unit 7C water-leak) alert banner.
- **Maintenance priority labels** standardized system-wide to the 4 canonical levels **Low · Medium · High · Emergency** — the stray "Normal" badge (admin/pm/maintenance dashboards) renamed to "Medium". Matches SRS.
- **Organization detail** (admin + super-admin): **Type of business** now multi-value comma-separated (signup is already multi-select); **Primary Contact** (name · email · mobile) added to the Organization Details card. SRS §4 org-record line updated.
- Admin **unit-detail**: unit-level + per-room **Create Lease** buttons gated hidden when status = Retired or Under Maintenance; Leases table gained a **Type** column and was moved to **after** the Rooms section.
- Admin **lease-detail**: **Renew** opens the Create Lease wizard in renew mode (`create-lease.html?renew=2103`); removed the top "Early Terminate" button and added an end-of-page **Early Termination** section — per-co-tenant consent table → "Early Terminate" enables only when all tenants request → reason modal (min 5 chars). `applyTermViewForStatus()` shows a read-only record when previewing Terminated (`data-status-show="upcoming,active,terminated"`). Removed tenant "View profile" links.

## Task 2 — Auth = email only
- **Status:** ✅ Completed
- `login.html` + `forgot-password.html`: removed all "Email or Phone" wording; `validateIdentifier()` accepts email only (dropped the 10-digit-mobile branch). Phone stays as profile/contact data only. SRS §3 Login row updated.
- Login **"Prototype Shortcuts — Preview as Role"** strip centered under the auth card (`max-width:480px; margin:32px auto 0`).

## Task 3 — Super Admin Contact Inbox bug fix
- **Status:** ✅ Completed
- "Mark as read / replied" wrote the status badge to `td:nth-child(5)` (Subject) instead of `td:nth-child(6)` (Status), clobbering the subject. Fixed the column index.

## Task 4 — PM property + lease clone (assigned-scoped) — finish + status labels
- **Status:** ✅ Completed (with prior-session work logged in `gharsetu-frontend-2026-05-29.md`)
- **NEW `pm/create-lease.html`** — cloned from `admin/create-lease.html` (full wizard + renew mode), PM chrome swapped in, `PROPERTIES`/`UNITS`/`TENANTS` scoped to the 3 assigned properties (Green Valley id1, Sai Heights id2, Mayur Vihar id3); Rohini Greens removed. Cancel → `leases.html`; title → Property Manager.
- **`pm/leases.html`** — re-cloned to the admin filter-tile listing layout (filter tiles, searchable Property filter, Lease Type column), chrome-swapped (Leases active), Rohini removed from filter, "+ New Lease" → `create-lease.html`, rows → `lease-detail.html?id=…`.
- **`pm/unit-detail.html` + `pm/lease-detail.html`** — at admin parity (Rooms + Leases Type + gated create-lease; renew + Early-Termination consent + no view-profile). PM chrome; assigned-scoped.
- **Lease status labels** standardized to **Active / Upcoming / Ended / Terminated** across admin + PM (no Closed/Expired/Renewed); lease-detail simulator button "Expired" → "Ended".
- Feature plan: `docs/planning/features/2026-05-29-pm-property-lease-clone.md`.

### Verification
- `node --check` on extracted inline JS of `pm/create-lease.html`, `pm/unit-detail.html`, `pm/lease-detail.html`, `admin/create-lease.html`, `admin/lease-detail.html` — all pass.
- Scope grep: PM active data shows only Green Valley / Sai Heights / Mayur Vihar; no other-org property names.
- PM lease status badges: only Active/Upcoming/Ended/Terminated.

### Sync
- `docs/planning/prototype-changes.md` — multiple rows appended.
- SRS updated: login email-only (§3), business-type multi-value (§4), priority levels (already low/medium/high/emergency).

### Notes
- App port to `apps/web` / `apps/api` for all v8 features remains pending (prototype is the design contract).

---

## Task 5 — Prototype listing enhancements (filters · clickable cards · pagination)
- **Status:** ✅ Completed · Plan: `docs/planning/features/2026-06-01-prototype-listing-enhancements.md`
- **Shared infra:** `assets/paginate.js` gained **`Paginator.setPredicate(tableId, fn)`** (custom/range row predicate, AND-combined with search/tile/attr; powers all date-range filters) and later **`data-search`** support in `trMatchesSearch` (scan a hidden attr so the visitor code stays hidden but searchable). `assets/styles.css` gained **`a.kpi`** clickable-card styling (hover/focus, reduced-motion).
- **Super Admin:** dashboard cards clickable → filtered pages; Organizations **Contact column + Created-date range filter** + contact search **and migrated to the shared Paginator** (fixing a bespoke right-aligned footer → one constant pagination design); Contact Inbox **received-date range filter**.
- **Admin:** dashboard cards clickable; **Properties** Total-Rooms column + Property-Type/Room-Status filters + Manager filter wired + clickable tiles; **Leases** Lease-Type filter + wired the dead Property filter; **Delegations** All-status tab + **new `delegation-activity.html`**; **Maintenance** room cascade filter + room field in raise form; **Rent** Room column + 5 filters (Tenant/Property/Unit/Room/PM) + room in Record Payment; **Settings** Field+Date filter; **Organization** invoice Status/Plan/Date filters; **Master Data** "Specializations" → "Maintenance Specializations" (25 files).
- **PM:** dashboard cards clickable; Properties Rooms column + Room-status filter; Leases Property + Lease-Type filters wired.

## Task 6 — NEW ROLE: Security Guard + gate-initiated visitor approvals
- **Status:** ✅ Completed (prototype) · Plan: `docs/planning/features/2026-06-01-security-guard-role.md`
- **`SECURITY_GUARD=5`** — org-scoped, assigned properties, Visitor-Management-only, email login.
- **New `prototype/security/`**: `dashboard.html` (gate KPIs, clickable), `visitors.html` (gate console — "Log Gate Arrival" routes an approval request to the tenant by lease type; common-area = guard approves directly, no code; approve/deny/check-in/out), `profile.html`; guard-only nav.
- **`tenant/visitors.html`**: "Pending approvals" section (any one co-tenant approves/denies; section hides when none).
- **`admin/users.html`**: Security Guard role option + assigned-properties checkboxes. **`login.html`**: guard preview shortcut (grid 5→6). **`admin/visitors.html` + `pm/visitors.html`**: "Awaiting tenant" tile + gate rows.
- **All visitor tables (admin/pm/security/tenant):** added a **Type** column (Pre-approved / Gate), a **Visitor-type filter**, **search-by-visitor-code** (hidden `data-search`), and **Property/Unit filters** (admin cascade; pm/security selects; tenant single-unit → type+code only).
- **SRS synced:** roles 5→6, matrix (Guard row + amended Tenant), enum `SECURITY_GUARD=5`, Module 8 gate flow + `awaiting_tenant_approval`, page map.
- **Solution Overview** (with `gharsetu-lead`): added the Security Guard role bullet to Visitor Management; tenant bullet now "register + approve gate visitor requests"; check-in/out bullet now includes Security Guard. (See `gharsetu-lead-2026-06-01.md`.)

### Bug fixes this session
- Super Admin Organizations pagination was a bespoke right-aligned footer → migrated to the shared centered `.pagination` component (one constant design).
- Broken HTML comments `<\!--` → `<!--` on `security/dashboard.html` + `admin/delegation-activity.html` (zsh mangled `!` in a heredoc; they were rendering as visible text).

### Verification
- `node --check` on all changed inline JS + `assets/paginate.js` — all pass.
- Scope: PM/Security pages assigned-scoped; Guard pages carry no other-module links.
- python-docx round-trip on `Solution_Overview.docx` after each bullet edit.

---

## Task 7 — Public-pages redesign v2 (glassmorphism / light-forward) — IN PROGRESS
- **Status:** 🟡 In progress · Plan: `docs/planning/features/2026-06-01-public-pages-redesign-v2.md`
- **Source:** client Google-Stitch design kit at `stitch_modern_design_overhaul/` (7 `code.html` + `screen.png` + `DESIGN.md`).
- **Decisions (confirmed with user):** Hybrid fidelity — adopt the Stitch *layout* + glassmorphism + light-forward surfaces, but render in GharSetu's **Poppins/Inter** + **navy/royal-blue/saffron** brand tokens (no Manrope/Hanken, no Material-3 names). Scope = **all 8 public pages**. Pricing keeps `plans.js`. Icons = **inline SVG** (no Material Symbols font). Cool-blue **surface tokens added to `styles.css`** (single-source rule preserved).
- **Done so far:**
  - `assets/styles.css` — added `--surface / --surface-low / --surface-container / --surface-high / --surface-dim / --surface-deep` to `:root`; flipped `.auth-shell` + `.auth-card` from navy gradient to **light glass** (cool-blue surface + soft orange/navy washes + frosted white card); repurposed `.public-band` to a light centered page header + kept `.glass-panel` frosted card.
  - `index.html` — rebuilt homepage to bento/glass layout (Rent/Maintenance/Leases/Visitors bento, navy 3-step band, 5-persona grid incl. Security Guard, plans via `renderMarketingPlans`, navy final-CTA). **Hero still being flipped navy → light to match reference.**
- **Pending:** flip homepage hero to light + harmonize section surfaces · `public-chrome.js` (light nav w/ logo icon + Features/How-it-Works/Pricing links, navy footer) · `login` (glass + Preview-as-Role modal, all 6 roles) · `forgot-password` · `reset-password` · `organization-signup` (light 3-card re-skin, keep wiring + validation) · `contact` · `privacy` · `terms`.
- **Non-negotiables held:** validation contract (errors below field, ⚠ glyph, no native tooltips) · DD/MM/YYYY · ₹ Indian grouping · single 1023px breakpoint · 44px targets · WCAG AA · no external image hosts (CSS mocks instead of Stitch `lh3.googleusercontent.com` URLs).

### Task 7 — COMPLETED (all 8 public pages)
- `assets/styles.css` — surface tokens; light-glass `.auth-shell`/`.auth-card`; light `.public-band` + `.glass-panel`.
- `assets/public-chrome.js` — light blurred nav (inline-SVG saffron logo mark + Features/How-it-Works/Pricing centre links + Login/Register), deep-navy footer (Product / Support).
- `index.html` — hero flipped to light (cool-blue surface, dark headline w/ saffron accent, navy-framed dashboard mock), section surfaces harmonized to tokens; bento + navy steps band + 5-persona grid + plans (`renderMarketingPlans`) + navy CTA retained.
- `login.html` — light glass card, orange icon badge, icon-in-field email/password (royal-blue focus per contract), eye toggle, custom validation (no native tooltips), **Preview-as-Role modal wired to all 6 dashboards** (super-admin/admin/pm/maintenance/security/tenant), minimal auth footer. Added inline tailwind color config (page lacked it) so `text-saffron`/`text-royal-blue` resolve.
- `forgot-password.html` / `reset-password.html` — inherit light glass; forgot gains mail-icon field; both gained the inline tailwind color config.
- `organization-signup.html` — outer card → transparent focused-width wrapper; each `.form-section` → glass card; section headings → charcoal title + saffron accent bar; new centered "Onboard your organization" header. Form fields, plan tiles (`renderSignupPlanTiles`), business-type chips, searchable selects, validation all unchanged.
- `contact.html` — light `.public-band` header + `.glass-panel` form + Email/Call/Office info row (inline SVG). Validation + record-only success unchanged.
- `privacy.html` / `terms.html` — light `.public-band` header (Legal-Document eyebrow + title + sub) + `.glass-panel` wrapping `renderLegalDoc` output. Legal copy still from `legal.js`.
- **Verification:** `node --check assets/public-chrome.js` OK; inline-JS parse OK for login/index/contact; no external image hosts, no Material-Symbols, no Manrope/Hanken anywhere in `prototype/*.html`.

### Task 7 — follow-up (user feedback: Plans + Personas hadn't adopted new design)
- `index.html` personas → bigger `rounded-2xl` 56px icon tiles (`.persona-ic`), 20px headings, hover border-saffron + lift + icon scale-110 (matches Stitch persona cards).
- `assets/plans.js` `renderMarketingPlans` rewritten to the v2 card design: **popular plan = elevated navy gradient card** (white text, saffron "Most Popular" badge, saffron button), others = light glass cards with navy-outline button; big 40px price + /mo, single-column saffron-check feature list (new `gsMarketingFeatureList`, theme-aware for navy vs light). Still driven by `GHARSETU_PLANS` (single source).
- `index.html` `#plansGrid` → `align-items:center`, 960px, gap 28; `.mkt-pop` scales 1.05 ≥1024px. `node --check assets/plans.js` OK; index inline JS OK.

### Task 7 — follow-up 2 (user feedback: header/footer + legal/auth consistency)
- **Shared chrome added to all auth pages** — `login`, `organization-signup`, `forgot-password`, `reset-password` now inject `#gs-public-nav` + `#gs-public-footer` via `public-chrome.js` (matches the register reference). Login's bespoke mini-footer removed (+ its dead `.auth-footer` CSS). **No dark/light-mode toggle** in the nav (uses Login/Register, per user).
- **Privacy / Terms → card grid** — `legal.js renderLegalDoc` now renders each section as a glass `.legal-card` (icon chip + heading + body) in a responsive `.legal-grid` (2-col → 1-col <768px), with a centered "Last updated" line; matches the Stitch legal layout. `.legal-grid`/`.legal-card` added to `styles.css`. Single `.glass-panel` wrapper removed from both pages. Legal copy still sourced from `legal.js`.
- **Verification:** `node --check` OK on `legal.js`/`plans.js`/`public-chrome.js`; all 8 public pages confirmed to carry nav+footer+chrome.js; auth inline JS parses.

### Task 7 — follow-up 3 (personas "Built for every person…" exact clone)
- Cloned the Stitch persona-section **animated background-paths effect**: `.path-container` with 4 `.animated-path` SVG strokes (navy/saffron/royal-blue, staggered `animation-delay`/`duration`) running the `path-flow` stroke-dashoffset loop at `opacity:0.32`, behind `z-index:1` content; `personas-wrap` clips it. Reduced-motion → static.
- Cards switched from heavy glass to the kit's translucent style: `rgba(255,255,255,0.45)` + `backdrop-blur` + `outline-variant` border, `rounded-24`, hover→saffron border + lift, 56px `rounded-2xl` icon tiles (group-hover scale-110).
- Added the **char-by-char title reveal** for "Built for every person in your building" (`.char-reveal` spans, 22ms stagger, IntersectionObserver trigger, nbsp word-gaps, reduced-motion safe).
- Verified: index inline JS parses; 5 persona cards; paths + char-reveal present.

### Task 7 — follow-up 4 (header/nav hover treatments)
- `public-chrome.js` nav matched to the Stitch kit: **Login = outlined navy button**, **Register = solid saffron button** — both with the `btn-glow` hover (saffron glow `0 0 20px rgba(255,111,0,.35-.45)` + `scale(1.02)`, `active:scale(0.96)`). Nav links (Features/How it Works/Pricing) gained an **animated saffron underline** (`::after` width 0→100%) + orange hover + focus-visible ring. Nav height → 76px (kit h-20). Reduced-motion disables the scale/underline transitions.
- Verified `node --check assets/public-chrome.js` OK.

### Task 7 — follow-up 5 (section headings: colour + sparkles)
- Section headings recoloured **royal-blue → dark charcoal** (`.section-head h2`) — matches the kit's near-black headings (user: blue "not great").
- Added a **vanilla-JS sparkles effect** (port of the Magic UI SparklesText *idea*, NOT the React component — prototype is static HTML, so no React/framer-motion/three install). Brand colours via `data-sparkle`: saffron+royal-blue on light sections (capabilities, plans), saffron+white on the navy bands (how, final-CTA). 7 looping `gs-sparkle` star SVGs per heading, periodically re-seeded; reduced-motion disables them. Personas heading keeps its char-reveal (no conflict).
- Verified index inline JS parses.

### Task 7 — follow-up 6 (animated brand background on form pages)
- New `assets/auth-bg.js` — a **vanilla WebGL** transparent overlay that layers slow brand-tinted (navy/royal-blue/saffron) flowing-noise motion over the EXISTING light surface (colours unchanged). Original compact fbm shader (NOT the three.js/React snippet — prototype is static HTML; no three/lucide/framer installed). Host-aware: inside `.auth-shell` (login/forgot/reset) or fixed-behind-content (contact, `body.gs-aurora-on` raises main/footer). Graceful: no-WebGL/compile-fail → canvas removed, static bg kept. Reduced-motion → single still frame. DPR capped 1.5; SRC_ALPHA blend; low alpha (~0.1) to stay subtle.
- Included on `login`, `forgot-password`, `reset-password`, `contact`. `node --check assets/auth-bg.js` OK.

### Task 7 — follow-up 7 (sparkles on form/legal page titles + shared refactor)
- Extracted the sparkles effect to a **shared `assets/sparkles.js`** + moved its CSS into `assets/styles.css` (`.sparkle-host`/`.sparkle`/`gs-sparkle`). Homepage now consumes the shared script (inline sparkle CSS + JS removed; `sparkles.js` loaded after the inline char-reveal so personas heading still gets both). `data-sparkle` colours + optional `data-sparkle-count`; reduced-motion safe; re-wrap guard; exposes `window.gsSparkleDecorate`.
- Applied `sparkle-text` to page titles: **Contact us · Privacy Policy · Terms of Service · "Onboard your organization" (register) · "Welcome Back" (login)** — saffron+royal-blue. `sparkles.js` included on each. Legal pages got sparkles only (NOT the animated bg — that stays scoped to auth+contact per the earlier request).
- Left forgot/reset out (their prominent text is a 14px tagline — sparkles would crowd it). Verified `node --check assets/sparkles.js` OK; index inline JS OK.

### Task 7 — follow-up 8 (privacy/terms → bento + trust strip, matching reference)
- `legal.js renderLegalDoc` rebuilt from a uniform 2-col grid to the kit's **bento**: featured "Overview" card (`col-8`, larger heading + CSS gradient panel instead of the stock photo — no external images), two stacked cards in a right `col-4` column, two `col-6` cards on the bottom row, extras full-width. Coloured **left-border accents** (saffron / royal-blue / slate). Added the navy **"Bank-Grade Security" trust strip** (icon + copy + ghost cross-link to the sibling legal doc + saffron "Contact support" CTA → contact.html). Legal copy still 100% from `legal.js`.
- `assets/styles.css` legal block replaced (`.legal-bento`/`.legal-col-*`/`.legal-right`/`.legal-card` accents/`.legal-feat-panel`/`.legal-strip*`); responsive → single column < 1024px.
- `privacy.html`/`terms.html` content width 820 → 1080px so the bento breathes.
- `node --check assets/legal.js` OK.

### Task 7 — follow-up 9 (homepage "deck" mode: section-as-screen + zoom-through)
- Homepage-only, **desktop ≥1024px + motion-allowed only**. The 6 sections (hero/capabilities/how/personas/plans/final-CTA) tagged `.screen`; `<html>` gets `deck-on` → native **CSS scroll-snap (y proximity)**, each screen `min-height:100vh; scroll-snap-align:center`, content flex-centred.
- **Zoom-through** 3D feel via a rAF scroll-driven controller: each `.screen` gets `--sx` (scale) / `--so` (opacity) from its distance to viewport centre — centred = crisp; leaving upward = scale↑ + fade; arriving from below = zoom-in from smaller. `perspective:1200px` on body for depth.
- **< 1024px or prefers-reduced-motion → normal flowing homepage** (deck disabled + inline vars cleared on resize; matchMedia listeners toggle live). Scrollbar/trackpad/anchor nav all still native (no scroll-hijack). Other pages untouched.
- Verified index inline JS parses.

### Task 7 — follow-up 10 (deck scroll fix: half-screen sticking)
- Root cause: `scroll-snap-type: y proximity` rests between sections. Switched to **`y mandatory`** + `scroll-snap-align: start` + `scroll-snap-stop: always` so each gesture always settles on a full screen.
- `.screen` now `height:100vh; overflow:hidden; box-sizing:border-box` (fixed full screen, no trap/half-rest). Deck-mode spacing tightened (section-head margin, bento gap/padding, personas/plans gap) so tall screens fit one viewport. Footer excluded from snap. Added a `max-height:740px` fallback that lets an over-tall screen scroll internally instead of clipping.
- Verified index inline JS parses.

### Task 7 — follow-up 11 (deck: stop stretching sections / restore original design)
- User report: fixed `height:100vh` + `overflow:hidden` + `justify-content:center` + tightened gaps stretched/distorted the sections. Reverted to a **minimal** deck: `.screen { min-height:100vh; scroll-snap-align:start; }` only — no fixed height, no clipping, no forced centring, no spacing overrides. Each section keeps its exact original design/padding and is simply ≥1 screen tall. Kept `scroll-snap-type: y mandatory` (fixes the earlier half-screen rest) + the zoom-through transform. Removed the `scroll-snap-stop:always`, the content-tightening rules, and the short-desktop overflow fallback.
- Verified index inline JS parses.

### Task 7 — follow-up 12 (deck: header offset + focus-pull blur)
- Sticky header was covering each screen's top → added `scroll-padding-top:76px` + `scroll-margin-top:76px` so snapped sections sit just below the 76px header.
- Turned the leaving-section fade into an intentional **focus-pull**: `.screen` now also gets `filter: blur(var(--bl))` driven by distance to viewport centre — 0px (sharp) when centred, up to 6px off-centre — so scrolling a section into view sharpens it. Softened the opacity fade (arriving 0.40 / leaving 0.55, was 0.65/0.85) so sections blur into depth rather than ghosting out. `--bl` cleared with the others below 1024px.
- Verified index inline JS parses.

### Task 7 — follow-up 13 (Playwright-verified deck scroll fix)
- **Tested with Playwright** (apps/web @playwright/test 1.59 + cached chromium-1223 headless shell; sandbox disabled for the Mach-port launch). Findings: deck active + header offset OK, but **content sections measure ~1100–1240px tall vs a 900px viewport** → per the scroll-snap spec, snapping never settles inside a section taller than the scrollport, which IS the "stuck half-screen" behaviour. Also found a double-offset bug (`scroll-padding-top:76` + `scroll-margin-top:76` = 152px).
- **Fix:** dropped rigid scroll-snap (it cannot work with sections taller than the screen); switched to **smooth free scroll + a dead-zone focus-pull**: a section stays fully sharp (blur 0 / opacity 1 / scale 1) while it dominates the viewport (|d|<0.45), then zooms/blurs only as it clearly leaves. Removed `scroll-margin-top`; kept `scroll-padding-top:84px` for anchor jumps + `scroll-behavior:smooth`. Effect ramp now `e=(|d|-0.45)/0.85`.
- **Re-tested:** dominant section blur 0.00px / opacity 1 at 71–100% coverage across all 6 sections; transitions blur ~0.4–1.2px only. No half-screen rest. Inline JS parses.

### Task 7 — follow-up 14 (Playwright: fix scroll-up "empty/stuck" + transition double-blur)
- Screenshots showed the real issue: `min-height:100vh` on shorter-than-screen sections left big dead whitespace bands (worst on scroll-up), and the centre-distance blur math blurred BOTH sections during a hand-off.
- Fixes: (1) **removed forced `min-height:100vh`** + flex-centring — sections keep natural height and flow continuously (no dead gaps). (2) **Focus math reworked to centre-coverage from layout geometry** (`offsetTop`/`offsetHeight`, transform-feedback-free): a section is fully sharp whenever it covers the viewport centre line; it only recedes/blurs once entirely above (leaving, zoom-through) or below (arriving, zoom-in). One dominant sharp section at all times.
- Playwright re-verified up + down: dominant section `blur 0.00px` at every rest (coverage 64–83%), neighbours blurred only in transition; no empty band. Inline JS parses. Temp test files removed.

### Task 7 — follow-up 15 (true full-page deck: flip-per-gesture, centred, non-sticky header, no h-overflow)
- Reworked the homepage deck per user direction into a **fullPage-style flip**:
  - `.screen` = `height:100vh; overflow-y:auto` (inner scrollbar hidden) with `justify-content: safe center` → content **vertically centred** when it fits, **scrolls internally** when taller (no clip, no blank-top).
  - **Wheel/key navigator** flips exactly **one section per gesture** (cooldown-debounced); a tall section scrolls internally first, then advances. Keyboard: ↑/↓/PgUp/PgDn/Space/Home/End.
  - **Header not sticky** on the deck (`#siteNav { position:absolute \!important }` → scrolls away with the hero); other pages keep the sticky chrome.
  - **No horizontal overflow**: focus scale kept `<=1` (recede) + `overflow-x:hidden`.
- **Playwright-verified:** navPos=absolute; hOverflow=0; one 40px wheel → scrollY=900 (full flip) + navTop=-900 (header gone); `how` content centre 450==viewport centre 450; capabilities internally scrollable (338px). Inline JS parses.

## Task 7 — Rent views (Lease/Property tabs) + Lease collection schedule
- `assets/styles.css`: added `.view-tabs`/`.view-tab` segmented control (navy active).
- `admin/rent.html`: added Lease-wise/Property-wise view tabs + shared Month control; generalised the rent-ledger script to `render(tab, scope)`; added `propertyRows()` aggregation; tab switching hides the lease filter card and resets lease filters. View-only.
- `admin/lease-detail.html`: added Block 4b "Rent Collection" — month-by-month table (Month/Rent/Collected/Late Fee/Status) generated from lease start→end + rent-change schedule, with a lease-total footer.
- Plan: `docs/planning/features/2026-06-01-rent-views-and-lease-collection-schedule.md`.
- Verified: `node --check` both pages; DOM-stub harness for all rent tab×scope combos and the 13-row collection schedule. No commit (awaiting user).

### Task 7 — follow-up 16 (slim header back + CTA & footer on one screen)
- **Header back, slim:** `#siteNav` fixed on the deck at **56px** height (was scrolled-away absolute); screens get `padding-top:72px` so content clears it.
- **Tall-section fix:** replaced unreliable `justify-content: safe center` with a JS `is-tall` class (a section taller than the screen → `flex-start` + internal scroll; else centred). Playwright: capabilities/plans tagged tall; CAP heading now at 133 (clear of header), not -118.
- **Closing screen:** wrapped the final-CTA section + footer slot in one `#closing .screen`; navigator's last index is now this screen (footer no longer a separate stop). Shrunk the CTA panel (padding/font/button) so **CTA + footer fit one viewport together** — Playwright (instant-scroll, settled): CTA heading 263, footer 515–759, footer fully visible.
- hOverflow 0; one-wheel flip + slim fixed header verified. Inline JS parses.

### Task 7 — follow-up 17 (plans cards: 2-column feature list + wider cards)
- `plans.js renderMarketingPlans`: feature `<ul>` switched from single flex column to **2-column grid** (`grid-template-columns:1fr 1fr; column-gap:18px; row-gap:9px`); feature rows 14px→13px, gap 10→8 for fit.
- `index.html` `#plansGrid` widened **960 → 1180px** (cards ~377px) to host the two columns; gap 28→24.
- Playwright: ul is grid w/ 2 cols (~150px each), 14 features, hOverflow 0; **plans screen now fits one viewport** (no longer `is-tall`). Screenshot confirms clean 2-col layout.

## Task 8 — Leases ↔ Rent ↔ Lease-detail data reconciliation
- `admin/leases.html`: replaced 8 static rows with a JS-generated `LEASES` roster of 24 (20 active mirroring the rent ROSTER + 2 upcoming/1 ended/1 terminated). Generated before paginate.js.
- `admin/rent.html`: ROSTER values unchanged (canonical active set); added mirror comment (L-2101..L-2120).
- `admin/lease-detail.html`: re-pointed to L-2114 (Raj Sharma + Priya, Green Valley 3A, ₹18,000) — title, renew link, tenant cards, consent-table names.
- Result: rent roll (20) = active subset of all leases (24); per-tenant unit/rent identical across screens; detail matches its list row.
- Verified: node --check all 3; DOM-stub confirms 24 rows / 20 active / Rohan 7C ₹22,000 both / L-2114 match. No commit.

### Task 7 — follow-up 18 (closing screen layout fix)
- Closing screen was centring the whole CTA+footer block → footer floated mid-lower with dead space below it. Fixed: `#closing` is `justify-content:flex-start` with the `.final-cta-wrap` set `flex:1` (CTA centred in the upper area) and `.gs-footer` set `flex:0 0 auto` → **footer pinned to the screen bottom**. Added `#closing { background:#fff }` so the upper area is seamless. Playwright: footerBottom=900 (pinned), CTA top 263, both fully visible.

### Task 7 — follow-up 19 (fit the capabilities bento to one screen)
- Capabilities (bento) measured 1214px vs 900px viewport → 314px over (the one section that overflowed the deck screen). Added **deck-only compaction** for `#capabilities` (tighter cell padding 36→20, mini-mock 18→12, mock-table row padding, feature-list gap, feature-h size/margins, section-head margin 56→22, h2 38→30, bento gap, padding-bottom 96→28). Normal/mobile layout unchanged.
- Playwright: capScrollH 901 ≈ clientH 900 (overBy 1, within tolerance) → no longer `is-tall`; centres as one screen. Screenshot confirms all 4 cards + heading fit, not cramped.

### Task 7 — follow-up 20 (deck polish: viewport-relative sizing across major desktop heights)
- **Status:** Completed
- **Started:** 2026-06-01
- **Completed:** 2026-06-01
- **ui-ux-pro-max skill guidance applied:**
  - Animation §7 `easing` + `duration-timing`: added `transition: opacity/filter/transform 180ms ease-out` on `.screen` for crisp enter/sharpen feel.
  - Depth effect §7 `transform-performance`: reworked `depthFactor()` — intensity scales with `vh/900` (0.75..1.6 capped) so tall monitors get more dramatic depth, short laptops stay readable. Added a 0.10 flat-zone (no ramp below 10% offset) so the dominant section stays fully sharp per the "dominant section must remain fully sharp" principle.
  - Opacity floor raised (never below ~0.58 for off-screen neighbours; was 0.5), blur scales 0→5px×df (was fixed 6px).
  - `primary-action` / CTA presence: enlarged closing CTA card with `clamp()` — padding `40→72px`, h2 `30→44px`, button `14→17px/12→16px` — all responsive across 768→1440.
  - `spacing-scale`: replaced all fixed-px deck overrides with `clamp()`/`vh`/`vmin` expressions for capabilities, plans, hero, how, roles sections.
- **Changes (prototype/index.html):**
  - Deck CSS `@media` block: `.screen padding-top` → `clamp(64px, 7vh, 88px)` (replaces hard 72px).
  - `transition` added to `.screen` for 180ms ease-out enter.
  - `depthFactor()` JS function added; all three depth vars (`--sx`, `--so`, `--bl`) now scaled by vhFactor; flat-zone of 0.10 before ramp.
  - `#closing .final-cta` padding/h2/p/btn — all `clamp()` for vmin-based scaling.
  - `#capabilities` — all 12 compaction properties converted from fixed-px to `clamp(floor, vmin/vh, ceil)`.
  - `#plans .mkt-plan` — card padding/radius/price font/feature list spacing overridden via `!important clamp()` (inline-style cards from plans.js).
  - `#hero`, `#how`, `#roles`, `#plans` section-head margins + heading sizes — all `clamp()`.
- **Playwright results (1440px wide, 3 heights):**
  | Height | h-overflow | nav fixed | hero | cap | how | roles | plans | closing | CTA inView | footer inView |
  |--------|-----------|-----------|------|-----|-----|-------|-------|---------|-----------|--------------|
  | 768    | 0         | yes (top:0)| fits | fits* | fits | fits | fits | fits | yes | yes |
  | 900    | 0         | yes (top:0)| fits | fits | fits | fits | fits | fits | yes | yes |
  | 1080   | 0         | yes (top:0)| fits | fits | fits | fits | fits | fits | yes | yes |
  - *capabilities at 768: scrollH=770 vs clientH=768 (2px subpixel rounding → `is-tall` tag fires but content fully readable; `fits` check passes at ≤4px tolerance). All other sections fit exactly. JS parses: true on all heights.
- **Files changed:** `prototype/index.html` (deck CSS + JS — no other pages, no shared assets touched)
- **Notes:** Normal/mobile flowing layout unchanged (deck CSS gated in `@media (min-width:1024px) and (prefers-reduced-motion:no-preference)`). `prototype/assets/plans.js` read-only (not edited). Temp Playwright test files cleaned up.

## Task 9 — Rent filters: combined cell, lease-type filter, payment-status dropdown
- `admin/rent.html`: Lease-wise views now lead with a bold combined **Property · Unit (· Room)** column; Tenant de-emphasised to a normal column. Headers updated (cumulative 8 cols, monthly 7).
- Added **Lease type** filter (data-lease-type on rows) + **Payment status** dropdown (mirrors tiles via shared `rentSetStatus()`, re-rendered per view). Both reset on tab-switch.
- Relabelled the status control "Payment status" per user (it's collection status, not lease status; lease status lives on the Leases page).
- Cascade (Property→Unit→Room) confirmed intact.
- Verified: node --check + DOM-stub (combined column, 8/7 cols, dropdown opts sync). Also: leases.html defaults to Active. No commit.

### Task 7 — follow-up 21 (plans cards alignment fix)
- Popular (Standard) card was inflated + staggered: removed `.mkt-pop { transform:scale(1.05) }` (emphasis now navy fill + badge only) and changed `#plansGrid` `align-items:center`→`stretch` so all three cards are equal height with bottom-aligned "Get started" buttons.
- `plans.js` feature rows 13→12px + `align-items:flex-start` (top-aligned checks) → long labels (Maintenance Requests / Admin Impersonation) no longer wrap to 2 lines.
- Playwright (1440×900): all 3 cards identical geometry (top 268, bottom 720, h 452). plans.js parses.

### Task 7 — SESSION CLOSE (public-pages redesign v2 + homepage deck)
Scope of THIS session's work (frontend / prototype only — no apps/, no SRS, no feature_list state changes):
- **Shared assets:** `assets/styles.css` (surface tokens, light-glass auth-shell/auth-card, public-band, glass-panel, legal bento + trust strip, sparkles styles); `assets/public-chrome.js` (light nav w/ logo mark + centre links + outlined-Login/solid-Register glow buttons; navy footer); `assets/plans.js` (`renderMarketingPlans` rebuilt: navy popular card, 2-col feature grid, equal-height alignment); `assets/legal.js` (`renderLegalDoc` → bento + Bank-Grade-Security strip); NEW `assets/auth-bg.js` (WebGL brand background, login/forgot/reset/contact); NEW `assets/sparkles.js` (shared magic-text headings).
- **Pages:** `index.html` (hybrid bento/glass homepage + full-page DECK: desktop-only flip-per-gesture, slim fixed 56px header, is-tall internal-scroll, focus zoom/blur, clamp()-responsive 768→1440, closing CTA+footer screen), `login` (glass + Preview-as-Role modal), `forgot-password`, `reset-password`, `organization-signup` (glass 3-card), `contact` (glass form + info), `privacy`/`terms` (legal bento). Domain placeholders → `anshika.tlitech.net`. Section headings → sparkles; personas char-reveal + animated paths.
- **Verification:** all touched JS parses; deck behaviour Playwright-verified across 768/900/1080 (no h-overflow, header fixed on every screen, all sections fit, CTA+footer together). Records: `docs/planning/features/2026-06-01-public-pages-redesign-v2.md` + `docs/planning/prototype-changes.md` row + this log (follow-ups 1–21).
- **NOT done (intentionally):** apps/web port, SRS edits, feature_list.json state flips (worker≠checker). Deck is homepage-only; mobile/reduced-motion keep the normal flowing layout.

---

## Task 10 — Admin small-fix pass (dashboard / properties / leases / users) — orchestrator-direct
- **Status:** ✅ Completed · prototype-only, no app code, no SRS/feature_list change. Full per-change detail in `docs/planning/prototype-changes.md` (7 rows dated 2026-06-01, this batch).
1. **Dashboard — Lease Expirations table:** each row's Lease ID linked to `lease-detail.html?id=<id>` (`text-royal-blue` anchor, Leases-page convention). 4 rows.
2. **Properties — room tiles:** added **Available Rooms** (→ create-lease) + **Total Rooms** (30; `<button>` filtering to has-rooms) beside Available Units.
3. **Upcoming lease date refresh:** L-2245 (Aditi Joshi, GV 1B) `01/04/2026→31/03/2027` ⇒ `01/07/2026→30/06/2027` (old start was in the past vs today 01/06/2026). 4 files: admin+pm `unit-detail.html` (display) + admin+pm `create-lease.html` (mock arrays).
4. **Leases — filters + cleanup:** added **Termination-requested (Yes/No)** filter (`data-termination`; flagged L-2114 active-pending + L-2080 terminated) and a **Unit** searchable filter (rule #18; options built from the roster in the IIFE before `searchable-select.js` inits). **Removed the "Pending Co-Tenant Consent" section** (phantom lease, not in roster).
5. **Users — actions to buttons + Impersonate last:** all 29 action cells → compact buttons (`btn … !py-1 !px-3 !text-sm`): Edit/Reset `btn-secondary`, Deactivate `btn-danger`/Activate `btn-secondary`, **Impersonate `btn-primary`, moved last**. Dropped `·` separators; wrapped in a flex row. Kept `imper-link` class + `data-target-*` + inactive-row hide. Patched `confirmStatusToggle` (tag-agnostic selector + `btn-danger`↔`btn-secondary` swap).
6. **Properties — Occupancy column removed** (header + 14 cells) and **edit-form off-by-one fixed**: `editPropertyRow` ignored the leading `<td data-pg-serial>` cell, so every field loaded one column off (serial→Name, Name→Address, …). Re-indexed to c[1]/c[2]/c[3]/c[4]/c[6]. **CSV export** had the same bug + missing Rooms → now maps explicit cells [1..6], drops Occupancy.
- **Verification:** scripted transforms reported expected match counts (29 user cells, 14 occupancy cells); grep confirms 0 leftover `action-link` anchors, 0 stale `01/04/2026`, consent section gone. No commit (awaiting user instruction).
- **Process note:** these logs (this entry + the `prototype-changes.md` rows) were written after the user flagged that the session's edits weren't yet logged — the per-task append should have happened incrementally per CLAUDE.md Working rule #5.

## Task 11 — Lease deep-link param fix (Properties + PM dashboard)
- **Status:** ✅ Completed · prototype-only.
- **Bug:** "Upcoming Leases" tile (admin Properties) + "Upcoming" KPI (PM dashboard) linked `leases.html?filter=upcoming`, but the Paginator deep-link param is `<tableId>_f` (`tbl-leases_f`). Wrong param ignored → page defaulted to Active.
- **Fix:** 3 links → `?tbl-leases_f=upcoming` / `=active` (`admin/properties.html` ×2, `pm/dashboard.html` ×1). Both leases tables share id `tbl-leases`, so the param prefix matches; the Paginator activates the matching tile + filters on init.
- **Found (deferred):** other dashboard `?filter=` KPI links (maintenance/properties/rent) use an inconsistent convention and likely don't filter; `super-admin/organizations.html?filter=pending` works via a custom handler. Offered the user a full audit.
- **Verification:** grep confirms 0 remaining `leases.html?filter=`. No commit.

## Task 12 — Delegations: dedicated Detail page (replaces drawer) + Activity Log removal
- **Status:** ✅ Completed · prototype-only. Plan: `docs/planning/features/2026-06-01-delegation-detail-page.md` (authored before code per Working rule #2; status in-progress).
- **NEW `admin/delegation-detail.html`** — full page reached from each row's **View**. Detail **card** (name + role chip + status badge; Tasks granted chips · Window `start → end · N days` + "N days remaining" for Active · Created by · **Revoked by** only when revoked) + **"Actions taken during this window"** table (When/Action badge/Target) with a real empty state. Reads `?id=<n>` from a `DELEGATIONS` array, **numeric ids 1–7** (rule #19), `findDelegationById` via `Number()`. Prototype clock 01/06/2026 for days-remaining; HTML-escaped output; unknown id → "Delegation not found" + back link. Chrome copied from `delegations.html` (Delegations nav active); reuses `.task-chip`/`.role-chip-*`/`.card`/`.divider`/`.data-table`/badges — no new tokens.
- **`admin/delegations.html`** — 7 View links rewired `#`+`openDetailDrawer('slug')` → `delegation-detail.html?id=<n>` (sunita=1, manoj=2, raju=3, pooja=4, sunita-expired=5, manoj-expired=6, anil-revoked=7); removed the **Activity Log** button, the side-drawer markup, `.detail-drawer*` CSS, and `drawerData`/`openDetailDrawer`/`closeDetailDrawer` JS; Escape handler trimmed to the revoke modal. Earlier in the task: **Revoked tab "Revoked by" column removed** (th + cell) — that data now renders on the detail card.
- **`admin/delegation-activity.html` DELETED** — user decision: don't maintain two action views; the global Activity Log is superseded by the per-delegation page. Confirmed 0 repo-wide references before deleting.
- **Verification:** `DELEGATIONS` parses (7 entries, ids 1–7, statuses active×3/upcoming/expired×2/revoked); Pooja(4)=0 actions → empty state; Anil(7) revoked-by present; inline-script brace/paren balance 0/0; grep shows 0 dangling `delegation-activity`/`openDetailDrawer`/`detail-drawer` refs. No commit.

## Task 12b — Delegation Detail: clearer actions + sidebar Master Data fix
- **Actions table made self-explanatory.** Each action now carries a friendly **`label`** (e.g. "Rent changed", "Payment recorded", "Request raised"), the raw audit **`code`** (e.g. `UNIT_RENT_UPDATED`), and a plain-English **`detail`** sentence with concrete specifics (amounts, before→after rent, tenant + unit + property, priority, resolution, reason). Table columns are now **When (IST) · Action · What changed** — Action shows the friendly label badge only; "What changed" shows the sentence. (The raw audit code was initially shown in small mono beneath the badge, but removed per user feedback — label + code read as the same action twice.) All 16 actions across the 7 delegations enriched.
- **Sidebar Master Data section fix.** The new page had been written with the wrong classes (`sidebar-section-title` span + `sidebar-section-chev`), which the CSS doesn't size — so the icon + chevron rendered huge. Replaced with the canonical markup from `delegations.html`: `<svg class="section-icon">` (database-cylinder) + text + `<svg class="section-chev">`, both sized by the existing `.sidebar-section-header .section-icon/.section-chev` rules.
- **Verification:** data parses, all actions complete, script brace/paren balance 0/0, `section-icon` present and no `sidebar-section-title` remnant. No commit.

## Task 13 — Admin nav rename (Rent → Rent collection) + Audit "Actor" → "User"
- **Sidebar "Rent" → "Rent collection"** across all 25 admin pages (20 top-level + 5 `master-data/` subpages) via a scoped script matching `href=".../rent.html" class="sidebar-link"` (lazy-stops at the link's own `Rent</a>`, so the mobile **tabbar stays "Rent"** — short label, like "Maint."). 25/27 sidebar files updated (2 had no rent link).
- **Audit Log "Actor" → "User"** on `admin/audit-log.html`: column header, `Actor role`→`User role`, `Actor name`→`User name`, and ids `actor-role`/`actor-search` → `user-role`/`user-search` with their `for=`. Confirmed no JS referenced the old ids; grep shows 0 remaining `actor` anywhere in the prototype.
- No commit.

## Task 14 — Check Availability page (PLAN only) + PM properties admin-parity
- **Plan authored** for a new **Check Availability** search-and-lease page: `docs/planning/features/2026-06-01-check-availability.md` (proposed, 12 TCs, 5 open decisions). Left filter rail (dates/type/property/city/state/BHK/bath/kitchen/rent·area ranges/amenities — facets from the master assets) → center result cards of available units/rooms → click card → details popup → **Create Lease** reuses the existing `create-lease.html?unitId=&roomId=` deep-link (lands Step 4). Entry: a "Check Availability" button beside Add Property on `properties.html`. **No code yet** — awaiting sign-off.
- **PM properties admin-parity (executed):** removed the **Occupancy** column from `pm/properties.html` (header + 5 cells), matching the admin change. Verified 8 cols header=rows. Did **not** copy admin-only items that don't map to PM (room summary tiles → PM tiles are tenure pagination; edit-form fix → no PM property CRUD; CSV export → none). Upcoming-lease date already mirrored to `pm/unit-detail.html`. No commit.

## Task 15 — Rent Collection completion (tiles + query-time status model + Portfolio tab)
- **Status:** ✅ Completed · prototype-only. Plan: `docs/planning/features/2026-06-01-rent-collection-completion.md`.
- **Top tiles** → Total Due · Collected · Outstanding · Overdue (Total Due = Collected + Outstanding; Overdue = count + "N leases past due"). `updateKpis` recomputes from ROSTER×MONTHS.
- **Query-time payment status (never stored):** `computeStatus(due, collected, dueDay)` → Paid / Partially Paid / Outstanding / Overdue / Prepaid (precedence prepaid>paid>overdue>outstanding>partial; overdue at due-day+5, BL-12). ROSTER dropped stored `ms`, now `mp` (collected) + `dd` (due day). Months → June 2026 (`TODAY_DAY=12`, `GRACE_DAYS=5`); `cellFor` derives status; `badge()` + `MONTHLY_TILES` relabelled (Outstanding=grey `badge-closed`, Partially Paid=amber). Verified: paid 10/partial 2/overdue 4/outstanding 1/prepaid 3; reconciles.
- **Portfolio tab (3rd view):** `#rentPortfolio` (Summary card: Total Properties 4 · Active Leases 20 · Monthly Due · Collection Rate + progress bar; Month-by-Month Trend table). `monthAgg(key)` aggregates Due+Collected over the **same** month → rate June 80% / past 100%, clamped ≤100% (**507% cross-period bug avoided**). `render()` toggles table/tiles/filters vs portfolio cards; added June to the Month dropdown; `#rentTableCard` id added.
- **Verified:** inline script parses (`new Function`); status counts + KPI reconciliation + portfolio aggregates via DOM-stub. No commit.
- **Carry-over:** SRS NR for "payment status is derived, not stored"; optional tab rename (Lease-wise/Property-wise → By Lease/By Building) to match reference; consider defaulting the Month filter to June.

## Task 16 — Check Availability page (built) + Privacy/Terms blue-card removal
*(work spans 2026-06-02)*
- **Check Availability — BUILT** (plan `docs/planning/features/2026-06-01-check-availability.md`, audited then built on recommended defaults D1–D6).
  - NEW `admin/check-availability.html`: left filter rail + center result cards + details popup. `PROPERTIES/UNITS/ROOMS` numeric-id mock (ids match `create-lease.html`) → flat `INVENTORY`. Filters: Looking-for (Both/Units/Rooms), Available-from date, Property (searchable), State→City cascade, Property type, Bedrooms/Bathrooms min, Kitchen, Rent range, Area range, Amenities (match-all). Card click → popup (attribute grid + amenities) → **Create Lease** = existing `create-lease.html?unitId=&roomId=` deep-link (lands Step 4). Mobile: filters slide-in sheet.
  - NEW `assets/amenities.js` — single source for the 8 amenities (+ `amenityName()`), fixing the plan's missing-asset gap.
  - `admin/properties.html`: **Check Availability** topbar button (Export · Check Availability · + Add Property).
  - `assets/styles.css`: `.avail-layout/.avail-filters/.avail-grid/.avail-card/.avail-chip` + mobile filter-sheet (compose existing tokens, no new colors).
  - **Verified (DOM-stub):** script parses; 5 unit + 7 room cards (12 in Both); every deep-link unit/room id resolves in `create-lease.html`; no-double-count (room-based units show rooms only). No commit.
- **Privacy/Terms blue card removed** (user): the empty navy `legal-feat-panel` in the Overview card made the page uneven. `legal.js` `renderLegalDoc` flattened from the 12-col bento (col-8 feat + right stack + col-6/12 spans) to a **uniform 2-col card grid**; `card()` no longer takes/emits the feat panel; dropped `height:100%`; removed `.legal-feat-panel`/`.legal-col-*`/`.legal-right`/`.legal-card.feat` CSS. Affects privacy + terms (shared). `node --check` OK; no stale refs. No commit.

## Task 17 — Super Admin dashboard: remove pending alert + fix tile nav
- Removed the **"3 organizations awaiting your review"** alert section (redundant with the Pending Sign-ups tile).
- Fixed KPI tile destinations: **Total Active Users** → `organizations.html?filter=active` (was generic). Pending Sign-ups (`?filter=pending`) + Plan Coverage (`plans.html`) already correct; Organizations → all. `organizations.html` honours `?filter=pending|active|deactivated|all` after Paginator init, so all four cards now land on the right filtered view. Verified: alert gone (0 matches), all hrefs map to accepted filter values. No commit.

## Task 18 — Check Availability: type-checkbox + load-on-scroll + moved to Leases; Super Admin data reconciled
*(2026-06-02)*
- **Check Availability enhancements** (`admin/check-availability.html`):
  - Property type filter → **checkbox list** (multi-select match-any, from `GHARSETU_PROPERTY_TYPES`); `<select>` removed; `selectedTypes()` + predicate `types.length && indexOf(propType)<0`.
  - **Load-on-scroll**: `renderCards` → batches of 9 via `appendBatch()` + `IntersectionObserver` on `#availMore`. Refactored card HTML into `cardHTML()`.
  - **More data**: +5 properties (varied type/city/state) + deterministic generator → 66 cards (59 unit/7 room), 8 batches; 4 types, 4 cities. Generated ids 9xxx (not in create-lease → deep-link opens wizard normally).
  - **Sticky desktop + mobile sheet** confirmed already in place (`.avail-filters` sticky; ≤1023px slide-in via the "Filters" toggle).
  - **Entry moved Properties → Leases** (user): removed button from `properties.html`; added beside "+ New Lease" on `leases.html`; page sidebar/more-sheet active + back-link re-pointed Properties→Leases.
  - Verified: script parses; counts; button on leases (1) not properties (0).
- **Super Admin dashboard data reconciled to `organizations.html`** (8 orgs): tiles Organizations 8 (4 active/3 pending/1 deactivated) · Pending 3 (Oldest 21/05/2026) · Total Active Users 66 (42+12+4+8) · Cap Utilization 53% (24/45, relabelled from bogus "Plan Coverage 87%"); donut → all-8 (Basic 4/Standard 3/Premium 1, arcs re-proportioned, centre "8"); Recently Approved → the 4 truly-active orgs (removed pending Saffron shown as Active); Recent Platform Activity rewritten coherently. No commit.

## Task 19 — Check Availability checkbox filters + show occupied; Plans filter fix; Invoices dup-strip
*(2026-06-02)*
- **Check Availability** (`admin/check-availability.html`):
  - **Bedrooms/Bathrooms/Kitchen → checkbox lists**; **Rent/Area → grouped range checkboxes** (Below ₹10k, ₹10k–15k, …; Below 500, 500–800, …). Generic `passGroup()` + `renderChecks()`; removed min/max inputs + `readNum`.
  - **Show occupied** (fix contradiction with the wizard): include occupied units/rooms (real 101/102/10501/10502/20102/20203 + ~⅓ generated) → 72 cards (48 avail / 24 occ); per-card Available(green)/Occupied(grey) badge + "frees <date>"; new **Status** filter; popup badges status + **disables Create Lease for occupied**; count label "N results".
  - Verified: script parses; 48/24 split; status filter + disabled-occupied logic present.
- **Super Admin Plans** (`plans.html` + `plans.js`): "View list" linked `?plan=<numeric id>` but the org list only accepts plan **slugs** → fixed to `?plan=<slug>`; corrected `plans.js` Standard `orgs` 5→3 to match the org list + dashboard. `node --check` OK.
- **Super Admin Invoices** (`invoices.html`): removed the top KPI strip (Total Issued/Outstanding/Paid/Cancelled) — duplicated the filter-tile row below; tiles retained.
- No commit.

## Task 20 — Super Admin Invoices: month filter (+ org filter) fixed
- The From/To **month** selects had no `onchange` and rows had no month attr → inert. Added a script that derives `data-month` (YYYY-MM) from each invoice number and wires both selects to a `Paginator.setPredicate` range filter (AND-combines with tile/org/plan). Defaults flipped May→May ⇒ **Any→Any** so the page doesn't load pre-hidden. Same fix for the **Organization** filter (rows had no `data-org` → derived from the Org cell). Verified: script parses, org cell text matches option values, 4 months of data. No commit.

## Task 21 — Super Admin audit fixes + master CRUD bugfix + several follow-ups (2026-06-02)
Result of the "go through super admin pages" audit + the user's follow-ups. All prototype-only, no commit. Detail in `docs/planning/prototype-changes.md` (7 rows dated 2026-06-02).
- **Invoices reconciled** to the 5 *approved* orgs via a JS roster generator (18 invoices, 13 paid/4 issued/1 cancelled, ₹999/₹2,999/₹6,999). Was billing a phantom org set.
- **Master Add/Edit bug fixed across all 9 master pages** (4 super-admin + 5 admin): Add was missing the leading `data-pg-serial` cell (column shift); Edit never updated the row. Now add prepends the serial cell + `Paginator.refresh`, and edit writes back via an `editingRow` lookup. Verified serial cells present + scripts parse on all 9.
- **Payment Methods → "Reference required" column** (+ checkbox, `data-ref`, `refRequired` in `payment-methods.js`); wired super-admin invoice-detail Mark Paid to hide/not-require the ref field for Cash.
- **Visit Purposes → "Requires details" column** (+ checkbox, `data-detail`). Consuming visitor-form wiring deferred.
- **Business Types "Other" removed** (master + `business-types.js`).
- **Admin Organization invoices:** removed meaningless Issued from/to date filter; added the missing Plan column.
- **Admin Delegations "All" tab** now renders one combined table (was 4 stacked panels).
- **Verification:** all 9 masters serial-present + balanced; invoices generator 18 rows; delegations parses; payment-methods 6 cols; visit-purposes 7 cols.
- **STILL OPEN (flagged to user):** (1) audit item #2 — super-admin `organization-detail.html` shows a Pending org (Saffron) with an *activated* plan history + 18 active users (incoherent for Pending); (2) wiring consuming visitor forms to show a detail input when a visit purpose has `requires-detail`.

---

## Task 22 — Admin nav reorder (sidebar + more-sheet, all 28 admin pages)
- **Status:** Completed · prototype-only. No app code. No commit.
- **Started:** 2026-06-02
- **Completed:** 2026-06-02
- **Method:** Node.js script `scripts/reorder-admin-nav.js` — tokenizes top-level sidebar children (11 `<a>` + 1 `<div class="sidebar-section">` Master Data block) and more-sheet tokens (anchors + the Master Data group header+sublinks); re-emits in the canonical order; idempotent on re-run.
- **Sidebar new order:** Dashboard → Properties → Leases → Rent collection → Maintenance → Visitors → Users → Delegations → Master Data (section block) → Settings → Organization → Audit Log.
- **More-sheet new order:** Properties → Leases → Visitors → Users → Delegations → Master Data group → Settings → Organization → Audit Log → My Profile → Sign out.
- **Files changed:** 28 of 28 admin pages (23 `prototype/admin/*.html` + 5 `prototype/admin/master-data/*.html`) all reordered; `scripts/reorder-admin-nav.js` added.
- **Verification:**
  - All 28 pages: 11 `sidebar-link` anchors + 1 `masterdata` section present after reorder; 10 `more-sheet-link` anchors (excl. masterdata group) in correct sequence.
  - `admin/master-data/amenities.html`: `../` prefix preserved on all 11 top-level links; bare `href="amenities.html"` sublink active class intact.
  - `admin/dashboard.html` has `sidebar-link active` = 1; `admin/leases.html` active = 1.
  - Pages with no active `sidebar-link` (master-data subpages, profile, master-data.html) each have active `sidebar-section-header` on the Master Data block instead.
  - Idempotency: second run reports 0 files changed.
- **Notes:** Bottom tabbar unchanged. No hrefs, SVGs, labels, or `active` classes altered.
- **2026-06-02 follow-up:** the one-off `scripts/reorder-admin-nav.js` was **deleted** after the reorder was applied + verified (untracked, not referenced by any page, idempotent — nothing to re-run). The `scripts/` folder is gone.

---

## Task 23 — Lease-detail Security Deposit · renew fix · Settings · Organization · invoice GST · Record-Payment plan (2026-06-02)
Orchestrator-direct batch of user-driven follow-ups after the nav reorder. All prototype + docs. No commit. Ledger rows in `docs/planning/prototype-changes.md` (dated 2026-06-02).

- **Lease detail — Security Deposit section (NEW).** Added a Security Deposit block (deposit ₹36,000; KPIs total/refunded/balance; refunds table + empty state) with a **Record Deposit Refund** modal (Full/Partial toggle, amount validated ≤ balance, method from `payment-methods.js` with method-aware reference field honouring `refRequired`, date, note; button locks to "Fully refunded" at ₹0 balance). **Refund gated to ended/terminated leases** via `data-status-show="expired,terminated"` (+ a note for upcoming/active explaining why it's disabled). **Layout:** Rent Change Schedule and Security Deposit now sit **side-by-side 6:6** (`lg:grid-cols-2 … items-start`); Rent Collection stays full-width below.
- **Lease detail — Tenants merged into the Lease Summary card.** The separate Tenants card was removed; Lease Summary is now a 2-col card (left = summary rows incl. `#ld-status-badge`; right = Tenants in a fixed-height **scroll** container `max-height:340px; overflow-y:auto`) so the card height stays constant as co-tenants grow.
- **Renew Lease fix.** `admin/create-lease.html?renew=2114` was landing on the default step because the `RENEWALS` map only had key `'2103'`; the leases reconciliation had re-keyed the renewable lease to `2114`. Added the `'2114'` entry (unit 103, two co-tenants, ₹18,000 / ₹36,000 deposit). Renew mode now correctly lands on the Tenants step (Step 4) with the title swapped to "Renew Lease". **Why it broke:** the lease-id reconciliation (Task 8) changed the link's `renew=` id but the RENEWALS lookup wasn't updated in lockstep.
- **Settings page.** Removed the read-only "last changed by …" metadata line and the standalone Cancel button (+ dead `cancelSettings`/`backToSettings` fns). Save now **stays on the same page** (toast + Recent-changes table) instead of swapping to a success card; removed the duplicate "Saving…" toast (one success toast only); removed the "Full history in the Audit Log" link. **Save button redesigned** — `btn-primary` when dirty, save icon + `#saveBtnLabel`, min-width 172px.
- **Organization page.** Subscription Plan History — plan value rendered as a **badge consistently** across rows (one row was plain text). Added a **Property cap** row (`#sub-property-cap-display`) + Active-properties + a Property-cap column in the history table; JS reads `plan.propertyCap` (null → "Unlimited properties").
- **Admin invoice detail.** Removed the "GST line item — deferred (see planning note §4 Q2)" row.
- **Record Payment — period-first model (PLAN ONLY, no code).** Authored `docs/planning/features/2026-06-02-record-payment-period-first.md` (status `proposed`, 14 TCs). User decisions locked: **plan-first** + **keep BL-13 unchanged (no month-end cap)** — the reference screenshot's month-end cap is dropped. Two sign-off questions remain (rework-vs-augment; single-period+rollover vs multi-select). No page code written.
- **Verification:** lease-detail Security-Deposit/refund markup present (22 hits) + merged-tenants scroll container present; create-lease has the `'2114'` renew key; settings `#saveBtnLabel` present, dead fns + read-only line + audit link all gone; org property-cap wiring present (5 hits); invoice-detail has no GST line (only `fonts.gstatic.com` remains).
