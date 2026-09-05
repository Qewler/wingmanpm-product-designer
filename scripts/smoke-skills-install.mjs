#!/usr/bin/env node

// Exercise the real skills.sh installer, not our separate npm installer.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkExplorationBrowser } from './check-exploration-browser.mjs';
import { checkCraftBrowser } from './check-craft-browser.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillName = 'wingmanpm-product-designer';
const source = path.join(root, 'skills', skillName);
const installerVersion = '1.5.23';
const temporary = await mkdtemp(path.join(os.tmpdir(), 'wingman skills install '));
const windows = process.platform === 'win32';
const npm = windows ? 'npm.cmd' : 'npm';
const npx = windows ? 'npx.cmd' : 'npx';

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', shell: windows,
    timeout: 600_000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, DISABLE_TELEMETRY: '1', WINGMAN_DESIGN_AUTO_UPDATE: '0', NO_COLOR: '1', CI: '1' }
  });
  assert.equal(result.status, 0, `${command} failed: ${result.error?.message ?? ''}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

async function inventory(directory, prefix = '') {
  const found = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const relative = path.join(prefix, item.name);
    if (item.isDirectory()) found.push(...await inventory(path.join(directory, item.name), relative));
    else if (item.isFile()) found.push(relative);
  }
  return found.sort();
}

try {
  const expected = await inventory(source);
  let buildProject;
  for (const mode of ['symlink', 'copy']) {
    const consumer = path.join(temporary, mode);
    await mkdir(consumer);
    run(npx, ['--yes', `skills@${installerVersion}`, 'add', root,
      '--skill', skillName, '--agent', 'codex', 'claude-code', 'cursor', '--yes',
      ...(mode === 'copy' ? ['--copy'] : [])], consumer);

    // Codex and Cursor use the universal .agents copy. Claude has an adapter.
    const universal = path.join(consumer, '.agents', 'skills', skillName);
    const claude = path.join(consumer, '.claude', 'skills', skillName);
    for (const installed of [universal, claude]) {
      assert.notEqual(await realpath(installed), await realpath(source), 'Must install independently of the source checkout.');
      const actual = await inventory(installed);
      for (const relative of expected) {
        assert.ok(actual.includes(relative), `${mode} dropped ${relative}`);
        assert.deepEqual(await readFile(path.join(installed, relative)), await readFile(path.join(source, relative)), `${mode} changed ${relative}`);
      }
      const cli = path.join(installed, 'bin', 'wingman-design.mjs');
      assert.match(run(process.execPath, [cli, '--help'], consumer), /wingman-design init/);
      assert.equal(JSON.parse(run(process.execPath, [cli, 'commands', '--json'], consumer)).length, 19);
      run(process.execPath, [cli, 'search', 'contrast'], consumer);
    }

    const cli = path.join(universal, 'bin', 'wingman-design.mjs');
    for (const kind of ['neutral', 'react']) {
      const project = path.join(consumer, `${kind} project`);
      await mkdir(project);
      const fixture = JSON.parse(await readFile(path.join(root, 'fixtures/neutral-saas/package.json'), 'utf8'));
      const metadata = { name: `skills-smoke-${kind}`, private: true, type: 'module' };
      if (kind === 'react') {
        metadata.dependencies = Object.fromEntries(Object.entries(fixture.dependencies).filter(([key]) => key !== 'lucide-react'));
        metadata.devDependencies = Object.fromEntries(Object.entries(fixture.devDependencies).filter(([key]) => key === 'typescript' || key.startsWith('@types/')));
      }
      await writeFile(path.join(project, 'package.json'), JSON.stringify(metadata, null, 2));
      run(process.execPath, [cli, 'init', '--project', project], consumer);
      const initialized = JSON.parse(await readFile(path.join(project, 'package.json'), 'utf8'));
      if (kind === 'react') {
        assert.ok(initialized.dependencies['lucide-react'], 'Fresh UI must declare its icon dependency before any table is added.');
        for (const dep of ['storybook', '@storybook/react', '@storybook/react-vite', '@storybook/addon-a11y', 'vite', '@playwright/test', '@axe-core/playwright']) {
          assert.ok(initialized.devDependencies[dep], `Missing generated tooling dependency: ${dep}`);
        }
        await readFile(path.join(project, '.storybook/main.ts'));
        if (mode === 'symlink') buildProject = project;
      }
      for (const profile of ['static', 'work', 'editable']) {
        run(process.execPath, [cli, 'add', 'data-table', '--project', project, '--profile', profile, '--id', `smoke-${profile}`], consumer);
        await readFile(path.join(project, 'design-system/tables', `smoke-${profile}.json`));
      }
      if (kind === 'react') {
        const generated = JSON.parse(await readFile(path.join(project, 'package.json'), 'utf8'));
        for (const dep of ['@tanstack/react-table', '@dnd-kit/react', 'lucide-react']) assert.ok(generated.dependencies[dep], `Missing ${dep}`);
      }
      // No network/npm wrapper is required by the copied project runtime.
      const report = spawnSync(process.execPath, [path.join(project, '.wingmanpm-design/runtime/checker.mjs'), '--project', project, '--json'], { cwd: consumer, encoding: 'utf8' });
      assert.equal(report.status, 1, report.stderr); // Browser proof is honestly pending.
      assert.ok(JSON.parse(report.stdout).counts.block > 0);
      assert.match(report.stdout, /Machine-written browser evidence is missing/);
    }
    console.log(`PASS skills@${installerVersion} ${mode}: all ${expected.length} files, Core 3 paths, bundled CLI, both stacks, all table profiles.`);
  }
  if (process.argv.includes('--build')) {
    console.log('Resolving generated dependencies and building the installed React scaffold.');
    run(npm, ['install', '--ignore-scripts', '--no-audit', '--no-fund'], buildProject);
    run(npm, ['run', 'build-storybook'], buildProject);
    console.log('PASS clean dependency install and Storybook build from the skills.sh bundle.');
    if (process.argv.includes('--browser')) {
      run(npm, ['exec', '--no', '--', 'playwright', 'install', ...(process.platform === 'linux' ? ['--with-deps'] : []), 'chromium'], buildProject);
      await checkExplorationBrowser(path.join(temporary, 'symlink', '.agents', 'skills', skillName), buildProject, process.env.WINGMAN_ARTIFACT_DIR);
      await checkCraftBrowser(path.join(temporary, 'symlink', '.agents', 'skills', skillName), buildProject, process.env.WINGMAN_ARTIFACT_DIR);
    }
  }
} finally {
  if (process.argv.includes('--keep')) console.log(`Saved smoke sandbox: ${temporary}`);
  else await rm(temporary, { recursive: true, force: true });
}
