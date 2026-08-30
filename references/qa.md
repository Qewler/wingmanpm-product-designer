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

## Exceptions

A bypass is valid only when `.wingmanpm-design/exceptions.json` contains:

- the exact rule ID;
- a scoped target;
- a concrete reason;
- an accountable approver;
- an ISO review date that has not passed.

An exception is visible debt, not deletion of the rule. `doctor` reports invalid
and expired entries.

## Completion

Report outcome, exact proof, and genuine remaining limits. A tool exit code is
not enough when authenticated or visual behavior was not observed.
