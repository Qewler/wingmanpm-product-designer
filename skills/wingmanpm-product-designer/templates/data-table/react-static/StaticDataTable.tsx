import type { CSSProperties, ReactNode } from 'react';
import './StaticDataTable.css';

export type WingmanStaticTableState =
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

export type WingmanStaticTableColumn<T extends Record<string, unknown>> = {
  id: string;
  label: string;
  description?: string;
  accessor: keyof T & string | ((row: T) => unknown);
  align?: 'start' | 'center' | 'end';
  width?: number | string;
  render?: (value: unknown, row: T) => ReactNode;
};

export type WingmanStaticTableProps<T extends Record<string, unknown>> = {
  tableId: string;
  profile: 'static';
  caption: string;
  data: T[];
  columns: Array<WingmanStaticTableColumn<T>>;
  getRowId: (row: T) => string;
  state?: WingmanStaticTableState;
  emptyTitle?: string;
  emptyMessage?: string;
  noResultsMessage?: string;
  onRetry?: () => void;
};

const stateCopy: Record<Exclude<WingmanStaticTableState, 'ready'>, { title: string; message: string }> = {
  loading: { title: 'Loading rows', message: 'The table structure remains available.' },
  empty: { title: 'No rows yet', message: 'There is nothing to show in this scope.' },
  'no-results': { title: 'No matching rows', message: 'Change the current filter or search.' },
  partial: { title: 'Some rows are unavailable', message: 'Available results are shown. Retry the missing source.' },
  stale: { title: 'Data may be stale', message: 'The latest available results remain visible while refresh continues.' },
  error: { title: 'Rows could not load', message: 'Nothing was changed. Retry when ready.' },
  permission: { title: 'Limited access', message: 'Only the rows you can access are shown.' },
  offline: { title: 'You are offline', message: 'The last saved results remain visible.' },
  saving: { title: 'Updating report', message: 'The visible values stay available while the update finishes.' },
  success: { title: 'Report updated', message: 'The latest values are now visible.' }
};

function getValue<T extends Record<string, unknown>>(column: WingmanStaticTableColumn<T>, row: T) {
  return typeof column.accessor === 'function' ? column.accessor(row) : row[column.accessor];
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

export function StaticDataTable<T extends Record<string, unknown>>({
  tableId,
  profile,
  caption,
  data,
  columns,
  getRowId,
  state = 'ready',
  emptyTitle = 'No rows yet',
  emptyMessage = 'There is nothing to show in this scope.',
  noResultsMessage = 'Change the current filter or search.',
  onRetry
}: WingmanStaticTableProps<T>) {
  const identityError = validateRowIdentity(data, getRowId);
  if (identityError) {
    return (
      <section className="wpd-static-table" data-state="error" aria-label={caption}>
        <div className="wpd-static-table-config-error" role="alert">
          <strong>Table configuration error</strong>
          <span>{identityError} Every row must have a unique, non-empty ID before this table can be used.</span>
        </div>
      </section>
    );
  }
  const effectiveState = state === 'ready' && data.length === 0 ? 'empty' : state;
  const copy = effectiveState === 'ready'
    ? null
    : effectiveState === 'empty'
      ? { title: emptyTitle, message: emptyMessage }
      : effectiveState === 'no-results'
        ? { ...stateCopy['no-results'], message: noResultsMessage }
        : stateCopy[effectiveState];
  const showRows = !['loading', 'empty', 'no-results', 'error'].includes(effectiveState);
  const showBanner = copy && !['loading', 'empty', 'no-results', 'error'].includes(effectiveState);

  return (
    <section
      className="wpd-static-table"
      data-state={effectiveState}
      aria-label={caption}
      aria-busy={effectiveState === 'loading'}
    >
      {showBanner && (
        <div className={`wpd-static-table-banner is-${effectiveState}`} role="status">
          <span><strong>{copy.title}</strong><small>{copy.message}</small></span>
          {effectiveState === 'partial' && onRetry && <button type="button" onClick={onRetry}>Retry missing rows</button>}
        </div>
      )}

      <div className="wpd-static-table-scroll" tabIndex={0} role="region" aria-label={`Scrollable ${caption}`}>
        <table data-wingman-table-id={tableId} data-wingman-table-profile={profile}>
          <caption className="wpd-static-visually-hidden">{caption}</caption>
          <colgroup>
            {columns.map((column) => (
              <col
                key={column.id}
                style={column.width === undefined ? undefined : ({ width: column.width } as CSSProperties)}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.id} scope="col" data-align={column.align ?? 'start'}>
                  <span className="wpd-static-table-heading">
                    <span>{column.label}</span>
                    {column.description && <small>{column.description}</small>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {effectiveState === 'loading' && Array.from({ length: 5 }, (_, rowIndex) => (
              <tr key={`loading-${rowIndex}`} aria-hidden="true">
                {columns.map((column) => <td key={column.id}><span className="wpd-static-table-skeleton" /></td>)}
              </tr>
            ))}
            {!showRows && effectiveState !== 'loading' && copy && (
              <tr>
                <td colSpan={Math.max(1, columns.length)}>
                  <div className="wpd-static-table-empty" role={effectiveState === 'error' ? 'alert' : 'status'}>
                    <strong>{copy.title}</strong>
                    <span>{copy.message}</span>
                    {effectiveState === 'error' && onRetry && <button type="button" onClick={onRetry}>Retry</button>}
                  </div>
                </td>
              </tr>
            )}
            {showRows && data.map((row) => (
              <tr key={getRowId(row)}>
                {columns.map((column) => {
                  const value = getValue(column, row);
                  return (
                    <td key={column.id} data-align={column.align ?? 'start'}>
                      <span className="wpd-static-table-value">
                        {column.render ? column.render(value, row) : String(value ?? 'Not available')}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
