# Automatic updates

The CLI checks the latest stable `wingmanpm-product-designer` release on the
official npm registry when `context` starts. Writable use saves a 24-hour cache; read-only checks reuse it without writes. Offline or failed checks keep the installed skill
usable. No product content or telemetry is sent; the request names the package.

For standalone skills.sh and npm-installer copies, a newer release is downloaded
and checked against npm's SHA-512 integrity value. Only the canonical skill folder
is extracted. The file manifest and runtime version are verified before an atomic
directory swap. A backup stays outside the host's skill discovery directory.
Project files and project dependencies are not upgraded by this process.

Local additions, deletions, changed bundle files, unknown installs, and development
checkouts are preserved. It never downgrades, runs package install scripts,
installs another skill, or changes the Node runtime. A newer release that needs
a newer Node version is reported and left unapplied.

After `updated`, reload the returned SKILL.md and run context again. Do not
continue with stale instructions or assume new code loaded into the old process.
Show a short update notice; remain quiet for unchanged or cached versions.

## Host-managed plugins

- Codex uses its own `plugin marketplace upgrade wingmanpm` and targeted
  `plugin add wingmanpm-product-designer@wingmanpm` commands.
- Claude Code uses its targeted plugin update command. A host prompt or failure
  is not bypassed. The host can require a restart to load new instructions.
- Cursor's native marketplace owns its update channel and reviews plugin
  releases. Its client handles reviewed updates; private marketplaces expose
  **Enable Auto Refresh**. An npm release can precede availability in that channel.
  Do not replace Cursor's managed cache with an unreviewed npm bundle.

Native commands completing does not prove the current session loaded the new
version. Reload through the host and check again. If the host cannot update,
report the gap once and continue with the installed version.

## Controls

```text
update --check --force
update --auto
update --disable
update --enable
context --no-update --request "review the settings page"
```

`--check` and `context --no-update` do not write update state or install files.
Explicit review intents also check without writes. Set
`WINGMAN_DESIGN_AUTO_UPDATE=0` to disable checks and upgrades for the environment.
Use the local `update --disable` setting to pin a copy until explicitly enabled.

Settings and cached public release metadata live in `.wingman-update.json` inside
the installed skill. Backups live under `.wingman-updates` next to the host's
`skills` directory. Do not delete a backup without the user's authorization.

Release maintainers regenerate `bundle-manifest.json` with
`npm run bundle:manifest` after changing the portable bundle. Release validation
checks every file hash so skills.sh copies include a verifiable complete runtime.
