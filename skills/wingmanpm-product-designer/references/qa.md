# Review and verification

## Read-only reviews

Review and audit do not edit unless the user requests fixes or supplies `--fix`.
Use a compact Before | After | Why table with source, DOM, screenshot, or test
evidence. Separate confirmed defects from design preference. Lead with impact.

## Stage-specific proof

Exploration follows [explore.md](explore.md): polished comparable slices, basic
responsive and keyboard review, honest mock behavior, tradeoffs, and selection.
No full-system scaffold or production certificate is needed.

Build uses [workflow.md](workflow.md): the selected surface, relevant states,
scoped source checks, and meaningful test commands. A command exit code is only
command evidence. Complete visual and interaction review separately.

Ship requires the project's design check, relevant Storybook interactions,
Chromium review at 390, 768, 1280, and 1440 CSS pixels, keyboard use, visible focus,
200% zoom, reduced motion, long content, required themes, workflow states, and
no serious or critical axe issue. Modals return focus after Escape, Cancel,
close, and success; test actual browser cancel and close events. Existing
machine-written `.wingmanpm-design/browser-evidence.json` must be fresh and pass
before the full review can be recorded. Scoped command proof never replaces it.
The current full gate audits every story; scoped build checks do not claim that
coverage. Missing authenticated or observed visual proof is a stated limit.

## Policy and judgment

- WPD009 card counts, WPD004 raw colors, and WPD005 motion-source patterns are
  advisory. Inspect context and the rendered result before proposing a fix.
- Four direction axes are optional. If recorded, values must be in range.
- WPD021 punctuation is a house preference. Configure `policy.punctuation` as
  `off`, `warn` (default), or `block` in `.wingmanpm-design/config.json`.
- Repeated heading text can be valid in separate content regions. Configure
  `policy.uniqueHeadings` with the same choices. Source detection warns by
  default; browser heading rejection is enabled only by `block`.
- WPD022 still protects shell landmarks and dialog controls. WPD023 still needs
  observed dropdown contrast and Escape behavior. Source-only tests are not proof.

For uncertain gradient or composited contrast, measure the rendered pixels or
use an appropriate contrast method. The current automated gate fails unresolved
colors; resolve the evidence gap rather than claiming a measured failure or pass.

Exceptions name the rule, scoped target, reason, approver, and a valid review
date in `.wingmanpm-design/exceptions.json`. Accessibility evidence gates cannot
be hidden in a legacy baseline. Project copy policy can be configured directly;
a global typography preference does not override user-supplied legal content.

Batch inspection, repair material issues, and confirm. Bound cosmetic iteration,
not correctness. Do not claim completion while required checks fail. Report
outcome, observed proof, remaining gaps, and unexpected baseline changes.
