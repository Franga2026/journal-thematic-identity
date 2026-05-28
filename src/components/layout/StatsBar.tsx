import { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useData } from '../../context/DataContext';
import { useFilters } from '../../context/FiltersContext';
import { Counter } from '../common/UIComponents';

export default function StatsBar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const currentTab = pathname.replace('/', '') || 'perfiles';
  const { DATA, INST, DEPTS, ORCID_COUNT } = useData();
  const { onlyOrcid, sdgFilter, setOnlyOrcid } = useFilters();

  const stats = useMemo(() => [
    { n: DATA.length, l: 'Perfiles', active: currentTab === 'perfiles' && !onlyOrcid && !sdgFilter, fn: () => navigate('/perfiles') },
    { n: DEPTS.length, l: 'Unidades', active: currentTab === 'unidades', fn: () => navigate('/unidades') },
    { n: INST.works_count || 0, l: 'Producción', active: currentTab === 'produccion', fn: () => navigate('/produccion') },
    { n: INST.cited_by_count || 0, l: 'Citas', active: false, fn: () => {} },
    { n: INST.h_index || 0, l: 'H-index', active: false, fn: () => {} },
    { n: ORCID_COUNT, l: 'ORCID', active: onlyOrcid, fn: () => { setOnlyOrcid(true); navigate('/perfiles'); } },
    { n: (INST.sdgs || []).length, l: 'ODS', active: currentTab === 'ods', fn: () => navigate('/ods') },
  ], [DATA.length, DEPTS.length, INST, ORCID_COUNT, currentTab, onlyOrcid, sdgFilter, navigate, setOnlyOrcid]);

  return (
    <div className="stats-bar" role="navigation" aria-label="Estadísticas institucionales">
      <div className="stats-bar__inner">
        {stats.map((s, i) => (
          <div
            key={i}
            className={`stats-bar__item ${s.active ? 'stats-bar__item--active' : ''}`}
            onClick={s.fn}
            role="button"
            tabIndex={0}
            aria-label={`${s.l}: ${s.n}`}
            onKeyDown={(e) => e.key === 'Enter' && s.fn()}
          >
            <span className="stats-bar__number"><Counter end={s.n} /></span>
            <span className="stats-bar__label">{s.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
