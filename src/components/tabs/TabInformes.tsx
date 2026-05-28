import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { getData, getAW, getInstitution, getAuthorOA } from '../../utils/dataProcessing';
import { SDG_COLORS, SDG_ES } from '../../utils/constants';
import { exportExcel, exportPDF, exportPPTX } from '../../utils/exporters';

export default function TabInformes() {
  const { INST } = useApp();
  const DATA = getData();
  const AW = getAW();

  const { yrs, fieldList, oaCount, oaPct, qCounts, yrField, yrOA, topAuthors, maxYrWorks } = useMemo(() => {
    const aw = AW || [];
    const _yrs = [...new Set(aw.map(w => w.y).filter(Boolean))].sort();
    const fc: Record<string, number> = {}; aw.forEach(w => { if (w.field) fc[w.field] = (fc[w.field] || 0) + 1; });
    const _fl = Object.entries(fc).sort((a, b) => b[1] - a[1]);
    const _oaCount = aw.filter(w => w.oa).length;
    const _qc = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }; aw.forEach(w => { if (w.qi) _qc[w.qi]++; });
    const _yrField = {}; _yrs.forEach(y => { _yrField[y] = {}; _fl.forEach(([f]) => { _yrField[y][f] = 0; }); }); aw.forEach(w => { if (w.y && w.field && _yrField[w.y]) _yrField[w.y][w.field]++; });
    const _yrOA = {}; _yrs.forEach(y => { const yw = aw.filter(w => w.y === y); _yrOA[y] = { total: yw.length, oa: yw.filter(w => w.oa).length }; });
    const _ta = DATA.filter(r => r.o).map(r => { const oa = getAuthorOA(r); return { name: r.f + ' ' + r.l, cc: oa?.cited_by_count || 0, wc: oa?.works_count || 0, hi: oa?.h_index || 0 }; }).sort((a, b) => b.cc - a.cc).slice(0, 10);
    const _mx = Math.max(..._yrs.map(y => aw.filter(w => w.y === y).length), 1);
    return { yrs: _yrs, fieldList: _fl, oaCount: _oaCount, oaPct: aw.length ? Math.round(_oaCount / aw.length * 100) : 0, qCounts: _qc, yrField: _yrField, yrOA: _yrOA, topAuthors: _ta, maxYrWorks: _mx };
  }, [AW, DATA]);

  const inst = INST || {};

  return (
    <>
      {/* Header + Export buttons */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', margin: '0 0 4px' }}>Informe Bibliométrico</h2>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', margin: 0 }}>Universidad de Tarapacá · Indicadores cienciométricos · Fuente: OpenAlex API</p>
          </div>
          <div className="btn-group">
            <button className="btn btn--success" onClick={() => exportExcel(DATA, inst, AW)}>📊 Excel</button>
            <button className="btn btn--danger" onClick={() => exportPPTX(DATA, inst, AW)}>📽 PowerPoint</button>
            <button className="btn btn--primary" onClick={exportPDF}>📄 PDF</button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid--auto-fit" style={{ gap: 12, marginBottom: 28 }}>
        {[
          { v: inst.works_count, l: 'Publicaciones', c: 'var(--blue-800)' },
          { v: inst.cited_by_count, l: 'Citas Totales', c: 'var(--red-600)' },
          { v: inst.h_index, l: 'H-index', c: 'var(--green-600)' },
          { v: oaPct + '%', l: 'Open Access', c: '#ea580c' },
          { v: Object.values(qCounts).reduce((s, v) => s + v, 0), l: 'Con Cuartil', c: '#7c3aed' },
          { v: DATA.length, l: 'Investigadores', c: '#0891b2' },
        ].map((m, i) => (
          <div key={i} className="kpi-card">
            <div className="kpi-card__value" style={{ color: m.c }}>{typeof m.v === 'number' ? (m.v || 0).toLocaleString() : m.v}</div>
            <div className="kpi-card__label">{m.l}</div>
          </div>
        ))}
      </div>

      {/* Production Evolution Chart */}
      <div className="card card--elevated" style={{ padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--red-600)', margin: '0 0 16px' }}>Evolución de la Producción Científica</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 180, padding: '0 10px' }}>
          {yrs.slice(-6).map((y, i) => {
            const cnt = (AW || []).filter(w => w.y === y).length;
            const oaCnt = (AW || []).filter(w => w.y === y && w.oa).length;
            const h = Math.max(8, (cnt / maxYrWorks) * 160);
            const oaH = cnt ? (oaCnt / cnt) * h : 0;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--blue-800)' }}>{cnt}</div>
                <div style={{ width: '100%', position: 'relative', height: h }}>
                  <div style={{ position: 'absolute', bottom: 0, width: '100%', height: h, background: 'var(--blue-800)', borderRadius: '4px 4px 0 0' }} />
                  <div style={{ position: 'absolute', bottom: 0, width: '100%', height: oaH, background: 'var(--green-600)' }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--gray-500)' }}>{y}</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
          <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, background: 'var(--blue-800)', borderRadius: 2, display: 'inline-block' }} /> Total</span>
          <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 12, height: 12, background: 'var(--green-600)', borderRadius: 2, display: 'inline-block' }} /> Open Access</span>
        </div>
      </div>

      {/* Areas Table */}
      <div className="card card--elevated" style={{ padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--red-600)', margin: '0 0 16px' }}>Evolución por Áreas de Investigación</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr style={{ background: 'var(--blue-800)' }}>
                <th style={{ color: '#fff' }}>Área</th>
                {yrs.slice(-3).map(y => <th key={y} style={{ color: '#fff', textAlign: 'center' }}>{y}</th>)}
                <th style={{ color: '#fff', textAlign: 'center', fontWeight: 700 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {fieldList.slice(0, 10).map(([f, total], i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500, color: 'var(--gray-700)' }}>{f}</td>
                  {yrs.slice(-3).map(y => <td key={y} style={{ textAlign: 'center' }}>{yrField[y]?.[f] || 0}</td>)}
                  <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--blue-800)' }}>{total}</td>
                </tr>
              ))}
              <tr style={{ background: 'var(--gray-100)', fontWeight: 700 }}>
                <td>UTA Total</td>
                {yrs.slice(-3).map(y => <td key={y} style={{ textAlign: 'center' }}>{(AW || []).filter(w => w.y === y).length}</td>)}
                <td style={{ textAlign: 'center', color: 'var(--red-600)', fontSize: 14 }}>{(AW || []).length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Quartiles and OA */}
      <div className="grid grid--2col" style={{ marginBottom: 24 }}>
        <div className="card card--elevated" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--red-600)', margin: '0 0 16px' }}>Distribución por Cuartil</h3>
          <div style={{ display: 'flex', gap: 12 }}>
            {[{ q: 'Q1', c: 'var(--red-600)' }, { q: 'Q2', c: '#ea580c' }, { q: 'Q3', c: '#eab308' }, { q: 'Q4', c: 'var(--gray-400)' }].map(({ q, c }, i) => (
              <div key={i} style={{ flex: 1, textAlign: 'center', padding: 12, background: 'var(--gray-50)', borderRadius: 8 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: c }}>{qCounts[q].toLocaleString()}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: c }}>{q}</div>
                <div style={{ fontSize: 10, color: 'var(--gray-500)' }}>{(AW || []).length ? Math.round(qCounts[q] / (AW || []).length * 100) : 0}% pub.</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card card--elevated" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--red-600)', margin: '0 0 16px' }}>Open Access vs Cerrado</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ position: 'relative', width: 100, height: 100 }}>
              <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="12" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--green-600)" strokeWidth="12" strokeDasharray={2 * Math.PI * 40} strokeDashoffset={2 * Math.PI * 40 * (1 - oaPct / 100)} strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: 'var(--green-600)' }}>{oaPct}%</div>
            </div>
            <div>
              <div style={{ fontSize: 13, marginBottom: 4 }}><span style={{ color: 'var(--green-600)', fontWeight: 700 }}>{oaCount.toLocaleString()}</span> Open Access</div>
              <div style={{ fontSize: 13 }}><span style={{ color: 'var(--gray-500)', fontWeight: 700 }}>{((AW || []).length - oaCount).toLocaleString()}</span> Acceso cerrado</div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Researchers Table */}
      <div className="card card--elevated" style={{ padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--red-600)', margin: '0 0 16px' }}>Top 10 Investigadores por Citaciones</h3>
        <table className="data-table">
          <thead>
            <tr style={{ background: 'var(--blue-800)' }}>
              <th style={{ color: '#fff' }}>#</th>
              <th style={{ color: '#fff' }}>Investigador</th>
              <th style={{ color: '#fff', textAlign: 'right' }}>Pub.</th>
              <th style={{ color: '#fff', textAlign: 'right' }}>Citas</th>
              <th style={{ color: '#fff', textAlign: 'right' }}>H-index</th>
            </tr>
          </thead>
          <tbody>
            {topAuthors.map((a, i) => (
              <tr key={i}>
                <td style={{ fontWeight: 700, color: i < 3 ? 'var(--red-600)' : 'var(--gray-500)' }}>{i + 1}</td>
                <td style={{ fontWeight: 600, color: 'var(--gray-700)' }}>{a.name}</td>
                <td style={{ textAlign: 'right', color: 'var(--blue-800)', fontWeight: 600 }}>{a.wc.toLocaleString()}</td>
                <td style={{ textAlign: 'right', color: 'var(--red-600)', fontWeight: 700 }}>{a.cc.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}><span className="badge badge--sm badge--cites">{a.hi}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SDG Contribution */}
      <div className="card card--elevated" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--red-600)', margin: '0 0 16px' }}>Contribución a los ODS</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>
          {(inst.sdgs || []).map((s, i) => {
            const es = SDG_ES[s.name] || s.name;
            const sc = SDG_COLORS[s.name] || '#333';
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border)' }}>
                <div style={{ width: 8, height: 32, borderRadius: 4, background: sc, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)' }}>{es}</div></div>
                <div style={{ fontSize: 16, fontWeight: 700, color: sc }}>{s.count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Source footer */}
      <div style={{ marginTop: 20, padding: 16, background: 'var(--gray-100)', borderRadius: 8, fontSize: 11, color: 'var(--gray-500)', textAlign: 'center' }}>
        Fuente de datos: OpenAlex API · Análisis: Portal de Investigadores UTA · {new Date().toLocaleDateString('es-CL')}
      </div>
    </>
  );
}
