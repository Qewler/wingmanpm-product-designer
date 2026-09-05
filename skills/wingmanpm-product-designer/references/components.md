# Components that hold together

Use when creating or refining a component or its interaction. Preserve the
project's accessible primitives, public props, events, and data contracts. A
component is a small task with changing states, not a decorated rectangle.

## Choose the response before the effect

Start with trigger, expected response, frequency, and consequences. A press
needs prompt feedback; it does not always need scale. Select a subtle color,
border, inset, or movement response that fits the component and input method.
Keyboard focus and activation must remain clear without pointer-only effects.
For motion choices, load [motion](motion.md).

## Detail patterns

| Situation | Coherent behavior | Check the difficult case |
| --- | --- | --- |
| Action becomes pending | Keep the control's geometry stable, name the work in progress, and prevent unintended duplicate submission. Preserve the relevant cancel or recovery path. | Long translated labels; fast completion; rejection; retry; changing selection during work. Do not announce success before completion. |
| Anchored menu or popover | Preserve the visible relationship to its trigger. If it moves, its origin should follow actual placement, including a flipped placement. | Open near a viewport edge, scroll, resize, press Escape, and reopen quickly. Focus must return to a valid trigger. |
| Repeated toolbar help | Keep discovery deliberate while allowing quick movement among related items. Prefer the project's existing tooltip timing and grouping. | Focus, coarse pointers, a disabled control, and movement between trigger and content. Essential instructions belong in the interface, not only in a tooltip. |
| Selection or content changes | Keep the user's place and show what changed. Reserve space for known controls; use stable keys for repeated objects. | Rapid reversal, reordered data, long content, and reduced motion. Do not reset input or replay a long reveal on every update. |
| Toast or temporary feedback | Confirm the outcome without stealing focus. Put important recovery near the affected task and make it persist as long as needed. | Several events in succession, backgrounding the page, hover/focus, dismissal, and screen-reader announcements. Critical information must survive the toast. |
| Drag, swipe, or resize | Keep a clear relationship between input and object; make cancellation and limits predictable. Offer a non-drag alternative. | Pointer leaving the object, pointer cancellation, additional touches, scroll conflict, keyboard access, and interrupted motion. Use the tested primitive's behavior before writing custom physics. |

## Compose a family

Use shared type, spacing, target sizes, icon alignment, state colors, and motion
roles. Check optical alignment with the actual icon and label; geometric center
alone may look wrong. Component defaults should work without per-instance CSS
patches. Variants express real meaning such as priority, state, density, or
placement, rather than arbitrary visual alternatives.

Preserve intrinsic content size and allow labels to wrap where needed. Do not
make button widths jump between idle, pending, and success. Keep hit areas and
focus rings intact when adjusting visual size. Test neighboring components as
well as an isolated story; a good button can still be wrong in a crowded toolbar.

Use this guidance in the shared component when the behavior should be shared;
keep a local composition choice local. Verify the affected callers before
changing a shared default. Avoid adding a new animation library for one effect.

## Prove the small details

Exercise one normal cycle and one interruption or failure. Check keyboard and
touch-equivalent paths, mobile width, text expansion, and reduced motion when
motion exists. Inspect a transition slowly only to diagnose a visible defect;
then retest at normal speed. State what was observed and what remains unverified.
