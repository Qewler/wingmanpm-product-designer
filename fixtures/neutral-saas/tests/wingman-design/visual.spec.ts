import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const viewports = [390, 768, 1280, 1440];
const stories = [
  'responsive-shell',
  'long-content',
  'loading-empty-error-permission',
  'reduced-motion',
  'ai-progress-sources-uncertainty-approval',
  'billing-and-role-permission',
  'operational-coverage'
];

for (const width of viewports) {
  test(`WingmanPM contract at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/iframe.html?id=wingmanpm-product-contract--responsive-shell&viewMode=story');
    await expect(page.locator('#storybook-root')).toBeVisible();
    expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
    await expect(page).toHaveScreenshot(`responsive-shell-${width}.png`);
  });
}

test('keyboard and reduced motion remain usable', async ({ page }) => {
  await page.goto('/iframe.html?id=wingmanpm-product-contract--responsive-shell&viewMode=story');
  await page.locator('.wpd-skip-link').focus();
  await expect(page.locator('.wpd-skip-link')).toBeFocused();
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    outline: document.activeElement ? getComputedStyle(document.activeElement).outlineStyle : 'none'
  }));
  expect(focus.tag).not.toBe('BODY');
  expect(focus.outline).not.toBe('none');
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.goto('/iframe.html?id=wingmanpm-product-contract--reduced-motion&viewMode=story&globals=theme:dark');
  await expect(page.locator('.wpd-spin')).toHaveCSS('animation-name', 'none');
});

for (const story of stories) {
  for (const theme of ['light', 'dark']) {
    test(`axe contract: ${story} · ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/iframe.html?id=wingmanpm-product-contract--${story}&viewMode=story&globals=theme:${theme}`);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
    });
  }
}
