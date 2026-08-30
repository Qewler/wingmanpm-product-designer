import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/wingman-design',
  outputDir: '.wingmanpm-design/test-results',
  reporter: [['list'], ['./.wingmanpm-design/runtime/browser-reporter.mjs']],
  snapshotPathTemplate: '.wingmanpm-design/baselines/{projectName}/{testFilePath}/{arg}{ext}',
  use: {
    baseURL: 'http://127.0.0.1:6006',
    browserName: 'chromium',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run storybook -- --ci --host 127.0.0.1',
    url: 'http://127.0.0.1:6006',
    reuseExistingServer: true,
    timeout: 120000
  }
});
