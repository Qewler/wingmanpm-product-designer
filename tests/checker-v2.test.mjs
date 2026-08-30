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
  validateBrowserEvidence,
  validateConfig,
  validateExceptions,
  validateReview,
  validateTableContract
} from '../skills/wingmanpm-product-designer/src/checker.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requiredStates = ['loading', 'empty', 'no-results', 'partial', 'stale', 'error', 'permission', 'offline', 'saving', 'success'];
const forbiddenDashCharacter = () => String['from' + 'CodePoint'](0x2000 + 0x14);
const forbiddenEnDashCharacter = () => String['from' + 'CodePoint'](0x2000 + 0x13);

async function writePassedBrowserEvidence(directory, overrides = {}) {
  const evidence = {
    schemaVersion: 1,
    status: 'passed',
    sourceHash: await hashReviewSources(directory),
    completedAt: new Date().toISOString(),
    tests: { passed: 1, failed: 0, skipped: 0 },
    storyCount: 1,
    themes: ['light', 'dark'],
    structureUnique: true,
    dropdownContrast: true,
    dropdownCandidateCount: 1,
    ...overrides
  };
  await writeFile(path.join(directory, '.wingmanpm-design', 'browser-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence;
}

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
  await writeFile(path.join(directory, 'tests', 'wingman-design', 'visual.spec.ts'), `
test('WPD022 structure audit', async () => { const structureViolations = await auditVisibleStructure(); expect(structureViolations).toEqual([]); });
test('WPD023 dropdown contrast in light and dark', async () => { const candidates = await auditDropdownContrast(4.5); expect(candidates).toBeGreaterThan(0); await press('Escape'); });
`);
  await writeFile(path.join(directory, '.wingmanpm-design', 'config.json'), `${JSON.stringify({ ...validConfig(), goldenStack: false, aiSurfaces: false })}\n`);
  await writeFile(path.join(directory, '.wingmanpm-design', 'exceptions.json'), '{"exceptions":[]}\n');
  await writeFile(path.join(directory, '.wingmanpm-design', 'review.json'), `${JSON.stringify({
    status: 'pending', reviewer: null, reviewedAt: null, sourceHash: null,
    viewports: [390, 768, 1280, 1440],
    checks: {
      ...Object.fromEntries(['keyboard', 'zoom200', 'reducedMotion', 'longContent', 'light', 'dark', 'axe', 'responsiveStates', 'structureUnique', 'dropdownContrast'].map((key) => [key, false])),
      tableDensity: false,
      tableColumns: false,
      tablePagination: false,
      tableExpansion: false,
      tableBulk: false,
      tableEditing: false
    },
    notes: 'Pending review.'
  })}\n`);
  await writePassedBrowserEvidence(directory);
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
    message: 'Schema version 1 is supported only for migration; run npx --yes wingmanpm-product-designer@1.0.0 upgrade.',
    severity: 'warn'
  }]);
  assert.match(validateConfig({ ...validConfig(), scanRoots: ['../private'] })[0].message, /safe project-relative/);
  assert.deepEqual(validateExceptions({ exceptions: [] }, { today: '2026-08-30' }), []);
  assert.equal(validateExceptions({ exceptions: [{
    ruleId: 'WPD020', target: 'src/table.tsx', reason: 'Temporary safe migration.', approver: 'Morgan Lee', reviewDate: '2026-08-29'
  }] }, { today: '2026-08-30' })[0].path, '$.exceptions[0].reviewDate');
  for (const ruleId of ['WPD021', 'WPD022', 'WPD023']) {
    const hardRule = validateExceptions({ exceptions: [{
      ruleId, target: 'src/example.tsx', reason: 'Attempted global bypass.', approver: 'Morgan Lee', reviewDate: '2099-12-31'
    }] }, { today: '2026-08-30' });
    assert.ok(hardRule.some((entry) => entry.path === '$.exceptions[0].ruleId' && /cannot be excepted/.test(entry.message)));
  }
  assert.deepEqual(validateReview({
    status: 'pending', reviewer: null, reviewedAt: null, sourceHash: null,
    viewports: [390, 768, 1280, 1440],
    checks: {
      ...Object.fromEntries(['keyboard', 'zoom200', 'reducedMotion', 'longContent', 'light', 'dark', 'axe', 'responsiveStates', 'structureUnique', 'dropdownContrast'].map((key) => [key, false])),
      tableDensity: true,
      tableColumns: true,
      tablePagination: true,
      tableExpansion: true,
      tableBulk: true,
      tableEditing: true
    },
    notes: 'Pending direct review.'
  }), []);
  const missingGlobalChecks = validateReview({
    status: 'pending', reviewer: null, reviewedAt: null, sourceHash: null,
    viewports: [390, 768, 1280, 1440],
    checks: Object.fromEntries(['keyboard', 'zoom200', 'reducedMotion', 'longContent', 'light', 'dark', 'axe', 'responsiveStates'].map((key) => [key, false]))
  });
  assert.ok(missingGlobalChecks.some((entry) => entry.path === '$.checks.structureUnique'));
  assert.ok(missingGlobalChecks.some((entry) => entry.path === '$.checks.dropdownContrast'));
  assert.deepEqual(validateBrowserEvidence({
    schemaVersion: 1, status: 'passed', sourceHash: 'a'.repeat(64), completedAt: new Date().toISOString(),
    tests: { passed: 2, failed: 0, skipped: 0 }, storyCount: 2, themes: ['light', 'dark'],
    structureUnique: true, dropdownContrast: true, dropdownCandidateCount: 4
  }), []);
  assert.ok(validateBrowserEvidence({
    schemaVersion: 1, status: 'passed', sourceHash: 'a'.repeat(64), completedAt: new Date().toISOString(),
    tests: { passed: 1, failed: 1, skipped: 0 }, storyCount: 1, themes: ['light'],
    structureUnique: true, dropdownContrast: true, dropdownCandidateCount: 0
  }).length >= 2);
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
  const checks = Object.fromEntries(['keyboard', 'zoom200', 'reducedMotion', 'longContent', 'light', 'dark', 'axe', 'responsiveStates', 'structureUnique', 'dropdownContrast'].map((key) => [key, true]));
  await writeFile(path.join(directory, '.wingmanpm-design', 'review.json'), `${JSON.stringify({
    status: 'reviewed', reviewer: 'Morgan Lee', reviewedAt: new Date().toISOString(), sourceHash,
    viewports: [390, 768, 1280, 1440], checks, notes: 'Reviewed table evidence.'
  }, null, 2)}\n`);
  report = await runChecks(directory);
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD019' && /tableDensity/.test(entry.message)));
  Object.assign(checks, {
    tableDensity: true, tableColumns: true, tablePagination: true,
    tableExpansion: true, tableBulk: true, tableEditing: false
  });
  await writeFile(path.join(directory, '.wingmanpm-design', 'review.json'), `${JSON.stringify({
    status: 'reviewed', reviewer: 'Morgan Lee', reviewedAt: new Date().toISOString(), sourceHash,
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
  const schemaRoot = path.join(root, 'skills', 'wingmanpm-product-designer', 'schemas');
  const configSchema = JSON.parse(await readFile(path.join(schemaRoot, 'config.schema.json'), 'utf8'));
  const exceptionSchema = JSON.parse(await readFile(path.join(schemaRoot, 'exceptions.schema.json'), 'utf8'));
  const reviewSchema = JSON.parse(await readFile(path.join(schemaRoot, 'review.schema.json'), 'utf8'));
  const browserSchema = JSON.parse(await readFile(path.join(schemaRoot, 'browser-evidence.schema.json'), 'utf8'));
  const tableSchema = JSON.parse(await readFile(path.join(schemaRoot, 'table-contract.schema.json'), 'utf8'));
  assert.equal(configSchema.properties.schemaVersion.const, 2);
  assert.ok(configSchema.properties.legacyBaseline);
  assert.ok(configSchema.properties.scanRoots);
  assert.equal(exceptionSchema.additionalProperties, false);
  assert.equal(reviewSchema.additionalProperties, false);
  assert.equal(browserSchema.properties.schemaVersion.const, 1);
  assert.deepEqual(browserSchema.properties.status.enum, ['passed', 'failed']);
  assert.equal(tableSchema.$defs.interactionAlternatives.properties.columnReorder.minItems, 0);
  assert.equal(tableSchema.$defs.interactionAlternatives.properties.columnResize.minItems, 0);
  const interactionRequirements = JSON.stringify(tableSchema.allOf);
  for (const method of ['drag', 'move-buttons', 'pointer', 'keyboard-separator', 'width-presets']) {
    assert.match(interactionRequirements, new RegExp(`"const":"${method}"`));
  }
});

test('WPD021 blocks every long-dash render form and allows the regular hyphen', async () => {
  const directory = await initializedProject();
  const slash = String.fromCharCode(92);
  const cases = [
    ['literal.md', `A${forbiddenDashCharacter()}B`],
    ['literal-en.md', `A${forbiddenEnDashCharacter()}B`],
    ['named.html', ['A&', 'mdash;B'].join('')],
    ['named-en.html', ['A&', 'ndash;B'].join('')],
    ['named-no-semicolon.html', ['A&', 'mdash B'].join('')],
    ['decimal.html', ['A&#', '8212;B'].join('')],
    ['hex.html', ['A&#', 'x2014;B'].join('')],
    ['hex-en.html', ['A&#', 'x2013;B'].join('')],
    ['decimal-no-semicolon.html', ['A&#', '8212 B'].join('')],
    ['hex-no-semicolon.html', ['A&#', 'x2014 B'].join('')],
    ['escaped.ts', `export const value = "${slash}${'u2014'}";`],
    ['escaped-en.ts', `export const value = "${slash}${'u2013'}";`],
    ['escaped.json', `{"value":"${slash}${'u2014'}"}`],
    ['escaped.yaml', `value: "${slash}${'u2014'}"`],
    ['content.css', `p::after { content: "${slash}${'2014 ' }"; }`],
    ['variable.css', `:root { --separator: "${slash}${'2014 '}"; }`],
    ['style.html', `<style>.label::after { content: "${slash}${'2014 '}"; }</style>`],
    ['code-point.ts', ['export const value = String', '.from', 'CodePoint(0x2014);'].join('')],
    ['char-code.ts', ['export const value = String', '.from', 'CharCode(8212);'].join('')],
    ['code-point-add.ts', ['export const value = String', '.from', 'CodePoint(0x2000 + 0x14);'].join('')],
    ['code-point-add-en.ts', ['export const value = String', '.from', 'CodePoint(0x2000 + 0x13);'].join('')],
    ['char-code-add.ts', ['export const value = String', '.from', 'CharCode(8_000 + 212);'].join('')],
    ['.wingmanpm-design/manifest.json', JSON.stringify({ entries: [{ path: `copy${forbiddenDashCharacter()}file.md`, ownership: 'user' }] })]
  ];
  for (const [name, content] of cases) await writeFile(path.join(directory, name), `${content}\n`);
  await writeFile(path.join(directory, 'allowed.md'), 'A-B\n');
  await writeFile(path.join(directory, 'encoded-example.md'), ['```html', ['&', 'mdash;'].join(''), '```', ''].join('\n'));

  const report = await runChecks(directory, { allowPendingReview: true });
  for (const [name] of cases) {
    assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD021' && entry.file === name), name);
  }
  assert.equal(report.findings.some((entry) => entry.ruleId === 'WPD021' && entry.file === 'allowed.md'), false);
  assert.equal(report.findings.some((entry) => entry.ruleId === 'WPD021' && entry.file === 'encoded-example.md'), false);

  await writeFile(path.join(directory, '.wingmanpm-design', 'exceptions.json'), `${JSON.stringify({ exceptions: [{
    ruleId: 'WPD021', target: 'literal.md', reason: 'Attempted global bypass.', approver: 'Morgan Lee', reviewDate: '2099-12-31'
  }] })}\n`);
  const bypass = await runChecks(directory, { allowPendingReview: true });
  assert.ok(bypass.findings.some((entry) => entry.ruleId === 'WPD021' && entry.file === 'literal.md'));
  assert.ok(bypass.findings.some((entry) => entry.ruleId === 'WPD-EXCEPTION' && /cannot be excepted/.test(entry.message)));
});

test('WPD022 blocks repeated normalized headings but ignores hidden HTML and fenced Markdown', async () => {
  const directory = await initializedProject();
  await writeFile(path.join(directory, 'guide.md'), [
    '# Guide',
    '## Settings',
    `## ${'Ｓｅｔｔｉｎｇｓ'}`,
    '```md',
    '## Settings',
    '```',
    '## Billing'
  ].join('\n'));
  await writeFile(path.join(directory, 'page.html'), [
    '<h2>Profile</h2>',
    '<h2 hidden>Profile</h2>',
    '<h3>Access</h3>',
    '<h3> access </h3>'
  ].join('\n'));
  const report = await runChecks(directory, { allowPendingReview: true });
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD022' && entry.file === 'guide.md' && /Repeated level 2/.test(entry.message)));
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD022' && entry.file === 'page.html' && /Access/i.test(entry.message)));
  assert.equal(report.findings.some((entry) => entry.ruleId === 'WPD022' && entry.file === 'page.html' && /Profile/.test(entry.message)), false);
});

test('WPD022 accepts only current passed machine-written browser evidence', async () => {
  const directory = await initializedProject();
  let report = await runChecks(directory, { allowPendingReview: true });
  assert.equal(report.findings.some((entry) => entry.ruleId === 'WPD022'), false);
  await writeFile(path.join(directory, 'src', 'NewSurface.tsx'), 'export const NewSurface = () => <main><h1>New surface</h1></main>;\n');
  report = await runChecks(directory, { allowPendingReview: true });
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD022' && /stale/.test(entry.message)));
  await writePassedBrowserEvidence(directory);
  report = await runChecks(directory, { allowPendingReview: true });
  assert.equal(report.findings.some((entry) => entry.ruleId === 'WPD022'), false);
});

test('WPD023 requires executable dropdown proof in light and dark', async () => {
  const directory = await initializedProject();
  await writeFile(path.join(directory, 'src', 'Dropdown.tsx'), 'export const Dropdown = () => <select aria-label="Status"><option>Open</option></select>;\n');
  await writeFile(path.join(directory, 'tests', 'wingman-design', 'visual.spec.ts'), 'test("visual", async () => { expect(true).toBe(true); });\n');
  let report = await runChecks(directory, { allowPendingReview: true });
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD023' && entry.file === 'src/Dropdown.tsx'));

  await writeFile(path.join(directory, 'tests', 'wingman-design', 'visual.spec.ts'), `
test('WPD022 structure', async () => { const structureViolations = await auditVisibleStructure(); expect(structureViolations).toEqual([]); });
test('WPD023 light and dark dropdown contrast', async () => { const candidates = await auditDropdownContrast(4.5); expect(candidates).toBeGreaterThan(0); await press('Escape'); });
`);
  report = await runChecks(directory, { allowPendingReview: true });
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD023' && /stale/.test(entry.message)));
  await writePassedBrowserEvidence(directory, { dropdownCandidateCount: 3 });
  report = await runChecks(directory, { allowPendingReview: true });
  assert.equal(report.findings.some((entry) => entry.ruleId === 'WPD023'), false);
});

test('WPD023 includes generated Wingman component sources', async () => {
  const directory = await initializedProject();
  const runtime = path.join(directory, 'src', 'components', 'wingman-design', 'data-table');
  await mkdir(runtime, { recursive: true });
  await writeFile(path.join(runtime, 'DataTable.tsx'), 'export const Density = () => <select aria-label="Density"><option>Dense</option></select>;\n');
  await writeFile(path.join(directory, 'tests', 'wingman-design', 'visual.spec.ts'), `
test('WPD022 structure', async () => { const structureViolations = await auditVisibleStructure(); expect(structureViolations).toEqual([]); });
`);
  const report = await runChecks(directory, { allowPendingReview: true });
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD023'
    && entry.file === 'src/components/wingman-design/data-table/DataTable.tsx'));
});

test('legacy baselines reject and never absorb WPD021 through WPD023', async () => {
  const directory = await initializedProject();
  await writeFile(path.join(directory, 'hard.md'), `# Copy\n${forbiddenDashCharacter()}\n## Repeat\n## Repeat\n`);
  await writeFile(path.join(directory, 'src', 'HardDropdown.tsx'), 'export const Hard = () => <select><option>Open</option></select>;\n');
  const initial = await runChecks(directory, { allowPendingReview: true });
  const selected = [
    initial.findings.find((entry) => entry.ruleId === 'WPD021' && entry.file === 'hard.md'),
    initial.findings.find((entry) => entry.ruleId === 'WPD022' && entry.file === 'hard.md'),
    initial.findings.find((entry) => entry.ruleId === 'WPD023')
  ];
  assert.ok(selected.every(Boolean));
  const counts = Object.fromEntries(selected.map((entry) => [[entry.ruleId, entry.file, entry.message].join('\u001f'), 1]));
  await writeFile(path.join(directory, '.wingmanpm-design', 'baseline.json'), `${JSON.stringify({
    schemaVersion: 1, createdAt: new Date().toISOString(), counts
  }, null, 2)}\n`);
  const report = await runChecks(directory, { allowPendingReview: true });
  assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD016' && /global hard rules/.test(entry.message)));
  for (const ruleId of ['WPD021', 'WPD022', 'WPD023']) assert.ok(report.findings.some((entry) => entry.ruleId === ruleId), ruleId);
});

test('Vue, Svelte, and Astro surfaces receive safe literal structure and dropdown checks', async () => {
  for (const extension of ['vue', 'svelte', 'astro']) {
    const unsafe = await initializedProject();
    const unsafeFile = path.join(unsafe, 'src', `Unsafe.${extension}`);
    await writeFile(unsafeFile, '<section><h2>Status</h2><h2> status </h2><select><option>Open</option></select></section>\n');
    const unsafeReport = await runChecks(unsafe, { allowPendingReview: true });
    assert.ok(unsafeReport.findings.some((entry) => entry.ruleId === 'WPD022' && entry.file === `src/Unsafe.${extension}`), extension);
    assert.ok(unsafeReport.findings.some((entry) => entry.ruleId === 'WPD023'), extension);

    const safe = await initializedProject();
    const safeFile = path.join(safe, 'src', `Safe.${extension}`);
    await writeFile(safeFile, '<section><h2>Status</h2><p>Ready</p></section>\n');
    await writePassedBrowserEvidence(safe);
    const safeReport = await runChecks(safe, { allowPendingReview: true });
    assert.equal(safeReport.findings.some((entry) => entry.ruleId === 'WPD022' && entry.file === `src/Safe.${extension}`), false, extension);
    assert.equal(safeReport.findings.some((entry) => entry.ruleId === 'WPD023' && entry.file === `src/Safe.${extension}`), false, extension);
  }
});

test('hard UI discovery ignores narrow scan roots and covers additional dropdown declarations', async () => {
  const narrow = await initializedProject();
  const configFile = path.join(narrow, '.wingmanpm-design', 'config.json');
  const config = JSON.parse(await readFile(configFile, 'utf8'));
  config.scanRoots = ['design-system/examples'];
  await writeFile(configFile, `${JSON.stringify(config)}\n`);
  await mkdir(path.join(narrow, 'outside-scan'), { recursive: true });
  await writeFile(path.join(narrow, 'outside-scan', 'Surface.vue'), '<h2>Queue</h2><h2>queue</h2><input list="states"><datalist id="states"><option value="Open"></datalist>\n');
  const narrowReport = await runChecks(narrow, { allowPendingReview: true });
  assert.ok(narrowReport.findings.some((entry) => entry.ruleId === 'WPD022' && entry.file === 'outside-scan/Surface.vue'));
  assert.ok(narrowReport.findings.some((entry) => entry.ruleId === 'WPD023'));

  const runtimeDirectory = await initializedProject();
  await mkdir(path.join(runtimeDirectory, 'src', 'runtime'), { recursive: true });
  await writeFile(path.join(runtimeDirectory, 'src', 'runtime', 'Unsafe.VUE'), '<h2>Queue</h2><h2>queue</h2><select><option>Open</option></select>\n');
  await mkdir(path.join(runtimeDirectory, '.wingmanpm-design', 'runtime'), { recursive: true });
  await writeFile(path.join(runtimeDirectory, '.wingmanpm-design', 'runtime', 'generated.ts'), `export const generated = "${forbiddenDashCharacter()}";\n`);
  const runtimeReport = await runChecks(runtimeDirectory, { allowPendingReview: true });
  assert.ok(runtimeReport.findings.some((entry) => entry.ruleId === 'WPD022' && entry.file === 'src/runtime/Unsafe.VUE'));
  assert.ok(runtimeReport.findings.some((entry) => entry.ruleId === 'WPD023'));
  assert.equal(runtimeReport.findings.some((entry) => entry.file === '.wingmanpm-design/runtime/generated.ts'), false);

  const uppercase = await initializedProject();
  await writeFile(path.join(uppercase, 'src', 'Upper.VUE'), '<h2>Queue</h2><h2>queue</h2><input list="states">\n');
  const uppercaseReport = await runChecks(uppercase, { allowPendingReview: true });
  assert.ok(uppercaseReport.findings.some((entry) => entry.ruleId === 'WPD022' && entry.file === 'src/Upper.VUE'));
  assert.ok(uppercaseReport.findings.some((entry) => entry.ruleId === 'WPD023'));

  for (const source of [
    '<input list="states"><datalist id="states"><option value="Open"></datalist>',
    '<div role="listbox"><div role="option">Open</div></div>',
    '<button aria-haspopup="listbox" aria-controls="states">Status</button><div id="states" role="listbox"></div>'
  ]) {
    const directory = await initializedProject();
    await writeFile(path.join(directory, 'src', 'DropdownVariant.tsx'), `export const Variant = () => <>${source}</>;\n`);
    const report = await runChecks(directory, { allowPendingReview: true });
    assert.ok(report.findings.some((entry) => entry.ruleId === 'WPD023'), source);
  }
});
