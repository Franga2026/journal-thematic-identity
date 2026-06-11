#!/usr/bin/env tsx
/**
 * enrich-work-openalex-metrics.ts — Backfill OpenAlex fwci + cited_by_count en all-works.json.
 *
 * Persiste: fwci, cited_by_count, c (= cited_by_count), impact (= fwci).
 * Requiere openalex_id ya resuelto (mismo W-id que enlaza la tile). Ejecutar
 * enrich:openalex-id antes. No consulta por DOI — evita divergencia tile ↔ OpenAlex.
 *
 * Uso:   npm run enrich:work-metrics
 *        npm run enrich:work-metrics -- --only-id=W7162097201
 *        npm run enrich:work-metrics -- --limit=100 --force
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shortOpenAlexWorkId } from '../src/utils/mapHarvestedWork.js';
import { mapOpenAlexWorkMetrics } from '../src/utils/workMetrics.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AW_PATH = join(__dirname, '..', 'src', 'all-works.json');
const MAILTO = process.env.OPENALEX_MAILTO ?? 'fgarrido@rosflo.com';
const BATCH_SIZE = 50;
const MINIFY = true;

interface Args {
  force: boolean;
  limit: number;
  onlyId: string | null;
  delayMs: number;
}

function parseArgs(): Args {
  const a: Args = { force: false, limit: Infinity, onlyId: null, delayMs: 250 };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--force') a.force = true;
    else if (arg.startsWith('--limit=')) a.limit = Number(arg.split('=')[1]);
    else if (arg.startsWith('--only-id=')) a.onlyId = arg.split('=')[1] ?? null;
    else if (arg.startsWith('--delay-ms=')) a.delayMs = Number(arg.split('=')[1]);
  }
  return a;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface OpenAlexWorkHit {
  id?: string;
  ids?: { openalex?: string; doi?: string };
  doi?: string | null;
  fwci?: number | null;
  cited_by_count?: number | null;
}

async function fetchOpenAlexMetricsByFilter(
  filter: string,
  keyFn: (hit: OpenAlexWorkHit) => string | null,
): Promise<Map<string, OpenAlexWorkHit>> {
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('filter', filter);
  url.searchParams.set('per-page', '200');
  url.searchParams.set('select', 'id,ids,doi,fwci,cited_by_count');
  url.searchParams.set('mailto', MAILTO);

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`OpenAlex ${res.status}: ${res.statusText}`);

  const data = (await res.json()) as { results?: OpenAlexWorkHit[] };
  const out = new Map<string, OpenAlexWorkHit>();
  for (const hit of data.results || []) {
    const key = keyFn(hit);
    if (key) out.set(key, hit);
  }
  return out;
}

type AwWork = {
  d?: string;
  doi?: string;
  openalex_id?: string;
  fwci?: number | null;
  cited_by_count?: number;
  c?: number;
  impact?: number;
};

function hasFreshMetrics(w: AwWork, force: boolean): boolean {
  if (force) return false;
  return w.fwci != null && w.cited_by_count != null;
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (!existsSync(AW_PATH)) {
    console.error(`No existe ${AW_PATH}`);
    process.exit(1);
  }

  const works = JSON.parse(readFileSync(AW_PATH, 'utf8')) as AwWork[];

  const pending = works
    .map((w) => ({
      w,
      oaId: shortOpenAlexWorkId(w.openalex_id),
    }))
    .filter(({ w, oaId }) => {
      if (args.onlyId && shortOpenAlexWorkId(args.onlyId) !== oaId) return false;
      if (!oaId) return false;
      if (hasFreshMetrics(w, args.force)) return false;
      return true;
    })
    .slice(0, args.limit);

  console.log(`Obras pendientes de métricas OpenAlex (por openalex_id): ${pending.length.toLocaleString()}`);

  let updated = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    const ids = batch.map((b) => b.oaId);
    const filter = `openalex:${ids.join('|')}`;
    const map = await fetchOpenAlexMetricsByFilter(filter, (hit) =>
      shortOpenAlexWorkId(hit.ids?.openalex || hit.id),
    );

    for (const item of batch) {
      const hit = map.get(item.oaId);
      if (!hit) continue;
      const metrics = mapOpenAlexWorkMetrics(hit);
      Object.assign(item.w, metrics);
      updated += 1;
    }

    console.log(`  IDs lote ${Math.floor(i / BATCH_SIZE) + 1}: ${map.size} hits (${updated} acumulados)`);
    if (i + BATCH_SIZE < pending.length) await sleep(args.delayMs);
  }

  writeFileSync(AW_PATH, JSON.stringify(works, null, MINIFY ? 0 : 2));
  console.log(`✓ métricas OpenAlex actualizadas en ${updated} obras`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
