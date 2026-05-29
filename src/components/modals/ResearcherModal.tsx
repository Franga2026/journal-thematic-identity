import { useMemo, useCallback } from 'react';
import { startTransition } from 'react';
import { useLocation } from 'react-router-dom';
import { useTransitionNavigate } from '../../app/hooks/useTransitionNavigate';
import { useOpenResearcherProfile } from '../../app/hooks/useOpenResearcherProfile';
import { useApp } from '../../context/AppContext';
import {
  getAuthorOA,
  getOrcidProfile,
  getMetrics,
  getResMetrics,
  getData,
  getAI,
  getAuthorsOA,
  getResearcherOpenAlexUrl,
} from '../../utils/dataProcessing';
import { getOrcidRecordUrl, shouldSyncProfileRoute } from '../../utils/researcherProfile';
import { getCoAuthorClickTarget, isCoAuthorClickable } from '../../utils/coAuthorProfileResolver';
import type { CoAuthorRef } from '../../shared/types';
import { cleanOrcid, getColor, getInitials } from '../../utils/helpers';
import { SDG_ES } from '../../utils/constants';
import { downloadMetricReport } from '../../utils/reportGenerator';
import ResearcherAreasSection from '../researcher/ResearcherAreasSection';
import ResearcherPublicationsSection from '../researcher/ResearcherPublicationsSection';
import OpenAlexResearcherProfile from './OpenAlexResearcherProfile';
import AISummaryButton from '../ai/AISummaryButton';
import { analyzeResearcher } from '../../api/aiApi';
import type { ResearcherAnalysisStructured } from '../../services/ai/types';
import type { MetricKey } from '../../shared/types';

// ─── Metric definitions factory ───
function buildMetricDefs(oa, rm, rdist, METRICS) {
  const qp = rm.quartile_profile || {};
  const oaRate = rm.oa_rate || 0;
  const utaFNCI = METRICS.fwci || 0.941;

  return {
    h_index: { name: 'h-index', val: oa.h_index || rm.h_index || 0, dist: rdist.h_index, color: '#1e5a78',
      desc: 'El h-index indica un balance entre productividad e impacto de citación. Un h-index de N significa N publicaciones con al menos N citas cada una.',
      calc: 'Se ordenan las publicaciones por citas (descendente). El h-index es el mayor valor h tal que h publicaciones tienen ≥h citas.',
      interpret: v => v >= 20 ? 'Excelente trayectoria con producción e impacto sostenido.' : v >= 10 ? 'Trayectoria consolidada.' : v >= 5 ? 'Investigador en desarrollo.' : 'Etapa temprana o producción aún no ampliamente citada.' },
    fwci: { name: 'FNCI', val: rm.fwci || 0, dist: rdist.fwci, color: rm.fwci >= 1 ? '#22c55e' : '#ef4444',
      desc: `Mide impacto de citación vs promedio mundial por disciplina, año y tipo. FNCI = 1.0 = promedio mundial. UTA = ${utaFNCI}.`,
      calc: `FNCI = (1/N) × Σ(citas_i / citas_esperadas_i). Mundo = 1.0. UTA = ${utaFNCI}.`,
      interpret: v => {
        const pW = ((v - 1) * 100).toFixed(1);
        if (v === 0) return '⚠️ FNCI = 0: Sin citas esperadas calculables.';
        if (v >= 2) return `🏆 Excelente: FNCI ${v} — +${pW}% vs mundo. Más del doble del promedio.`;
        if (v >= 1) return `🟢 Sobre promedio mundial: FNCI ${v} — +${pW}% vs mundo.`;
        if (v >= 0.8) return `🟡 Ligeramente bajo: FNCI ${v} — ${pW}% vs mundo. Margen de mejora.`;
        return `🔴 Bajo promedio: FNCI ${v} — ${pW}% vs mundo.`;
      } },
    cpp: { name: 'Citas/Pub', val: oa.works_count > 0 ? +((oa.cited_by_count || 0) / oa.works_count).toFixed(2) : 0, dist: rdist.citations_per_pub, color: '#7c3aed',
      desc: 'Promedio de citas por publicación. No normaliza por disciplina.',
      calc: 'CPP = Total de citas ÷ Total de publicaciones',
      interpret: v => v >= 20 ? 'Muy alto promedio de citas.' : v >= 10 ? 'Buena visibilidad.' : v >= 5 ? 'Promedio moderado.' : 'Promedio bajo — puede reflejar publicaciones recientes.' },
    output: { name: 'Scholarly Output', val: oa.works_count || rm.scholarly_output || 0, dist: rdist.scholarly_output, color: '#1e3a8a',
      desc: "Total de publicaciones indexadas. 'Power Metric' que aumenta con tamaño.",
      calc: 'Cuenta de publicaciones indexadas.',
      interpret: v => v >= 100 ? 'Producción muy alta.' : v >= 50 ? 'Producción sustancial.' : v >= 20 ? 'Producción activa.' : 'Producción moderada.' },
    cites: { name: 'Citation Count', val: oa.cited_by_count || rm.citation_count || 0, dist: null, color: '#dc2626',
      desc: "Total de citas recibidas. 'Power Metric' de visibilidad acumulada.",
      calc: 'Suma de todas las citas recibidas.',
      interpret: v => v >= 1000 ? 'Visibilidad excepcional.' : v >= 200 ? 'Buena visibilidad.' : v >= 50 ? 'Visibilidad en desarrollo.' : 'Visibilidad aún limitada.' },
    oa_rate: { name: 'Open Access', val: oaRate + '%', dist: rdist.oa_rate, color: '#22c55e', numVal: oaRate,
      desc: 'Porcentaje en acceso abierto (gold, green, hybrid, bronze).',
      calc: 'OA rate = Publicaciones OA ÷ Total × 100',
      interpret: v => v >= 80 ? 'Excelente compromiso OA.' : v >= 50 ? 'Buena tasa OA.' : v >= 30 ? 'Tasa moderada.' : 'Baja tasa OA — oportunidad de mejora.' },
    q1_pct: { name: '% en Q1', val: (qp.q1_pct || 0) + '%', dist: rdist.q1_pct, color: '#dc2626', numVal: qp.q1_pct || 0,
      desc: 'Porcentaje en revistas del cuartil superior (Top 25%) según CiteScore.',
      calc: 'Revistas en el top 25% de su categoría = Q1.',
      interpret: v => v >= 60 ? 'Excelente: mayoría en revistas top.' : v >= 40 ? 'Muy buen perfil Q1.' : v >= 20 ? 'Presencia significativa en Q1.' : 'Oportunidad de orientar más publicaciones a Q1.' },
  };
}

// ─── Methodology notes ───
const METHOD_NOTES = {
  cpp: 'CPP no está normalizado por disciplina. Se recomienda interpretarlo con FNCI y percentiles.',
  fwci: 'FNCI normaliza por campo, año y tipo. 1.0 = promedio mundial exacto.',
  h_index: 'El h-index favorece carreras largas y no distingue entre disciplinas.',
  oa_rate: 'No normaliza por disciplina. Diferentes áreas tienen distintos patrones OA.',
  q1_pct: 'No normaliza por disciplina. Diferentes áreas tienen distinta distribución de cuartiles.',
};

export default function ResearcherModal() {
  const navigate = useTransitionNavigate();
  const location = useLocation();
  const { openLocalResearcherProfile } = useOpenResearcherProfile();
  const {
    selected,
    openAlexAuthorId,
    closeResearcher,
    modalTopic,
    setModalTopic,
    metricDetail,
    setMetricDetail,
    setViewCoAuthor,
    openResearcher,
  } = useApp();

  const openCoAuthor = useCallback(
    (ref: CoAuthorRef) => {
      const target = getCoAuthorClickTarget(ref, getData());
      if (!target) return;
      if (target.kind === 'uta') {
        openLocalResearcherProfile(target.researcher);
        return;
      }
      setViewCoAuthor(target.profile);
    },
    [openLocalResearcherProfile, setViewCoAuthor]
  );

  const handleCloseProfile = useCallback(() => {
    startTransition(() => {
      closeResearcher();
      if (/^\/perfiles\/[^/]+/.test(location.pathname)) {
        navigate('/perfiles');
      }
    });
  }, [closeResearcher, navigate, location.pathname]);

  if (openAlexAuthorId) {
    return (
      <OpenAlexResearcherProfile
        authorId={openAlexAuthorId}
        onClose={handleCloseProfile}
        onUtaMatch={(r) => {
          startTransition(() => {
            openResearcher(r);
            if (shouldSyncProfileRoute(location.pathname)) {
              const orcid = (r.o || '').replace(/https?:\/\/orcid\.org\//i, '').trim();
              if (orcid) navigate(`/perfiles/${orcid}`);
              else if (r.id) navigate(`/perfiles/${encodeURIComponent(r.id)}`);
            }
          });
        }}
      />
    );
  }

  if (!selected) return null;

  const oa = getAuthorOA(selected);
  const orcidUrl = getOrcidRecordUrl(selected.o);
  const openAlexUrl = getResearcherOpenAlexUrl(selected);
  const op = getOrcidProfile(selected);
  const c = getColor((selected.f || '') + (selected.l || ''));
  const AI = getAI();
  const METRICS = getMetrics();
  const RES_METRICS = getResMetrics();
  const DATA = getData();

  const aiSummary = (AI?.summaries || {})[cleanOrcid(selected.o)];
  const affinityList = (AI?.affinity || {})[cleanOrcid(selected.o)] || [];
  const rm = RES_METRICS[cleanOrcid(selected.o)] || {};
  const qp = rm.quartile_profile || {};
  const mq = rm.metrics_quality || {};
  const rdist = METRICS.researcher_distributions || {};

  const MDEFS = useMemo(() => oa ? buildMetricDefs(oa, rm, rdist, METRICS) : {}, [oa, rm, rdist, METRICS]);

  return (
    <div className="modal-overlay" onClick={handleCloseProfile}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 960 }}>

        {/* ── Header ── */}
        <div className="researcher-modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            {selected.ph ? (
              <img src={`/photos/${selected.ph}`} alt="" style={{ width: 85, height: 85, borderRadius: '50%', objectFit: 'cover', border: '3px solid #fff' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div style={{ width: 85, height: 85, borderRadius: '50%', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 36, border: '4px solid #fff', flexShrink: 0 }}>
                {getInitials(selected.f, selected.l)}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, color: '#93c5fd', fontWeight: 700, marginBottom: 4 }}>Universidad de Tarapacá</div>
              <h2 style={{ margin: '0 0 4px', fontSize: 'clamp(18px,2.5vw,24px)', fontWeight: 700, color: '#fff' }}>{selected.f} {selected.l}</h2>
              {selected.t && <div style={{ fontSize: 14, color: '#e2e8f0', marginBottom: 4 }}>{selected.t}</div>}
              {(selected.dp || [])[0] && <div style={{ fontSize: 13, color: '#cbd5e1', marginBottom: 6 }}>{(selected.dp || [])[0]?.d}{(selected.dp || [])[0]?.j && (' — ' + (selected.dp || [])[0]?.j)}</div>}
              {selected.e && <div style={{ fontSize: 13, color: '#cbd5e1', marginBottom: 8 }}>✉ {selected.e}</div>}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {orcidUrl && (
                  <a
                    href={orcidUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      background: '#a6ce39',
                      color: '#fff',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                    title="Abrir ficha en orcid.org"
                  >
                    ORCID: {cleanOrcid(selected.o)}
                  </a>
                )}
                {openAlexUrl && (
                  <a
                    href={openAlexUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      background: 'rgba(255,255,255,0.15)',
                      color: '#fff',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: 'none',
                      border: '1px solid rgba(255,255,255,0.35)',
                    }}
                    title="Ver autor en OpenAlex"
                  >
                    OpenAlex
                  </a>
                )}
              </div>
            </div>
            <button onClick={handleCloseProfile} className="modal__close" aria-label="Cerrar">×</button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="researcher-modal__body">

          {/* AI Summary */}
          {aiSummary && <div className="ai-summary">🤖 <strong>Resumen IA:</strong> {aiSummary}</div>}

          {/* ── Metric Cards ── */}
          {oa && <>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 10, marginBottom: 16 }}>
              {[{ k: 'output', l: 'Publicaciones' }, { k: 'cites', l: 'Citas Totales' }, { k: 'cpp', l: 'Citas/Pub' }, { k: 'h_index', l: 'h-index' }, { k: 'fwci', l: 'FNCI' }, { k: 'oa_rate', l: 'Open Access' }].map(({ k, l }, i) => {
                const md = MDEFS[k] || {};
                const displayVal = k === 'cpp' ? (oa.works_count > 0 ? +((oa.cited_by_count || 0) / oa.works_count).toFixed(2) : 0) : md.val;
                return (
                  <div key={i} onClick={() => setMetricDetail(metricDetail === k ? null : (k as MetricKey))}
                    style={{ background: metricDetail === k ? '#eff6ff' : '#fff', border: `2px solid ${metricDetail === k ? (md.color || '#3b82f6') : '#e2e8f0'}`, borderRadius: 10, padding: '14px 10px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: metricDetail === k ? '0 4px 16px rgba(30,58,138,0.1)' : '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: md.color || '#1e3a8a', lineHeight: 1 }}>{typeof displayVal === 'number' ? displayVal.toLocaleString() : displayVal}</div>
                    <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginTop: 4 }}>{l}</div>
                    <div style={{ fontSize: 8, color: metricDetail === k ? md.color : '#cbd5e1', marginTop: 3 }}>{metricDetail === k ? '▲ Cerrar' : '▼ Analizar'}</div>
                  </div>
                );
              })}
            </div>

            {/* ── Expanded Metric Detail Panel ── */}
            {metricDetail && MDEFS[metricDetail] && <MetricDetailPanel metricKey={metricDetail} md={MDEFS[metricDetail]} oa={oa} selected={selected} METRICS={METRICS} RES_METRICS={RES_METRICS} />}

            {/* ── Publication Ecosystem ── */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a8a', marginBottom: 10 }}>📚 Ecosistema de Publicación</div>
              <div className="card card--elevated" style={{ padding: 14, marginBottom: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 2 }}>Cuartiles de revistas</div>
                    <div style={{ display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                      {[{ q: 'Q1', c: '#dc2626', n: qp.q1 || 0 }, { q: 'Q2', c: '#f59e0b', n: qp.q2 || 0 }, { q: 'Q3', c: '#F97316', n: qp.q3 || 0 }, { q: 'Q4', c: '#888', n: qp.q4 || 0 }].map(({ q, c, n }) => {
                        const pct = qp.with_quartile ? n / qp.with_quartile * 100 : 0;
                        return pct > 0 ? <div key={q} style={{ width: pct + '%', background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#fff' }}>{pct > 3 ? q : ''}</div> : null;
                      })}
                    </div>
                    {[{ q: 'Q1', c: '#dc2626' }, { q: 'Q2', c: '#f59e0b' }, { q: 'Q3', c: '#F97316' }, { q: 'Q4', c: '#888' }].map(({ q, c }) => (
                      <div key={q} style={{ fontSize: 9, color: '#64748b', lineHeight: 1.7 }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, background: c, borderRadius: 2, marginRight: 4 }} />
                        <strong>{q}:</strong> {qp[q.toLowerCase()] || 0} pub. ({qp.q1_pct && q === 'Q1' ? qp.q1_pct : qp.with_quartile ? ((qp[q.toLowerCase()] || 0) / qp.with_quartile * 100).toFixed(1) : 0}%)
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '12px 16px', textAlign: 'center', minWidth: 120, border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: '#16a34a' }}>{rm.oa_rate || 0}%</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#166534' }}>Open Access</div>
                  </div>
                </div>
              </div>

              {/* Profile badges */}
              <div className="card card--elevated" style={{ padding: 12, marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Perfil del investigador</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {mq.above_world_avg && <span className="badge badge--sm badge--field">Impacto sobre promedio mundial</span>}
                  {mq.highly_cited && <span className="badge badge--sm badge--impact">Altamente citado (&gt;50 citas)</span>}
                  {mq.interdisciplinary && <span className="badge badge--sm" style={{ background: '#ede9fe', color: '#5b21b6' }}>Interdisciplinario (≥3 áreas)</span>}
                  {mq.productive && <span className="badge badge--sm badge--cites">Productivo (≥20 pub.)</span>}
                  {!mq.above_world_avg && !mq.highly_cited && <span className="badge badge--sm" style={{ background: '#f8fafc', color: '#888' }}>En desarrollo</span>}
                </div>
              </div>
            </div>

            {/* Productivity Trend */}
            {rm.productivity_trend && (
              <div className="card card--elevated" style={{ padding: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 8 }}>Publicaciones por año (últimos 5 años)</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 50 }}>
                  {Object.entries(rm.productivity_trend as Record<string, number>).map(([yr, n], i) => {
                    const mx = Math.max(...Object.values(rm.productivity_trend as Record<string, number>)) || 1;
                    return (
                      <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: '#1e3a8a' }}>{n}</div>
                        <div style={{ height: Math.max(4, n / mx * 36), background: 'linear-gradient(#1e3a8a,#3b82f6)', borderRadius: '2px 2px 0 0', marginBottom: 2 }} />
                        <div style={{ fontSize: 8, color: '#888' }}>{yr}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <AISummaryButton
              label="Analizar con IA"
              panelTitle={`Análisis IA — ${selected.f} ${selected.l}`}
              fetchAnalysis={() =>
                analyzeResearcher({
                  orcid: cleanOrcid(selected.o),
                  researcherId: selected.id,
                })
              }
              renderStructured={(data: ResearcherAnalysisStructured) => (
                <div className="ai-researcher-analysis">
                  {[
                    ['Líneas de investigación', data.lineas_investigacion],
                    ['Fortalezas científicas', data.fortalezas_cientificas],
                    ['ODS principales', data.ods_principales],
                    ['Colaboraciones destacadas', data.colaboraciones_destacadas],
                    ['Publicaciones clave', data.publicaciones_clave],
                    ['Oportunidades de colaboración', data.oportunidades_colaboracion],
                  ].map(([title, items]) =>
                    items?.length ? (
                      <div key={String(title)} className="ai-panel__section">
                        <div className="ai-panel__heading">{title}</div>
                        <ul className="ai-panel__list">
                          {items.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null
                  )}
                </div>
              )}
            />
          </>}

          {/* ── Education ── */}
          {op?.education?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>🎓 Formación Académica</div>
              {op.education.slice(0, 3).map((e, i) => (
                <div key={i} style={{ fontSize: 13, color: '#475569', marginBottom: 3 }}>{e.degree || 'Grado'} — {e.institution} {e.endYear ? `(${e.endYear})` : ''}</div>
              ))}
            </div>
          )}

          {/* ── Collaboration Section ── */}
          <h2 className="section-title">Colaboración e Interdisciplina</h2>

          <div className="card card--elevated" style={{ borderLeft: '5px solid #f59e0b', padding: 20, marginBottom: 24 }}>
            {op?.coAuthors?.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, color: '#334155', fontSize: 13, marginBottom: 6 }}>
                  Co-autores Principales <span style={{ fontWeight: 400, color: '#64748b' }}>(clic para abrir ficha)</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {op.coAuthors.slice(0, 12).map((ca, i) => {
                    const clickable = isCoAuthorClickable(ca, DATA);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (clickable) openCoAuthor(ca);
                        }}
                        className={`coauthor-chip ${clickable ? 'coauthor-chip--linked' : ''}`}
                        disabled={!clickable}
                      >
                        {ca.name} ({ca.count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Affinity Researchers ── */}
          {affinityList.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#6A4C93', marginBottom: 8 }}>🔮 Investigadores Afines (IA)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {affinityList.slice(0, 8).map((af, i) => (
                  <span key={i} onClick={() => { const r2 = DATA.find(p => (p.o || '').trim() === af.orcid); if (r2) openResearcher(r2); }}
                    className="badge badge--clickable" style={{ background: '#f3eef8', color: '#6A4C93', borderColor: '#e0d5ee' }}>
                    {af.name} <strong>({af.score})</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Research areas (misma UI que /areas, datos del investigador) ── */}
          <h2 className="section-title">Áreas de Investigación</h2>
          <div style={{ marginBottom: 24 }}>
            <ResearcherAreasSection
              researcher={selected}
              activeArea={modalTopic}
              onAreaClick={setModalTopic}
            />
          </div>

          {/* ── Publications (all-works.json vía autores_uta) ── */}
          <h2 className="section-title">Producción Científica</h2>
          <ResearcherPublicationsSection
            researcher={selected}
            modalTopic={modalTopic}
            onTopicChange={setModalTopic}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Metric Detail Panel sub-component ───
function MetricDetailPanel({ metricKey, md, oa, selected, METRICS, RES_METRICS }) {
  const numV = md.numVal !== undefined ? md.numVal : (typeof md.val === 'string' ? parseFloat(md.val) : md.val);
  const dist = md.dist || {};
  const pctile = dist.max && dist.max > dist.min ? Math.min(99, Math.round(((numV - dist.min) / (dist.max - dist.min)) * 100)) : 50;
  const vsMedia = dist.mean > 0 ? +(numV / dist.mean).toFixed(1) : 0;
  const wc = oa?.works_count || 0;
  const cc = oa?.cited_by_count || 0;
  const rm2 = RES_METRICS[cleanOrcid(selected.o)] || {};
  const isPositive = metricKey === 'fwci' ? numV >= 1 : numV >= (dist.median || 0);

  return (
    <div className="metric-panel" style={{ borderColor: md.color }}>
      <div className="metric-panel__header" style={{ background: `linear-gradient(135deg,${md.color},${md.color}cc)` }}>
        <div>
          <div className="metric-panel__title">{md.name}</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Análisis detallado de indicador bibliométrico</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="metric-panel__value">{typeof md.val === 'number' ? md.val.toLocaleString() : md.val}</div>
        </div>
      </div>

      <div className="metric-panel__body">
        {/* Left column */}
        <div>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#94a3b8', fontWeight: 800, marginBottom: 10 }}>Definición</div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: '#334155', marginBottom: 20 }}>{md.desc}</div>

          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#94a3b8', fontWeight: 800, marginBottom: 10 }}>Cálculo</div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#f8fafc', padding: '14px 16px', fontSize: 14, fontWeight: 600, color: '#475569', fontFamily: 'monospace', marginBottom: 20 }}>{md.calc}</div>

          {metricKey === 'cpp' && (
            <div style={{ marginBottom: 20, fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
              Citas totales: <strong>{cc.toLocaleString()}</strong><br />
              Publicaciones totales: <strong>{wc.toLocaleString()}</strong><br />
              CPP resultante: <strong>{wc > 0 ? (cc / wc).toFixed(2) : 0}</strong> citas por publicación
            </div>
          )}

          {dist.mean !== undefined && (
            <>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#94a3b8', fontWeight: 800, marginBottom: 10 }}>Benchmark institucional</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[{ l: 'Investigador', v: typeof md.val === 'number' ? md.val : numV }, { l: 'Media UTA', v: dist.mean }, { l: 'Mediana UTA', v: dist.median }, { l: 'P75 UTA', v: dist.p75 }].map(({ l, v }, j) => (
                  <div key={j} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', background: '#fff' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, marginBottom: 3 }}>{l}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>{typeof v === 'number' ? v.toLocaleString() : v}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right column */}
        <div>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#94a3b8', fontWeight: 800, marginBottom: 10 }}>Interpretación analítica</div>
          <div style={{ background: isPositive ? '#ecfdf5' : '#fef2f2', border: `1px solid ${isPositive ? '#a7f3d0' : '#fecaca'}`, borderRadius: 14, padding: '14px 16px', fontSize: 14, lineHeight: 1.5, color: isPositive ? '#065f46' : '#991b1b', marginBottom: 16 }}>
            {md.interpret(numV)}
          </div>

          {/* Distribution Bar */}
          {dist.max !== undefined && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 10 }}>Distribución comparativa institucional</div>
              <div style={{ position: 'relative', height: 50, marginBottom: 8 }}>
                <div style={{ position: 'absolute', top: 14, left: 0, right: 0, height: 18, borderRadius: 999, background: `linear-gradient(90deg,#e2e8f0 0%,${md.color}66 55%,${md.color} 100%)`, opacity: 0.9 }} />
                <div style={{ position: 'absolute', top: 5, left: Math.max(0, Math.min(95, ((numV - dist.min) / (dist.max - dist.min || 1)) * 100)) + '%', width: 5, height: 38, borderRadius: 999, background: md.color, boxShadow: `0 0 0 5px ${md.color}22` }} />
                <div style={{ position: 'absolute', top: 44, left: Math.max(0, Math.min(95, ((numV - dist.min) / (dist.max - dist.min || 1)) * 100)) + '%', transform: 'translateX(-50%)', fontSize: 12, fontWeight: 900, color: md.color, whiteSpace: 'nowrap' }}>{typeof md.val === 'number' ? md.val : numV}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', fontWeight: 700, marginTop: 14 }}>
                <span>Min: {dist.min}</span><span>Mediana: {dist.median}</span><span>P75: {dist.p75}</span><span>Max: {dist.max}</span>
              </div>
            </div>
          )}

          {/* Comparison badges */}
          {dist.mean !== undefined && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {pctile >= 75 && <span style={{ borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 800, background: '#f3e8ff', color: '#5b21b6', border: '1px solid #ddd6fe' }}>Top {100 - pctile}% institucional</span>}
                {vsMedia >= 2 && <span style={{ borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 800, background: '#f3e8ff', color: '#5b21b6', border: '1px solid #ddd6fe' }}>{vsMedia}× sobre la media UTA</span>}
                <span style={{ borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 800, background: '#f3e8ff', color: '#5b21b6', border: '1px solid #ddd6fe' }}>Percentil P{pctile}</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: '#475569' }}>
                <strong>Distribución UTA ({METRICS.metadata?.total_researchers || 164} investigadores):</strong> Media={dist.mean}, σ={dist.std}.
                {pctile >= 90 ? ` Se ubica en el segmento de mayor impacto (P${pctile}).` : pctile >= 75 ? ' Cuartil superior de la distribución.' : pctile >= 50 ? ' Sobre la mediana institucional.' : ' Bajo la mediana, con oportunidad de mejora.'}
              </div>
            </div>
          )}

          {/* Methodology note */}
          <div style={{ borderLeft: `4px solid ${md.color}`, padding: '10px 12px', background: `${md.color}08`, color: '#475569', fontSize: 12, lineHeight: 1.5, borderRadius: 8 }}>
            <strong>Nota metodológica:</strong> {METHOD_NOTES[metricKey] || 'Interpretar en conjunto con otras métricas.'}
          </div>

          {/* Download button */}
          <button onClick={() => {
            const rm3 = RES_METRICS[cleanOrcid(selected.o)] || {};
            downloadMetricReport({
              metricKey, md, numV, dist, pctile, vsMedia, wc, cc,
              name: selected.f + ' ' + selected.l,
              dept: (selected.dp || [])[0]?.d || 'No especificada',
              fields: rm3.fields || [],
              career: rm3.career_span || {},
            });
          }} className="btn btn--xl btn--primary" style={{ marginTop: 14, boxShadow: '0 10px 22px rgba(30,58,138,0.24)' }}>
            📥 Descargar Análisis Completo
          </button>
        </div>
      </div>
    </div>
  );
}

