# Blind variety review

You are an art director reviewing two portfolios. Each portfolio is a set of
landing pages for different products, made by one unnamed studio. You do not
know who made them. Judge only what you see.

Folder `{{DIR}}/X/` and folder `{{DIR}}/Y/` each hold numbered pages. Every page
has `desktop-fold.png` (1440×900 first viewport) and `mobile.png` (full page at
390). Look at every image. Do not open any other folder.

For each portfolio, answer:

1. **shared_skeleton**: describe in one sentence any layout skeleton that two or
   more of its pages share (same hero arrangement, same section shapes, same
   type treatment), or `none`.
2. **sameness**: 1 (every page is its own world) to 10 (one template, recoloured).
3. **best_page** and **weakest_page**: the page numbers, with one sentence each.

Then pick **more_authored**: `X` or `Y`, the portfolio whose pages each have a
specific, memorable art direction drawn from their product while staying clear
and usable. No tie. Give one sentence of evidence.

Write JSON to `{{OUT}}`:

```json
{ "X": { "shared_skeleton": "...", "sameness": 3, "best_page": {"n": 2, "why": "..."}, "weakest_page": {"n": 4, "why": "..."} },
  "Y": { "...": "..." },
  "more_authored": { "winner": "X", "why": "..." } }
```

Reply with a one-line confirmation only.
