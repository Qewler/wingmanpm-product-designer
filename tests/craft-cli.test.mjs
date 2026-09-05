import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { getPattern, searchPatterns } from '../skills/wingmanpm-product-designer/src/patterns.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'bin', 'wingman-design.mjs');

function run(args, cwd = root) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
}

test('help lists craft and patterns with their main inputs', () => {
  const result = run(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /craft --file PATH\|--url URL/);
  assert.match(result.stdout, /patterns \[QUERY WORDS\].*--id ID.*--limit 1\.\.5/);
});

test('patterns search stays bounded and ID lookup returns the same record', () => {
  const defaults = searchPatterns('');
  assert.ok(defaults.length > 0);
  assert.ok(defaults.length <= 3);
  assert.deepEqual(searchPatterns('', { limit: 1 }), defaults.slice(0, 1));

  const selected = defaults[0];
  assert.equal(typeof selected.id, 'string');
  assert.deepEqual(getPattern(selected.id), selected);
  assert.equal(getPattern('__unknown_pattern__'), null);

  const listed = run(['patterns', '--limit', '1', '--json']);
  assert.equal(listed.status, 0, listed.stderr);
  assert.deepEqual(JSON.parse(listed.stdout), defaults.slice(0, 1));

  const byId = run(['patterns', '--id', selected.id, '--json']);
  assert.equal(byId.status, 0, byId.stderr);
  assert.deepEqual(JSON.parse(byId.stdout), selected);
});

test('patterns validates limits and unknown IDs', () => {
  for (const limit of ['0', '6', '1.5', 'many']) {
    const result = run(['patterns', '--limit', limit]);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /integer from 1 to 5/);
  }
  const unknown = run(['patterns', '--id', '__unknown_pattern__']);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Unknown pattern ID/);
});

test('craft requires exactly one valid source and keeps paths inside the project', async () => {
  const project = await mkdtemp(path.join(os.tmpdir(), 'wingman-craft-cli-'));
  await writeFile(path.join(project, 'surface.html'), '<!doctype html><html><body><main><h1>Example</h1></main></body></html>\n');

  const missing = run(['craft', '--project', project]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /exactly one of --file or --url/);

  const both = run(['craft', '--file', 'surface.html', '--url', 'https://example.com', '--project', project]);
  assert.equal(both.status, 1);
  assert.match(both.stderr, /exactly one of --file or --url/);

  const invalidUrl = run(['craft', '--url', 'file:///tmp/example.html', '--project', project]);
  assert.equal(invalidUrl.status, 1);
  assert.match(invalidUrl.stderr, /must use http: or https:/);

  const outside = run(['craft', '--file', 'surface.html', '--out', '../craft.json', '--project', project]);
  assert.equal(outside.status, 1);
  assert.match(outside.stderr, /--out must stay inside the project/);

  const missingModule = run(['craft', '--file', 'surface.html', '--browser-module', 'missing.mjs', '--project', project]);
  assert.equal(missingModule.status, 1);
  assert.match(missingModule.stderr, /--browser-module does not exist/);
});

test('craft dispatch returns JSON and maps its status to the process exit code', async () => {
  const project = await mkdtemp(path.join(os.tmpdir(), 'wingman-craft-run-'));
  await writeFile(path.join(project, 'surface.html'), '<!doctype html><html><body><main><h1>Example</h1></main></body></html>\n');
  const result = run(['craft', '--file', 'surface.html', '--json'], project);
  assert.ok([0, 1, 2].includes(result.status), result.stderr);
  const report = JSON.parse(result.stdout);
  assert.ok(['passed', 'failed', 'unverified'].includes(report.status));
  assert.ok(Array.isArray(report.findings));
  assert.equal(result.status, { passed: 0, failed: 1, unverified: 2 }[report.status]);
});
