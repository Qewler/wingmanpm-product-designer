import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { evidencePlan, projectPath } from './evidence.mjs';
import { inspectExploration } from './explore.mjs';
import { resolveRequest } from './intents.mjs';

const hash = text => createHash('sha256').update(text).digest('hex');
const documents = ['AGENTS.md', 'PRODUCT.md', 'DESIGN.md', 'design-system/PRODUCT.md', 'design-system/DESIGN.md', 'design-system/COMPONENTS.md'];

/** Read-only, bounded context. This command does not write a cache or install tools. */
export async function readContext(root, { request, target, capabilities = {} } = {}) {
  const authority = [];
  for (const file of documents) {
    try {
      const absolute = await projectPath(root, file);
      if ((await stat(absolute)).size > 256_000) { authority.push({ file, read: 'on-demand', reason: 'large document' }); continue; }
      const text = await readFile(absolute, 'utf8');
      authority.push({ file, hash: hash(text).slice(0, 12) });
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  let pkg = {};
  try { pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const entries = await readdir(root);
  const manager = pkg.packageManager?.split('@')[0] ?? (entries.includes('pnpm-lock.yaml') ? 'pnpm' : entries.includes('yarn.lock') ? 'yarn' : entries.some(p => p.startsWith('bun.lock')) ? 'bun' : 'npm');
  const contract = request ? resolveRequest(request, { target }) : undefined;
  const plan = target ? await evidencePlan(root, [target]) : null;
  const sessions = [];
  const canonicalTarget = target ? await realpath(path.resolve(root, target)).catch(() => path.resolve(root, target)) : null;
  const directory = path.join(root, '.wingmanpm-design/explorations');
  let names = [];
  try { names = await readdir(directory); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  names = names.filter(name => /^[a-z][a-z0-9-]{0,63}$/.test(name));
  const dated = await Promise.all(names.map(async name => ({ name, mtime: (await stat(path.join(directory, name, 'session.json')).catch(() => ({ mtimeMs: 0 }))).mtimeMs })));
  names = dated.sort((a, b) => a.mtime - b.mtime).map(entry => entry.name);
  for (const name of names.reverse()) {
    try {
      const metadata = JSON.parse(await readFile(path.join(directory, name, 'session.json'), 'utf8'));
      if (target && await realpath(path.resolve(root, metadata.target)).catch(() => path.resolve(root, metadata.target)) !== canonicalTarget) continue;
      const session = await inspectExploration(root, name);
      sessions.push({ id: name, target: session.target, stage: session.stage, selected: session.selected, stale: session.stale.length > 0, decision: session.decision, preview: `.wingmanpm-design/explorations/${name}/board.html` });
      if (sessions.length === 3) break;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return {
    authority, packageManager: manager || 'inspect-lockfile',
    tools: { node: process.versions.node, scripts: Object.keys(pkg.scripts ?? {}).filter(s => /build|test|design|storybook/.test(s)).slice(0, 12) },
    capabilities: { browser: capabilities.browser ?? 'unknown', images: capabilities.images ?? 'unknown', selection: 'local-board-or-chat', reviewer: capabilities.reviewer ?? 'unknown' },
    contract,
    scope: plan ? { kind: plan.scope, hash: plan.sourceHash, files: plan.files.length, stories: plan.storyFiles.slice(0, 12), storyCount: plan.storyFiles.length, warnings: plan.warnings.slice(0, 5), warningCount: plan.warnings.length } : undefined,
    decisions: sessions.slice(-3),
    next: authority.length ? 'Read the relevant authority files if their hashes are new to this session. Load only the active reference.' : 'Inspect current UI and product facts; missing design documents do not authorize redesign.'
  };
}
