# Version 1 publication record

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
