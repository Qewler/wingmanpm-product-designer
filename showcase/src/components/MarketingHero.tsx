import { ArrowDownRight, ArrowRight, Crosshair, MapPin, Waves } from '@phosphor-icons/react';
import { concept, marketing } from '../data';
import { Actions, ConceptLabel } from './Shared';

const imagePath = '/images/tamarack-coast.webp';

function ProofItems() {
  return (
    <ul className="marketing-proof" aria-label="Product summary">
      {marketing.proof.map((item) => <li key={item}>{item}</li>)}
    </ul>
  );
}

export function MarketingBefore() {
  return (
    <main className="marketing marketing--before">
      <nav aria-label="Primary navigation">
        <a className="plain-logo" href="#home">{concept.company}</a>
        <div><a href="#product">Product</a><a href="#workflow">Workflow</a><a href="#about">About</a></div>
      </nav>
      <section className="marketing-before__hero">
        <div>
          <ConceptLabel />
          <h1>{marketing.title}</h1>
          <p>{marketing.description}</p>
          <Actions primary={marketing.primaryAction} secondary={marketing.secondaryAction} />
          <ProofItems />
        </div>
        <img src={imagePath} alt="Fictional coastal wind farm for the Tamarack Renewables concept" />
      </section>
    </main>
  );
}

export function MarketingAfter() {
  return (
    <main className="marketing marketing--after">
      <div className="marketing-after__photo" aria-hidden="true">
        <img src={imagePath} alt="" />
      </div>
      <nav aria-label="Primary navigation">
        <a className="tamarack-logo" href="#home" aria-label="Tamarack Renewables home">
          <span className="tamarack-logo__mark"><Waves aria-hidden="true" weight="bold" /></span>
          <span>Tamarack<br />Renewables</span>
        </a>
        <div><a href="#product">Product</a><a href="#workflow">Workflow</a><a href="#about">About</a></div>
        <a className="marketing-nav-cta" href="#review">{marketing.primaryAction}<ArrowRight aria-hidden="true" /></a>
      </nav>

      <section className="marketing-after__hero">
        <div className="marketing-after__copy">
          <ConceptLabel />
          <h1>{marketing.title}</h1>
          <p>{marketing.description}</p>
          <Actions primary={marketing.primaryAction} secondary={marketing.secondaryAction} />
          <ProofItems />
        </div>

        <div className="field-note" role="note">
          <span className="field-note__icon"><Crosshair aria-hidden="true" /></span>
          <span><small>North Sound</small><strong>36 MW</strong><em>Inside range</em></span>
        </div>
        <div className="site-coordinate">
          <MapPin aria-hidden="true" weight="fill" />
          <span>Coastal operations</span>
        </div>
        <ArrowDownRight className="marketing-after__corner-arrow" aria-hidden="true" weight="thin" />
      </section>
    </main>
  );
}
