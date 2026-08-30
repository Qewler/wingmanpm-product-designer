# Cross-agent results

The evaluation is read-only. Each agent receives the same fourteen benchmark
decisions from `evals/benchmarks.json` and the installed release candidate.

Pass requires fourteen valid decision records and no proposal to edit during the
review-only case. Authentication or tool startup failure is recorded as a
blocked result, not a behavioral pass.

A valid decision result proves routing and judgment only. It does not override
the browser, cross-agent, npm, or publication gates.

Current host record:

- Codex: command benchmark passed 14/14. The isolated implementation passed
  21/21 static checks and live browser proof after two focused repair iterations.
- Claude Code 2.1.251: live behavior and implementation runs were waived by the
  user. Strict plugin validation passed.
- Cursor 3.17.12: authenticated, but the two model calls await explicit consent
  to send the public skill and evaluation inputs to Cursor.

The Cursor and npm gates remain closed.

All repository evaluation evidence comes from the committed public fixture.
`public-fixture-validation.json` records the exact commands and results needed
to reproduce that proof without access to another repository.
