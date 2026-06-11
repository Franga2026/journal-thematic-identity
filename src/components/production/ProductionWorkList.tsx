import { useMemo } from 'react';
import type { Researcher, Work } from '../../shared/types';
import { enrichWork } from '../../utils/dataProcessing';
import WorkCard from '../cards/WorkCard';
import { EmptyState } from '../common/UIComponents';

interface ProductionWorkListProps {
  works: Work[];
  onOpenResearcher?: (profileId: string) => void;
  currentResearcher?: Researcher | null;
}

export default function ProductionWorkList({
  works,
  onOpenResearcher,
  currentResearcher,
}: ProductionWorkListProps) {
  const enrichedWorks = useMemo(
    () => works.map((work) => enrichWork(work) as Work),
    [works],
  );

  if (!enrichedWorks.length) {
    return (
      <EmptyState
        icon="📄"
        title="No se encontraron publicaciones"
        message="Prueba con otros términos de búsqueda o ajusta los filtros laterales."
      />
    );
  }

  return (
    <div className="production-work-list" role="list">
      {enrichedWorks.map((w, i) => (
        <WorkCard
          key={`${w.d || ''}-${w.y || ''}-${i}`}
          w={w}
          variant="production"
          onOpenResearcher={onOpenResearcher}
          currentResearcher={currentResearcher}
        />
      ))}
    </div>
  );
}
