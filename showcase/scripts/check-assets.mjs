import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const showcaseDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = path.resolve(showcaseDir, '..');

const expected = [
  ['assets/plugin-icon.png', 512, 512],
  ['assets/plugin-logo.png', 1200, 300],
  ['assets/plugin-logo-dark.png', 1200, 300],
  ['assets/plugin-screenshot-workspace.png', 1600, 1000],
  ['assets/plugin-screenshot-ai.png', 1600, 1000],
  ['assets/plugin-screenshot-marketing.png', 1600, 1000],
  ['assets/social-preview.png', 1280, 640],
  ['docs/assets/readme/hero-light.webp', 1600, 900],
  ['docs/assets/readme/hero-dark.webp', 1600, 900],
  ['docs/assets/readme/comparison-workspace.webp', 1600, 900],
  ['docs/assets/readme/comparison-ai-review.webp', 1600, 900],
  ['docs/assets/readme/comparison-marketing.webp', 1600, 900],
  ['docs/assets/readme/responsive-proof.webp', 1600, 900],
];

let readmeBytes = 0;
for (const [relative, expectedWidth, expectedHeight] of expected) {
  const file = path.join(repoDir, relative);
  const [details, metadata] = await Promise.all([stat(file), sharp(file).metadata()]);
  if (metadata.width !== expectedWidth || metadata.height !== expectedHeight) {
    throw new Error(`${relative} is ${metadata.width}x${metadata.height}, expected ${expectedWidth}x${expectedHeight}`);
  }
  if (metadata.exif || metadata.iptc || metadata.xmp) {
    throw new Error(`${relative} contains metadata that must be stripped`);
  }
  if (relative.startsWith('docs/assets/readme/')) readmeBytes += details.size;
}

const limit = 3.5 * 1024 * 1024;
if (readmeBytes > limit) {
  throw new Error(`README images total ${(readmeBytes / 1024 / 1024).toFixed(2)} MB, limit is 3.5 MB`);
}

process.stdout.write(`README image payload: ${(readmeBytes / 1024 / 1024).toFixed(2)} MB\n`);
