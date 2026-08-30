import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(root, 'fixtures', 'neutral-saas');
const benchmarks = JSON.parse(await readFile(path.join(root, 'evals', 'benchmarks.json'), 'utf8')).benchmarks;
const contract = [
  await readFile(path.join(root, 'SKILL.md'), 'utf8'),
  await readFile(path.join(root, 'references', 'system.md'), 'utf8'),
  await readFile(path.join(root, 'references', 'product-ui.md'), 'utf8'),
  await readFile(path.join(root, 'references', 'motion.md'), 'utf8'),
  await readFile(path.join(root, 'references', 'qa.md'), 'utf8'),
  await readFile(path.join(root, 'references', 'marketing.md'), 'utf8'),
  await readFile(path.join(fixture, 'design-system', 'PRODUCT.md'), 'utf8'),
  await readFile(path.join(fixture, 'design-system', 'DESIGN.md'), 'utf8'),
  await readFile(path.join(fixture, 'design-system', 'COMPONENTS.md'), 'utf8'),
  await readFile(path.join(fixture, 'src', 'stories', 'WingmanProduct.stories.tsx'), 'utf8')
].join('\n').toLowerCase();

for (const benchmark of benchmarks) {
  const matches = benchmark.mustMention.filter((term) => contract.includes(term.toLowerCase()));
  assert.ok(matches.length >= Math.min(2, benchmark.mustMention.length), `${benchmark.id} has too little fixture evidence`);
  console.log(`PASS ${benchmark.id}: ${matches.join(', ')}`);
}

const check = spawnSync(process.execPath, [path.join(root, 'bin', 'wingman-design.mjs'), 'check', '--project', fixture, '--allow-pending-review'], { encoding: 'utf8' });
assert.equal(check.status, 0, check.stdout + check.stderr);
console.log(`Fixture evaluation passed: ${benchmarks.length} behavioral contracts; deterministic check passed.`);
