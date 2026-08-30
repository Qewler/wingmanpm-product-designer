import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, LockKeyhole, WifiOff } from 'lucide-react';

type StateKind = 'loading' | 'empty' | 'partial' | 'error' | 'success' | 'disabled' | 'permission' | 'offline';

type StatePanelProps = {
  kind: StateKind;
  title: string;
  message: string;
  action?: ReactNode;
};

const icons = {
  loading: LoaderCircle,
  empty: AlertCircle,
  partial: AlertCircle,
  error: AlertCircle,
  success: CheckCircle2,
  disabled: LockKeyhole,
  permission: LockKeyhole,
  offline: WifiOff
};

export function StatePanel({ kind, title, message, action }: StatePanelProps) {
  const Icon = icons[kind];
  return (
    <section className="wpd-state-panel" aria-labelledby={`state-${kind}`} aria-live={kind === 'loading' ? 'polite' : undefined}>
      <Icon className={kind === 'loading' ? 'wpd-spin' : undefined} aria-hidden="true" size={22} />
      <div>
        <h2 id={`state-${kind}`}>{title}</h2>
        <p>{message}</p>
      </div>
      {action}
    </section>
  );
}
