---
name: document-generation
description: Complete knowledge package for `.docx` work on the Property Rental Management platform. Covers Rule 28 (JS source-of-truth, never hand-edit the binary), the `doc-assets/templates/` folder layout, shared design tokens (palette, typography, helpers), the `docx` npm package patterns, validation via python-docx round-trip, asset handling, the workflow for editing an existing generator vs authoring a new one, and the commit discipline (JS + .docx as a matched pair). Load this skill before touching any `.docx` under `docs/product/`.
---

# Document Generation Skill — Property Rental Management

> **Purpose of this skill.** Give any new developer's AI agent the
> complete mental model of the document-agent role on this project —
> the Rule 28 JS-source-of-truth discipline, the `docx` npm package
> patterns, the design system inside the generators, the validation
> workflow, and the commit discipline. Load it once; you should
> not need to onboard further.

## 1. When to load this skill

Any of these tasks:

- Updating any `.docx` file under `docs/product/`
- Adding a new `.docx` document to the platform
- Normalising design tokens across existing documents
- Adding a new section, table, or worked example to an existing document
- Fixing a layout / typo / formatting issue in any generated `.docx`
- Refactoring shared helpers in `_design.js` (when present) or splitting them out

If your task is pure frontend / UI / app code, load
`frontend-uiux` instead. If your task is backend / API / schema,
load `backend-data-api`.

## 2. Prerequisites — what to read first

| Read | Why |
|---|---|
| [`CONTEXT.md`](../../../CONTEXT.md) | 5-minute project orientation. §1 + §3 — the documents are part of the project's deliverables. |
| [`CLAUDE.md`](../../../CLAUDE.md) **Working Rules 27, 28, 30, 31** | Rule 28 is the workflow contract for `.docx` files. Rule 27 governs preservation discipline (don't restructure client-approved artefacts). Rules 30, 31 govern doc maintenance generally. |
| [`docs/planning/DOCUMENT_AGENT.md`](../../../docs/planning/DOCUMENT_AGENT.md) | The document-agent's full briefing: client profile, language rules, every existing document with its purpose + structure + design decisions. **Read this BEFORE editing any document.** |
| [`docs/product/Solution_Overview.docx`](../../../docs/product/Solution_Overview.docx) + [`docs/product/UI_UX_Design_Guidelines.docx`](../../../docs/product/UI_UX_Design_Guidelines.docx) | The two anchor documents whose visual style defines the project's document design vocabulary. Open them in Word/LibreOffice to internalise the look. |
| The corresponding generator under `doc-assets/templates/` | The JS source of truth. Always edit this, never the binary. |

## 3. Rule 28 in one paragraph

Every `.docx` under `docs/product/` is a **derived artefact**. The
source of truth is a JavaScript generator in
`doc-assets/templates/` using the
[`docx`](https://www.npmjs.com/package/docx) npm package. The
`.docx` is regenerated from the JS — never hand-edited via
python-docx surgical scripts, never edited via Word's track-changes,
never patched via XML surgery. The JS source is what `git diff`
shows as plain text; the `.docx` is opaque binary. Edit JS;
regenerate; validate; commit BOTH as a matched pair in the same
commit.

## 4. Folder layout

```
doc-assets/
├── README.md                              ─ how to run the generators
├── package.json                           ─ declares the `docx` npm dep
├── node_modules/                          ─ gitignored; `npm install` to populate
└── templates/
    ├── generate_solution_overview.js            ─ Solution_Overview generator (the original anchor)
    ├── generate_developers_field_guide.js ─ Developers_Field_Guide generator
    ├── generate_ui_ux_design_guidelines.js
    ├── generate_api_spec.js               ─ API_Database_Specification generator (~830 LoC)
    ├── generate_deployment_guide.js       ─ Deployment_Guide generator (owned by devops agent)
    ├── generate_manual_testing_guide.js
    ├── generate_manual_testing_setup.js
    ├── lifecycle.png                      ─ embedded image asset
    └── _design.js                         ─ (future) shared palette + helpers when 2+ generators share
```

The folder lives at the **project root**, not under `docs/`,
because the binary `.docx` files at `docs/product/` are **products**
of this folder, not siblings of it. Per Rule 30, never reference
absolute paths inside generators — use `path.resolve(__dirname, ...)`.

## 5. The workflow (when a `.docx` needs to change)

### 5.1 Standard edit (existing document)

```bash
# 1. Edit the JS source — paragraph indices, bullets, table rows,
#    all live as plain JS arrays
cd doc-assets
vim templates/generate_solution_overview.js     # or your editor of choice

# 2. Regenerate from inside doc-assets/
node templates/generate_solution_overview.js
# → writes docs/product/Solution_Overview.docx

# 3. Validate via python-docx round-trip
python3 -c "
from docx import Document
d = Document('docs/product/Solution_Overview.docx')
# Read your edited paragraph and assert the new text reads correctly
for i, p in enumerate(d.paragraphs[:80]):
    print(f'{i:3}  {p.text[:100]}')
"

# 4. Commit JS source + regenerated .docx in the SAME commit
git add doc-assets/templates/generate_solution_overview.js docs/product/Solution_Overview.docx
git commit -m "docs(solution): refresh §4 ... regenerated from JS source per Rule 28"
```

The python-docx validator (`/mnt/skills/public/docx/scripts/office/validate.py`)
that the original Anthropic skill used is sandbox-only — the
round-trip read is the local equivalent.

### 5.2 New document

1. Decide the purpose, audience, and a one-paragraph "what this is" — paste into top of file as a comment.
2. Create `doc-assets/templates/generate_<doc>.js`. Start by copying
   the closest existing generator (Solution_Overview if it's a
   client-facing prose doc; API spec if it's a structural reference
   doc; Deployment Guide if it's a runbook).
3. Decide if shared design tokens (palette + helpers) should move
   into `_design.js` (yes if this is the second generator using
   them; no for the first).
4. Author the content as JS arrays — see §6 for canonical patterns.
5. Regenerate, validate, commit as in §5.1.
6. Update `docs/product/README.md` and `docs/planning/DOCUMENT_AGENT.md`
   with the new document's purpose.

### 5.3 What you must NEVER do

- ❌ Hand-edit a `.docx` in `docs/product/` directly (python-docx surgical script, Word track-changes, manual binary patching). Hard restriction.
- ❌ Commit a `.docx` change without the matching JS source change in the same commit.
- ❌ Put `node_modules/` or `package-lock.json` from `doc-assets/` into git (`.gitignore` covers both).
- ❌ Reference absolute paths (`/Users/aayushsaini/...`) inside generators (Rule 30).
- ❌ Restructure or redesign a document the user has flagged as preservation-locked (Rule 27).

## 6. The `docx` npm package — canonical patterns

### 6.1 Document skeleton

```js
const path = require('path');
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
        Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } = require('docx');

// ───── Design tokens — palette + helpers ─────
const COLOR = {
  navy:   '16213E',   // anchor (Solution_Overview style)
  purple: '5B52D6',   // admin accent / left-bar accent
  blue:   '0EA5E9',   // PM accent / sub-section accent
  amber:  'F59E0B',
  red:    'DC2626',
  green:  '16A34A',
  grey50: 'F9FAFB',
  grey100:'F3F4F6',
  grey300:'D1D5DB',
  text:   '111827',
  textSec:'4B5563',
};

const para = (text, opts = {}) => new Paragraph({
  children: [new TextRun({ text, font: opts.font ?? 'Calibri', size: opts.size ?? 22, ...opts.run })],
  spacing: opts.spacing ?? { after: 120 },
});

const bullet = (text) => new Paragraph({
  text,
  bullet: { level: 0 },
  spacing: { after: 60 },
});

const headerCell = (text, opts = {}) => new TableCell({
  width: { size: opts.width ?? 2400, type: WidthType.DXA },
  shading: { fill: opts.fill ?? COLOR.navy },
  children: [new Paragraph({
    children: [new TextRun({ text, bold: true, color: 'FFFFFF', size: 20 })],
  })],
});

const bodyCell = (text, opts = {}) => new TableCell({
  width: { size: opts.width ?? 4000, type: WidthType.DXA },
  shading: opts.fill ? { fill: opts.fill } : undefined,
  children: [new Paragraph({
    children: [new TextRun({ text, size: 20 })],
  })],
});

// ───── Compose the document ─────
const doc = new Document({
  styles: {
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal',
        run: { font: 'Calibri', size: 80, bold: true, color: 'FFFFFF' },
        paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 1200, after: 240 } } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal',
        run: { font: 'Calibri', size: 32, bold: true, color: COLOR.navy },
        paragraph: { spacing: { before: 360, after: 180 } } },
      // ...Heading2, Heading3, Subtitle, etc.
    ],
  },
  numbering: { /* config for bulleted lists if you need custom dots */ },
  sections: [{
    properties: {},
    children: [
      // Cover page
      new Paragraph({ children: [], spacing: { before: 2400 } }),
      new Paragraph({ style: 'Title', children: [new TextRun('Document Title')] }),
      // Page break
      new Paragraph({ children: [new PageBreak()] }),
      // Body content
      new Paragraph({ style: 'Heading1', children: [new TextRun('1. Section')] }),
      para('Body paragraph text...'),
      bullet('First bullet point'),
      bullet('Second bullet point'),
    ],
  }],
});

// ───── Output ─────
const outPath = path.resolve(__dirname, '..', '..', 'docs', 'product', 'My_Document.docx');
Packer.toBuffer(doc).then(buf => fs.writeFileSync(outPath, buf));
```

### 6.2 Tables — the canonical helpers

`headerCell(text, { width, fill })` for column headers.
`bodyCell(text, { width, fill })` for normal cells.
`multiCell(paragraphArray, { width, fill })` when a cell has
multiple paragraphs or formatted runs.
`cellPara(text, runOpts)` returns just the Paragraph (use inside
`multiCell`).

```js
new Table({
  width: { size: 9360, type: WidthType.DXA },  // ≈ full-page-width at default margins
  rows: [
    new TableRow({
      tableHeader: true,
      children: [
        headerCell('Field', { width: 2400 }),
        headerCell('Type', { width: 1800 }),
        headerCell('Description', { width: 5160 }),
      ],
    }),
    new TableRow({
      children: [
        bodyCell('email', { width: 2400, fill: COLOR.grey50 }),
        bodyCell('string', { width: 1800 }),
        bodyCell('User email — max 128 chars', { width: 5160 }),
      ],
    }),
  ],
});
```

### 6.3 Bulleted lists with custom numbering

`numbering.config` on the `Document` lets you define list styles
(e.g. coloured bullets, indented sub-lists). The
`generate_solution_overview.js` setup is the canonical reference.

### 6.4 Images

```js
const fs = require('fs');
const path = require('path');

new Paragraph({
  children: [
    new ImageRun({
      data: fs.readFileSync(path.resolve(__dirname, 'lifecycle.png')),
      transformation: { width: 540, height: 360 },
    }),
  ],
  alignment: AlignmentType.CENTER,
});
```

Image assets live alongside the generator in
`doc-assets/templates/`. Always read via `path.resolve(__dirname,
'asset.png')` — never absolute paths.

To extract an embedded image from an existing `.docx` (for the
initial seed), `unzip` the docx and copy files out from
`word/media/`. Rename descriptively.

## 7. Shared design system

When two or more generators exist (Solution Overview + API Spec, say),
extract the shared palette + helpers into
`doc-assets/templates/_design.js` and `require()` it from each
generator. Different docs can have different visual flavours while
sharing common atoms.

Today's design vocabulary across documents:

| Document | Anchor colour | Typography | Page setup |
|---|---|---|---|
| `Solution_Overview.docx` | Navy `#16213E` cover, purple `#5B52D6` left-bar accent on H1s | Calibri throughout; body 11pt; cover 40pt bold white-on-navy | US Letter, default margins |
| `UI_UX_Design_Guidelines.docx` | Platform palette swatches (navy, purple, blue, all status colours) | Inter / Poppins for the swatches; Calibri for prose | US Letter |
| `API_Database_Specification.docx` | Navy section titles, purple left-bar on H1s, method-coloured endpoint headers (GET green, POST blue, PATCH amber, DELETE red) | Calibri body 11pt; cover 40pt bold white-on-navy | US Letter, status-code numerals colour-coded |
| `Deployment_Guide.docx` | Same anchor palette; runbook-style code blocks (dark-fill mono cells) | Calibri 11pt; code blocks in Consolas | US Letter |
| `Developers_Field_Guide.docx` | Same anchor palette | Calibri 11pt; tour-style with worked examples | US Letter |
| `Manual_Testing_Guide.docx` + `Manual_Testing_Setup.docx` | Same anchor palette; status colours next to swatches | Calibri 11pt | US Letter |

**Preservation discipline (Rule 27).** Solution_Overview.docx and
UI_UX_Design_Guidelines.docx are **client-approved** anchor
documents. Their structure and visual style are
preservation-locked. Do not restructure, redesign, or apply a
"modern direction" to them without explicit per-document
authorisation. The May-15 incident (SRS v2.123 rollback) cost a
full restore-from-snapshot cycle — see Rule 27's "Why this rule
exists" section.

## 8. Validation checklist (before committing)

```bash
# 1. Regenerate cleanly with no errors
cd doc-assets && node templates/generate_<doc>.js
echo "Exit: $?"

# 2. python-docx round-trip — open and read paragraphs
python3 -c "
from docx import Document
d = Document('../docs/product/<Doc>.docx')
print(f'Paragraphs: {len(d.paragraphs)}')
print(f'Tables: {len(d.tables)}')
print(f'Sections: {len(d.sections)}')
# Read the paragraphs around your edit
for i, p in enumerate(d.paragraphs[65:75]):
    print(f'  ¶{65+i}: {p.text[:120]}')
"

# 3. File size sanity — sudden 10× change is a smell
ls -l ../docs/product/<Doc>.docx

# 4. Visual inspection (recommended)
# Open the .docx in LibreOffice / Word; eyeball the page where you edited.
# Cover page intact, headings render at the right size, tables aligned,
# images present and sized correctly.
```

## 9. Worked examples (real shipped patterns)

### 9.1 Standard edit — refresh a paragraph

Reference: **Solution_Overview.docx** paragraph 68 (the May-15 hot-fix
that triggered Rule 28's existence).

1. Open `doc-assets/templates/generate_solution_overview.js`.
2. Find the `Paragraph(...)` at the right index — count from the top, accounting for cover-page paragraphs + page breaks + headings.
3. Edit the `TextRun` content.
4. Save → `node templates/generate_solution_overview.js`.
5. python-docx round-trip → confirm paragraph 68 reads as expected.
6. `git add` JS + .docx → commit pair.

### 9.2 Add a new section to an existing document

Reference: **Deployment_Guide.docx §6.2 + §6.3** (the submodule split addition).

1. Decide where the new section goes (numbering, TOC entry, downstream renumbering of any later sections).
2. Add the `h1('6.2 ...')` block, body paragraphs, caution boxes, code blocks in the generator's `children: [...]` array.
3. If you renumbered later sections, update their headings in the same edit.
4. Update the cover-page version badge (`v1.1 · 18 May 2026` → `v1.2 · 20 May 2026`).
5. Add a row to the §17 change history table inside the generator.
6. Regenerate → validate → commit JS + .docx pair.

### 9.3 Author a new document from scratch

Reference: **`generate_api_spec.js`** (~830 LoC, SRS v2.124).

1. Copy `generate_solution_overview.js` as the starting point.
2. Strip the body content, keep the cover-page + heading-style scaffolding.
3. Add component helpers specific to the new document
   (`endpointCard(spec)`, `codeBlock(text)`, `schemaTable(rows)`,
   `simpleTable(headers, rows, widths)` are the API-spec-specific atoms).
4. Author content section by section. Validate accuracy against
   the source (e.g. API spec validates DTO field rules against
   `class-validator` decorators in `backend/src/`).
5. Regenerate → python-docx round-trip → file-size check → visual
   inspection.
6. Commit JS + .docx pair + SRS row + CHANGELOG bullet + (if
   applicable) update `docs/product/README.md`.

## 10. Emergency hotfix exception

If the JS source is lost or broken and a `.docx` urgently needs a
one-line fix, a python-docx surgical edit is acceptable — but the
very next step is to back-port the change into the JS so source and
binary are aligned again. Log the deviation in `chat/YYYY-MM-DD.md`
under Rule 25 + add a §6 Post-deploy entry to the relevant planning
file.

The 2026-05-15 paragraph-68 fix on Solution_Overview was an
emergency hotfix that bypassed the JS — and it took a full Rule 28
introduction + JS-source restoration cycle to recover. Avoid it.

## 11. Anti-patterns (drawn from real incidents)

| Anti-pattern | Real incident | Fix |
|---|---|---|
| Hand-editing a `.docx` via python-docx surgical script | 2026-05-15 — paragraph 68 on Solution_Overview; the JS went out of sync with the binary | Rule 28 was created in response. Edit JS → regenerate → commit pair. |
| Committing `.docx` without the matching JS source change | The next regenerator silently reverts the fix | Stage both files together; use `git status` to verify. |
| Embedding absolute paths in the generator (`/Users/aayushsaini/...` or `/home/claude/...`) | Sandbox-only paths break on other machines | Use `path.resolve(__dirname, '..', '..', 'docs', 'product', 'X.docx')` (Rule 30) |
| Hardcoding the developer's name as "Prepared by" | Future devs see Aayush's name on their generated documents | Resolve from `git config user.name` (current: "Aayush"; canonical project owner: "Aayush Kumar"). Per the agent definition. |
| Restructuring a preservation-locked document without explicit per-document authorisation | 2026-05-15 — SRS v2.123 redesign of Solution Overview + UI_UX Design Guidelines was a full rollback | Ask the user which specific artefacts the new direction applies to (Rule 27). |
| Committing `doc-assets/node_modules/` or `doc-assets/package-lock.json` | Repo bloat + merge conflicts | Both gitignored; `git restore --staged` if staged accidentally (Rule 15) |
| Skipping the python-docx round-trip after regenerating | A subtle Table or PageBreak misconfig ships unnoticed | Always validate before commit — see §8 checklist |

## 12. Cross-references

| Topic | File |
|---|---|
| The document-agent itself | [`.claude/agents/document-agent.md`](../../agents/document-agent.md) |
| Working Rules cited above | [`CLAUDE.md`](../../../CLAUDE.md) — Rules 27, 28, 30 |
| Document-agent's briefing | [`docs/planning/DOCUMENT_AGENT.md`](../../../docs/planning/DOCUMENT_AGENT.md) |
| Solution_Overview generator (the anchor pattern) | `doc-assets/templates/generate_solution_overview.js` |
| API spec generator (most recently authored, ~830 LoC) | `doc-assets/templates/generate_api_spec.js` |
| Deployment Guide generator (owned by devops agent) | `doc-assets/templates/generate_deployment_guide.js` |
| `docx` npm package docs | [npmjs.com/package/docx](https://www.npmjs.com/package/docx) |
| Recent document planning files | [`docs/planning/features/`](../../../docs/planning/features/) — sorted by date |
