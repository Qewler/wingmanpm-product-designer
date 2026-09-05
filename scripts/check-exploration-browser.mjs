import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/** Reuses the smoke project's installed test dependencies; no production dependency. */
export async function checkExplorationBrowser(skill, project, artifactDirectory) {
  const { chromium } = await import(pathToFileURL(path.join(project, 'node_modules/playwright/index.mjs')));
  const { default: AxeBuilder } = await import(pathToFileURL(path.join(project, 'node_modules/@axe-core/playwright/dist/index.mjs')));
  const { createExploration, serveExploration, inspectExploration } = await import(pathToFileURL(path.join(skill, 'src/explore.mjs')));
  const sample = (id, columns) => `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${id} Sample review</title><style>*{box-sizing:border-box}body{margin:0;background:#f6f8fc;color:#17232e;font:16px/1.5 system-ui,sans-serif}main{padding:30px;max-width:1100px;margin:auto}h1{font-size:30px;line-height:1.2}section{background:white;border:1px solid #cbd5e1;padding:24px;border-radius:10px;margin:18px 0}.content{display:grid;grid-template-columns:${columns};gap:24px}button{background:#205b9c;color:white;border:0;border-radius:7px;font:inherit;padding:12px 18px}button:focus-visible{outline:3px solid #111;outline-offset:3px}.source{color:#52616d}@media(max-width:600px){main{padding:18px}.content{grid-template-columns:1fr}}</style></head><body><main><p>Sample content</p><h1>${id}</h1><p>Review suggested changes before updating the document.</p><section><div class="content"><div><h2>Original</h2><p>We will get back to you soon.</p><p class="source">Source: support response draft</p></div><div><h2>Suggested edit</h2><p>We will reply within two working days.</p><button type="button" onclick="this.textContent=this.textContent==='Accept draft'?'Undo':'Accept draft'">Accept draft</button></div></div></section><section><h2>Missing source</h2><p>This Sample suggestion needs a source before review.</p></section></main></body></html>`;
  await writeFile(path.join(project, 'speed-preview.html'), sample('Review in place', '1fr'));
  await writeFile(path.join(project, 'compare-preview.html'), sample('Compare changes', '1fr 1fr'));
  await createExploration(project, {
    id: 'browser-proof', target: 'speed-preview.html', question: 'How should people review a proposed change?', identity: 'Keep the blue-and-white product identity and the same type.', content: 'The same Sample suggestion and missing-source state.',
    recommended: 'compare', reason: 'Keep the original visible when reviewing the change.',
    options: [
      { id: 'speed', title: 'Review in place', idea: 'A continuous review queue.', difference: 'Original and change follow the reading order.', tradeoff: 'Faster to scan, with more vertical reading.', preview: 'speed-preview.html', limits: 'Local draft action only.' },
      { id: 'compare', title: 'Compare changes', idea: 'See the source beside the edit.', difference: 'Original and change sit side by side.', tradeoff: 'Clearer comparison, with less room for a long queue.', preview: 'compare-preview.html', limits: 'Local draft action only.' }
    ]
  });
  const { server, url } = await serveExploration(project, 'browser-proof');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1080 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(url);
    await page.getByRole('heading', { name: 'How should people review a proposed change?' }).waitFor();
    assert.equal(await page.locator('iframe').count(), 2);
    await page.frameLocator('iframe').first().getByRole('button', { name: 'Accept draft' }).click();
    assert.equal(await page.frameLocator('iframe').first().getByRole('button', { name: 'Undo' }).count(), 1);
    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1080 });
        await page.getByRole('button', { name: width === 390 ? 'Mobile' : 'Desktop', exact: true }).click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Board overflow at ${width}`);
        assert.equal(await page.locator('#fallback').isVisible(), false);
        for (const [index, title] of ['Review in place', 'Compare changes'].entries()) {
          await page.frameLocator('iframe').nth(index).getByRole('heading', { name: title, exact: true }).waitFor();
          assert.equal(await page.frames()[index + 1].evaluate(() => innerWidth), width === 390 ? 390 : 1280);
        }
        const audit = await new AxeBuilder({ page }).analyze();
        const severe = audit.violations.filter(item => ['serious', 'critical'].includes(item.impact));
        assert.deepEqual(severe.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) })), [], `${theme} ${width} accessibility`);
        if (artifactDirectory) {
          await mkdir(artifactDirectory, { recursive: true });
          for (const [index, preview] of (await page.locator('.preview').all()).entries()) {
            await preview.scrollIntoViewIfNeeded();
            await page.frameLocator('iframe').nth(index).getByRole('button', { name: /Accept draft|Undo/ }).click();
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
            await preview.screenshot({ path: path.join(artifactDirectory, `preview-${index + 1}-${theme}-${width}.png`) });
          }
          await page.evaluate(() => scrollTo(0, 0));
          await page.screenshot({ path: path.join(artifactDirectory, `explore-${theme}-${width}.png`), fullPage: width !== 390 });
        }
      }
    }
    await page.getByLabel('What should guide the next step?').fill('Test choice: keep both versions visible.');
    await page.getByRole('button', { name: 'Choose Compare changes' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('status').filter({ hasText: 'Saved compare locally' }).waitFor();
    await page.reload();
    assert.equal((await inspectExploration(project, 'browser-proof')).selected, 'compare');
    assert.equal(await page.getByRole('status').textContent(), 'Saved choice: compare.');
    assert.deepEqual(errors, []);
    console.log('PASS board browser: both themes, desktop/mobile, axe, draft interaction, keyboard choice, reload persistence, no page errors.');
  } finally {
    await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
}
