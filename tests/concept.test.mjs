import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkConcept } from '../skills/wingmanpm-product-designer/src/concept.mjs';
import { drawDirections } from '../skills/wingmanpm-product-designer/src/direction.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'skills/wingmanpm-product-designer/bin/wingman-design.mjs');
const c = (name, s, family = 'none') => ({ name, who: 'shift leads, daily', looks: 'its own ground, colours, and mark', marks: 'a scratch is arrived, a notch is late, a jump is moved', family, scores: s });
const S = (native, verb, unswappable, operable, silhouette) => ({ native, verb, unswappable, operable, silhouette });
const sheet = (candidates) => ({ brief: 'Dockslot dock scheduling', audience: 'warehouse managers and shift leads', mechanism: 'Late trucks move to the next free door.', scene: 'The dock office at 6am.', rut: ['SaaS dashboard hero with a calendar', 'a loading dock photo'], candidates });
const seven = [
  c('Gantt calendar', S(2, 2, 2, 1, 1)),
  c('Tachograph chart disc', S(2, 2, 2, 1, 1), 'chart'),
  c('Dock door plate', S(2, 1, 2, 1, 1), 'plate'),
  c('Yard whiteboard', S(2, 2, 1, 1, 0)),
  c('Seal tag', S(2, 0, 2, 1, 1)),
  c('Generic dashboard', S(0, 2, 0, 1, 0)),
  c('Bill of lading', S(2, 1, 1, 1, 0), 'dossier')
];

test('the first idea and the rut are never dealt; the best remaining candidate wins', () => {
  const r = checkConcept(sheet(seven));
  assert.equal(r.ok, true);
  assert.equal(r.chosen.name, 'Tachograph chart disc');
  assert.deepEqual(r.chosen.family, { id: 'chart', name: 'Chart, survey, or blueprint' });
  const rutted = checkConcept({ ...sheet(seven), rut: ['tachograph wall', 'calendar'] });
  assert.notEqual(rutted.chosen.name, 'Tachograph chart disc');
});

test('a candidate needs native, verb, and unswappable above zero and 6 of 8', () => {
  const weak = seven.map((x, i) => i === 0 ? x : { ...x, scores: { ...x.scores, verb: 0 } });
  const r = checkConcept(sheet(weak));
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /native, verb, and unswappable/);
});

test('the worksheet must be complete', () => {
  const r = checkConcept({ brief: 'x', candidates: seven.slice(0, 3) });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /mechanism/.test(e)));
  assert.ok(r.errors.some((e) => /rut/.test(e)));
  assert.ok(r.errors.some((e) => /at least 7/.test(e)));
  const bad = checkConcept(sheet(seven.map((x, i) => i === 2 ? { ...x, family: 'spaceship', scores: { ...x.scores, native: 5 } } : x)));
  assert.ok(bad.errors.some((e) => /family/.test(e)) && bad.errors.some((e) => /native/.test(e)));
});


test('direction fixes the world when one is named', () => {
  const r = drawDirections('Dockslot dock scheduling', { world: 'Tachograph chart disc', family: 'chart' });
  assert.ok(r.options.every((o) => o.world.name === 'Tachograph chart disc' && o.world.native));
  assert.equal(new Set(r.options.map((o) => o.composition.id)).size, 3);
  assert.throws(() => drawDirections('x', { family: 'nope' }), /Unknown --family/);
});

test('the CLI scores a worksheet and exits 2 when it fails', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'concept-'));
  const good = path.join(dir, 'good.json'); writeFileSync(good, JSON.stringify(sheet(seven)));
  const text = execFileSync(process.execPath, [cli, 'concept', good], { encoding: 'utf8' });
  assert.match(text, /^World: Tachograph chart disc \(8\/8\)/);
  assert.match(text, /--world "Tachograph chart disc" --family chart/);
  const bad = path.join(dir, 'bad.json'); writeFileSync(bad, JSON.stringify({ brief: 'x' }));
  assert.throws(() => execFileSync(process.execPath, [cli, 'concept', bad], { encoding: 'utf8', stdio: 'pipe' }), (e) => e.status === 2);
});

test('ties break toward native and unswappable, then verb, then silhouette, before the seed', () => {
  const tied = [
    c('Gantt calendar', S(2, 2, 2, 1, 1)),
    c('Yard whiteboard', S(1, 2, 2, 1, 1)),
    c('Dock door plate', S(2, 1, 2, 1, 1), 'plate'),
    c('Seal tag', S(2, 2, 1, 1, 1)),
    c('Bill of lading', S(2, 1, 1, 1, 1), 'dossier'),
    c('Generic dashboard', S(0, 2, 0, 1, 0)),
    c('Gate pass', S(1, 1, 1, 1, 1))
  ];
  for (const seed of [0, 1, 2, 3, 4, 5, 6, 7]) {
    const r = checkConcept(sheet(tied), { seed });
    assert.equal(r.chosen.name, 'Dock door plate', `seed ${seed}`);
    assert.equal(r.finalists.length, 3);
  }
});

