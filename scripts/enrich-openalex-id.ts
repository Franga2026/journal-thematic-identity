#!/usr/bin/env tsx
/**
 * enrich-openalex-id.ts — Backfill de openalex_id (W-id) en all-works.json por DOI.
 *
 * Uso:   npm run enrich:openalex-id
 *        npm run enrich:openalex-id -- --force
 *        npm run enrich:openalex-id -- --limit=100
 *        npm run enrich:openalex-id -- --only-doi=10.1016/j.jasrep.2026.105837
 *
 * Para cada obra con DOI y sin openalex_id, consulta OpenAlex en lotes (≤50 DOIs)
 * y persiste ids.openalex en openalex_id, mapeando de vuelta por DOI normalizado.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shortOpenAlexWorkId } from '../src/utils/mapHarvestedWork.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');
const AW_PATH = join(SRC, 'all-works.json');
const MAILTO = process.env.OPENALEX_MAILTO ?? 'fgarrido@rosflo.com';
const BATCH_SIZE = 50;
const MINIFY = true;

interface Args {
  force: boolean;
  limit: number;
  onlyDoi: string | null;
  delayMs: number;
}

function parseArgs(): Args {
  const a: Args = { force: false, limit: Infinity, onlyDoi: null, delayMs: 250 };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--force') a.force = true;
    else if (arg.startsWith('--limit=')) a.limit = Number(arg.split('=')[1]);
    else if (arg.startsWith('--only-doi=')) a.onlyDoi = arg.split('=')[1] ?? null;
    else if (arg.startsWith('--delay-ms=')) a.delayMs = Number(arg.split('=')[1]);
  }
  return a;
}

function normDoi(d?: string): string {
  const raw = (d || '').toLowerCase().trim();
  if (!raw) return '';
  return raw.replace(/^https?:\/\/(dx\.)?doi\.org\//, '');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface OpenAlexWorkHit {
  id?: string;
  ids?: { openalex?: string; doi?: string };
  doi?: string | null;
}

async function fetchOpenAlexIdsByDoi(dois: string[]): Promise<Map<string, string>> {
  const filter = `doi:${dois.join('|')}`;
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('filter', filter);
  url.searchParams.set('per-page', String(Math.min(dois.length, 200)));
  url.searchParams.set('select', 'id,ids,doi');
  url.searchParams.set('mailto', MAILTO);

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`OpenAlex ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as { results?: OpenAlexWorkHit[] };
  const out = new Map<string, string>();

  for (const hit of data.results || []) {
    const oaId = shortOpenAlexWorkId(hit.ids?.openalex || hit.id);
    const doiKey = normDoi(hit.ids?.doi || hit.doi || '');
    if (oaId && doiKey) out.set(doiKey, oaId);
  }

  return out;
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (!existsSync(AW_PATH)) {
    console.error(`No existe ${AW_PATH}`);
    process.exit(1);
  }

  const works = JSON.parse(readFileSync(AW_PATH, 'utf8')) as Array<{
    d?: string;
    doi?: string;
    openalex_id?: string;
  }>;

  const pending = works
    .map((w, index) => ({ w, index, doiKey: normDoi(w.d || w.doi) }))
    .filter(({ w, doiKey }) => {
      if (!doiKey) return false;
      if (args.onlyDoi && normDoi(args.onlyDoi) !== doiKey) return false;
      if (!args.force && w.openalex_id) return false;
      return true;
    })
    .slice(0, args.limit);

  console.log(`Obras pendientes de openalex_id: ${pending.length.toLocaleString()}`);

  let updated = 0;
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const dois = batch.map((b) => b.doiKey);
    const map = await fetchOpenAlexIdsByDoi(dois);

    for (const item of batch) {
      const oaId = map.get(item.doiKey);
      if (!oaId) continue;
      item.w.openalex_id = oaId;
      updated += 1;
    }

    console.log(`  Lote ${Math.floor(i / BATCH_SIZE) + 1}: +${map.size} ids (${updated} acumulados)`);
    if (i + BATCH_SIZE < pending.length) await sleep(args.delayMs);
  }

  writeFileSync(AW_PATH, JSON.stringify(works, null, MINIFY ? 0 : 2));
  console.log(`✓ openalex_id actualizado en ${updated} obras`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
