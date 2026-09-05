# Component and State Contract

Mark coverage only after the workflow is implemented and checked. Each
workflow records applicable states; `N/A` needs a short reason in the surface
file. This generated inventory is not completion evidence.

Required states: loading, empty, partial, error, success, disabled, permission,
offline, responsive.

## Coverage

- [ ] Shell and navigation
- [ ] Command interface and search
- [ ] Forms and validation
- [ ] Overlays
- [ ] Settings and onboarding
- [ ] Permissions, operational settings, access controls, and team administration
- [ ] Notifications and audit logs
- [ ] File management
- [ ] Tables with static, work, and editable profiles; dense and comfortable
  modes; truthful pagination; saved views; expansion; selection; bulk actions;
  and complete edit states. Per-table contracts live in `tables/`.
- [ ] Transparent AI workflow with progress, sources, uncertainty, cancel,
  errors, recovery, and human approval before consequential actions

## Vocabulary

Use project-owned primitives. Do not add a second icon set, one-off button
language, or new radius scale without recording the reason in `DESIGN.md`.

## Interaction contract

For each changed component, record its trigger, expected response, scope, and
relevant failure or interruption. Keep geometry stable during pending feedback;
prevent accidental duplicate submission and provide recovery. Verify focus,
Escape/cancel, rapid reversal, long labels, and mobile use where applicable.
Preserve the public component API and inspect affected callers for shared edits.

## Content and action contract

Headings mark real sections; eyebrows add distinct context. Remove copy that
repeats a label, while preserving required text, evidence, and recovery guidance.
Name the main action for the current decision area and distinguish alternatives.
Keep global selection and bulk actions available on mobile. Use established
primitives with product-specific composition; framework defaults are not defects
by themselves.
