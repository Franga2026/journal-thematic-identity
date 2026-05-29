import { OPENALEX_BASE, OPENALEX_MAILTO } from '../sdg/constants';
import { cleanOrcid } from '../../utils/helpers';

interface OpenAlexWorkRow {
  id?: string;
  doi?: string;
  title?: string;
}

interface OpenAlexWorksPage {
  results?: OpenAlexWorkRow[];
  meta?: { next_cursor?: string };
}

function normDoi(d?: string): string {
  const raw = (d || '').toLowerCase().trim();
  if (!raw) return '';
  return raw.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
}

/** DOIs normalizados de obras OpenAlex del autor (ORCID o OpenAlex author id). */
export async function fetchAuthorWorkDois(input: {
  orcid?: string;
  oaId?: string;
  maxPages?: number;
}): Promise<string[]> {
  const orcid = cleanOrcid(input.orcid);
  const oaId = (input.oaId || '').replace('https://openalex.org/', '').trim();
  const maxPages = input.maxPages ?? 3;

  let filter = '';
  if (orcid) {
    filter = `authorships.author.orcid:https://orcid.org/${orcid}`;
  } else if (oaId) {
    filter = `authorships.author.id:https://openalex.org/${oaId}`;
  } else {
    return [];
  }

  const dois = new Set<string>();
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page += 1) {
    const params = new URLSearchParams({
      filter,
      'per-page': '200',
      mailto: OPENALEX_MAILTO,
    });
    if (cursor) params.set('cursor', cursor);

    const url = `${OPENALEX_BASE}/works?${params.toString()}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new Error(`OpenAlex works ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as OpenAlexWorksPage;
    (data.results || []).forEach((row) => {
      const doi = normDoi(row.doi);
      if (doi) dois.add(doi);
    });

    cursor = data.meta?.next_cursor;
    if (!cursor || !(data.results || []).length) break;
  }

  return [...dois];
}

export { normDoi as normCollaboratorDoi };
