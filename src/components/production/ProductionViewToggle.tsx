export type ProductionViewMode = 'list' | 'cards';

function IconRows() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

interface ProductionViewToggleProps {
  value: ProductionViewMode;
  onChange: (mode: ProductionViewMode) => void;
}

export default function ProductionViewToggle({ value, onChange }: ProductionViewToggleProps) {
  return (
    <div className="prod-view-toggle" role="group" aria-label="Vista de obras">
      <button
        type="button"
        className={`prod-view-toggle__btn${value === 'list' ? ' prod-view-toggle__btn--active' : ''}`}
        onClick={() => onChange('list')}
        aria-pressed={value === 'list'}
      >
        <IconRows />
        Lista
      </button>
      <button
        type="button"
        className={`prod-view-toggle__btn${value === 'cards' ? ' prod-view-toggle__btn--active' : ''}`}
        onClick={() => onChange('cards')}
        aria-pressed={value === 'cards'}
      >
        <IconGrid />
        Tarjetas
      </button>
    </div>
  );
}
