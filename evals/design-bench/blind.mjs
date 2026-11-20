#!/usr/bin/env node
// Builds a blind pairwise judging set.
// Usage: node evals/design-bench/blind.mjs <out-dir> <skillA-run-dir> <skillB-run-dir> [--seed N]
// Each run dir holds <prompt>/index.html plus score.mjs screenshots. Writes
// <out-dir>/<prompt>/{A,B}/ and a judge-only-forbidden key.json mapping labels to sources,
// plus key-flipped.json for the swapped-order pass.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [outDir, left, right] = process.argv.slice(2).map(p => p && path.resolve(p));
if (!outDir || !left || !right) { console.error('Usage: blind.mjs <out-dir> <runA> <runB> [--seed N]'); process.exit(2); }
let seed = Number(process.argv.includes('--seed') ? process.argv[process.argv.indexOf('--seed') + 1] : Date.now() % 100000);
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const scrub = html => html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, m => /wingman|impeccable|skill|direction contract|seed/i.test(m) ? '' : m).replace(/wingman(pm)?|impeccable/gi, 'design');

const key = {}, flipped = {};
for (const prompt of readdirSync(left).filter(p => existsSync(path.join(left, p, 'index.html')) && existsSync(path.join(right, p, 'index.html')))) {
  const swap = rand() < 0.5;
  const [a, b] = swap ? [right, left] : [left, right];
  for (const [label, src] of [['A', a], ['B', b]]) {
    const dir = path.join(outDir, 'pass1', prompt, label); mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'index.html'), scrub(readFileSync(path.join(src, prompt, 'index.html'), 'utf8')));
    for (const shot of ['desktop.png', 'desktop-fold.png', 'mobile.png']) if (existsSync(path.join(src, prompt, shot))) copyFileSync(path.join(src, prompt, shot), path.join(dir, shot));
  }
  for (const [label, src] of [['A', b], ['B', a]]) {
    const dir = path.join(outDir, 'pass2', prompt, label); mkdirSync(dir, { recursive: true });
    for (const file of ['index.html', 'desktop.png', 'desktop-fold.png', 'mobile.png']) { const from = path.join(outDir, 'pass1', prompt, label === 'A' ? 'B' : 'A', file); if (existsSync(from)) copyFileSync(from, path.join(dir, file)); }
  }
  key[prompt] = { A: a, B: b }; flipped[prompt] = { A: b, B: a };
}
mkdirSync(path.join(outDir, 'keys'), { recursive: true });
writeFileSync(path.join(outDir, 'keys', 'pass1.json'), JSON.stringify(key, null, 2));
writeFileSync(path.join(outDir, 'keys', 'pass2.json'), JSON.stringify(flipped, null, 2));
console.log(`Blind set: ${Object.keys(key).length} prompts in ${outDir}`);
