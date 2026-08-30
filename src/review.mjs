import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { validateReview } from './checker.mjs';
import { exists, fileHash, sha256, writeAtomic } from './utils.mjs';

export const REVIEW_RELATIVE = '.wingmanpm-design/review.json';
export const GLOBAL_REVIEW_CHECKS = Object.freeze([
  'keyboard', 'zoom200', 'reducedMotion', 'longContent', 'light', 'dark', 'axe',
  'responsiveStates', 'structureUnique', 'dropdownContrast'
]);
export const TABLE_REVIEW_CHECKS = Object.freeze([
  'tableDensity', 'tableColumns', 'tablePagination', 'tableExpansion', 'tableBulk'
]);

async function tableReviewChecks(root, additionalProfiles = []) {
  const directory = path.join(root, 'design-system', 'tables');
  let names = [];
  try {
    names = (await readdir(directory)).filter((name) => name.endsWith('.json'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const profiles = [...additionalProfiles];
  const allowedProfiles = new Set(['static', 'work', 'editable']);
  let operational = false;
  let editable = false;
  for (const name of names) {
    let value;
    try { value = JSON.parse(await readFile(path.join(directory, name), 'utf8')); }
    catch (error) { throw new Error(`Cannot plan review state from malformed table contract ${name}: ${error.message}`); }
    profiles.push(value?.profile);
  }
  for (const profile of profiles) {
    if (!allowedProfiles.has(profile)) throw new Error(`Cannot plan review state from unknown table profile: ${String(profile)}.`);
    if (profile === 'work' || profile === 'editable') operational = true;
    if (profile === 'editable') editable = true;
  }
  return [...(operational ? TABLE_REVIEW_CHECKS : []), ...(editable ? ['tableEditing'] : [])];
}

export async function requiredReviewChecks(root, options = {}) {
  return [...GLOBAL_REVIEW_CHECKS, ...await tableReviewChecks(root, options.additionalProfiles ?? [])];
}

export async function createPendingReview(root, notes, options = {}) {
  const checks = await requiredReviewChecks(root, options);
  return {
    status: 'pending',
    reviewer: null,
    reviewedAt: null,
    sourceHash: null,
    viewports: [390, 768, 1280, 1440],
    checks: Object.fromEntries(checks.map((key) => [key, false])),
    notes
  };
}

export async function planReviewInvalidation(root, options = {}) {
  const file = path.join(root, REVIEW_RELATIVE);
  const desired = await createPendingReview(root, options.notes ?? 'Review invalidated after generated design changes.', options);
  const content = `${JSON.stringify(desired, null, 2)}\n`;
  let prior = null;
  let parsed = null;
  if (await exists(file)) {
    prior = await readFile(file, 'utf8');
    try { parsed = JSON.parse(prior); } catch {}
  }
  const required = Object.keys(desired.checks);
  const pendingIsNotCanonical = parsed?.status === 'pending' && (
    parsed.reviewer !== null
    || parsed.reviewedAt !== null
    || parsed.sourceHash !== null
    || JSON.stringify(parsed.viewports) !== JSON.stringify(desired.viewports)
    || Object.keys(parsed.checks ?? {}).length !== required.length
    || required.some((key) => parsed.checks?.[key] !== false)
  );
  const invalid = !parsed
    || validateReview(parsed).some((issue) => issue.severity === 'block')
    || required.some((key) => typeof parsed.checks?.[key] !== 'boolean')
    || (parsed.status === 'reviewed' && required.some((key) => parsed.checks?.[key] !== true))
    || pendingIsNotCanonical;
  const shouldInvalidate = options.force === true || invalid;
  return {
    file,
    existed: prior !== null,
    changed: shouldInvalidate && prior !== content,
    content,
    review: desired,
    hash: shouldInvalidate ? sha256(content) : prior === null ? null : sha256(prior),
    invalid
  };
}

export async function applyReviewInvalidation(plan) {
  if (plan.changed) await writeAtomic(plan.file, plan.content);
  return plan.hash ?? (await exists(plan.file) ? fileHash(plan.file) : null);
}

export function upsertObservedReviewEntry(manifest, hash) {
  if (!hash) return;
  manifest.entries ??= [];
  const next = { path: REVIEW_RELATIVE, ownership: 'observed', action: 'created', hash };
  let found = false;
  manifest.entries = manifest.entries.filter((entry) => {
    if (entry.path !== REVIEW_RELATIVE) return true;
    if (found) return false;
    Object.assign(entry, next);
    found = true;
    return true;
  });
  if (!found) manifest.entries.push(next);
}
