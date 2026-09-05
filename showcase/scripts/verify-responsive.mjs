import assert from 'node:assert/strict';

/** Verify the real embedded viewports before calling their screenshot proof. */
export async function verifyResponsive(page) {
  const previews = page.locator('.device__canvas iframe');
  assert.equal(await previews.count(), 3, 'All three real viewports must exist.');
  const results = [];
  for (let index = 0; index < 3; index++) {
    const element = previews.nth(index);
    const width = Number(await element.getAttribute('width'));
    const height = Number(await element.getAttribute('height'));
    const frame = await (await element.elementHandle()).contentFrame();
    await frame.locator('.site-row').last().waitFor({ state: 'visible' });
    await frame.evaluate(() => document.fonts.ready);
    const result = await frame.evaluate(() => {
      const box = element => { const r = element.getBoundingClientRect(); return { left:r.left, right:r.right, top:r.top, bottom:r.bottom, width:r.width }; };
      const visible = element => !!element && getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().width > 0;
      const main = document.querySelector('.ops-main');
      return {
        width: innerWidth, height: innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        main: box(main),
        rows: [...document.querySelectorAll('.site-row')].map(row => ({ text:row.textContent, ...box(row) })),
        links: [...document.querySelectorAll('.ops-rail nav a')].map(link => ({ visible:visible(link), ...box(link) })),
        actions: [...document.querySelectorAll('.ops-heading button')].map(button => ({ visible:visible(button), ...box(button) })),
      };
    });
    assert.equal(result.width, width, 'Embedded viewport must match its declared width.');
    assert.equal(result.height, height);
    assert.ok(result.documentWidth <= width + 1, `${width}: horizontal page overflow`);
    if (width <= 900) assert.ok(result.main.width >= width * .95, `${width}: content is trapped in a sidebar column`);
    assert.equal(result.rows.length, 3);
    for (const [i, name] of ['North Sound', 'Quartz Ridge', 'Cedar Basin'].entries()) {
      assert.ok(result.rows[i].text.includes(name));
      assert.ok(result.rows[i].left >= 0 && result.rows[i].right <= width + 1, `${width}: clipped site row`);
      assert.ok(result.rows[i].bottom <= height, `${width}: final site data is cropped out of the proof`);
    }
    assert.equal(result.links.length, 4);
    assert.equal(result.actions.length, 2);
    for (const control of [...result.links, ...result.actions]) {
      assert.ok(control.visible && control.left >= 0 && control.right <= width + 1 && control.bottom <= height, `${width}: missing or clipped control`);
    }
    const firstLink = frame.locator('.ops-rail nav a').first();
    await firstLink.focus();
    await firstLink.press('Tab');
    assert.equal(await frame.evaluate(() => document.activeElement?.textContent), 'Sites', `${width}: navigation keyboard order`);
    await frame.locator('.ops-heading button').last().focus();
    assert.match(await frame.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), /solid/);
    await frame.locator('.ops-heading button').last().blur();
    const fit = await element.evaluate(iframe => {
      const a=iframe.getBoundingClientRect(), b=iframe.parentElement.getBoundingClientRect();
      return { width: Math.abs(a.width-b.width), height: Math.abs(a.height-b.height) };
    });
    assert.ok(fit.width < 1 && fit.height < 1, `${width}: viewport does not fill its device frame`);
    results.push({ width, height, rows: result.rows.length, navigation: result.links.length, actions: result.actions.length, fullWidth: result.main.width });
  }
  return results;
}
