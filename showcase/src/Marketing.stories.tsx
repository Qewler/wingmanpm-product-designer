import type { Meta, StoryObj } from '@storybook/react-vite';
import { CompareFrame } from './components/Shared';
import { MarketingAfter, MarketingBefore } from './components/MarketingHero';

const meta = { title: 'Proof/SaaS Marketing', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Before: Story = { render: () => <MarketingBefore /> };
export const After: Story = { render: () => <MarketingAfter /> };
export const Comparison: Story = {
  render: () => <CompareFrame title="SaaS marketing first view" before={<MarketingBefore />} after={<MarketingAfter />} />,
};
