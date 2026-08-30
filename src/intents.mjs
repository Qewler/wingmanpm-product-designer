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

const PICKER_OPTIONS = Object.freeze([
  Object.freeze({
    id: 'refine',
    label: 'Refine',
    description: 'Preserve the direction and repair hierarchy, rhythm, states, and consistency.'
  }),
  Object.freeze({
    id: 'elevate',
    label: 'Elevate',
    description: 'Refine the surface and add one useful product-specific signature moment.'
  }),
  Object.freeze({
    id: 'reimagine',
    label: 'Reimagine',
    description: 'Create three responsive coded directions and wait for a choice before full implementation.'
  })
]);

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

function matchWrappedRequest(normalized) {
  const exact = intentIndex.get(normalized) ?? naturalPhraseIndex.get(normalized);
  if (exact) return { ...exact, target: null };

  const polite = normalized
    .replace(/^please\s+/u, '')
    .replace(/^can you\s+/u, '')
    .replace(/^could you\s+/u, '');

  const suffixes = [...intentIndex.entries(), ...naturalPhraseIndex.entries()]
    .sort(([left], [right]) => right.length - left.length);

  for (const [alias, match] of suffixes) {
    const makePrefix = 'make ';
    const suffix = ` ${alias}`;
    if (polite.startsWith(makePrefix) && polite.endsWith(suffix)) {
      const target = polite.slice(makePrefix.length, -suffix.length).trim();
      if (target) return { ...match, target: /^(it|this)$/u.test(target) ? null : target };
    }

    if (polite === `${alias} it` || polite === `${alias} this`) {
      return { ...match, target: null };
    }
    if (polite.startsWith(`${alias} `)) {
      const target = polite.slice(alias.length + 1).trim();
      if (target && target !== 'it' && target !== 'this') return { ...match, target };
    }
  }

  return null;
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
  const match = matchWrappedRequest(normalized);
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
    return { kind: 'unknown', normalized, reason: 'no-exact-intent-match' };
  }

  const explicit = request.explicit === true;
  const fix = request.fix === true;
  const readOnly = match.command.mutationPolicy === 'read-only-unless-fix' && !fix;
  const shouldPick = match.command.naturalPhrasePicker && !explicit && !requestedLevel;

  if (shouldPick) {
    return {
      kind: 'picker',
      intent: match.command.id,
      matchedAlias: match.matchedAlias,
      normalized,
      target: match.target,
      recommendedLevel: match.command.defaultLevel,
      options: PICKER_OPTIONS.map((option) => ({ ...option })),
      explicit: false,
      fix,
      readOnly,
      reference: match.command.reference
    };
  }

  return {
    kind: 'direct',
    intent: match.command.id,
    matchedAlias: match.matchedAlias,
    normalized,
    target: match.target,
    level: requestedLevel ?? match.command.defaultLevel,
    explicit,
    fix,
    readOnly,
    reference: match.command.reference,
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
