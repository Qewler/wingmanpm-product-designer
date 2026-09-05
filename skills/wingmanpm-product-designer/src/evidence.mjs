import { createHash } from 'node:crypto';
import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

const ignored = new Set(['.git', 'node_modules', '.next', '.cache', '.turbo', 'dist', 'build', 'coverage', 'storybook-static', 'test-results', 'baselines', 'explorations', '.tmp', '.wingmanpm-design', '.agents', '.claude', '.codex', '.cursor']);
const sourceExtensions = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs', '.css', '.scss', '.html', '.vue', '.svelte', '.astro', '.json', '.mdx'];
const sourceRoots = ['src', 'app', 'pages', 'components', 'stories', 'design-system/examples'];
const controls = ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb', 'tsconfig.json', 'jsconfig.json', 'DESIGN.md', 'PRODUCT.md', 'AGENTS.md', 'CLAUDE.md', 'design-system/DESIGN.md', 'design-system/PRODUCT.md', 'design-system/COMPONENTS.md', '.wingmanpm-design/config.json'];
const slash = p => p.split(path.sep).join('/');
async function exists(p) { try { await stat(p); return true; } catch { return false; } }

export async function projectPath(root, relative, { mustExist = true } = {}) {
  if (typeof relative !== 'string' || !relative.trim() || path.isAbsolute(relative) || relative.includes('\0')) throw new Error('Expected a project-relative path.');
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error(`Path leaves the project: ${relative}`);
  if (mustExist) {
    const actual = await realpath(resolved);
    const base = await realpath(root);
    if (!actual.startsWith(`${base}${path.sep}`)) throw new Error(`Symlink leaves the project: ${relative}`);
  }
  return resolved;
}

async function walk(root, directory, output, seen = new Set()) {
  if (!(await exists(directory))) return;
  const actual = await realpath(directory);
  if (actual !== root && !actual.startsWith(root + path.sep)) throw new Error(`Evidence path leaves project: ${directory}`);
  if (seen.has(actual)) return;
  seen.add(actual);
  const info = await stat(directory);
  if (!info.isDirectory()) { output.add(slash(path.relative(root, directory))); return; }
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.name.startsWith('.env')) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory() || entry.isSymbolicLink()) await walk(root, file, output, seen);
    else if (entry.isFile()) output.add(slash(path.relative(root, file)));
  }
}

async function resolveImport(root, importer, specifier) {
  if (/^(?:https?:|data:|node:|#)/.test(specifier)) return null;
  let base;
  if (specifier.startsWith('.')) base = path.resolve(root, path.dirname(importer), specifier);
  else if (specifier.startsWith('/')) base = path.resolve(root, 'public', specifier.slice(1));
  else return null;
  if (!base.startsWith(`${root}${path.sep}`)) return { uncertain: `External path from ${importer}` };
  for (const candidate of [base, ...sourceExtensions.map(ext => base + ext), ...sourceExtensions.map(ext => path.join(base, 'index' + ext))]) {
    if (await exists(candidate) && (await stat(candidate)).isFile()) {
      await projectPath(root, slash(path.relative(root, candidate)));
      return { file: slash(path.relative(root, candidate)) };
    }
  }
  return { uncertain: `Unresolved ${specifier} in ${importer}` };
}

/** Small conservative import graph. Unsupported aliases/dynamic imports widen proof. */
export async function evidencePlan(project, targets = []) {
  const root = await realpath(project);
  const all = new Set();
  let config = {};
  try { config = JSON.parse(await readFile(path.join(root, '.wingmanpm-design/config.json'), 'utf8')); } catch {}
  const roots = Array.isArray(config.scanRoots) ? config.scanRoots : sourceRoots;
  for (const relative of [...roots, 'design-system', 'public', '.storybook', 'tests/wingman-design']) {
    await walk(root, await projectPath(root, relative, { mustExist: false }), all);
  }
  const projectFiles = new Set();
  await walk(root, root, projectFiles);
  for (const file of projectFiles) if (sourceExtensions.includes(path.extname(file)) || /\.(?:png|jpe?g|webp|svg|avif|gif|woff2?|ttf|otf|mp4|webm)$/.test(file)) all.add(file);
  for (const entry of await readdir(root)) {
    if (/^(?:next|vite|tailwind|postcss|playwright|astro|svelte)\.config\./.test(entry) || /^playwright\./.test(entry)) all.add(entry);
  }
  for (const relative of controls) if (await exists(path.join(root, relative))) all.add(relative);
  // Shared configuration, tokens, and assets affect every consumer.
  const shared = [...all].filter(p => controls.includes(p) || /^(?:public\/|design-system\/tokens\/|\.storybook\/)/.test(p) || /(?:^|\/)(?:globals?|theme|tokens)\.(?:css|scss)$/.test(p) || !p.includes('/'));
  const warnings = [];
  let declaredPackages = new Set();
  try { const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')); declaredPackages = new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })); } catch {}
  const selected = new Set(shared);
  const visited = new Set();
  const graph = new Map();
  async function visit(relative) {
    if (visited.has(relative)) return;
    visited.add(relative);
    selected.add(relative);
    if (!sourceExtensions.includes(path.extname(relative)) || path.extname(relative) === '.json') return;
    const content = await readFile(await projectPath(root, relative), 'utf8');
    const specs = [...content.matchAll(/(?:\bfrom\s*|\bimport\s*|\brequire\s*\(\s*|\bimport\s*\(\s*)['"]([^'"]+)['"]|\b(?:src|href)\s*=\s*['"]([^'"]+)['"]|url\(\s*['"]?([^\s)'"#]+)['"]?\s*\)/g)].map(m => m[1] ?? m[2] ?? m[3]);
    if (/\b(?:import|require)\s*\(\s*(?!['"\s])/.test(content)) warnings.push(`Dynamic import in ${relative}`);
    const imports = [];
    for (let specifier of specs) {
      if (specifier.startsWith('#')) { warnings.push(`Package import or fragment ${specifier} in ${relative}`); continue; }
      specifier = specifier.split(/[?#]/)[0];
      if (!specifier || (specifier.startsWith('/') && !path.extname(specifier))) continue;
      // Package dependencies are covered by the manifest/lockfile. Aliases are not guessed.
      if (/^(?:@\/|~\/|\$lib\/)/.test(specifier) || (!specifier.startsWith('.') && !specifier.startsWith('/') && !/^(?:node:|https?:|data:|#)/.test(specifier) && !declaredPackages.has(specifier.split('/').slice(0, specifier.startsWith('@') ? 2 : 1).join('/')) && !['fs', 'path', 'url', 'crypto', 'os', 'util', 'assert', 'stream', 'http', 'https', 'events'].includes(specifier))) { warnings.push(`Alias ${specifier} in ${relative}`); continue; }
      const resolved = await resolveImport(root, relative, specifier);
      if (resolved?.uncertain) warnings.push(resolved.uncertain);
      if (resolved?.file) { imports.push(resolved.file); await visit(resolved.file); }
    }
    graph.set(relative, imports);
  }
  const normalized = [];
  for (const target of targets) {
    const relativeTarget = path.isAbsolute(target) ? path.relative(root, await realpath(target)) : target;
    const absolute = await projectPath(root, relativeTarget);
    normalized.push(slash(path.relative(root, absolute)));
    const files = new Set(); await walk(root, absolute, files);
    for (const file of files) await visit(file);
  }
  const targetDependencies = new Set(selected);
  for (const file of all) if (sourceExtensions.includes(path.extname(file))) await visit(file);
  if (targets.length) {
    // Build graph for reverse consumers as well, so a shared component fans out.
    for (const file of all) if (sourceExtensions.includes(path.extname(file))) await visit(file);
    const affected = new Set(normalized);
    for (const target of normalized) for (const file of all) if (file.startsWith(target + '/')) affected.add(file);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [file, deps] of graph) if (!affected.has(file) && deps.some(dep => affected.has(dep))) { affected.add(file); changed = true; }
    }
    selected.clear();
    for (const file of targetDependencies) selected.add(file);
    const addDeps = file => { if (selected.has(file)) return; selected.add(file); for (const dep of graph.get(file) ?? []) addDeps(dep); };
    for (const file of affected) if (all.has(file)) addDeps(file);
  }
  const wide = !targets.length || warnings.length > 0 || normalized.some(target => shared.includes(target) || /^(?:design-system\/tokens|public)(?:\/|$)/.test(target));
  const files = [...(wide ? new Set([...all, ...selected]) : selected)].sort();
  const fingerprints = {};
  const hash = createHash('sha256');
  for (const file of files) {
    const bytes = await readFile(await projectPath(root, file));
    fingerprints[file] = createHash('sha256').update(bytes).digest('hex');
    hash.update(file).update('\0').update(fingerprints[file]).update('\0');
  }
  const sortedTargets = [...new Set(normalized)].sort();
  return { targets: sortedTargets, scope: wide ? 'project' : 'surface', sourceHash: hash.digest('hex'), files, fingerprints, warnings: [...new Set(warnings)], storyFiles: files.filter(p => /\.stories\.[cm]?[jt]sx?$/.test(p)), testFiles: files.filter(p => /(?:\.spec|\.test)\.[cm]?[jt]sx?$/.test(p)) };
}
