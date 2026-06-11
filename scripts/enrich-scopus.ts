#!/usr/bin/env tsx
/**
 * enrich-scopus.ts — Enriquece src/openalex.json con % Scopus-indexed por autor.
 *
 * Uso:   npm run enrich:scopus
 *        npm run enrich:scopus -- --force
 *        npm run enrich:scopus -- --limit=5
 *        npm run enrich:scopus -- --only=0000-0002-3298-6877
 *
 * KBART (fuera del bundle, ~17 MB):
 *   scripts/data/6569_elsevier_scopus_kbart.txt
 *   o SCOPUS_KBART_PATH=/ruta/al/kbart.txt
 *
 * Es ADDITIVO: escribe scopusIndexedRate / scopusIndexedN / scopusWorksTotal /
 * scopusFetchedAt en authors[orcid]. No toca fwci ni el resto del perfil.
 *
 * IDEMPOTENTE: salta autores con scopusFetchedAt reciente (--max-age-days, default 7),
 * salvo --force. Guarda cada 25 autores.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OpenAlexClient,
  getAuthorCore,
  computeAuthorScopusIndex,
} from '../src/utils/openAlexMetrics.js';
import { buildScopusIssnSet, makeIsScopusIndexed } from '../src/utils/scopusIndex.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');
const OA_PATH = join(SRC, 'openalex.json');
const DEFAULT_KBART = join(__dirname, 'data', '6569_elsevier_scopus_kbart.txt');

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
  scopusIndexedRate?: number | null;
  scopusIndexedN?: number;
  scopusWorksTotal?: number;
  scopusFetchedAt?: string;
  [k: string]: unknown;
}
interface OpenAlexFile {
  authors?: Record<string, AuthorProfile>;
  [k: string]: unknown;
}

function isFresh(profile: AuthorProfile, maxAgeDays: number): boolean {
  if (!profile.scopusFetchedAt) return false;
  const ageMs = Date.now() - new Date(profile.scopusFetchedAt).getTime();
  return ageMs < maxAgeDays * 86_400_000;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const kbartPath = process.env.SCOPUS_KBART_PATH ?? DEFAULT_KBART;

  if (!existsSync(kbartPath)) {
    console.error(`No existe el KBART en ${kbartPath}.`);
    console.error('Coloca 6569_elsevier_scopus_kbart.txt en scripts/data/ o define SCOPUS_KBART_PATH.');
    process.exit(1);
  }
  if (!existsSync(OA_PATH)) {
    console.error(`No existe ${OA_PATH}. Corre setup:data primero.`);
    process.exit(1);
  }

  console.log(`Cargando ISSN Scopus desde KBART (${kbartPath})…`);
  const scopusSet = buildScopusIssnSet(kbartPath);
  const isScopusIndexed = makeIsScopusIndexed(scopusSet);
  console.log(`  ${scopusSet.size.toLocaleString()} ISSN únicos en el set Scopus.`);

  const OA: OpenAlexFile = JSON.parse(readFileSync(OA_PATH, 'utf8'));
  const authors = OA.authors ?? {};
  let orcids = Object.keys(authors);
  if (args.only) orcids = orcids.filter((o) => o.includes(args.only as string));
  const total = orcids.length;

  if (!total) {
    console.error('openalex.json no tiene authors.');
    process.exit(1);
  }

  const client = new OpenAlexClient({ mailto: MAILTO });
  const flush = (): void => writeFileSync(OA_PATH, JSON.stringify(OA, null, MINIFY ? undefined : 2));

  let enriched = 0;
  let skipped = 0;
  let errors = 0;
  let processed = 0;

  console.log(`Enriqueciendo Scopus-indexed de ${total} autores (mailto=${MAILTO})…`);

  try {
    for (let i = 0; i < orcids.length && processed < args.limit; i++) {
      const orcid = orcids[i] as string;
      const profile = authors[orcid] as AuthorProfile;

      if (!args.force && isFresh(profile, args.maxAgeDays)) {
        skipped++;
        continue;
      }

      try {
        const core = await getAuthorCore(client, orcid);
        if (!core.authorId) {
          console.warn(`  ⚠ ${orcid}: sin author_id en OpenAlex, se omite`);
          errors++;
        } else {
          const scopus = await computeAuthorScopusIndex(client, core.authorId, isScopusIndexed);

          profile.scopusIndexedRate = scopus.scopusIndexedRate;
          profile.scopusIndexedN = scopus.scopusIndexedN;
          profile.scopusWorksTotal = scopus.scopusWorksTotal;
          profile.scopusFetchedAt = new Date().toISOString();

          enriched++;
          console.log(
            `  [${i + 1}/${total}] ${orcid} → Scopus=${scopus.scopusIndexedRate ?? 'sin dato'}% (${scopus.scopusIndexedN}/${scopus.scopusWorksTotal} con ISSN)`,
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
