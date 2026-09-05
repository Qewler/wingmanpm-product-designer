Use the installed WingmanPM Product Designer skill to complete the supplied
scenario in its isolated workspace. Preserve the specified scope. For reviews,
do not change files. For exploration, create comparable local artifacts and wait
for the user's choice before changing production UI. Name remaining proof gaps.

Run each host with `record-agent-run.mjs` and a run spec declaring workspace,
command (executable plus argument array), scenario, readOnly, allowedPaths, and
requiredArtifacts. Write the result outside the workspace. The recorder measures
before/after file hashes, filesystem write events, exit status, output hash,
and elapsed time. A watcher gap is unverified, not a passing read-only result. Tokens are null
unless separately measured by the host; do not estimate them as observed usage.
Validate the record with `validate-agent-result.mjs`.

Use the same task, data, tools, model, and initial workspace when comparing skill
versions. Use repeated trials. Blind visual reviewers to the tool name and score
task success, craft, identity fit, distinct options, responsive behavior, and
accessibility. Record their evidence separately. Execution-contract success does
not establish design quality. Paid model runs require a chosen scope and budget.
