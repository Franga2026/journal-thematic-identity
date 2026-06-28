import { useMemo, useState, useCallback, useEffect } from 'react';
import { startTransition } from 'react';
import { useLocation } from 'react-router-dom';
import { getAW, enrichWork, buildWorkFacets } from '../../utils/dataProcessing';
import { useUI } from '../../context/UIContext';
import { useTransitionNavigate } from '../../app/hooks/useTransitionNavigate';
import { getProfileRoutePath, shouldSyncProfileRoute } from '../../utils/researcherProfile';
import { getSourceAccess, isAccessLookupLoaded } from '../../services/sources/sourceAccess';
import { typeLabelEs } from '../../utils/constants';
import { sortWorks, type SortKey } from '../../utils/sortWorks';
import { unifiedSearch, type SearchResult } from '../../services/search/unifiedSearch';
import { getColor, getInitials } from '../../utils/helpers';
import WorkCard from '../cards/WorkCard';
import { Pagination, EmptyState } from '../common/UIComponents';

const PAGE_SIZE = 15;

/* ─── Tipos locales ─── */
interface FacetItem {
  count: number;
  /** Valor crudo que va al filtro (p. ej. 'article', 'open', 'Q1'). */
  value: string;
  /** Texto visible; si falta, se usa value. */
  label?: string;
  /** Alias legacy de buildWorkFacets / facetas locales. */
  name?: string;
}

function facetValue(item: FacetItem): string {
  return item.value ?? item.name ?? '';
}

function facetLabel(item: FacetItem): string {
  return item.label ?? item.name ?? item.value ?? '';
}

/* ─── Componente de faceta compacta ─── */
function Facet({
  title, items, selected, onSelect, limit = 6,
}: {
  title: string; items: FacetItem[]; selected: string;
  onSelect: (v: string) => void; limit?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, limit);
  const max = items[0]?.count || 1;
  if (!items.length) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </div>
      {visible.map((item) => {
        const value = facetValue(item);
        const active = selected === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onSelect(active ? '' : value)}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              width: '100%', padding: '5px 8px', fontSize: 11, border: 'none',
              background: active ? 'var(--blue-100)' : 'transparent',
              color: active ? 'var(--blue-800)' : 'var(--gray-700)',
              fontWeight: active ? 700 : 400, cursor: 'pointer', borderRadius: 4,
              marginBottom: 1, position: 'relative',
            }}
          >
            <span style={{ zIndex: 1, position: 'relative' }}>{facetLabel(item)}</span>
            <span style={{ zIndex: 1, position: 'relative', fontWeight: 600, fontSize: 10 }}>{item.count.toLocaleString()}</span>
            <span style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${Math.max(4, (item.count / max) * 100)}%`,
              background: active ? 'var(--blue-200)' : 'var(--gray-100)',
              borderRadius: 4, transition: 'width 0.3s',
            }} />
          </button>
        );
      })}
      {items.length > limit && (
        <button
          type="button" onClick={() => setExpanded(!expanded)}
          style={{ fontSize: 10, color: 'var(--blue-700)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
        >
          {expanded ? '▲ Menos' : `▼ +${items.length - limit} más`}
        </button>
      )}
    </div>
  );
}

/* ─── Componente principal ─── */
export default function TabDescubridor() {
  const navigate = useTransitionNavigate();
  const location = useLocation();
  const {
    search,
    setSearch,
    resolveResearcherProfile,
    descubridorQuartile,
    setDescubridorQuartile,
    descubridorAccess,
    setDescubridorAccess,
  } = useUI();

  const handleOpenResearcher = useCallback(
    (profileId: string) => {
      const id = profileId.trim();
      if (!id) return;
      startTransition(() => {
        resolveResearcherProfile(id);
        if (shouldSyncProfileRoute(location.pathname)) {
          navigate(getProfileRoutePath(id));
        }
      });
    },
    [resolveResearcherProfile, navigate, location.pathname],
  );

  const AW = getAW();
  const totalWorks = (AW || []).length;

  // ─── Estado de búsqueda ───
  const [year, setYear] = useState('');
  const [type, setType] = useState('');
  const [field, setField] = useState('');
  const [sdg, setSdg] = useState('');
  const quartile = descubridorQuartile;
  const setQuartile = setDescubridorQuartile;
  const access = descubridorAccess;
  const setAccess = setDescubridorAccess;
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<SortKey>('citations');
  const [lookupReady, setLookupReady] = useState(isAccessLookupLoaded());

  useEffect(() => {
    const check = setInterval(() => {
      if (isAccessLookupLoaded()) { setLookupReady(true); clearInterval(check); }
    }, 500);
    return () => clearInterval(check);
  }, []);

  const resetPage = useCallback(() => setPage(0), []);

  useEffect(() => {
    setPage(0);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [sortBy]);

  const hasFilters = Boolean(search.trim() || year || type || access || field || quartile || sdg);

  const clearAll = useCallback(() => {
    setSearch('');
    setYear('');
    setType('');
    setAccess('');
    setField('');
    setQuartile('');
    setSdg('');
    setPage(0);
  }, [setSearch, setAccess, setQuartile]);

  // ─── Filtrado ───
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (AW || []).filter((w) => {
      const mt = !q ||
        (w.t || '').toLowerCase().includes(q) ||
        (w.a || []).some((a: string) => a.toLowerCase().includes(q)) ||
        (w.s || '').toLowerCase().includes(q) ||
        (w.d || '').toLowerCase().includes(q) ||
        String(w.cr_issn || '').toLowerCase().includes(q) ||
        String(w.up_issn || '').toLowerCase().includes(q);
      const my = !year || String(w.y) === year;
      const mtp = !type || w.tp === type;
      const moa = !access ||
        (access === 'open' ? Boolean(w.oa) : access === 'closed' ? !w.oa : true);
      const mf = !field || w.field === field || w.topic === field;
      const mq = !quartile || w.qi === quartile;
      const ms = !sdg || (w.sdgs && w.sdgs.some((s: string) => s === sdg));
      return mt && my && mtp && moa && mf && mq && ms;
    });
  }, [AW, search, year, type, access, field, quartile, sdg]);

  const sorted = useMemo(() => sortWorks(filtered, sortBy), [filtered, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageData = useMemo(
    () => sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(enrichWork),
    [sorted, page]
  );

  // ─── Facetas (calculadas sobre los resultados cruzados) ───
  const facets = useMemo(() => buildWorkFacets(
    year ? filtered : (AW || []) // Para años, mostrar todos si no hay filtro de año
  ), [AW, filtered, year]);

  // Faceta de cuartil
  const quartileFacets = useMemo(() => {
    const qc: Record<string, number> = {};
    const base = quartile ? filtered : (AW || []);
    base.forEach((w) => { if (w.qi) qc[w.qi] = (qc[w.qi] || 0) + 1; });
    return Object.entries(qc)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        const order = ['Q1', 'Q2', 'Q3', 'Q4'];
        return order.indexOf(a.name) - order.indexOf(b.name);
      });
  }, [AW, filtered, quartile]);

  // Faceta ODS
  const sdgFacets = useMemo(() => {
    const sc: Record<string, number> = {};
    const base = sdg ? filtered : (AW || []);
    base.forEach((w) => { (w.sdgs || []).forEach((s: string) => { sc[s] = (sc[s] || 0) + 1; }); });
    return Object.entries(sc)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [AW, filtered, sdg]);

  // ─── Stats rápidos del resultado ───
  const resultStats = useMemo(() => {
    const oa = filtered.filter((w) => w.oa).length;
    const q1 = filtered.filter((w) => w.qi === 'Q1').length;
    const cites = filtered.reduce((s, w) => s + (w.c || 0), 0);
    let sdAccess = 0;
    if (lookupReady) {
      filtered.forEach((w) => {
        if (getSourceAccess(w.s) !== 'none') sdAccess++;
      });
    }
    return { oa, q1, cites, sdAccess };
  }, [filtered, lookupReady]);

  const uni = useMemo(
    () => (search.trim() ? unifiedSearch(search) : []),
    [search],
  );
  const unifiedResearchers = useMemo(
    () => uni.filter((r): r is Extract<SearchResult, { kind: 'researcher' }> => r.kind === 'researcher'),
    [uni],
  );
  const unifiedJournals = useMemo(
    () => uni.filter((r): r is Extract<SearchResult, { kind: 'journal' }> => r.kind === 'journal'),
    [uni],
  );

  const handleJournalClick = useCallback(
    (title: string) => {
      setSearch(title);
      resetPage();
    },
    [setSearch, resetPage],
  );

  const showEmptyState =
    filtered.length === 0 && unifiedResearchers.length === 0 && unifiedJournals.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* ─── Header ─── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', margin: '0 0 4px' }}>
          🔍 Descubridor — Producción Científica UTA
        </h2>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: 0 }}>
          {totalWorks.toLocaleString()} publicaciones · Búsqueda por título, autor, revista, DOI ·
          Acceso vinculado a suscripciones Elsevier KBART
        </p>
      </div>

      {/* ─── Barra de búsqueda ─── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            placeholder="Buscar por título, autor, revista o DOI…"
            style={{
              flex: 1, padding: '12px 16px', fontSize: 15,
              border: '2px solid var(--blue-300)', borderRadius: 10,
              outline: 'none', transition: 'border-color 0.2s',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'var(--blue-600)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'var(--blue-300)'; }}
          />
          {hasFilters && (
            <button onClick={clearAll} className="btn btn--ghost" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
              ✕ Limpiar
            </button>
          )}
        </div>
        <div style={{
          marginTop: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
            <strong style={{ color: 'var(--blue-800)' }}>{filtered.length.toLocaleString()}</strong> resultados
            {filtered.length !== totalWorks && (
              <span> de {totalWorks.toLocaleString()} publicaciones</span>
            )}
          </div>
          <div className="descubridor__sort">
            <label htmlFor="descubridor-sort" className="descubridor__sort-label">Ordenar por</label>
            <select
              id="descubridor-sort"
              className="descubridor__sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
            >
              <option value="citations">Más citadas</option>
              <option value="fwci">Mayor FWCI</option>
              <option value="year">Año (recientes)</option>
              <option value="relevance">Relevancia</option>
            </select>
          </div>
        </div>
      </div>

      {/* ─── KPIs rápidos ─── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { v: filtered.length, l: 'Resultados', c: 'var(--blue-800)' },
          { v: resultStats.oa, l: 'Open Access', c: 'var(--green-600)' },
          { v: resultStats.q1, l: 'En Q1', c: 'var(--red-600)' },
          { v: resultStats.cites, l: 'Citas totales', c: '#7c3aed' },
          { v: resultStats.sdAccess, l: 'En ScienceDirect', c: '#1e40af' },
        ].map((m) => (
          <div key={m.l} style={{
            flex: '1 1 120px', padding: '10px 14px', background: 'var(--gray-50)',
            borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: m.c }}>{m.v.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: 'var(--gray-500)' }}>{m.l}</div>
          </div>
        ))}
      </div>

      {/* ─── Layout: Facetas + Resultados ─── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* Facetas */}
        <aside style={{
          width: 220, flexShrink: 0, position: 'sticky', top: 10,
          maxHeight: 'calc(100vh - 80px)', overflowY: 'auto',
          padding: '12px 0',
        }}>
          <Facet
            title="Año"
            items={facets.years.slice(0, 20).map((y) => ({
              value: y.name,
              count: y.count,
            }))}
            selected={year}
            onSelect={(v) => { setYear(v); resetPage(); }}
          />
          <Facet
            title="Cuartil"
            items={quartileFacets.filter((q) => q.count > 0).map((q) => ({
              value: q.name,
              label: q.name,
              count: q.count,
            }))}
            selected={quartile}
            onSelect={(v) => { setQuartile(v); resetPage(); }}
            limit={4}
          />
          <Facet
            title="Tipo"
            items={facets.types.filter((t) => t.count > 0).map((t) => ({
              value: t.name,
              label: typeLabelEs(t.name),
              count: t.count,
            }))}
            selected={type}
            onSelect={(v) => { setType(v); resetPage(); }}
          />
          <Facet
            title="Acceso"
            items={facets.access.filter((a) => a.count > 0).map((a) => ({
              value: a.name,
              label: a.name === 'open' ? 'Open Access' : 'Cerrado',
              count: a.count,
            }))}
            selected={access}
            onSelect={(v) => { setAccess(v); resetPage(); }}
            limit={2}
          />
          <Facet
            title="Área temática"
            items={facets.topics.map((t) => ({
              value: t.name,
              count: t.count,
            }))}
            selected={field}
            onSelect={(v) => { setField(v); resetPage(); }}
          />
          {sdgFacets.length > 0 && (
            <Facet
              title="ODS"
              items={sdgFacets.map((s) => ({
                value: s.name,
                count: s.count,
              }))}
              selected={sdg}
              onSelect={(v) => { setSdg(v); resetPage(); }}
            />
          )}
        </aside>

        {/* Resultados */}
        <main style={{ flex: 1, minWidth: 0 }}>
          {showEmptyState ? (
            <EmptyState
              icon="🔍"
              title="Sin resultados"
              message="Prueba con otros términos de búsqueda o ajusta los filtros."
            />
          ) : (
            <>
              {search.trim() && unifiedResearchers.length > 0 && (
                <section className="descubridor-mixed" aria-label="Investigadores">
                  <h3 className="descubridor-mixed__heading">
                    Investigadores ({unifiedResearchers.length})
                  </h3>
                  <div className="descubridor-mixed__list">
                    {unifiedResearchers.map((r) => {
                      const initials = getInitials(r.raw.f, r.raw.l);
                      const avatarColor = getColor(r.name);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          className="descubridor-mixed__row descubridor-mixed__row--researcher"
                          onClick={() => handleOpenResearcher(r.orcid || r.id)}
                        >
                          <span
                            className="descubridor-mixed__avatar"
                            style={{ background: avatarColor }}
                            aria-hidden
                          >
                            {initials}
                          </span>
                          <span className="descubridor-mixed__content">
                            <span className="descubridor-mixed__topline">
                              <span className="descubridor-mixed__badge descubridor-mixed__badge--researcher">
                                INVESTIGADOR
                              </span>
                              <span className="descubridor-mixed__title">{r.name}</span>
                            </span>
                            <span className="descubridor-mixed__subtitle">{r.subtitle}</span>
                          </span>
                          {r.hIndex != null && (
                            <span className="descubridor-mixed__meta">
                              h-index {r.hIndex}
                            </span>
                          )}
                          <span className="descubridor-mixed__arrow" aria-hidden>↗</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {search.trim() && unifiedJournals.length > 0 && (
                <section className="descubridor-mixed" aria-label="Revistas">
                  <h3 className="descubridor-mixed__heading">
                    Revistas ({unifiedJournals.length})
                  </h3>
                  <div className="descubridor-mixed__list">
                    {unifiedJournals.map((j) => (
                      <button
                        key={j.id}
                        type="button"
                        className="descubridor-mixed__row descubridor-mixed__row--journal"
                        onClick={() => handleJournalClick(j.title)}
                      >
                        <span className="descubridor-mixed__content">
                          <span className="descubridor-mixed__topline">
                            <span className="descubridor-mixed__badge descubridor-mixed__badge--journal">
                              REVISTA
                            </span>
                            <span className="descubridor-mixed__title">{j.title}</span>
                          </span>
                          <span className="descubridor-mixed__subtitle">
                            {j.issn ? `ISSN ${j.issn}` : 'Sin ISSN'}
                            {j.qi ? ` · ${j.qi}` : ''}
                            {j.raw.workCount > 0
                              ? ` · ${j.raw.workCount.toLocaleString()} obras`
                              : ''}
                          </span>
                        </span>
                        <span className="descubridor-mixed__arrow" aria-hidden>↗</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {filtered.length > 0 && (
                <section className="descubridor-mixed descubridor-mixed--works" aria-label="Publicaciones">
                  <h3 className="descubridor-mixed__heading">
                    Publicaciones ({filtered.length.toLocaleString()})
                  </h3>
                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>
                    {pageData.map((w, i) => (
                      <WorkCard key={`${w.d || ''}-${w.y || ''}-${i}`} w={w} variant="discovery" onOpenResearcher={handleOpenResearcher} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          <div style={{ marginTop: 16 }}>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </main>
      </div>

      {/* ─── Footer ─── */}
      <div style={{
        marginTop: 24, padding: 16, background: 'var(--gray-100)',
        borderRadius: 8, fontSize: 11, color: 'var(--gray-500)', textAlign: 'center',
      }}>
        Descubridor Bibliográfico · CRIS UTA · Datos: OpenAlex + Elsevier KBART ·
        {totalWorks.toLocaleString()} publicaciones · 52,695 fuentes con nivel de acceso ·
        {new Date().toLocaleDateString('es-CL')}
      </div>
    </div>
  );
}
