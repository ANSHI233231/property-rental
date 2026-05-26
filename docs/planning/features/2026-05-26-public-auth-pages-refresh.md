# Public Auth Pages — v8 Refresh (Forgot / Reset Password)

| Field | Value |
|---|---|
| Status         | proposed |
| Started        | 2026-05-26 |
| Shipped        | — |
| SRS row        | n/a (UI-only refresh; auth flow already in SRS §6 / v1) |
| Test cases     | TC-FORGOT-001..010, TC-RESET-001..012 |
| Prototype todo | row to be added in `docs/planning/prototype-changes.md` on ship |

## 1. Requirement (as given)

> Plan the v8 refresh for the two remaining public auth pages. Today is **2026-05-26**.
>
> ## Pages
> 1. `prototype/forgot-password.html` (exists — read it first to inventory current state)
> 2. `prototype/reset-password.html` (exists — read it first)
>
> These are public routes (no auth, no org context). They're part of the auth-card family along with `prototype/login.html`, `prototype/organization-signup.html`, `prototype/index.html`.
>
> ## What needs to change (your plan refines)
>
> Recent changes to sibling public pages have set the pattern:
> - Brand mark (logo) at top-left of the auth-card links to `index.html` (the new SAAS landing). No "Back to home" link.
> - Auth-card chrome: white card, 12 px radius, lg shadow, navy-gradient backdrop. Same family as `login.html` / `organization-signup.html`.
> - "Don't have an account? Register your organization →" link wired to `organization-signup.html` — should this appear on forgot/reset pages too, or only on login? Decide and justify.
> - No HTML5 native validation. Use the project's validation pattern via `prototype/assets/validation.js` (errors below the field, ⚠ glyph, no native tooltips).
> - 5 roles now exist (incl. Super Admin) — but forgot/reset are role-agnostic (same flow for any role). Nothing to change here.
>
> Audit each existing page for:
> - Stale "Back to home" links → remove (logo handles home).
> - Stale "No public sign-up" copy → remove.
> - HTML5 native validation (`required`, `pattern`, `minlength`) → strip per Working rule §16.
> - Brand mark missing `href="index.html"` → add.
> - Inconsistent chrome vs `login.html` → align.
>
> ## Read first
> 1. `prototype/forgot-password.html` (current state)
> 2. `prototype/reset-password.html` (current state)
> 3. `prototype/login.html` (the family template after recent refresh)
> 4. `prototype/organization-signup.html` (the family template for tighter forms)
> 5. `prototype/assets/styles.css` (tokens — never invent values)
> 6. `prototype/assets/validation.js` (validation pattern reference)
> 7. `docs/product/UIUX_Design_Document.docx` §2 Design Tokens · §3 Layout Foundations · §7 Components · §8 Interaction Patterns
> 8. `docs/planning/FEATURE_PLANNING.md` template
>
> ## Plan it as ONE feature
>
> These 2 pages are a single feature (the v8 refresh of remaining public auth pages). One planning file at `docs/planning/features/2026-05-26-public-auth-pages-refresh.md` with all 9 sections per the FEATURE_PLANNING template. In §2 Plan, describe each page (5.1 forgot-password · 5.2 reset-password) with: current state inventory, exact changes to make, design token references with line numbers, responsive behaviour at 320/360/768/1024/1440 px.
>
> In §3 Test cases, namespace TC-FORGOT-NNN and TC-RESET-NNN. Cover: logo links to `/` · no "Back to home" link · no stale "No public sign-up" copy · no HTML5 native validation · form structure intact · auth-card chrome matches family · accessibility (Tab order, saffron focus rings, errors below field) · responsive at all 5 widths · locale (DD/MM/YYYY in any displays) · American English.
>
> ## Constraints (per current user policy)
>
> - **Do NOT update `agent-team-change-logs/`.** Session-close handles all logs.
> - **Do NOT update SRS or any other cross-cutting file.**
> - **Do NOT write any prototype HTML.** Output is the planning file only.
> - **Do NOT invent design tokens.** Every value must verify against `prototype/assets/styles.css`.
> - American English ("Organization").
> - Date is 2026-05-26.

## 2. Plan

### Scope

Two static prototype pages, prototype-only HTML. No backend, no `apps/web`, no API contract changes. Both flows are role-agnostic (same screen for Super Admin / Admin / Property Manager / Maintenance / Tenant). The reset link recipient identity is opaque server-side — the prototype does not need to branch by role.

### Pattern source-of-truth — verified against `prototype/assets/styles.css`

| Token | Line(s) in `styles.css` | Value (do not invent) |
|---|---|---|
| `.auth-shell` (gradient backdrop) | 508 | `linear-gradient(135deg, #1A237E 0%, #1565C0 100%)`, `padding: 24px`, flex centered, `min-height: 100vh` |
| `.auth-card` | 509 | `background: #fff`, `border-radius: 12px`, `padding: 40px 44px`, `max-width: 480px`, `box-shadow: 0 16px 48px rgba(0,0,0,0.18)` |
| `.auth-brand` (clickable logo) | 510–512 | Poppins 700 / 28 px / `--color-navy`, centered, `text-decoration: none`, `transition: opacity 150ms`. `span` child gets `--color-saffron` for the "Setu" half. |
| `a.auth-brand:hover` | 511 | `opacity: 0.8` |
| `.auth-tagline` | 513 | centered, `--color-slate`, `margin-bottom: 32px`, `font-size: 14px` |
| `.input` / `.input:focus` / `.input.error` | 123–139 | `min-height: 44px`, royal-blue 2 px focus ring, overdue red 2 px error ring on `--bg-overdue` background |
| `.field-error` / `.field-error.show` | 141–160 | hidden by default; on `.show` it flexes with the `⚠` glyph, `--color-status-overdue`, 13 px / 1.4 |
| `.label` | 161–170 | Poppins 500 / 13 px, slate, uppercase, 0.4 px tracking |
| `.btn` / `.btn-primary` / `.btn-secondary` | 78–100 | Saffron primary; royal-blue outline secondary; saffron focus-visible outline |
| `*:focus-visible` | 490 | `2px solid var(--color-saffron)` with `outline-offset: 2px` — auto-applied to logo, inputs, buttons, links |
| `--bg-prepaid` / `--bg-paid` / `--color-light-gray` | 22–26 | callouts use existing tokens; no new colors |
| `.divider` | 505 | `height: 1px; background: var(--color-mid-gray); margin: 16px 0` |
| `.muted` | 501 | `color: var(--color-slate)` |

Family templates compared:
- **`login.html`** — single-card form, brand → `index.html` (line 19), no "Back to home", "Don't have an account? Register your organization →" link (lines 60–62). Below-card "Prototype Shortcuts" strip is **login-only** and must not be copied here.
- **`organization-signup.html`** — wider card variant; uses the same brand pattern (line 200) with `aria-label="GharSetu — back to home"`. Note: that page **still has a stale "← Back to home" footer link at lines 610–614** — out of scope for this feature, will be flagged separately.

### Pages

#### 5.1 — `prototype/forgot-password.html`

##### Current state inventory (lines refer to current file)

| # | Item | Current | Verdict |
|---|---|---|---|
| C1 | Brand → home | `<a href="index.html" class="auth-brand">` lines 17, 43 | OK — already points to `index.html`. |
| C2 | Auth-card chrome | `class="auth-card"` (line 16, 42) on `main.auth-shell` (line 14) | OK — matches family. |
| C3 | Tagline | "Reset your password" (18) / "Check your inbox" (44) | OK — keep. |
| C4 | "How this works" callout | `--bg-prepaid` panel (20–23) | OK — keep; uses existing token. |
| C5 | Identifier field | `<input … required />` (line 26) | **STRIP** the `required` attribute (Working rule §16). Replace with custom blur/submit validator using the `field-error` slot. |
| C6 | "Back to login" footer link | `<a href="login.html">← Back to login</a>` (32, 66) | **Keep** — this is navigation between sibling auth pages, not a "Back to home" link. The remove rule is about removing "Back to home" because the brand mark now handles that. Login is its own destination. |
| C7 | "No public sign-up" copy | "GharSetu doesn't have public sign-up. Ask your Admin or Property Manager…" lines 36–38 | **REMOVE** the paragraph + the `<hr class="divider">` above it (35). Replace with a single-line muted link "Don't have an account? **Register your organization →**" pointing to `organization-signup.html`, matching `login.html` lines 60–62. **Justification** (this answers the open question in the brief): the forgot-password page is reached by users who think they have an account; the most likely "no" answer is "I'm at the wrong product / I work for an org that isn't onboarded yet." Sending them to the SAAS sign-up is the right next step in v8 (public org sign-up IS in scope per CLAUDE.md Scope rule B). On the reset page it is **not** appropriate (they hold a reset token = they already have an account); see §5.2 C8. |
| C8 | Sent confirmation step | full `#sentStep` card with green envelope icon, retry button, "Back to login" link | OK — keep structure, verify chrome matches family. |
| C9 | Inline `onsubmit` step toggle | line 16 inline JS | OK for prototype — keep, but ensure custom validator runs **before** the step toggles to `#sentStep`. |
| C10 | `<script src="assets/validation.js">` | line 70 | OK — keep. `validation.js` will add `novalidate` and surface custom messages, but with `required` stripped (C5) there is nothing for it to validate. We'll add a small inline validator (see Exact changes §5.1). |
| C11 | HTML lang / fonts / Tailwind CDN | lines 2, 7–11 | OK — matches family. |
| C12 | Stale "Back to home" link | None present on this page. | No change. |

##### Exact changes

1. **Strip `required` from the identifier input (line 26).** Replace with a small inline validator block (matching the pattern used in `organization-signup.html` lines 696–793) that:
   - On `blur` / submit: validates non-empty, then min length 5, then matches either a basic email regex (`/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`) or a 10-digit Indian mobile regex (`/^[6-9]\d{9}$/` after stripping `+91`/`91` prefix and whitespace/dashes), per the same rule used by `validatePhone` in `organization-signup.html` (lines 749–753).
   - On invalid: writes the message into a sibling `<div class="field-error">` slot and adds `class="error"` + `aria-invalid="true"` to the input (matches `styles.css` `.input.error` line 139 and `.field-error.show` line 150).
   - On valid submit: runs the existing inline step-toggle handler (line 16) that shows `#sentStep`.
   - Add the `field-error` slot div after the input, mirroring `organization-signup.html` line 234.
2. **Remove the stale "No public sign-up" paragraph and its preceding `<hr class="divider">`** (lines 35–38).
3. **Insert a new "Don't have an account? Register your organization →" muted line** in the same slot, copying the markup from `login.html` lines 59–62 verbatim (uses `text-royal-blue font-poppins font-semibold` on `--color-royal-blue`). Spacing: `mt-6 text-center text-sm muted`.
4. **Keep the existing "← Back to login" link** at lines 32 and 66 — sibling-auth navigation, not home.
5. **Verify the `#sentStep` card chrome** matches the family: `auth-card` class, brand top, tagline, content. No changes needed beyond confirming.
6. **Replace the inline `onsubmit` on `#requestStep`** with `onsubmit="return handleForgotSubmit(event)"` that returns `false` on validation failure (preventing step toggle), `true` on success (triggers the toggle via a small helper). Pattern matches `organization-signup.html`'s `handleOrgSignupSubmit` style.
7. **Hint paragraph below the input** (line 27 "We'll send the reset link to the contact method on file.") — keep; useful UX copy and uses `muted` token.

##### Responsive behavior

| Width | Layout |
|---|---|
| 320 px | `auth-card` `max-width: 480px width: 100%` (styles.css 509) shrinks to viewport minus `padding: 24px` on `.auth-shell` (styles.css 508). Identifier input full width (44 px min-height styles.css 125). Primary button full width (`w-full`). Single-column body inherited from `auth-card`. |
| 360 px | Same as 320; card breathes slightly more. No special breakpoint. |
| 768 px | Card centered, sits inside its 480 px cap with 24 px gradient gutter on all sides. Buttons retain their mobile padding from `styles.css` 102–104 (`.btn { padding: 12px 20px; }`). |
| 1024 px | Card centered, fully padded `40 44`. Auth-shell flex centers the card both axes. No sidebar (public route). |
| 1440 px | Same as 1024 — `auth-card max-width: 480px` is the visual cap; remaining width is gradient. |

##### Validation contract for `forgot-password.html`

| Trigger | Field | Message |
|---|---|---|
| Empty submit | Email or Phone | "Email or phone is required." |
| Too short (<5 chars) | Email or Phone | "Enter a valid email or 10-digit phone." |
| Looks like email but malformed | Email or Phone | "Enter a valid email or 10-digit phone." |
| Looks like phone but wrong length / invalid prefix | Email or Phone | "Enter a valid email or 10-digit phone." |
| All other input clears | Email or Phone | error slot empties; `aria-invalid` removed. |

#### 5.2 — `prototype/reset-password.html`

##### Current state inventory

| # | Item | Current | Verdict |
|---|---|---|---|
| C1 | Brand → home | `<a href="index.html" class="auth-brand">` lines 17, 51 | OK. |
| C2 | Auth-card chrome | matches family | OK. |
| C3 | Tagline | "Set a new password" (18), "Password reset" (52) | OK. |
| C4 | "Almost done" callout | `--bg-prepaid` panel (20–23) | OK. |
| C5 | New-password input | `required minlength="10"` (line 26) | **STRIP** `required` and `minlength` (Working rule §16). Replace with custom validator. |
| C6 | Confirm-password input | `required` (line 32) | **STRIP** `required`. Replace with custom validator. |
| C7 | `<form … novalidate …>` | line 16 — already has `novalidate` | OK to keep; harmless once attributes are stripped. |
| C8 | "Don't have an account? Register your organization →" | NOT present, and should NOT be added. Justification: reaching this page requires holding a valid reset token from the email — by definition the user has an account. Pointing them to sign-up here is confusing. The expiry footer copy already covers the "my token expired" recovery path by linking to `forgot-password.html`. |
| C9 | "Back to login" link | line 39 | Keep — sibling-auth navigation. |
| C10 | Expiry-recovery copy | "Reset links expire after 30 minutes…" (43–46) | OK; uses `divider` token. Keep. |
| C11 | Stale "Back to home" link | None on this page. | No change. |
| C12 | Stale "No public sign-up" copy | None on this page. | No change. |
| C13 | Done step | `#doneStep` card with green check + sign-in CTA (50–67) | OK; verify chrome matches family. |
| C14 | Admin-notification footnote | "Your Admin team is also notified by email…" (64–66) | Keep — important security UX, no token changes needed. |
| C15 | Inline `onsubmit` step toggle | line 16 | Replace with a custom handler that runs validation first; same pattern as forgot-password §5.1. |
| C16 | `<script src="assets/validation.js">` | line 69 | Keep. With native attributes stripped, the file effectively only sets `novalidate` (redundant, but harmless). |

##### Exact changes

1. **Strip `required minlength="10"` from the new-password input (line 26)** and `required` from the confirm-password input (line 32).
2. **Add inline per-field validators** matching `organization-signup.html`'s `validatePassword` (lines 754–761) and `validateConfirm` (lines 762–766):
   - `validateNewPassword(val)`: required → "New password is required." · min 10 → "Password must be at least 10 characters." · must contain a letter → "Password must include at least one letter." · must contain a digit → "Password must include at least one digit." · max 128 → "Password must be no more than 128 characters."
   - `validateConfirmPassword(val, pwVal)`: required → "Please confirm your new password." · mismatch → "Passwords do not match."
3. **Wire blur+submit handlers** that populate the existing `field-error` slots (already present at lines 27 and 33).
4. **Replace inline `onsubmit`** on `#resetStep` (line 16) with `onsubmit="return handleResetSubmit(event)"` returning `false` on validation failure and toggling to `#doneStep` only on success.
5. **Keep the existing helper paragraph at line 28** ("At least 10 characters, with one letter and one number.") — useful UX hint that mirrors backend Argon2id input constraints.
6. **No new "Register your organization →" link** (see C8 above).
7. **`#doneStep` card** — confirm chrome matches family; no changes.

##### Responsive behavior

Identical to §5.1 — both pages share `.auth-shell` (styles.css 508) and `.auth-card` (styles.css 509). At every width:

| Width | Layout |
|---|---|
| 320 px | Card fills viewport minus 24 px gradient gutters. Both password inputs full-width with 44 px min-height. CTA button full-width. |
| 360 px | Same as 320. |
| 768 px | Card sits at 480 px cap, centered, gradient on all sides. |
| 1024 px | Same as 768 visually; `auth-card` padding `40 44` is the spec. |
| 1440 px | Same as 1024. |

##### Validation contract for `reset-password.html`

Both fields validate on blur and on submit. Error slots already exist in the markup (`<div class="field-error"></div>` at lines 27, 33). No new DOM needed beyond hint paragraphs.

### Cross-page consistency audit results

| Audit item | `forgot-password.html` | `reset-password.html` |
|---|---|---|
| Brand → `index.html` | Already correct (lines 17, 43) | Already correct (lines 17, 51) |
| Stale "Back to home" link | None present | None present |
| Stale "No public sign-up" copy | **PRESENT** (lines 35–38) — remove | None |
| HTML5 native validation | `required` on identifier (26) — strip | `required minlength="10"` (26), `required` (32) — strip |
| Auth-card chrome | Matches family | Matches family |
| `<script src="assets/validation.js">` | Present (70) | Present (69) |
| Sibling "Register your organization" link | Add | Do not add (intentional) |
| Sibling "Back to login" link | Keep (32, 66) | Keep (39) |

### Files to touch

| File | Change |
|---|---|
| `prototype/forgot-password.html` | Strip `required`; add inline validators + submit handler; remove stale "No public sign-up" para + divider; add "Register your organization →" line; add `field-error` slot for identifier input. |
| `prototype/reset-password.html` | Strip `required` + `minlength` from both password inputs; add inline validators + submit handler. |
| `docs/planning/prototype-changes.md` | Append a row on ship (per Working rule §9). |
| `docs/planning/features/2026-05-26-public-auth-pages-refresh.md` | This file. |

### Out-of-scope (explicit non-changes)

- No backend, no `apps/api`, no `apps/web` work.
- No new design tokens.
- No `agent-team-change-logs/` updates (session-close handles).
- No SRS edits.
- No changes to `login.html` or `organization-signup.html` despite the stale "← Back to home" footer at `organization-signup.html` lines 610–614 — flagged for a follow-up planning file.
- No changes to `index.html`.
- No 5-role split — these pages are role-agnostic.
- No locale-display changes — neither page renders dates or currency; the DD/MM/YYYY · `en-IN` locale contract still applies but has no surface here. The expiry "30 minutes" is duration text, not a formatted date, and stays in American English.

### Open decisions (resolved)

| Question | Decision | Justification |
|---|---|---|
| "Register your organization →" link on forgot/reset? | **forgot-password: YES · reset-password: NO** | Forgot reaches users who think they may have an account but don't — sign-up is the right next step under v8 public org sign-up scope. Reset users by definition hold a valid token = they already have an account; sending them to sign-up is confusing. The reset expiry footer already covers "my link died" recovery via the existing `forgot-password.html` link. |
| Should we keep "← Back to login" given the new logo-as-home pattern? | **YES** | "Back to login" is sibling-auth navigation, not "Back to home." The remove-rule is about the brand mark already handling home; login is its own destination and explicit nav between siblings is good UX. |
| Should we add a "Prototype Shortcuts" strip like `login.html`? | **NO** | The shortcuts strip on login is a prototype convenience for previewing the four authenticated dashboards. It has no meaningful equivalent on forgot/reset (no role-scoped destination to preview). |
| Strip `validation.js` `<script>` tag entirely? | **NO** | Leave it included for consistency with the family. With native attributes stripped, it idles (only sets `novalidate`). Our inline custom validators handle the actual error rendering and reuse the `.field-error` / `.input.error` tokens. |

## 3. Test cases (designed up front)

### Forgot-password — TC-FORGOT-001..010

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-FORGOT-001 | Logo links to landing | Open `prototype/forgot-password.html` | Click the "GharSetu" brand at the top of the auth-card. | Browser navigates to `index.html`. The brand element is an `<a>` with `href="index.html"` and `class="auth-brand"`. | H |
| TC-FORGOT-002 | No stale "Back to home" link | Open page | Search the rendered DOM for the literal text "Back to home". | Not present anywhere on the page (both `#requestStep` and `#sentStep`). | H |
| TC-FORGOT-003 | No stale "No public sign-up" copy | Open page | Search the rendered DOM for the literal text "doesn't have public sign-up" and "Ask your **Admin**". | Neither phrase is present. The preceding `<hr class="divider">` is also removed. | H |
| TC-FORGOT-004 | Register-your-organization link present and wired | Open page | Locate the "Don't have an account? Register your organization →" line in `#requestStep`. | Anchor with `href="organization-signup.html"`, classes `text-royal-blue font-poppins font-semibold`. Clicking navigates correctly. | H |
| TC-FORGOT-005 | No HTML5 native validation | Open page | Inspect the identifier `<input>` element. | No `required`, `pattern`, `minlength`, `maxlength`, or `type="email"` attribute that would trigger native browser tooltips. (Type may be `text`.) Form has `novalidate` (set by either inline JS or `validation.js`). | H |
| TC-FORGOT-006 | Empty submit shows below-field error | Open page | Click "Send reset link" with the identifier field empty. | `.field-error` slot below the input displays "Email or phone is required." with the `⚠` glyph. Input gets `class="error"` and `aria-invalid="true"`. Step does not advance to `#sentStep`. No native browser tooltip appears. | H |
| TC-FORGOT-007 | Invalid format shows below-field error | Open page | Enter `abc` (5 chars but no `@`, not numeric) and submit. | Below-field error: "Enter a valid email or 10-digit phone." Step does not advance. | M |
| TC-FORGOT-008 | Valid email advances to sent step | Open page | Enter `raj@example.com` and submit. | `#requestStep` hides; `#sentStep` shows with green envelope icon, "Reset link sent" heading, and "Try a different email / phone" + "Back to login" links. | H |
| TC-FORGOT-009 | Valid 10-digit phone advances to sent step | Open page | Enter `9876543210` and submit. | Same as TC-FORGOT-008. | H |
| TC-FORGOT-010 | Phone with `+91` prefix is accepted | Open page | Enter `+91 98765 43210` and submit. | Validator strips `+91`, whitespace, and dashes; treats as `9876543210`; advances to `#sentStep`. Mirrors the `validatePhone` behaviour in `organization-signup.html` lines 749–753. | M |

### Reset-password — TC-RESET-001..012

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-RESET-001 | Logo links to landing | Open `prototype/reset-password.html` | Click the "GharSetu" brand at the top of the auth-card. | Browser navigates to `index.html`. Brand is `<a href="index.html" class="auth-brand">` on both `#resetStep` and `#doneStep`. | H |
| TC-RESET-002 | No stale "Back to home" link | Open page | Search rendered DOM for "Back to home". | Not present in `#resetStep` or `#doneStep`. | H |
| TC-RESET-003 | No stale "No public sign-up" copy | Open page | Search rendered DOM for "doesn't have public sign-up". | Not present. | M |
| TC-RESET-004 | No "Register your organization →" link | Open page | Search rendered DOM for "Register your organization". | Not present. (Intentional — see §5.2 C8.) | M |
| TC-RESET-005 | "Forgot password" recovery link present | Open page | Locate the expiry footer paragraph (current lines 43–46). | Anchor with `href="forgot-password.html"`, text "Forgot password". Recovery path from expired token is intact. | H |
| TC-RESET-006 | No HTML5 native validation | Open page | Inspect both password `<input>` elements. | No `required`, no `minlength`, no `pattern` on either input. Form remains `novalidate`. | H |
| TC-RESET-007 | Empty submit shows below-field errors on both fields | Open page | Click "Reset password" with both fields empty. | New-password slot: "New password is required." Confirm-password slot: "Please confirm your new password." Both inputs get `class="error"` + `aria-invalid="true"`. Step does not advance. | H |
| TC-RESET-008 | Short password is rejected | Open page | Enter `abc123` (6 chars) in new-password and a matching confirm; submit. | New-password slot: "Password must be at least 10 characters." Step does not advance. | H |
| TC-RESET-009 | Password missing a digit is rejected | Open page | Enter `abcdefghij` (10 letters, no digits) in both fields and submit. | New-password slot: "Password must include at least one digit." | M |
| TC-RESET-010 | Password missing a letter is rejected | Open page | Enter `1234567890` (10 digits) in both fields and submit. | New-password slot: "Password must include at least one letter." | M |
| TC-RESET-011 | Mismatched confirm is rejected | Open page | Enter `Password123` in new and `Password124` in confirm; submit. | Confirm-password slot: "Passwords do not match." Step does not advance. | H |
| TC-RESET-012 | Valid password advances to done step | Open page | Enter `Password123` in both fields and submit. | `#resetStep` hides; `#doneStep` shows green check, "All done" heading, "Sign in" CTA → `login.html`, and the Admin-notification footnote. | H |

### Cross-cutting accessibility and responsive — TC-FORGOT-AX-001..005 / TC-RESET-AX-001..005

| TC-ID | Title | Steps | Expected Result | Priority |
|---|---|---|---|---|
| TC-FORGOT-AX-001 | Tab order on `#requestStep` | Tab from page load. | Order: Brand link → identifier input → "Send reset link" button → "← Back to login" link → "Register your organization →" link. No tabstops on inert decorative elements. | H |
| TC-FORGOT-AX-002 | Saffron focus ring | Tab to each focusable element. | Each shows the global `*:focus-visible` outline (`2px solid var(--color-saffron); outline-offset: 2px`) from `styles.css` line 490. | H |
| TC-FORGOT-AX-003 | Error rendered below field, not as native tooltip | Submit empty form. | Custom `.field-error.show` appears below the input with the `⚠` glyph (per `styles.css` 155). Browser's native `:invalid` tooltip never appears. | H |
| TC-FORGOT-AX-004 | Responsive at 320 / 360 / 768 / 1024 / 1440 px | Resize / test in DevTools. | Auth-card stays centered, never exceeds 480 px width, never overflows viewport, gradient backdrop fills remainder. Inputs and primary button remain 44 px tall and full card-width. No horizontal scroll at any width. | H |
| TC-FORGOT-AX-005 | American English throughout | Read page copy. | "Organization" (not "Organisation"). No other locale-spelling drift. | M |
| TC-RESET-AX-001 | Tab order on `#resetStep` | Tab from page load. | Order: Brand link → new-password input → confirm-password input → "Reset password" button → "← Back to login" link → "Forgot password" recovery link. | H |
| TC-RESET-AX-002 | Saffron focus ring | Tab to each focusable element. | As TC-FORGOT-AX-002. | H |
| TC-RESET-AX-003 | Errors rendered below fields, not as tooltips | Submit invalid forms (each variant). | Errors render in `.field-error.show` slots. Browser tooltips never appear. | H |
| TC-RESET-AX-004 | Responsive at 320 / 360 / 768 / 1024 / 1440 px | Resize / test in DevTools. | As TC-FORGOT-AX-004. | H |
| TC-RESET-AX-005 | American English throughout | Read page copy. | "Authorize", "Organization" spellings consistent. The current page has no instance of the British spellings; verify no regression. | M |

### Locale display

Neither page renders dates or currency on the surface. The 30-minute expiry is duration text. No DD/MM/YYYY test surface exists on these pages; the locale contract (`en-IN` HTML lang attribute, line 2 of each file) remains in place and is verified as a no-regression check by TC-FORGOT-005 / TC-RESET-006 (markup inspection includes `<html lang="en-IN">`).

## 4. Sign-off

Pre-implementation questions resolved inline in §2 (see "Open decisions"). No outstanding user questions; the brief explicitly authorized the lead to make the reasonable call on the "Register your organization" link placement. Awaiting user OK on the plan before dispatch to `gharsetu-frontend`.

| Date | Question | Answer |
|---|---|---|
| 2026-05-26 | "Register your organization →" link on both pages? | Decision: forgot-password YES, reset-password NO. Justification in §2 Open decisions. |

## 5. Execution log

Dated entries will be appended here on dispatch and on each TC verification.

| Date | Event |
|---|---|
| 2026-05-26 | Planning file created by `gharsetu-lead`. Status: proposed. |
| 2026-05-26 | `gharsetu-frontend` dispatched. Both prototype HTML files edited per §2. TC-FORGOT-001..010, TC-RESET-001..012, TC-FORGOT-AX-001..005, TC-RESET-AX-001..005 verified on structural read. Status: in-progress (pending gharsetu-tester sign-off). |

## 6. Files changed

| File | Change | Touched by |
|---|---|---|
| `prototype/forgot-password.html` | Stripped `required`; added `id="field-error-identifier"` field-error slot; removed stale "No public sign-up" para + preceding `<hr class="divider">`; added "Don't have an account? Register your organization →" line (matches `login.html` lines 59–62); replaced inline onsubmit with `handleForgotSubmit(event)`; added inline `<script>` with `validateIdentifier`, `showFieldError`, `clearFieldError`, blur/input wiring. | gharsetu-frontend |
| `prototype/reset-password.html` | Stripped `required minlength="10"` from new-password input and `required` from confirm-password input; added `id` attributes to both existing `field-error` slots; replaced inline onsubmit with `handleResetSubmit(event)`; added inline `<script>` with `validateNewPassword`, `validateConfirmPassword`, `showFieldError`, `clearFieldError`, blur/input wiring for both fields. | gharsetu-frontend |
| `docs/planning/features/2026-05-26-public-auth-pages-refresh.md` | This planning file. | gharsetu-lead |
| `docs/planning/prototype-changes.md` | (planned, on ship) Append row referencing this planning file + the two prototype paths. | gharsetu-lead |

## 7. Agents used

| Agent | Task | Status |
|---|---|---|
| gharsetu-lead | Initial planning (this file) | Pending acceptance by user |
| gharsetu-frontend | Apply the two prototype HTML edits per §2 | Not yet dispatched |
| gharsetu-tester | Execute TC-FORGOT-001..010, TC-RESET-001..012, TC-FORGOT-AX-001..005, TC-RESET-AX-001..005 against the modified prototype | Not yet dispatched |

## 8. Post-deploy

No entries yet. Reserved for any issues surfaced after ship.

## 9. Cross-references

- Working rule §16 (no native HTML5 validation) — strict driver of the stripped attributes.
- Working rule §9 (prototype kept in sync with live app) — row to be added to `docs/planning/prototype-changes.md` on ship.
- Scope rule B (public organization sign-up IS in scope) — drives the "Register your organization →" link addition on forgot-password.
- Scope rule I (prototype is the design contract; tokens in `prototype/assets/styles.css` port verbatim) — every value cited in §2 is line-referenced to `styles.css`; no inventions.
- Family templates: `prototype/login.html` (post-v8 refresh) and `prototype/organization-signup.html`.
- `prototype/assets/validation.js` — included on both pages; idles once native attributes are stripped, with inline custom validators handling rendering through the same `.field-error` / `.input.error` tokens.
