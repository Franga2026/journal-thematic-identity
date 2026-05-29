import {
  OPENALEX_BASE,
  OPENALEX_MAILTO,
  SDG_WORKS_MAX_PAGES,
  SDG_WORKS_PER_PAGE,
} from './constants';
import { sdgLog, sdgWarn } from './diagnostics';
import type { OpenAlexWorkResult, OpenAlexWorksPage } from './openAlexTypes';

export function buildSdgWorksFilterUrl(sdgId: number, cursor?: string): string {
  const filter = `sustainable_development_goals.id:https://openalex.org/SDG${sdgId}`;
  const params = new URLSearchParams({
    filter,
    'per-page': String(SDG_WORKS_PER_PAGE),
    mailto: OPENALEX_MAILTO,
  });
  if (cursor) params.set('cursor', cursor);
  return `${OPENALEX_BASE}/works?${params.toString()}`;
}

export async function fetchAllWorksForSdg(sdgId: number): Promise<{
  works: OpenAlexWorkResult[];
  diagnostics: string[];
}> {
  const diagnostics: string[] = [];
  const works: OpenAlexWorkResult[] = [];
  let cursor: string | undefined;
  let page = 0;

  sdgLog(`Fetching works for SDG${sdgId}…`);

  while (page < SDG_WORKS_MAX_PAGES) {
    page += 1;
    const url = buildSdgWorksFilterUrl(sdgId, cursor);
    diagnostics.push(`GET works page ${page}${cursor ? ` (cursor)` : ''}`);

    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      const err = `OpenAlex works ${res.status}: ${res.statusText}`;
      sdgWarn(err, { sdgId, page });
      throw new Error(err);
    }

    const data = (await res.json()) as OpenAlexWorksPage;
    const batch = data.results || [];
    works.push(...batch);

    sdgLog(`SDG${sdgId} page ${page}: +${batch.length} works (total ${works.length})`);

    const next = data.meta?.next_cursor;
    if (!next || batch.length === 0) break;
    cursor = next;
  }

  if (page >= SDG_WORKS_MAX_PAGES) {
    diagnostics.push(`Stopped at max pages (${SDG_WORKS_MAX_PAGES})`);
    sdgWarn(`SDG${sdgId}: reached max pages cap`, { total: works.length });
  }

  diagnostics.push(`Fetched ${works.length} works in ${page} page(s)`);
  return { works, diagnostics };
}
