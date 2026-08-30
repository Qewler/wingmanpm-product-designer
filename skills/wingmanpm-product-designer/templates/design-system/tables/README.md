# Table contracts

Each production table has one `<table-id>.json` contract validated against the
WingmanPM table schema. Keep IDs stable across label and layout changes.

- `static` is semantic read-only content without irrelevant grid controls.
- `work` supports repeated data operations and saved views.
- `editable` adds explicit inline editing and complete save states.

Run `npx --yes wingmanpm-product-designer@1.0.0 add data-table --project . --profile <profile>` to create a
new contract and the correct project-owned implementation. Review the generated
assumptions before connecting live data.

The contract records interaction alternatives and evidence. A drag interaction
without move buttons, pointer resize without a keyboard separator and presets,
or a clipped value without a full-value path is incomplete.
