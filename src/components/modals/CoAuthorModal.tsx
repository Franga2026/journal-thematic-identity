import { useMemo, useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useUI } from '../../context/UIContext';
import { useOpenResearcherProfile } from '../../app/hooks/useOpenResearcherProfile';
import { useTransitionNavigate } from '../../app/hooks/useTransitionNavigate';
import { fieldEs } from '../../utils/fieldEs';
import { getData, resolveCoAuthorProfile, getAuthorOA } from '../../utils/dataProcessing';
import { getInitials, shortDept, stripTags } from '../../utils/helpers';
import {
  COAUTHOR_EMPTY_LIST_MESSAGE,
  COAUTHOR_EMPTY_LIST_TITLE,
  COAUTHOR_TECHNICAL_NOTE,
  shouldShowCoAuthorLinkingNote,
} from '../../utils/coAuthorsTechnicalNote';
import {
  buildCoAuthorKpiCards,
  countUtaCoauthorsFromWorks,
  getCoAuthorOpenAlexAuthorUrl,
  getCoAuthorOrcidUrl,
  listUtaCollaboratorsFromWorks,
} from '../../utils/coAuthorProfileView';
import { sortWorks, type SortKey } from '../../utils/sortWorks';
import { findResearcherByProfileId } from '../../utils/researcherProfile';
import { getUtaLinks } from '../../utils/utaAuthorLinks';
import ProductionWorkList from '../production/ProductionWorkList';
import WorkCard from '../cards/WorkCard';
import ProductionViewToggle, { type ProductionViewMode } from '../production/ProductionViewToggle';
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
import type { GlobalProfile } from '../../shared/types/globalProfile';
import { getCoAuthorGlobalProfile } from '../../services/coauthor/coAuthorGlobalProfile';
import CoAuthorGlobalSection from '../coauthor/CoAuthorGlobalSection';
import { computeMeanEligibleWorkFwci, getWorkOpenAlexCitations } from '../../utils/workMetrics';

const PAGE_SIZE = 8;

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  return (parts[0]?.slice(0, 2) || '?').toUpperCase();
}

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
  const { sdgNum: sdgNumRoute } = useParams();
  const catalog = getData();

  const [page, setPage] = useState(0);
  const [pubSearch, setPubSearch] = useState('');
  const [fieldFilter, setFieldFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('citations');
  const [datasetsCount, setDatasetsCount] = useState<number | undefined>(undefined);
  const [datasetsLoading, setDatasetsLoading] = useState(false);
  const [datasetsExpanded, setDatasetsExpanded] = useState(false);
  const [utaExpanded, setUtaExpanded] = useState(false);
  const [coauthorDatasets, setCoauthorDatasets] = useState<DatasetRecord[]>([]);
  const [datasetsListLoading, setDatasetsListLoading] = useState(false);
  const [globalProfile, setGlobalProfile] = useState<GlobalProfile | null>(null);
  const [pubViewMode, setPubViewMode] = useState<ProductionViewMode>('list');

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
  const jointWorksByUtaId = useMemo(() => {
    const counts = new Map<string, number>();
    allWorks.forEach((w) => {
      getUtaLinks(w).forEach((link) => {
        const rut = link.rut.trim();
        if (!rut) return;
        counts.set(rut, (counts.get(rut) ?? 0) + 1);
      });
    });
    return counts;
  }, [allWorks]);

  const orcidUrl = ca ? getCoAuthorOrcidUrl(ca) : null;
  const openAlexAuthorUrl = ca ? getCoAuthorOpenAlexAuthorUrl(ca) : null;

  useEffect(() => {
    let alive = true;
    setGlobalProfile(null);
    getCoAuthorGlobalProfile(ca?.orcid, ca?.global_profile ?? null).then((p) => {
      if (alive) setGlobalProfile(p);
    });
    return () => {
      alive = false;
    };
  }, [ca?.orcid, ca?.global_profile]);

  useEffect(() => {
    setPage(0);
    setPubSearch('');
    setFieldFilter('');
    setSortKey('citations');
    setDatasetsExpanded(false);
    setUtaExpanded(false);
    setCoauthorDatasets([]);
    setPubViewMode('list');
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

  const fieldCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of allWorks) {
      const t = w.field ?? w.topic;
      if (t) m.set(t, (m.get(t) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [allWorks]);

  const isOdsReferent = ca?.metricsScope === 'global_openalex';

  const filteredWorks = useMemo(() => {
    let list = [...allWorks];
    if (!isOdsReferent) {
      const q = pubSearch.trim().toLowerCase();
      if (q) {
        list = list.filter((w) => stripTags(w.t).toLowerCase().includes(q));
      }
    }
    if (fieldFilter) {
      list = list.filter((w) => w.field === fieldFilter || w.topic === fieldFilter);
    }
    return sortWorks(list, sortKey);
  }, [allWorks, pubSearch, fieldFilter, sortKey, isOdsReferent]);

  const totalPages = Math.max(1, Math.ceil(filteredWorks.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageWorks = isOdsReferent
    ? filteredWorks
    : filteredWorks.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const odsSdgNum = useMemo(() => {
    const n = parseInt(String(sdgNumRoute ?? ''), 10);
    return n >= 1 && n <= 17 ? n : undefined;
  }, [sdgNumRoute]);

  const odsMetrics = useMemo(() => {
    const { fwci } = computeMeanEligibleWorkFwci(allWorks);
    const citations = allWorks.reduce((sum, w) => sum + getWorkOpenAlexCitations(w), 0);
    return {
      fwci,
      publications: allWorks.length,
      h_index: ca?.h_index ?? null,
      citations,
    };
  }, [allWorks, ca?.h_index]);

  const handleOpenResearcherFromWork = useCallback(
    (profileId: string) => {
      const researcher = findResearcherByProfileId(catalog, profileId);
      if (!researcher) return;
      setViewCoAuthor(null);
      openLocalResearcherProfile(researcher);
    },
    [catalog, setViewCoAuthor, openLocalResearcherProfile],
  );

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
            {(orcidUrl || openAlexAuthorUrl) && (
              <span className="coauthor-hero__link-sep" aria-hidden>
                ·
              </span>
            )}
            <AISummaryButton
              buttonClassName="coauthor-hero__ia"
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
        </header>

        <div className="coauthor-body">
          {!isOdsReferent && (
          <div className="coauthor-zone-label">
            <span>🔗 Cooperación con la UTA</span>
          </div>
          )}
          {!isOdsReferent && (
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
          )}

          {isOdsReferent && utaCoauthorCount === 0 && (
            <div className="coauthor-uta-opportunity" role="note">
              <div className="coauthor-uta-opportunity__icon" aria-hidden>
                🔗
              </div>
              <div className="coauthor-uta-opportunity__body">
                <h4 className="coauthor-uta-opportunity__title">
                  Sin colaboración previa con la Universidad de Tarapacá
                </h4>
                <p className="coauthor-uta-opportunity__text">
                  Referente internacional en este ODS. Potencial oportunidad de vinculación para
                  investigadores UTA.
                </p>
              </div>
            </div>
          )}

          {isOdsReferent && globalProfile && (
            <CoAuthorGlobalSection
              profile={globalProfile}
              odsReferentLayout
              odsSdgNum={odsSdgNum}
              odsMetrics={odsMetrics}
              showTopWorks={false}
            />
          )}

          {!isOdsReferent && utaCoauthorCount > 0 ? (
            <>
              <div className="cg-prod-head">
                <span className="cg-prod-title">COAUTORES UTA</span>
                <span className="cg-prod-pill">{utaCoauthorCount} investigadores</span>
              </div>
              <div className="cg-uta-coauthors">
                {utaCollaborators.map((link) => {
                  const researcher = link.researcher;
                  const deptName = researcher ? (researcher.dp || [])[0]?.d : undefined;
                  const areaLabel = deptName ? shortDept(deptName) : null;
                  const hIndex = researcher ? getAuthorOA(researcher)?.h_index : undefined;
                  const jointWorks = jointWorksByUtaId.get(link.id) ?? 0;
                  const avatarInitials = researcher
                    ? getInitials(researcher.f, researcher.l)
                    : initialsFromName(link.name);

                  return (
                    <div className="cg-uta-coauthor" key={link.id}>
                      <div className="cg-uta-coauthor__avatar">{avatarInitials}</div>
                      <div className="cg-uta-coauthor__body">
                        <div className="cg-uta-coauthor__name">{link.name}</div>
                        {areaLabel && (
                          <div className="cg-uta-coauthor__meta">
                            {areaLabel} · UTA
                          </div>
                        )}
                        <div className="cg-uta-coauthor__stats">
                          {hIndex != null && `h-${hIndex} · `}
                          {jointWorks.toLocaleString('es')} obras conjuntas
                          {researcher && (
                            <>
                              {' · '}
                              <button
                                type="button"
                                className="cg-uta-coauthor__link"
                                onClick={() => handleOpenUtaResearcher(researcher, link.id)}
                              >
                                Ver ficha ↗
                              </button>
                            </>
                          )}
                          {!researcher && (
                            <span className="cg-uta-coauthor__missing"> · Sin ficha local</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : !isOdsReferent ? (
            <div className="coauthor-uta-opportunity" role="note">
              <div className="coauthor-uta-opportunity__icon" aria-hidden>
                🔗
              </div>
              <div className="coauthor-uta-opportunity__body">
                <h4 className="coauthor-uta-opportunity__title">
                  Sin colaboración previa con la Universidad de Tarapacá
                </h4>
                <p className="coauthor-uta-opportunity__text">
                  Referente internacional en este ODS. Potencial oportunidad de vinculación para
                  investigadores UTA.
                </p>
              </div>
            </div>
          ) : null}

          {fieldCounts.length > 0 && (
            <section className="coauthor-section" aria-labelledby="coauthor-lines-label">
              <h3 id="coauthor-lines-label" className="coauthor-section__label">
                Áreas temáticas
              </h3>
              <div className="coauthor-line-chips">
                {isOdsReferent && (
                  <button
                    type="button"
                    className={`coauthor-line-chip ${!fieldFilter ? 'coauthor-line-chip--active' : ''}`}
                    onClick={() => {
                      setFieldFilter('');
                      setPage(0);
                    }}
                  >
                    Todas · {allWorks.length}
                  </button>
                )}
                {fieldCounts.map(([f, n]) => (
                  <button
                    key={f}
                    type="button"
                    className={`coauthor-line-chip ${fieldFilter === f ? 'coauthor-line-chip--active' : ''}`}
                    onClick={() => {
                      setFieldFilter((prev) => (prev === f ? '' : f));
                      setPage(0);
                    }}
                  >
                    {fieldEs(f)} · {n}
                  </button>
                ))}
              </div>
            </section>
          )}

          {isOdsReferent && ca.top_coauthors && ca.top_coauthors.length > 0 && (
            <section className="coauthor-section" aria-labelledby="coauthor-top-coauthors-label">
              <h3 id="coauthor-top-coauthors-label" className="coauthor-section__label">
                Principales coautores en este ODS
              </h3>
              <div className="coauthor-ods-coauthor-chips">
                {ca.top_coauthors.map((tc) => {
                  const label = tc.institution
                    ? `${tc.name} · ${tc.institution}`
                    : tc.name;
                  return (
                    <div
                      key={tc.openalex_id || tc.name}
                      className="coauthor-ods-coauthor-chip"
                    >
                      <span className="coauthor-ods-coauthor-chip__avatar" aria-hidden>
                        {initialsFromName(tc.name)}
                      </span>
                      <span className="coauthor-ods-coauthor-chip__label">{label}</span>
                      <span className="coauthor-ods-coauthor-chip__badge">
                        {tc.works_together.toLocaleString('es')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="coauthor-section coauthor-publications" aria-labelledby="coauthor-pubs-label">
            <div className="coauthor-panel__head">
              <h3 id="coauthor-pubs-label" className="coauthor-panel__title">
                {isOdsReferent
                  ? `Publicaciones en el ODS · ${filteredWorks.length}`
                  : `Publicaciones indexadas (${filteredWorks.length})`}
              </h3>
              {allWorks.length > 0 && (
                <div className="coauthor-panel__tools">
                  <ProductionViewToggle value={pubViewMode} onChange={setPubViewMode} />
                </div>
              )}
            </div>
            {allWorks.length > 0 && (
              <div className="coauthor-pub-toolbar">
                <div className="descubridor__sort">
                  <label htmlFor="coauthor-pub-sort" className="descubridor__sort-label">Ordenar por</label>
                  <select
                    id="coauthor-pub-sort"
                    className="descubridor__sort-select coauthor-panel__input"
                    value={sortKey}
                    onChange={(e) => {
                      setSortKey(e.target.value as SortKey);
                      setPage(0);
                    }}
                    aria-label="Ordenar publicaciones"
                  >
                    <option value="citations">Más citadas</option>
                    <option value="fwci">Mayor FWCI</option>
                    <option value="year">Año (recientes)</option>
                    <option value="quartile">Mejor cuartil</option>
                  </select>
                </div>
                {!isOdsReferent && (
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
                )}
              </div>
            )}
            {pageWorks.length > 0 ? (
              <>
                <div className="coauthor-pub-list">
                  <ProductionWorkList
                    works={pageWorks}
                    viewMode={pubViewMode}
                    variant="coauthor"
                    onOpenResearcher={handleOpenResearcherFromWork}
                  />
                </div>
                {!isOdsReferent && (
                  <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
                )}
              </>
            ) : (
              <EmptyWorksMessage
                showLinkingNote={showLinkingNote}
                showGlobal={Boolean(showGlobal)}
                openAlexAuthorUrl={openAlexAuthorUrl}
              />
            )}
          </section>

          {!isOdsReferent && ca.top_coauthors && ca.top_coauthors.length > 0 && (
            <section className="coauthor-section" aria-labelledby="coauthor-top-coauthors-label">
              <h3 id="coauthor-top-coauthors-label" className="coauthor-section__label">
                Principales coautores en este ODS
              </h3>
              <ul className="coauthor-top-coauthors">
                {ca.top_coauthors.map((tc) => (
                  <li key={tc.openalex_id || tc.name} className="coauthor-top-coauthors__item">
                    <span className="coauthor-top-coauthors__name">{tc.name}</span>
                    {tc.institution && (
                      <span className="coauthor-top-coauthors__meta"> · {tc.institution}</span>
                    )}
                    <span className="coauthor-top-coauthors__meta">
                      {' · '}
                      {tc.works_together.toLocaleString('es')}{' '}
                      {tc.works_together === 1 ? 'obra junta' : 'obras juntas'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!isOdsReferent && globalProfile && (
            <CoAuthorGlobalSection profile={globalProfile} />
          )}
        </div>

        <footer className="coauthor-footer">
          <p className="coauthor-footer__note">
            Los indicadores se actualizan automáticamente con datos de OpenAlex y ORCID.
          </p>
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
