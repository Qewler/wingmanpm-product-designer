# WingmanPM Product Designer

Private `0.2.0-private.2` development build of a portable Agent Skill for
designing and shipping high-quality SaaS product interfaces.

Created by [Julius (@Qewler)](https://github.com/Qewler), creator of
[WingmanPM](https://wingman.pm).

## Status

- Private GitHub development build
- GitHub owner: [@Qewler](https://github.com/Qewler)
- Repository: [Qewler/wingmanpm-product-designer](https://github.com/Qewler/wingmanpm-product-designer)
- Private GitHub repository; no public release
- No npm publication
- Apache 2.0 license prepared for a later release

## Local commands

```bash
npm test
node ./bin/wingman-design.mjs --help
node ./bin/wingman-design.mjs install --agent all
node ./bin/wingman-design.mjs init --project /path/to/project
node ./bin/wingman-design.mjs upgrade --project /path/to/project
node ./bin/wingman-design.mjs commands
node ./bin/wingman-design.mjs explain "make this stunning"
node ./bin/wingman-design.mjs add data-table \
  --project /path/to/project --profile work --id customer-records
node ./bin/wingman-design.mjs check --project /path/to/project
node ./bin/wingman-design.mjs doctor --project /path/to/project
node ./bin/wingman-design.mjs uninstall --project /path/to/project
```

The skill is portable through the
[Agent Skills `SKILL.md` format](https://agentskills.io/specification). Project
initialization creates a framework-neutral design contract and, for the golden
Next.js stack, project-owned components plus Storybook.

## Design commands

Use one skill with an intent and optional target:

```text
# Codex
$wingmanpm-product-designer stunning billing settings

# Claude Code and Cursor
/wingmanpm-product-designer standout billing settings

# Direct level selection
$wingmanpm-product-designer beautiful settings --level refine
```

Professional and plain aliases are equal. Examples include `polish` /
`beautiful`, `standout` / `stunning`, `amplify` / `pimp`, `review` / `audit`,
and `data-table` / `table`. Run `wingman-design commands` for all 18 families
or `wingman-design explain <phrase> --json` for the exact resolved contract.

An explicit skill command acts directly. A free-form request such as “make it
beautiful,” “make this stunning,” or “pimp it up” does not guess how far to go.
After inspecting the product, the skill offers one choice:

- **Refine:** preserve the direction and repair execution.
- **Elevate:** refine it and add one useful product-specific signature moment.
- **Reimagine:** show three responsive coded directions before full work.

Free-form `beautiful` recommends Refine. `stunning` and `pimp it up` recommend
Elevate. Reviews stay read-only unless the user explicitly requests changes or
uses `--fix`.

## Data tables

Every table uses the smallest profile that matches the task:

- `static`: semantic comparison or report content without grid controls;
- `work`: operational data with density, column controls, pagination,
  expansion, selection, and bulk actions;
- `editable`: the work profile plus deliberate inline editing and recovery.

The generator preserves a capable existing grid. In React projects without
one, it creates a project-owned TanStack-based table kit. Other stacks receive
a table contract and semantic HTML/CSS reference. It never runs a package
install; it records the exact dependencies for the user or CI to install.

```bash
wingman-design add data-table \
  --project /path/to/project \
  --profile work \
  --id customer-records
```

Each generated table has a stable contract in `design-system/tables/`, plus
Storybook and browser-test evidence where the detected stack supports them.
Use `--dry-run` to inspect the plan without writing files.

## Ownership and safety

`init` does not overwrite existing product documents, components, stories, or
instructions. It adds marked instruction blocks and records generated files in
`.wingmanpm-design/manifest.json`.

`upgrade` moves an initialized v1 project to the v2 contract. It refreshes only
unchanged managed runtime files, migrates configuration, inventories discovered
tables, and preserves project-owned work. It is safe to repeat and supports
`--dry-run`. Table scaffolding remains a separate, explicit command.

Use `--mode preserve` for an established product. It records legacy findings in
`.wingmanpm-design/baseline.json`, keeps them visible as a count, and blocks new
occurrences. This prevents a first install from treating old debt as new work.

The manifest classifies files as:

- `managed`: generated runtime, compiled outputs, configuration, and adapters;
- `seeded`: project-owned components, stories, and test references;
- `user`: product truth, design decisions, surfaces, and token source;
- `observed`: baselines and review evidence.

Project uninstall removes unchanged managed files and marked pointer blocks.
It preserves user, seeded, observed, and locally changed files. Global skill
uninstall uses content hashes and refuses to replace or delete changed files.

## Quality gate

`wingman-design check` blocks deterministic contract, token, accessibility,
keyboard, state, theme, motion, responsive, vocabulary, card-wall, AI, and
visual-evidence failures. Performance findings warn.

Table enforcement adds:

- `WPD018`: the table declaration or contract is missing or invalid;
- `WPD019`: Storybook, browser, or visual-review evidence is missing or stale;
- `WPD020`: reorder, resize, full-value, or grid behavior lacks an accessible
  alternative.

Three global rules apply to generated code, UI copy, documents, stories,
templates, and handoff text:

- `WPD021`: the forbidden long dash or a render equivalent is present;
- `WPD022`: a surface repeats heading structure, shell landmarks, or dialog
  close controls;
- `WPD023`: a dropdown lacks executable light and dark contrast and behavior
  evidence.

The checker does not pretend to measure beauty with source-code patterns.
Subjective quality is proven by browser evidence and review; the hook enforces
that the evidence exists and is current.

Visual evidence is pending after initialization. After a real browser review,
record it explicitly:

```bash
wingman-design check --project /path/to/project \
  --record-review --reviewer "Reviewer name" \
  --confirm keyboard,zoom200,reducedMotion,longContent,light,dark,axe,responsiveStates,structureUnique,dropdownContrast
```

The source-linked rule registry is searchable:

```bash
wingman-design search reduced motion
```

## Share safety

This release stays private. The npm package uses an explicit allowlist, so
local evaluations, fixtures, screenshots, and tests are not included in a
future package archive. Before sharing a repository copy, run:

```bash
npm run check:share
```

The check rejects absolute home and temporary paths, secret-shaped values,
tracked environment or OS files, PNG metadata, generated build directories,
unexpected Git remotes, a non-private package, and local data left in Git
history.

Public GitHub visibility and npm publication remain blocked until the complete
behavioral benchmark passes in Codex, Claude Code, and Cursor against both the
neutral fixture and the private preservation fixture. See
[`docs/release-roadmap.md`](docs/release-roadmap.md).

## Repository map

- `SKILL.md`: portable Agent Skill router.
- `references/`: focused product, system, motion, QA, and marketing guidance.
- `registry/`: original command and source-linked rule registries.
- `schemas/`: command, project, review, exception, and table contracts.
- `templates/`: generated design contracts, product patterns, tables,
  Storybook, and browser tests.
- `src/`: CLI, intent resolver, table scaffolder, token compiler, checker,
  adapters, upgrade, and uninstall logic.
- `fixtures/neutral-saas/`: neutral golden-stack overfitting fixture.
- `evals/`: fourteen behavioral contracts and cross-agent prompt.
- `docs/compatibility.md`: tested local tool versions and build results.
