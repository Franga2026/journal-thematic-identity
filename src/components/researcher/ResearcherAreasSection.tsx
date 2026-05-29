import { useMemo } from 'react';
import type { Researcher } from '../../shared/types';
import { getResearcherUtaId } from '../../utils/helpers';
import { groupWorksByArea } from '../../utils/areaGrouping';
import { getEnrichedWorksForResearcher } from '../../utils/researcherWorks';
import AreaCardsGrid from '../areas/AreaCardsGrid';
import { EmptyState } from '../common/UIComponents';

interface ResearcherAreasSectionProps {
  researcher: Researcher;
  activeArea?: string;
  onAreaClick?: (areaName: string) => void;
}

export default function ResearcherAreasSection({
  researcher,
  activeArea,
  onAreaClick,
}: ResearcherAreasSectionProps) {
  const utaId = getResearcherUtaId(researcher);

  const publicacionesVinculadas = useMemo(
    () => getEnrichedWorksForResearcher(researcher),
    [researcher, utaId]
  );

  const areasPorInvestigador = useMemo(
    () => groupWorksByArea(publicacionesVinculadas),
    [publicacionesVinculadas]
  );

  if (!utaId) {
    return (
      <EmptyState
        icon="🔬"
        title="Sin identificador UTA"
        message="No se pueden calcular áreas sin RUT u ORCID del investigador."
      />
    );
  }

  const handleAreaClick = (name: string) => {
    if (!onAreaClick) return;
    onAreaClick(activeArea === name ? '' : name);
  };

  return (
    <>
      <p className="researcher-areas__meta">
        {publicacionesVinculadas.length.toLocaleString()} publicaciones vinculadas
        <span className="researcher-areas__source"> · all-works.json / autores_uta</span>
      </p>
      <AreaCardsGrid
        areas={areasPorInvestigador}
        onAreaClick={onAreaClick ? handleAreaClick : undefined}
        footerLabel="publicaciones"
        showShare
        emptyTitle="Sin áreas para este investigador"
        emptyMessage="Las publicaciones vinculadas no tienen campo o tópico OpenAlex asignado."
      />
    </>
  );
}
