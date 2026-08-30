import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  COMMAND_LEVELS,
  COMMANDS,
  listCommands,
  normalizeAlias,
  resolveIntent,
  resolveRequest
} from '../src/intents.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('registry exposes all 18 unique SaaS intent families and aliases', () => {
  const expected = [
    'polish', 'standout', 'amplify', 'calm', 'simplify', 'layout',
    'typography', 'color', 'motion', 'responsive', 'harden', 'review',
    'data-table', 'forms', 'onboarding', 'ai-flow', 'navigation', 'design-system'
  ];
  assert.deepEqual(COMMANDS.map(({ id }) => id), expected);
  assert.equal(new Set(COMMANDS.flatMap(({ id, aliases }) => [id, ...aliases]).map(normalizeAlias)).size, 36);
  assert.deepEqual(COMMAND_LEVELS, ['refine', 'elevate', 'reimagine']);
  assert.equal(listCommands().length, expected.length);
});

test('normalizer handles case, punctuation, Unicode width, and whitespace', () => {
  assert.equal(normalizeAlias('  DATA---TABLE!!!  '), 'data table');
  const wideAlias = `ＡＩ${String['from' + 'CodePoint'](0x2000 + 0x14)}ＵＩ`;
  assert.equal(normalizeAlias(wideAlias), 'ai ui');
  assert.equal(resolveIntent('  DaTa---TaBlE!!  ')?.intent, 'data-table');
  assert.equal(resolveIntent('PRODUCTION_ready')?.intent, 'harden');
});

test('resolver uses exact aliases and never substring matches', () => {
  assert.equal(resolveIntent('audit')?.intent, 'review');
  assert.equal(resolveIntent('audited'), null);
  assert.equal(resolveIntent('unaudited'), null);
  assert.equal(resolveRequest('make this unaudited').kind, 'unknown');
  assert.equal(resolveRequest('this table is stunningly fast').kind, 'unknown');
});

test('free-form vague phrases require the three-level picker', () => {
  assert.equal(resolveIntent('make it beautiful')?.intent, 'polish');
  assert.equal(resolveIntent('make it stunning')?.intent, 'standout');
  const beautiful = resolveRequest('Please, make this beautiful!');
  assert.equal(beautiful.kind, 'picker');
  assert.equal(beautiful.intent, 'polish');
  assert.equal(beautiful.recommendedLevel, 'refine');
  assert.deepEqual(beautiful.options.map(({ id }) => id), ['refine', 'elevate', 'reimagine']);

  const stunning = resolveRequest('Could you make the billing settings stunning?');
  assert.equal(stunning.kind, 'picker');
  assert.equal(stunning.intent, 'standout');
  assert.equal(stunning.target, 'the billing settings');
  assert.equal(stunning.recommendedLevel, 'elevate');

  const pimp = resolveRequest('PIMP IT UP!!!');
  assert.equal(pimp.kind, 'picker');
  assert.equal(pimp.intent, 'amplify');
  assert.equal(pimp.recommendedLevel, 'elevate');
});

test('explicit invocation and supplied level act directly', () => {
  const explicit = resolveRequest('stunning', { explicit: true });
  assert.equal(explicit.kind, 'direct');
  assert.equal(explicit.intent, 'standout');
  assert.equal(explicit.level, 'elevate');

  const leveled = resolveRequest('make it beautiful', { level: 'reimagine' });
  assert.equal(leveled.kind, 'direct');
  assert.equal(leveled.level, 'reimagine');

  const invalid = resolveRequest('beautiful', { level: 'maximum' });
  assert.equal(invalid.kind, 'unknown');
  assert.equal(invalid.reason, 'invalid-level');
});

test('clear non-vague natural requests act directly', () => {
  const layout = resolveRequest('Reflow the settings screen');
  assert.equal(layout.kind, 'direct');
  assert.equal(layout.intent, 'layout');
  assert.equal(layout.target, 'the settings screen');

  const table = resolveRequest('table');
  assert.equal(table.kind, 'direct');
  assert.equal(table.intent, 'data-table');
});

test('review is read-only unless fix is explicit', () => {
  const review = resolveRequest('Audit this');
  assert.equal(review.kind, 'direct');
  assert.equal(review.intent, 'review');
  assert.equal(review.readOnly, true);
  assert.equal(review.fix, false);

  const fixed = resolveRequest('audit', { explicit: true, fix: true });
  assert.equal(fixed.kind, 'direct');
  assert.equal(fixed.readOnly, false);
  assert.equal(fixed.fix, true);
});

test('command registry carries progressive references and source citations', async () => {
  const registry = JSON.parse(await readFile(path.join(root, 'registry', 'commands.json'), 'utf8'));
  const schema = JSON.parse(await readFile(path.join(root, 'schemas', 'commands.schema.json'), 'utf8'));
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const packageLock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
  const skill = await readFile(path.join(root, 'SKILL.md'), 'utf8');
  assert.equal(registry.version, '0.2.0-private.2');
  assert.equal(packageJson.version, registry.version);
  assert.equal(packageLock.version, registry.version);
  assert.equal(packageLock.packages[''].version, registry.version);
  assert.match(skill, /version: 0\.2\.0-private\.2/);
  assert.equal(registry.intents.length, 18);
  assert.ok(registry.sources.every(({ url }) => url.startsWith('https://')));
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  for (const command of registry.intents) {
    const [relative] = command.reference.split('#');
    await readFile(path.join(root, relative), 'utf8');
  }
});
