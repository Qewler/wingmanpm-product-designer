import { Bell, Check, FileText, Search, ShieldCheck, Upload, Zap } from 'lucide-react';
import type { CSSProperties } from 'react';

const auditEvents = [
  { id: 'a1', actor: 'Sample: Imani Okafor', action: 'Changed maintenance access', time: '09:42' },
  { id: 'a2', actor: 'Sample: Elena Rossi', action: 'Approved forecast adjustment', time: 'Yesterday' }
];

export function OperationalPatterns() {
  return (
    <section className="wpd-pattern-catalog" aria-labelledby="patterns-heading">
      <header className="wpd-page-heading">
        <div>
          <p className="wpd-eyebrow">Tamarack FieldOps · Concept demo · Sample data</p>
          <h1 id="patterns-heading">Renewable operations patterns</h1>
          <p>Search assets, validate thresholds, onboard sites, review activity, and manage inspection files in one visual system.</p>
        </div>
        <button className="wpd-secondary-button" type="button"><Upload aria-hidden="true" size={16} /> Import telemetry</button>
      </header>

      <div className="wpd-pattern-grid">
        <section className="wpd-command-panel" role="dialog" aria-modal={false} aria-labelledby="command-heading">
          <div className="wpd-section-heading"><Search aria-hidden="true" size={18} /><h2 id="command-heading">Command and search</h2><kbd>⌘ K</kbd></div>
          <label className="wpd-search-field">
            <span className="wpd-visually-hidden">Search commands</span>
            <Search aria-hidden="true" size={16} />
            <input type="search" placeholder="Search sites and actions" />
          </label>
          <ul className="wpd-command-results" aria-label="Sample command results">
            <li className="is-active"><button type="button"><span>Open inverter alert queue</span><kbd>↵</kbd></button></li>
            <li><button type="button"><span>Review weather window</span><span>Forecast</span></button></li>
          </ul>
        </section>

        <form className="wpd-settings-form" onSubmit={(event) => event.preventDefault()} aria-labelledby="settings-heading">
          <div className="wpd-section-heading"><ShieldCheck aria-hidden="true" size={18} /><h2 id="settings-heading">Alert settings and validation</h2></div>
          <label>Operations hub<input name="operationsHub" defaultValue="Tamarack FieldOps" /></label>
          <label>Alert threshold<input name="alertThreshold" aria-invalid="true" aria-describedby="threshold-error" defaultValue="101%" /></label>
          <p className="wpd-field-error" id="threshold-error">Enter a percentage from 1 to 100.</p>
          <button className="wpd-primary-button" type="submit">Save settings</button>
        </form>

        <section className="wpd-onboarding" aria-labelledby="onboarding-heading">
          <div className="wpd-section-heading"><Zap aria-hidden="true" size={18} /><h2 id="onboarding-heading">Onboarding</h2><span>2 of 3</span></div>
          <ol>
            <li className="is-complete"><Check aria-hidden="true" size={15} /><span><strong>Connect telemetry source</strong><small>Complete</small></span></li>
            <li className="is-complete"><Check aria-hidden="true" size={15} /><span><strong>Map renewable sites</strong><small>Complete</small></span></li>
            <li><span className="wpd-step-number">3</span><span><strong>Invite the field crew</strong><small>Recommended next step</small></span></li>
          </ol>
        </section>

        <section className="wpd-escalation" aria-labelledby="escalation-heading">
          <p className="wpd-eyebrow">Output risk detected</p>
          <h2 id="escalation-heading">Protect today's generation</h2>
          <p>Three assets exceed their safe vibration threshold. Existing schedules stay available.</p>
          <div><span><strong>3 assets</strong> · Concept demo</span><button className="wpd-primary-button" type="button">Review response plan</button></div>
        </section>

        <section className="wpd-activity" aria-labelledby="notifications-heading">
          <div className="wpd-section-heading"><Bell aria-hidden="true" size={18} /><h2 id="notifications-heading">Notifications</h2><button type="button">Mark all read</button></div>
          <ul>
            <li><span className="wpd-unread-dot" aria-hidden="true" /><div><strong><span className="wpd-visually-hidden">Unread: </span>Forecast update is ready to review</strong><small>Tamarack FieldOps · 4 minutes ago</small></div></li>
            <li><span /><div><strong>Maintenance access changed</strong><small>Sample: Imani Okafor · Yesterday</small></div></li>
          </ul>
        </section>

        <section className="wpd-files" aria-labelledby="files-heading">
          <div className="wpd-section-heading"><FileText aria-hidden="true" size={18} /><h2 id="files-heading">Files</h2><button type="button">Add file</button></div>
          <ul>
            <li><FileText aria-hidden="true" size={18} /><span><strong>Sample site-inspection.pdf</strong><small>2.4 MB · Indexed</small></span><button type="button">Open</button></li>
            <li><FileText aria-hidden="true" size={18} /><span><strong>Sample sensor-readings.csv</strong><small>840 KB · Processing 62%</small></span><progress max="100" value="62">62%</progress></li>
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
          <figcaption><span><strong id="chart-heading">Recovered energy output</strong><small>Last 6 weeks · Sample data</small></span><strong>+18%</strong></figcaption>
          <div className="wpd-bars" role="img" aria-label="Recovered output increased from 42 to 76 megawatt-hours over six weeks">
            {[42, 48, 51, 58, 69, 76].map((value, index) => <span key={value} style={{ '--wpd-bar': `${value}%` } as CSSProperties}><i /><small>W{index + 1}</small></span>)}
          </div>
        </figure>
      </div>
    </section>
  );
}
