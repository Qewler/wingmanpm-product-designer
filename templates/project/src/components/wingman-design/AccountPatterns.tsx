import { CreditCard, LockKeyhole, Users } from 'lucide-react';

type AccountPatternsProps = {
  role: 'owner' | 'admin' | 'member' | 'guest';
  billingState: 'trial' | 'active' | 'past-due' | 'canceled';
  memberCount: number;
  seatLimit: number;
};

export function AccountPatterns({ role, billingState, memberCount, seatLimit }: AccountPatternsProps) {
  const canManage = role === 'owner' || role === 'admin';
  return (
    <section className="wpd-settings" aria-labelledby="account-heading">
      <div className="wpd-page-heading">
        <div><p className="wpd-eyebrow">Workspace administration</p><h1 id="account-heading">Account</h1></div>
      </div>
      <div className="wpd-settings-section">
        <div><Users aria-hidden="true" size={20} /><h2>Team</h2><p>{memberCount} of {seatLimit} seats are in use.</p></div>
        <button className="wpd-secondary-button" type="button" disabled={!canManage}>{canManage ? 'Manage team' : 'Admin access required'}</button>
      </div>
      <div className="wpd-settings-section">
        <div><CreditCard aria-hidden="true" size={20} /><h2>Billing</h2><p>Plan status: {billingState.replace('-', ' ')}.</p></div>
        <button className="wpd-secondary-button" type="button" disabled={!canManage}>{canManage ? 'Open billing' : 'Owner access required'}</button>
      </div>
      {!canManage && <p className="wpd-permission-note"><LockKeyhole aria-hidden="true" size={16} /> You can view these settings. Ask an owner to make changes.</p>}
    </section>
  );
}
