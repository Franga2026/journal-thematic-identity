/**
 * authorWorksLoader.ts — Carga las obras de UN investigador bajo demanda.
 *
 * Reemplaza el patrón `getAW().filter(workHasResearcher)` que obligaba a
 * tener las ~9.127 obras (60 MB) en el bundle. Ahora se piden solo las obras
 * del investigador que se está viendo (~200 KB), con caché en memoria.
 *
 * Requiere: `npm run split:works` → `public/data/works/{id}.json` + `_index.json`
 * (clave = `data.json` → `r.id`, formato RUT).
 */

import type { Work } from '../shared/types';

const cache = new Map<string, Work[]>();
const inFlight = new Map<string, Promise<Work[]>>();

let worksIndex: Record<string, number> | null = null;

/**
 * Carga el índice de obras por investigador (ligero).
 * Útil para contadores sin descargar las obras.
 */
export async function loadWorksIndex(): Promise<Record<string, number>> {
  if (worksIndex) return worksIndex;
  const res = await fetch('/data/works/_index.json');
  if (!res.ok) throw new Error('No se pudo cargar el índice de obras');
  worksIndex = (await res.json()) as Record<string, number>;
  return worksIndex;
}

/**
 * Devuelve las obras de un investigador (por su id / RUT del catálogo).
 * Cachea en memoria: la segunda llamada es instantánea.
 *
 * @param researcherId el `id` del investigador (`data.json` → `r.id`)
 */
export async function loadAuthorWorks(researcherId: string): Promise<Work[]> {
  const id = String(researcherId || '').trim();
  if (!id) return [];

  const cached = cache.get(id);
  if (cached) return cached;

  const pending = inFlight.get(id);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const res = await fetch(`/data/works/${encodeURIComponent(id)}.json`);
      if (!res.ok) {
        if (res.status === 404) {
          cache.set(id, []);
          return [];
        }
        throw new Error(`Error al cargar obras de ${id}: ${res.status}`);
      }
      const works = (await res.json()) as Work[];
      const list = Array.isArray(works) ? works : [];
      cache.set(id, list);
      return list;
    } finally {
      inFlight.delete(id);
    }
  })();

  inFlight.set(id, promise);
  return promise;
}

/** ¿Cuántas obras tiene un investigador? (sin descargarlas) */
export async function getWorksCount(researcherId: string): Promise<number> {
  const idx = await loadWorksIndex();
  return idx[String(researcherId).trim()] ?? 0;
}

/** Limpia la caché (tests / cambio de contexto). */
export function clearWorksCache(): void {
  cache.clear();
  inFlight.clear();
  worksIndex = null;
}

/** @internal — inyección de índice sin fetch (tests). */
export function setWorksIndexForTests(index: Record<string, number> | null): void {
  worksIndex = index;
}

/** @internal — inyección de obras sin fetch (tests). */
export function setAuthorWorksForTests(researcherId: string, works: Work[]): void {
  cache.set(String(researcherId).trim(), works);
}
