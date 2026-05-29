import type { Work } from '../shared/types';
import { getAW, getOA } from './dataProcessing';
import { filterWorksBySdg, workMatchesSdg } from './odsResearchers';

/**
 * Obras ODS: primero all-works.json; si vacío, obras de perfiles OpenAlex (authors.*.works).
 * Alinea ranking con el contador institucional del hero.
 */
export function collectPublicationsForSdg(sdgName: string, sdgNum: number): Work[] {
  const local = filterWorksBySdg(getAW(), sdgName, sdgNum);
  if (local.length > 0) return local;

  const seen = new Set<string>();
  const merged: Work[] = [];

  const add = (w: Work) => {
    const key = ((w.d || w.t || '') + String(w.y || '')).toLowerCase().slice(0, 120);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(w);
  };

  Object.values(getOA().authors || {}).forEach((profile) => {
    (profile.works || []).forEach((w) => {
      if (workMatchesSdg(w, sdgName, sdgNum)) add(w);
    });
  });

  return merged;
}
