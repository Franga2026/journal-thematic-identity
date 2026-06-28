import { useEffect, useMemo, useState } from 'react';
import type { Researcher, Work } from '../../shared/types';
import { enrichWork } from '../../utils/dataProcessing';
import { workRowId } from '../../utils/workRowId';
import WorkCard, { type WorkCardVariant } from '../cards/WorkCard';
import WorkRow from '../cards/WorkRow';
import { EmptyState } from '../common/UIComponents';
import type { ProductionViewMode } from './ProductionViewToggle';

interface ProductionWorkListProps {
  works: Work[];
  viewMode?: ProductionViewMode;
  variant?: WorkCardVariant;
  onOpenResearcher?: (profileId: string) => void;
  currentResearcher?: Researcher | null;
}

export default function ProductionWorkList({
  works,
  viewMode = 'cards',
  variant = 'production',
  onOpenResearcher,
  currentResearcher,
}: ProductionWorkListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const enrichedWorks = useMemo(
    () => works.map((work) => enrichWork(work) as Work),
    [works],
  );

  useEffect(() => {
    setExpandedId(null);
  }, [works, viewMode]);

  const handleToggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  if (!enrichedWorks.length) {
    return (
      <EmptyState
        icon="📄"
        title="No se encontraron publicaciones"
        message="Prueba con otros términos de búsqueda o ajusta los filtros laterales."
      />
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="work-rows" role="list">
        {enrichedWorks.map((w, i) => {
          const id = workRowId(w, i);
          return (
            <WorkRow
              key={id}
              rowId={id}
              w={w}
              variant={variant}
              expanded={expandedId === id}
              onToggle={handleToggle}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="production-work-list" role="list">
      {enrichedWorks.map((w, i) => (
        <WorkCard
          key={`${w.d || ''}-${w.y || ''}-${i}`}
          w={w}
          variant={variant}
          onOpenResearcher={onOpenResearcher}
          currentResearcher={currentResearcher}
        />
      ))}
    </div>
  );
}
