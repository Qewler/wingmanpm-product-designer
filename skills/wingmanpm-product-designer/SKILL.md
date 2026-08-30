---
name: wingmanpm-product-designer
description: Design, build, redesign, review, polish, and verify responsive SaaS product interfaces and their design systems. Use for authenticated web apps, dashboards, dense data UI, AI workflows, onboarding, settings, billing, team administration, or a SaaS marketing surface. Not for backend-only work or native mobile implementation.
license: Apache-2.0
metadata:
  author: Julius (@Qewler)
  version: 1.0.0
---

# WingmanPM Product Designer

Create SaaS interfaces that feel precise, fast, coherent, and specific to the
product. The brief and existing product truth outrank this skill's defaults.

## Inspect before design

Read repository instructions, product and design documents, tokens, shared
components, representative screens, assets, and working behavior before asking
questions or editing. Preserve business rules, legal text, factual claims,
routes, permissions, data relationships, analytics contracts, and established
product behavior unless the user explicitly changes their scope.

## Resolve the request

Use the exact intents and aliases in
[registry/commands.json](registry/commands.json). Invocation is portable:

```text
$wingmanpm-product-designer <intent> [target] [--level refine|elevate|reimagine]
/wingmanpm-product-designer <intent> [target] [--level refine|elevate|reimagine]
```

- An explicit skill invocation or supplied `--level` will **act directly**.
- A free-form request using `make it beautiful`, `make it stunning`, or
  `pimp it up` first
  inspects the target, then offers one choice: **Refine**, **Elevate**, or
  **Reimagine**. Recommend Refine, Elevate, and Elevate respectively. Do not
  edit before the choice.
- Reimagine is a major redesign. Produce three responsive coded first-view
  directions and require a user choice before full implementation.
- `review` and `audit` are read-only. Edit only when the user explicitly asks
  for changes or supplies `--fix`.
- A review keeps [references/qa.md](references/qa.md) as its owning policy. If
  its target explicitly names one product pattern, also load that pattern's
  reference. This does not turn the review into implementation. Do not infer a
  supporting reference from a broad target such as billing or settings.
- Match aliases exactly after case, punctuation, and whitespace normalization.
  Never infer an intent from a substring.

## Load only the owning reference

- `polish`, `standout`, `amplify`, `calm`, `simplify`:
  [references/transforms.md](references/transforms.md)
- `layout`, `typography`, `color`, `responsive`:
  [references/product-craft.md](references/product-craft.md)
- `motion`: [references/motion.md](references/motion.md)
- `harden`, `review`: [references/qa.md](references/qa.md)
- `data-table`: [references/data-tables.md](references/data-tables.md)
- `forms`, `onboarding`: [references/forms.md](references/forms.md)
- `ai-flow`: [references/ai-ui.md](references/ai-ui.md)
- `navigation`: [references/navigation.md](references/navigation.md)
- `design-system`, a new screen, or major redesign:
  [references/system.md](references/system.md)
- Landing, pricing, launch, or docs marketing:
  [references/marketing.md](references/marketing.md)
- Validator behavior: [references/registry.md](references/registry.md)

Use [references/product-ui.md](references/product-ui.md) as the shared product
foundation only when an owning reference points to it or the request spans
several product patterns.

## Product contract

- Adapt to coherent existing systems. When no authority exists, start precise
  and warm: compact density, controlled softness, calm neutrals, one brand
  accent, semantic colors, strong sans type, and tabular figures for data.
- Record justified 1-10 values for Expression, Density, Motion, and Warmth
  before and after a transformation. Every changed value must alter concrete
  layout, type, color, shape, or motion decisions.
- Use cards only for real containment or elevation. Establish hierarchy with
  composition, alignment, type, dividers, and spacing.
- WCAG 2.2 AA, complete workflow states, keyboard use, zoom, long content,
  locale-aware values, touch input, responsive behavior, and reduced motion
  are completion requirements.
- AI actions expose scope, progress, sources, uncertainty, cancellation,
  recovery, and human approval before consequential changes.
- Editable data tables use deliberate inline editing with validation, saving,
  permission, conflict, offline, cancellation, and recovery states.
- Invented data is realistic and visibly labeled `Sample` or `Mock`.
- Apply WPD021 through WPD023 to every skill-produced UI, copy, document,
  story, template, and handoff before completion. Do not produce the forbidden
  long dash or a render equivalent. Keep visible headings and shell landmarks
  unique per surface, and keep one icon-only close control per dialog. Test
  every dropdown in light and dark with at least 4.5:1 text contrast, real
  option states, and Escape close behavior.

## Verify and hand off

Run the project's `design:check`, relevant Storybook checks, browser review, and
visual comparison. Fix blocking findings and repeat until clean. Never replace
an unexpected visual baseline without explicit review.

The WPD021 check is deterministic. WPD022 and WPD023 also require executable
browser proof across every Storybook story and a fresh review with
`structureUnique` and `dropdownContrast` confirmed.

For reviews, use a `Before | After | Why` table backed by screenshots, DOM
evidence, exact code, or test results. A completed implementation reports the
outcome, proof, and genuine remaining limits.
