#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { observeRun, validateObservedRun } from './observed-run.mjs';
if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node evals/record-agent-run.mjs <run-spec.json> <result.json>');
const spec = JSON.parse(await readFile(process.argv[2], 'utf8'));
const output = path.resolve(process.argv[3]);
const workspace = path.resolve(spec.workspace);
if (output === workspace || output.startsWith(workspace + path.sep)) throw new Error('Store evaluation results outside the measured workspace.');
const record = await observeRun(spec);
await writeFile(output, JSON.stringify(record, null, 2) + '\n');
console.log(JSON.stringify(validateObservedRun(record), null, 2));
