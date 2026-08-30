import { Activity, LockKeyhole, RadioTower } from 'lucide-react';

type AccountPatternsProps = {
  role: 'owner' | 'admin' | 'member' | 'guest';
  operationsState: 'nominal' | 'watch' | 'degraded' | 'offline';
  siteCount: number;
  monitoredSiteLimit: number;
};

export function AccountPatterns({ role, operationsState, siteCount, monitoredSiteLimit }: AccountPatternsProps) {
  const canManage = role === 'owner' || role === 'admin';
  return (
    <section className="wpd-settings" aria-labelledby="account-heading">
      <div className="wpd-page-heading">
        <div><p className="wpd-eyebrow">Tamarack FieldOps · Concept demo</p><h1 id="account-heading">Operations access</h1></div>
      </div>
      <div className="wpd-settings-section">
        <div><RadioTower aria-hidden="true" size={20} /><h2>Connected sites</h2><p>{siteCount} of {monitoredSiteLimit} renewable sites are online.</p></div>
        <button className="wpd-secondary-button" type="button" disabled={!canManage}>{canManage ? 'Manage sites' : 'Admin access required'}</button>
      </div>
      <div className="wpd-settings-section">
        <div><Activity aria-hidden="true" size={20} /><h2>Fleet status</h2><p>Current state: {operationsState}.</p></div>
        <button className="wpd-secondary-button" type="button" disabled={!canManage}>{canManage ? 'Open status board' : 'Owner access required'}</button>
      </div>
      {!canManage && <p className="wpd-permission-note"><LockKeyhole aria-hidden="true" size={16} /> You can view these settings. Ask an owner to make changes.</p>}
    </section>
  );
}
