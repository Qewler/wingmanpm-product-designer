# Data tables

Read this reference for `data-table` / `table` work. A table is a task surface,
not a decorated list. Preserve an established capable grid, its data contract,
and its product-specific behavior before introducing a new engine.

## Choose the smallest honest profile

- **Static:** comparison, reporting, audit, or reference content. Use a native
  table and do not add grid controls that the task does not need.
- **Work:** repeated operational decisions. Add density, sort and filter,
  visibility, order, sizing, pagination, expansion, selection, and bulk actions
  only where the data supports them.
- **Editable:** a work table whose primary task includes changing cell values.
  Do not infer editing from a user's desire for a better-looking table.

Record the decision in `design-system/tables/<table-id>.json`. Table IDs and
column IDs are stable product identifiers; labels can change without losing a
saved view.

## Preserve or scaffold

1. Inspect dependencies, shared components, routes, data loading, permissions,
   and existing table behavior.
2. If the project has a capable grid, extend it. Do not install a parallel
   table engine.
3. For React without a capable grid, scaffold the project-owned Wingman table
   kit. It uses TanStack Table as a headless row/cell engine and dnd kit behind
   an internal reorder adapter. The application owns markup, visual language,
   persistence, and accessibility.
4. For other stacks, create the contract plus the semantic HTML/CSS reference,
   then implement with the project's established primitives.

Virtualize only after measuring a real rendering problem. Keep headers,
keyboard focus, row height, and screen-reader position truthful when doing so.
The opt-in 10,000-row lab lives in `templates/data-table/optional/`; it is not
copied by `init` or `add data-table` and must not become a production default.

## Table anatomy

- Put search and high-frequency filters before view controls.
- Let labels wrap. A tooltip can explain a term; it must not hide a clipped
  header that could have wrapped.
- Align text and dates to the logical start, numeric data to the logical end,
  and short statuses consistently.
- Use 36 px dense rows and 48 px comfortable rows as starting targets. Prefer
  comfortable mode for coarse pointers. Persist the user's choice.
- Keep selection, disclosure, identity, and row-action columns protected when
  hiding or moving them would break the task.
- Keep the primary identifier visible on narrow screens. Move secondary values
  into row details or a labeled compact presentation instead of crushing every
  column.

## Interaction invariants

### Column visibility and order

- A column manager lists the visible state and current order.
- Drag reorder is an enhancement. Also provide Move to start, Move left, Move
  right, and Move to end controls usable with a single pointer and keyboard.
- Announce the resulting position. Do not rely on spatial animation to explain
  the change.

### Column sizing

- A resize separator exposes its label, current width, minimum, and maximum.
- Arrow keys move 8 px; Shift+Arrow moves 32 px; Home and End use the minimum
  and maximum. Provide compact, default, and wide presets in the column manager.
- Resizing must not trigger sorting. During pointer resize, update only the
  affected column and keep interaction responsive.

### Complete values and help

- Meaning is always reachable by keyboard, touch, and pointer.
- Wrap important identifiers. When compact cells use ellipsis, reveal the full
  value through a focusable custom tooltip or row details.
- Tooltips are non-interactive, portaled when clipping is possible, dismiss on
  Escape, and open on focus as well as hover. Use a popover when the content has
  links, controls, or multiple actions.

### Pagination and selection

- Client and offset pagination show the visible range and truthful total.
- Cursor pagination shows Previous and Next only; never invent totals or page
  numbers.
- Client mode can apply search and structured filters locally. Offset and
  cursor modes send controlled query, sort, and filter values to the server;
  never filter only the loaded page while keeping a global total.
- Keep page selection separate from "all filtered results." State the scope in
  the bulk bar and pass the query, sort, filters, excluded IDs, and total to the
  action handler.
- Preserve the current rows and focus during background loads. Do not blank the
  table to show progress.

### Expansion, bulk work, and editing

- Expansion uses a disclosure button with `aria-expanded` and `aria-controls`.
  The detail row spans the visible columns and remains useful on mobile.
- A sticky bulk bar shows the selection count, clear action, progress, partial
  failures, permissions, and safe destructive confirmation when applicable.
- Work and editable public props require expansion, at least one bulk action,
  and a real bulk handler. Editable props also require a commit handler. Missing
  runtime handlers are configuration errors, never simulated success.
- Editable cells have an explicit edit affordance. Enter or F2 starts editing,
  Enter commits, Escape cancels, and Tab follows the product's form behavior.
- Keep original and draft values separate. Invalid or rejected values stay in
  the editor with an associated message. Cover saving, saved, retry, conflict,
  permission, offline, and safe undo behavior.

Never persist selected rows, drafts, errors, or the active editor. Prefer an
existing account or workspace settings API for density, order, visibility, and
widths; otherwise use the versioned local-storage adapter and provide Reset
view.

## Semantics and motion

Use native `<table>` semantics by default. Use `role="grid"` only when the
surface implements a complete composite focus model: one tab stop, roving cell
focus, arrow navigation, Home/End behavior, editing entry and exit, and focus
restoration. A native table with controls inside cells is often the better SaaS
choice.

Keep repeated state feedback between 90 and 180 ms. Do not scale rows. Reduced
motion removes spatial travel while preserving selection, sort, save, and error
meaning.

## Required evidence

Cover loading, empty, no-results, partial, stale, error, permission, offline,
saving, and success states. Review dense and comfortable modes, long localized
content, light and dark themes, reduced motion, 200% and 400% zoom, and widths
390, 768, 1280, and 1440. Verify mouse, touch, and keyboard alternatives for
reorder and resize. The contract points to its Storybook stories, browser tests,
and `.wingmanpm-design/review.json`.

Sources: [WAI table pattern](https://www.w3.org/WAI/ARIA/apg/patterns/table/),
[WAI grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/),
[WCAG 2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements),
[TanStack Table](https://tanstack.com/table/latest), and
[dnd kit React](https://dndkit.com/react/quickstart/).
