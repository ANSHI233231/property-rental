# Agent Team Change Log — Setup Prompt

> A self-contained prompt you can paste into Claude Code (or any LLM-orchestrated dev session) in a fresh project to install the same per-agent dated change-log convention.

---

## How to use

1. Copy everything from the `--- BEGIN PROMPT ---` line below into a new Claude Code conversation in the target project.
2. Replace `<PROJECT_NAME>` with the project's display name (e.g. `CMS`, `MyCoolApp`).
3. Run it. Claude will scaffold the directory, write the format sample, edit every agent file, and update the agents README.

---

--- BEGIN PROMPT ---

Install an agent-team change-log convention in this project so every specialist agent writes a dated, structured record of every task it completes. The goal: a durable audit trail of what each agent did, when, and what files were touched — without me having to remember to remind them.

**Project name:** `<PROJECT_NAME>`

## What I want

1. A directory `agent-team-change-logs/` at the repo root.
2. A `sample-log-format.md` file inside that directory documenting the exact format every entry should follow.
3. Every agent definition file under `.claude/agents/*.md` updated so its system prompt instructs the agent to append a task entry to `agent-team-change-logs/<that-agent's-name>-YYYY-MM-DD.md` at the end of every task it completes.
4. The shared agent-team README (typically `.claude/agents/README.md`) updated to list "Change log per task" as one of the conventions every agent follows.

## Step-by-step

### Step 1 — Scaffold the directory + sample format

If `agent-team-change-logs/` doesn't exist at the repo root, create it.

Write `agent-team-change-logs/sample-log-format.md` with exactly this content (preserve the formatting):

```markdown
# Agent Change Log

Agent: backend-agent
Project: project-x
Date: 2026-05-06

---

## Task 1 — API Refactor

- Status: ✅ Completed
- Started: 2026-05-06 09:10 IST
- Completed: 2026-05-06 09:42 IST
- Duration: 32m

### Changes
- Refactored auth middleware
- Removed duplicate token validation
- Added centralized error handling

### Files Changed
- src/middleware/auth.ts
- src/utils/jwt.ts
- src/routes/user.ts

### Notes
- Backward compatible
- No DB migration required

---

## Task 2 — Database Optimization

- Status: ⚠️ Partial
- Started: 2026-05-06 11:00 IST
- Completed: 2026-05-06 12:15 IST
- Duration: 1h 15m

### Changes
- Added indexes to user_sessions
- Improved query caching

### Pending
- Need production benchmark validation

### Files Changed
- prisma/schema.prisma
- src/db/session.ts

---

## Task 3 — Failed Deployment

- Status: ❌ Failed
- Started: 2026-05-06 14:20 IST
- Completed: 2026-05-06 14:35 IST
- Duration: 15m

### Issue
- CI failed due to TypeScript build errors

### Error Summary
- Missing type definitions in payment module

### Action Required
- frontend-agent must update shared types

---
```

### Step 2 — Bake the change-log instruction into every agent file

Find every Markdown file under `.claude/agents/` whose filename matches `*.md` AND is NOT `README.md`. For each one:

- The file has YAML frontmatter at the top with a `name:` field. That is the agent's canonical name (e.g. `nestjs-api-architect`, `qa-test-engineer`). Use that name as the file-prefix in the change-log path.
- The file's system-prompt body has a final closing bullet like `- **Stop and ask if unclear.** <agent-specific text>` at the very end of its `## Output style` (or equivalent closing) section.
- **Insert a new bullet immediately before that closing line.** The new bullet's text MUST be:

```
- **Change log:** end every task by appending a `## Task N — <name>` entry to `agent-team-change-logs/<AGENT-NAME>-YYYY-MM-DD.md`, matching the [sample format](../../agent-team-change-logs/sample-log-format.md). Required: Status (✅/⚠️/❌), Started, Completed, Duration (IST), Changes, Files Changed. Optional: Notes / Pending / Issue + Error Summary + Action Required. Create the file with the standard header (`Agent: <AGENT-NAME>` / `Project: <PROJECT_NAME>` / `Date: <today>`) if absent.
```

Replace `<AGENT-NAME>` with the agent's actual `name:` from its frontmatter. Replace `<PROJECT_NAME>` with this project's name. Leave `YYYY-MM-DD` and `<today>` and `<name>` as literal placeholders — the agent fills those in at runtime.

If the file doesn't have a `## Output style` section or a "Stop and ask if unclear" closing line, append the bullet at the very end of the file under a new `## Change log` section, with a one-line intro:

```
## Change log

- **Change log:** end every task by appending a `## Task N — <name>` entry to ... (same as above)
```

### Step 3 — Update the agents README

If `.claude/agents/README.md` exists and contains a section listing shared conventions (typically a numbered list under a heading like `## Conventions all agents follow` or `## Baseline Conventions`), append one new numbered item to that list:

```
N. **Change log per task.** Every agent appends a `## Task N — <name>` entry to `agent-team-change-logs/<agent>-YYYY-MM-DD.md` at the end of each task, matching the [sample format](../../agent-team-change-logs/sample-log-format.md): Status (✅/⚠️/❌), Started + Completed + Duration in IST, Changes (bulleted), Files Changed (paths), plus Notes / Pending / Issue + Error Summary + Action Required as applicable. The orchestrator does NOT need to remind agents — it's baked into each agent's definition under `## Output style`.
```

Where `N.` is the next sequential number after the last item.

If the README has no conventions section, skip this step and report it as a follow-up.

### Step 4 — Verify and report

After the edits, run a sanity check:

```bash
grep -l "Change log:" .claude/agents/*.md
```

Report:
- Number of agent files updated
- Whether the README convention bullet landed
- Path to the new `agent-team-change-logs/` directory
- Any agent file that didn't have a "Stop and ask" closing line and needed the fallback append

## What I don't want

- Don't write the change log content itself for any existing past work — the convention applies to future tasks only.
- Don't add a hook to `.claude/settings.json` — the instruction in each agent's system prompt is sufficient.
- Don't touch any other agent-file content beyond inserting the one new bullet.
- Don't pluralize the directory name, change the file-naming pattern, or alter the sample format's section headings — downstream tooling can pattern-match against these.

--- END PROMPT ---

---

## What "matching the sample format" means in practice

Each daily log file (`agent-team-change-logs/<agent>-2026-05-06.md`) starts with the standard header:

```markdown
# Agent Change Log

Agent: <agent-name>
Project: <project>
Date: 2026-05-06
```

Followed by one or more `## Task N — <name>` blocks. Each task block has:

- Three top-level metadata lines: `Status`, `Started`, `Completed`, `Duration`
- A `### Changes` bullet list (always)
- A `### Files Changed` bullet list of paths (always)
- Conditional sections:
  - `### Notes` — when ✅ Completed and there's something worth flagging
  - `### Pending` — when ⚠️ Partial, listing what's not yet done
  - `### Issue` + `### Error Summary` + `### Action Required` — when ❌ Failed

The sample at `sample-log-format.md` is the canonical reference. Downstream tools (analytics dashboards, release-note generators, on-call timeline reconstruction) pattern-match against these section names — keep them stable.

## Why this convention is worth installing

- **Cross-agent dependency tracking** — when agent A flags a follow-up for agent B, the log captures it explicitly under `Pending` or `Action Required` rather than getting lost in chat.
- **Time accounting** — IST-stamped Started/Completed/Duration triplets give you real engineering-hours data per agent per day.
- **Rollback context** — if a deploy goes sideways, the change log tells you which agents touched which files in which order. Faster forensics than `git blame` alone.
- **Onboarding** — new contributors reading `agent-team-change-logs/` get a chronological narrative of how the codebase evolved.
- **Failure pattern detection** — repeated ❌ Failed tasks against the same agent surface tooling/permission gaps before they become recurring problems.
