import type { Preview } from '@storybook/react';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Product theme',
      toolbar: {
        icon: 'paintbrush',
        items: [{ value: 'light', title: 'Light' }, { value: 'dark', title: 'Dark' }]
      }
    }
  },
  initialGlobals: { theme: 'light' },
  parameters: {
    controls: { expanded: true },
    options: { storySort: { order: ['WingmanPM Product'] } }
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme === 'dark' ? 'dark' : 'light';
      document.documentElement.dataset.theme = theme;
      return Story();
    }
  ]
};

export default preview;
