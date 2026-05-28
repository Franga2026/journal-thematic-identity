import { useMemo } from 'react';
import { getMetrics, getResMetrics, getAW } from '../../utils/dataProcessing';
import { COLORS } from '../../utils/constants';
import { BarChart } from '../common/UIComponents';

export default function TabMetricas() {
  const M = getMetrics() || {};
  const AW = getAW();

  const tr = M.trends || [];
  const last6 = tr.slice(-6);
  const fd = (M.field_distribution || []).slice(0, 12);
  const oaD = M.open_access || {};
  const ranks = M.rankings || {};
  const rdist = M.researcher_distributions || {};
  const sdgs = M.sdg_alignment || [];
  const cr = M.crossref_enrichment || {};
  const tjp = M.top_journal_percentiles || {};
  const tcp = M.top_citation_percentiles || {};
  const collab = M.collaboration || {};

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>📊 Dashboard de Métricas — Universidad de Tarapacá</h2>
        <span style={{ fontSize: 10, color: 'var(--gray-400)' }}>Estándares internacionales · OpenAlex + Crossref + Unpaywall</span>
      </div>

      {/* KPIs */}
      <div className="grid grid--kpi" style={{ marginBottom: 20 }}>
        {[
          { v: M.scholarly_output || 0, l: 'Scholarly Output', c: 'var(--blue-700)' },
          { v: M.citation_count || 0, l: 'Citation Count', c: 'var(--red-600)' },
          { v: M.citations_per_publication || 0, l: 'Citas / Pub', c: '#7c3aed' },
          { v: M.fwci || 0, l: 'FNCI', c: M.fwci >= 1 ? 'var(--green-600)' : 'var(--amber-500)' },
          { v: M.h_index || 0, l: 'h-index', c: 'var(--blue-800)' },
          { v: (oaD.oa_rate || 0) + '%', l: 'Open Access', c: 'var(--green-600)' },
          { v: (tjp.q1_pct || 0) + '%', l: 'En Q1', c: 'var(--red-600)' },
        ].map((m, i) => (
          <div key={i} className="kpi-card">
            <div className="kpi-card__value" style={{ color: m.c }}>{typeof m.v === 'number' ? m.v.toLocaleString() : m.v}</div>
            <div className="kpi-card__label">{m.l}</div>
          </div>
        ))}
      </div>

      <div className="grid grid--2col" style={{ marginBottom: 20 }}>
        {/* Production & Citations by Year */}
        <div className="card card--elevated" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue-700)', marginBottom: 12 }}>📈 Producción y Citas por Año</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 130 }}>
            {last6.map((t, i) => { const mx = Math.max(...last6.map(x => x.output)) || 1; return (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--blue-800)', marginBottom: 2 }}>{t.output}</div>
                <div style={{ height: Math.max(6, t.output / mx * 100), background: 'linear-gradient(var(--blue-800),var(--blue-500))', borderRadius: '3px 3px 0 0', marginBottom: 2 }} />
                <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--red-600)', marginBottom: 2 }}>{t.cpp}</div>
                <div style={{ fontSize: 9, color: '#888' }}>{t.year}</div>
              </div>
            ); })}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8, fontSize: 10 }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--blue-800)', borderRadius: 2, marginRight: 3 }} />Output</span>
            <span style={{ color: 'var(--red-600)' }}>Números rojos = Citas/Pub</span>
          </div>
        </div>

        {/* Open Access Distribution */}
        <div className="card card--elevated" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue-700)', marginBottom: 12 }}>🔓 Distribución Open Access</div>
          {[{ k: 'gold', l: 'Gold (revista OA)', c: '#F5A623' }, { k: 'green', l: 'Green (repositorio)', c: 'var(--green-600)' }, { k: 'hybrid', l: 'Hybrid', c: 'var(--blue-500)' }, { k: 'bronze', l: 'Bronze', c: '#CD7F32' }, { k: 'closed', l: 'Closed', c: '#ef4444' }].map(({ k, l, c }) => {
            const d = oaD[k] || {};
            return <BarChart key={k} value={d.count || 0} max={M.scholarly_output || 1} color={c} label={`${l} (${d.pct || 0}%)`} />;
          })}
        </div>
      </div>

      <div className="grid grid--2col" style={{ marginBottom: 20 }}>
        {/* Top Citation Percentiles */}
        <div className="card card--elevated" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue-700)', marginBottom: 12 }}>🏆 Top Citation Percentiles</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
            {[{ l: 'Top 1%', v: tcp.top1pct, n: tcp.top1 }, { l: 'Top 5%', v: tcp.top5pct, n: tcp.top5 }, { l: 'Top 10%', v: tcp.top10pct, n: tcp.top10 }, { l: 'Top 25%', v: tcp.top25pct, n: tcp.top25 }].map(({ l, v, n }, i) => (
              <div key={i} style={{ textAlign: 'center', padding: 12, background: i === 0 ? '#fef3c7' : i === 1 ? 'var(--blue-100)' : 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: i === 0 ? '#92400e' : i === 1 ? 'var(--blue-800)' : 'var(--gray-600)' }}>{v || 0}%</div>
                <div style={{ fontSize: 10, color: '#888' }}>{l}</div>
                <div style={{ fontSize: 9, color: 'var(--gray-400)' }}>{n} pub.</div>
              </div>
            ))}
          </div>
        </div>

        {/* Journal Quartiles */}
        <div className="card card--elevated" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue-700)', marginBottom: 12 }}>📚 Cuartiles de Revistas</div>
          <div style={{ display: 'flex', height: 28, borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
            {[{ q: 'Q1', c: 'var(--red-600)' }, { q: 'Q2', c: 'var(--amber-500)' }, { q: 'Q3', c: '#F97316' }, { q: 'Q4', c: '#888' }].map(({ q, c }) => {
              const count = AW.filter(w => w.qi === q).length;
              const pct = AW.length ? count / AW.length * 100 : 0;
              return pct > 0 ? <div key={q} style={{ width: pct + '%', background: c, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }} title={`${q}: ${count}`}>{pct > 3 ? q : ''}</div> : null;
            })}
          </div>
          {[{ q: 'Q1', c: 'var(--red-600)' }, { q: 'Q2', c: 'var(--amber-500)' }, { q: 'Q3', c: '#F97316' }, { q: 'Q4', c: '#888' }].map(({ q, c }) => {
            const count = AW.filter(w => w.qi === q).length;
            return (
              <div key={q} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: c, borderRadius: 2, marginRight: 4 }} />{q}</span>
                <span style={{ fontWeight: 600 }}>{count} <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>({AW.length ? (count / AW.length * 100).toFixed(1) : 0}%)</span></span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid--2col" style={{ marginBottom: 20 }}>
        {/* Research Areas */}
        <div className="card card--elevated" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue-700)', marginBottom: 12 }}>🌍 Áreas de Investigación (Top 12)</div>
          {fd.map((f, i) => <BarChart key={i} value={f.output} max={fd[0]?.output || 1} color={COLORS[i % COLORS.length]} label={`${f.field} (CPP:${f.cpp})`} height={12} />)}
        </div>

        {/* SDG Alignment */}
        <div className="card card--elevated" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue-700)', marginBottom: 12 }}>🌱 Alineamiento ODS</div>
          {sdgs.slice(0, 12).map((s, i) => <BarChart key={i} value={s.publications} max={sdgs[0]?.publications || 1} color="#0A97D9" label={s.sdg} height={10} />)}
        </div>
      </div>

      <div className="grid grid--2col" style={{ marginBottom: 20 }}>
        {/* Researcher Distribution */}
        <div className="card card--elevated" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue-700)', marginBottom: 12 }}>👥 Distribución de Investigadores</div>
          {[{ l: 'h-index', d: rdist.h_index }, { l: 'Citas/Pub', d: rdist.citations_per_pub }, { l: 'FNCI', d: rdist.fwci }, { l: 'Output', d: rdist.scholarly_output }, { l: '% OA', d: rdist.oa_rate }, { l: '% Q1', d: rdist.q1_pct }].map(({ l, d }, i) => d ? (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--gray-600)', fontWeight: 500 }}>{l}</span>
              <span><span style={{ color: '#888' }}>min:</span>{d.min} <span style={{ color: '#888' }}>med:</span><strong>{d.median}</strong> <span style={{ color: '#888' }}>max:</span>{d.max} <span style={{ color: '#888' }}>σ:</span>{d.std}</span>
            </div>
          ) : null)}
        </div>

        {/* Funding */}
        <div className="card card--elevated" style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue-700)', marginBottom: 12 }}>💰 Financiamiento (Crossref)</div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>{cr.with_funder || 0} publicaciones con funder • {cr.with_license || 0} con licencia</div>
          {(cr.top_funders || []).slice(0, 8).map((f, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--gray-600)', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <span style={{ fontWeight: 600, color: 'var(--blue-700)' }}>{f.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Rankings */}
      <div className="grid grid--3col" style={{ marginBottom: 20 }}>
        {[{ title: '🏆 Top por h-index', data: ranks.by_h_index, val: r => `h=${r.h_index}`, c: 'var(--red-600)' },
          { title: '🎯 Top por FNCI', data: ranks.by_fwci, val: r => r.fwci, c: r => r.fwci >= 1 ? 'var(--green-600)' : 'var(--amber-500)' },
          { title: '🥇 Top por % Q1', data: ranks.by_q1_pct, val: r => r.q1_pct + '%', c: 'var(--green-600)' }
        ].map(({ title, data, val, c }, idx) => (
          <div key={idx} className="card card--elevated" style={{ padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{title}</div>
            {(data || []).slice(0, 8).map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ color: 'var(--blue-700)', fontWeight: 500 }}>{i + 1}. {r.name}</span>
                <span style={{ fontWeight: 700, color: typeof c === 'function' ? c(r) : c }}>{typeof val === 'function' ? val(r) : val}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Methodology */}
      <div style={{ background: 'linear-gradient(135deg,var(--blue-900),var(--blue-800))', borderRadius: 10, padding: 20, color: '#fff' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>📋 Fundamentos Metodológicos</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12, fontSize: 11, opacity: 0.85 }}>
          <div><strong>FNCI</strong>: Citas recibidas vs esperadas por campo, año y tipo documental. Mundo = 1.0</div>
          <div><strong>Top Percentiles</strong>: Publicaciones en el top 1/5/10/25% más citado globalmente</div>
          <div><strong>Top Journal</strong>: Publicaciones en revistas Q1/Q2 según CiteScore</div>
          <div><strong>Cited Pubs</strong>: % de producción con al menos 1 cita</div>
          <div><strong>h-index</strong>: h papers con ≥h citas cada uno</div>
          <div><strong>Collaboration</strong>: Co-autoría internacional, nacional, institucional</div>
        </div>
        <div style={{ marginTop: 10, fontSize: 10, opacity: 0.5 }}>Fuentes: OpenAlex + Crossref + Unpaywall + ORCID · Estándares internacionales</div>
      </div>
    </>
  );
}
