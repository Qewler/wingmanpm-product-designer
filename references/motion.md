# Motion Decision System

Motion explains cause, preserves orientation, confirms action, or adds a rare
product moment. If it does none of these, remove it.

## Motion tiers

### Tier 1: repeated micro-interactions

Use for hover, press, focus, selection, menus, tooltips, and local state change.

- Duration: usually 90-180 ms; never make a repeated control wait for flair.
- Distance: usually 2-8 px.
- Properties: opacity and transform first.
- Easing: responsive ease-out. Do not use ease-in for interactive arrivals.
- Behavior: transitions must be interruptible and settle from their current
  state when the user reverses direction.

### Tier 2: structural transitions

Use for panels, dialogs, navigation context, list insertion, and mode changes.

- Duration: usually 160-320 ms, adjusted for distance and area.
- Preserve the origin and destination relationship.
- Keep focus management and input availability correct throughout.
- Do not animate layout when a transform can communicate the same change.

### Tier 3: rare or explanatory moments

Use for an onboarding explanation, a launch hero, a data-story transition, or a
meaningful success. Build a clear sequence with one focal event, not independent
effects on every element. Let the user skip, scroll past, or interrupt it.

## Reduced motion

Every non-essential animation needs a `prefers-reduced-motion: reduce` path.
Replace movement with an immediate state change or a short opacity transition.
Do not hide information, focus, progress, or feedback in reduced-motion mode.

## Blocking patterns

- `transition: all` or equivalent broad property animation.
- Infinite decorative motion near a repeated task.
- Scroll listeners that write layout every frame without scheduling.
- Long entrance sequences before the interface becomes usable.
- Motion that cannot be interrupted or that delays input.
- Animated width, height, top, or left for high-frequency interaction when a
  transform is suitable.

## Performance warnings

Warn on large animated blur, long-lived `will-change`, many concurrent animated
nodes, image sequences without budgets, and JavaScript-driven scroll effects.
Measure before blocking. Performance regression is a warning in version one.

## Review questions

For every motion decision, answer: What changed? What caused it? Does the user
need orientation? How often will it repeat? Can it stop? What happens with
reduced motion?
