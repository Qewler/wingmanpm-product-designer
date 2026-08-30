import type { Meta, StoryObj } from '@storybook/react-vite';
import { MakerSpotlight } from './components/MakerSpotlight';

const meta = {
  title: 'Maker Spotlight/WingmanPM',
  parameters: { layout: 'fullscreen' },
  globals: { theme: 'dark' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const PublicProductStory: Story = {
  name: 'Public product story',
  render: () => <MakerSpotlight />,
};
