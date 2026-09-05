import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFile, realpath, mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';

const inside = (root, target) => { const r = path.relative(root, target); return !r.startsWith('..' + path.sep) && r !== '..' && !path.isAbsolute(r); };
const localURL = (value) => { const u = new URL(value); if (!['http:', 'https:'].includes(u.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) || u.username || u.password) throw new Error('Craft only accepts loopback HTTP URLs.'); return u; };
export function contrastRatio(foreground, background) {
  const luminance = (rgb) => rgb.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const a = luminance(foreground), b = luminance(background); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}
const rgb = (value) => { const m = value.match(/^rgba?\(([^)]+)\)$/); if (!m || m[1].includes('%')) return null; const parts = m[1].split(/[, /]+/).filter(Boolean).map(Number); return parts.length >= 3 && parts.every(Number.isFinite) ? [...parts.slice(0, 3), parts[3] ?? 1] : null; };
const over = (a, b) => a.slice(0, 3).map((v, i) => v * a[3] + b[i] * (1 - a[3]));

// Self-contained so a host browser can evaluate the same collector.
export function collectCraftDOM() {
  const visible = el => { const s = getComputedStyle(el), r = el.getBoundingClientRect(); return !el.closest('[hidden],[inert],[aria-hidden="true"]') && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) !== 0 && r.width > 0 && r.height > 0 && r.right > 0 && r.left < innerWidth; };
  const label = el => (el.getAttribute('aria-label') || el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 100);
  const key = el => { const href = el.getAttribute('href'); return href && href !== '#' ? href : label(el).toLowerCase(); };
  const navigation = [...document.querySelectorAll('nav a,nav button,nav [role="link"],[role="navigation"] a,[role="navigation"] button,nav span')].filter(el => visible(el) && (el.matches('a,button,[role="link"]') || !el.closest('a,button,[role="link"]') && !el.querySelector('a,button,span')) && !el.closest('[data-brand]')).map(key).filter(Boolean);
  const menuItems = [...document.querySelectorAll('[role="menuitem"],dialog a,[role="dialog"] a,header a,nav a,nav button')].filter(visible).map(key).filter(Boolean);
  const texts = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || el.matches('script,style,svg *,[disabled],input[type="password"]') || el.closest('[aria-disabled="true"],[data-brand]')) continue;
    let text = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    const placeholder = el.matches('input,textarea') && !el.value && el.placeholder;
    if (el.matches('input,textarea')) text = el.value || el.placeholder;
    if (!text) continue;
    const s = getComputedStyle(el), layers = []; let uncertain = Boolean(placeholder);
    for (let p = el; p; p = p.parentElement) {
      const c = getComputedStyle(p); layers.push(c.backgroundColor);
      for (const pseudo of ['::before', '::after']) { const ps = getComputedStyle(p, pseudo); if (!['none', 'normal'].includes(ps.content) && (ps.backgroundImage !== 'none' || !['rgba(0, 0, 0, 0)', 'transparent'].includes(ps.backgroundColor))) uncertain = true; }
      if (c.backgroundImage !== 'none' || Number(c.opacity) !== 1 || c.mixBlendMode !== 'normal' || c.filter !== 'none' || c.backdropFilter && c.backdropFilter !== 'none') uncertain = true;
    }
    texts.push({ text: text.slice(0, 70), color: s.color, layers, uncertain, size: parseFloat(s.fontSize), weight: parseInt(s.fontWeight, 10) || 400 });
  }
  return { customPaint: [...document.querySelectorAll('canvas,svg text')].some(visible), title: document.title, navigation: [...new Set(navigation)], menuItems: [...new Set(menuItems)], texts, overflow: document.documentElement.scrollWidth > innerWidth + 1, width: innerWidth };
}

export function assessCraftDOM(snapshot) {
  const groups = new Map();
  for (const t of snapshot.texts) {
    const fg = rgb(t.color), layers = t.layers.map(rgb);
    let code, ratio, minimum = t.size >= 24 || t.size >= 18.6666667 && t.weight >= 700 ? 3 : 4.5;
    if (t.uncertain || !fg || layers.some(l => !l)) code = 'contrast-unverified';
    else {
      const bg = layers.reverse().reduce((base, layer) => over(layer, base), [255, 255, 255]);
      ratio = contrastRatio(over(fg, bg), bg);
      if (ratio < minimum) code = 'text-contrast';
    }
    if (!code) continue;
    const key = JSON.stringify([code, t.color, t.layers, minimum]);
    const prior = groups.get(key); if (prior) prior.count++;
    else groups.set(key, { code, severity: code === 'text-contrast' ? 'failure' : 'unverified', count: 1, sample: t.text, ...(ratio === undefined ? {} : { ratio, minimum }), message: code === 'text-contrast' ? 'Text contrast is below the minimum.' : 'Complex paint needs visual or browser accessibility proof.' });
  }
  const findings = [...groups.values()];
  if (snapshot.customPaint) findings.push({ code: 'custom-paint', severity: 'unverified', message: 'Visible canvas or SVG text requires host browser proof.' });
  if (snapshot.overflow) findings.push({ code: 'page-overflow', severity: 'failure', message: 'The page scrolls horizontally at this width.' });
  return findings;
}

export async function runCraft({ project = process.cwd(), file, url, browserModule, cdp, out, viewports = [{ width: 1440, height: 960 }, { width: 390, height: 844 }] }) {
  if (Boolean(file) === Boolean(url)) throw new Error('Provide exactly one of file or url.');
  project = await realpath(project);
  let target;
  if (file) { target = await realpath(path.resolve(project, file)); if (!inside(project, target) || !/\.html?$/i.test(target)) throw new Error('Craft file must be HTML inside the project.'); }
  if (url) localURL(url); if (cdp) localURL(cdp);
  if (out) {
    out = path.resolve(project, out);
    if (!inside(project, out) || !out.endsWith('.json')) throw new Error('Craft output must be a JSON file inside the project.');
    let parent = path.dirname(out);
    for (;;) { try { if (!inside(project, await realpath(parent))) throw new Error('Craft output parent escapes the project.'); break; } catch (error) { if (error.code !== 'ENOENT') throw error; parent = path.dirname(parent); } }
    await mkdir(path.dirname(out), { recursive: true });
  }
  const report = { status: 'unverified', findings: [], viewports: [], scope: 'Quick rendered craft check. Not a full accessibility audit, interaction test, or shipping gate.' };
  let server, browser, context, page;
  try {
    let modulePath = browserModule;
    if (!modulePath) { const require = createRequire(path.join(project, 'package.json')); for (const name of ['playwright', 'playwright-core', '@playwright/test']) { try { modulePath = require.resolve(name); break; } catch {} } }
    if (!modulePath) { report.findings.push({ code: 'browser-unavailable', severity: 'unverified', message: 'Use an existing host browser or pass --browser-module with an installed Playwright module.' }); return report; }
    const module = await import(pathToFileURL(path.resolve(modulePath)).href);
    const chromium = module.chromium || module.default?.chromium;
    if (!chromium) throw new Error('Browser module must export Playwright chromium.');
    if (file) {
      const root = path.dirname(target);
      server = http.createServer(async (req, res) => { try { const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); const name = pathname === '/' ? path.basename(target) : pathname.slice(1); if (name.split('/').some(p => p.startsWith('.'))) throw new Error(); const asset = await realpath(path.resolve(root, name)); if (!inside(root, asset) || !/\.(html?|css|js|mjs|png|jpe?g|webp|svg|woff2?)$/i.test(asset)) throw new Error(); const ext = path.extname(asset); res.setHeader('Content-Type', ({'.html':'text/html','.htm':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.svg':'image/svg+xml'})[ext] || 'application/octet-stream'); res.end(await readFile(asset)); } catch { res.writeHead(404); res.end(); } });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); url = `http://127.0.0.1:${server.address().port}/`;
    }
    browser = cdp ? await chromium.connectOverCDP(cdp) : await chromium.launch({ headless: true });
    context = cdp ? browser.contexts()[0] : await browser.newContext();
    if (!context) throw new Error('No existing browser context is available.');
    page = await context.newPage();
    if (file) await page.route('**/*', route => { const u = new URL(route.request().url()); return u.origin === new URL(url).origin || ['data:', 'blob:'].includes(u.protocol) ? route.continue() : route.abort(); });
    const errors = []; page.on('pageerror', error => errors.push(error.message.slice(0, 200)));
    let desktop;
    for (const viewport of [...viewports].sort((a, b) => b.width - a.width)) {
      await page.setViewportSize(viewport); const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 }); await page.evaluate(() => document.fonts.ready);
      const snapshot = await page.evaluate(collectCraftDOM);
      const findings = assessCraftDOM(snapshot);
      if (response && !response.ok()) findings.push({ code: 'http-error', severity: 'failure', message: `The requested page returned HTTP ${response.status()}.` });
      if (!snapshot.texts.length) findings.push({ code: 'no-readable-content', severity: 'unverified', message: 'No readable HTML text was observed; inspect custom rendering or the loading state with the host browser.' });
      if (new URL(page.url()).origin !== new URL(url).origin) findings.push({ code: 'target-changed', severity: 'unverified', message: 'The browser redirected away from the requested app.' });
      if (!desktop) desktop = snapshot;
      else {
        let missing = desktop.navigation.filter(key => !snapshot.navigation.includes(key));
        if (missing.length) {
          const menu = page.locator('header button,nav button,[role="navigation"] button').filter({ hasText: /menu|navigation/i });
          const labelled = page.getByRole('button', { name: /^(open |toggle )?(main )?(menu|navigation)$/i });
          for (const candidate of [labelled, menu]) {
            if (await candidate.count() === 1 && await candidate.isVisible()) { await candidate.focus(); await candidate.press('Enter'); const opened = await page.evaluate(collectCraftDOM); missing = missing.filter(key => ![...opened.navigation, ...opened.menuItems].includes(key)); await page.keyboard.press('Escape'); break; }
          }
          if (missing.length) findings.push({ code: 'mobile-navigation', severity: 'failure', missing, message: 'Desktop navigation has no observed mobile replacement. Restore it or verify the equivalent menu with the host browser.' });
        }
      }
      report.viewports.push({ ...viewport, title: snapshot.title, findings });
      report.findings.push(...findings.map(f => ({ ...f, width: viewport.width })));
    }
    for (const message of new Set(errors)) report.findings.push({ code: 'browser-error', severity: 'failure', message });
    report.status = report.findings.some(f => f.severity === 'failure') ? 'failed' : report.findings.length ? 'unverified' : 'passed';
  } catch (error) { report.findings.push({ code: 'browser-check-incomplete', severity: 'unverified', message: error.message }); report.status = report.findings.some(f => f.severity === 'failure') ? 'failed' : 'unverified'; }
  finally {
    await page?.close().catch(() => {});
    if (!cdp) await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (out) { const temporary = `${out}.${process.pid}.tmp`; await writeFile(temporary, JSON.stringify(report, null, 2) + '\n'); await rename(temporary, out); }
  }
  return report;
}
