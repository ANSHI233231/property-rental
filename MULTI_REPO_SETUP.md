# Multi-repo setup — playbook

A reusable guide for splitting a multi-app project (web + api + worker
+ mobile + …) across **one main repo + N sub-repos** using git
submodules. Self-contained: pick it up on any new project that fits the
shape.

The example throughout uses 4 apps under `apps/<name>` and 1 main repo,
matching the JyotishAI layout, but the steps generalise to any number
of apps and any folder layout.

---

## When this pattern fits

Use this pattern when **all** of the following are true:

- Each app is independently deployable (its own host, its own pipeline,
  its own access controls).
- Different teams or different external collaborators may need access
  to one app but not the others.
- You still want a single point-of-clone for new contributors who are
  setting up the whole stack locally.
- You can tolerate the small extra friction of submodule commands.

Do **NOT** use it when:

- Cross-app refactors are frequent (renaming a shared API endpoint
  touches 3 apps in one PR — submodules force 3 separate PRs and a
  pointer bump).
- All apps deploy as one unit (just stay in a monorepo).
- Your team is unfamiliar with git submodules and the project is
  small (a single repo with sub-folders is simpler).

---

## Topology

```
github.com/<org>/<project>                    ← main / meta repo
├── apps/web        →  github.com/<org>/<project>-web    (submodule)
├── apps/api        →  github.com/<org>/<project>-api    (submodule)
├── packages/       (optional shared libs in the main repo)
├── docs/
├── docker-compose.yml
├── pnpm-workspace.yaml      (if using pnpm workspace at root)
├── turbo.json               (if using Turborepo at root)
└── .gitmodules              (declares the 4 submodules above)
```

The main repo holds:

- Meta files: `README.md`, `DEPLOYMENT.md`, infra (`docker-compose.yml`)
- Workspace config: `package.json`, `pnpm-workspace.yaml`,
  `turbo.json`, root `tsconfig.base.json`
- Optional shared packages under `packages/*`
- Submodule pointers (one gitlink entry per app)

The main repo does **not** hold any of the apps' source. Source lives
inside each sub-repo and is checked out into `apps/<name>` when the
submodule is initialised.

---

## Greenfield — 5 fresh repos from day 1

### 0. Decide on naming

Pick one convention and stick with it. Two common choices:

- **Product-prefixed**: `<project>` (main), `<project>-web`,
  `<project>-api`, …
- **Type-suffixed**: `<project>` (main), `<project>` (web is the
  flagship), `api.<project>`, … *(harder to scan; avoid)*

Use the same prefix or suffix everywhere.

### 1. Create empty repos on GitHub

```bash
gh auth status
for name in <project> <project>-web <project>-api <project>-worker <project>-mobile; do
  gh repo create <org>/$name --private --description "<project> — $name"
done
```

Do **not** let GitHub seed a README, license, or `.gitignore` — we
want bare repos so the first push lands cleanly.

### 2. Initialise each sub-repo locally and push

For each app folder (or empty scaffold):

```bash
mkdir -p apps/web && cd apps/web
# ... create scaffold ...
git init -b main
echo "node_modules/\n.env\n.next/\ndist/\n.turbo/" > .gitignore
git add .
git commit -m "feat: initial scaffold"
git remote add origin https://github.com/<org>/<project>-web.git
git push -u origin main
cd ../..
```

Repeat for `api`, `worker`, `mobile`.

### 3. Initialise the main repo + add submodules

```bash
cd <project-root>
git init -b main

# Each app folder must be EMPTY before `git submodule add` clones into
# it. If you already created the apps in step 2 inside this folder,
# move them aside first (see brownfield section below).

git submodule add https://github.com/<org>/<project>-web.git    apps/web
git submodule add https://github.com/<org>/<project>-api.git    apps/api

git add .gitmodules apps package.json pnpm-workspace.yaml turbo.json \
        docker-compose.yml README.md
git commit -m "chore: initialise meta repo with submodules"
git remote add origin https://github.com/<org>/<project>.git
git push -u origin main
```

---

## Brownfield — splitting an existing monorepo

This is the path to take when you already have a single git repo with
all apps as sub-folders, and you want to break each app into its own
repo without losing the working tree on disk.

### Phase A — wipe all `.git` directories

Pick one branch on the existing monorepo as the source of truth, push
it, then wipe local git state. **History is lost.** Preserve history
only if a sub-app's history is genuinely valuable; in that case, use
`git filter-repo --subdirectory-filter apps/<name>` per app instead of
the wipe.

```bash
cd <project-root>
find . -type d -name .git -not -path "./node_modules/*" -not -path "*/.venv/*"
# review the list, then wipe:
rm -rf .git apps/*/.git .gitmodules
```

### Phase B — create the 5 new GitHub repos

Same as Greenfield step 1.

### Phase C — push each app folder as a sub-repo

For each app, run from inside the app folder:

```bash
cd apps/web
git init -b main
ls .gitignore                # make sure node_modules / .env / build dirs excluded
git add .
git status                   # eyeball — no secrets, no node_modules
git commit -m "feat: initial scaffold"
git remote add origin https://github.com/<org>/<project>-web.git
git push -u origin main
cd ../..
```

Repeat for the others. They're independent — order doesn't matter.

### Phase D — wire submodules in the main repo

Submodules require an empty target path. Each `apps/<name>` folder is
non-empty (it's the working tree). The safe pattern is **move-aside →
submodule add → diff → drop the backup**:

```bash
cd <project-root>
git init -b main
mkdir -p /tmp/repo-backup

for name in web api worker mobile; do
  mv apps/$name /tmp/repo-backup/$name
  git submodule add https://github.com/<org>/<project>-$name.git apps/$name

  # Sanity: cloned content should equal the backup, modulo gitignored artefacts
  diff -rq /tmp/repo-backup/$name apps/$name \
    --exclude=.git --exclude=node_modules --exclude=.next --exclude=.venv \
    --exclude=dist --exclude=.turbo --exclude=.expo --exclude=__pycache__

  rm -rf /tmp/repo-backup/$name
done

rmdir /tmp/repo-backup
```

If `diff -rq` reports differences in committed source files, **stop**.
Usually means a `.gitignore` rule excluded a file that should have
been committed; fix the rule, amend the sub-repo's first commit,
push-force, then redo the move-aside.

### Phase E — first commit + push of the main repo

```bash
cd <project-root>
git add .gitmodules apps/* \
        package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json \
        docker-compose.yml README.md DEPLOYMENT.md docs packages
git status      # apps/<name> entries should appear as gitlinks (1 line each)
git commit -m "chore: initialise meta repo with submodules"
git remote add origin https://github.com/<org>/<project>.git
git push -u origin main
```

`git status` is the key check. If `apps/web` shows as an untracked
folder full of files, the move-aside step was skipped — undo and redo.

### Phase F — verify with a fresh recursive clone

```bash
cd /tmp
git clone --recurse-submodules https://github.com/<org>/<project>.git verify
cd verify
git submodule status         # should list 4 submodules pinned to commits
ls apps/web apps/api apps/worker apps/mobile
pnpm install                 # workspace must resolve symlinks across submodules
```

After verifying, delete the temp clone.

### Phase G — restore local dev artefacts

The move-aside step in Phase D dropped local `node_modules`, `.env`,
`.next`, `.venv`, build outputs. Restore them on the original working
copy:

```bash
cd <project-root>
pnpm install                          # root workspace
cp apps/api/.env.example apps/api/.env             # then fill in
cp apps/web/.env.example apps/web/.env.local       # then fill in
cd apps/<python-app> && python3 -m venv .venv && \
  source .venv/bin/activate && pip install -e .
```

---

## Day-2 workflows

### Edit a single app

Treat the sub-repo as a normal repo:

```bash
cd apps/web
git checkout -b feat/<thing>
# … edit, commit, push
git push -u origin feat/<thing>
# open PR on github.com/<org>/<project>-web
```

After the PR merges into `main` of the sub-repo, the meta repo's
pointer is **still on the old commit**. Bump it:

```bash
cd <project-root>
git submodule update --remote apps/web
git add apps/web
git commit -m "chore: bump web to <short-sha>"
git push
```

### Pull latest everywhere

After someone else bumped pointers in the meta repo:

```bash
cd <project-root>
git pull --recurse-submodules
git submodule update --init --recursive
```

### Edit two apps in one logical change

Submodules force two PRs (one per app) plus a third bump-PR on the
meta repo. Pre-coordinate the merge order so the API change merges
first, then the web change that depends on it, then the meta bump.

### Add a new app

```bash
gh repo create <org>/<project>-<newapp> --private
cd apps/<newapp>
git init -b main
# … scaffold + first commit + push (Greenfield step 2)
cd <project-root>
git submodule add https://github.com/<org>/<project>-<newapp>.git apps/<newapp>
git commit -m "chore: add <newapp> submodule"
git push
```

### Remove an app

```bash
cd <project-root>
git submodule deinit -f apps/<oldapp>
git rm -f apps/<oldapp>
rm -rf .git/modules/apps/<oldapp>
git commit -m "chore: drop <oldapp> submodule"
git push
# Optionally archive the sub-repo on GitHub.
```

---

## Pitfalls and how to avoid them

1. **Forgetting `--recurse-submodules` on clone**
   Result: empty `apps/*` folders. Fix: `git submodule update --init
   --recursive`. Mitigation: add it to the README's first command.

2. **Pushed secrets**
   The first commit on each sub-repo will be public-history-permanent.
   Audit `git status` and `git diff --cached --name-only | grep -E
   '\.env$|node_modules|\.venv'` before the first commit. If you push
   a secret: rotate it, then `git filter-repo` to scrub history.

3. **Build artefacts leak in**
   Common offenders: `.turbo/`, `tsconfig.tsbuildinfo`, `.next/`,
   `dist/`, `coverage/`, `.expo/`, `.venv/`, `__pycache__/`,
   `*.egg-info/`. Each app's `.gitignore` must cover its own stack;
   the root `.gitignore` does not propagate into submodules.

4. **`git submodule add` fails with "already exists"**
   The target path is non-empty. Use the move-aside pattern from
   Phase D.

5. **Detached HEAD inside a submodule**
   After `git submodule update`, the sub-repo is on a detached HEAD at
   the pinned commit. To work in it: `cd apps/<name> && git checkout
   main`.

6. **Pointer drift**
   Meta repo `apps/web` is pinned to commit `abc123`, but on disk you
   pulled `def456` after editing in the sub-repo. `git status` at the
   meta layer shows `modified: apps/web (new commits)`. Either commit
   the bump (`git add apps/web && git commit`) or revert the sub-repo
   (`git submodule update apps/web`).

7. **CI building the wrong commit**
   Each sub-repo's CI builds whatever's on its `main`. The meta repo
   should NOT trigger app builds (it has no app source). Production
   deploys from the sub-repo, not the meta. Keep that boundary clear.

8. **Workspace lockfile conflicts after the split**
   If you keep `pnpm-workspace.yaml` at the meta layer, the lockfile
   lives there. Each sub-repo has no lockfile of its own. Production
   builds that clone only the sub-repo (without the meta) need either
   their own lockfile (run `pnpm install` once inside the sub-repo and
   commit `pnpm-lock.yaml`), or the deploy must clone the meta repo
   recursively. Pick one and document it.

9. **`https://` vs `git@` URLs**
   Mixing causes auth failures on CI. Use one scheme consistently in
   `.gitmodules`. HTTPS works with cached credentials and PATs;
   SSH works with deploy keys.

---

## File checklist

After Phase F you should have:

```
<project-root>/
├── .git/                       (main repo)
├── .gitmodules                 (4 submodule entries)
├── .gitignore                  (covers node_modules, .turbo, .env, .DS_Store, IDE configs)
├── README.md                   (mentions --recurse-submodules in the clone instructions)
├── DEPLOYMENT.md               (uses the new sub-repo URLs)
├── package.json                (workspace root)
├── pnpm-workspace.yaml
├── turbo.json
├── docker-compose.yml
├── packages/                   (shared libs, optional)
├── docs/
└── apps/
    ├── web/.git                (sub-repo)
    ├── api/.git                (sub-repo)
```

`find . -type d -name .git -not -path '*/node_modules/*' -not -path
'*/.venv/*'` should print exactly 5 entries.

---

## Verification checklist

- [ ] `find . -type d -name .git` lists exactly the meta repo + N
      sub-repo `.git` folders (plus anything inside `node_modules/`).
- [ ] `git -C apps/<name> remote -v` shows the sub-repo URL for every
      app.
- [ ] `git remote -v` at root shows the meta repo URL.
- [ ] All N+1 GitHub repos have one commit on `main`.
- [ ] Fresh `git clone --recurse-submodules` of the meta repo
      produces a working tree that the package manager / build tool
      accepts at the root.
- [ ] Each app's `.gitignore` prevents `.env`, `node_modules`, build
      outputs from leaking on the next commit.
- [ ] No app's first commit contains a secret. (`git log -p
      apps/<name> | grep -iE 'API[_ ]?KEY|password|secret'`)
