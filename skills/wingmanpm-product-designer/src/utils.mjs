import { createHash } from 'node:crypto';
import { chmod, copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const TEXT_EXTENSIONS = new Set([
  '.css', '.html', '.js', '.jsx', '.json', '.md', '.mjs', '.scss', '.ts', '.tsx', '.yaml', '.yml'
]);

export async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(target, fallback) {
  try {
    return JSON.parse(await readFile(target, 'utf8'));
  } catch (error) {
    if (arguments.length > 1) return fallback;
    throw error;
  }
}

export async function writeAtomic(target, content, mode) {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.wingman-${process.pid}-${Date.now()}`;
  await writeFile(temporary, content, 'utf8');
  if (mode) await chmod(temporary, mode);
  await rename(temporary, target);
}

export async function writeJsonAtomic(target, value) {
  await writeAtomic(target, `${JSON.stringify(value, null, 2)}\n`);
}

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

export async function fileHash(target) {
  return sha256(await readFile(target));
}

export function replaceTemplate(content, values) {
  return content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) =>
    Object.hasOwn(values, key) ? String(values[key]) : match
  );
}

export async function listFiles(root, options = {}) {
  const ignored = new Set(options.ignored ?? [
    '.git', '.next', 'build', 'coverage', 'dist', 'node_modules', 'storybook-static'
  ]);
  const results = [];

  async function visit(directory) {
    let entries = [];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (ignored.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else results.push(absolute);
    }
  }

  await visit(root);
  return results.sort();
}

export async function copyTemplateTree(source, destination, values, onCreate) {
  const entries = await readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      await mkdir(to, { recursive: true });
      await copyTemplateTree(from, to, values, onCreate);
      continue;
    }
    if (await exists(to)) continue;
    await mkdir(path.dirname(to), { recursive: true });
    const extension = path.extname(from);
    if (TEXT_EXTENSIONS.has(extension) || entry.name.startsWith('.')) {
      const content = replaceTemplate(await readFile(from, 'utf8'), values);
      await writeAtomic(to, content);
    } else {
      await copyFile(from, to);
    }
    if (onCreate) await onCreate(to);
  }
}

export function managedBlock(label, body, comment = 'html') {
  const start = comment === 'shell'
    ? `# ${label}:start`
    : `<!-- ${label}:start -->`;
  const end = comment === 'shell'
    ? `# ${label}:end`
    : `<!-- ${label}:end -->`;
  return { start, end, text: `${start}\n${body.trim()}\n${end}` };
}

export async function upsertManagedBlock(target, block, prefix = '') {
  const prior = (await exists(target)) ? await readFile(target, 'utf8') : prefix;
  const startIndex = prior.indexOf(block.start);
  const endIndex = prior.indexOf(block.end);
  let next;
  if (startIndex >= 0 && endIndex > startIndex) {
    next = `${prior.slice(0, startIndex)}${block.text}${prior.slice(endIndex + block.end.length)}`;
  } else {
    next = `${prior.trimEnd()}${prior.trim() ? '\n\n' : ''}${block.text}\n`;
  }
  await writeAtomic(target, next);
  return { prior, next };
}

export async function removeManagedBlock(target, block) {
  if (!(await exists(target))) return false;
  const content = await readFile(target, 'utf8');
  const startIndex = content.indexOf(block.start);
  const endIndex = content.indexOf(block.end);
  if (startIndex < 0 || endIndex < startIndex) return false;
  const next = `${content.slice(0, startIndex)}${content.slice(endIndex + block.end.length)}`
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!next) await rm(target);
  else await writeAtomic(target, `${next}\n`);
  return true;
}

export function relativeUnix(root, target) {
  return path.relative(root, target).split(path.sep).join('/');
}

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      positional.push(value);
      continue;
    }
    const [rawKey, inline] = value.slice(2).split('=', 2);
    if (inline !== undefined) {
      flags[rawKey] = inline;
    } else if (argv[index + 1] && !argv[index + 1].startsWith('--')) {
      flags[rawKey] = argv[index + 1];
      index += 1;
    } else {
      flags[rawKey] = true;
    }
  }
  return { positional, flags };
}

export async function makeExecutable(target) {
  await chmod(target, 0o755);
}
