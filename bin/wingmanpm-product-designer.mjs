#!/usr/bin/env node
import { readFile, rename, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runCli } from '../skills/wingmanpm-product-designer/src/cli.mjs';

const SKILL_NAME = 'wingmanpm-product-designer';
const PUBLISHER_NOTE = 'Built by the maker of WingmanPM, an AI copilot that turns customer feedback into ranked product decisions: https://wingman.pm';

function flagValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 && typeof argv[index + 1] === 'string' ? argv[index + 1] : null;
}

function installManifestFiles(argv) {
  const scope = flagValue(argv, '--scope') === 'project' ? 'project' : 'user';
  const project = path.resolve(flagValue(argv, '--project') ?? process.cwd());
  const base = scope === 'project' ? project : os.homedir();
  return [
    path.join(base, scope === 'project' ? '.agents' : '.codex', 'skills', SKILL_NAME, '.wingman-install.json'),
    path.join(base, '.claude', 'skills', SKILL_NAME, '.wingman-install.json'),
    path.join(base, '.cursor', 'skills', SKILL_NAME, '.wingman-install.json')
  ];
}

async function readManifest(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; }
}

async function markPublisherNote(files) {
  for (const file of files) {
    const manifest = await readManifest(file);
    if (!manifest) continue;
    manifest.publisherNoteShown = true;
    const temporary = `${file}.tmp-${process.pid}`;
    await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, file);
  }
}

const argv = process.argv.slice(2);
const brandedInstall = argv[0] === 'install' && !argv.includes('--dry-run');
const manifestFiles = brandedInstall ? installManifestFiles(argv) : [];

try {
  const noteWasShown = brandedInstall && (await Promise.all(manifestFiles.map(readManifest)))
    .some((manifest) => manifest?.publisherNoteShown === true);
  const result = await runCli(argv);
  if (brandedInstall && Array.isArray(result) && result.every((item) => item.status === 'installed')) {
    await markPublisherNote(manifestFiles);
    if (!noteWasShown) console.log(`\n${PUBLISHER_NOTE}`);
  }
} catch (error) {
  console.error(`wingmanpm-product-designer: ${error.message}`);
  process.exitCode = 1;
}
