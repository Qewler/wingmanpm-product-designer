# Compatibility and current evidence

This private `0.2.0-private.2` build was tested on 2026-08-30 with Node.js
24.18.0 and npm 11.16.

| Check | Tool or version | Current evidence |
| --- | --- | --- |
| Repository tests | Node.js 24.18.0 | 67/67 passed |
| Command benchmark | Codex | 14/14 decision scenarios pass |
| Generated TypeScript | TypeScript 7.0.2 | Strict generated-fixture TSC passed |
| Story inventory | Storybook 10.5.10 | Build passed with 59 total stories: 52 generated profile stories plus 7 base stories |
| Browser proof | Playwright 1.62.1 | Local Chromium passed 84/84 in 2.0 minutes, with 0 failed, 0 skipped, 1,056 dropdown candidates, and all 4 expected specs |
| Design check | `wingman-design check` | 0 blocks; one WPD014 performance warning |
| Project doctor | `wingman-design doctor` | 0 failures; one expected no-Git-hook warning in the non-Git temp project |
| Builder | Vite 8.0.16 | Pinned for the checked-in Storybook configuration |

## Agent command interface

The portable entry point remains one `wingmanpm-product-designer` skill.

| Agent | Explicit form | Result |
| --- | --- | --- |
| Codex | `$wingmanpm-product-designer <intent> [target]` | Acts directly |
| Claude Code | `/wingmanpm-product-designer <intent> [target]` | Acts directly |
| Cursor | `/wingmanpm-product-designer <intent> [target]` | Acts directly |

Host benchmark status is separate from command compatibility:

- Codex command benchmark: passed 14/14.
- Claude Code 2.1.241: blocked by authentication; benchmark not run.
- Cursor 3.17.12: blocked by authentication; benchmark not run.

All three use the same 18 command families, aliases, and `refine`, `elevate`,
or `reimagine` level contract. Free-form `beautiful`, `stunning`, and `pimp it
up` requests first show that three-level choice. Explicit invocations and
requests with a selected level do not show it again. `review` and `audit` stay
read-only unless the user asks for changes or supplies `--fix`.

The local CLI can inspect this interface without invoking an agent:

```bash
wingman-design commands --json
wingman-design explain "make this stunning" --json
```

## Project format compatibility

- A v1 initialized checkout is supported as migration input.
- `wingman-design upgrade --project <root>` writes schema version 2, refreshes
  unchanged managed assets, inventories tables, and preserves seeded and
  user-owned files.
- A repeated upgrade is idempotent. `--dry-run` reports work without mutation.
- New table behavior is opt-in through `wingman-design add data-table`.

Table profiles are portable contract values: `static`, `work`, and `editable`.
React without a capable grid receives the project-owned TanStack table kit.
React with a supported grid receives integration guidance without a parallel
engine. Framework-neutral projects receive a semantic HTML/CSS reference.

Table contracts are checked through `WPD018`, evidence through `WPD019`, and
interaction alternatives through `WPD020`. Work and editable tables add their
own required visual-review confirmations.

## Continuous browser fixture

CI uses Node 24 to upgrade the committed neutral v1 fixture and scaffold static,
work, and editable tables. It then installs the declared dependencies and
Chromium, builds Storybook once, and runs one Playwright Chromium suite across
all profiles. The full semantic, accessibility, structure, contrast, and table
suite runs on Linux. `WINGMAN_SKIP_SCREENSHOTS=1` disables only the four
cross-OS pixel screenshot assertions. Reviewed local baselines remain unchanged
and are never replaced automatically. This all-profile CI job is the repeatable
browser release gate.

The fixture uses `@storybook/react-vite`. Vite remains pinned because a newer
Vite 8 build previously reproduced a React default-export failure in the
Storybook development preview. The local proof above is a point-in-time result;
CI remains the repeatable all-profile browser release gate.

References:

- [Storybook Vite configuration](https://storybook.js.org/docs/9/builders/vite)
- [Tracked Storybook and Vite compatibility failure](https://github.com/storybookjs/storybook/issues/35332)
- [Agent Skills specification](https://agentskills.io/specification)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## Private release gate

Compatibility on one agent or fixture is not a public-release signal. The
cross-agent gate and npm gate remain closed. The repository stays private and
npm publication stays disabled until the 14-scenario benchmark passes in Codex,
Claude Code, and Cursor and the all-profile Chromium CI gate passes.
