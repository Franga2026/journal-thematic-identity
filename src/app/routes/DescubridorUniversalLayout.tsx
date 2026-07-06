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

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TabDescubrirUniversal from '../../components/tabs/TabDescubrirUniversal';
import { INSTITUTION } from '../../config/institution.config';

export default function DescubridorUniversalLayout() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';

  const [inputValue, setInputValue] = useState(urlQuery);

  // Mantener el input sincronizado si cambia la URL (ej. navegación directa)
  useEffect(() => {
    setInputValue(urlQuery);
  }, [urlQuery]);

  const submit = () => {
    const q = inputValue.trim();
    if (q.length < 2) return;
    setSearchParams({ q });
  };

  return (
    <div className="discovery-universal-screen">
      {/* Cabecera propia — sin barra de tabs institucional */}
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

        <div className="discovery-universal-header__search">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            placeholder="Buscar en todo el conocimiento del mundo…"
            className="discovery-universal-header__input"
            autoFocus
          />
          <button onClick={submit} className="discovery-universal-header__btn">
            Buscar
          </button>
        </div>
      </header>

      {/* Resultados */}
      <main className="discovery-universal-main">
        <TabDescubrirUniversal />
      </main>
    </div>
  );
}
