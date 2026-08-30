# Neutral fixture browser QA

- Target: Storybook at `http://127.0.0.1:6006`
- Scope: generated SaaS shell, data, state, AI, and account stories
- Viewports: 390, 768, 1280, 1440
- Themes: light and dark
- Motion: normal and reduced
- Status: passed

## Summary

| Severity | Count |
| --- | ---: |
| Critical | 0 |
| High | 3 |
| Medium | 3 |
| Low | 0 |

## Checks

- Responsive layout: passed at 390, 768, 1280, and 1440 px
- Keyboard and focus: passed
- Accessibility tree: passed with axe in light and dark across all seven story groups
- Console errors: passed after the Vite compatibility fix
- Reduced motion: passed; computed animation is `none`
- Light and dark: passed with separately composed semantic colors

## Findings

### ISSUE-001: Serious contrast failure in the Ready status

- Severity: Medium
- Status: resolved
- Evidence: `screenshots/static-manager.png`; Storybook axe result reported
  4.41:1 for `.wpd-status-ready`, below the required 4.5:1.
- Reproduction: open the responsive shell story, open Accessibility, expand
  Color contrast.

### ISSUE-002: Storybook development preview does not render

- Severity: High
- Status: resolved
- Evidence: the preview stays on its loading skeleton; the Storybook terminal
  reports that React does not provide a default export. The static build works.
- Reproduction: run `npm run storybook`, open the responsive shell story, and
  observe the permanent loading preview.

### ISSUE-003: Storybook wrapper appeared to have horizontal overflow

- Severity: Medium
- Status: dismissed after investigation
- Evidence: `screenshots/responsive-768.png`; the hidden Storybook manager
  wrapper was wider than the viewport, but the isolated story body matched the
  viewport. The generated product shell did not overflow.
- Reproduction: compare the isolated story `body` width with the viewport and
  exclude hidden Storybook manager elements.

### ISSUE-004: Dark theme semantic colors fail WCAG AA contrast

- Severity: High
- Status: resolved
- Evidence: Playwright axe found serious failures on the eyebrow and Ready,
  In progress, and Blocked status labels in dark mode.
- Reproduction: open the responsive shell with `globals=theme:dark` and run
  axe against the isolated story.

### ISSUE-005: Standalone stories did not paint the dark canvas

- Severity: Medium
- Status: resolved
- Evidence: `screenshots/operational-dark-1280.png`; the shared `.wpd-main`
  surface now applies the canvas and text tokens directly.
- Reproduction: open the operational coverage story with `globals=theme:dark`
  outside the full application shell.

### ISSUE-006: Dark bulk-action bar used the light-theme foreground

- Severity: High
- Status: resolved
- Evidence: the full dark-theme axe pass found 2.16:1 contrast. The bar now
  uses the theme-specific brand foreground token.
- Reproduction: open the long-content story in dark mode and run axe.

### ISSUE-007: Unread dot had a prohibited ARIA label

- Severity: Medium
- Status: resolved
- Evidence: the dot is now decorative and the unread state is present as
  screen-reader text in the notification title.
- Reproduction: open operational coverage and run the axe ARIA rules.

## Final proof

- Playwright: 19 of 19 tests passed.
- Storybook: static build passed; the development preview rendered correctly.
- Accessibility: no axe violations in the tested light and dark stories.
- Dependency audit: 0 known vulnerabilities.
- Visual baselines: explicitly reviewed and stored for all four required widths.
