#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { validateObservedRun } from './observed-run.mjs';
if (!process.argv[2]) throw new Error('Usage: node evals/validate-agent-result.mjs <observed-run.json>');
console.log(JSON.stringify(validateObservedRun(JSON.parse(await readFile(process.argv[2], 'utf8'))), null, 2));
