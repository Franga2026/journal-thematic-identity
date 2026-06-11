import { useMemo, useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useUI } from '../../context/UIContext';
import { useOpenResearcherProfile } from '../../app/hooks/useOpenResearcherProfile';
import { useTransitionNavigate } from '../../app/hooks/useTransitionNavigate';
import { getData, resolveCoAuthorProfile } from '../../utils/dataProcessing';
import { stripTags } from '../../utils/helpers';
import {
  COAUTHOR_EMPTY_LIST_MESSAGE,
  COAUTHOR_EMPTY_LIST_TITLE,
  COAUTHOR_TECHNICAL_NOTE,
  shouldShowCoAuthorLinkingNote,
} from '../../utils/coAuthorsTechnicalNote';
import {
  type PubSortKey,
  buildCoAuthorKpiCards,
  countUtaCoauthorsFromWorks,
  getCoAuthorOpenAlexAuthorUrl,
  getCoAuthorOrcidUrl,
  listUtaCollaboratorsFromWorks,
  sortCoAuthorWorks,
} from '../../utils/coAuthorProfileView';
import { getCitationsForWork } from '../../utils/citation/getCitationsForWork';
import { findResearcherByProfileId } from '../../utils/researcherProfile';
import WorkCard from '../cards/WorkCard';
import ResearcherProfileCard from '../researcher/ResearcherProfileCard';
import AISummaryButton from '../ai/AISummaryButton';
import { analyzeCoauthor } from '../../api/aiApi';
import type { CoauthorAnalysisStructured } from '../../services/ai/types';
import { Pagination } from '../common/UIComponents';
import {
  fetchCoAuthorDatasetRecords,
  fetchCoAuthorDatasetsCount,
} from '../../services/coauthors/coAuthorDatasetsCount';
import type { DatasetRecord, Researcher } from '../../shared/types';

const PAGE_SIZE = 8;

function IconChevronDown({ className }: { className?: string }) {
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
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function CoAuthorModal() {
  const { viewCoAuthor, setViewCoAuthor } = useApp();
  const { openResearcher } = useUI();
  const navigate = useTransitionNavigate();
  const { openLocalResearcherProfile } = useOpenResearcherProfile();
  const catalog = getData();

  const [page, setPage] = useState(0);
  const [pubSearch, setPubSearch] = useState('');
  const [fieldFilter, setFieldFilter] = useState('');
  const [sortKey, setSortKey] = useState<PubSortKey>('recent');
  const [datasetsCount, setDatasetsCount] = useState<number | undefined>(undefined);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [datasetsExpanded, setDatasetsExpanded] = useState(false);
  const [utaExpanded, setUtaExpanded] = useState(false);
  const [coauthorDatasets, setCoauthorDatasets] = useState<DatasetRecord[]>([]);
  const [datasetsListLoading, setDatasetsListLoading] = useState(false);

  const ca = useMemo(() => {
    if (!viewCoAuthor) return null;
    if (viewCoAuthor.metricsScope != null) return viewCoAuthor;
    return resolveCoAuthorProfile(viewCoAuthor);
  }, [viewCoAuthor]);

  const allWorks = ca?.works || [];
  const utaCoauthorCount = useMemo(() => countUtaCoauthorsFromWorks(allWorks), [allWorks]);
  const utaCollaborators = useMemo(
    () => listUtaCollaboratorsFromWorks(allWorks, catalog),
    [allWorks, catalog],
  );

  const orcidUrl = ca ? getCoAuthorOrcidUrl(ca) : null;
  const openAlexAuthorUrl = ca ? getCoAuthorOpenAlexAuthorUrl(ca) : null;

  useEffect(() => {
    setPage(0);
    setPubSearch('');
    setFieldFilter('');
    setSortKey('recent');
    setDatasetsExpanded(false);
    setUtaExpanded(false);
    setCoauthorDatasets([]);
  }, [viewCoAuthor]);

  useEffect(() => {
    if (!ca) {
      setDatasetsCount(undefined);
      setDatasetsLoading(false);
      return;
    }
    let cancelled = false;
    setDatasetsLoading(true);
    setDatasetsCount(undefined);

    fetchCoAuthorDatasetsCount({ oaId: ca.oaId, orcid: ca.orcid })
      .then((count) => {
        if (!cancelled) setDatasetsCount(count);
      })
      .catch(() => {
        if (!cancelled) setDatasetsCount(0);
      })
      .finally(() => {
        if (!cancelled) setDatasetsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ca?.oaId, ca?.orcid]);

  useEffect(() => {
    if (!datasetsExpanded || !ca || (datasetsCount ?? 0) <= 0) return;

    let cancelled = false;
    setDatasetsListLoading(true);

    fetchCoAuthorDatasetRecords({ oaId: ca.oaId, orcid: ca.orcid })
      .then((records) => {
        if (!cancelled) {
          setCoauthorDatasets(
            [...records].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setCoauthorDatasets([]);
      })
      .finally(() => {
        if (!cancelled) setDatasetsListLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [datasetsExpanded, ca, datasetsCount]);

  const handleOpenUtaResearcher = useCallback(
    (researcher: Researcher, rut: string) => {
      const profileId = rut.trim();
      if (!profileId) return;
      setViewCoAuthor(null);
      openResearcher(researcher);
      navigate(`/perfiles/${encodeURIComponent(profileId)}`);
    },
    [setViewCoAuthor, openResearcher, navigate],
  );

  const filteredWorks = useMemo(() => {
    let list = sortCoAuthorWorks(allWorks, sortKey);
    const q = pubSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((w) => stripTags(w.t).toLowerCase().includes(q));
    }
    if (fieldFilter) {
      list = list.filter((w) => w.field === fieldFilter);
    }
    return list;
  }, [allWorks, pubSearch, fieldFilter, sortKey]);

  const totalPages = Math.max(1, Math.ceil(filteredWorks.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageWorks = filteredWorks.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const handleOpenResearcherFromWork = useCallback(
    (profileId: string) => {
      const researcher = findResearcherByProfileId(catalog, profileId);
      if (!researcher) return;
      setViewCoAuthor(null);
      openLocalResearcherProfile(researcher);
    },
    [catalog, setViewCoAuthor, openLocalResearcherProfile],
  );

  const handleExportReference = useCallback(() => {
    const w = filteredWorks[0] || allWorks[0];
    if (!w) return;
    const c = getCitationsForWork(w);
    const text = c.apa || c.ieee || stripTags(w.t);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'referencia.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredWorks, allWorks]);

  const metricCards = useMemo(
    () =>
      ca
        ? buildCoAuthorKpiCards(ca, utaCoauthorCount, {
            datasetsCount,
            datasetsLoading,
          })
        : [],
    [ca, utaCoauthorCount, datasetsCount, datasetsLoading],
  );

  if (!ca) return null;

  const listScope = ca.publicationListScope || ca.metricsScope || 'collaboration';
  const global = ca.global_openalex;
  const showGlobal =
    global &&
    listScope !== 'global_openalex' &&
    ((global.works_count ?? 0) > (ca.works_count ?? 0) ||
      (global.cited_by_count ?? 0) > (ca.cited_by_count ?? 0) ||
      (global.h_index ?? 0) > (ca.h_index ?? 0));

  const showLinkingNote = shouldShowCoAuthorLinkingNote({
    worksLength: allWorks.length,
    publicationListScope: listScope,
    globalWorksCount: global?.works_count,
    orcid: ca.orcid,
  });

  return (
    <div className="modal-overlay coauthor-overlay" onClick={() => setViewCoAuthor(null)}>
      <div
        className="modal coauthor-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="coauthor-modal-title"
      >
        <header className="coauthor-hero">
          <button
            type="button"
            onClick={() => setViewCoAuthor(null)}
            className="modal__close coauthor-hero__close"
            aria-label="Cerrar"
          >
            ×
          </button>
          <span className="coauthor-hero__badge">Colaborador internacional</span>
          <h2 id="coauthor-modal-title" className="coauthor-hero__name">
            {ca.name}
            {orcidUrl && (
              <a
                href={orcidUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="coauthor-hero__verified"
                title="Ver perfil ORCID"
                aria-label="Perfil ORCID verificado"
              >
                ✓
              </a>
            )}
          </h2>
          {(ca.institutions || []).length > 0 && (
            <p className="coauthor-hero__institutions">{ca.institutions!.join(' · ')}</p>
          )}
          {(orcidUrl || openAlexAuthorUrl) && (
            <div className="coauthor-hero__links">
              {orcidUrl && (
                <a
                  href={orcidUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="coauthor-hero__link"
                >
                  ORCID
                </a>
              )}
              {orcidUrl && openAlexAuthorUrl && (
                <span className="coauthor-hero__link-sep" aria-hidden>
                  ·
                </span>
              )}
              {openAlexAuthorUrl && (
                <a
                  href={openAlexAuthorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="coauthor-hero__link"
                >
                  OpenAlex
                </a>
              )}
            </div>
          )}
        </header>

        <div className="coauthor-body">
          <section className="coauthor-section" aria-labelledby="coauthor-metrics-label">
            <h3 id="coauthor-metrics-label" className="coauthor-section__label">
              Métricas de colaboración con UTA
            </h3>
            {metricCards.length > 0 && (
              <>
                <div className="coauthor-metrics">
                  {metricCards.map((m) => {
                    const isDatasets = m.key === 'datasets';
                    const isUta = m.key === 'uta';
                    const isExpanded = isDatasets ? datasetsExpanded : isUta ? utaExpanded : false;
                    const valueClass = `coauthor-metric__value${
                      m.positive ? ' coauthor-metric__value--positive' : ''
                    }${m.key === 'fwci' && !m.positive && m.display !== '—' ? ' coauthor-metric__value--neutral' : ''}`;
                    const body = (
                      <>
                        <span className="coauthor-metric__value-row">
                          <span className={valueClass}>{m.display}</span>
                          {m.expandable && (
                            <IconChevronDown
                              className={`coauthor-metric__chevron ti-chevron-down${
                                isExpanded ? ' coauthor-metric__chevron--open' : ''
                              }`}
                            />
                          )}
                        </span>
                        <span className="coauthor-metric__label">{m.label}</span>
                      </>
                    );

                    if (m.expandable && (isDatasets || isUta)) {
                      return (
                        <button
                          key={m.key}
                          type="button"
                          className={`coauthor-metric coauthor-metric--expandable${
                            isExpanded ? ' coauthor-metric--active' : ''
                          }`}
                          aria-label={`${m.label}: ${m.display}`}
                          aria-expanded={isExpanded}
                          aria-controls={`coauthor-${m.key}-panel`}
                          onClick={() => {
                            if (isDatasets) setDatasetsExpanded((open) => !open);
                            if (isUta) setUtaExpanded((open) => !open);
                          }}
                        >
                          {body}
                        </button>
                      );
                    }

                    return (
                      <div
                        key={m.key}
                        className="coauthor-metric"
                        aria-label={`${m.label}: ${m.display}`}
                      >
                        {body}
                      </div>
                    );
                  })}
                </div>
                {datasetsExpanded && (datasetsCount ?? 0) > 0 && (
                  <div
                    id="coauthor-datasets-panel"
                    className="coauthor-datasets-panel"
                    role="region"
                    aria-label={`Datasets del colaborador (${datasetsCount})`}
                  >
                    {datasetsListLoading && (
                      <p className="coauthor-datasets-panel__loading">Cargando datasets…</p>
                    )}
                    {!datasetsListLoading &&
                      coauthorDatasets.map((ds) => (
                        <WorkCard
                          key={ds.openalex_id}
                          ds={ds}
                          variant="dataset"
                          onOpenResearcher={handleOpenResearcherFromWork}
                        />
                      ))}
                    {!datasetsListLoading && coauthorDatasets.length === 0 && (
                      <p className="coauthor-datasets-panel__empty">
                        No se pudieron cargar los datasets.
                      </p>
                    )}
                  </div>
                )}
                {utaExpanded && utaCoauthorCount > 0 && (
                  <div
                    id="coauthor-uta-panel"
                    className="coauthor-uta-panel"
                    role="region"
                    aria-label={`Coautores UTA (${utaCoauthorCount})`}
                  >
                    {utaCollaborators.map((link) =>
                      link.researcher ? (
                        <ResearcherProfileCard
                          key={link.id}
                          researcher={link.researcher}
                          compact
                          onClick={(researcher) => handleOpenUtaResearcher(researcher, link.id)}
                        />
                      ) : (
                        <div key={link.id} className="coauthor-uta-panel__missing">
                          <span className="coauthor-uta-panel__missing-name">{link.name}</span>
                          <span className="coauthor-uta-panel__missing-hint">Sin ficha local</span>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          {(ca.fields || []).length > 0 && (
            <section className="coauthor-section" aria-labelledby="coauthor-lines-label">
              <h3 id="coauthor-lines-label" className="coauthor-section__label">
                Líneas de investigación
              </h3>
              <div className="coauthor-line-chips">
                {ca.fields!.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`coauthor-line-chip ${fieldFilter === f ? 'coauthor-line-chip--active' : ''}`}
                    onClick={() => {
                      setFieldFilter((prev) => (prev === f ? '' : f));
                      setPage(0);
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </section>
          )}

          <div className="coauthor-ai-wrap">
            <AISummaryButton
              className="coauthor-ai-btn"
              label="✨ Ver análisis IA completo"
              panelTitle={`Colaboración — ${ca.name}`}
              fetchAnalysis={() =>
                analyzeCoauthor({
                  orcid: viewCoAuthor?.orcid,
                  name: viewCoAuthor?.name,
                  oaId: viewCoAuthor?.oaId,
                })
              }
              renderStructured={(data: CoauthorAnalysisStructured) => (
                <div className="ai-coauthor-analysis">
                  <p>
                    <strong>Tipo de colaboración:</strong> {data.tipo_colaboracion}
                  </p>
                  <p>
                    <strong>Impacto:</strong> {data.impacto_colaboracion}
                  </p>
                  {data.temas_comunes?.length > 0 && (
                    <p>
                      <strong>Temas comunes:</strong> {data.temas_comunes.join(' · ')}
                    </p>
                  )}
                </div>
              )}
            />
          </div>

          <section className="coauthor-section coauthor-publications" aria-labelledby="coauthor-pubs-label">
            <div className="coauthor-panel__head">
              <h3 id="coauthor-pubs-label" className="coauthor-panel__title">
                Publicaciones indexadas ({filteredWorks.length})
              </h3>
              {allWorks.length > 0 && (
                <div className="coauthor-panel__tools">
                  <select
                    className="filter-bar__input coauthor-sort coauthor-panel__input"
                    value={sortKey}
                    onChange={(e) => {
                      setSortKey(e.target.value as PubSortKey);
                      setPage(0);
                    }}
                    aria-label="Ordenar publicaciones"
                  >
                    <option value="recent">Más recientes</option>
                    <option value="cited">Más citadas</option>
                    <option value="oldest">Más antiguas</option>
                  </select>
                  <input
                    className="filter-bar__input coauthor-panel__input"
                    value={pubSearch}
                    onChange={(e) => {
                      setPubSearch(e.target.value);
                      setPage(0);
                    }}
                    placeholder="Buscar publicación..."
                    aria-label="Buscar publicación"
                  />
                </div>
              )}
            </div>
            {pageWorks.length > 0 ? (
              <>
                <div className="coauthor-pub-list">
                  {pageWorks.map((w, i) => (
                    <WorkCard
                      key={w.d || w.t || `${safePage}-${i}`}
                      w={w}
                      variant="coauthor"
                      onOpenResearcher={handleOpenResearcherFromWork}
                    />
                  ))}
                </div>
                <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
              </>
            ) : (
              <EmptyWorksMessage
                showLinkingNote={showLinkingNote}
                showGlobal={Boolean(showGlobal)}
                openAlexAuthorUrl={openAlexAuthorUrl}
              />
            )}
          </section>
        </div>

        <footer className="coauthor-footer">
          <p className="coauthor-footer__note">
            Los indicadores se actualizan automáticamente con datos de OpenAlex y ORCID.
          </p>
          <button
            type="button"
            className="coauthor-footer__export"
            onClick={handleExportReference}
            disabled={!allWorks.length}
          >
            Exportar referencia
          </button>
        </footer>
      </div>
    </div>
  );
}

function EmptyWorksMessage({
  showLinkingNote,
  showGlobal,
  openAlexAuthorUrl,
}: {
  showLinkingNote: boolean;
  showGlobal: boolean;
  openAlexAuthorUrl: string | null;
}) {
  return (
    <div className="coauthor-empty">
      <div className="coauthor-empty__title">{COAUTHOR_EMPTY_LIST_TITLE}</div>
      <p>{COAUTHOR_EMPTY_LIST_MESSAGE}</p>
      {showGlobal && openAlexAuthorUrl && (
        <p>
          <a
            href={openAlexAuthorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="coauthor-hero__link"
          >
            Ver perfil global en OpenAlex →
          </a>
        </p>
      )}
      {showLinkingNote && (
        <div className="coauthor-empty__note">
          <strong>{COAUTHOR_TECHNICAL_NOTE.title}</strong>
          <p>{COAUTHOR_TECHNICAL_NOTE.message}</p>
        </div>
      )}
    </div>
  );
}
