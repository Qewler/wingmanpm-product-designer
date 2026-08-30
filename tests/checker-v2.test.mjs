import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  hashReviewSources,
  runChecks,
  validateConfig,
  validateExceptions,
  validateReview,
  validateTableContract
} from '../src/checker.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredStates = ['loading', 'empty', 'no-results', 'partial', 'stale', 'error', 'permission', 'offline', 'saving', 'success'];

async function initializedProject() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wingman-checker-v2-'));
  for (const relative of ['design-system/surfaces', 'design-system/tokens', 'src/stories', 'tests/wingman-design', '.wingmanpm-design']) {
    await mkdir(path.join(directory, relative), { recursive: true });
  }
  await writeFile(path.join(directory, 'design-system', 'PRODUCT.md'), '# Product truth\n');
  await writeFile(path.join(directory, 'design-system', 'DESIGN.md'), '| Axis | Value | Why |\n|---|---:|---|\n| Expression | 5 | Clear |\n| Density | 6 | Useful |\n| Motion | 3 | Calm |\n| Warmth | 5 | Human |\n');
  await writeFile(path.join(directory, 'design-system', 'COMPONENTS.md'), `# Components\n${['loading', 'empty', 'partial', 'error', 'success', 'disabled', 'permission', 'offline', 'responsive'].join(' ')}\n`);
  await writeFile(path.join(directory, 'design-system', 'tokens', 'tokens.json'), `${JSON.stringify({
    $schema: 'https://www.designtokens.org/tr/2025.10/format/', color: { light: {}, dark: {} }
  })}\n`);
  await writeFile(path.join(directory, 'design-system', 'tokens', 'tokens.css'), '[data-theme="dark"] {}\n');
  await writeFile(path.join(directory, 'design-system', 'tokens', 'tailwind.preset.mjs'), 'export default {};\n');
  await writeFile(path.join(directory, 'design-system', 'tokens', 'shadcn.css'), ':root {}\n');
  await writeFile(path.join(directory, 'src', 'stories', 'WingmanProduct.stories.tsx'), 'export const Example = {};\n');
  await writeFile(path.join(directory, 'tests', 'wingman-design', 'visual.spec.ts'), 'export const visualEvidence = true;\n');
  await writeFile(path.join(directory, '.wingmanpm-design', 'config.json'), `${JSON.stringify({ ...validConfig(), goldenStack: false, aiSurfaces: false })}\n`);
  await writeFile(path.join(directory, '.wingmanpm-design', 'exceptions.json'), '{"exceptions":[]}\n');
  await writeFile(path.join(directory, '.wingmanpm-design', 'review.json'), `${JSON.stringify({
    status: 'pending', reviewer: null, reviewedAt: null, sourceHash: null,
    viewports: [390, 768, 1280, 1440],
    checks: {
      ...Object.fromEntries(['keyboard', 'zoom200', 'reducedMotion', 'longContent', 'light', 'dark', 'axe', 'responsiveStates'].map((key) => [key, false])),
      tableDensity: false,
      tableColumns: false,
      tablePagination: false,
      tableExpansion: false,
      tableBulk: false,
      tableEditing: false
    },
    notes: 'Pending review.'
  })}\n`);
  return directory;
}

function validConfig(version = 2) {
  return {
    schemaVersion: version,
    systemMode: 'new-system',
    stack: 'next-react-tailwind',
    goldenStack: true,
    requiresDarkTheme: true,
    aiSurfaces: true,
    legacyBaseline: false,
    scanRoots: ['src', 'stories'],
    viewports: [390, 768, 1280, 1440],
    visualEvidenceMaxAgeDays: 30
  };
}

function validContract(overrides = {}) {
  const contract = {
    id: 'orders',
    version: 1,
    profile: 'work',
    semantics: 'table',
    rowIdField: 'id',
    pagination: { mode: 'offset', pageSize: 25 },
    columns: [{
      id: 'name', label: 'Customer name', type: 'text', align: 'start',
      minWidth: 120, defaultWidth: 220, maxWidth: 420, priority: 1,
      required: true, hideable: false, sortable: true, filterable: true,
      resizable: true, reorderable: true, fullValue: 'wrap'
    }],
    capabilities: {
      visibility: true, reorder: true, resize: true, expansion: true,
      selection: true, bulkActions: true, inlineEditing: false, virtualization: false
    },
    interactionAlternatives: {
      columnReorder: ['drag', 'move-buttons'],
      columnResize: ['pointer', 'keyboard-separator', 'width-presets'],
      fullValue: ['wrap'],
      gridKeyboard: 'not-applicable'
    },
    preferences: {
      scope: 'workspace', fallback: 'versioned-local-storage', schemaVersion: 1,
      persist: ['density', 'columnOrder', 'columnVisibility', 'columnWidths'],
      neverPersist: ['selection', 'drafts', 'errors', 'activeEditing']
    },
    states: requiredStates,
    evidence: {
      stories: ['src/stories/WingmanProduct.stories.tsx'],
      browserTests: ['tests/wingman-design/visual.spec.ts'],
      visualReview: '.wingmanpm-design/review.json'
    }
  };
  return { ...contract, ...overrides };
}

test('dependency-free validators accept schema v2 and expose v1 as a migration warning', () => {
  assert.deepEqual(validateConfig(validConfig()), []);
  assert.deepEqual(validateConfig(validConfig(1)), [{
    path: '$.schemaVersion',
    message: 'Schema version 1 is supported only for migration; run wingman-design upgrade.',
    severity: 'warn'
  }]);
  assert.match(validateConfig({ ...validConfig(), scanRoots: ['../private'] })[0].message, /safe project-relative/);
  assert.deepEqual(validateExceptions({ exceptions: [] }, { today: '2026-08-30' }), []);
  assert.equal(validateExceptions({ exceptions: [{
    ruleId: 'WPD020', target: 'src/table.tsx', reason: 'Temporary safe migration.', approver: 'Julius', reviewDate: '2026-08-29'
  }] }, { today: '2026-08-30' })[0].path, '$.exceptions[0].reviewDate');
  assert.deepEqual(validateReview({
    status: 'pending', reviewer: null, reviewedAt: null, sourceHash: null,
    viewports: [390, 768, 1280, 1440],
    checks: {
      ...Object.fromEntries(['keyboard', 'zoom200', 'reducedMotion', 'longContent', 'light', 'dark', 'axe', 'responsiveStates'].map((key) => [key, false])),
      tableDensity: true,
      tableColumns: true,
      tablePagination: true,
      tableExpansion: true,
      tableBulk: true,
      tableEditing: true
    },
    notes: 'Pending direct review.'
  }), []);
});

test('table contract validator separates structural and interaction paths', () => {
  assert.deepEqual(validateTableContract(validContract()), []);
  assert.deepEqual(validateTableContract(validContract({
    profile: 'static',
    capabilities: {
      visibility: false, reorder: false, resize: false, expansion: false,
      selection: false, bulkActions: false, inlineEditing: false, virtualization: false
    },
    interactionAlternatives: {
      columnReorder: [], columnResize: [], fullValue: ['wrap'], gridKeyboard: 'not-applicable'
    },
    preferences: {
      scope: 'local', fallback: 'none', schemaVersion: 1, persist: [],
      neverPersist: ['selection', 'drafts', 'errors', 'activeEditing']
    }
  })), []);
  const unsafe = validContract({
    interactionAlternatives: {
      columnReorder: ['drag'],
      columnResize: ['pointer'],
      fullValue: ['wrap'],
      gridKeyboard: 'not-applicable'
    }
  });
  const issues = validateTableContract(unsafe);
  assert.ok(issues.some((entry) => entry.path === '$.interactionAlternatives.columnReorder' && /move-buttons/.test(entry.message)));
  assert.ok(issues.some((entry) => entry.path === '$.interactionAlternatives.columnResize' && /keyboard-separator/.test(entry.message)));

  const missingWorkAlternatives = validateTableContract(validContract({
    interactionAlternatives: {
      columnReorder: [], columnResize: [], fullValue: ['wrap'], gridKeyboard: 'not-applicable'
    }
  }));
  assert.ok(missingWorkAlternatives.some((entry) => entry.path === '$.interactionAlternatives.columnReorder' && /drag/.test(entry.message)));
  assert.ok(missingWorkAlternatives.some((entry) => entry.path === '$.interactionAlternatives.columnResize' && /pointer/.test(entry.message)));
});

test('malformed project JSON becomes explicit blocking findings', async () => {
  const directory = await initializedProject();
  await writeFile(path.join(directory, '.wingmanpm-design', 'config.json'), '{ bad config');
  await writeFile(path.join(directory, '.wingmanpm-design', 'exceptions.json'), '{ bad exceptions');
  await writeFile(path.join(directory, '.wingmanpm-design', 'review.json'), '{ bad review');
  const report = await runChecks(directory, { allowPendingReview: true });
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD016' && /Malformed JSON/.test(entry.message)));
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD-EXCEPTION' && /Malformed JSON/.test(entry.message)));
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD011' && /Malformed JSON/.test(entry.message)));
});

test('WPD018 blocks a work table without its matching contract', async () => {
  const directory = await initializedProject();
  const target = path.join(directory, 'src', 'MissingTable.tsx');
  await writeFile(target, 'export const Missing = () => <DataTable tableId="orders" profile="work" />;\n');
  const report = await runChecks(directory, { allowPendingReview: true });
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD018' && /orders\.json/.test(entry.message)));
});

test('WPD018 covers static, native, DataGrid, and useReactTable surfaces but skips Wingman runtime primitives', async () => {
  const directory = await initializedProject();
  await writeFile(path.join(directory, 'src', 'StaticReport.tsx'), 'export const Report = () => <table data-wingman-table-id="report" data-wingman-table-profile="static" />;\n');
  await writeFile(path.join(directory, 'src', 'NativeOrders.tsx'), 'export const Orders = () => <table><tbody /></table>;\n');
  await writeFile(path.join(directory, 'src', 'GridOrders.tsx'), 'export const Orders = () => <DataGrid rows={[]} />;\n');
  await writeFile(path.join(directory, 'src', 'HeadlessOrders.tsx'), 'export const Orders = () => { const table = useReactTable({}); return <div>{table.id}</div>; };\n');
  const runtimeDirectory = path.join(directory, 'src', 'components', 'wingman-design', 'data-table');
  await mkdir(runtimeDirectory, { recursive: true });
  await writeFile(path.join(runtimeDirectory, 'DataTable.tsx'), 'export function DataTable({ tableId, profile }) { return <table data-wingman-table-id={tableId} data-wingman-table-profile={profile} />; }\n');

  const report = await runChecks(directory, { allowPendingReview: true });
  for (const file of ['src/StaticReport.tsx', 'src/NativeOrders.tsx', 'src/GridOrders.tsx', 'src/HeadlessOrders.tsx']) {
    assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD018' && entry.file === file && entry.severity === 'block'), file);
  }
  assert.equal(report.findings.some((entry) => entry.ruleId === 'WPD018' && entry.file.endsWith('/data-table/DataTable.tsx')), false);
});

test('WPD018 warns only for an unchanged legacy source hash and blocks changes or non-legacy entries', async () => {
  const directory = await initializedProject();
  const target = path.join(directory, 'src', 'LegacyTable.tsx');
  const source = 'export const Legacy = () => <DataTable tableId="legacy-orders" profile="work" />;\n';
  await writeFile(target, source);
  const inventoryFile = path.join(directory, '.wingmanpm-design', 'table-inventory.json');
  const sourceHash = createHash('sha256').update(source).digest('hex');
  const inventory = {
    schemaVersion: 1,
    tables: [{
      id: 'legacy-orders', file: 'src/LegacyTable.tsx', inferredProfile: 'work',
      status: 'legacy', sourceHash
    }]
  };
  await writeFile(inventoryFile, `${JSON.stringify(inventory, null, 2)}\n`);

  let report = await runChecks(directory, { allowPendingReview: true });
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD018' && entry.severity === 'warn' && /unchanged legacy/.test(entry.message)));
  assert.equal(report.findings.some((entry) => entry.ruleId === 'WPD018' && entry.severity === 'block' && entry.file === 'src/LegacyTable.tsx'), false);

  await writeFile(target, source.replace('Legacy =', 'ChangedLegacy ='));
  report = await runChecks(directory, { allowPendingReview: true });
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD018' && entry.severity === 'block' && entry.file === 'src/LegacyTable.tsx'));

  await writeFile(target, source);
  inventory.tables[0].status = 'confirmed';
  await writeFile(inventoryFile, `${JSON.stringify(inventory, null, 2)}\n`);
  report = await runChecks(directory, { allowPendingReview: true });
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD018' && entry.severity === 'block' && entry.file === 'src/LegacyTable.tsx'));
});

test('WPD019 blocks missing evidence and stale visual review evidence', async () => {
  const directory = await initializedProject();
  const tables = path.join(directory, 'design-system', 'tables');
  await mkdir(tables, { recursive: true });
  const contract = validContract();
  await writeFile(path.join(tables, 'orders.json'), `${JSON.stringify(contract, null, 2)}\n`);
  contract.evidence.stories = ['src/stories/MissingTable.stories.tsx'];
  await writeFile(path.join(tables, 'orders.json'), `${JSON.stringify(contract, null, 2)}\n`);
  let report = await runChecks(directory, { allowPendingReview: true });
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD019' && /MissingTable/.test(entry.message)));

  contract.evidence.stories = ['src/stories/WingmanProduct.stories.tsx'];
  await writeFile(path.join(tables, 'orders.json'), `${JSON.stringify(contract, null, 2)}\n`);
  const sourceHash = await hashReviewSources(directory);
  const checks = Object.fromEntries(['keyboard', 'zoom200', 'reducedMotion', 'longContent', 'light', 'dark', 'axe', 'responsiveStates'].map((key) => [key, true]));
  await writeFile(path.join(directory, '.wingmanpm-design', 'review.json'), `${JSON.stringify({
    status: 'reviewed', reviewer: 'Julius', reviewedAt: new Date().toISOString(), sourceHash,
    viewports: [390, 768, 1280, 1440], checks, notes: 'Reviewed table evidence.'
  }, null, 2)}\n`);
  report = await runChecks(directory);
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD019' && /tableDensity/.test(entry.message)));
  Object.assign(checks, {
    tableDensity: true, tableColumns: true, tablePagination: true,
    tableExpansion: true, tableBulk: true, tableEditing: false
  });
  await writeFile(path.join(directory, '.wingmanpm-design', 'review.json'), `${JSON.stringify({
    status: 'reviewed', reviewer: 'Julius', reviewedAt: new Date().toISOString(), sourceHash,
    viewports: [390, 768, 1280, 1440], checks, notes: 'Reviewed table evidence.'
  }, null, 2)}\n`);
  await writeFile(path.join(directory, 'src', 'ChangedAfterReview.tsx'), 'export const Changed = () => <p>Changed</p>;\n');
  report = await runChecks(directory);
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD019' && /stale/.test(entry.message)));
});

test('review freshness includes table contracts, token JSON, and declared browser evidence', async () => {
  const directory = await initializedProject();
  const tables = path.join(directory, 'design-system', 'tables');
  await mkdir(tables, { recursive: true });
  await writeFile(path.join(tables, 'orders.json'), `${JSON.stringify(validContract(), null, 2)}\n`);
  const initial = await hashReviewSources(directory);

  await writeFile(path.join(directory, 'tests', 'wingman-design', 'visual.spec.ts'), 'export const visualEvidence = "changed";\n');
  const afterBrowser = await hashReviewSources(directory);
  assert.notEqual(afterBrowser, initial);

  const contract = validContract({ version: 2 });
  await writeFile(path.join(tables, 'orders.json'), `${JSON.stringify(contract, null, 2)}\n`);
  const afterContract = await hashReviewSources(directory);
  assert.notEqual(afterContract, afterBrowser);

  await writeFile(path.join(directory, 'design-system', 'tokens', 'tokens.json'), `${JSON.stringify({
    $schema: 'https://www.designtokens.org/tr/2025.10/format/', color: { light: { brand: '#123456' }, dark: {} }
  })}\n`);
  assert.notEqual(await hashReviewSources(directory), afterContract);
});

test('WPD020 blocks drag-only reorder and pointer-only resize declarations', async () => {
  const directory = await initializedProject();
  const tables = path.join(directory, 'design-system', 'tables');
  await mkdir(tables, { recursive: true });
  const contract = validContract({
    interactionAlternatives: {
      columnReorder: ['drag'], columnResize: ['pointer'], fullValue: ['wrap'], gridKeyboard: 'not-applicable'
    }
  });
  await writeFile(path.join(tables, 'orders.json'), `${JSON.stringify(contract, null, 2)}\n`);
  const report = await runChecks(directory, { allowPendingReview: true });
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD020' && /move-buttons/.test(entry.message)));
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD020' && /keyboard-separator/.test(entry.message)));
});

test('WPD020 rejects interaction claims without implementation and browser evidence', async () => {
  const directory = await initializedProject();
  const tables = path.join(directory, 'design-system', 'tables');
  await mkdir(tables, { recursive: true });
  await writeFile(path.join(tables, 'orders.json'), `${JSON.stringify(validContract(), null, 2)}\n`);
  await writeFile(path.join(directory, 'src', 'Orders.tsx'), 'export const Orders = () => <DataTable tableId="orders" profile="work" />;\n');
  await writeFile(path.join(directory, 'tests', 'wingman-design', 'visual.spec.ts'), 'test("orders", async () => { expect(true).toBe(true); });\n');

  const report = await runChecks(directory, { allowPendingReview: true });
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD020' && /drag reorder has no implementation evidence/.test(entry.message)));
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD020' && /drag reorder has no browser interaction evidence/.test(entry.message)));
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD020' && /keyboard separator has no browser interaction evidence/.test(entry.message)));
});

test('schema files remain parseable and make config v2 authoritative', async () => {
  const configSchema = JSON.parse(await readFile(path.join(root, 'schemas', 'config.schema.json'), 'utf8'));
  const exceptionSchema = JSON.parse(await readFile(path.join(root, 'schemas', 'exceptions.schema.json'), 'utf8'));
  const reviewSchema = JSON.parse(await readFile(path.join(root, 'schemas', 'review.schema.json'), 'utf8'));
  const tableSchema = JSON.parse(await readFile(path.join(root, 'schemas', 'table-contract.schema.json'), 'utf8'));
  assert.equal(configSchema.properties.schemaVersion.const, 2);
  assert.ok(configSchema.properties.legacyBaseline);
  assert.ok(configSchema.properties.scanRoots);
  assert.equal(exceptionSchema.additionalProperties, false);
  assert.equal(reviewSchema.additionalProperties, false);
  assert.equal(tableSchema.$defs.interactionAlternatives.properties.columnReorder.minItems, 0);
  assert.equal(tableSchema.$defs.interactionAlternatives.properties.columnResize.minItems, 0);
  const interactionRequirements = JSON.stringify(tableSchema.allOf);
  for (const method of ['drag', 'move-buttons', 'pointer', 'keyboard-separator', 'width-presets']) {
    assert.match(interactionRequirements, new RegExp(`"const":"${method}"`));
  }
});
