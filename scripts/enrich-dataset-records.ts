#!/usr/bin/env tsx
/**
 * enrich-dataset-records.ts — Cosecha registros de datasets (type=dataset) por autor desde OpenAlex.
 *
 * Uso:   npm run enrich:dataset-records
 *        npm run enrich:dataset-records -- --force
 *        npm run enrich:dataset-records -- --limit=5
 *        npm run enrich:dataset-records -- --only=0000-0001-5228-1180
 *
 * Escribe src/datasets.json indexado por ORCID (misma clave que openalex.json authors).
 * Es IDEMPOTENTE: salta autores con fetchedAt reciente (--max-age-days, default 7),
 * salvo --force. Sin fetchedAt → no se considera fresco (siempre enriquece).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OpenAlexClient,
  authorIdFromStoredProfile,
  resolveAuthorIdByOrcid,
} from '../src/utils/openAlexMetrics.js';
import type { MappedDatasetRecord } from '../src/utils/datasetOpenAlex.js';
import { resolveDatasetAuthorIds } from '../src/utils/datasetAuthorIds.js';
import { fetchDatasetRecordsForAuthorIds } from '../src/utils/fetchDatasetRecords.js';
import type { OrcidAuthorIdMapFile } from '../src/utils/orcidAuthorIdMap.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');
const OA_PATH = join(SRC, 'openalex.json');
const DATASETS_PATH = join(SRC, 'datasets.json');
const MAP_PATH = join(SRC, 'data', 'orcid-authorid-map.json');

const MAILTO = process.env.OPENALEX_MAILTO ?? 'fgarrido@rosflo.com';
const MINIFY = true;

interface Args {
  force: boolean;
  maxAgeDays: number;
  limit: number;
  only: string | null;
  delayMs: number;
}

function parseArgs(): Args {
  const a: Args = { force: false, maxAgeDays: 7, limit: Infinity, only: null, delayMs: 300 };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--force') a.force = true;
    else if (arg.startsWith('--max-age-days=')) a.maxAgeDays = Number(arg.split('=')[1]);
    else if (arg.startsWith('--limit=')) a.limit = Number(arg.split('=')[1]);
    else if (arg.startsWith('--only=')) a.only = arg.split('=')[1] ?? null;
    else if (arg.startsWith('--delay-ms=')) a.delayMs = Number(arg.split('=')[1]);
  }
  return a;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

interface AuthorProfile {
  openalex_id?: string;
  works_count?: number;
  datasetsCount?: number;
  datasetsFetchedAt?: string;
  [k: string]: unknown;
}

interface OpenAlexFile {
  authors?: Record<string, AuthorProfile>;
  [k: string]: unknown;
}

export type DatasetRecord = MappedDatasetRecord;

interface AuthorDatasets {
  fetchedAt: string;
  records: DatasetRecord[];
}

type DatasetsFile = Record<string, AuthorDatasets>;

function isFresh(entry: AuthorDatasets | undefined, maxAgeDays: number): boolean {
  const ts = entry?.fetchedAt?.trim();
  if (!ts) return false;
  const fetched = new Date(ts).getTime();
  if (Number.isNaN(fetched)) return false;
  return Date.now() - fetched < maxAgeDays * 86_400_000;
}

function loadOrcidAuthorIdMap(): OrcidAuthorIdMapFile {
  if (!existsSync(MAP_PATH)) {
    console.error(`No existe ${MAP_PATH}. Corre npm run enrich:author-ids primero.`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(MAP_PATH, 'utf8')) as OrcidAuthorIdMapFile;
}

async function resolveAuthorIds(
  client: OpenAlexClient,
  orcid: string,
  profile: AuthorProfile,
  orcidMap: Record<string, string[]>,
): Promise<string[]> {
  const profileId = authorIdFromStoredProfile(profile) || null;
  let ids = resolveDatasetAuthorIds(orcid, orcidMap, profileId);
  if (ids.length) return ids;
  const fallback = await resolveAuthorIdByOrcid(client, orcid);
  return fallback ? resolveDatasetAuthorIds(orcid, orcidMap, fallback, [fallback]) : [];
}

function loadDatasets(): DatasetsFile {
  if (!existsSync(DATASETS_PATH)) return {};
  return JSON.parse(readFileSync(DATASETS_PATH, 'utf8')) as DatasetsFile;
}

function audit(
  authors: Record<string, AuthorProfile>,
  datasets: DatasetsFile,
): void {
  const orcids = Object.keys(authors);
  const discrepancies: Array<{
    orcid: string;
    records: number;
    datasetsCount: number;
  }> = [];
  let matched = 0;
  let noRecords = 0;

  for (const orcid of orcids) {
    const recordsLen = datasets[orcid]?.records?.length ?? 0;
    const datasetsCount = authors[orcid]?.datasetsCount ?? 0;
    if (recordsLen === datasetsCount) {
      matched++;
    } else {
      discrepancies.push({ orcid, records: recordsLen, datasetsCount });
    }
    if (recordsLen === 0 && datasetsCount === 0) noRecords++;
  }

  console.log('\n── Auditoría: records.length vs openalex.json datasetsCount ──');
  console.log(`  autores revisados: ${orcids.length}`);
  console.log(`  coinciden: ${matched}`);
  console.log(`  discrepancias: ${discrepancies.length}`);
  console.log(`  sin datasets (0/0): ${noRecords}`);

  if (discrepancies.length) {
    console.log('\n  Discrepancias:');
    for (const d of discrepancies) {
      console.log(
        `    ${d.orcid}: records=${d.records} · datasetsCount=${d.datasetsCount}`,
      );
    }
  } else {
    console.log('  ✓ Sin discrepancias.');
  }
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (!existsSync(OA_PATH)) {
    console.error(`No existe ${OA_PATH}. Corre setup:data primero.`);
    process.exit(1);
  }

  const OA: OpenAlexFile = JSON.parse(readFileSync(OA_PATH, 'utf8'));
  const authors = OA.authors ?? {};
  let orcids = Object.keys(authors);
  if (args.only) orcids = orcids.filter((o) => o.includes(args.only as string));
  const total = orcids.length;

  if (!total) {
    console.error('openalex.json no tiene authors. ¿Forma inesperada?');
    process.exit(1);
  }

  const datasets = loadDatasets();
  const orcidAuthorIdMap = loadOrcidAuthorIdMap();
  const client = new OpenAlexClient({ mailto: MAILTO });
  const flush = (): void =>
    writeFileSync(DATASETS_PATH, JSON.stringify(datasets, null, MINIFY ? undefined : 2));

  let enriched = 0;
  let skipped = 0;
  let errors = 0;
  let processed = 0;

  console.log(`Cosechando registros de datasets de ${total} autores (mailto=${MAILTO})…`);

  try {
    for (let i = 0; i < orcids.length && processed < args.limit; i++) {
      const orcid = orcids[i] as string;
      const profile = authors[orcid] as AuthorProfile;

      if (!args.force && isFresh(datasets[orcid], args.maxAgeDays)) {
        skipped++;
        continue;
      }

      try {
        const authorIds = await resolveAuthorIds(client, orcid, profile, orcidAuthorIdMap.map);
        if (!authorIds.length) {
          console.warn(`  ⚠ ${orcid}: sin author_id en mapa ni OpenAlex, se omite`);
          errors++;
        } else {
          const records = await fetchDatasetRecordsForAuthorIds(client, authorIds);
          datasets[orcid] = {
            fetchedAt: new Date().toISOString(),
            records,
          };

          enriched++;
          const idNote = authorIds.length > 1 ? ` [${authorIds.length} author.id]` : '';
          console.log(
            `  [${i + 1}/${total}] ${orcid} → ${records.length} dataset(s)${idNote} (datasetsCount=${profile.datasetsCount ?? '?'})`,
          );
        }
      } catch (err) {
        errors++;
        console.warn(`  ✗ ${orcid}: ${(err as Error).message}`);
      }

      processed++;
      if (processed % 25 === 0) flush();
      await sleep(args.delayMs);
    }
  } finally {
    flush();
  }

  console.log(`\n✓ datasets.json actualizado (${DATASETS_PATH})`);
  console.log(`  enriquecidos: ${enriched} · saltados (frescos): ${skipped} · errores: ${errors}`);

  audit(authors, datasets);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
