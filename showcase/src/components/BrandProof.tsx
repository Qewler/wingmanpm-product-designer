import { ArrowRight, Check, Code, Eye, Keyboard, Moon, Sparkle, Sun } from '@phosphor-icons/react';
import { OperationalAfter } from './OperationalWorkspace';
import { BrandMark } from './Shared';

export function ProductDesignerLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`product-lockup${compact ? ' product-lockup--compact' : ''}`}>
      <BrandMark />
      <span><strong>WingmanPM</strong><small>Product Designer</small></span>
    </div>
  );
}

export function ReadmeHero({ mode = 'light' }: { mode?: 'light' | 'dark' }) {
  return (
    <main className={`readme-hero readme-hero--${mode}`} data-theme={mode}>
      <div className="readme-hero__grain" aria-hidden="true" />
      <header>
        <ProductDesignerLockup />
        <span className="readme-hero__edition">Open source design judgment</span>
      </header>
      <section>
        <div className="readme-hero__copy">
          <span className="readme-hero__eyebrow">For Codex, Claude Code, Cursor, and modern agents</span>
          <h1>Product design judgment for coding agents.</h1>
          <p>Give your agent a sharper eye, a stricter process, and proof that survives the browser.</p>
          <div className="readme-hero__command">
            <Code aria-hidden="true" weight="bold" />
            <code>npx plugins add Qewler/wingmanpm-product-designer</code>
            <ArrowRight aria-hidden="true" weight="bold" />
          </div>
          <ul aria-label="Quality coverage">
            <li><Check aria-hidden="true" />Responsive</li>
            <li><Check aria-hidden="true" />Accessible</li>
            <li><Check aria-hidden="true" />Evidence-based</li>
          </ul>
        </div>

        <div className="readme-hero__stage" aria-label="Refined product workspace preview">
          <div className="readme-hero__workspace"><OperationalAfter /></div>
          <div className="craft-note craft-note--hierarchy"><Eye aria-hidden="true" /><span><strong>Hierarchy</strong><small>Read the room first</small></span></div>
          <div className="craft-note craft-note--states"><Sparkle aria-hidden="true" weight="fill" /><span><strong>States</strong><small>Not just the happy path</small></span></div>
          <div className="craft-note craft-note--keyboard"><Keyboard aria-hidden="true" /><span><strong>Keyboard</strong><small>Built into the proof</small></span></div>
        </div>
      </section>
    </main>
  );
}

const responsiveViews = [
  { name: 'Desktop', width: 1280, height: 720, detail: 'The complete operating view', className: 'desktop' },
  { name: 'Tablet', width: 768, height: 760, detail: 'More room for the work', className: 'tablet' },
  { name: 'Mobile', width: 390, height: 880, detail: 'Every site. Every action.', className: 'mobile' },
];

export function ResponsiveProof() {
  return (
    <main className="responsive-proof">
      <header>
        <div><ProductDesignerLockup compact /><h1>One workspace. Every screen.</h1></div>
        <span>Same sample data and controls.<br />Rendered at three real viewport sizes.</span>
      </header>
      <section className="responsive-proof__stage" aria-label="Responsive product previews">
        {responsiveViews.map(view => (
          <figure className={`device-study device-study--${view.className}`} key={view.name}>
            <div className={`device device--${view.className}`}>
              <div className="device__bar" aria-hidden="true"><i /><i /><i /></div>
              <div className="device__canvas">
                <iframe
                  title={`${view.name} FieldOps preview at ${view.width} pixels`}
                  src="./iframe.html?viewMode=story&id=proof-operational-workspace--after&globals=theme:light"
                  width={view.width}
                  height={view.height}
                  data-viewport={view.width}
                  loading="eager"
                />
              </div>
            </div>
            <figcaption><span><strong>{view.name}</strong><small>{view.detail}</small></span><span>{view.width} px</span></figcaption>
          </figure>
        ))}
      </section>
      <footer>Runnable React views, not static mockups. <span>Tamarack FieldOps / Concept demo</span></footer>
    </main>
  );
}

export function PluginIcon() {
  return <main className="plugin-icon"><BrandMark /></main>;
}

export function PluginLogo({ mode = 'light' }: { mode?: 'light' | 'dark' }) {
  return (
    <main className={`plugin-logo plugin-logo--${mode}`}>
      <ProductDesignerLockup />
      <span className="plugin-logo__line" />
      <span>Design judgment for coding agents</span>
      {mode === 'dark' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
    </main>
  );
}

export function SocialPreview() {
  return (
    <main className="social-preview">
      <div className="social-preview__noise" aria-hidden="true" />
      <header><ProductDesignerLockup /></header>
      <section>
        <div><h1>Product design judgment<br />for coding agents.</h1><p>Inspect. Decide. Build. Prove.</p></div>
        <div className="social-preview__mark"><BrandMark /></div>
      </section>
      <footer><span>Codex</span><span>Claude Code</span><span>Cursor</span><span>Agent Skills</span></footer>
    </main>
  );
}
