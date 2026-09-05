import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, writeFile, symlink, realpath } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveRequest } from '../skills/wingmanpm-product-designer/src/intents.mjs';
import { evidencePlan } from '../skills/wingmanpm-product-designer/src/evidence.mjs';
import { runChecks } from '../skills/wingmanpm-product-designer/src/checker.mjs';
import { readContext } from '../skills/wingmanpm-product-designer/src/context.mjs';
import { createExploration, chooseExploration, inspectExploration, serveExploration } from '../skills/wingmanpm-product-designer/src/explore.mjs';
import { checkStage, runProof } from '../skills/wingmanpm-product-designer/src/stages.mjs';

async function project() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'wingman-creative-'));
  for (const folder of ['src', 'public', '.tmp', '.wingmanpm-design']) await mkdir(path.join(root, folder));
  await writeFile(path.join(root, 'package.json'), '{"private":true}');
  await writeFile(path.join(root, 'src/Button.tsx'), 'export const Button=()=> <button type="button">Open</button>;');
  await writeFile(path.join(root, 'src/A.tsx'), 'import {Button} from "./Button"; export const A=()=> <Button/>;');
  await writeFile(path.join(root, 'src/B.tsx'), 'export const B=()=> <p>Other surface</p>;');
  await writeFile(path.join(root, 'src/A.stories.tsx'), 'import {A} from "./A"; export const Example={render:A};');
  return root;
}
async function spec(root) {
  for (const id of ['a', 'b']) await writeFile(path.join(root, `.tmp/${id}.html`), `<!doctype html><html lang="en"><title>Sample ${id}</title><button type="button">${id}</button></html>`);
  return { id: 'review', target: 'src/A.tsx', question: 'Which review flow?', identity: 'Preserve blue and white', content: 'Same Sample suggestions', recommended: 'a', reason: 'Fewer steps for frequent review', options: ['a', 'b'].map(id => ({ id, title: 'Direction ' + id, idea: 'Task idea ' + id, difference: 'Structure ' + id, tradeoff: 'Tradeoff ' + id, preview: `.tmp/${id}.html`, limits: 'Sample local state only' })) };
}

test('routing preserves raw paths, Unicode, URLs, and compound review scope', () => {
  for (const target of ['src/My UI/BillingPage.tsx', '/example/My App/screen.tsx', './src/screen.js', 'https://example.test/Case?value=A&B=2', 'src/Zażółć.tsx', 'src/𠮷田.tsx']) {
    assert.equal(resolveRequest(`polish ${target}`).target, target);
    assert.equal(resolveRequest(`review "${target}"`).target, target);
    assert.equal(resolveRequest(`make "${target}" beautiful`).target, target);
    assert.equal(resolveRequest('polish', { target }).target, target);
  }
  const review = resolveRequest('review forms and navigation');
  assert.equal(review.readOnly, true);
  assert.deepEqual(review.supportingReferences, ['references/forms.md#forms--form', 'references/navigation.md']);
  assert.equal(resolveRequest('review', { level: 'reimagine' }).stage, 'review');
  assert.equal(resolveRequest('explore the AI queue').stage, 'explore');
  assert.ok(resolveRequest('Help the dashboard feel confident').fallback);
});

test('package imports widen proof to include source outside configured roots', async () => {
  const root = await project();
  await writeFile(path.join(root, 'copy.js'), 'export default "Original";');
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ imports: { '#copy': './copy.js' } }));
  await writeFile(path.join(root, 'src/A.tsx'), 'import copy from "#copy"; export const A=()=>copy;');
  const before = await evidencePlan(root, [path.join(root, 'src/A.tsx')]);
  assert.equal(before.scope, 'project'); assert.ok(before.warnings.length);
  assert.ok(before.files.includes('copy.js'));
  await runProof(root, ['src/A.tsx'], [process.execPath, '-e', 'process.exit(0)']);
  await writeFile(path.join(root, 'copy.js'), 'export default "Changed";');
  assert.notEqual((await evidencePlan(root, ['src/A.tsx'])).sourceHash, before.sourceHash);
  assert.equal((await checkStage(root, { stage: 'build', target: 'src/A.tsx' })).proof.status, 'stale');
});

test('newer unrelated explorations cannot hide a saved choice for the target', async () => {
  const root = await project(); const proposal = await spec(root);
  await createExploration(root, proposal);
  await chooseExploration(root, proposal.id, 'a', 'User chose the faster flow');
  for (let i = 0; i < 13; i++) await createExploration(root, { ...proposal, id: `other-${i}`, target: 'src/B.tsx' });
  const context = await readContext(root, { target: await realpath(path.join(root, 'src/A.tsx')) });
  assert.equal(context.decisions.length, 1);
  assert.equal(context.decisions[0].selected, 'a');
});

test('proof ignores unrelated notes but follows imports, reverse consumers, assets, and locks', async () => {
  const root = await project();
  const first = await evidencePlan(root, ['src/A.tsx']);
  assert.equal(first.scope, 'surface');
  assert.ok(first.files.includes('src/Button.tsx'));
  assert.ok(first.storyFiles.includes('src/A.stories.tsx'));
  assert.equal(first.files.includes('src/B.tsx'), false);
  await writeFile(path.join(root, 'meeting-notes.md'), '# Meeting');
  assert.equal((await evidencePlan(root, ['src/A.tsx'])).sourceHash, first.sourceHash);
  await writeFile(path.join(root, 'src/B.tsx'), 'export const B=()=> <p>Changed sibling</p>;');
  assert.equal((await evidencePlan(root, ['src/A.tsx'])).sourceHash, first.sourceHash);
  await writeFile(path.join(root, 'src/Button.tsx'), 'export const Button=()=> <button type="button">Next</button>;');
  assert.notEqual((await evidencePlan(root, ['src/A.tsx'])).sourceHash, first.sourceHash);
  const component = await evidencePlan(root, ['src/Button.tsx']);
  assert.ok(component.files.includes('src/A.tsx'));
  assert.ok(component.files.includes('src/A.stories.tsx'));
  await writeFile(path.join(root, 'public/photo.webp'), 'new asset');
  assert.notEqual((await evidencePlan(root, ['src/Button.tsx'])).sourceHash, component.sourceHash);
  const assetHash = (await evidencePlan(root)).sourceHash;
  await writeFile(path.join(root, 'package-lock.json'), '{"lockfileVersion":3}');
  assert.notEqual((await evidencePlan(root)).sourceHash, assetHash);
});

test('unsupported dependency resolution widens the plan and exact targets cannot escape', async () => {
  const root = await project();
  await writeFile(path.join(root, 'src/A.tsx'), 'import Button from "@/Button";');
  const plan = await evidencePlan(root, ['src/A.tsx']);
  assert.equal(plan.scope, 'project'); assert.ok(plan.warnings.length);
  await assert.rejects(evidencePlan(root, ['../outside.tsx']));
  await assert.rejects(evidencePlan(root, ['src/missing.tsx']));
});

test('house rules are optional and visual source heuristics are advisory', async () => {
  const root = await project();
  const punctuation = String.fromCodePoint(0x2014);
  await writeFile(path.join(root, 'copy.md'), `# Repeated\n# Repeated\n${punctuation}`);
  await writeFile(path.join(root, 'src/A.tsx'), 'export const A=()=> <div className="grid grid-cols-3 transition-all" style={{color:"#abcdef"}}>' + '<article>Object</article>'.repeat(6) + '</div>');
  const report = await runChecks(root);
  for (const rule of ['WPD004', 'WPD005', 'WPD009', 'WPD021']) assert.ok(report.findings.some(f => f.ruleId === rule && f.severity === 'warn'), rule);
  await writeFile(path.join(root, '.wingmanpm-design/config.json'), JSON.stringify({ policy: { punctuation: 'off', uniqueHeadings: 'off' } }));
  const disabled = await runChecks(root);
  assert.equal(disabled.findings.some(f => f.ruleId === 'WPD021'), false);
  assert.equal(disabled.findings.some(f => f.file === 'copy.md' && f.ruleId === 'WPD022'), false);
});

test('exploration copies previews, protects existing sessions, and persists an explicit choice', async () => {
  const root = await project(); const proposal = await spec(root);
  const created = await createExploration(root, proposal);
  assert.ok((await readFile(created.board, 'utf8')).includes('Static board'));
  assert.equal((await checkStage(root, { stage: 'explore', id: 'review' })).releaseReady, false);
  await assert.rejects(createExploration(root, proposal), /already exists/);
  await chooseExploration(root, 'review', 'b', 'User prefers visible comparisons', 0);
  assert.equal((await inspectExploration(root, 'review')).selected, 'b');
  assert.equal((await readContext(root, { target: 'src/A.tsx' })).decisions[0].selected, 'b');
  await assert.rejects(chooseExploration(root, 'review', 'a', 'Stale page', 0), /stale/);
  await writeFile(path.join(root, '.tmp/a.html'), 'changed');
  await assert.rejects(chooseExploration(root, 'review', 'a', 'Changed sources', 1), /sources changed/);
});

test('preview input paths reject escape and hostile text is escaped in the board', async () => {
  const root = await project(); const proposal = await spec(root);
  proposal.question = '<script>bad()</script>';
  proposal.options[0].preview = '../outside.html';
  await assert.rejects(createExploration(root, proposal));
  proposal.options[0].preview = '.tmp/a.html';
  const result = await createExploration(root, proposal);
  const html = await readFile(result.board, 'utf8');
  assert.equal(html.includes('<script>bad()</script>'), false);
  assert.ok(html.includes('&lt;script&gt;'));
});

test('local board rejects cross-origin selection and arbitrary file reads', async () => {
  const root = await project(); await createExploration(root, await spec(root));
  const { server, url } = await serveExploration(root, 'review');
  try {
    assert.equal((await fetch(url + '/session.json')).status, 404);
    assert.equal((await fetch(url + '/choice', { method: 'POST', headers: { Origin: 'https://example.test' }, body: '{}' })).status, 403);
    const html = await (await fetch(url)).text();
    const token = html.match(/const token="([a-f0-9]+)"/)[1];
    const response = await fetch(url + '/choice', { method: 'POST', headers: { Origin: url, 'X-Wingman-Token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ option: 'a', reason: 'Test user chose faster review', revision: 0 }) });
    assert.equal(response.status, 200);
    assert.equal((await inspectExploration(root, 'review')).selected, 'a');
    const preview = await fetch(url + '/a-preview.html');
    assert.match(preview.headers.get('content-security-policy'), /connect-src 'none'/);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('scoped command evidence records failure, success, and freshness without claiming shipping', async () => {
  const root = await project();
  assert.equal((await runProof(root, ['src/A.tsx'], [process.execPath, '-e', 'process.exit(2)'])).status, 'failed');
  const passed = await runProof(root, ['src/A.tsx'], [process.execPath, '-e', 'process.exit(0)']);
  assert.equal(passed.status, 'passed'); assert.equal(passed.releaseReady, false);
  let report = await checkStage(root, { stage: 'build', target: 'src/A.tsx' });
  assert.equal(report.proof.status, 'passed'); assert.equal(report.releaseReady, false);
  await writeFile(path.join(root, 'src/A.tsx'), 'export const A=()=>null;');
  report = await checkStage(root, { stage: 'build', target: 'src/A.tsx' });
  assert.equal(report.proof.status, 'stale');
});
