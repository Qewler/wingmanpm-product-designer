import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const frame = (title, styles, body, script = '') => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: rgb(255, 255, 255); color: rgb(20, 20, 20); font: 16px/1.5 system-ui, sans-serif; }
    header, main { width: min(900px, 100%); margin: auto; padding: 24px; }
    nav { display: flex; align-items: center; gap: 20px; }
    nav a { color: rgb(20, 20, 20); }
    ${styles}
  </style>
</head>
<body>
  ${body}
  ${script ? `<script>${script}</script>` : ''}
</body>
</html>`;

const lowContrastAndMissingNavigation = frame(
  'Failing craft sample',
  '@media (max-width: 600px) { nav { display: none; } }',
  '<header><nav aria-label="Main navigation"><a href="#overview">Overview</a><a href="#activity">Activity</a></nav></header><main><h1>Account overview</h1><p style="color:rgb(107,124,144)">This text does not meet normal-text contrast.</p></main>'
);

const correctedWithKeyboardMenu = frame(
  'Passing craft sample',
  `nav button { display: none; background: rgb(31, 41, 55); color: white; border: 0; padding: 10px 14px; }
   @media (max-width: 600px) {
     nav { align-items: flex-start; flex-direction: column; }
     nav a { display: none; }
     nav button { display: block; }
     nav.open a { display: block; }
   }`,
  '<header><nav aria-label="Main navigation"><button type="button" aria-label="Open menu">Menu</button><a href="#overview">Overview</a><a href="#activity">Activity</a></nav></header><main><h1>Account overview</h1><p>Current activity is ready for review.</p></main>',
  "document.querySelector('nav button').addEventListener('click', event => event.currentTarget.closest('nav').classList.toggle('open'));"
);

const gradientText = frame(
  'Unverified gradient sample',
  '.gradient { padding: 24px; background-image: linear-gradient(90deg, white, rgb(20,20,20)); }',
  '<main><h1>Visual treatment</h1><p class="gradient">This text crosses a gradient.</p></main>'
);

const blankPage = frame('Blank craft sample', '', '');

const customPaintAndPlaceholder = frame(
  'Custom paint sample',
  'canvas, svg { display: block; width: 200px; height: 80px; } input { margin-top: 20px; padding: 10px; }',
  '<main><h1>Rendered details</h1><svg viewBox="0 0 200 80" aria-label="Chart"><text x="10" y="40">SVG label</text></svg><canvas width="200" height="80" aria-label="Canvas chart"></canvas><label for="search">Search</label><input id="search" placeholder="Find a record"></main>'
);

const nestedDesktopLink = frame(
  'Equivalent navigation sample',
  `.mobile-route { display: none; }
   @media (max-width: 600px) { .desktop-route { display: none; } .mobile-route { display: inline; } }`,
  '<header><nav aria-label="Main navigation"><a class="desktop-route" href="#activity"><span>Activity</span></a><a class="mobile-route" href="#activity">Activity</a></nav></header><main><h1>Activity</h1><p>Recent work is ready.</p></main>'
);

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${server.address().port}/`;
}

async function closeServer(server) {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}

const childTermination = child => (
  child.exitCode !== null || child.signalCode !== null
    ? { exitCode: child.exitCode, signalCode: child.signalCode }
    : null
);

const describeTermination = ({ exitCode, signalCode }) => (
  signalCode ? `signal ${signalCode}` : `code ${exitCode}`
);

export async function stopChild(child, { signal = 'SIGKILL', timeoutMs = 5_000 } = {}) {
  const stopped = childTermination(child);
  if (stopped) return stopped;

  return new Promise((resolve, reject) => {
    let timer;
    const finish = result => {
      clearTimeout(timer);
      child.off('exit', onExit);
      child.off('close', onClose);
      child.off('error', onError);
      resolve(result);
    };
    const onExit = (exitCode, signalCode) => finish({ exitCode, signalCode });
    const onClose = (exitCode, signalCode) => finish({ exitCode, signalCode });
    const onError = error => finish({ exitCode: child.exitCode, signalCode: child.signalCode, error });

    child.once('exit', onExit);
    child.once('close', onClose);
    child.once('error', onError);
    timer = setTimeout(() => {
      child.off('exit', onExit);
      child.off('close', onClose);
      child.off('error', onError);
      reject(new Error(`Browser process did not stop within ${timeoutMs}ms after ${signal}.`));
    }, timeoutMs);
    const racedStop = childTermination(child);
    if (racedStop) {
      finish(racedStop);
      return;
    }
    try {
      child.kill(signal);
    } catch (error) {
      finish({ exitCode: child.exitCode, signalCode: child.signalCode, error });
    }
  });
}

export async function readCdpPort(profile, owner, { timeoutMs = 5_000, pollIntervalMs = 50 } = {}) {
  const portFile = path.join(profile, 'DevToolsActivePort');
  const deadline = Date.now() + timeoutMs;
  let spawnError;
  let stderr = '';
  const onError = error => { spawnError = error; };
  const onStderr = chunk => { stderr = `${stderr}${chunk}`.slice(-4_000); };
  owner.once('error', onError);
  owner.stderr?.on('data', onStderr);

  try {
    while (Date.now() < deadline) {
      if (spawnError) throw new Error(`CDP owner failed to start: ${spawnError.message}`);
      const stopped = childTermination(owner);
      if (stopped) {
        const detail = stderr.trim();
        throw new Error(`CDP owner exited with ${describeTermination(stopped)} before publishing a debug port.${detail ? ` Chromium stderr: ${detail}` : ''}`);
      }
      try {
        const [port] = (await readFile(portFile, 'utf8')).trim().split(/\s+/);
        if (/^\d+$/.test(port)) return Number(port);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      await new Promise(resolve => setTimeout(resolve, Math.min(pollIntervalMs, Math.max(0, deadline - Date.now()))));
    }
    throw new Error(`CDP owner did not publish a debug port within ${timeoutMs}ms.${stderr.trim() ? ` Chromium stderr: ${stderr.trim()}` : ''}`);
  } finally {
    owner.off('error', onError);
    owner.stderr?.off('data', onStderr);
  }
}

/** Reuses the smoke project's installed browser dependency; it does not install or mutate project sources. */
export async function checkCraftBrowser(skill, project, artifactDirectory) {
  const browserModule = path.join(project, 'node_modules', 'playwright', 'index.mjs');
  const { runCraft } = await import(pathToFileURL(path.join(skill, 'src', 'craft.mjs')).href);
  const { chromium } = await import(pathToFileURL(browserModule).href);
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'wingman-craft-browser-'));
  const viewports = [{ width: 1440, height: 960 }, { width: 390, height: 844 }];
  let notFoundServer;
  let cdpOwner;

  try {
    const cases = [
      ['failing.html', lowContrastAndMissingNavigation],
      ['passing.html', correctedWithKeyboardMenu],
      ['gradient.html', gradientText],
      ['blank.html', blankPage],
      ['custom-paint.html', customPaintAndPlaceholder],
      ['nested-route.html', nestedDesktopLink]
    ];
    await Promise.all(cases.map(([name, source]) => writeFile(path.join(temporary, name), source)));

    const failed = await runCraft({ project: temporary, file: 'failing.html', browserModule, viewports });
    assert.equal(failed.status, 'failed');
    assert.ok(failed.findings.some(({ code }) => code === 'text-contrast'), 'Low contrast must fail.');
    assert.ok(failed.findings.some(({ code }) => code === 'mobile-navigation'), 'Missing mobile navigation must fail.');

    const passed = await runCraft({ project: temporary, file: 'passing.html', browserModule, viewports });
    assert.equal(passed.status, 'passed', JSON.stringify(passed.findings));
    assert.deepEqual(passed.findings, []);

    const gradient = await runCraft({ project: temporary, file: 'gradient.html', browserModule, viewports });
    assert.equal(gradient.status, 'unverified');
    assert.ok(gradient.findings.some(({ code, severity }) => code === 'contrast-unverified' && severity === 'unverified'));
    assert.equal(gradient.findings.some(({ code }) => code === 'text-contrast'), false);

    const blank = await runCraft({ project: temporary, file: 'blank.html', browserModule, viewports });
    assert.equal(blank.status, 'unverified');
    assert.ok(blank.findings.some(({ code }) => code === 'no-readable-content'));

    notFoundServer = http.createServer((_request, response) => {
      response.writeHead(404, { 'content-type': 'text/html' });
      response.end('<!doctype html><title>Missing</title><p>Not found</p>');
    });
    const notFoundUrl = await listen(notFoundServer);
    const notFound = await runCraft({ project: temporary, url: notFoundUrl, browserModule, viewports: [viewports[0]] });
    assert.equal(notFound.status, 'failed');
    assert.ok(notFound.findings.some(({ code, message }) => code === 'http-error' && /HTTP 404/.test(message)));
    await closeServer(notFoundServer);
    notFoundServer = undefined;

    const customPaint = await runCraft({ project: temporary, file: 'custom-paint.html', browserModule, viewports: [viewports[0]] });
    assert.equal(customPaint.status, 'unverified');
    assert.ok(customPaint.findings.some(({ code }) => code === 'custom-paint'), 'SVG text and canvas must be unverified.');
    assert.ok(customPaint.findings.some(({ code, sample }) => code === 'contrast-unverified' && sample === 'Find a record'), 'Placeholder contrast must be unverified.');

    const nestedRoute = await runCraft({ project: temporary, file: 'nested-route.html', browserModule, viewports });
    assert.equal(nestedRoute.status, 'passed', JSON.stringify(nestedRoute.findings));
    assert.equal(nestedRoute.findings.some(({ code }) => code === 'mobile-navigation'), false);

    const cdpProfile = path.join(temporary, 'cdp-profile');
    await mkdir(cdpProfile);
    // These flags apply only to this disposable, test-owned Chromium profile. They never launch or change a user browser.
    const linuxSandboxFlags = process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [];
    cdpOwner = spawn(chromium.executablePath(), [
      '--headless', '--disable-background-networking', '--disable-component-update', '--disable-default-apps',
      '--disable-extensions', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0',
      ...linuxSandboxFlags, `--user-data-dir=${cdpProfile}`, 'about:blank'
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    const cdpPort = await readCdpPort(cdpProfile, cdpOwner);
    const cdp = `http://127.0.0.1:${cdpPort}`;
    const connected = await runCraft({
      project: temporary, file: 'passing.html', browserModule, cdp, viewports: [viewports[0]]
    });
    const cdpNavigationVerified = connected.status === 'passed';
    if (!cdpNavigationVerified) {
      assert.ok(connected.findings.some(({ code, message }) => code === 'browser-check-incomplete' && /Timeout 20000ms/.test(message)), JSON.stringify(connected.findings));
    }
    assert.equal(childTermination(cdpOwner), null, 'Craft must not stop the browser that owns the CDP endpoint.');
    const version = await fetch(`${cdp}/json/version`);
    assert.equal(version.ok, true, 'The owning browser must still answer after Craft disconnects.');

    for (const [name, source] of cases) assert.equal(await readFile(path.join(temporary, name), 'utf8'), source, 'Craft must not modify source files.');
    const reports = { failed, passed, gradient, blank, notFound, customPaint, nestedRoute, connected, cdpNavigationVerified };
    if (artifactDirectory) {
      await mkdir(artifactDirectory, { recursive: true });
      await writeFile(path.join(artifactDirectory, 'craft-browser.json'), `${JSON.stringify(reports, null, 2)}\n`);
    }
    console.log(`PASS craft browser: failures, blank/404, custom paint, placeholder, navigation equivalence, keyboard menu, CDP ownership${cdpNavigationVerified ? '' : ' (navigation unsupported by local raw Chromium)'}, no source writes.`);
    return reports;
  } finally {
    if (notFoundServer) await closeServer(notFoundServer);
    if (cdpOwner) await stopChild(cdpOwner);
    await rm(temporary, { recursive: true, force: true });
  }
}
