import { ArrowUpRight, CheckCircle, Graph, Radio } from '@phosphor-icons/react';

const publicWordmark = '/images/wingmanpm-wordmark-white.svg';

export function MakerSpotlight() {
  return (
    <main className="maker-spotlight">
      <div className="maker-spotlight__atmosphere" aria-hidden="true" />
      <nav aria-label="Maker spotlight navigation">
        <img src={publicWordmark} alt="WingmanPM" />
        <a href="https://wingman.pm" target="_blank" rel="noreferrer">
          Visit wingman.pm<ArrowUpRight aria-hidden="true" />
        </a>
      </nav>

      <section>
        <div className="maker-spotlight__copy">
          <span className="maker-spotlight__label">Maker spotlight</span>
          <h1>You Fly the Product.<br />We Cover Your Six.</h1>
          <p>
            Every feedback channel. One intelligence system. From raw signal to
            shipped feature, with your customers notified at the end.
          </p>
          <a className="maker-spotlight__cta" href="https://wingman.pm" target="_blank" rel="noreferrer">
            Explore WingmanPM<ArrowUpRight aria-hidden="true" weight="bold" />
          </a>
        </div>

        <div className="maker-orbit" aria-label="WingmanPM product loop">
          <div className="maker-orbit__ring maker-orbit__ring--outer" />
          <div className="maker-orbit__ring maker-orbit__ring--inner" />
          <span className="maker-orbit__node maker-orbit__node--signal"><Radio aria-hidden="true" /><small>Signal</small></span>
          <span className="maker-orbit__node maker-orbit__node--decision"><Graph aria-hidden="true" /><small>Decision</small></span>
          <span className="maker-orbit__node maker-orbit__node--follow"><CheckCircle aria-hidden="true" /><small>Follow-through</small></span>
          <div className="maker-orbit__core">
            <span>Full-loop</span>
            <strong>Feedback<br />intelligence</strong>
          </div>
        </div>
      </section>

      <footer>
        <span>Public product showcase</span>
        <span>No account, product data, or private route is shown.</span>
      </footer>
    </main>
  );
}
