# Admin Users page — overhaul (2026-05-27)

| Field | Value |
|---|---|
| Status         | shipped (prototype) |
| Started        | 2026-05-27 |
| Shipped        | 2026-05-27 |
| SRS row        | Module 1 (User & Role Management) — refine; §12.2 password reset |
| Prototype todo | row in `docs/planning/prototype-changes.md` |

## 1. Requirements (as given, this session)

A series of refinements to `prototype/admin/users.html`:
1. "in user edit form merge reset password and edit form together — no meaning to show them separately."
2. "in edit form email cannot be changed — disable it."
3. "show phone number — currently showing xxxxxxxx."
4. "no need to show the admin role user in the users list."
5. "user table should have an option to deactivate / activate a user with a confirmation modal."
6. "add status filter also."
7. "there is no meaning of the scope column in the users table in admin role." → remove it.
8. "in the tenant edit form keep only the password update option, change the Edit button name to Reset."
9. (recurring rule) no descriptive caption text after the table.

## 2. What shipped

- **Edit ⨉ Reset-password merged** into one `#editUserForm` with a single **Save changes** action. The standalone `#resetPasswordForm` is gone; the password field is now an **optional** "Reset password" inside the same form ("leave blank to keep current"). Helper notes preserved (shared privately, no email).
- **Email locked** — `disabled` input + "Email can't be changed." (Role/email immutable from this surface; role change is a separate audited action.)
- **Phones unmasked** — Admin scope sees full 10-digit numbers (consistent with the property-detail manager-contact decision). `98xxxxxx12` → `9876543212`.
- **Admin self-row removed** — the page never adds Admins (they come from org sign-up); the Admin manages their own account from My Profile. Comment left in place of the row.
- **Activate / Deactivate** per row — a destructive `.action-link.danger` "Deactivate" (or "Activate" when inactive) opens a **confirmation modal** (`#statusToggleModal`, role=dialog, focus to Cancel, Esc/backdrop close). Confirm flips the status badge (`badge-active` ⇄ `badge-closed` "Inactive"), the action label, hides/shows Impersonate (can't impersonate an inactive user), toasts, and refreshes the paginator (so the Status filter re-counts). Soft state — records kept.
- **Status filter tiles** — Active / Inactive added to the existing tile bar (single-dimension filter via `paginate.js` `data-status`). 3 seed rows ship Inactive (1 PM, 1 Maintenance, 1 Tenant) so the filter is demonstrable.
- **Scope column removed** — header + every row cell. Columns now: `# · Name · Role · Phone · Status · Actions`.
- **Role-aware Edit/Reset** — tenant rows' action reads **Reset**; `openEditUser()` collapses the modal to **password-only** for tenants (title "Reset password — Name", profile fields hidden, password required) and full edit for PM/Maintenance.
- **Specialization → multi-checkbox** (Add User) — see `2026-05-27-specializations-master.md`.
- **`#` serial column** — see `2026-05-27-listing-serial-numbers.md`.
- **Caption removed** — the "No public sign-up…" line after the table is gone (project rule: no helper caption text under titles/tables).

## 3. App-port carry-over
- `PATCH /users/:id` (Admin): name + phone editable; **email + role immutable** here. Optional password reset = same endpoint or a dedicated `POST /users/:id/reset-password` (Argon2id, audited, no email sent).
- Tenant accounts: only password reset is exposed to Admin (profile is lease-derived).
- **User status** = `active | inactive` (soft); deactivation revokes sessions, blocks login, keeps records; audited. Never DELETE (Scope rule C).
- Impersonation offered only for active, impersonable roles (NR-7).
- Phone visibility: Admin sees full; mask for lower-privilege viewers.

## 4. Files changed
| File | Change |
|------|--------|
| `prototype/admin/users.html` | all of §2 (markup + inline JS: `openEditUser`, `openStatusToggle`/`confirmStatusToggle`/`closeStatusToggle`, `saveEditUser`) |
| `prototype/assets/styles.css` | + `.action-link.danger` (destructive row action, overdue red) |
| `prototype/assets/paginate.js` | serial-number stamping (shared) |
| `prototype/assets/specializations.js` | NEW (shared master source) |

## 5. Verification
`tagcheck.py` clean; inline JS `node --check` OK; 0 masked phones; 27 serial cells; status tiles + 3 inactive rows present; Add-User specialization = checkbox list.
