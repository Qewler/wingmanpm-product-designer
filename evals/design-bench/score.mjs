#!/usr/bin/env node
// Scores benchmark outputs with the rendered anti-slop gates via the agent-browser CLI.
// Usage: node evals/design-bench/score.mjs <run-dir> [--only skill/prompt]
// <run-dir> holds <skill>/<prompt>/index.html. Writes score.json, desktop.png and
// mobile.png beside each page plus <run-dir>/summary.json.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessSlop, slopScript } from '../../skills/wingmanpm-product-designer/src/slop.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const runDir = path.resolve(process.argv[2] || '');
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
if (!existsSync(runDir)) { console.error('Run directory not found.'); process.exit(2); }
const prompts = JSON.parse(readFileSync(path.join(here, 'prompts.json'), 'utf8')).prompts;
const modeOf = Object.fromEntries(prompts.map(p => [p.id, p.mode]));

const tmp = mkdtempSync(path.join(os.tmpdir(), 'wpd-score-'));
const config = path.join(tmp, 'agent-browser.json');
writeFileSync(config, JSON.stringify({ autoConnect: false, headed: false, contentBoundaries: false, maxOutput: 4000000, defaultTimeout: 30000 }));
const session = `wpd-score-${process.pid}`;
const ab = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8', env: { ...process.env, AGENT_BROWSER_CONFIG: config, AGENT_BROWSER_COLOR_SCHEME: "light" }, maxBuffer: 64 * 1024 * 1024 });
const evalJS = source => { const file = path.join(tmp, 'eval.js'); writeFileSync(file, source); const raw = execFileSync('agent-browser', ['--session', session, 'eval', '--stdin'], { input: source, encoding: 'utf8', env: { ...process.env, AGENT_BROWSER_CONFIG: config, AGENT_BROWSER_COLOR_SCHEME: "light" }, maxBuffer: 64 * 1024 * 1024 }).trim(); let v = JSON.parse(raw); return typeof v === 'string' ? JSON.parse(v) : v; };
const settle = `(async () => { const h = () => document.documentElement.scrollHeight; for (let y = 0; y < h(); y += Math.round(innerHeight * 0.7)) { scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); } scrollTo(0, 0); await new Promise(r => setTimeout(r, 600)); await document.fonts.ready; return JSON.stringify(true); })()`;

const pages = [];
for (const skill of readdirSync(runDir, { withFileTypes: true }).filter(d => d.isDirectory())) for (const prompt of readdirSync(path.join(runDir, skill.name), { withFileTypes: true }).filter(d => d.isDirectory())) {
  const file = path.join(runDir, skill.name, prompt.name, 'index.html');
  if (existsSync(file) && (!only || only === `${skill.name}/${prompt.name}`)) pages.push({ skill: skill.name, prompt: prompt.name, file });
}

const summary = [];
try {
  for (const page of pages) {
    const dir = path.dirname(page.file), mode = modeOf[page.prompt] || 'auto';
    let result;
    try {
      ab('set', 'viewport', '1440', '900'); ab('open', `file://${page.file}`); ab('wait', '800'); evalJS(settle);
      ab('screenshot', '--full', path.join(dir, 'desktop.png'));
      ab('screenshot', path.join(dir, 'desktop-fold.png'));
      const desktop = evalJS(slopScript({ probe: true }));
      ab('set', 'viewport', '390', '844'); ab('open', `file://${page.file}`); ab('wait', '800'); evalJS(settle);
      ab('screenshot', '--full', path.join(dir, 'mobile.png'));
      const mobile = evalJS(slopScript({ probe: false }));
      const d = assessSlop(desktop.snapshot, desktop.probe, mode);
      const m = assessSlop(mobile.snapshot, null, mode).findings.filter(f => ['page-overflow', 'control-misalign', 'card-paragraph', 'small-target', 'clipped-control', 'covered-text', 'cramped-hero', 'outsized-display', 'split-headline', 'edge-cut-text', 'hidden-visible', 'clipped-text', 'control-contrast', 'truncated-text'].includes(f.code)).map(f => ({ ...f, width: 390 }));
      const findings = [...d.findings, ...m];
      result = { skill: page.skill, prompt: page.prompt, mode: d.mode, status: findings.some(f => f.severity === 'failure') ? 'failed' : findings.length ? 'warnings' : 'passed', failures: findings.filter(f => f.severity === 'failure').length, warnings: findings.filter(f => f.severity === 'warning').length, findings, metrics: { heroWords: desktop.snapshot.heroWords, bodyWords: desktop.snapshot.bodyWords, operateProse: desktop.snapshot.operateProse, headings: desktop.snapshot.headings.length, menusProbed: desktop.probe?.probed ?? 0 } };
    } catch (error) { result = { skill: page.skill, prompt: page.prompt, status: 'error', failures: 1, warnings: 0, findings: [{ code: 'score-error', severity: 'failure', message: String(error.message).slice(0, 300) }] }; }
    writeFileSync(path.join(dir, 'score.json'), JSON.stringify(result, null, 2) + '\n');
    summary.push({ skill: result.skill, prompt: result.prompt, status: result.status, failures: result.failures, warnings: result.warnings, codes: [...new Set(result.findings.filter(f => f.severity === 'failure').map(f => f.code))] });
    console.log(`${result.status.padEnd(8)} ${page.skill}/${page.prompt}  F${result.failures} W${result.warnings}  ${summary.at(-1).codes.join(' ')}`);
  }
} finally { try { ab('close'); } catch {} }
if (!only) writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
