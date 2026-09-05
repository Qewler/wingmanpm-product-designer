import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleInventory } from '../skills/wingmanpm-product-designer/src/update.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../skills/wingmanpm-product-designer');
const version = JSON.parse(await readFile(path.join(root, 'registry/commands.json'), 'utf8')).version;
const manifest = { schemaVersion: 1, name: 'wingmanpm-product-designer', version, files: await bundleInventory(root) };
await writeFile(path.join(root, 'bundle-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Recorded ${Object.keys(manifest.files).length} portable bundle file hashes.`);
