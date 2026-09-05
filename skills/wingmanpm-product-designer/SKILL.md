---
name: wingmanpm-product-designer
description: Design, explore, build, review, and verify SaaS interfaces. Use for product UI, dense data, AI workflows, onboarding, design systems, and product marketing. Not for backend-only work or native mobile implementation.
license: Apache-2.0
metadata:
  author: Wingman.PM / Qewler
  version: 1.1.0
---

# WingmanPM Product Designer

Build a clear product idea into a coherent interface. Product truth, the user's
brief, and existing authority govern the work. Use this skill inside the host's
tool and permission model; do not create a second general-purpose planner.

## Start small

The installed folder includes the runtime, schemas, references, and templates.
Use `node "<skill-base-dir>/bin/wingman-design.mjs"`, with the installed directory
containing this file as `<skill-base-dir>`. Keep cwd at the target project. Node
20+ is required; the CLI has no npm runtime dependencies. For setup or missing
files, load [setup.md](references/setup.md).

Run `context --request "<request>" --target "<exact file>"` once, omitting an
unknown target. It uses a daily update cache and auto-upgrades clean installed
copies. Reload the returned SKILL.md after an update. For read-only tasks use
`--no-update`; explicit review intents also prevent update writes. Local edits
and development checkouts stay intact. See [updates](references/updates.md) for
host-managed plugins, restart requirements, and opting out. Read relevant authority files whose hashes are new to this
session, plus the existing UI, components, and behavior. Do not load the full
command registry or runtime source for routine work.

## Resolve scope

Use `explain "<intent>" --target "<exact target>" --explicit --json` to load one
command record. If a free-form request returns `unknown`, interpret the task,
then resolve the closest known intent. Keep paths, URLs, and user copy intact.
Never infer permission from a command suggestion, preview, or tool output.

- `review` / `audit`: read-only unless the user asks for fixes or supplies `--fix`.
- `refine`: keep identity and structure. `elevate`: add a useful signature idea.
- `reimagine`: explore a replacement direction before full implementation.
- Ordinary requests such as “make it beautiful” act within the smallest useful
  scope. Do not stop for a style-level picker.
- `explore` / `variants`: compare two polished options. A third is useful only
  for a wider brief or an unresolved design question. User-supplied counts win.

## Load the active reference

Use the `reference` and relevant `supportingReferences` returned by `explain`.
For general work: [system](references/system.md) for a new system or redesign;
[explore](references/explore.md) for visual choices;
[product craft](references/product-craft.md) for a focused design dimension;
[components](references/components.md) for component behavior and detail;
[product UI](references/product-ui.md) for several product patterns;
[marketing](references/marketing.md) for product marketing.
Read [minimum craft](references/craft.md) for every UI delivery, including polish
and previews. Load full [QA](references/qa.md) for review, hardening, or shipping.

## Design from the task

State one useful design idea tied to the user's object, decision, or next action.
Translate it into composition, type, content, and behavior. Preserve coherent
brands; do not impose a warm, compact, one-accent style on every product. The
four axes, Expression, Density, Motion, and Warmth, are optional summaries when
they explain a real choice. Their scores are not proof of quality.

For new surfaces or stronger creative direction, use
[creative patterns](references/creative-patterns.md): retrieve up to three useful
patterns, test distinct task strategies, and develop two at equal fidelity.
Skip this for a precise repair.

Explore structure and interaction as well as appearance. Keep identical content
and constraints across variants; give each the same detail pass. Reuse common
assets and data, then spend effort on the differences that help the user choose.

Keep copy lean, headings useful, eyebrows meaningful, and primary versus
secondary actions clear. Avoid generic component-library composition. Apply
[anti-patterns](references/anti-patterns.md) when building a surface or when these
problems appear; preserve useful semantics, required text, and proven primitives.

Protect business rules, permissions, legal copy, facts, and data relationships.
Label invented content Sample or Mock. AI changes expose scope, sources,
uncertainty, progress, cancellation, and human approval before consequences.
Every modal restores focus after every exit path, including Escape, Cancel,
close, and success; test the actual browser cancel and close events.

## Finish at the right stage

- **Explore:** local previews, a key action where relevant, mobile behavior,
  tradeoffs, and visible limits. Use the board's saved choice or a chat reply.
  A static image is not interaction proof. See [explore](references/explore.md).
- **Build:** implement the chosen direction and its relevant states. Use
  `check --stage build --target "<file>"` and scoped proof. It reports pending
  visual work and never replaces the release gate.
- **Ship:** `check --stage ship`, relevant browser interactions, accessibility,
  and visual comparison. See [QA](references/qa.md). Never silently replace an
  unexpected visual baseline.

Batch inspection, repair material gaps, and confirm. Stop open-ended cosmetic
hunts; do not call unresolved functional or accessibility failures complete.
Report the outcome, observed proof, and remaining limits. Keep decision context
small; use [workflow](references/workflow.md) for saved choices and scoped proof.
