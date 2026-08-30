import type { Meta, StoryObj } from '@storybook/react-vite';
import { PluginIcon, PluginLogo, ReadmeHero, ResponsiveProof, SocialPreview } from './components/BrandProof';

const meta = { title: 'README/Brand', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const HeroLight: Story = { render: () => <ReadmeHero mode="light" /> };
export const HeroDark: Story = { render: () => <ReadmeHero mode="dark" />, globals: { theme: 'dark' } };
export const Responsive: Story = { render: () => <ResponsiveProof /> };
export const PluginIconStory: Story = { name: 'Plugin Icon', render: () => <PluginIcon /> };
export const PluginLogoLight: Story = { name: 'Plugin Logo Light', render: () => <PluginLogo mode="light" /> };
export const PluginLogoDark: Story = { name: 'Plugin Logo Dark', render: () => <PluginLogo mode="dark" />, globals: { theme: 'dark' } };
export const SocialPreviewStory: Story = { name: 'Social Preview', render: () => <SocialPreview />, globals: { theme: 'dark' } };
