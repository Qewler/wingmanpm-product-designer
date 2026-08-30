import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const viewports = [390, 768, 1280, 1440];
const focusedStories = [
  'responsive-shell',
  'long-content',
  'loading-empty-error-permission',
  'reduced-motion',
  'ai-progress-sources-uncertainty-approval',
  'billing-and-role-permission',
  'operational-coverage'
];
const skipScreenshots = process.env.WINGMAN_SKIP_SCREENSHOTS === '1';

async function storyIds(page: Page) {
  const response = await page.request.get('/index.json');
  expect(response.ok()).toBe(true);
  const index = await response.json() as { entries?: Record<string, { id?: string; type?: string }> };
  return Object.values(index.entries ?? {})
    .filter((entry) => entry.type === 'story' && typeof entry.id === 'string')
    .map((entry) => entry.id as string)
    .sort();
}

async function openStory(page: Page, story: string, theme: 'light' | 'dark') {
  await page.goto(`/iframe.html?id=${encodeURIComponent(story)}&viewMode=story&globals=theme:${theme}`);
  await expect(page.locator('#storybook-root')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
}

async function auditVisibleStructure(page: Page) {
  return page.evaluate(() => {
    const normalize = (value: string | null | undefined) => (value ?? '')
      .normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
    const visible = (element: Element) => {
      if (element.closest('[hidden],[aria-hidden="true"],[inert]')) return false;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const explicit = Array.from(document.querySelectorAll('[data-wingman-surface-root]')).filter(visible);
    const fallback = document.querySelector('#storybook-root');
    const candidates = explicit.length ? explicit : fallback && visible(fallback) ? [fallback] : [];
    const roots = candidates.filter((candidate) => !candidates.some((other) => other !== candidate && other.contains(candidate)));
    const violations: string[] = [];

    for (const root of roots) {
      const headings = new Set<string>();
      for (const heading of Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6')).filter(visible)) {
        if (heading.closest('[data-wingman-surface-root],#storybook-root') !== root) continue;
        const text = normalize(heading.textContent);
        if (!text) continue;
        const key = `${heading.tagName.toLowerCase()}:${text}`;
        if (headings.has(key)) violations.push(`duplicate heading ${key}`);
        headings.add(key);
      }

      const markedShells = [
        ...(root.matches('.wpd-shell,[data-wingman-shell]') ? [root] : []),
        ...Array.from(root.querySelectorAll('.wpd-shell,[data-wingman-shell]'))
      ].filter(visible);
      const shells = markedShells.length ? markedShells : [root];
      for (const shell of shells) {
        const marked = shell.matches('.wpd-shell,[data-wingman-shell]');
        const landmarks = Array.from(shell.querySelectorAll('header,footer,[role="banner"],[role="contentinfo"]'))
          .filter(visible)
          .filter((landmark) => !marked || landmark.closest('.wpd-shell,[data-wingman-shell]') === shell)
          .filter((landmark) => {
            const container = landmark.parentElement?.closest('main,article,section,aside,dialog,[role="dialog"]');
            return !container || !shell.contains(container);
          });
        const banners = new Set(landmarks.filter((item) => item.tagName === 'HEADER' || item.getAttribute('role') === 'banner'));
        const footers = new Set(landmarks.filter((item) => item.tagName === 'FOOTER' || item.getAttribute('role') === 'contentinfo'));
        if (banners.size > 1) violations.push(`shell has ${banners.size} top-level banners`);
        if (footers.size > 1) violations.push(`shell has ${footers.size} top-level contentinfo landmarks`);
      }

      for (const dialog of Array.from(root.querySelectorAll('dialog,[role="dialog"]')).filter(visible)) {
        const controls = Array.from(dialog.querySelectorAll('button,[role="button"],[data-slot="dialog-close"],[data-dialog-close],[data-radix-dialog-close]'))
          .filter(visible)
          .filter((control) => control.closest('dialog,[role="dialog"]') === dialog)
          .filter((control) => {
            const action = normalize(`${control.getAttribute('data-action')} ${control.getAttribute('aria-label')}`);
            if (/filter|chip|clear|cancel|reject/.test(action)) return false;
            if (control.matches('[data-slot="dialog-close"],[data-dialog-close],[data-radix-dialog-close]')) return true;
            const name = normalize(control.getAttribute('aria-label') || control.getAttribute('title') || control.textContent);
            if (!/^(close|dismiss)\b/.test(name)) return false;
            const icon = control.querySelector('svg[data-lucide="x"],.lucide-x,[data-icon="x"],[data-testid*="close" i]');
            const walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
            const parts: string[] = [];
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
              const parent = node.parentElement;
              if (!parent || !visible(parent)) continue;
              const style = getComputedStyle(parent);
              if (style.clipPath === 'inset(50%)' || style.clip !== 'auto') continue;
              parts.push(node.textContent ?? '');
            }
            const visibleText = normalize(parts.join(' ')).replace(String.fromCodePoint(0xd7), '').replace(/^x$/, '');
            return Boolean(icon && !visibleText);
          });
        if (new Set(controls).size > 1) violations.push(`dialog has ${controls.length} icon-only close controls`);
      }
    }
    return violations;
  });
}

async function exerciseCustomComboboxes(page: Page) {
  const failures: string[] = [];
  const controls = page.locator('[role="combobox"]:visible:not(select):not([aria-disabled="true"])');
  for (let index = 0; index < await controls.count(); index += 1) {
    const control = controls.nth(index);
    const target = await control.getAttribute('aria-controls') ?? await control.getAttribute('aria-owns');
    if (!target) {
      failures.push('custom combobox lacks aria-controls or aria-owns');
      continue;
    }
    if (await control.getAttribute('aria-expanded') !== 'true') await control.click();
    const listbox = page.locator(`[id=${JSON.stringify(target)}]`);
    await expect(listbox).toBeVisible();
    const options = listbox.locator('[role="option"]:visible:not([aria-disabled="true"])');
    const optionCount = await options.count();
    if (optionCount > 0) {
      const auditState = async (state: string) => {
        const contrast = await auditDropdownContrast(page);
        failures.push(...contrast.failures.map((failure) => `${state}: ${failure}`));
        if (contrast.candidateCount === 0) failures.push(`${state}: custom combobox ${target} produced no contrast candidates`);
      };
      await auditState('default or selected');
      await options.first().hover();
      await auditState('hover');
      await control.press('ArrowDown');
      const activeId = await control.getAttribute('aria-activedescendant');
      if (activeId && !await page.locator(`[id=${JSON.stringify(activeId)}]`).isVisible()) {
        failures.push(`custom combobox ${target} has no visible keyboard-active option`);
      }
      await auditState('keyboard-active');
    } else {
      failures.push(`custom combobox ${target} produced no enabled options`);
    }
    await control.press('Escape');
    if (await control.getAttribute('aria-expanded') === 'true' || await listbox.isVisible()) {
      failures.push(`custom combobox ${target} did not close with Escape`);
    }
  }
  return failures;
}

async function auditDropdownContrast(page: Page) {
  return page.evaluate(() => {
    type Color = [number, number, number, number];
    const visible = (element: Element) => {
      if (element.closest('[hidden],[aria-hidden="true"],[inert]')) return false;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const color = (value: string): Color | null => {
      const match = value.match(/^rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] === undefined ? 1 : Number(match[4])] : null;
    };
    const blend = (front: Color, back: Color): Color => {
      const alpha = front[3] + back[3] * (1 - front[3]);
      if (alpha === 0) return [0, 0, 0, 0];
      return [
        (front[0] * front[3] + back[0] * back[3] * (1 - front[3])) / alpha,
        (front[1] * front[3] + back[1] * back[3] * (1 - front[3])) / alpha,
        (front[2] * front[3] + back[2] * back[3] * (1 - front[3])) / alpha,
        alpha
      ];
    };
    const background = (element: Element): Color | null => {
      let result: Color = [0, 0, 0, 0];
      for (let current: Element | null = element; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (style.backgroundImage !== 'none') return null;
        const layer = color(style.backgroundColor);
        if (!layer) return null;
        result = blend(result, layer);
        if (result[3] >= 0.999) return result;
      }
      return null;
    };
    const luminance = ([red, green, blue]: Color) => {
      const channel = (value: number) => {
        const normalized = value / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
    };
    const ratio = (first: Color, second: Color) => {
      const [bright, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
      return (bright + 0.05) / (dark + 0.05);
    };
    const failures: string[] = [];
    const candidates: Array<{ element: Element; label: string }> = [];
    const native = Array.from(document.querySelectorAll('select:not(:disabled)')).filter(visible);
    const custom = Array.from(document.querySelectorAll('[role="combobox"]:not([aria-disabled="true"])')).filter(visible);
    for (const select of native) {
      candidates.push({ element: select, label: 'native select current value' });
      for (const option of Array.from(select.querySelectorAll('option:not(:disabled)'))) {
        candidates.push({ element: option, label: `native option ${option.textContent?.trim() ?? ''}` });
      }
    }
    for (const combobox of custom) candidates.push({ element: combobox, label: 'custom combobox current value' });
    for (const option of Array.from(document.querySelectorAll('[role="option"]:not([aria-disabled="true"])')).filter(visible)) {
      candidates.push({ element: option, label: `custom option ${option.textContent?.trim() ?? ''}` });
    }
    for (const candidate of candidates) {
      const fallback = candidate.element instanceof HTMLOptionElement ? candidate.element.closest('select') : null;
      const style = getComputedStyle(candidate.element);
      const text = color(style.color) ?? (fallback ? color(getComputedStyle(fallback).color) : null);
      const back = background(candidate.element) ?? (fallback ? background(fallback) : null);
      if (!text || !back || back[3] < 0.999) {
        failures.push(`${candidate.label} has an unresolved or gradient color`);
        continue;
      }
      const effectiveText = text[3] < 1 ? blend(text, back) : text;
      const contrast = ratio(effectiveText, back);
      if (contrast < 4.5) failures.push(`${candidate.label} contrast is ${contrast.toFixed(2)}:1`);
    }
    return { dropdownCount: new Set([...native, ...custom]).size, candidateCount: candidates.length, failures };
  });
}

for (const width of viewports) {
  test(`WingmanPM contract at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/iframe.html?id=wingmanpm-product-contract--responsive-shell&viewMode=story');
    await expect(page.locator('#storybook-root')).toBeVisible();
    expect(await page.evaluate(() => document.body.scrollWidth <= window.innerWidth)).toBe(true);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
    if (!skipScreenshots) await expect(page).toHaveScreenshot(`responsive-shell-${width}.png`);
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

for (const story of focusedStories) {
  for (const theme of ['light', 'dark'] as const) {
    test(`axe contract: ${story} · ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await openStory(page, `wingmanpm-product-contract--${story}`, theme);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
    });
  }
}

test('WPD022 and WPD023 audit every Storybook story in light and dark', async ({ page }) => {
  test.setTimeout(600_000);
  const stories = await storyIds(page);
  expect(stories.length).toBeGreaterThan(0);
  for (const story of stories) {
    for (const theme of ['light', 'dark'] as const) {
      await openStory(page, story, theme);
      const structureViolations = await auditVisibleStructure(page);
      expect(structureViolations, `${story} ${theme}`).toEqual([]);
      const behaviorFailures = await exerciseCustomComboboxes(page);
      expect(behaviorFailures, `${story} ${theme}`).toEqual([]);
      const contrast = await auditDropdownContrast(page);
      expect(contrast.failures, `${story} ${theme}`).toEqual([]);
      if (contrast.dropdownCount > 0) expect(contrast.candidateCount, `${story} ${theme}`).toBeGreaterThan(0);
    }
  }
});
