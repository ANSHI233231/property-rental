# TODO — Rename `pm` → `manager` (cascading impacts)

**Created:** 10/05/2026
**Trigger:** [SRS §11.4](../SRS_Document.md#114-conventions-adopted-from-the-api-spec) locks the role enum as `MANAGER` (uppercase). Agent prompts ([gharsetu-backend.md](../.claude/agents/gharsetu-backend.md), [gharsetu-frontend.md](../.claude/agents/gharsetu-frontend.md), [gharsetu-lead.md](../.claude/agents/gharsetu-lead.md)) have been cleaned to use `MANAGER` consistently. The Next.js URL route was decided as `/manager/` (full lowercase role name, matching `/admin/`, `/maintenance/`, `/tenant/`).

The static prototype still uses `prototype/pm/` as the folder name and the in-page links still reference `pm/`. This TODO tracks the cascading rename.

---

## Tasks

| # | TODO | Affected files / paths |
|---|---|---|
| **T1** | Rename `prototype/pm/` folder to `prototype/manager/` | 6 files inside the folder: `dashboard.html`, `tenants.html`, `leases.html`, `rent-collection.html`, `maintenance.html`, `profile.html` |
| **T2** | Update all `href="pm/...` and `href="../pm/..."` references to `manager/` / `../manager/` | [`prototype/index.html`](../prototype/index.html) (role landing card), [`prototype/login.html`](../prototype/login.html) (demo role button), and any cross-links from admin/maintenance/tenant pages |
| **T3** | Update [`SRS_Document.md` §3 page map](../SRS_Document.md#3-pages--navigation-map) | All `prototype/pm/*.html` paths → `prototype/manager/*.html` |
| **T4** | Update [`Test_Cases.md`](../Test_Cases.md) | Any test case that cites `pm/` file paths or URL routes |
| **T5** | Update [`AGENTS.md`](../AGENTS.md) | Any workflow example or invocation example referencing `pm/` |
| **T6** | Update [`CLAUDE.md`](../CLAUDE.md) | Quick scan for any `pm/` references |
| **T7** | Update [`document/GharSetu_Model_API_Spec.md`](../document/GharSetu_Model_API_Spec.md) | Probably none (the spec uses `MANAGER` enum, not URL paths) — worth a grep to confirm |
| **T8** | Optional: align backend NestJS module naming | `apps/api/src/` (when it exists). Current suggested layout uses `users/` (not `pm/`), so likely no impact, but worth a final review during Phase 1. |

---

## Recommended execution order (when ready)

1. **Rename folder first:** `git mv prototype/pm prototype/manager`
2. **Run a single sed sweep across docs:**
   ```bash
   grep -rl "prototype/pm/\|\bpm/dashboard\|\bpm/tenants\|\bpm/leases\|\bpm/rent-collection\|\bpm/maintenance\|\bpm/profile" \
     prototype/ SRS_Document.md Test_Cases.md AGENTS.md CLAUDE.md document/ \
     | xargs sed -i 's|prototype/pm/|prototype/manager/|g; s|"pm/|"manager/|g; s|\.\./pm/|../manager/|g'
   ```
3. **Verify with the audit:**
   ```bash
   grep -rn '\bpm/' prototype/ SRS_Document.md Test_Cases.md AGENTS.md CLAUDE.md
   ```
   Expected: **(clean)**, except this TODO file itself which mentions `pm/` historically.
4. **Open every page in a browser** and click through navigation to confirm no broken links.
5. **Re-run [`Test_Cases.md`](../Test_Cases.md) §11 (Navigation & Linking) tests** — TC-NAV-001 through TC-NAV-010.
6. **Delete this TODO file** once T1–T7 are confirmed done. T8 stays open until backend Phase 1.

---

## Why this is deferred (not done now)

Renaming the prototype mid-stream while the project is in active spec-reconciliation creates churn for tests, documentation, and any open work. Bundling all the `pm` → `manager` updates into a single atomic change after the team is ready avoids cross-cutting confusion.

## Out-of-scope for this TODO

- Renaming any database column, API field, or backend identifier — those already use `MANAGER` (or `manager_id` for FK columns) per the API spec. No change needed.
- The `PM` abbreviation in any **historical** content (e.g. an old PR description, archived docs) — leave alone.
