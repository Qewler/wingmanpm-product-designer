import { CircleHelp } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type TableTooltipProps = {
  label: string;
  content: string;
  valueOnly?: boolean;
};

export function TableTooltip({ label, content, valueOnly = false }: TableTooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [valueOverflow, setValueOverflow] = useState(!valueOnly);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const valueMeasureRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0, placement: 'below' as 'above' | 'below' });
  useLayoutEffect(() => {
    if (!valueOnly || !valueMeasureRef.current) return;
    const value = valueMeasureRef.current;
    const update = () => setValueOverflow(value.scrollWidth > value.clientWidth + 1);
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(value);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [content, valueOnly]);
  useEffect(() => {
    if (valueOnly && !valueOverflow) setOpen(false);
  }, [valueOnly, valueOverflow]);
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const tooltipWidth = tooltipRef.current?.getBoundingClientRect().width ?? Math.min(320, window.innerWidth - 24);
      const halfWidth = tooltipWidth / 2;
      const gutter = 12;
      const placement = rect.bottom > window.innerHeight - 140 ? 'above' : 'below';
      setPosition({
        left: Math.min(window.innerWidth - halfWidth - gutter, Math.max(halfWidth + gutter, rect.left + rect.width / 2)),
        top: placement === 'above' ? rect.top - 7 : rect.bottom + 7,
        placement
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);
  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);
  const keepOpen = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setOpen(true);
  };
  const closeSoon = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };
  return (
    <span className={`wpd-table-tooltip ${valueOnly ? 'wpd-table-tooltip-value' : ''}`}>
      {valueOnly && (
        <span ref={valueMeasureRef} className="wpd-table-value-measure" aria-hidden={valueOverflow || undefined}>{content}</span>
      )}
      {(!valueOnly || valueOverflow) && <button
          ref={triggerRef}
          type="button"
          className={valueOnly ? 'wpd-table-value-trigger' : 'wpd-table-help-trigger'}
          aria-label={valueOnly ? `Show full value for ${label}` : `About ${label}`}
          aria-describedby={open ? id : undefined}
          aria-expanded={open}
          onClick={keepOpen}
          onFocus={keepOpen}
          onBlur={closeSoon}
          onMouseEnter={keepOpen}
          onMouseLeave={closeSoon}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              event.currentTarget.blur();
            }
          }}
        >
          {valueOnly ? <span>{content}</span> : <CircleHelp aria-hidden="true" size={13} />}
        </button>}
      {open && typeof document !== 'undefined' && createPortal(
        <span
          ref={tooltipRef}
          id={id}
          className="wpd-table-tooltip-content"
          data-placement={position.placement}
          role="tooltip"
          style={{ left: position.left, top: position.top }}
          onMouseEnter={keepOpen}
          onMouseLeave={closeSoon}
        >
          {content}
        </span>,
        document.body
      )}
    </span>
  );
}
