import { useCallback, useMemo, type ChangeEvent } from 'react';
import { startTransition } from 'react';
import { useTransitionNavigate } from '../../app/hooks/useTransitionNavigate';
import { useUI } from '../../context/UIContext';
import { useFilters } from '../../context/FiltersContext';
import { getSearchIntentMeta } from '../../utils/searchIntent';
import type { SearchType } from '../../shared/types';

export default function Header() {
  const navigate = useTransitionNavigate();
  const {
    search,
    setSearch,
    searchType,
    setSearchType,
    resetPage,
    setDescubridorQuartile,
    setDescubridorAccess,
  } = useUI();
  const { setOnlyOrcid, setSdgFilter } = useFilters();

  const intentMeta = useMemo(() => getSearchIntentMeta(search), [search]);

  const clearDescubridorPresets = useCallback(() => {
    setDescubridorQuartile('');
    setDescubridorAccess('');
  }, [setDescubridorQuartile, setDescubridorAccess]);

  const applySearch = useCallback(
    (value: string) => {
      const meta = getSearchIntentMeta(value);
      startTransition(() => {
        setSearch(value);
        setOnlyOrcid(false);
        setSdgFilter('');
        resetPage();
        clearDescubridorPresets();
        navigate(meta.route);
      });
    },
    [setSearch, setOnlyOrcid, setSdgFilter, resetPage, clearDescubridorPresets, navigate],
  );

  const handleSearch = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      applySearch(e.target.value);
    },
    [applySearch],
  );

  return (
    <header className="header header--institutional" role="banner">
      <div className="header__inner">
        <div className="header__subtitle">Universidad de Tarapacá · Arica, Chile</div>
        <h1 className="header__title">
          Portal de Investigadores de la
          <br />
          <strong>Universidad de Tarapacá</strong>
        </h1>

        <div className="search-wrapper">
          <div className="search-tabs" role="tablist" aria-label="Tipo de búsqueda">
            {['concepto', 'texto'].map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={searchType === t}
                className={`search-tabs__btn ${searchType === t ? 'search-tabs__btn--active' : ''}`}
                onClick={() => setSearchType(t as SearchType)}
              >
                {t === 'concepto' ? 'Concepto' : 'Texto coincidente'}
              </button>
            ))}
          </div>
          <div className="search-bar">
            <input
              className="search-bar__input"
              placeholder="Buscar publicaciones, investigadores, revistas o DOI..."
              value={search}
              onChange={handleSearch}
              aria-label="Buscar en el portal UTA"
              aria-describedby="search-intent-hint"
            />
            <button
              type="button"
              className="search-bar__btn"
              aria-label="Buscar"
              onClick={() => applySearch(search)}
            >
              Buscar
            </button>
          </div>
          {search.trim() && (
            <p id="search-intent-hint" className="search-hint" aria-live="polite">
              <span className="search-hint__badge">{intentMeta.label}</span>
              {intentMeta.hint}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
