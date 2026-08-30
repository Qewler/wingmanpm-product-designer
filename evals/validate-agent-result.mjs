#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resultFile = path.resolve(process.argv[2] ?? path.join(root, 'evals', 'results', 'codex.json'));
const benchmarks = JSON.parse(await readFile(path.join(root, 'evals', 'benchmarks.json'), 'utf8')).benchmarks;
const payload = JSON.parse(await readFile(resultFile, 'utf8'));
const results = payload.results ?? payload;

if (!Array.isArray(results)) throw new Error('Agent result must contain a results array.');

const expectedIds = benchmarks.map((benchmark) => benchmark.id);
const actualIds = results.map((result) => result.id);
if (new Set(actualIds).size !== actualIds.length) throw new Error('Agent result contains duplicate benchmark IDs.');
if (expectedIds.some((id) => !actualIds.includes(id)) || actualIds.some((id) => !expectedIds.includes(id))) {
  throw new Error(`Benchmark IDs do not match. Expected: ${expectedIds.join(', ')}. Received: ${actualIds.join(', ')}.`);
}

const failures = [];
for (const benchmark of benchmarks) {
  const result = results.find((candidate) => candidate.id === benchmark.id);
  const evidence = [result.classification, result.decision, result.proof, result.risk]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const missing = benchmark.mustMention.filter((term) => !evidence.includes(term.toLowerCase()));
  if (missing.length) failures.push(`${benchmark.id}: ${missing.join(', ')}`);
}

if (failures.length) throw new Error(`Behavioral benchmark failed:\n${failures.join('\n')}`);
console.log(`Agent behavioral benchmark passed: ${results.length}/${benchmarks.length} scenarios in ${path.relative(root, resultFile)}.`);
