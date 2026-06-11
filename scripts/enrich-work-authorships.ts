#!/usr/bin/env tsx
/**
 * enrich-work-authorships.ts — Persiste authorships (con author.orcid) en all-works.json.
 *
 * Uso:   npm run enrich:authorships
 *        npm run enrich:authorships -- --limit=100
 *        npm run enrich:authorships -- --force
 *
 * Requiere openalex_id en la obra. Ejecutar antes de npm run link:works.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shortOpenAlexWorkId } from '../src/utils/mapHarvestedWork.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AW_PATH = join(__dirname, '..', 'src', 'all-works.json');
const MAILTO = process.env.OPENALEX_MAILTO ?? 'fgarrido@rosflo.com';
const BATCH_SIZE = 50;
const MINIFY = true;

interface Args {
  force: boolean;
  limit: number;
  delayMs: number;
}

function parseArgs(): Args {
  const a: Args = { force: false, limit: Infinity, delayMs: 250 };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--force') a.force = true;
    else if (arg.startsWith('--limit=')) a.limit = Number(arg.split('=')[1]);
    else if (arg.startsWith('--delay-ms=')) a.delayMs = Number(arg.split('=')[1]);
  }
  return a;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type CompactAuthorship = {
  author?: { id?: string; display_name?: string; orcid?: string | null };
};

interface OpenAlexWorkHit {
  id?: string;
  authorships?: CompactAuthorship[];
}

function compactAuthorships(raw: CompactAuthorship[] | undefined): CompactAuthorship[] {
  return (raw || []).map((a) => ({
    author: {
      id: a.author?.id,
      display_name: a.author?.display_name,
      orcid: a.author?.orcid ?? null,
    },
  }));
}

async function fetchAuthorshipsBatch(oaIds: string[]): Promise<Map<string, CompactAuthorship[]>> {
  const filter = `openalex_id:${oaIds.join('|')}`;
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('filter', filter);
  url.searchParams.set('per-page', String(Math.min(oaIds.length, 200)));
  url.searchParams.set('select', 'id,authorships');
  url.searchParams.set('mailto', MAILTO);

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`OpenAlex ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as { results?: OpenAlexWorkHit[] };
  const out = new Map<string, CompactAuthorship[]>();

  for (const hit of data.results || []) {
    const oaId = shortOpenAlexWorkId(hit.id);
    if (!oaId) continue;
    out.set(oaId, compactAuthorships(hit.authorships));
  }

  return out;
}

async function main() {
  const args = parseArgs();
  if (!existsSync(AW_PATH)) {
    console.error('Falta src/all-works.json');
    process.exit(1);
  }

  const works = JSON.parse(readFileSync(AW_PATH, 'utf8')) as Array<{
    openalex_id?: string;
    authorships?: CompactAuthorship[];
  }>;

  const targets = works
    .map((w, index) => ({ w, index, oaId: shortOpenAlexWorkId(w.openalex_id) }))
    .filter(({ w, oaId }) => {
      if (!oaId) return false;
      if (!args.force && Array.isArray(w.authorships) && w.authorships.length > 0) return false;
      return true;
    })
    .slice(0, args.limit);

  console.log(`Enriqueciendo authorships: ${targets.length} obras (de ${works.length})`);

  let updated = 0;
  let withOrcid = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const ids = batch.map((t) => t.oaId);
    const map = await fetchAuthorshipsBatch(ids);

    for (const { w, oaId } of batch) {
      const authorships = map.get(oaId);
      if (!authorships) continue;
      w.authorships = authorships;
      updated += 1;
      if (authorships.some((a) => a.author?.orcid)) withOrcid += 1;
    }

    console.log(`  lote ${Math.floor(i / BATCH_SIZE) + 1}: ${Math.min(i + BATCH_SIZE, targets.length)}/${targets.length}`);
    if (i + BATCH_SIZE < targets.length) await sleep(args.delayMs);
  }

  writeFileSync(AW_PATH, JSON.stringify(works, null, MINIFY ? 0 : 2));
  console.log(`✓ authorships actualizados en ${updated} obras (${withOrcid} con al menos un author.orcid)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
