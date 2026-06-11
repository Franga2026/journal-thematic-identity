import { useCallback, useState, type ReactNode } from 'react';
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
}: AISummaryButtonProps<T>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiApiResponse<T> | null>(null);
  const [showPanel, setShowPanel] = useState(false);

  const run = useCallback(async () => {
    if (loading || disabled) return;
    setLoading(true);
    setError(null);
    setShowPanel(true);
    try {
      const res = await fetchAnalysis();
      setResult(res);
    } catch (err) {
      setError(friendlyAiError(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [loading, disabled, fetchAnalysis]);

  return (
    <div className={`ai-summary-btn-wrap ${className}`}>
      <button
        type="button"
        className={`btn ai-summary-btn${ghost ? ' ai-summary-btn--ghost' : ''}`}
        disabled={disabled || loading}
        title="Análisis con Claude (servidor)"
        onClick={(e) => {
          e.stopPropagation();
          void run();
        }}
        style={ghost ? undefined : {
          background: loading ? '#94a3b8' : 'linear-gradient(135deg,#6A4C93,#1e3a8a)',
          color: '#fff',
          padding: compact ? '3px 10px' : '5px 14px',
          fontSize: compact ? 10 : 11,
          border: 'none',
        }}
      >
        {loading ? '… IA' : ghost ? label : `✨ ${label}`}
      </button>

      {showPanel && (
        <AIAssistantPanel
          title={panelTitle}
          loading={loading}
          error={error}
          result={result}
          onClose={() => {
            setShowPanel(false);
            setResult(null);
            setError(null);
          }}
        >
          {result?.ok && result.structured && renderStructured
            ? renderStructured(result.structured as T)
            : undefined}
        </AIAssistantPanel>
      )}
    </div>
  );
}
