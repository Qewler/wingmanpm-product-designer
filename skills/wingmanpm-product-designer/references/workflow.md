# Small context and scoped proof

The host owns tools, permissions, scheduling, and conversation. This runtime owns
local design artifacts and measured checks. No cloud service, API key, other
skill, or model call is needed by the runtime.

## Context

Run `context --request "<task>" --target "<exact file>"` once per task. It returns
hashes and paths for authoritative documents, relevant scripts, the resolved
intent, scope, and up to three relevant saved decisions. The read-only context collector does not load or
summarize the entire repository. The CLI checks updates first; use `--no-update`
when the task forbids changes. Read changed authority files and relevant source
on demand. Inspect the host's actual tools before assuming browser, image, or
independent-review capabilities. Unknown means unknown, not unavailable.

The saved exploration record holds target, question, identity, content basis,
options, immutable preview hashes, selected option, reason, and stage. Use it as
a short design decision, not a transcript or global taste memory. Scope all
inferences to this product and surface.

## Evidence scope

`proof --target "<file>"` returns the import closure, reverse consumers, affected
stories, shared inputs, and source hash. It includes package/lock files, shared
tokens, public assets, and test configuration. Unresolved aliases or dynamic
imports widen the plan to the project. Review the warnings. An unrelated root
Markdown note does not invalidate design evidence.

To measure a project command, put its executable and separate arguments in JSON:

```json
["npm", "run", "test", "--", "Review.test.tsx"]
```

Then run `proof --target "src/Review.tsx" --command-file .tmp/proof-command.json`.
The process uses the project's cwd without a shell. It stores exit status,
command, output hash, bounded local log, timestamps, and source hash. A source change during the
command invalidates the result. Use a meaningful test command; an exit code
cannot prove visual quality, task success, or accessibility on its own.

`check --stage build --target "src/Review.tsx"` reports the scoped source checks
and freshness of the latest command result. Visual and interaction review remain
explicit pending work. The full shipping gate still uses machine-written browser
evidence and review confirmations. A partial command record cannot satisfy it.

## Efficient review

Capture the relevant desktop and mobile states together. Use detail crops when
needed, inspect once, batch material fixes, and confirm. Preserve known good
assets and components. Do not repeat setup or unchanged checks. Broaden tests
when shared inputs change or the dependency plan is uncertain.

An independent reviewer helps consequential or complex work when the host
supports delegation and its use is authorized. Give it the original brief,
constraints, artifacts, and evidence, without the builder's conclusions. Where
unavailable, disclose an in-thread review. Neither path can invent observations.
