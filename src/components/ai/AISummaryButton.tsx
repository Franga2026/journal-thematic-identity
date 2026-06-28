import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { AiApiResponse } from '../../services/ai/types';
import { friendlyAiError } from '../../api/aiApi';
import AIAssistantPanel from './AIAssistantPanel';

type AiFetchFn<T> = () => Promise<AiApiResponse<T>>;

interface AISummaryButtonProps<T = unknown> {
  label?: string;
  panelTitle?: string;
  compact?: boolean;
  ghost?: boolean;
  disabled?: boolean;
  fetchAnalysis: AiFetchFn<T>;
  renderStructured?: (data: T) => ReactNode;
  className?: string;
  buttonClassName?: string;
  showIcon?: boolean;
  /** Oculta el botón; el panel se controla con montaje externo o `open`. */
  hideButton?: boolean;
  /** Control externo de visibilidad del panel (junto con `onOpenChange`). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function IconSparkles({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m12 3-1.9 5.8L4.3 10.7l5.8 1.9L12 18.4l1.9-5.8 5.8-1.9-5.8-1.9L12 3Z" />
      <path d="M5 3v4M3 5h4M19 17v4M17 19h4" />
    </svg>
  );
}

export default function AISummaryButton<T>({
  label = 'Resumen IA',
  panelTitle = 'Análisis IA',
  compact = false,
  ghost = false,
  disabled = false,
  fetchAnalysis,
  renderStructured,
  className = '',
  buttonClassName,
  showIcon = false,
  hideButton = false,
  open: openProp,
  onOpenChange,
}: AISummaryButtonProps<T>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiApiResponse<T> | null>(null);
  const [showPanel, setShowPanel] = useState(false);

  const isPanelControlled = openProp !== undefined;
  const panelOpen = hideButton ? true : (isPanelControlled ? openProp : showPanel);

  const run = useCallback(async () => {
    if (loading || disabled) return;
    setLoading(true);
    setError(null);
    if (!hideButton) setShowPanel(true);
    try {
      const res = await fetchAnalysis();
      setResult(res);
    } catch (err) {
      setError(friendlyAiError(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [loading, disabled, fetchAnalysis, hideButton]);

  useEffect(() => {
    if (!hideButton) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchAnalysis();
        if (!cancelled) setResult(res);
      } catch (err) {
        if (!cancelled) {
          setError(friendlyAiError(err));
          setResult(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hideButton, fetchAnalysis]);

  const closePanel = useCallback(() => {
    if (hideButton || isPanelControlled) {
      onOpenChange?.(false);
      return;
    }
    setShowPanel(false);
    setResult(null);
    setError(null);
  }, [hideButton, isPanelControlled, onOpenChange]);

  const footStyle = Boolean(buttonClassName);
  const plainStyle = ghost || footStyle;

  return (
    <div className={`ai-summary-btn-wrap ${className}`}>
      {!hideButton && (
      <button
        type="button"
        className={[
          'btn',
          buttonClassName,
          !buttonClassName && `ai-summary-btn${ghost ? ' ai-summary-btn--ghost' : ''}`,
        ].filter(Boolean).join(' ')}
        disabled={disabled || loading}
        title="Análisis con Claude (servidor)"
        onClick={(e) => {
          e.stopPropagation();
          void run();
        }}
        style={plainStyle ? undefined : {
          background: loading ? '#94a3b8' : 'linear-gradient(135deg,#6A4C93,#1e3a8a)',
          color: '#fff',
          padding: compact ? '3px 10px' : '5px 14px',
          fontSize: compact ? 10 : 11,
          border: 'none',
        }}
      >
        {loading ? (
          '… IA'
        ) : plainStyle ? (
          <>
            {showIcon && <IconSparkles className={footStyle ? 'work-card__btn-icon' : undefined} />}
            {label}
          </>
        ) : (
          `✨ ${label}`
        )}
      </button>
      )}

      {panelOpen && (
        <AIAssistantPanel
          title={panelTitle}
          loading={loading}
          error={error}
          result={result}
          onClose={closePanel}
        >
          {result?.ok && result.structured && renderStructured
            ? renderStructured(result.structured as T)
            : undefined}
        </AIAssistantPanel>
      )}
    </div>
  );
}
