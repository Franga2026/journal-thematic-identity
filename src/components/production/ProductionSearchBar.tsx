import type { SortKey } from '../../utils/sortWorks';

interface ProductionSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  sortBy: SortKey;
  onSortChange: (sortBy: SortKey) => void;
}

export default function ProductionSearchBar({
  value,
  onChange,
  resultCount,
  totalCount,
  onClearFilters,
  hasActiveFilters,
  sortBy,
  onSortChange,
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
      <div className="production-search__meta-row">
        <p className="production-search__meta">
          <strong>{resultCount.toLocaleString()}</strong> resultados
          {resultCount !== totalCount && (
            <span> de {totalCount.toLocaleString()} publicaciones</span>
          )}
        </p>
        <div className="descubridor__sort">
          <label htmlFor="production-sort" className="descubridor__sort-label">Ordenar por</label>
          <select
            id="production-sort"
            className="descubridor__sort-select"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as SortKey)}
          >
            <option value="citations">Más citadas</option>
            <option value="fwci">Mayor FWCI</option>
            <option value="year">Año (recientes)</option>
            <option value="quartile">Mejor cuartil</option>
          </select>
        </div>
      </div>
    </div>
  );
}
