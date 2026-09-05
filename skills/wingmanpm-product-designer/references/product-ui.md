# SaaS Product UI Playbook

## Optimize for the work

Start with the user's object, decision, and next action. Navigation and chrome
should support that work without competing with it. Prefer a calm application
shell and let high-expression moments be rare and earned.

Use cards only for real containment, elevation, comparison, or a self-contained
action. A page made from equal rounded cards hides hierarchy. First try section
rhythm, dividers, alignment, type, and whitespace.

## Establish character from the task

- Choose density for the task and audience; keep comfortable target sizes.
- Controlled corner softness: smaller radii for dense controls, larger radii
  only for meaningful containers or focal moments.
- A product-specific palette with distinct status and data colors.
- Type that fits the identity and reading task; aligned figures for data.
- Clear selected, hover, focus, disabled, destructive, and pending states.
- Project-owned components, even when they began from shadcn primitives.

## First-release pattern map

Cover the patterns that the product actually uses:

- Responsive shell, global and local navigation, breadcrumbs, command menu,
  search, notifications, and account/workspace switching.
- Forms, validation, overlays, settings, onboarding, permissions, billing,
  paywalls, team administration, and audit logs.
- File management, tables, charts, filters, saved views, selection, bulk
  actions, pagination, density controls, and column behavior.
- Loading, empty, partial, error, success, disabled, permission, offline, and
  responsive states for every relevant workflow.

Do not render desktop tables as crushed desktop tables on mobile. Keep the task
intact with priority columns, horizontal overflow, a row detail view, or a
purpose-built compact representation.

## AI workflows

An AI feature must show:

1. What input and sources are in scope.
2. Progress and the ability to cancel long work.
3. Sources and provenance near the output they support.
4. Uncertainty, missing context, and failures without fake confidence.
5. A reversible draft or preview before consequential actions.
6. Clear human approval for sending, publishing, deleting, or changing records.

## Content and international use

Write concise local UX copy when permitted. Preserve legal text, contractual
claims, identifiers, analytics labels, and business meaning. Label invented
people, companies, and metrics as `Sample` or `Mock`.

Test long labels, 200% zoom, localized dates and numbers, flexible wrapping,
and content expansion. Add RTL only when the product supports an RTL locale.

## Accessibility contract

WCAG 2.2 AA failures block completion. Aim for AAA contrast and clarity where
it does not damage hierarchy or brand meaning. Preserve semantic HTML, visible
focus, keyboard order, target size, names, roles, error association, and status
announcements.
