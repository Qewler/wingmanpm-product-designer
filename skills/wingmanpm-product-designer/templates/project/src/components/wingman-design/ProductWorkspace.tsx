import { ArrowUpRight, Filter, MoreHorizontal, Search } from 'lucide-react';

export type WorkItem = {
  id: string;
  title: string;
  owner: string;
  status: 'Ready' | 'In progress' | 'Blocked';
  updated: string;
};

type ProductWorkspaceProps = {
  items: WorkItem[];
  selectedIds?: string[];
  sample?: boolean;
  stale?: boolean;
  offline?: boolean;
};

export function ProductWorkspace({ items, selectedIds = [], sample = false, stale = false, offline = false }: ProductWorkspaceProps) {
  return (
    <section aria-labelledby="workspace-heading">
      <div className="wpd-page-heading">
        <div>
          <p className="wpd-eyebrow">Tamarack Renewables {sample ? '· Concept demo · Sample data' : ''}</p>
          <h1 id="workspace-heading">Tamarack FieldOps</h1>
          <p>Review asset signals, schedule field work, and keep the next action visible.</p>
        </div>
        <button className="wpd-primary-button" type="button">Create work order</button>
      </div>

      {(offline || stale) && (
        <div className="wpd-status-banner" role="status">
          <strong>{offline ? 'You are offline.' : 'Data may be stale.'}</strong>
          <span>{offline ? 'Changes will wait for a connection.' : 'Refreshing in the background.'}</span>
        </div>
      )}

      <div className="wpd-toolbar" aria-label="Table controls">
        <label className="wpd-search-field">
          <span className="wpd-visually-hidden">Search assets and work orders</span>
          <Search aria-hidden="true" size={16} />
          <input type="search" placeholder="Search assets and work orders" />
        </label>
        <button className="wpd-secondary-button" type="button"><Filter aria-hidden="true" size={16} /> Filter</button>
        <span className="wpd-toolbar-count" aria-live="polite">{items.length} items</span>
      </div>

      {selectedIds.length > 0 && (
        <div className="wpd-bulk-bar" role="region" aria-label="Bulk actions">
          <span>{selectedIds.length} selected</span>
          <button type="button">Assign</button>
          <button type="button">Change status</button>
          <button className="wpd-danger-action" type="button">Delete</button>
        </div>
      )}

      <div className="wpd-table-region" tabIndex={0} aria-label="Scrollable work items table">
        <table>
          <caption className="wpd-visually-hidden">Renewable operations work items and their current status</caption>
          <thead>
            <tr>
              <th scope="col"><span className="wpd-visually-hidden">Select</span></th>
              <th scope="col">Item</th>
              <th scope="col">Status</th>
              <th scope="col">Owner</th>
              <th scope="col">Updated</th>
              <th scope="col"><span className="wpd-visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><input type="checkbox" aria-label={`Select ${item.title}`} defaultChecked={selectedIds.includes(item.id)} /></td>
                <th scope="row"><a href={`/items/${item.id}`}>{item.title}<ArrowUpRight aria-hidden="true" size={14} /></a></th>
                <td><span className={`wpd-status wpd-status-${item.status.toLowerCase().replace(' ', '-')}`}>{item.status}</span></td>
                <td>{item.owner}</td>
                <td><time>{item.updated}</time></td>
                <td><button className="wpd-icon-button" type="button" aria-label={`More actions for ${item.title}`}><MoreHorizontal aria-hidden="true" size={17} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
