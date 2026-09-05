import { watch } from 'node:fs';
import { createHash } from 'node:crypto';
import { readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export async function snapshot(directory) {
  const hashes = {};
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (['.git', 'node_modules', '.next', 'storybook-static'].includes(entry.name)) continue;
      const file = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(file);
      else if (entry.isSymbolicLink()) throw new Error('Evaluation fixtures must not contain symlinks.');
      else if (entry.isFile()) hashes[path.relative(directory, file).split(path.sep).join('/')] = createHash('sha256').update(await readFile(file)).digest('hex');
    }
  }
  await visit(directory);
  return hashes;
}

export function changedFiles(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(file => before[file] !== after[file]).sort();
}

/** Executes the supplied real command. No model is called by default. */
export async function observeRun({ workspace, command, scenario, readOnly, allowedPaths = [], requiredArtifacts = [], host = 'unspecified', model = null }) {
  const root = await realpath(workspace);
  if (!Array.isArray(command) || !command.length || command.some(v => typeof v !== 'string')) throw new Error('Command must be a non-empty argument array.');
  if (typeof readOnly !== 'boolean') throw new Error('Declare whether this scenario is read-only.');
  const before = await snapshot(root);
  const started = Date.now();
  const touched = new Set();
  let observationError = null;
  let watcher;
  try { watcher = watch(root, { recursive: true }, (_event, filename) => { const file = filename?.toString().split(path.sep).join('/'); if (file === path.basename(root)) return; if (!file || !/^(?:\.git|node_modules|\.next|storybook-static)(?:\/|$)/.test(file)) touched.add(file ?? '(unknown)'); }); } catch (error) { observationError = error.message; }
  const result = spawnSync(command[0], command.slice(1), { cwd: root, shell: false, encoding: 'utf8', timeout: 900_000, maxBuffer: 16 * 1024 * 1024 });
  await new Promise(resolve => setTimeout(resolve, 50));
  watcher?.close();
  const after = await snapshot(root);
  return { schemaVersion: 2, kind: 'observed-execution', scenario, host, model, command, readOnly, allowedPaths, requiredArtifacts, before, after, touched: [...touched].sort(), observationError, exitCode: result.status, error: result.error?.message ?? null, outputHash: createHash('sha256').update(result.stdout ?? '').update(result.stderr ?? '').digest('hex'), elapsedMs: Date.now() - started, tokens: null, completedAt: new Date().toISOString() };
}

export function validateObservedRun(record) {
  const failures = [];
  if (record?.schemaVersion !== 2 || record.kind !== 'observed-execution') throw new Error('Legacy word-match results are not behavioral evidence. Record an observed run first.');
  if (!record.scenario || typeof record.readOnly !== 'boolean' || !Array.isArray(record.command) || !record.command.length) failures.push('Missing scenario, command, or read-only contract.');
  for (const key of ['before', 'after']) {
    if (!record[key] || typeof record[key] !== 'object' || Array.isArray(record[key]) || Object.entries(record[key]).some(([file, hash]) => !file || path.isAbsolute(file) || file.split('/').includes('..') || !/^[a-f0-9]{64}$/.test(hash))) failures.push(`Invalid ${key} snapshot.`);
  }
  if (failures.length) throw new Error(failures.join('\n'));
  if (record.exitCode !== 0 || record.error) failures.push('Execution did not finish successfully.');
  if (!Array.isArray(record.touched) || record.observationError) failures.push('Filesystem write observation is missing or unavailable.');
  const changed = [...new Set([...changedFiles(record.before, record.after), ...(record.touched ?? [])])].sort();
  if (record.readOnly && changed.length) failures.push(`Read-only run changed files: ${changed.join(', ')}`);
  if (!record.readOnly) {
    const allowed = record.allowedPaths ?? [];
    if (!Array.isArray(allowed) || allowed.some(p => typeof p !== 'string' || !p || path.isAbsolute(p) || p.split('/').includes('..'))) failures.push('Invalid allowed path.');
    else for (const file of changed) if (!allowed.some(p => file === p || file.startsWith(p.replace(/\/$/, '') + '/'))) failures.push(`Out-of-scope change: ${file}`);
  }
  for (const file of record.requiredArtifacts ?? []) if (!record.after[file]) failures.push(`Missing artifact: ${file}`);
  if (failures.length) throw new Error(failures.join('\n'));
  return { scenario: record.scenario, changedFiles: changed, status: 'execution-contract-passed', designQuality: 'not-scored', elapsedMs: record.elapsedMs, tokens: record.tokens ?? null };
}
