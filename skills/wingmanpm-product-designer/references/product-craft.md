# Product Craft Commands

These commands improve one design dimension without silently redesigning the
product. Read [product-ui.md](product-ui.md) first when the request spans several
patterns. Preserve product meaning, data relationships, component contracts,
and established brand authority.

Use Expression, Density, Motion, and Warmth only when they clarify the choice.
A single-dimension command should preserve unrelated design decisions. Use
[anti-patterns](anti-patterns.md) for excess copy, framing, generic composition,
or unclear actions; [components](components.md) for component states and feel.

## `layout` / `reflow`

Start from the user's object, decision, and next action. Establish page order,
group related controls, separate global from local actions, and make primary
and supporting regions visibly different. Prefer alignment, spacing, dividers,
and type hierarchy before adding containers.

- Keep source order meaningful and focus order predictable.
- Use a stable spacing rhythm with explicit exceptions for dense data.
- Protect usable line length and prevent controls from drifting away from the
  content they affect.
- At narrow widths, reprioritize and recompose. Do not only stack every desktop
  region or crush data to fit.

## `typography` / `typeset`

Assign a small set of semantic roles for display, page title, section title,
body, label, helper, metadata, and data. Make differences clear through size,
weight, line height, and placement rather than many font families.

- Use tabular figures for aligned quantities and mono only when the content is
  genuinely code-like or identifier-like.
- Let labels and headings wrap without collision. Preserve full meaning for
  clipped data through a keyboard-, touch-, and pointer-accessible path.
- Check capitalization, punctuation, numeral alignment, localized values, and
  text expansion.
- Do not make secondary text fail contrast to manufacture hierarchy.

## `color` / `colorize`

Use the product palette for identity and priority, semantic colors for state,
and a deliberate palette for data. Color is supportive evidence, never the only
way to identify status or selection.

- Map every value to an existing or approved token.
- Reserve saturated color for meaningful priority and feedback.
- Test text, icons, focus indicators, charts, hover, selection, disabled, and
  forced or high-contrast contexts.
- Compose dark mode separately when the product contract requires it. A narrow
  repair does not add a new theme.

## `responsive` / `adapt`

Test the task, not only the breakpoint. Cover 390, 768, 1280, and 1440 CSS
pixels plus 200% zoom, long localized content, keyboard input, touch targets,
and coarse pointers.

- Keep the primary object, state, and action discoverable at every size.
- Replace precision-only controls with usable touch alternatives.
- Allow intentional overflow when preserving a relationship is better than
  forced wrapping; name and keyboard-enable the scroll region.
- Recompose navigation, filters, data detail, and action placement instead of
  hiding essential capability.
- Verify sticky and fixed regions do not obscure focus, errors, or content.

## Proof

Show the changed dimension at affected states and viewports. Run accessibility
and interaction checks, then state which design decisions stayed fixed and why.
