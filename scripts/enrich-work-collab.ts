#!/usr/bin/env tsx
/**
 * enrich-work-collab.ts — Afiliaciones (institutions) + citation percentile por obra.
 *
 * Uso:   npm run enrich:collab
 *        npm run enrich:collab -- --force
 *        npm run enrich:collab -- --limit=100
 *        npm run enrich:collab -- --delay-ms=300
 *
 * ADDITIVO: merge en authorships[] (institutions, countries) + work.percentile + collabFetchedAt.
 * Requiere openalex_id. Respaldar all-works.json antes de escribir. Resumible (flush por lote).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shortOpenAlexWorkId } from '../src/utils/mapHarvestedWork.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');
const AW_PATH = join(SRC, 'all-works.json');
const CACHE_DIR = join(__dirname, '.cache');
const PROGRESS_PATH = join(CACHE_DIR, 'enrich-collab-progress.json');
const MAILTO = process.env.OPENALEX_MAILTO ?? 'fgarrido@rosflo.com';
const BATCH_SIZE = 50;
const MINIFY = true;

interface Args {
  force: boolean;
  maxAgeDays: number;
  limit: number;
  delayMs: number;
  noBackup: boolean;
}

interface WorkPercentile {
  value?: number;
  is_in_top_1_percent?: boolean;
  is_in_top_10_percent?: boolean;
}

interface CompactInstitution {
  display_name?: string;
  ror?: string;
  country_code?: string;
  type?: string;
}

interface CompactAuthorship {
  author?: { id?: string; display_name?: string; orcid?: string | null };
  institutions?: CompactInstitution[];
  countries?: string[];
}

interface WorkRecord {
  openalex_id?: string;
  authorships?: CompactAuthorship[];
  percentile?: WorkPercentile;
  collabFetchedAt?: string;
  [k: string]: unknown;
}

interface OpenAlexInstitution {
  display_name?: string;
  ror?: string;
  country_code?: string;
  type?: string;
}

interface OpenAlexAuthorship {
  author?: { id?: string; display_name?: string; orcid?: string | null };
  institutions?: OpenAlexInstitution[];
  countries?: string[];
}

interface OpenAlexWorkHit {
  id?: string;
  authorships?: OpenAlexAuthorship[];
  citation_normalized_percentile?: WorkPercentile | null;
}

interface ProgressFile {
  completedIds: string[];
  updatedAt?: string;
}

function parseArgs(): Args {
  const a: Args = {
    force: false,
    maxAgeDays: 7,
    limit: Infinity,
    delayMs: 250,
    noBackup: false,
  };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--force') a.force = true;
    else if (arg === '--no-backup') a.noBackup = true;
    else if (arg.startsWith('--max-age-days=')) a.maxAgeDays = Number(arg.split('=')[1]);
    else if (arg.startsWith('--limit=')) a.limit = Number(arg.split('=')[1]);
    else if (arg.startsWith('--delay-ms=')) a.delayMs = Number(arg.split('=')[1]);
  }
  return a;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseAuthorId(id?: string | null): string {
  return String(id ?? '')
    .replace(/^https?:\/\/openalex\.org\//i, '')
    .trim();
}

function compactInstitutions(raw: OpenAlexInstitution[] | undefined): CompactInstitution[] {
  return (raw ?? [])
    .map((ins) => ({
      display_name: ins.display_name?.trim() || undefined,
      ror: ins.ror?.trim() || undefined,
      country_code: ins.country_code?.trim() || undefined,
      type: ins.type?.trim() || undefined,
    }))
    .filter((ins) => ins.display_name || ins.ror || ins.country_code || ins.type);
}

function mergeAuthorships(
  existing: CompactAuthorship[] | undefined,
  incoming: OpenAlexAuthorship[] | undefined,
): CompactAuthorship[] {
  const inc = incoming ?? [];
  if (!inc.length) return existing ?? [];

  if (!existing?.length) {
    return inc.map((a) => ({
      author: {
        id: a.author?.id,
        display_name: a.author?.display_name,
        orcid: a.author?.orcid ?? null,
      },
      institutions: compactInstitutions(a.institutions),
      countries: a.countries?.filter(Boolean) ?? [],
    }));
  }

  const byId = new Map<string, OpenAlexAuthorship>();
  for (const a of inc) {
    const id = parseAuthorId(a.author?.id);
    if (id) byId.set(id, a);
  }

  return existing.map((ex, idx) => {
    const id = parseAuthorId(ex.author?.id);
    const fromApi = (id && byId.get(id)) || inc[idx];
    const instFromApi = fromApi ? compactInstitutions(fromApi.institutions) : [];
    const inst = instFromApi.length ? instFromApi : (ex.institutions ?? []);
    const countries = fromApi?.countries?.length ? fromApi.countries : (ex.countries ?? []);

    return {
      author: {
        id: ex.author?.id ?? fromApi?.author?.id,
        display_name: ex.author?.display_name ?? fromApi?.author?.display_name,
        orcid: ex.author?.orcid ?? fromApi?.author?.orcid ?? null,
      },
      ...(inst.length ? { institutions: inst } : {}),
      ...(countries.length ? { countries } : {}),
    };
  });
}

function compactPercentile(raw: WorkPercentile | null | undefined): WorkPercentile | undefined {
  if (!raw || raw.value == null) return undefined;
  return {
    value: raw.value,
    is_in_top_1_percent: raw.is_in_top_1_percent,
    is_in_top_10_percent: raw.is_in_top_10_percent,
  };
}

function hasCollabData(work: WorkRecord): boolean {
  const hasInst = (work.authorships ?? []).some((a) => (a.institutions?.length ?? 0) > 0);
  const hasPct = work.percentile?.value != null;
  return hasInst && hasPct;
}

function isFresh(work: WorkRecord, maxAgeDays: number): boolean {
  if (!work.collabFetchedAt) return false;
  const ageMs = Date.now() - new Date(work.collabFetchedAt).getTime();
  return ageMs < maxAgeDays * 86_400_000;
}

function needsEnrich(work: WorkRecord, args: Args): boolean {
  const oaId = shortOpenAlexWorkId(work.openalex_id);
  if (!oaId) return false;
  if (args.force) return true;
  if (isFresh(work, args.maxAgeDays) && hasCollabData(work)) return false;
  return !hasCollabData(work);
}

function loadProgress(): Set<string> {
  if (!existsSync(PROGRESS_PATH)) return new Set();
  try {
    const data = JSON.parse(readFileSync(PROGRESS_PATH, 'utf8')) as ProgressFile;
    return new Set(data.completedIds ?? []);
  } catch {
    return new Set();
  }
}

function saveProgress(completed: Set<string>): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  const payload: ProgressFile = {
    completedIds: [...completed],
    updatedAt: new Date().toISOString(),
  };
  writeFileSync(PROGRESS_PATH, JSON.stringify(payload, null, 2));
}

async function fetchCollabBatch(oaIds: string[]): Promise<Map<string, OpenAlexWorkHit>> {
  const filter = `openalex_id:${oaIds.join('|')}`;
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('filter', filter);
  url.searchParams.set('select', 'id,authorships,citation_normalized_percentile');
  url.searchParams.set('per-page', String(Math.min(oaIds.length, 200)));
  url.searchParams.set('mailto', MAILTO);

  const maxRetries = 8;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
      if (res.ok) {
        const data = (await res.json()) as { results?: OpenAlexWorkHit[] };
        const out = new Map<string, OpenAlexWorkHit>();
        for (const hit of data.results ?? []) {
          const oaId = shortOpenAlexWorkId(hit.id);
          if (oaId) out.set(oaId, hit);
        }
        return out;
      }
      if (res.status === 429 || res.status >= 500) {
        const wait = Math.min(45_000, 750 * 2 ** attempt);
        console.warn(`  ↻ OpenAlex ${res.status} — reintento en ${wait}ms (${attempt + 1}/${maxRetries})`);
        await sleep(wait);
        continue;
      }
      throw new Error(`OpenAlex ${res.status}: ${(await res.text()).slice(0, 200)}`);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      const retriable = code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'ENOTFOUND';
      if (retriable && attempt < maxRetries - 1) {
        const wait = Math.min(45_000, 1000 * 2 ** attempt);
        console.warn(`  ↻ red ${code} — reintento en ${wait}ms (${attempt + 1}/${maxRetries})`);
        await sleep(wait);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`OpenAlex: agotados reintentos para lote ${oaIds.slice(0, 3).join(',')}…`);
}

function backupAllWorks(): string {
  const backupDir = join(SRC, 'backups');
  mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(backupDir, `all-works.pre-collab.${stamp}.json`);
  copyFileSync(AW_PATH, backupPath);
  return backupPath;
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (!existsSync(AW_PATH)) {
    console.error(`No existe ${AW_PATH}`);
    process.exit(1);
  }

  const works = JSON.parse(readFileSync(AW_PATH, 'utf8')) as WorkRecord[];
  const progress = args.force ? new Set<string>() : loadProgress();

  const targets = works
    .map((w, index) => ({ w, index, oaId: shortOpenAlexWorkId(w.openalex_id) }))
    .filter(({ w, oaId }) => {
      if (!oaId) return false;
      if (progress.has(oaId) && !args.force) return false;
      return needsEnrich(w, args);
    })
    .slice(0, args.limit);

  const withOaId = works.filter((w) => shortOpenAlexWorkId(w.openalex_id)).length;
  console.log(`Enriqueciendo colaboración: ${targets.length} obras (de ${withOaId} con openalex_id)`);
  console.log(`mailto=${MAILTO} · batch=${BATCH_SIZE} · delay=${args.delayMs}ms`);

  if (!targets.length) {
    console.log('Nada que enriquecer (¿--force?).');
    return;
  }

  let backupPath: string | null = null;
  if (!args.noBackup) {
    backupPath = backupAllWorks();
    console.log(`Respaldo: ${backupPath}`);
  }

  let updated = 0;
  let withInst = 0;
  let withPct = 0;
  let missing = 0;
  let batches = 0;

  const flush = (): void => {
    writeFileSync(AW_PATH, JSON.stringify(works, null, MINIFY ? 0 : 2));
  };

  try {
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      batches++;
      const batch = targets.slice(i, i + BATCH_SIZE);
      const ids = batch.map((t) => t.oaId);
      const map = await fetchCollabBatch(ids);
      const now = new Date().toISOString();

      for (const { w, oaId } of batch) {
        const hit = map.get(oaId);
        if (!hit) {
          missing++;
          continue;
        }

        w.authorships = mergeAuthorships(w.authorships, hit.authorships);
        const pct = compactPercentile(hit.citation_normalized_percentile);
        if (pct) w.percentile = pct;
        w.collabFetchedAt = now;

        updated++;
        if ((w.authorships ?? []).some((a) => (a.institutions?.length ?? 0) > 0)) withInst++;
        if (w.percentile?.value != null) withPct++;
        progress.add(oaId);
      }

      flush();
      saveProgress(progress);
      console.log(
        `  lote ${batches}: ${Math.min(i + BATCH_SIZE, targets.length)}/${targets.length} · acum updated=${updated}`,
      );

      if (i + BATCH_SIZE < targets.length) await sleep(args.delayMs);
    }
  } finally {
    flush();
    saveProgress(progress);
  }

  console.log(`\n✓ all-works.json enriquecido (${AW_PATH})`);
  console.log(`  actualizadas: ${updated} · sin hit OpenAlex: ${missing} · lotes: ${batches}`);
  console.log(`  con institutions: ${withInst} · con percentile: ${withPct}`);
  if (backupPath) console.log(`  respaldo: ${backupPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
