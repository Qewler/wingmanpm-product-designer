# Design benchmark

A rendered, blind comparison of what agents build with a design skill. It
measures output, not wording. Six fixed briefs (`prompts.json`), two
landing pages and four product screens, each built unattended as one
self-contained HTML file.

## Run

1. Build each brief with each skill into `<run>/<skill>/<prompt>/index.html`,
   one fresh agent per brief, same model, same constraints (see `prompts.json`).
2. Score with the rendered gates (needs the `agent-browser` CLI):

   ```bash
   node evals/design-bench/score.mjs <run>
   ```

   Each page gets `score.json`, `desktop.png`, `desktop-fold.png` and
   `mobile.png`. The gates are the skill's own `slop` checks at 1440 and 390,
   forced to light mode, including the popup keyboard probe.
3. Build a blind pair set and judge it twice with the order swapped:

   ```bash
   node evals/design-bench/blind.mjs <blind-dir> <runA>/<skillA> <runB>/<skillB> --seed 4242
   ```

   Render `judge.md` for `pass1` and `pass2` and give each to a fresh agent
   with no design skill loaded. The page source is scrubbed of skill names.
4. For landing pages, also run a blind variety review across each skill's
   whole set, so a skill cannot win by polishing one template:

   ```bash
   node evals/design-bench/variety.mjs <variety-dir> <runA>/<skillA> <runB>/<skillB> --seed 4242
   ```

   Render `variety.md` (`{{DIR}}`, `{{OUT}}`) for a fresh agent; `key.json`
   maps X and Y back to the skills.
5. Unblind:

   ```bash
   node evals/design-bench/tally.mjs <blind-dir>
   ```

## Bar

A skill version beats a competitor when its pages pass every gate, it wins or
ties every judged category in aggregate (including identity), it wins at least
three quarters of the pairings, and its landing set is judged more authored in
the variety review. Briefs marked `heldout` are never used to tune the skill; once their results
inform a change they are marked `seen`, and new held-out briefs replace them.
Model judges reward taste unevenly, so a human review of the screenshot board
stays the final call. Run outputs live in `runs/` (git-ignored).
