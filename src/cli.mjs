import { cp, lstat, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileTokenFile, compileTokens } from './tokens.mjs';
import { createLegacyBaseline, hashReviewSources, runChecks } from './checker.mjs';
import {
  copyTemplateTree, exists, fileHash, listFiles, makeExecutable, managedBlock,
  parseArgs, readJson, relativeUnix, removeManagedBlock, sha256, upsertManagedBlock,
  writeAtomic, writeJsonAtomic
} from './utils.mjs';

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_NAME = 'wingmanpm-product-designer';
const POINTER_LABEL = SKILL_NAME;
const PROJECT_MANIFEST = '.wingmanpm-design/manifest.json';
const VERSION = '0.1.0-private.1';

const help = `WingmanPM Product Designer ${VERSION}

Usage:
  wingman-design install [--agent all|codex|claude|cursor] [--scope user|project] [--project PATH] [--dry-run]
  wingman-design init [--project PATH] [--mode new-system|preserve] [--dry-run]
  wingman-design check [--project PATH] [--json] [--allow-pending-review]
  wingman-design check --record-review --reviewer NAME --confirm CHECKS [--project PATH]
  wingman-design doctor [--project PATH] [--json]
  wingman-design uninstall [--project PATH] [--agent all|codex|claude|cursor] [--scope user|project] [--dry-run]
  wingman-design search TERMS [--domain NAME] [--json]

Required review confirmation list:
  keyboard,zoom200,reducedMotion,longContent,light,dark,axe,responsiveStates
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
  if (relative.startsWith('design-system/surfaces/') || relative === 'design-system/tokens/tokens.json') return 'user';
  if (relative.startsWith('src/') || relative.startsWith('.storybook/') || relative.startsWith('tests/wingman-design/')) return 'seeded';
  if (relative.includes('review.json') || relative.includes('baselines/')) return 'observed';
  return 'managed';
}

async function recordCreated(manifest, root, target) {
  const relative = relativeUnix(root, target);
  manifest.entries.push({ path: relative, ownership: ownership(relative), action: 'created', hash: await fileHash(target) });
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
  const currentManifest = await readJson(manifestFile, null);
  if (currentManifest && !flags['dry-run']) {
    const runtimeRelative = '.wingmanpm-design/runtime/checker.mjs';
    const runtimeTarget = path.join(root, runtimeRelative);
    const runtimeEntry = currentManifest.entries?.find((entry) => entry.path === runtimeRelative);
    const currentHash = await exists(runtimeTarget) ? await fileHash(runtimeTarget) : null;
    if (currentHash && runtimeEntry?.hash && currentHash !== runtimeEntry.hash) {
      throw new Error(`Refusing to replace a locally changed checker runtime: ${runtimeTarget}`);
    }
    const expectedHash = await fileHash(path.join(SRC_ROOT, 'src', 'checker.mjs'));
    let refreshed = false;
    if (currentHash !== expectedHash) {
      await mkdir(path.dirname(runtimeTarget), { recursive: true });
      await cp(path.join(SRC_ROOT, 'src', 'checker.mjs'), runtimeTarget);
      if (runtimeEntry) runtimeEntry.hash = expectedHash;
      else currentManifest.entries.push({ path: runtimeRelative, ownership: 'managed', action: 'created', hash: expectedHash });
      currentManifest.version = VERSION;
      await writeJsonAtomic(manifestFile, currentManifest);
      refreshed = true;
    }
    const result = { status: 'already-initialized', project: root, manifest: PROJECT_MANIFEST, runtimeRefreshed: refreshed };
    console.log(`Already initialized: ${root}${refreshed ? '; checker runtime refreshed' : ''}`);
    return result;
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
    schemaVersion: 1,
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

    const runtimeDir = path.join(root, '.wingmanpm-design', 'runtime');
    await mkdir(runtimeDir, { recursive: true });
    const runtimeChecker = path.join(runtimeDir, 'checker.mjs');
    if (!(await exists(runtimeChecker))) {
      await cp(path.join(SRC_ROOT, 'src', 'checker.mjs'), runtimeChecker);
      await onCreate(runtimeChecker);
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
    await writeJsonAtomic(manifestFile, manifest);
    console.log(`Initialized WingmanPM Product Designer in ${root}`);
    console.log(`Stack: ${detected.stack}; mode: ${mode}; seeded files are never overwritten.`);
    return { status: 'initialized', project: root, manifest };
  } catch (error) {
    await rollback(root, created, modified);
    throw error;
  }
}

async function recordReview(root, flags) {
  const reviewer = flags.reviewer;
  const required = ['keyboard', 'zoom200', 'reducedMotion', 'longContent', 'light', 'dark', 'axe', 'responsiveStates'];
  const confirmed = new Set(String(flags.confirm ?? '').split(',').map((item) => item.trim()).filter(Boolean));
  const missing = required.filter((item) => !confirmed.has(item));
  if (!reviewer || missing.length) throw new Error(`Review recording needs --reviewer and all confirmations. Missing: ${missing.join(', ') || 'reviewer'}`);
  const report = await runChecks(root, { allowPendingReview: true });
  const otherBlocks = report.findings.filter((finding) => finding.severity === 'block' && finding.ruleId !== 'WPD011');
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

async function doctorProject(flags) {
  const root = validateRoot(flags.project ?? process.cwd());
  const checks = [];
  const push = (id, status, message) => checks.push({ id, status, message });
  const manifest = await readJson(path.join(root, PROJECT_MANIFEST), null);
  push('manifest', manifest ? 'pass' : 'fail', manifest ? 'Managed manifest is present.' : 'Managed manifest is missing.');
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

  const runtimeChecker = path.join(root, '.wingmanpm-design', 'runtime', 'checker.mjs');
  const expectedChecker = path.join(SRC_ROOT, 'src', 'checker.mjs');
  const runtimeCurrent = await exists(runtimeChecker) && await fileHash(runtimeChecker) === await fileHash(expectedChecker);
  push('runtime', runtimeCurrent ? 'pass' : 'fail', runtimeCurrent ? 'Checker runtime matches this CLI build.' : 'Checker runtime is missing or stale; run wingman-design init with the current CLI.');

  const packageJson = await readJson(path.join(root, 'package.json'), {});
  const deps = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
  const config = await readJson(path.join(root, '.wingmanpm-design', 'config.json'), {});
  const storybookPackages = ['storybook', '@storybook/react', '@storybook/react-vite', '@storybook/addon-a11y'];
  const storybookVersions = storybookPackages.map((name) => deps[name]).filter(Boolean);
  const storybookMajors = new Set(storybookVersions.map((version) => String(version).match(/\d+/)?.[0]).filter(Boolean));
  const storybookFiles = await exists(path.join(root, '.storybook', 'main.ts')) && await exists(path.join(root, '.storybook', 'preview.ts'));
  if (config.goldenStack !== true) {
    push('storybook', storybookVersions.length ? 'pass' : 'warn', storybookVersions.length ? 'Optional Storybook dependencies are present.' : 'Storybook is optional for this framework-neutral project.');
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
  const sourceEntries = ['SKILL.md', 'LICENSE', 'NOTICE', 'agents', 'references', 'registry'];
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
      const directories = ['agents', 'references', 'registry', destination];
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
        if (packageJson[dependency.section]?.[dependency.key] === dependency.value) delete packageJson[dependency.section][dependency.key];
      }
      await writeJsonAtomic(packageFile, packageJson);
    }
    if (!conflicts.length) await rm(manifestFile, { force: true });
  }
  console.log(`Project uninstall: ${removed.length} managed files removed, ${conflicts.length} changed managed files preserved. User and seeded files remain.`);
  return { status: conflicts.length ? 'conflict' : 'uninstalled', project: root, removed, conflicts };
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

export async function runCli(argv = process.argv.slice(2)) {
  const { positional, flags } = parseArgs(argv);
  const command = positional.shift();
  if (!command || command === 'help' || flags.help) {
    console.log(help);
    return;
  }
  if (command === 'init') return initProject(flags);
  if (command === 'check') return checkProject(flags);
  if (command === 'doctor') return doctorProject(flags);
  if (command === 'install') return installSkill(flags);
  if (command === 'uninstall') {
    if (flags.agent || flags.scope) return uninstallSkill(flags);
    return uninstallProject(flags);
  }
  if (command === 'search') return searchRegistry(positional, flags);
  throw new Error(`Unknown command: ${command}\n\n${help}`);
}
