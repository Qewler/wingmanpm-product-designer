# Version 1 publication record

Last updated: August 31, 2026

Version: `1.0.0`

Publisher: Julius / Qewler

License: Apache-2.0

Release gate: closed until the two Cursor model calls receive explicit consent and pass

## Public destinations

| Destination | URL | State |
| --- | --- | --- |
| GitHub | <https://github.com/Qewler/wingmanpm-product-designer> | Private release candidate |
| npm | <https://www.npmjs.com/package/wingmanpm-product-designer> | Not published |
| skills.sh | Listing URL pending discovery after the repository is public | Not triggered |
| OpenAI | Review URL assigned after submission | Ad-free archive validated; not submitted |
| Claude community marketplace | Listing URL assigned after submission | Manifest validated; not submitted |
| Cursor Marketplace | Listing URL assigned after submission | Root Agent Plugin ready; not submitted |

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

## Verified release-candidate proof

| Check | Result |
| --- | --- |
| Codex behavior decisions | Passed 14 of 14 |
| Codex isolated implementation | Passed 21 of 21 plus live browser proof after two focused repair iterations |
| Public fixture browser suite | Passed 20 of 20 |
| Canonical skill and plugin manifests | Passed |
| Agent Plugins and Agent Skills discovery | One plugin and one skill found |
| Claude plugin structure | Strict validation passed |
| Codex marketplace lifecycle | Listed, installed, enabled, and removed at 1.0.0 |
| npm archive matrix | Full clean lifecycle passed on Node 20, 22, 24 and Linux, macOS, Windows |
| Readme image payload | 0.20 MB, below the 3.5 MB limit |
| Dependency audit | No known vulnerability in root, fixture, or showcase lockfiles |
| Claude Code behavior and implementation | User waived; strict plugin validation passed |
| Cursor behavior and implementation | Authenticated; explicit public-payload consent pending |
| Hosted cross-platform CI | [Passed](https://github.com/Qewler/wingmanpm-product-designer/actions/runs/33340951433) |

Update this record after each public action. Do not mark a submitted listing as
published until its public page and clean install are verified.
