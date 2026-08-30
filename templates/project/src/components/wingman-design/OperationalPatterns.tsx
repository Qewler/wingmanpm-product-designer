import { Bell, Check, FileText, Search, ShieldCheck, Upload, Zap } from 'lucide-react';
import type { CSSProperties } from 'react';

const auditEvents = [
  { id: 'a1', actor: 'Sample: Maya Chen', action: 'Changed workspace role', time: '09:42' },
  { id: 'a2', actor: 'Sample: Alex Nowak', action: 'Approved AI draft', time: 'Yesterday' }
];

export function OperationalPatterns() {
  return (
    <section className="wpd-pattern-catalog" aria-labelledby="patterns-heading">
      <header className="wpd-page-heading">
        <div>
          <p className="wpd-eyebrow">Operational coverage · Sample data</p>
          <h1 id="patterns-heading">Core product patterns</h1>
          <p>Search, configure, onboard, review activity, and manage files without changing visual vocabulary.</p>
        </div>
        <button className="wpd-secondary-button" type="button"><Upload aria-hidden="true" size={16} /> Import file</button>
      </header>

      <div className="wpd-pattern-grid">
        <section className="wpd-command-panel" role="dialog" aria-modal={false} aria-labelledby="command-heading">
          <div className="wpd-section-heading"><Search aria-hidden="true" size={18} /><h2 id="command-heading">Command and search</h2><kbd>⌘ K</kbd></div>
          <label className="wpd-search-field">
            <span className="wpd-visually-hidden">Search commands</span>
            <Search aria-hidden="true" size={16} />
            <input type="search" placeholder="Search pages and actions" />
          </label>
          <ul className="wpd-command-results" aria-label="Sample command results">
            <li className="is-active"><button type="button"><span>Open feedback inbox</span><kbd>↵</kbd></button></li>
            <li><button type="button"><span>Invite team member</span><span>Team</span></button></li>
          </ul>
        </section>

        <form className="wpd-settings-form" onSubmit={(event) => event.preventDefault()} aria-labelledby="settings-heading">
          <div className="wpd-section-heading"><ShieldCheck aria-hidden="true" size={18} /><h2 id="settings-heading">Settings and validation</h2></div>
          <label>Workspace name<input name="workspaceName" defaultValue="Sample Workspace" /></label>
          <label>Reply domain<input name="replyDomain" aria-invalid="true" aria-describedby="domain-error" defaultValue="sample" /></label>
          <p className="wpd-field-error" id="domain-error">Enter a full domain, for example sample.com.</p>
          <button className="wpd-primary-button" type="submit">Save settings</button>
        </form>

        <section className="wpd-onboarding" aria-labelledby="onboarding-heading">
          <div className="wpd-section-heading"><Zap aria-hidden="true" size={18} /><h2 id="onboarding-heading">Onboarding</h2><span>2 of 3</span></div>
          <ol>
            <li className="is-complete"><Check aria-hidden="true" size={15} /><span><strong>Create workspace</strong><small>Complete</small></span></li>
            <li className="is-complete"><Check aria-hidden="true" size={15} /><span><strong>Connect a source</strong><small>Complete</small></span></li>
            <li><span className="wpd-step-number">3</span><span><strong>Invite the team</strong><small>Recommended next step</small></span></li>
          </ol>
        </section>

        <section className="wpd-paywall" aria-labelledby="paywall-heading">
          <p className="wpd-eyebrow">Plan limit reached</p>
          <h2 id="paywall-heading">Keep the workflow moving</h2>
          <p>Two more seats are needed. Existing work stays available.</p>
          <div><span><strong>$24</strong> / month · Sample price</span><button className="wpd-primary-button" type="button">Review upgrade</button></div>
        </section>

        <section className="wpd-activity" aria-labelledby="notifications-heading">
          <div className="wpd-section-heading"><Bell aria-hidden="true" size={18} /><h2 id="notifications-heading">Notifications</h2><button type="button">Mark all read</button></div>
          <ul>
            <li><span className="wpd-unread-dot" aria-hidden="true" /><div><strong><span className="wpd-visually-hidden">Unread: </span>Import is ready to review</strong><small>Sample Workspace · 4 minutes ago</small></div></li>
            <li><span /><div><strong>Billing role changed</strong><small>Sample: Maya Chen · Yesterday</small></div></li>
          </ul>
        </section>

        <section className="wpd-files" aria-labelledby="files-heading">
          <div className="wpd-section-heading"><FileText aria-hidden="true" size={18} /><h2 id="files-heading">Files</h2><button type="button">Add file</button></div>
          <ul>
            <li><FileText aria-hidden="true" size={18} /><span><strong>Sample research notes.pdf</strong><small>2.4 MB · Indexed</small></span><button type="button">Open</button></li>
            <li><FileText aria-hidden="true" size={18} /><span><strong>Sample feedback.csv</strong><small>840 KB · Processing 62%</small></span><progress max="100" value="62">62%</progress></li>
          </ul>
        </section>
      </div>

      <div className="wpd-evidence-grid">
        <section className="wpd-audit" aria-labelledby="audit-heading">
          <div className="wpd-section-heading"><ShieldCheck aria-hidden="true" size={18} /><h2 id="audit-heading">Audit log</h2><button type="button">Export</button></div>
          <div className="wpd-table-region" tabIndex={0}>
            <table><thead><tr><th scope="col">Actor</th><th scope="col">Action</th><th scope="col">Time</th></tr></thead><tbody>{auditEvents.map((event) => <tr key={event.id}><th scope="row">{event.actor}</th><td>{event.action}</td><td>{event.time}</td></tr>)}</tbody></table>
          </div>
        </section>

        <figure className="wpd-chart" aria-labelledby="chart-heading">
          <figcaption><span><strong id="chart-heading">Resolved feedback</strong><small>Last 6 weeks · Sample data</small></span><strong>+18%</strong></figcaption>
          <div className="wpd-bars" role="img" aria-label="Resolved feedback increased from 42 to 76 items over six weeks">
            {[42, 48, 51, 58, 69, 76].map((value, index) => <span key={value} style={{ '--wpd-bar': `${value}%` } as CSSProperties}><i /><small>W{index + 1}</small></span>)}
          </div>
        </figure>
      </div>
    </section>
  );
}
