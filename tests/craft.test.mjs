import assert from 'node:assert/strict';
import { access, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assessCraftDOM, contrastRatio, runCraft } from '../skills/wingmanpm-product-designer/src/craft.mjs';

const white = 'rgb(255, 255, 255)';

function snapshot(...texts) {
  return { texts, overflow: false };
}

function text(color, options = {}) {
  return {
    text: options.text ?? 'Readable sample',
    color,
    layers: options.layers ?? [white],
    uncertain: options.uncertain ?? false,
    size: options.size ?? 16,
    weight: options.weight ?? 400
  };
}

test('original benchmark secondary text colors fail the 4.5 minimum', () => {
  const findings = assessCraftDOM(snapshot(
    text('rgb(107, 124, 144)', { text: 'Ratio 4.27' }),
    text('rgb(122, 137, 156)', { text: 'Ratio 3.56' })
  ));

  assert.equal(findings.length, 2);
  assert.deepEqual(findings.map(({ code, severity, minimum }) => ({ code, severity, minimum })), [
    { code: 'text-contrast', severity: 'failure', minimum: 4.5 },
    { code: 'text-contrast', severity: 'failure', minimum: 4.5 }
  ]);
  assert.ok(findings[0].ratio > 4.27 && findings[0].ratio < 4.28);
  assert.ok(findings[1].ratio > 3.56 && findings[1].ratio < 3.57);
});

test('contrast compares the unrounded ratio with the threshold', () => {
  const [finding] = assessCraftDOM(snapshot(text('rgb(139, 111, 125)')));

  assert.equal(Number(finding.ratio.toFixed(2)), 4.5);
  assert.ok(finding.ratio < 4.5);
  assert.equal(finding.code, 'text-contrast');
  assert.equal(finding.severity, 'failure');
});

test('alpha text is composited and large text uses the 3.0 threshold', () => {
  const alpha = assessCraftDOM(snapshot(text('rgba(0, 0, 0, 0.5)')))[0];
  assert.equal(alpha.code, 'text-contrast');
  assert.ok(Math.abs(alpha.ratio - contrastRatio([127.5, 127.5, 127.5, 1], [255, 255, 255, 1])) < 1e-12);

  const large = assessCraftDOM(snapshot(text('rgb(122, 137, 156)', { size: 24 })));
  assert.deepEqual(large, []);

  const boldLarge = assessCraftDOM(snapshot(text('rgb(122, 137, 156)', { size: 18.6666667, weight: 700 })));
  assert.deepEqual(boldLarge, []);
});

test('gradient-backed text is unverified instead of receiving a false contrast result', () => {
  const [finding] = assessCraftDOM(snapshot(text('rgb(20, 20, 20)', { uncertain: true })));

  assert.equal(finding.code, 'contrast-unverified');
  assert.equal(finding.severity, 'unverified');
  assert.equal(finding.ratio, undefined);
});

test('visible canvas or SVG text requires custom-paint verification', () => {
  const [finding] = assessCraftDOM({ texts: [], overflow: false, customPaint: true });

  assert.deepEqual(finding, {
    code: 'custom-paint',
    severity: 'unverified',
    message: 'Visible canvas or SVG text requires host browser proof.'
  });
});

test('an output path below an escaping symlink creates no outside directory', async () => {
  const project = await mkdtemp(path.join(os.tmpdir(), 'wingman-craft-output-project-'));
  const outside = await mkdtemp(path.join(os.tmpdir(), 'wingman-craft-output-outside-'));
  try {
    await writeFile(path.join(project, 'surface.html'), '<!doctype html><title>Safe source</title><p>Content</p>');
    await symlink(outside, path.join(project, 'linked-output'), process.platform === 'win32' ? 'junction' : 'dir');

    await assert.rejects(
      runCraft({ project, file: 'surface.html', out: 'linked-output/new/report.json' }),
      /output parent escapes the project/
    );
    await assert.rejects(access(path.join(outside, 'new')), { code: 'ENOENT' });
  } finally {
    await Promise.all([
      rm(project, { recursive: true, force: true }),
      rm(outside, { recursive: true, force: true })
    ]);
  }
});
