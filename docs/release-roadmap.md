# Private release roadmap

## Current gate

This repository stays private until the behavioral benchmark passes in Codex,
Claude Code, and Cursor against both the neutral fixture and an isolated
private preservation fixture.

Current result on 2026-08-30:

- Codex passed all 8 behavioral cases.
- The neutral fixture passed build, browser, accessibility, theme, and motion checks.
- The isolated private preserve-mode pilot passed and the worktree was removed.
- Shareable Claude Code and Cursor results are not recorded yet, so the public
  release gate remains closed.

## Later publication

- Private GitHub repository: `Qewler/wingmanpm-product-designer`.
- Keep repository visibility private until the full cross-agent gate passes.
- Review the Apache 2.0 NOTICE and source citations before changing visibility.
- Reserve npm publication for a later release.
- Preferred future package name: `wingmanpm-product-designer`.
- Do not mix this release reminder into `SKILL.md` or generated design rules.
