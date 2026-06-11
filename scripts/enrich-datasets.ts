#!/usr/bin/env tsx
/**
 * enrich-datasets.ts — Enriquece src/openalex.json con datasetsCount por autor (OpenAlex type=dataset).
 *
 * Uso:   npm run enrich:datasets
 *        npm run enrich:datasets -- --force
 *        npm run enrich:datasets -- --limit=5
 *        npm run enrich:datasets -- --only=0000-0001-5228-1180
 *
 * Es ADDITIVO: solo escribe datasetsCount / datasetsFetchedAt en authors[orcid].
 * Es IDEMPOTENTE: salta autores con datasetsFetchedAt reciente (--max-age-days, default 7),
 * salvo --force. Sin datasetsFetchedAt → no se considera fresco (siempre enriquece).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OpenAlexClient,
  authorIdFromStoredProfile,
  resolveAuthorIdByOrcid,
  computeDatasetsCountForAuthorIds,
} from '../src/utils/openAlexMetrics.js';
import { resolveDatasetAuthorIds } from '../src/utils/datasetAuthorIds.js';
import type { OrcidAuthorIdMapFile } from '../src/utils/orcidAuthorIdMap.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');
const OA_PATH = join(SRC, 'openalex.json');
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

function isFresh(profile: AuthorProfile, maxAgeDays: number): boolean {
  const ts = profile.datasetsFetchedAt?.trim();
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

  const orcidAuthorIdMap = loadOrcidAuthorIdMap();
  const client = new OpenAlexClient({ mailto: MAILTO });
  const flush = (): void => writeFileSync(OA_PATH, JSON.stringify(OA, null, MINIFY ? undefined : 2));

  let enriched = 0;
  let skipped = 0;
  let errors = 0;
  let processed = 0;

  console.log(`Enriqueciendo datasetsCount de ${total} autores (mailto=${MAILTO})…`);

  try {
    for (let i = 0; i < orcids.length && processed < args.limit; i++) {
      const orcid = orcids[i] as string;
      const profile = authors[orcid] as AuthorProfile;

      if (!args.force && isFresh(profile, args.maxAgeDays)) {
        skipped++;
        continue;
      }

      try {
        const authorIds = await resolveAuthorIds(client, orcid, profile, orcidAuthorIdMap.map);
        if (!authorIds.length) {
          console.warn(`  ⚠ ${orcid}: sin author_id en mapa ni OpenAlex, se omite`);
          errors++;
        } else {
          const datasetsCount = await computeDatasetsCountForAuthorIds(client, authorIds);
          profile.datasetsCount = datasetsCount;
          profile.datasetsFetchedAt = new Date().toISOString();

          enriched++;
          const idNote = authorIds.length > 1 ? ` [${authorIds.length} author.id]` : '';
          console.log(
            `  [${i + 1}/${total}] ${orcid} → datasets=${datasetsCount}${idNote} (works_count=${profile.works_count ?? '?'})`,
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

  console.log(`\n✓ openalex.json enriquecido (${OA_PATH})`);
  console.log(`  enriquecidos: ${enriched} · saltados (frescos): ${skipped} · errores: ${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
