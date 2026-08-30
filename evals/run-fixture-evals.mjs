import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'fixtures', 'neutral-saas');
const benchmarks = JSON.parse(await readFile(path.join(root, 'evals', 'benchmarks.json'), 'utf8')).benchmarks;
const referenceFiles = (await readdir(path.join(root, 'references')))
  .filter((name) => name.endsWith('.md'))
  .sort()
  .map((name) => path.join(root, 'references', name));
const contract = [
  await readFile(path.join(root, 'SKILL.md'), 'utf8'),
  ...(await Promise.all(referenceFiles.map((file) => readFile(file, 'utf8')))),
  await readFile(path.join(root, 'registry', 'commands.json'), 'utf8'),
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

  const firstUpgrade = run('upgrade', '--project', migratedFixture);
  assert.equal(firstUpgrade.status, 0, firstUpgrade.stdout + firstUpgrade.stderr);

  const review = run(
    'check',
    '--project', migratedFixture,
    '--record-review',
    '--reviewer', 'Deterministic fixture migration evaluation',
    '--confirm', 'keyboard,zoom200,reducedMotion,longContent,light,dark,axe,responsiveStates',
    '--notes', 'Deterministic fixture evidence only; not a browser sign-off.'
  );
  assert.equal(review.status, 0, review.stdout + review.stderr);

  const strictAfterReview = run('check', '--project', migratedFixture);
  assert.equal(strictAfterReview.status, 0, strictAfterReview.stdout + strictAfterReview.stderr);

  const secondUpgrade = run('upgrade', '--project', migratedFixture);
  assert.equal(secondUpgrade.status, 0, secondUpgrade.stdout + secondUpgrade.stderr);
  assert.match(secondUpgrade.stdout, /Already current/);

  const strictAfterSecondUpgrade = run('check', '--project', migratedFixture);
  assert.equal(strictAfterSecondUpgrade.status, 0, strictAfterSecondUpgrade.stdout + strictAfterSecondUpgrade.stderr);

  console.log(`Fixture evaluation passed: ${benchmarks.length} behavioral contracts; migrated fixture passed two strict checks and an idempotent upgrade.`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
