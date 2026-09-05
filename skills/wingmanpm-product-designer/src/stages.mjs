import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { evidencePlan } from './evidence.mjs';
import { runChecks } from './checker.mjs';
import { inspectExploration } from './explore.mjs';

const key = targets => createHash('sha256').update(JSON.stringify([...targets].sort())).digest('hex').slice(0, 16);
const proofPath = (root, targets) => path.join(root, '.wingmanpm-design/proofs', `${key(targets)}.json`);

/** A measured command result is not a claim of visual or accessibility quality. */
export async function runProof(root, targets, command) {
  if (!targets.length || !Array.isArray(command) || !command.length || command.some(x => typeof x !== 'string' || !x || x.includes('\0'))) throw new Error('Proof needs targets and a non-empty command argument array.');
  const before = await evidencePlan(root, targets);
  const startedAt = new Date().toISOString();
  const output = createHash('sha256');
  let log = '';
  let logTruncated = false;
  const collect = chunk => { output.update(chunk); if (log.length < 1024 * 1024) log += chunk.toString(); else logTruncated = true; };
  const result = await new Promise((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), { cwd: root, shell: false, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, WINGMAN_PROOF_TARGETS: JSON.stringify(before.targets) } });
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.once('error', reject);
    child.once('close', (exitCode, signal) => resolve({ exitCode, signal }));
  });
  const after = await evidencePlan(root, targets);
  const record = { schemaVersion: 1, kind: 'command-result', ...result, command, targets: before.targets, scope: before.scope, sourceHash: before.sourceHash, startedAt, completedAt: new Date().toISOString(), outputHash: output.digest('hex'), status: result.exitCode === 0 && before.sourceHash === after.sourceHash ? 'passed' : 'failed', sourcesChanged: before.sourceHash !== after.sourceHash, releaseReady: false };
  const file = proofPath(root, before.targets);
  await mkdir(path.dirname(file), { recursive: true });
  const logFile = `${file}.${randomBytes(6).toString('hex')}.log`;
  await writeFile(logFile, log, { flag: 'wx' });
  record.log = path.relative(root, logFile);
  record.logTruncated = logTruncated;
  const temporary = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  await writeFile(temporary, JSON.stringify(record, null, 2) + '\n', { flag: 'wx' }); await rename(temporary, file);
  return { ...record, file };
}

export async function checkStage(root, { stage = 'ship', target, id, allowPendingReview = false } = {}) {
  if (!['explore', 'build', 'ship'].includes(stage)) throw new Error('Stage must be explore, build, or ship.');
  if (stage === 'explore') {
    if (!id) throw new Error('Explore checks need --id.');
    const session = await inspectExploration(root, id);
    return { stage, status: session.stale.length ? 'stale' : 'preview-ready', releaseReady: false, selected: session.selected, pending: ['Human visual review', ...(session.selected ? [] : ['User choice'])], counts: { block: session.stale.length, warn: 0, excepted: 0, baselined: 0 }, findings: session.stale.map(file => ({ severity: 'block', ruleId: 'EXPLORE', file, line: 0, message: 'Preview source changed.' })) };
  }
  if (stage === 'ship') return { ...await runChecks(root, { allowPendingReview }), stage };
  if (!target) throw new Error('Build checks need an exact --target. Use ship for the full project.');
  const plan = await evidencePlan(root, [target]);
  const report = await runChecks(root, { allowPendingReview: true });
  const files = new Set(plan.files);
  // Global contracts and all-story records belong to shipping. Name the debt;
  // a focused source pass must never masquerade as a release certificate.
  const deferred = new Set(['WPD001', 'WPD002', 'WPD011', 'WPD012', 'WPD013', 'WPD016', 'WPD018', 'WPD019', 'WPD022', 'WPD023']);
  const findings = report.findings.filter(f => !deferred.has(f.ruleId) && (f.file === null || files.has(f.file)));
  let proof = null;
  try {
    const record = JSON.parse(await readFile(proofPath(root, plan.targets), 'utf8'));
    proof = { status: record.sourceHash === plan.sourceHash ? record.status : 'stale', command: record.command, kind: record.kind, completedAt: record.completedAt };
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return { stage, status: 'scoped-source-check', scope: plan.scope, targets: plan.targets, files: plan.files.length, stories: plan.storyFiles.slice(0, 12), storyCount: plan.storyFiles.length, warnings: plan.warnings.slice(0, 5), warningCount: plan.warnings.length, proof, releaseReady: false, pending: ['Visual and interaction review at the target sizes', 'Full ship gate before release'], findings, counts: { block: findings.filter(f => f.severity === 'block').length, warn: findings.filter(f => f.severity === 'warn').length, excepted: 0, baselined: 0 } };
}
