import {
  ChartLineUp,
  CheckCircle,
  Drop,
  Gauge,
  MapTrifold,
  Sun,
  Warning,
  Wind,
  Wrench,
} from '@phosphor-icons/react';
import { concept, operationsCopy, sites } from '../data';
import { Actions, ConceptLabel } from './Shared';

const typeIcons = {
  Wind,
  Solar: Sun,
  Hydro: Drop,
};

export function OperationalBefore() {
  return (
    <div className="operational operational--before">
      <header className="plain-header">
        <div>
          <ConceptLabel />
          <p className="plain-brand">{concept.product}</p>
        </div>
        <nav aria-label="Primary navigation">
          <a href="#overview">Overview</a>
          <a href="#sites">Sites</a>
          <a href="#work">Work orders</a>
        </nav>
      </header>

      <main className="plain-main">
        <div className="plain-title-row">
          <div>
            <h2>{operationsCopy.title}</h2>
            <p>{operationsCopy.description}</p>
          </div>
          <Actions
            primary={operationsCopy.primaryAction}
            secondary={operationsCopy.secondaryAction}
            compact
          />
        </div>

        <section className="plain-stats" aria-label="Portfolio summary">
          <article><span>Active output</span><strong>81 MW</strong></article>
          <article><span>Sites online</span><strong>3 of 3</strong></article>
          <article><span>Open work</span><strong>4 items</strong></article>
        </section>

        <section className="plain-table-wrap" aria-labelledby="plain-sites-title">
          <h3 id="plain-sites-title">Sites</h3>
          <table>
            <thead>
              <tr>
                <th scope="col">Site</th>
                <th scope="col">State</th>
                <th scope="col">Output</th>
                <th scope="col">Current focus</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((site) => (
                <tr key={site.name}>
                  <td><strong>{site.name}</strong><span>{site.type}</span></td>
                  <td>{site.state}</td>
                  <td>{site.output}</td>
                  <td>{site.focus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}

export function OperationalAfter() {
  return (
    <div className="operational operational--after">
      <aside className="ops-rail" aria-label="Primary navigation">
        <div className="ops-identity">
          <span className="ops-identity__mark">T</span>
          <span>{concept.product}</span>
        </div>
        <nav>
          <a className="is-active" href="#overview"><Gauge aria-hidden="true" />Overview</a>
          <a href="#sites"><MapTrifold aria-hidden="true" />Sites</a>
          <a href="#work"><Wrench aria-hidden="true" />Work orders</a>
          <a href="#reports"><ChartLineUp aria-hidden="true" />Reports</a>
        </nav>
        <div className="ops-rail__footer">
          <span>Tamarack Renewables</span>
          <small>Operations workspace</small>
        </div>
      </aside>

      <main className="ops-main">
        <header className="ops-topbar">
          <ConceptLabel />
          <span className="ops-profile" aria-label="Tamarack Renewables workspace">TR</span>
        </header>

        <div className="ops-heading">
          <div>
            <h2>{operationsCopy.title}</h2>
            <p>{operationsCopy.description}</p>
          </div>
          <Actions
            primary={operationsCopy.primaryAction}
            secondary={operationsCopy.secondaryAction}
            compact
          />
        </div>

        <section className="output-band" aria-label="Portfolio summary">
          <div className="output-band__primary">
            <span>Active output</span>
            <strong>81 <small>MW</small></strong>
            <p><ChartLineUp aria-hidden="true" /> Inside today's operating range</p>
          </div>
          <div className="output-band__metric">
            <span>Sites online</span>
            <strong>3 of 3</strong>
          </div>
          <div className="output-band__metric">
            <span>Open work</span>
            <strong>4 items</strong>
          </div>
          <div className="output-band__trace" aria-hidden="true">
            <svg viewBox="0 0 320 84" role="presentation">
              <path d="M2 64 C38 62 40 39 76 45 S120 70 154 48 S207 26 240 35 S276 55 318 18" />
            </svg>
          </div>
        </section>

        <section className="site-board" aria-labelledby="site-board-title">
          <header>
            <h3 id="site-board-title">Sites</h3>
            <span>Updated today, 14:20</span>
          </header>
          <div className="site-board__head" aria-hidden="true">
            <span>Site</span><span>State</span><span>Output</span><span>Current focus</span><span>Updated</span>
          </div>
          <div className="site-board__rows">
            {sites.map((site) => {
              const Icon = typeIcons[site.type as keyof typeof typeIcons];
              const StateIcon = site.state === 'Stable' ? CheckCircle : Warning;
              return (
                <article className="site-row" key={site.name}>
                  <div className="site-row__name">
                    <span className="site-row__icon"><Icon aria-hidden="true" weight="duotone" /></span>
                    <span><strong>{site.name}</strong><small>{site.type}</small></span>
                  </div>
                  <span className={`site-state site-state--${site.state.toLowerCase()}`}>
                    <StateIcon aria-hidden="true" weight="fill" />{site.state}
                  </span>
                  <strong className="site-output">{site.output}</strong>
                  <span className="site-focus">{site.focus}</span>
                  <time>{site.updated}</time>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
