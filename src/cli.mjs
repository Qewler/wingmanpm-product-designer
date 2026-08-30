import { cp, lstat, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileTokenFile, compileTokens } from './tokens.mjs';
import {
  createLegacyBaseline, hashReviewSources, runChecks, validateConfig, validateTableContract
} from './checker.mjs';
import { listCommands, resolveRequest } from './intents.mjs';
import { planDataTableScaffold, applyDataTableScaffold } from './table-scaffold.mjs';
import {
  copyTemplateTree, exists, fileHash, listFiles, makeExecutable, managedBlock,
  parseArgs, readJson, relativeUnix, removeManagedBlock, sha256, upsertManagedBlock,
  writeAtomic, writeJsonAtomic
} from './utils.mjs';

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_NAME = 'wingmanpm-product-designer';
const POINTER_LABEL = SKILL_NAME;
const PROJECT_MANIFEST = '.wingmanpm-design/manifest.json';
const VERSION = '0.2.0-private.1';
const PROJECT_SCHEMA_VERSION = 2;
const DEFAULT_SCAN_ROOTS = ['src', 'app', 'pages', 'components', 'stories', 'design-system/examples'];

const help = `WingmanPM Product Designer ${VERSION}

Usage:
  wingman-design install [--agent all|codex|claude|cursor] [--scope user|project] [--project PATH] [--dry-run]
  wingman-design init [--project PATH] [--mode new-system|preserve] [--dry-run]
  wingman-design upgrade [--project PATH] [--dry-run]
  wingman-design add data-table [--project PATH] [--profile static|work|editable] [--id TABLE_ID] [--dry-run]
  wingman-design check [--project PATH] [--json] [--allow-pending-review]
  wingman-design check --record-review --reviewer NAME --confirm CHECKS [--project PATH]
  wingman-design doctor [--project PATH] [--json]
  wingman-design uninstall [--project PATH] [--agent all|codex|claude|cursor] [--scope user|project] [--dry-run]
  wingman-design commands [--json]
  wingman-design explain PHRASE [--explicit] [--level refine|elevate|reimagine] [--fix] [--json]
  wingman-design search TERMS [--domain NAME] [--json]

Required review confirmation list:
  keyboard,zoom200,reducedMotion,longContent,light,dark,axe,responsiveStates
  Work tables add: tableDensity,tableColumns,tablePagination,tableExpansion,tableBulk
  Editable tables add: tableEditing
`;

function logJsonOrText(value, json, formatter) {
  if (json) console.log(JSON.stringify(value, null, 2));
  else console.log(formatter(value));
}

function validateRoot(root) {
  const resolved = path.resolve(root);
  const parsed = path.parse(resolved);
  if (resolved === parsed.root || resolved === os.homedir()) {
    throw new Error(`Refusing broad project root: ${resolved}`);
  }
  return resolved;
}

async function detectProject(root) {
  const packageFile = path.join(root, 'package.json');
  const packageJson = await readJson(packageFile, {});
  const dependencies = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
  const hasReact = Boolean(dependencies.react);
  const hasNext = Boolean(dependencies.next);
  const hasTailwind = Boolean(dependencies.tailwindcss || await exists(path.join(root, 'tailwind.config.js')) || await exists(path.join(root, 'tailwind.config.ts')));
  const goldenStack = hasReact && hasNext && hasTailwind;
  const stack = [hasNext && 'Next.js', hasReact && 'React', hasTailwind && 'Tailwind'].filter(Boolean).join(' + ') || 'framework-neutral';
  return { packageFile, packageJson, goldenStack, stack };
}

function ownership(relative) {
  if (['design-system/PRODUCT.md', 'design-system/DESIGN.md', 'design-system/COMPONENTS.md'].includes(relative)) return 'user';
  if (relative.startsWith('design-system/surfaces/') || relative.startsWith('design-system/tables/') || relative === 'design-system/tokens/tokens.json') return 'user';
  if (relative.startsWith('src/') || relative.startsWith('.storybook/') || relative.startsWith('tests/wingman-design/')) return 'seeded';
  if (relative.includes('review.json') || relative.includes('baselines/') || relative.endsWith('table-inventory.json')) return 'observed';
  return 'managed';
}

async function recordCreated(manifest, root, target) {
  const relative = relativeUnix(root, target);
  manifest.entries.push({ path: relative, ownership: ownership(relative), action: 'created', hash: await fileHash(target) });
}

function upsertManifestEntry(manifest, entry) {
  const index = manifest.entries.findIndex((candidate) => candidate.path === entry.path);
  if (index >= 0) manifest.entries[index] = { ...manifest.entries[index], ...entry };
  else manifest.entries.push(entry);
}

async function runtimeAssets() {
  const schemas = (await readdir(path.join(SRC_ROOT, 'schemas')))
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({ source: path.join(SRC_ROOT, 'schemas', name), relative: `.wingmanpm-design/runtime/schemas/${name}` }));
  return [
    { source: path.join(SRC_ROOT, 'src', 'checker.mjs'), relative: '.wingmanpm-design/runtime/checker.mjs' },
    { source: path.join(SRC_ROOT, 'registry', 'rules.json'), relative: '.wingmanpm-design/runtime/rules.json' },
    ...schemas
  ];
}

async function syncRuntimeAssets(root, manifest, options = {}) {
  const changes = [];
  for (const asset of await runtimeAssets()) {
    const target = path.join(root, asset.relative);
    const expectedHash = await fileHash(asset.source);
    const priorEntry = manifest.entries?.find((entry) => entry.path === asset.relative);
    const currentHash = await exists(target) ? await fileHash(target) : null;
    const entryCurrent = priorEntry?.ownership === 'managed' && priorEntry?.hash === expectedHash;
    let status = null;
    if (currentHash === expectedHash) {
      if (!entryCurrent) status = 'record';
    } else if (!currentHash) {
      status = 'create';
    } else if (priorEntry?.ownership === 'managed' && priorEntry?.hash && currentHash === priorEntry.hash) {
      status = 'refresh';
    } else {
      throw new Error(`Refusing to replace a locally changed or unmanaged runtime asset: ${target}`);
    }
    if (!status) continue;
    const change = { target, relative: asset.relative, source: asset.source, expectedHash, status };
    changes.push(change);
    if (options.dryRun) continue;
    if (status !== 'record') {
      await mkdir(path.dirname(target), { recursive: true });
      await cp(asset.source, target);
    }
    upsertManifestEntry(manifest, { path: asset.relative, ownership: 'managed', action: 'created', hash: expectedHash });
  }
  return changes;
}

async function tableContracts(root) {
  const directory = path.join(root, 'design-system', 'tables');
  if (!(await exists(directory))) return [];
  const results = [];
  for (const name of (await readdir(directory)).filter((item) => item.endsWith('.json')).sort()) {
    const file = path.join(directory, name);
    try {
      results.push({ file, contract: await readJson(file), error: null });
    } catch (error) {
      results.push({ file, contract: null, error: error.message });
    }
  }
  return results;
}

function literalAttribute(tag, names) {
  for (const name of names) {
    const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
    if (match) return match[1];
  }
  return null;
}

function declaredTables(content) {
  const declarations = [];
  for (const match of content.matchAll(/<(?:DataTable|DataGrid|[A-Z][A-Za-z0-9.]*(?:DataTable|DataGrid)|table)\b[^>]*>/gs)) {
    const id = literalAttribute(match[0], ['data-wingman-table-id', 'tableId']);
    const profile = literalAttribute(match[0], ['data-wingman-table-profile', 'profile']);
    declarations.push({ id, profile });
  }
  if (declarations.length === 0 && /\buseReactTable\s*\(/.test(content)) declarations.push({ id: null, profile: null });
  return declarations;
}

function isGenericWingmanRuntime(relative) {
  const normalized = `/${relative.split('\\').join('/')}`;
  return normalized.includes('/components/wingman-design/') && !normalized.includes('/components/wingman-design/tables/');
}

async function discoverTables(root, config, { markLegacy = false } = {}) {
  const roots = Array.isArray(config?.scanRoots) && config.scanRoots.every((item) => typeof item === 'string')
    ? config.scanRoots
    : DEFAULT_SCAN_ROOTS;
  const contractProfiles = new Map();
  for (const { contract, error } of await tableContracts(root)) {
    if (error || validateTableContract(contract).some((issue) => issue.severity === 'block')) continue;
    contractProfiles.set(contract.id, contract.profile);
  }
  const discovered = [];
  for (const scanRoot of roots) {
    const target = path.join(root, scanRoot);
    if (!(await exists(target))) continue;
    const candidates = (await stat(target)).isDirectory() ? await listFiles(target) : [target];
    for (const file of candidates) {
      if (!['.html', '.jsx', '.tsx'].includes(path.extname(file))) continue;
      const relative = relativeUnix(root, file);
      if (relative.includes('.stories.') || /(^|\/)(?:tests?|__tests__|fixtures)(\/|$)/.test(relative)) continue;
      if (isGenericWingmanRuntime(relative)) continue;
      const content = await readFile(file, 'utf8');
      if (!/<table\b|<(?:DataTable|DataGrid|[A-Z][A-Za-z0-9.]*(?:DataTable|DataGrid))\b|\buseReactTable\s*\(/.test(content)) continue;
      const declarations = declaredTables(content);
      const declaredProfiles = declarations.map(({ profile }) => profile).filter((profile) => ['static', 'work', 'editable'].includes(profile));
      const profile = declaredProfiles.includes('editable') || /contentEditable|inlineEditing|onCommitEdit|EditableCell/.test(content)
        ? 'editable'
        : declaredProfiles.includes('work') || /DataTable|DataGrid|useReactTable|rowSelection|bulk|pagination/i.test(content) ? 'work' : 'static';
      const declaredIds = [...new Set(declarations.map(({ id }) => id).filter(Boolean))];
      const fullyContracted = declarations.length > 0 && declarations.every(({ id, profile: declaredProfile }) =>
        Boolean(id && declaredProfile && contractProfiles.get(id) === declaredProfile)
      );
      const status = fullyContracted ? 'contracted' : markLegacy ? 'legacy' : 'inferred';
      discovered.push({
        id: declaredIds.length === 1
          ? declaredIds[0]
          : relative.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase(),
        file: relative,
        inferredProfile: profile,
        status,
        sourceHash: sha256(content),
        note: status === 'legacy'
          ? 'Unchanged legacy surface. Add a table contract before modifying this file.'
          : status === 'contracted'
            ? 'A matching table contract was found; the contract remains authoritative.'
            : 'Confirm the profile before changing this table. Existing behavior remains authoritative.'
      });
    }
  }
  return discovered;
}

async function mergeTableInventory(root, prior, discovered) {
  const existing = new Map((prior?.tables ?? []).filter((table) => table?.file).map((table) => [table.file, table]));
  const merged = [];
  const discoveredFiles = new Set(discovered.map((table) => table.file));
  for (const table of discovered) {
    const previous = existing.get(table.file);
    let next;
    if (previous?.status === 'legacy' && table.status !== 'contracted') {
      // A legacy source hash is a baseline, not a rolling observation. Never
      // refresh it after edits or a later upgrade would hide the change.
      next = { ...table, ...previous, file: table.file };
    } else if (previous?.status && previous.status !== 'inferred') {
      next = {
        ...previous,
        ...table,
        status: previous.status === 'legacy' ? 'contracted' : previous.status
      };
    } else {
      next = { ...previous, ...table };
    }
    merged.push(next);
  }
  for (const table of prior?.tables ?? []) {
    if (!table?.file || discoveredFiles.has(table.file) || table.status !== 'integration-required') continue;
    if (await exists(path.join(root, table.file))) merged.push(table);
  }
  return merged.sort((left, right) => left.file.localeCompare(right.file));
}

function inventoryNeedsWrite(prior, tables) {
  return !prior || prior.schemaVersion !== 1 || JSON.stringify(prior.tables ?? []) !== JSON.stringify(tables);
}

function tableInventoryError(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'must be a JSON object';
  if (value.schemaVersion !== 1) return 'must use schemaVersion 1';
  if (!Array.isArray(value.tables)) return 'tables must be an array';
  if (value.tables.some((table) => !table || typeof table !== 'object' || typeof table.file !== 'string' || !table.file)) {
    return 'every table entry must have a project-relative file';
  }
  if (value.tables.some((table) => table.status === 'legacy' && !/^[a-f0-9]{64}$/.test(table.sourceHash ?? ''))) {
    return 'every legacy table entry must have a SHA-256 sourceHash';
  }
  return null;
}

function normalizeV2Ownership(manifest) {
  let changed = false;
  for (const entry of manifest.entries ?? []) {
    let expected;
    if (entry.path?.startsWith('design-system/tables/')) expected = 'user';
    else if (entry.path?.endsWith('.wingmanpm-design/table-inventory.json') || entry.path === '.wingmanpm-design/table-inventory.json') expected = 'observed';
    if (expected && entry.ownership !== expected) {
      entry.ownership = expected;
      changed = true;
    }
  }
  return changed;
}

async function rollback(root, created, modified) {
  for (const target of created.reverse()) {
    try { await rm(target, { recursive: true, force: true }); } catch {}
  }
  for (const [target, content] of [...modified.entries()].reverse()) {
    try { await writeAtomic(target, content); } catch {}
  }
  const parents = new Set();
  for (const target of created) {
    let parent = path.dirname(target);
    while (parent.startsWith(`${root}${path.sep}`)) {
      parents.add(parent);
      parent = path.dirname(parent);
    }
  }
  for (const directory of [...parents].sort((left, right) => right.length - left.length)) {
    try { await rm(directory, { recursive: false }); } catch {}
  }
}

async function initProject(flags) {
  const root = validateRoot(flags.project ?? process.cwd());
  if (!(await exists(root))) throw new Error(`Project does not exist: ${root}`);
  const manifestFile = path.join(root, PROJECT_MANIFEST);
  if (await exists(manifestFile)) {
    try { await readJson(manifestFile); } catch (error) {
      throw new Error(`Project manifest is malformed; refusing to initialize over it: ${error.message}`);
    }
    return upgradeProject({ ...flags, project: root, fromInit: true });
  }
  const detected = await detectProject(root);
  const mode = flags.mode === 'preserve' ? 'preserve' : 'new-system';
  const values = {
    PRODUCT_NAME: path.basename(root),
    SYSTEM_MODE: mode,
    STACK: detected.stack,
    GOLDEN_STACK: detected.goldenStack ? 'true' : 'false',
    LEGACY_BASELINE: mode === 'preserve' ? 'true' : 'false'
  };
  const planned = [
    'design-system/PRODUCT.md', 'design-system/DESIGN.md', 'design-system/COMPONENTS.md',
    'design-system/surfaces/index.md', 'design-system/tokens/tokens.json',
    '.wingmanpm-design/config.json', '.wingmanpm-design/exceptions.json',
    '.wingmanpm-design/review.json', 'AGENTS.md', 'CLAUDE.md',
    '.cursor/rules/wingmanpm-product-designer.mdc'
  ];
  if (flags['dry-run']) {
    console.log(planned.map((entry) => `CREATE OR PRESERVE ${entry}`).join('\n'));
    return { status: 'dry-run', project: root, planned };
  }

  const created = [];
  const modified = new Map();
  const manifest = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    skill: SKILL_NAME,
    version: VERSION,
    createdAt: new Date().toISOString(),
    project: root,
    entries: [],
    adapters: [],
    packageScripts: [],
    packageDependencies: []
  };

  try {
    const onCreate = async (target) => {
      created.push(target);
      await recordCreated(manifest, root, target);
    };
    await copyTemplateTree(path.join(SRC_ROOT, 'templates', 'design-system'), path.join(root, 'design-system'), values, onCreate);
    await copyTemplateTree(path.join(SRC_ROOT, 'templates', 'project', '.wingmanpm-design'), path.join(root, '.wingmanpm-design'), values, onCreate);

    if (detected.goldenStack) {
      await copyTemplateTree(path.join(SRC_ROOT, 'templates', 'project', 'src'), path.join(root, 'src'), values, onCreate);
      await copyTemplateTree(path.join(SRC_ROOT, 'templates', 'project', '.storybook'), path.join(root, '.storybook'), values, onCreate);
      await copyTemplateTree(path.join(SRC_ROOT, 'templates', 'project', 'tests'), path.join(root, 'tests'), values, onCreate);
      await copyTemplateTree(path.join(SRC_ROOT, 'templates', 'project', 'root'), root, values, onCreate);
    } else {
      await copyTemplateTree(path.join(SRC_ROOT, 'templates', 'project', 'neutral'), path.join(root, 'design-system', 'examples'), values, onCreate);
    }

    const tokens = await readJson(path.join(root, 'design-system', 'tokens', 'tokens.json'));
    const compiled = compileTokens(tokens);
    for (const [name, content] of [
      ['tokens.css', compiled.css], ['tailwind.preset.mjs', compiled.tailwind], ['shadcn.css', compiled.shadcn]
    ]) {
      const target = path.join(root, 'design-system', 'tokens', name);
      if (!(await exists(target))) {
        await writeAtomic(target, content);
        await onCreate(target);
      }
    }

    for (const change of await syncRuntimeAssets(root, manifest)) {
      if (change.status === 'create') created.push(change.target);
    }

    const generatedConfig = await readJson(path.join(root, '.wingmanpm-design', 'config.json'), {});
    const generatedConfigIssues = validateConfig(generatedConfig, { allowLegacy: false }).filter((issue) => issue.severity === 'block');
    if (generatedConfigIssues.length) throw new Error(`Generated configuration is invalid: ${generatedConfigIssues.map((issue) => `${issue.path} ${issue.message}`).join('; ')}`);
    const inventoryTarget = path.join(root, '.wingmanpm-design', 'table-inventory.json');
    if (!(await exists(inventoryTarget))) {
      await writeJsonAtomic(inventoryTarget, {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        purpose: 'Discovery only. Confirm a table profile before changing its behavior.',
        tables: await discoverTables(root, generatedConfig)
      });
      await onCreate(inventoryTarget);
    }

    const pointer = managedBlock(POINTER_LABEL, `This project uses the WingmanPM Product Designer contract.\nRead design-system/PRODUCT.md and design-system/DESIGN.md before UI work.\nRun \`node .wingmanpm-design/runtime/checker.mjs --project .\` before completion.`);
    for (const filename of ['AGENTS.md', 'CLAUDE.md']) {
      const target = path.join(root, filename);
      if (await exists(target) && (await lstat(target)).isSymbolicLink()) {
        manifest.adapters.push({
          provider: filename === 'AGENTS.md' ? 'codex' : 'claude',
          path: filename,
          mode: 'symlink-preserved'
        });
        continue;
      }
      const before = (await exists(target)) ? await readFile(target, 'utf8') : '';
      if (before) modified.set(target, before); else created.push(target);
      const { next } = await upsertManagedBlock(target, pointer);
      manifest.adapters.push({ provider: filename === 'AGENTS.md' ? 'codex' : 'claude', path: filename, hash: sha256(next) });
    }

    const cursorTarget = path.join(root, '.cursor', 'rules', 'wingmanpm-product-designer.mdc');
    if (!(await exists(cursorTarget))) {
      const cursorRule = `---\ndescription: Apply the project design contract to SaaS product UI work\nglobs: [\"src/**/*.{ts,tsx,css}\", \"app/**/*.{ts,tsx,css}\"]\nalwaysApply: false\n---\n\nRead design-system/PRODUCT.md and design-system/DESIGN.md. Preserve business meaning. Run node .wingmanpm-design/runtime/checker.mjs --project . before completion.\n`;
      await writeAtomic(cursorTarget, cursorRule);
      created.push(cursorTarget);
      await recordCreated(manifest, root, cursorTarget);
    }
    manifest.adapters.push({ provider: 'cursor', path: relativeUnix(root, cursorTarget), hash: await fileHash(cursorTarget) });

    const hookTarget = path.join(root, '.git', 'hooks', 'pre-commit');
    if (await exists(path.join(root, '.git')) && (await lstat(path.join(root, '.git'))).isDirectory()) {
      const hookBlock = managedBlock(POINTER_LABEL, 'node ".wingmanpm-design/runtime/checker.mjs" --project "."', 'shell');
      const before = (await exists(hookTarget)) ? await readFile(hookTarget, 'utf8') : '';
      if (before) modified.set(hookTarget, before); else created.push(hookTarget);
      const { next } = await upsertManagedBlock(hookTarget, hookBlock, '#!/bin/sh\n');
      await makeExecutable(hookTarget);
      manifest.adapters.push({ provider: 'git', path: '.git/hooks/pre-commit', hash: sha256(next) });
    }

    if (await exists(detected.packageFile)) {
      const beforeText = await readFile(detected.packageFile, 'utf8');
      const packageJson = JSON.parse(beforeText);
      packageJson.scripts ??= {};
      const additions = {
        'design:check': 'node .wingmanpm-design/runtime/checker.mjs --project .',
        'design:doctor': 'wingman-design doctor --project .'
      };
      if (detected.goldenStack) {
        Object.assign(additions, {
          storybook: 'storybook dev -p 6006',
          'build-storybook': 'storybook build',
          'design:test:visual': 'playwright test --config playwright.wingman.config.ts'
        });
      }
      for (const [key, value] of Object.entries(additions)) {
        if (!(key in packageJson.scripts)) {
          manifest.packageScripts.push({ key, value, previous: null });
          packageJson.scripts[key] = value;
        }
      }
      if (detected.goldenStack) {
        packageJson.devDependencies ??= {};
        const designDependencies = {
          storybook: '^10.5.10',
          '@storybook/react': '^10.5.10',
          '@storybook/react-vite': '^10.5.10',
          '@storybook/addon-a11y': '^10.5.10',
          'vite': '8.0.16',
          '@playwright/test': '^1.62.1',
          '@axe-core/playwright': '^4.13.0'
        };
        for (const [key, value] of Object.entries(designDependencies)) {
          if (!(key in packageJson.devDependencies) && !(key in (packageJson.dependencies ?? {}))) {
            packageJson.devDependencies[key] = value;
            manifest.packageDependencies.push({ section: 'devDependencies', key, value });
          }
        }
      }
      const nextText = `${JSON.stringify(packageJson, null, 2)}\n`;
      if (nextText !== beforeText) {
        modified.set(detected.packageFile, beforeText);
        await writeAtomic(detected.packageFile, nextText);
      }
    }

    if (mode === 'preserve') {
      const baselineFile = path.join(root, '.wingmanpm-design', 'baseline.json');
      const legacyReport = await runChecks(root, { allowPendingReview: true, ignoreLegacyBaseline: true });
      await writeJsonAtomic(baselineFile, createLegacyBaseline(legacyReport.findings));
      await onCreate(baselineFile);
    }

    manifest.entries = manifest.entries.filter((entry, index, entries) => entries.findIndex((candidate) => candidate.path === entry.path) === index);
    normalizeV2Ownership(manifest);
    await writeJsonAtomic(manifestFile, manifest);
    console.log(`Initialized WingmanPM Product Designer in ${root}`);
    console.log(`Stack: ${detected.stack}; mode: ${mode}; seeded files are never overwritten.`);
    return { status: 'initialized', project: root, manifest };
  } catch (error) {
    await rollback(root, created, modified);
    throw error;
  }
}

async function upgradeProject(flags) {
  const root = validateRoot(flags.project ?? process.cwd());
  if (!(await exists(root))) throw new Error(`Project does not exist: ${root}`);
  const manifestFile = path.join(root, PROJECT_MANIFEST);
  if (!(await exists(manifestFile))) throw new Error(`No WingmanPM project manifest in ${root}. Run wingman-design init first.`);
  let manifest;
  try { manifest = await readJson(manifestFile); } catch (error) {
    throw new Error(`Project manifest is malformed: ${error.message}`);
  }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error(`Project manifest is invalid: ${manifestFile}`);
  const originalManifest = structuredClone(manifest);
  const upgradingLegacyProject = manifest.schemaVersion === 1 || /^0\.1(?:\.|$)/.test(String(manifest.version ?? ''));
  for (const key of ['entries', 'adapters', 'packageScripts', 'packageDependencies']) {
    if (manifest[key] !== undefined && !Array.isArray(manifest[key])) throw new Error(`Project manifest is invalid: ${key} must be an array.`);
    manifest[key] ??= [];
  }
  if (manifest.entries.some((entry) => !entry || typeof entry !== 'object' || typeof entry.path !== 'string')) {
    throw new Error('Project manifest is invalid: every entry must have a path.');
  }

  const configFile = path.join(root, '.wingmanpm-design', 'config.json');
  if (!(await exists(configFile))) throw new Error(`Project configuration is missing: ${configFile}`);
  let config;
  try { config = await readJson(configFile); } catch (error) {
    throw new Error(`Project configuration is malformed: ${error.message}`);
  }
  const nextConfig = {
    ...config,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    legacyBaseline: config.legacyBaseline ?? await exists(path.join(root, '.wingmanpm-design', 'baseline.json')),
    scanRoots: config.scanRoots ?? DEFAULT_SCAN_ROOTS
  };
  const configErrors = validateConfig(nextConfig, { allowLegacy: false }).filter((issue) => issue.severity === 'block');
  if (configErrors.length) {
    throw new Error(`Cannot upgrade invalid project configuration: ${configErrors.map((issue) => `${issue.path} ${issue.message}`).join('; ')}`);
  }

  const runtimeChanges = await syncRuntimeAssets(root, manifest, { dryRun: true });
  const inventoryFile = path.join(root, '.wingmanpm-design', 'table-inventory.json');
  const inventoryExists = await exists(inventoryFile);
  let priorInventory = null;
  if (inventoryExists) {
    try { priorInventory = await readJson(inventoryFile); } catch (error) {
      throw new Error(`Table inventory is malformed; refusing to replace it: ${error.message}`);
    }
    const inventoryProblem = tableInventoryError(priorInventory);
    if (inventoryProblem) throw new Error(`Table inventory is invalid; refusing to replace it: ${inventoryProblem}.`);
  }
  const discovered = await discoverTables(root, nextConfig, { markLegacy: upgradingLegacyProject });
  const inventoryTables = await mergeTableInventory(root, priorInventory, discovered);
  const inventoryChanged = inventoryNeedsWrite(priorInventory, inventoryTables);
  const inventory = inventoryChanged ? {
    ...(priorInventory ?? {}),
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    purpose: priorInventory?.purpose ?? 'Discovery only. Confirm a table profile before changing its behavior.',
    tables: inventoryTables
  } : priorInventory;
  const configChanged = JSON.stringify(config) !== JSON.stringify(nextConfig);

  const preview = structuredClone(manifest);
  for (const change of runtimeChanges) {
    upsertManifestEntry(preview, { path: change.relative, ownership: 'managed', action: 'created', hash: change.expectedHash });
  }
  const configHash = configChanged ? sha256(`${JSON.stringify(nextConfig, null, 2)}\n`) : await fileHash(configFile);
  upsertManifestEntry(preview, { path: relativeUnix(root, configFile), ownership: 'managed', action: 'created', hash: configHash });
  if (inventory) {
    const inventoryHash = inventoryChanged ? sha256(`${JSON.stringify(inventory, null, 2)}\n`) : await fileHash(inventoryFile);
    upsertManifestEntry(preview, { path: relativeUnix(root, inventoryFile), ownership: 'observed', action: 'created', hash: inventoryHash });
  }
  normalizeV2Ownership(preview);
  preview.schemaVersion = PROJECT_SCHEMA_VERSION;
  preview.version = VERSION;
  preview.entries = preview.entries.filter((entry, index, entries) => entries.findIndex((candidate) => candidate.path === entry.path) === index);
  const manifestChanged = JSON.stringify(preview) !== JSON.stringify(originalManifest);
  const planned = [
    ...runtimeChanges.map((change) => `${change.status.toUpperCase()} ${change.relative}`),
    ...(configChanged ? ['UPDATE .wingmanpm-design/config.json to schemaVersion 2'] : []),
    ...(inventoryChanged ? [`${inventoryExists ? 'UPDATE' : 'CREATE'} .wingmanpm-design/table-inventory.json`] : []),
    ...(manifestChanged ? [`UPDATE ${PROJECT_MANIFEST} to schemaVersion 2 and version ${VERSION}`] : [])
  ];
  if (flags['dry-run']) {
    console.log(planned.length ? planned.join('\n') : `CURRENT ${root}`);
    return { status: 'dry-run', project: root, planned, tables: inventoryTables };
  }

  const created = [];
  const modified = new Map();
  try {
    if (manifestChanged || runtimeChanges.length || configChanged || inventoryChanged) modified.set(manifestFile, await readFile(manifestFile, 'utf8'));
    if (configChanged) modified.set(configFile, await readFile(configFile, 'utf8'));
    if (inventoryChanged && inventoryExists) modified.set(inventoryFile, await readFile(inventoryFile, 'utf8'));
    for (const change of runtimeChanges) {
      if (change.status === 'refresh') modified.set(change.target, await readFile(change.target, 'utf8'));
      else if (change.status === 'create') created.push(change.target);
    }
    await syncRuntimeAssets(root, manifest);
    if (configChanged) await writeJsonAtomic(configFile, nextConfig);
    upsertManifestEntry(manifest, {
      path: relativeUnix(root, configFile), ownership: 'managed', action: 'created', hash: await fileHash(configFile)
    });

    if (inventoryChanged) {
      await writeJsonAtomic(inventoryFile, inventory);
      if (!inventoryExists) created.push(inventoryFile);
    }
    if (inventory) {
      upsertManifestEntry(manifest, {
        path: relativeUnix(root, inventoryFile), ownership: 'observed', action: 'created', hash: await fileHash(inventoryFile)
      });
    }

    manifest.schemaVersion = PROJECT_SCHEMA_VERSION;
    manifest.version = VERSION;
    normalizeV2Ownership(manifest);
    manifest.entries = manifest.entries.filter((entry, index, entries) =>
      entries.findIndex((candidate) => candidate.path === entry.path) === index
    );
    const changed = runtimeChanges.length > 0 || configChanged || inventoryChanged || manifestChanged;
    if (changed) {
      manifest.upgradedAt = new Date().toISOString();
      await writeJsonAtomic(manifestFile, manifest);
    }
    const refreshed = runtimeChanges.some((change) => change.status === 'refresh' || change.status === 'create');
    const status = flags.fromInit ? 'already-initialized' : 'upgraded';
    console.log(`${flags.fromInit ? 'Already initialized' : changed ? 'Upgraded' : 'Already current'}: ${root}${refreshed ? '; runtime refreshed' : '; runtime current'}`);
    return { status, project: root, manifest: PROJECT_MANIFEST, changed, runtimeRefreshed: refreshed, tables: inventoryTables };
  } catch (error) {
    await rollback(root, created, modified);
    throw error;
  }
}

async function recordReview(root, flags) {
  const reviewer = typeof flags.reviewer === 'string' ? flags.reviewer.trim() : '';
  const required = ['keyboard', 'zoom200', 'reducedMotion', 'longContent', 'light', 'dark', 'axe', 'responsiveStates'];
  const contracts = await tableContracts(root);
  if (contracts.some(({ contract }) => ['work', 'editable'].includes(contract?.profile))) {
    required.push('tableDensity', 'tableColumns', 'tablePagination', 'tableExpansion', 'tableBulk');
  }
  if (contracts.some(({ contract }) => contract?.profile === 'editable')) required.push('tableEditing');
  const confirmed = new Set(String(flags.confirm ?? '').split(',').map((item) => item.trim()).filter(Boolean));
  const missing = required.filter((item) => !confirmed.has(item));
  if (reviewer.length < 2 || missing.length) throw new Error(`Review recording needs --reviewer and all confirmations. Missing: ${missing.join(', ') || 'reviewer'}`);
  const report = await runChecks(root, { allowPendingReview: true });
  const otherBlocks = report.findings.filter((finding) => {
    if (finding.severity !== 'block' || finding.ruleId === 'WPD011') return false;
    if (finding.ruleId === 'WPD019' && finding.file === '.wingmanpm-design/review.json' && /Visual review evidence/.test(finding.message)) return false;
    return true;
  });
  if (otherBlocks.length) throw new Error(`Cannot record review while ${otherBlocks.length} non-review blocking findings remain.`);
  const review = {
    status: 'reviewed', reviewer, reviewedAt: new Date().toISOString(),
    sourceHash: await hashReviewSources(root), viewports: [390, 768, 1280, 1440],
    checks: Object.fromEntries(required.map((item) => [item, true])),
    notes: flags.notes ?? 'Explicit visual and interaction review confirmed by CLI operator.'
  };
  await writeJsonAtomic(path.join(root, '.wingmanpm-design', 'review.json'), review);
  console.log(`Recorded explicit review evidence for ${reviewer}.`);
}

async function checkProject(flags) {
  const root = validateRoot(flags.project ?? process.cwd());
  if (flags['record-review']) await recordReview(root, flags);
  const report = await runChecks(root, { allowPendingReview: Boolean(flags['allow-pending-review']) });
  logJsonOrText(report, Boolean(flags.json), (value) => [
    ...value.findings.map((finding) => `${finding.severity.toUpperCase()} ${finding.ruleId} ${finding.file}:${finding.line} ${finding.message}`),
    `WingmanPM design check: ${value.counts.block} block, ${value.counts.warn} warn, ${value.counts.excepted} excepted, ${value.counts.baselined} legacy.`
  ].join('\n'));
  if (report.counts.block) process.exitCode = 1;
  return report;
}

async function addProjectAsset(positional, flags) {
  const asset = positional.shift();
  if (asset !== 'data-table' || positional.length) {
    throw new Error('Add supports exactly one asset: data-table.');
  }
  const root = validateRoot(flags.project ?? process.cwd());
  const plan = await planDataTableScaffold(root, {
    profile: typeof flags.profile === 'string' ? flags.profile : 'work',
    tableId: typeof flags.id === 'string' ? flags.id : 'data-table'
  });
  const result = await applyDataTableScaffold(plan, { dryRun: Boolean(flags['dry-run']) });
  const headline = result.status === 'dry-run'
    ? 'Data table plan'
    : result.status === 'current'
      ? 'Data table current'
      : result.status === 'integration-required'
        ? 'Data table integration required'
        : 'Data table scaffolded';
  const lines = [
    `${headline}: ${result.tableId} (${result.profile})`,
    `Strategy: ${result.strategy}${result.existingGrid ? ` · preserve ${result.existingGrid}` : ''}`,
    ...result.operations.map((operation) => `${operation.type === 'preserve' ? 'PRESERVE' : 'CREATE'} ${relativeUnix(result.projectRoot, operation.target)}`),
    ...result.dependencies.map((dependency) => `DEPENDENCY ${dependency.key}@${dependency.value}`),
    ...result.warnings.map((warning) => `NOTE ${warning}`)
  ];
  console.log(lines.join('\n'));
  return result;
}

async function doctorProject(flags) {
  const root = validateRoot(flags.project ?? process.cwd());
  const checks = [];
  const push = (id, status, message) => checks.push({ id, status, message });
  const manifestFile = path.join(root, PROJECT_MANIFEST);
  let manifest = null;
  let manifestError = null;
  if (await exists(manifestFile)) {
    try { manifest = await readJson(manifestFile); } catch (error) { manifestError = error.message; }
  }
  push('manifest', manifest ? 'pass' : 'fail', manifest
    ? 'Managed manifest is present.'
    : manifestError ? `Managed manifest is malformed: ${manifestError}` : 'Managed manifest is missing.');
  if (manifest) {
    const current = manifest.schemaVersion === PROJECT_SCHEMA_VERSION && manifest.version === VERSION;
    push('manifest-version', current ? 'pass' : 'fail', current
      ? `Manifest uses schemaVersion ${PROJECT_SCHEMA_VERSION} and version ${VERSION}.`
      : `Manifest is stale; run wingman-design upgrade to reach schemaVersion ${PROJECT_SCHEMA_VERSION} and version ${VERSION}.`);
  }
  for (const filename of ['AGENTS.md', 'CLAUDE.md']) {
    const target = path.join(root, filename);
    const content = (await exists(target)) ? await readFile(target, 'utf8') : '';
    push(filename, content.includes(`<!-- ${POINTER_LABEL}:start -->`) ? 'pass' : 'fail', `${filename} managed pointer ${content.includes(`<!-- ${POINTER_LABEL}:start -->`) ? 'is present' : 'is missing'}.`);
  }
  const cursor = path.join(root, '.cursor', 'rules', 'wingmanpm-product-designer.mdc');
  push('cursor', await exists(cursor) ? 'pass' : 'fail', `Cursor rule ${await exists(cursor) ? 'is present' : 'is missing'}.`);
  const hook = path.join(root, '.git', 'hooks', 'pre-commit');
  const hookContent = (await exists(hook)) ? await readFile(hook, 'utf8') : '';
  push('hook', hookContent.includes(`# ${POINTER_LABEL}:start`) ? 'pass' : 'warn', hookContent.includes(`# ${POINTER_LABEL}:start`) ? 'Git hook is installed.' : 'Git hook is not installed or this is not a Git project.');

  const tokenFile = path.join(root, 'design-system', 'tokens', 'tokens.json');
  if (await exists(tokenFile)) {
    try {
      const expected = compileTokens(await readJson(tokenFile));
      for (const [name, content] of [['tokens.css', expected.css], ['tailwind.preset.mjs', expected.tailwind], ['shadcn.css', expected.shadcn]]) {
        const target = path.join(root, 'design-system', 'tokens', name);
        const actual = (await exists(target)) ? await readFile(target, 'utf8') : '';
        push(`tokens:${name}`, actual === content ? 'pass' : 'fail', `${name} ${actual === content ? 'matches' : 'has drift from'} the DTCG source.`);
      }
    } catch (error) {
      push('tokens', 'fail', `Token compilation failed: ${error.message}`);
    }
  } else push('tokens', 'fail', 'DTCG token source is missing.');

  for (const asset of await runtimeAssets()) {
    const target = path.join(root, asset.relative);
    const expectedHash = await fileHash(asset.source);
    const fileCurrent = await exists(target) && await fileHash(target) === expectedHash;
    const manifestEntry = manifest?.entries?.find((entry) => entry.path === asset.relative);
    const current = fileCurrent && manifestEntry?.ownership === 'managed' && manifestEntry?.hash === expectedHash;
    const id = asset.relative.endsWith('/checker.mjs') ? 'runtime' : `runtime:${path.basename(asset.relative)}`;
    push(id, current ? 'pass' : 'fail', current
      ? `${asset.relative} matches this CLI build.`
      : `${asset.relative} is missing or stale; run wingman-design upgrade with the current CLI.`);
  }

  const packageJson = await readJson(path.join(root, 'package.json'), {});
  const deps = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
  const configFile = path.join(root, '.wingmanpm-design', 'config.json');
  let config = {};
  let configError = null;
  try { config = await readJson(configFile); } catch (error) { configError = error.message; }
  const configIssues = configError ? [{ path: '$', message: `Malformed or missing JSON: ${configError}`, severity: 'block' }] : validateConfig(config);
  push('config', configIssues.some((issue) => issue.severity === 'block') ? 'fail' : configIssues.length ? 'warn' : 'pass',
    configIssues.length ? configIssues.map((issue) => `${issue.path} ${issue.message}`).join('; ') : 'Project configuration matches schema version 2.');

  const contracts = await tableContracts(root);
  const contractIssues = contracts.flatMap(({ file, contract, error }) => error
    ? [{ file: relativeUnix(root, file), path: '$', message: `Malformed JSON: ${error}`, severity: 'block' }]
    : validateTableContract(contract).map((issue) => ({ file: relativeUnix(root, file), ...issue }))
  );
  push('table-contracts', contractIssues.some((issue) => issue.severity === 'block') ? 'fail' : 'pass',
    contractIssues.length
      ? contractIssues.map((issue) => `${issue.file}${issue.path}: ${issue.message}`).join('; ')
      : `${contracts.length} table contract${contracts.length === 1 ? '' : 's'} validated.`);
  const inventoryFile = path.join(root, '.wingmanpm-design', 'table-inventory.json');
  const discoveredTables = await discoverTables(root, config);
  let savedInventory = null;
  let inventoryError = null;
  if (await exists(inventoryFile)) {
    try { savedInventory = await readJson(inventoryFile); } catch (error) { inventoryError = error.message; }
  }
  if (savedInventory && !inventoryError) inventoryError = tableInventoryError(savedInventory);
  const savedTables = Array.isArray(savedInventory?.tables) ? savedInventory.tables : [];
  const inventoriedFiles = new Set(savedTables.map((table) => table.file));
  const missingInventory = discoveredTables.filter((table) => !inventoriedFiles.has(table.file));
  const discoveredFiles = new Set(discoveredTables.map((table) => table.file));
  const staleInventory = [];
  for (const table of savedTables) {
    if (discoveredFiles.has(table.file)) continue;
    const integrationGuideExists = table.status === 'integration-required' && await exists(path.join(root, table.file));
    if (!integrationGuideExists) staleInventory.push(table);
  }
  push('table-inventory', inventoryError || (!savedInventory && discoveredTables.length) ? 'fail' : missingInventory.length || staleInventory.length ? 'warn' : 'pass',
    inventoryError
      ? `Table inventory is malformed: ${inventoryError}`
      : !savedInventory && discoveredTables.length
      ? `Table inventory is missing for ${discoveredTables.length} discovered surface(s); run wingman-design upgrade.`
      : missingInventory.length || staleInventory.length
        ? `${missingInventory.length} discovered table surface(s) are missing and ${staleInventory.length} saved table surface(s) are stale; review and refresh with upgrade.`
        : `${discoveredTables.length} discovered table surface(s) are inventoried.`);
  if (manifest && savedInventory) {
    const inventoryEntry = manifest.entries?.find((entry) => entry.path === '.wingmanpm-design/table-inventory.json');
    push('table-inventory-ownership', inventoryEntry?.ownership === 'observed' ? 'pass' : 'fail', inventoryEntry?.ownership === 'observed'
      ? 'Table inventory is recorded as observed evidence.'
      : 'Table inventory ownership is stale; run wingman-design upgrade.');
    const staleTableOwnership = (manifest.entries ?? []).filter((entry) => entry.path?.startsWith('design-system/tables/') && entry.ownership !== 'user');
    push('table-contract-ownership', staleTableOwnership.length ? 'fail' : 'pass', staleTableOwnership.length
      ? `${staleTableOwnership.length} table contract entries are not user-owned; run wingman-design upgrade.`
      : 'Recorded table contracts are user-owned.');
  }
  const storybookPackages = ['storybook', '@storybook/react', '@storybook/react-vite', '@storybook/addon-a11y'];
  const storybookVersions = storybookPackages.map((name) => deps[name]).filter(Boolean);
  const storybookMajors = new Set(storybookVersions.map((version) => String(version).match(/\d+/)?.[0]).filter(Boolean));
  const storybookFiles = await exists(path.join(root, '.storybook', 'main.ts')) && await exists(path.join(root, '.storybook', 'preview.ts'));
  if (config.goldenStack !== true) {
    const stackLabel = typeof config.stack === 'string' && config.stack.trim() ? ` (${config.stack.trim()})` : '';
    push('storybook', storybookVersions.length ? 'pass' : 'warn', storybookVersions.length ? 'Optional Storybook dependencies are present.' : `Storybook is optional for this non-golden-stack project${stackLabel}.`);
  } else if (storybookVersions.length !== storybookPackages.length || !storybookFiles) {
    push('storybook', 'fail', 'Golden-stack Storybook dependencies or configuration files are missing.');
  } else {
    push('storybook', storybookMajors.size === 1 ? 'pass' : 'fail', storybookMajors.size === 1 ? 'Storybook packages use one compatible major version.' : 'Storybook packages have major-version drift.');
  }
  push('playwright', deps['@playwright/test'] ? 'pass' : 'warn', 'Playwright dependency presence checked.');
  const report = await runChecks(root, { allowPendingReview: true });
  push('rules', report.counts.block ? 'fail' : 'pass', `${report.counts.block} blocking and ${report.counts.warn} warning findings.`);
  const result = { project: root, checks, counts: { fail: checks.filter((item) => item.status === 'fail').length, warn: checks.filter((item) => item.status === 'warn').length } };
  logJsonOrText(result, Boolean(flags.json), (value) => [
    ...value.checks.map((item) => `${item.status.toUpperCase()} ${item.id}: ${item.message}`),
    `Doctor: ${value.counts.fail} fail, ${value.counts.warn} warn.`
  ].join('\n'));
  if (result.counts.fail) process.exitCode = 1;
  return result;
}

function installRoots(scope, project) {
  if (scope === 'project') {
    const root = validateRoot(project ?? process.cwd());
    return {
      codex: path.join(root, '.agents', 'skills', SKILL_NAME),
      claude: path.join(root, '.claude', 'skills', SKILL_NAME),
      cursor: path.join(root, '.cursor', 'skills', SKILL_NAME)
    };
  }
  return {
    codex: path.join(os.homedir(), '.codex', 'skills', SKILL_NAME),
    claude: path.join(os.homedir(), '.claude', 'skills', SKILL_NAME),
    cursor: path.join(os.homedir(), '.cursor', 'skills', SKILL_NAME)
  };
}

function selectedAgents(agent = 'all') {
  if (agent === 'all') return ['codex', 'claude', 'cursor'];
  if (!['codex', 'claude', 'cursor'].includes(agent)) throw new Error(`Unknown agent: ${agent}`);
  return [agent];
}

async function installSkill(flags) {
  const scope = flags.scope === 'project' ? 'project' : 'user';
  const roots = installRoots(scope, flags.project);
  const agents = selectedAgents(flags.agent);
  const sourceEntries = ['SKILL.md', 'LICENSE', 'NOTICE', 'agents', 'references', 'registry', 'schemas'];
  const results = [];
  for (const agent of agents) {
    const destination = roots[agent];
    if (flags['dry-run']) {
      results.push({ agent, destination, status: 'planned' });
      continue;
    }
    const priorManifest = await readJson(path.join(destination, '.wingman-install.json'), null);
    if (await exists(destination)) {
      const priorFiles = await listFiles(destination, { ignored: [] });
      const unmanaged = priorFiles.filter((file) => !file.endsWith('.wingman-install.json'));
      if (unmanaged.length && !priorManifest) {
        throw new Error(`Refusing to replace an unmanaged skill directory: ${destination}`);
      }
      for (const item of priorManifest?.files ?? []) {
        const target = path.join(destination, item.path);
        if (await exists(target) && await fileHash(target) !== item.hash) {
          throw new Error(`Refusing to replace a changed installed skill file: ${target}`);
        }
      }
    }
    await mkdir(destination, { recursive: true });
    for (const entry of sourceEntries) {
      const source = path.join(SRC_ROOT, entry);
      if (await exists(source)) await cp(source, path.join(destination, entry), { recursive: true, force: true });
    }
    const installedFiles = await listFiles(destination, { ignored: [] });
    const manifest = {
      schemaVersion: 1, skill: SKILL_NAME, version: VERSION, agent, scope,
      source: SRC_ROOT, installedAt: new Date().toISOString(),
      files: await Promise.all(installedFiles.filter((file) => !file.endsWith('.wingman-install.json')).map(async (file) => ({ path: relativeUnix(destination, file), hash: await fileHash(file) })))
    };
    await writeJsonAtomic(path.join(destination, '.wingman-install.json'), manifest);
    results.push({ agent, destination, status: 'installed', files: manifest.files.length });
  }
  console.log(results.map((item) => `${item.agent}: ${item.status} at ${item.destination}`).join('\n'));
  return results;
}

async function uninstallSkill(flags) {
  const scope = flags.scope === 'project' ? 'project' : 'user';
  const roots = installRoots(scope, flags.project);
  const agents = selectedAgents(flags.agent);
  const results = [];
  for (const agent of agents) {
    const destination = roots[agent];
    const manifestFile = path.join(destination, '.wingman-install.json');
    const manifest = await readJson(manifestFile, null);
    if (!manifest) {
      results.push({ agent, status: 'not-installed', destination });
      continue;
    }
    const conflicts = [];
    const removable = [];
    for (const item of manifest.files ?? []) {
      const target = path.join(destination, item.path);
      if (!(await exists(target))) continue;
      if (await fileHash(target) === item.hash) removable.push(target);
      else conflicts.push(item.path);
    }
    if (flags['dry-run']) {
      results.push({ agent, status: 'planned', destination, removable: removable.length, conflicts });
      continue;
    }
    for (const target of removable) await rm(target, { force: true });
    if (!conflicts.length) {
      await rm(manifestFile, { force: true });
      const directories = ['agents', 'references', 'registry', 'schemas', destination];
      for (const relative of directories) {
        const target = relative === destination ? destination : path.join(destination, relative);
        try { await rm(target, { recursive: false }); } catch {}
      }
    }
    results.push({ agent, status: conflicts.length ? 'conflict' : 'uninstalled', destination, removed: removable.length, conflicts });
  }
  console.log(results.map((item) => `${item.agent}: ${item.status}${item.conflicts?.length ? `; preserved changed files: ${item.conflicts.join(', ')}` : ''}`).join('\n'));
  return results;
}

async function uninstallProject(flags) {
  const root = validateRoot(flags.project ?? process.cwd());
  const manifestFile = path.join(root, PROJECT_MANIFEST);
  const manifest = await readJson(manifestFile, null);
  if (!manifest) {
    console.log(`No project manifest found in ${root}`);
    return { status: 'not-initialized', project: root };
  }
  const conflicts = [];
  const removed = [];
  const tableDependencyKeys = new Set(['@tanstack/react-table', '@dnd-kit/react']);
  const tableScaffoldEntries = (manifest.entries ?? []).filter((entry) =>
    ['user', 'seeded'].includes(entry.ownership) && (
      /^design-system\/tables\/(?!README\.md$).+/.test(entry.path) ||
      entry.path.startsWith('src/components/wingman-design/data-table/') ||
      entry.path.startsWith('src/components/wingman-design/tables/') ||
      /^design-system\/examples\/.+-table\.html$/.test(entry.path)
    )
  );
  const preservedTableConsumers = [];
  for (const entry of tableScaffoldEntries) {
    if (await exists(path.join(root, entry.path))) preservedTableConsumers.push(entry.path);
  }
  const preservedDependencies = [];
  for (const entry of manifest.entries ?? []) {
    if (entry.ownership !== 'managed') continue;
    const target = path.join(root, entry.path);
    if (!(await exists(target))) continue;
    if (entry.hash && await fileHash(target) !== entry.hash) {
      conflicts.push(entry.path);
      continue;
    }
    if (!flags['dry-run']) await rm(target, { force: true });
    removed.push(entry.path);
  }
  const pointer = managedBlock(POINTER_LABEL, '');
  const hookBlock = managedBlock(POINTER_LABEL, '', 'shell');
  if (!flags['dry-run']) {
    await removeManagedBlock(path.join(root, 'AGENTS.md'), pointer);
    await removeManagedBlock(path.join(root, 'CLAUDE.md'), pointer);
    await removeManagedBlock(path.join(root, '.git', 'hooks', 'pre-commit'), hookBlock);
    const packageFile = path.join(root, 'package.json');
    const packageJson = await readJson(packageFile, null);
    if (packageJson) {
      for (const script of manifest.packageScripts ?? []) {
        if (packageJson.scripts?.[script.key] === script.value) delete packageJson.scripts[script.key];
      }
      for (const dependency of manifest.packageDependencies ?? []) {
        if (preservedTableConsumers.length && tableDependencyKeys.has(dependency.key)) {
          preservedDependencies.push(dependency.key);
          continue;
        }
        if (packageJson[dependency.section]?.[dependency.key] === dependency.value) delete packageJson[dependency.section][dependency.key];
      }
      await writeJsonAtomic(packageFile, packageJson);
    }
    if (!conflicts.length) await rm(manifestFile, { force: true });
  }
  const dependencyMessage = preservedDependencies.length
    ? ` Preserved table dependencies: ${[...new Set(preservedDependencies)].join(', ')}.`
    : '';
  console.log(`Project uninstall: ${removed.length} managed files removed, ${conflicts.length} changed managed files preserved. User and seeded files remain.${dependencyMessage}`);
  return {
    status: conflicts.length ? 'conflict' : 'uninstalled',
    project: root,
    removed,
    conflicts,
    preservedDependencies: [...new Set(preservedDependencies)]
  };
}

async function searchRegistry(positional, flags) {
  const query = positional.join(' ').toLowerCase();
  if (!query) throw new Error('Search needs one or more terms.');
  const registry = await readJson(path.join(SRC_ROOT, 'registry', 'rules.json'));
  const results = registry.entries.filter((entry) => {
    const domainMatch = !flags.domain || entry.domain === flags.domain;
    const haystack = `${entry.id} ${entry.domain} ${entry.title} ${entry.summary}`.toLowerCase();
    return domainMatch && query.split(/\s+/).every((term) => haystack.includes(term));
  });
  logJsonOrText(results, Boolean(flags.json), (items) => items.length
    ? items.map((entry) => `${entry.id} [${entry.domain}] ${entry.title}\n  ${entry.summary}\n  ${entry.source}`).join('\n')
    : 'No matching registry entry.');
  return results;
}

function commandCatalog(flags) {
  const commands = listCommands();
  logJsonOrText(commands, Boolean(flags.json), (items) => items.map((item) => {
    const names = [item.id, ...item.aliases].join(' / ');
    const mode = item.mutationPolicy === 'read-only-unless-fix' ? '; read-only unless --fix' : '';
    return `${names} [${item.category}; default ${item.defaultLevel}${mode}]\n  ${item.summary}`;
  }).join('\n'));
  return commands;
}

function explainCommand(positional, flags) {
  const phrase = positional.join(' ').trim();
  if (!phrase) throw new Error('Explain needs an intent or phrase.');
  const result = resolveRequest(phrase, {
    explicit: Boolean(flags.explicit),
    level: typeof flags.level === 'string' ? flags.level : undefined,
    fix: Boolean(flags.fix)
  });
  logJsonOrText(result, Boolean(flags.json), (value) => {
    if (value.kind === 'unknown') {
      const detail = value.reason === 'invalid-level'
        ? ` Use one of: ${value.allowedLevels.join(', ')}.`
        : ' Use an exact command ID or alias.';
      return `No WingmanPM command matched "${phrase}".${detail}`;
    }
    if (value.kind === 'picker') {
      return [
        `${value.intent} (${value.matchedAlias}) needs one level choice before editing.`,
        `Recommended: ${value.recommendedLevel}.`,
        ...value.options.map((option) => `  ${option.id}: ${option.description}`),
        value.target ? `Target: ${value.target}.` : null,
        `Reference: ${value.reference}`
      ].filter(Boolean).join('\n');
    }
    return [
      `${value.intent} (${value.matchedAlias}) will act directly at ${value.level}.`,
      value.readOnly ? 'Mode: read-only. Add --fix only when changes are explicitly requested.' : 'Mode: implementation.',
      value.target ? `Target: ${value.target}.` : null,
      `Reference: ${value.reference}`
    ].filter(Boolean).join('\n');
  });
  if (result.kind === 'unknown') process.exitCode = 1;
  return result;
}

export async function runCli(argv = process.argv.slice(2)) {
  const { positional, flags } = parseArgs(argv);
  const command = positional.shift();
  if (!command || command === 'help' || flags.help) {
    console.log(help);
    return;
  }
  if (command === 'init') return initProject(flags);
  if (command === 'upgrade') return upgradeProject(flags);
  if (command === 'add') return addProjectAsset(positional, flags);
  if (command === 'check') return checkProject(flags);
  if (command === 'doctor') return doctorProject(flags);
  if (command === 'install') return installSkill(flags);
  if (command === 'uninstall') {
    if (flags.agent || flags.scope) return uninstallSkill(flags);
    return uninstallProject(flags);
  }
  if (command === 'commands') return commandCatalog(flags);
  if (command === 'explain') return explainCommand(positional, flags);
  if (command === 'search') return searchRegistry(positional, flags);
  throw new Error(`Unknown command: ${command}\n\n${help}`);
}
