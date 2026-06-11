import { useEffect, useState } from 'react';
import {
  fetchOpenAlexAuthor,
  fetchOpenAlexAuthorByName,
  fetchAuthorFwci,
  fetchAuthorWorks,
  type OpenAlexWorkItem,
} from '../../services/odsService';
import { getData } from '../../utils/dataProcessing';
import { findResearcherByProfileId } from '../../utils/researcherProfile';
import { workItemToWork } from '../../utils/openAlexWorkAdapter';
import { useUI } from '../../context/UIContext';
import type { OpenAlexAuthorDetail, OpenAlexAuthorSummary } from '../../shared/types/openalex';
import type { Researcher } from '../../shared/types';
import WorkCard from '../cards/WorkCard';
import { Loading } from '../common/UIComponents';

interface OpenAlexResearcherProfileProps {
  authorId: string;
  onClose: () => void;
  /** Si el ORCID coincide con un investigador UTA, abrir ficha local completa */
  onUtaMatch?: (researcher: Researcher) => void;
}

const WORKS_PER_PAGE = 25;

/** Convierte el resumen de la fila del ranking en el detalle que pinta la ficha. */
function detailFromSummary(s: OpenAlexAuthorSummary): OpenAlexAuthorDetail {
  return { ...s, topics: [] };
}

/** ¿El id parece un id de autor OpenAlex válido (A123…)? Para no enlazar a un 404. */
function isValidOpenAlexId(id?: string): boolean {
  return !!id && /^A\d+$/i.test(id.replace(/^https?:\/\/openalex\.org\//i, ''));
}

export default function OpenAlexResearcherProfile({
  authorId,
  onClose,
  onUtaMatch,
}: OpenAlexResearcherProfileProps) {
  // Datos completos del autor (de la fila del ranking) puestos en el contexto al abrir.
  const { openAlexAuthor } = useUI();

  const [author, setAuthor] = useState<OpenAlexAuthorDetail | null>(
    openAlexAuthor ? detailFromSummary(openAlexAuthor) : null
  );
  // Solo mostramos spinner si NO tenemos datos locales que pintar.
  const [loading, setLoading] = useState(!openAlexAuthor);
  const [error, setError] = useState<string | null>(null);
  // ¿Estamos trayendo el perfil completo desde OpenAlex en segundo plano?
  const [enriching, setEnriching] = useState(false);
  // FWCI (calculado sobre OpenAlex como universo de referencia).
  const [fwci, setFwci] = useState<number | null>(null);
  const [fwciLoading, setFwciLoading] = useState(false);
  // Producción científica (lista de obras, carga perezosa + paginada).
  const [worksOpen, setWorksOpen] = useState(false);
  const [works, setWorks] = useState<OpenAlexWorkItem[]>([]);
  const [worksTotal, setWorksTotal] = useState<number | null>(null);
  const [worksPage, setWorksPage] = useState(0);
  const [worksLoading, setWorksLoading] = useState(false);

  // Identificadores canónicos para llamadas a OpenAlex (ORCID preferido).
  const orcid = author?.orcid?.trim() || undefined;
  const oaId = isValidOpenAlexId(author?.openAlexId) ? author?.openAlexId : undefined;
  const hasIdentifier = !!orcid || !!oaId;

  useEffect(() => {
    let cancelled = false;

    // 1) ¿Es en realidad un investigador UTA? -> abrir su ficha local completa.
    const matchKey = openAlexAuthor?.orcid?.trim() || authorId;
    const localUta = findResearcherByProfileId(getData(), matchKey);
    if (localUta && onUtaMatch) {
      onUtaMatch(localUta);
      return;
    }

    // 2) Pintar de inmediato con los datos de la fila (sin esperar a la red).
    if (openAlexAuthor) {
      setAuthor(detailFromSummary(openAlexAuthor));
      setLoading(false);
      setError(null);
    } else {
      setAuthor(null);
      setLoading(true);
      setError(null);
    }

    // 3) Enriquecer desde OpenAlex con el PERFIL COMPLETO (ORCID -> id -> nombre).
    const candidates = Array.from(
      new Set(
        [openAlexAuthor?.orcid, authorId, openAlexAuthor?.openAlexId, openAlexAuthor?.id]
          .map((x) => (x || '').trim())
          .filter(Boolean)
      )
    );

    setEnriching(true);
    (async () => {
      for (const cand of candidates) {
        try {
          const detail = await fetchOpenAlexAuthor(cand);
          if (cancelled) return;
          const localFromDetail = findResearcherByProfileId(
            getData(),
            detail.orcid || detail.openAlexId || cand
          );
          if (localFromDetail && onUtaMatch) {
            onUtaMatch(localFromDetail);
            return;
          }
          setAuthor(detail);
          setError(null);
          setLoading(false);
          setEnriching(false);
          return;
        } catch {
          // probar siguiente identificador
        }
      }

      // 4) Fallback por NOMBRE (id fusionado y sin ORCID).
      const name = openAlexAuthor?.display_name?.trim();
      if (name) {
        try {
          const byName = await fetchOpenAlexAuthorByName(name);
          if (cancelled) return;
          if (byName) {
            const localByName = findResearcherByProfileId(
              getData(),
              byName.orcid || byName.openAlexId || ''
            );
            if (localByName && onUtaMatch) {
              onUtaMatch(localByName);
              return;
            }
            setAuthor(byName);
            setError(null);
            setLoading(false);
            setEnriching(false);
            return;
          }
        } catch {
          // nombre tampoco resolvió
        }
      }

      // 5) Conservar datos locales (sin error) si no se pudo enriquecer.
      if (cancelled) return;
      setEnriching(false);
      setLoading(false);
      if (!openAlexAuthor) setError('No se pudo cargar el perfil desde OpenAlex.');
    })();

    return () => {
      cancelled = true;
    };
  }, [authorId, onUtaMatch, openAlexAuthor]);

  // Al cambiar de autor: calcular FWCI y reiniciar la lista de producción.
  useEffect(() => {
    let cancelled = false;

    setWorks([]);
    setWorksTotal(null);
    setWorksPage(0);
    setWorksOpen(false);

    if (!orcid && !oaId) {
      setFwci(null);
      setFwciLoading(false);
      return;
    }

    setFwciLoading(true);
    fetchAuthorFwci({ orcid, oaId })
      .then((res) => {
        if (!cancelled) setFwci(res.fwci);
      })
      .catch(() => {
        if (!cancelled) setFwci(null);
      })
      .finally(() => {
        if (!cancelled) setFwciLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orcid, oaId]);

  async function loadWorks(page: number) {
    if (!orcid && !oaId) return;
    setWorksLoading(true);
    try {
      const res = await fetchAuthorWorks({ orcid, oaId, page, perPage: WORKS_PER_PAGE });
      setWorks((prev) => (page === 1 ? res.works : [...prev, ...res.works]));
      setWorksTotal(res.total);
      setWorksPage(page);
    } catch {
      // si falla (rate limit / red), dejamos lo que haya
    } finally {
      setWorksLoading(false);
    }
  }

  function toggleWorks() {
    const next = !worksOpen;
    setWorksOpen(next);
    if (next && works.length === 0 && !worksLoading) {
      void loadWorks(1);
    }
  }

  const openAlexLink = author && isValidOpenAlexId(author.openAlexId)
    ? `https://openalex.org/authors/${author.openAlexId.replace(/^https?:\/\/openalex\.org\//i, '')}`
    : null;

  const showFwci = fwciLoading || fwci !== null;
  const canLoadMore = worksTotal !== null && works.length < worksTotal && !worksLoading;

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
                <p style={{ margin: '8px 0 0', fontSize: 14, color: '#cbd5e1' }}>
                  {author.institution}
                  {author.country_code ? ` · ${author.country_code}` : ''}
                </p>
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
          {loading && !author && <Loading message="Cargando perfil desde OpenAlex…" />}
          {error && !author && <p style={{ color: 'var(--red-600)', fontSize: 14 }}>{error}</p>}
          {author && (
            <>
              <div className="grid grid--kpi" style={{ marginBottom: 8 }}>
                {[
                  { l: 'Publicaciones', v: author.works_count },
                  { l: 'Citas', v: author.cited_by_count },
                  { l: 'h-index', v: author.h_index ?? '—' },
                  {
                    l: 'FWCI',
                    v: fwciLoading ? '…' : typeof fwci === 'number' ? fwci.toFixed(2) : '—',
                  },
                ].map((m) => (
                  <div key={m.l} className="kpi-card">
                    <div className="kpi-card__value" style={{ color: 'var(--blue-700)' }}>
                      {typeof m.v === 'number' ? m.v.toLocaleString() : m.v}
                    </div>
                    <div className="kpi-card__label">{m.l}</div>
                  </div>
                ))}
              </div>

              {showFwci && (
                <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 16px' }}>
                  FWCI calculado sobre OpenAlex como universo de referencia (no Scopus/SciVal).
                  1,00 = promedio mundial; &gt;1,00 sobre el promedio.
                </p>
              )}

              {enriching && (
                <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
                  Cargando perfil completo desde OpenAlex…
                </p>
              )}

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

              {/* Producción científica (carga perezosa) */}
              {hasIdentifier && (
                <div style={{ marginBottom: 16 }}>
                  <button
                    type="button"
                    onClick={toggleWorks}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      textAlign: 'left',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: '10px 12px',
                      fontSize: 14,
                      fontWeight: 700,
                      color: '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ color: '#64748b' }}>{worksOpen ? '▾' : '▸'}</span>
                    Producción científica
                    {worksTotal !== null && (
                      <span style={{ color: '#94a3b8', fontWeight: 600 }}>({worksTotal.toLocaleString()})</span>
                    )}
                  </button>

                  {worksOpen && (
                    <div
                      style={{
                        marginTop: 8,
                        maxHeight: 380,
                        overflowY: 'auto',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                      }}
                    >
                      {works.map((item) => (
                        <WorkCard
                          key={item.id}
                          w={workItemToWork(item)}
                          variant="openalex"
                        />
                      ))}

                      {worksLoading && (
                        <div style={{ padding: 12 }}>
                          <Loading message="Cargando publicaciones…" />
                        </div>
                      )}

                      {canLoadMore && (
                        <button
                          type="button"
                          onClick={() => void loadWorks(worksPage + 1)}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            background: '#fff',
                            border: 'none',
                            borderTop: '1px solid #f1f5f9',
                            color: '#1e3a8a',
                            fontWeight: 700,
                            fontSize: 13,
                            cursor: 'pointer',
                          }}
                        >
                          Cargar más ({works.length.toLocaleString()} / {worksTotal?.toLocaleString()})
                        </button>
                      )}

                      {!worksLoading && works.length === 0 && (
                        <div style={{ padding: 12, fontSize: 13, color: '#94a3b8' }}>
                          No se pudieron cargar las publicaciones.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {openAlexLink && (
                <a
                  href={openAlexLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                  style={{ background: 'var(--blue-800)', color: '#fff' }}
                >
                  Ver perfil completo en OpenAlex
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
