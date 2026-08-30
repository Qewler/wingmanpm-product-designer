import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  exists,
  fileHash,
  listFiles,
  readJson,
  relativeUnix,
  writeAtomic,
  writeJsonAtomic
} from './utils.mjs';
import { applyReviewInvalidation, planReviewInvalidation, upsertObservedReviewEntry } from './review.mjs';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE_COMPONENT_ROOT = path.join(
  PACKAGE_ROOT,
  'templates',
  'data-table',
  'react',
  'data-table'
);
const TEMPLATE_STATIC_COMPONENT_ROOT = path.join(
  PACKAGE_ROOT,
  'templates',
  'data-table',
  'react-static'
);
const PROJECT_MANIFEST = '.wingmanpm-design/manifest.json';

export const TABLE_PROFILES = Object.freeze(['static', 'work', 'editable']);

const CAPABLE_GRIDS = Object.freeze([
  '@tanstack/react-table',
  'ag-grid-react',
  '@mui/x-data-grid',
  'handsontable',
  '@handsontable/react',
  'react-data-grid',
  '@glideapps/glide-data-grid',
  '@syncfusion/ej2-react-grids',
  '@progress/kendo-react-grid',
  'primereact'
]);

function assertTableId(tableId) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tableId)) {
    throw new Error(`Invalid table ID "${tableId}". Use lowercase words separated by hyphens.`);
  }
}

function pascalCase(value) {
  return value.split('-').map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join('');
}

function templateComponentTarget(projectRoot, sourceName) {
  return path.join(projectRoot, 'src', 'components', 'wingman-design', 'data-table', sourceName);
}

async function templateComponentOperations(projectRoot) {
  const entries = await readdir(TEMPLATE_COMPONENT_ROOT, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => ({
      type: 'create',
      source: path.join(TEMPLATE_COMPONENT_ROOT, entry.name),
      target: templateComponentTarget(projectRoot, entry.name),
      ownership: 'seeded'
    }));
}

async function templateStaticComponentOperations(projectRoot) {
  const entries = await readdir(TEMPLATE_STATIC_COMPONENT_ROOT, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => ({
      type: 'create',
      source: path.join(TEMPLATE_STATIC_COMPONENT_ROOT, entry.name),
      target: path.join(projectRoot, 'src', 'components', 'wingman-design', 'static-table', entry.name),
      ownership: 'seeded'
    }));
}

function sampleColumns(profile) {
  const columns = [
    {
      id: 'name', label: 'Name', type: 'text', align: 'start',
      minWidth: 180, defaultWidth: 280, maxWidth: 560, priority: 1,
      required: true, hideable: false, sortable: profile !== 'static', filterable: profile !== 'static',
      resizable: profile !== 'static', reorderable: false, fullValue: 'wrap'
    },
    {
      id: 'status', label: 'Status', type: 'status', align: 'start',
      minWidth: 112, defaultWidth: 144, maxWidth: 220, priority: 2,
      required: false, hideable: profile !== 'static', sortable: profile !== 'static',
      filterable: profile !== 'static', resizable: profile !== 'static', reorderable: profile !== 'static',
      fullValue: 'wrap'
    },
    {
      id: 'owner', label: 'Owner', type: 'text', align: 'start',
      minWidth: 136, defaultWidth: 184, maxWidth: 320, priority: 3,
      required: false, hideable: profile !== 'static', sortable: profile !== 'static',
      filterable: profile !== 'static', resizable: profile !== 'static', reorderable: profile !== 'static',
      fullValue: profile === 'static' ? 'wrap' : 'focus-tooltip'
    }
  ];
  if (profile === 'editable') columns[0].editor = 'text';
  return columns;
}

function tableContract(tableId, profile) {
  const interactive = profile !== 'static';
  return {
    id: tableId,
    version: 1,
    profile,
    semantics: 'table',
    rowIdField: 'id',
    pagination: { mode: 'client', pageSize: 25 },
    columns: sampleColumns(profile),
    capabilities: {
      visibility: interactive,
      reorder: interactive,
      resize: interactive,
      expansion: interactive,
      selection: interactive,
      bulkActions: interactive,
      inlineEditing: profile === 'editable',
      virtualization: false
    },
    interactionAlternatives: {
      columnReorder: interactive ? ['drag', 'move-buttons'] : [],
      columnResize: interactive ? ['pointer', 'keyboard-separator', 'width-presets'] : [],
      fullValue: interactive ? ['wrap', 'focus-tooltip', 'row-details'] : ['wrap'],
      gridKeyboard: 'not-applicable'
    },
    preferences: {
      scope: interactive ? 'workspace' : 'local',
      fallback: interactive ? 'versioned-local-storage' : 'none',
      schemaVersion: 1,
      persist: interactive ? ['density', 'columnOrder', 'columnVisibility', 'columnWidths'] : [],
      neverPersist: ['selection', 'drafts', 'errors', 'activeEditing']
    },
    states: [
      'loading', 'empty', 'no-results', 'partial', 'stale', 'error',
      'permission', 'offline', 'saving', 'success'
    ],
    evidence: {
      stories: [`src/stories/${pascalCase(tableId)}Table.stories.tsx`],
      browserTests: [`tests/wingman-design/${tableId}.spec.ts`],
      visualReview: '.wingmanpm-design/review.json'
    }
  };
}

function wrapperSource(tableId, profile) {
  const name = `${pascalCase(tableId)}Table`;
  const propsType = profile === 'editable' ? 'WingmanEditableTableProps' : 'WingmanWorkTableProps';
  return `import { DataTable } from '../data-table';
import type { ${propsType} } from '../data-table';

export type ${name}Props<T extends Record<string, unknown>> = Omit<${propsType}<T>, 'tableId' | 'profile'>;

/** Product-owned boundary for the ${tableId} table contract. */
export function ${name}<T extends Record<string, unknown>>(props: ${name}Props<T>) {
  return <DataTable tableId="${tableId}" profile="${profile}" {...props} />;
}
`;
}

function staticWrapperSource(tableId) {
  const name = `${pascalCase(tableId)}Table`;
  return `import { StaticDataTable } from '../static-table';
import type { WingmanStaticTableProps } from '../static-table';

export type ${name}Props<T extends Record<string, unknown>> = Omit<WingmanStaticTableProps<T>, 'tableId' | 'profile'>;

/** Product-owned boundary for the ${tableId} static table contract. */
export function ${name}<T extends Record<string, unknown>>(props: ${name}Props<T>) {
  return <StaticDataTable tableId="${tableId}" profile="static" {...props} />;
}
`;
}

function staticStorySource(tableId) {
  const name = `${pascalCase(tableId)}Table`;
  return `import type { Meta, StoryObj } from '@storybook/react';
import { ${name} } from '../components/wingman-design/tables/${name}';
import type { WingmanStaticTableColumn, WingmanStaticTableState } from '../components/wingman-design/static-table';
import '../components/wingman-design/system.css';

type SampleRow = { id: string; name: string; status: string; owner: string };
const sampleRows: SampleRow[] = Array.from({ length: 12 }, (_, index) => ({
  id: 'sample-' + (index + 1),
  name: index === 0 ? 'Przykład (dane testowe): Zażółć gęślą jaźń, 31.08.2026 · 1 234,56 zł, długie tłumaczenie pozostaje kompletne' : 'Sample report item ' + (index + 1),
  status: index % 3 === 0 ? 'Ready' : index % 3 === 1 ? 'In progress' : 'Blocked',
  owner: index === 0 ? 'Beispieldaten: Łucja Weiß, vollständige Verantwortlichenbezeichnung' : index % 2 ? 'Sample: Alex Nowak' : 'Sample: Sam Rivera'
}));
const columns: Array<WingmanStaticTableColumn<SampleRow>> = [
  { id: 'name', label: 'Name', description: 'The stable report identity.', accessor: 'name', width: '44%' },
  { id: 'status', label: 'Status', description: 'The current reported state.', accessor: 'status', width: '22%' },
  { id: 'owner', label: 'Owner', description: 'The accountable person.', accessor: 'owner', width: '34%' }
];

function SampleTable({ state = 'ready', rows = sampleRows }: { state?: WingmanStaticTableState; rows?: SampleRow[] }) {
  return (
    <main className="wpd-main">
      <${name}
        caption="${pascalCase(tableId)} sample data"
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        state={state}
      />
    </main>
  );
}

const meta = { title: 'WingmanPM Product/Generated/${tableId}', parameters: { layout: 'fullscreen', a11y: { test: 'error' } } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <SampleTable /> };
export const LongContent: Story = { render: () => <SampleTable rows={sampleRows.slice(0, 3)} /> };
export const Loading: Story = { render: () => <SampleTable state="loading" /> };
export const Empty: Story = { render: () => <SampleTable state="empty" rows={[]} /> };
export const NoResults: Story = { render: () => <SampleTable state="no-results" rows={[]} /> };
export const Partial: Story = { render: () => <SampleTable state="partial" /> };
export const Stale: Story = { render: () => <SampleTable state="stale" /> };
export const ErrorState: Story = { name: 'Error', render: () => <SampleTable state="error" /> };
export const Permission: Story = { render: () => <SampleTable state="permission" /> };
export const Offline: Story = { render: () => <SampleTable state="offline" /> };
export const Saving: Story = { render: () => <SampleTable state="saving" /> };
export const Success: Story = { render: () => <SampleTable state="success" /> };
export const DuplicateIdentity: Story = { render: () => <SampleTable rows={[sampleRows[0], { ...sampleRows[1], id: sampleRows[0].id }]} /> };
export const EmptyIdentity: Story = { render: () => <SampleTable rows={[{ ...sampleRows[0], id: '' }]} /> };
`;
}

function storySource(tableId, profile) {
  const name = `${pascalCase(tableId)}Table`;
  const editor = profile === 'editable'
    ? ", editor: { type: 'text', validate: (value: unknown) => String(value ?? '').trim() ? null : 'Name is required.' }"
    : '';
  const statusEditor = profile === 'editable'
    ? ", editor: { type: 'select', options: [{ label: 'Ready', value: 'Ready' }, { label: 'In progress', value: 'In progress' }, { label: 'Blocked', value: 'Blocked' }] }"
    : '';
  const editHandler = profile === 'editable' ? `
        onCommitEdit={async ({ rowId, columnId, value, previousValue }) => {
          if (String(value).toLocaleLowerCase() === 'reject') throw new Error('Sample rejected save. Retry or cancel.');
          if (String(value).toLocaleLowerCase() === 'conflict') return { status: 'conflict', message: 'Value changed elsewhere. Review and retry.' };
          setCurrentRows((current) => current.map((row) => row.id === rowId ? { ...row, [columnId]: value } as SampleRow : row));
          setLastAction('edit:' + rowId + ':' + columnId + ':' + String(value));
          return {
            message: 'Sample edit saved.',
            undo: async () => {
              setCurrentRows((current) => current.map((row) => row.id === rowId ? { ...row, [columnId]: previousValue } as SampleRow : row));
              setLastAction('undo-edit:' + rowId + ':' + columnId);
            }
          };
        }}` : '';
  return `import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';
import { ${name} } from '../components/wingman-design/tables/${name}';
import type { ${name}Props } from '../components/wingman-design/tables/${name}';
import type { WingmanDataTableColumn, WingmanPagination, WingmanServerSort, WingmanTableDensity, WingmanTableFilterDefinition, WingmanTableFilters, WingmanTableState } from '../components/wingman-design/data-table';
import '../components/wingman-design/system.css';

type SampleRow = { id: string; name: string; status: string; owner: string };
const sampleRows: SampleRow[] = Array.from({ length: 53 }, (_, index) => ({
  id: 'sample-' + (index + 1),
  name: index === 0 ? 'Przykład (dane testowe): Zażółć gęślą jaźń, 31.08.2026 · 1 234,56 zł, długie tłumaczenie pozostaje kompletne' : 'Sample work item ' + (index + 1),
  status: index % 3 === 0 ? 'Ready' : index % 3 === 1 ? 'In progress' : 'Blocked',
  owner: index === 0 ? 'Beispieldaten: Łucja Weiß, vollständige Verantwortlichenbezeichnung' : index % 2 ? 'Sample: Alex Nowak' : 'Sample: Sam Rivera'
}));
const thousandRows: SampleRow[] = Array.from({ length: 1000 }, (_, index) => ({
  id: 'scale-' + (index + 1),
  name: 'Sample scale row ' + (index + 1),
  status: index % 2 ? 'Ready' : 'In progress',
  owner: index % 2 ? 'Sample: Maya Chen' : 'Sample: Alex Nowak'
}));
const columns: Array<WingmanDataTableColumn<SampleRow>> = [
  { id: 'name', label: 'Name', description: 'The stable item identity.', accessor: 'name', required: true, hideable: false, reorderable: false, sortable: true, minWidth: 180, defaultWidth: 280, maxWidth: 560, fullValue: 'wrap'${editor} },
  { id: 'status', label: 'Status', description: 'The current workflow state.', accessor: 'status', sortable: true, minWidth: 112, defaultWidth: 144, maxWidth: 220, fullValue: 'wrap'${statusEditor} },
  { id: 'owner', label: 'Owner', description: 'The person accountable for the next action.', accessor: 'owner', sortable: true, minWidth: 136, defaultWidth: 184, maxWidth: 320, fullValue: 'focus-tooltip' }
];
const filterDefinitions: WingmanTableFilterDefinition[] = [{
  id: 'status',
  label: 'Status',
  columnId: 'status',
  options: [
    { label: 'Ready', value: 'Ready' },
    { label: 'In progress', value: 'In progress' },
    { label: 'Blocked', value: 'Blocked' }
  ]
}];

function SampleTable({ state = 'ready', density = 'comfortable', rows = sampleRows, pageSize = 10, pagination }: { state?: WingmanTableState; density?: WingmanTableDensity; rows?: SampleRow[]; pageSize?: number; pagination?: WingmanPagination }) {
  const [currentRows, setCurrentRows] = useState(rows);
  const [lastAction, setLastAction] = useState('');
  useEffect(() => setCurrentRows(rows), [rows]);
  return (
    <div className="wpd-main">
      <${name}
        caption="${pascalCase(tableId)} sample data"
        data={currentRows}
        columns={columns}
        filterDefinitions={filterDefinitions}
        getRowId={(row) => row.id}
        state={state}
        initialDensity={density}
        pagination={pagination ?? { mode: 'client', initialPageSize: pageSize, pageSizeOptions: [10, 25, 50, 1000] }}
        renderExpanded={(row) => <p>Full details for {row.name}. Owner: {row.owner}.</p>}
        bulkActions={[{ id: 'assign', label: 'Assign' }, { id: 'archive', label: 'Archive' }, { id: 'delete', label: 'Delete', destructive: true }]}
        onBulkAction={async (actionId, selection) => {
          const exclusions = selection.type === 'all-filtered' && selection.excludedRowIds.length ? ':excluded=' + selection.excludedRowIds.length : '';
          setLastAction('bulk:' + actionId + ':' + selection.type + exclusions);
          const undo = async () => setLastAction('undo-bulk:' + actionId);
          return actionId === 'archive'
            ? { failed: 2, message: '2 sample rows failed; other changes completed.', undo }
            : { message: 'Sample bulk action completed.', undo };
        }}
${editHandler}
      />
      <output data-testid="table-result">{lastAction}</output>
    </div>
  );
}

function OffsetTable() {
  const [pageIndex, setPageIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [serverSort, setServerSort] = useState<WingmanServerSort>(null);
  const [serverFilters, setServerFilters] = useState<WingmanTableFilters>({});
  const rows = sampleRows.slice(pageIndex * 10, pageIndex * 10 + 10);
  return (
    <>
      <SampleTable
        rows={rows}
        pagination={{
          mode: 'offset', pageIndex, pageSize: 10, totalRows: 53,
          onPageChange: (nextPage) => setPageIndex(nextPage),
          serverQuery: {
            query,
            sort: serverSort,
            filters: serverFilters,
            onQueryChange: (nextQuery) => { setQuery(nextQuery); setPageIndex(0); },
            onSortChange: setServerSort,
            onFiltersChange: setServerFilters
          }
        }}
      />
      <output data-testid="server-result">server-query:{query}|server-sort:{serverSort?.id ?? 'none'}:{serverSort?.direction ?? 'none'}</output>
    </>
  );
}

function CursorTable() {
  const [cursorIndex, setCursorIndex] = useState(0);
  const [query, setQuery] = useState('');
  const [serverSort, setServerSort] = useState<WingmanServerSort>(null);
  const [serverFilters, setServerFilters] = useState<WingmanTableFilters>({});
  const rows = sampleRows.slice(cursorIndex * 10, cursorIndex * 10 + 10);
  return (
    <>
      <SampleTable
        rows={rows}
        pagination={{
          mode: 'cursor', pageSize: 10,
          hasPreviousPage: cursorIndex > 0,
          hasNextPage: cursorIndex < 5,
          onPrevious: () => setCursorIndex((current) => Math.max(0, current - 1)),
          onNext: () => setCursorIndex((current) => current + 1),
          serverQuery: { query, sort: serverSort, filters: serverFilters, onQueryChange: setQuery, onSortChange: setServerSort, onFiltersChange: setServerFilters }
        }}
      />
      <output data-testid="server-result">cursor:{cursorIndex}|server-query:{query}|server-sort:{serverSort?.id ?? 'none'}:{serverSort?.direction ?? 'none'}</output>
    </>
  );
}

function UnconfiguredHandlersTable() {
  const unsafeProps = {
    caption: '${pascalCase(tableId)} unconfigured handler proof',
    data: sampleRows.slice(0, 3),
    columns,
    getRowId: (row: SampleRow) => row.id,
    pagination: { mode: 'client' as const, initialPageSize: 10 },
    renderExpanded: (row: SampleRow) => <p>Full details for {row.name}.</p>,
    bulkActions: [{ id: 'assign', label: 'Assign' }]
  } as unknown as ${name}Props<SampleRow>;
  return (
    <div className="wpd-main">
      <${name} {...unsafeProps} />
    </div>
  );
}

const meta = { title: 'WingmanPM Product/Generated/${tableId}', parameters: { layout: 'fullscreen', a11y: { test: 'error' } } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { render: () => <SampleTable /> };
export const Dense: Story = { render: () => <SampleTable density="dense" /> };
export const LongContent: Story = { render: () => <SampleTable rows={sampleRows.slice(0, 3)} /> };
export const ThousandRowResize: Story = { name: '1,000 rendered rows · resize performance', render: () => <SampleTable rows={thousandRows} pageSize={1000} /> };
export const OffsetPagination: Story = { name: 'Server offset pagination', render: () => <OffsetTable /> };
export const CursorPagination: Story = { name: 'Server cursor pagination', render: () => <CursorTable /> };
export const UnconfiguredHandlers: Story = { name: 'Unconfigured handlers · safety proof', render: () => <UnconfiguredHandlersTable /> };
export const Loading: Story = { render: () => <SampleTable state="loading" /> };
export const Empty: Story = { render: () => <SampleTable state="empty" rows={[]} /> };
export const NoResults: Story = { render: () => <SampleTable state="no-results" /> };
export const Partial: Story = { render: () => <SampleTable state="partial" /> };
export const Stale: Story = { render: () => <SampleTable state="stale" /> };
export const ErrorState: Story = { name: 'Error', render: () => <SampleTable state="error" /> };
export const Permission: Story = { render: () => <SampleTable state="permission" /> };
export const Offline: Story = { render: () => <SampleTable state="offline" /> };
export const Saving: Story = { render: () => <SampleTable state="saving" /> };
export const Success: Story = { render: () => <SampleTable state="success" /> };
export const DuplicateIdentity: Story = { render: () => <SampleTable rows={[sampleRows[0], { ...sampleRows[1], id: sampleRows[0].id }]} /> };
export const EmptyIdentity: Story = { render: () => <SampleTable rows={[{ ...sampleRows[0], id: '' }]} /> };
`;
}

function browserTestSource(tableId, profile) {
  const storyId = `wingmanpm-product-generated-${tableId}--default`;
  const staticTests = profile === 'static' ? `
test('static profile omits operational controls', async ({ page }) => {
  await page.goto(story);
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Dense' })).toHaveCount(0);
  await expect(page.getByText('Columns', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
});

test('static loading respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(story.replace('--default', '--loading'));
  await expect(page.locator('.wpd-static-table-skeleton').first()).toHaveCSS('animation-name', 'none');
});
` : '';
  const workTests = profile === 'static' ? '' : `
test('density, column alternatives, keyboard resize, and complete value tooltip work', async ({ page }) => {
  await page.goto(story);
  const root = page.locator('.wpd-data-table');
  await page.getByRole('button', { name: 'Dense' }).click();
  await expect(root).toHaveAttribute('data-density', 'dense');
  await page.locator('.wpd-column-manager > summary').click();
  await page.getByRole('button', { name: 'Move Status right' }).click();
  const headings = await page.locator('thead th').allTextContents();
  expect(headings.join('|')).toContain('Owner|Status');
  await page.getByRole('checkbox', { name: 'Owner' }).uncheck();
  await expect(page.getByRole('columnheader', { name: /Owner/ })).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Owner' }).click();
  await expect(page.getByRole('checkbox', { name: 'Owner' })).toBeChecked();
  const separator = page.getByRole('separator', { name: 'Resize Status column' });
  await separator.focus();
  const initial = Number(await separator.getAttribute('aria-valuenow'));
  await page.keyboard.press('ArrowRight');
  await expect(separator).toHaveAttribute('aria-valuenow', String(initial + 8));
  await page.keyboard.press('Shift+ArrowRight');
  await expect(separator).toHaveAttribute('aria-valuenow', String(initial + 40));
  await page.keyboard.press('Home');
  await expect(separator).toHaveAttribute('aria-valuenow', '112');
  await page.keyboard.press('End');
  await expect(separator).toHaveAttribute('aria-valuenow', '220');
  const fullValue = page.getByRole('button', { name: 'Show full value for Owner' }).first();
  await fullValue.focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toBeHidden();
});

test('structured filter controls show their active scope and clear cleanly', async ({ page }) => {
  await page.goto(story);
  await page.locator('.wpd-filter-manager > summary').click();
  await page.getByRole('checkbox', { name: 'Filter Status: Ready' }).check();
  await expect(page.locator('.wpd-filter-manager > summary')).toContainText('1');
  await expect(page.getByRole('button', { name: 'Remove Status: Ready' })).toBeVisible();
  await expect(page.getByText('1–10 of 18')).toBeVisible();
  await page.getByRole('button', { name: 'Clear all filters' }).click();
  await expect(page.getByText('1–10 of 53')).toBeVisible();
});

test('drag reorder works and keeps the move-button alternative', async ({ page }) => {
  await page.goto(story);
  const source = page.getByRole('button', { name: /Drag Status column/ });
  const target = page.getByRole('button', { name: /Drag Owner column/ });
  await source.dragTo(target);
  await expect.poll(async () => (await page.locator('thead th').allTextContents()).join('|')).toContain('Owner|Status');
  await page.locator('.wpd-column-manager > summary').click();
  await expect(page.getByRole('button', { name: 'Move Status left' })).toBeVisible();
});

test('pagination, expansion, page selection, all-filtered selection, and bulk work are truthful', async ({ page }) => {
  await page.goto(story);
  await expect(page.getByText('1–10 of 53')).toBeVisible();
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('11–20 of 53')).toBeVisible();
  await page.getByRole('button', { name: 'Previous page' }).click();
  await page.getByRole('button', { name: /^Expand row sample-1$/ }).click();
  await expect(page.getByText(/Full details for Przykład \\(dane testowe\\)/)).toBeVisible();
  await page.getByRole('checkbox', { name: 'Select all rows on this page' }).check();
  await expect(page.getByText('10 selected')).toBeVisible();
  await page.getByRole('button', { name: 'Select all 53 filtered rows' }).click();
  await expect(page.getByText('53 selected')).toBeVisible();
  await page.getByRole('checkbox', { name: /^Select row sample-1$/ }).uncheck();
  await expect(page.getByText('52 selected')).toBeVisible();
  await page.getByRole('button', { name: 'Assign' }).click();
  await expect(page.getByTestId('table-result')).toHaveText('bulk:assign:all-filtered:excluded=1');
  await page.getByRole('button', { name: 'Undo bulk action' }).click();
  await expect(page.getByTestId('table-result')).toHaveText('undo-bulk:assign');
  await page.getByRole('checkbox', { name: 'Select all rows on this page' }).check();
  await page.getByRole('button', { name: 'Archive' }).click();
  await expect(page.getByText('2 sample rows failed; other changes completed.')).toBeVisible();
  await page.getByRole('button', { name: 'Undo bulk action' }).click();
  await expect(page.getByTestId('table-result')).toHaveText('undo-bulk:archive');
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('button', { name: 'Confirm Delete' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm Delete' }).click();
  await expect(page.getByTestId('table-result')).toHaveText('bulk:delete:rows');
});

test('offset pagination delegates query and sort to the server contract', async ({ page }) => {
  await page.goto(story.replace('--default', '--offset-pagination'));
  await expect(page.getByText('1–10 of 53')).toBeVisible();
  await expect(page.getByText('Page 1 of 6')).toBeVisible();
  await page.getByRole('searchbox').fill('remote-only-query');
  await expect(page.getByTestId('server-result')).toContainText('server-query:remote-only-query');
  await expect(page.getByText(/Przykład \\(dane testowe\\).*Zażółć/)).toBeVisible();
  await page.getByRole('button', { name: 'Name', exact: true }).click();
  await expect(page.getByTestId('server-result')).toContainText('server-sort:name:asc');
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect(page.getByText('11–20 of 53')).toBeVisible();
});

test('cursor pagination never invents totals or page numbers', async ({ page }) => {
  await page.goto(story.replace('--default', '--cursor-pagination'));
  const pagination = page.getByRole('navigation', { name: /pagination/i });
  await expect(pagination).toContainText('10 rows loaded');
  await expect(pagination).not.toContainText(/\bPage\b|\bof\s+\d/);
  await page.getByRole('button', { name: /Next/ }).click();
  await expect(page.getByTestId('server-result')).toContainText('cursor:1');
  await page.getByRole('searchbox').fill('server-cursor-query');
  await expect(page.getByTestId('server-result')).toContainText('server-query:server-cursor-query');
  await expect(pagination).not.toContainText(/\bPage\b|\bof\s+\d/);
});

test('pointer resize commits on release and restores width on cancellation', async ({ page }) => {
  await page.goto(story);
  const separator = page.getByRole('separator', { name: 'Resize Status column' });
  const initial = Number(await separator.getAttribute('aria-valuenow'));
  await separator.dispatchEvent('pointerdown', { pointerId: 17, clientX: 100, bubbles: true });
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 17, clientX: 116, bubbles: true })));
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 17, clientX: 116, bubbles: true })));
  await expect(separator).toHaveAttribute('aria-valuenow', String(initial + 16));
  await separator.dispatchEvent('pointerdown', { pointerId: 18, clientX: 116, bubbles: true });
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 18, clientX: 148, bubbles: true })));
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 18, clientX: 148, bubbles: true })));
  await expect(separator).toHaveAttribute('aria-valuenow', String(initial + 16));
});

test('first and last header tooltips stay inside a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(story);
  const assertInsideViewport = async () => {
    const bounds = await page.getByRole('tooltip').boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  };
  await page.getByRole('button', { name: 'About Name' }).focus();
  await assertInsideViewport();
  await page.keyboard.press('Escape');
  const scrollRegion = page.getByRole('region', { name: /scrollable/i });
  await scrollRegion.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  await page.getByRole('button', { name: 'About Owner' }).focus();
  await assertInsideViewport();
});

test('reduced motion keeps loading meaning without shimmer', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(story.replace('--default', '--loading'));
  await expect(page.locator('.wpd-table-skeleton').first()).toHaveCSS('animation-name', 'none');
});

test('missing bulk handler never reports a fake success', async ({ page }) => {
  await page.goto(story.replace('--default', '--unconfigured-handlers'));
  await page.getByRole('checkbox', { name: 'Select row sample-1' }).check();
  await page.getByRole('button', { name: 'Assign' }).click();
  await expect(page.getByText('Bulk actions are not configured. Connect onBulkAction before changing selected rows.')).toBeVisible();
  await expect(page.getByText('1 selected')).toBeVisible();
});

test('200% and 400% text zoom keep controls and horizontal overflow contained', async ({ page }) => {
  for (const percent of [200, 400]) {
    await page.goto(story);
    await page.evaluate((value) => { document.documentElement.style.fontSize = value + '%'; }, percent);
    await expect(page.locator('[data-wingman-table-id="${tableId}"]')).toBeVisible();
    expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('coarse pointers force comfort density and retain non-drag column alternatives', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = (query) => query === '(pointer: coarse)'
      ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } }
      : original(query);
  });
  await page.goto(story);
  await expect(page.locator('.wpd-data-table')).toHaveAttribute('data-density', 'comfortable');
  await expect(page.getByRole('button', { name: 'Dense' })).toBeDisabled();
  await page.locator('.wpd-column-manager > summary').click();
  await expect(page.getByRole('button', { name: 'Move Status right' })).toBeVisible();
  await page.getByLabel('Status width preset').selectOption('wide');
});

test('versioned view preferences migrate safely and never persist transient state', async ({ page }) => {
  const storageKey = 'wingmanpm-design:table:${tableId}';
  await page.goto(story);
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 0, density: 'dense', columnOrder: ['owner'], columnVisibility: { name: false }, columnWidths: { status: 999 } })), storageKey);
  await page.reload();
  await expect(page.locator('.wpd-data-table')).toHaveAttribute('data-density', 'comfortable');
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').schemaVersion, storageKey)).toBe(1);
  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ schemaVersion: 1, density: 'compressed', columnOrder: [42], columnVisibility: { owner: 'yes' }, columnWidths: { status: 'wide' } })), storageKey);
  await page.reload();
  await expect(page.locator('.wpd-data-table')).toHaveAttribute('data-density', 'comfortable');
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').density, storageKey)).toBe('comfortable');
  await page.getByRole('button', { name: 'Dense' }).click();
  await page.locator('.wpd-column-manager > summary').click();
  await page.getByRole('button', { name: 'Move Status right' }).click();
  await page.getByRole('checkbox', { name: 'Owner' }).uncheck();
  await page.getByLabel('Status width preset').selectOption('wide');
  await page.locator('.wpd-column-manager > summary').click();
  await page.getByRole('checkbox', { name: /^Select row sample-1$/ }).check();
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}').density, storageKey)).toBe('dense');
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), storageKey);
  expect(saved.columnOrder).toEqual(['name', 'owner', 'status']);
  expect(saved.columnVisibility.owner).toBe(false);
  expect(saved.columnWidths.status).toBe(220);
  for (const transient of ['selection', 'drafts', 'errors', 'activeEditing']) expect(saved).not.toHaveProperty(transient);
  await page.reload();
  await expect(page.locator('.wpd-data-table')).toHaveAttribute('data-density', 'dense');
  await expect(page.getByRole('columnheader', { name: /Owner/ })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /^Select row sample-1$/ })).not.toBeChecked();
});

test('1,000-row resize reports a warning instead of a flaky performance block', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.goto(story.replace('--default', '--thousand-row-resize'));
  await expect(page.locator('[data-wingman-table-id="${tableId}"] tbody > tr')).toHaveCount(1000);
  const separator = page.getByRole('separator', { name: 'Resize Status column' });
  await separator.focus();
  const started = performance.now();
  for (let index = 0; index < 12; index += 1) await page.keyboard.press('ArrowRight');
  const elapsed = performance.now() - started;
  if (elapsed > 250) testInfo.annotations.push({ type: 'performance-warning', description: '12 resize steps took ' + Math.round(elapsed) + ' ms; profile before enabling virtualization.' });
  await expect(separator).toHaveAttribute('aria-valuenow', '220');
});
`;
  const editableTests = profile === 'editable' ? `
test('editable profile supports cancel, validation, commit, and rejected save', async ({ page }) => {
  await page.goto(story);
  await page.getByRole('button', { name: 'Edit Name' }).first().click();
  let editor = page.getByRole('textbox', { name: 'Edit Name' });
  await editor.fill('Canceled value');
  await page.getByRole('button', { name: 'Cancel editing Name' }).click();
  await expect(page.getByText('Canceled value')).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit Name' }).first().click();
  editor = page.getByRole('textbox', { name: 'Edit Name' });
  await editor.fill('');
  await page.getByRole('button', { name: 'Save Name' }).click();
  await expect(page.getByText('Name is required.')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel editing Name' }).click();
  await page.getByRole('button', { name: 'Edit Name' }).first().click();
  editor = page.getByRole('textbox', { name: 'Edit Name' });
  await editor.fill('Renamed sample');
  await page.getByRole('button', { name: 'Save Name' }).click();
  await expect(page.getByTestId('table-result')).toHaveText('edit:sample-1:name:Renamed sample');
  await expect(page.getByText('Renamed sample', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Undo edit' }).click();
  await expect(page.getByTestId('table-result')).toHaveText('undo-edit:sample-1:name');
  await expect(page.getByText(/Przykład \\(dane testowe\\).*Zażółć gęślą jaźń/)).toBeVisible();
  await page.getByRole('button', { name: 'Edit Name' }).first().click();
  editor = page.getByRole('textbox', { name: 'Edit Name' });
  await editor.fill('conflict');
  await page.getByRole('button', { name: 'Save Name' }).click();
  await expect(page.getByText('Value changed elsewhere. Review and retry.').first()).toBeVisible();
  await expect(editor).toBeVisible();
  await page.getByRole('button', { name: 'Cancel editing Name' }).click();
  await page.getByRole('button', { name: 'Edit Name' }).nth(1).click();
  editor = page.getByRole('textbox', { name: 'Edit Name' });
  await editor.fill('reject');
  await page.getByRole('button', { name: 'Save Name' }).click();
  await expect(page.getByText('Sample rejected save. Retry or cancel.')).toBeVisible();
  await expect(editor).toBeVisible();
});

test('permission, offline, and saving states keep mutation controls locked', async ({ page }) => {
  for (const state of ['permission', 'offline', 'saving']) {
    await page.goto(story.replace('--default', '--' + state));
    await expect(page.getByRole('button', { name: 'Edit Name' }).first()).toBeDisabled();
    await expect(page.getByRole('checkbox', { name: 'Select all rows on this page' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Select all rows on this page' })).toBeDisabled();
  }
});

test('missing edit handler keeps the editor open and never fakes persistence', async ({ page }) => {
  await page.goto(story.replace('--default', '--unconfigured-handlers'));
  await page.getByRole('button', { name: 'Edit Name' }).first().click();
  const editor = page.getByRole('textbox', { name: 'Edit Name' });
  await editor.fill('Unsafe local-only value');
  await page.getByRole('button', { name: 'Save Name' }).click();
  await expect(page.getByText('Inline editing is not configured. Connect onCommitEdit before saving changes.').first()).toBeVisible();
  await expect(editor).toBeVisible();
});

test('inline edit drafts and active editors never survive reload', async ({ page }) => {
  await page.goto(story);
  await page.getByRole('button', { name: 'Edit Name' }).first().click();
  await page.getByRole('textbox', { name: 'Edit Name' }).fill('Unpersisted draft');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Edit Name' })).toHaveCount(0);
  await expect(page.getByText('Unpersisted draft', { exact: true })).toHaveCount(0);
});
` : '';
  return `import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const story = '/iframe.html?id=${storyId}&viewMode=story';

async function analyzeWithAxe(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await new AxeBuilder({ page }).analyze();
    } catch (error) {
      if (!String(error).includes('Axe is already running') || attempt === 2) throw error;
      await page.waitForTimeout(100);
    }
  }
  throw new Error('Axe analysis did not complete.');
}

async function tableSelectContrast(page: Page) {
  return page.locator('[data-wingman-table-id="${tableId}"]').evaluate((table) => {
    type Color = { red: number; green: number; blue: number; alpha: number };
    type ContrastFailure = { label: string; reason?: string; ratio?: number };
    const parseColor = (value: string): Color | null => {
      const channels = value.match(/[\\d.]+/g)?.map(Number);
      if (!channels || channels.length < 3) return null;
      return { red: channels[0], green: channels[1], blue: channels[2], alpha: channels[3] ?? 1 };
    };
    const composite = (foreground: Color, background: Color): Color => ({
      red: foreground.red * foreground.alpha + background.red * (1 - foreground.alpha),
      green: foreground.green * foreground.alpha + background.green * (1 - foreground.alpha),
      blue: foreground.blue * foreground.alpha + background.blue * (1 - foreground.alpha),
      alpha: 1
    });
    const channelLuminance = (channel: number) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    const luminance = (color: Color) => 0.2126 * channelLuminance(color.red) + 0.7152 * channelLuminance(color.green) + 0.0722 * channelLuminance(color.blue);
    const contrast = (foreground: Color, background: Color) => {
      const foregroundLuminance = luminance(foreground);
      const backgroundLuminance = luminance(background);
      return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
    };
    const root = table.closest('.wpd-data-table, .wpd-static-table');
    if (!root) return { selectCount: 0, candidateCount: 0, controlClasses: [], failures: [{ label: 'table root', reason: 'missing Wingman table boundary' }] };
    const documentBackground = parseColor(getComputedStyle(document.body).backgroundColor) ?? { red: 255, green: 255, blue: 255, alpha: 1 };
    const selects = Array.from(root.querySelectorAll('select')).filter((select) => {
      const style = getComputedStyle(select);
      return !select.disabled && !select.hidden && select.getClientRects().length > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    });
    let candidateCount = 0;
    const controlClasses = [...new Set(selects.map((select) => {
      if (select.closest('.wpd-column-width-preset')) return 'wpd-column-width-preset';
      if (select.closest('.wpd-inline-editor')) return 'wpd-inline-editor';
      if (select.closest('.wpd-table-pagination')) return 'wpd-table-pagination';
      return 'unclassified-select';
    }))];
    const failures = selects.flatMap<ContrastFailure>((select, selectIndex) => {
      const selectStyle = getComputedStyle(select);
      const rawSelectBackground = parseColor(selectStyle.backgroundColor) ?? documentBackground;
      const selectBackground = rawSelectBackground.alpha < 1 ? composite(rawSelectBackground, documentBackground) : rawSelectBackground;
      const candidates: Array<{ element: Element; label: string }> = [
        { element: select, label: 'select ' + (select.getAttribute('aria-label') ?? selectIndex + 1) },
        ...Array.from(select.options)
          .filter((option) => !option.disabled && !(option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled))
          .map((option) => ({ element: option, label: 'option ' + option.value }))
      ];
      candidateCount += candidates.length;
      return candidates.flatMap<ContrastFailure>(({ element, label }) => {
        const style = getComputedStyle(element);
        const rawBackground = parseColor(style.backgroundColor) ?? selectBackground;
        const background = rawBackground.alpha < 1 ? composite(rawBackground, selectBackground) : rawBackground;
        const rawForeground = parseColor(style.color);
        if (!rawForeground) return [{ label, reason: 'unresolved text color' }];
        const foreground = rawForeground.alpha < 1 ? composite(rawForeground, background) : rawForeground;
        const ratio = contrast(foreground, background);
        return ratio >= 4.5 ? [] : [{ label, ratio: Number(ratio.toFixed(2)) }];
      });
    });
    return { selectCount: selects.length, candidateCount, controlClasses, failures };
  });
}

for (const width of [390, 768, 1280, 1440]) {
  for (const theme of ['light', 'dark']) {
    test('${tableId} table at ' + width + 'px in ' + theme, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(story + '&globals=theme:' + theme);
      await expect(page.locator('[data-wingman-table-id="${tableId}"][data-wingman-table-profile="${profile}"]')).toBeVisible();
      expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true);
      const results = await analyzeWithAxe(page);
      expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
      ${profile === 'editable' ? "await page.getByRole('button', { name: 'Edit Status' }).first().click();\n      await expect(page.locator('.wpd-inline-editor select')).toBeVisible();" : ''}
      ${profile === 'static' ? '' : "await page.locator('.wpd-column-manager > summary').click();\n      await expect(page.locator('.wpd-column-manager-panel')).toBeVisible();"}
      const selectContrast = await tableSelectContrast(page);
      expect(selectContrast.failures, 'Every table select and option must meet WCAG AA text contrast.').toEqual([]);
      ${profile === 'static'
        ? "expect(selectContrast.selectCount, 'Static tables must stay free of operational selects.').toBe(0);\n      expect(selectContrast.candidateCount).toBe(0);\n      expect(selectContrast.controlClasses).toEqual([]);"
        : profile === 'editable'
          ? "expect(selectContrast.controlClasses).toEqual(expect.arrayContaining(['wpd-table-pagination', 'wpd-column-width-preset', 'wpd-inline-editor']));\n      expect(selectContrast.selectCount, 'Editable proof must include pagination, every width preset, and its inline editor.').toBeGreaterThanOrEqual(5);\n      expect(selectContrast.candidateCount, 'Editable proof must include the options for every required control.').toBeGreaterThanOrEqual(21);"
          : "expect(selectContrast.controlClasses).toEqual(expect.arrayContaining(['wpd-table-pagination', 'wpd-column-width-preset']));\n      expect(selectContrast.selectCount, 'Work proof must include pagination and every width preset.').toBeGreaterThanOrEqual(4);\n      expect(selectContrast.candidateCount, 'Work proof must include the options for every required control.').toBeGreaterThanOrEqual(17);"}
    });
  }
}

test('${tableId} table preserves complete values at narrow width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(story);
  await page.getByRole('region', { name: /scrollable/i }).focus();
  await expect(page.locator('body')).not.toHaveJSProperty('scrollWidth', 0);
  await expect(page.getByText(/Przykład \\(dane testowe\\).*1 234,56 zł/)).toBeVisible();
});

test('${tableId} rejects duplicate and empty row identities before interaction', async ({ page }) => {
  await page.goto(story.replace('--default', '--duplicate-identity'));
  await expect(page.getByRole('alert')).toContainText('Duplicate row identity');
  await page.goto(story.replace('--default', '--empty-identity'));
  await expect(page.getByRole('alert')).toContainText('empty identity');
});
${staticTests}${workTests}${editableTests}
`;
}

function integrationSource(tableId, existingGrid) {
  return `# ${tableId} integration

This project already uses \`${existingGrid}\`. Preserve that engine and the
established shared table components. Implement the contract in
\`${tableId}.json\` with the existing grid instead of adding TanStack Table.

Required proof:

- Add a literal \`data-wingman-table-id="${tableId}"\` and the matching profile
  to the production table boundary.
- Add the Storybook and browser-test paths named by the contract.
- Provide the non-drag reorder controls, keyboard resize separator and presets,
  and full-value paths for every compact cell.

Until those production, Storybook, browser-test, and visual-review links are
complete, wingman-design check is expected to report WPD019 proof debt. The
generator does not claim this integration is complete.
`;
}

async function findProjectOwnedGrid(root) {
  const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte']);
  const candidates = (await listFiles(root)).filter((file) => {
    const relative = relativeUnix(root, file);
    if (!sourceExtensions.has(path.extname(file))) return false;
    if (!/^(?:src|app|components|packages|ui|lib)\//.test(relative)) return false;
    if (/(?:^|\/)(?:tests?|__tests__|__fixtures__|stories)(?:\/|$)|\.(?:stories|story|spec|test)\./i.test(relative)) return false;
    if (relative.includes('/wingman-design/') || relative.startsWith('src/components/wingman-design/')) return false;
    return true;
  });
  for (const file of candidates) {
    let content;
    try { content = await readFile(file, 'utf8'); } catch { continue; }
    const definesSharedTable = /\b(?:export\s+(?:default\s+)?(?:function|class|const)|(?:function|class|const))\s+(?:DataTable|DataGrid|SmartTable|VirtualizedTable)\b/.test(content);
    const importsLocalSharedTable = /\bimport\s+(?:\{[^}]*\b(?:DataTable|DataGrid|SmartTable|VirtualizedTable)\b[^}]*\}|(?:DataTable|DataGrid|SmartTable|VirtualizedTable))\s+from\s+['"](?:\.|@\/|~\/)/.test(content);
    const hasHeadlessEngine = /\buseReactTable\s*\(|\bcreateTable\s*\(/.test(content);
    const hasGridPrimitive = /<(?:DataGrid|AgGridReact|ReactDataGrid|HotTable)\b|role\s*=\s*['"]grid['"]/.test(content);
    const featureSignals = [
      /column(?:Order|Visibility|Sizing)/,
      /rowSelection|selectedRows?/i,
      /pagination|pageSize/i,
      /sorting|sortBy|sorted/i,
      /resiz(?:e|ing)|columnWidth/i
    ].filter((pattern) => pattern.test(content)).length;
    if (hasHeadlessEngine || hasGridPrimitive || importsLocalSharedTable || (definesSharedTable && featureSignals >= 2)) {
      return relativeUnix(root, file);
    }
  }
  return null;
}

export async function detectTableProject(projectRoot) {
  const root = path.resolve(projectRoot);
  const packageFile = path.join(root, 'package.json');
  const packageJson = await readJson(packageFile, {});
  const dependencies = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
  const existingGrid = CAPABLE_GRIDS.find((name) => Object.hasOwn(dependencies, name)) ?? null;
  const react = Boolean(dependencies.react);
  const wingmanKit = await exists(path.join(root, 'src', 'components', 'wingman-design', 'data-table', 'DataTable.tsx'));
  const projectOwnedGrid = wingmanKit ? null : await findProjectOwnedGrid(root);
  return {
    projectRoot: root,
    packageFile,
    packageJson,
    react,
    wingmanKit,
    projectOwnedGrid,
    existingGrid: existingGrid ?? (projectOwnedGrid ? `project-owned shared table at ${projectOwnedGrid}` : null),
    stack: react ? 'react' : 'framework-neutral'
  };
}

export async function planDataTableScaffold(projectRoot, options = {}) {
  const root = path.resolve(projectRoot);
  if (!(await exists(root))) throw new Error(`Project does not exist: ${root}`);
  const profile = options.profile ?? 'work';
  if (!TABLE_PROFILES.includes(profile)) {
    throw new Error(`Unknown table profile "${profile}". Use: ${TABLE_PROFILES.join(', ')}.`);
  }
  const tableId = options.tableId ?? options.id ?? 'data-table';
  assertTableId(tableId);
  const detected = await detectTableProject(root);
  const strategy = detected.react && profile === 'static'
    ? 'native-react-static'
    : detected.wingmanKit
      ? 'tanstack-react'
    : detected.existingGrid
      ? 'preserve-existing-grid'
      : detected.react
      ? 'tanstack-react'
      : 'framework-neutral';
  const contractTarget = path.join(root, 'design-system', 'tables', `${tableId}.json`);
  if (await exists(contractTarget)) {
    let existingContract;
    try { existingContract = await readJson(contractTarget); } catch (error) {
      throw new Error(`Cannot reuse table ID ${tableId}; its existing contract is malformed: ${error.message}`);
    }
    if (existingContract?.profile && existingContract.profile !== profile) {
      throw new Error(`Table ID ${tableId} already uses profile ${existingContract.profile}; choose a new ID or keep that profile.`);
    }
  }
  const operations = [{
    type: 'create',
    target: contractTarget,
    content: `${JSON.stringify(tableContract(tableId, profile), null, 2)}\n`,
    ownership: 'user'
  }];
  const dependencies = [];
  const warnings = [];
  let surfaceTarget = contractTarget;

  if (strategy === 'native-react-static') {
    operations.push(...await templateStaticComponentOperations(root));
    const componentName = `${pascalCase(tableId)}Table`;
    surfaceTarget = path.join(root, 'src', 'components', 'wingman-design', 'tables', `${componentName}.tsx`);
    operations.push(
      {
        type: 'create',
        target: surfaceTarget,
        content: staticWrapperSource(tableId),
        ownership: 'seeded'
      },
      {
        type: 'create',
        target: path.join(root, 'src', 'stories', `${componentName}.stories.tsx`),
        content: staticStorySource(tableId),
        ownership: 'seeded'
      },
      {
        type: 'create',
        target: path.join(root, 'tests', 'wingman-design', `${tableId}.spec.ts`),
        content: browserTestSource(tableId, profile),
        ownership: 'seeded'
      }
    );
  } else if (strategy === 'tanstack-react') {
    operations.push(...await templateComponentOperations(root));
    const componentName = `${pascalCase(tableId)}Table`;
    surfaceTarget = path.join(root, 'src', 'components', 'wingman-design', 'tables', `${componentName}.tsx`);
    operations.push(
      {
        type: 'create',
        target: surfaceTarget,
        content: wrapperSource(tableId, profile),
        ownership: 'seeded'
      },
      {
        type: 'create',
        target: path.join(root, 'src', 'stories', `${componentName}.stories.tsx`),
        content: storySource(tableId, profile),
        ownership: 'seeded'
      },
      {
        type: 'create',
        target: path.join(root, 'tests', 'wingman-design', `${tableId}.spec.ts`),
        content: browserTestSource(tableId, profile),
        ownership: 'seeded'
      }
    );
    dependencies.push(
      { section: 'dependencies', key: '@tanstack/react-table', value: '9.2.4' },
      { section: 'dependencies', key: '@dnd-kit/react', value: '0.5.0' },
      { section: 'dependencies', key: 'lucide-react', value: '0.468.0' }
    );
  } else if (strategy === 'preserve-existing-grid') {
    surfaceTarget = path.join(root, 'design-system', 'tables', `${tableId}.integration.md`);
    operations.push({
      type: 'create',
      target: surfaceTarget,
      content: integrationSource(tableId, detected.existingGrid),
      ownership: 'user'
    });
    warnings.push(`Preserve and extend ${detected.existingGrid}; no parallel grid dependency will be added.`);
    warnings.push('Integration is not complete: WPD019 proof debt is expected until production use, Storybook, browser tests, and visual review are connected.');
  } else {
    const neutralFilename = profile === 'static' ? 'static-table.html' : 'data-table.html';
    const neutralTemplate = (await readFile(path.join(PACKAGE_ROOT, 'templates', 'data-table', 'neutral', neutralFilename), 'utf8'))
      .replaceAll('{{TABLE_ID}}', tableId)
      .replaceAll('{{TABLE_PROFILE}}', profile);
    surfaceTarget = path.join(root, 'design-system', 'examples', `${tableId}-table.html`);
    operations.push({
      type: 'create',
      target: surfaceTarget,
      content: neutralTemplate,
      ownership: 'seeded'
    });
    warnings.push('Framework-neutral semantic reference created; connect it to the detected stack.');
    warnings.push('Integration is not complete: WPD019 proof debt is expected until production use, stories or equivalent state proof, browser tests, and visual review are connected.');
  }

  for (const operation of operations) {
    operation.type = await exists(operation.target) ? 'preserve' : 'create';
  }
  return {
    projectRoot: root,
    profile,
    tableId,
    stack: detected.stack,
    strategy,
    existingGrid: detected.existingGrid,
    projectOwnedGrid: detected.projectOwnedGrid,
    requiresIntegration: strategy === 'preserve-existing-grid' || strategy === 'framework-neutral',
    surfaceFile: relativeUnix(root, surfaceTarget),
    dependencies,
    operations,
    warnings
  };
}

async function updateProjectPackage(plan, createdDependencies) {
  if (!plan.dependencies.length) return;
  const packageFile = path.join(plan.projectRoot, 'package.json');
  const packageJson = await readJson(packageFile, null);
  if (!packageJson) return;
  let changed = false;
  for (const dependency of plan.dependencies) {
    const otherSection = dependency.section === 'dependencies' ? 'devDependencies' : 'dependencies';
    if (packageJson[dependency.section]?.[dependency.key] || packageJson[otherSection]?.[dependency.key]) continue;
    packageJson[dependency.section] ??= {};
    packageJson[dependency.section][dependency.key] = dependency.value;
    createdDependencies.push(dependency);
    changed = true;
  }
  if (changed) await writeJsonAtomic(packageFile, packageJson);
}

async function registerManifest(plan, created, createdDependencies, reviewHash) {
  const manifestFile = path.join(plan.projectRoot, PROJECT_MANIFEST);
  if (!(await exists(manifestFile))) return;
  const manifest = await readJson(manifestFile);
  manifest.entries ??= [];
  manifest.packageDependencies ??= [];
  for (const item of created) {
    const relative = relativeUnix(plan.projectRoot, item.target);
    if (manifest.entries.some((entry) => entry.path === relative)) continue;
    manifest.entries.push({
      path: relative,
      ownership: item.ownership,
      action: 'created',
      hash: await fileHash(item.target)
    });
  }
  for (const dependency of createdDependencies) {
    if (!manifest.packageDependencies.some((item) => item.section === dependency.section && item.key === dependency.key)) {
      manifest.packageDependencies.push(dependency);
    }
  }
  const inventoryFile = path.join(plan.projectRoot, '.wingmanpm-design', 'table-inventory.json');
  if (await exists(inventoryFile)) {
    const inventoryPath = relativeUnix(plan.projectRoot, inventoryFile);
    const inventoryEntry = manifest.entries.find((entry) => entry.path === inventoryPath);
    const next = { path: inventoryPath, ownership: 'observed', action: 'created', hash: await fileHash(inventoryFile) };
    if (inventoryEntry) Object.assign(inventoryEntry, next);
    else manifest.entries.push(next);
  }
  upsertObservedReviewEntry(manifest, reviewHash);
  await writeJsonAtomic(manifestFile, manifest);
}

async function updateTableInventory(plan) {
  const inventoryFile = path.join(plan.projectRoot, '.wingmanpm-design', 'table-inventory.json');
  let prior = null;
  if (await exists(inventoryFile)) prior = await readJson(inventoryFile);
  const tables = Array.isArray(prior?.tables) ? prior.tables : [];
  const entry = {
    id: plan.tableId,
    file: plan.surfaceFile,
    inferredProfile: plan.profile,
    status: plan.requiresIntegration ? 'integration-required' : 'generated',
    sourceHash: await fileHash(path.join(plan.projectRoot, plan.surfaceFile)),
    note: plan.requiresIntegration
      ? 'Integration guidance only; production and evidence links remain required.'
      : 'Created by wingman-design add data-table; the contract remains authoritative.'
  };
  const nextTables = tables.filter((table) => table?.id !== plan.tableId && table?.file !== plan.surfaceFile);
  nextTables.push(entry);
  nextTables.sort((left, right) => left.file.localeCompare(right.file));
  if (prior && JSON.stringify(prior.tables ?? []) === JSON.stringify(nextTables)) return false;
  await writeJsonAtomic(inventoryFile, {
    ...(prior ?? {}),
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    purpose: prior?.purpose ?? 'Discovery only. Confirm a table profile before changing its behavior.',
    tables: nextTables
  });
  return true;
}

export async function applyDataTableScaffold(plan, options = {}) {
  if (options.dryRun) {
    return {
      ...plan,
      status: 'dry-run',
      created: [],
      preserved: plan.operations.filter((item) => item.type === 'preserve').map((item) => relativeUnix(plan.projectRoot, item.target))
    };
  }
  const willCreateGeneratedSource = (await Promise.all(plan.operations.map(async (operation) =>
    operation.type === 'create' && !(await exists(operation.target))
  ))).some(Boolean);
  const reviewPlan = willCreateGeneratedSource
    ? await planReviewInvalidation(plan.projectRoot, {
      force: true,
      additionalProfiles: [plan.profile],
      notes: 'Review invalidated after WingmanPM generated table changes. Run browser checks, then record a new human review.'
    })
    : null;
  const reviewHash = reviewPlan ? await applyReviewInvalidation(reviewPlan) : null;
  const created = [];
  const preserved = [];
  for (const operation of plan.operations) {
    if (operation.type === 'preserve' || await exists(operation.target)) {
      preserved.push(relativeUnix(plan.projectRoot, operation.target));
      continue;
    }
    const content = operation.content ?? await readFile(operation.source, 'utf8');
    await writeAtomic(operation.target, content);
    created.push(operation);
  }
  const createdDependencies = [];
  await updateProjectPackage(plan, createdDependencies);
  const inventoryChanged = await updateTableInventory(plan);
  const generatedSourceChanged = created.length > 0;
  const projectChanged = generatedSourceChanged || createdDependencies.length > 0 || inventoryChanged;
  if (projectChanged) await registerManifest(plan, created, createdDependencies, reviewHash);
  const status = plan.requiresIntegration
    ? 'integration-required'
    : projectChanged
      ? 'scaffolded'
      : 'current';
  return {
    ...plan,
    status,
    created: created.map((item) => relativeUnix(plan.projectRoot, item.target)),
    preserved,
    addedDependencies: createdDependencies,
    inventoryChanged
  };
}

export async function scaffoldDataTable(projectRoot, options = {}) {
  const plan = await planDataTableScaffold(projectRoot, options);
  return applyDataTableScaffold(plan, { dryRun: Boolean(options.dryRun) });
}
