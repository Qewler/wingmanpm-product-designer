# Cut the slop

Use when building or reviewing a surface, or when it feels wordy, over-framed,
generic, or loose. The budgets below are gate-enforced on rendered output. User
copy, legal text, evidence, and error recovery are never cut to meet a budget.
Instead, restructure what surrounds them. A review stays read-only unless the user
asked for changes.

| Slop | Fix | Budget |
| --- | --- | --- |
| Wall of text | Delete welcome filler, restated labels, and "this section lets you" sentences. Move optional help behind an inline disclosure next to the control. | Persuade: 35 words in the first viewport, 450 on the page. Operate: 150 words of prose per screen. Card paragraphs: 3 lines. |
| Heading soup (`h1`–`h4` everywhere) | One `h1`. One `h2` per section. Repeated item titles (tiers, features, rows) are `h3` at most on Persuade, labels on Operate. Merge tiny sections. | Persuade: up to `h3` and 16 headings below the `h1`. Operate: up to `h4` and 8 headings in the first viewport. |
| Stacked headings | A heading followed directly by a smaller heading means a missing sentence or an extra level. Delete one. | Zero. |
| Eyebrow or kicker labels | Delete the small uppercase label. Let the heading carry the meaning. A real date, status, or category goes in metadata next to the heading. | Zero on Persuade; advisory on Operate. |
| Template composition | Start from the product's object and decision, not from hero, three cards, testimonials, and CTA. Change the structure, not the paint. | See the [marketing](marketing.md) compositions. |
| Loose controls | One height per row, square icon buttons, a search field that grows, aligned centers. | ±1px. |
| Unpolished dropdowns | Styled popup surface, 32px items, checks and shortcuts right-aligned, the full keyboard contract. | Zero `menu-behavior` failures. |
| Unclear actions | One primary per decision area, named with a verb and its object ("Save changes", "Invite 3 members"). Secondary actions sit nearby and quieter. Never promote Delete. | One filled button per region. |

## Make the cut

Read only the headings: they should form the outline of the task or story. Read
only the action labels: each should predict its result and scope. Then count words
in the first viewport. Fix the biggest region first and explain the gain in one
sentence. Rerun the gate.

Concision must not remove a consequence (who receives a message, what a deletion
destroys) or force a needless click. Keep semantic headings for real document
structure on Read surfaces; never replace a heading with bold text to dodge a
budget.
