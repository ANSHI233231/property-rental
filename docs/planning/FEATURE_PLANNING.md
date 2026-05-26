# Feature Planning — Process and Template

Every new feature or significant modification gets a dedicated planning file before any code is written. The file is the **single timeline** for that feature: the verbatim requirement, the plan, the test cases, the execution log, and any post-deploy issues with their fixes.

This file documents the process. The actual feature files live under `docs/planning/features/`.

---

## File location

```
docs/planning/features/<YYYY-MM-DD>-<short-slug>.md
```

Example: `docs/planning/features/2026-06-12-per-room-leasing.md`

The date is the day the feature was proposed (when the planning file was created), not the ship date.

---

## Lifecycle

```
proposed → in-progress → shipped
```

`shipped` is **terminal** — there is no separate `stable` flip, no closure ceremony. Once all of these are in place, status becomes `shipped` and the file becomes a historical record:

- SRS row added (or modified)
- Test cases promoted into `docs/testing/v1/Test_Cases.md`
- `product/CHANGELOG` bullet
- (Where relevant) `docs/planning/prototype-changes.md` row

Post-deploy issues continue to be logged in §6 of the planning file even after the status is `shipped` — the file stays open indefinitely as the timeline for that feature.

---

## Required sections (template)

Copy the block below verbatim when creating a new planning file:

```markdown
# <Feature title>

| Field | Value |
|---|---|
| Status         | proposed / in-progress / shipped |
| Started        | YYYY-MM-DD |
| Shipped        | YYYY-MM-DD (or — if not yet) |
| SRS row        | v2.X |
| Test cases     | TC-XX-NN..NN |
| Prototype todo | row # in prototype-changes.md (or — if not relevant) |

## 1. Requirement (as given)
> Verbatim quote of what the user / client said. No paraphrasing.

## 2. Plan
Rule-by-rule analysis against the Working rules + Technical conventions
+ Scope rules in CLAUDE.md. Files to touch (apps/api, apps/web,
prototype/, packages/shared). Security / performance considerations.
Open questions for the user (with proposed defaults).

## 3. Test cases (designed up front)
Defined here BEFORE coding, so the feature is testable from day one
and tests are crafted alongside the design. Use the same shape as
`docs/testing/v1/Test_Cases.md`:

| TC-ID    | Title | Pre-condition | Steps | Expected Result | Priority |
|----------|-------|---------------|-------|-----------------|----------|
| TC-XX-NN | ...   | ...           | ...   | ...             | H / M / L |

Cover at minimum:
- Happy path
- Every forbidden role (403 expected)
- Every validation failure mode
- Every error / edge condition surfaced in §2's plan

When the feature ships, copy these rows verbatim into
`docs/testing/v1/Test_Cases.md` under the appropriate module and tick
the cross-reference in §7.

## 4. Sign-off
Pre-implementation questions + the user's answers. Dated entries.

## 5. Execution log
Dated entries on each meaningful milestone — commits, live verifications,
typecheck passes, agent dispatches. Each test case from §3 gets a
`PASS` / `FAIL` row here as it's verified live.

## 6. Files changed
Running ledger of every file the feature touched. One row per file at
minimum (group repeated touches under the same row if useful).

| File | Change | Touched by |
|------|--------|------------|
| apps/api/src/leases/leases.service.ts          | new method `terminate()` + per-co-tenant approval flow | gharsetu-backend |
| apps/api/prisma/schema.prisma                  | added `LeaseTermination` + `LeaseTerminationApproval` models | gharsetu-backend |
| apps/api/prisma/migrations/2026MMDD_...        | new migration                                              | gharsetu-backend |
| apps/web/src/components/pm/TerminationDrawer.tsx | new drawer UI                                            | gharsetu-frontend |
| docs/testing/v1/Test_Cases.md                  | promoted §3 rows on ship                                   | gharsetu-tester |

## 7. Agents used
One row per agent + task. Status reflects whether that agent's
deliverable was accepted by `gharsetu-lead` per Worker ≠ Checker —
not whether the agent finished work.

| Agent | Task | Status |
|-------|------|--------|
| gharsetu-lead     | Initial planning + delegation + integration                  | ✅ accepted |
| gharsetu-backend  | API + Prisma + business-rule enforcement                     | ✅ accepted |
| gharsetu-frontend | Termination drawer + tenant consent UI                       | ✅ accepted |
| gharsetu-tester   | TC-LEASE-007..012 execution                                  | ✅ accepted |
| gharsetu-security | VAPT on the /leases/terminate-* surface                      | ✅ accepted |

## 8. Post-deploy
Issues surfaced after going live + their diagnosis + the fix. Multiple
dated entries OK. Stays open indefinitely — there's no formal close.

## 9. Cross-references
- SRS §14 row vN.M
- TEST_CASES TC-XX-NN..NN (promoted from §3 on ship)
- prototype-changes.md row #
- product/CHANGELOG bullet
- Production deploy notes (if any non-standard steps needed)
```

---

## Reactivation discipline

When starting **any** backend or frontend work, OR when a user reports a bug, **grep the planning folder first**:

```
grep -l "<keyword>" docs/planning/features/*.md
```

If a related file exists:

1. **Read it for design context BEFORE coding.** The plan, sign-off, and execution log capture decisions the next agent must respect.
2. **Append new post-deploy issues to §6 of the existing file** rather than fixing silently.
3. **Never create a new planning file for the same feature** — extend the existing one.

The file is the single timeline for the feature even across many sessions. Without this discipline, context gets lost when the session ends and the next agent starts from scratch.

---

## Who creates the planning file

- For features triggered by a user request: **`gharsetu-lead`** creates the file at proposal time.
- For bugs / post-deploy issues on a shipped feature: whichever agent is handling the work appends to §6 of the existing file.
- For a brand-new bug whose feature has no planning file (i.e. a v1 feature that pre-dates this process): no need to backfill — record the issue in the relevant module's bug list or open a new planning file if the fix is large enough to warrant one.

---

## What this is NOT

- Not a Jira / Trello replacement. The planning file is the **technical** timeline, not the project-management ticket.
- Not a closure ceremony. There is no review meeting required to flip from `in-progress` to `shipped`; the four criteria above (SRS / test cases / changelog / prototype row) are the closure conditions.
- Not optional. If you're starting code for something that doesn't have a planning file, stop and create one.
