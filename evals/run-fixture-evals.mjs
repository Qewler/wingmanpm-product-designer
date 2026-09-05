import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillRoot = path.join(root, 'skills', 'wingmanpm-product-designer');
const fixture = path.join(root, 'fixtures', 'neutral-saas');
const benchmarks = JSON.parse(await readFile(path.join(root, 'evals', 'benchmarks.json'), 'utf8')).benchmarks;
// Execute request resolution, rather than searching all documents for words.
const { resolveRequest } = await import('../skills/wingmanpm-product-designer/src/intents.mjs');
const cases = [
  ['greenfield', 'design-system', 'design-system'], ['preserve', 'polish src/App.tsx', 'polish'],
  ['card-wall', 'layout dashboard', 'layout'], ['dense-data', 'data-table orders', 'data-table'],
  ['transparent-ai', 'ai-flow review', 'ai-flow'], ['review-only', 'audit settings', 'review'],
  ['motion', 'motion panel', 'motion'], ['marketing', 'design-system pricing', 'design-system'],
  ['ambiguous-polish', 'make it beautiful', 'polish'], ['explicit-intent', 'standout', 'standout'],
  ['static-table', 'table report', 'data-table'], ['work-table', 'table work', 'data-table'],
  ['editable-table', 'table editable', 'data-table'], ['preserve-grid', 'review data table', 'review']
];
for (const [id, request, intent] of cases) {
  const resolved = resolveRequest(request);
  assert.equal(resolved.intent, intent, id);
  assert.equal(resolved.kind, 'direct', id);
  if (intent === 'review') assert.equal(resolved.readOnly, true, id);
  console.log(`PASS runtime routing ${id}`);
}
assert.equal(resolveRequest('polish src/My UI/BillingPage.tsx').target, 'src/My UI/BillingPage.tsx');
assert.equal(resolveRequest('explore AI review').stage, 'explore');

const cli = path.join(root, 'bin', 'wingman-design.mjs');
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'wingman-fixture-eval-'));
const migratedFixture = path.join(temporaryRoot, 'neutral-saas');
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

try {
  await cp(fixture, migratedFixture, { recursive: true });
  await rm(path.join(migratedFixture, '.wingmanpm-design', 'browser-evidence.json'), { force: true });

  const firstUpgrade = run('upgrade', '--project', migratedFixture);
  assert.equal(firstUpgrade.status, 0, firstUpgrade.stdout + firstUpgrade.stderr);

  const beforeBrowser = run('check', '--project', migratedFixture, '--allow-pending-review');
  assert.equal(beforeBrowser.status, 1, beforeBrowser.stdout + beforeBrowser.stderr);
  assert.match(beforeBrowser.stdout, /WPD022[\s\S]*Machine-written browser evidence is missing/);

  const secondUpgrade = run('upgrade', '--project', migratedFixture);
  assert.equal(secondUpgrade.status, 0, secondUpgrade.stdout + secondUpgrade.stderr);
  assert.match(secondUpgrade.stdout, /Already current/);

  const afterSecondUpgrade = run('check', '--project', migratedFixture, '--allow-pending-review');
  assert.equal(afterSecondUpgrade.status, 1, afterSecondUpgrade.stdout + afterSecondUpgrade.stderr);
  assert.match(afterSecondUpgrade.stdout, /WPD022[\s\S]*Machine-written browser evidence is missing/);

  console.log(`Fixture evaluation passed: ${cases.length} runtime routing checks; migrated fixture kept the browser evidence gate through an idempotent upgrade.`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
