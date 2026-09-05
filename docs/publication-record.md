# Publication record

Last verified: September 5, 2026

Current code and GitHub release: `1.1.0`

Publisher: Wingman.PM / Qewler

## Current channels

| Channel | Verified state |
| --- | --- |
| GitHub | [PR #4](https://github.com/Qewler/wingmanpm-product-designer/pull/4) merged; [v1.1.0](https://github.com/Qewler/wingmanpm-product-designer/releases/tag/v1.1.0) published with all five release assets; downloaded checksums passed |
| npm | `1.1.0` staged by trusted GitHub publishing; owner approval is still required. Public `latest` remains `1.0.0` until approval succeeds |
| skills.sh | A fresh install from the public repository returned `1.1.0`, with all 88 portable files identical to the source bundle |
| Codex own marketplace | `wingmanpm-product-designer@wingmanpm` updated to `1.1.0`; publisher metadata verified as Wingman.PM / Qewler |
| Claude Code own marketplace | Updated from `1.0.0` to `1.1.0`; restart required to load the update |
| Claude reviewed catalog | Console still shows Submitted and pending review. Own-marketplace installation is separate from catalog approval |
| Cursor | Standalone installed skill updated to `1.1.0`; public marketplace approval is not verified. A previous application was submitted; no duplicate was sent |
| OpenAI directory | No separate published entry was confirmed. Organization settings show individual verification Approved, but skills-only creation still displays an identity-verification gate. Creation is paused pending clarification of the existing listing |

Existing standalone Codex, Cursor, and skills.sh-managed copies were backed up
locally and updated through their owning installers. All four skill paths,
including the Claude symlink, contain the same 88-file `1.1.0` bundle. Native
plugin caches also contain `1.1.0`; running hosts may need a restart.

## Release evidence

The release code passed all ten CI jobs, including 119 regression tests,
14 routing fixtures, the generated UI browser suite, showcase, package
lifecycles on Linux/macOS/Windows, and complete skills.sh installation checks.

The [release run](https://github.com/Qewler/wingmanpm-product-designer/actions/runs/33970329088)
built and published the GitHub assets. Its initial npm step failed because a
relative archive path was parsed as a GitHub repository. The corrected
[npm-only retry](https://github.com/Qewler/wingmanpm-product-designer/actions/runs/33971555094)
staged the checksum-verified existing archive successfully, without rebuilding
or replacing the public assets.

The npm stage ID is `1abcd981-0880-40eb-887b-ba772a1a7cb0`; its SHA-1 is
`d790a18be20cc77c94a0123cac80cf3974f38d73`. The owner can approve it in
[npm Staged Packages](https://www.npmjs.com/settings/qewler/staged-packages).
At the last attempt, npm redirected approval to a 2FA configuration notice
despite an existing security key. Publication is not marked complete.

Historical records below describe earlier checkpoints, not current availability.

## Historical version 1.0.0 publication record

Last updated: August 31, 2026

Version: `1.0.0`

Publisher: Julius / Qewler

License: Apache-2.0

Release status: public v1 released; Claude Code and Cursor live behavior tests remain explicitly deferred

## Public destinations

| Destination | URL | State |
| --- | --- | --- |
| GitHub | <https://github.com/Qewler/wingmanpm-product-designer/releases/tag/v1.0.0> | Public release `v1.0.0` |
| npm | <https://www.npmjs.com/package/wingmanpm-product-designer> | Public package `1.0.0` |
| skills.sh | <https://www.skills.sh/qewler/wingmanpm-product-designer/wingmanpm-product-designer> | Live listing |
| Codex | <https://github.com/Qewler/wingmanpm-product-designer> | Clean public install passed |
| Claude Code | <https://github.com/Qewler/wingmanpm-product-designer> | Clean public install passed; community marketplace review pending |
| Cursor Marketplace | Public listing URL assigned after approval | Submitted; review pending |
| OpenAI | Submission available after developer identity verification | Ad-free archive ready; identity verification is the only blocker |

## Install commands

```bash
npx plugins add Qewler/wingmanpm-product-designer
npx skills add Qewler/wingmanpm-product-designer --skill wingmanpm-product-designer
codex plugin marketplace add Qewler/wingmanpm-product-designer
codex plugin add wingmanpm-product-designer@wingmanpm
claude plugin marketplace add Qewler/wingmanpm-product-designer
claude plugin install wingmanpm-product-designer@wingmanpm
npx wingmanpm-product-designer@latest install --agent all
```

## Verified public-release proof

| Check | Result |
| --- | --- |
| Codex behavior decisions | Passed 14 of 14 |
| Codex isolated implementation | Passed 21 of 21 plus live browser proof after two focused repair iterations |
| Public fixture browser suite | Passed 20 of 20 |
| Canonical skill and plugin manifests | Passed |
| Agent Plugins and Agent Skills discovery | One plugin and one skill found |
| Claude plugin structure | Strict validation passed |
| Codex public install lifecycle | Installed cleanly from the public repository at 1.0.0 |
| Claude Code public install lifecycle | Installed cleanly from the public repository at 1.0.0 |
| npm archive matrix | Full clean lifecycle passed on Node 20, 22, 24 and Linux, macOS, Windows |
| npm trusted publishing | Configured as a guarded stage-only workflow; it cannot run without the explicit manual input and repository variable |
| Readme image payload | 0.20 MB, below the 3.5 MB limit |
| Dependency audit | No known vulnerability in root, fixture, or showcase lockfiles |
| Claude Code behavior and implementation | Deferred by user; not marked passed |
| Cursor behavior and implementation | Deferred by user; not marked passed |
| Final release workflow | [Passed](https://github.com/Qewler/wingmanpm-product-designer/actions/runs/33345388217) |

Claude community marketplace and Cursor Marketplace are submitted but remain
pending until their public listings are approved and verified. OpenAI remains
blocked only by developer identity verification. Do not mark a reviewed channel
as published until its public page and clean install are verified.

## September 5 pre-release distribution check (historical)

The public v1 record above is historical. On September 5, 2026:

- Claude Console showed **Submitted and pending review**, submitted five days ago.
- The plugin was absent from both Anthropic's official catalog (291 entries) and
  community catalog (2,282 entries).
- The local Claude install was enabled as
  `wingmanpm-product-designer@wingmanpm`, version 1.0.0, from this repository's
  own marketplace. This does not establish Anthropic catalog approval.
- The working copy now uses **Wingman.PM / Qewler** as its publisher display name.
  That metadata has not been published and does not yet change installed copies.

The current status can be checked in
[Claude Console submissions](https://platform.claude.com/plugins/submissions).
The community catalog is a
[reviewed, nightly-synced mirror](https://github.com/anthropics/claude-plugins-community).
Do not send a duplicate submission while this one is pending.
