# Server Logs — Super Admin diagnostics page

| Field | Value |
|---|---|
| Status         | proposed |
| Started        | 2026-05-27 |
| Shipped        | — |
| SRS row        | (new — to add at app-port time under Super Admin / Diagnostics) |
| Test cases     | TC-SLOG-001..NNN |
| Prototype todo | row pending |

---

## 1. Requirement (as given)

> "in super admin new page needed with menu — Server Logs"
> "in the server logs we will show the logs of backend that will be saved into files day wise"
> "so in api apps/logs folder and show all files of it"
> "give two option view log and show logs file detail into an popup"
> "give one more button on each row download log — that will be download the logs"

---

## 2. Plan

### 2.0 Rules check (CLAUDE.md)

- Working rule §2 — planning file authored before code.
- Working rule §9 — prototype-only; `prototype-changes.md` row to add on ship.
- Scope rule **I** — every value sourced from `prototype/assets/styles.css`. No new tokens needed.
- This is a Super Admin / platform-only diagnostic surface — Admin / PM / Tenant / Maintenance never see Server Logs.

### 2.1 Backend mapping (carry-over for app port)

- Daily log file convention: `apps/api/logs/api-YYYY-MM-DD.log` (Pino → file transport with daily rotation).
- File contents: newline-delimited JSON (one log record per line — Pino default), e.g.:
  ```
  {"level":30,"time":1748345400000,"pid":12345,"hostname":"api-prod-01","reqId":"req-001","msg":"POST /api/v1/auth/login 200 124ms","userId":7}
  ```
- The Super Admin Server Logs page is the only UI surface that reads this folder. It does so via a Super-Admin-only API endpoint (to add at app-port time) that:
  - `GET /api/v1/platform/logs` — lists files with name, day, size, line-count, mtime.
  - `GET /api/v1/platform/logs/:filename/view?limit=N` — returns the first N lines (or last N, depending on flag) parsed into a pretty-print structure for the modal.
  - `GET /api/v1/platform/logs/:filename/download` — streams the raw file as `Content-Type: text/plain; Content-Disposition: attachment`.
- Authz: hard-locked to `role === SUPER_ADMIN`. Even Admin users cannot reach these endpoints.
- Audit: every view + every download writes an audit-log row at the platform scope (`actor_role=SUPER_ADMIN`, `action=VIEW_SERVER_LOG` / `DOWNLOAD_SERVER_LOG`, `resource_type=LOG_FILE`, `resource_id=filename`).
- Retention: 90 days default (configurable in `apps/api` settings). Older files are pruned by a daily job — same scheduler that owns rent/maintenance crons.

### 2.2 Prototype scope (this iteration)

A new file `prototype/super-admin/server-logs.html` with:

1. **Sidebar nav** — Super Admin chrome with Server Logs marked active.
2. **Header** — `<h1>Server Logs</h1>` + `+ Refresh` button (mocked — alerts "Log list refreshed").
3. **Filter strip** — Search by filename + Date range select (Last 7 days / Last 30 days / All). Mocked — non-functional in prototype.
4. **Log files table** — 10 rows of mocked log files, one per day. Columns:
   - **File name** — `api-2026-05-27.log` style
   - **Date** — `27/05/2026` (DD/MM/YYYY)
   - **Size** — `1.2 MB` / `843 KB` style
   - **Lines** — mock line count (e.g., `12,484`)
   - **Last modified** — `27/05/2026 23:59 IST` style
   - **Actions** — two buttons per row: `View` (opens popup) · `Download` (triggers a Blob download of mock content)
5. **View log modal** — when "View" is clicked:
   - Title: `api-2026-05-27.log · 27/05/2026`
   - Sub-meta: `1.2 MB · 12,484 lines · level distribution: 9,840 INFO · 1,820 DEBUG · 624 WARN · 200 ERROR`
   - Scrollable code block showing the first ~30 mock log entries pretty-printed (`[timestamp] [LEVEL] [reqId] message`)
   - Bottom row: `Download full file` button + `Close` button
6. **Download** — uses `Blob` + a temporary `<a download>` link to trigger a real download with mock log content (~30 JSON lines). The file is named per the row's filename.
7. **Mobile** — Super Admin's 4-tab tabbar is unchanged; Server Logs is reached via the sidebar drawer.

### 2.3 Super Admin sidebar/nav update

Add the Server Logs entry to the sidebar **after Master Data**, separated by a divider:

```
Dashboard
Organizations
─── divider ───
Plans
Master Data ▾
  Cities · States · Payment Methods
─── divider ───
Server Logs
```

Files to touch (9 super-admin files):
- `prototype/super-admin/dashboard.html`
- `prototype/super-admin/organizations.html`
- `prototype/super-admin/organization-detail.html`
- `prototype/super-admin/plans.html`
- `prototype/super-admin/profile.html`
- `prototype/super-admin/master-data.html`
- `prototype/super-admin/master-data/cities.html`
- `prototype/super-admin/master-data/states.html`
- `prototype/super-admin/master-data/payment-methods.html`

Each gets the new `<a href="server-logs.html" class="sidebar-link">…</a>` entry after the Master Data section, preceded by a `<div class="sidebar-divider"></div>`. On `server-logs.html` itself, the link carries `.active`.

The 4-tab mobile tabbar (Dashboard · Orgs · Plans · Account) is unchanged — Server Logs is a less-frequent diagnostic surface and lives in the drawer.

### 2.4 Open decisions

| Question | Default |
|---|---|
| Place Server Logs after Master Data with divider? | Yes |
| Mobile tabbar — replace one of the 4 tabs with Server Logs? | No (keep 4-tab; sidebar drawer is fine) |
| File-name convention | `api-YYYY-MM-DD.log` |
| View modal — first N lines or last N? | First 30 (prototype simplification; production should default to last N — that's the live tail) |
| Download — real Blob or alert mock? | Real Blob (more credible UX even in prototype) |

---

## 3. Test cases (designed up front)

| TC-ID | Title | Pre | Steps | Expected | Priority |
|---|---|---|---|---|---|
| TC-SLOG-001 | Page renders for Super Admin | Logged-in Super Admin | Visit `/super-admin/server-logs.html` | Page title "Server Logs", 10 mock rows | H |
| TC-SLOG-002 | Page absent from non-Super-Admin nav | Logged-in Admin/PM/Tenant/Maintenance | Open sidebar | No Server Logs link present | H |
| TC-SLOG-003 | Direct URL from non-Super-Admin | Logged-in Admin | Visit the URL | Production: 403. Prototype: file is in `super-admin/` so structurally inaccessible from admin URLs. | H |
| TC-SLOG-004 | View modal opens | Click "View" on a row | Modal opens with file name + meta + log lines | H |
| TC-SLOG-005 | View modal close — backdrop click | Modal open | Click backdrop | Modal closes | M |
| TC-SLOG-006 | View modal close — Escape key | Modal open | Press Escape | Modal closes | M |
| TC-SLOG-007 | Download triggers browser file save | Click "Download" on a row | A `.log` file with the row's filename downloads | H |
| TC-SLOG-008 | Downloaded content is the mock log lines | Open the downloaded file | Plain text, one JSON line per record | M |
| TC-SLOG-009 | Sidebar active state | On `/super-admin/server-logs.html` | Inspect sidebar | Server Logs row has saffron border-left + white text | M |
| TC-SLOG-010 | Refresh button | Click "+ Refresh" | Alerts "Log list refreshed" (mocked) | L |
| TC-SLOG-011 | Mobile drawer reachable | <1024px, Super Admin | Open hamburger | Server Logs link visible in drawer below Master Data | M |
| TC-SLOG-012 | Account menu / sheet present | Server Logs page | Open account menu | Aayush · Super Admin · AK + My Profile + Sign out | M |
| TC-SLOG-013 | Responsive at 5 widths | 320/480/768/1024/1440 | Visit page | Table scrolls horizontally on narrow widths · sidebar drawer on mobile · no broken layout | M |
| TC-SLOG-014 | Locale | Visit page | Inspect dates | All dates DD/MM/YYYY with IST suffix | M |
| TC-SLOG-015 | Audit log carry-over | App port — `VIEW_SERVER_LOG` / `DOWNLOAD_SERVER_LOG` rows present in audit table when actions fire | (Documented for the port; not testable in prototype) | M |

---

## 4. Sign-off

| Date | Question | Default | User answer |
|---|---|---|---|
| 2026-05-27 | Sidebar placement | After Master Data with divider | Default applied |
| 2026-05-27 | Mobile tabbar — Server Logs slot? | No (drawer-only) | Default applied |
| 2026-05-27 | View modal — first 30 lines | First 30 lines (prototype) | Default applied |
| 2026-05-27 | Download — real Blob or alert? | Real Blob (better UX even in prototype) | Default applied |

---

## 5. Execution log

| Date | Event |
|---|---|
| 2026-05-27 | Planning file authored (BEFORE code, per Working rule §2). Executing now. |
| 2026-05-27 | Implemented: created `prototype/super-admin/server-logs.html` (10 mock log files going back from 27/05/2026; 6-column table File · Date · Size · Lines · Last modified · Actions; per-row View and Download buttons; pretty-printed dark-theme log viewer modal with JetBrains Mono font + colored levels INFO/DEBUG/WARN/ERROR + level distribution meta; real Blob download triggers a `.log` file with mock JSON-line content + line summary; Refresh button mocked; Search by filename + Date range filter (All / Last 7 / Last 30 days) wired). Added Server Logs sidebar entry (with divider before it) to all 9 Super Admin pages (dashboard, organizations, organization-detail, plans, profile, master-data + the 3 master-data sub-pages). Page itself has the sidebar entry marked `.active`. Documented app-port carry-over: `apps/api/logs/api-YYYY-MM-DD.log` file convention, Super-Admin-only `GET /api/v1/platform/logs[…]` endpoints, `VIEW_SERVER_LOG` / `DOWNLOAD_SERVER_LOG` audit actions, 90-day retention with daily prune job. |

---

## 6. Files changed

| File | Change | Touched by |
|---|---|---|
| `./../../../prototype/super-admin/server-logs.html` | NEW | orchestrator |
| `./../../../prototype/super-admin/dashboard.html` | Sidebar: add Server Logs entry after Master Data, behind a divider | orchestrator |
| `./../../../prototype/super-admin/organizations.html` | Same | orchestrator |
| `./../../../prototype/super-admin/organization-detail.html` | Same | orchestrator |
| `./../../../prototype/super-admin/plans.html` | Same | orchestrator |
| `./../../../prototype/super-admin/profile.html` | Same | orchestrator |
| `./../../../prototype/super-admin/master-data.html` | Same | orchestrator |
| `./../../../prototype/super-admin/master-data/cities.html` | Same (paths one-level-deep adjusted) | orchestrator |
| `./../../../prototype/super-admin/master-data/states.html` | Same | orchestrator |
| `./../../../prototype/super-admin/master-data/payment-methods.html` | Same | orchestrator |
| `./../prototype-changes.md` | Row pending — on ship | gharsetu-frontend |

App-port-time additions (NOT in this prototype iteration):
- `apps/api/src/platform/logs/logs.controller.ts` — GET endpoints behind Super-Admin guard
- `apps/api/src/platform/logs/logs.service.ts` — file-system reads scoped to `apps/api/logs/`
- `apps/api/src/platform/audit/audit.service.ts` — `VIEW_SERVER_LOG` + `DOWNLOAD_SERVER_LOG` actions
- `apps/web/src/app/(platform)/server-logs/page.tsx` — React page matching this prototype
- SRS row — new entry under Super Admin / Diagnostics

---

## 7. Agents used

| Agent | Task | Status |
|---|---|---|
| gharsetu-lead (orchestrator) | Planning + execution | accepted |

---

## 8. Post-deploy

_Empty — prototype only. Real log file pagination, search-within-file, and live-tail are out of scope for the prototype but should be considered in the app-port._

---

## 9. Cross-references

- `docs/planning/features/2026-05-26-super-admin-pages.md` — original Super Admin scope; this file adds Server Logs as a 6th surface.
- `docs/planning/features/2026-05-27-master-data-ownership-split.md` — sets the pattern for "Super Admin platform-utility" surfaces.
- `prototype/assets/styles.css` — token source.
- Future: SRS Super Admin section + Solution Overview Super Admin section need an entry for Server Logs in the next pass.
