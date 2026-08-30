import type { ReactNode } from 'react';
import { ArrowUpRight, Lightning } from '@phosphor-icons/react';
import { concept } from '../data';

export function ConceptLabel() {
  return (
    <span className="concept-label">
      <Lightning aria-hidden="true" size={13} weight="fill" />
      {concept.label}
    </span>
  );
}

export function BrandMark({ label = 'WingmanPM Product Designer' }: { label?: string }) {
  return (
    <span className="brand-mark" role="img" aria-label={label}>
      <span className="brand-mark__plane brand-mark__plane--back" />
      <span className="brand-mark__plane brand-mark__plane--front" />
      <span className="brand-mark__core" />
    </span>
  );
}

export function Actions({
  primary,
  secondary,
  compact = false,
}: {
  primary: string;
  secondary: string;
  compact?: boolean;
}) {
  return (
    <div className={`actions${compact ? ' actions--compact' : ''}`}>
      <button className="button button--secondary" type="button">
        {secondary}
      </button>
      <button className="button button--primary" type="button">
        {primary}
        <ArrowUpRight aria-hidden="true" size={15} weight="bold" />
      </button>
    </div>
  );
}

export function CompareFrame({
  before,
  after,
  title,
}: {
  before: ReactNode;
  after: ReactNode;
  title: string;
}) {
  return (
    <main className="comparison" aria-label={`${title} before and after comparison`}>
      <header className="comparison__header">
        <div>
          <span className="comparison__kicker">Same content. Same actions. Better judgment.</span>
          <h1>{title}</h1>
        </div>
        <div className="comparison__legend" aria-label="Comparison legend">
          <span>Before</span>
          <span>After</span>
        </div>
      </header>
      <div className="comparison__grid">
        <section className="comparison__panel comparison__panel--before" aria-label="Before">
          <div className="comparison__panel-label">Before</div>
          <div className="comparison__viewport">{before}</div>
        </section>
        <section className="comparison__panel comparison__panel--after" aria-label="After">
          <div className="comparison__panel-label">After</div>
          <div className="comparison__viewport">{after}</div>
        </section>
      </div>
    </main>
  );
}
