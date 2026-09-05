# Compatibility and current evidence

Version `1.0.0` was released and checked on 2026-08-31 with Node.js 24.18.0
and npm 11.16.0. Public evidence comes only from the committed Tamarack
FieldOps fixture, which is always marked `Concept demo`.

| Check | Current evidence |
| --- | --- |
| Command benchmark | Historical Codex text contract matched 14 of 14; this is not a behavioral quality score |
| Isolated Codex implementation | Passed 21 of 21 static checks plus responsive, theme, reduced-motion, approval, focus-return, and browser-error proof after two focused repair iterations |
| Fixture migration | Public version-1 fixture upgrade stayed idempotent and kept the browser-evidence gate active |
| Storybook | Static build passed for all 7 base stories |
| Browser proof | Chromium passed 20 of 20; 0 failed; 0 skipped |
| Accessibility | No serious or critical axe findings in light or dark |
| Responsive proof | 390, 768, 1280, and 1440 pixel baselines reviewed |
| Structure and contrast | WPD022 and WPD023 passed across every base story in both themes |
| Design check | 0 blocks; one expected version-1 migration warning |
| npm archive | Clean lifecycle passed on Node 20, 22, 24 and Linux, macOS, Windows for install, repeat install, init, upgrade, changed-file protection, and uninstall |
| Codex marketplace | Public marketplace listed, installed at 1.0.0, enabled, and verified cleanly |
| Hosted CI | [Final release matrix passed](https://github.com/Qewler/wingmanpm-product-designer/actions/runs/33345388217) |

The machine-readable record is
[`evals/results/public-fixture-validation.json`](../evals/results/public-fixture-validation.json).

## Agent interface

Version 1.1.0 uses one skill and 19 command families, including `explore`. The version-1.0 evidence in this document remains historical.

The 1.1.0 PR passed all 10 CI jobs: Node 20/22/24, generated fixture browser
checks, public showcase, and package lifecycles on Linux, macOS, and Windows.
It passed 119 regression tests, 14 routing fixtures, and full skills.sh copy
and symlink installs with all 88 portable files. For current publication and
marketplace states, see [the publication record](publication-record.md).

| Host | Explicit form | Current host benchmark |
| --- | --- | --- |
| Codex | `$wingmanpm-product-designer <intent> [target]` | Historical text contract plus isolated build |
| Claude Code | `/wingmanpm-product-designer <intent> [target]` | Live run deferred by user; strict plugin validation passed |
| Cursor | `/wingmanpm-product-designer <intent> [target]` | Live run deferred by user; authenticated CLI confirmed |

Explicit invocations and ordinary refinement requests act within their bounded
scope. `explore` and unresolved `reimagine` requests show visual directions
before a replacement is built. `review` and `audit` remain
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

## Publication status

GitHub `v1.1.0`, public-repository skills.sh installs, and the direct Codex and
Claude marketplace installs are verified. Existing standalone skills, including
Cursor, are updated to `1.1.0`. npm `1.1.0` is staged and awaits owner approval;
public `latest` is still `1.0.0` at the recorded check.

Reviewed catalog approval is separate from direct installation. See the
[current publication record](publication-record.md) for Claude, Cursor, OpenAI,
and the exact remaining authentication or approval steps. Deferred live Claude
and Cursor behavior benchmarks are not reported as passes.
