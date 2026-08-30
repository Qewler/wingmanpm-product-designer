# Tamarack FieldOps public fixture browser QA

- Product: Tamarack FieldOps by the fictional Tamarack Renewables
- Disclosure: `Concept demo` is visible on every Storybook story
- Scope: renewable operations shell, states, AI review, access, and operational patterns
- Viewports: 390, 768, 1280, 1440
- Themes: light and dark
- Reviewed: 2026-08-31
- Status: passed

## Current result

| Check | Result |
| --- | --- |
| Playwright | 20 of 20 passed; 0 failed; 0 skipped |
| Story inventory | 7 stories checked in both themes |
| Accessibility | No serious or critical axe findings |
| Keyboard and focus | Passed, including the skip link |
| Responsive layout | Passed at all four required widths |
| Reduced motion | Passed; the loading animation resolves to `none` |
| Structure | Unique headings and valid landmark ownership passed |
| Dropdown contrast | Passed; this fixture has no dropdown candidates |
| Visual review | Light, dark, desktop, tablet, and mobile images reviewed |

## Reproduce

```bash
npm ci
npm --prefix fixtures/neutral-saas ci
npm run test:fixture:storybook
npm run eval:fixtures
```

The browser job in `.github/workflows/ci.yml` copies this public fixture,
upgrades that copy, and runs the committed Playwright suite. The committed
browser evidence and review files contain the current source hash. The expected
schema-version warning remains because this fixture is also the public
version-1 migration input.
