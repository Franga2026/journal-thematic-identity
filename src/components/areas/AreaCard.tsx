import { memo, type KeyboardEvent } from 'react';
import { Donut } from '../common/UIComponents';
import type { AreaGroup } from '../../utils/areaGrouping';

export interface AreaCardProps {
  area: AreaGroup;
  color: string;
  onClick?: (name: string) => void;
  footerLabel?: string;
  showShare?: boolean;
}

const AreaCard = memo(function AreaCard({
  area,
  color,
  onClick,
  footerLabel = 'publicaciones →',
  showShare = false,
}: AreaCardProps) {
  const interactive = Boolean(onClick);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (interactive && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick?.(area.name);
    }
  };

  return (
    <div
      className={`card area-card ${interactive ? 'area-card--clickable' : ''}`}
      onClick={interactive ? () => onClick?.(area.name) : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
    >
      <Donut pct={area.donutPct} color={color} />
      <div className="area-card__body">
        <div className="area-card__name">{area.name}</div>
        <div className="area-card__count" style={{ color }}>
          {area.count.toLocaleString()}
        </div>
        <div className="area-card__footer">
          {showShare ? `${area.sharePct}% · ${footerLabel}` : footerLabel}
        </div>
      </div>
    </div>
  );
});

export default AreaCard;
