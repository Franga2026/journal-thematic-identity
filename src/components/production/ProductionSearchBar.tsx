interface ProductionSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export default function ProductionSearchBar({
  value,
  onChange,
  resultCount,
  totalCount,
  onClearFilters,
  hasActiveFilters,
}: ProductionSearchBarProps) {
  return (
    <div className="production-search">
      <div className="production-search__row">
        <input
          type="search"
          className="production-search__input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Buscar por título, autor o fuente…"
          aria-label="Buscar publicaciones"
        />
        {hasActiveFilters && (
          <button type="button" className="btn btn--ghost production-search__clear" onClick={onClearFilters}>
            Limpiar filtros
          </button>
        )}
      </div>
      <p className="production-search__meta">
        <strong>{resultCount.toLocaleString()}</strong> resultados
        {resultCount !== totalCount && (
          <span> de {totalCount.toLocaleString()} publicaciones</span>
        )}
      </p>
    </div>
  );
}
