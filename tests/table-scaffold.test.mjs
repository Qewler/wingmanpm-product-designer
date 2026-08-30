import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateTableContract } from '../src/checker.mjs';
import {
  applyDataTableScaffold,
  planDataTableScaffold,
  TABLE_PROFILES
} from '../src/table-scaffold.mjs';

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
    if (profile === 'static') {
      assert.doesNotMatch(story, /ThousandRowResize/);
      assert.doesNotMatch(browser, /1,000-row resize reports a warning/);
      assert.match(browser, /static profile omits operational controls/);
      assert.deepEqual(contract.interactionAlternatives.columnReorder, []);
      assert.deepEqual(contract.interactionAlternatives.columnResize, []);
    } else {
      assert.match(story, /ThousandRowResize/);
      assert.match(browser, /1,000-row resize reports a warning/);
      assert.match(wrapper.content, profile === 'editable' ? /WingmanEditableTableProps/ : /WingmanWorkTableProps/);
      assert.match(browser, /offset pagination delegates query and sort/);
      assert.match(browser, /cursor pagination never invents totals/);
    }
    if (profile === 'editable') assert.match(browser, /conflict|Value changed elsewhere/);
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
  const component = await readFile(path.join(repository, 'templates', 'data-table', 'react', 'data-table', 'DataTable.tsx'), 'utf8');
  const types = await readFile(path.join(repository, 'templates', 'data-table', 'react', 'data-table', 'DataTable.types.ts'), 'utf8');
  const preferences = await readFile(path.join(repository, 'templates', 'data-table', 'react', 'data-table', 'DataTablePreferences.ts'), 'utf8');
  const staticComponent = await readFile(path.join(repository, 'templates', 'data-table', 'react-static', 'StaticDataTable.tsx'), 'utf8');
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
  assert.doesNotMatch(staticComponent, /@tanstack|@dnd-kit|lucide-react/);
});

test('CLI names preserved-grid proof debt as integration required', async () => {
  const directory = await project({ react: '19.2.0', 'ag-grid-react': '35.0.0' });
  const result = spawnSync(process.execPath, [cli, 'add', 'data-table', '--project', directory, '--profile', 'work', '--id', 'cli-existing'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Data table integration required: cli-existing \(work\)/);
  assert.match(result.stdout, /WPD019 proof debt/);
});

test('a fresh native static React scaffold has no deterministic checker block', async () => {
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
  assert.equal(check.status, 0, check.stdout + check.stderr);
  assert.doesNotMatch(check.stdout + check.stderr, /BLOCK WPD00[1-9]|BLOCK WPD01[0-8]|BLOCK WPD020/);
  assert.match(check.stdout, /WPD019|0 block/);
});
