import { readFileSync } from 'node:fs';

const registry = JSON.parse(readFileSync(new URL('../registry/commands.json', import.meta.url), 'utf8'));

export const COMMAND_LEVELS = Object.freeze(['refine', 'elevate', 'reimagine']);
export const COMMANDS = Object.freeze(registry.intents.map((entry) => Object.freeze({
  ...entry,
  aliases: Object.freeze([...entry.aliases]),
  naturalPhrases: Object.freeze([...entry.naturalPhrases]),
  protectedScope: Object.freeze([...entry.protectedScope]),
  verification: Object.freeze([...entry.verification])
})));

/**
 * Normalize an intent or request for exact comparison. Punctuation and symbol
 * runs become spaces, Unicode width variants are folded, and whitespace is
 * collapsed. The resolver still compares the complete normalized value.
 */
export function normalizeAlias(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

const intentIndex = new Map();
const naturalPhraseIndex = new Map();

for (const command of COMMANDS) {
  for (const alias of [command.id, ...command.aliases]) {
    const normalized = normalizeAlias(alias);
    if (intentIndex.has(normalized)) throw new Error(`Duplicate WingmanPM command alias: ${alias}`);
    intentIndex.set(normalized, { command, matchedAlias: alias, naturalPhrase: false });
  }
  for (const phrase of command.naturalPhrases) {
    const normalized = normalizeAlias(phrase);
    if (intentIndex.has(normalized) || naturalPhraseIndex.has(normalized)) {
      throw new Error(`Duplicate WingmanPM natural phrase: ${phrase}`);
    }
    naturalPhraseIndex.set(normalized, { command, matchedAlias: phrase, naturalPhrase: true });
  }
}

/** Resolve only a complete command ID or alias. Never performs substring matching. */
export function resolveIntent(value) {
  const normalized = normalizeAlias(value);
  const match = intentIndex.get(normalized) ?? naturalPhraseIndex.get(normalized);
  if (!match) return null;
  return {
    intent: match.command.id,
    matchedAlias: match.matchedAlias,
    normalized,
    naturalPhrase: match.naturalPhrase,
    command: match.command
  };
}

function normalizeLevel(value) {
  if (value == null || value === '') return null;
  const normalized = normalizeAlias(value);
  return COMMAND_LEVELS.includes(normalized) ? normalized : null;
}

// Retain raw character spans while normalizing only the command vocabulary.
function normalizedWithOffsets(raw) {
  const chars = [];
  let offset = 0;
  for (const char of raw) {
    for (const normalized of char.normalize('NFKC').toLocaleLowerCase('en-US')) {
      const output = /[\p{P}\p{S}\s]/u.test(normalized) ? ' ' : normalized;
      for (const unit of output.split('')) chars.push({ char: unit, start: offset, end: offset + char.length });
    }
    offset += char.length;
  }
  const compact = [];
  for (const char of chars) {
    if (char.char === ' ' && (!compact.length || compact.at(-1).char === ' ')) continue;
    compact.push(char);
  }
  if (compact.at(-1)?.char === ' ') compact.pop();
  return { text: compact.map(x => x.char).join(''), spans: compact };
}

function matchWrappedRequest(raw) {
  const { text: normalized, spans } = normalizedWithOffsets(raw);
  const exact = intentIndex.get(normalized) ?? naturalPhraseIndex.get(normalized);
  if (exact) return { ...exact, target: null };
  const polite = normalized.replace(/^(?:please |can you |could you )/u, '');
  const base = normalized.length - polite.length;
  const unquote = value => {
    value = value.trim();
    return /^("[\s\S]*"|'[\s\S]*')$/.test(value) ? value.slice(1, -1) : value;
  };
  const aliases = [...intentIndex.entries(), ...naturalPhraseIndex.entries()].sort(([a], [b]) => b.length - a.length);
  for (const [alias, match] of aliases) {
    if (polite.startsWith('make ') && polite.endsWith(` ${alias}`)) {
      const target = unquote(raw.slice(spans[base + 3].end, spans[normalized.length - alias.length].start));
      if (target) return { ...match, target: /^(it|this)$/iu.test(target) ? null : target };
    }
    if (polite === `${alias} it` || polite === `${alias} this`) return { ...match, target: null };
    if (polite.startsWith(`${alias} `)) return { ...match, target: unquote(raw.slice(spans[base + alias.length - 1].end)) };
  }
  return null;
}

const REVIEW_TARGET_REFERENCES = Object.freeze([
  Object.freeze({ reference: 'references/ai-ui.md', phrases: ['artificial intelligence', 'ai flow', 'ai ui'], words: ['ai', 'llm'] }),
  Object.freeze({ reference: 'references/data-tables.md', phrases: ['data table'], words: ['table', 'tables', 'grid', 'grids'] }),
  Object.freeze({ reference: 'references/forms.md#onboarding--activate', phrases: ['first run'], words: ['onboarding', 'activation'] }),
  Object.freeze({ reference: 'references/forms.md#forms--form', phrases: [], words: ['form', 'forms'] }),
  Object.freeze({ reference: 'references/navigation.md', phrases: ['app shell'], words: ['navigation', 'nav', 'sidebar'] }),
  Object.freeze({ reference: 'references/motion.md', phrases: [], words: ['motion', 'animation', 'transition'] }),
  Object.freeze({ reference: 'references/product-craft.md', phrases: [], words: ['layout', 'typography', 'color', 'responsive', 'breakpoint', 'mobile'] }),
  Object.freeze({ reference: 'references/system.md', phrases: ['design system'], words: ['tokens'] }),
  Object.freeze({ reference: 'references/marketing.md', phrases: ['landing page'], words: ['marketing', 'pricing', 'launch'] })
]);

function reviewTargetReferences(command, target) {
  if (command.id !== 'review' || !target) return [];
  const normalized = normalizeAlias(target);
  const words = new Set(normalized.split(' ').filter(Boolean));
  const matches = REVIEW_TARGET_REFERENCES.filter((candidate) => (
    candidate.phrases.some((phrase) => normalized === phrase || normalized.startsWith(`${phrase} `) || normalized.endsWith(` ${phrase}`) || normalized.includes(` ${phrase} `))
    || candidate.words.some((word) => words.has(word))
  ));
  return [...new Set(matches.map(match => match.reference))];
}

/**
 * Resolve an agent request into an action contract.
 *
 * @param {string|{phrase?: string, text?: string, explicit?: boolean, level?: string, fix?: boolean}} input
 * @param {{explicit?: boolean, level?: string, fix?: boolean}} [options]
 */
export function resolveRequest(input, options = {}) {
  const request = typeof input === 'string' ? { phrase: input, ...options } : { ...(input ?? {}) };
  const phrase = request.phrase ?? request.text ?? '';
  const normalized = normalizeAlias(phrase);
  const match = matchWrappedRequest(phrase);
  const requestedLevel = normalizeLevel(request.level);

  if (request.level != null && !requestedLevel) {
    return {
      kind: 'unknown',
      normalized,
      reason: 'invalid-level',
      allowedLevels: [...COMMAND_LEVELS]
    };
  }

  if (!match) {
    return { kind: 'unknown', request: phrase, normalized, reason: 'no-exact-intent-match', fallback: 'Interpret the user task, then call explain with one known intent and --target preserving the exact target. Keep reviews read-only; do not invent permission.' };
  }

  const explicit = request.explicit === true;
  const fix = request.fix === true;
  const readOnly = match.command.mutationPolicy === 'read-only-unless-fix' && !fix;
  const target = request.target ?? match.target;
  const supportingReferences = reviewTargetReferences(match.command, target);

  return {
    kind: 'direct',
    intent: match.command.id,
    matchedAlias: match.matchedAlias,
    normalized,
    target,
    level: requestedLevel ?? match.command.defaultLevel,
    stage: readOnly ? 'review' : match.command.id === 'explore' || requestedLevel === 'reimagine' ? 'explore' : 'build',
    explicit,
    fix,
    readOnly,
    reference: match.command.reference,
    supportingReferences,
    protectedScope: [...match.command.protectedScope],
    verification: [...match.command.verification]
  };
}

export function listCommands() {
  return COMMANDS.map((command) => ({
    id: command.id,
    aliases: [...command.aliases],
    naturalPhrases: [...command.naturalPhrases],
    category: command.category,
    summary: command.summary,
    defaultLevel: command.defaultLevel,
    naturalPhrasePicker: command.naturalPhrasePicker,
    reference: command.reference,
    protectedScope: [...command.protectedScope],
    verification: [...command.verification],
    mutationPolicy: command.mutationPolicy
  }));
}
