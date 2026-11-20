# Controls, menus, and alignment

Mode: **Operate**. People who use tools like this know where everything is before
they notice the style. Polish shows as precise geometry, complete states, and
keyboard behavior that just works. Use the project's component library when one
exists and hold it to this contract. Otherwise, start from
[controls.css](../templates/controls/controls.css) and
[controls.js](../templates/controls/controls.js). Copy or inline both, retint the
tokens to the product, and keep the geometry.

## One geometry

| Token | Value | Use |
| --- | --- | --- |
| Control height | 28 / **32** / 40px | 28 for dense toolbars and table rows, 32 for app default, 40 for landing actions and touch-first forms |
| Radius | control 8, popup 12, item 8 | Item radius = popup radius − popup padding |
| Icon | 16px (18px in 40px controls) | One stroke weight and one library |
| Type | 12 / 13–14 / 18–20px | Metadata, UI and body, page title. Weights 400, 500, 600 only |
| Gap | 6–8px inside controls and rows | Search fields grow; icon buttons are square |
| Touch | 40px controls and items | `(pointer: coarse), (max-width: 640px)` raises the scale; the template does it |

Every control in a row shares one height and one vertical center. This includes the
search field, filter triggers, segmented controls, icon buttons, and the primary
action. The gate fails a row that is off by more than 1px. Use at most three control
heights per screen.

## Choose the right control

- **Menu** (`role="menu"`): actions such as row overflow, "Invite ▾", and bulk actions.
- **Select** (`role="listbox"` behind a `.select-trigger` button): one value from
  2–9 options. Use 10 or more options, or any list someone must search, and the
  listbox gets a search field (combobox pattern).
- **Multi-select filter**: items show a checkbox and a count, and the trigger
  summarizes the choice ("Source · 2"). Put a "Clear" item last, and keep the
  selection while the menu reopens.
- **Segmented control** for 2–4 modes such as density, period, or view. A **switch**
  applies immediately; a **checkbox** waits for a submit.
- **Split button**: a primary part, a 1px divider, and a chevron part at the same
  height, with joined radii.
- A native `<select>` is allowed only when restyled to `.select-trigger` geometry
  with `appearance: none`. An unstyled browser select fails the gate.

## Popup anatomy

Size: at least the trigger width and at least 200px. Inner padding is 4px. Items are
32px tall with 8px horizontal padding and an 8px gap. A leading icon is 16px and
muted. Selection checks and shortcuts are right-aligned, and shortcuts use
`tabular-nums`. Separators are full-bleed and 1px. Group labels are 12px and faint.
Destructive items come last, after a separator, in the danger color. Disabled items
are at 45% opacity with no hover. Maximum height is 360px, then the popup scrolls.

Surface: a layered shadow plus a 1px ring. Entry is 140ms of scale 0.97 and fade
from the trigger's corner, with no exit animation and no motion under reduced
motion. Position: below the trigger with a 6px gap. It flips above when space is
short, stays inside an 8px viewport margin, and uses `data-align="end"` for menus
anchored at the right edge.

Every popup obeys this keyboard contract (the gate's menu probe drives it):
click, ArrowDown, or ArrowUp opens; arrows, Home, End, and typeahead move the
highlight; Enter or Space chooses; Escape closes and returns focus to the
trigger; Tab closes and continues; an outside press closes. The trigger
carries `aria-haspopup`, `aria-expanded`, and `aria-controls`. Items carry
`menuitem` or `option` roles, plus hover and highlight styles.

## States, every time

Rest, hover, active, focus-visible, disabled, open (`aria-expanded`), selected,
invalid, loading, and empty. Loading swaps the icon for a spinner while the width
stays fixed. Focus is a 2px ring with a 2px offset in the accent color, or the
field ring (accent border plus a 3px soft halo). Theme `::selection`, scrollbars,
`accent-color`, and tabular figures. Browser defaults look unmade.

## Feedback that shows the system working

Polish is felt in how a screen answers. Each of these is expected, not extra:

- **Unsaved changes**: every edited field gets a quiet "Edited" marker; each
  sub-nav item shows its count; the bar names what changed ("3 changes: Name,
  Time zone, 1 role") with a Review list that can undo one change; Discard,
  Save, and Cmd/Ctrl+S; a guard before leaving with unsaved work.
- **Filters**: active filters appear as removable chips under the toolbar with
  "Clear all"; each trigger shows its count ("Status · 2"); the empty result
  names the active filters and offers "Clear search" and "Clear all filters".
- **Completion**: finishing a step, save, or bulk action gets one authored
  moment: a check that draws in over 240ms, a progress fill that animates, a
  count that ticks, plus a toast with Undo when the action is reversible.
- **Change in place**: sorting, reordering, and inserting animate position
  (FLIP, 200–260ms, ease-out) so people see where things went; numbers that
  change count to their new value. Reduced motion swaps to an instant change
  with a brief highlight.
- **Every mode is a state**: compact density, bulk selection, open dialogs,
  empty, and error each get the same craft. Run the gate in each mode.

## Operate layouts

- **App shell**: the sidebar is 232–248px with 32px items. The active item gets a
  tinted background and full-strength text. The page header is 56px with an `h1` of
  18–20px at weight 600 and the page actions on the right. Settings content stays
  at or under 1040px; tables run full width.
- **Settings**: show rows with the label and a one-line helper on the left (one
  third) and the control on the right, stacked on mobile. Separate groups with
  dividers, not cards inside cards. Each section gets one heading and at most one
  line of description. Changes raise a fixed unsaved bar: 48px, centered at the
  bottom, sliding in over 160ms, with Discard (ghost) and Save (primary).
- **Phones**: tables become cards (primary text, then status and number, then
  meta) with selection and the overflow button visible at 40px. Toolbars wrap
  into search, then a 2-column grid of filter triggers. Settings rows stack the
  label above a full-width control. Sub-navigation becomes a horizontally
  scrolling tab strip whose last tab is reachable and visibly cut, or a select.
- **Tables**: the header is 32px, 12–13px, weight 500, and muted. Rows are 40px
  comfortable or 32px compact. Numbers are right-aligned with `tabular-nums`. The
  header is sticky; rows show a hover tint and an accent-soft tint when selected.
  The bulk bar replaces the toolbar in place at the same height, with no layout
  jump. The row overflow button is a 28px ghost icon, visible on row hover and
  focus and always visible on touch.
- **Dialogs**: native `<dialog>` through `Wingman.dialog` so focus returns on every
  exit. Width is 440 or 560px with an 18px title and one paragraph at most.
  Actions are right-aligned with the primary last. A destructive confirmation names
  the exact consequence, and its button stays disabled until the typed name matches.
- **Copy**: labels and states carry the screen. Explanatory prose stays under 150
  words for the whole screen. Helper text is one line. Errors name the problem and
  the fix. Empty states have one line of meaning and one action.

## Verify

Run the gate with `--mode operate` (see [minimum craft](craft.md)). Zero
`control-misalign`, `menu-behavior`, `native-select`, and `missing-*` failures is
the floor. Then open every popup near the bottom-right edge of a 390px viewport
and confirm it flips and stays in view.
