import type { ReactNode } from 'react';
import { Bell, Command, Menu, Search } from 'lucide-react';

export type NavigationItem = {
  id: string;
  label: string;
  href: string;
  active?: boolean;
};

type AppShellProps = {
  children: ReactNode;
  navigation: NavigationItem[];
  workspaceName: string;
  onOpenCommand?: () => void;
  onOpenMobileNavigation?: () => void;
};

export function AppShell({
  children,
  navigation,
  workspaceName,
  onOpenCommand,
  onOpenMobileNavigation
}: AppShellProps) {
  return (
    <div className="wpd-shell" data-surface-mode="operate">
      <a className="wpd-skip-link" href="#wpd-main">Skip to content</a>
      <aside className="wpd-sidebar" aria-label="Primary navigation">
        <a className="wpd-wordmark" href="/">{workspaceName}</a>
        <nav>
          <ul className="wpd-nav-list">
            {navigation.map((item) => (
              <li key={item.id}>
                <a aria-current={item.active ? 'page' : undefined} className="wpd-nav-item" href={item.href}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="wpd-workspace">
        <header className="wpd-topbar">
          <button className="wpd-icon-button wpd-mobile-only" type="button" onClick={onOpenMobileNavigation} aria-label="Open navigation">
            <Menu aria-hidden="true" size={18} />
          </button>
          <button className="wpd-command-trigger" type="button" onClick={onOpenCommand}>
            <Search aria-hidden="true" size={16} />
            <span>Search workspace</span>
            <span className="wpd-key-hint"><Command aria-hidden="true" size={13} /> K</span>
          </button>
          <button className="wpd-icon-button" type="button" aria-label="Open notifications">
            <Bell aria-hidden="true" size={18} />
          </button>
        </header>
        <main id="wpd-main" className="wpd-main" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
