# Component and State Contract

Each implemented workflow marks its applicable states. `N/A` needs a short
reason in the surface file.

Required states: loading, empty, partial, error, success, disabled, permission,
offline, responsive.

## Coverage

- [x] Shell and navigation
- [x] Command interface and search
- [x] Forms and validation
- [x] Overlays
- [x] Settings and onboarding
- [x] Permissions, billing, paywalls, and team administration
- [x] Notifications and audit logs
- [x] File management
- [x] Tables, charts, filters, selection, and bulk actions
- [x] Transparent AI workflow with progress, sources, uncertainty, cancel,
  errors, recovery, and human approval before consequential actions

## Vocabulary

Use project-owned primitives. Do not add a second icon set, one-off button
language, or new radius scale without recording the reason in `DESIGN.md`.
