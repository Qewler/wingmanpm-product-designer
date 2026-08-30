# Cross-agent results

The evaluation is read-only. Each agent receives the same eight benchmark
decisions from `evals/benchmarks.json` and the installed private skill.

Pass requires eight valid decision records and no proposal to edit during the
review-only case. Authentication or tool startup failure is recorded as a
blocked result, not a behavioral pass.

Private-repository preservation evidence is redacted in
`private-preservation-pilot.json`. Source paths, revisions, structures, and
finding counts do not belong in the shareable repository.
