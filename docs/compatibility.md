# Compatibility and current evidence

The `1.0.0` release candidate was checked on 2026-08-31 with Node.js 24.18.0
and npm 11.16.0. Public evidence comes only from the committed Tamarack
FieldOps fixture, which is always marked `Concept demo`.

| Check | Current evidence |
| --- | --- |
| Command benchmark | Codex passed 14 of 14 routing and judgment cases |
| Fixture migration | Public version-1 fixture upgrade stayed idempotent and kept the browser-evidence gate active |
| Storybook | Static build passed for all 7 base stories |
| Browser proof | Chromium passed 20 of 20; 0 failed; 0 skipped |
| Accessibility | No serious or critical axe findings in light or dark |
| Responsive proof | 390, 768, 1280, and 1440 pixel baselines reviewed |
| Structure and contrast | WPD022 and WPD023 passed across every base story in both themes |
| Design check | 0 blocks; one expected version-1 migration warning |
| npm archive | Clean macOS and Node 24 lifecycle passed for install, repeat install, init, upgrade, changed-file protection, and uninstall |
| Codex marketplace | Local release candidate listed, installed at 1.0.0, enabled, and removed cleanly |

The machine-readable record is
[`evals/results/public-fixture-validation.json`](../evals/results/public-fixture-validation.json).

## Agent interface

All supported hosts use the same skill and 18 command families.

| Host | Explicit form | Current host benchmark |
| --- | --- | --- |
| Codex | `$wingmanpm-product-designer <intent> [target]` | Passed 14 of 14 |
| Claude Code | `/wingmanpm-product-designer <intent> [target]` | Pending authenticated release run |
| Cursor | `/wingmanpm-product-designer <intent> [target]` | Pending authenticated release run |

Explicit invocations and requests with a selected `refine`, `elevate`, or
`reimagine` level act directly. Free-form requests for `beautiful`, `stunning`,
or `pimp it up` first show the three-level choice. `review` and `audit` remain
read-only unless the user asks for changes or supplies `--fix`.

## Project compatibility

- Version-1 initialized projects remain supported migration inputs.
- `npx wingmanpm-product-designer@latest upgrade --project <root>` refreshes unchanged managed assets,
  preserves user and seeded files, and is idempotent.
- React projects can add `static`, `work`, or `editable` table profiles.
- Projects with an established capable grid keep that grid instead of gaining a
  parallel table engine.
- Framework-neutral projects receive semantic HTML and CSS references.
- Node.js 20, 22, and 24 are the release CI targets.

## Publication gate

The public fixture, package layout, local archive lifecycle, and local Codex
marketplace proof are green. Publication still requires the hosted Node 20, 22,
24 and Linux, macOS, Windows CI jobs plus authenticated Claude Code and Cursor
behavior runs. Reviewed directories stay listed as `submitted` until their
public pages are visible.
