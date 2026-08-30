import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFile, lstat, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compileTokens } from '../src/tokens.mjs';
import { hashReviewSources } from '../src/checker.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'bin', 'wingman-design.mjs');

function run(args, cwd) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
}

async function hashFile(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

async function project(options = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wingman-design-test-'));
  const packageJson = options.neutral ? {
    name: 'neutral-test', private: true, type: 'module', scripts: {}
  } : {
    name: 'golden-test', private: true, type: 'module', scripts: {},
    dependencies: { next: '^16.3.3', react: '^19.2.8', tailwindcss: '^4.3.3', 'lucide-react': '^1.37.0' }
  };
  await writeFile(path.join(directory, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
  if (options.git) spawnSync('git', ['init', '-b', 'main'], { cwd: directory, encoding: 'utf8' });
  return directory;
}

async function writePassedBrowserEvidence(directory, dropdownCandidateCount = 1) {
  await writeFile(path.join(directory, '.wingmanpm-design', 'browser-evidence.json'), `${JSON.stringify({
    schemaVersion: 1, status: 'passed', sourceHash: await hashReviewSources(directory), completedAt: new Date().toISOString(),
    tests: { passed: 1, failed: 0, skipped: 0 }, storyCount: 1, themes: ['light', 'dark'],
    structureUnique: true, dropdownContrast: true, dropdownCandidateCount
  }, null, 2)}\n`);
}

test('help lists the five lifecycle commands', () => {
  const result = run(['--help'], root);
  assert.equal(result.status, 0, result.stderr);
  for (const command of ['install', 'init', 'check', 'doctor', 'uninstall']) assert.match(result.stdout, new RegExp(command));
});

test('commands exposes the 18 intent families as text and JSON', () => {
  const textResult = run(['commands'], root);
  assert.equal(textResult.status, 0, textResult.stderr);
  assert.match(textResult.stdout, /polish \/ beautiful/);
  assert.match(textResult.stdout, /review \/ audit[\s\S]*read-only unless --fix/);
  assert.match(textResult.stdout, /data-table \/ table/);

  const jsonResult = run(['commands', '--json'], root);
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  const commands = JSON.parse(jsonResult.stdout);
  assert.equal(commands.length, 18);
  assert.equal(commands.find(({ id }) => id === 'standout').aliases[0], 'stunning');
});

test('explain distinguishes vague pickers, explicit commands, and read-only reviews', () => {
  const vague = run(['explain', 'make it stunning', '--json'], root);
  assert.equal(vague.status, 0, vague.stderr);
  const picker = JSON.parse(vague.stdout);
  assert.equal(picker.kind, 'picker');
  assert.equal(picker.intent, 'standout');
  assert.equal(picker.recommendedLevel, 'elevate');
  assert.deepEqual(picker.options.map(({ id }) => id), ['refine', 'elevate', 'reimagine']);

  const explicit = run(['explain', 'stunning', '--explicit', '--level', 'reimagine', '--json'], root);
  assert.equal(explicit.status, 0, explicit.stderr);
  const direct = JSON.parse(explicit.stdout);
  assert.equal(direct.kind, 'direct');
  assert.equal(direct.intent, 'standout');
  assert.equal(direct.level, 'reimagine');

  const audit = run(['explain', 'audit', '--explicit', '--json'], root);
  assert.equal(audit.status, 0, audit.stderr);
  assert.equal(JSON.parse(audit.stdout).readOnly, true);
  const fixedAudit = run(['explain', 'audit', '--explicit', '--fix', '--json'], root);
  assert.equal(fixedAudit.status, 0, fixedAudit.stderr);
  assert.equal(JSON.parse(fixedAudit.stdout).readOnly, false);
});

test('init creates a complete golden-stack contract and is idempotent', async () => {
  const directory = await project({ git: true });
  await writeFile(path.join(directory, 'AGENTS.md'), 'Existing instructions stay.\n');
  const first = run(['init', '--project', directory], root);
  assert.equal(first.status, 0, first.stderr);
  for (const relative of [
    'design-system/PRODUCT.md', 'design-system/DESIGN.md', 'design-system/tokens/tokens.json',
    'design-system/tokens/tokens.css', 'src/components/wingman-design/AppShell.tsx',
    'src/stories/WingmanProduct.stories.tsx', '.storybook/main.ts',
    '.wingmanpm-design/manifest.json', '.wingmanpm-design/runtime/checker.mjs', '.wingmanpm-design/runtime/browser-reporter.mjs',
    '.cursor/rules/wingmanpm-product-designer.mdc', 'playwright.wingman.config.ts'
  ]) assert.equal(await readFile(path.join(directory, relative), 'utf8').then(() => true), true, relative);
  assert.match(await readFile(path.join(directory, 'AGENTS.md'), 'utf8'), /Existing instructions stay[\s\S]*wingmanpm-product-designer:start/);
  await appendFile(path.join(directory, 'design-system', 'PRODUCT.md'), '\nUser-owned fact.\n');
  const second = run(['init', '--project', directory], root);
  assert.equal(second.status, 0, second.stderr);
  assert.match(await readFile(path.join(directory, 'design-system', 'PRODUCT.md'), 'utf8'), /User-owned fact/);
  await writePassedBrowserEvidence(directory);
  const check = run(['check', '--project', directory, '--allow-pending-review'], root);
  assert.equal(check.status, 0, check.stdout + check.stderr);
  assert.match(check.stdout, /0 block/);
});

test('framework-neutral init creates semantic output without React files', async () => {
  const directory = await project({ neutral: true });
  const result = run(['init', '--project', directory], root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(await readFile(path.join(directory, 'design-system', 'examples', 'semantic-ui.html'), 'utf8'), /Framework-neutral SaaS contract/);
  const config = JSON.parse(await readFile(path.join(directory, '.wingmanpm-design', 'config.json'), 'utf8'));
  assert.equal(config.goldenStack, false);
});

test('init preserves AGENTS symlinks and skips shared hooks in linked worktrees', async () => {
  const directory = await project({ neutral: true });
  await writeFile(path.join(directory, 'CLAUDE.md'), 'Shared project instructions.\n');
  await symlink('CLAUDE.md', path.join(directory, 'AGENTS.md'));
  await writeFile(path.join(directory, '.git'), `gitdir: ${path.join(os.tmpdir(), 'example-linked-worktree')}\n`);
  const result = run(['init', '--project', directory, '--mode', 'preserve'], root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await lstat(path.join(directory, 'AGENTS.md'))).isSymbolicLink(), true);
  assert.match(await readFile(path.join(directory, 'CLAUDE.md'), 'utf8'), /Shared project instructions[\s\S]*wingmanpm-product-designer:start/);
});

test('preserve mode baselines old findings but blocks a new regression', async () => {
  const directory = await project({ neutral: true });
  await mkdir(path.join(directory, 'src'), { recursive: true });
  const target = path.join(directory, 'src', 'legacy.tsx');
  await writeFile(target, 'export const Legacy = () => <div className="transition-all">Legacy</div>;\n');
  const initialized = run(['init', '--project', directory, '--mode', 'preserve'], root);
  assert.equal(initialized.status, 0, initialized.stderr);
  await mkdir(path.join(directory, 'tests', 'wingman-design'), { recursive: true });
  await writeFile(path.join(directory, 'tests', 'wingman-design', 'visual.spec.ts'), `
test('WPD022 structure audit', async () => { const structureViolations = await auditVisibleStructure(); expect(structureViolations).toEqual([]); });
`);
  await writePassedBrowserEvidence(directory);
  const clean = run(['check', '--project', directory, '--allow-pending-review'], root);
  assert.equal(clean.status, 0, clean.stdout + clean.stderr);
  assert.match(clean.stdout, /1 legacy/);
  await appendFile(target, 'export const Regression = () => <div className="transition-all">New</div>;\n');
  const blocked = run(['check', '--project', directory, '--allow-pending-review'], root);
  assert.equal(blocked.status, 1);
  assert.match(blocked.stdout, /WPD005/);
});

test('check blocks a deterministic violation and accepts a scoped dated exception', async () => {
  const directory = await project();
  assert.equal(run(['init', '--project', directory], root).status, 0);
  const target = path.join(directory, 'src', 'components', 'wingman-design', 'Violation.tsx');
  await writeFile(target, 'export const Bad = () => <div className="transition-all">Bad</div>;\n');
  await writePassedBrowserEvidence(directory);
  const blocked = run(['check', '--project', directory, '--allow-pending-review'], root);
  assert.equal(blocked.status, 1);
  assert.match(blocked.stdout, /WPD005/);
  await writeFile(path.join(directory, '.wingmanpm-design', 'exceptions.json'), `${JSON.stringify({
    exceptions: [{
      ruleId: 'WPD005', target: 'src/components/wingman-design/Violation.tsx',
      reason: 'Temporary migration of an established interaction.', approver: 'Julius', reviewDate: '2099-12-31'
    }]
  }, null, 2)}\n`);
  const excepted = run(['check', '--project', directory, '--allow-pending-review'], root);
  assert.equal(excepted.status, 0, excepted.stdout + excepted.stderr);
  assert.match(excepted.stdout, /1 excepted/);
});

test('doctor detects generated token drift', async () => {
  const directory = await project();
  assert.equal(run(['init', '--project', directory], root).status, 0);
  await appendFile(path.join(directory, 'design-system', 'tokens', 'tokens.css'), '\n/* drift */\n');
  const result = run(['doctor', '--project', directory], root);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /FAIL tokens:tokens.css/);
});

test('doctor detects a stale project checker runtime', async () => {
  const directory = await project();
  assert.equal(run(['init', '--project', directory], root).status, 0);
  await appendFile(path.join(directory, '.wingmanpm-design', 'runtime', 'checker.mjs'), '\n// stale runtime\n');
  const result = run(['doctor', '--project', directory], root);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /FAIL runtime/);
});

test('init refreshes an unchanged stale checker runtime', async () => {
  const directory = await project();
  assert.equal(run(['init', '--project', directory], root).status, 0);
  const manifestFile = path.join(directory, '.wingmanpm-design', 'manifest.json');
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  const runtime = path.join(directory, '.wingmanpm-design', 'runtime', 'checker.mjs');
  await writeFile(runtime, '// old managed runtime\n');
  const entry = manifest.entries.find((item) => item.path === '.wingmanpm-design/runtime/checker.mjs');
  entry.hash = (await import('node:crypto')).createHash('sha256').update('// old managed runtime\n').digest('hex');
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  const refreshed = run(['init', '--project', directory], root);
  assert.equal(refreshed.status, 0, refreshed.stderr);
  assert.match(refreshed.stdout, /runtime refreshed/);
  assert.match(await readFile(runtime, 'utf8'), /export async function runChecks/);
});

test('project uninstall removes only managed files and preserves user and seeded work', async () => {
  const directory = await project({ git: true });
  await writeFile(path.join(directory, 'AGENTS.md'), 'Keep this instruction.\n');
  assert.equal(run(['init', '--project', directory], root).status, 0);
  const result = run(['uninstall', '--project', directory], root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal((await readFile(path.join(directory, 'AGENTS.md'), 'utf8')).trim(), 'Keep this instruction.');
  assert.match(await readFile(path.join(directory, 'design-system', 'PRODUCT.md'), 'utf8'), /Product Truth/);
  assert.match(await readFile(path.join(directory, 'src', 'components', 'wingman-design', 'AppShell.tsx'), 'utf8'), /AppShell/);
  await assert.rejects(readFile(path.join(directory, '.wingmanpm-design', 'runtime', 'checker.mjs'), 'utf8'));
});

test('project-scoped skill install and uninstall preserve changed installed files', async () => {
  const directory = await project({ neutral: true });
  const install = run(['install', '--agent', 'codex', '--scope', 'project', '--project', directory], root);
  assert.equal(install.status, 0, install.stderr);
  const skill = path.join(directory, '.agents', 'skills', 'wingmanpm-product-designer', 'SKILL.md');
  const commandSchema = path.join(directory, '.agents', 'skills', 'wingmanpm-product-designer', 'schemas', 'commands.schema.json');
  assert.equal(JSON.parse(await readFile(commandSchema, 'utf8')).title, 'WingmanPM Product Designer command registry');
  await appendFile(skill, '\nLocal change.\n');
  const uninstall = run(['uninstall', '--agent', 'codex', '--scope', 'project', '--project', directory], root);
  assert.equal(uninstall.status, 0, uninstall.stderr);
  assert.match(uninstall.stdout, /conflict/);
  assert.match(await readFile(skill, 'utf8'), /Local change/);
});

test('project-scoped all-agent install is portable, complete, repeatable, and safely removable', async () => {
  const directory = await project({ neutral: true });
  const install = run(['install', '--agent', 'all', '--scope', 'project', '--project', directory], root);
  assert.equal(install.status, 0, install.stdout + install.stderr);
  const destinations = [
    path.join(directory, '.agents', 'skills', 'wingmanpm-product-designer'),
    path.join(directory, '.claude', 'skills', 'wingmanpm-product-designer'),
    path.join(directory, '.cursor', 'skills', 'wingmanpm-product-designer')
  ];
  const requiredAssets = [
    'bin/wingman-design.mjs',
    'src/cli.mjs',
    'src/checker.mjs',
    'src/browser-reporter.mjs',
    'templates/project/tests/wingman-design/visual.spec.ts',
    'templates/data-table/react/data-table/DataTable.tsx',
    'scripts/validate-skill.mjs',
    'schemas/browser-evidence.schema.json'
  ];

  for (const destination of destinations) {
    const manifest = JSON.parse(await readFile(path.join(destination, '.wingman-install.json'), 'utf8'));
    assert.match(manifest.source, /^wingmanpm-product-designer@0\.2\.0-private\.2$/);
    assert.equal(path.isAbsolute(manifest.source), false);
    assert.equal(JSON.stringify(manifest).includes(root), false);
    assert.equal(JSON.stringify(manifest).includes(directory), false);
    for (const item of manifest.files) {
      assert.equal(path.isAbsolute(item.path), false, item.path);
      const installedFile = path.join(destination, item.path);
      assert.equal(item.hash, await hashFile(installedFile), item.path);
      assert.equal((await readFile(installedFile)).includes(Buffer.from(root)), false, item.path);
    }
    for (const relative of requiredAssets) {
      const installedFile = path.join(destination, relative);
      const entry = manifest.files.find((item) => item.path === relative);
      assert.ok(entry, relative);
      assert.equal(entry.hash, await hashFile(installedFile), relative);
    }
  }

  const repeat = run(['install', '--agent', 'all', '--scope', 'project', '--project', directory], root);
  assert.equal(repeat.status, 0, repeat.stdout + repeat.stderr);
  for (const destination of destinations) await writeFile(path.join(destination, 'LOCAL-NOTE.md'), 'Keep this user file.\n');

  const uninstall = run(['uninstall', '--agent', 'all', '--scope', 'project', '--project', directory], root);
  assert.equal(uninstall.status, 0, uninstall.stdout + uninstall.stderr);
  for (const destination of destinations) {
    assert.match(await readFile(path.join(destination, 'LOCAL-NOTE.md'), 'utf8'), /Keep this user file/);
    await assert.rejects(readFile(path.join(destination, 'src', 'browser-reporter.mjs')), { code: 'ENOENT' });
    await assert.rejects(readFile(path.join(destination, '.wingman-install.json')), { code: 'ENOENT' });
  }
});

test('DTCG token compiler creates theme, Tailwind, and shadcn outputs', async () => {
  const tokens = JSON.parse(await readFile(path.join(root, 'templates', 'design-system', 'tokens', 'tokens.json'), 'utf8'));
  const compiled = compileTokens(tokens);
  assert.match(compiled.css, /--wpd-color-canvas/);
  assert.match(compiled.css, /data-theme="dark"/);
  assert.match(compiled.tailwind, /transitionDuration/);
  assert.match(compiled.shadcn, /--background/);
});
