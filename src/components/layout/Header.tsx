import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUI } from '../../context/UIContext';
import { useFilters } from '../../context/FiltersContext';
import type { SearchType } from '../../shared/types';

export default function Header() {
  const navigate = useNavigate();
  const { search, setSearch, searchType, setSearchType, resetPage } = useUI();
  const { setOnlyOrcid, setSdgFilter } = useFilters();

  const handleSearch = useCallback(
    (e) => {
      setSearch(e.target.value);
      setOnlyOrcid(false);
      setSdgFilter('');
      resetPage();
      navigate('/perfiles');
    },
    [setSearch, setOnlyOrcid, setSdgFilter, resetPage, navigate]
  );

  return (
    <header className="header" role="banner">
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
              placeholder="Buscar por nombre, ORCID o email..."
              value={search}
              onChange={handleSearch}
              aria-label="Buscar investigadores"
            />
            <button className="search-bar__btn" aria-label="Buscar">
              Buscar
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
