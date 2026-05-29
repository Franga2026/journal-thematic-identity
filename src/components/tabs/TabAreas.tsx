import { useMemo, useCallback } from 'react';
import { useTransitionNavigate } from '../../app/hooks/useTransitionNavigate';
import { useApp } from '../../context/AppContext';
import { getAW } from '../../utils/dataProcessing';
import { groupWorksByArea } from '../../utils/areaGrouping';
import AreaCardsGrid from '../areas/AreaCardsGrid';

export default function TabAreas() {
  const { setSdgFilter, setAreaFilter, setOnlyOrcid, setDept, setPage } = useApp();
  const navigate = useTransitionNavigate();
  const AW = getAW();

  const areas = useMemo(() => groupWorksByArea(AW || []), [AW]);

  const handleClick = useCallback(
    (name: string) => {
      setAreaFilter(name);
      setSdgFilter('');
      setOnlyOrcid(false);
      setDept('');
      setPage(0);
      navigate('/perfiles');
    },
    [setAreaFilter, setSdgFilter, setOnlyOrcid, setDept, setPage, navigate]
  );

  return (
    <>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px' }}>Áreas de Investigación</h2>
      <p style={{ fontSize: 13, color: '#666', margin: '0 0 16px' }}>
        Datos reales de OpenAlex · {(AW || []).length.toLocaleString()} publicaciones
      </p>
      <AreaCardsGrid areas={areas} onAreaClick={handleClick} />
    </>
  );
}
