import { FileText, Pause, RotateCcw, ShieldCheck, Sparkles, X } from 'lucide-react';

type Source = { id: string; label: string; href: string };

type TransparentAIReviewProps = {
  status: 'idle' | 'running' | 'draft' | 'error';
  progress?: number;
  draft?: string;
  uncertainty?: string;
  sources?: Source[];
  onCancel?: () => void;
  onRetry?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
};

export function TransparentAIReview({
  status,
  progress = 0,
  draft,
  uncertainty,
  sources = [],
  onCancel,
  onRetry,
  onApprove,
  onReject
}: TransparentAIReviewProps) {
  return (
    <section className="wpd-ai-review" aria-labelledby="ai-review-heading">
      <header>
        <div className="wpd-ai-icon"><Sparkles aria-hidden="true" size={17} /></div>
        <div>
          <p className="wpd-eyebrow">Tamarack FieldOps · Concept demo · AI draft</p>
          <h2 id="ai-review-heading">Prepare an action plan</h2>
        </div>
        <span className="wpd-scope"><ShieldCheck aria-hidden="true" size={15} /> 3 approved sources in scope</span>
      </header>

      {status === 'running' && (
        <div className="wpd-ai-progress" role="status" aria-live="polite">
          <div><span>Drafting from approved sources</span><span>{progress}%</span></div>
          <progress max="100" value={progress}>{progress}%</progress>
          <button className="wpd-secondary-button" type="button" onClick={onCancel}><Pause aria-hidden="true" size={15} /> Cancel</button>
        </div>
      )}

      {status === 'error' && (
        <div className="wpd-status-banner" role="alert">
          <strong>The draft stopped.</strong><span>No action was taken.</span>
          <button type="button" onClick={onRetry}><RotateCcw aria-hidden="true" size={15} /> Retry</button>
        </div>
      )}

      {status === 'draft' && (
        <>
          <label className="wpd-draft-field">
            <span>Reviewable draft</span>
            <textarea defaultValue={draft} rows={8} />
          </label>
          {uncertainty && <p className="wpd-uncertainty"><strong>Uncertainty:</strong> {uncertainty}</p>}
          <div className="wpd-sources">
            <h3>Sources</h3>
            <ul>{sources.map((source) => <li key={source.id}><FileText aria-hidden="true" size={15} /><a href={source.href}>{source.label}</a></li>)}</ul>
          </div>
          <footer>
            <p>Approval applies the reviewed plan. Nothing changes automatically.</p>
            <div>
              <button className="wpd-secondary-button" type="button" onClick={onReject}><X aria-hidden="true" size={15} /> Reject</button>
              <button className="wpd-primary-button" type="button" onClick={onApprove}>Approve plan</button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
