# Motion Decision System

Motion explains cause, preserves orientation, confirms action, or adds a rare
product moment. If it does none of these, remove it.

## Choose the smallest useful response

Consider task frequency before duration. Frequent actions may be immediate;
occasional changes may need a brief transition to preserve orientation; a rare
explanation can have more expression. Never delay keyboard or pointer input
until an effect finishes. Keyboard use does not automatically forbid useful
orientation feedback, and a click does not automatically require movement.

Use the project's existing motion roles first. Durations below are starting
ranges, not quotas. Test at normal speed, during rapid reversal, and with
reduced motion. A longer transition needs a task-based reason, not a score.

## Motion tiers

### Tier 1: repeated micro-interactions

Use for hover, press, focus, selection, menus, tooltips, and local state change.

- Duration: immediate or brief, often 90-180 ms when a transition helps.
- Distance: usually 2-8 px.
- Properties: opacity and transform first.
- Easing: show a prompt initial response; ease-out often fits an arrival.
  Choose the curve for the transition, not a universal curve rule.
- Behavior: transitions must be interruptible and settle from their current
  state when the user reverses direction.

### Tier 2: structural transitions

Use for panels, dialogs, navigation context, list insertion, and mode changes.

- Duration: usually 160-320 ms, adjusted for distance and area.
- Preserve the origin and destination relationship. Anchored surfaces should
  feel connected to their actual trigger placement; centered dialogs need not
  imitate a popover.
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

## Component details

Use [components](components.md) for pending actions, anchored surfaces, grouped
help, feedback, and gesture behavior. Motion cannot repair unclear copy, action
priority, or state semantics. Avoid automatic scale-on-press, decorative blur,
and stagger on every list. Use them only when their purpose survives repetition.
Gate pointer hover effects to suitable pointer/hover capabilities, while keeping
focus and touch feedback available. Prefer an interruptible transition for a
reversible state change; choose other animation tools when their behavior fits.
Do not assume that an API or property guarantees hardware acceleration. Profile
visible trouble in the target browser before replacing a working implementation.

## Patterns to inspect

Source matches are review signals. Judge actual behavior and measured effects;
do not block a result only because a duration or curve differs from a default.

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
