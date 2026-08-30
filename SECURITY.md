# Security Policy

## Supported versions

Security fixes are provided for the latest `1.x` release.

| Version | Supported |
| --- | --- |
| Latest `1.x` | Yes |
| Older releases | No |

## Report a vulnerability

Use GitHub's private vulnerability reporting form:

<https://github.com/Qewler/wingmanpm-product-designer/security/advisories/new>

Do not open a public issue for an undisclosed vulnerability. Include the
affected version, impact, reproduction steps, and any suggested fix. Remove
unrelated secrets and personal data. Reports are reviewed on a best-effort
basis; no response-time guarantee is made.

## Security model

The public plugin is skills-only. It has no MCP server, account system,
authentication flow, telemetry, remote code loader, or install-time lifecycle
script. Host permissions and user approvals remain the security boundary for
file access, shell commands, browser use, and network tools.

The command-line installer records content hashes and avoids replacing or
removing locally changed files. Users should still review package contents,
agent actions, generated changes, and dependency updates before use in a
sensitive environment.

## Disclosure

Please allow a reasonable period to investigate and prepare a fix before
public disclosure. Credit is welcome but optional; state your preference in
the report.
