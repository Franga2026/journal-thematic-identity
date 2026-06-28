import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import type { Work, WorkCitations } from '../../shared/types';
import { getCitationsForWork } from '../../utils/citation/getCitationsForWork';
import { getWorkCitationId } from '../../utils/citation/workCitationId';

interface WorkCitationPanelProps {
  work: Work;
  compact?: boolean;
  ghost?: boolean;
  buttonClassName?: string;
}

const FORMATS: Array<{ key: keyof WorkCitations; label: string }> = [
  { key: 'apa', label: 'APA 7' },
  { key: 'ieee', label: 'IEEE' },
  { key: 'vancouver', label: 'Vancouver' },
  { key: 'bibtex', label: 'BibTeX' },
  { key: 'ris', label: 'RIS' },
];

interface PopoverCoords {
  top: number;
  left: number;
  maxHeight: number;
  placement: 'above' | 'below';
}

const PANEL_WIDTH = 420;
const PANEL_EST_HEIGHT = 360;
const VIEWPORT_MARGIN = 8;

function computePopoverCoords(anchor: DOMRect): PopoverCoords {
  const width = Math.min(PANEL_WIDTH, window.innerWidth * 0.92);
  const spaceBelow = window.innerHeight - anchor.bottom - VIEWPORT_MARGIN;
  const spaceAbove = anchor.top - VIEWPORT_MARGIN;
  const openBelow = spaceBelow >= Math.min(PANEL_EST_HEIGHT, 220) || spaceBelow >= spaceAbove;

  let top: number;
  let maxHeight: number;
  let placement: 'above' | 'below';

  if (openBelow) {
    placement = 'below';
    top = anchor.bottom + 6;
    maxHeight = Math.max(160, Math.min(PANEL_EST_HEIGHT, spaceBelow - 6));
  } else {
    placement = 'above';
    maxHeight = Math.max(160, Math.min(PANEL_EST_HEIGHT, spaceAbove - 6));
    top = anchor.top - 6 - maxHeight;
  }

  let left = anchor.right - width;
  left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN));

  return { top, left, maxHeight, placement };
}

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function IconQuote({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 21c3 0 7-1 7-8V5H3v14Z" />
      <path d="M14 21c3 0 7-1 7-8V5h-7v14Z" />
    </svg>
  );
}

const WorkCitationPanel = memo(function WorkCitationPanel({
  work,
  compact,
  ghost,
  buttonClassName,
}: WorkCitationPanelProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [coords, setCoords] = useState<PopoverCoords | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const citations = useMemo(() => getCitationsForWork(work), [work]);
  const fileBase = useMemo(() => {
    const id = getWorkCitationId(work).replace(/[^a-z0-9]+/gi, '-').slice(0, 40);
    return id || 'citation';
  }, [work]);

  const updateCoords = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    setCoords(computePopoverCoords(el.getBoundingClientRect()));
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updateCoords();
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => updateCoords();
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) return;
    let onDocClick: ((e: Event) => void) | null = null;
    const timer = window.setTimeout(() => {
      onDocClick = (e: Event) => {
        const target = e.target as Node;
        if (anchorRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
        setOpen(false);
      };
      document.addEventListener('mousedown', onDocClick);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      if (onDocClick) document.removeEventListener('mousedown', onDocClick);
    };
  }, [open]);

  const handleToggle = useCallback((e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen((v) => !v);
  }, []);

  const handleCopy = useCallback(async (key: keyof WorkCitations, label: string) => {
    const text = citations[key];
    if (typeof text !== 'string') return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied('Error al copiar');
    }
  }, [citations]);

  const popover = open && coords ? (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Citas bibliográficas"
      aria-modal="false"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        zIndex: 10000,
        width: `min(${PANEL_WIDTH}px, 92vw)`,
        maxHeight: coords.maxHeight,
        overflowY: 'auto',
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        padding: 12,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
        Citas bibliográficas
        {citations.incomplete && (
          <span style={{ color: '#b45309', fontWeight: 600, marginLeft: 6 }}>(incompleta)</span>
        )}
      </div>
      {FORMATS.map(({ key, label }) => (
        <div key={key} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748b' }}>{label}</span>
            <button
              type="button"
              onClick={() => handleCopy(key, label)}
              style={{ fontSize: 10, padding: '2px 8px', cursor: 'pointer', borderRadius: 4, border: '1px solid #cbd5e1', background: '#f8fafc' }}
            >
              Copiar
            </button>
          </div>
          <pre
            style={{
              margin: 0,
              fontSize: 10,
              lineHeight: 1.45,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              background: '#f8fafc',
              padding: 8,
              borderRadius: 6,
              maxHeight: 100,
              overflow: 'auto',
              color: '#1e293b',
            }}
          >
            {citations[key] || ''}
          </pre>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        <button
          type="button"
          onClick={() => downloadText(`${fileBase}.bib`, citations.bibtex, 'application/x-bibtex')}
          style={{ fontSize: 10, padding: '4px 10px', cursor: 'pointer', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff' }}
        >
          Descargar BibTeX
        </button>
        <button
          type="button"
          onClick={() => downloadText(`${fileBase}.ris`, citations.ris, 'application/x-research-info-systems')}
          style={{ fontSize: 10, padding: '4px 10px', cursor: 'pointer', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff' }}
        >
          Descargar RIS
        </button>
      </div>
      {copied && (
        <div style={{ fontSize: 10, color: '#15803d', marginTop: 8 }}>Copiado: {copied}</div>
      )}
    </div>
  ) : null;

  const footStyle = Boolean(buttonClassName);
  const showQuoteIcon = ghost || footStyle;

  return (
    <div ref={anchorRef} className="work-citation-panel">
      <button
        type="button"
        onClick={handleToggle}
        className={[
          'btn',
          buttonClassName,
          !buttonClassName && `work-citation-panel__btn${ghost ? ' work-citation-panel__btn--ghost' : ''}`,
        ].filter(Boolean).join(' ')}
        title="Citar publicación"
        aria-expanded={open}
        style={ghost || footStyle ? undefined : {
          background: '#475569',
          color: '#fff',
          padding: compact ? '3px 10px' : '5px 14px',
          fontSize: compact ? 10 : 11,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {showQuoteIcon ? (
          <>
            <IconQuote className={footStyle ? 'work-card__btn-icon' : 'work-citation-panel__icon'} />
            Citar
          </>
        ) : (
          <>📎 Citar</>
        )}
      </button>
      {popover && createPortal(popover, document.body)}
    </div>
  );
});

export default WorkCitationPanel;
