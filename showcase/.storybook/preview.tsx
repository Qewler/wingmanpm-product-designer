import type { Preview } from '@storybook/react-vite';
import React from 'react';
import '../src/showcase.css';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Showcase theme',
      defaultValue: 'light',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => (
      <div className="showcase-root" data-theme={context.globals.theme ?? 'light'}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
    a11y: { test: 'error' },
    options: { storySort: { order: ['README', 'Proof', 'Maker Spotlight'] } },
  },
};

export default preview;
