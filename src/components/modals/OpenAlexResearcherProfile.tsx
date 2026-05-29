import { useEffect, useState } from 'react';
import { fetchOpenAlexAuthor } from '../../services/odsService';
import { getData } from '../../utils/dataProcessing';
import { findResearcherByProfileId } from '../../utils/researcherProfile';
import type { OpenAlexAuthorDetail } from '../../shared/types/openalex';
import type { Researcher } from '../../shared/types';
import { Loading } from '../common/UIComponents';

interface OpenAlexResearcherProfileProps {
  authorId: string;
  onClose: () => void;
  /** Si el ORCID coincide con un investigador UTA, abrir ficha local completa */
  onUtaMatch?: (researcher: Researcher) => void;
}

export default function OpenAlexResearcherProfile({
  authorId,
  onClose,
  onUtaMatch,
}: OpenAlexResearcherProfileProps) {
  const [author, setAuthor] = useState<OpenAlexAuthorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setAuthor(null);

    fetchOpenAlexAuthor(authorId)
      .then((detail) => {
        if (cancelled) return;
        const local = findResearcherByProfileId(
          getData(),
          detail.orcid || detail.openAlexId || authorId
        );
        if (local && onUtaMatch) {
          onUtaMatch(local);
          return;
        }
        setAuthor(detail);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'No se pudo cargar el perfil');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authorId, onUtaMatch]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 960 }}>
        <div className="researcher-modal__header" style={{ background: 'linear-gradient(135deg,#0f172a,#1e3a8a)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: 1.2,
                  color: '#93c5fd',
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                OpenAlex · Investigador internacional
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff' }}>
                {author?.display_name || 'Cargando…'}
              </h2>
              {author?.institution && (
                <p style={{ margin: '8px 0 0', fontSize: 14, color: '#cbd5e1' }}>{author.institution}</p>
              )}
              {author?.orcid && (
                <span
                  style={{
                    display: 'inline-block',
                    marginTop: 8,
                    background: '#a6ce39',
                    color: '#fff',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  ORCID: {author.orcid}
                </span>
              )}
            </div>
            <button type="button" onClick={onClose} className="modal__close" aria-label="Cerrar">
              ×
            </button>
          </div>
        </div>

        <div className="researcher-modal__body">
          {loading && <Loading message="Cargando perfil desde OpenAlex…" />}
          {error && <p style={{ color: 'var(--red-600)', fontSize: 14 }}>{error}</p>}
          {author && !loading && (
            <>
              <div className="grid grid--kpi" style={{ marginBottom: 20 }}>
                {[
                  { l: 'Obras', v: author.works_count },
                  { l: 'Citas', v: author.cited_by_count },
                  { l: 'h-index', v: author.h_index ?? '—' },
                ].map((m) => (
                  <div key={m.l} className="kpi-card">
                    <div className="kpi-card__value" style={{ color: 'var(--blue-700)' }}>
                      {typeof m.v === 'number' ? m.v.toLocaleString() : m.v}
                    </div>
                    <div className="kpi-card__label">{m.l}</div>
                  </div>
                ))}
              </div>
              {author.topics && author.topics.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                    Temas
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {author.topics.map((t) => (
                      <span key={t} className="badge badge--field">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <a
                href={`https://openalex.org/authors/${author.openAlexId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{ background: 'var(--blue-800)', color: '#fff' }}
              >
                Ver perfil completo en OpenAlex
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
