import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { DIRECTIONS, drawDirections, inferDomains } from '../skills/wingmanpm-product-designer/src/direction.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'skills/wingmanpm-product-designer/bin/wingman-design.mjs');
const devtool = 'Landing page for Tracewell, open-source tracing for Node.js. npm i tracewell, localhost UI, GitHub.';
const hardware = 'Landing page for Aera, a home air-quality monitor with sensors, a light ring, free shipping, for parents in apartments.';

test('domains are read from the brief', () => {
  assert.ok(inferDomains(devtool).includes('devtool'));
  assert.ok(inferDomains(hardware).includes('hardware'));
  assert.deepEqual(inferDomains('something unrelated'), ['b2b']);
  assert.ok(!inferDomains('Stemroom splits songs for musicians. Pro 9 EUR per month.').includes('finance'), 'a price in EUR is not a finance product');
});

test('draws are deterministic per brief and seed, and differ across seeds', () => {
  const a = drawDirections(devtool, { seed: 1 });
  assert.deepEqual(a, drawDirections(devtool, { seed: 1 }));
  const signatures = new Set([0, 1, 2, 3, 4, 5].map((seed) => drawDirections(devtool, { seed }).options.map((o) => o.composition.id).join()));
  assert.ok(signatures.size > 1, 'seeds should change the draw');
});

test('options never repeat an axis value within one draw', () => {
  for (const seed of [0, 7, 42]) {
    const { options } = drawDirections(hardware, { seed, count: 4 });
    for (const axis of ['world', 'composition', 'type', 'color', 'device', 'motion']) {
      assert.equal(new Set(options.map((o) => o[axis].id)).size, options.length, `${axis} repeats at seed ${seed}`);
    }
  }
});

test('type is drawn for the world, and character faces carry a usage limit', () => {
  const typeIds = new Set(DIRECTIONS.type.map((t) => t.id));
  for (const w of DIRECTIONS.worlds) for (const id of w.faces) assert.ok(typeIds.has(id), `${w.id} → ${id}`);
  let fit = 0, total = 0;
  for (let seed = 0; seed < 40; seed++) for (const o of drawDirections(hardware, { seed }).options) { total++; if (o.world.faces.includes(o.type.id)) fit++; }
  assert.ok(fit / total > 0.6, `only ${fit}/${total} options pair the world with one of its faces`);
  for (const t of DIRECTIONS.type) assert.ok(t.use, t.id);
  assert.deepEqual(DIRECTIONS.type.filter((t) => t.character).map((t) => t.id).sort(), ['dot-matrix', 'stencil', 'typewriter']);
});

test('the banned template is never a composition option', () => {
  const ids = DIRECTIONS.compositions.map((c) => c.id);
  for (const banned of DIRECTIONS.banned) assert.ok(!ids.includes(banned.id));
  for (const id of ['split-straddle', 'headline-left-object-right', 'accent-last-line', 'section-kit', 'headline-stack', 'borrowed-motifs', 'split-headline', 'pale-panel']) assert.ok(DIRECTIONS.banned.some((b) => b.id === id), id);
  assert.ok(!/interleaved|between the first and second line/.test(DIRECTIONS.compositions.find((c) => c.id === 'type-wall').move), 'type-wall no longer splits the headline');
  for (const w of DIRECTIONS.worlds) assert.ok(w.ground, `${w.id} names its ground`);
});

test('direction rejects an empty brief and bad counts', () => {
  assert.throws(() => drawDirections(''), /needs a brief/);
  assert.throws(() => drawDirections(devtool, { count: 9 }), /--count/);
});

test('the CLI prints options and the banned fingerprints', () => {
  const text = execFileSync(process.execPath, [cli, 'direction', hardware], { encoding: 'utf8' });
  assert.match(text, /^A\. /m);
  assert.match(text, /Never build these/);
  assert.match(text, /straddling a full-bleed/);
  const json = JSON.parse(execFileSync(process.execPath, [cli, 'direction', devtool, '--seed', '3', '--json'], { encoding: 'utf8' }));
  assert.equal(json.options.length, 3);
  assert.equal(json.seed, 3);
});
