import { mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { hashReviewSources } from './checker.mjs';

export const BROWSER_AUDIT_ATTACHMENT = 'wingman-browser-audit';
export const BROWSER_EVIDENCE_RELATIVE = '.wingmanpm-design/browser-evidence.json';
export const CANONICAL_BROWSER_AUDIT_TITLE = 'WPD022 and WPD023 audit every Storybook story in light and dark';

function removeEvidence(target) {
  try { unlinkSync(target); } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function writeEvidence(target, value) {
  mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(temporary, target);
}

function attachmentBody(attachment) {
  if (attachment?.body) return Buffer.from(attachment.body).toString('utf8');
  if (attachment?.path) return readFileSync(attachment.path, 'utf8');
  return null;
}

function validAudit(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Number.isInteger(value.storyCount) && value.storyCount > 0
    && Array.isArray(value.themes) && ['light', 'dark'].every((theme) => value.themes.includes(theme))
    && value.structureUnique === true
    && value.dropdownContrast === true
    && Number.isInteger(value.dropdownCandidateCount) && value.dropdownCandidateCount >= 0;
}

function testSpecFiles(directory) {
  const files = [];
  const visit = (target) => {
    let entries;
    try { entries = readdirSync(target, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const file = path.join(target, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (/\.(?:spec|test)\.(?:[cm]?[jt]sx?)$/i.test(entry.name)) files.push(path.resolve(file));
    }
  };
  visit(directory);
  return files.sort();
}

export default class WingmanBrowserReporter {
  constructor(options = {}) {
    this.projectRoot = path.resolve(options.projectRoot ?? process.cwd());
    this.target = path.join(this.projectRoot, options.outputFile ?? BROWSER_EVIDENCE_RELATIVE);
    this.results = new Map();
    this.audit = null;
    this.auditPassed = false;
    this.specInventoryComplete = false;
  }

  onBegin(_config, suite) {
    removeEvidence(this.target);
    this.results.clear();
    this.audit = null;
    this.auditPassed = false;
    const expected = testSpecFiles(path.join(this.projectRoot, 'tests', 'wingman-design'));
    const discovered = new Set((suite?.allTests?.() ?? [])
      .map((test) => test?.location?.file)
      .filter(Boolean)
      .map((file) => path.resolve(this.projectRoot, file)));
    this.specInventoryComplete = expected.length > 0 && expected.every((file) => discovered.has(file));
  }

  onTestEnd(test, result) {
    const key = test?.id ?? test?.titlePath?.().join(' > ') ?? test?.title ?? `test-${this.results.size}`;
    this.results.set(key, result?.status ?? 'failed');
    if (test?.title !== CANONICAL_BROWSER_AUDIT_TITLE) return;
    const attachment = result?.attachments?.find((item) => item.name === BROWSER_AUDIT_ATTACHMENT);
    if (!attachment) return;
    try {
      const parsed = JSON.parse(attachmentBody(attachment));
      this.audit = parsed;
      this.auditPassed = result.status === 'passed' && validAudit(parsed);
    } catch {
      this.audit = null;
      this.auditPassed = false;
    }
  }

  async onEnd(fullResult) {
    const counts = { passed: 0, failed: 0, skipped: 0 };
    for (const status of this.results.values()) {
      if (status === 'passed') counts.passed += 1;
      else if (status === 'skipped') counts.skipped += 1;
      else counts.failed += 1;
    }
    const sourceHash = await hashReviewSources(this.projectRoot);
    const runPassed = fullResult?.status === 'passed' && counts.failed === 0 && counts.skipped === 0;
    const passed = runPassed && this.auditPassed && this.specInventoryComplete;
    const evidence = {
      schemaVersion: 1,
      status: passed ? 'passed' : 'failed',
      sourceHash,
      completedAt: new Date().toISOString(),
      tests: counts,
      storyCount: this.audit?.storyCount ?? 0,
      themes: Array.isArray(this.audit?.themes) ? [...new Set(this.audit.themes)] : [],
      structureUnique: passed && this.audit?.structureUnique === true,
      dropdownContrast: passed && this.audit?.dropdownContrast === true,
      dropdownCandidateCount: Number.isInteger(this.audit?.dropdownCandidateCount) ? this.audit.dropdownCandidateCount : 0
    };
    writeEvidence(this.target, evidence);
  }
}
