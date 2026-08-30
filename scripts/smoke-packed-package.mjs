#!/usr/bin/env node

import assert from 'node:assert/strict';
import { access, appendFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const tarballArgument = process.argv[2];
if (!tarballArgument) throw new Error('Usage: node scripts/smoke-packed-package.mjs <package.tgz>');

const tarball = path.resolve(tarballArgument);
await access(tarball);

const temporaryParent = process.env.RUNNER_TEMP || os.tmpdir();
const temporaryRoot = await mkdtemp(path.join(temporaryParent, 'wingman-packed-smoke-'));
const consumer = path.join(temporaryRoot, 'consumer');
const project = path.join(temporaryRoot, 'project');
const windows = process.platform === 'win32';
const npmCommand = windows ? 'npm.cmd' : 'npm';
const npxCommand = windows ? 'npx.cmd' : 'npx';
const wingmanDomain = ['https://wingman', '.pm'].join('');
const promotion = `Built by the maker of WingmanPM, an AI copilot that turns customer feedback into ranked product decisions: ${wingmanDomain}`;

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: windows,
    env: { ...process.env, NO_COLOR: '1' }
  });
  assert.equal(result.status, 0, `${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  return result;
}

function executable(name) {
  return path.join(consumer, 'node_modules', '.bin', `${name}${windows ? '.cmd' : ''}`);
}

function count(source, value) {
  return source.split(value).length - 1;
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

try {
  await mkdir(consumer, { recursive: true });
  await mkdir(project, { recursive: true });
  await writeFile(path.join(consumer, 'package.json'), '{"name":"packed-smoke-consumer","private":true}\n');
  await writeFile(path.join(project, 'package.json'), '{"name":"packed-smoke-project","private":true,"type":"module"}\n');

  const npmInstall = ['install', '--ignore-scripts', '--no-audit', '--no-fund', tarball];
  run(npmCommand, npmInstall, consumer);
  run(npmCommand, npmInstall, consumer);

  for (const name of ['wingman-design', 'wingmanpm-product-designer']) {
    await access(executable(name));
    const version = run(executable(name), ['--version'], consumer);
    assert.equal(version.stdout.trim(), '1.0.0');
    assert.equal(version.stdout.includes(wingmanDomain), false);
  }

  const installArguments = ['install', '--scope', 'project', '--project', project, '--agent', 'all'];
  const firstInstall = run(executable('wingmanpm-product-designer'), installArguments, consumer);
  assert.equal(count(firstInstall.stdout, promotion), 1, 'The branded installer must show the maker note once.');

  const secondInstall = run(executable('wingmanpm-product-designer'), installArguments, consumer);
  assert.equal(secondInstall.stdout.includes(promotion), false, 'The maker note must not repeat.');

  const installManifest = JSON.parse(await readFile(path.join(
    project, '.agents', 'skills', 'wingmanpm-product-designer', '.wingman-install.json'
  ), 'utf8'));
  assert.equal(installManifest.publisherNoteShown, true);

  const init = run(executable('wingman-design'), ['init', '--project', project], consumer);
  assert.equal(init.stdout.includes(wingmanDomain), false);
  const projectPackage = JSON.parse(await readFile(path.join(project, 'package.json'), 'utf8'));
  assert.equal(
    projectPackage.scripts['design:doctor'],
    'npx --yes wingmanpm-product-designer@1.0.0 doctor --project .'
  );
  const cleanPathDoctor = spawnSync(npxCommand, [
    '--yes', '--package', tarball, 'wingman-design', 'doctor', '--project', project
  ], {
    cwd: project,
    encoding: 'utf8',
    shell: windows,
    env: { ...process.env, NO_COLOR: '1' }
  });
  assert.notEqual(cleanPathDoctor.status, null, cleanPathDoctor.error?.message);
  assert.match(cleanPathDoctor.stdout, /Doctor:/, cleanPathDoctor.stdout + cleanPathDoctor.stderr);
  assert.equal(cleanPathDoctor.stdout.includes(wingmanDomain), false);
  const productContract = path.join(project, 'design-system', 'PRODUCT.md');
  await appendFile(productContract, '\nUser-owned release smoke note.\n');
  const upgrade = run(executable('wingman-design'), ['upgrade', '--project', project], consumer);
  assert.equal(upgrade.stdout.includes(wingmanDomain), false);
  assert.match(await readFile(productContract, 'utf8'), /User-owned release smoke note/);

  const changedSkill = path.join(project, '.agents', 'skills', 'wingmanpm-product-designer', 'SKILL.md');
  await appendFile(changedSkill, '\nLocal changed-file protection marker.\n');
  const uninstall = run(executable('wingman-design'), [
    'uninstall', '--scope', 'project', '--project', project, '--agent', 'all'
  ], consumer);
  assert.equal(uninstall.stdout.includes(wingmanDomain), false);
  assert.match(await readFile(changedSkill, 'utf8'), /Local changed-file protection marker/);
  for (const relative of [
    '.claude/skills/wingmanpm-product-designer',
    '.cursor/skills/wingmanpm-product-designer'
  ]) await assert.rejects(access(path.join(project, relative)), { code: 'ENOENT' });

  for (const file of await filesBelow(project)) {
    const content = await readFile(file).catch(() => Buffer.alloc(0));
    assert.equal(content.toString('utf8').includes(promotion), false, `${file} contains the installer promotion.`);
  }

  run(npmCommand, ['uninstall', '--ignore-scripts', '--no-audit', '--no-fund', 'wingmanpm-product-designer'], consumer);
  await assert.rejects(access(path.join(consumer, 'node_modules', 'wingmanpm-product-designer')), { code: 'ENOENT' });
  console.log(`Packed package lifecycle passed on Node ${process.versions.node} and ${process.platform}.`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
