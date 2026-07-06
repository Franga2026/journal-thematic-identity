/**
 * TabDescubrirUniversal — Descubridor bibliográfico universal (OpenAlex).
 *
 * Busca en TODA la base de OpenAlex (474M obras) a través del proxy FastAPI.
 *
 * IMPORTANTE: la query se lee de la URL (?q=...) vía useSearchParams, NO del
 * `search` compartido del UIContext. Esto evita contaminar el filtro de
 * /perfiles y las demás tabs del portal institucional.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import WorkCard from '../cards/WorkCard';
import {
  searchWorks,
  workResultToWork,
  DiscoveryError,
  type SearchResponse,
  type WorkResult,
} from '../../services/discovery/universalSearch';

type SortMode = 'relevance' | 'citations' | 'date';

export default function TabDescubrirUniversal() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';

  const [sort, setSort] = useState<SortMode>('relevance');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastKey = useRef<string>('');

  const runSearch = useCallback(
    async (query: string, pageArg: number, sortArg: SortMode) => {
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        setData(null);
        setError(null);
        return;
      }
      const key = `${trimmed.toLowerCase()}|${pageArg}|${sortArg}`;
      if (key === lastKey.current) return;
      lastKey.current = key;

      setLoading(true);
      setError(null);
      try {
        const res = await searchWorks({
          q: trimmed,
          page: pageArg,
          perPage: 25,
          sort: sortArg,
        });
        setData(res);
      } catch (e) {
        const msg =
          e instanceof DiscoveryError
            ? e.message
            : 'Ocurrió un error al buscar. Intenta nuevamente.';
        setError(msg);
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Cuando cambia la query de la URL, buscar (página 1).
  useEffect(() => {
    if (q && q.trim().length >= 2) {
      setPage(1);
      runSearch(q, 1, sort);
    } else {
      setData(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const handleSortChange = (next: SortMode) => {
    setSort(next);
    setPage(1);
    lastKey.current = '';
    runSearch(q, 1, next);
  };

  const goToPage = (next: number) => {
    if (next < 1) return;
    setPage(next);
    runSearch(q, next, sort);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPages = data ? Math.ceil(data.total / data.per_page) : 0;

  return (
    <div className="tab-descubrir-universal">
      {/* Controles de orden */}
      {data && (
        <div className="descubrir-universal__controls">
          <span className="descubrir-universal__meta">
            {data.total.toLocaleString('es-CL')} resultados
            {data.cached && ' · desde caché'}
          </span>
          <div className="descubrir-universal__sort">
            {(['relevance', 'citations', 'date'] as SortMode[]).map((s) => (
              <button
                key={s}
                onClick={() => handleSortChange(s)}
                className={`descubrir-universal__sort-btn${sort === s ? ' is-active' : ''}`}
              >
                {s === 'relevance' ? 'Relevancia' : s === 'citations' ? 'Más citadas' : 'Recientes'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Estados */}
      {loading && (
        <div className="descubrir-universal__state">Buscando en OpenAlex…</div>
      )}
      {error && !loading && (
        <div className="descubrir-universal__state descubrir-universal__state--error">
          {error}
        </div>
      )}
      {!loading && !error && data && data.results.length === 0 && (
        <div className="descubrir-universal__state">
          No se encontraron resultados para “{data.query}”.
        </div>
      )}
      {!loading && !error && !data && (
        <div className="descubrir-universal__state">
          Escribe un término y presiona Buscar para explorar 474 millones de obras.
        </div>
      )}

      {/* Resultados */}
      {!loading && !error && data && data.results.length > 0 && (
        <>
          <div className="descubrir-universal__grid">
            {data.results.map((r: WorkResult) => (
              <WorkCard
                key={r.openalex_id}
                w={workResultToWork(r)}
                variant="openalex"
              />
            ))}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="descubrir-universal__pagination">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="descubrir-universal__page-btn"
              >
                Anterior
              </button>
              <span className="descubrir-universal__page-info">
                Página {page} de {totalPages.toLocaleString('es-CL')}
              </span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="descubrir-universal__page-btn"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
