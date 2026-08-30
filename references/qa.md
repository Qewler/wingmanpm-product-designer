# Review and Verification

## Read-only reviews

When asked to review, do not edit. Report evidence in this format:

| Before | After | Why |
| --- | --- | --- |
| Current measured behavior | Specific proposed behavior | User and product impact |

Order findings by impact. Use screenshots, DOM evidence, exact files, or test
results. Separate confirmed defects from design preference.

## Required proof for implementation

1. `wingman-design check` has no blocking finding.
2. Storybook builds and relevant interactions pass.
3. Chromium browser review covers 390, 768, 1280, and 1440 CSS pixels.
4. Keyboard-only use, visible focus, 200% zoom, reduced motion, long content,
   light, dark, loading, empty, error, and permission paths were exercised.
5. Axe has no serious or critical issue in the changed surfaces.
6. Visual comparison has explicit reviewer evidence; unexpected baselines were
   not silently replaced.
7. The full Playwright run wrote current passed evidence to
   `.wingmanpm-design/browser-evidence.json`. Source-shaped test files alone do
   not satisfy WPD022 or WPD023, and review recording refuses missing, failed,
   or stale browser evidence.

## Global hard rules

Run these rules for every skill-produced UI, copy, document, story, template,
and handoff before completion:

- `WPD021` blocks the forbidden long dash and each HTML, JavaScript, or CSS
  form that renders it. Use a comma, colon, period, or shorter dash that fits
  the sentence.
- `WPD022` blocks repeated visible headings with the same level and text in one
  surface, repeated top-level banner or contentinfo landmarks in one app shell,
  and more than one icon-only close control in one visible dialog. Markdown
  uses the same normalized heading rule outside fenced code.
- `WPD023` requires executable light and dark browser checks whenever a select,
  combobox, or listbox exists. Test enabled current values and options at 4.5:1
  text contrast or better, require a nonzero candidate count, and confirm that
  custom popups close with Escape.

Resolve transparent backgrounds through their ancestors. Treat gradients or
unresolved colors as failures. Set `color-scheme: light dark` on the document
or theme root so native controls use the intended platform palette. Browser
evidence must enumerate every Storybook story from its runtime index. It must
not rely on a fixed story list.

The managed reporter invalidates the prior browser record when a run starts.
It writes passed evidence only after the canonical all-story audit and the full
Playwright run pass. Vue, Svelte, and Astro surfaces use the same hard rules as
HTML and React surfaces.

## Exceptions

A bypass is valid only when `.wingmanpm-design/exceptions.json` contains:

- the exact rule ID;
- a scoped target;
- a concrete reason;
- an accountable approver;
- an ISO review date that has not passed.

An exception is visible debt, not deletion of the rule. `doctor` reports invalid
and expired entries.

WPD021, WPD022, and WPD023 are global hard rules. They cannot be excepted or
absorbed into a legacy baseline.

## Completion

Report outcome, exact proof, and genuine remaining limits. A tool exit code is
not enough when authenticated or visual behavior was not observed.
