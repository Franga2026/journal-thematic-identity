// Cálculo de métricas de COLABORACIÓN para un investigador, a partir del corpus
// all-works.json ENRIQUECIDO (authorships[].institutions[] con country_code/ror/type
// y percentile{ is_in_top_10_percent, is_in_top_1_percent }).
//
// Porta 1:1 la lógica de scripts/collab-metrics.mjs (validada con Rothhammer).
// El caller pasa el array de obras ya cargado (p. ej. getAW() en el server).

import type { Work } from '../../shared/types';
import { isUtaRor } from '../../constants/utaInstitution';

export interface Institution {
  display_name?: string;
  ror?: string;
  country_code?: string;
  type?: string;
}
export interface Authorship {
  author?: { id?: string; display_name?: string; orcid?: string | null };
  institutions?: Institution[];
  countries?: string[];
}
export interface Percentile {
  value?: number | null;
  is_in_top_1_percent?: boolean;
  is_in_top_10_percent?: boolean;
}
export type CollabWork = Work & {
  publication_year?: number;
  anio?: number;
  year?: number;
  py?: number;
  citation_normalized_percentile?: Percentile;
};

export interface Coautor {
  nombre: string | null;
  orcid: string | null;
  n_obras: number;
  pais: string | null;
  institucion: string | null;
}
export interface CollabMetrics {
  orcid: string;
  nombre: string | null;
  periodo: { from: number | null; to: number | null };
  n_obras: number;
  n_clasificables: number;
  n_sin_afiliacion: number;
  colaboracion: {
    internacional: { n: number; pct: number };
    nacional: { n: number; pct: number };
    institucional: { n: number; pct: number };
  };
  pct_colab_intl: number;
  n_paises: number;
  paises_colaboradores: { cc: string; n: number }[];
  intersectorial_obras: Record<string, number>;
  n_obras_con_empresa: number;
  excelencia: {
    obras_con_percentil: number;
    top10: { n: number; pct: number };
    top1: { n: number; pct: number };
  };
  top_coautores: Coautor[];
}

export const normOrcid = (o?: string | null): string | null => {
  if (!o) return null;
  const m = String(o).match(/(\d{4}-\d{4}-\d{4}-\d{3}[\dX])/i);
  return m ? m[1].toUpperCase() : null;
};

const yearOf = (w: CollabWork): number | null =>
  (w.publication_year ?? w.anio ?? w.year ?? w.py ?? w.y ?? null) as number | null;

const isUTA = (i: Institution): boolean =>
  isUtaRor(i.ror) || /tarapac/i.test(i.display_name || '');

const modeKey = (obj: Record<string, number>): string | null => {
  let k: string | null = null;
  let max = -1;
  for (const [key, v] of Object.entries(obj)) {
    if (v > max) {
      max = v;
      k = key;
    }
  }
  return k;
};

const pct = (n: number, d: number): number => (d ? +((100 * n) / d).toFixed(1) : 0);

/** Normaliza el contenido de all-works.json a un array plano de obras. */
export function normWorks(raw: unknown): CollabWork[] {
  if (Array.isArray(raw)) return raw as CollabWork[];
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    if (Array.isArray(r.works)) return r.works as CollabWork[];
    const flat: CollabWork[] = [];
    for (const v of Object.values(r)) {
      if (Array.isArray(v)) flat.push(...(v as CollabWork[]));
      else if (v && typeof v === 'object' && Array.isArray((v as { works?: unknown }).works)) {
        flat.push(...((v as { works: CollabWork[] }).works));
      } else if (v && typeof v === 'object' && (v as CollabWork).authorships) {
        flat.push(v as CollabWork);
      }
    }
    if (flat.length) return flat;
  }
  return [];
}

export function computeCollabMetrics(
  works: CollabWork[],
  orcidRaw: string,
  opts: { from?: number | null; to?: number | null } = {},
): CollabMetrics {
  const TARGET = normOrcid(orcidRaw);
  if (!TARGET) throw new Error('ORCID inválido: ' + orcidRaw);
  const { from = null, to = null } = opts;

  let mine = works.filter((w) =>
    (w.authorships || []).some((a) => normOrcid(a.author?.orcid) === TARGET),
  );
  const allYears = mine.map(yearOf).filter((y): y is number => y != null).sort((a, b) => a - b);
  if (from || to) {
    mine = mine.filter((w) => {
      const y = yearOf(w);
      return y != null && (!from || y >= from) && (!to || y <= to);
    });
  }

  let NAME: string | null = null;
  for (const w of mine) {
    for (const a of w.authorships || []) {
      if (normOrcid(a.author?.orcid) === TARGET) {
        NAME = a.author?.display_name ?? null;
        break;
      }
    }
    if (NAME) break;
  }

  let nClasif = 0;
  let nSin = 0;
  let nIntl = 0;
  let nNac = 0;
  let nInst = 0;
  const paisCount: Record<string, number> = {};
  const sectorObras: Record<string, number> = {
    education: 0,
    company: 0,
    government: 0,
    healthcare: 0,
    facility: 0,
    archive: 0,
    nonprofit: 0,
    other: 0,
  };
  let nTop10 = 0;
  let nTop1 = 0;
  let nConPct = 0;
  const coauth = new Map<
    string,
    {
      nombre: string | null;
      orcid: string | null;
      n: number;
      cc: Record<string, number>;
      inst: Record<string, number>;
    }
  >();

  for (const w of mine) {
    const insts: Institution[] = [];
    for (const a of w.authorships || []) {
      for (const i of a.institutions || []) insts.push(i);
    }

    if (insts.length === 0) {
      nSin++;
    } else {
      nClasif++;
      const countries = [...new Set(insts.map((i) => i.country_code).filter(Boolean) as string[])];
      const instKeys = [...new Set(insts.map((i) => i.ror || i.display_name).filter(Boolean) as string[])];
      if (countries.length >= 2) nIntl++;
      else if (instKeys.length >= 2) nNac++;
      else nInst++;

      for (const cc of new Set(countries)) {
        if (cc && cc !== 'CL') paisCount[cc] = (paisCount[cc] || 0) + 1;
      }

      const tiposObra = new Set<string>();
      for (const i of insts) {
        if (!isUTA(i) && i.type) tiposObra.add(i.type);
      }
      for (const t of tiposObra) {
        if (sectorObras[t] !== undefined) sectorObras[t]++;
        else sectorObras.other++;
      }
    }

    const p = w.percentile || w.citation_normalized_percentile;
    if (p && (p.value != null || p.is_in_top_10_percent != null)) {
      nConPct++;
      if (p.is_in_top_10_percent) nTop10++;
      if (p.is_in_top_1_percent) nTop1++;
    }

    const seen = new Set<string>();
    for (const a of w.authorships || []) {
      const o = normOrcid(a.author?.orcid);
      const nm = a.author?.display_name ?? null;
      if (o === TARGET || (NAME && nm === NAME)) continue;
      const key = o || nm;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (!coauth.has(key)) {
        coauth.set(key, { nombre: nm, orcid: o, n: 0, cc: {}, inst: {} });
      }
      const rec = coauth.get(key)!;
      rec.n++;
      rec.nombre = nm || rec.nombre;
      rec.orcid = rec.orcid || o;
      for (const i of a.institutions || []) {
        if (i.country_code) rec.cc[i.country_code] = (rec.cc[i.country_code] || 0) + 1;
        if (i.display_name) rec.inst[i.display_name] = (rec.inst[i.display_name] || 0) + 1;
      }
    }
  }

  const paises = Object.entries(paisCount)
    .map(([cc, n]) => ({ cc, n }))
    .sort((a, b) => b.n - a.n);
  const topCo: Coautor[] = [...coauth.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 15)
    .map((r) => ({
      nombre: r.nombre,
      orcid: r.orcid,
      n_obras: r.n,
      pais: modeKey(r.cc),
      institucion: modeKey(r.inst),
    }));

  return {
    orcid: TARGET,
    nombre: NAME,
    periodo: { from: from || (allYears[0] ?? null), to: to || (allYears[allYears.length - 1] ?? null) },
    n_obras: mine.length,
    n_clasificables: nClasif,
    n_sin_afiliacion: nSin,
    colaboracion: {
      internacional: { n: nIntl, pct: pct(nIntl, nClasif) },
      nacional: { n: nNac, pct: pct(nNac, nClasif) },
      institucional: { n: nInst, pct: pct(nInst, nClasif) },
    },
    pct_colab_intl: pct(nIntl, nClasif),
    n_paises: paises.length,
    paises_colaboradores: paises,
    intersectorial_obras: sectorObras,
    n_obras_con_empresa: sectorObras.company,
    excelencia: {
      obras_con_percentil: nConPct,
      top10: { n: nTop10, pct: pct(nTop10, nConPct) },
      top1: { n: nTop1, pct: pct(nTop1, nConPct) },
    },
    top_coautores: topCo,
  };
}
