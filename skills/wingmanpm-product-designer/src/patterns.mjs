import { readFileSync } from 'node:fs';
const patterns = JSON.parse(readFileSync(new URL('../registry/patterns.json', import.meta.url), 'utf8'));
export const getPattern = id => patterns.find(p => p.id === id) ?? null;
export function searchPatterns(query = '', { limit = 3 } = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) throw new Error('Pattern limit must be an integer from 1 to 5.');
  const words = String(query).toLowerCase().match(/[a-z0-9]+/g) || [];
  return patterns.map((p, i) => ({ p, i, score: words.reduce((sum, word) => sum + (p.tags.includes(word) ? 4 : 0) + (JSON.stringify(p).toLowerCase().includes(word) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score || a.i - b.i).slice(0, limit).map(({ p }) => p);
}
