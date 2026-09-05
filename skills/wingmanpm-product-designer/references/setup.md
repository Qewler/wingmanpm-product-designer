# Project setup

Use the CLI bundled beside the loaded SKILL.md. A skills.sh repository install
includes the full folder. Do not fetch a standalone Markdown file or require
the separately published npm wrapper to use the local tools.

1. Inspect the target project, its package manager, existing test tools, and
   design configuration. Read-only review does not initialize a project.
2. When the requested implementation needs the managed design system, run
   `node "<skill-base-dir>/bin/wingman-design.mjs" init --project "<project>"`.
   Add `--mode preserve` for an existing product. Do not initialize unrelated
   projects or rerun setup for an already complete environment.
3. `init` and `add data-table` declare the packages their generated files need
   in the target's `package.json`. They preserve existing dependency versions.
   Complete the install with that project's existing package manager and
   update its lockfile. For npm, run `npm install` in the target project.
   Use the corresponding install command for pnpm, Yarn, or Bun. Do not add
   another package manager or mark declared packages as installed.
4. Before generated browser tests, install Chromium with the project's local
   Playwright CLI if the browser is absent. For npm, after package installation,
   use `npm exec --no -- playwright install chromium`. CI on Linux can need
   `--with-deps`. Use an existing authenticated browser session when the test
   needs the user's login; downloaded Chromium does not supply that login.
5. Run the target's relevant build and tests. Report a missing runtime, blocked
   package download, or missing browser as a setup gap, never a passing check.

The bundled CLI itself uses only Node built-ins. React, icons, table libraries,
Storybook, Playwright, and axe are project dependencies used only by the
matching generated workflow. Image tools and other agent skills are not
mandatory dependencies and are not installed by skills.sh.
