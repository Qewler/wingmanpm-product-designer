import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args, cwd) {
  return spawnSync(command, args, { cwd, encoding: 'utf8' });
}

async function commit(directory, message) {
  assert.equal(run('git', ['add', '.'], directory).status, 0);
  const result = run('git', ['-c', 'user.name=Wingman Test', '-c', 'user.email=test@wingman.invalid', 'commit', '-m', message], directory);
  assert.equal(result.status, 0, result.stderr);
}

test('share safety accepts clean text and rejects forbidden long-dash output', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wingman-share-test-'));
  await mkdir(path.join(directory, 'scripts'), { recursive: true });
  await writeFile(path.join(directory, 'scripts', 'check-share-safety.mjs'), await readFile(path.join(root, 'scripts', 'check-share-safety.mjs')));
  await writeFile(path.join(directory, 'package.json'), `${JSON.stringify({ name: 'wingmanpm-product-designer', version: '1.0.0', files: [] }, null, 2)}\n`);
  await writeFile(path.join(directory, 'README.md'), '# Safe repository\n');
  assert.equal(run('git', ['init', '-b', 'main'], directory).status, 0);
  await commit(directory, 'safe fixture');
  let result = run(process.execPath, ['scripts/check-share-safety.mjs'], directory);
  assert.equal(result.status, 0, result.stdout + result.stderr);

  const forbiddenDash = String['from' + 'CodePoint'](0x2000 + 0x14);
  const forbiddenEnDash = String['from' + 'CodePoint'](0x2000 + 0x13);
  const slash = String['from' + 'CharCode'](90 + 2);
  await writeFile(path.join(directory, 'README.md'), `# Unsafe${forbiddenDash}repository\n`);
  await writeFile(path.join(directory, 'en-dash.md'), `# Unsafe${forbiddenEnDash}repository\n`);
  await writeFile(path.join(directory, 'named.html'), ['<p>&', 'mdash;</p>'].join(''));
  await writeFile(path.join(directory, 'named-no-semicolon.html'), ['<p>&', 'mdash </p>'].join(''));
  await writeFile(path.join(directory, 'numeric.html'), ['<p>&#', '8212;</p>'].join(''));
  await writeFile(path.join(directory, 'hex.html'), ['<p>&#', 'x2014;</p>'].join(''));
  await writeFile(path.join(directory, 'numeric-no-semicolon.html'), ['<p>&#', '8212 </p>'].join(''));
  await writeFile(path.join(directory, 'escaped.js'), `export const unsafe = "${slash}${'u2014'}";\n`);
  await writeFile(path.join(directory, 'escaped.json'), `{"unsafe":"${slash}${'u2014'}"}\n`);
  await writeFile(path.join(directory, 'escaped.yaml'), `unsafe: "${slash}${'u2014'}"\n`);
  await writeFile(path.join(directory, 'content.css'), `p::after { content: "${slash}${'2014 '}"; }\n`);
  await writeFile(path.join(directory, 'variable.css'), `:root { --unsafe: "${slash}${'2014 '}"; }\n`);
  await writeFile(path.join(directory, 'style.html'), `<style>.label::after { content: "${slash}${'2014 '}"; }</style>\n`);
  await writeFile(path.join(directory, 'code-point.js'), ['export const unsafe = String', '.from', 'CodePoint(0x2014);'].join(''));
  await writeFile(path.join(directory, 'char-code.js'), ['export const unsafe = String', '.from', 'CharCode(8212);'].join(''));
  await writeFile(path.join(directory, 'code-point-add.js'), ['export const unsafe = String', '.from', 'CodePoint(0x2000 + 0x14);'].join(''));
  await writeFile(path.join(directory, 'char-code-add.js'), ['export const unsafe = String', '.from', 'CharCode(8_000 + 212);'].join(''));
  await commit(directory, 'unsafe fixture');
  result = run(process.execPath, ['scripts/check-share-safety.mjs'], directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /forbidden long-dash output/);
  for (const file of ['en-dash.md', 'named.html', 'named-no-semicolon.html', 'numeric.html', 'hex.html', 'numeric-no-semicolon.html', 'escaped.js', 'escaped.json', 'escaped.yaml', 'content.css', 'variable.css', 'style.html', 'code-point.js', 'char-code.js', 'code-point-add.js', 'char-code-add.js']) assert.match(result.stderr, new RegExp(file));
});

test('share safety handles Git history larger than the Node default buffer', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wingman-share-history-'));
  await mkdir(path.join(directory, 'scripts'), { recursive: true });
  await writeFile(path.join(directory, 'scripts', 'check-share-safety.mjs'), await readFile(path.join(root, 'scripts', 'check-share-safety.mjs')));
  await writeFile(path.join(directory, 'package.json'), `${JSON.stringify({ name: 'wingmanpm-product-designer', version: '1.0.0', files: [] }, null, 2)}\n`);
  await writeFile(path.join(directory, 'README.md'), '# Safe history fixture\n');
  assert.equal(run('git', ['init', '-b', 'main'], directory).status, 0);
  await commit(directory, 'initial safe fixture');

  const largeHistory = Array.from(
    { length: 90000 },
    (_, index) => `safe historical record ${String(index).padStart(6, '0')} contains only public fixture text\n`
  ).join('');
  assert.ok(Buffer.byteLength(largeHistory) > 1024 * 1024);
  const historicalFile = path.join(directory, 'large-history.txt');
  await writeFile(historicalFile, largeHistory);
  await commit(directory, 'add large safe history');
  await rm(historicalFile);
  await commit(directory, 'remove large safe history');

  const result = run(process.execPath, ['scripts/check-share-safety.mjs'], directory);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Release-safety check passed/);
});
