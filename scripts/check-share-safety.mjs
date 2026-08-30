#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function git(args, options = {}) {
  return execFileSync('git', args, { cwd: root, encoding: options.encoding ?? 'utf8' });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const slash = escapeRegex(path.posix.sep);
const backslash = escapeRegex(path.win32.sep);
const localPathPatterns = [
  new RegExp(`${slash}${'Users'}${slash}[^\\s"'<>]+${slash}`),
  new RegExp(`${slash}${'home'}${slash}[^\\s"'<>]+${slash}`),
  new RegExp(`[A-Za-z]:${backslash}${'Users'}${backslash}[^\\s"'<>]+${backslash}`),
  new RegExp(`${slash}${'private'}${slash}${'tmp'}${slash}`),
  new RegExp(`${slash}${'var'}${slash}${'folders'}${slash}`)
];
const secretPatterns = [
  new RegExp(['sk', '-', '[A-Za-z0-9_-]{20,}'].join('')),
  new RegExp(['CLERK', '_SECRET', '_KEY', '\\s*='].join('')),
  new RegExp(['BEGIN ', '(?:RSA |EC |OPENSSH )?', 'PRIVATE KEY'].join(''))
];

const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean);
for (const relative of tracked) {
  const parts = relative.split('/');
  if (parts.some((part) => ['node_modules', 'storybook-static', 'test-results'].includes(part))) {
    failures.push(`${relative}: generated artifact is tracked`);
  }
  if (parts.at(-1) === '.DS_Store' || parts.at(-1)?.startsWith('._') || parts.at(-1)?.startsWith('.env')) {
    failures.push(`${relative}: local environment or OS file is tracked`);
  }
  const buffer = await readFile(path.join(root, relative));
  const content = buffer.toString('utf8');
  if (localPathPatterns.some((pattern) => pattern.test(content))) failures.push(`${relative}: contains an absolute local path`);
  if (secretPatterns.some((pattern) => pattern.test(content))) failures.push(`${relative}: contains a secret-shaped value`);

  if (relative.endsWith('.png')) {
    let offset = 8;
    while (offset + 12 <= buffer.length) {
      const length = buffer.readUInt32BE(offset);
      const type = buffer.toString('ascii', offset + 4, offset + 8);
      if (['tEXt', 'zTXt', 'iTXt', 'eXIf'].includes(type)) failures.push(`${relative}: PNG contains ${type} metadata`);
      offset += 12 + length;
      if (type === 'IEND') break;
    }
  }
}

const generated = [
  'node_modules',
  'fixtures/neutral-saas/node_modules',
  'fixtures/neutral-saas/storybook-static',
  'fixtures/neutral-saas/.wingmanpm-design/test-results'
];
for (const relative of generated) {
  try {
    await lstat(path.join(root, relative));
    failures.push(`${relative}: generated local artifact is present`);
  } catch {}
}

const ignoredFiles = git(['ls-files', '--others', '--ignored', '--exclude-standard', '-z']).split('\0').filter(Boolean);
for (const relative of ignoredFiles) failures.push(`${relative}: ignored local artifact is present`);

const history = git(['log', '-p', '--all', '--no-ext-diff', '--format=fuller']);
if (localPathPatterns.some((pattern) => pattern.test(history))) failures.push('Git history contains an absolute local path');
if (secretPatterns.some((pattern) => pattern.test(history))) failures.push('Git history contains a secret-shaped value');

const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
if (packageJson.private !== true) failures.push('package.json must stay private during version one');
for (const excluded of ['evals', 'fixtures', 'tests']) {
  if ((packageJson.files ?? []).some((entry) => entry.replace(/\/$/, '') === excluded)) failures.push(`npm package allowlist includes ${excluded}`);
}
const approvedRemoteUrls = new Set([
  'https://github.com/Qewler/wingmanpm-product-designer',
  'https://github.com/Qewler/wingmanpm-product-designer.git',
  'git@github.com:Qewler/wingmanpm-product-designer',
  'git@github.com:Qewler/wingmanpm-product-designer.git'
]);
const remoteNames = git(['remote']).trim().split('\n').filter(Boolean);
for (const remoteName of remoteNames) {
  if (remoteName !== 'origin') failures.push(`Unexpected Git remote name: ${remoteName}`);
  const remoteUrls = new Set([
    ...git(['remote', 'get-url', '--all', remoteName]).trim().split('\n'),
    ...git(['remote', 'get-url', '--push', '--all', remoteName]).trim().split('\n')
  ].filter(Boolean));
  for (const remoteUrl of remoteUrls) {
    if (!approvedRemoteUrls.has(remoteUrl)) failures.push(`Unexpected Git remote URL for ${remoteName}: ${remoteUrl}`);
  }
}
if (git(['status', '--porcelain']).trim()) failures.push('Git working tree is not clean');

const xattr = spawnSync('xattr', ['-h'], { encoding: 'utf8' });
if (xattr.error?.code !== 'ENOENT') {
  for (const relative of tracked) {
    const result = spawnSync('xattr', [path.join(root, relative)], { encoding: 'utf8' });
    const attributes = result.stdout?.split('\n').map((item) => item.trim()).filter(Boolean)
      .filter((item) => item !== 'com.apple.provenance') ?? [];
    if (attributes.length) failures.push(`${relative}: non-provenance extended attributes are present`);
  }
}

if (failures.length) {
  console.error(`Share-safety check failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Share-safety check passed: ${tracked.length} tracked files, no local paths, secret shapes, metadata, generated artifacts, or private-release drift.`);
