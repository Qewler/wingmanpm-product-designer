# Version 1 release roadmap

## Current gate

The public Tamarack FieldOps `Concept demo` fixture now replaces all private or
redacted preservation evidence. Its contract benchmark, Storybook build,
20-test browser suite, accessibility checks, four responsive baselines, light
and dark themes, and visual review pass.

The release remains gated until:

- Cursor receives explicit consent for the two public-payload model calls and
  passes the same 14 decision cases plus one isolated design implementation.
- Claude Code remains recorded as user-waived rather than passed.
- The final history, secret, local-path, package-content, and image-metadata
  scans pass.

## Publication order

1. Make `Qewler/wingmanpm-product-designer` public and create tag `v1.0.0`.
2. Publish the GitHub release archives and checksums.
3. Publish `wingmanpm-product-designer@1.0.0` to npm with two-factor approval.
4. Verify the automatic skills.sh page after one public `npx skills add` run.
5. Verify direct Codex and Claude Code marketplace installation from GitHub.
6. Submit the promotion-free skill archive to OpenAI.
7. Submit the plugin to Claude's community marketplace and Cursor Marketplace.
8. Record each public URL, version, review state, and verified install command.

The release plan is approved. Authenticated publisher actions are still needed
for repository visibility, npm publication, and external marketplace
submissions. Promotion stays out of agent answers and portable review bundles.
