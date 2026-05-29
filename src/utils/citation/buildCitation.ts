import type { Work } from '../../shared/types';
import {
  bibtexEscape,
  normalizeCitationMeta,
  slugBibtexKey,
  type NormalizedCitationMeta,
} from './normalizeCitationMeta';

export type CitationFormat = 'apa' | 'ieee' | 'vancouver' | 'bibtex' | 'ris';

export interface WorkCitations {
  apa: string;
  ieee: string;
  vancouver: string;
  bibtex: string;
  ris: string;
  incomplete?: boolean;
}

const INCOMPLETE_TAG = ' [Cita incompleta]';

function withIncomplete(text: string, incomplete: boolean): string {
  if (!incomplete) return text;
  if (text.includes('Cita incompleta')) return text;
  return `${text}${INCOMPLETE_TAG}`;
}

function joinApaAuthors(authors: NormalizedCitationMeta['authors']): string {
  if (!authors.length) return '';
  if (authors.length === 1) return authors[0].apa;
  if (authors.length === 2) return `${authors[0].apa}, & ${authors[1].apa}`;
  const head = authors.slice(0, -1).map((a) => a.apa).join(', ');
  return `${head}, & ${authors[authors.length - 1].apa}`;
}

function joinIeeeAuthors(authors: NormalizedCitationMeta['authors']): string {
  if (!authors.length) return '';
  if (authors.length === 1) return authors[0].ieee;
  if (authors.length === 2) return `${authors[0].ieee} and ${authors[1].ieee}`;
  const head = authors.slice(0, -1).map((a) => a.ieee).join(', ');
  return `${head}, and ${authors[authors.length - 1].ieee}`;
}

function joinVancouverAuthors(authors: NormalizedCitationMeta['authors']): string {
  if (!authors.length) return '';
  return authors.map((a) => a.vancouver).join(', ');
}

function apaJournalTail(meta: NormalizedCitationMeta): string {
  const parts: string[] = [];
  if (meta.journal) {
    let journalPart = meta.journal;
    if (meta.volume) {
      journalPart += `, ${meta.volume}`;
      if (meta.issue) journalPart += `(${meta.issue})`;
    }
    if (meta.pages) journalPart += `, ${meta.pages}`;
    parts.push(journalPart);
  }
  if (meta.doiUrl) parts.push(meta.doiUrl);
  else if (meta.url && !meta.doiUrl) parts.push(meta.url);
  return parts.join('. ').replace(/\.\./g, '.');
}

export function buildApaCitation(meta: NormalizedCitationMeta): string {
  const authors = joinApaAuthors(meta.authors);
  const year = meta.year ?? 's.f.';
  const title = meta.title || 'Sin título';
  const tail = apaJournalTail(meta);

  let cite = authors
    ? `${authors} (${year}). ${title}.`
    : `${title}. (${year}).`;

  if (tail) cite += ` ${tail}`;
  if (!cite.endsWith('.')) cite += '.';

  return withIncomplete(cite, meta.incomplete);
}

export function buildIeeeCitation(meta: NormalizedCitationMeta): string {
  const authors = joinIeeeAuthors(meta.authors);
  const title = meta.title || 'Sin título';
  const year = meta.year ?? 'n.d.';
  const journal = meta.journal || 'Sin fuente';

  const volPart = meta.volume ? `, vol. ${meta.volume}` : '';
  const noPart = meta.issue ? `, no. ${meta.issue}` : '';
  const pagesPart = meta.pages ? `, pp. ${meta.pages}` : '';
  const doiPart = meta.doi ? `, doi: ${meta.doi}` : '';

  const authorPrefix = authors ? `${authors}, ` : '';
  return withIncomplete(
    `${authorPrefix}"${title}," ${journal}${volPart}${noPart}${pagesPart}, ${year}${doiPart}.`,
    meta.incomplete
  );
}

export function buildVancouverCitation(meta: NormalizedCitationMeta): string {
  const authors = joinVancouverAuthors(meta.authors);
  const title = meta.title || 'Sin título';
  const journal = meta.journal || 'Sin fuente';
  const year = meta.year ?? 's.f.';

  let volIssue = '';
  if (meta.volume) {
    volIssue = meta.issue ? `${meta.volume}(${meta.issue})` : `${meta.volume}`;
  }
  const pagesPart = meta.pages ? `:${meta.pages}` : '';
  const doiPart = meta.doi ? ` doi:${meta.doi}` : '';

  const authorPrefix = authors ? `${authors}. ` : '';
  const tail = volIssue ? `${year};${volIssue}${pagesPart}.` : `${year}.`;

  return withIncomplete(
    `${authorPrefix}${title}. ${journal}. ${tail}${doiPart}`.replace(/\s+/g, ' ').trim(),
    meta.incomplete
  );
}

export function buildBibtexCitation(meta: NormalizedCitationMeta): string {
  const key = slugBibtexKey(meta);
  const type = meta.docType === 'book-chapter' ? 'incollection' : meta.docType === 'book' ? 'book' : 'article';
  const lines = [`@${type}{${key},`];

  if (meta.authors.length) {
    lines.push(`  author = {${meta.authors.map((a) => bibtexEscape(a.bibtex)).join(' and ')}},`);
  }
  lines.push(`  title = {${bibtexEscape(meta.title || 'Sin título')}},`);
  if (meta.journal) lines.push(`  journal = {${bibtexEscape(meta.journal)}},`);
  if (meta.year) lines.push(`  year = {${meta.year}},`);
  if (meta.volume) lines.push(`  volume = {${meta.volume}},`);
  if (meta.issue) lines.push(`  number = {${meta.issue}},`);
  if (meta.pages) lines.push(`  pages = {${meta.pages}},`);
  if (meta.doi) lines.push(`  doi = {${meta.doi}},`);
  if (meta.url) lines.push(`  url = {${meta.url}},`);
  lines.push('}');

  const body = lines.join('\n');
  return withIncomplete(body, meta.incomplete);
}

export function buildRisCitation(meta: NormalizedCitationMeta): string {
  const typeMap: Record<string, string> = {
    article: 'JOUR',
    'book-chapter': 'CHAP',
    book: 'BOOK',
    proceedings: 'CONF',
  };
  const ty = typeMap[meta.docType] || 'JOUR';
  const lines = [`TY  - ${ty}`];

  meta.authors.forEach((a) => lines.push(`AU  - ${a.bibtex}`));
  lines.push(`TI  - ${meta.title || 'Sin título'}`);
  if (meta.journal) lines.push(`JO  - ${meta.journal}`);
  if (meta.year) lines.push(`PY  - ${meta.year}`);
  if (meta.volume) lines.push(`VL  - ${meta.volume}`);
  if (meta.issue) lines.push(`IS  - ${meta.issue}`);
  if (meta.pages) {
    const [sp, ep] = meta.pages.split(/[-–—]/).map((p) => p.trim());
    if (sp) lines.push(`SP  - ${sp}`);
    if (ep) lines.push(`EP  - ${ep}`);
  }
  if (meta.doi) lines.push(`DO  - ${meta.doi}`);
  if (meta.url) lines.push(`UR  - ${meta.url}`);
  lines.push('ER  - ');

  return withIncomplete(lines.join('\n'), meta.incomplete);
}

export function buildCitation(work: Work, format: CitationFormat): string {
  const meta = normalizeCitationMeta(work);
  switch (format) {
    case 'apa':
      return buildApaCitation(meta);
    case 'ieee':
      return buildIeeeCitation(meta);
    case 'vancouver':
      return buildVancouverCitation(meta);
    case 'bibtex':
      return buildBibtexCitation(meta);
    case 'ris':
      return buildRisCitation(meta);
    default:
      return buildApaCitation(meta);
  }
}

export function buildAllCitations(work: Work): WorkCitations {
  const meta = normalizeCitationMeta(work);
  return {
    apa: buildApaCitation(meta),
    ieee: buildIeeeCitation(meta),
    vancouver: buildVancouverCitation(meta),
    bibtex: buildBibtexCitation(meta),
    ris: buildRisCitation(meta),
    incomplete: meta.incomplete,
  };
}
