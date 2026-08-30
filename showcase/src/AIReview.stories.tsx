import type { Meta, StoryObj } from '@storybook/react-vite';
import { CompareFrame } from './components/Shared';
import { AIReviewAfter, AIReviewBefore } from './components/TransparentAIReview';

const meta = { title: 'Proof/Transparent AI Review', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Before: Story = { render: () => <AIReviewBefore /> };
export const After: Story = { render: () => <AIReviewAfter /> };
export const Comparison: Story = {
  render: () => <CompareFrame title="Transparent AI review" before={<AIReviewBefore />} after={<AIReviewAfter />} />,
};
