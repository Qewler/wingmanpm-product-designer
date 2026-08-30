import {
  ArrowRight,
  CheckCircle,
  FileText,
  Fingerprint,
  ShieldCheck,
  Sparkle,
  Warning,
} from '@phosphor-icons/react';
import { aiReview, concept } from '../data';
import { Actions, ConceptLabel } from './Shared';

function EvidenceList() {
  return (
    <ul className="evidence-list">
      {aiReview.sources.map((source, index) => (
        <li key={source.title}>
          <span className="evidence-list__index">0{index + 1}</span>
          <span><strong>{source.title}</strong><small>{source.detail}</small></span>
        </li>
      ))}
    </ul>
  );
}

export function AIReviewBefore() {
  return (
    <main className="ai-review ai-review--before">
      <header>
        <div>
          <ConceptLabel />
          <p className="plain-brand">{concept.product}</p>
        </div>
      </header>
      <div className="ai-plain-card">
        <h2>{aiReview.title}</h2>
        <p>{aiReview.description}</p>
        <label htmlFor="plain-ai-draft">Generated draft</label>
        <textarea id="plain-ai-draft" defaultValue={aiReview.draft} rows={6} />
        <section aria-labelledby="plain-sources">
          <h3 id="plain-sources">Sources</h3>
          <EvidenceList />
        </section>
        <div className="plain-warning" role="note">
          <strong>Uncertainty</strong>
          <span>{aiReview.uncertainty}</span>
        </div>
        <Actions primary={aiReview.primaryAction} secondary={aiReview.secondaryAction} />
      </div>
    </main>
  );
}

export function AIReviewAfter() {
  return (
    <main className="ai-review ai-review--after">
      <header className="ai-topbar">
        <div className="ai-product">
          <span className="ai-product__icon"><Sparkle aria-hidden="true" weight="fill" /></span>
          <span><strong>{concept.product}</strong><small>Review workspace</small></span>
        </div>
        <ConceptLabel />
      </header>

      <div className="ai-layout">
        <section className="ai-editor" aria-labelledby="ai-review-title">
          <div className="ai-heading">
            <span className="ai-heading__icon"><FileText aria-hidden="true" weight="duotone" /></span>
            <div><h2 id="ai-review-title">{aiReview.title}</h2><p>{aiReview.description}</p></div>
          </div>

          <div className="draft-panel">
            <div className="draft-panel__bar">
              <span><Sparkle aria-hidden="true" weight="fill" />AI draft</span>
              <span>Review required</span>
            </div>
            <label className="sr-only" htmlFor="refined-ai-draft">Generated draft</label>
            <textarea id="refined-ai-draft" defaultValue={aiReview.draft} rows={7} />
            <div className="draft-panel__foot">
              <span><Fingerprint aria-hidden="true" />2 approved sources</span>
              <span>Edited just now</span>
            </div>
          </div>

          <div className="ai-uncertainty" role="note">
            <Warning aria-hidden="true" weight="fill" />
            <span><strong>Needs confirmation</strong>{aiReview.uncertainty}</span>
          </div>

          <div className="ai-approval">
            <span><ShieldCheck aria-hidden="true" weight="duotone" /><span><strong>Human approval</strong><small>No action happens before review.</small></span></span>
            <Actions primary={aiReview.primaryAction} secondary={aiReview.secondaryAction} compact />
          </div>
        </section>

        <aside className="source-drawer" aria-labelledby="evidence-title">
          <header>
            <span>Evidence</span>
            <span className="source-drawer__check"><CheckCircle aria-hidden="true" weight="fill" />Verified</span>
          </header>
          <h3 id="evidence-title">Trace every claim.</h3>
          <p>The draft stays connected to the field records that support it.</p>
          <EvidenceList />
          <div className="source-flow" aria-label="Evidence flow">
            <span>Field records</span><ArrowRight aria-hidden="true" /><span>Draft</span><ArrowRight aria-hidden="true" /><span>Approval</span>
          </div>
        </aside>
      </div>
    </main>
  );
}
