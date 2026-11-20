import { DIRECTIONS } from './direction.mjs';

// The concept worksheet: an art direction drawn from the audience's own world.
// Benchmarks showed catalog families (any ledger, any board) read as borrowed;
// winning worlds were objects the audience handles at work, and rarely the
// first idea on the list.

export const CONCEPT_TESTS = {
  native: { max: 2, ask: 'Who in the audience handles this object, and when? 2 = weekly in their own work or hobby, 1 = they know it well, 0 = only outsiders use it.' },
  verb: { max: 2, ask: 'Does the object\'s own verb state the product\'s promise (posts, itemizes, files, records, routes)? 2 = exactly, 1 = loosely, 0 = no.' },
  unswappable: { max: 2, ask: 'Could another industry front its product with this object? 2 = no, 1 = one neighbour could, 0 = yes (a generic notebook, ledger, dashboard, board, or blueprint).' },
  operable: { max: 1, ask: 'Does it have a part the visitor can work (a dial, tab, fader, slider, stamp, pull)? 1 = yes.' },
  silhouette: { max: 1, ask: 'At 200px wide, is its shape recognisable (a disc, a wall drawing, a shelf of colour blocks) rather than rows in a box? 1 = yes.' }
};
const PASS = 6;
const MIN_CANDIDATES = 7;

function hash(text) {
  let h = 2166136261;
  for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const words = (text) => String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];

// The catalog family the candidate names, used only for form vocabulary (ground, faces, devices).
export function familyFor(candidate) {
  const world = DIRECTIONS.worlds.find((w) => w.id === candidate.family);
  return world ? { id: world.id, name: world.name } : null;
}

export function checkConcept(sheet, { seed = 0 } = {}) {
  const errors = [];
  if (!sheet || typeof sheet !== 'object') return { ok: false, errors: ['The worksheet must be a JSON object.'] };
  for (const field of ['brief', 'mechanism', 'scene']) if (!String(sheet[field] || '').trim()) errors.push(`Missing "${field}".`);
  const rut = Array.isArray(sheet.rut) ? sheet.rut.filter((r) => String(r).trim()) : [];
  if (rut.length < 2) errors.push('Name the rut: at least the page this category always ships and the brief\'s literal metaphor ("rut": [..]).');
  const list = Array.isArray(sheet.candidates) ? sheet.candidates : [];
  if (list.length < MIN_CANDIDATES) errors.push(`List at least ${MIN_CANDIDATES} candidate objects from the audience's own work or hobby; found ${list.length}.`);
  const rutWords = new Set(rut.flatMap(words).filter((w) => w.length > 4));
  const scored = list.map((c, index) => {
    const problems = [];
    if (!String(c?.name || '').trim()) problems.push('no name');
    if (!String(c?.who || '').trim()) problems.push('no "who" (who handles it, when)');
    if (!String(c?.looks || '').trim()) problems.push('no "looks" (ground, colours, type voice, signature)');
    if (c?.family !== undefined && c.family !== 'none' && !DIRECTIONS.worlds.some((w) => w.id === c.family)) problems.push(`"family" must be one of ${DIRECTIONS.worlds.map((w) => w.id).join(', ')}, or "none"`);
    const scores = c?.scores || {};
    let total = 0;
    for (const [key, test] of Object.entries(CONCEPT_TESTS)) {
      const v = scores[key];
      if (!Number.isInteger(v) || v < 0 || v > test.max) problems.push(`score "${key}" must be an integer 0..${test.max}`);
      else total += v;
    }
    const inRut = words(c?.name).some((w) => rutWords.has(w));
    return { index, name: String(c?.name || ''), who: c?.who, looks: c?.looks, family: c?.family, scores, total, inRut, problems };
  });
  for (const c of scored) if (c.problems.length) errors.push(`Candidate ${c.index + 1} (${c.name || 'unnamed'}): ${c.problems.join(', ')}.`);
  if (errors.length) return { ok: false, errors, candidates: scored };
  // The first idea is usually the category's obvious one; it never wins the deal.
  const passing = scored.filter((c) => c.index > 0 && !c.inRut && c.total >= PASS && c.scores.unswappable > 0 && c.scores.verb > 0 && c.scores.native > 0);
  if (!passing.length) return { ok: false, errors: [`No candidate after the first scores ${PASS}/8 with native, verb, and unswappable all above 0. List objects closer to the audience's own work: their tools, forms, diagrams, signage, and rituals.`], candidates: scored };
  // Ties break toward the most native, unswappable object, then the clearest verb,
  // then the strongest silhouette; only a full tie is dealt by seed.
  const rank = (c) => [c.total, c.scores.native + c.scores.unswappable, c.scores.verb, c.scores.silhouette];
  const cmp = (a, b) => { const ra = rank(a), rb = rank(b); for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return rb[i] - ra[i]; return 0; };
  const best = [...passing].sort(cmp)[0];
  const finalists = passing.filter((c) => c.total === best.total);
  const leaders = finalists.filter((c) => cmp(c, best) === 0);
  const pick = leaders[hash(`${sheet.brief}::${seed}`) % leaders.length];
  return { ok: true, chosen: { ...pick, family: familyFor(pick) }, finalists, candidates: scored, errors: [] };
}

export function formatConcept(result) {
  if (!result.ok) return ['Concept worksheet needs work:', ...result.errors.map((e) => `- ${e}`)].join('\n');
  const c = result.chosen;
  const lines = [
    `World: ${c.name} (${c.total}/8).`,
    `Who handles it: ${c.who}`,
    `How it looks: ${c.looks}`,
    `Finalists dealt from: ${result.finalists.map((f) => `${f.name} (${f.total})`).join(', ')}.`,
    c.family ? `Form family for ground, faces, and devices: ${c.family.name}. Run direction "<brief>" --world "${c.name}" --family ${c.family.id}.` : `No catalog family matches; run direction "<brief>" --world "${c.name}" and take ground and faces from the object itself.`,
    'Build this world fully committed. Draw the object with its real anatomy, put the product\'s own output on it, and make its operable part the signature control.'
  ];
  return lines.join('\n');
}
