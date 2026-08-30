import { spawn } from 'node:child_process';
import { mkdir, readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import sharp from 'sharp';

const showcaseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = path.resolve(showcaseDir, '..');
const readmeDir = path.join(repoDir, 'docs', 'assets', 'readme');
const assetsDir = path.join(repoDir, 'assets');
const port = 7007;
const baseUrl = `http://127.0.0.1:${port}`;

await mkdir(readmeDir, { recursive: true });
await mkdir(assetsDir, { recursive: true });

const server = spawn(
  process.execPath,
  [path.join(showcaseDir, 'node_modules', 'storybook', 'dist', 'bin', 'dispatcher.js'), 'dev', '--port', String(port), '--ci', '--no-open'],
  { cwd: showcaseDir, stdio: ['ignore', 'pipe', 'pipe'] },
);

let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk; });
server.stderr.on('data', (chunk) => { serverOutput += chunk; });

async function waitForServer() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/iframe.html`);
      if (response.ok) return;
    } catch {
      // Storybook is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Storybook did not start.\n${serverOutput}`);
}

async function reencode(file, type, quality = 82) {
  const input = await readFile(file);
  const temporary = `${file}.tmp`;
  const pipeline = sharp(input).rotate();
  if (type === 'webp') {
    await pipeline.webp({ quality, effort: 6, smartSubsample: true }).toFile(temporary);
  } else {
    await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, effort: 10 }).toFile(temporary);
  }
  await rename(temporary, file);
}

async function capture(page, { id, file, width, height, theme = 'light', type = 'png', quality = 82 }) {
  await page.setViewportSize({ width, height });
  const target = `${baseUrl}/iframe.html?viewMode=story&id=${id}&globals=theme:${theme}`;
  await page.goto(target, { waitUntil: 'networkidle' });
  await page.waitForSelector('.showcase-root > *', { state: 'visible' });
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.screenshot({ path: file, type, quality: type === 'webp' ? quality : undefined, animations: 'disabled' });
  await reencode(file, type, quality);
}

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    colorScheme: 'light',
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const jobs = [
    ['readme-brand--hero-light', path.join(readmeDir, 'hero-light.webp'), 1600, 900, 'light', 'webp', 82],
    ['readme-brand--hero-dark', path.join(readmeDir, 'hero-dark.webp'), 1600, 900, 'dark', 'webp', 82],
    ['proof-operational-workspace--comparison', path.join(readmeDir, 'comparison-workspace.webp'), 1600, 900, 'light', 'webp', 80],
    ['proof-transparent-ai-review--comparison', path.join(readmeDir, 'comparison-ai-review.webp'), 1600, 900, 'light', 'webp', 80],
    ['proof-saas-marketing--comparison', path.join(readmeDir, 'comparison-marketing.webp'), 1600, 900, 'light', 'webp', 80],
    ['readme-brand--responsive', path.join(readmeDir, 'responsive-proof.webp'), 1600, 780, 'dark', 'webp', 80],
    ['readme-brand--plugin-icon-story', path.join(assetsDir, 'plugin-icon.png'), 512, 512, 'dark', 'png', 100],
    ['readme-brand--plugin-logo-light', path.join(assetsDir, 'plugin-logo.png'), 1200, 300, 'light', 'png', 100],
    ['readme-brand--plugin-logo-dark', path.join(assetsDir, 'plugin-logo-dark.png'), 1200, 300, 'dark', 'png', 100],
    ['proof-operational-workspace--after', path.join(assetsDir, 'plugin-screenshot-workspace.png'), 1600, 1000, 'light', 'png', 100],
    ['proof-transparent-ai-review--after', path.join(assetsDir, 'plugin-screenshot-ai.png'), 1600, 1000, 'light', 'png', 100],
    ['proof-saas-marketing--after', path.join(assetsDir, 'plugin-screenshot-marketing.png'), 1600, 1000, 'light', 'png', 100],
    ['readme-brand--social-preview-story', path.join(assetsDir, 'social-preview.png'), 1280, 640, 'dark', 'png', 100],
  ];

  for (const [id, file, width, height, theme, type, quality] of jobs) {
    await capture(page, { id, file, width, height, theme, type, quality });
    process.stdout.write(`captured ${path.relative(repoDir, file)}\n`);
  }

  await context.close();
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
}
