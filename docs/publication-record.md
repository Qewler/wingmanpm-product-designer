# Version 1 publication record

Last updated: August 31, 2026

Version: `1.0.0`

Publisher: Julius / Qewler

License: Apache-2.0

Release gate: closed until the authenticated Claude Code and Cursor tests pass

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
| Public fixture browser suite | Passed 20 of 20 |
| Canonical skill and plugin manifests | Passed |
| Agent Plugins and Agent Skills discovery | One plugin and one skill found |
| Claude plugin structure | Strict validation passed |
| Codex marketplace lifecycle | Listed, installed, enabled, and removed at 1.0.0 |
| npm archive on macOS and Node 24 | Full clean lifecycle passed |
| Readme image payload | 0.20 MB, below the 3.5 MB limit |
| Dependency audit | No known vulnerability in root, fixture, or showcase lockfiles |
| Claude Code behavior and implementation | Blocked by host authentication |
| Cursor behavior and implementation | Blocked by host authentication |
| Hosted cross-platform CI | Pending first private push |

Update this record after each public action. Do not mark a submitted listing as
published until its public page and clean install are verified.
