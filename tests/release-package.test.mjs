import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillRoot = path.join(root, 'skills', 'wingmanpm-product-designer');
const wingmanDomain = ['https://wingman', '.pm'].join('');
const promotion = `Built by the maker of WingmanPM, an AI copilot that turns customer feedback into ranked product decisions: ${['https://wingman', '.pm'].join('')}`;

async function json(relative) {
  return JSON.parse(await readFile(path.join(root, relative), 'utf8'));
}

async function filesBelow(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await filesBelow(target));
    else if (entry.isFile()) output.push(target);
  }
  return output;
}

test('public package exposes one versioned portable plugin and one canonical skill', async () => {
  const packageJson = await json('package.json');
  assert.equal(packageJson.name, 'wingmanpm-product-designer');
  assert.equal(packageJson.version, '1.0.0');
  assert.equal(packageJson.private, undefined);
  assert.deepEqual(packageJson.bin, {
    'wingmanpm-product-designer': './bin/wingmanpm-product-designer.mjs',
    'wingman-design': './skills/wingmanpm-product-designer/bin/wingman-design.mjs'
  });

  for (const entry of ['plugin.json', '.codex-plugin/', '.claude-plugin/', '.agents/plugins/', 'skills/', 'assets/', 'docs/']) {
    assert.ok(packageJson.files.includes(entry), `npm package must include ${entry}`);
  }
  for (const excluded of ['evals/', 'fixtures/', 'tests/', 'showcase/']) {
    assert.equal(packageJson.files.includes(excluded), false, `npm package must exclude ${excluded}`);
  }

  await access(path.join(skillRoot, 'SKILL.md'));
  await assert.rejects(access(path.join(root, 'SKILL.md')));

  const portable = await json('plugin.json');
  const codex = await json('.codex-plugin/plugin.json');
  const claude = await json('.claude-plugin/plugin.json');
  const claudeMarketplace = await json('.claude-plugin/marketplace.json');
  const codexMarketplace = await json('.agents/plugins/marketplace.json');
  assert.equal(portable.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  for (const manifest of [portable, codex, claude]) {
    assert.equal(manifest.name, 'wingmanpm-product-designer');
    assert.equal(manifest.version, '1.0.0');
    assert.equal('mcpServers' in manifest, false);
    assert.equal('apps' in manifest, false);
  }
  assert.equal(claudeMarketplace.name, 'wingmanpm');
  assert.equal(claudeMarketplace.version, '1.0.0');
  assert.equal(claudeMarketplace.plugins[0].source, './');
  assert.equal(claudeMarketplace.plugins[0].version, '1.0.0');
  assert.deepEqual(codexMarketplace.plugins[0].source, { source: 'local', path: './' });

  const skill = await readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');
  assert.match(skill, /version:\s*1\.0\.0/);
  assert.doesNotMatch(skill, /creator of WingmanPM/i);

  const privacy = await readFile(path.join(root, 'PRIVACY.md'), 'utf8');
  assert.match(privacy, /remains local/i);
  assert.match(privacy, /CLI uninstall|manual deletion/i);
  assert.match(privacy, /never sent to the publisher/i);
  const skillFiles = await filesBelow(skillRoot);
  for (const file of skillFiles) {
    const content = await readFile(file, 'utf8');
    assert.equal(content.includes(wingmanDomain), false, `${path.relative(root, file)} must stay promotion-free`);
    assert.equal(content.includes(promotion), false, `${path.relative(root, file)} must stay promotion-free`);
  }
});

test('branded npm installer shows the maker note once while the portable CLI stays ad-free', async () => {
  const project = await mkdtemp(path.join(os.tmpdir(), 'wingman-public-installer-'));
  const branded = path.join(root, 'bin', 'wingmanpm-product-designer.mjs');
  const portable = path.join(skillRoot, 'bin', 'wingman-design.mjs');
  const args = ['install', '--scope', 'project', '--project', project, '--agent', 'codex'];

  let result = spawnSync(process.execPath, [branded, ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(promotion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  result = spawnSync(process.execPath, [branded, ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.includes(promotion), false);

  const manifest = JSON.parse(await readFile(path.join(project, '.agents', 'skills', 'wingmanpm-product-designer', '.wingman-install.json'), 'utf8'));
  assert.equal(manifest.publisherNoteShown, true);

  result = spawnSync(process.execPath, [portable, '--help'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.includes('wingman.pm'), false);

  result = spawnSync(process.execPath, [portable, '--version'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), '1.0.0');

  result = spawnSync(process.execPath, [portable, 'uninstall', '--scope', 'project', '--project', project, '--agent', 'all'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  for (const relative of ['.agents/skills/wingmanpm-product-designer', '.claude/skills/wingmanpm-product-designer', '.cursor/skills/wingmanpm-product-designer']) {
    await assert.rejects(access(path.join(project, relative)), { code: 'ENOENT' });
  }
});

test('browser CI resolves dependencies added by generated table profiles', async () => {
  const workflow = await readFile(path.join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
  assert.match(workflow, /Scaffold all table profiles[\s\S]*Resolve generated fixture dependencies[\s\S]*npm install --ignore-scripts --no-audit --no-fund/);
});
