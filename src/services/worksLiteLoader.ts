/**
 * worksLiteLoader.ts — Carga el corpus LIGERO de obras para las tabs globales.
 *
 * Reemplaza el `import allWorks from '../all-works.json'` (60 MB en el bundle,
 * causa del OOM) por un fetch asíncrono de `public/data/works-lite.json` (~5 MB),
 * que el navegador además cachea.
 *
 * Requiere: `npm run build:works-lite`
 * Las tabs que usaban `getAW()` pueden migrar a `loadWorksLite()` / `getWorksLite()`.
 */

import type { Work } from '../shared/types';

let corpus: Work[] | null = null;
let loading: Promise<Work[]> | null = null;

/**
 * Carga el corpus ligero (una sola vez). Las llamadas concurrentes comparten
 * la misma promesa: nunca se descarga dos veces.
 */
export async function loadWorksLite(): Promise<Work[]> {
  if (corpus) return corpus;
  if (loading) return loading;

  loading = (async () => {
    try {
      const res = await fetch('/data/works-lite.json');
      if (!res.ok) throw new Error(`No se pudo cargar el corpus: ${res.status}`);
      const data = (await res.json()) as Work[];
      corpus = Array.isArray(data) ? data : [];
      return corpus;
    } finally {
      loading = null;
    }
  })();

  return loading;
}

/**
 * Devuelve el corpus si ya está cargado; null si aún no.
 * Para usarlo de forma síncrona en componentes que ya esperaron la carga.
 */
export function getWorksLite(): Work[] | null {
  return corpus;
}

/** ¿Está el corpus listo? */
export function isWorksLiteReady(): boolean {
  return corpus !== null;
}

/** Libera el corpus de memoria (útil al cambiar de institución en el SaaS). */
export function clearWorksLite(): void {
  corpus = null;
  loading = null;
}

/** @internal — tests. */
export function setWorksLiteForTests(works: Work[] | null): void {
  corpus = works;
  loading = null;
}
