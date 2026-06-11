#!/usr/bin/env tsx
/**
 * enrich-fwci.ts — Enriquece src/openalex.json con FWCI y Open Access por autor (desde OpenAlex).
 *
 * Uso:   npm run enrich:fwci
 *        (npm run enrich:fwci -- --force)            // re-calcula todos
 *        (npm run enrich:fwci -- --limit=5)          // solo 5 (prueba)
 *        (npm run enrich:fwci -- --only=0000-0002-3298-6877)  // un autor
 *
 * Es ADDITIVO: solo escribe fwci / fwciN / oaRate / fwciFetchedAt en authors[orcid].
 * No toca works_count, h_index ni el resto del profile (eso lo arma setup:data).
 *
 * Es IDEMPOTENTE: salta autores cuyo fwciFetchedAt sea reciente (--max-age-days, default 7),
 * salvo --force. Guarda el progreso cada 25 autores (resiliente ante caídas).
 *
 * Requisitos: tsx (npm i -D tsx). Corre en Node >= 18 (fetch nativo). NUNCA en el navegador.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OpenAlexClient,
  getAuthorCore,
  computeAuthorFwci,
  computeOaRate,
} from '../src/utils/openAlexMetrics.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');
const OA_PATH = join(SRC, 'openalex.json');

// ── Config ──
const MAILTO = process.env.OPENALEX_MAILTO ?? 'fgarrido@rosflo.com';
const MINIFY = true; // openalex.json actual está minificado (una sola línea)

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
  fwci?: number | null;
  fwciN?: number;
  oaRate?: number;
  fwciFetchedAt?: string;
  [k: string]: unknown;
}
interface OpenAlexFile {
  authors?: Record<string, AuthorProfile>;
  [k: string]: unknown;
}

function isFresh(profile: AuthorProfile, maxAgeDays: number): boolean {
  if (!profile.fwciFetchedAt) return false;
  const ageMs = Date.now() - new Date(profile.fwciFetchedAt).getTime();
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
  const total = orcids.length;

  if (!total) {
    console.error('openalex.json no tiene authors. ¿Forma inesperada?');
    process.exit(1);
  }

  const client = new OpenAlexClient({ mailto: MAILTO });
  const flush = (): void => writeFileSync(OA_PATH, JSON.stringify(OA, null, MINIFY ? undefined : 2));

  let enriched = 0;
  let skipped = 0;
  let errors = 0;
  let processed = 0;

  console.log(`Enriqueciendo FWCI/OA de ${total} autores (mailto=${MAILTO})…`);

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
          const fwci = await computeAuthorFwci(client, core.authorId);
          const oar = await computeOaRate(client, core.authorId);

          profile.fwci = fwci.fwci;
          profile.fwciN = fwci.nWithFwci;
          profile.oaRate = oar.oaRate;
          profile.fwciFetchedAt = new Date().toISOString();

          enriched++;
          console.log(
            `  [${i + 1}/${total}] ${orcid} → FWCI=${fwci.fwci ?? 'sin dato'} (n=${fwci.nWithFwci}), OA=${oar.oaRate}%`,
          );
        }
      } catch (err) {
        errors++;
        console.warn(`  ✗ ${orcid}: ${(err as Error).message}`);
      }

      processed++;
      if (processed % 25 === 0) flush(); // guarda progreso periódicamente
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
