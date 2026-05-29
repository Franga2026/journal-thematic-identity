import { memo } from 'react';
import { COLORS } from '../../utils/constants';
import type { AreaGroup } from '../../utils/areaGrouping';
import AreaCard from './AreaCard';
import { EmptyState } from '../common/UIComponents';

export interface AreaCardsGridProps {
  areas: AreaGroup[];
  onAreaClick?: (name: string) => void;
  footerLabel?: string;
  showShare?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
}

const AreaCardsGrid = memo(function AreaCardsGrid({
  areas,
  onAreaClick,
  footerLabel,
  showShare = false,
  emptyTitle = 'Sin áreas registradas',
  emptyMessage = 'No hay publicaciones con campo o tópico asignado en este conjunto.',
}: AreaCardsGridProps) {
  if (!areas.length) {
    return <EmptyState icon="🔬" title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div className="grid grid--areas area-cards-grid">
      {areas.map((area, i) => (
        <AreaCard
          key={area.name}
          area={area}
          color={COLORS[i % COLORS.length]}
          onClick={onAreaClick}
          footerLabel={footerLabel}
          showShare={showShare}
        />
      ))}
    </div>
  );
});

export default AreaCardsGrid;
