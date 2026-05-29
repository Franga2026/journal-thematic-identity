import { useState, useMemo } from 'react';

export interface FacetItem {
  name: string;
  count: number;
  label?: string;
}

interface FacetCardProps {
  title: string;
  items: FacetItem[];
  selected: string;
  onSelect: (name: string) => void;
  limit?: number;
  showBars?: boolean;
  maxCount?: number;
}

export default function FacetCard({
  title,
  items,
  selected,
  onSelect,
  limit = 8,
  showBars = true,
  maxCount: maxCountProp,
}: FacetCardProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, limit);
  const maxCount = maxCountProp ?? (items[0]?.count || 1);

  const handleClick = (name: string) => {
    onSelect(selected === name ? '' : name);
  };

  if (!items.length) {
    return (
      <section className="production-facet">
        <h3 className="production-facet__title">{title}</h3>
        <p className="production-facet__empty">Sin datos</p>
      </section>
    );
  }

  return (
    <section className="production-facet">
      <h3 className="production-facet__title">{title}</h3>
      <ul className="production-facet__list">
        {visible.map((item) => {
          const pct = Math.round((item.count / maxCount) * 100);
          const isActive = selected === item.name;
          return (
            <li key={item.name}>
              <button
                type="button"
                className={`production-facet__row ${isActive ? 'production-facet__row--active' : ''}`}
                onClick={() => handleClick(item.name)}
              >
                <span className="production-facet__label" title={item.label || item.name}>
                  {item.label || item.name}
                </span>
                <span className="production-facet__count">{item.count.toLocaleString()}</span>
                {showBars && (
                  <span
                    className="production-facet__bar"
                    style={{ width: `${Math.max(4, pct)}%` }}
                    aria-hidden
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {items.length > limit && (
        <button
          type="button"
          className="production-facet__more"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? 'Less…' : 'More…'}
        </button>
      )}
    </section>
  );
}

export function useFacetMax(items: FacetItem[]) {
  return useMemo(() => items.reduce((m, i) => Math.max(m, i.count), 0) || 1, [items]);
}
