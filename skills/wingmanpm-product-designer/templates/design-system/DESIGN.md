# Design Contract

> Mode: {{SYSTEM_MODE}}. Generated values are a starting hypothesis and require
> product evidence before a major implementation.

## Design idea

State the main user task and the product-specific idea that makes it clearer.
Choose composition, type, color, density, and interaction from that task and the
existing brand. These are hypotheses until checked against the rendered result.

## Visual system

Record the actual type roles, palette, spacing, shape, elevation, icons, and
component behavior. Prefer established product tokens and components. Optional
Expression, Density, Motion, and Warmth values must have concrete consequences.

## Themes

- Light is art-directed first.
- Dark is independently composed and tested, not numerically inverted.
- Existing light-only products do not gain dark mode during a narrow repair.

## Interaction

- Repeated actions respond immediately; useful motion is brief and interruptible.
- Structural transitions are normally 160-320 ms.
- Reduced motion preserves all meaning and input.
- Focus is visible; keyboard order follows reading and task order.

## Responsive contract

- 390: preserve the task, not the desktop layout.
- 768: use available width without premature desktop chrome.
- 1280 and 1440: constrain reading width while allowing dense data surfaces.
- Tables use priority columns, overflow, or row detail instead of crushed cells.

## Content contract

- Local UX copy can improve when meaning remains intact. Cut repetition, not
  necessary evidence or recovery instructions.
- Headings identify real sections; eyebrows add context instead of repeating titles.
- Main and supporting actions are clear within each decision area.
- Legal text, claims, prices, and business rules are protected.
- Long labels, locale-aware values, and 200% zoom must remain usable.
