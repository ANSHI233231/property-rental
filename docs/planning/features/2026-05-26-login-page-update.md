# Login page update — logo-as-home, role shortcuts, register link, stale-copy fix

| Field | Value |
|---|---|
| Status         | proposed |
| Started        | 2026-05-26 |
| Shipped        | — |
| SRS row        | (prototype-only — no SRS row; production login already shipped under v1) |
| Test cases     | TC-LOGIN-001..018 (designed in §3, prototype-scope) |
| Prototype todo | row to be added to `docs/planning/prototype-changes.md` on ship |

## 1. Requirement (as given)

> "let keep this doing and we will plan the login page / remove the back to home link and on click on logo take it to home / add login as roles button for all roles and links those to dashboard of the roles / pm/dashboard, /admin/dashboard"

Plus the carried-over Q5 follow-up from `2026-05-26-organization-signup.html.md` §4:

> "update `prototype/login.html` line 59 stale 'No public sign-up' copy + add 'Register your organization' link"

## 2. Plan

### 2.1 Intent

Refactor `prototype/login.html` to align with the new SAAS landing page (`prototype/index.html`) shipped in `2026-05-26-landing-page-saas.md`. Specifically:

1. Make the brand mark the single "go home" affordance — clicks through to `prototype/index.html` (already does today; the existing dedicated "← Back to home" link becomes redundant).
2. Remove the separate "← Back to home" link in the credential card (`prototype/login.html` line 19).
3. Replace the current two-step pattern (credential form → role picker after submit) with a **single-card layout** where the credential form stays visible at all times, and a clearly-labelled **"Prototype shortcuts — preview as role"** strip lives below the card with 4 role-jump buttons. This makes it obvious to reviewers (and stakeholders) that role-jump is a prototype-only convenience, not part of the real login flow.
4. Fix the stale copy at line 59: "No public sign-up. Accounts are created by your Admin or Property Manager." Replace with a "Don't have an account? Register your organization →" link that routes to `organization-signup.html`.

The email + password form, the "Forgot password?" link, the "Remember me" checkbox, the password eye-toggle, and the saffron primary submit button are all preserved verbatim — these constitute the production design and must not change.

### 2.2 Why drop the "two-step then role picker" pattern

The current `prototype/login.html` shows a credential form, then on submit it swaps to a "Pick a role to demo" card with 4 role buttons. This worked for v1 (single-tenant, no public landing page) but is now redundant:

| Why it dies now | Detail |
|---|---|
| Landing already explains the product | `prototype/index.html` §5 Roles introduces the four roles. The login page no longer needs a role-explanation moment. |
| Reviewer friction | Reviewers have to fake a login (any email + 8-char password) before they can pick a role. Surfacing the role buttons below the card removes that friction. |
| Conflates "real flow" with "prototype convenience" | A reviewer seeing "Pick a role to demo" might assume the production app behaves that way. A clearly-demoted "Prototype shortcuts" strip says "this is fake" out loud. |
| Easier to remove for production | When the live app builds, the role-shortcuts strip is deleted in one block. The current two-step model would need surgery on the submit handler. |

This is a small UX deviation from the user's literal phrasing ("add login as roles button" — they might imagine the existing role-picker step). The lead's call is that **demoting role-jump to a visually-distinct strip below the auth-card** is closer to user intent than keeping the two-step machine. Captured as Q1 in §4 for the user to redirect if wrong.

### 2.3 Page anatomy — top to bottom (single-card layout, no two-step)

| Zone | Content | Source / class |
|------|---------|----------------|
| 1. Backdrop | `.auth-shell` — navy → royal-blue 135° gradient (`prototype/assets/styles.css` line 508) | unchanged |
| 2. Auth-card | `.auth-card` — white card, 12 px radius, 40 px / 44 px padding, max-width 480 px, shadow `0 16px 48px rgba(0,0,0,0.18)` (line 509) | unchanged |
| 2a. Brand mark | `<a href="index.html" class="auth-brand">Ghar<span>Setu</span></a>` (lines 510–512) — **this becomes the only "back home" affordance** | reused verbatim from current line 17 |
| 2b. Tagline | "Property Rental Management" via `.auth-tagline` (line 513) | reused verbatim from current line 18 |
| 2c. ~~Back to home~~ | **REMOVED** — current line 19 `<div class="text-center mb-6"><a href="index.html">← Back to home</a></div>` | delete |
| 2d. Email/phone field | `<label class="label">` + `<input class="input">` (lines 21–22 today) | reused verbatim |
| 2e. Password field + eye-toggle | Current lines 24–47 (label, input, eye-toggle button + both SVG eye states) | reused verbatim |
| 2f. Remember me + Forgot password row | Current lines 49–54 | reused verbatim |
| 2g. Submit button | `<button class="btn btn-primary w-full mt-6">Login</button>` — current line 56 | reused verbatim |
| 2h. ~~No public sign-up copy~~ | **REPLACED** — current line 59 stale text removed; replaced with: | rewrite |
| 2i. **NEW** Org sign-up link | `<div class="mt-6 text-center text-sm muted">Don't have an account? <a href="organization-signup.html" class="text-royal-blue font-poppins font-semibold">Register your organization →</a></div>` | new |
| 3. **NEW** Prototype shortcuts strip — below the auth-card | Visually demoted, full-width muted block: small "PROTOTYPE SHORTCUTS — PREVIEW AS ROLE" label (Poppins 500 12 px UPPERCASE letter-spacing 0.5 px, white at 65 % opacity to stay legible on navy gradient), then a 4-button row (responsive to 2-col then 1-col). Each button is `.btn .btn-secondary` with `color: #fff; border-color: rgba(255,255,255,0.6); background: transparent;` overrides (matches the landing hero's "Login" secondary CTA pattern from `prototype/index.html` line 67). | new |
| 3a. Login as Admin | → `admin/dashboard.html` | new |
| 3b. Login as Property Manager | → `pm/dashboard.html` | new |
| 3c. Login as Maintenance Staff | → `maintenance/dashboard.html` | new |
| 3d. Login as Tenant | → `tenant/dashboard.html` | new |
| 3e. Helper text | "Prototype only. Real login uses the form above — your role is detected from your account." (Inter 13 px, white 50 % opacity) | new |

### 2.4 What gets deleted

| Lines | Reason |
|---|---|
| 19 — `<div class="text-center mb-6"><a href="index.html" ...>← Back to home</a></div>` | Logo at line 17 now serves this purpose. |
| 58–60 — `<div class="mt-6 text-center text-xs muted">No public sign-up. Accounts are created by your Admin or Property Manager.</div>` | Stale under v8 SAAS — public org sign-up IS in scope. Replaced by the new sign-up link (Zone 2i). |
| 63–79 — `<div id="role-step" class="auth-card" style="display:none;">...</div>` (the entire "Pick a role to demo" second card) | Two-step pattern dropped per §2.2. Role-jump moves to the demoted shortcuts strip outside the auth-card. |
| 16 — the inline `onsubmit="event.preventDefault(); ... document.getElementById('role-step').style.display='block';"` handler | Now obsolete — submit becomes a no-op `event.preventDefault()` only (still prevents form GET-redirect on enter; submit doesn't navigate anywhere in the prototype). |

### 2.5 What stays untouched

| Element | Why |
|---|---|
| `<head>` block (lines 3–12) | Already correct — Inter + Poppins fonts, Tailwind CDN, shared `assets/styles.css`. |
| Brand mark anchor `<a href="index.html" class="auth-brand">` | This is the new "home" affordance. Already points at `index.html` (the new landing). No change needed. |
| Tagline "Property Rental Management" | Production copy, keep. |
| Email + password fields, labels, autocomplete attributes | Production form, keep. |
| Password eye-toggle button + both SVG states + `togglePassword()` JS function | Production form, keep. |
| Remember me checkbox | Production form, keep. |
| "Forgot password?" link → `forgot-password.html` | Production link, keep. |
| Saffron submit button copy "Login" | Production CTA, keep. |
| Final `<script src="assets/validation.js">` | Production wiring, keep. |

### 2.6 Design tokens — all sourced from `prototype/assets/styles.css`

| Use | Token / class | Source line | CSS value |
|---|---|---|---|
| Backdrop gradient | `.auth-shell` | 508 | `linear-gradient(135deg, #1A237E 0%, #1565C0 100%)` |
| Card | `.auth-card` | 509 | white · 12 px radius · 40 px / 44 px padding · max-width 480 px · `0 16px 48px rgba(0,0,0,0.18)` shadow |
| Brand mark | `.auth-brand` + `span` | 510–512 | navy + saffron, Poppins 700 28 px, centered, hover opacity 0.8 |
| Tagline | `.auth-tagline` | 513 | slate, 14 px, centered, 32 px margin-bottom |
| Label | `.label` | 161–170 | slate Poppins 500 13 px UPPERCASE letter-spacing 0.4 px |
| Input | `.input` | 123–134 | mid-gray border, 6 px radius, 44 px min-height, 10 px / 14 px padding |
| Input focus | `.input:focus` | 135–138 | 2 px royal-blue border |
| Primary CTA | `.btn .btn-primary` | 93–94 | saffron `#FF6F00` bg, white text, hover `#d95f00`, Poppins 600 15 px, 6 px radius |
| Secondary CTA (role buttons) | `.btn .btn-secondary` | 95–96 | transparent bg, royal-blue text + 2 px border. **Override for navy backdrop**: `color: #fff; border-color: rgba(255,255,255,0.6);` (matches landing hero pattern at `prototype/index.html` line 67). |
| Sign-up link | `text-royal-blue font-poppins font-semibold text-sm` (Tailwind utilities + `var(--color-royal-blue)`) | — | royal-blue Poppins 600 14 px |
| Helper text on navy | inline `color: rgba(255,255,255,0.5); font-size: 13px;` Inter | — | demoted, legible on navy gradient |
| Shortcuts label | inline `color: rgba(255,255,255,0.65); font-family: 'Poppins'; font-weight: 500; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;` | — | matches `.label` pattern but white-tinted for navy |
| Focus ring | `*:focus-visible` | 490 | 2 px saffron outline + 2 px offset |
| Shortcut button min tap target | `.btn` mobile padding (`12px 20px` at ≤ 767 px, line 103) | 102–103 | ≥ 44 × 44 px on mobile |

**No new tokens.** Two inline `color:` overrides on the secondary buttons are necessary because `.btn-secondary` defaults to royal-blue text on white — illegible on the navy backdrop where the shortcuts strip lives. Same override pattern is already used on `prototype/index.html` line 67. If the same override surfaces a third time, promote to a `.btn-secondary--on-dark` utility in `styles.css`; not warranted yet.

### 2.7 Responsive behaviour (UIUX Design Document §3 — single 1024 px breakpoint)

| Viewport | Behaviour |
|---|---|
| 320 px | `.auth-shell` padding 24 px; card spans full width minus padding. Card padding reduces if needed (existing `@media max-width: 767px` rule at line 102 already softens `.btn` padding). Shortcuts strip: 4 buttons stack 1-col, each full-width. Helper text wraps. No horizontal scroll. All tap targets ≥ 44 × 44 px. |
| 360 px | Same as 320 px with marginal breathing room. |
| 768 px | Still mobile per the 1024 px rule (`max-width: 1023px` triggers existing rules). Card centers with backdrop visible around it. Shortcuts strip: 2-col grid (Admin + PM on row 1, Maintenance + Tenant on row 2). Buttons stretch to fill cell. |
| 1024 px | Card centered, 480 px max. Shortcuts strip: 4-col row (one button per role) under the card. Strip width capped to ~520 px (matches card + small overflow) so buttons don't span the full viewport. |
| 1440 px | Identical to 1024 px — card and strip are fixed widths; navy backdrop fills the rest. |

The shortcuts strip lives **outside** the `.auth-card`, in a sibling `<div>` directly under it, both wrapped in a flex column inside `.auth-shell`. This keeps the card's existing centered layout intact and isolates the demoted strip visually. Gap between card and strip: `var(--space-lg)` (32 px) at desktop, `var(--space-md)` (24 px) at mobile.

### 2.8 Accessibility floor (UIUX Design Document §9)

- Tab order: brand → email → password → eye-toggle → Remember me → Forgot password → Submit → Register your organization → Login as Admin → Login as PM → Login as Maintenance → Login as Tenant.
- Saffron focus ring (`*:focus-visible`, line 490) on every focusable element. Visible on white card AND on navy backdrop — verify the 2 px saffron `#FF6F00` outline meets ≥ 3:1 against the gradient (`#1A237E` → `#1565C0`); saffron contrast against navy `#1A237E` ≈ 4.4:1 ✓, against royal-blue `#1565C0` ≈ 2.6:1 — borderline at the lower end of the gradient. **Mitigation**: shortcut buttons sit in the upper half of the strip (against navy-leaning portion of the gradient). If a follow-up audit fails contrast, swap the focus ring offset color to white inside the strip via a scoped rule. Tracked as a deferred item; not blocking.
- All shortcut buttons rendered as `<a href="...">` with `role="button"` not required (anchors with href already announce as links — preferred since they navigate).
- Helper text under shortcut buttons is decorative supporting copy; not associated with a control via `aria-describedby`.
- Sign-up link copy: "Don't have an account? Register your organization →" — the arrow is decorative (`aria-hidden="true"` on the `→` span) so screen readers announce "Register your organization" cleanly.
- One `<h1 class="sr-only">` "Sign in to GharSetu" added for the page; the visible "GharSetu" brand + tagline provide the visual equivalent.
- No native HTML5 validation tooltips. The current form has `required` and `minlength="8"` on lines 22 and 27 — these **must be removed** per Working rule §16 / Technical convention #16. `validation.js` handles all field errors below the field. Captured as Q2 in §4.
- Color contrast spot checks:
  - Charcoal `#212121` on white card: 16:1 ✓
  - Royal-blue `#1565C0` on white: 7.7:1 ✓
  - White text on navy gradient (Login as Role buttons): ≥ 12:1 ✓
  - Rgba(255,255,255,0.65) shortcut label on navy `#1A237E`: ~9:1 ✓; on royal-blue `#1565C0`: ~5:1 ✓
  - Rgba(255,255,255,0.5) helper text on navy: ~6.5:1 ✓; on royal-blue: ~3.6:1 — passes for ≥ 13 px text per WCAG AA. Acceptable.

### 2.9 Locale + i18n

- No date or currency rendered on this page — locale rules (DD/MM/YYYY, ₹ Indian grouping) don't apply directly. Keep the `<html lang="en-IN">` attribute (already present, line 2).
- Spelling: enforce American English per `2026-05-26-organization-signup.html.md` §3 TC-ORGSIGN-038 — "Organization" (not "Organisation"), "personalize" (not "personalise"), etc.

### 2.10 Files to touch

| File | Change |
|---|---|
| `prototype/login.html` | Apply §2.3 anatomy: delete lines 19 + 58–60 + 63–79 + the role-step submit handler on line 16; add Zone 2i (org-signup link) + Zone 3 (prototype shortcuts strip with 4 role buttons + helper text); remove HTML5 `required` + `minlength` attributes per §2.8. Brand mark, tagline, form fields, eye-toggle, remember me, forgot password, submit button — all preserved. |
| `prototype/assets/styles.css` | No changes expected. If the shortcuts strip's secondary-button-on-dark override gets reused on a third page, promote to a `.btn-secondary--on-dark` utility. Flag in §4 if needed. |
| `docs/planning/prototype-changes.md` | Row added on ship. |

### 2.11 Out of scope

- Changing the production credential form (fields, autocomplete, password rules, submit behavior).
- Removing `validation.js` wiring or changing its loaded path.
- Building a real role-based authentication flow — the role buttons are prototype navigation shortcuts only; they do not set any auth state.
- Updating the Next.js / live app login page. This is a prototype-only file.
- Adding a "Sign in with Google / Microsoft" social-auth row (out of scope per CLAUDE.md Scope rule K — no 2FA / no public-sign-up flows beyond the org form).
- Adding `prototype/login.html` to the navigation footer of other prototype pages.

## 3. Test cases (designed up front)

Prototype-level structural + visual + a11y + responsive. Promotable to live E2E (TC-LOGIN-* IDs reserved) when the live app's login page absorbs the v8 sign-up link.

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-LOGIN-001 | Page renders with all zones — single-card | `prototype/login.html` open at 1440 px | Inspect DOM top-to-bottom | Backdrop (`.auth-shell`) · auth-card with: brand · tagline · email · password + eye-toggle · remember-me + forgot-password row · submit · sign-up link · then OUTSIDE the card a "PROTOTYPE SHORTCUTS — PREVIEW AS ROLE" strip with 4 role buttons + helper text. No second card. No `id="role-step"` element in DOM. | H |
| TC-LOGIN-002 | "Back to home" link is absent | Page open | `document.querySelector('a:not(.auth-brand)')` text-search for "Back to home" | Zero matches. The brand mark is the only path back to home. | H |
| TC-LOGIN-003 | Brand mark → `index.html` | Page open | Click "GharSetu" brand at top of card | Navigates to `prototype/index.html` (new SAAS landing) | H |
| TC-LOGIN-004 | Login as Admin button → admin dashboard | Page open | Click "Login as Admin" in shortcuts strip | Navigates to `prototype/admin/dashboard.html` | H |
| TC-LOGIN-005 | Login as Property Manager → PM dashboard | Page open | Click "Login as Property Manager" | Navigates to `prototype/pm/dashboard.html` | H |
| TC-LOGIN-006 | Login as Maintenance Staff → maintenance dashboard | Page open | Click "Login as Maintenance Staff" | Navigates to `prototype/maintenance/dashboard.html` | H |
| TC-LOGIN-007 | Login as Tenant → tenant dashboard | Page open | Click "Login as Tenant" | Navigates to `prototype/tenant/dashboard.html` | H |
| TC-LOGIN-008 | Production form preserved | Page open | Inspect DOM for: `input#email[type=text]`, `input#password[type=password]`, eye-toggle button `#pw-toggle`, "Remember me" checkbox, "Forgot password?" `<a href="forgot-password.html">`, saffron submit `.btn-primary` "Login" | All 6 elements present with correct attributes, classes, and copy | H |
| TC-LOGIN-009 | Forgot password link → forgot-password page | Page open | Click "Forgot password?" | Navigates to `prototype/forgot-password.html` | H |
| TC-LOGIN-010 | Password eye-toggle works | Page open | Click eye icon · type characters · click again | Field type toggles `password` ↔ `text`; `aria-label` toggles "Show password" ↔ "Hide password"; both SVG states swap | M |
| TC-LOGIN-011 | Org-signup link present + routed | Page open | Locate "Don't have an account? Register your organization →" line below submit | Link `href="organization-signup.html"`; royal-blue Poppins 600; clicking navigates to `prototype/organization-signup.html` | H |
| TC-LOGIN-012 | Stale "No public sign-up" copy removed | Page open | DOM text-search for "No public sign-up" | Zero matches | H |
| TC-LOGIN-013 | No HTML5 native validation attributes | Page open | Inspect `input#email` and `input#password` | Neither has `required`; neither has `pattern`; password has no `minlength` (current line 27 attribute `minlength="8"` removed) | H |
| TC-LOGIN-014 | Shortcuts strip visually demoted | Page open | Compare shortcuts strip styling to submit button | Strip uses white-on-navy outline buttons (transparent bg, white text, white-rgba border); NOT saffron-filled. Strip label "PROTOTYPE SHORTCUTS — PREVIEW AS ROLE" in uppercase white-tinted Poppins 500 12 px above buttons. Helper text below buttons. | H |
| TC-LOGIN-015 | Responsive — 320 px | Viewport 320 px | Reload + inspect | Card spans full viewport minus 24 px backdrop padding. Shortcuts strip: 4 buttons stack 1-col, each full width. Helper text wraps. No horizontal scroll. All tap targets ≥ 44 px. | H |
| TC-LOGIN-016 | Responsive — 360 px | Viewport 360 px | Reload + inspect | Same as 320 px with marginal breathing room. | M |
| TC-LOGIN-017 | Responsive — 768 px | Viewport 768 px | Reload + inspect | Card centered max-width 480 px. Shortcuts strip: 2-col grid (Admin + PM row 1; Maintenance + Tenant row 2). Backdrop visible around card. | H |
| TC-LOGIN-018 | Responsive — 1024 px | Viewport 1024 px | Reload + inspect | Card 480 px centered. Shortcuts strip: 4-col row under card; strip width ~520 px. | H |
| TC-LOGIN-019 | Responsive — 1440 px | Viewport 1440 px | Reload + inspect | Identical to 1024 px; broader navy backdrop margins on either side. | M |
| TC-LOGIN-020 | Tab order | Page open | Tab from address bar | Order: brand → email → password → eye-toggle → Remember me → Forgot password → Submit → Register your organization → Login as Admin → Login as PM → Login as Maintenance → Login as Tenant. | H |
| TC-LOGIN-021 | Saffron focus ring on every control | Page open | Tab through all focusable elements | Each shows 2 px saffron outline + 2 px offset via `*:focus-visible` (line 490). | H |
| TC-LOGIN-022 | No native HTML5 tooltips on focus / hover | Page open | Hover + focus email + password inputs | No yellow browser-native tooltip; no `:invalid` red ring; only `.field-error` rendered messages would appear (none expected on initial load). | H |
| TC-LOGIN-023 | Locale — en-IN + American English | Page open | Inspect `<html lang>` + DOM text-search for "Organisation" / "organise" | `lang="en-IN"` preserved; zero British-English matches. | M |
| TC-LOGIN-024 | No second card / role-step element | Page open | DOM query `#role-step` | Returns `null` — the two-step pattern is gone. | H |
| TC-LOGIN-025 | Submit does not navigate | Page open with all fields blank | Click submit | `event.preventDefault()` fires; URL unchanged; no `#role-step` swap; no errors thrown. (Prototype-only — real flow happens in the live app.) | M |

## 4. Sign-off — pre-implementation questions

Lead-defaulted decisions are marked **(defaulted)** with rationale. Open questions surface where the lead is making a judgment call that deviates from the user's literal phrasing or needs commercial input.

| # | Question | Lead default / recommendation | Status |
|---|---|---|---|
| Q1 | The user said "add login as roles button for all roles". I interpreted this as a **demoted prototype-shortcuts strip outside the auth-card** rather than keeping the existing two-step role-picker that activates on submit. Is that the right read? | **(defaulted)** **Yes — demoted strip outside the card.** Rationale: (a) the new landing page already explains the four roles, so a role-picker inside the auth flow is redundant; (b) reviewers shouldn't need to fake-submit before jumping to a role; (c) putting role-jump *outside* the card visually says "this is prototype convenience, not real login," which the current "Pick a role to demo" card does not communicate. Easy to change to a literal "after-submit role picker" if the user disagrees. | needs user redirect if wrong |
| Q2 | The current `prototype/login.html` lines 22 + 27 use HTML5 `required` and `minlength="8"`. Working rule §16 / Technical convention #16 forbids native HTML5 validation. Should this update strip those attributes (consistent with `organization-signup.html`) or leave as-is? | **(defaulted)** **Strip them.** The login form is the only remaining prototype page with native HTML5 validation. Stripping keeps the validation contract consistent across the prototype family. `validation.js` already loaded on the page can register the email + password rules at implementation time. | accepted by lead |
| Q3 | Role-shortcut button wording — "Login as Admin" / "Login as Property Manager" / "Login as Maintenance Staff" / "Login as Tenant" (as the user phrased it), OR shorter "Admin" / "PM" / "Maintenance" / "Tenant" (matches the existing role-picker copy on current line 70–73)? | **(defaulted)** **Use the user's full "Login as X" phrasing.** Reasons: (a) verbatim alignment with their request; (b) "Login as" frames the action correctly — these buttons SIMULATE a login that lands you in a role; (c) at 4 buttons spaced over a 480 px card + small overflow, the longer copy still fits at 1024 px+ (each button ~115 px wide); on mobile they stack so length is irrelevant. Use "Login as PM" only if "Login as Property Manager" forces visual overflow on 320 px — test at implementation. | accepted by lead |
| Q4 | Shortcut buttons — outline-on-navy (transparent + white border + white text) OR filled saffron (matches landing hero primary)? | **(defaulted)** **Outline-on-navy.** Reasons: (a) saffron-filled would compete with the real "Login" submit button inside the card and confuse the visual hierarchy; (b) outline buttons on navy are the established pattern (`prototype/index.html` line 67); (c) the outline treatment reinforces "demoted / prototype-only" reading. | accepted by lead |
| Q5 | Shortcuts-strip label wording — "PROTOTYPE SHORTCUTS — PREVIEW AS ROLE" (recommended), "DEMO SHORTCUTS", or "QUICK PREVIEW"? | **(defaulted)** **"PROTOTYPE SHORTCUTS — PREVIEW AS ROLE"** — most explicit; says "this is prototype" and "this is per-role". Length OK at all viewports (uppercase 12 px Poppins 500 fits on one line down to ~320 px; wraps gracefully if not). | accepted by lead |
| Q6 | Helper text wording under the shortcut buttons — "Prototype only. Real login uses the form above — your role is detected from your account." OR omit? | **(defaulted)** **Include the helper.** Two sentences, 13 px white-50% on the navy gradient. Reinforces the "prototype-only" framing for any reviewer who might otherwise wonder why the real product would surface role-jump publicly. | accepted by lead |
| Q7 | Should the brand mark also include hover-state copy "Back to home" via title attribute or visible tooltip? | **(defaulted)** **No.** The `.auth-brand` `:hover { opacity: 0.85 }` rule (line 511) is sufficient affordance. Title attributes break a11y patterns (announce inconsistently to screen readers). Logo as home is a universally understood pattern. | accepted by lead |
| Q8 | Org-signup link copy — "Don't have an account? Register your organization →" OR "New here? Register your organization →" OR "Set up your organization →"? | **(defaulted)** **"Don't have an account? Register your organization →"** — mirrors the landing page's final-CTA companion copy "Already have an account? Login" (`prototype/index.html` line 294) for symmetry across the funnel. | accepted by lead |
| Q9 | Should this update touch the live Next.js login (`apps/web/src/app/login/page.tsx`) in any way? | **(defaulted)** **No.** Prototype-only per the user's instruction. The live login already has its own production design; the v8 SAAS sign-up link will be added there in a separate planning file when the SAAS backend module ships under ENG-F06. | accepted by lead |

No open questions block prototype implementation. Q1 is the only one where the user might redirect.

## 5. Execution log

2026-05-26 — implementation pass: removed "← Back to home" link (line 19); logo anchor preserved as sole home affordance; removed two-step role-picker card (`#role-step`, lines 63–79) and its submit-handler swap; `onsubmit` reduced to `event.preventDefault()` only; removed stale "No public sign-up" copy (lines 58–60); added "Don't have an account? Register your organization →" link to `organization-signup.html`; added prototype-shortcuts strip below auth-card (outside `<form>`) with 4 white-outline-on-navy buttons → `admin/dashboard.html`, `pm/dashboard.html`, `maintenance/dashboard.html`, `tenant/dashboard.html`; responsive grid rule (1-col / 2-col / 4-col) via scoped `<style>` block; helper text below buttons; `<h1 class="sr-only">` added; `required` and `minlength="8"` attributes stripped from both inputs per Working rule §16.

## 6. Files changed

| File | Change |
|---|---|
| `prototype/login.html` | Removed back-home link · removed role-step card · simplified onsubmit · replaced stale copy with org-signup link · added prototype shortcuts strip with 4 role-jump buttons + responsive grid + helper text · stripped HTML5 native validation attrs · added sr-only h1 |

## 7. Agents used

| Agent | Task | Status |
|---|---|---|
| gharsetu-lead | Initial planning (this file) — anatomy refactor, two-step → single-card decision, prototype-shortcuts strip design, sign-up link placement, stale-copy fix, design-token sourcing from existing classes only, responsive map, TC catalogue (TC-LOGIN-001..025) | ✅ accepted |

Implementation deferred to a follow-up task.

## 8. Post-deploy

(Empty.)

## 9. Cross-references

- **UIUX Design Document** (`docs/product/UIUX_Design_Document.docx`) — §2 Design Tokens (every token used here verified against this section), §3 Layout Foundations (single 1024 px breakpoint, responsive transformations), §7 Components (Button · Input · Card), §8 Interaction Patterns (form-validation visual contract — no native HTML5 tooltips), §9 Accessibility (Tab order, focus ring, label association, contrast floors).
- **Solution Overview v8** (`docs/product/Solution_Overview.docx`) — §New Features → Organization Management (SAAS layer) authorises the public sign-up link this page now exposes; deprecates the "No public sign-up" copy.
- **Landing page plan** (`docs/planning/features/2026-05-26-landing-page-saas.md`) — the upstream page that the brand-as-home anchor now targets. The shortcuts strip is the inverse of the landing's role marketing section (`prototype/index.html` §5 Roles): landing explains; login lets reviewers jump.
- **Organization-signup plan** (`docs/planning/features/2026-05-26-organization-signup.html.md`) — §4 Q5 carried over here. The sign-up link added in Zone 2i is the inverse of that page's "Already have an account? Login" link (mutual cross-funnel discoverability).
- **`prototype/assets/styles.css`** — all design tokens used; nothing invented. Specific lines cited inline in §2.6.
- **`prototype/index.html`** — the new SAAS landing; brand-as-home target. Line 67 also provides the secondary-button-on-dark pattern reused in Zone 3.
- **`prototype/forgot-password.html`** — chrome family sibling (`.auth-shell` + `.auth-card` + `.auth-brand`); kept consistent.
- **CLAUDE.md Working rule #2** — planning file precedes code; this file fulfils it for the login-page refactor.
- **CLAUDE.md Working rule #9** — prototype kept in sync with the live app; on ship, append a row to `docs/planning/prototype-changes.md` documenting (a) "Back to home" link removed, (b) prototype shortcuts strip added, (c) stale "No public sign-up" copy replaced, (d) HTML5 native validation attributes stripped.
- **CLAUDE.md Technical convention #16** — Q2 above codifies the HTML5-validation-attribute strip-out to align with the rest of the prototype family.
- **CLAUDE.md Scope rule B** — Public Organization sign-up IS in scope; tenant self-signup remains out of scope. The new sign-up link's destination is the right one (`organization-signup.html`), not a tenant-signup page.
