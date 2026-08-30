#!/usr/bin/env node

import { access, readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillRoot = path.join(root, 'skills', 'wingmanpm-product-designer');
const expectedVersion = '1.0.0';
const wingmanDomain = ['https://wingman', '.pm'].join('');
const privateRepositoryName = ['WingmanPM', 'Pure'].join('_');
const localSchemaHost = ['wingmanpm', 'local'].join('.');
const privateRuleScheme = ['wingmanpm', '://'].join('');
const feedbackOperations = ['Feedback', 'operations'].join(' ');
const replyDomain = ['reply', 'domain'].join(' ');
const failures = [];

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

async function json(relative) {
  try { return JSON.parse(await readFile(path.join(root, relative), 'utf8')); }
  catch (error) {
    failures.push(`${relative}: ${error.message}`);
    return {};
  }
}

async function filesBelow(directory) {
  if (!(await exists(directory))) return [];
  const output = [];
  const ignoredDirectories = new Set(['.git', 'node_modules', 'storybook-static', 'test-results', 'dist']);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) output.push(...await filesBelow(target));
    else if (entry.isFile()) output.push(target);
  }
  return output;
}

function requireValue(condition, message) {
  if (!condition) failures.push(message);
}

const packageJson = await json('package.json');
const portable = await json('plugin.json');
const codex = await json('.codex-plugin/plugin.json');
const claude = await json('.claude-plugin/plugin.json');
const claudeMarketplace = await json('.claude-plugin/marketplace.json');
const codexMarketplace = await json('.agents/plugins/marketplace.json');
const commands = await json('skills/wingmanpm-product-designer/registry/commands.json');

requireValue(packageJson.name === 'wingmanpm-product-designer', 'package.json: public package name is not set');
requireValue(packageJson.version === expectedVersion, `package.json: version must be ${expectedVersion}`);
requireValue(packageJson.private === undefined, 'package.json: private must be removed');
requireValue(packageJson.scripts?.postinstall === undefined, 'package.json: postinstall is forbidden');
requireValue(packageJson.bin?.['wingmanpm-product-designer'] === './bin/wingmanpm-product-designer.mjs', 'package.json: branded executable is missing');
requireValue(packageJson.bin?.['wingman-design'] === './skills/wingmanpm-product-designer/bin/wingman-design.mjs', 'package.json: portable executable is missing');

for (const [name, manifest] of [['plugin.json', portable], ['.codex-plugin/plugin.json', codex], ['.claude-plugin/plugin.json', claude]]) {
  requireValue(manifest.name === 'wingmanpm-product-designer', `${name}: plugin name mismatch`);
  requireValue(manifest.version === expectedVersion, `${name}: version mismatch`);
  requireValue(manifest.mcpServers === undefined && manifest.apps === undefined, `${name}: v1 must remain skills-only`);
}
requireValue(portable.$schema === 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', 'plugin.json: wrong Agent Plugins schema');
requireValue(claudeMarketplace.name === 'wingmanpm', '.claude-plugin/marketplace.json: marketplace must be wingmanpm');
requireValue(claudeMarketplace.plugins?.[0]?.source === './', '.claude-plugin/marketplace.json: root plugin source must be ./');
requireValue(claudeMarketplace.version === expectedVersion, '.claude-plugin/marketplace.json: top-level version mismatch');
requireValue(claudeMarketplace.plugins?.[0]?.version === expectedVersion, '.claude-plugin/marketplace.json: plugin version mismatch');
requireValue(codexMarketplace.name === 'wingmanpm', '.agents/plugins/marketplace.json: marketplace must be wingmanpm');
requireValue(codexMarketplace.plugins?.[0]?.source?.source === 'local' && codexMarketplace.plugins?.[0]?.source?.path === './', '.agents/plugins/marketplace.json: root plugin source must be local path ./');
requireValue(commands.version === expectedVersion, 'registry/commands.json: version mismatch');

const skillFile = path.join(skillRoot, 'SKILL.md');
requireValue(await exists(skillFile), 'skills/wingmanpm-product-designer/SKILL.md: missing canonical skill');
requireValue(!(await exists(path.join(root, 'SKILL.md'))), 'SKILL.md: root duplicate must be removed');
if (await exists(skillFile)) {
  const skill = await readFile(skillFile, 'utf8');
  requireValue(new RegExp(`version:\\s*${expectedVersion.replaceAll('.', '\\.')}`).test(skill), 'SKILL.md: version mismatch');
}

for (const name of ['browser-evidence', 'commands', 'config', 'exceptions', 'review', 'table-contract']) {
  const schema = await json(`skills/wingmanpm-product-designer/schemas/${name}.schema.json`);
  requireValue(
    schema.$id === `https://raw.githubusercontent.com/Qewler/wingmanpm-product-designer/main/skills/wingmanpm-product-designer/schemas/${name}.schema.json`,
    `schemas/${name}.schema.json: public schema URL does not point at the canonical skill path`
  );
}

const publicRules = await json('skills/wingmanpm-product-designer/registry/rules.json');
for (const entry of publicRules.entries ?? []) {
  if (entry.source?.startsWith('https://github.com/Qewler/wingmanpm-product-designer/')) {
    requireValue(
      entry.source.includes('/blob/main/skills/wingmanpm-product-designer/references/'),
      `registry/rules.json: ${entry.id} does not point at the canonical public reference path`
    );
  }
}

for (const relative of ['README.md', 'LICENSE', 'NOTICE', 'PRIVACY.md', 'TERMS.md', 'SUPPORT.md', 'SECURITY.md', 'CHANGELOG.md', 'docs/publication-record.md']) {
  requireValue(await exists(path.join(root, relative)), `${relative}: missing public release document`);
}

const requiredPackageEntries = ['plugin.json', '.codex-plugin/', '.claude-plugin/', '.agents/plugins/', 'skills/', 'assets/', 'bin/', 'docs/'];
for (const entry of requiredPackageEntries) requireValue(packageJson.files?.includes(entry), `package.json: files must include ${entry}`);
for (const entry of ['evals/', 'fixtures/', 'tests/', 'showcase/']) requireValue(!packageJson.files?.includes(entry), `package.json: files must exclude ${entry}`);

const forbiddenPortableText = [
  wingmanDomain, privateRepositoryName, localSchemaHost, privateRuleScheme,
  'Built by the maker of WingmanPM', 'creator of WingmanPM', feedbackOperations, replyDomain
];
for (const file of await filesBelow(skillRoot)) {
  const buffer = await readFile(file);
  const content = buffer.toString('utf8');
  for (const value of forbiddenPortableText) {
    if (content.includes(value)) failures.push(`${path.relative(root, file)}: portable skill contains forbidden product or promotion text: ${value}`);
  }
}

const domainAllowed = [
  /^README\.md$/,
  /^bin\/wingmanpm-product-designer\.mjs$/,
  /^showcase\//
];
for (const file of await filesBelow(root)) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  if (relative.startsWith('.git/') || relative.includes('/node_modules/') || relative.startsWith('node_modules/')) continue;
  const content = (await readFile(file)).toString('utf8');
  if (content.includes(wingmanDomain) && !domainAllowed.some((pattern) => pattern.test(relative))) {
    failures.push(`${relative}: wingman.pm is outside an approved promotion surface`);
  }
}

const readme = await readFile(path.join(root, 'README.md'), 'utf8').catch(() => '');
requireValue(readme.includes('Product design judgment for coding agents'), 'README.md: launch promise is missing');
requireValue(readme.includes('npx plugins add Qewler/wingmanpm-product-designer'), 'README.md: canonical install command is missing');
requireValue(readme.includes('From the maker of WingmanPM'), 'README.md: approved maker block is missing');
requireValue(readme.includes('npx wingmanpm-product-designer@latest doctor --project /path/to/project'), 'README.md: portable doctor command is missing');

const readmeAssets = path.join(root, 'docs', 'assets', 'readme');
let assetBytes = 0;
for (const file of await filesBelow(readmeAssets)) assetBytes += (await stat(file)).size;
requireValue(assetBytes <= 3.5 * 1024 * 1024, `docs/assets/readme: ${assetBytes} bytes exceeds the 3.5 MB budget`);

const interfaceManifest = codex.interface ?? {};
for (const asset of [interfaceManifest.composerIcon, interfaceManifest.logo, interfaceManifest.logoDark, ...(interfaceManifest.screenshots ?? [])].filter(Boolean)) {
  requireValue(asset.startsWith('./'), `.codex-plugin/plugin.json: asset path must start with ./: ${asset}`);
  requireValue(await exists(path.join(root, asset)), `.codex-plugin/plugin.json: asset is missing: ${asset}`);
}

if (failures.length) {
  console.error(`Release validation failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Release validation passed: ${packageJson.name}@${expectedVersion}; portable skill, manifests, public documents, promotion boundaries, and assets are consistent.`);
