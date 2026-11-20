#!/usr/bin/env node
// Unblinds judge results. Usage: node evals/design-bench/tally.mjs <blind-dir>
// Expects <blind-dir>/keys/passN.json and <blind-dir>/judge-passN.json.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dir = path.resolve(process.argv[2] || '');
const CATS = ['hierarchy', 'typography', 'copy_economy', 'component_polish', 'alignment_spacing', 'interaction_motion', 'responsive', 'identity'];
const who = p => (p.match(/\/(wingman|impeccable)(\/|$)/) || [, path.basename(path.dirname(p))])[1];
const totals = {}, pairings = [];
const bump = (cat, name, n = 1) => { totals[cat] ??= {}; totals[cat][name] = (totals[cat][name] || 0) + n; };
for (const pass of ['pass1', 'pass2']) {
  const keyFile = path.join(dir, 'keys', `${pass}.json`), judgeFile = path.join(dir, `judge-${pass}.json`);
  if (!existsSync(keyFile) || !existsSync(judgeFile)) continue;
  const key = JSON.parse(readFileSync(keyFile, 'utf8')), judged = JSON.parse(readFileSync(judgeFile, 'utf8'));
  for (const [prompt, labels] of Object.entries(key)) {
    const r = judged[prompt]; if (!r) continue;
    for (const cat of [...CATS, 'overall']) {
      const w = r[cat]?.winner;
      if (w === 'tie') { bump(cat, who(labels.A), 0.5); bump(cat, who(labels.B), 0.5); }
      else if (w === 'A' || w === 'B') bump(cat, who(labels[w]));
    }
    pairings.push({ pass, prompt, overall: r.overall?.winner ? who(labels[r.overall.winner]) : null, why: r.overall?.why });
  }
}
const result = { totals, pairings };
writeFileSync(path.join(dir, 'tally.json'), JSON.stringify(result, null, 2) + '\n');
for (const cat of [...CATS, 'overall']) console.log(cat.padEnd(20), JSON.stringify(totals[cat] || {}));
for (const p of pairings) console.log(`${p.pass} ${p.prompt.padEnd(16)} → ${p.overall}`);
