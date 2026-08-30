import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
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
  await writeFile(path.join(directory, 'package.json'), `${JSON.stringify({ name: 'share-test', private: true, files: [] }, null, 2)}\n`);
  await writeFile(path.join(directory, 'README.md'), '# Safe repository\n');
  assert.equal(run('git', ['init', '-b', 'main'], directory).status, 0);
  await commit(directory, 'safe fixture');
  let result = run(process.execPath, ['scripts/check-share-safety.mjs'], directory);
  assert.equal(result.status, 0, result.stdout + result.stderr);

  await writeFile(path.join(directory, 'README.md'), `# Unsafe${String.fromCodePoint(0x2014)}repository\n`);
  await writeFile(path.join(directory, 'named.html'), ['<p>&', 'mdash;</p>'].join(''));
  await writeFile(path.join(directory, 'numeric.html'), ['<p>&#', '8212;</p>'].join(''));
  await writeFile(path.join(directory, 'hex.html'), ['<p>&#', 'x2014;</p>'].join(''));
  await writeFile(path.join(directory, 'escaped.js'), `export const unsafe = "${String.fromCharCode(92)}${'u2014'}";\n`);
  await writeFile(path.join(directory, 'content.css'), `p::after { content: "${String.fromCharCode(92)}${'2014 '}"; }\n`);
  await commit(directory, 'unsafe fixture');
  result = run(process.execPath, ['scripts/check-share-safety.mjs'], directory);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /forbidden long-dash output/);
  for (const file of ['named.html', 'numeric.html', 'hex.html', 'escaped.js', 'content.css']) assert.match(result.stderr, new RegExp(file));
});
