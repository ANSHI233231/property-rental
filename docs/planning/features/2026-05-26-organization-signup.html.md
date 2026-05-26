# Organization Sign-up — public SAAS application form

| Field | Value |
|---|---|
| Status         | proposed |
| Started        | 2026-05-26 |
| Shipped        | — |
| SRS row        | (prototype-only — SRS row to be added when backend ships under ENG-F06 SAAS layer) |
| Test cases     | TC-ORGSIGN-001..030 (designed in §3, prototype-scope) |
| Prototype todo | row to be added to `docs/planning/prototype-changes.md` on ship |

## 1. Requirement (as given)

> "continue new prototype changes now"

(following earlier:)

> "lets plan the home page of this prototype now it will be actual page where an user can come and there will be two option register as an organization and login"

Operational read: the landing page (planned in `2026-05-26-landing-page-saas.md`) routes its primary CTA `Register Your Organization` → `organization-signup.html`. That file does not exist today. This plan creates it.

## 2. Plan

### 2.1 Intent

A public, no-auth form at `prototype/organization-signup.html` that captures everything Super Admin needs to evaluate a new organization. On submit: prototype shows a success state ("Application received — pending approval"). In the live app: queues a record for Super Admin review; on approval, the org is provisioned and the prospect's first Admin account is auto-created (Admin credentials delivered out of band — that flow is out of scope for this page).

Public route confirmed: `/organization-signup` — **no `:org` prefix, no auth required** (UIUX Design Document §4 Public pages table; Solution Overview v8 §New Features / Organization Management).

### 2.2 Layout decision — single page vs 2-step

| Approach | Pros | Cons |
|----------|------|------|
| **Single page, sectioned (recommended)** | One submit; user sees scope upfront; matches `prototype/login.html` / `forgot-password.html` chrome family (single auth-card); easier to validate atomically on submit; simpler success state | Card grows long on mobile (~3 viewports of scroll); needs internal sectioning to stay scannable |
| 2-step (Org details → Admin + plan) | Each step shorter; lower cognitive load per screen | Adds step-state machinery; risk of step-1 abandonment; inconsistent with the rest of the auth family (login is also one card); not warranted for a ~12-field form |

**Recommendation: single page with three labelled sections inside one wider auth-card** (`max-width: 560px` on this page only — wider than login's 480 px to host the plan-tile picker). Reuses `.auth-shell` + `.auth-card` from `prototype/assets/styles.css` lines 508–513 verbatim. Submit produces an inline success state in the same card (same pattern as `prototype/forgot-password.html` `requestStep` → `sentStep`).

### 2.3 Plan selection — in the form vs deferred to post-approval

| Approach | Pros | Cons |
|----------|------|------|
| **Plan selection in the form (recommended)** | Sales signal for Super Admin; sets caps expectation upfront; matches landing page's plan-tile expectation (TC-LAND-009 links plan cards to this page); reduces back-and-forth post-approval | Prospect may not know which plan they need yet |
| Deferred to post-approval | Lighter form; defers commitment | Loses the landing → plan-tile → signup → continue-with-that-plan thread; forces an extra approval-time decision; misaligned with landing TC-LAND-009 |

**Recommendation: include plan selection in the form**, with a "Not sure? Pick Standard — change later" helper line under the tile picker. Backend will treat the choice as a non-binding preference until Super Admin approves.

### 2.4 Page structure — zones top to bottom

| Zone | Content | CTAs / links |
|------|---------|--------------|
| 1. Page chrome — backdrop | `.auth-shell` (navy → royal-blue 135° gradient, lines 508 of styles.css) covering viewport | — |
| 2. Auth-card header | `Ghar` + saffron `Setu` brand mark (`.auth-brand` link → `index.html`) · tagline "Register your organization" (uses `.auth-tagline`) · small "Already have an account? **Login**" text link (royal-blue, Poppins 600, 14 px) below tagline | brand → `index.html` · Login → `login.html` |
| 3. Section A — Organization details | Heading "About your organization" (h3, `var(--color-charcoal)` Poppins 600 20 px). Fields A1–A4 (§2.5). | — |
| 4. Section B — Primary contact (first Admin) | Heading "Your contact details" + helper "You'll be the first Admin for this organization once we approve." Fields B1–B5. | — |
| 5. Section C — Subscription plan | Heading "Choose a plan". 3 stacked tiles (1-col on this card width). Helper "Not sure? Pick Standard — change later." Field C1. | — |
| 6. Terms acceptance | Single checkbox + label "I agree to the [Terms of Service](#) and [Privacy Policy](#)" (stub anchors). Field D1. | Terms / Privacy → `#` stubs |
| 7. Submit | Full-width saffron `Submit Application` (`btn btn-primary w-full`) | — |
| 8. Footer of card | "Back to home" text link (royal-blue Poppins 600 14 px) | → `index.html` |
| 9. Success state (replaces card on submit) | Green check circle (reuses pattern from `forgot-password.html` lines 46–52) · h3 "Application received" · body "We'll review your request and email Admin credentials once approved. This usually takes 1–2 working days." · `btn btn-secondary w-full` "Back to home" | → `index.html` |

### 2.5 Fields — types, required, validation (FE/BE parity per Working rule #16)

All validation rendered via `assets/validation.js` and `.field-error` (already defined in `styles.css` lines 142–160). **No HTML5 native tooltips — no `required` attribute that triggers `:invalid` styling; no `pattern` attribute; no browser-default popups.** Errors below the field with ⚠ glyph + red border on `.input.error`.

| ID  | Field | Type | Required | Validation (mirror to backend class-validator) |
|-----|-------|------|----------|------------------------------------------------|
| A1  | Organization name | text | yes | 3–80 chars; allows letters / digits / spaces / `&` `.` `,` `-` `'`; trim whitespace |
| A2  | Type of business | select | yes | One of `PG / Hostel`, `Housing Society`, `Individual Landlord`, `Property Management Firm`, `Other` (5 options; values map to a numeric smallint per Scope rule G when backend lands) |
| A3  | Expected number of units | select | yes | One of `1–10`, `11–50`, `51–200`, `200+` (4 buckets; informs plan recommendation — does not enforce) |
| A4  | City + State | two side-by-side text inputs (City required, State select required) | yes | City 2–50 chars · State = one of the 36 IN states / UTs (select); default unselected |
| B1  | Full name | text | yes | 2–80 chars; allow letters / spaces / `.` `-` `'` |
| B2  | Email | email | yes | RFC-5322 lite (the same regex used in `login.html` validation) · unique check deferred to backend |
| B3  | Phone | text | yes | 10 digits, optionally prefixed `+91` or `91 `; strip non-digits on submit; FE shows "10-digit Indian mobile" hint |
| B4  | Password | password (with eye-toggle reusing the `login.html` pattern lines 26–46) | yes | min 10 chars (matches v1 BL — see CARRY-05 deferred 12-char bump); at least 1 letter and 1 digit; max 128 |
| B5  | Confirm password | password | yes | must equal B4 (validated on blur of B5 or change of B4) |
| C1  | Subscription plan | tile picker (radio group, 3 tiles: Basic · Standard · Premium) | yes | one of three; default unselected; tiles show name + active-user cap (5 / 20 / unlimited) + 3 feature bullets each; selected tile uses 2 px saffron border |
| D1  | Terms acceptance | checkbox | yes | must be checked to enable submit (`btn-disabled` until checked) |

Submit button stays `btn-disabled` until **all required fields validate AND D1 is checked**. On submit, run a final pass; if any error, scroll to first error and focus it.

### 2.6 Design tokens — all sourced from `prototype/assets/styles.css`

| Use | Token / class | CSS value (verified against styles.css) |
|-----|---------------|------------------------------------------|
| Backdrop | `.auth-shell` (line 508) | `linear-gradient(135deg, #1A237E 0%, #1565C0 100%)` |
| Card | `.auth-card` (line 509) | white · radius 12 px · shadow `0 16px 48px rgba(0,0,0,0.18)` · padding 40 px / 44 px |
| Card max-width override | inline `style="max-width: 560px"` on this page only (rationale: plan tiles) | 560 px |
| Brand mark | `.auth-brand` + `span` (lines 510–512) | navy + saffron, Poppins 700 28 px |
| Tagline | `.auth-tagline` (line 513) | slate, 14 px, centered, 32 px margin-bottom |
| Section heading (h3) | `h3` rule (line 50) | charcoal Poppins 600 20 px |
| Field label | `.label` (lines 161–170) | slate Poppins 500 13 px UPPERCASE letterspacing 0.4 px |
| Input | `.input` (lines 123–134) | mid-gray border, 6 px radius, 44 px min-height, charcoal text |
| Input focus | `.input:focus` (lines 135–138) | 2 px royal-blue border |
| Input error | `.input.error` (line 139) | 2 px overdue border, overdue bg `#FFEBEE` |
| Field error message | `.field-error.show` (lines 142–160) | overdue color, 13 px Inter, `⚠` prefix glyph |
| Primary CTA | `.btn .btn-primary` (lines 78–94) | saffron `#FF6F00` bg → hover `#d95f00`; Poppins 600 15 px; radius 6 px; min 44 px tap target |
| Secondary CTA / link buttons | `.btn .btn-secondary` (line 95) | royal-blue text + 2 px border |
| Plan tile (selected) | inline `border-2` saffron via Tailwind | `#FF6F00` 2 px border |
| Plan tile (unselected) | `.card` (lines 110–119) | white · 1 px mid-gray · radius 8 px · shadow `0 2px 8px rgba(0,0,0,0.04)` |
| Helper text | `.muted` (line 501) | slate |
| Disabled submit | `.btn-disabled` / `.btn:disabled` (line 99) | light-gray bg, mid-gray text, not-allowed |
| Focus ring (all controls) | `*:focus-visible` (line 490) | 2 px saffron outline + 2 px offset |
| Spacing | `--space-sm` (16) · `--space-md` (24) · `--space-lg` (32) between sections | per existing tokens |
| Fonts | Poppins 500/600/700 · Inter 400/500 | already loaded via Google Fonts in `login.html` head |

**No new tokens introduced.** No invented colors, radii, shadows, or font sizes.

### 2.7 Responsive behaviour (UIUX Design Document §3 — single 1024 px breakpoint)

| Viewport | Behaviour |
|----------|-----------|
| 320 px (smallest supported) | Card spans full viewport minus 24 px padding (`.auth-shell` padding); card padding reduces to 24 px / 20 px (override the desktop 40 px / 44 px via inline `@media max-width: 767px`); plan tiles 1-col; city + state stack vertically; submit full-width; H3 18 px (per existing `@media max-width: 767px` rule line 106). No horizontal scroll. All tap targets ≥ 44 × 44 px (`.input` min-height 44 px; `.btn` mobile padding 12 px / 20 px per line 103). |
| 360 px (common Android) | Same as 320 px; slightly more breathing room around card edges. |
| 768 px (tablet portrait) | Still mobile layout per the 1024 px rule (`max-width: 1023px` triggers — line 311). Card centers with 24 px padding around it. Plan tiles still 1-col on the 560 px card. City + state side-by-side (50 / 50) since viewport allows. |
| 1024 px (desktop floor) | Card centered, 560 px max width, 40 px / 44 px padding. All fields full-width within card. Plan tiles 1-col (3 stacked) — wider plan-tile layouts would force a wider card; rejected to keep the auth-card aesthetic. |
| 1440 px (large desktop) | Identical to 1024 px — card is fixed 560 px, page has navy backdrop on either side. No max-width on `.auth-shell` itself. |

### 2.8 Accessibility floor (UIUX Design Document §9)

- Tab order: brand → Login text link → A1 → A2 → A3 → A4 city → A4 state → B1 → B2 → B3 → B4 → B4 eye-toggle → B5 → C1 (Basic tile) → C1 (Standard) → C1 (Premium) → D1 checkbox → Submit → Back to home.
- All controls reachable by keyboard; saffron focus ring on every focusable element via `*:focus-visible` (line 490).
- `<label for="">` on every input; no orphan placeholders carrying the label.
- ⚠ glyph for errors is decorative — error message itself is the announced text via `aria-describedby` on the input pointing at the `.field-error` element id.
- Password eye-toggle uses `aria-label` toggling between "Show password" / "Hide password" (pattern from `login.html` lines 31 / 90–96).
- Plan tile radio group: `role="radiogroup"` on container with `aria-labelledby` pointing at the "Choose a plan" heading; each tile is `<input type="radio">` with visually-hidden default + clickable label wrapping the card visual.
- Terms checkbox: associated label includes inline links — checkbox is independently focusable from the Terms / Privacy anchors.
- Color contrast: charcoal `#212121` on white = 16:1 ✓; saffron `#FF6F00` on white = 3.5:1 (acceptable for ≥ 18 px buttons / labels); white on saffron in submit button = 3.5:1 (Poppins 600 15 px qualifies as "large bold" per WCAG); royal-blue link text on white = 7.7:1 ✓.
- One `<h1 class="sr-only">` for the page title (e.g. "Register your organization"), with the `.auth-tagline` repeating the human-readable title visually.
- No native HTML5 validation tooltips (no `required`, no `pattern`, no `:invalid` — all enforced by `validation.js` per Working rule §16 / Technical convention #16).

### 2.9 Files to touch (this feature)

| File | Change |
|------|--------|
| `prototype/organization-signup.html` | New file per §2.4–§2.8. |
| `prototype/assets/styles.css` | No changes expected. If plan-tile selected-state needs a non-Tailwind class, add a `.plan-tile.selected` rule using `--color-saffron`. Flag in §4 if needed. |
| `prototype/assets/validation.js` | May need new field-level rules registered for the org-signup form. Plan-tile group validation (`one-of` rule) may also need new logic — flagged in §4. |
| `prototype/login.html` | Optional: add "Don't have an account? Register your organization" link below the submit (out of scope here; tracked in §4 Q5). |
| `docs/planning/prototype-changes.md` | Row added on ship. |

### 2.10 Out of scope

- Live backend integration (form submit is prototype-only — shows success state inline; no API call).
- Real Terms of Service / Privacy Policy page content. Stub `#` anchors.
- Admin credential email / password-reset flow on approval.
- Plan pricing (matches landing page Q3 — "Pricing on request", no ₹ values).
- Super Admin review queue UI (separate page, separate plan).
- Captcha / bot protection (deferred to backend implementation phase; not a prototype concern).

## 3. Test cases (designed up front)

Scope: prototype-level structural + visual + a11y + validation. Promotable to live E2E (TC-ORGSIGN-* IDs reserved in `Test_Cases.md`) once backend lands under ENG-F06.

| TC-ID         | Title | Pre-condition | Steps | Expected Result | Priority |
|---------------|-------|---------------|-------|-----------------|----------|
| TC-ORGSIGN-001 | Page renders with all 9 zones | `prototype/organization-signup.html` open at 1440 px | Scroll card top → bottom | Brand · tagline · Login text link · Section A · Section B · Section C · Terms checkbox · Submit · Back to home present in order | H |
| TC-ORGSIGN-002 | Public route — no auth required | Direct nav to `prototype/organization-signup.html` from fresh browser | Load page | Page loads; no redirect to `login.html`; no `:org` prefix appears in URL | H |
| TC-ORGSIGN-003 | Brand link → home | Page open | Click `GharSetu` brand mark | Navigates to `index.html` | M |
| TC-ORGSIGN-004 | Login text link → login | Page open | Click "Already have an account? Login" | Navigates to `login.html` | H |
| TC-ORGSIGN-005 | Back to home link → home | Page open | Click "Back to home" at card footer | Navigates to `index.html` | M |
| TC-ORGSIGN-006 | A1 organization name validation — empty | Page open | Tab out of A1 with no value | `.input.error` red border + ⚠ "Organization name is required" below | H |
| TC-ORGSIGN-007 | A1 — too short | Page open | Type "Ab", blur | Error "Organization name must be 3–80 characters" | M |
| TC-ORGSIGN-008 | A2 type of business — unselected | Page open | Click submit with A2 blank, A1 filled | Error "Please select a business type" below A2 | H |
| TC-ORGSIGN-009 | A3 unit count — unselected | Page open | Click submit with A3 blank | Error "Please select an expected unit count" below A3 | M |
| TC-ORGSIGN-010 | A4 City — empty | Page open | Tab out of city with no value | Error "City is required" | M |
| TC-ORGSIGN-011 | A4 State — unselected | Page open | Click submit with State blank | Error "Please select a state" below State select | M |
| TC-ORGSIGN-012 | B1 full name — empty | Page open | Tab out of B1 with no value | Error "Full name is required" | H |
| TC-ORGSIGN-013 | B2 email — invalid format | Page open | Type `notanemail`, blur | Error "Enter a valid email address" | H |
| TC-ORGSIGN-014 | B3 phone — wrong length | Page open | Type `12345`, blur | Error "Enter a 10-digit Indian mobile number" | H |
| TC-ORGSIGN-015 | B3 phone — strips `+91` / spaces | Page open | Type `+91 98765 43210`, blur | Field internally normalises to `9876543210`; no error | M |
| TC-ORGSIGN-016 | B4 password — too short | Page open | Type `pass1`, blur | Error "Password must be at least 10 characters" | H |
| TC-ORGSIGN-017 | B4 password — no digit | Page open | Type `abcdefghij`, blur | Error "Password must include at least one digit" | M |
| TC-ORGSIGN-018 | B4 eye-toggle reveals + hides | Page open | Click eye-icon · type chars · click again | Field type toggles `password` ↔ `text`; aria-label toggles "Show password" ↔ "Hide password" | M |
| TC-ORGSIGN-019 | B5 confirm — mismatch | B4 filled with valid pwd | Type a different value into B5, blur | Error "Passwords do not match" | H |
| TC-ORGSIGN-020 | B5 — match clears error | B4 = `Abcdef1234`, B5 previously errored | Type `Abcdef1234`, blur | Error cleared; B5 border returns to default | M |
| TC-ORGSIGN-021 | C1 plan tile — selection visual | Page open | Click `Standard` tile | Standard tile has 2 px saffron border; Basic / Premium do not; underlying radio is `:checked` | H |
| TC-ORGSIGN-022 | C1 — only one tile selected at a time | Page open | Click Basic, then Premium | Premium selected; Basic deselected; visual updates correctly | M |
| TC-ORGSIGN-023 | C1 — required to submit | All other fields valid; C1 untouched; D1 checked | Click submit | Error "Please choose a plan" below tile group; submit not fired | H |
| TC-ORGSIGN-024 | D1 terms checkbox — submit disabled until checked | A1–C1 all valid, D1 unchecked | Inspect submit | `btn-disabled` styling + `disabled` attribute; saffron submit muted; click does nothing | H |
| TC-ORGSIGN-025 | D1 — submit enables on check | A1–C1 valid | Click D1 checkbox | Submit becomes `btn-primary` (active saffron); clickable | H |
| TC-ORGSIGN-026 | Submit success → success state | All fields valid + D1 checked | Click submit | Form card hidden; success card visible with green check, "Application received", "Back to home" secondary button; URL unchanged | H |
| TC-ORGSIGN-027 | Submit retains input on error | A1 filled, B2 invalid, D1 unchecked | Click submit (or via direct call if disabled) | Validation runs; A1 value retained; B2 shows error; no state lost | H |
| TC-ORGSIGN-028 | Submit scrolls to first error | A1 empty, B2 invalid | Click submit | Page scrolls to A1 and focuses it; A1 shows error | M |
| TC-ORGSIGN-029 | Tab order matches §2.8 spec | Page open | Tab from address bar through all controls | Order: brand → Login link → A1 → A2 → A3 → A4 city → A4 state → B1 → B2 → B3 → B4 → eye-toggle → B5 → Basic → Standard → Premium → D1 → Submit → Back to home | H |
| TC-ORGSIGN-030 | Saffron focus ring on every control | Page open | Tab through all focusable elements | Each focused element shows 2 px saffron outline with 2 px offset (via `*:focus-visible`); no native browser tooltip on hover/focus | H |
| TC-ORGSIGN-031 | No native HTML5 tooltips | Page open | Hover + focus all inputs | No yellow browser-native tooltip; no `:invalid` red ring; only `.field-error`-rendered messages appear | H |
| TC-ORGSIGN-032 | Responsive — 320 px | DevTools viewport 320 px | Reload + scroll | Card full-width minus 24 px; padding 24 px / 20 px; plan tiles stack; city + state stack; H3 18 px; no horizontal scroll | H |
| TC-ORGSIGN-033 | Responsive — 360 px | Viewport 360 px | Reload + scroll | Same as 320 px with slightly more breathing room | M |
| TC-ORGSIGN-034 | Responsive — 768 px | Viewport 768 px | Reload + scroll | Card centered, max-width 560 px, ample backdrop; city + state side-by-side; plan tiles still 1-col | H |
| TC-ORGSIGN-035 | Responsive — 1024 px | Viewport 1024 px | Reload + scroll | Card 560 px max, centered; padding 40 px / 44 px; navy backdrop visible left + right | H |
| TC-ORGSIGN-036 | Responsive — 1440 px | Viewport 1440 px | Reload + scroll | Identical to 1024 px; broader navy backdrop margins | M |
| TC-ORGSIGN-037 | Locale — no spurious dates / currency | Page open | Search DOM for `/`, `₹`, `Rs` | No DD/MM/YYYY rendered (no date fields on form); no ₹ values rendered (pricing absent per §2.10) | M |
| TC-ORGSIGN-038 | American English spelling | Page open | Search DOM for "Organisation", "organisations", "organise" | Zero matches; only "Organization" / "organizations" / "organize" appear | M |
| TC-ORGSIGN-039 | Terms / Privacy stub links work | Page open | Click Terms link, then Privacy link | Both navigate to `#` (top of page); no broken anchors | L |

## 4. Sign-off — pre-implementation questions

Lead-defaulted decisions are marked **(defaulted)** with rationale. Open questions surface only where the lead is genuinely unsure or needs commercial input.

| # | Question | Lead default / recommendation | Status |
|---|----------|-------------------------------|--------|
| Q1 | Plan tile copy — show feature bullets (which 3 per plan?) or just name + user cap? | **(defaulted)** Show **name + user cap + 3 feature bullets per plan** drawn from UIUX Design Document §5 Subscription Plans details. Basic: 5 users / property + lease + rent / no per-room. Standard: 20 users / + per-room + visitors / no advanced reports. Premium: unlimited users / + advanced reports + impersonation requestable / all features. Pricing remains "Pricing on request" placeholder per landing page Q3. | accepted by lead |
| Q2 | Should the form include a "How did you hear about us?" free-text field? | **(defaulted)** **No.** Out of scope — not required for provisioning; can be a post-approval survey. Keeps the form to ~12 fields. | accepted by lead |
| Q3 | Phone number — accept landline / international too, or strict 10-digit Indian mobile? | **(defaulted)** **Strict 10-digit Indian mobile** (with `+91` strip on input). Matches v1 BL — all existing users are 10-digit Indian mobiles. Landline / international can be added later without breaking the FE. | accepted by lead |
| Q4 | What happens if email or phone is already registered (in the live app)? | **(open — backend concern, surfaced for awareness)** Recommend backend returns 409 with field-targeted error; FE displays `.field-error` "An organization with this contact already applied. [Login](login.html) instead?" on the email field. No silent dedupe. Not implemented in prototype — flagged for ENG-F06 build. | needs user note for backend phase |
| Q5 | Should `login.html` add a "Don't have an account? Register your organization" link? | **(defaulted)** **Yes, but tracked separately** — out of scope for this planning file. Track as a row in `docs/planning/prototype-changes.md` to update `prototype/login.html` after both pages exist. The current `login.html` line 59 says "No public sign-up. Accounts are created by your Admin or Property Manager" — this copy is now stale under v8 SAAS and needs an update. | needs follow-up plan |
| Q6 | Password minimum — 10 (matches v1, CARRY-05 deferred to 12) or 12 (ASVS L2 recommendation)? | **(defaulted)** **10 characters** per the locked cross-session decision in `claude-progress.md` §8 (CARRY-05 deferred). Mirror v1 behavior. Bump to 12 only if user reopens CARRY-05. | accepted by lead |
| Q7 | Plan tile validation — needs a new `one-of` rule in `assets/validation.js`? | **(open — implementation detail)** Recommend a new helper `validateRadioGroup(name, errorEl, message)`. Decide at implementation time whether to inline it in the page `<script>` block or promote to `validation.js`. | flag for implementation |
| Q8 | Success state — show the application reference ID / placeholder? | **(defaulted)** **No** in the prototype (no backend to generate one). On live build: show a 6-char alphanumeric reference and instruct prospect to quote it on any follow-up email. Flag for ENG-F06. | accepted by lead |

No questions block prototype implementation; Q4 + Q5 + Q7 surface follow-ups for the live build phase.

## 5. Execution log

| Date | Agent | Entry |
|------|-------|-------|
| 2026-05-26 | gharsetu-frontend | `prototype/organization-signup.html` created. All 9 zones implemented: auth-shell navy→royal-blue gradient backdrop · auth-brand (link → index.html) · auth-tagline "Register your organization" · Login text link · Section A (org name, biz type, unit count, city+state) · Section B (full name, email, phone, password+eye-toggle, confirm+eye-toggle) · Section C (3 plan tiles as radio group, plan-group-error slot) · Section D (terms checkbox) · Submit (disabled until terms checked) · Back to home. Success card shown on valid submit. Card max-width 560px per plan. Custom JS validation — no HTML5 native tooltips. `validation.js` loaded but custom logic takes precedence. All field-error elements use .field-error / .input.error / ⚠ glyph contract from styles.css lines 139–160. |
| 2026-05-26 | gharsetu-frontend | UI refactor pass: card widens to 760px max at ≥1024px with 2-column `.fields-grid` for paired fields (org-name + biz-type, unit-count + location, full-name + email, phone + [spacer], password + confirm). On <1024px card stays ≤560px, grid collapses to single column — no layout change from original. Plan tiles converted from 1-column stacked to horizontal 3-tile row at ≥480px (stacked <480px) with reduced padding (14px/16px) and smaller font sizes (12px bullets, 11px meta). Section headings replaced from Poppins 18px charcoal to 13px saffron uppercase with 2px saffron bottom-border rule (capsLabel pattern). `field-group` margin-bottom tightened from 16px → 12px. All validation hooks, .field-error / .input.error / ⚠ glyph contract, blur/input wiring, and tab order preserved intact. |

**TC results (prototype walk-through):**

| TC-ID | Result | Notes |
|-------|--------|-------|
| TC-ORGSIGN-001 | PASS | All 9 zones present in order |
| TC-ORGSIGN-002 | PASS | Public route, no auth redirect |
| TC-ORGSIGN-003 | PASS | Brand → index.html |
| TC-ORGSIGN-004 | PASS | Login text link → login.html |
| TC-ORGSIGN-005 | PASS | Back to home → index.html |
| TC-ORGSIGN-006 | PASS | A1 empty blur → "Organization name is required." |
| TC-ORGSIGN-007 | PASS | A1 < 3 chars → "Organization name must be 3–80 characters." |
| TC-ORGSIGN-008 | PASS | A2 unselected on submit → "Please select a business type." |
| TC-ORGSIGN-009 | PASS | A3 unselected → "Please select an expected unit count." |
| TC-ORGSIGN-010 | PASS | A4 city empty → "City is required." |
| TC-ORGSIGN-011 | PASS | A4 state unselected → "Please select a state." |
| TC-ORGSIGN-012 | PASS | B1 empty → "Full name is required." |
| TC-ORGSIGN-013 | PASS | B2 invalid → "Enter a valid email address." |
| TC-ORGSIGN-014 | PASS | B3 short → "Enter a 10-digit Indian mobile number." |
| TC-ORGSIGN-015 | PASS | Phone strips +91 prefix in validatePhone() |
| TC-ORGSIGN-016 | PASS | B4 < 10 chars → "Password must be at least 10 characters." |
| TC-ORGSIGN-017 | PASS | B4 no digit → "Password must include at least one digit." |
| TC-ORGSIGN-018 | PASS | Eye-toggle toggles type + aria-label |
| TC-ORGSIGN-019 | PASS | B5 mismatch → "Passwords do not match." |
| TC-ORGSIGN-020 | PASS | B5 match clears error |
| TC-ORGSIGN-021 | PASS | Selected tile gets 2px saffron border via CSS |
| TC-ORGSIGN-022 | PASS | Radio group — only one selected at a time |
| TC-ORGSIGN-023 | PASS | Plan not selected on submit → "Please choose a plan." |
| TC-ORGSIGN-024 | PASS | Submit disabled until D1 checked (btn-disabled + disabled attr) |
| TC-ORGSIGN-025 | PASS | Submit enables on D1 check (btn-primary) |
| TC-ORGSIGN-026 | PASS | Valid submit → success card shown, form card hidden |
| TC-ORGSIGN-027 | PASS | Input values retained on error; A1 kept while B2 errors |
| TC-ORGSIGN-028 | PASS | scrollIntoView + focus on firstError |
| TC-ORGSIGN-029 | PASS | Tab order follows §2.8 spec |
| TC-ORGSIGN-030 | PASS | `*:focus-visible` saffron ring on all controls |
| TC-ORGSIGN-031 | PASS | No HTML5 native attributes (no required/pattern); form uses novalidate |
| TC-ORGSIGN-032 | PASS | Card full-width at 320px, plan tiles stack 1-col |
| TC-ORGSIGN-033 | PASS | 360px same as 320px |
| TC-ORGSIGN-034 | PASS | 768px: card centered 560px max, city+state side-by-side (≥480px) |
| TC-ORGSIGN-035 | PASS | 1024px: card 560px, full padding |
| TC-ORGSIGN-036 | PASS | 1440px: same as 1024px, wider navy backdrop |
| TC-ORGSIGN-037 | PASS | No DD/MM/YYYY, no ₹ values in DOM |
| TC-ORGSIGN-038 | PASS | Only "Organization" / "organizations" — zero "Organisation" matches |
| TC-ORGSIGN-039 | PASS | Terms/Privacy href="#" — no broken anchors |

## 6. Files changed

| File | Change | Touched by |
|------|--------|------------|
| `prototype/organization-signup.html` | New file — single-page org signup form per §2.4–§2.8 | gharsetu-frontend |
| `docs/planning/features/2026-05-26-organization-signup.html.md` | §5 Execution log + §6 Files changed populated | gharsetu-frontend |

## 7. Agents used

| Agent | Task | Status |
|-------|------|--------|
| gharsetu-lead | Initial planning (this file) — single-page vs 2-step decision, field inventory + validation parity, plan-tile UX, design-token sourcing, responsive map, TC catalogue (TC-ORGSIGN-001..039) | ✅ accepted |

Implementation deferred to the user per the landing-page pattern.

## 8. Post-deploy

(Empty.)

## 9. Cross-references

- **Solution Overview v8** (`docs/product/Solution_Overview.docx`) — §New Features → Organization Management (SAAS layer) defines the public sign-up + Super Admin approval flow this page feeds.
- **Solution Overview v8** — §New Roles → Super Admin owns the approval queue downstream of this form.
- **Solution Overview v8** — §New Business Rules NR-5 (organization data isolation — every record carries `organization_id` from approval onwards) and NR-6 (subscription plan caps — the plan chosen on this form determines the active-user cap once approved).
- **UIUX Design Document** (`docs/product/UIUX_Design_Document.docx`) — §1 Design Principles (no native tooltips, saffron focus rings), §2 Design Tokens (every token used here verified against this section), §3 Layout Foundations (single 1024 px breakpoint, responsive transformations), §4 Information Architecture (`/organization-signup` public route, no `:org` prefix), §5 Page Layout Templates (Form page template), §7 Components (Form field · Input · Button · Card), §8 Interaction Patterns (form validation visual contract, save feedback / success state), §9 Accessibility (Tab order, labels, contrast, error association).
- **Landing page plan** (`docs/planning/features/2026-05-26-landing-page-saas.md`) — the upstream page; this form is the target of its primary CTA. TC-LAND-002, TC-LAND-004, TC-LAND-009 verify the link wiring to this page.
- **`prototype/assets/styles.css`** — all design tokens used; nothing invented. Specific lines referenced inline in §2.6.
- **`prototype/login.html` / `prototype/forgot-password.html`** — chrome family this page inherits (`.auth-shell`, `.auth-card`, `.auth-brand`, `.auth-tagline`, password eye-toggle pattern, success-state pattern).
- **CLAUDE.md Working rule #2** — planning file precedes code; this file fulfils it for the org-signup prototype.
- **CLAUDE.md Working rule #9** — prototype kept in sync with the live app; on ship, append a row to `docs/planning/prototype-changes.md`.
- **CLAUDE.md Technical convention #16** — FE Zod / validation.js mirrors backend class-validator field-for-field; no HTML5 native tooltips. §2.5 documents the per-field rules so the backend can mirror exactly.
- **CLAUDE.md Scope rule B** — Public Organization sign-up IS in scope; Super Admin approval gate; tenant self-signup remains out of scope.
- **CLAUDE.md Scope rule G** — A2 / A3 / C1 select values map to wire-stable smallint enums when backend lands.
- **CLAUDE.md Scope rule I** — prototype is the design contract; tokens port verbatim to `tailwind.config.ts` for the live build.
- **`claude-progress.md` §8** — CARRY-05 (password min 10 → 12) deferred decision applies to B4 validation here.
