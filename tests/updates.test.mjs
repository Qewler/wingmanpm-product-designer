import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { updateSkill, verifyBundle, bundleInventory } from '../skills/wingmanpm-product-designer/src/update.mjs';

const name = 'wingmanpm-product-designer';
const hash = data => createHash('sha256').update(data).digest('hex');
function releaseFiles(version, extra = {}) {
  const files = {
    'SKILL.md': `---\nname: ${name}\nversion: ${version}\n---\nNew instructions`,
    'bin/wingman-design.mjs': `console.log('${version}')`,
    'registry/commands.json': JSON.stringify({ version, intents: [] }),
    'src/runtime.mjs': 'export const sample = true;',
    'references/setup.md': 'Setup guide',
    'schemas/commands.schema.json': '{}',
    'templates/example.html': '<p>Sample</p>',
    ...extra
  };
  files['bundle-manifest.json'] = JSON.stringify({ name, version, files: Object.fromEntries(Object.entries(files).map(([file, data]) => [file, hash(data)])) });
  return files;
}
function tarball(files) {
  const pieces = [];
  for (const [file, data] of Object.entries(files)) {
    const bytes = Buffer.from(data);
    const header = Buffer.alloc(512);
    const full = `package/skills/${name}/${file}`;
    const split = full.lastIndexOf('/');
    const short = full.length > 100 ? full.slice(split + 1) : full;
    header.write(short, 0, 100);
    if (full.length > 100) header.write(full.slice(0, split), 345, 155);
    header.write('0000644\0', 100, 8);
    header.write(bytes.length.toString(8).padStart(11, '0') + '\0', 124, 12);
    header.fill(32, 148, 156); header[156] = 48;
    header.write('ustar\0', 257, 6);
    header.write([...header].reduce((sum, n) => sum + n, 0).toString(8).padStart(6, '0') + '\0 ', 148, 8);
    pieces.push(header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512));
  }
  return gzipSync(Buffer.concat([...pieces, Buffer.alloc(1024)]));
}
function transport(files = releaseFiles('1.1.0'), release = '1.1.0') {
  const archive = tarball(files);
  const metadata = { name, version: release, engines: { node: '>=20' }, dist: { tarball: `https://registry.npmjs.org/${name}/-/${name}-${release}.tgz`, integrity: `sha512-${createHash('sha512').update(archive).digest('base64')}` } };
  return { metadata: async () => metadata, archive: async () => archive, document: metadata };
}
async function installed(owner = 'standalone') {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'wingman-update-test-'));
  const relative = owner === 'standalone' ? `.agents/skills/${name}` : owner === 'development' ? `source/skills/${name}` : `.${owner}/plugins/cache/wingmanpm/${name}/1.0.0/skills/${name}`;
  const root = path.join(temp, relative);
  for (const [file, content] of Object.entries(releaseFiles('1.0.0', { 'old.txt': 'Keep in backup' }))) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), content);
  }
  return root;
}

test('a clean standalone skill updates completely and retains a usable backup', async () => {
  const root = await installed();
  const result = await updateSkill(root, { auto: true }, transport());
  assert.equal(result.status, 'updated'); assert.equal(result.current, '1.1.0');
  assert.equal((await verifyBundle(root)).clean, true);
  assert.equal((await verifyBundle(result.backup)).version, '1.0.0');
  assert.equal(await readFile(path.join(result.backup, 'old.txt'), 'utf8'), 'Keep in backup');
  await assert.rejects(readFile(path.join(root, 'old.txt')), /ENOENT/);
  assert.equal(result.reload, await realpath(path.join(root, 'SKILL.md')));
});

test('changed, missing, and extra files block automatic replacement', async () => {
  for (const change of ['changed', 'missing', 'extra']) {
    const root = await installed();
    if (change === 'changed') await writeFile(path.join(root, 'SKILL.md'), 'Local edits');
    if (change === 'missing') await rm(path.join(root, 'old.txt'));
    if (change === 'extra') await writeFile(path.join(root, 'custom.md'), 'Local instructions');
    const before = await bundleInventory(root);
    const result = await updateSkill(root, { auto: true }, transport());
    assert.equal(result.status, 'local-edits', change);
    assert.deepEqual(await bundleInventory(root), before);
  }
});

test('integrity errors, unsafe paths, and a broken runtime leave the old copy intact', async () => {
  const cases = [
    { ...transport(), archive: async () => Buffer.from('bad download') },
    transport(releaseFiles('1.1.0', { '../escape.txt': 'Do not write' })),
    transport(releaseFiles('1.1.0', { 'bin/wingman-design.mjs': 'process.exit(1)' }))
  ];
  for (const deps of cases) {
    const root = await installed(); const before = await bundleInventory(root);
    const result = await updateSkill(root, { auto: true }, deps);
    assert.equal(result.status, 'update-unavailable', result.detail);
    assert.deepEqual(await bundleInventory(root), before);
  }
});

test('checks cache release metadata, never downgrade, and honor disabled updates', async () => {
  const root = await installed(); let calls = 0;
  const deps = transport(); const fetchMetadata = deps.metadata;
  deps.metadata = async () => { calls++; return fetchMetadata(); };
  assert.equal((await updateSkill(root, {}, deps)).status, 'available');
  assert.equal((await updateSkill(root, {}, deps)).status, 'available');
  assert.equal(calls, 1);
  await updateSkill(root, { enabled: false }, deps);
  assert.equal((await updateSkill(root, { auto: true, force: true }, deps)).status, 'disabled');
  assert.equal(calls, 1);
  await updateSkill(root, { enabled: true }, deps);
  assert.equal((await updateSkill(root, { auto: true, force: true }, transport(releaseFiles('0.9.0'), '0.9.0'))).status, 'current');
  assert.equal((await verifyBundle(root)).version, '1.0.0');
});

test('read-only checks do not write files; development and offline operation continue', async () => {
  const root = await installed(); const before = await readdir(root);
  assert.equal((await updateSkill(root, { auto: true, readOnly: true }, transport())).status, 'available');
  assert.deepEqual(await readdir(root), before);
  const development = await installed('development');
  assert.equal((await updateSkill(development, { auto: true }, { metadata: () => { throw new Error('Must not call'); } })).status, 'development');
  const offline = await updateSkill(root, { auto: true, force: true }, { metadata: async () => { throw new Error('Offline'); } });
  assert.equal(offline.continueWithInstalled, true);
  assert.equal((await verifyBundle(root)).version, '1.0.0');
});

test('native plugin updates stay with the owning manager and report reload needs', async () => {
  for (const owner of ['codex', 'claude', 'cursor']) {
    const root = await installed(owner); const calls = [];
    const deps = { ...transport(), runManager: async args => { calls.push(args); return { status: 0 }; } };
    const result = await updateSkill(root, { auto: true }, deps);
    assert.equal(result.status, owner === 'cursor' ? 'host-managed' : 'restart-required');
    assert.equal(calls.length, owner === 'codex' ? 2 : owner === 'claude' ? 1 : 0);
    assert.equal((await verifyBundle(root)).version, '1.0.0'); // No direct cache rewrite.
  }
});

test('a new Node requirement does not trigger a runtime or package downgrade', async () => {
  const root = await installed(); const deps = transport(); deps.document.engines.node = '>=99';
  assert.equal((await updateSkill(root, { auto: true }, deps)).status, 'runtime-required');
  assert.equal((await verifyBundle(root)).version, '1.0.0');
});

test('a custom native marketplace never installs a second canonical plugin', async () => {
  const root = await installed('codex');
  const custom = root.replace(path.join('cache', 'wingmanpm'), path.join('cache', 'custom-market'));
  await mkdir(path.dirname(custom), { recursive: true });
  const { rename } = await import('node:fs/promises');
  await rename(root, custom);
  const result = await updateSkill(custom, { auto: true }, { ...transport(), runManager: async () => { throw new Error('Must not call another marketplace'); } });
  assert.equal(result.status, 'host-managed');
});
