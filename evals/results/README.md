# Evaluation evidence

New runs use `evals/record-agent-run.mjs` and observed before/after file hashes.
The validator rejects legacy word-match JSON. Successful execution proves the
recorded scope and artifact contract only; visual quality needs separate review.

## Historical version 1 evidence


The evaluation is read-only. Each agent receives the same fourteen benchmark
decisions from `evals/benchmarks.json` and the installed version `1.0.0` skill.

Pass requires fourteen valid decision records and no proposal to edit during the
review-only case. Authentication or tool startup failure is recorded as a
blocked result, not a behavioral pass.

A valid decision result proves keyword coverage only. It does not override
the browser, cross-agent, npm, or publication gates.

Current host record:

- Codex: legacy text contract matched 14/14. The isolated implementation passed
  21/21 static checks and live browser proof after two focused repair iterations.
- Claude Code 2.1.251: live behavior and implementation runs were deferred by
  the user until after publication. Strict plugin validation passed.
- Cursor 3.17.12: authenticated, but live behavior and implementation runs were
  deferred by the user until after publication. No Cursor model call was made.

Public version `1.0.0` was released with those two live checks recorded as
deferred, not passed.

All repository evaluation evidence comes from the committed public fixture.
`public-fixture-validation.json` records the exact commands and results needed
to reproduce that proof without access to another repository.
