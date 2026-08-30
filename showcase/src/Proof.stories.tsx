import type { Meta, StoryObj } from '@storybook/react-vite';
import { CompareFrame } from './components/Shared';
import { OperationalAfter, OperationalBefore } from './components/OperationalWorkspace';
import { AIReviewAfter, AIReviewBefore } from './components/TransparentAIReview';
import { MarketingAfter, MarketingBefore } from './components/MarketingHero';

const workspaceMeta = {
  title: 'Proof/Operational Workspace',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default workspaceMeta;
type Story = StoryObj<typeof workspaceMeta>;

export const Before: Story = { render: () => <OperationalBefore /> };
export const After: Story = { render: () => <OperationalAfter /> };
export const Comparison: Story = {
  render: () => <CompareFrame title="Operational workspace" before={<OperationalBefore />} after={<OperationalAfter />} />,
};
