import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { getAW } from '../../utils/dataProcessing';
import { COLORS } from '../../utils/constants';
import { Donut } from '../common/UIComponents';

export default function TabAreas() {
  const { setSdgFilter, setAreaFilter, setOnlyOrcid, setTab, setDept, setPage } = useApp();
  const AW = getAW();

  const fieldList = useMemo(() => {
    const fc: Record<string, number> = {};
    (AW || []).forEach((w) => { if (w.field) fc[w.field] = (fc[w.field] || 0) + 1; });
    return Object.entries(fc).sort((a, b) => b[1] - a[1]);
  }, [AW]);

  const maxCount = Math.max(...fieldList.map((f) => f[1]), 1);

  const handleClick = (name) => {
    setAreaFilter(name);
    setSdgFilter('');
    setOnlyOrcid(false);
    setTab('perfiles');
    setDept('');
    setPage(0);
  };

  return (
    <>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px' }}>Áreas de Investigación</h2>
      <p style={{ fontSize: 13, color: '#666', margin: '0 0 16px' }}>
        Datos reales de OpenAlex · {(AW || []).length.toLocaleString()} publicaciones
      </p>
      <div className="grid grid--areas">
        {fieldList.map(([name, count], i) => {
          const pct = Math.round((count / maxCount) * 100);
          return (
            <div
              key={i}
              className="card"
              onClick={() => handleClick(name)}
              style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleClick(name)}
            >
              <Donut pct={pct} color={COLORS[i % COLORS.length]} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: COLORS[i % COLORS.length] }}>
                  {count.toLocaleString()}
                </div>
                <div style={{ fontSize: 10, color: '#888' }}>publicaciones →</div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
