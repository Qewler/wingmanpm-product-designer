import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import WingmanBrowserReporter, { BROWSER_AUDIT_ATTACHMENT, CANONICAL_BROWSER_AUDIT_TITLE } from '../skills/wingmanpm-product-designer/src/browser-reporter.mjs';
import { hashReviewSources, validateBrowserEvidence } from '../skills/wingmanpm-product-designer/src/checker.mjs';

async function project() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wingman-browser-reporter-'));
  await mkdir(path.join(directory, 'src'), { recursive: true });
  await mkdir(path.join(directory, 'tests', 'wingman-design'), { recursive: true });
  await mkdir(path.join(directory, '.wingmanpm-design'), { recursive: true });
  await writeFile(path.join(directory, 'src', 'Surface.tsx'), 'export const Surface = () => <main><h1>Surface</h1></main>;\n');
  await writeFile(path.join(directory, 'tests', 'wingman-design', 'visual.spec.ts'), 'test("browser audit", () => expect(true).toBe(true));\n');
  await writeFile(path.join(directory, '.wingmanpm-design', 'config.json'), `${JSON.stringify({
    scanRoots: ['src'], viewports: [390, 768, 1280, 1440]
  })}\n`);
  return directory;
}

function passedAttachment() {
  return {
    name: BROWSER_AUDIT_ATTACHMENT,
    contentType: 'application/json',
    body: Buffer.from(JSON.stringify({
      storyCount: 7,
      themes: ['light', 'dark'],
      structureUnique: true,
      dropdownContrast: true,
      dropdownCandidateCount: 12
    }))
  };
}

function suiteFor(directory, files = ['visual.spec.ts']) {
  return {
    allTests: () => files.map((file, index) => ({
      id: `suite-${index}`,
      location: { file: path.join(directory, 'tests', 'wingman-design', file) }
    }))
  };
}

test('reporter writes current passed evidence only after the canonical audit and full run pass', async () => {
  const directory = await project();
  const reporter = new WingmanBrowserReporter({ projectRoot: directory });
  reporter.onBegin({}, suiteFor(directory));
  reporter.onTestEnd({ id: 'ordinary', title: 'ordinary' }, { status: 'passed', attachments: [] });
  reporter.onTestEnd({ id: 'canonical', title: CANONICAL_BROWSER_AUDIT_TITLE }, { status: 'passed', attachments: [passedAttachment()] });
  await reporter.onEnd({ status: 'passed' });
  const evidence = JSON.parse(await readFile(path.join(directory, '.wingmanpm-design', 'browser-evidence.json'), 'utf8'));
  assert.deepEqual(validateBrowserEvidence(evidence), []);
  assert.equal(evidence.status, 'passed');
  assert.equal(evidence.sourceHash, await hashReviewSources(directory));
  assert.deepEqual(evidence.tests, { passed: 2, failed: 0, skipped: 0 });
  assert.equal(evidence.storyCount, 7);
  assert.equal(evidence.dropdownCandidateCount, 12);
});

test('reporter rejects spoofed audit attachments and skipped full runs', async () => {
  const directory = await project();
  const reporter = new WingmanBrowserReporter({ projectRoot: directory });
  reporter.onBegin({}, suiteFor(directory));
  reporter.onTestEnd({ id: 'spoof', title: 'similar audit title' }, { status: 'passed', attachments: [passedAttachment()] });
  reporter.onTestEnd({ id: 'skipped', title: 'skipped' }, { status: 'skipped', attachments: [] });
  await reporter.onEnd({ status: 'passed' });
  const evidence = JSON.parse(await readFile(path.join(directory, '.wingmanpm-design', 'browser-evidence.json'), 'utf8'));
  assert.equal(evidence.status, 'failed');
  assert.equal(evidence.tests.skipped, 1);
  assert.equal(evidence.storyCount, 0);
});

test('reporter rejects a canonical-only run when another test spec exists', async () => {
  const directory = await project();
  await writeFile(path.join(directory, 'tests', 'wingman-design', 'interaction.spec.ts'), 'test("interaction", () => expect(true).toBe(true));\n');
  const reporter = new WingmanBrowserReporter({ projectRoot: directory });
  reporter.onBegin({}, suiteFor(directory));
  reporter.onTestEnd({ id: 'canonical', title: CANONICAL_BROWSER_AUDIT_TITLE }, { status: 'passed', attachments: [passedAttachment()] });
  await reporter.onEnd({ status: 'passed' });
  const evidence = JSON.parse(await readFile(path.join(directory, '.wingmanpm-design', 'browser-evidence.json'), 'utf8'));
  assert.equal(evidence.status, 'failed');
  assert.equal(evidence.tests.failed, 0);
  assert.equal(evidence.tests.skipped, 0);
});

test('reporter removes stale pass evidence at start and records a failed full run', async () => {
  const directory = await project();
  const target = path.join(directory, '.wingmanpm-design', 'browser-evidence.json');
  await writeFile(target, '{"status":"passed"}\n');
  const reporter = new WingmanBrowserReporter({ projectRoot: directory });
  reporter.onBegin({}, suiteFor(directory));
  await assert.rejects(readFile(target, 'utf8'), { code: 'ENOENT' });
  reporter.onTestEnd({ id: 'canonical', title: 'canonical' }, { status: 'failed', attachments: [] });
  await reporter.onEnd({ status: 'failed' });
  const evidence = JSON.parse(await readFile(target, 'utf8'));
  assert.equal(evidence.status, 'failed');
  assert.equal(evidence.tests.failed, 1);
  assert.equal(evidence.structureUnique, false);
  assert.equal(evidence.dropdownContrast, false);
});

test('canonical browser source keeps delayed, visible-text, X-icon, and active-option guards', async () => {
  const source = await readFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'wingmanpm-product-designer', 'templates', 'project', 'tests', 'wingman-design', 'visual.spec.ts'), 'utf8');
  assert.match(source, /visibleText\(heading\)/);
  assert.match(source, /const explicitX[\s\S]*if \(!marked && !named && !explicitX\)/);
  assert.match(source, /activeByFocus[\s\S]*no visible keyboard-active option/);
  assert.match(source, /waitForTimeout\(300\)/);
  assert.match(source, /const portalFallbackRoot = roots\[0\]/);
  assert.match(source, /return root === portalFallbackRoot/);
});
