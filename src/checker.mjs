import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_STATES = ['loading', 'empty', 'partial', 'error', 'success', 'disabled', 'permission', 'offline', 'responsive'];
const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.jsx', '.md', '.mjs', '.scss', '.ts', '.tsx']);
const IGNORE = new Set(['.git', '.next', 'build', 'coverage', 'dist', 'node_modules', 'storybook-static', 'runtime']);
const DEFAULT_SCAN_ROOTS = ['src', 'app', 'pages', 'components', 'stories', 'design-system/examples'];

async function exists(target) {
  try { await stat(target); return true; } catch { return false; }
}

async function json(target, fallback = null) {
  try { return JSON.parse(await readFile(target, 'utf8')); } catch { return fallback; }
}

async function files(root) {
  const output = [];
  async function visit(directory) {
    let entries = [];
    try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (IGNORE.has(entry.name)) continue;
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (TEXT_EXTENSIONS.has(path.extname(target))) output.push(target);
    }
  }
  await visit(root);
  return output.sort();
}

async function filesInRoots(root, roots = DEFAULT_SCAN_ROOTS) {
  const results = new Set();
  for (const relative of roots) {
    const target = path.join(root, relative);
    if (!(await exists(target))) continue;
    const metadata = await stat(target);
    if (metadata.isDirectory()) {
      for (const file of await files(target)) results.add(file);
    } else if (TEXT_EXTENSIONS.has(path.extname(target))) {
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
  if (!exception || typeof exception !== 'object') return false;
  if (!exception.ruleId || !exception.target || !exception.reason || !exception.approver || !exception.reviewDate) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(exception.reviewDate) && exception.reviewDate >= today;
}

function findingKey(finding) {
  return [finding.ruleId, finding.file, finding.message].join('\u001f');
}

function baselineCounts(findings) {
  const counts = {};
  for (const finding of findings) {
    if (finding.ruleId === 'WPD011' || finding.ruleId === 'WPD-EXCEPTION') continue;
    const key = findingKey(finding);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
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
  const config = await json(path.join(root, '.wingmanpm-design', 'config.json'), {});
  const candidates = await filesInRoots(root, [...(config.scanRoots ?? DEFAULT_SCAN_ROOTS), 'design-system']);
  for (const file of candidates) {
    hasher.update(path.relative(root, file));
    hasher.update(await readFile(file));
  }
  return hasher.digest('hex');
}

export async function runChecks(root, options = {}) {
  root = path.resolve(root);
  const findings = [];
  const configFile = path.join(root, '.wingmanpm-design', 'config.json');
  const config = await json(configFile, {});
  const exceptionFile = path.join(root, '.wingmanpm-design', 'exceptions.json');
  const exceptionData = await json(exceptionFile, { exceptions: [] });
  const today = new Date().toISOString().slice(0, 10);
  const validExceptions = [];

  for (const exception of exceptionData?.exceptions ?? []) {
    if (validException(exception, today)) validExceptions.push(exception);
    else add(findings, root, 'block', 'WPD-EXCEPTION', exceptionFile, 'An exception is incomplete, invalid, or past its review date.');
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
    const tokens = await json(tokenFile, {});
    if (!String(tokens?.$schema ?? '').includes('2025.10')) add(findings, root, 'block', 'WPD003', tokenFile, 'Token source must declare the DTCG 2025.10 schema.');
    if (!tokens?.color?.light || !tokens?.color?.dark) add(findings, root, 'block', 'WPD003', tokenFile, 'Token source needs independently named light and dark color groups.');
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

  const sourceFiles = await filesInRoots(root, config.scanRoots ?? DEFAULT_SCAN_ROOTS);
  let hasMotion = false;
  let hasReducedMotion = false;
  const iconSets = new Set();
  let storyContent = '';

  for (const file of sourceFiles) {
    const relative = path.relative(root, file).split(path.sep).join('/');
    if (relative.startsWith('.wingmanpm-design/')) continue;
    const content = await readFile(file, 'utf8');
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

    const isTestFile = /(^|\/)(?:tests?|__tests__|fixtures)(\/|$)|\.(?:test|spec)\.[^.]+$/.test(relative);
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
  const review = await json(reviewFile, {});
  if (review.status !== 'reviewed') {
    add(findings, root, options.allowPendingReview ? 'warn' : 'block', 'WPD011', reviewFile, 'Visual review evidence is pending.');
  } else {
    const requiredChecks = ['keyboard', 'zoom200', 'reducedMotion', 'longContent', 'light', 'dark', 'axe', 'responsiveStates'];
    for (const check of requiredChecks) {
      if (review.checks?.[check] !== true) add(findings, root, 'block', 'WPD011', reviewFile, `Visual review evidence is missing ${check}.`);
    }
    const viewports = new Set(review.viewports ?? []);
    for (const viewport of [390, 768, 1280, 1440]) if (!viewports.has(viewport)) add(findings, root, 'block', 'WPD011', reviewFile, `Visual review is missing the ${viewport}px viewport.`);
    const sourceHash = await hashReviewSources(root);
    if (review.sourceHash !== sourceHash) add(findings, root, 'block', 'WPD011', reviewFile, 'Visual review evidence is stale because UI or design sources changed.');
    const ageDays = (Date.now() - Date.parse(review.reviewedAt ?? 0)) / 86_400_000;
    if (!Number.isFinite(ageDays) || ageDays > (config.visualEvidenceMaxAgeDays ?? 30)) add(findings, root, 'block', 'WPD011', reviewFile, 'Visual review evidence is too old.');
  }

  const afterExceptions = findings.filter((finding) => !validExceptions.some((exception) =>
    exception.ruleId === finding.ruleId && globMatch(exception.target, finding.file)
  ));
  const baselineFile = path.join(root, '.wingmanpm-design', 'baseline.json');
  const baseline = options.ignoreLegacyBaseline ? null : await json(baselineFile, null);
  const remainingBaseline = { ...(baseline?.counts ?? {}) };
  let baselined = 0;
  const filtered = afterExceptions.filter((finding) => {
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
      excepted: findings.length - afterExceptions.length,
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
