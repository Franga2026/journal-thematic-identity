import { useCallback, useState, type ReactNode } from 'react';
import type { AiApiResponse } from '../../services/ai/types';

interface AIAssistantPanelProps {
  title?: string;
  loading?: boolean;
  error?: string | null;
  result?: AiApiResponse<unknown> | null;
  children?: ReactNode;
  defaultOpen?: boolean;
  onClose?: () => void;
}

function formatStructured(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  return Object.entries(data as Record<string, unknown>)
    .map(([key, val]) => {
      const label = key.replace(/_/g, ' ');
      if (Array.isArray(val)) {
        return `**${label}**\n${val.map((x) => `• ${x}`).join('\n')}`;
      }
      return `**${label}**\n${String(val)}`;
    })
    .join('\n\n');
}

export default function AIAssistantPanel({
  title = 'Análisis IA',
  loading = false,
  error = null,
  result = null,
  children,
  defaultOpen = true,
  onClose,
}: AIAssistantPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const displayText =
    result?.ok && result.structured
      ? formatStructured(result.structured)
      : result?.ok
        ? result.text
        : '';

  const handleCopy = useCallback(async () => {
    if (!displayText) return;
    try {
      await navigator.clipboard.writeText(displayText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }, [displayText]);

  if (!loading && !error && !result && !children) return null;

  return (
    <div className="ai-panel">
      <button
        type="button"
        className="ai-panel__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="ai-panel__toggle-icon">{open ? '▼' : '▶'}</span>
        <span>{title}</span>
        {loading && <span className="ai-panel__badge">Analizando…</span>}
        {error && <span className="ai-panel__badge ai-panel__badge--error">Error</span>}
      </button>

      {open && (
        <div className="ai-panel__body">
          {loading && (
            <div className="ai-panel__loading" role="status">
              <span className="loading__spinner" />
              Generando análisis con Claude…
            </div>
          )}

          {error && !loading && (
            <div className="ai-panel__error" role="alert">
              {error}
            </div>
          )}

          {result?.ok && !loading && (
            <>
              <p className="ai-panel__disclaimer">{result.disclaimer}</p>
              <div className="ai-panel__actions">
                <button type="button" className="btn btn--ghost btn--sm" onClick={handleCopy}>
                  {copied ? '✓ Copiado' : 'Copiar análisis'}
                </button>
                {onClose && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={onClose}>
                    Cerrar
                  </button>
                )}
              </div>
              <div className="ai-panel__content">
                {children || displayText.split('\n').map((line, i) => {
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return (
                      <div key={i} className="ai-panel__heading">
                        {line.replace(/\*\*/g, '')}
                      </div>
                    );
                  }
                  if (line.startsWith('• ')) {
                    return <div key={i} className="ai-panel__bullet">{line.slice(2)}</div>;
                  }
                  if (!line.trim()) return <div key={i} className="ai-panel__spacer" />;
                  return <p key={i} className="ai-panel__line">{line}</p>;
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
