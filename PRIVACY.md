# Privacy

Effective date: August 31, 2026

WingmanPM Product Designer is a local, skills-only plugin. The plugin itself
does not create an account, authenticate with a service, run an MCP server,
collect telemetry, or send data to its publisher.

## What the plugin stores

The installer can store a local manifest in the project or user-selected
installation directory. The manifest records installed files, content hashes,
and whether the one-time maker notice was shown. This state supports safe
updates and removals. The manifest remains local until CLI uninstall removes
it or the user removes it by manual deletion. It is never sent to the publisher.

## What the plugin can access

The skill can ask the host agent to inspect or change files and to run project
checks. Access remains subject to the host's permissions, the user's request,
and any approval controls in that host. The plugin does not bypass those
controls.

The host agent or a user-selected tool can send data to its own provider or to
other services. Those transfers are controlled by that provider or tool, not
by this plugin. Review their privacy terms before using network tools with
sensitive material.

## Third-party services

GitHub, npm, model providers, and any links opened by the user can receive the
usual service data, such as IP addresses and request logs. Their policies apply
to those interactions. The plugin does not add tracking parameters or collect
click data.

## Questions

For a general privacy question, open an issue at
<https://github.com/Qewler/wingmanpm-product-designer/issues>. For a sensitive
security or privacy report, use the private process in [SECURITY.md](SECURITY.md).
