import { createHash, randomBytes } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const NAME = 'wingmanpm-product-designer';
const MANIFEST = 'bundle-manifest.json';
const STATE = '.wingman-update.json';
const ignored = new Set([MANIFEST, STATE, '.wingman-install.json', '.DS_Store']);
const hash = value => createHash('sha256').update(value).digest('hex');
const version = value => /^\d+\.\d+\.\d+$/.test(value ?? '') ? value.split('.').map(Number) : null;
const newer = (a, b) => { const aa = version(a), bb = version(b); if (!aa || !bb) return false; for (let i = 0; i < 3; i++) if (aa[i] !== bb[i]) return aa[i] > bb[i]; return false; };
const safeRelative = value => typeof value === 'string' && value && !value.includes('\\') && !value.includes(':') && !value.includes('\0') && !path.posix.isAbsolute(value) && !value.split('/').some(part => part === '..' || part === '.');
async function exists(file) { try { await readFile(file); return true; } catch { return false; } }
async function json(file, fallback) { try { return JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return fallback; throw error; } }

export async function bundleInventory(root) {
  const files = {};
  async function walk(directory, prefix = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!prefix && ignored.has(entry.name)) continue;
      const relative = prefix + entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Installed bundle contains a symlink: ${relative}`);
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative + '/');
      else if (entry.isFile()) files[relative] = hash(await readFile(path.join(directory, entry.name)));
    }
  }
  await walk(root);
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)));
}

export async function verifyBundle(root) {
  const manifest = await json(path.join(root, MANIFEST), null);
  if (!manifest || manifest.name !== NAME || !version(manifest.version) || !manifest.files || typeof manifest.files !== 'object') return { clean: false, reason: 'Bundle manifest missing or invalid.' };
  if (Object.entries(manifest.files).some(([file, digest]) => !safeRelative(file) || !/^[a-f0-9]{64}$/.test(digest))) return { clean: false, reason: 'Bundle manifest has invalid paths or hashes.' };
  const actual = await bundleInventory(root);
  const changed = [...new Set([...Object.keys(actual), ...Object.keys(manifest.files)])].filter(file => actual[file] !== manifest.files[file]);
  return { clean: changed.length === 0, version: manifest.version, changed, reason: changed.length ? 'Local bundle edits were preserved.' : undefined };
}

export function updateOwner(root) {
  const normalized = root.split(path.sep).join('/');
  if (/\/(?:\.agents|\.codex|\.claude|\.cursor)\/skills\/wingmanpm-product-designer$/.test(normalized)) return 'standalone';
  if (/\/\.codex\/plugins\/cache\//.test(normalized)) return 'codex';
  if (/\/\.claude\/plugins\/cache\//.test(normalized)) return 'claude';
  if (/\/\.cursor\/plugins\/cache\//.test(normalized)) return 'cursor';
  return 'development';
}

async function fetchBytes(url, maximum = 12 * 1024 * 1024) {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://registry.npmjs.org' || !parsed.pathname.startsWith('/' + NAME)) throw new Error('Update source must be the official package registry.');
  const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'error' });
  if (!response.ok) throw new Error(`Update service returned ${response.status}.`);
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > maximum) throw new Error('Update exceeds the download limit.'); chunks.push(chunk); }
  return Buffer.concat(chunks);
}

/** Extract only regular files in the canonical skill; no tar command or install scripts. */
export async function extractBundle(archive, integrity, destination) {
  if (!/^sha512-[A-Za-z0-9+/]+=*$/.test(integrity ?? '') || `sha512-${createHash('sha512').update(archive).digest('base64')}` !== integrity) throw new Error('Update archive integrity check failed.');
  const tar = gunzipSync(archive, { maxOutputLength: 64 * 1024 * 1024 });
  const prefix = `package/skills/${NAME}/`;
  const seen = new Set();
  const field = (header, start, length) => header.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '').trim();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const checksum = Number.parseInt(field(header, 148, 8), 8);
    let sum = 0; for (let i = 0; i < 512; i++) sum += i >= 148 && i < 156 ? 32 : header[i];
    if (sum !== checksum) throw new Error('Invalid archive header.');
    const sizeText = field(header, 124, 12);
    if (!/^[0-7]+$/.test(sizeText)) throw new Error('Unsupported archive size.');
    const size = Number.parseInt(sizeText, 8);
    const name = [field(header, 345, 155), field(header, 0, 100)].filter(Boolean).join('/');
    const type = String.fromCharCode(header[156]);
    const start = offset + 512;
    if (!Number.isSafeInteger(size) || start + size > tar.length) throw new Error('Truncated archive.');
    offset = start + Math.ceil(size / 512) * 512;
    if (!name.startsWith(prefix) || name === prefix) continue;
    const relative = name.slice(prefix.length).replace(/\/$/, '');
    if (!safeRelative(relative)) throw new Error('Unsafe archive path.');
    if (type === '5') continue;
    if (!['0', '\0'].includes(type)) throw new Error('Bundle archives must contain regular files only.');
    if (seen.has(relative)) throw new Error('Duplicate archive path.');
    seen.add(relative);
    const file = path.join(destination, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, tar.subarray(start, start + size), { flag: 'wx' });
  }
  for (const required of ['SKILL.md', 'bin/wingman-design.mjs', 'registry/commands.json', MANIFEST]) if (!seen.has(required)) throw new Error(`Update bundle is missing ${required}.`);
  for (const area of ['bin/', 'src/', 'registry/', 'references/', 'schemas/', 'templates/']) if (![...seen].some(file => file.startsWith(area))) throw new Error(`Update bundle is missing ${area}`);
  return verifyBundle(destination);
}

function nativeCommands(owner) {
  if (owner === 'codex') return [['codex', 'plugin', 'marketplace', 'upgrade', 'wingmanpm', '--json'], ['codex', 'plugin', 'add', `${NAME}@wingmanpm`, '--json']];
  if (owner === 'claude') return [['claude', 'plugin', 'update', `${NAME}@wingmanpm`]];
  return [];
}

async function saveState(root, state) {
  const file = path.join(root, STATE);
  const temporary = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  try { await writeFile(temporary, JSON.stringify(state, null, 2) + '\n', { flag: 'wx' }); await rename(temporary, file); }
  finally { await rm(temporary, { force: true }); }
}

/** Called once at skill entry. Tests inject transport/manager execution, never live installs. */
export async function updateSkill(directory, options = {}, dependencies = {}) {
  const root = await realpath(directory);
  const owner = updateOwner(root);
  const current = (await json(path.join(root, 'registry/commands.json'), {})).version;
  if (owner === 'development') return { status: 'development', current, detail: 'Development checkouts are never auto-updated.' };
  if (!version(current)) return { status: 'version-unrecognized', current, detail: 'Keep the installed copy; no stable version comparison is possible.' };
  let state;
  try { state = await json(path.join(root, STATE), {}); } catch { return { status: 'settings-invalid', current, detail: 'Update settings are invalid; the installed copy was preserved.' }; }
  if (options.enabled !== undefined) {
    await saveState(root, { ...state, enabled: options.enabled });
    return { status: options.enabled ? 'enabled' : 'disabled', current };
  }
  if (state.enabled === false || process.env.WINGMAN_DESIGN_AUTO_UPDATE === '0') return { status: 'disabled', current };
  const now = dependencies.now ?? Date.now();
  let metadata;
  try {
    const cached = !options.force && state.metadata && now - (state.checkedAt ?? 0) >= 0 && now - state.checkedAt < 86_400_000;
    metadata = cached ? state.metadata : await (dependencies.metadata ?? (async () => JSON.parse((await fetchBytes(`https://registry.npmjs.org/${NAME}/latest`, 1024 * 1024)).toString())) )();
    if (metadata.name !== NAME || !version(metadata.version)) throw new Error('Invalid stable release metadata.');
    if (!cached && !options.readOnly) await saveState(root, { ...state, checkedAt: now, metadata: { name: metadata.name, version: metadata.version, dist: metadata.dist, engines: metadata.engines } });
    if (!newer(metadata.version, current)) return { status: 'current', current, latest: metadata.version, cached: Boolean(cached) };
    if (!options.auto || options.readOnly) return { status: 'available', current, latest: metadata.version, owner };
    const clean = await verifyBundle(root);
    if (!clean.clean) return { status: 'local-edits', current, latest: metadata.version, detail: clean.reason, changed: clean.changed };
    const engine = metadata.engines?.node ?? '>=20';
    const minimum = engine.match(/^>=(\d+)(?:\.(\d+)(?:\.(\d+))?)?$/);
    const minimumVersion = minimum ? `${minimum[1]}.${minimum[2] ?? 0}.${minimum[3] ?? 0}` : null;
    if (!minimumVersion || newer(minimumVersion, dependencies.nodeVersion ?? process.versions.node)) return { status: 'runtime-required', current, latest: metadata.version, node: engine };
    if (owner === 'cursor') return { status: 'host-managed', current, latest: metadata.version, detail: 'Cursor owns native plugin updates. Its marketplace distributes reviewed releases; private marketplaces use Enable Auto Refresh. The npm release can precede that channel.' };
    if (owner !== 'standalone') {
      const marketplace = root.split(path.sep).join('/').match(/\/plugins\/cache\/([^/]+)\//)?.[1];
      if (marketplace !== 'wingmanpm') return { status: 'host-managed', current, latest: metadata.version, detail: 'This copy belongs to another marketplace; keep its owning update channel.' };
      const commands = nativeCommands(owner);
      for (const args of commands) {
        const result = dependencies.runManager ? await dependencies.runManager(args) : spawnSync(args[0], args.slice(1), { encoding: 'utf8', timeout: 60_000, shell: false });
        if (result.status !== 0) return { status: 'manager-update-needed', current, latest: metadata.version, owner, detail: 'The host manager did not complete the update. Continue with the current skill; do not rewrite its cache.' };
      }
      return { status: 'restart-required', current, latest: metadata.version, owner, detail: 'Host update commands completed. Reload the plugin, then check the active version. This process still has the old instructions loaded.' };
    }
    const parent = path.dirname(root);
    const lock = path.join(parent, `.${NAME}.update.lock`);
    try { await writeFile(lock, String(process.pid), { flag: 'wx' }); }
    catch (error) { if (error.code === 'EEXIST') return { status: 'busy', current, latest: metadata.version }; throw error; }
    const work = path.join(path.dirname(parent), '.wingman-updates');
    const suffix = randomBytes(8).toString('hex');
    const stage = path.join(work, `stage-${suffix}`);
    const backup = path.join(work, `backup-${current}-${suffix}`);
    let stageCreated = false;
    try {
      await mkdir(work, { recursive: true });
      if (await realpath(work) !== work) throw new Error('Update staging directory must not be a symlink.');
      await mkdir(stage);
      stageCreated = true;
      const tarball = metadata.dist?.tarball;
      if (typeof tarball !== 'string' || new URL(tarball).origin !== 'https://registry.npmjs.org' || !new URL(tarball).pathname.startsWith(`/${NAME}/-/`)) throw new Error('Invalid release archive URL.');
      const archive = await (dependencies.archive ?? fetchBytes)(tarball);
      const staged = await extractBundle(archive, metadata.dist?.integrity, stage);
      if (!staged.clean || staged.version !== metadata.version) throw new Error('Staged update manifest does not match the release.');
      const registry = await json(path.join(stage, 'registry/commands.json'), {});
      if (registry.version !== metadata.version) throw new Error('Staged runtime version mismatch.');
      const smoke = spawnSync(process.execPath, [path.join(stage, 'bin/wingman-design.mjs'), '--version'], { encoding: 'utf8', timeout: 10_000, shell: false });
      if (smoke.status !== 0 || smoke.stdout.trim() !== metadata.version) throw new Error('Staged runtime check failed.');
      if (!(await verifyBundle(root)).clean) throw new Error('The installed bundle changed during update.');
      const receipt = await json(path.join(root, '.wingman-install.json'), null);
      if (receipt) await writeFile(path.join(stage, '.wingman-install.json'), JSON.stringify({ ...receipt, version: metadata.version, source: `${NAME}@${metadata.version}`, files: [...Object.entries(await bundleInventory(stage)).map(([file, digest]) => ({ path: file, hash: digest })), { path: MANIFEST, hash: hash(await readFile(path.join(stage, MANIFEST))) }] }, null, 2));
      await saveState(stage, { ...state, checkedAt: now, metadata, installedAt: now });
      if ((await json(path.join(root, STATE), {})).enabled === false) return { status: 'disabled', current };
      await rename(root, backup);
      try { await rename(stage, root); } catch (error) { await rename(backup, root); throw error; }
      return { status: 'updated', previous: current, current: metadata.version, backup, reload: path.join(root, 'SKILL.md') };
    } finally { if (stageCreated) await rm(stage, { recursive: true, force: true }); await rm(lock, { force: true }); }
  } catch (error) {
    return { status: 'update-unavailable', current, detail: error.message, continueWithInstalled: true };
  }
}
