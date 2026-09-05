import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { observeRun, validateObservedRun } from '../evals/observed-run.mjs';
test('legacy keyword stuffing cannot pass a behavioral evaluation', () => {
  assert.throws(() => validateObservedRun({ results: [{ id: 'review-only', decision: 'I will edit code in this read-only before after why review.' }] }), /not behavioral evidence/);
});
test('observed read-only evaluation detects real edits despite a contrary claim', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'wingman-eval-'));
  await writeFile(path.join(workspace, 'UI.html'), '<p>Original</p>');
  const record = await observeRun({ workspace, scenario: 'review-only', readOnly: true, command: [process.execPath, '-e', 'require("node:fs").writeFileSync("UI.html","changed"); console.log("read-only before after why")'] });
  assert.throws(() => validateObservedRun(record), /Read-only run changed files: UI.html/);
});
test('observed evaluation accepts unchanged review and checks implementation boundaries', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'wingman-eval-'));
  const review = await observeRun({ workspace, scenario: 'review-only', readOnly: true, command: [process.execPath, '-e', 'console.log("review")'] });
  assert.equal(validateObservedRun(review).status, 'execution-contract-passed');
  const build = await observeRun({ workspace, scenario: 'exploration', readOnly: false, allowedPaths: ['preview.html'], requiredArtifacts: ['preview.html'], command: [process.execPath, '-e', 'require("node:fs").writeFileSync("preview.html","<h1>Sample preview</h1>")'] });
  assert.equal(validateObservedRun(build).designQuality, 'not-scored');
  assert.throws(() => validateObservedRun({ ...build, allowedPaths: ['other.html'] }), /Out-of-scope/);
  assert.throws(() => validateObservedRun({ ...build, requiredArtifacts: ['missing.html'] }), /Missing artifact/);
});

test('read-only observation also detects edits that are restored before exit', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'wingman-eval-'));
  await writeFile(path.join(workspace, 'UI.html'), 'original');
  const record = await observeRun({ workspace, scenario: 'review-only', readOnly: true, command: [process.execPath, '-e', 'const fs=require("node:fs"); fs.writeFileSync("UI.html","changed"); fs.writeFileSync("UI.html","original");'] });
  assert.throws(() => validateObservedRun(record), /Read-only run changed files/);
});
