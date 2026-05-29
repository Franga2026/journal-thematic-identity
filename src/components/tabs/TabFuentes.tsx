import { useMemo, useState, useEffect } from 'react';
import { KPI, BarChart, Donut, Badge, Pagination, Loading, EmptyState } from '../common/UIComponents';
import { COLORS } from '../../utils/constants';
import type { KBData } from '../../shared/types/sources';

const KB: KBData = {
  stats: {
    total_raw_records: 110354,
    total_unique_sources: 95180,
    dedup_merges: 15174,
    dedup_rate: 13.8,
    journals: 44087,
    ebooks: 51093,
    fulltext_access: 57539,
    indexed_only: 37640,
    open_access: 2317,
    multi_collection: 5452,
    top_publishers: [
      ['Academic Press', 20443], ['Elsevier', 16192], ['Pergamon', 4436],
      ['Butterworth-Heinemann', 3267], ['Woodhead Publishing', 2612],
      ['Elsevier Masson', 1316], ['Taylor and Francis', 1127],
      ['Springer Verlag', 1037], ['W.B. Saunders', 1001],
      ['North-Holland', 882], ['Urban and Fischer', 866],
      ['Morgan Kaufmann', 794], ['Elsevier (discontinued)', 664],
      ['Blackwell Publishing Inc.', 656], ['Chandos Publishing', 606],
    ],
    collections: [
      { collection_name: 'SCOPUS', records: 41513, depths: { indexed: 41513 }, date_range: [1817, 2086] },
      { collection_name: 'ScienceDirect All Books', records: 51398, depths: { ebook: 51139, fulltext: 259 }, date_range: [1618, 2026] },
      { collection_name: 'Elsevier ScienceDirect Journals', records: 7423, depths: { fulltext: 7362, ebook: 53, print: 6, abstracts: 2 }, date_range: [1823, 2026] },
      { collection_name: 'ScienceDirect - Freedom Collection ( All )', records: 3348, depths: { fulltext: 3338, ebook: 9, indexed: 1 }, date_range: [1994, 2026] },
      { collection_name: 'ScienceDirect Journals - Freedom Collection', records: 3321, depths: { fulltext: 3321 }, date_range: [1994, 2026] },
      { collection_name: 'Elsevier ScienceDirect Open Access Journals', records: 2507, depths: { fulltext: 2507 }, date_range: [1905, 2026] },
      { collection_name: 'Elsevier ScienceDirect Open Access and Open Archive Journals', records: 719, depths: { fulltext: 719 }, date_range: [1905, 2020] },
      { collection_name: 'Elsevier ScienceDirect Open Access eBooks', records: 49, depths: { ebook: 49 }, date_range: [1618, 2026] },
      { collection_name: 'ScienceDirect eBook - Spanish Medical Collection 2014', records: 27, depths: { ebook: 27 }, date_range: [2013, 2015] },
    ],
  },
  coverage_gap: {
    total_gap: 37640,
    gap_pct: 39.5,
    gap_by_publisher: [
      ['Taylor and Francis', 1127], ['Springer Verlag', 1037],
      ['Blackwell Publishing Inc.', 656], ['SAGE Publications', 515],
      ['Emerald Group Publishing Ltd.', 467], ['John Wiley and Sons Inc.', 460],
      ['Taylor and Francis Ltd.', 455], ['Kluwer Academic Publishers', 427],
      ['Wiley-Blackwell', 412], ['Cambridge University Press', 391],
      ['Oxford University Press', 380], ['Routledge', 333],
    ],
  },
  collection_overlap: {
    overlaps: [
      { collection_a: 'Elsevier ScienceDirect Journals', collection_b: 'SCOPUS', shared_sources: 3529, pct_of_a: 62.3, pct_of_b: 8.5 },
      { collection_a: 'ScienceDirect - Freedom Collection ( All )', collection_b: 'Elsevier ScienceDirect Journals', shared_sources: 2270, pct_of_a: 96.0, pct_of_b: 40.0 },
      { collection_a: 'Elsevier ScienceDirect Open Access Journals', collection_b: 'Elsevier ScienceDirect Journals', shared_sources: 2154, pct_of_a: 98.9, pct_of_b: 38.0 },
      { collection_a: 'ScienceDirect - Freedom Collection ( All )', collection_b: 'SCOPUS', shared_sources: 1852, pct_of_a: 78.3, pct_of_b: 4.5 },
      { collection_a: 'ScienceDirect - Freedom Collection ( All )', collection_b: 'ScienceDirect Journals - Freedom Collection', shared_sources: 1779, pct_of_a: 75.2, pct_of_b: 73.7 },
      { collection_a: 'Elsevier ScienceDirect Journals', collection_b: 'ScienceDirect Journals - Freedom Collection', shared_sources: 1774, pct_of_a: 31.3, pct_of_b: 73.5 },
      { collection_a: 'SCOPUS', collection_b: 'ScienceDirect Journals - Freedom Collection', shared_sources: 1524, pct_of_a: 3.7, pct_of_b: 63.1 },
      { collection_a: 'Elsevier ScienceDirect Open Access Journals', collection_b: 'SCOPUS', shared_sources: 919, pct_of_a: 42.2, pct_of_b: 2.2 },
    ],
  },
};

interface OAEntry {
  t: string;
  url: string;
  issn: string | null;
  pub: string;
  yr: number | null;
  ebook: boolean;
}

function trunc(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function formatDateRange(range: [number | null, number | null]): string {
  const [from, to] = range;
  if (from == null && to == null) return '—';
  if (from != null && to != null) return `${from}–${to}`;
  return String(from ?? to);
}

function CollectionAccessBadges({ depths }: { depths: Record<string, number> }) {
  const hasFulltext = Boolean(depths.fulltext);
  const hasEbook = Boolean(depths.ebook);
  const indexedOnly = Boolean(depths.indexed) && !hasFulltext && !hasEbook;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {hasFulltext && <Badge bg="var(--green-600)" color="#fff" small>fulltext</Badge>}
      {hasEbook && <Badge bg="var(--blue-700)" color="#fff" small>ebook</Badge>}
      {indexedOnly && <Badge bg="var(--gray-400)" color="#fff" small>indexed</Badge>}
    </div>
  );
}

export default function TabFuentes() {
  const { stats, coverage_gap, collection_overlap } = KB;

  const fulltextPct = useMemo(
    () => Number(((stats.fulltext_access / stats.total_unique_sources) * 100).toFixed(1)),
    [stats.fulltext_access, stats.total_unique_sources]
  );

  const journalsFulltext = useMemo(
    () => Math.max(0, stats.fulltext_access - stats.ebooks),
    [stats.fulltext_access, stats.ebooks]
  );

  const gapMax = coverage_gap.gap_by_publisher[0]?.[1] ?? 1;
  const publisherMax = stats.top_publishers[0]?.[1] ?? 1;
  const today = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

  // ─── Catálogo OA ───
  const [oaCatalog, setOaCatalog] = useState<OAEntry[]>([]);
  const [oaLoading, setOaLoading] = useState(true);
  const [oaSearch, setOaSearch] = useState('');
  const [oaType, setOaType] = useState<'all' | 'journal' | 'ebook'>('all');
  const [oaPage, setOaPage] = useState(0);
  const OA_PAGE_SIZE = 20;

  useEffect(() => {
    fetch('/data/oa_catalog.json')
      .then((r) => r.json())
      .then((data) => {
        setOaCatalog(data.oa || []);
        setOaLoading(false);
      })
      .catch(() => setOaLoading(false));
  }, []);

  const oaJournalCount = useMemo(() => oaCatalog.filter((s) => !s.ebook).length, [oaCatalog]);
  const oaEbookCount = useMemo(() => oaCatalog.filter((s) => s.ebook).length, [oaCatalog]);

  const oaFiltered = useMemo(() => {
    let results = oaCatalog;
    if (oaType === 'journal') results = results.filter((s) => !s.ebook);
    if (oaType === 'ebook') results = results.filter((s) => s.ebook);
    if (oaSearch.trim()) {
      const q = oaSearch.toLowerCase();
      results = results.filter(
        (s) =>
          s.t.toLowerCase().includes(q) ||
          (s.issn && s.issn.includes(q)) ||
          (s.pub && s.pub.toLowerCase().includes(q))
      );
    }
    return results;
  }, [oaCatalog, oaSearch, oaType]);

  const oaTotalPages = Math.max(1, Math.ceil(oaFiltered.length / OA_PAGE_SIZE));
  const oaPageData = oaFiltered.slice(oaPage * OA_PAGE_SIZE, (oaPage + 1) * OA_PAGE_SIZE);

  return (
    <>
      {/* Sección 1 — Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', margin: '0 0 4px' }}>
          Knowledge Base — Fuentes Bibliográficas
        </h2>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: 0 }}>
          Suscripciones institucionales · Elsevier KBART · 95,180 fuentes únicas
        </p>
      </div>

      {/* Sección 2 — KPIs */}
      <div className="grid grid--auto-fit" style={{ gap: 12, marginBottom: 24 }}>
        <KPI value={stats.total_unique_sources} label="Fuentes únicas" color="var(--blue-800)" />
        <KPI value={stats.journals} label="Revistas" color="var(--blue-700)" />
        <KPI value={stats.ebooks} label="eBooks" color="#7c3aed" />
        <KPI value={stats.fulltext_access} label="Texto completo" color="var(--green-600)" />
        <KPI value={stats.indexed_only} label="Solo indexado" color="var(--red-600)" />
        <KPI value={stats.open_access} label="Open Access" color="#ea580c" />
      </div>

      {/* Sección 3 — Mapa de cobertura */}
      <div className="card card--elevated" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--blue-800)', marginBottom: 16 }}>
          Mapa de Cobertura
        </div>
        <div className="grid grid--2col" style={{ gap: 24, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Donut pct={fulltextPct} color="var(--green-600)" size={120} stroke={10} />
              <div style={{
                position: 'absolute', fontSize: 22, fontWeight: 700, color: 'var(--green-600)',
              }}>
                {fulltextPct}%
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--gray-600)', textAlign: 'center' }}>
              {fulltextPct}% con texto completo · {coverage_gap.gap_pct}% solo indexado
            </div>
          </div>
          <div>
            <BarChart
              value={journalsFulltext}
              max={stats.total_unique_sources}
              color="var(--blue-700)"
              label="Revistas con fulltext"
            />
            <BarChart
              value={stats.ebooks}
              max={stats.total_unique_sources}
              color="#7c3aed"
              label="eBooks"
            />
            <BarChart
              value={stats.indexed_only}
              max={stats.total_unique_sources}
              color="var(--red-600)"
              label="Solo indexado (Scopus)"
            />
          </div>
        </div>
      </div>

      {/* Sección 4 — Brecha de acceso */}
      <div className="card card--elevated" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-900)' }}>⚠️ Brecha de Cobertura</div>
          <Badge bg="var(--red-600)" color="#fff">{coverage_gap.gap_pct}%</Badge>
        </div>
        <p style={{ fontSize: 12, color: 'var(--gray-500)', margin: '0 0 16px' }}>
          {coverage_gap.total_gap.toLocaleString()} fuentes indexadas en Scopus sin suscripción a texto completo
        </p>
        {coverage_gap.gap_by_publisher.map(([name, count], i) => (
          <BarChart
            key={i}
            value={count}
            max={gapMax}
            color="var(--red-600)"
            label={name}
            height={12}
          />
        ))}
      </div>

      {/* Sección 5 — Colecciones */}
      <div className="card card--elevated" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--blue-800)', marginBottom: 16 }}>
          📚 Colecciones Institucionales
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr style={{ background: 'var(--blue-800)' }}>
                <th style={{ color: '#fff' }}>Colección</th>
                <th style={{ color: '#fff', textAlign: 'right' }}>Registros</th>
                <th style={{ color: '#fff' }}>Acceso</th>
                <th style={{ color: '#fff', textAlign: 'center' }}>Rango</th>
              </tr>
            </thead>
            <tbody>
              {stats.collections.map((col, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500, color: 'var(--gray-700)', maxWidth: 320 }}>{col.collection_name}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--blue-800)' }}>
                    {col.records.toLocaleString()}
                  </td>
                  <td><CollectionAccessBadges depths={col.depths} /></td>
                  <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--gray-600)' }}>
                    {formatDateRange(col.date_range)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sección 6 — Solapamiento */}
      <div className="card card--elevated" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--blue-800)', marginBottom: 16 }}>
          🔗 Solapamiento entre Colecciones
        </div>
        {collection_overlap.overlaps.map((ov, i) => (
          <div
            key={i}
            style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
              padding: '10px 0', borderBottom: i < collection_overlap.overlaps.length - 1 ? '1px solid var(--border-light)' : undefined,
              fontSize: 12,
            }}
          >
            <span style={{ fontWeight: 500, color: 'var(--gray-700)' }} title={ov.collection_a}>
              {trunc(ov.collection_a, 35)}
            </span>
            <span style={{ color: 'var(--gray-400)', fontWeight: 700 }}>∩</span>
            <span style={{ fontWeight: 500, color: 'var(--gray-700)' }} title={ov.collection_b}>
              {trunc(ov.collection_b, 35)}
            </span>
            <Badge bg="var(--blue-100)" color="var(--blue-800)" small>
              {ov.shared_sources.toLocaleString()} fuentes
            </Badge>
            <Badge bg="var(--gray-100)" color="var(--gray-600)" small>
              {ov.pct_of_a}% de A
            </Badge>
            <Badge bg="var(--gray-100)" color="var(--gray-600)" small>
              {ov.pct_of_b}% de B
            </Badge>
          </div>
        ))}
      </div>

      {/* Sección 7 — Top Publishers */}
      <div className="card card--elevated" style={{ padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--blue-800)', marginBottom: 16 }}>
          🏢 Publishers (normalizados)
        </div>
        {stats.top_publishers.map(([name, count], i) => (
          <BarChart
            key={i}
            value={count}
            max={publisherMax}
            color={COLORS[i % COLORS.length]}
            label={name}
            height={12}
          />
        ))}
      </div>

      {/* Sección 8 — Catálogo OA */}
      <div className="card card--elevated" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--green-600)', margin: '0 0 4px' }}>
              🔓 Catálogo de Acceso Abierto
            </h3>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', margin: 0 }}>
              {oaCatalog.length.toLocaleString()} revistas y ebooks con acceso libre — clic directo a ScienceDirect
            </p>
          </div>
          <div className="btn-group">
            {([
              { key: 'all' as const, label: `Todas (${oaCatalog.length})` },
              { key: 'journal' as const, label: `Revistas (${oaJournalCount})` },
              { key: 'ebook' as const, label: `eBooks (${oaEbookCount})` },
            ]).map(({ key, label }) => (
              <button
                key={key}
                className={`btn ${oaType === key ? 'btn--primary' : 'btn--ghost'}`}
                style={{ fontSize: 11 }}
                onClick={() => { setOaType(key); setOaPage(0); }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <input
          type="search"
          value={oaSearch}
          onChange={(e) => { setOaSearch(e.target.value); setOaPage(0); }}
          placeholder="Buscar por título, ISSN o editorial…"
          style={{
            width: '100%', padding: '10px 14px', fontSize: 13,
            border: '1px solid var(--border)', borderRadius: 8,
            marginBottom: 12, outline: 'none', boxSizing: 'border-box',
          }}
        />

        <p style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 12 }}>
          <strong>{oaFiltered.length.toLocaleString()}</strong> resultados
        </p>

        {oaLoading ? (
          <Loading message="Cargando catálogo OA…" />
        ) : oaFiltered.length === 0 ? (
          <EmptyState icon="🔍" title="Sin resultados" message="No se encontraron fuentes con ese criterio." />
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
            {oaPageData.map((entry, i) => (
              <a
                key={entry.url + i}
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: i < oaPageData.length - 1 ? '1px solid var(--border)' : 'none',
                  textDecoration: 'none', color: 'inherit', transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--blue-50, #eff6ff)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--blue-800)' }}>
                    {entry.ebook ? '📚' : '📖'} {entry.t}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>
                    {[entry.pub, entry.issn, entry.yr ? `desde ${entry.yr}` : null].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span
                    className="badge badge--sm"
                    style={{
                      background: entry.ebook ? '#7c3aed' : 'var(--green-600)',
                      color: '#fff',
                    }}
                  >
                    {entry.ebook ? 'eBook' : 'OA Journal'}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--blue-700)', fontWeight: 600 }}>
                    Abrir →
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <Pagination page={oaPage} totalPages={oaTotalPages} onPageChange={setOaPage} />
        </div>
      </div>

      {/* Sección 9 — Footer metodológico */}
      <div style={{ background: 'linear-gradient(135deg,var(--blue-900),var(--blue-800))', borderRadius: 10, padding: 20, color: '#fff' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          📋 Metodología
        </div>
        <div style={{ fontSize: 11, opacity: 0.9, lineHeight: 1.6 }}>
          Datos procesados desde 10 archivos KBART de Elsevier · 110,354 registros originales ·
          Deduplicación por ISSN/ISBN: {stats.dedup_rate}% · Publishers normalizados (15 variantes de Elsevier → 1) ·
          Cobertura: fulltext, ebook, indexed, abstracts · Fuente: OCLC WorldCat KB + Elsevier KBART
        </div>
      </div>

      {/* Sección 10 — Fuente */}
      <div style={{ marginTop: 20, fontSize: 11, color: 'var(--gray-500)', textAlign: 'center' }}>
        Knowledge Base · CRIS UTA · Datos: Elsevier KBART · {today}
      </div>
    </>
  );
}
