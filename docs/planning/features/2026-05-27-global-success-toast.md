# Global Success Toast (top-right notifications) — all forms

| Field | Value |
|---|---|
| Status         | proposed |
| Started        | 2026-05-27 |
| Shipped        | — |
| SRS row        | (n/a — prototype UX; app-port carry-over in §6) |
| Test cases     | TC-TOAST-001..012 (§5) |

## 1. Requirement (as given)

> "after every form submission we need a alert kind of in top-right, a notice after success. plan it for all forms."

A consistent **top-right toast notification** shown after a successful form submission, across every form in the prototype — replacing the scattered `alert()` / inline-banner patterns with one shared component.

## 2. Design

### 2.1 Component — `assets/toast.js` + CSS in `assets/styles.css`

- **Container**: a single fixed region, top-right (`position:fixed; top:16px; right:16px; z-index:200`), `role="region" aria-label="Notifications"`, holding a vertical stack of toasts (newest on top). Auto-created on first use (no per-page markup).
- **Toast**: white card, 12px radius, soft shadow, a **colored left bar (4px)** + small status icon, message text, and a `×` dismiss button (`aria-label="Dismiss"`). Slides in from the right; auto-dismisses after **4s**; **pauses on hover/focus**; dismissable anytime.
- **Variants** (compose existing tokens in `styles.css`): `success` → `--color-status-paid` (green ✓, default), `info` → `--color-royal-blue`, `error` → `--color-status-overdue`. Primary use is `success`.
- **API**:
  ```js
  gsToast('Property created.');                       // success (default)
  gsToast('Could not save — try again.', 'error');    // or { type, timeout }
  ```
- **Single source**: lives in `assets/toast.js`, loaded on every page (like `validation.js`). CSS lives in `styles.css` so all pages get it.

### 2.2 Accessibility
- Container is `aria-live="polite"` for success/info, `assertive` for error → screen-reader announces the message (replaces the per-page `announce()` live-region role).
- `@media (prefers-reduced-motion: reduce)`: no slide transform — fade/appear only; auto-dismiss still applies.
- Dismiss button ≥ 24px hit area inside a ≥44px toast; toasts never trap focus (non-modal).
- Contrast: text is `--color-charcoal` on white (13.4:1); the colored bar/icon is decorative + backed by the text.

### 2.3 Behaviour rules
- Default timeout 4s; `error` toasts persist until dismissed (no auto-timeout).
- Max 4 visible; older ones drop off the bottom.
- Toast is **non-blocking** (unlike `alert()`), so flows continue.

## 3. Inventory & mapping (what "all forms" means)

Counts from grep on 2026-05-27: **49 `alert()` across 22 files**, `showSuccess()` in 1 file, `announce()` in 12 master pages, terminal success screens in 4 pages.

| Source pattern | Files | Action |
|---|---|---|
| **`showSuccess(msg)` banner** | `admin/property-detail.html` | Re-point `showSuccess` to call `gsToast(msg)` — one edit covers reassign-PM, create-lease, add/edit unit, retire. |
| **Genuine success `alert('…')`** (e.g. "Property created.", "Profile updated.", "Password changed successfully.", "Marked as Resolved.", "Termination recorded.", "Request closed.", "Priority updated.", "Technician reassigned.", "Organization approved/deactivated/reactivated.") | across admin / pm / tenant / maintenance / super-admin | Replace `alert('…')` → `gsToast('…')`. |
| **Master `announce(msg)`** (add / edit / deactivate / reactivate on the 8 master pages + others) | 12 files | Route the success announcement to `gsToast(msg)` (keep the SR behaviour via the toast's `aria-live`). |
| **Terminal public success screens** (signup `success-card`, contact `contactSuccess`) | `organization-signup.html`, `contact.html` | **Keep** the full-page success state — it IS the confirmation. (Optional: also fire a toast; default = keep card only.) |
| **Placeholder `alert('… form opened.')` / "Export started…" stubs** | several | **Do NOT convert** — these are stubs for unbuilt forms, not submissions. They become real forms (then real toasts) during the app port. Listed in §3.1. |

### 3.1 Placeholders to leave as-is (not submissions)
"Edit property form opened.", "Edit contact form opened.", "Add co-tenant form opened.", "Renewal form opened.", "Deposit refund form opened.", "Export started…/Exporting…", "Lease agreement PDF would download…", "All 12 users — expand view…". These open a flow or are not-yet-built — out of scope for the success toast.

## 4. Implementation steps
1. Build `assets/toast.js` (container + `gsToast`) and append toast CSS to `assets/styles.css`.
2. Add `<script src="…/assets/toast.js"></script>` to every in-app page (correct `../` depth). Public pages too (contact uses its own card but loads it for consistency).
3. `admin/property-detail.html`: `showSuccess()` body → `gsToast(msg)`.
4. Replace the **genuine-success** `alert('…')` calls (curated list, not the §3.1 placeholders) with `gsToast('…')`.
5. Master pages: route success `announce(msg)` → `gsToast(msg)` (and drop the now-redundant hidden live-region, or keep it harmlessly).
6. Verify: JS parses on every touched page; tag balance unchanged; a toast appears top-right and auto-dismisses; reduced-motion path fades.

## 5. Test cases
| TC | Title | Expected |
|---|---|---|
| TC-TOAST-001 | Toast appears top-right on success | After a success action, a toast slides in at top-right |
| TC-TOAST-002 | Auto-dismiss | Success toast disappears after ~4s |
| TC-TOAST-003 | Manual dismiss | `×` removes it immediately |
| TC-TOAST-004 | Pause on hover | Hovering pauses the auto-dismiss timer |
| TC-TOAST-005 | Stacking | Multiple toasts stack; max 4 visible |
| TC-TOAST-006 | Success variant | Green bar + ✓ icon |
| TC-TOAST-007 | Error variant persists | `error` toast stays until dismissed |
| TC-TOAST-008 | a11y live region | Message announced via `aria-live`; reduced-motion fades, no slide |
| TC-TOAST-009 | property-detail flows | reassign / create-lease / add-unit / edit-unit / retire all toast |
| TC-TOAST-010 | master add/deactivate | toast on add / edit / deactivate / reactivate |
| TC-TOAST-011 | genuine success alerts converted | none of the converted ones use `alert()` |
| TC-TOAST-012 | placeholders untouched | "… form opened." stubs still behave as before |

## 6. App-port carry-over
- Toast becomes a React provider/hook (e.g. a `useToast()` over a `<Toaster/>`), fired from mutation `onSuccess`. Same tokens → `tailwind.config.ts`.
- Success copy stays server-truthful (e.g. "Payment recorded", "Lease created"). Errors surface API messages via the `error` variant.

## 7. Open decisions
| # | Decision | Default |
|---|---|---|
| OD-1 | Convert signup/contact terminal success screens to toast too? | **No** — keep the dedicated success screens; toast is for in-app form actions. |
| OD-2 | Replace `alert()` placeholders for unbuilt forms? | **No** — leave until those forms are built (§3.1). |
| OD-3 | Auto-dismiss timeout | **4s** (errors persist). |

## 8. Cross-references
- `assets/validation.js` — sibling shared behaviour module; toast loads the same way.
- `assets/styles.css` — status tokens (paid/overdue/royal-blue) reused for variants.
- `admin/property-detail.html` `showSuccess()` — first integration point.
