# Visual exploration

Use for a meaningful design choice, from one component to a whole surface. Work
in an isolated local folder. Do not replace production files, initialize the
full design system, or build a backend to compare directions.

## Choose the question

Inspect product facts, existing identity, content, main task, and constraints.
Name the uncertainty: composition, information order, interaction, or visual
voice. If the user already chose a direction, extend it rather than reopening
selection. Missing DESIGN.md does not make an existing product a blank canvas.

Form a few short candidate ideas; develop the strongest two. Each should test
a distinct way to support the task, not just a different accent color. A third
may help a wide brief. Honor larger explicit counts; one board supports up to
six options, and larger requests can use multiple boards. A precise small repair normally needs one implementation.

Use [creative patterns](creative-patterns.md) to form distinct task strategies
and retrieve only relevant patterns. Apply [minimum craft](craft.md) to each
option before comparison.

## Make the choice visible

Build high-fidelity slices with the same content, data, assets, viewport, brand
limits, and detail quality. Show the main area, one key action, and a hard state.
Test responsive layout and basic keyboard use. Match the medium to the question:
images for art direction, runnable code for interaction. Keep data realistic and
labeled Sample or Mock. Name unavailable behavior; never fake persistence.

Use self-contained HTML with inline CSS, scripts, and embedded assets, or local
PNG/WebP/JPG previews. The served board isolates scripts and blocks preview network access.
The static fallback is for local trusted previews and chat-based selection. Existing private screens or data require authorization before use in an
external image tool. Image generation is optional; code is a capable fallback.

## Create the comparison board

Author a JSON spec using project-relative preview paths. This example shows the
schema, not default design directions. Replace its concepts with the brief’s own
question and selected strategies:

```json
{
  "id": "review-flow",
  "target": "src/Review.tsx",
  "question": "Review suggestions in place or compare changes?",
  "identity": "Preserve the current type, palette, and navigation.",
  "content": "The same six Sample suggestions and source excerpts.",
  "options": [
    {
      "id": "in-place",
      "title": "Review in place",
      "idea": "Keep the suggestion beside its source.",
      "difference": "One continuous review queue with inline expansion.",
      "tradeoff": "Faster scanning; less room for long comparisons.",
      "preview": ".tmp/review-a.html",
      "limits": "Local draft actions only. No server persistence."
    },
    {
      "id": "compare",
      "title": "Compare changes",
      "idea": "Make each change visible before accepting it.",
      "difference": "A master-detail layout with original and proposed text.",
      "tradeoff": "Clearer changes; less space for the queue.",
      "preview": ".tmp/review-b.html",
      "limits": "Local draft actions only. No server persistence."
    }
  ],
  "recommended": "compare",
  "reason": "The user must inspect consequential text changes."
}
```

Each option may add `mobile` for a separate mobile image or HTML preview.
An image without a mobile companion is only a resized image, not mobile proof.

Using the bundled CLI:

```text
explore create --spec .tmp/exploration.json
explore serve --id review-flow
explore inspect --id review-flow
check --stage explore --id review-flow
```

Open the returned local URL with the host's browser. Inspect every preview at
full size and at the relevant mobile width before presenting it. Give a short
recommendation tied to the task, then let the user choose or give feedback.
The board supports size comparison, full-size previews, feedback, and local saved
selection. It does not wake or message an agent. Read `explore inspect` after
user feedback; the host conversation controls when work resumes.

Without a local server, open `board.html`; its buttons prepare a message to paste
into the host chat. A normal chat choice can be saved with:

```text
explore choose --id review-flow --option compare --reason "User chose side-by-side review."
```

Do not click a choice on the user's behalf except during a labeled test. The
agent's recommendation is not approval. Respect an earlier explicit user choice.

## Develop the selected direction

Read the saved decision, preserve its reasons and artifacts, then build only the
selected direction. If combining parts, create a coherent new comparison and
review it; do not splice incompatible styles. Existing explorations are never
overwritten. A source change invalidates a pending selection; use a fresh ID.
Retain alternatives until cleanup is authorized. Exploration readiness never
claims shipping, full accessibility, authentication, or production correctness.
