# Minimum rendered craft

Apply this floor to every UI deliverable, including quick polish and throwaway
variants. A brief or an established brand overrides taste here, never a line
marked as gate-enforced. Before editing, note the existing navigation, main
actions, content, and brand rules, and keep them unless the brief says otherwise.

## The floor

- **Mode.** Persuade (landing, pricing, launch): [marketing](marketing.md).
  Operate (app screens, settings, tables, tools): [controls](controls.md).
  Read (docs, articles, changelogs): structure for comprehension, 65-75ch measure.
- **Copy budget.** Persuade: at most 35 words in the first viewport, at most 450
  words of body copy. Operate: at most 150 words of explanatory prose per screen,
  helpers one line. Labels, data, and states carry meaning; paragraphs rarely do.
- **Headings.** One `h1`. Persuade stops at `h3`, Operate at `h4`. One `h2` per
  section. Never a heading followed directly by a smaller heading. No eyebrow or
  kicker labels above headings. Item titles in repeated rows are labels, not
  headings.
- **Composition.** At 1280-1440px content fills a fluid grid or sits centered in
  one container; no columns stopping short with a dead gutter. In a split hero,
  align the supporting column to the headline's top or last baseline, never
  floating at its vertical center.
- **Geometry.** One spacing scale (4px base). One control-height scale (28/32/40).
  Every control in a row shares height and center within 1px. Body copy is 16px on
  Persuade and 13-14px on Operate. Prose measure is at most 75ch.
- **Components.** Every dropdown is a styled popup with the full keyboard contract in
  [controls](controls.md). No unstyled native selects or checkboxes. Every
  button-like element has hover, focus-visible, active, and disabled styles.
- **Browser surfaces.** Theme `::selection`, `accent-color`, focus rings, scrollbars,
  and use tabular figures in numeric columns.
- **Contrast.** At least 4.5:1 for normal text and 3:1 for text of at least 24px or
  18.67px bold. Aim for 5:1 on small secondary labels. Measure it; never round up.
- **Mobile.** At 390px every route and action stays reachable through a visible
  control or a keyboard-operable menu. No horizontal page scroll.
- **Recompose for 390.** Mobile is its own composition, not the desktop stacked.
  Decide what leads on a phone, then change the pattern:
  - Controls and menu items are 40px tall on touch. Never let a select, tab, or
    segmented control shrink below 32px; the gate fails it.
  - Toolbars: search on its own full-width row, then filters as a grid of equal-width
    triggers (`grid-template-columns: 1fr 1fr`), with secondary actions in an
    overflow menu. Nothing floats as a lone text link.
  - Tables become cards that keep every field that matters: primary text first,
    then status and the key number on one line, then a metadata line. Row actions
    and selection stay visible. Never silently drop a column's information.
  - Names, titles, and primary values wrap (`overflow-wrap: anywhere`). Ellipsis is
    only for secondary metadata. Nothing is clipped by its container.
  - Multi-pane product scenes show one pane at a time behind tabs or steps, and
    their chrome sheds secondary controls so the rest fit. Hide empty panes.
  - Pricing comparisons become one full-width block per plan with its own list.
  - Fixed and sticky bars clear the safe area and never cover focused content.
- **Keyboard.** Tab, Enter, Space, Escape, and the arrows work on the main flow.
  Focus stays visible and returns to its trigger after overlays.
- **Refuse.** Gradient text, emoji icons, glass as decoration, thick one-sided
  accent borders, nested cards, equal icon-card grids as page structure, and
  monospace as a "technical" costume.

## Run the gate

With a project Playwright install:

```text
craft --file index.html --mode persuade|operate|read --json
craft --url http://127.0.0.1:3000 --mode operate --json
```

With any host browser (agent-browser, Chrome DevTools, the host's own tool),
evaluate the gate script and assess its output. The script returns a JSON string;
save it as-is:

```text
node "<skill-base-dir>/bin/wingman-design.mjs" slop --script > .tmp/slop.js
# evaluate .tmp/slop.js in the page at 1440x900 and again at 390x844 (reload
# between widths); save each result, e.g. .tmp/slop-1440.json and .tmp/slop-390.json
node "<skill-base-dir>/bin/wingman-design.mjs" slop --snapshot .tmp/slop-1440.json --mode operate
node "<skill-base-dir>/bin/wingman-design.mjs" slop --snapshot .tmp/slop-390.json --mode operate
```

The gate measures contrast, overflow, mobile navigation, copy and heading
budgets, eyebrows, stacked headings, paragraphs in cards, row alignment, native
controls, hover, focus and disabled styles, type discipline (the headline
outranks every other text in the fold, font families, character and mono faces),
the distance from headline to primary action, split headlines, a neutral
near-white ground on landing pages, nav alignment, and the behavior of every
`aria-haspopup` popup: opening, item roles, hover and highlight styles, arrow
keys, Escape, and focus return. Fix every `failure`; address warnings or state
why they stay. A gate pass is the floor, not the finish. Then look at the render
at 1440 and 390 px and judge it against the thesis.

Run it in every mode the screen has: each density, with rows selected, with a
dialog or drawer open, empty, and in error. Bugs hide in the mode nobody
captured.

`--mode auto` picks Operate for an app shell and Persuade for a display-size
`h1`. Mark product mock-ups `<figure data-demo>` so their UI text is not counted
as copy. Missing browser proof reports `unverified` (exit 2); observed failures
report `failed` (exit 1). The gate does not certify WCAG compliance.

References: [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
and [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
