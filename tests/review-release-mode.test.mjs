import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { hashReviewSources, runChecks } from '../skills/wingmanpm-product-designer/src/checker.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function projectFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wingman-review-mode-'));
  for (const relative of ['design-system/tokens', 'design-system/surfaces', 'src/stories', 'tests/wingman-design', '.wingmanpm-design']) {
    await mkdir(path.join(directory, relative), { recursive: true });
  }
  await writeFile(path.join(directory, 'design-system', 'PRODUCT.md'), '# Concept demo\n');
  await writeFile(path.join(directory, 'design-system', 'DESIGN.md'), '| Axis | Value | Why |\n|---|---:|---|\n| Expression | 5 | Clear |\n| Density | 5 | Useful |\n| Motion | 3 | Calm |\n| Warmth | 5 | Human |\n');
  await writeFile(path.join(directory, 'design-system', 'COMPONENTS.md'), '# Components\nloading empty partial error success disabled permission offline responsive progress sources uncertainty cancel approval\n');
  await writeFile(path.join(directory, 'design-system', 'tokens', 'tokens.json'), '{"$schema":"https://www.designtokens.org/tr/2025.10/format/","color":{"light":{},"dark":{}}}\n');
  await writeFile(path.join(directory, 'design-system', 'tokens', 'tokens.css'), '[data-theme="dark"] {}\n');
  await writeFile(path.join(directory, 'design-system', 'tokens', 'tailwind.preset.mjs'), 'export default {};\n');
  await writeFile(path.join(directory, 'design-system', 'tokens', 'shadcn.css'), ':root {}\n');
  await writeFile(path.join(directory, 'src', 'stories', 'ConceptDemo.stories.tsx'), 'export const ConceptDemo = {};\n');
  await writeFile(path.join(directory, 'tests', 'wingman-design', 'visual.spec.ts'), `
test('structure', async () => { const structureViolations = await auditVisibleStructure(); expect(structureViolations).toEqual([]); });
test('dropdowns', async () => { const candidates = await auditDropdownContrast(4.5); expect(candidates).toBeGreaterThan(0); await press('Escape'); });
`);
  await writeFile(path.join(directory, '.wingmanpm-design', 'config.json'), JSON.stringify({
    schemaVersion: 2, systemMode: 'new-system', stack: 'framework-neutral', goldenStack: false,
    requiresDarkTheme: true, aiSurfaces: false, legacyBaseline: false,
    scanRoots: ['src', 'stories'], viewports: [390, 768, 1280, 1440], visualEvidenceMaxAgeDays: 30
  }));
  await writeFile(path.join(directory, '.wingmanpm-design', 'exceptions.json'), '{"exceptions":[]}\n');
  return directory;
}

async function validReview(directory, overrides = {}) {
  const checks = Object.fromEntries([
    'keyboard', 'zoom200', 'reducedMotion', 'longContent', 'light', 'dark', 'axe',
    'responsiveStates', 'structureUnique', 'dropdownContrast', 'tableDensity',
    'tableColumns', 'tablePagination', 'tableExpansion', 'tableBulk', 'tableEditing'
  ].map((key) => [key, true]));
  return {
    status: 'reviewed', reviewer: 'Public fixture reviewer', reviewedAt: new Date().toISOString(),
    sourceHash: await hashReviewSources(directory), viewports: [390, 768, 1280, 1440], checks,
    notes: 'Public release fixture review.', ...overrides
  };
}

test('allow-pending-review demotes valid unfinished human review but never malformed evidence', async () => {
  const directory = await projectFixture();
  const reviewFile = path.join(directory, '.wingmanpm-design', 'review.json');
  const review = await validReview(directory);
  review.checks.structureUnique = false;
  review.sourceHash = '0'.repeat(64);
  await writeFile(reviewFile, `${JSON.stringify(review, null, 2)}\n`);

  let report = await runChecks(directory, { allowPendingReview: true });
  assert.equal(report.findings.some((finding) => finding.ruleId === 'WPD011' && finding.severity === 'block'), false);
  assert.ok(report.findings.some((finding) => finding.ruleId === 'WPD011' && finding.severity === 'warn' && /structureUnique|stale/.test(finding.message)));

  report = await runChecks(directory);
  assert.ok(report.findings.some((finding) => finding.ruleId === 'WPD011' && finding.severity === 'block' && /structureUnique|stale/.test(finding.message)));

  await writeFile(reviewFile, '{not-json\n');
  report = await runChecks(directory, { allowPendingReview: true });
  assert.ok(report.findings.some((finding) => finding.ruleId === 'WPD011' && finding.severity === 'block' && /Malformed JSON|Invalid JSON/.test(finding.message)));
});

test('release-mode test imports the current checker seam', async () => {
  const source = await readFile(path.join(root, 'skills', 'wingmanpm-product-designer', 'src', 'checker.mjs'), 'utf8');
  assert.match(source, /export async function runChecks/);
});
