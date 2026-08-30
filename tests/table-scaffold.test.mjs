import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { hashReviewSources, validateTableContract } from '../skills/wingmanpm-product-designer/src/checker.mjs';
import {
  applyDataTableScaffold,
  planDataTableScaffold,
  TABLE_PROFILES
} from '../skills/wingmanpm-product-designer/src/table-scaffold.mjs';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repository, 'bin', 'wingman-design.mjs');

async function project(dependencies = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wingman-table-test-'));
  await writeFile(path.join(directory, 'package.json'), `${JSON.stringify({
    name: 'wingman-table-test',
    private: true,
    type: 'module',
    scripts: {},
    dependencies
  }, null, 2)}\n`);
  await mkdir(path.join(directory, '.wingmanpm-design'), { recursive: true });
  await writeFile(path.join(directory, '.wingmanpm-design', 'manifest.json'), `${JSON.stringify({
    schemaVersion: 2,
    entries: [],
    adapters: [],
    packageScripts: [],
    packageDependencies: []
  }, null, 2)}\n`);
  await writeFile(path.join(directory, '.wingmanpm-design', 'table-inventory.json'), `${JSON.stringify({
    schemaVersion: 1,
    generatedAt: '2026-08-30T00:00:00.000Z',
    purpose: 'Test inventory.',
    tables: []
  }, null, 2)}\n`);
  return directory;
}

async function json(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

const reviewChecks = ['keyboard', 'zoom200', 'reducedMotion', 'longContent', 'light', 'dark', 'axe', 'responsiveStates', 'structureUnique', 'dropdownContrast'];

async function seedReviewedEvidence(directory) {
  const reviewFile = path.join(directory, '.wingmanpm-design', 'review.json');
  const review = {
    status: 'reviewed', reviewer: 'Morgan Lee', reviewedAt: '2026-08-30T10:00:00.000Z', sourceHash: 'a'.repeat(64),
    viewports: [390, 768, 1280, 1440], checks: Object.fromEntries(reviewChecks.map((key) => [key, true])), notes: 'Reviewed.'
  };
  const content = `${JSON.stringify(review, null, 2)}\n`;
  await writeFile(reviewFile, content);
  const manifestFile = path.join(directory, '.wingmanpm-design', 'manifest.json');
  const manifest = await json(manifestFile);
  const next = { path: '.wingmanpm-design/review.json', ownership: 'observed', action: 'created', hash: createHash('sha256').update(content).digest('hex') };
  const entry = manifest.entries.find((item) => item.path === next.path);
  if (entry) Object.assign(entry, next);
  else manifest.entries.push(next);
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  return { reviewFile, manifestFile };
}

test('static, work, and editable plans produce valid distinct contracts and source evidence', async () => {
  const directory = await project({ react: '19.2.0' });
  for (const profile of TABLE_PROFILES) {
    const plan = await planDataTableScaffold(directory, { profile, tableId: `sample-${profile}` });
    assert.equal(plan.strategy, profile === 'static' ? 'native-react-static' : 'tanstack-react');
    assert.deepEqual(plan.dependencies, profile === 'static' ? [] : [
      { section: 'dependencies', key: '@tanstack/react-table', value: '9.2.4' },
      { section: 'dependencies', key: '@dnd-kit/react', value: '0.5.0' },
      { section: 'dependencies', key: 'lucide-react', value: '0.468.0' }
    ]);
    const contract = JSON.parse(plan.operations.find(({ target }) => target.endsWith('.json')).content);
    assert.deepEqual(validateTableContract(contract), []);
    assert.equal(contract.capabilities.inlineEditing, profile === 'editable');
    assert.equal(contract.capabilities.visibility, profile !== 'static');
    assert.equal(contract.capabilities.bulkActions, profile !== 'static');
    assert.equal(contract.columns.some(({ editor }) => editor), profile === 'editable');
    const wrapper = plan.operations.find(({ target }) => target.endsWith(`${profile.replace(/^./, (letter) => letter.toUpperCase())}Table.tsx`))
      ?? plan.operations.find(({ target }) => target.includes('/tables/'));
    assert.match(wrapper.content, new RegExp(`tableId="sample-${profile}" profile="${profile}"`));
    const story = plan.operations.find(({ target }) => target.endsWith('.stories.tsx')).content;
    const browser = plan.operations.find(({ target }) => target.endsWith('.spec.ts')).content;
    assert.doesNotMatch(story + browser, /\{\{[A-Z_]+\}\}/);
    assert.ok(browser.includes('Przykład \\(dane testowe\\)'), 'localized regexes must preserve literal parentheses');
    assert.match(browser, /tableSelectContrast/);
    assert.match(browser, /analyzeWithAxe/);
    assert.match(browser, /Axe is already running/);
    assert.match(browser, /closest\('\.wpd-data-table, \.wpd-static-table'\)/);
    assert.match(browser, /option\.parentElement instanceof HTMLOptGroupElement/);
    assert.match(browser, /!option\.disabled/);
    assert.match(browser, /ratio >= 4\.5/);
    if (profile === 'static') {
      assert.doesNotMatch(browser, /At least one visible enabled table select must be checked/);
      assert.match(browser, /Static tables must stay free of operational selects/);
      assert.match(browser, /selectContrast\.candidateCount\)\.toBe\(0\)/);
      assert.doesNotMatch(browser, /wpd-column-manager-panel/);
      assert.doesNotMatch(browser, /test\.setTimeout\(90_000\)/);
      assert.doesNotMatch(story, /ThousandRowResize/);
      assert.doesNotMatch(browser, /1,000-row resize reports a warning/);
      assert.match(browser, /static profile omits operational controls/);
      assert.deepEqual(contract.interactionAlternatives.columnReorder, []);
      assert.deepEqual(contract.interactionAlternatives.columnResize, []);
    } else {
      assert.match(browser, /\.wpd-column-manager > summary/);
      assert.match(browser, /wpd-column-manager-panel/);
      assert.match(browser, /wpd-table-pagination/);
      assert.match(browser, /wpd-column-width-preset/);
      assert.match(browser, /test\.setTimeout\(90_000\)/);
      assert.match(story, /ThousandRowResize/);
      assert.match(browser, /1,000-row resize reports a warning/);
      assert.match(wrapper.content, profile === 'editable' ? /WingmanEditableTableProps/ : /WingmanWorkTableProps/);
      assert.match(browser, /offset pagination delegates query and sort/);
      assert.match(browser, /cursor pagination never invents totals/);
    }
    if (profile === 'editable') {
      assert.match(story, /type: 'select'/);
      assert.match(browser, /Edit Status/);
      assert.match(browser, /wpd-inline-editor/);
      assert.match(browser, /toBeGreaterThanOrEqual\(21\)/);
      assert.match(browser, /conflict|Value changed elsewhere/);
    } else {
      assert.doesNotMatch(browser, /Edit Status/);
      if (profile === 'work') assert.match(browser, /toBeGreaterThanOrEqual\(17\)/);
    }
  }
});

test('dry-run writes nothing and reports the complete plan', async () => {
  const directory = await project({ react: '19.2.0' });
  const plan = await planDataTableScaffold(directory, { profile: 'work', tableId: 'dry-table' });
  const result = await applyDataTableScaffold(plan, { dryRun: true });
  assert.equal(result.status, 'dry-run');
  assert.equal(result.created.length, 0);
  await assert.rejects(readFile(path.join(directory, 'design-system', 'tables', 'dry-table.json')));
  assert.deepEqual((await json(path.join(directory, '.wingmanpm-design', 'table-inventory.json'))).tables, []);
});

test('table changes invalidate reviewed evidence, track its hash, and stay idempotent', async () => {
  const directory = await project({ react: '19.2.0' });
  const { reviewFile, manifestFile } = await seedReviewedEvidence(directory);
  const duplicateManifest = await json(manifestFile);
  duplicateManifest.entries.push({ ...duplicateManifest.entries.find(({ path: entry }) => entry === '.wingmanpm-design/review.json') });
  await writeFile(manifestFile, `${JSON.stringify(duplicateManifest, null, 2)}\n`);
  const plan = await planDataTableScaffold(directory, { profile: 'work', tableId: 'review-work' });
  const reviewBefore = await readFile(reviewFile, 'utf8');
  const manifestBefore = await readFile(manifestFile, 'utf8');
  await applyDataTableScaffold(plan, { dryRun: true });
  assert.equal(await readFile(reviewFile, 'utf8'), reviewBefore);
  assert.equal(await readFile(manifestFile, 'utf8'), manifestBefore);

  const first = await applyDataTableScaffold(plan);
  assert.equal(first.status, 'scaffolded');
  const pending = await json(reviewFile);
  assert.equal(pending.status, 'pending');
  assert.equal(pending.reviewer, null);
  assert.equal(pending.reviewedAt, null);
  assert.equal(pending.sourceHash, null);
  for (const key of [...reviewChecks, 'tableDensity', 'tableColumns', 'tablePagination', 'tableExpansion', 'tableBulk']) assert.equal(pending.checks[key], false, key);
  assert.equal(Object.keys(pending.checks).length, 15);
  assert.equal(pending.checks.tableEditing, undefined);
  const reviewHash = createHash('sha256').update(await readFile(reviewFile)).digest('hex');
  const firstManifest = await json(manifestFile);
  assert.equal(firstManifest.entries.find(({ path: entry }) => entry === '.wingmanpm-design/review.json').hash, reviewHash);
  assert.equal(firstManifest.entries.filter(({ path: entry }) => entry === '.wingmanpm-design/review.json').length, 1);

  const protectedFiles = [reviewFile, manifestFile, path.join(directory, '.wingmanpm-design', 'table-inventory.json'), path.join(directory, 'package.json')];
  const beforeConflict = await Promise.all(protectedFiles.map(async (file) => ({ content: await readFile(file, 'utf8'), mtimeMs: (await stat(file)).mtimeMs })));
  await assert.rejects(planDataTableScaffold(directory, { profile: 'editable', tableId: 'review-work' }), /already uses profile work/);
  assert.deepEqual(await Promise.all(protectedFiles.map(async (file) => ({ content: await readFile(file, 'utf8'), mtimeMs: (await stat(file)).mtimeMs }))), beforeConflict);

  const reviewed = {
    ...pending,
    status: 'reviewed',
    reviewer: 'Morgan Lee',
    reviewedAt: new Date().toISOString(),
    sourceHash: await hashReviewSources(directory),
    checks: Object.fromEntries(Object.keys(pending.checks).map((key) => [key, true]))
  };
  const reviewedContent = `${JSON.stringify(reviewed, null, 2)}\n`;
  await writeFile(reviewFile, reviewedContent);
  const reviewedManifest = await json(manifestFile);
  reviewedManifest.entries.find(({ path: entry }) => entry === '.wingmanpm-design/review.json').hash = createHash('sha256').update(reviewedContent).digest('hex');
  await writeFile(manifestFile, `${JSON.stringify(reviewedManifest, null, 2)}\n`);
  const inventoryFile = path.join(directory, '.wingmanpm-design', 'table-inventory.json');
  const inventory = await json(inventoryFile);
  inventory.tables = [];
  await writeFile(inventoryFile, `${JSON.stringify(inventory, null, 2)}\n`);
  const reviewBeforeRepair = { content: await readFile(reviewFile, 'utf8'), mtimeMs: (await stat(reviewFile)).mtimeMs };
  const repairPlan = await planDataTableScaffold(directory, { profile: 'work', tableId: 'review-work' });
  const repaired = await applyDataTableScaffold(repairPlan);
  assert.equal(repaired.status, 'scaffolded');
  assert.deepEqual({ content: await readFile(reviewFile, 'utf8'), mtimeMs: (await stat(reviewFile)).mtimeMs }, reviewBeforeRepair);

  const secondPlan = await planDataTableScaffold(directory, { profile: 'work', tableId: 'review-work' });
  const beforeCurrent = { review: await readFile(reviewFile, 'utf8'), manifest: await readFile(manifestFile, 'utf8'), reviewMtime: (await stat(reviewFile)).mtimeMs, manifestMtime: (await stat(manifestFile)).mtimeMs };
  const second = await applyDataTableScaffold(secondPlan);
  assert.equal(second.status, 'current');
  assert.deepEqual({ review: await readFile(reviewFile, 'utf8'), manifest: await readFile(manifestFile, 'utf8'), reviewMtime: (await stat(reviewFile)).mtimeMs, manifestMtime: (await stat(manifestFile)).mtimeMs }, beforeCurrent);

  const editable = await planDataTableScaffold(directory, { profile: 'editable', tableId: 'review-editable' });
  await applyDataTableScaffold(editable);
  const editablePending = await json(reviewFile);
  assert.equal(editablePending.checks.tableEditing, false);
  assert.equal(Object.keys(editablePending.checks).length, 16);

  const staticDirectory = await project({ react: '19.2.0' });
  await seedReviewedEvidence(staticDirectory);
  const staticPlan = await planDataTableScaffold(staticDirectory, { profile: 'static', tableId: 'review-static' });
  await applyDataTableScaffold(staticPlan);
  assert.equal(Object.keys((await json(path.join(staticDirectory, '.wingmanpm-design', 'review.json'))).checks).length, 10);

  const malformedContractDirectory = await project({ react: '19.2.0' });
  const malformedEvidence = await seedReviewedEvidence(malformedContractDirectory);
  const malformedPlan = await planDataTableScaffold(malformedContractDirectory, { profile: 'work', tableId: 'safe-table' });
  const malformedContract = path.join(malformedContractDirectory, 'design-system', 'tables', 'broken.json');
  await mkdir(path.dirname(malformedContract), { recursive: true });
  await writeFile(malformedContract, '{ bad contract');
  const beforeMalformed = { review: await readFile(malformedEvidence.reviewFile, 'utf8'), manifest: await readFile(malformedEvidence.manifestFile, 'utf8') };
  await assert.rejects(applyDataTableScaffold(malformedPlan), /malformed table contract broken\.json/);
  assert.deepEqual({ review: await readFile(malformedEvidence.reviewFile, 'utf8'), manifest: await readFile(malformedEvidence.manifestFile, 'utf8') }, beforeMalformed);
  await assert.rejects(readFile(path.join(malformedContractDirectory, 'src', 'components', 'wingman-design', 'tables', 'SafeTableTable.tsx')));

  const failedManifestDirectory = await project({ react: '19.2.0' });
  const failedManifestEvidence = await seedReviewedEvidence(failedManifestDirectory);
  const failedManifestPlan = await planDataTableScaffold(failedManifestDirectory, { profile: 'work', tableId: 'failed-manifest' });
  await writeFile(failedManifestEvidence.manifestFile, '{ bad manifest');
  await assert.rejects(applyDataTableScaffold(failedManifestPlan));
  assert.equal((await json(failedManifestEvidence.reviewFile)).status, 'pending');
  const failedManifestSurface = failedManifestPlan.operations.find(({ target }) => target.endsWith('FailedManifestTable.tsx')).target;
  assert.match(await readFile(failedManifestSurface, 'utf8'), /profile="work"/);
});

test('React scaffold is pinned, no-overwrite, idempotent, inventoried, and reusable', async () => {
  const directory = await project({ react: '19.2.0' });
  const firstPlan = await planDataTableScaffold(directory, { profile: 'work', tableId: 'work-items' });
  const protectedStory = firstPlan.operations.find(({ target }) => target.endsWith('.stories.tsx')).target;
  await mkdir(path.dirname(protectedStory), { recursive: true });
  await writeFile(protectedStory, '// user-owned story\n');
  const first = await applyDataTableScaffold(firstPlan);
  assert.equal(first.status, 'scaffolded');
  assert.equal(await readFile(protectedStory, 'utf8'), '// user-owned story\n');
  const packageJson = await json(path.join(directory, 'package.json'));
  assert.equal(packageJson.dependencies['@tanstack/react-table'], '9.2.4');
  assert.equal(packageJson.dependencies['@dnd-kit/react'], '0.5.0');
  assert.equal(packageJson.dependencies['lucide-react'], '0.468.0');
  const inventory = await json(path.join(directory, '.wingmanpm-design', 'table-inventory.json'));
  assert.equal(inventory.tables[0].status, 'generated');
  assert.equal(inventory.tables[0].id, 'work-items');
  assert.match(inventory.tables[0].sourceHash, /^[a-f0-9]{64}$/);
  const manifest = await json(path.join(directory, '.wingmanpm-design', 'manifest.json'));
  assert.equal(manifest.entries.find(({ path: value }) => value === 'design-system/tables/work-items.json')?.ownership, 'user');
  assert.equal(manifest.entries.find(({ path: value }) => value === '.wingmanpm-design/table-inventory.json')?.ownership, 'observed');

  const secondPlan = await planDataTableScaffold(directory, { profile: 'work', tableId: 'work-items' });
  assert.equal(secondPlan.strategy, 'tanstack-react');
  assert.ok(secondPlan.operations.every(({ type }) => type === 'preserve'));
  assert.equal(secondPlan.operations.some(({ target }) => target.endsWith('.integration.md')), false);
  const second = await applyDataTableScaffold(secondPlan);
  assert.equal(second.status, 'current');

  const thirdPlan = await planDataTableScaffold(directory, { profile: 'editable', tableId: 'accounts' });
  assert.equal(thirdPlan.strategy, 'tanstack-react');
  assert.equal(thirdPlan.operations.some(({ target }) => target.endsWith('AccountsTable.tsx') && typeIsCreate(thirdPlan, target)), true);
  assert.equal(thirdPlan.operations.some(({ target }) => target.endsWith('.integration.md')), false);
});

function typeIsCreate(plan, target) {
  return plan.operations.find((operation) => operation.target === target)?.type === 'create';
}

test('a capable existing grid is preserved without parallel dependencies', async () => {
  const directory = await project({ react: '19.2.0', 'ag-grid-react': '35.0.0' });
  const plan = await planDataTableScaffold(directory, { profile: 'work', tableId: 'accounts' });
  assert.equal(plan.strategy, 'preserve-existing-grid');
  assert.equal(plan.existingGrid, 'ag-grid-react');
  assert.deepEqual(plan.dependencies, []);
  assert.equal(plan.operations.some(({ target }) => target.endsWith('accounts.integration.md')), true);
  const result = await applyDataTableScaffold(plan);
  assert.equal(result.status, 'integration-required');
  const after = await json(path.join(directory, 'package.json'));
  assert.equal(after.dependencies['@tanstack/react-table'], undefined);
  assert.match(await readFile(path.join(directory, 'design-system', 'tables', 'accounts.integration.md'), 'utf8'), /Preserve that engine/);
  assert.match(result.warnings.join('\n'), /WPD019 proof debt/);
  assert.equal((await json(path.join(directory, '.wingmanpm-design', 'table-inventory.json'))).tables[0].status, 'integration-required');
});

test('a capable project-owned shared table is preserved conservatively', async () => {
  const directory = await project({ react: '19.2.0' });
  const component = path.join(directory, 'src', 'components', 'shared', 'DataTable.tsx');
  await mkdir(path.dirname(component), { recursive: true });
  await writeFile(component, `export function DataTable() {
  const columnOrder = []; const pagination = {}; const rowSelection = {};
  return <table>{String(columnOrder.length + Object.keys(pagination).length + Object.keys(rowSelection).length)}</table>;
}\n`);
  const plan = await planDataTableScaffold(directory, { profile: 'work', tableId: 'shared-data' });
  assert.equal(plan.strategy, 'preserve-existing-grid');
  assert.match(plan.existingGrid, /project-owned shared table at src\/components\/shared\/DataTable\.tsx/);
  assert.deepEqual(plan.dependencies, []);
  const result = await applyDataTableScaffold(plan);
  assert.equal(result.status, 'integration-required');
  assert.equal((await json(path.join(directory, 'package.json'))).dependencies['@tanstack/react-table'], undefined);
});

test('framework-neutral add substitutes its semantic reference while neutral init alone stays table-free', async () => {
  const directory = await project();
  const plan = await planDataTableScaffold(directory, { profile: 'static', tableId: 'audit-events' });
  assert.equal(plan.strategy, 'framework-neutral');
  const neutral = plan.operations.find(({ target }) => target.endsWith('audit-events-table.html'));
  assert.match(neutral.content, /data-wingman-table-id="audit-events"/);
  assert.match(neutral.content, /data-wingman-table-profile="static"/);
  assert.doesNotMatch(neutral.content, /\{\{TABLE_/);
  assert.doesNotMatch(neutral.content, />Columns<|data-density|role="separator"/);
  const neutralResult = await applyDataTableScaffold(plan);
  assert.equal(neutralResult.status, 'integration-required');

  const initOnly = await mkdtemp(path.join(os.tmpdir(), 'wingman-neutral-init-'));
  await writeFile(path.join(initOnly, 'package.json'), '{"name":"neutral-init","private":true,"scripts":{}}\n');
  const result = spawnSync(process.execPath, [cli, 'init', '--project', initOnly], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const examples = await readdir(path.join(initOnly, 'design-system', 'examples'));
  assert.deepEqual(examples, ['semantic-ui.html']);
  const contracts = await readdir(path.join(initOnly, 'design-system', 'tables'));
  assert.deepEqual(contracts, ['README.md']);
});

test('CLI add formats dry-run and rejects invalid profiles without mutation', async () => {
  const directory = await project({ react: '19.2.0' });
  const dry = spawnSync(process.execPath, [cli, 'add', 'data-table', '--project', directory, '--profile', 'work', '--id', 'cli-table', '--dry-run'], { encoding: 'utf8' });
  assert.equal(dry.status, 0, dry.stdout + dry.stderr);
  assert.match(dry.stdout, /Data table plan: cli-table \(work\)/);
  assert.match(dry.stdout, /DEPENDENCY @tanstack\/react-table@9\.2\.4/);
  await assert.rejects(readFile(path.join(directory, 'design-system', 'tables', 'cli-table.json')));
  const invalid = spawnSync(process.execPath, [cli, 'add', 'data-table', '--project', directory, '--profile', 'huge'], { encoding: 'utf8' });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Unknown table profile/);
});

test('table templates retain runtime safety, accessible alternatives, and required public handlers', async () => {
  const templateRoot = path.join(repository, 'skills', 'wingmanpm-product-designer', 'templates');
  const component = await readFile(path.join(templateRoot, 'data-table', 'react', 'data-table', 'DataTable.tsx'), 'utf8');
  const types = await readFile(path.join(templateRoot, 'data-table', 'react', 'data-table', 'DataTable.types.ts'), 'utf8');
  const preferences = await readFile(path.join(templateRoot, 'data-table', 'react', 'data-table', 'DataTablePreferences.ts'), 'utf8');
  const styles = await readFile(path.join(templateRoot, 'data-table', 'react', 'data-table', 'DataTable.css'), 'utf8');
  const staticComponent = await readFile(path.join(templateRoot, 'data-table', 'react-static', 'StaticDataTable.tsx'), 'utf8');
  assert.match(types, /WingmanWorkTableProps/);
  assert.match(types, /WingmanEditableTableProps/);
  assert.match(types, /onBulkAction:\s*\(/);
  assert.match(types, /onCommitEdit: NonNullable/);
  assert.match(component, /pointercancel/);
  assert.match(component, /setPointerCapture/);
  assert.match(component, /excludedRowIds/);
  assert.match(component, /Inline editing is not configured/);
  assert.match(component, /Bulk actions are not configured/);
  assert.match(component, /Duplicate row identity/);
  assert.match(component, /serverQuery\?\.onFiltersChange/);
  assert.match(component, /event\.key === 'F2'/);
  assert.match(component, /selectionVisible/);
  assert.match(component, /disabled=\{!selectionAllowed\}/);
  assert.match(component, /const checked = event\.currentTarget\.checked/);
  assert.match(preferences, /validPreferences/);
  assert.match(styles, /\.wpd-table-toolbar[\s\S]*flex-wrap: wrap/);
  assert.match(styles, /\.wpd-table-search[\s\S]*max-width: 24rem[\s\S]*flex: 1 1 20rem/);
  assert.match(styles, /\.wpd-density-switch button[\s\S]*overflow-wrap: anywhere/);
  const forbiddenDash = String.fromCodePoint(Number.parseInt(['20', '14'].join(''), 16));
  assert.equal((component + staticComponent).includes(forbiddenDash), false);
  assert.match(styles, /color-scheme: light/);
  assert.match(styles, /\[data-theme='dark'\][\s\S]*color-scheme: dark/);
  assert.match(styles, /\.wpd-data-table select,[\s\S]*\.wpd-data-table option[\s\S]*color: var\(--wpd-color-text\)[\s\S]*background-color: var\(--wpd-color-surface\)/);
  assert.doesNotMatch(staticComponent, /@tanstack|@dnd-kit|lucide-react/);
});

test('CLI names preserved-grid proof debt as integration required', async () => {
  const directory = await project({ react: '19.2.0', 'ag-grid-react': '35.0.0' });
  const result = spawnSync(process.execPath, [cli, 'add', 'data-table', '--project', directory, '--profile', 'work', '--id', 'cli-existing'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Data table integration required: cli-existing \(work\)/);
  assert.match(result.stdout, /WPD019 proof debt/);
});

test('a fresh native static React scaffold blocks until machine browser evidence exists', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wingman-static-check-'));
  await writeFile(path.join(directory, 'package.json'), `${JSON.stringify({
    name: 'wingman-static-check',
    private: true,
    type: 'module',
    scripts: {},
    dependencies: { next: '15.0.0', react: '19.2.0', 'react-dom': '19.2.0', tailwindcss: '4.0.0', 'lucide-react': '0.468.0' }
  }, null, 2)}\n`);
  const init = spawnSync(process.execPath, [cli, 'init', '--project', directory], { encoding: 'utf8' });
  assert.equal(init.status, 0, init.stdout + init.stderr);
  const add = spawnSync(process.execPath, [cli, 'add', 'data-table', '--project', directory, '--profile', 'static', '--id', 'audit-summary'], { encoding: 'utf8' });
  assert.equal(add.status, 0, add.stdout + add.stderr);
  const check = spawnSync(process.execPath, [cli, 'check', '--project', directory, '--allow-pending-review'], { encoding: 'utf8' });
  assert.equal(check.status, 1, check.stdout + check.stderr);
  assert.doesNotMatch(check.stdout + check.stderr, /BLOCK WPD0(?:0[1-9]|1[0-9]|20)\b/);
  assert.match(check.stdout + check.stderr, /BLOCK WPD022[\s\S]*Machine-written browser evidence is missing/);
});
