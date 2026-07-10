/**
 * DescubridorUniversalLayout — pantalla dedicada del descubridor universal.
 *
 * Corre EN PARALELO al portal institucional: sin la barra de tabs (TabNavigation),
 * con su propia cabecera e identidad. Incluye un chip de retorno dinámico que
 * vuelve al portal de la institución (leído de institution.config).
 *
 * La query se lee de la URL (?q=...), independiente del `search` compartido del
 * portal — así el descubridor universal no contamina el filtro de /perfiles ni
 * las demás tabs.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import TabDescubrirUniversal from '../../components/tabs/TabDescubrirUniversal';
import { INSTITUTION } from '../../config/institution.config';
import { useOpenResearcherProfile } from '../hooks/useOpenResearcherProfile';
import { useUI } from '../../context/UIContext';
import { findResearcherByOpenAlexAuthorId } from '../../utils/researcherProfile';
import { cleanOrcid } from '../../utils/helpers';
import {
  autocompleteItemToAuthorSummary,
  createDebouncedAutocomplete,
  getAuthorAutocompleteAction,
  getEntityStyle,
  type AutocompleteItem,
} from '../../services/discovery/autocomplete';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export default function DescubridorUniversalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';
  const urlAutor = searchParams.get('autor') || '';
  const { openLocalResearcherProfile, openOpenAlexProfile, openProfileById } = useOpenResearcherProfile();
  const { selected, openAlexAuthorId } = useUI();
  const deepLinkHandled = useRef(false);

  const [inputValue, setInputValue] = useState(urlQuery);
  const [suggestions, setSuggestions] = useState<AutocompleteItem[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const searchWrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedFetch = useMemo(
    () => createDebouncedAutocomplete(setSuggestions, 300),
    [],
  );

  useEffect(() => {
    setInputValue(urlQuery);
  }, [urlQuery]);

  // Abrir ficha desde enlace persistente ?autor=
  useEffect(() => {
    const autorId = urlAutor.trim();
    if (!autorId) {
      deepLinkHandled.current = false;
      return;
    }
    if (selected || openAlexAuthorId) return;
    if (deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    openProfileById(autorId);
  }, [urlAutor, selected, openAlexAuthorId, openProfileById]);

  // Mantener ?autor= sincronizado con el modal abierto
  useEffect(() => {
    if (location.pathname !== '/descubrir') return;

    const activeId = selected
      ? (cleanOrcid(selected.o) || (selected.id || '').trim() || null)
      : openAlexAuthorId;

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const currentAutor = next.get('autor') || '';

      if (activeId) {
        if (currentAutor === activeId) return prev;
        next.set('autor', activeId);
      } else {
        if (!currentAutor) return prev;
        next.delete('autor');
        deepLinkHandled.current = false;
      }
      return next;
    }, { replace: true });
  }, [selected, openAlexAuthorId, location.pathname, setSearchParams]);

  useEffect(() => {
    if (inputValue.trim().length >= 2) {
      debouncedFetch(inputValue);
    } else {
      setSuggestions([]);
    }
  }, [inputValue, debouncedFetch]);

  useEffect(() => {
    setDropdownOpen(suggestions.length > 0 && document.activeElement === inputRef.current);
  }, [suggestions]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const runSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < 2) return;
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('q', trimmed);
        return next;
      });
      setDropdownOpen(false);
      setActiveIndex(-1);
      setSuggestions([]);
    },
    [setSearchParams],
  );

  const resolveAuthorPick = useCallback(
    (item: AutocompleteItem) => {
      setInputValue(item.display_name);
      setDropdownOpen(false);
      setActiveIndex(-1);
      setSuggestions([]);

      const local = findResearcherByOpenAlexAuthorId(item.id);
      if (local) {
        openLocalResearcherProfile(local);
        return;
      }
      openOpenAlexProfile(autocompleteItemToAuthorSummary(item));
    },
    [openLocalResearcherProfile, openOpenAlexProfile],
  );

  const pickSuggestion = useCallback(
    (item: AutocompleteItem) => {
      if (item.entity_type === 'author') {
        resolveAuthorPick(item);
        return;
      }
      setInputValue(item.display_name);
      runSearch(item.display_name);
    },
    [resolveAuthorPick, runSearch],
  );

  const submit = () => {
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      pickSuggestion(suggestions[activeIndex]);
      return;
    }
    runSearch(inputValue);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      if (!dropdownOpen || suggestions.length === 0) return;
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
      return;
    }
    if (e.key === 'ArrowUp') {
      if (!dropdownOpen || suggestions.length === 0) return;
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
      return;
    }
    if (e.key === 'Escape') {
      setDropdownOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (e.key === 'Enter') {
      submit();
    }
  };

  return (
    <div className="discovery-universal-screen">
      <header className="discovery-universal-header">
        <button
          type="button"
          className="discovery-universal-header__back"
          onClick={() => navigate(INSTITUTION.returnPath)}
          aria-label={`Volver al portal de ${INSTITUTION.fullName}`}
        >
          ← Portal {INSTITUTION.shortName}
        </button>

        <div className="discovery-universal-header__brand">
          <h1 className="discovery-universal-header__title">Descubridor Universal</h1>
          <p className="discovery-universal-header__subtitle">
            Explora 474 millones de obras en OpenAlex
          </p>
        </div>

        <div
          className="discovery-universal-header__search"
          ref={searchWrapRef}
        >
          <div className="discovery-universal-header__input-wrap">
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded={dropdownOpen}
              aria-autocomplete="list"
              aria-controls="discovery-autocomplete-list"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setActiveIndex(-1);
              }}
              onFocus={() => {
                if (suggestions.length > 0) setDropdownOpen(true);
              }}
              onKeyDown={onKeyDown}
              placeholder="Buscar en todo el conocimiento del mundo…"
              className="discovery-universal-header__input"
              autoFocus
            />

            {dropdownOpen && suggestions.length > 0 && (
              <ul
                id="discovery-autocomplete-list"
                role="listbox"
                className="discovery-autocomplete"
              >
                {suggestions.map((item, idx) => {
                  const style = getEntityStyle(item.entity_type);
                  const authorAction =
                    item.entity_type === 'author' ? getAuthorAutocompleteAction(item.id) : null;
                  const meta =
                    item.works_count > 0
                      ? `${formatCount(item.works_count)} obras`
                      : item.cited_by_count > 0
                        ? `${formatCount(item.cited_by_count)} citas`
                        : null;

                  return (
                    <li
                      key={`${item.entity_type}-${item.id}`}
                      role="option"
                      aria-selected={idx === activeIndex}
                      className={
                        idx === activeIndex
                          ? 'discovery-autocomplete__item discovery-autocomplete__item--active'
                          : 'discovery-autocomplete__item'
                      }
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickSuggestion(item)}
                      onMouseEnter={() => setActiveIndex(idx)}
                    >
                      <span
                        className="discovery-autocomplete__icon"
                        style={{ backgroundColor: style.color }}
                        aria-hidden
                      >
                        {style.icon}
                      </span>
                      <span className="discovery-autocomplete__body">
                        <span className="discovery-autocomplete__name">
                          {item.display_name}
                        </span>
                        {(item.hint || meta || authorAction) && (
                          <span className="discovery-autocomplete__hint">
                            {[style.label, item.hint, meta, authorAction].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <button type="button" onClick={submit} className="discovery-universal-header__btn">
            Buscar
          </button>
        </div>
      </header>

      <main className="discovery-universal-main">
        <TabDescubrirUniversal />
      </main>
    </div>
  );
}
