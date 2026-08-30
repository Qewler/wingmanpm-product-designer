import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
  async viteFinal(current) {
    const { mergeConfig } = await import('vite');
    return mergeConfig(current, {
      optimizeDeps: { include: ['react', 'react-dom', 'react/jsx-runtime', 'lucide-react'] }
    });
  }
};

export default config;
