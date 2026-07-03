#!/usr/bin/env tsx
/**
 * enrich-author-works-metrics.ts — Recomputa works_count / cited_by_count / h_index
 * desde /works (obras indexadas bajo author.id), no desde el agregado /authors.
 *
 * Uso:   npm run enrich:author-metrics
 *        npm run enrich:author-metrics -- --force
 *        npm run enrich:author-metrics -- --only=0000-0003-0568-5750
 *        npm run enrich:author-metrics -- --limit=5
 *
 * Escribe en openalex.json authors[orcid]:
 *   works_count, cited_by_count, h_index  ← desde /works (canónicos para Ranking)
 *   works_count_profile, works_count_real, identity_flag, merge_ratio, worksMetricsFetchedAt
 */
import './lib/bootstrapProjectEnv.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OpenAlexClient,
  authorIdFromStoredProfile,
  computeAuthorMetricsFromWorks,
  resolveAuthorIdByOrcid,
} from '../src/utils/openAlexMetrics.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');
const OA_PATH = join(SRC, 'openalex.json');

const MAILTO = process.env.OPENALEX_MAILTO ?? 'fgarrido@rosflo.com';
const API_KEY = process.env.OPENALEX_API_KEY;
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
  cited_by_count?: number;
  h_index?: number;
  works_count_profile?: number;
  works_count_real?: number;
  identity_flag?: 'possible_merge' | null;
  merge_ratio?: number | null;
  worksMetricsFetchedAt?: string;
  [k: string]: unknown;
}

interface OpenAlexFile {
  authors?: Record<string, AuthorProfile>;
  [k: string]: unknown;
}

function isFresh(profile: AuthorProfile, maxAgeDays: number): boolean {
  if (!profile.worksMetricsFetchedAt) return false;
  const ageMs = Date.now() - new Date(profile.worksMetricsFetchedAt).getTime();
  return ageMs < maxAgeDays * 86_400_000;
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

  const client = new OpenAlexClient({ mailto: MAILTO, apiKey: API_KEY });
  const flush = (): void => writeFileSync(OA_PATH, JSON.stringify(OA, null, MINIFY ? undefined : 2));

  let enriched = 0;
  let skipped = 0;
  let errors = 0;
  let flagged = 0;
  let processed = 0;

  console.log(`Recomputando métricas /works de ${orcids.length} autores…`);

  try {
    for (let i = 0; i < orcids.length && processed < args.limit; i++) {
      const orcid = orcids[i] as string;
      const profile = authors[orcid] as AuthorProfile;

      if (!args.force && isFresh(profile, args.maxAgeDays)) {
        skipped++;
        continue;
      }

      try {
        let authorId = authorIdFromStoredProfile(profile);
        if (!authorId) authorId = (await resolveAuthorIdByOrcid(client, orcid)) ?? '';
        if (!authorId) {
          console.warn(`  ⚠ ${orcid}: sin author.id, se omite`);
          errors++;
          processed++;
          continue;
        }

        const worksCountProfile =
          typeof profile.works_count_profile === 'number'
            ? profile.works_count_profile
            : (profile.works_count ?? 0);

        const metrics = await computeAuthorMetricsFromWorks(client, authorId, worksCountProfile);

        profile.works_count_profile = worksCountProfile;
        profile.works_count_real = metrics.worksCountReal;
        profile.works_count = metrics.worksCountReal;
        profile.cited_by_count = metrics.citedByCountReal;
        profile.h_index = metrics.hIndexReal;
        profile.identity_flag = metrics.identityFlag;
        profile.merge_ratio = metrics.mergeRatio;
        profile.worksMetricsFetchedAt = new Date().toISOString();
        profile.worksMetricsSource = 'openalex_works';

        enriched++;
        if (metrics.identityFlag) flagged++;
        console.log(
          `  [${i + 1}/${orcids.length}] ${orcid} → works ${worksCountProfile}→${metrics.worksCountReal}` +
            ` · cits ${metrics.citedByCountReal} · h ${metrics.hIndexReal}` +
            (metrics.identityFlag ? ` · ⚠ ${metrics.identityFlag} (×${metrics.mergeRatio})` : ''),
        );
      } catch (err) {
        errors++;
        console.warn(`  ✗ ${orcid}: ${(err as Error).message}`);
      }

      processed++;
      if (processed % 10 === 0) flush();
      await sleep(args.delayMs);
    }
  } finally {
    flush();
  }

  console.log(`\n✓ openalex.json actualizado (${OA_PATH})`);
  console.log(
    `  enriquecidos: ${enriched} · fusiones sospechosas: ${flagged} · saltados: ${skipped} · errores: ${errors}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
