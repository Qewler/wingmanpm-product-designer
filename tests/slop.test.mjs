import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { assessSlop, detectMode, slopScript, SLOP_LIMITS } from '../skills/wingmanpm-product-designer/src/slop.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'skills/wingmanpm-product-designer/bin/wingman-design.mjs');

function clean(overrides = {}) {
  return {
    width: 1440, height: 900, title: 'Sample', h1Size: 56,
    headings: [{ level: 1, text: 'Hear every customer', top: 120, firstView: true, stacked: false, eyebrow: null }],
    sectionStats: [{ h2: 1, headings: 2 }], heroWords: 24, heroSample: '', bodyWords: 300, operateProse: 40,
    longCardText: [], misaligned: [], controlHeights: [32, 40], nativeSelects: [], unthemedChecks: 0,
    noHover: [], noFocus: [], noDisabled: [], selectionThemed: true, chevronTriggers: [], gradientText: [],
    emojiIcons: [], numericCells: 4, proportionalNumbers: 0, accentBorders: 0, overflow: false, layout: { appShell: false },
    ...overrides
  };
}
const codes = (result) => result.findings.map((f) => f.code);

test('a clean landing snapshot passes the persuade gates', () => {
  const result = assessSlop(clean(), { probed: 2, results: [{ trigger: 'Product', problems: [] }] }, 'persuade');
  assert.equal(result.status, 'passed');
  assert.deepEqual(result.findings, []);
});

test('persuade budgets fail excess copy, headings, and eyebrows', () => {
  const headings = [
    { level: 1, text: 'Title', firstView: true, stacked: true, eyebrow: 'FEATURES' },
    { level: 2, text: 'Why', firstView: true, stacked: false, eyebrow: null },
    { level: 4, text: 'Deep', firstView: false, stacked: false, eyebrow: null },
    ...Array.from({ length: 16 }, (_, i) => ({ level: 3, text: `Card ${i}`, firstView: false, stacked: false, eyebrow: null }))
  ];
  const result = assessSlop(clean({ headings, heroWords: 60, bodyWords: 900, sectionStats: [{ h2: 3, headings: 5 }] }), null, 'persuade');
  assert.equal(result.status, 'failed');
  for (const code of ['heading-depth', 'stacked-headings', 'eyebrow-label', 'section-multi-heading', 'heading-wall', 'hero-copy', 'copy-budget']) {
    assert.ok(codes(result).includes(code), code);
  }
  assert.equal(result.findings.find((f) => f.code === 'eyebrow-label').severity, 'failure');
});

test('two h1 headings fail on a landing page but zero is allowed in an app screen', () => {
  const two = clean({ headings: [{ level: 1, text: 'A' }, { level: 1, text: 'B' }] });
  assert.ok(codes(assessSlop(two, null, 'persuade')).includes('h1-count'));
  assert.ok(!codes(assessSlop(clean({ headings: [] }), null, 'operate')).includes('h1-count'));
  assert.ok(codes(assessSlop(clean({ headings: [] }), null, 'persuade')).includes('h1-count'));
});

test('operate screens keep eyebrows advisory but enforce prose and heading depth', () => {
  const result = assessSlop(clean({ headings: [{ level: 1, text: 'Settings', eyebrow: 'WORKSPACE' }, { level: 5, text: 'Tiny' }], operateProse: 400 }), null, 'operate');
  assert.equal(result.findings.find((f) => f.code === 'eyebrow-label').severity, 'warning');
  assert.ok(codes(result).includes('prose-budget'));
  assert.ok(codes(result).includes('heading-depth'));
  assert.ok(!codes(result).includes('hero-copy'));
});

test('control polish failures block in every mode', () => {
  const snapshot = clean({
    misaligned: [{ a: 'Search', b: 'Filter', heights: [36, 32], centerOffset: 2 }],
    nativeSelects: ['Timezone'], noHover: ['Save'], noFocus: ['Save'], noDisabled: ['Archive'],
    chevronTriggers: ['Status'], gradientText: ['Ship faster'], emojiIcons: ['🚀 Launch'], overflow: true
  });
  for (const mode of ['persuade', 'operate']) {
    const result = assessSlop(snapshot, null, mode);
    for (const code of ['control-misalign', 'native-select', 'missing-hover', 'missing-focus-style', 'missing-disabled-style', 'dropdown-aria', 'gradient-text', 'emoji-icons', 'page-overflow']) {
      assert.equal(result.findings.find((f) => f.code === code)?.severity, 'failure', `${mode} ${code}`);
    }
  }
});

test('mobile gates fail small targets, clipped controls, and truncated names', () => {
  const mobile = clean({ width: 390, smallTargets: ['Team size (22px)'], clipped: ['Pause'], truncated: ['Scheduled CSV ex', 'Northwind Fr', 'Halcyon He'] });
  const result = assessSlop(mobile, null, 'operate');
  for (const code of ['small-target', 'clipped-control', 'truncated-text']) assert.equal(result.findings.find((f) => f.code === code)?.severity, 'failure', code);
  const covered = assessSlop(clean({ width: 390, covered: ['Know the air'], heroGap: { gap: 12, size: 66 } }), null, 'persuade');
  assert.equal(covered.findings.find((f) => f.code === 'covered-text')?.severity, 'failure');
  assert.equal(covered.findings.find((f) => f.code === 'cramped-hero')?.severity, 'warning');
  assert.ok(!codes(assessSlop(clean({ heroGap: { gap: 40, size: 66 } }), null, 'persuade')).includes('cramped-hero'));
  const broken = assessSlop(clean({ hiddenShown: ['Done'], clippedText: ['db.q', 'db.q', 'INSER'], faintControls: ['Sync now'] }), null, 'persuade');
  for (const code of ['hidden-visible', 'clipped-text', 'control-contrast']) assert.equal(broken.findings.find((f) => f.code === code)?.severity, 'failure', code);
  assert.equal(assessSlop(clean({ clippedText: ['one'] }), null, 'persuade').findings.find((f) => f.code === 'clipped-text').severity, 'warning');
  const desktop = assessSlop(clean({ truncated: ['a', 'b', 'c'] }), null, 'operate');
  assert.equal(desktop.findings.find((f) => f.code === 'truncated-text').severity, 'warning');
  assert.ok(!codes(assessSlop(clean({ truncated: ['one id'] }), null, 'operate')).includes('truncated-text'));
});

test('type and hierarchy gates hold the headline, the faces, and the primary action', () => {
  const type = (over = {}) => ({ h1Family: 'Archivo', outsized: [], firstViewLarge: ['Archivo'], families: [{ family: 'Archivo', share: 80 }, { family: 'IBM Plex Mono', share: 20 }], characterUse: [], characterCount: 0, proseChars: 900, monoProse: 0, ...over });
  const ok = assessSlop(clean({ type: type(), ctaGap: { gap: 120, dx: 0, dy: 120, label: 'Start free', h1Size: 72 } }), null, 'persuade');
  assert.equal(ok.status, 'passed');
  const bad = assessSlop(clean({
    type: type({ outsized: [{ text: '$242,000', size: 216 }], firstViewLarge: ['Anybody', 'Big Shoulders'], families: ['A', 'B', 'C', 'D'].map((family) => ({ family, share: 25 })), h1Family: 'Doto', characterUse: Array(7).fill('h2 Pricing'), characterCount: 7, monoProse: 800 }),
    ctaGap: { gap: 501, dx: 501, dy: 0, label: 'Copy install command', h1Size: 56 },
    navMisalign: { offset: 10, logo: 'Clause' }
  }), null, 'persuade');
  for (const code of ['outsized-display', 'character-face-sprawl', 'mono-prose', 'font-sprawl', 'cta-far']) assert.equal(bad.findings.find((f) => f.code === code)?.severity, 'failure', code);
  for (const code of ['two-display-faces', 'nav-misalign']) assert.equal(bad.findings.find((f) => f.code === code)?.severity, 'warning', code);
  assert.equal(assessSlop(clean({ type: type({ characterCount: 4, characterUse: Array(4).fill('h2') }) }), null, 'persuade').findings.find((f) => f.code === 'character-face-sprawl').severity, 'warning');
  const phone = assessSlop(clean({ width: 390, type: type(), ctaGap: { gap: 600, dx: 0, dy: 600, label: 'Start', h1Size: 44 } }), null, 'persuade');
  assert.ok(!codes(phone).includes('cta-far'), 'stacked phone layouts are not held to the desktop distance');
  const app = assessSlop(clean({ type: type({ outsized: [{ text: '42', size: 90 }], families: ['A', 'B', 'C', 'D'].map((family) => ({ family, share: 25 })) }) }), null, 'operate');
  assert.ok(!codes(app).includes('outsized-display'));
  assert.equal(app.findings.find((f) => f.code === 'font-sprawl').severity, 'warning');
});

test('a split headline fails and a neutral ground warns on landing pages', () => {
  const broken = assessSlop(clean({ splitHeadline: { gap: 201, size: 144 }, ground: { rgb: '241,238,230', share: 71, L: 0.949, C: 0.011 } }), null, 'persuade');
  assert.equal(broken.findings.find((f) => f.code === 'split-headline')?.severity, 'failure');
  assert.equal(broken.findings.find((f) => f.code === 'neutral-ground')?.severity, 'warning');
  for (const ground of [{ rgb: '228,236,213', share: 71, L: 0.931, C: 0.032 }, { rgb: '182,195,202', share: 53, L: 0.809, C: 0.017 }, { rgb: 'textured', share: 99, textured: true }, { rgb: '255,255,255', share: 40, L: 1, C: 0 }]) {
    assert.ok(!codes(assessSlop(clean({ ground }), null, 'persuade')).includes('neutral-ground'), ground.rgb);
  }
  const app = assessSlop(clean({ splitHeadline: { gap: 120, size: 40 }, ground: { rgb: '255,255,255', share: 100, L: 1, C: 0 } }), null, 'operate');
  assert.ok(!codes(app).some((c) => c === 'split-headline' || c === 'neutral-ground'));
});

test('edge-cut text fails, and formula headlines and crowded type warn', () => {
  const cut = assessSlop(clean({ edgeCut: ['NRD 214', '09:00'] }), null, 'operate');
  assert.equal(cut.findings.find((f) => f.code === 'edge-cut-text')?.severity, 'failure');
  const type = { h1Family: 'Archivo', h1Text: 'Every request, itemized.', outsized: [], firstViewLarge: ['Archivo'], firstViewFamilies: ['Archivo', 'Kalam', 'Doto', 'IBM Plex Mono'], families: [{ family: 'Archivo', share: 90 }], characterUse: [], characterCount: 0, proseChars: 900, monoProse: 0 };
  const warned = assessSlop(clean({ type }), null, 'persuade');
  for (const code of ['formula-headline', 'viewport-voices']) assert.equal(warned.findings.find((f) => f.code === code)?.severity, 'warning', code);
  const calm = assessSlop(clean({ type: { ...type, h1Text: 'One file for every pet', firstViewFamilies: ['Archivo', 'Courier Prime', 'IBM Plex Mono'] } }), null, 'persuade');
  assert.ok(!codes(calm).some((c) => c === 'formula-headline' || c === 'viewport-voices'));
});

test('popup probe problems become menu-behavior failures', () => {
  const probe = { probed: 2, results: [
    { trigger: 'Role', problems: ['no-arrow-keys', 'focus-not-returned'] },
    { trigger: 'Columns', problems: [] }
  ] };
  const result = assessSlop(clean(), probe, 'operate');
  const menu = result.findings.filter((f) => f.code === 'menu-behavior');
  assert.equal(menu.length, 1);
  assert.deepEqual(menu[0].problems, ['no-arrow-keys', 'focus-not-returned']);
});

test('warnings alone do not fail and mode detection follows the shell', () => {
  const result = assessSlop(clean({ selectionThemed: false, proportionalNumbers: 3, controlHeights: [24, 28, 32, 36, 44] }), null, 'operate');
  assert.equal(result.status, 'warnings');
  assert.equal(detectMode(clean({ layout: { appShell: true } })), 'operate');
  assert.equal(detectMode(clean({ h1Size: 64 })), 'persuade');
  assert.equal(detectMode(clean({ h1Size: 24 })), 'operate');
  assert.equal(SLOP_LIMITS.persuade.heroWords, 35);
  assert.equal(SLOP_LIMITS.persuade.bodyWords, 450);
});

test('the browser script is valid standalone JavaScript and the CLI exposes it', () => {
  for (const probe of [true, false]) assert.doesNotThrow(() => new Function(`return ${slopScript({ probe })}`));
  assert.match(slopScript({ probe: false }), /const probe = null/);
  const printed = execFileSync(process.execPath, [cli, 'slop', '--script'], { encoding: 'utf8' });
  assert.match(printed, /collectSlopDOM/);
  assert.match(printed, /await probeMenus\(\)/);
});
