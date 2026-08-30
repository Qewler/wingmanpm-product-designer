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
const referenceFiles = (await readdir(path.join(skillRoot, 'references')))
  .filter((name) => name.endsWith('.md'))
  .sort()
  .map((name) => path.join(skillRoot, 'references', name));
const contract = [
  await readFile(path.join(skillRoot, 'SKILL.md'), 'utf8'),
  ...(await Promise.all(referenceFiles.map((file) => readFile(file, 'utf8')))),
  await readFile(path.join(skillRoot, 'registry', 'commands.json'), 'utf8'),
  await readFile(path.join(fixture, 'design-system', 'PRODUCT.md'), 'utf8'),
  await readFile(path.join(fixture, 'design-system', 'DESIGN.md'), 'utf8'),
  await readFile(path.join(fixture, 'design-system', 'COMPONENTS.md'), 'utf8'),
  await readFile(path.join(fixture, 'src', 'stories', 'WingmanProduct.stories.tsx'), 'utf8')
].join('\n').toLowerCase();

for (const benchmark of benchmarks) {
  const matches = benchmark.mustMention.filter((term) => contract.includes(term.toLowerCase()));
  const missing = benchmark.mustMention.filter((term) => !matches.includes(term));
  assert.deepEqual(missing, [], `${benchmark.id} is missing contract evidence: ${missing.join(', ')}`);
  console.log(`PASS ${benchmark.id}: ${matches.join(', ')}`);
}

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

  console.log(`Fixture evaluation passed: ${benchmarks.length} behavioral contracts; migrated fixture kept the browser evidence gate through an idempotent upgrade.`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
