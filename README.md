# WingmanPM Product Designer

Private development build of a portable Agent Skill for designing and shipping
high-quality SaaS product interfaces.

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
node ./bin/wingman-design.mjs check --project /path/to/project
node ./bin/wingman-design.mjs doctor --project /path/to/project
node ./bin/wingman-design.mjs uninstall --project /path/to/project
```

The skill is portable through the Agent Skills `SKILL.md` format. Project
initialization creates a framework-neutral design contract and, for the golden
Next.js stack, project-owned components plus Storybook.

## Ownership and safety

`init` does not overwrite existing product documents, components, stories, or
instructions. It adds marked instruction blocks and records generated files in
`.wingmanpm-design/manifest.json`.

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
visual-evidence failures. Performance findings warn in version one.

Visual evidence is pending after initialization. After a real browser review,
record it explicitly:

```bash
wingman-design check --project /path/to/project \
  --record-review --reviewer "Reviewer name" \
  --confirm keyboard,zoom200,reducedMotion,longContent,light,dark,axe,responsiveStates
```

The source-linked registry is searchable:

```bash
wingman-design search reduced motion
```

## Share safety

Version one stays private. The npm package uses an explicit allowlist, so local
evaluations, fixtures, screenshots, and tests are not included in a future
package archive. Before sharing a repository copy, run:

```bash
npm run check:share
```

The check rejects absolute home and temporary paths, secret-shaped values,
tracked environment or OS files, PNG metadata, generated build directories,
unexpected Git remotes, a non-private package, and local data left in Git
history.

## Repository map

- `SKILL.md`: portable Agent Skill router.
- `references/`: focused product, system, motion, QA, and marketing guidance.
- `registry/`: original small, source-linked rule registry.
- `templates/`: generated design contracts, app patterns, Storybook, and tests.
- `src/`: CLI, token compiler, checker, safe adapters, and uninstall logic.
- `fixtures/neutral-saas/`: neutral golden-stack overfitting fixture.
- `evals/`: eight behavioral contracts and cross-agent prompt.
- `docs/compatibility.md`: tested local tool versions and build results.
