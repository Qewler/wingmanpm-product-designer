import type { ReactNode } from 'react';

export type WingmanTableProfile = 'static' | 'work' | 'editable';
export type WingmanTableDensity = 'dense' | 'comfortable';
export type WingmanTableSemantics = 'table' | 'grid';
export type WingmanPaginationMode = 'client' | 'offset' | 'cursor';

export interface WingmanColumnContract {
  id: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'status' | 'actions' | 'selection';
  align: 'start' | 'center' | 'end';
  minWidth: number;
  defaultWidth: number;
  maxWidth: number;
  priority: 1 | 2 | 3 | 4 | 5;
  required: boolean;
  hideable: boolean;
  sortable: boolean;
  filterable: boolean;
  resizable: boolean;
  reorderable: boolean;
  fullValue: 'wrap' | 'focus-tooltip' | 'row-details';
  editor?: 'text' | 'number' | 'select' | 'date';
}

export interface WingmanTableContract {
  id: string;
  version: number;
  profile: WingmanTableProfile;
  semantics: WingmanTableSemantics;
  rowIdField: string;
  pagination: WingmanPaginationMode;
  columns: WingmanColumnContract[];
  capabilities: {
    visibility: boolean;
    reorder: boolean;
    resize: boolean;
    expansion: boolean;
    selection: boolean;
    bulkActions: boolean;
    inlineEditing: boolean;
    virtualization: boolean;
  };
  evidence: {
    stories: string[];
    browserTests: string[];
    visualReview: string;
  };
}
export type WingmanTableState =
  | 'ready'
  | 'loading'
  | 'empty'
  | 'no-results'
  | 'partial'
  | 'stale'
  | 'error'
  | 'permission'
  | 'offline'
  | 'saving'
  | 'success';

export type WingmanCellEditor = {
  type: 'text' | 'number' | 'select' | 'date';
  options?: Array<{ label: string; value: string }>;
  validate?: (value: unknown) => string | null;
};

export type WingmanDataTableColumn<T extends Record<string, unknown>> = {
  id: string;
  label: string;
  description?: string;
  accessor: keyof T & string | ((row: T) => unknown);
  align?: 'start' | 'center' | 'end';
  minWidth?: number;
  defaultWidth?: number;
  maxWidth?: number;
  priority?: 1 | 2 | 3 | 4 | 5;
  required?: boolean;
  hideable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  resizable?: boolean;
  reorderable?: boolean;
  fullValue?: 'wrap' | 'focus-tooltip' | 'row-details';
  editor?: WingmanCellEditor;
  render?: (value: unknown, row: T) => ReactNode;
};

export type TablePreferences = {
  schemaVersion: number;
  density: WingmanTableDensity;
  columnOrder: string[];
  columnVisibility: Record<string, boolean>;
  columnWidths: Record<string, number>;
};

export interface TablePreferencesAdapter {
  load(tableId: string, schemaVersion: number): Promise<TablePreferences | null>;
  save(tableId: string, schemaVersion: number, value: TablePreferences): Promise<void>;
  reset(tableId: string): Promise<void>;
}

export type ClientPagination = {
  mode: 'client';
  initialPageSize?: number;
  pageSizeOptions?: number[];
};

export type OffsetPagination = {
  mode: 'offset';
  pageIndex: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (pageIndex: number, pageSize: number) => void;
  pageSizeOptions?: number[];
  serverQuery?: WingmanServerQuery;
};

export type CursorPagination = {
  mode: 'cursor';
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  onPrevious: () => void;
  onNext: () => void;
  serverQuery?: WingmanServerQuery;
};

export type WingmanPagination = ClientPagination | OffsetPagination | CursorPagination;

export type WingmanBulkAction = {
  id: string;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
};

export type WingmanTableFilters = Record<string, string[]>;

export type WingmanTableFilterDefinition = {
  id: string;
  label: string;
  columnId: string;
  options: Array<{ label: string; value: string }>;
};

export type WingmanSelectionScope =
  | { type: 'rows'; rowIds: string[] }
  | {
      type: 'all-filtered';
      query: string;
      sort: WingmanServerSort;
      filters: WingmanTableFilters;
      total: number;
      excludedRowIds: string[];
    };

export type WingmanBulkResult = {
  failed?: number;
  message?: string;
  undo?: () => Promise<void> | void;
};

export type WingmanEditResult = {
  status?: 'saved' | 'conflict';
  message?: string;
  undo?: () => Promise<void> | void;
};

export type WingmanServerSort = { id: string; direction: 'asc' | 'desc' } | null;

export type WingmanServerQuery = {
  query: string;
  sort: WingmanServerSort;
  filters: WingmanTableFilters;
  onQueryChange: (query: string) => void;
  onSortChange: (sort: WingmanServerSort) => void;
  onFiltersChange: (filters: WingmanTableFilters) => void;
};

export type WingmanDataTableBaseProps<T extends Record<string, unknown>> = {
  tableId: string;
  profile: 'work' | 'editable';
  caption: string;
  data: T[];
  columns: Array<WingmanDataTableColumn<T>>;
  getRowId: (row: T) => string;
  state?: WingmanTableState;
  initialDensity?: WingmanTableDensity;
  pagination?: WingmanPagination;
  filterDefinitions?: WingmanTableFilterDefinition[];
  filters?: WingmanTableFilters;
  onFiltersChange?: (filters: WingmanTableFilters) => void;
  preferencesAdapter?: TablePreferencesAdapter;
  preferencesSchemaVersion?: number;
  bulkActions: [WingmanBulkAction, ...WingmanBulkAction[]];
  onBulkAction: (
    actionId: string,
    selection: WingmanSelectionScope
  ) => Promise<WingmanBulkResult | void> | WingmanBulkResult | void;
  renderExpanded: (row: T) => ReactNode;
  onCommitEdit?: (input: {
    row: T;
    rowId: string;
    columnId: string;
    value: unknown;
    previousValue: unknown;
  }) => Promise<WingmanEditResult | void> | WingmanEditResult | void;
  onRetry?: () => void;
  searchLabel?: string;
  emptyTitle?: string;
  emptyMessage?: string;
  noResultsMessage?: string;
};

export type WingmanWorkTableProps<T extends Record<string, unknown>> = Omit<
  WingmanDataTableBaseProps<T>,
  'profile' | 'onCommitEdit'
> & {
  profile: 'work';
  onCommitEdit?: never;
};

export type WingmanEditableTableProps<T extends Record<string, unknown>> = Omit<
  WingmanDataTableBaseProps<T>,
  'profile' | 'onCommitEdit'
> & {
  profile: 'editable';
  onCommitEdit: NonNullable<WingmanDataTableBaseProps<T>['onCommitEdit']>;
};

export type WingmanDataTableProps<T extends Record<string, unknown>> =
  | WingmanWorkTableProps<T>
  | WingmanEditableTableProps<T>;
