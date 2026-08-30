import { tableFeatures, useTable } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Edit3,
  ListFilter,
  RotateCcw,
  Search,
  Settings2,
  X
} from 'lucide-react';
import {
  useEffect,
  Fragment,
  useMemo,
  useRef,
  useState
} from 'react';
import type { ChangeEvent, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { ColumnDragHandle, ColumnReorderProvider } from './ColumnReorderAdapter';
import { createLayeredTablePreferencesAdapter, createLocalTablePreferencesAdapter } from './DataTablePreferences';
import type {
  TablePreferences,
  WingmanBulkAction,
  WingmanDataTableColumn,
  WingmanDataTableProps,
  WingmanSelectionScope,
  WingmanTableFilters,
  WingmanTableDensity,
  WingmanTableState
} from './DataTable.types';
import { TableTooltip } from './TableTooltip';
import './DataTable.css';

const engineFeatures = tableFeatures({});
const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_WIDTH = 176;
const MIN_WIDTH = 72;
const MAX_WIDTH = 720;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function cellValue<T extends Record<string, unknown>>(column: WingmanDataTableColumn<T>, row: T) {
  return typeof column.accessor === 'function' ? column.accessor(row) : row[column.accessor];
}

function comparable(value: unknown) {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  return String(value ?? '').toLocaleLowerCase();
}

function validateRowIdentity<T extends Record<string, unknown>>(data: T[], getRowId: (row: T) => string) {
  const seen = new Set<string>();
  for (const [index, row] of data.entries()) {
    let rowId: unknown;
    try { rowId = getRowId(row); } catch {
      return `Row ${index + 1} identity could not be read.`;
    }
    if (typeof rowId !== 'string' || rowId.trim() === '') return `Row ${index + 1} has an empty identity.`;
    if (seen.has(rowId)) return `Duplicate row identity "${rowId}" was found.`;
    seen.add(rowId);
  }
  return null;
}

function moveBefore(values: string[], sourceId: string, targetId: string) {
  const sourceIndex = values.indexOf(sourceId);
  const targetIndex = values.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return values;
  const next = values.filter((id) => id !== sourceId);
  next.splice(next.indexOf(targetId), 0, sourceId);
  return next;
}

function moveTo(values: string[], sourceId: string, targetIndex: number) {
  const sourceIndex = values.indexOf(sourceId);
  if (sourceIndex < 0) return values;
  const next = values.filter((id) => id !== sourceId);
  next.splice(clamp(targetIndex, 0, next.length), 0, sourceId);
  return next;
}

function SelectionCheckbox({ checked, mixed, label, onChange, disabled = false }: {
  checked: boolean;
  mixed?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(mixed);
  }, [mixed]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      aria-label={label}
      disabled={disabled}
      onChange={(event) => onChange(event.currentTarget.checked)}
    />
  );
}

function stateCopy(state: WingmanTableState, emptyTitle: string, emptyMessage: string, noResultsMessage: string) {
  const copy: Record<Exclude<WingmanTableState, 'ready'>, { title: string; message: string }> = {
    loading: { title: 'Loading rows', message: 'The table structure remains available.' },
    empty: { title: emptyTitle, message: emptyMessage },
    'no-results': { title: 'No matching rows', message: noResultsMessage },
    partial: { title: 'Some rows are unavailable', message: 'Available results are shown. Retry the missing source.' },
    stale: { title: 'Data may be stale', message: 'The last available results stay visible while refresh continues.' },
    error: { title: 'Rows could not load', message: 'Nothing was changed. Retry when ready.' },
    permission: { title: 'Read-only access', message: 'You can inspect these rows but cannot change them.' },
    offline: { title: 'You are offline', message: 'Saved data stays visible. Changes resume after reconnection.' },
    saving: { title: 'Saving changes', message: 'Keep this page open until the update finishes.' },
    success: { title: 'Changes saved', message: 'The latest values are now visible.' }
  };
  return state === 'ready' ? null : copy[state];
}

function parseEditorValue(type: string, draft: string): unknown {
  if (type === 'number') return draft.trim() === '' ? null : Number(draft);
  return draft;
}

type EditState = {
  rowId: string;
  columnId: string;
  original: unknown;
  draft: string;
  status: 'editing' | 'saving' | 'error';
  error?: string;
};

function InlineEditor({
  label,
  editor,
  edit,
  onDraft,
  onCommit,
  onCancel
}: {
  label: string;
  editor: NonNullable<WingmanDataTableColumn<Record<string, unknown>>['editor']>;
  edit: EditState;
  onDraft: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const errorId = `${edit.rowId}-${edit.columnId}-edit-error`;
  const shared = {
    autoFocus: true,
    value: edit.draft,
    disabled: edit.status === 'saving',
    'aria-label': `Edit ${label}`,
    'aria-invalid': edit.status === 'error' as const,
    'aria-describedby': edit.error ? errorId : undefined,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onDraft(event.currentTarget.value),
    onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        onCommit();
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    }
  };
  return (
    <div className="wpd-inline-editor" data-status={edit.status}>
      {editor.type === 'select' ? (
        <select {...shared}>
          {(editor.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      ) : (
        <input {...shared} type={editor.type} />
      )}
      <span className="wpd-inline-edit-actions">
        <button type="button" aria-label={`Save ${label}`} onClick={onCommit} disabled={edit.status === 'saving'}><Check aria-hidden="true" size={14} /></button>
        <button type="button" aria-label={`Cancel editing ${label}`} onClick={onCancel} disabled={edit.status === 'saving'}><X aria-hidden="true" size={14} /></button>
      </span>
      {edit.error && <span className="wpd-inline-edit-error" id={errorId}>{edit.error}</span>}
    </div>
  );
}

export function DataTable<T extends Record<string, unknown>>({
  tableId,
  profile,
  caption,
  data,
  columns,
  getRowId,
  state = 'ready',
  initialDensity = 'comfortable',
  pagination = { mode: 'client', initialPageSize: DEFAULT_PAGE_SIZE },
  filterDefinitions = [],
  filters: controlledFilters,
  onFiltersChange,
  preferencesAdapter,
  preferencesSchemaVersion = 1,
  bulkActions,
  onBulkAction,
  renderExpanded,
  onCommitEdit,
  onRetry,
  searchLabel = 'Search rows',
  emptyTitle = 'No rows yet',
  emptyMessage = 'Add the first item or change the current scope.',
  noResultsMessage = 'Change or clear the current search.'
}: WingmanDataTableProps<T>) {
  const identityError = validateRowIdentity(data, getRowId);
  const safeData = identityError ? [] : data;
  const defaults = useMemo(() => ({
    density: initialDensity,
    order: columns.map((column) => column.id),
    visibility: Object.fromEntries(columns.map((column) => [column.id, true])),
    widths: Object.fromEntries(columns.map((column) => [column.id, column.defaultWidth ?? DEFAULT_WIDTH]))
  }), [columns, initialDensity]);
  const localAdapter = useMemo(() => createLocalTablePreferencesAdapter(), []);
  const adapter = useMemo(
    () => createLayeredTablePreferencesAdapter(preferencesAdapter, localAdapter),
    [preferencesAdapter, localAdapter]
  );
  const [density, setDensity] = useState<WingmanTableDensity>(defaults.density);
  const [columnOrder, setColumnOrder] = useState(defaults.order);
  const [columnVisibility, setColumnVisibility] = useState(defaults.visibility);
  const [columnWidths, setColumnWidths] = useState(defaults.widths);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [preferencesMessage, setPreferencesMessage] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ id: string; direction: 'asc' | 'desc' } | null>(null);
  const [localFilters, setLocalFilters] = useState<WingmanTableFilters>({});
  const [clientPageIndex, setClientPageIndex] = useState(0);
  const [clientPageSize, setClientPageSize] = useState(
    pagination.mode === 'client' ? pagination.initialPageSize ?? DEFAULT_PAGE_SIZE : pagination.pageSize
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [allFilteredSelected, setAllFilteredSelected] = useState(false);
  const [excludedFilteredIds, setExcludedFilteredIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<EditState | null>(null);
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  const [announcement, setAnnouncement] = useState('');
  const [bulkStatus, setBulkStatus] = useState<'idle' | 'running' | 'error' | 'success'>('idle');
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkUndo, setBulkUndo] = useState<null | (() => Promise<void> | void)>(null);
  const [confirmAction, setConfirmAction] = useState<WingmanBulkAction | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [editUndo, setEditUndo] = useState<null | (() => Promise<void> | void)>(null);
  const [coarsePointer, setCoarsePointer] = useState(false);
  const isInteractive = true;
  const isMutationLocked = state === 'permission' || state === 'offline' || state === 'saving';
  const appliedDensity: WingmanTableDensity = coarsePointer ? 'comfortable' : density;
  const serverQuery = pagination.mode === 'client' ? undefined : pagination.serverQuery;
  const activeQuery = pagination.mode === 'client' ? query : serverQuery?.query ?? '';
  const activeSort = pagination.mode === 'client' ? sort : serverQuery?.sort ?? null;
  const activeFilters = pagination.mode === 'client'
    ? controlledFilters ?? localFilters
    : serverQuery?.filters ?? {};
  const activeFilterCount = Object.values(activeFilters).reduce((total, values) => total + values.length, 0);
  const filterSignature = JSON.stringify(activeFilters);
  const hasQueryControls = pagination.mode === 'client' || Boolean(serverQuery);

  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)');
    const update = () => setCoarsePointer(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    let active = true;
    setPreferencesReady(false);
    if (!isInteractive) {
      setPreferencesReady(true);
      return () => { active = false; };
    }
    adapter.load(tableId, preferencesSchemaVersion).then((saved) => {
      if (!active || !saved) return;
      const known = new Set(columns.map((column) => column.id));
      const savedOrder = saved.columnOrder.filter((id) => known.has(id));
      setDensity(saved.density);
      setColumnOrder([...savedOrder, ...columns.map((column) => column.id).filter((id) => !savedOrder.includes(id))]);
      setColumnVisibility({ ...defaults.visibility, ...saved.columnVisibility });
      setColumnWidths({ ...defaults.widths, ...saved.columnWidths });
    }).catch(() => {
      if (active) setPreferencesMessage('Saved view could not load. Defaults are in use.');
    }).finally(() => {
      if (active) setPreferencesReady(true);
    });
    return () => { active = false; };
  }, [adapter, columns, defaults.visibility, defaults.widths, isInteractive, preferencesSchemaVersion, tableId]);

  useEffect(() => {
    if (!preferencesReady || !isInteractive) return;
    const timer = window.setTimeout(() => {
      const value: TablePreferences = {
        schemaVersion: preferencesSchemaVersion,
        density,
        columnOrder,
        columnVisibility,
        columnWidths
      };
      adapter.save(tableId, preferencesSchemaVersion, value)
        .then(() => setPreferencesMessage(''))
        .catch(() => setPreferencesMessage('View saved on this device; account sync is unavailable.'));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [adapter, columnOrder, columnVisibility, columnWidths, density, isInteractive, preferencesReady, preferencesSchemaVersion, tableId]);

  const getValue = (column: WingmanDataTableColumn<T>, row: T) => {
    const overrideKey = `${getRowId(row)}::${column.id}`;
    return Object.hasOwn(overrides, overrideKey) ? overrides[overrideKey] : cellValue(column, row);
  };

  const visibleColumns = columnOrder
    .map((id) => columns.find((column) => column.id === id))
    .filter((column): column is WingmanDataTableColumn<T> => Boolean(column && columnVisibility[column.id] !== false));

  const filteredRows = useMemo(() => {
    if (pagination.mode !== 'client') return safeData;
    let nextRows = safeData;
    for (const definition of filterDefinitions) {
      const selected = activeFilters[definition.id] ?? [];
      if (!selected.length) continue;
      const column = columns.find((candidate) => candidate.id === definition.columnId);
      if (!column) continue;
      nextRows = nextRows.filter((row) => selected.includes(String(getValue(column, row) ?? '')));
    }
    const normalized = activeQuery.trim().toLocaleLowerCase();
    if (!normalized) return nextRows;
    return nextRows.filter((row) => columns.some((column) => {
      if (column.filterable === false) return false;
      return String(getValue(column, row) ?? '').toLocaleLowerCase().includes(normalized);
    }));
  // getValue intentionally reflects overrides, which must participate in search.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilters, activeQuery, columns, filterDefinitions, overrides, pagination.mode, safeData]);

  const sortedRows = useMemo(() => {
    if (pagination.mode !== 'client' || !activeSort) return filteredRows;
    const column = columns.find((candidate) => candidate.id === activeSort.id);
    if (!column) return filteredRows;
    return [...filteredRows].sort((left, right) => {
      const a = comparable(getValue(column, left));
      const b = comparable(getValue(column, right));
      const result = a < b ? -1 : a > b ? 1 : 0;
      return activeSort.direction === 'asc' ? result : -result;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSort, columns, filteredRows, overrides, pagination.mode]);

  const offsetPageIndex = pagination.mode === 'offset' ? pagination.pageIndex : clientPageIndex;
  const pageSize = pagination.mode === 'client' ? clientPageSize : pagination.pageSize;
  const pageRows = pagination.mode === 'client'
    ? sortedRows.slice(clientPageIndex * clientPageSize, (clientPageIndex + 1) * clientPageSize)
    : sortedRows;
  const truthfulTotal = pagination.mode === 'offset' ? pagination.totalRows : filteredRows.length;
  const pageCount = pagination.mode === 'cursor' ? null : Math.max(1, Math.ceil(truthfulTotal / pageSize));

  useEffect(() => {
    if (pagination.mode === 'client' && clientPageIndex >= Math.max(1, Math.ceil(filteredRows.length / clientPageSize))) {
      setClientPageIndex(0);
    }
  }, [clientPageIndex, clientPageSize, filteredRows.length, pagination.mode]);

  const startEdit = (row: T, column: WingmanDataTableColumn<T>) => {
    if (profile !== 'editable' || !column.editor || isMutationLocked) return;
    setEditMessage('');
    const original = getValue(column, row);
    setEdit({
      rowId: getRowId(row),
      columnId: column.id,
      original,
      draft: String(original ?? ''),
      status: 'editing'
    });
  };

  const commitEdit = async (row: T, column: WingmanDataTableColumn<T>) => {
    if (!edit || !column.editor) return;
    if (isMutationLocked) {
      const message = 'Editing is unavailable while this table is read-only, offline, or saving.';
      setEdit({ ...edit, status: 'error', error: message });
      setEditMessage(message);
      return;
    }
    const value = parseEditorValue(column.editor.type, edit.draft);
    const validation = column.editor.validate?.(value);
    if (validation) {
      setEdit({ ...edit, status: 'error', error: validation });
      return;
    }
    if (column.editor.type === 'number' && typeof value === 'number' && Number.isNaN(value)) {
      setEdit({ ...edit, status: 'error', error: 'Enter a valid number.' });
      return;
    }
    if (!onCommitEdit) {
      const message = 'Inline editing is not configured. Connect onCommitEdit before saving changes.';
      setEdit({ ...edit, status: 'error', error: message });
      setEditMessage(message);
      return;
    }
    setEdit({ ...edit, status: 'saving', error: undefined });
    try {
      const result = await onCommitEdit({
        row,
        rowId: edit.rowId,
        columnId: edit.columnId,
        value,
        previousValue: edit.original
      });
      if (result?.status === 'conflict') {
        const message = result.message ?? 'This value changed elsewhere. Review the latest value and retry.';
        setEdit({ ...edit, status: 'error', error: message });
        setEditMessage(message);
        return;
      }
      setOverrides((current) => ({ ...current, [`${edit.rowId}::${edit.columnId}`]: value }));
      setEdit(null);
      setEditMessage(result?.message ?? `${column.label} saved.`);
      setAnnouncement(result?.message ?? `${column.label} saved.`);
      setEditUndo(result?.undo ? () => async () => {
        await result.undo?.();
        setOverrides((current) => ({ ...current, [`${edit.rowId}::${edit.columnId}`]: edit.original }));
        setEditMessage(`${column.label} change undone.`);
        setEditUndo(null);
      } : null);
    } catch (error) {
      setEdit((current) => current ? {
        ...current,
        status: 'error',
        error: error instanceof Error ? error.message : 'The value could not be saved. Retry or cancel.'
      } : current);
    }
  };

  const renderValue = (row: T, column: WingmanDataTableColumn<T>): ReactNode => {
    const value = getValue(column, row);
    const rendered = column.render ? column.render(value, row) : String(value ?? 'Not available');
    const rowId = getRowId(row);
    if (edit?.rowId === rowId && edit.columnId === column.id && column.editor) {
      return (
        <InlineEditor
          label={column.label}
          editor={column.editor as NonNullable<WingmanDataTableColumn<Record<string, unknown>>['editor']>}
          edit={edit}
          onDraft={(draft) => setEdit((current) => current ? { ...current, draft, status: 'editing', error: undefined } : current)}
          onCommit={() => commitEdit(row, column)}
          onCancel={() => setEdit(null)}
        />
      );
    }
    const display = column.fullValue === 'focus-tooltip' && typeof rendered === 'string'
      ? <TableTooltip label={column.label} content={rendered} valueOnly />
      : <span className="wpd-table-cell-value">{rendered}</span>;
    if (profile === 'editable' && column.editor) {
      return (
        <span className="wpd-editable-cell-value">
          {display}
          <button
            type="button"
            className="wpd-cell-edit-trigger"
            aria-label={`Edit ${column.label}`}
            onClick={() => startEdit(row, column)}
            onKeyDown={(event) => {
              if (event.key === 'F2') {
                event.preventDefault();
                startEdit(row, column);
              }
            }}
            disabled={isMutationLocked}
          >
            <Edit3 aria-hidden="true" size={13} />
          </button>
        </span>
      );
    }
    return display;
  };

  const engineColumns = visibleColumns.map((column) => ({
    id: column.id,
    accessorFn: (row: T) => getValue(column, row),
    header: column.label,
    cell: (info: { row: { original: T } }) => renderValue(info.row.original, column)
  })) as Array<ColumnDef<typeof engineFeatures, T>>;

  const table = useTable({
    key: tableId,
    features: engineFeatures,
    columns: engineColumns,
    data: pageRows,
    getRowId
  });

  const pageIds = pageRows.map(getRowId);
  const rowIsSelected = (rowId: string) => allFilteredSelected
    ? !excludedFilteredIds.has(rowId)
    : selectedIds.has(rowId);
  const allPageSelected = pageIds.length > 0 && pageIds.every(rowIsSelected);
  const somePageSelected = !allPageSelected && pageIds.some(rowIsSelected);
  const selectedCount = allFilteredSelected
    ? Math.max(0, truthfulTotal - excludedFilteredIds.size)
    : selectedIds.size;

  const togglePage = (checked: boolean) => {
    if (allFilteredSelected) {
      setExcludedFilteredIds((current) => {
        const next = new Set(current);
        for (const id of pageIds) checked ? next.delete(id) : next.add(id);
        return next;
      });
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of pageIds) checked ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const toggleRow = (rowId: string, checked: boolean) => {
    if (allFilteredSelected) {
      setExcludedFilteredIds((current) => {
        const next = new Set(current);
        checked ? next.delete(rowId) : next.add(rowId);
        return next;
      });
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      checked ? next.add(rowId) : next.delete(rowId);
      return next;
    });
  };

  const selectionScope = (): WingmanSelectionScope => allFilteredSelected
    ? {
        type: 'all-filtered',
        query: activeQuery,
        sort: activeSort,
        filters: activeFilters,
        total: truthfulTotal,
        excludedRowIds: [...excludedFilteredIds]
      }
    : { type: 'rows', rowIds: [...selectedIds] };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setAllFilteredSelected(false);
    setExcludedFilteredIds(new Set());
    setConfirmAction(null);
  };

  const commitFilters = (next: WingmanTableFilters) => {
    if (pagination.mode === 'client') {
      if (onFiltersChange) onFiltersChange(next);
      else setLocalFilters(next);
      setClientPageIndex(0);
    } else {
      serverQuery?.onFiltersChange(next);
    }
    clearSelection();
  };

  const toggleFilter = (filterId: string, value: string, checked: boolean) => {
    const current = activeFilters[filterId] ?? [];
    const nextValues = checked
      ? [...new Set([...current, value])]
      : current.filter((candidate) => candidate !== value);
    commitFilters({ ...activeFilters, [filterId]: nextValues });
  };

  useEffect(() => {
    setSelectedIds(new Set());
    setAllFilteredSelected(false);
    setExcludedFilteredIds(new Set());
    setConfirmAction(null);
  }, [activeQuery, activeSort?.direction, activeSort?.id, filterSignature, pagination.mode]);

  useEffect(() => {
    if (!isMutationLocked) return;
    setSelectedIds(new Set());
    setAllFilteredSelected(false);
    setExcludedFilteredIds(new Set());
    setConfirmAction(null);
    setEdit(null);
  }, [isMutationLocked]);

  const runBulkAction = async (action: WingmanBulkAction) => {
    if (isMutationLocked) {
      setBulkStatus('error');
      setBulkMessage('Bulk actions are unavailable while this table is read-only, offline, or saving.');
      return;
    }
    if (!onBulkAction) {
      setBulkStatus('error');
      setBulkMessage('Bulk actions are not configured. Connect onBulkAction before changing selected rows.');
      return;
    }
    if (action.destructive && confirmAction?.id !== action.id) {
      setConfirmAction(action);
      setBulkMessage(`Confirm ${action.label.toLocaleLowerCase()} for ${selectedCount} selected rows.`);
      return;
    }
    setConfirmAction(null);
    setBulkStatus('running');
    setBulkMessage(`${action.label} in progress.`);
    setBulkUndo(null);
    try {
      const result = await onBulkAction(action.id, selectionScope());
      const failed = result?.failed ?? 0;
      setBulkStatus(failed ? 'error' : 'success');
      setBulkMessage(result?.message ?? (failed ? `${failed} rows could not be updated. The other changes completed.` : `${action.label} completed.`));
      setBulkUndo(result?.undo ? () => result.undo! : null);
      if (!failed) clearSelection();
    } catch (error) {
      setBulkStatus('error');
      setBulkMessage(error instanceof Error ? error.message : `${action.label} could not complete.`);
    }
  };

  const undoBulkAction = async () => {
    if (!bulkUndo) return;
    setBulkStatus('running');
    setBulkMessage('Undo in progress.');
    try {
      await bulkUndo();
      setBulkStatus('success');
      setBulkMessage('Bulk action undone.');
      setBulkUndo(null);
    } catch (error) {
      setBulkStatus('error');
      setBulkMessage(error instanceof Error ? error.message : 'The bulk action could not be undone.');
    }
  };

  const setColumnWidth = (column: WingmanDataTableColumn<T>, width: number) => {
    setColumnWidths((current) => ({
      ...current,
      [column.id]: clamp(width, column.minWidth ?? MIN_WIDTH, column.maxWidth ?? MAX_WIDTH)
    }));
  };

  const beginPointerResize = (event: ReactPointerEvent<HTMLSpanElement>, column: WingmanDataTableColumn<T>) => {
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = columnWidths[column.id] ?? column.defaultWidth ?? DEFAULT_WIDTH;
    const tableElement = handle.closest('table');
    const colElement = tableElement?.querySelector<HTMLTableColElement>(`col[data-column-id="${CSS.escape(column.id)}"]`);
    let previewWidth = startWidth;
    try { handle.setPointerCapture(pointerId); } catch { /* Pointer capture is an enhancement. */ }
    const onMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      previewWidth = clamp(startWidth + moveEvent.clientX - startX, column.minWidth ?? MIN_WIDTH, column.maxWidth ?? MAX_WIDTH);
      if (colElement) colElement.style.width = `${previewWidth}px`;
      handle.setAttribute('aria-valuenow', String(previewWidth));
    };
    const cleanUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onCancel);
      try { if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId); } catch { /* The pointer may already be released. */ }
    };
    const onEnd = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return;
      cleanUp();
      setColumnWidth(column, previewWidth);
      setAnnouncement(`${column.label} width set to ${previewWidth} pixels.`);
    };
    const onCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== pointerId) return;
      cleanUp();
      if (colElement) colElement.style.width = `${startWidth}px`;
      handle.setAttribute('aria-valuenow', String(startWidth));
      setAnnouncement(`${column.label} resize canceled.`);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onCancel);
  };

  const resizeWithKeyboard = (event: KeyboardEvent<HTMLSpanElement>, column: WingmanDataTableColumn<T>) => {
    const current = columnWidths[column.id] ?? column.defaultWidth ?? DEFAULT_WIDTH;
    const step = event.shiftKey ? 32 : 8;
    let next: number | null = null;
    if (event.key === 'ArrowLeft') next = current - step;
    if (event.key === 'ArrowRight') next = current + step;
    if (event.key === 'Home') next = column.minWidth ?? MIN_WIDTH;
    if (event.key === 'End') next = column.maxWidth ?? MAX_WIDTH;
    if (next !== null) {
      event.preventDefault();
      event.stopPropagation();
      setColumnWidth(column, next);
      setAnnouncement(`${column.label} width ${clamp(next, column.minWidth ?? MIN_WIDTH, column.maxWidth ?? MAX_WIDTH)} pixels.`);
    }
  };

  const moveColumn = (columnId: string, destination: 'start' | 'left' | 'right' | 'end') => {
    setColumnOrder((current) => {
      const index = current.indexOf(columnId);
      const target = destination === 'start' ? 0 : destination === 'end' ? current.length - 1 : destination === 'left' ? index - 1 : index + 1;
      const next = moveTo(current, columnId, target);
      setAnnouncement(`${columns.find((column) => column.id === columnId)?.label ?? columnId} moved to position ${next.indexOf(columnId) + 1} of ${next.length}.`);
      return next;
    });
  };

  const resetView = async () => {
    setDensity(defaults.density);
    setColumnOrder(defaults.order);
    setColumnVisibility(defaults.visibility);
    setColumnWidths(defaults.widths);
    await adapter.reset(tableId);
    setAnnouncement('Table view reset.');
  };

  const effectiveState: WingmanTableState = state === 'ready' && !safeData.length
    ? 'empty'
    : state === 'ready' && (activeQuery || activeFilterCount > 0) && !filteredRows.length
      ? 'no-results'
      : state;
  const copy = stateCopy(effectiveState, emptyTitle, emptyMessage, noResultsMessage);
  const showRows = !['loading', 'empty', 'no-results', 'error'].includes(effectiveState);
  const selectionVisible = isInteractive && showRows;
  const selectionAllowed = selectionVisible && !isMutationLocked;
  const expansionAllowed = isInteractive && showRows && Boolean(renderExpanded);
  const utilityColumns = Number(selectionVisible) + Number(expansionAllowed);
  const columnCount = visibleColumns.length + utilityColumns;

  if (identityError) {
    return (
      <section className="wpd-data-table" data-density={appliedDensity} data-profile={profile} aria-label={caption}>
        <div className="wpd-table-config-error" role="alert">
          <strong>Table configuration error</strong>
          <span>{identityError} Every row must have a unique, non-empty ID before this table can be used.</span>
        </div>
      </section>
    );
  }

  return (
    <section className="wpd-data-table" data-density={appliedDensity} data-profile={profile} aria-label={caption}>
      <p className="wpd-visually-hidden" aria-live="polite">{announcement}</p>

      {copy && !['loading', 'empty', 'no-results', 'error'].includes(effectiveState) && (
        <div className={`wpd-table-state-banner is-${effectiveState}`} role="status">
          <span><strong>{copy.title}</strong><small>{copy.message}</small></span>
          {effectiveState === 'partial' && onRetry && <button type="button" onClick={onRetry}>Retry missing rows</button>}
        </div>
      )}

      {editMessage && (
        <div className="wpd-table-edit-feedback" role="status">
          <span>{editMessage}</span>
          {editUndo && <button type="button" onClick={editUndo}>Undo edit</button>}
          <button type="button" aria-label="Dismiss edit status" onClick={() => { setEditMessage(''); setEditUndo(null); }}><X aria-hidden="true" size={14} /></button>
        </div>
      )}

      {isInteractive && (
        <div className="wpd-table-toolbar" aria-label={`${caption} controls`}>
          {hasQueryControls && <label className="wpd-table-search">
            <Search aria-hidden="true" size={15} />
            <span className="wpd-visually-hidden">{searchLabel}</span>
            <input
              type="search"
              value={activeQuery}
              placeholder={searchLabel}
              onChange={(event) => {
                if (pagination.mode === 'client') {
                  setQuery(event.currentTarget.value);
                  setClientPageIndex(0);
                } else {
                  serverQuery?.onQueryChange(event.currentTarget.value);
                }
                clearSelection();
              }}
            />
          </label>}
          {filterDefinitions.length > 0 && (pagination.mode === 'client' || serverQuery) && (
            <details className="wpd-filter-manager">
              <summary>
                <ListFilter aria-hidden="true" size={15} />
                Filters
                {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
              </summary>
              <div className="wpd-filter-manager-panel">
                <div className="wpd-filter-manager-heading">
                  <span><strong>Filters</strong><small>Combine values without hiding the active scope.</small></span>
                  <button type="button" onClick={() => commitFilters({})} disabled={activeFilterCount === 0}>Clear filters</button>
                </div>
                {filterDefinitions.map((definition) => (
                  <fieldset key={definition.id}>
                    <legend>{definition.label}</legend>
                    {definition.options.map((option) => (
                      <label key={option.value}>
                        <input
                          type="checkbox"
                          checked={(activeFilters[definition.id] ?? []).includes(option.value)}
                          aria-label={`Filter ${definition.label}: ${option.label}`}
                          onChange={(event) => toggleFilter(definition.id, option.value, event.currentTarget.checked)}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </fieldset>
                ))}
              </div>
            </details>
          )}
          {activeFilterCount > 0 && (
            <div className="wpd-active-filters" aria-label="Active filters">
              {filterDefinitions.flatMap((definition) => (activeFilters[definition.id] ?? []).map((value) => {
                const option = definition.options.find((candidate) => candidate.value === value);
                const label = `${definition.label}: ${option?.label ?? value}`;
                return (
                  <button key={`${definition.id}:${value}`} type="button" aria-label={`Remove ${label}`} onClick={() => toggleFilter(definition.id, value, false)}>
                    <span>{label}</span><X aria-hidden="true" size={12} />
                  </button>
                );
              }))}
              <button type="button" className="wpd-clear-filters" onClick={() => commitFilters({})}>Clear all filters</button>
            </div>
          )}
          <div className="wpd-density-switch" role="group" aria-label="Row density">
            {(['dense', 'comfortable'] as const).map((value) => (
              <button key={value} type="button" aria-pressed={appliedDensity === value} disabled={coarsePointer && value === 'dense'} title={coarsePointer && value === 'dense' ? 'Comfort density is required for this pointer.' : undefined} onClick={() => setDensity(value)}>{value === 'dense' ? 'Dense' : 'Comfort'}</button>
            ))}
          </div>
          <details className="wpd-column-manager">
            <summary><Columns3 aria-hidden="true" size={15} /> Columns <ChevronDown aria-hidden="true" size={14} /></summary>
            <div className="wpd-column-manager-panel">
              <div className="wpd-column-manager-heading">
                <span><strong>Columns</strong><small>Show, move, and size each column.</small></span>
                <button type="button" onClick={resetView}><RotateCcw aria-hidden="true" size={13} /> Reset view</button>
              </div>
              <ol>
                {columnOrder.map((id, index) => {
                  const column = columns.find((candidate) => candidate.id === id);
                  if (!column) return null;
                  const canMove = column.reorderable !== false;
                  const currentWidth = columnWidths[id] ?? column.defaultWidth ?? DEFAULT_WIDTH;
                  return (
                    <li key={id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={columnVisibility[id] !== false}
                          disabled={column.required || column.hideable === false}
                          onChange={(event) => {
                            const checked = event.currentTarget.checked;
                            setColumnVisibility((current) => ({ ...current, [id]: checked }));
                          }}
                        />
                        <span>{column.label}{column.required && <small>Required</small>}</span>
                      </label>
                      <span className="wpd-column-move-buttons" role="group" aria-label={`Move ${column.label}`}>
                        <button type="button" aria-label={`Move ${column.label} to start`} disabled={!canMove || index === 0} onClick={() => moveColumn(id, 'start')}><ArrowLeftToLine aria-hidden="true" size={13} /></button>
                        <button type="button" aria-label={`Move ${column.label} left`} disabled={!canMove || index === 0} onClick={() => moveColumn(id, 'left')}><ChevronLeft aria-hidden="true" size={13} /></button>
                        <button type="button" aria-label={`Move ${column.label} right`} disabled={!canMove || index === columnOrder.length - 1} onClick={() => moveColumn(id, 'right')}><ChevronRight aria-hidden="true" size={13} /></button>
                        <button type="button" aria-label={`Move ${column.label} to end`} disabled={!canMove || index === columnOrder.length - 1} onClick={() => moveColumn(id, 'end')}><ArrowRightToLine aria-hidden="true" size={13} /></button>
                      </span>
                      <label className="wpd-column-width-preset">
                        <span className="wpd-visually-hidden">{column.label} width preset</span>
                        <select
                          value={currentWidth <= (column.minWidth ?? MIN_WIDTH) + 24 ? 'compact' : currentWidth >= (column.maxWidth ?? MAX_WIDTH) - 96 ? 'wide' : 'default'}
                          disabled={column.resizable === false}
                          onChange={(event) => {
                            const preset = event.currentTarget.value;
                            setColumnWidth(column, preset === 'compact' ? column.minWidth ?? MIN_WIDTH : preset === 'wide' ? column.maxWidth ?? MAX_WIDTH : column.defaultWidth ?? DEFAULT_WIDTH);
                          }}
                        >
                          <option value="compact">Compact</option>
                          <option value="default">Default</option>
                          <option value="wide">Wide</option>
                        </select>
                      </label>
                    </li>
                  );
                })}
              </ol>
            </div>
          </details>
          <span className="wpd-table-count" aria-live="polite">{truthfulTotal.toLocaleString()} {truthfulTotal === 1 ? 'row' : 'rows'}</span>
        </div>
      )}

      {preferencesMessage && <p className="wpd-table-preference-note" role="status"><Settings2 aria-hidden="true" size={14} /> {preferencesMessage}</p>}

      {(selectedCount > 0 || bulkMessage) && (
        <div className="wpd-table-bulk-bar" role="region" aria-label="Bulk actions" data-status={bulkStatus}>
          {selectedCount > 0 && <strong>{selectedCount.toLocaleString()} selected</strong>}
          {selectedCount > 0 && allPageSelected && !allFilteredSelected && pagination.mode !== 'cursor' && truthfulTotal > pageIds.length && (
            <button type="button" onClick={() => { setAllFilteredSelected(true); setSelectedIds(new Set()); setExcludedFilteredIds(new Set()); }}>
              Select all {truthfulTotal.toLocaleString()} filtered rows
            </button>
          )}
          {selectedCount > 0 && allFilteredSelected && <span>All filtered results</span>}
          <span className="wpd-bulk-actions">
            {selectedCount > 0 && bulkActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className={action.destructive ? 'is-destructive' : undefined}
                disabled={action.disabled || bulkStatus === 'running' || isMutationLocked}
                onClick={() => runBulkAction(action)}
              >
                {confirmAction?.id === action.id ? `Confirm ${action.label}` : action.label}
              </button>
            ))}
            {confirmAction && <button type="button" onClick={() => { setConfirmAction(null); setBulkMessage(''); }}>Cancel</button>}
            {bulkUndo && <button type="button" onClick={undoBulkAction} disabled={bulkStatus === 'running'}>Undo bulk action</button>}
            {selectedCount > 0 && <button type="button" onClick={clearSelection}>Clear</button>}
            {selectedCount === 0 && <button type="button" onClick={() => { setBulkMessage(''); setBulkUndo(null); }}>Dismiss</button>}
          </span>
          {bulkMessage && <small role={bulkStatus === 'error' ? 'alert' : 'status'}>{bulkMessage}</small>}
        </div>
      )}

      <ColumnReorderProvider
        columnIds={visibleColumns.map((column) => column.id)}
        onReorder={(sourceId, targetId) => {
          setColumnOrder((current) => moveBefore(current, sourceId, targetId));
          setAnnouncement(`${columns.find((column) => column.id === sourceId)?.label ?? sourceId} moved before ${columns.find((column) => column.id === targetId)?.label ?? targetId}.`);
        }}
      >
        <div className="wpd-data-table-scroll" tabIndex={0} role="region" aria-label={`Scrollable ${caption}`}>
          <table data-wingman-table-id={tableId} data-wingman-table-profile={profile}>
            <caption className="wpd-visually-hidden">{caption}</caption>
            <colgroup>
              {selectionVisible && <col className="wpd-table-control-column" />}
              {expansionAllowed && <col className="wpd-table-control-column" />}
              {visibleColumns.map((column) => <col key={column.id} data-column-id={column.id} style={{ width: columnWidths[column.id] ?? column.defaultWidth ?? DEFAULT_WIDTH }} />)}
            </colgroup>
            <thead>
              <tr>
                {selectionVisible && (
                  <th scope="col" className="wpd-table-control-cell">
                    <SelectionCheckbox checked={allPageSelected} mixed={somePageSelected} label="Select all rows on this page" onChange={togglePage} disabled={!selectionAllowed} />
                  </th>
                )}
                {expansionAllowed && <th scope="col" className="wpd-table-control-cell"><span className="wpd-visually-hidden">Row details</span></th>}
                {visibleColumns.map((column, index) => {
                  const sorted = activeSort?.id === column.id ? activeSort.direction : null;
                  const width = columnWidths[column.id] ?? column.defaultWidth ?? DEFAULT_WIDTH;
                  return (
                    <th
                      key={column.id}
                      scope="col"
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                      data-align={column.align ?? 'start'}
                      data-priority={column.priority ?? 3}
                    >
                      <span className="wpd-table-header-content">
                        {isInteractive && (
                          <ColumnDragHandle id={column.id} index={index} label={column.label} disabled={column.reorderable === false} />
                        )}
                        {column.sortable === false || (pagination.mode !== 'client' && !serverQuery) ? (
                          <span className="wpd-table-header-label">{column.label}</span>
                        ) : (
                          <button
                            type="button"
                            className="wpd-table-sort-button"
                            onClick={() => {
                              const next = activeSort?.id !== column.id
                                ? { id: column.id, direction: 'asc' as const }
                                : activeSort.direction === 'asc'
                                  ? { id: column.id, direction: 'desc' as const }
                                  : null;
                              if (pagination.mode === 'client') setSort(next);
                              else serverQuery?.onSortChange(next);
                              clearSelection();
                            }}
                          >
                            <span>{column.label}</span>
                            {sorted === 'asc' && <ArrowUp aria-hidden="true" size={13} />}
                            {sorted === 'desc' && <ArrowDown aria-hidden="true" size={13} />}
                          </button>
                        )}
                        {column.description && <TableTooltip label={column.label} content={column.description} />}
                        {isInteractive && column.resizable !== false && (
                          <span
                            className="wpd-column-resizer"
                            role="separator"
                            aria-orientation="vertical"
                            aria-label={`Resize ${column.label} column`}
                            aria-valuemin={column.minWidth ?? MIN_WIDTH}
                            aria-valuemax={column.maxWidth ?? MAX_WIDTH}
                            aria-valuenow={width}
                            tabIndex={0}
                            onPointerDown={(event) => beginPointerResize(event, column)}
                            onKeyDown={(event) => resizeWithKeyboard(event, column)}
                          />
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {effectiveState === 'loading' && Array.from({ length: 5 }, (_, rowIndex) => (
                <tr key={`loading-${rowIndex}`} aria-hidden="true">
                  {Array.from({ length: columnCount }, (_, cellIndex) => <td key={cellIndex}><span className="wpd-table-skeleton" /></td>)}
                </tr>
              ))}
              {!showRows && effectiveState !== 'loading' && copy && (
                <tr>
                  <td colSpan={Math.max(1, columnCount)}>
                    <div className="wpd-table-empty-state" role={effectiveState === 'error' ? 'alert' : 'status'}>
                      <strong>{copy.title}</strong><span>{copy.message}</span>
                      {effectiveState === 'error' && onRetry && <button type="button" onClick={onRetry}>Retry</button>}
                    </div>
                  </td>
                </tr>
              )}
              {showRows && table.getRowModel().rows.map((engineRow) => {
                const row = engineRow.original;
                const rowId = getRowId(row);
                const expanded = expandedIds.has(rowId);
                return (
                  <Fragment key={rowId}>
                    <tr data-selected={rowIsSelected(rowId) || undefined} data-expanded={expanded || undefined}>
                      {selectionVisible && (
                        <td className="wpd-table-control-cell">
                          <SelectionCheckbox checked={rowIsSelected(rowId)} label={`Select row ${rowId}`} onChange={(checked) => toggleRow(rowId, checked)} disabled={!selectionAllowed} />
                        </td>
                      )}
                      {expansionAllowed && (
                        <td className="wpd-table-control-cell">
                          <button
                            type="button"
                            className="wpd-row-expand-button"
                            aria-label={`${expanded ? 'Collapse' : 'Expand'} row ${rowId}`}
                            aria-expanded={expanded}
                            aria-controls={`${tableId}-${rowId}-details`}
                            onClick={() => setExpandedIds((current) => {
                              const next = new Set(current);
                              next.has(rowId) ? next.delete(rowId) : next.add(rowId);
                              return next;
                            })}
                          >
                            <ChevronRight aria-hidden="true" size={15} />
                          </button>
                        </td>
                      )}
                      {engineRow.getAllCells().map((cell) => {
                        const column = visibleColumns.find((candidate) => candidate.id === cell.column.id)!;
                        return (
                          <td
                            key={cell.id}
                            data-align={column.align ?? 'start'}
                            data-priority={column.priority ?? 3}
                            onDoubleClick={() => startEdit(row, column)}
                          >
                            <table.FlexRender cell={cell} />
                          </td>
                        );
                      })}
                    </tr>
                    {expanded && renderExpanded && (
                      <tr className="wpd-expanded-row">
                        <td id={`${tableId}-${rowId}-details`} colSpan={Math.max(1, columnCount)}>{renderExpanded(row)}</td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </ColumnReorderProvider>

      {showRows && (pagination.mode === 'cursor' ? (
        <nav className="wpd-table-pagination" aria-label={`${caption} pagination`}>
          <span>{pageRows.length.toLocaleString()} rows loaded</span>
          <span className="wpd-pagination-buttons">
            <button type="button" disabled={!pagination.hasPreviousPage} onClick={pagination.onPrevious}><ChevronLeft aria-hidden="true" size={15} /> Previous</button>
            <button type="button" disabled={!pagination.hasNextPage} onClick={pagination.onNext}>Next <ChevronRight aria-hidden="true" size={15} /></button>
          </span>
        </nav>
      ) : truthfulTotal > 0 && (
        <nav className="wpd-table-pagination" aria-label={`${caption} pagination`}>
          <span>
            {(offsetPageIndex * pageSize + 1).toLocaleString()}–{Math.min((offsetPageIndex + 1) * pageSize, truthfulTotal).toLocaleString()} of {truthfulTotal.toLocaleString()}
          </span>
          <label>
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={(event) => {
                const next = Number(event.currentTarget.value);
                if (pagination.mode === 'offset') pagination.onPageChange(0, next);
                else { setClientPageSize(next); setClientPageIndex(0); }
              }}
            >
              {(pagination.pageSizeOptions ?? [10, 25, 50, 100]).map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <span>Page {offsetPageIndex + 1} of {pageCount}</span>
          <span className="wpd-pagination-buttons">
            <button
              type="button"
              aria-label="Previous page"
              disabled={offsetPageIndex === 0}
              onClick={() => pagination.mode === 'offset' ? pagination.onPageChange(offsetPageIndex - 1, pageSize) : setClientPageIndex((current) => Math.max(0, current - 1))}
            ><ChevronLeft aria-hidden="true" size={15} /></button>
            <button
              type="button"
              aria-label="Next page"
              disabled={offsetPageIndex + 1 >= (pageCount ?? 1)}
              onClick={() => pagination.mode === 'offset' ? pagination.onPageChange(offsetPageIndex + 1, pageSize) : setClientPageIndex((current) => current + 1)}
            ><ChevronRight aria-hidden="true" size={15} /></button>
          </span>
        </nav>
      ))}
    </section>
  );
}
