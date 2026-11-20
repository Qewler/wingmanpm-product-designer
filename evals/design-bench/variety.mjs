#!/usr/bin/env node
// Builds a blind variety review: does a skill give each product its own art
// direction, or reuse one template? Usage:
//   node evals/design-bench/variety.mjs <out-dir> <runA-skill-dir> <runB-skill-dir> [--seed N] [--prompts a,b,c]
// Writes <out-dir>/X/<n>/ and <out-dir>/Y/<n>/ with desktop-fold.png and mobile.png
// (numbered, so prompt ids do not pair the sets), plus <out-dir>/key.json.
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const [outDir, left, right] = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--')).map((p) => path.resolve(p));
if (!outDir || !left || !right) { console.error('Usage: variety.mjs <out-dir> <runA> <runB> [--seed N] [--prompts a,b]'); process.exit(2); }
let seed = Number(flag('--seed') ?? Date.now() % 100000);
const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const only = flag('--prompts')?.split(',');
const shared = readdirSync(left).filter((p) => (!only || only.includes(p))
  && existsSync(path.join(left, p, 'desktop-fold.png')) && existsSync(path.join(right, p, 'desktop-fold.png')));
const swap = rand() < 0.5;
const sets = swap ? { X: right, Y: left } : { X: left, Y: right };
const order = { X: [...shared].sort(() => rand() - 0.5), Y: [...shared].sort(() => rand() - 0.5) };
const key = { X: sets.X, Y: sets.Y, order };
for (const [label, src] of Object.entries(sets)) {
  order[label].forEach((prompt, i) => {
    const dir = path.join(outDir, label, String(i + 1)); mkdirSync(dir, { recursive: true });
    for (const shot of ['desktop-fold.png', 'mobile.png']) {
      const from = path.join(src, prompt, shot);
      if (existsSync(from)) copyFileSync(from, path.join(dir, shot));
    }
  });
}
writeFileSync(path.join(outDir, 'key.json'), JSON.stringify(key, null, 2));
console.log(`Variety set: ${shared.length} pages per side in ${outDir}`);
