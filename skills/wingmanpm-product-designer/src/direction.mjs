import { readFileSync } from 'node:fs';

export const DIRECTIONS = JSON.parse(readFileSync(new URL('../registry/directions.json', import.meta.url), 'utf8'));
const AXES = ['worlds', 'compositions', 'type', 'color', 'devices', 'motion'];

function hash(text) {
  let h = 2166136261;
  for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function inferDomains(brief = '') {
  const text = ` ${String(brief).toLowerCase()} `;
  const scores = Object.entries(DIRECTIONS.domains).map(([domain, words]) => [
    domain,
    words.reduce((sum, word) => sum + (new RegExp(`[^a-z]${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^a-z]`).test(text) ? 1 : 0), 0)
  ]).filter(([, score]) => score > 0).sort((a, b) => b[1] - a[1]);
  return scores.length ? scores.slice(0, 2).map(([domain]) => domain) : ['b2b'];
}

// Weighted draw without replacement: fitting entries are likelier, never certain.
function drawDistinct(items, count, domains, random) {
  const pool = items.map((item) => ({ item, weight: 1 + 2 * domains.filter((d) => item.suits?.includes(d)).length }));
  const picked = [];
  while (picked.length < count && pool.length) {
    const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = random() * total;
    const index = pool.findIndex((entry) => (roll -= entry.weight) < 0);
    picked.push(pool.splice(index === -1 ? pool.length - 1 : index, 1)[0].item);
  }
  return picked;
}

// Type is drawn per world: a face that could be printed on the artifact is far likelier.
function drawFacesForWorlds(worlds, domains, random) {
  const pool = [...DIRECTIONS.type];
  return worlds.map((world) => {
    const weights = pool.map((t) => (world.faces?.includes(t.id) ? 30 : 1) + domains.filter((d) => t.suits?.includes(d)).length);
    let roll = random() * weights.reduce((a, b) => a + b, 0);
    const index = weights.findIndex((w) => (roll -= w) < 0);
    return pool.splice(index === -1 ? pool.length - 1 : index, 1)[0];
  });
}

export function drawDirections(brief, { seed = 0, count = 3, world = null, family = null } = {}) {
  if (!String(brief || '').trim()) throw new Error('Direction needs a brief: direction "<product, audience, action>".');
  if (!Number.isInteger(count) || count < 2 || count > 4) throw new Error('Direction --count must be an integer from 2 to 4.');
  const domains = inferDomains(brief);
  const random = rng(hash(`${brief}::${seed}`));
  const columns = Object.fromEntries(AXES.filter((axis) => axis !== 'type').map((axis) => [axis, drawDistinct(DIRECTIONS[axis], count, domains, random)]));
  if (family || world) {
    const base = family ? DIRECTIONS.worlds.find((w) => w.id === family) : null;
    if (family && !base) throw new Error(`Unknown --family "${family}". Use one of: ${DIRECTIONS.worlds.map((w) => w.id).join(', ')}.`);
    const fixed = { ...(base || { id: 'native', examples: 'its real anatomy, materials, and marks', faces: [], ground: 'the object\'s own material' }), ...(world ? { name: world, native: true } : {}) };
    columns.worlds = Array.from({ length: count }, () => fixed);
  }
  columns.type = drawFacesForWorlds(columns.worlds, domains, random);
  const options = Array.from({ length: count }, (_, i) => ({
    id: String.fromCharCode(65 + i),
    world: columns.worlds[i],
    composition: columns.compositions[i],
    type: columns.type[i],
    color: columns.color[i],
    device: columns.devices[i],
    motion: columns.motion[i]
  }));
  return { domains, seed, banned: DIRECTIONS.banned, options };
}

export function formatDirections(result) {
  const lines = [`Domains read from the brief: ${result.domains.join(', ')}. Seed ${result.seed}.`, ''];
  for (const o of result.options) {
    lines.push(`${o.id}. ${o.world.name} · ${o.composition.name} · ${o.color.name} · ${o.type.display} / ${o.type.text}`);
    lines.push(o.world.native ? `   World: ${o.world.name}. Draw it with its own anatomy and marks, and put the product's output on it.${o.world.id !== 'native' ? ` Form vocabulary from the ${o.world.name === o.world.id ? o.world.id : 'family'}: ${o.world.examples}.` : ''}` : `   Form family: ${o.world.name}: ${o.world.examples}. Name the object from the audience's own work first (concept worksheet); a family object alone reads as borrowed.`);
    lines.push(`   Composition: ${o.composition.move}`);
    lines.push(`   Rhythm: ${o.composition.rhythm}`);
    lines.push(`   At 390: ${o.composition.mobile}`);
    lines.push(`   Ground: ${o.world.ground}. Light mode means a light tint of this material, never a neutral near-white.`);
    lines.push(`   Colour: ${o.color.rule}`);
    lines.push(`   Type voice: ${o.type.voice}. ${o.type.use}`);
    lines.push(`   Device: ${o.device.name}. ${o.device.rule}`);
    lines.push(`   Motion: ${o.motion.name}. ${o.motion.rule}`);
    lines.push(`   Risk: ${o.composition.risk}`);
    lines.push('');
  }
  lines.push('Never build these, whatever the palette:');
  for (const b of result.banned) lines.push(`- ${b.fingerprint}`);
  lines.push('');
  lines.push('Pick the option whose world can display the product\'s own output. You may swap one axis for another catalog entry; say why in your notes.');
  lines.push('The signature control is a part of the artifact the visitor operates (pull the folder, move the fader, tear the ticket), not an app widget beside it.');
  return lines.join('\n');
}
