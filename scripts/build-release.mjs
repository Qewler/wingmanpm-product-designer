#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const version = packageJson.version;
// Optional output directory keeps release artifacts outside a share-ready checkout.
const dist = path.resolve(process.argv[2] ?? path.join(root, 'dist'));
const baseName = `wingmanpm-product-designer-${version}`;

const bundles = [
  {
    name: `${baseName}-agent-plugin.zip`,
    entries: ['plugin.json', 'skills', 'assets', 'LICENSE', 'NOTICE']
  },
  {
    name: `${baseName}-codex-plugin.zip`,
    entries: ['.codex-plugin/plugin.json', 'skills', 'assets', 'LICENSE', 'NOTICE', 'PRIVACY.md', 'TERMS.md', 'SUPPORT.md']
  },
  {
    name: `${baseName}-openai-skills.zip`,
    entries: ['.claude-plugin/plugin.json', 'skills', 'LICENSE', 'NOTICE', 'PRIVACY.md', 'TERMS.md', 'SUPPORT.md']
  }
];

await mkdir(dist, { recursive: true });
const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'wingman-release-'));
const checksums = [];

try {
  for (const bundle of bundles) {
    const staging = path.join(temporaryRoot, bundle.name.replace(/\.zip$/, ''));
    await mkdir(staging, { recursive: true });
    for (const relative of bundle.entries) {
      await cp(path.join(root, relative), path.join(staging, relative), { recursive: true, force: true });
    }
    const target = path.join(dist, bundle.name);
    await rm(target, { force: true });
    const zipped = spawnSync('/usr/bin/zip', ['-q', '-r', target, '.'], { cwd: staging, encoding: 'utf8' });
    if (zipped.status !== 0) throw new Error(`zip failed for ${bundle.name}: ${zipped.stderr || zipped.stdout}`);
    const digest = createHash('sha256').update(await readFile(target)).digest('hex');
    checksums.push(`${digest}  ${bundle.name}`);
  }
  await writeFile(path.join(dist, 'SHA256SUMS'), `${checksums.join('\n')}\n`);
  console.log(`Built ${bundles.length} release archives for ${packageJson.name}@${version}.`);
  for (const line of checksums) console.log(line);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
