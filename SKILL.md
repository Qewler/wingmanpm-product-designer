---
name: wingmanpm-product-designer
description: Design, build, redesign, review, polish, and verify responsive SaaS product interfaces and their design systems. Use for authenticated web apps, dashboards, dense data UI, AI workflows, onboarding, settings, billing, team administration, or a SaaS marketing surface. Not for backend-only work or native mobile implementation.
license: Apache-2.0
metadata:
  author: Julius (@Qewler), creator of WingmanPM
  version: 0.1.0-private.1
---

# WingmanPM Product Designer

Create SaaS interfaces that feel precise, fast, coherent, and specific to the
product. The brief and existing product truth outrank this skill's defaults.

## Start with authority and scope

1. Inspect the repository before asking questions. Read existing instructions,
   design documents, tokens, components, representative screens, and assets.
2. Classify the request:
   - **Review:** report evidence; do not edit unless the user asks for a fix.
   - **Narrow repair:** preserve the current system and record temporary
     assumptions if no design contract exists.
   - **Product work:** build or improve task-focused authenticated UI.
   - **New system or major redesign:** follow the direction workflow below.
   - **Marketing:** use the separate marketing playbook.
3. Preserve business rules, legal text, factual claims, routes, analytics
   contracts, and product behavior unless the user explicitly changes scope.

## Load only the owning reference

- New system, new screen, or major redesign: [references/system.md](references/system.md)
- Authenticated app UI and component decisions: [references/product-ui.md](references/product-ui.md)
- Animation or interaction polish: [references/motion.md](references/motion.md)
- Review, audit, hardening, or final QA: [references/qa.md](references/qa.md)
- Landing, pricing, launch, or docs marketing: [references/marketing.md](references/marketing.md)
- Rule lookup or validator behavior: [references/registry.md](references/registry.md)

## Product character

- Adapt to the product and preserve coherent existing systems.
- When no visual authority exists, start precise and warm: compact density,
  controlled softness, calm neutrals, one brand accent, semantic state colors,
  one strong sans family, and mono or tabular figures for data.
- Familiar controls are a feature. Expression belongs in composition,
  component detail, and earned moments, never ornamental friction.
- Do not turn every group into the same rounded card. Use cards for genuine
  containment or elevation; otherwise use hierarchy, alignment, and spacing.
- Generated systems record justified 1-10 values for expression, density,
  motion, and warmth. Values must change concrete design decisions.

## New system or major redesign

1. Inspect product truth and visual authority.
2. Ask only high-impact questions the repository cannot answer.
3. Research a small set of real references with sanitized public queries. Never
   send private project content to external search.
4. Produce three distinct responsive coded first-view concepts using honest
   content. State each concept's product fit and risk.
5. Wait for the user's choice before implementing the full direction.
6. Run `wingman-design init --project <root>` and replace scaffold assumptions
   with the approved contract.
7. Build with project-owned components and Storybook evidence.

## Completion contract

- New design systems define separately composed light and dark themes. A narrow
  repair does not silently add dark mode to an existing light-only product.
- WCAG 2.2 AA is blocking. Improve toward AAA where product constraints allow.
- Cover every relevant loading, empty, partial, error, success, disabled,
  permission, offline, and responsive state.
- Long labels, locale-aware values, keyboard use, zoom, reduced motion, and
  touch input must remain usable.
- AI actions expose progress, sources, uncertainty, cancellation, recovery, and
  human approval before consequential changes.
- Sample people, companies, and metrics are realistic and visibly labeled as
  sample or mock.
- Run the project's `design:check`, Storybook checks, and browser review. Fix
  blocking findings and repeat until clean. If the same external blocker
  survives three honest attempts, stop and name it precisely.
- Unexpected visual baselines require explicit review before replacement.

## Reviews and handoff

Use a `Before | After | Why` table for review findings, ordered by impact and
backed by screenshots, DOM evidence, or exact code. Do not mutate on a review-
only request. A completed task reports the outcome, proof, and genuine remaining
limits without a design lecture.
