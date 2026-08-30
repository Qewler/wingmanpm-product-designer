import type { Meta, StoryObj } from '@storybook/react';
import { AppShell, ProductWorkspace, StatePanel, TransparentAIReview, AccountPatterns, OperationalPatterns } from '../components/wingman-design';
import '../components/wingman-design/system.css';

const navigation = [
  { id: 'home', label: 'Overview', href: '#', active: true },
  { id: 'feedback', label: 'Feedback', href: '#' },
  { id: 'knowledge', label: 'Knowledge', href: '#' },
  { id: 'settings', label: 'Settings', href: '#' }
];

const sampleItems = [
  { id: '1', title: 'Long-content feedback title that wraps safely on compact screens', owner: 'Sample: Maya Chen', status: 'Ready' as const, updated: 'Today, 09:42' },
  { id: '2', title: 'Billing permission clarification', owner: 'Sample: Alex Nowak', status: 'In progress' as const, updated: 'Yesterday' },
  { id: '3', title: 'Offline recovery behavior', owner: 'Sample: Sam Rivera', status: 'Blocked' as const, updated: 'Aug 28' }
];

const meta = {
  title: 'WingmanPM Product/Contract',
  parameters: {
    layout: 'fullscreen',
    backgrounds: { default: 'light', values: [{ name: 'light', value: 'var(--wpd-color-canvas)' }, { name: 'dark', value: 'var(--wpd-color-canvas)' }] },
    a11y: { test: 'error' }
  }
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const ResponsiveShell: Story = {
  name: 'Responsive shell · light and dark',
  render: () => <AppShell navigation={navigation} workspaceName="Sample Workspace"><ProductWorkspace items={sampleItems} sample /></AppShell>
};

export const LongContent: Story = {
  name: 'Long content · responsive data table',
  render: () => <AppShell navigation={navigation} workspaceName="Sample Workspace with a very long localized name"><ProductWorkspace items={sampleItems} sample selectedIds={['1', '3']} stale /></AppShell>
};

export const LoadingEmptyErrorPermission: Story = {
  name: 'Loading, empty, partial, error, permission, offline, success, disabled',
  render: () => <div className="wpd-main"><StatePanel kind="loading" title="Loading work" message="The current task remains available." /><StatePanel kind="empty" title="No items yet" message="Create the first item or change the current filters." /><StatePanel kind="error" title="Items could not load" message="Nothing was changed. Retry when ready." action={<button className="wpd-secondary-button" type="button">Retry</button>} /><StatePanel kind="permission" title="You can view this area" message="Ask an owner to make changes." /><StatePanel kind="offline" title="You are offline" message="Queued changes will resume after reconnection." /><StatePanel kind="success" title="Changes saved" message="The audit log has been updated." /></div>
};

export const ReducedMotion: Story = {
  name: 'Reduced motion · final state remains readable',
  parameters: { reducedMotion: 'reduce' },
  render: () => <div className="wpd-main"><StatePanel kind="loading" title="Checking status" message="No spatial motion is required to understand progress." /></div>
};

export const AIProgressSourcesUncertaintyApproval: Story = {
  name: 'AI · progress, sources, uncertainty, cancel, error, human approval',
  render: () => <div className="wpd-main"><TransparentAIReview status="draft" draft="Sample draft. Review this text before any action." uncertainty="The account tier could not be confirmed from the approved sources." sources={[{ id: '1', label: 'Sample: Product policy', href: '#' }, { id: '2', label: 'Sample: Account history', href: '#' }]} /></div>
};

export const BillingAndRolePermission: Story = {
  name: 'Billing, team, paywall, settings, permission',
  render: () => <div className="wpd-main"><AccountPatterns role="member" billingState="past-due" memberCount={8} seatLimit={10} /></div>
};

export const OperationalCoverage: Story = {
  name: 'Command, forms, onboarding, notifications, files, audit, chart',
  render: () => <div className="wpd-main"><OperationalPatterns /></div>
};
