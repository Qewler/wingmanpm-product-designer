# Remove friction, keep meaning

Use when building or reviewing a surface, or when it feels wordy, over-framed,
unclear, or generic. Judge the rendered task and content together. Counts and
class names are clues, not a quality score. A review stays read-only unless the
user asked for changes.

| Pattern to challenge | Better decision | Preserve when useful |
| --- | --- | --- |
| Excessive text | Cut repeated explanations, welcome filler, and paragraphs that restate a label. Put a short instruction at the point of need; reveal optional help nearby. | Evidence, error recovery, unfamiliar concepts, accessible names, legal text, and exact user copy. Concision must not remove a consequence or force a needless click. |
| Excessive h2/h3 subheads | A heading introduces a meaningful section people may want to find. Combine tiny sections that describe one task; use labels for individual fields and metadata. | Real document structure, long-form reading, distinct repeated records, and useful screen-reader navigation. Do not flatten the outline or replace headings with bold paragraphs to evade a count. |
| Excessive eyebrow headers | Remove an eyebrow that repeats the title or merely says Features, Overview, or Experience. Let the title carry the meaning. | A distinct category, project, date, stage, or location that changes how the title is understood. Small uppercase styling is not itself a defect. |
| Unclear primary and secondary actions | Name the next intended action for the current state. Give it clear visual priority within its decision area; place alternatives nearby with less emphasis and precise verb labels. | Independent row actions and peer choices. A comparison may have equal choices; an empty state or read-only page may need no primary action. Never promote Delete by default or hide a required alternative. |
| Generic shadcn/Tailwind composition | Keep reliable primitives and semantics; adapt information order, type roles, density, grouping, action placement, and states to this product. Change the repeated recipe that causes sameness. | Established brand components and layouts that already fit the job. Framework imports, utility classes, default tokens, and familiar patterns do not prove poor design. |

## Make a small, visible correction

Identify the task, the main decision, and the content required to make it. Point
to the actual repeated words, needless framing, competing controls, or layout
that hides the work. Change the highest-impact region first; explain the benefit
in one sentence. Do not invent word, heading, or eyebrow quotas.

Examples of meaningful cuts: remove a sentence saying to use the search box
when its label already explains it; combine three tiny setup sections into one
form; remove an Overview eyebrow above an Overview title. Keep a warning about
who will receive a message and the evidence needed to approve a suggestion.

A useful action hierarchy is contextual: Save changes leads while editing;
Cancel remains visible but quieter. A workspace-level Create action must not
compete with every row's Details action. Put global selection and bulk controls
outside desktop-only table headings, or supply an equivalent mobile control.

To escape a template, start from the product's object and decision. A queue may
need a compact list and a stable action bar; an editor may need an object view
with nearby tools. A new font, accent, radius, or animation on an unchanged
card grid is not enough. Do not add a signature at the cost of clarity.

## Verify the result

Scan the page at desktop and mobile widths. Read just the headings: do they
form a useful outline? Read just the action labels: can the user predict the
next step and its scope? Check long content, an empty/error state, and changed
selection. Essential evidence and controls must still be reachable without
hover. Report observed problems and corrections, not an unsupported taste score.
