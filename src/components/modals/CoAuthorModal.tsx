import { useMemo, useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useOpenResearcherProfile } from '../../app/hooks/useOpenResearcherProfile';
import { getData, resolveCoAuthorProfile, METRICS_SCOPE_LABELS } from '../../utils/dataProcessing';
import { stripTags } from '../../utils/helpers';
import {
  COAUTHOR_EMPTY_LIST_MESSAGE,
  COAUTHOR_EMPTY_LIST_TITLE,
  COAUTHOR_TECHNICAL_NOTE,
  shouldShowCoAuthorLinkingNote,
} from '../../utils/coAuthorsTechnicalNote';
import {
  type CoAuthorModalTab,
  type PubSortKey,
  countUtaCoauthorsFromWorks,
  getCoAuthorOpenAlexAuthorUrl,
  getCoAuthorOrcidUrl,
  listUtaCollaboratorsFromWorks,
  sortCoAuthorWorks,
} from '../../utils/coAuthorProfileView';
import { getCitationsForWork } from '../../utils/citation/getCitationsForWork';
import CoAuthorPublicationCard from '../coauthor/CoAuthorPublicationCard';
import AISummaryButton from '../ai/AISummaryButton';
import { analyzeCoauthor } from '../../api/aiApi';
import type { CoauthorAnalysisStructured } from '../../services/ai/types';
import { Pagination } from '../common/UIComponents';

const PAGE_SIZE = 8;

const TABS: { key: CoAuthorModalTab; label: string }[] = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'publicaciones', label: 'Publicaciones' },
  { key: 'colaboracion', label: 'Colaboración UTA' },
  { key: 'impacto', label: 'Impacto' },
  { key: 'red', label: 'Red de coautoría' },
];

export default function CoAuthorModal() {
  const { viewCoAuthor, setViewCoAuthor } = useApp();
  const { openLocalResearcherProfile } = useOpenResearcherProfile();
  const catalog = getData();

  const [activeTab, setActiveTab] = useState<CoAuthorModalTab>('resumen');
  const [page, setPage] = useState(0);
  const [pubSearch, setPubSearch] = useState('');
  const [fieldFilter, setFieldFilter] = useState('');
  const [sortKey, setSortKey] = useState<PubSortKey>('recent');

  const ca = useMemo(() => {
    if (!viewCoAuthor) return null;
    if (viewCoAuthor.metricsScope != null) return viewCoAuthor;
    return resolveCoAuthorProfile(viewCoAuthor);
  }, [viewCoAuthor]);

  const allWorks = ca?.works || [];
  const utaCoauthorCount = useMemo(() => countUtaCoauthorsFromWorks(allWorks), [allWorks]);
  const utaLinks = useMemo(
    () => listUtaCollaboratorsFromWorks(allWorks, catalog),
    [allWorks, catalog]
  );

  const orcidUrl = ca ? getCoAuthorOrcidUrl(ca) : null;
  const openAlexAuthorUrl = ca ? getCoAuthorOpenAlexAuthorUrl(ca) : null;

  useEffect(() => {
    setActiveTab('resumen');
    setPage(0);
    setPubSearch('');
    setFieldFilter('');
    setSortKey('recent');
  }, [viewCoAuthor]);

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

  if (!ca) return null;

  const listScope = ca.publicationListScope || ca.metricsScope || 'collaboration';
  const listScopeLabel = METRICS_SCOPE_LABELS[listScope];
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

  const pubTabLabel = `Publicaciones (${allWorks.length})`;

  const metricCards = [
    {
      icon: '📄',
      value: ca.works_count ?? 0,
      label: 'Publicaciones',
      tab: 'publicaciones' as CoAuthorModalTab,
    },
    {
      icon: '❝',
      value: ca.cited_by_count ?? 0,
      label: 'Citas',
      tab: 'impacto' as CoAuthorModalTab,
    },
    {
      icon: '📈',
      value: ca.h_index ?? 0,
      label: 'H-index',
      tab: 'impacto' as CoAuthorModalTab,
    },
    {
      icon: '👥',
      value: utaCoauthorCount,
      label: 'Coautores UTA',
      tab: 'colaboracion' as CoAuthorModalTab,
    },
  ];

  const renderPublications = () => (
    <div className="coauthor-panel">
      <div className="coauthor-panel__head">
        <div>
          <h3 className="coauthor-panel__title">
            Publicaciones indexadas ({filteredWorks.length})
          </h3>
          <p className="coauthor-panel__subtitle">{listScopeLabel}</p>
        </div>
        {allWorks.length > 3 && (
          <div className="coauthor-panel__tools">
            <select
              className="filter-bar__input coauthor-sort"
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
              className="filter-bar__input"
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
              <CoAuthorPublicationCard
                key={w.d || w.t || `${safePage}-${i}`}
                work={w}
                authorHIndex={ca.h_index}
              />
            ))}
          </div>
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </>
      ) : (
        <EmptyWorksMessage
          showLinkingNote={showLinkingNote}
          showGlobal={Boolean(showGlobal)}
        />
      )}
    </div>
  );

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
          <span className="coauthor-hero__badge">COLABORADOR INTERNACIONAL</span>
          <div className="coauthor-hero__top">
            <div className="coauthor-hero__identity">
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
                <ul className="coauthor-hero__institutions">
                  {ca.institutions!.map((inst, i) => (
                    <li key={i}>{inst}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="coauthor-hero__lines">
              <div className="coauthor-hero__lines-title">Líneas de investigación</div>
              <div className="coauthor-hero__chips">
                {(ca.fields || []).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`coauthor-line-chip ${fieldFilter === f ? 'coauthor-line-chip--active' : ''}`}
                    onClick={() => {
                      setFieldFilter((prev) => (prev === f ? '' : f));
                      setActiveTab('publicaciones');
                      setPage(0);
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <AISummaryButton
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
                    <p><strong>Tipo de colaboración:</strong> {data.tipo_colaboracion}</p>
                    <p><strong>Impacto:</strong> {data.impacto_colaboracion}</p>
                    {data.temas_comunes?.length > 0 && (
                      <p><strong>Temas comunes:</strong> {data.temas_comunes.join(' · ')}</p>
                    )}
                  </div>
                )}
              />
            </div>
          </div>
          <p className="coauthor-hero__scope">{METRICS_SCOPE_LABELS[ca.metricsScope || 'collaboration']}</p>
          <div className="coauthor-metrics">
            {metricCards.map((m) => (
              <button
                key={m.label}
                type="button"
                className="coauthor-metric"
                onClick={() => setActiveTab(m.tab)}
                aria-label={`${m.label}: ${m.value}`}
              >
                <span className="coauthor-metric__icon" aria-hidden>
                  {m.icon}
                </span>
                <span className="coauthor-metric__value">{Number(m.value).toLocaleString()}</span>
                <span className="coauthor-metric__label">{m.label}</span>
              </button>
            ))}
          </div>
          <div className="coauthor-hero__links">
            {orcidUrl && (
              <a href={orcidUrl} target="_blank" rel="noopener noreferrer" className="coauthor-hero__link">
                ORCID
              </a>
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
        </header>

        <nav className="coauthor-tabs" role="tablist" aria-label="Secciones del colaborador">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={activeTab === key}
              className={`coauthor-tabs__btn ${activeTab === key ? 'coauthor-tabs__btn--active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              {key === 'publicaciones' ? pubTabLabel : label}
            </button>
          ))}
        </nav>

        <div className="coauthor-body">
          {(activeTab === 'resumen' || activeTab === 'publicaciones') && renderPublications()}

          {activeTab === 'colaboracion' && (
            <div className="coauthor-panel">
              <h3 className="coauthor-panel__title">Colaboración con investigadores UTA</h3>
              <p className="coauthor-panel__subtitle">
                {utaCoauthorCount} investigadores UTA vinculados en publicaciones conjuntas del repositorio local.
              </p>
              {utaLinks.length > 0 ? (
                <ul className="coauthor-uta-list">
                  {utaLinks.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        className="coauthor-uta-list__btn"
                        onClick={() => {
                          if (u.researcher) {
                            setViewCoAuthor(null);
                            openLocalResearcherProfile(u.researcher);
                          }
                        }}
                        disabled={!u.researcher}
                      >
                        {u.name}
                        {!u.researcher && (
                          <span className="coauthor-uta-list__hint"> (sin ficha local)</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="coauthor-panel__empty">No hay coautores UTA identificados en obras locales.</p>
              )}
            </div>
          )}

          {activeTab === 'impacto' && (
            <div className="coauthor-panel">
              <h3 className="coauthor-panel__title">Impacto bibliométrico</h3>
              <div className="coauthor-impact-grid">
                <div className="coauthor-impact-card">
                  <span className="coauthor-impact-card__label">Publicaciones (colaboración UTA)</span>
                  <strong>{(ca.works_count ?? 0).toLocaleString()}</strong>
                </div>
                <div className="coauthor-impact-card">
                  <span className="coauthor-impact-card__label">Citas (colaboración UTA)</span>
                  <strong>{(ca.cited_by_count ?? 0).toLocaleString()}</strong>
                </div>
                <div className="coauthor-impact-card">
                  <span className="coauthor-impact-card__label">H-index (colaboración UTA)</span>
                  <strong>{ca.h_index ?? 0}</strong>
                </div>
              </div>
              {showGlobal && global && (
                <div className="coauthor-global-box">
                  <h4>{METRICS_SCOPE_LABELS.global_openalex}</h4>
                  <p>
                    <strong>{(global.works_count ?? 0).toLocaleString()}</strong> publicaciones ·{' '}
                    <strong>{(global.cited_by_count ?? 0).toLocaleString()}</strong> citas · h-index{' '}
                    <strong>{global.h_index ?? 0}</strong>
                  </p>
                  <p className="coauthor-panel__subtitle">
                    Totales de carrera en OpenAlex; no equivalen al repositorio UTA.
                  </p>
                  {openAlexAuthorUrl && (
                    <a
                      href={openAlexAuthorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="coauthor-hero__link"
                    >
                      Ver autor en OpenAlex →
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'red' && (
            <div className="coauthor-panel">
              <h3 className="coauthor-panel__title">Red de coautoría</h3>
              <p className="coauthor-panel__subtitle">
                Coautores en publicaciones indexadas con la UTA.
              </p>
              {allWorks.length > 0 ? (
                <ul className="coauthor-network-list">
                  {[
                    ...new Set(
                      allWorks.flatMap((w) => (w.a || []).map((n) => n.trim()).filter(Boolean))
                    ),
                  ]
                    .slice(0, 40)
                    .map((name) => (
                      <li key={name}>
                        <span className="coauthor-network-list__name">{name}</span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="coauthor-panel__empty">Sin autores en obras vinculadas.</p>
              )}
            </div>
          )}
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
}: {
  showLinkingNote: boolean;
  showGlobal: boolean;
}) {
  return (
    <div className="coauthor-empty">
      <div className="coauthor-empty__title">{COAUTHOR_EMPTY_LIST_TITLE}</div>
      <p>{COAUTHOR_EMPTY_LIST_MESSAGE}</p>
      {showGlobal && (
        <p>Consulte las métricas globales OpenAlex en la pestaña Impacto.</p>
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
