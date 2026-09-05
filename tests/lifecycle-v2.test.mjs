import assert from 'node:assert/strict';
import { appendFile, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { hashReviewSources } from '../skills/wingmanpm-product-designer/src/checker.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'bin', 'wingman-design.mjs');
const baseChecks = ['keyboard', 'zoom200', 'reducedMotion', 'longContent', 'light', 'dark', 'axe', 'responsiveStates', 'structureUnique', 'dropdownContrast'];
const tableChecks = ['tableDensity', 'tableColumns', 'tablePagination', 'tableExpansion', 'tableBulk'];

function run(args, cwd = root) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
}

function hash(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function project({ git = true, tailwind = true } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wingman-lifecycle-v2-'));
  const dependencies = { next: '^16.3.3', react: '^19.2.8', 'lucide-react': '^1.37.0' };
  if (tailwind) dependencies.tailwindcss = '^4.3.3';
  await writeFile(path.join(directory, 'package.json'), `${JSON.stringify({
    name: 'wingman-lifecycle-v2', private: true, type: 'module', scripts: {},
    dependencies
  }, null, 2)}\n`);
  if (git) spawnSync('git', ['init', '-b', 'main'], { cwd: directory, encoding: 'utf8' });
  return directory;
}

async function json(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function writePassedBrowserEvidence(directory, dropdownCandidateCount = 1) {
  await writeFile(path.join(directory, '.wingmanpm-design', 'browser-evidence.json'), `${JSON.stringify({
    schemaVersion: 1, status: 'passed', sourceHash: await hashReviewSources(directory), completedAt: new Date().toISOString(),
    tests: { passed: 1, failed: 0, skipped: 0 }, storyCount: 1, themes: ['light', 'dark'],
    structureUnique: true, dropdownContrast: true, dropdownCandidateCount
  }, null, 2)}\n`);
}

async function snapshot(files) {
  return Object.fromEntries(await Promise.all(files.map(async (file) => {
    try {
      const content = await readFile(file, 'utf8');
      const metadata = await stat(file);
      return [file, { content, mtimeMs: metadata.mtimeMs }];
    } catch (error) {
      if (error.code === 'ENOENT') return [file, null];
      throw error;
    }
  })));
}

test('fresh init records v2 ownership, runtime assets, clean checks, and a clean doctor', async () => {
  const directory = await project();
  const initialized = run(['init', '--project', directory]);
  assert.equal(initialized.status, 0, initialized.stderr);

  const config = await json(path.join(directory, '.wingmanpm-design', 'config.json'));
  const manifest = await json(path.join(directory, '.wingmanpm-design', 'manifest.json'));
  assert.equal(config.schemaVersion, 2);
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.version, '1.1.0');
  assert.equal(manifest.entries.find(({ path: entry }) => entry === 'design-system/tables/README.md')?.ownership, 'user');
  assert.equal(manifest.entries.find(({ path: entry }) => entry === '.wingmanpm-design/table-inventory.json')?.ownership, 'observed');
  assert.equal(manifest.entries.find(({ path: entry }) => entry === '.wingmanpm-design/browser-evidence.json')?.ownership, 'observed');

  for (const relative of [
    '.wingmanpm-design/runtime/checker.mjs',
    '.wingmanpm-design/runtime/browser-reporter.mjs',
    '.wingmanpm-design/runtime/rules.json',
    '.wingmanpm-design/runtime/schemas/config.schema.json',
    '.wingmanpm-design/runtime/schemas/browser-evidence.schema.json',
    '.wingmanpm-design/runtime/schemas/commands.schema.json',
    '.wingmanpm-design/runtime/schemas/table-contract.schema.json'
  ]) assert.equal(Boolean(await readFile(path.join(directory, relative), 'utf8')), true, relative);
  assert.match(await readFile(path.join(directory, 'playwright.wingman.config.ts'), 'utf8'), /browser-reporter\.mjs/);

  await writePassedBrowserEvidence(directory);
  const checked = run(['check', '--project', directory, '--allow-pending-review']);
  assert.equal(checked.status, 0, checked.stdout + checked.stderr);
  const doctor = run(['doctor', '--project', directory]);
  assert.equal(doctor.status, 0, doctor.stdout + doctor.stderr);
  assert.match(doctor.stdout, /PASS manifest-version/);
  assert.match(doctor.stdout, /PASS table-inventory-ownership/);
  assert.match(doctor.stdout, /PASS browser-evidence/);
  assert.match(doctor.stdout, /PASS browser-evidence-ownership/);
});

test('doctor describes React projects without the golden stack truthfully', async () => {
  const directory = await project({ tailwind: false });
  assert.equal(run(['init', '--project', directory]).status, 0);
  const doctor = run(['doctor', '--project', directory]);
  assert.match(doctor.stdout, /Storybook is optional for this non-golden-stack project \(Next\.js \+ React\)\./);
  assert.doesNotMatch(doctor.stdout, /framework-neutral project/);
});

test('upgrade dry-run is read-only and actual upgrade is safe and idempotent', async () => {
  const directory = await project();
  assert.equal(run(['init', '--project', directory]).status, 0);
  const configFile = path.join(directory, '.wingmanpm-design', 'config.json');
  const manifestFile = path.join(directory, '.wingmanpm-design', 'manifest.json');
  const inventoryFile = path.join(directory, '.wingmanpm-design', 'table-inventory.json');
  const checkerFile = path.join(directory, '.wingmanpm-design', 'runtime', 'checker.mjs');
  const commandSchema = path.join(directory, '.wingmanpm-design', 'runtime', 'schemas', 'commands.schema.json');
  const playwrightFile = path.join(directory, 'playwright.wingman.config.ts');
  const reviewFile = path.join(directory, '.wingmanpm-design', 'review.json');

  const config = await json(configFile);
  config.schemaVersion = 1;
  delete config.legacyBaseline;
  delete config.scanRoots;
  await writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`);
  const manifest = await json(manifestFile);
  manifest.schemaVersion = 1;
  manifest.version = '0.1.0-private.1';
  const oldRuntime = '// managed v1 checker\n';
  await writeFile(checkerFile, oldRuntime);
  manifest.entries.find(({ path: entry }) => entry === '.wingmanpm-design/runtime/checker.mjs').hash = hash(oldRuntime);
  const oldPlaywright = (await readFile(playwrightFile, 'utf8')).replace(/^\s*reporter:.*\n/m, '');
  await writeFile(playwrightFile, oldPlaywright);
  manifest.entries.find(({ path: entry }) => entry === 'playwright.wingman.config.ts').hash = hash(oldPlaywright);
  const oldReview = {
    status: 'reviewed', reviewer: 'Legacy reviewer', reviewedAt: '2026-08-30T10:00:00.000Z', sourceHash: 'a'.repeat(64),
    viewports: [390, 768, 1280, 1440],
    checks: { keyboard: true, zoom200: true, reducedMotion: true, longContent: true, light: true, dark: true, axe: true, responsiveStates: true },
    notes: 'Old review shape.'
  };
  await writeFile(reviewFile, `${JSON.stringify(oldReview, null, 2)}\n`);
  manifest.entries.find(({ path: entry }) => entry === '.wingmanpm-design/review.json').hash = hash(`${JSON.stringify(oldReview, null, 2)}\n`);
  await rm(commandSchema);
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);

  const tracked = [configFile, manifestFile, inventoryFile, checkerFile, commandSchema, playwrightFile, reviewFile];
  const beforeDryRun = await snapshot(tracked);
  const dryRun = run(['upgrade', '--project', directory, '--dry-run']);
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.match(dryRun.stdout, /REFRESH \.wingmanpm-design\/runtime\/checker\.mjs/);
  assert.match(dryRun.stdout, /CREATE \.wingmanpm-design\/runtime\/schemas\/commands\.schema\.json/);
  assert.match(dryRun.stdout, /REFRESH playwright\.wingman\.config\.ts/);
  assert.match(dryRun.stdout, /UPDATE \.wingmanpm-design\/review\.json to pending/);
  assert.deepEqual(await snapshot(tracked), beforeDryRun);

  const upgraded = run(['upgrade', '--project', directory]);
  assert.equal(upgraded.status, 0, upgraded.stderr);
  assert.equal((await json(configFile)).schemaVersion, 2);
  assert.deepEqual((await json(configFile)).scanRoots, ['src', 'app', 'pages', 'components', 'stories', 'design-system/examples']);
  assert.equal(typeof (await json(configFile)).legacyBaseline, 'boolean');
  assert.equal((await json(manifestFile)).schemaVersion, 2);
  const migratedReview = await json(reviewFile);
  assert.equal(migratedReview.status, 'pending');
  assert.equal(migratedReview.reviewer, null);
  assert.equal(migratedReview.checks.structureUnique, false);
  assert.equal(migratedReview.checks.dropdownContrast, false);
  assert.equal((await json(manifestFile)).entries.find(({ path: entry }) => entry === '.wingmanpm-design/review.json').hash, hash(await readFile(reviewFile, 'utf8')));
  assert.match(await readFile(checkerFile, 'utf8'), /export async function runChecks/);
  assert.match(await readFile(playwrightFile, 'utf8'), /browser-reporter\.mjs/);
  assert.equal((await json(commandSchema)).title, 'WingmanPM Product Designer command registry');

  const afterUpgrade = await snapshot(tracked);
  const second = run(['upgrade', '--project', directory]);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /Already current/);
  assert.deepEqual(await snapshot(tracked), afterUpgrade);
});

test('upgrade refuses and preserves a locally changed managed runtime', async () => {
  const directory = await project();
  assert.equal(run(['init', '--project', directory]).status, 0);
  const runtime = path.join(directory, '.wingmanpm-design', 'runtime', 'checker.mjs');
  const config = path.join(directory, '.wingmanpm-design', 'config.json');
  const manifest = path.join(directory, '.wingmanpm-design', 'manifest.json');
  await appendFile(runtime, '\n// local protected change\n');
  const before = await snapshot([runtime, config, manifest]);
  const result = run(['upgrade', '--project', directory]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Refusing to replace a locally changed or unmanaged runtime asset/);
  assert.deepEqual(await snapshot([runtime, config, manifest]), before);
});

test('no-change upgrade preserves valid reviewed proof bytes and mtimes', async () => {
  const directory = await project();
  assert.equal(run(['init', '--project', directory]).status, 0);
  await writePassedBrowserEvidence(directory);
  const recorded = run([
    'check', '--record-review', '--project', directory, '--reviewer', 'Morgan Lee',
    '--confirm', baseChecks.join(',')
  ]);
  assert.equal(recorded.status, 0, recorded.stdout + recorded.stderr);
  const reviewFile = path.join(directory, '.wingmanpm-design', 'review.json');
  const manifestFile = path.join(directory, '.wingmanpm-design', 'manifest.json');
  const before = await snapshot([reviewFile, manifestFile]);
  const upgrade = run(['upgrade', '--project', directory]);
  assert.equal(upgrade.status, 0, upgrade.stdout + upgrade.stderr);
  assert.match(upgrade.stdout, /Already current/);
  assert.deepEqual(await snapshot([reviewFile, manifestFile]), before);

  const incompleteReview = await json(reviewFile);
  incompleteReview.checks.keyboard = false;
  const incompleteContent = `${JSON.stringify(incompleteReview, null, 2)}\n`;
  await writeFile(reviewFile, incompleteContent);
  const incompleteManifest = await json(manifestFile);
  incompleteManifest.entries.find(({ path: entry }) => entry === '.wingmanpm-design/review.json').hash = hash(incompleteContent);
  await writeFile(manifestFile, `${JSON.stringify(incompleteManifest, null, 2)}\n`);
  const invalidated = run(['upgrade', '--project', directory]);
  assert.equal(invalidated.status, 0, invalidated.stdout + invalidated.stderr);
  assert.equal((await json(reviewFile)).status, 'pending');
  assert.ok(Object.values((await json(reviewFile)).checks).every((value) => value === false));
});

test('v1 upgrade snapshots legacy table sources and never refreshes their baseline hash', async () => {
  const directory = await project();
  assert.equal(run(['init', '--project', directory]).status, 0);
  const sourceFile = path.join(directory, 'src', 'LegacyOrdersTable.tsx');
  const source = 'export const LegacyOrders = () => <DataTable tableId="legacy-orders" profile="work" />;\n';
  await writeFile(sourceFile, source);

  const configFile = path.join(directory, '.wingmanpm-design', 'config.json');
  const manifestFile = path.join(directory, '.wingmanpm-design', 'manifest.json');
  const config = await json(configFile);
  config.schemaVersion = 1;
  await writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`);
  const manifest = await json(manifestFile);
  manifest.schemaVersion = 1;
  manifest.version = '0.1.0-private.1';
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);

  const upgraded = run(['upgrade', '--project', directory]);
  assert.equal(upgraded.status, 0, upgraded.stdout + upgraded.stderr);
  const inventoryFile = path.join(directory, '.wingmanpm-design', 'table-inventory.json');
  const legacy = (await json(inventoryFile)).tables.find(({ file }) => file === 'src/LegacyOrdersTable.tsx');
  assert.equal(legacy.status, 'legacy');
  assert.equal(legacy.sourceHash, hash(source));

  await writePassedBrowserEvidence(directory);
  const unchanged = run(['check', '--project', directory, '--allow-pending-review']);
  assert.equal(unchanged.status, 0, unchanged.stdout + unchanged.stderr);
  assert.match(unchanged.stdout, /WARN WPD018 .*unchanged legacy/);

  await writeFile(sourceFile, source.replace('LegacyOrders =', 'ChangedLegacyOrders ='));
  let changed = run(['check', '--project', directory, '--allow-pending-review']);
  assert.equal(changed.status, 1);
  assert.match(changed.stdout, /BLOCK WPD018/);

  assert.equal(run(['upgrade', '--project', directory]).status, 0);
  assert.equal((await json(inventoryFile)).tables.find(({ file }) => file === 'src/LegacyOrdersTable.tsx').sourceHash, hash(source));
  changed = run(['check', '--project', directory, '--allow-pending-review']);
  assert.equal(changed.status, 1);
  assert.match(changed.stdout, /BLOCK WPD018/);
});

test('doctor reports stale table inventory and upgrade removes deleted surfaces', async () => {
  const directory = await project();
  assert.equal(run(['init', '--project', directory]).status, 0);
  const sourceFile = path.join(directory, 'src', 'LegacyGrid.tsx');
  await writeFile(sourceFile, 'export const LegacyGrid = () => <DataGrid rows={[]} />;\n');

  const configFile = path.join(directory, '.wingmanpm-design', 'config.json');
  const manifestFile = path.join(directory, '.wingmanpm-design', 'manifest.json');
  const config = await json(configFile);
  config.schemaVersion = 1;
  await writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`);
  const manifest = await json(manifestFile);
  manifest.schemaVersion = 1;
  manifest.version = '0.1.0-private.1';
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);

  assert.equal(run(['upgrade', '--project', directory]).status, 0);
  const inventoryFile = path.join(directory, '.wingmanpm-design', 'table-inventory.json');
  assert.ok((await json(inventoryFile)).tables.some(({ file }) => file === 'src/LegacyGrid.tsx'));
  await rm(sourceFile);

  const doctor = run(['doctor', '--project', directory]);
  assert.match(doctor.stdout, /WARN table-inventory: .*1 saved table surface\(s\) are stale/);
  assert.equal(run(['upgrade', '--project', directory]).status, 0);
  assert.equal((await json(inventoryFile)).tables.some(({ file }) => file === 'src/LegacyGrid.tsx'), false);
  const cleanDoctor = run(['doctor', '--project', directory]);
  assert.doesNotMatch(cleanDoctor.stdout, /saved table surface\(s\) are stale/);
});

test('upgrade keeps generated static, work, and editable table inventory current', async () => {
  const directory = await project();
  assert.equal(run(['init', '--project', directory]).status, 0);
  for (const profile of ['static', 'work', 'editable']) {
    const added = run(['add', 'data-table', '--project', directory, '--profile', profile, '--id', `${profile}-records`]);
    assert.equal(added.status, 0, added.stdout + added.stderr);
  }

  const inventoryFile = path.join(directory, '.wingmanpm-design', 'table-inventory.json');
  const before = await json(inventoryFile);
  for (const profile of ['static', 'work', 'editable']) {
    assert.ok(before.tables.some(({ id, status }) => id === `${profile}-records` && status === 'generated'), profile);
  }

  const upgraded = run(['upgrade', '--project', directory]);
  assert.equal(upgraded.status, 0, upgraded.stdout + upgraded.stderr);
  const after = await json(inventoryFile);
  for (const profile of ['static', 'work', 'editable']) {
    assert.ok(after.tables.some(({ id }) => id === `${profile}-records`), profile);
  }
  const doctor = run(['doctor', '--project', directory]);
  assert.doesNotMatch(doctor.stdout, /saved table surface\(s\) are stale/);
  assert.match(doctor.stdout, /PASS table-inventory:/);
});

test('review confirmations adapt to work and editable table contracts', async () => {
  const directory = await project();
  assert.equal(run(['init', '--project', directory]).status, 0);
  const added = run(['add', 'data-table', '--project', directory, '--profile', 'editable', '--id', 'work-items']);
  assert.equal(added.status, 0, added.stdout + added.stderr);
  const contractFile = path.join(directory, 'design-system', 'tables', 'work-items.json');
  assert.equal((await json(contractFile)).profile, 'editable');
  assert.equal((await json(path.join(directory, '.wingmanpm-design', 'manifest.json'))).entries
    .find(({ path: entry }) => entry === 'design-system/tables/work-items.json')?.ownership, 'user');
  assert.equal(run(['upgrade', '--project', directory]).status, 0);
  const generatedInventory = (await json(path.join(directory, '.wingmanpm-design', 'table-inventory.json'))).tables
    .find(({ file }) => file.endsWith('/WorkItemsTable.tsx'));
  assert.ok(generatedInventory);
  assert.notEqual(generatedInventory.status, 'legacy');

  const withoutTable = run([
    'check', '--record-review', '--project', directory, '--reviewer', 'Morgan Lee',
    '--confirm', [...baseChecks, ...tableChecks].join(',')
  ]);
  assert.equal(withoutTable.status, 1);
  assert.match(withoutTable.stderr, /tableEditing/);

  const withoutEvidence = run([
    'check', '--record-review', '--project', directory, '--reviewer', 'Morgan Lee',
    '--confirm', [...baseChecks, ...tableChecks, 'tableEditing'].join(',')
  ]);
  assert.equal(withoutEvidence.status, 1);
  assert.match(withoutEvidence.stderr, /Machine-written browser evidence is missing/);

  await writePassedBrowserEvidence(directory, 4);

  const pendingCheck = run(['check', '--project', directory, '--allow-pending-review']);
  assert.equal(pendingCheck.status, 0, pendingCheck.stdout + pendingCheck.stderr);
  assert.doesNotMatch(pendingCheck.stdout, /BLOCK /);
  assert.match(pendingCheck.stdout, /WARN WPD019|WARN WPD011/);

  await writeFile(path.join(directory, '.wingmanpm-design', 'review.json'), `${JSON.stringify({
    status: 'reviewed', reviewer: 'Legacy reviewer', reviewedAt: '2026-08-30T10:00:00.000Z', sourceHash: 'a'.repeat(64),
    viewports: [390, 768, 1280, 1440], checks: Object.fromEntries(baseChecks.slice(0, 8).map((key) => [key, true])), notes: 'Invalid old review.'
  }, null, 2)}\n`);

  const complete = run([
    'check', '--record-review', '--project', directory, '--reviewer', 'Morgan Lee',
    '--confirm', [...baseChecks, ...tableChecks, 'tableEditing'].join(',')
  ]);
  assert.equal(complete.status, 0, complete.stdout + complete.stderr);
  const review = await json(path.join(directory, '.wingmanpm-design', 'review.json'));
  assert.equal(review.checks.tableDensity, true);
  assert.equal(review.checks.tableEditing, true);
  assert.equal(review.checks.structureUnique, true);
  assert.equal(review.checks.dropdownContrast, true);
  const recordedReviewFile = path.join(directory, '.wingmanpm-design', 'review.json');
  assert.equal((await json(path.join(directory, '.wingmanpm-design', 'manifest.json'))).entries
    .find(({ path: entry }) => entry === '.wingmanpm-design/review.json')?.hash, hash(await readFile(recordedReviewFile, 'utf8')));
});

test('CI flow migrates legacy review, adds all table profiles, and accepts valid pending evidence', async () => {
  const directory = await project();
  assert.equal(run(['init', '--project', directory]).status, 0);
  const reviewFile = path.join(directory, '.wingmanpm-design', 'review.json');
  await writeFile(reviewFile, `${JSON.stringify({
    status: 'reviewed', reviewer: 'Legacy reviewer', reviewedAt: '2026-08-30T10:00:00.000Z', sourceHash: 'a'.repeat(64),
    viewports: [390, 768, 1280, 1440], checks: Object.fromEntries(baseChecks.slice(0, 8).map((key) => [key, true])), notes: 'Legacy CI fixture review.'
  }, null, 2)}\n`);
  assert.equal(run(['upgrade', '--project', directory]).status, 0);
  assert.equal((await json(reviewFile)).status, 'pending');
  for (const profile of ['static', 'work', 'editable']) {
    const added = run(['add', 'data-table', '--project', directory, '--profile', profile, '--id', `ci-${profile}`]);
    assert.equal(added.status, 0, added.stdout + added.stderr);
  }
  const pending = await json(reviewFile);
  assert.equal(pending.status, 'pending');
  assert.equal(Object.keys(pending.checks).length, 16);
  assert.ok(Object.values(pending.checks).every((value) => value === false));
  await writePassedBrowserEvidence(directory, 12);
  const check = run(['check', '--project', directory, '--allow-pending-review']);
  assert.equal(check.status, 0, check.stdout + check.stderr);
  assert.doesNotMatch(check.stdout, /BLOCK /);
  assert.equal((await json(path.join(directory, '.wingmanpm-design', 'manifest.json'))).entries
    .find(({ path: entry }) => entry === '.wingmanpm-design/review.json')?.hash, hash(await readFile(reviewFile, 'utf8')));
});

test('project uninstall preserves table dependencies only while preserved table consumers remain', async () => {
  const withTable = await project();
  assert.equal(run(['init', '--project', withTable]).status, 0);
  assert.equal(run(['add', 'data-table', '--project', withTable, '--profile', 'work', '--id', 'accounts']).status, 0);
  const tablePackageBefore = await json(path.join(withTable, 'package.json'));
  assert.equal(tablePackageBefore.dependencies['@tanstack/react-table'], '9.2.4');
  assert.equal(tablePackageBefore.dependencies['@dnd-kit/react'], '0.5.0');

  const uninstalled = run(['uninstall', '--project', withTable]);
  assert.equal(uninstalled.status, 0, uninstalled.stdout + uninstalled.stderr);
  assert.match(uninstalled.stdout, /Preserved table dependencies: .*@tanstack\/react-table.*@dnd-kit\/react/);
  const tablePackageAfter = await json(path.join(withTable, 'package.json'));
  assert.equal(tablePackageAfter.dependencies['@tanstack/react-table'], '9.2.4');
  assert.equal(tablePackageAfter.dependencies['@dnd-kit/react'], '0.5.0');
  assert.equal(Boolean(await readFile(path.join(withTable, 'design-system', 'tables', 'accounts.json'), 'utf8')), true);

  const withoutConsumers = await project();
  assert.equal(run(['init', '--project', withoutConsumers]).status, 0);
  const packageFile = path.join(withoutConsumers, 'package.json');
  const packageJson = await json(packageFile);
  packageJson.dependencies['@tanstack/react-table'] = '9.2.4';
  packageJson.dependencies['@dnd-kit/react'] = '0.5.0';
  await writeFile(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`);
  const manifestFile = path.join(withoutConsumers, '.wingmanpm-design', 'manifest.json');
  const manifest = await json(manifestFile);
  manifest.packageDependencies.push(
    { section: 'dependencies', key: '@tanstack/react-table', value: '9.2.4' },
    { section: 'dependencies', key: '@dnd-kit/react', value: '0.5.0' }
  );
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  assert.equal(run(['uninstall', '--project', withoutConsumers]).status, 0);
  const genericPackageAfter = await json(packageFile);
  assert.equal(genericPackageAfter.dependencies['@tanstack/react-table'], undefined);
  assert.equal(genericPackageAfter.dependencies['@dnd-kit/react'], undefined);
});

test('runtime registry covers active checker rules and resolves deterministic and table IDs', async () => {
  const checker = await readFile(path.join(root, 'skills', 'wingmanpm-product-designer', 'src', 'checker.mjs'), 'utf8');
  const active = new Set(checker.match(/WPD(?:[0-9]{3}|-EXCEPTION)/g));
  const registered = new Set((await json(path.join(root, 'skills', 'wingmanpm-product-designer', 'registry', 'rules.json'))).entries.map(({ id }) => id));
  assert.deepEqual([...active].filter((id) => !registered.has(id)), []);
  for (const ruleId of ['WPD005', 'WPD018']) {
    const result = run(['search', ruleId]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, new RegExp(ruleId));
  }
});
