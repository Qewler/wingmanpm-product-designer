#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const forbiddenDash = String['from' + 'CodePoint'](0x2000 + 0x14);
const forbiddenEnDash = String['from' + 'CodePoint'](0x2000 + 0x13);
const DEFAULT_GIT_MAX_BUFFER = 64 * 1024 * 1024;

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: options.encoding ?? 'utf8',
    maxBuffer: options.maxBuffer ?? DEFAULT_GIT_MAX_BUFFER
  });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const htmlDashPatterns = [
  new RegExp(['&', '(?:m|n)dash(?:;|(?=[^0-9a-z]|$))'].join(''), 'i'),
  new RegExp(['&#', '821[12](?:;|(?=[^0-9]|$))'].join('')),
  new RegExp(['&#', 'x0*201[34](?:;|(?=[^0-9a-f]|$))'].join(''), 'i')
];
const slashCharacter = String['from' + 'CharCode'](90 + 2);
const unicodeDashPattern = new RegExp(escapeRegex(slashCharacter) + 'u(?:0{0,4}201[34]|\\{0*201[34]\\})', 'i');
const cssDashPattern = new RegExp(escapeRegex(slashCharacter) + '0*201[34](?:\\s|(?=[^0-9a-f]|$))', 'i');

function additiveInteger(value) {
  let expression = value.replace(/\s+/g, '');
  while (expression.startsWith('(') && expression.endsWith(')')) expression = expression.slice(1, -1);
  const literal = '(?:0x[0-9a-f](?:_?[0-9a-f])*|[0-9](?:_?[0-9])*)';
  if (!new RegExp(`^[+-]?${literal}(?:[+-]${literal})*$`, 'i').test(expression)) return null;
  const terms = expression.match(new RegExp(`[+-]?${literal}`, 'gi')) ?? [];
  let total = 0;
  for (const term of terms) {
    const sign = term.startsWith('-') ? -1 : 1;
    const number = Number(term.replace(/^[+-]/, '').replaceAll('_', ''));
    if (!Number.isSafeInteger(number)) return null;
    total += sign * number;
  }
  return Number.isSafeInteger(total) ? total : null;
}

function containsConstructedDash(content) {
  const pattern = new RegExp([
    'String', '\\s*\\.\\s*', 'from', '(?:CodePoint|CharCode)',
    '\\s*\\(\\s*([0-9a-fx_+\\-\\s()]+)\\s*\\)'
  ].join(''), 'gi');
  return [...content.matchAll(pattern)].some((match) => {
    const value = additiveInteger(match[1]);
    return value === 0x2000 + 0x14 || value === 0x2000 + 0x13;
  });
}

function forbiddenRenderedDash(relative, content) {
  if (htmlDashPatterns.some((pattern) => pattern.test(content))) return true;
  const extension = path.extname(relative).toLowerCase();
  if (['.astro', '.cjs', '.js', '.jsx', '.json', '.mjs', '.svelte', '.ts', '.tsx', '.vue', '.yaml', '.yml'].includes(extension)
    && (unicodeDashPattern.test(content) || containsConstructedDash(content))) return true;
  return ['.astro', '.cjs', '.css', '.html', '.js', '.jsx', '.mjs', '.scss', '.svelte', '.ts', '.tsx', '.vue'].includes(extension) && cssDashPattern.test(content);
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
  new RegExp(['BEGIN ', '(?:RSA |EC |OPENSSH )?', 'PRIVATE KEY'].join('')),
  /github_pat_[A-Za-z0-9_]{20,}/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /glpat-[A-Za-z0-9_-]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{20,}/,
  /npm_[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /(?:OPENAI|ANTHROPIC|CURSOR|NPM)_API_KEY\s*=/
];
const privateProductPatterns = [
  new RegExp(['WingmanPM', 'Pure'].join('_'), 'i'),
  new RegExp(['WingmanPM', 'Lead', 'Hunter'].join('_'), 'i'),
  new RegExp(['WingmanPM', 'frontend'].join('_'), 'i'),
  new RegExp(['Pornstars', 'Database'].join('_'), 'i')
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
  if (['.npmrc', '.pypirc', 'credentials', 'credentials.json'].includes(parts.at(-1))) failures.push(`${relative}: credential configuration is tracked`);
  const buffer = await readFile(path.join(root, relative));
  const content = buffer.toString('utf8');
  if (localPathPatterns.some((pattern) => pattern.test(content))) failures.push(`${relative}: contains an absolute local path`);
  if (secretPatterns.some((pattern) => pattern.test(content))) failures.push(`${relative}: contains a secret-shaped value`);
  if (privateProductPatterns.some((pattern) => pattern.test(content))) failures.push(`${relative}: contains a private product or repository reference`);
  if (content.includes(forbiddenDash) || content.includes(forbiddenEnDash)) failures.push(`${relative}: contains forbidden long-dash output`);
  if (forbiddenRenderedDash(relative, content)) failures.push(`${relative}: contains an encoded forbidden long-dash output`);

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
if (privateProductPatterns.some((pattern) => pattern.test(history))) failures.push('Git history contains a private product or repository reference');

const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
if (packageJson.name !== 'wingmanpm-product-designer') failures.push('package.json must use the public package name');
if (packageJson.version !== '1.0.0') failures.push('package.json must use the public v1 version');
if (packageJson.private !== undefined) failures.push('package.json must not set private for the public release');
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

console.log(`Release-safety check passed: ${tracked.length} tracked files, no local paths, secret shapes, private product references, forbidden long-dash output, metadata, generated artifacts, or public-release drift.`);
