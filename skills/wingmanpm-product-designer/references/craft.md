# Minimum rendered craft

Apply this floor to every UI deliverable, including quick polish and throwaway
variants. It is smaller than the shipping gate, not optional because work is a
prototype. Before editing, note the existing navigation, main actions, content,
and brand rules. Preserve them unless the brief authorizes a change.

- Measure text contrast against its actual background: at least 4.5:1 for normal
  text; 3:1 for text at least 24 CSS px, or 18.67 px bold. Aim for 5:1 for small
  secondary labels so a subtle palette change does not break the minimum.
  Muted text still carries information. Inactive controls and logos are separate
  cases. Do not guess ratios from screenshots or round a failing ratio up.
- At mobile width, retain every route and task action through a visible control
  or a keyboard-operable menu. Hiding a desktop row is not a mobile design.
  Open the replacement menu and follow a route. Preserve clear current location.
- Align related controls to a shared height and baseline. Test real long labels,
  wrapped toolbars, selected states, empty states, and one error or hard state.
  Do not crop labels to make an attractive screenshot.
- Use actual keyboard focus, Enter, Tab, and Escape on the main flow. Keep focus
  visible, restore it after overlays, and make state changes clear in words.

After rendering, use the host's browser and accessibility checks, or this small
helper with an existing project/host Playwright installation:

```text
craft --file .tmp/variant-a.html --out .tmp/craft-a.json --json
craft --url http://127.0.0.1:3000 --json
```

An existing Playwright module can be passed with `--browser-module <path>`.
For authenticated local work, use the host browser or an existing session via
`--cdp <loopback-url>`. Do not create a logged-out substitute for authenticated QA.
No browser dependency is installed automatically. Missing browser proof reports
`unverified` (exit 2); observed failures report `failed` (exit 1).

The helper checks rendered solid text contrast, document overflow, runtime
errors, and observed desktop/mobile navigation at 1440 and 390 CSS px. It does
not certify WCAG compliance. Gradients, images, blending, SVG, canvas, and custom
navigation need host browser proof. Inspect the report; fix real failures and
recheck affected views. A heuristic warning can be resolved with explicit proof
of the equivalent behavior, not by deleting the test or weakening the design.

References: [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
and [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
