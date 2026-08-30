# System and Direction Workflow

Use this workflow only for a new design system or a major redesign. For a
narrow repair, preserve the current visual authority and make the smallest
coherent change.

## 1. Establish authority

Inspect, in this order:

1. Repository instructions and product requirements.
2. Existing routes, working behavior, analytics, and protected text.
3. Tokens, shared components, Storybook, and representative screens.
4. Brand assets, current production UI, and recent visual decisions.

Write findings in `design-system/PRODUCT.md`. Separate facts from assumptions.
Never replace business meaning with more attractive copy.

## 2. Choose preserve, extend, or redesign

- **Preserve** when the system is coherent and the request is local.
- **Extend** when a new workflow can use the current vocabulary.
- **Redesign** only when the user asks, the current system cannot support the
  work, or measured usability failures make local repair ineffective.

Record protected elements and permitted changes before editing.

## 3. Set four axes

Record a justified integer from 1 to 10 for each axis:

- **Expression:** quiet utility to distinctive visual voice.
- **Density:** spacious browsing to compact expert work.
- **Motion:** near-static feedback to explanatory choreography.
- **Warmth:** neutral precision to humane softness.

Each value must produce at least two concrete choices in layout, type, color,
shape, or motion. If it does not, the axis is decorative and must be revised.

## 4. Research safely

Use a small set of live public references. Search with generic, sanitized terms
such as the interface pattern and industry. Do not include private names, data,
screenshots, code, or unreleased features in external queries.

For each reference, record the source URL, date, relevant pattern, product fit,
and a warning against literal imitation.

## 5. Show three directions

Create three responsive, coded first-view concepts with the same honest
content. Vary composition, hierarchy, density, and expression—not only color.
Each direction must work at 390 and 1280 CSS pixels and state:

- the product idea it reinforces;
- its four axes;
- the main risk;
- what is deliberately preserved.

Do not implement the full system until the user chooses a direction.

## 6. Build the contract

After approval, complete `PRODUCT.md`, `DESIGN.md`, surface notes, tokens,
project-owned primitives, the responsive app shell, and Storybook evidence.
Compose light first, then compose dark independently. Do not make dark by
inverting light values.

## 7. Verify in loops

Run deterministic checks, Storybook interaction tests, browser review, and
visual comparison. Fix blocking findings and rerun. Baseline updates require an
identified reviewer and a recorded reason.
