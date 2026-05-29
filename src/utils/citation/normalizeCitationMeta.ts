import type { Work } from '../../shared/types';
import { stripTags } from '../helpers';
import { getWorkAccessUrl } from '../workAccess';

export interface ParsedAuthor {
  last: string;
  initials: string;
  /** Apellido, Iniciales (APA) */
  apa: string;
  /** A. Apellido (IEEE) */
  ieee: string;
  /** Apellido II (Vancouver) */
  vancouver: string;
  /** Apellido, Nombre (BibTeX/RIS) */
  bibtex: string;
}

export interface NormalizedCitationMeta {
  title: string;
  year: number | null;
  authors: ParsedAuthor[];
  authorStrings: string[];
  journal: string;
  volume: string;
  issue: string;
  pages: string;
  doi: string;
  doiUrl: string;
  url: string;
  docType: string;
  incomplete: boolean;
  missing: string[];
}

type WorkMeta = Work & {
  vol?: string | number;
  volume?: string | number;
  issue?: string | number;
  num?: string | number;
  pages?: string;
  pg?: string;
  page?: string;
};

export function cleanCitationDoi(raw?: string): string {
  const d = (raw || '').trim();
  if (!d) return '';
  return d.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim();
}

export function safeCitationYear(work: Work): number | null {
  const y = work.y;
  if (y == null || Number.isNaN(Number(y))) return null;
  const n = Number(y);
  if (n < 1600 || n > 2100) return null;
  return n;
}

export function parseAuthorName(raw: string): ParsedAuthor {
  const name = (raw || '').replace(/\s+/g, ' ').trim();
  if (!name) {
    return {
      last: 'Anónimo',
      initials: '',
      apa: 'Anónimo',
      ieee: 'Anónimo',
      vancouver: 'Anónimo',
      bibtex: 'Anónimo',
    };
  }

  if (name.includes(',')) {
    const [lastPart, ...restParts] = name.split(',').map((p) => p.trim());
    const firstTokens = restParts.join(' ').split(/\s+/).filter(Boolean);
    const initials = firstTokens.map((t) => `${t.charAt(0).toUpperCase()}.`).join(' ');
    const ieeeInitials = firstTokens.map((t) => `${t.charAt(0).toUpperCase()}.`).join(' ');
    const vancouverInitials = firstTokens.map((t) => t.charAt(0).toUpperCase()).join('');
    const firstNames = restParts.join(' ').trim();
    return {
      last: lastPart,
      initials,
      apa: `${lastPart}, ${initials}`.trim(),
      ieee: `${ieeeInitials} ${lastPart}`.trim(),
      vancouver: `${lastPart} ${vancouverInitials}`.trim(),
      bibtex: `${lastPart}, ${firstNames || initials}`.trim(),
    };
  }

  const parts = name.split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1];
  const firstParts = parts.slice(0, -1);
  const initials = firstParts.map((p) => `${p.charAt(0).toUpperCase()}.`).join(' ');
  const ieeeInitials = firstParts.map((p) => `${p.charAt(0).toUpperCase()}.`).join(' ');
  const vancouverInitials = firstParts.map((p) => p.charAt(0).toUpperCase()).join('');

  return {
    last,
    initials,
    apa: `${last}, ${initials}`.trim(),
    ieee: `${ieeeInitials} ${last}`.trim(),
    vancouver: `${last} ${vancouverInitials}`.trim(),
    bibtex: `${last}, ${firstParts.join(' ')}`.trim(),
  };
}

function strField(v: string | number | undefined | null): string {
  if (v == null) return '';
  return String(v).trim();
}

export function normalizeCitationMeta(work: Work | null | undefined): NormalizedCitationMeta {
  const w = (work || {}) as WorkMeta;
  const title = stripTags(w.t || w.title || '').trim();
  const year = safeCitationYear(w);
  const authorStrings = (w.a || []).map((a) => a.trim()).filter(Boolean);
  const authors = authorStrings.length ? authorStrings.map(parseAuthorName) : [];
  const doi = cleanCitationDoi(w.d || w.doi);
  const doiUrl = doi ? `https://doi.org/${doi}` : '';
  const url = getWorkAccessUrl(w) || w.u || w.url || doiUrl || '';
  const journal = strField(w.s || w.pub || w.cr_pub);
  const volume = strField(w.vol ?? w.volume);
  const issue = strField(w.issue ?? w.num);
  const pages = strField(w.pages ?? w.pg ?? w.page);
  const docType = strField(w.tp) || 'article';

  const missing: string[] = [];
  if (!title) missing.push('título');
  if (!year) missing.push('año');
  if (!authors.length) missing.push('autores');
  if (!journal) missing.push('revista/fuente');

  const incomplete = !title || !year;

  return {
    title,
    year,
    authors,
    authorStrings,
    journal,
    volume,
    issue,
    pages,
    doi,
    doiUrl,
    url,
    docType,
    incomplete,
    missing,
  };
}

export function bibtexEscape(value: string): string {
  return value.replace(/[{}\\]/g, '\\$&');
}

export function slugBibtexKey(meta: NormalizedCitationMeta): string {
  const last = meta.authors[0]?.last || 'anon';
  const year = meta.year ?? 'nd';
  const slug = `${last}${year}`.toLowerCase().replace(/[^a-z0-9]/g, '');
  return slug || 'work';
}
