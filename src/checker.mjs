import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_STATES = ['loading', 'empty', 'partial', 'error', 'success', 'disabled', 'permission', 'offline', 'responsive'];
const REQUIRED_TABLE_STATES = ['loading', 'empty', 'no-results', 'partial', 'stale', 'error', 'permission', 'offline', 'saving', 'success'];
const REQUIRED_VIEWPORTS = [390, 768, 1280, 1440];
const REQUIRED_REVIEW_CHECKS = ['keyboard', 'zoom200', 'reducedMotion', 'longContent', 'light', 'dark', 'axe', 'responsiveStates', 'structureUnique', 'dropdownContrast'];
const OPTIONAL_TABLE_REVIEW_CHECKS = ['tableDensity', 'tableColumns', 'tablePagination', 'tableExpansion', 'tableBulk', 'tableEditing'];
const TABLE_PROFILES = new Set(['static', 'work', 'editable']);
const NON_EXEMPTIBLE_RULES = new Set(['WPD021', 'WPD022', 'WPD023']);
const TABLE_CAPABILITIES = ['visibility', 'reorder', 'resize', 'expansion', 'selection', 'bulkActions', 'inlineEditing', 'virtualization'];
const TABLE_PREFERENCE_KEYS = ['density', 'columnOrder', 'columnVisibility', 'columnWidths'];
const TABLE_TRANSIENT_KEYS = ['selection', 'drafts', 'errors', 'activeEditing'];
const TEXT_EXTENSIONS = new Set(['.astro', '.cjs', '.css', '.html', '.js', '.jsx', '.md', '.mdx', '.mjs', '.scss', '.svelte', '.ts', '.tsx', '.vue']);
const REVIEW_EXTENSIONS = new Set([...TEXT_EXTENSIONS, '.json']);
const POLICY_TEXT_EXTENSIONS = new Set([...TEXT_EXTENSIONS, '.json', '.txt', '.yaml', '.yml']);
const IGNORE = new Set(['.cache', '.git', '.next', '.turbo', 'build', 'coverage', 'dist', 'node_modules', 'out', 'storybook-static', 'vendor']);
const LOCKFILES = new Set(['bun.lock', 'bun.lockb', 'npm-shrinkwrap.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);
const DEFAULT_SCAN_ROOTS = ['src', 'app', 'pages', 'components', 'stories', 'design-system/examples'];

async function exists(target) {
  try { await stat(target); return true; } catch { return false; }
}

async function readJsonDocument(target) {
  let source;
  try {
    source = await readFile(target, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return { exists: false, value: null, error: null };
    return { exists: true, value: null, error: `Cannot read JSON: ${error.message}` };
  }
  try {
    return { exists: true, value: JSON.parse(source), error: null };
  } catch (error) {
    return { exists: true, value: null, error: `Malformed JSON: ${error.message}` };
  }
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function issue(pathname, message, severity = 'block') {
  return { path: pathname, message, severity };
}

function additionalProperties(value, allowed, pathname = '$') {
  if (!object(value)) return [];
  return Object.keys(value)
    .filter((key) => !allowed.includes(key))
    .map((key) => issue(`${pathname}.${key}`, 'Unknown property.'));
}

function validIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validIsoDateTime(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

function validProjectPath(value) {
  if (typeof value !== 'string' || value.trim() !== value || value.length < 1 || path.isAbsolute(value)) return false;
  const normalized = value.split('\\').join('/');
  return normalized !== '..' && !normalized.startsWith('../') && !normalized.includes('/../');
}

function requireBooleanProperties(value, keys, pathname, output, optionalKeys = []) {
  if (!object(value)) {
    output.push(issue(pathname, 'Must be an object.'));
    return;
  }
  for (const key of keys) {
    if (typeof value[key] !== 'boolean') output.push(issue(`${pathname}.${key}`, 'Must be a boolean.'));
  }
  for (const key of optionalKeys) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') output.push(issue(`${pathname}.${key}`, 'Must be a boolean.'));
  }
  output.push(...additionalProperties(value, [...keys, ...optionalKeys], pathname));
}

/** Validate a project config without requiring a JSON Schema runtime. */
export function validateConfig(value, { allowLegacy = true } = {}) {
  const output = [];
  if (!object(value)) return [issue('$', 'Config must be a JSON object.')];
  const allowed = ['schemaVersion', 'systemMode', 'stack', 'goldenStack', 'requiresDarkTheme', 'aiSurfaces', 'legacyBaseline', 'scanRoots', 'viewports', 'visualEvidenceMaxAgeDays'];
  output.push(...additionalProperties(value, allowed));
  if (value.schemaVersion === 1 && allowLegacy) output.push(issue('$.schemaVersion', 'Schema version 1 is supported only for migration; run wingman-design upgrade.', 'warn'));
  else if (value.schemaVersion !== 2) output.push(issue('$.schemaVersion', 'Must equal the current schema version 2.'));
  if (!['new-system', 'preserve'].includes(value.systemMode)) output.push(issue('$.systemMode', 'Must be new-system or preserve.'));
  if (typeof value.stack !== 'string' || value.stack.trim().length < 1) output.push(issue('$.stack', 'Must be a non-empty string.'));
  for (const key of ['goldenStack', 'requiresDarkTheme', 'aiSurfaces', 'legacyBaseline']) {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') output.push(issue(`$.${key}`, 'Must be a boolean.'));
  }
  if (typeof value.requiresDarkTheme !== 'boolean') output.push(issue('$.requiresDarkTheme', 'Is required and must be a boolean.'));
  if (!Array.isArray(value.scanRoots) || value.scanRoots.length < 1) output.push(issue('$.scanRoots', 'Must be a non-empty array of project-relative paths.'));
  else {
    const unique = new Set();
    for (const [index, root] of value.scanRoots.entries()) {
      if (!validProjectPath(root)) output.push(issue(`$.scanRoots[${index}]`, 'Must be a safe project-relative path.'));
      if (unique.has(root)) output.push(issue(`$.scanRoots[${index}]`, 'Must not repeat a scan root.'));
      unique.add(root);
    }
  }
  if (!Array.isArray(value.viewports)) output.push(issue('$.viewports', 'Must be an array of integer viewport widths.'));
  else {
    if (value.viewports.some((viewport) => !Number.isInteger(viewport) || viewport < 320)) output.push(issue('$.viewports', 'Each viewport must be an integer of at least 320.'));
    if (new Set(value.viewports).size !== value.viewports.length) output.push(issue('$.viewports', 'Must not repeat a viewport.'));
    for (const viewport of REQUIRED_VIEWPORTS) if (!value.viewports.includes(viewport)) output.push(issue('$.viewports', `Must include ${viewport}.`));
  }
  if (value.visualEvidenceMaxAgeDays !== undefined && (!Number.isInteger(value.visualEvidenceMaxAgeDays) || value.visualEvidenceMaxAgeDays < 1 || value.visualEvidenceMaxAgeDays > 180)) {
    output.push(issue('$.visualEvidenceMaxAgeDays', 'Must be an integer from 1 to 180.'));
  }
  return output;
}

/** Validate exception structure and expiry while leaving matching to runChecks. */
export function validateExceptions(value, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const output = [];
  if (!object(value)) return [issue('$', 'Exceptions must be a JSON object.')];
  output.push(...additionalProperties(value, ['exceptions']));
  if (!Array.isArray(value.exceptions)) return [...output, issue('$.exceptions', 'Is required and must be an array.')];
  for (const [index, entry] of value.exceptions.entries()) {
    const base = `$.exceptions[${index}]`;
    if (!object(entry)) {
      output.push(issue(base, 'Must be an object.'));
      continue;
    }
    const keys = ['ruleId', 'target', 'reason', 'approver', 'reviewDate'];
    output.push(...additionalProperties(entry, keys, base));
    if (typeof entry.ruleId !== 'string' || !/^WPD(?:\d{3}|-EXCEPTION)$/.test(entry.ruleId)) output.push(issue(`${base}.ruleId`, 'Must be a WingmanPM rule ID such as WPD005.'));
    else if (NON_EXEMPTIBLE_RULES.has(entry.ruleId)) output.push(issue(`${base}.ruleId`, `${entry.ruleId} is a global hard rule and cannot be excepted.`));
    if (!validProjectPath(entry.target) && entry.target !== '*' && entry.target !== '**') output.push(issue(`${base}.target`, 'Must be a non-empty project-relative target or glob.'));
    if (typeof entry.reason !== 'string' || entry.reason.trim().length < 12) output.push(issue(`${base}.reason`, 'Must explain the exception in at least 12 characters.'));
    if (typeof entry.approver !== 'string' || entry.approver.trim().length < 2) output.push(issue(`${base}.approver`, 'Must name the approver.'));
    if (!validIsoDate(entry.reviewDate)) output.push(issue(`${base}.reviewDate`, 'Must be a real ISO date in YYYY-MM-DD form.'));
    else if (entry.reviewDate < today) output.push(issue(`${base}.reviewDate`, 'The exception is past its review date.'));
  }
  return output;
}

/** Validate visual-review evidence shape. Freshness is checked by runChecks. */
export function validateReview(value) {
  const output = [];
  if (!object(value)) return [issue('$', 'Review evidence must be a JSON object.')];
  const allowed = ['status', 'reviewer', 'reviewedAt', 'sourceHash', 'viewports', 'checks', 'notes'];
  output.push(...additionalProperties(value, allowed));
  if (!['pending', 'reviewed'].includes(value.status)) output.push(issue('$.status', 'Must be pending or reviewed.'));
  if (value.reviewer !== null && value.reviewer !== undefined && (typeof value.reviewer !== 'string' || value.reviewer.trim().length < 2)) output.push(issue('$.reviewer', 'Must be null or name the reviewer.'));
  if (value.reviewedAt !== null && value.reviewedAt !== undefined && !validIsoDateTime(value.reviewedAt)) output.push(issue('$.reviewedAt', 'Must be null or a valid date-time.'));
  if (value.sourceHash !== null && value.sourceHash !== undefined && (typeof value.sourceHash !== 'string' || !/^[a-f0-9]{64}$/i.test(value.sourceHash))) output.push(issue('$.sourceHash', 'Must be null or a SHA-256 hash.'));
  if (!Array.isArray(value.viewports)) output.push(issue('$.viewports', 'Must be an array of viewport widths.'));
  else {
    if (value.viewports.some((viewport) => !Number.isInteger(viewport) || viewport < 320)) output.push(issue('$.viewports', 'Each viewport must be an integer of at least 320.'));
    if (new Set(value.viewports).size !== value.viewports.length) output.push(issue('$.viewports', 'Must not repeat a viewport.'));
    for (const viewport of REQUIRED_VIEWPORTS) if (!value.viewports.includes(viewport)) output.push(issue('$.viewports', `Must include ${viewport}.`));
  }
  requireBooleanProperties(value.checks, REQUIRED_REVIEW_CHECKS, '$.checks', output, OPTIONAL_TABLE_REVIEW_CHECKS);
  if (value.notes !== undefined && typeof value.notes !== 'string') output.push(issue('$.notes', 'Must be a string.'));
  if (value.status === 'reviewed') {
    if (typeof value.reviewer !== 'string' || value.reviewer.trim().length < 2) output.push(issue('$.reviewer', 'A reviewed record must name the reviewer.'));
    if (!validIsoDateTime(value.reviewedAt)) output.push(issue('$.reviewedAt', 'A reviewed record must include a valid date-time.'));
    if (typeof value.sourceHash !== 'string' || !/^[a-f0-9]{64}$/i.test(value.sourceHash)) output.push(issue('$.sourceHash', 'A reviewed record must include a SHA-256 source hash.'));
  }
  return output;
}

/** Validate machine-written browser evidence without a JSON Schema runtime. */
export function validateBrowserEvidence(value) {
  const output = [];
  if (!object(value)) return [issue('$', 'Browser evidence must be a JSON object.')];
  const allowed = [
    'schemaVersion', 'status', 'sourceHash', 'completedAt', 'tests', 'storyCount',
    'themes', 'structureUnique', 'dropdownContrast', 'dropdownCandidateCount'
  ];
  output.push(...additionalProperties(value, allowed));
  if (value.schemaVersion !== 1) output.push(issue('$.schemaVersion', 'Must equal 1.'));
  if (!['passed', 'failed'].includes(value.status)) output.push(issue('$.status', 'Must be passed or failed.'));
  if (typeof value.sourceHash !== 'string' || !/^[a-f0-9]{64}$/i.test(value.sourceHash)) output.push(issue('$.sourceHash', 'Must be a SHA-256 source hash.'));
  if (!validIsoDateTime(value.completedAt)) output.push(issue('$.completedAt', 'Must be a valid date-time.'));
  if (!object(value.tests)) output.push(issue('$.tests', 'Must contain browser test counts.'));
  else {
    output.push(...additionalProperties(value.tests, ['passed', 'failed', 'skipped'], '$.tests'));
    for (const key of ['passed', 'failed', 'skipped']) {
      if (!Number.isInteger(value.tests[key]) || value.tests[key] < 0) output.push(issue(`$.tests.${key}`, 'Must be a non-negative integer.'));
    }
  }
  if (!Number.isInteger(value.storyCount) || value.storyCount < 0) output.push(issue('$.storyCount', 'Must be a non-negative integer.'));
  if (!Array.isArray(value.themes) || value.themes.some((theme) => !['light', 'dark'].includes(theme)) || new Set(value.themes).size !== value.themes.length) {
    output.push(issue('$.themes', 'Must be a unique array containing only light and dark.'));
  }
  for (const key of ['structureUnique', 'dropdownContrast']) {
    if (typeof value[key] !== 'boolean') output.push(issue(`$.${key}`, 'Must be a boolean.'));
  }
  if (!Number.isInteger(value.dropdownCandidateCount) || value.dropdownCandidateCount < 0) output.push(issue('$.dropdownCandidateCount', 'Must be a non-negative integer.'));
  if (value.status === 'passed') {
    if (value.tests?.failed !== 0) output.push(issue('$.tests.failed', 'Passed evidence cannot contain failed tests.'));
    if (value.tests?.skipped !== 0) output.push(issue('$.tests.skipped', 'Passed evidence cannot contain skipped tests.'));
    if (!(value.tests?.passed > 0)) output.push(issue('$.tests.passed', 'Passed evidence must contain at least one passed test.'));
    if (!(value.storyCount > 0)) output.push(issue('$.storyCount', 'Passed evidence must cover at least one story.'));
    for (const theme of ['light', 'dark']) if (!value.themes?.includes(theme)) output.push(issue('$.themes', `Passed evidence must include ${theme}.`));
    if (value.structureUnique !== true) output.push(issue('$.structureUnique', 'Passed evidence must confirm unique structure.'));
    if (value.dropdownContrast !== true) output.push(issue('$.dropdownContrast', 'Passed evidence must confirm dropdown contrast.'));
  }
  return output;
}

function enumArray(value, allowed, pathname, output, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length < 1)) {
    output.push(issue(pathname, allowEmpty ? 'Must be an array.' : 'Must be a non-empty array.'));
    return;
  }
  const seen = new Set();
  for (const [index, entry] of value.entries()) {
    if (!allowed.includes(entry)) output.push(issue(`${pathname}[${index}]`, `Must be one of: ${allowed.join(', ')}.`));
    if (seen.has(entry)) output.push(issue(`${pathname}[${index}]`, 'Must not repeat a value.'));
    seen.add(entry);
  }
}

/** Validate the portable data-table contract. Interaction issues map to WPD020. */
export function validateTableContract(value) {
  const output = [];
  if (!object(value)) return [issue('$', 'Table contract must be a JSON object.')];
  const allowed = ['id', 'version', 'profile', 'semantics', 'rowIdField', 'pagination', 'columns', 'capabilities', 'interactionAlternatives', 'preferences', 'states', 'evidence'];
  output.push(...additionalProperties(value, allowed));
  if (typeof value.id !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/.test(value.id)) output.push(issue('$.id', 'Must be a stable lowercase table ID.'));
  if (!Number.isInteger(value.version) || value.version < 1) output.push(issue('$.version', 'Must be a positive integer.'));
  if (!TABLE_PROFILES.has(value.profile)) output.push(issue('$.profile', 'Must be static, work, or editable.'));
  if (!['table', 'grid'].includes(value.semantics)) output.push(issue('$.semantics', 'Must be table or grid.'));
  if (typeof value.rowIdField !== 'string' || value.rowIdField.trim().length < 1) output.push(issue('$.rowIdField', 'Must name a stable row identity field.'));

  if (!object(value.pagination)) output.push(issue('$.pagination', 'Must be an object.'));
  else {
    output.push(...additionalProperties(value.pagination, ['mode', 'pageSize'], '$.pagination'));
    if (!['client', 'offset', 'cursor'].includes(value.pagination.mode)) output.push(issue('$.pagination.mode', 'Must be client, offset, or cursor.'));
    if (!Number.isInteger(value.pagination.pageSize) || value.pagination.pageSize < 1 || value.pagination.pageSize > 1000) output.push(issue('$.pagination.pageSize', 'Must be an integer from 1 to 1000.'));
  }

  if (!Array.isArray(value.columns) || value.columns.length < 1) output.push(issue('$.columns', 'Must contain at least one column.'));
  else {
    const ids = new Set();
    let editors = 0;
    for (const [index, column] of value.columns.entries()) {
      const base = `$.columns[${index}]`;
      if (!object(column)) {
        output.push(issue(base, 'Must be an object.'));
        continue;
      }
      const keys = ['id', 'label', 'type', 'align', 'minWidth', 'defaultWidth', 'maxWidth', 'priority', 'required', 'hideable', 'sortable', 'filterable', 'resizable', 'reorderable', 'fullValue', 'editor'];
      output.push(...additionalProperties(column, keys, base));
      if (typeof column.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(column.id)) output.push(issue(`${base}.id`, 'Must be a stable column ID.'));
      else if (ids.has(column.id)) output.push(issue(`${base}.id`, 'Column IDs must be unique.'));
      ids.add(column.id);
      if (typeof column.label !== 'string' || column.label.trim().length < 1) output.push(issue(`${base}.label`, 'Must be a non-empty label.'));
      if (!['text', 'number', 'date', 'status', 'actions', 'selection'].includes(column.type)) output.push(issue(`${base}.type`, 'Uses an unsupported column type.'));
      if (!['start', 'center', 'end'].includes(column.align)) output.push(issue(`${base}.align`, 'Must be start, center, or end.'));
      for (const key of ['minWidth', 'defaultWidth', 'maxWidth']) if (!Number.isFinite(column[key]) || column[key] <= 0) output.push(issue(`${base}.${key}`, 'Must be a positive number.'));
      if (Number.isFinite(column.minWidth) && Number.isFinite(column.defaultWidth) && Number.isFinite(column.maxWidth) && !(column.minWidth <= column.defaultWidth && column.defaultWidth <= column.maxWidth)) output.push(issue(base, 'Column widths must satisfy minWidth <= defaultWidth <= maxWidth.'));
      if (!Number.isInteger(column.priority) || column.priority < 1 || column.priority > 5) output.push(issue(`${base}.priority`, 'Must be an integer from 1 to 5.'));
      for (const key of ['required', 'hideable', 'sortable', 'filterable', 'resizable', 'reorderable']) if (typeof column[key] !== 'boolean') output.push(issue(`${base}.${key}`, 'Must be a boolean.'));
      if (column.required === true && column.hideable === true) output.push(issue(base, 'A required column cannot be hideable.'));
      if (!['wrap', 'focus-tooltip', 'row-details'].includes(column.fullValue)) output.push(issue(`${base}.fullValue`, 'Must expose the full value by wrapping, focus tooltip, or row details.'));
      if (column.editor !== undefined) {
        editors += 1;
        if (!['text', 'number', 'select', 'date'].includes(column.editor)) output.push(issue(`${base}.editor`, 'Uses an unsupported editor.'));
      }
    }
    if (value.profile === 'editable' && editors < 1) output.push(issue('$.columns', 'An editable table must declare at least one editable column.'));
    if (value.profile !== 'editable' && editors > 0) output.push(issue('$.columns', 'Only the editable profile can declare column editors.'));
  }

  requireBooleanProperties(value.capabilities, TABLE_CAPABILITIES, '$.capabilities', output);
  if (object(value.capabilities) && TABLE_PROFILES.has(value.profile)) {
    const operational = ['visibility', 'reorder', 'resize', 'expansion', 'selection', 'bulkActions'];
    if (value.profile === 'static') {
      for (const key of [...operational, 'inlineEditing', 'virtualization']) if (value.capabilities[key] !== false) output.push(issue(`$.capabilities.${key}`, 'Static tables do not enable operational grid controls.'));
    } else {
      for (const key of operational) if (value.capabilities[key] !== true) output.push(issue(`$.capabilities.${key}`, `${value.profile} tables require this capability.`));
      if (value.capabilities.inlineEditing !== (value.profile === 'editable')) output.push(issue('$.capabilities.inlineEditing', 'Must be enabled only for the editable profile.'));
    }
  }

  if (!object(value.interactionAlternatives)) output.push(issue('$.interactionAlternatives', 'Must declare safe interaction alternatives.'));
  else {
    const base = '$.interactionAlternatives';
    output.push(...additionalProperties(value.interactionAlternatives, ['columnReorder', 'columnResize', 'fullValue', 'gridKeyboard'], base));
    enumArray(value.interactionAlternatives.columnReorder, ['drag', 'move-buttons'], `${base}.columnReorder`, output, { allowEmpty: true });
    enumArray(value.interactionAlternatives.columnResize, ['pointer', 'keyboard-separator', 'width-presets'], `${base}.columnResize`, output, { allowEmpty: true });
    enumArray(value.interactionAlternatives.fullValue, ['wrap', 'focus-tooltip', 'row-details'], `${base}.fullValue`, output);
    if (!['not-applicable', 'roving-focus'].includes(value.interactionAlternatives.gridKeyboard)) output.push(issue(`${base}.gridKeyboard`, 'Must be not-applicable or roving-focus.'));
    if (value.capabilities?.reorder === true) {
      for (const method of ['drag', 'move-buttons']) if (!value.interactionAlternatives.columnReorder?.includes(method)) output.push(issue(`${base}.columnReorder`, `Reorder requires ${method}.`));
    }
    if (value.capabilities?.resize === true) {
      for (const method of ['pointer', 'keyboard-separator', 'width-presets']) if (!value.interactionAlternatives.columnResize?.includes(method)) output.push(issue(`${base}.columnResize`, `Resize requires ${method}.`));
    }
    if (value.semantics === 'grid' && value.interactionAlternatives.gridKeyboard !== 'roving-focus') output.push(issue(`${base}.gridKeyboard`, 'Grid semantics require roving-focus keyboard behavior.'));
    if (value.semantics === 'table' && value.interactionAlternatives.gridKeyboard !== 'not-applicable') output.push(issue(`${base}.gridKeyboard`, 'Native table semantics must mark grid keyboard behavior not-applicable.'));
    const fullValueModes = new Set((value.columns ?? []).map((column) => column?.fullValue).filter(Boolean));
    for (const method of fullValueModes) if (!value.interactionAlternatives.fullValue?.includes(method)) output.push(issue(`${base}.fullValue`, `Must declare the column full-value path ${method}.`));
  }

  if (!object(value.preferences)) output.push(issue('$.preferences', 'Must declare persistent and transient preferences.'));
  else {
    const base = '$.preferences';
    output.push(...additionalProperties(value.preferences, ['scope', 'fallback', 'schemaVersion', 'persist', 'neverPersist'], base));
    if (!['account', 'workspace', 'local'].includes(value.preferences.scope)) output.push(issue(`${base}.scope`, 'Must be account, workspace, or local.'));
    if (!['versioned-local-storage', 'none'].includes(value.preferences.fallback)) output.push(issue(`${base}.fallback`, 'Must be versioned-local-storage or none.'));
    if (!Number.isInteger(value.preferences.schemaVersion) || value.preferences.schemaVersion < 1) output.push(issue(`${base}.schemaVersion`, 'Must be a positive integer.'));
    enumArray(value.preferences.persist, TABLE_PREFERENCE_KEYS, `${base}.persist`, output, { allowEmpty: true });
    enumArray(value.preferences.neverPersist, TABLE_TRANSIENT_KEYS, `${base}.neverPersist`, output);
    for (const key of TABLE_TRANSIENT_KEYS) if (!value.preferences.neverPersist?.includes(key)) output.push(issue(`${base}.neverPersist`, `Must include ${key}.`));
    if (value.profile !== 'static') for (const key of TABLE_PREFERENCE_KEYS) if (!value.preferences.persist?.includes(key)) output.push(issue(`${base}.persist`, `${value.profile} tables must persist ${key}.`));
  }

  enumArray(value.states, REQUIRED_TABLE_STATES, '$.states', output);
  if (Array.isArray(value.states) && value.profile !== 'static') for (const state of REQUIRED_TABLE_STATES) if (!value.states.includes(state)) output.push(issue('$.states', `${value.profile} tables must include ${state}.`));

  if (!object(value.evidence)) output.push(issue('$.evidence', 'Must declare stories, browser tests, and visual review evidence.'));
  else {
    const base = '$.evidence';
    output.push(...additionalProperties(value.evidence, ['stories', 'browserTests', 'visualReview'], base));
    for (const key of ['stories', 'browserTests']) {
      if (!Array.isArray(value.evidence[key]) || value.evidence[key].length < 1) output.push(issue(`${base}.${key}`, 'Must contain at least one evidence path.'));
      else for (const [index, target] of value.evidence[key].entries()) if (!validProjectPath(target)) output.push(issue(`${base}.${key}[${index}]`, 'Must be a safe project-relative path.'));
    }
    if (!validProjectPath(value.evidence.visualReview) || path.extname(value.evidence.visualReview) !== '.json') output.push(issue(`${base}.visualReview`, 'Must point to a project-relative JSON review record.'));
  }
  return output;
}

async function files(root, extensions = TEXT_EXTENSIONS) {
  const output = [];
  async function visit(directory) {
    let entries = [];
    try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (IGNORE.has(entry.name)) continue;
      if (entry.name === 'runtime' && path.basename(directory) === '.wingmanpm-design') continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (extensions.has(path.extname(target).toLowerCase())) output.push(target);
    }
  }
  await visit(root);
  return output.sort();
}

async function filesInRoots(root, roots = DEFAULT_SCAN_ROOTS, extensions = TEXT_EXTENSIONS) {
  const results = new Set();
  for (const relative of roots) {
    const target = path.join(root, relative);
    if (!(await exists(target))) continue;
    const metadata = await stat(target);
    if (metadata.isDirectory()) {
      for (const file of await files(target, extensions)) results.add(file);
    } else if (extensions.has(path.extname(target).toLowerCase())) {
      results.add(target);
    }
  }
  return [...results].sort();
}

function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

function globMatch(pattern, value) {
  if (pattern === '*' || pattern === '**') return true;
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`).test(value);
}

function add(findings, root, severity, ruleId, file, message, index = 0) {
  findings.push({
    severity,
    ruleId,
    file: file ? path.relative(root, file).split(path.sep).join('/') : '.',
    line: file && Number.isInteger(index) ? index : 0,
    message
  });
}

function validException(exception, today) {
  return validateExceptions({ exceptions: [exception] }, { today }).length === 0;
}

function findingKey(finding) {
  return [finding.ruleId, finding.file, finding.message].join('\u001f');
}

function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex');
}

function baselineCounts(findings) {
  const counts = {};
  for (const finding of findings) {
    if (['WPD011', 'WPD016', 'WPD021', 'WPD022', 'WPD023', 'WPD-EXCEPTION'].includes(finding.ruleId)) continue;
    const key = findingKey(finding);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function stripMarkdownFences(content) {
  const lines = content.split('\n');
  let fence = null;
  return lines.map((line) => {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker && !fence) {
      fence = marker[1][0];
      return ' '.repeat(line.length);
    }
    if (marker && fence === marker[1][0]) {
      fence = null;
      return ' '.repeat(line.length);
    }
    return fence ? ' '.repeat(line.length) : line;
  }).join('\n');
}

function normalizedLabel(value) {
  return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function additiveInteger(value) {
  let expression = value.replace(/\s+/g, '');
  while (expression.startsWith('(') && expression.endsWith(')')) expression = expression.slice(1, -1);
  const literal = '(?:0x[0-9a-f](?:_?[0-9a-f])*|[0-9](?:_?[0-9])*)';
  if (!new RegExp(`^[+-]?${literal}(?:[+-]${literal})*$`, 'i').test(expression)) return null;
  const terms = expression.match(new RegExp(`[+-]?${literal}`, 'gi')) ?? [];
  let total = 0;
  for (const term of terms) {
    const sign = term.startsWith('-') ? -1 : 1;
    const unsigned = term.replace(/^[+-]/, '').replaceAll('_', '');
    const number = Number(unsigned);
    if (!Number.isSafeInteger(number)) return null;
    total += sign * number;
  }
  return Number.isSafeInteger(total) ? total : null;
}

function constructedDashMatches(content) {
  const matches = [];
  const callPattern = new RegExp([
    'String', '\\s*\\.\\s*', 'from', '(CodePoint|CharCode)',
    '\\s*\\(\\s*([0-9a-fx_+\\-\\s()]+)\\s*\\)'
  ].join(''), 'gi');
  for (const match of content.matchAll(callPattern)) {
    if (additiveInteger(match[2]) === 0x2000 + 0x14) matches.push({
      index: match.index,
      kind: match[1].toLowerCase() === 'codepoint' ? 'JavaScript code-point construction' : 'JavaScript character-code construction'
    });
  }
  return matches;
}

function forbiddenDashMatches(content, extension) {
  const matches = [];
  const literal = String['from' + 'CodePoint'](0x2000 + 0x14);
  for (let index = content.indexOf(literal); index >= 0; index = content.indexOf(literal, index + literal.length)) {
    matches.push({ index, kind: 'literal punctuation' });
  }

  const searchable = ['.md', '.mdx'].includes(extension) ? stripMarkdownFences(content) : content;
  const patterns = [
    { regex: new RegExp(['&', 'mdash(?:;|(?=[^0-9a-z]|$))'].join(''), 'gi'), kind: 'named HTML render equivalent' },
    { regex: new RegExp(['&#', '8212(?:;|(?=[^0-9]|$))'].join(''), 'g'), kind: 'numeric HTML render equivalent' },
    { regex: new RegExp(['&#', 'x0*2014(?:;|(?=[^0-9a-f]|$))'].join(''), 'gi'), kind: 'hex HTML render equivalent' }
  ];
  if (['.astro', '.cjs', '.js', '.jsx', '.json', '.mjs', '.svelte', '.ts', '.tsx', '.vue', '.yaml', '.yml'].includes(extension)) {
    patterns.push({
      regex: new RegExp('\\\\' + 'u(?:0{0,4}2014|\\{0*2014\\})', 'gi'),
      kind: 'JavaScript Unicode render escape'
    });
    matches.push(...constructedDashMatches(searchable));
  }
  if (['.astro', '.cjs', '.css', '.html', '.js', '.jsx', '.mjs', '.scss', '.svelte', '.ts', '.tsx', '.vue'].includes(extension)) {
    patterns.push({
      regex: new RegExp('\\\\' + '0*2014(?:\\s|(?=[^0-9a-f]|$))', 'gi'),
      kind: 'CSS render escape'
    });
  }
  for (const pattern of patterns) {
    for (const match of searchable.matchAll(pattern.regex)) matches.push({ index: match.index, kind: pattern.kind });
  }
  return matches.sort((a, b) => a.index - b.index);
}

function duplicateMarkdownHeadings(content) {
  const searchable = stripMarkdownFences(content);
  const seen = new Set();
  const duplicates = [];
  for (const match of searchable.matchAll(/^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/gm)) {
    const text = normalizedLabel(match[2]);
    if (!text) continue;
    const key = `${match[1].length}\u001f${text}`;
    if (seen.has(key)) duplicates.push({ index: match.index, level: match[1].length, text: match[2].trim() });
    else seen.add(key);
  }
  return duplicates;
}

function duplicateHtmlHeadings(content) {
  const seen = new Set();
  const duplicates = [];
  for (const match of content.matchAll(/<h([1-6])\b(?![^>]*(?:\bhidden\b|\binert\b|aria-hidden\s*=\s*["']true["']))[^>]*>\s*([^<{][^<{}]*?)\s*<\/h\1\s*>/gi)) {
    const text = normalizedLabel(match[2].replace(/&nbsp;/gi, ' '));
    if (!text) continue;
    const key = `${match[1]}\u001f${text}`;
    if (seen.has(key)) duplicates.push({ index: match.index, level: Number(match[1]), text: match[2].trim() });
    else seen.add(key);
  }
  return duplicates;
}

function dropdownSource(content) {
  return /<select\b|<input\b[^>]*\blist\s*=|\brole\s*=\s*\{?\s*["'](?:combobox|listbox)\b|\baria-haspopup\s*=\s*\{?\s*["']listbox\b|<(?:[A-Z][A-Za-z0-9.]*)?(?:Select|Combobox|Listbox)\b/.test(content);
}

function executableRuleEvidence(corpus, ruleId) {
  if (!corpus.includes(ruleId) || !/\btest\s*\(/.test(corpus) || !/\bexpect\s*\(/.test(corpus)) return false;
  if (ruleId === 'WPD022') return /auditVisibleStructure/.test(corpus) && /structureViolations/.test(corpus);
  if (ruleId === 'WPD023') return /auditDropdownContrast/.test(corpus) && /candidate/i.test(corpus);
  return true;
}

export function createLegacyBaseline(findings) {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    purpose: 'Preserve-mode baseline. Existing findings are recorded; new occurrences still block.',
    counts: baselineCounts(findings)
  };
}

export async function hashReviewSources(root) {
  const hasher = createHash('sha256');
  const configDocument = await readJsonDocument(path.join(root, '.wingmanpm-design', 'config.json'));
  const config = object(configDocument.value) ? configDocument.value : {};
  const configuredRoots = Array.isArray(config.scanRoots) && config.scanRoots.length > 0 && config.scanRoots.every(validProjectPath) ? config.scanRoots : DEFAULT_SCAN_ROOTS;
  const candidates = new Set(await filesInRoots(
    root,
    [...configuredRoots, 'design-system', 'tests/wingman-design'],
    REVIEW_EXTENSIONS
  ));
  for (const file of await files(root, TEXT_EXTENSIONS)) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    if (!relative.startsWith('.wingmanpm-design/')) candidates.add(file);
  }
  for (const contractFile of await tableContractFiles(root)) {
    candidates.add(contractFile);
    const contractDocument = await readJsonDocument(contractFile);
    if (!object(contractDocument.value)) continue;
    for (const target of [
      ...(contractDocument.value.evidence?.stories ?? []),
      ...(contractDocument.value.evidence?.browserTests ?? [])
    ]) {
      if (!validProjectPath(target)) continue;
      const evidenceFile = path.join(root, target);
      if (await exists(evidenceFile) && REVIEW_EXTENSIONS.has(path.extname(evidenceFile).toLowerCase())) candidates.add(evidenceFile);
    }
  }
  for (const file of [...candidates].sort()) {
    hasher.update(path.relative(root, file));
    hasher.update(await readFile(file));
  }
  return hasher.digest('hex');
}

function addValidationFindings(findings, root, ruleId, file, issues, defaultSeverity = 'block') {
  for (const validationIssue of issues) {
    add(findings, root, validationIssue.severity ?? defaultSeverity, ruleId, file, `${validationIssue.path}: ${validationIssue.message}`);
  }
}

async function tableContractFiles(root) {
  const directory = path.join(root, 'design-system', 'tables');
  let entries = [];
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return []; }
  return entries
    .filter((entry) => entry.isFile() && path.extname(entry.name) === '.json')
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

function attribute(tag, names) {
  for (const name of names) {
    const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
    if (match) return match[1];
  }
  return null;
}

function tableDeclarations(content) {
  const declarations = [];
  for (const match of content.matchAll(/<(?:DataTable|DataGrid|[A-Z][A-Za-z0-9.]*(?:DataTable|DataGrid)|table)\b[^>]*>/gs)) {
    const id = attribute(match[0], ['data-wingman-table-id', 'tableId']);
    const profile = attribute(match[0], ['data-wingman-table-profile', 'profile']);
    declarations.push({ id, profile, index: match.index, kind: match[0].match(/^<([^\s>]+)/)?.[1] ?? 'table' });
  }
  if (declarations.length === 0) {
    for (const match of content.matchAll(/\buseReactTable\s*\(/g)) declarations.push({ id: null, profile: null, index: match.index, kind: 'useReactTable' });
  }
  return declarations;
}

function isGenericWingmanRuntime(relative) {
  const normalized = `/${relative.split('\\').join('/')}`;
  return normalized.includes('/components/wingman-design/') && !normalized.includes('/components/wingman-design/tables/');
}

async function readEvidenceCorpus(root, targets) {
  let corpus = '';
  for (const target of targets ?? []) {
    if (!validProjectPath(target)) continue;
    const file = path.join(root, target);
    if (!(await exists(file)) || !REVIEW_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    corpus += `\n${await readFile(file, 'utf8')}`;
  }
  return corpus;
}

function interactionEvidenceIssues(contract, sourceCorpus, browserCorpus) {
  const output = [];
  if (!object(contract) || !TABLE_PROFILES.has(contract.profile)) return output;
  const requireEvidence = (condition, pathname, message) => {
    if (!condition) output.push(issue(pathname, message));
  };
  const contractIdPattern = new RegExp(contract.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  requireEvidence(
    /\btest\s*\(/.test(browserCorpus) && /\bexpect\s*\(/.test(browserCorpus) && contractIdPattern.test(browserCorpus),
    '$.evidence.browserTests',
    `Browser evidence must execute assertions for table ${contract.id}.`
  );

  if (contract.capabilities?.reorder === true) {
    requireEvidence(/DragDrop|useSortable|\bdraggable\b|onDrag(?:Start|End)?\b/i.test(sourceCorpus), '$.interactionAlternatives.columnReorder', 'Declared drag reorder has no implementation evidence.');
    requireEvidence(/\bmoveColumn\b|Move [^\n]*(?:left|right|start|end)/i.test(sourceCorpus), '$.interactionAlternatives.columnReorder', 'Declared non-drag reorder controls have no implementation evidence.');
    requireEvidence(/\.dragTo\s*\(|mouse\.down\s*\([\s\S]*mouse\.move\s*\([\s\S]*mouse\.up\s*\(/i.test(browserCorpus), '$.interactionAlternatives.columnReorder', 'Declared drag reorder has no browser interaction evidence.');
    requireEvidence(/Move [^\n]*(?:left|right|start|end)/i.test(browserCorpus), '$.interactionAlternatives.columnReorder', 'Declared non-drag reorder controls have no browser interaction evidence.');
  }

  if (contract.capabilities?.resize === true) {
    requireEvidence(/onPointerDown|pointerdown/i.test(sourceCorpus), '$.interactionAlternatives.columnResize', 'Declared pointer resize has no implementation evidence.');
    requireEvidence(/role\s*=\s*["'{]separator|aria-valuenow/i.test(sourceCorpus), '$.interactionAlternatives.columnResize', 'Declared keyboard separator has no implementation evidence.');
    requireEvidence(/width preset|Width preset/i.test(sourceCorpus), '$.interactionAlternatives.columnResize', 'Declared width presets have no implementation evidence.');
    requireEvidence(/pointerdown|mouse\.down\s*\(/i.test(browserCorpus), '$.interactionAlternatives.columnResize', 'Declared pointer resize has no browser interaction evidence.');
    requireEvidence(/getByRole\s*\(\s*['"]separator['"][\s\S]*Arrow(?:Left|Right)|Arrow(?:Left|Right)[\s\S]*getByRole\s*\(\s*['"]separator['"]/i.test(browserCorpus), '$.interactionAlternatives.columnResize', 'Declared keyboard separator has no browser interaction evidence.');
    requireEvidence(/width preset|selectOption\s*\(/i.test(browserCorpus), '$.interactionAlternatives.columnResize', 'Declared width presets have no browser interaction evidence.');
  }

  for (const method of contract.interactionAlternatives?.fullValue ?? []) {
    const supported = method === 'wrap'
      ? /complete value|complete values|long content|LongContent/i.test(browserCorpus)
      : method === 'focus-tooltip'
        ? /tooltip|Show full value/i.test(browserCorpus)
        : /Expand row|row details|expanded/i.test(browserCorpus);
    requireEvidence(supported, '$.interactionAlternatives.fullValue', `Declared ${method} full-value handling has no browser evidence.`);
  }

  if (contract.semantics === 'grid') {
    requireEvidence(/role\s*=\s*["'{]grid/i.test(sourceCorpus), '$.semantics', 'Grid semantics are declared without role="grid" implementation evidence.');
    requireEvidence(/getByRole\s*\(\s*['"]grid['"]/i.test(browserCorpus), '$.semantics', 'Grid semantics are declared without browser evidence for the grid role.');
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape']) {
      requireEvidence(sourceCorpus.includes(key) && browserCorpus.includes(key), '$.interactionAlternatives.gridKeyboard', `Grid keyboard evidence is missing ${key}.`);
    }
    requireEvidence(/\b(?:Enter|F2)\b/.test(sourceCorpus) && /\b(?:Enter|F2)\b/.test(browserCorpus), '$.interactionAlternatives.gridKeyboard', 'Grid editing evidence must include Enter or F2.');
  }
  return output;
}

function safetyIssue(validationIssue) {
  return validationIssue.path.startsWith('$.interactionAlternatives');
}

export async function runChecks(root, options = {}) {
  root = path.resolve(root);
  const findings = [];
  const configFile = path.join(root, '.wingmanpm-design', 'config.json');
  const configDocument = await readJsonDocument(configFile);
  const config = object(configDocument.value) ? configDocument.value : {};
  if (configDocument.error) add(findings, root, 'block', 'WPD016', configFile, configDocument.error);
  else if (configDocument.exists) addValidationFindings(findings, root, 'WPD016', configFile, validateConfig(config));
  const exceptionFile = path.join(root, '.wingmanpm-design', 'exceptions.json');
  const exceptionDocument = await readJsonDocument(exceptionFile);
  const exceptionData = object(exceptionDocument.value) ? exceptionDocument.value : { exceptions: [] };
  const today = new Date().toISOString().slice(0, 10);
  const validExceptions = [];

  if (exceptionDocument.error) add(findings, root, 'block', 'WPD-EXCEPTION', exceptionFile, exceptionDocument.error);
  else if (exceptionDocument.exists) addValidationFindings(findings, root, 'WPD-EXCEPTION', exceptionFile, validateExceptions(exceptionData, { today }));
  for (const exception of exceptionData?.exceptions ?? []) {
    if (validException(exception, today)) validExceptions.push(exception);
  }

  const required = [
    'design-system/PRODUCT.md', 'design-system/DESIGN.md', 'design-system/COMPONENTS.md',
    'design-system/surfaces', 'design-system/tokens/tokens.json',
    'design-system/tokens/tokens.css', 'design-system/tokens/tailwind.preset.mjs',
    'design-system/tokens/shadcn.css', '.wingmanpm-design/config.json',
    '.wingmanpm-design/exceptions.json', '.wingmanpm-design/review.json'
  ];
  for (const relative of required) {
    if (!(await exists(path.join(root, relative)))) add(findings, root, 'block', 'WPD001', null, `Missing required contract: ${relative}`);
  }

  const designFile = path.join(root, 'design-system', 'DESIGN.md');
  if (await exists(designFile)) {
    const design = await readFile(designFile, 'utf8');
    for (const axis of ['Expression', 'Density', 'Motion', 'Warmth']) {
      const match = design.match(new RegExp(`\\|\\s*${axis}\\s*\\|\\s*(\\d+)\\s*\\|`, 'i'));
      if (!match || Number(match[1]) < 1 || Number(match[1]) > 10) {
        add(findings, root, 'block', 'WPD002', designFile, `${axis} must be a justified integer from 1 to 10.`);
      }
    }
  }

  const tokenFile = path.join(root, 'design-system', 'tokens', 'tokens.json');
  if (await exists(tokenFile)) {
    const tokenDocument = await readJsonDocument(tokenFile);
    if (tokenDocument.error) add(findings, root, 'block', 'WPD003', tokenFile, tokenDocument.error);
    else {
      const tokens = tokenDocument.value;
      if (!String(tokens?.$schema ?? '').includes('2025.10')) add(findings, root, 'block', 'WPD003', tokenFile, 'Token source must declare the DTCG 2025.10 schema.');
      if (!tokens?.color?.light || !tokens?.color?.dark) add(findings, root, 'block', 'WPD003', tokenFile, 'Token source needs independently named light and dark color groups.');
    }
  }

  if (config.requiresDarkTheme === true) {
    const cssFile = path.join(root, 'design-system', 'tokens', 'tokens.css');
    const css = (await exists(cssFile)) ? await readFile(cssFile, 'utf8') : '';
    if (!css.includes('[data-theme="dark"]') && !css.includes('.dark')) add(findings, root, 'block', 'WPD012', cssFile, 'A new system must compile a dark theme.');
  }

  const componentsFile = path.join(root, 'design-system', 'COMPONENTS.md');
  if (await exists(componentsFile)) {
    const components = (await readFile(componentsFile, 'utf8')).toLowerCase();
    for (const state of REQUIRED_STATES) {
      if (!components.includes(state)) add(findings, root, 'block', 'WPD008', componentsFile, `The component contract is missing the ${state} state.`);
    }
  }

  const contractsById = new Map();
  const legacyTablesByFile = new Map();
  const inventoryFile = path.join(root, '.wingmanpm-design', 'table-inventory.json');
  const inventoryDocument = await readJsonDocument(inventoryFile);
  if (inventoryDocument.error) {
    add(findings, root, 'block', 'WPD018', inventoryFile, inventoryDocument.error);
  } else if (inventoryDocument.exists) {
    if (!object(inventoryDocument.value) || inventoryDocument.value.schemaVersion !== 1 || !Array.isArray(inventoryDocument.value.tables)) {
      add(findings, root, 'block', 'WPD018', inventoryFile, 'Table inventory must use schemaVersion 1 and contain a tables array.');
    } else {
      for (const entry of inventoryDocument.value.tables) {
        if (!object(entry) || entry.status !== 'legacy') continue;
        if (!validProjectPath(entry.file) || !/^[a-f0-9]{64}$/.test(entry.sourceHash ?? '')) {
          add(findings, root, 'block', 'WPD018', inventoryFile, 'Every legacy table inventory entry needs a safe file path and SHA-256 sourceHash.');
          continue;
        }
        const entries = legacyTablesByFile.get(entry.file) ?? [];
        entries.push(entry);
        legacyTablesByFile.set(entry.file, entries);
      }
    }
  }
  let sourceHashPromise;
  const currentSourceHash = () => {
    sourceHashPromise ??= hashReviewSources(root);
    return sourceHashPromise;
  };
  const scanRoots = Array.isArray(config.scanRoots) && config.scanRoots.length > 0 && config.scanRoots.every(validProjectPath) ? config.scanRoots : DEFAULT_SCAN_ROOTS;
  const sourceFiles = await filesInRoots(root, scanRoots);
  const sourceContents = new Map();
  for (const file of sourceFiles) sourceContents.set(file, await readFile(file, 'utf8'));
  const sourceCorpus = [...sourceContents.values()].join('\n');
  const browserEvidenceFiles = await filesInRoots(root, ['tests/wingman-design'], TEXT_EXTENSIONS);
  let browserEvidenceCorpus = '';
  for (const file of browserEvidenceFiles) browserEvidenceCorpus += `\n${await readFile(file, 'utf8')}`;

  const policyFiles = (await files(root, POLICY_TEXT_EXTENSIONS))
    .filter((file) => !LOCKFILES.has(path.basename(file)));
  const policyContents = new Map();
  for (const file of policyFiles) {
    const content = sourceContents.get(file) ?? await readFile(file, 'utf8');
    policyContents.set(file, content);
    const extension = path.extname(file).toLowerCase();
    for (const match of forbiddenDashMatches(content, extension)) {
      add(findings, root, 'block', 'WPD021', file, `Replace the ${match.kind}; WingmanPM output cannot render this punctuation.`, lineOf(content, match.index));
    }
    if (['.md', '.mdx'].includes(extension)) {
      for (const duplicate of duplicateMarkdownHeadings(content)) {
        add(findings, root, 'block', 'WPD022', file, `Repeated level ${duplicate.level} heading: ${duplicate.text}.`, lineOf(content, duplicate.index));
      }
    } else if (['.astro', '.html', '.svelte', '.vue'].includes(extension)) {
      for (const duplicate of duplicateHtmlHeadings(content)) {
        add(findings, root, 'block', 'WPD022', file, `Repeated visible h${duplicate.level} heading: ${duplicate.text}.`, lineOf(content, duplicate.index));
      }
    }
  }

  const productUiFiles = [...policyContents.entries()].filter(([file]) => {
    const relative = path.relative(root, file).split(path.sep).join('/');
    return ['.astro', '.html', '.jsx', '.svelte', '.tsx', '.vue'].includes(path.extname(file).toLowerCase())
      && !/(^|\/)(?:tests?|__tests__|fixtures)(\/|$)|\.(?:test|spec)\.[^.]+$/.test(relative);
  });
  const machineEvidenceFile = path.join(root, '.wingmanpm-design', 'browser-evidence.json');
  const machineEvidenceDocument = productUiFiles.length ? await readJsonDocument(machineEvidenceFile) : { exists: false, value: null, error: null };
  const machineEvidenceIssues = machineEvidenceDocument.exists && !machineEvidenceDocument.error
    ? validateBrowserEvidence(machineEvidenceDocument.value)
    : [];
  const machineEvidence = object(machineEvidenceDocument.value) ? machineEvidenceDocument.value : {};
  const machineEvidenceFresh = productUiFiles.length && machineEvidenceIssues.length === 0
    && machineEvidence.status === 'passed'
    && machineEvidence.sourceHash === await currentSourceHash();
  const machineEvidenceProblem = !machineEvidenceDocument.exists
    ? 'Machine-written browser evidence is missing.'
    : machineEvidenceDocument.error
      ? machineEvidenceDocument.error
      : machineEvidenceIssues.length
        ? `${machineEvidenceIssues[0].path}: ${machineEvidenceIssues[0].message}`
        : machineEvidence.status !== 'passed'
          ? 'The latest full browser run did not pass.'
          : machineEvidence.sourceHash !== await currentSourceHash()
            ? 'Machine-written browser evidence is stale.'
            : null;
  if (productUiFiles.length && !executableRuleEvidence(browserEvidenceCorpus, 'WPD022')) {
    add(findings, root, 'block', 'WPD022', null, 'Canonical browser source for unique visible headings, shell landmarks, and dialog close controls is missing.');
  }
  if (productUiFiles.length && (!machineEvidenceFresh || machineEvidence.structureUnique !== true)) {
    add(findings, root, 'block', 'WPD022', machineEvidenceFile, machineEvidenceProblem ?? 'Machine-written browser evidence did not confirm unique structure.');
  }
  const dropdownFiles = productUiFiles.filter(([, content]) => dropdownSource(content));
  if (dropdownFiles.length) {
    const dropdownEvidenceComplete = executableRuleEvidence(browserEvidenceCorpus, 'WPD023')
      && /\blight\b/i.test(browserEvidenceCorpus)
      && /\bdark\b/i.test(browserEvidenceCorpus)
      && /4\.5/.test(browserEvidenceCorpus)
      && /Escape/.test(browserEvidenceCorpus)
      && /candidate/i.test(browserEvidenceCorpus);
    if (!dropdownEvidenceComplete) {
      add(findings, root, 'block', 'WPD023', dropdownFiles[0][0], 'Dropdowns require canonical light and dark browser source for nonzero candidates, 4.5:1 text contrast, controlled options, and Escape close.');
    }
    if (!machineEvidenceFresh || machineEvidence.dropdownContrast !== true || !(machineEvidence.dropdownCandidateCount > 0)) {
      add(findings, root, 'block', 'WPD023', machineEvidenceFile, machineEvidenceProblem ?? 'Machine-written browser evidence did not confirm dropdown contrast with a nonzero candidate count.');
    }
  }
  for (const contractFile of await tableContractFiles(root)) {
    const document = await readJsonDocument(contractFile);
    if (document.error) {
      add(findings, root, 'block', 'WPD018', contractFile, document.error);
      continue;
    }
    const contract = document.value;
    const validationIssues = validateTableContract(contract);
    for (const validationIssue of validationIssues) {
      add(findings, root, validationIssue.severity, safetyIssue(validationIssue) ? 'WPD020' : 'WPD018', contractFile, `${validationIssue.path}: ${validationIssue.message}`);
    }
    if (!object(contract) || typeof contract.id !== 'string') continue;
    if (contractsById.has(contract.id)) add(findings, root, 'block', 'WPD018', contractFile, `Duplicate table contract ID: ${contract.id}.`);
    contractsById.set(contract.id, { contract, file: contractFile });
    if (path.basename(contractFile, '.json') !== contract.id) add(findings, root, 'block', 'WPD018', contractFile, 'The contract filename must match its stable table ID.');

    for (const target of [...(contract.evidence?.stories ?? []), ...(contract.evidence?.browserTests ?? [])]) {
      if (validProjectPath(target) && !(await exists(path.join(root, target)))) add(findings, root, 'block', 'WPD019', contractFile, `Declared table evidence is missing: ${target}`);
    }
    const browserCorpus = await readEvidenceCorpus(root, contract.evidence?.browserTests);
    addValidationFindings(findings, root, 'WPD020', contractFile, interactionEvidenceIssues(contract, sourceCorpus, browserCorpus));
    const reviewTarget = contract.evidence?.visualReview;
    if (validProjectPath(reviewTarget)) {
      const tableReviewFile = path.join(root, reviewTarget);
      const tableReviewDocument = await readJsonDocument(tableReviewFile);
      if (!tableReviewDocument.exists) add(findings, root, 'block', 'WPD019', contractFile, `Declared table visual review is missing: ${reviewTarget}`);
      else if (tableReviewDocument.error) add(findings, root, 'block', 'WPD019', tableReviewFile, tableReviewDocument.error);
      else if (tableReviewDocument.value?.status === 'pending') {
        addValidationFindings(findings, root, 'WPD019', tableReviewFile, validateReview(tableReviewDocument.value));
        add(findings, root, options.allowPendingReview ? 'warn' : 'block', 'WPD019', tableReviewFile, `Visual review evidence for table ${contract.id} is pending.`);
      }
      else if (tableReviewDocument.value?.status !== 'reviewed') addValidationFindings(findings, root, 'WPD019', tableReviewFile, validateReview(tableReviewDocument.value));
      else {
        addValidationFindings(findings, root, 'WPD019', tableReviewFile, validateReview(tableReviewDocument.value));
        for (const check of REQUIRED_REVIEW_CHECKS) {
          if (tableReviewDocument.value.checks?.[check] !== true) add(findings, root, 'block', 'WPD019', tableReviewFile, `Visual review evidence for table ${contract.id} is missing ${check}.`);
        }
        const tableChecks = contract.profile === 'editable'
          ? ['tableDensity', 'tableColumns', 'tablePagination', 'tableExpansion', 'tableBulk', 'tableEditing']
          : contract.profile === 'work'
            ? ['tableDensity', 'tableColumns', 'tablePagination', 'tableExpansion', 'tableBulk']
            : [];
        for (const check of tableChecks) {
          if (tableReviewDocument.value.checks?.[check] !== true) add(findings, root, 'block', 'WPD019', tableReviewFile, `Visual review evidence for table ${contract.id} is missing ${check}.`);
        }
        const currentHash = await currentSourceHash();
        if (tableReviewDocument.value.sourceHash !== currentHash) add(findings, root, 'block', 'WPD019', tableReviewFile, `Visual review evidence for table ${contract.id} is stale.`);
        const ageDays = (Date.now() - Date.parse(tableReviewDocument.value.reviewedAt ?? 0)) / 86_400_000;
        if (!Number.isFinite(ageDays) || ageDays > (config.visualEvidenceMaxAgeDays ?? 30)) add(findings, root, 'block', 'WPD019', tableReviewFile, `Visual review evidence for table ${contract.id} is too old.`);
      }
    }
  }

  let hasMotion = false;
  let hasReducedMotion = false;
  const iconSets = new Set();
  let storyContent = '';

  for (const file of sourceFiles) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    if (relative.startsWith('.wingmanpm-design/')) continue;
    const content = sourceContents.get(file) ?? await readFile(file, 'utf8');
    const unchangedLegacyTable = (legacyTablesByFile.get(relative) ?? [])
      .some((entry) => entry.sourceHash === sha256Text(content));
    const legacySeverity = unchangedLegacyTable ? 'warn' : 'block';
    const legacySuffix = unchangedLegacyTable
      ? ' This unchanged legacy surface is allowed as a warning until its source changes.'
      : '';
    const isTestFile = /(^|\/)(?:tests?|__tests__|fixtures)(\/|$)|\.(?:test|spec)\.[^.]+$/.test(relative);
    if (relative.includes('.stories.')) storyContent += `\n${content}`;
    if (/prefers-reduced-motion/.test(content)) hasReducedMotion = true;
    if (/\b(transition|animation|@keyframes|gsap|useAnimate|motion\.)\b/.test(content)) hasMotion = true;

    const patterns = [
      { rule: 'WPD005', severity: 'block', regex: /transition(?:-property)?\s*:\s*all\b|\btransition-all\b/g, message: 'Specify transition properties; transition-all is forbidden.' },
      { rule: 'WPD005', severity: 'block', regex: /\bease-in\b(?!-out)/g, message: 'Routine interactive arrivals cannot use ease-in.' },
      { rule: 'WPD007', severity: 'block', regex: /\boutline-none\b(?![^\n]*focus-visible)/g, message: 'Removing the outline requires a visible focus replacement.' },
      { rule: 'WPD015', severity: 'block', regex: /\bh-screen\b|height\s*:\s*100vh\b/g, message: 'Use dynamic viewport or minimum-height behavior instead of a fixed 100vh app shell.' },
      { rule: 'WPD014', severity: 'warn', regex: /\bwill-change\b/g, message: 'Measure will-change use and remove it outside active motion.' },
      { rule: 'WPD014', severity: 'warn', regex: /filter\s*:\s*blur\((?:1[3-9]|[2-9]\d)px\)/g, message: 'Large animated blur needs an isolated performance review.' },
      { rule: 'WPD014', severity: 'warn', regex: /window\.addEventListener\(\s*['"]scroll['"]/g, message: 'JavaScript scroll listeners need scheduling, cleanup, and measured performance.' }
    ];
    for (const pattern of patterns) {
      for (const match of content.matchAll(pattern.regex)) add(findings, root, pattern.severity, pattern.rule, file, pattern.message, lineOf(content, match.index));
    }

    if (/animation-(?:iteration-count|duration)[^;\n]*infinite|animation\s*:[^;\n]*infinite/.test(content) && !/prefers-reduced-motion/.test(content)) {
      add(findings, root, 'block', 'WPD006', file, 'Infinite motion requires a same-system reduced-motion stop.');
    }

    if (!relative.includes('.stories.') && !isTestFile && !isGenericWingmanRuntime(relative)) {
      for (const declaration of tableDeclarations(content)) {
        if (!declaration.id && !declaration.profile) {
          add(findings, root, legacySeverity, 'WPD018', file, `A ${declaration.kind} table surface must declare a stable table ID, its static, work, or editable profile, and a matching contract.${legacySuffix}`, lineOf(content, declaration.index));
          continue;
        }
        if (!declaration.profile) {
          add(findings, root, legacySeverity, 'WPD018', file, `Table ${declaration.id} must declare its static, work, or editable profile.${legacySuffix}`, lineOf(content, declaration.index));
          continue;
        }
        if (!TABLE_PROFILES.has(declaration.profile)) {
          add(findings, root, legacySeverity, 'WPD018', file, `Table ${declaration.id ?? '(missing ID)'} uses invalid profile ${declaration.profile}; use static, work, or editable.${legacySuffix}`, lineOf(content, declaration.index));
          continue;
        }
        if (!declaration.id) {
          add(findings, root, legacySeverity, 'WPD018', file, `A ${declaration.profile} table must declare a stable table ID.${legacySuffix}`, lineOf(content, declaration.index));
          continue;
        }
        const registered = contractsById.get(declaration.id);
        if (!registered) add(findings, root, legacySeverity, 'WPD018', file, `Missing design-system/tables/${declaration.id}.json for this ${declaration.profile} table.${legacySuffix}`, lineOf(content, declaration.index));
        else if (registered.contract.profile !== declaration.profile) add(findings, root, 'block', 'WPD018', file, `Table profile ${declaration.profile} does not match its ${registered.contract.profile} contract.`, lineOf(content, declaration.index));
      }
    }

    if (['.tsx', '.jsx', '.html'].includes(path.extname(file))) {
      for (const match of content.matchAll(/<button\b(?![^>]*\btype=)[^>]*>/gi)) {
        add(findings, root, 'block', 'WPD007', file, 'Every button needs an explicit type.', lineOf(content, match.index));
      }
      const cardCount = (content.match(/<(?:Card|article)\b/g) ?? []).length;
      if (cardCount >= 6 && /grid-cols-[23456]|repeat\([3-9]/.test(content)) {
        add(findings, root, 'block', 'WPD009', file, 'Six or more equal card regions form a generic card wall. Record a catalog exception or redesign the hierarchy.');
      } else if (cardCount >= 4) {
        add(findings, root, 'warn', 'WPD009', file, 'Four or more card regions need a clear containment or comparison purpose.');
      }
    }

    if (!relative.startsWith('design-system/tokens/') && !relative.includes('.stories.') && !isTestFile) {
      for (const match of content.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        add(findings, root, 'block', 'WPD004', file, 'Raw color bypasses the design token source.', lineOf(content, match.index));
      }
    }

    for (const match of content.matchAll(/from\s+['"](lucide-react|react-icons(?:\/[^'"]+)?|@heroicons\/[^'"]+|@tabler\/icons[^'"]*|@phosphor-icons\/[^'"]+)['"]/gi)) iconSets.add(match[1]);
  }

  if (hasMotion && !hasReducedMotion) add(findings, root, 'block', 'WPD006', null, 'Motion exists without a prefers-reduced-motion path.');
  if (iconSets.size > 1) add(findings, root, 'block', 'WPD010', null, `Multiple icon vocabularies detected: ${[...iconSets].join(', ')}`);

  if (config.goldenStack === true) {
    const requiredStoryTerms = ['light', 'dark', 'loading', 'error', 'permission', 'long content', 'reduced motion'];
    for (const term of requiredStoryTerms) {
      if (!storyContent.toLowerCase().includes(term)) add(findings, root, 'block', 'WPD013', null, `Storybook evidence is missing: ${term}.`);
    }
  }

  if (config.aiSurfaces === true && await exists(componentsFile)) {
    const components = (await readFile(componentsFile, 'utf8')).toLowerCase();
    for (const term of ['progress', 'sources', 'uncertainty', 'cancel', 'approval']) {
      if (!components.includes(term)) add(findings, root, 'block', 'WPD017', componentsFile, `The AI contract is missing ${term}.`);
    }
  }

  const reviewFile = path.join(root, '.wingmanpm-design', 'review.json');
  const reviewDocument = await readJsonDocument(reviewFile);
  const review = object(reviewDocument.value) ? reviewDocument.value : {};
  if (reviewDocument.error) add(findings, root, 'block', 'WPD011', reviewFile, reviewDocument.error);
  else if (reviewDocument.exists) addValidationFindings(findings, root, 'WPD011', reviewFile, validateReview(review));
  if (!reviewDocument.error && review.status === 'pending') {
    add(findings, root, options.allowPendingReview ? 'warn' : 'block', 'WPD011', reviewFile, 'Visual review evidence is pending.');
  } else if (!reviewDocument.error && review.status === 'reviewed') {
    for (const check of REQUIRED_REVIEW_CHECKS) {
      if (review.checks?.[check] !== true) add(findings, root, 'block', 'WPD011', reviewFile, `Visual review evidence is missing ${check}.`);
    }
    const viewports = new Set(review.viewports ?? []);
    for (const viewport of REQUIRED_VIEWPORTS) if (!viewports.has(viewport)) add(findings, root, 'block', 'WPD011', reviewFile, `Visual review is missing the ${viewport}px viewport.`);
    const sourceHash = await currentSourceHash();
    if (review.sourceHash !== sourceHash) add(findings, root, 'block', 'WPD011', reviewFile, 'Visual review evidence is stale because UI or design sources changed.');
    const ageDays = (Date.now() - Date.parse(review.reviewedAt ?? 0)) / 86_400_000;
    if (!Number.isFinite(ageDays) || ageDays > (config.visualEvidenceMaxAgeDays ?? 30)) add(findings, root, 'block', 'WPD011', reviewFile, 'Visual review evidence is too old.');
  }

  const baselineFile = path.join(root, '.wingmanpm-design', 'baseline.json');
  let baseline = null;
  if (!options.ignoreLegacyBaseline) {
    const baselineDocument = await readJsonDocument(baselineFile);
    if (baselineDocument.error) add(findings, root, 'block', 'WPD016', baselineFile, baselineDocument.error);
    else if (baselineDocument.exists) {
      const candidate = baselineDocument.value;
      const countsValid = object(candidate?.counts) && Object.values(candidate.counts).every((count) => Number.isInteger(count) && count >= 0);
      const hardRuleKeys = object(candidate?.counts)
        ? Object.keys(candidate.counts).filter((key) => NON_EXEMPTIBLE_RULES.has(key.split('\u001f', 1)[0]))
        : [];
      if (!object(candidate) || candidate.schemaVersion !== 1 || !countsValid) add(findings, root, 'block', 'WPD016', baselineFile, 'Legacy baseline must use schemaVersion 1 and non-negative integer occurrence counts.');
      else if (hardRuleKeys.length) add(findings, root, 'block', 'WPD016', baselineFile, `Legacy baseline cannot contain global hard rules: ${hardRuleKeys.map((key) => key.split('\u001f', 1)[0]).join(', ')}.`);
      else baseline = candidate;
    } else if (config.legacyBaseline === true) {
      add(findings, root, 'block', 'WPD016', baselineFile, 'Preserve mode declares a legacy baseline, but baseline.json is missing.');
    }
  }
  const withBaselineValidation = findings.filter((finding) => NON_EXEMPTIBLE_RULES.has(finding.ruleId)
    || !validExceptions.some((exception) => exception.ruleId === finding.ruleId && globMatch(exception.target, finding.file))
  );
  const remainingBaseline = { ...(baseline?.counts ?? {}) };
  let baselined = 0;
  const filtered = withBaselineValidation.filter((finding) => {
    if (NON_EXEMPTIBLE_RULES.has(finding.ruleId)) return true;
    const key = findingKey(finding);
    if ((remainingBaseline[key] ?? 0) < 1) return true;
    remainingBaseline[key] -= 1;
    baselined += 1;
    return false;
  });
  return {
    root,
    findings: filtered,
    counts: {
      block: filtered.filter((finding) => finding.severity === 'block').length,
      warn: filtered.filter((finding) => finding.severity === 'warn').length,
      excepted: findings.length - withBaselineValidation.length,
      baselined
    }
  };
}

function parse(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--project') options.project = argv[++i];
    else if (argv[i] === '--allow-pending-review') options.allowPendingReview = true;
    else if (argv[i] === '--json') options.json = true;
  }
  return options;
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const options = parse(process.argv.slice(2));
  const report = await runChecks(options.project ?? process.cwd(), options);
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    for (const finding of report.findings) console.log(`${finding.severity.toUpperCase()} ${finding.ruleId} ${finding.file}:${finding.line} ${finding.message}`);
    console.log(`WingmanPM design check: ${report.counts.block} block, ${report.counts.warn} warn, ${report.counts.excepted} excepted, ${report.counts.baselined} legacy.`);
  }
  process.exitCode = report.counts.block ? 1 : 0;
}
