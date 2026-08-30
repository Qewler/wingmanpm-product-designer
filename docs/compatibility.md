# Tested compatibility

This private build was tested on 2026-08-30 with Node.js 24.18.0 and npm 11.16.

| Tool | Tested version | Result |
| --- | --- | --- |
| Storybook | 10.5.10 | Development preview and static build pass |
| Vite | 8.0.16 | Pinned; development preview passes |
| Playwright | 1.62.1 | 19 browser tests pass |
| axe-core Playwright | 4.13.0 | No violations in the tested stories |
| TypeScript | 7.0.2 | Fixture compiles through Storybook |

The fixture uses `@storybook/react-vite`. Vite is pinned because a newer Vite
8 build reproduced a React default-export failure in the Storybook development
preview. The selected version passed both the development and static paths.

References:

- [Storybook Vite configuration](https://storybook.js.org/docs/9/builders/vite)
- [Tracked Storybook and Vite compatibility failure](https://github.com/storybookjs/storybook/issues/35332)
