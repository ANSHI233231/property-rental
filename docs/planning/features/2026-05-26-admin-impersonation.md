# Admin Impersonation — banner overlay + start/end-session flow from `prototype/admin/users.html`

| Field | Value |
|---|---|
| Status         | proposed |
| Started        | 2026-05-26 |
| Shipped        | — |
| SRS row        | (prototype-only — SRS row added when backend ships under ENG-F02 Admin Impersonation; backed today by `Solution_Overview.docx` v8 §New Features → Admin Impersonation + §Business Rules NR-7) |
| Test cases     | TC-IMPERS-001..028 (designed up front in §3) |
| Prototype todo | row to be added to `docs/planning/prototype-changes.md` on ship (one row covering `prototype/admin/users.html` + the partial banner include across all role-scoped pages) |

## 1. Requirement (as given)

> "Plan the Admin Impersonation UI. Today is **2026-05-26**.
>
> What it is. Per Solution Overview v8 §New Features → 'Users & Access — Admin Impersonation': Admin can start an impersonation session as any PM / Maintenance / Tenant within their own Organization. During the session, the Admin sees the impersonated user's UI / actions / data. All actions during the session are recorded against the Admin in the audit log (per NR-7). The Admin can end the session at any time.
>
> Boundary (per NR-7): Super Admin cannot be impersonated; Admin cannot impersonate users outside their own Organization; Admin cannot impersonate another Admin (no peer impersonation).
>
> Prototype surface. This feature is mostly a banner component that overlays the impersonated user's UI + a small start-session flow. Two main pieces:
> 1. Start-session flow, triggered from `prototype/admin/users.html`: each user row gets an 'Impersonate' action (only for PM / Maintenance / Tenant rows; not for Admin rows). Click → confirmation modal: 'Start impersonation session as Sunita Arora (PM)?' with the Admin's name as recorded actor + warning that all actions are audited as Admin. Confirm → modal closes, persistent saffron banner appears, page redirects to the impersonated user's dashboard.
> 2. Persistent saffron banner, shown across the top of EVERY page during an impersonation session: saffron background, white text — 'Acting as Sunita Arora (PM, Green Valley). All actions recorded as you.' 'End session' button on the right (red-outline-on-saffron). Banner is fixed at the top, pushes the rest of the page down. Stays visible in every role-scoped layout.
> 3. End-session flow: Click 'End session' → confirmation modal: 'End impersonation session and return to your Admin dashboard?' Confirm → banner disappears, redirect to `admin/dashboard.html`.
>
> Prototype implementation note: since the prototype is static HTML, impersonation can be simulated with a demo 'Impersonate' link on `prototype/admin/users.html` that navigates to the target dashboard with a flag (`?impersonating=sunita`) that triggers the banner via JS, and a demo banner component (HTML partial that can be included on each authenticated page) that reads the flag and renders accordingly.
>
> Plan it as ONE feature. One planning file at `docs/planning/features/2026-05-26-admin-impersonation.md` with all 9 sections per FEATURE_PLANNING. In §2 Plan, describe: the banner component anatomy (HTML structure + tokens), the start-session flow (admin/users.html row action + modal + redirect mechanic), the end-session flow, and where the banner gets included across the role-scoped pages.
>
> In §3 Test cases, namespace TC-IMPERS-NNN. Cover: banner renders at top of every role-scoped page when impersonating · 'End session' returns to admin dashboard · 'Impersonate' action absent for Admin rows · 'Impersonate' action absent for the Admin's own row · Super Admin cannot be impersonated (action not shown in any list) · all actions still UI-attributable to the Admin (visual cue: small 'you' label or similar) · accessibility · responsive at 5 widths · locale.
>
> Constraints: do NOT update agent-team-change-logs · do NOT update SRS or any other cross-cutting file · do NOT write any prototype HTML · do NOT invent design tokens · American English · today is 2026-05-26."

Backed by `Solution_Overview.docx` v8 §New Features → Admin Impersonation row + §Business Rules NR-7, and `UIUX_Design_Document.docx` §6 Components → "Impersonation banner" entry · §7 Components / interaction patterns · §8 Modal pattern · §9 Accessibility floor. The prototype surface ports the design contract from `prototype/assets/styles.css` verbatim.

## 2. Plan

### 2.0 Scope guardrails

This planning file covers the **prototype surface only** — the static HTML/CSS/JS visual design of the impersonation banner + the start/end flows on `prototype/admin/users.html`. Backend (impersonation token issuance, audit-log writes under Admin actor_id, role-scope enforcement of NR-7 boundaries) ships separately under ENG-F02 in `feature_list.json` and is **not** in scope here. The prototype simulates the session entirely client-side via a query-string flag — no auth, no API.

NR-7 boundary checks (Super Admin not impersonable · cross-Org blocked · peer-Admin blocked · own-row blocked) are enforced visually on the prototype by **omitting the Impersonate action from those rows** — there is no client-side guard against a hand-crafted URL because the prototype is not the security boundary. Tests in §3 verify only the visual omission, not the server-side enforcement.

### 2.1 Component anatomy — the saffron impersonation banner

Single new component, included as an HTML block at the top of every authenticated role-scoped page. Lives **inside** the `.app-shell` div, **above** the `aside.sidebar` and `main.app-main`. Pushes the rest of the page down — the sidebar's `top: 0` and the main's `padding-top` both adjust by the banner height when the banner is present.

#### 2.1.1 HTML structure (canonical block, included once per page)

```html
<div class="impers-banner" id="impersBanner" role="status" aria-live="polite" hidden>
  <div class="impers-banner-inner">
    <svg class="impers-banner-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <!-- eye-with-warning icon, 18 × 18, currentColor (= white on saffron) -->
    </svg>
    <div class="impers-banner-text">
      <span class="impers-banner-line1">
        Acting as <strong id="impersTargetName">—</strong>
        <span class="impers-banner-target-meta">
          (<span id="impersTargetRole">—</span><span id="impersTargetScope">—</span>)
        </span>
      </span>
      <span class="impers-banner-line2">
        All actions recorded as <strong id="impersActorName">—</strong>
        <span class="impers-banner-you-pill">YOU</span>
      </span>
    </div>
    <button type="button" class="btn impers-end-btn" onclick="openEndImpersonation()" aria-haspopup="dialog">
      End session
    </button>
  </div>
</div>
```

Two text lines so the banner is readable at mobile widths without forcing a 3-line wrap. On ≥ 768 px both lines render inline (single row); on ≤ 767 px the second line stacks under the first.

#### 2.1.2 Visual contract — tokens only, no invented values

Every value verifies against `prototype/assets/styles.css`. No new tokens introduced.

| Use | Token / class | CSS source (verified in `prototype/assets/styles.css`) |
|---|---|---|
| Banner background | `background: var(--color-saffron)` | line 7 (`#FF6F00`) |
| Banner text color | `color: #fff` | matches `.btn-primary` text on saffron, line 93 |
| Banner inner padding | `12px 24px` (desktop), `12px 16px` (≤ 1023 px) | mirrors `.app-main` 32/48 → 24/16 step at line 240 / 321 |
| Banner font family | `font-family: 'Poppins', system-ui, sans-serif` | matches `.btn` Poppins family, line 84 |
| Banner line-1 weight / size | Poppins 500 / 14 px desktop · 13 px mobile | mirrors `.sidebar-link` 14 px (line 208) and the global mobile step at line 107 |
| Banner line-2 weight / size | Inter 400 / 13 px (both widths) | mirrors `.field-error` 13 px (line 145) for secondary copy |
| Strong (target name, actor name) | `font-weight: 700` Poppins | matches `.kpi-value` weight, line 445 |
| "YOU" pill | `.badge`-style: 4×10 padding, 999 px radius, Poppins 600 12 px UPPERCASE letter-spacing 0.4 px, white background, saffron text | mirrors `.badge` at lines 53–63 — exact same shape, inverted color (white bg + saffron text instead of bg-paid + status-paid) |
| End-session button | `.btn` shape (Poppins 600 15 px, 6 px radius, 200 ms transition) with **white border + transparent fill + white text**, hover fills with white + saffron text | extends `.btn` (line 78) with two new selectors — uses **only** existing color tokens (white + saffron) |
| Focus ring on End-session | `2px solid #fff` (inverted because saffron focus-ring would be invisible on saffron background) | overrides the global `*:focus-visible` saffron ring (line 490) — only the inverted color value (#fff) is justified here, not a new token |
| Banner height (reserved) | desktop `48px`, mobile `64px` (two stacked lines) | derived from 12 + 14×1.6 + 12 ≈ 47 px; rounded to 48 to align with 8 px spacing grid (line 30 `--space-xs: 8px`) |
| Banner `position` | `position: fixed; top: 0; left: 0; right: 0; z-index: 80` | sits **above** `.sidebar` z-index 70 (line 318) and the drawer-backdrop z-index 60 (line 348), **below** modals z-index 100 (line 477). New z-index `80` is a derived value in the existing scale, not a new token. |
| Eye icon | inline `<svg>` 18 × 18, `stroke="currentColor"` | matches every other inline SVG icon in the prototype (e.g. `prototype/admin/users.html` line 21) |

#### 2.1.3 Layout offsets — how the banner pushes content down

The banner is `position: fixed` at the top. To prevent it overlapping the sidebar and main content, when the banner is present (i.e. `body` has class `impers-active`):

- `.sidebar { top: 48px; height: calc(100vh - 48px); }` on desktop · `top: 64px; height: calc(100vh - 64px)` on ≤ 1023 px
- `.app-main { padding-top: calc(32px + 48px); }` on desktop · `calc(24px + 64px)` on ≤ 1023 px
- `.tabbar` (mobile bottom tab bar) is unaffected — it sits at `bottom: 0`
- `.modal-backdrop` is unaffected — modals already render above the banner (z-index 100 > 80)

When `body` does **not** have `impers-active`, the banner stays `hidden` (HTML attribute) and the sidebar/main use their existing offsets unchanged. This means **every authenticated page can include the banner block unconditionally** — it's invisible when not impersonating, no markup branching needed in the per-page files.

#### 2.1.4 "YOU" pill — the actor cue requested in the brief

The white "YOU" pill on line 2 of the banner is the visual cue the brief asks for ("all actions still UI-attributable to the Admin: visual cue, small 'you' label or similar"). It sits next to the Admin's name on every page so the impersonator never loses track of who they actually are. Same pill is **not** rendered in form footers, modals, or audit-log rows — the banner is the single source of the cue. (Backend writes the audit_log row with `actor_user_id = admin.id` regardless — that's an ENG-F02 backend concern, not a prototype concern.)

### 2.2 Start-session flow — `prototype/admin/users.html`

Three additions to the existing file (`prototype/admin/users.html`):

#### 2.2.1 Per-row "Impersonate" action

The users table (lines 54–119) already has an Edit link in the last `<td>`. Add a second action — `Impersonate` — separated by a `·` middot, with conditional rendering driven entirely by row content (no inline JS, pure HTML so it's grep-able and accessible):

| Row | Role cell value | Action cell shows |
|---|---|---|
| Raj Singh (Admin, current user) | "Admin" | **Edit** only (no Impersonate — own row + Admin) |
| Sunita Arora (PM) | "Property Manager" | **Edit · Impersonate** |
| Manoj Verma (PM) | "Property Manager" | **Edit · Impersonate** |
| Raju Kumar (Maintenance) | "Maintenance" | **Edit · Impersonate** |
| Anil Bhardwaj (Maintenance) | "Maintenance" | **Edit · Impersonate** |
| Raj Sharma (Tenant) | "Tenant" | **Edit · Impersonate** |
| Priya Sharma (Tenant) | "Tenant" | **Edit · Impersonate** |

The conditional logic on the prototype is **static HTML** — every Admin row literally omits the `Impersonate` link from its cell. There is no client-side filter to bypass. On the live app, the same conditional is enforced by the renderer using `user.role` and `user.id !== currentAdmin.id`. The prototype encodes the rule by example.

For Super Admin rows — Super Admins do not appear in `prototype/admin/users.html` at all (that page lists only the Admin's own Organization, and Super Admins are platform-scoped, not Org-scoped). NR-7 boundary "Super Admin cannot be impersonated" is enforced by **absence from the list**, not by a per-row condition. Tests in §3 verify Super Admin does not appear in the Admin's user list.

#### 2.2.2 Start-impersonation modal

A new `<div class="modal-backdrop" id="startImpersonationModal">…</div>` block, sibling of the existing `addUserModal` (line 127) and `editUserModal` (line 197). Uses the same `.modal` chrome (white card, 12 px radius, 32 px padding, max-width 480 px — lines 478–483). Contents:

| Element | Tokens / class | Copy / behavior |
|---|---|---|
| Title (`<h3>`) | `.charcoal Poppins 600 20 px` (line 50) | "Start impersonation session?" |
| Body (`<p class="muted text-sm">`) | slate 14 px (`.muted` line 501) | "You're about to act as **Sunita Arora (Property Manager, Green Valley)**. While the session is active, you will see her dashboard, her data, and her permissions." |
| Audit notice (`<div class="alert">`) | `.alert` partial-amber band (lines 461–467) | Warning icon (`⚠`) + "Every action you take during this session is recorded in the audit log against **your** Admin account (Raj Singh). The impersonated user is not the actor." |
| Confirmation row | flex right-aligned, 24 px top margin | `<button class="btn btn-secondary">Cancel</button>` + `<button class="btn btn-primary">Start session</button>` |

No "Reason" textarea on the prototype — the backend (ENG-F02) may add a reason field for audit, but the prototype does not introduce a textbox that doesn't have a backend home yet. Open question logged in §4.

Modal trigger: each `Impersonate` link sets two `data-` attributes on the link (`data-target-name`, `data-target-role-scope`) and the click handler (added once, inline in `users.html` like the existing `addUserModal` opener) reads those attributes, populates the modal copy, and opens the modal — mirrors the existing `editUserModal` opener pattern at line 76. No `validation.js` change needed; this modal has no inputs.

#### 2.2.3 Redirect mechanic on confirm

The "Start session" button's onclick: build a `localStorage` snapshot of the impersonation context and redirect to the impersonated user's dashboard.

| `localStorage` key | Value | Read by |
|---|---|---|
| `gharsetu_impersonating` | `"1"` | All authenticated pages — gate for `impers-active` body class |
| `gharsetu_impers_target_name` | e.g. `"Sunita Arora"` | Banner line 1 |
| `gharsetu_impers_target_role` | e.g. `"Property Manager"` | Banner line 1 meta |
| `gharsetu_impers_target_scope` | e.g. `"Green Valley, Dwarka"` | Banner line 1 meta (after `,`) |
| `gharsetu_impers_actor_name` | e.g. `"Raj Singh"` | Banner line 2 (the admin's own name) |
| `gharsetu_impers_target_dashboard` | one of `pm/dashboard.html`, `maintenance/dashboard.html`, `tenant/dashboard.html` | Redirect target |

The brief's `?impersonating=sunita` query-string alternative is simpler but doesn't survive page navigation (every subsequent click needs to re-pass the flag) — `localStorage` is the right primitive for a session that spans many pages. Both Admin and prototype-impersonation sessions exist only on the local browser; clearing site data ends them. The brief's intent (a flag that triggers the banner via JS) is preserved — only the storage medium differs.

Inline JS on `users.html` builds the snapshot from `data-` attributes, writes the six keys, then `window.location.assign('../<target-dashboard>')`.

### 2.3 Where the banner gets included — across the role-scoped pages

The banner block from §2.1.1 + the inline JS from §2.4 are included on every authenticated page **except** Public + Super Admin pages (which are out of scope for impersonation per NR-7).

**Included on (10 pages)**:

| Page | Why |
|---|---|
| `prototype/admin/dashboard.html` | Admin returns here when ending the session; the banner is hidden until impersonation starts (it's never "active" on an Admin page in practice because starting impersonation immediately redirects away from Admin, but having the block present means **end-session** can land here safely and the JS doesn't crash looking for a missing element) |
| `prototype/admin/users.html` | same rationale + this is where impersonation starts |
| `prototype/admin/properties.html`, `units.html`, `maintenance.html`, `rent.html`, `audit-log.html`, `profile.html` | Admin pages — same defensive include |
| `prototype/pm/*.html` (9 files) | Impersonation as PM lands on `pm/dashboard.html`; the banner must persist across PM navigation |
| `prototype/maintenance/*.html` (3 files) | Impersonation as Maintenance lands on `maintenance/dashboard.html`; banner must persist |
| `prototype/tenant/*.html` (4 files) | Impersonation as Tenant lands on `tenant/dashboard.html`; banner must persist |

**Excluded from (4 + 5 pages)**:

| Page | Why excluded |
|---|---|
| `prototype/index.html` | Public landing — no auth, no impersonation context |
| `prototype/login.html`, `forgot-password.html`, `reset-password.html` | Public auth — impersonation must be cleared before login (see §2.5) |
| `prototype/organization-signup.html` | Public — out of scope |
| `prototype/super-admin/*.html` (5 files) | Per NR-7, Super Admin cannot be impersonated. Super Admin sessions are a separate auth domain; the banner block is not included to make the impossibility of impersonating-into-Super-Admin structurally visible. |

#### 2.3.1 Banner partial — manual include vs JS injection

The prototype has no template system (it's static HTML with no Eleventy / Astro / Vite). Two options to avoid copy-paste drift:

| Option | How | Tradeoff |
|---|---|---|
| **A — Copy-paste** | The banner block (§2.1.1) and the JS handler (§2.4) are pasted into each of the 27 included files. | Verbose; risk of drift if the banner copy changes. |
| **B — JS injection (recommended)** | A new file `prototype/assets/impersonation.js` contains: (1) the banner HTML as a JS string + a function that prepends it to `document.body` on `DOMContentLoaded` if `localStorage.gharsetu_impersonating === "1"`; (2) the `openEndImpersonation()` modal opener; (3) the body-class toggling; (4) the localStorage read/write. Every included page just adds `<script src="../assets/impersonation.js"></script>` next to the existing `validation.js` include. | Single source of truth; aligns with how `validation.js` already works (auto-suppresses native tooltips on every form). |

Recommend **B**. It's the same pattern the prototype already uses for cross-cutting JS (`prototype/assets/validation.js`). All copy lives in one file; banner edits ripple through the 27 pages automatically.

### 2.4 JS contract — `prototype/assets/impersonation.js`

Single new file, ~80 lines, no dependencies. Exposes nothing on `window` (all state in `localStorage` + a single `id` on the injected modal). Behaviors:

| Trigger | Effect |
|---|---|
| `DOMContentLoaded` on any included page | Read `localStorage.gharsetu_impersonating`. If `"1"`, add `impers-active` class to `<body>`, inject the banner HTML (from §2.1.1) as the first child of `<body>`, populate the four text slots from `localStorage`, and inject the End-session confirmation modal as a sibling of the banner. |
| Click on `.impers-end-btn` (the End-session button in the banner) | `openEndImpersonation()` — adds `.open` to the End-session modal backdrop, focuses the Cancel button (matches `.btn:focus-visible` ring per `*:focus-visible` line 490). |
| Click on Cancel inside the End-session modal | Removes `.open` from the modal backdrop. Banner stays. |
| Click on Confirm ("End session & return") inside the End-session modal | Clears all six `gharsetu_impers_*` localStorage keys, removes the banner element + the End-session modal element + `impers-active` body class, then `window.location.assign('../admin/dashboard.html')`. |
| Escape key while End-session modal is open | Same as Cancel. |

### 2.5 End-session flow — confirmation modal

The End-session modal block (injected by `impersonation.js`, never lives in source HTML):

| Element | Tokens / class | Copy |
|---|---|---|
| Title `<h3>` | `.charcoal Poppins 600 20 px` | "End impersonation session?" |
| Body `<p class="muted">` | slate 14 px | "You'll return to your Admin dashboard. The audit log already shows every action you took as **Raj Singh** acting on behalf of **Sunita Arora**." |
| Confirmation row | flex right-aligned | `<button class="btn btn-secondary">Cancel</button>` + `<button class="btn btn-danger">End session & return</button>` |

Confirm uses `.btn-danger` (`#C62828` / status-overdue, line 97) because the action is irreversible (state-changing) and matches the existing prototype convention (`prototype/pm/leases.html` and similar files use `.btn-danger` for terminate / void actions).

### 2.6 Edge cases the prototype must handle

| Edge case | Resolution |
|---|---|
| User reloads a page mid-impersonation | localStorage survives reload → banner re-injects on the next `DOMContentLoaded`. No flicker because the injection runs before the page is fully painted (or fast enough that it doesn't matter — fixed-position banner appearing slightly late doesn't break layout because the `impers-active` body class sets the offsets only when present). |
| User opens a non-included page (Public, Super Admin) while impersonating | The banner does not render on those pages (no script include). Returning to an included page re-shows the banner because localStorage still holds the flag. This is the prototype's accepted behavior — production would either redirect impersonators away from Public pages or refuse Super Admin pages entirely. Test TC-IMPERS-019 verifies this. |
| User clears localStorage in DevTools | Banner disappears on next reload. No persistent state on the server (this is the prototype). Production: server invalidates the impersonation token on logout / end-session. |
| User hits browser Back to `admin/users.html` after starting impersonation | Banner stays visible (Admin pages include the script); the Admin sees the banner over their own users list, which is a confusing state but visually correct — the banner says "Acting as Sunita, recorded as you" and the page is the Admin's own. End-session clears it. (Real product would refuse to render Admin chrome while impersonating; out of scope for the prototype.) |
| Two impersonation sessions started in quick succession (Admin clicks Impersonate on Sunita, then immediately Back, then Impersonate on Manoj) | Last write wins — localStorage is overwritten. Banner shows Manoj. No history of the Sunita session on the client (audit log on the server is canonical). Acceptable. |

### 2.7 Files to touch — prototype only

| File | Change |
|---|---|
| `prototype/admin/users.html` | Add per-row Impersonate link (6 rows: 2 PM + 2 Maintenance + 2 Tenant) · add `data-target-*` attributes on each Impersonate link · add `<div class="modal-backdrop" id="startImpersonationModal">…</div>` block · add inline JS handler that reads the data-attrs, populates the modal, and on Start-session writes localStorage + redirects · add `<script src="../assets/impersonation.js"></script>` next to the existing `validation.js` include |
| `prototype/assets/impersonation.js` (new file) | The full JS contract from §2.4 — banner injection, End-session modal injection, localStorage read/write, body-class toggling, Escape handler |
| `prototype/assets/styles.css` | Append new CSS rules (no token changes) for: `.impers-banner` + `.impers-banner-inner` + `.impers-banner-text` + `.impers-banner-line1` + `.impers-banner-line2` + `.impers-banner-icon` + `.impers-banner-you-pill` + `.impers-end-btn` (and hover/focus variants) + `body.impers-active .sidebar` (offset override) + `body.impers-active .app-main` (padding-top override) + responsive `@media (max-width: 1023px)` rules for stacked text on mobile |
| 9 PM pages, 3 Maintenance pages, 4 Tenant pages, 7 Admin pages (23 files total — 27 minus the 4 excluded Public pages, minus 0 Super Admin since none are touched) | Each gets a single new line: `<script src="../assets/impersonation.js"></script>` placed right after the existing `<script src="../assets/validation.js"></script>` include (typically the second-to-last line before `</body>`). No HTML body changes. |

**Out of scope for this planning file**: any change to `apps/api`, `apps/web`, `feature_list.json`, SRS, Test_Cases.md, agent-team-change-logs/, prototype-changes.md, CHANGELOG, or any non-prototype file. ENG-F02 backend (impersonation token, server-side NR-7 enforcement, audit_log integration) ships separately.

### 2.8 Rule check — Working rules / Technical conventions / Scope rules from CLAUDE.md

| Rule | Check |
|---|---|
| Working rule 9 — prototype kept in sync with the live app | This **is** the prototype-first delivery; ENG-F02 backend will mirror it. Row to be added to `docs/planning/prototype-changes.md` on ship. |
| Working rule 11 — file size caps | This file is the planning doc, not CLAUDE.md / AGENTS.md — no cap applies. |
| Scope rule A — the 23 BLs are sacrosanct | No BL touched. Impersonation is a new feature governed by NR-7 (Solution Overview v8), not by any of BL-01..BL-23. |
| Scope rule C — no DELETE endpoints | Not applicable (prototype-only); ENG-F02 backend will use `POST /impersonations/end` to invalidate, not DELETE. |
| Scope rule G — wire-stable numeric smallint enums | Not applicable on the prototype; ENG-F02 will reserve enum codes for impersonation event types in audit_log. |
| Scope rule I — prototype is the design contract | This planning file is **explicitly token-only**. Every value verifies against `prototype/assets/styles.css` (lines cited inline above). |
| Scope rule J — DD/MM/YYYY · ₹ · Asia/Kolkata · en-IN | No dates or currency on the banner; user names only. Locale rule not exercised. |
| Scope rule K — no SMS, no file uploads, no payments, no 2FA | None invoked. |

No rule violated. No new design tokens introduced (white-on-saffron focus ring is a derived inversion of existing tokens, justified inline in §2.1.2).

## 3. Test cases (designed up front)

Twenty-eight test cases, namespaced TC-IMPERS-NNN. Promoted into `docs/testing/v1/Test_Cases.md` when the feature ships. Priority: **H** = release-blocking, **M** = should-fix, **L** = nice-to-have.

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-IMPERS-001 | Impersonate link present on every PM row | Admin signed in, on `prototype/admin/users.html` | Inspect each row where Role = "Property Manager" | Each PM row's actions cell contains "Impersonate" link to the right of "Edit" separated by a middot | H |
| TC-IMPERS-002 | Impersonate link present on every Maintenance row | as above | Inspect rows where Role = "Maintenance" | Each Maintenance row shows Edit · Impersonate | H |
| TC-IMPERS-003 | Impersonate link present on every Tenant row | as above | Inspect rows where Role = "Tenant" | Each Tenant row (including co-tenants) shows Edit · Impersonate | H |
| TC-IMPERS-004 | Impersonate link absent on Admin (peer) rows | as above | Inspect every row where Role = "Admin" that is NOT the current user | Action cell shows Edit only, no Impersonate. NR-7 boundary "no peer impersonation" enforced by absence. | H |
| TC-IMPERS-005 | Impersonate link absent on the Admin's own row | as above (current user = Raj Singh, first row) | Inspect the Raj Singh row | Action cell shows Edit only — no Impersonate on the user's own row | H |
| TC-IMPERS-006 | Super Admin does not appear in Admin's user list at all | as above | Search the entire `tbody` for any row with Role = "Super Admin" | Zero matches. NR-7 boundary "Super Admin cannot be impersonated" enforced by absence from the list. | H |
| TC-IMPERS-007 | Start-impersonation modal opens with correct target metadata | as above | Click Impersonate on Sunita Arora's row | Modal opens. Title reads "Start impersonation session?". Body contains "Sunita Arora", "Property Manager", "Green Valley". Audit notice contains "Raj Singh". | H |
| TC-IMPERS-008 | Start-impersonation modal cancel returns to users page | Modal open | Click Cancel | Modal closes, no localStorage written, page remains on `users.html` | H |
| TC-IMPERS-009 | Start session redirects to PM dashboard | Modal open for Sunita Arora | Click Start session | Page navigates to `prototype/pm/dashboard.html`. localStorage `gharsetu_impersonating` = "1", target name = "Sunita Arora", target role = "Property Manager", target dashboard = `pm/dashboard.html`. | H |
| TC-IMPERS-010 | Banner renders at top of PM dashboard during session | TC-IMPERS-009 complete | Inspect `pm/dashboard.html` | Saffron banner fixed at top, height 48 px (desktop) / 64 px (mobile). Line 1 says "Acting as **Sunita Arora** (Property Manager, Green Valley)". Line 2 says "All actions recorded as **Raj Singh**" with white "YOU" pill. | H |
| TC-IMPERS-011 | Banner persists across PM navigation | On `pm/dashboard.html` with banner visible | Click sidebar Leases · Tenants · Rent · Maintenance · Profile in turn | Banner stays visible on every PM page. localStorage values unchanged. | H |
| TC-IMPERS-012 | Banner renders on Maintenance dashboard | Start impersonation as Raju Kumar (Maintenance) from users.html | Land on `maintenance/dashboard.html` | Banner visible with "Acting as **Raju Kumar** (Maintenance)" / "All actions recorded as **Raj Singh**" | H |
| TC-IMPERS-013 | Banner renders on Tenant dashboard | Start impersonation as Raj Sharma (Tenant) | Land on `tenant/dashboard.html` | Banner visible with target = Raj Sharma, scope = "Unit 3A, Green Valley" | H |
| TC-IMPERS-014 | Banner pushes sidebar down (no overlap) | Impersonation active on any page ≥ 1024 px | Inspect computed styles | `.sidebar` has `top: 48px` and `height: calc(100vh - 48px)`. Sidebar brand link visible just below banner with no clipping. | H |
| TC-IMPERS-015 | Banner pushes main content down (no overlap) | as above | Inspect computed styles on `.app-main` | `padding-top` ≥ 80 px (32 px base + 48 px banner). Page title not clipped. | H |
| TC-IMPERS-016 | "YOU" pill visible next to Admin name | Banner visible on any included page | Locate the "YOU" pill on banner line 2 | White-background saffron-text pill, 999 px radius, Poppins 600 12 px UPPERCASE. Renders to the right of "Raj Singh". | H |
| TC-IMPERS-017 | End-session button visible and labelled | Banner visible | Inspect the right side of the banner | Button reads "End session", white border + transparent background, Poppins 600 15 px, 6 px radius (inherits `.btn`). | H |
| TC-IMPERS-018 | End-session opens confirmation modal | Banner visible | Click End-session button | Modal opens with title "End impersonation session?", body explaining return to Admin dashboard, Cancel + "End session & return" (saffron danger button) actions. | H |
| TC-IMPERS-019 | End-session modal Confirm clears state and returns to Admin | End-session modal open | Click "End session & return" | All 6 `gharsetu_impers_*` localStorage keys deleted. Banner element removed from DOM. `impers-active` body class removed. Page navigates to `prototype/admin/dashboard.html`. | H |
| TC-IMPERS-020 | End-session modal Cancel leaves session intact | End-session modal open | Click Cancel | Modal closes. Banner still visible. localStorage unchanged. | M |
| TC-IMPERS-021 | Escape key closes End-session modal | End-session modal open, focus inside modal | Press Escape | Modal closes (same as Cancel). Banner intact. | M |
| TC-IMPERS-022 | Banner does NOT render on Super Admin pages | localStorage flag set, navigate to `prototype/super-admin/dashboard.html` directly | Inspect the page | Banner element not present in DOM. Confirms Super Admin pages exclude `impersonation.js`. | H |
| TC-IMPERS-023 | Banner does NOT render on Public auth pages | localStorage flag set, navigate to `prototype/login.html` | Inspect the page | Banner element not present in DOM. Auth pages exclude `impersonation.js`. | M |
| TC-IMPERS-024 | Page reload preserves banner | Banner visible on `pm/dashboard.html` | Reload the page (Cmd-R) | Banner re-renders on next paint with all four text slots populated from localStorage. No flicker > 200 ms. | H |
| TC-IMPERS-025 | Accessibility — banner has `role="status"` and `aria-live="polite"` | Banner visible | Inspect the banner element | `role="status"` present. `aria-live="polite"` present. Banner content is read by VoiceOver / NVDA when activated. | H |
| TC-IMPERS-026 | Accessibility — End-session button reachable by keyboard | Banner visible | Tab from the top of the page | End-session button is in the natural tab order (early — banner is the first body child). Focus ring renders as `2px solid #fff` (inverted to be visible on saffron). | H |
| TC-IMPERS-027 | Responsive — banner renders correctly at 5 widths | Banner visible | Test at viewport widths 360 px, 480 px, 768 px, 1024 px, 1440 px | At 360 / 480: two stacked text lines, banner height = 64 px, padding 12 × 16. At 768 / 1024 / 1440: text inline on one row (line 1 + line 2 side by side or stacked), banner height = 48 px, padding 12 × 24. End-session button never clipped. | H |
| TC-IMPERS-028 | Locale — all banner copy in American English, no rupee / no date | Banner visible | Read banner text on all 23 included pages | Spelling: "Organization", "behavior" (not "behaviour"). No rupee symbol. No date. Names are passed through verbatim from localStorage (no formatting). | M |

## 4. Sign-off

Pre-implementation questions for the user. Defaults proposed inline so work can proceed without blocking (Auto Mode policy):

| # | Question | Proposed default |
|---|---|---|
| 1 | Should the start-impersonation modal include a "Reason" textarea (free text, e.g. "Tenant called about Unit 3A rent issue")? Backend will eventually write this to audit_log. | **Default: no Reason textarea on the prototype.** Reasons can be added when ENG-F02 backend ships. Including it now risks designing the field twice. |
| 2 | Should ending an impersonation session always return to `admin/dashboard.html`, or should it return to wherever the Admin was when they clicked Impersonate (i.e. `admin/users.html`)? | **Default: always `admin/dashboard.html`** — matches the user's brief verbatim ("return to your Admin dashboard"). If users.html is wanted, change the redirect target in `impersonation.js` end-session handler in one place. |
| 3 | Should the "YOU" pill on banner line 2 be a "YOU" label or the Admin's actual user-id last 4 chars (e.g. "U-0012")? | **Default: "YOU" word.** Brief asks for a "small 'you' label or similar". A literal "YOU" is the simplest cue and doesn't require resolving a user-id format that doesn't exist on the prototype. |
| 4 | Should the End-session modal Confirm button be `.btn-danger` (red, irreversible action) or `.btn-primary` (saffron, normal CTA)? | **Default: `.btn-danger`** — matches existing prototype convention for state-changing actions (lease termination, account deactivation). |
| 5 | Should `impersonation.js` log a console message when the session starts / ends to help dev-time debugging? | **Default: no console output.** Matches the silent behavior of `validation.js`. |

## 5. Execution log

_(Empty until prototype HTML/JS/CSS work is dispatched in a follow-up session.)_

| Date | Milestone | Agent | Notes |
|---|---|---|---|
| 2026-05-26 | Planning file created | gharsetu-lead | All 9 sections drafted. Tests designed up front (28 cases). Token verification complete. |
| 2026-05-26 | Implemented | gharsetu-frontend | prototype/assets/impersonation.js created; prototype/assets/styles.css extended; admin/users.html updated (Impersonate links + start-session modal); super-admin/organization-detail.html updated (Impersonate Admin button + start-session modal); impersonation.js <script> include added to 30 role-scoped pages (12 admin, 10 pm, 3 maintenance, 5 tenant). Storage: sessionStorage key gharsetu_impersonation. Banner: amber/warning palette (bg-partial #FFF8E1, color-status-partial #F57F17). |

## 6. Files changed

_(Empty until work ships. Mirror of §2.7 once executed.)_

| File | Change | Touched by |
|---|---|---|
| _pending_ | — | — |

## 7. Agents used

| Agent | Task | Status |
|---|---|---|
| gharsetu-lead | Initial planning + delegation + integration | proposed |
| gharsetu-frontend | (Future) Prototype HTML/CSS/JS implementation per §2.7 | not_started |
| gharsetu-tester | (Future) Execute TC-IMPERS-001..028 against the prototype | not_started |
| gharsetu-backend | (Future, ENG-F02) Impersonation token + audit_log integration — not part of this planning file | not_started |
| gharsetu-security | (Future, ENG-F02) NR-7 boundary VAPT — not part of this planning file | not_started |

## 8. Post-deploy

_(Empty — stays open indefinitely per FEATURE_PLANNING §Lifecycle.)_

## 9. Cross-references

- `Solution_Overview.docx` v8 §New Features → "Users & Access — Admin Impersonation" row + §New Roles + §Business Rules NR-7
- `UIUX_Design_Document.docx` §6 Components → "Impersonation banner" entry · §3 Layout Foundations · §4 IA · §7 Components · §8 Interaction Patterns · §9 Accessibility
- `prototype/admin/users.html` — host page for the start-impersonation flow
- `prototype/pm/dashboard.html`, `prototype/maintenance/dashboard.html`, `prototype/tenant/dashboard.html` — first landings after starting impersonation
- `prototype/assets/styles.css` — token source of truth; every value cited inline with line numbers in §2.1.2
- `prototype/assets/validation.js` — pattern for the new `prototype/assets/impersonation.js`
- `docs/planning/FEATURE_PLANNING.md` — template + lifecycle this file follows
- Sibling planning files (cross-reference for related v8 work): `2026-05-26-super-admin-pages.md`, `2026-05-26-admin-module-additions.md`, `2026-05-26-visitor-management.md`
- `feature_list.json` — ENG-F02 row (Admin Impersonation backend) will reference this planning file when picked up
- `docs/testing/v1/Test_Cases.md` — TC-IMPERS-001..028 promoted on ship
- `docs/planning/prototype-changes.md` — row added on ship (one row covering `prototype/admin/users.html` + the 23-file `<script>` include + new `impersonation.js` + appended `styles.css` rules)
