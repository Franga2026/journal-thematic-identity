import { useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { getAW, getInstitution, enrichWork, filterWorks } from '../../utils/dataProcessing';
import { WORKS_PAGE_SIZE, TYPE_ES } from '../../utils/constants';
import { Pagination } from '../common/UIComponents';
import WorkCard from '../cards/WorkCard';

export default function TabProduccion() {
  const {
    workSearch, setWorkSearch, workYear, setWorkYear,
    workType, setWorkType, workOA, setWorkOA,
    workField, setWorkField, workSdg, setWorkSdg,
    workPage, setWorkPage,
  } = useApp();

  const AW = getAW();
  const INST = getInstitution();

  const fw = useMemo(
    () => filterWorks({ search: workSearch, year: workYear, type: workType, oa: workOA, field: workField, sdg: workSdg }),
    [workSearch, workYear, workType, workOA, workField, workSdg]
  );

  const totalPages = Math.max(1, Math.ceil(fw.length / WORKS_PAGE_SIZE));
  const pageData = fw.slice(workPage * WORKS_PAGE_SIZE, (workPage + 1) * WORKS_PAGE_SIZE);

  const yrs = useMemo(() => [...new Set((AW || []).map((w) => w.y).filter(Boolean))].sort((a, b) => b - a), [AW]);
  const tps = useMemo(() => [...new Set((AW || []).map((w) => w.tp).filter(Boolean))], [AW]);
  const fields = useMemo(() => [...new Set((AW || []).map((w) => w.field).filter(Boolean))].sort(), [AW]);

  const resetWorkPage = useCallback(() => setWorkPage(0), [setWorkPage]);

  return (
    <>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 10px' }}>Producción Científica</h2>

      {/* KPI Cards */}
      <div className="grid grid--kpi" style={{ marginBottom: 16 }}>
        {[
          { l: 'Publicaciones', v: INST.works_count, c: 'var(--blue-700)' },
          { l: 'Citas', v: INST.cited_by_count, c: '#2a7a8a' },
          { l: 'H-index', v: INST.h_index, c: '#4C9F38' },
          { l: 'Open Access', v: (AW || []).filter((w) => w.oa).length, c: '#FD6925' },
        ].map((m, i) => (
          <div key={i} className="kpi-card">
            <div className="kpi-card__value" style={{ color: m.c }}>{(m.v || 0).toLocaleString()}</div>
            <div className="kpi-card__label">{m.l}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input
          className="filter-bar__input"
          value={workSearch}
          onChange={(e) => { setWorkSearch(e.target.value); resetWorkPage(); }}
          placeholder="Buscar título, autor o revista..."
          aria-label="Buscar publicaciones"
        />
        <select className="filter-bar__select" value={workYear} onChange={(e) => { setWorkYear(e.target.value); resetWorkPage(); }}>
          <option value="">Año</option>
          {yrs.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="filter-bar__select" value={workType} onChange={(e) => { setWorkType(e.target.value); resetWorkPage(); }}>
          <option value="">Tipo</option>
          {tps.map((t) => <option key={t} value={t}>{TYPE_ES[t] || t}</option>)}
        </select>
        <select className="filter-bar__select" value={workField} onChange={(e) => { setWorkField(e.target.value); resetWorkPage(); }}>
          <option value="">Área</option>
          {fields.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="checkbox" checked={workOA} onChange={(e) => { setWorkOA(e.target.checked); resetWorkPage(); }} style={{ accentColor: '#4C9F38' }} />
          <span style={{ color: workOA ? '#4C9F38' : '#888' }}>OA</span>
        </label>
        {(workField || workSdg) && (
          <button className="btn btn--ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => { setWorkField(''); setWorkSdg(''); resetWorkPage(); }}>✕</button>
        )}
        <span className="filter-bar__count">{fw.length.toLocaleString()} result.</span>
      </div>

      {/* Works List */}
      <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
        {pageData.map((w, i) => <WorkCard key={`${w.d || ''}-${i}`} w={enrichWork(w)} compact={false} />)}
      </div>

      <Pagination page={workPage} totalPages={totalPages} onPageChange={setWorkPage} />
    </>
  );
}
