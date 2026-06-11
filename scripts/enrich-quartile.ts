#!/usr/bin/env tsx
/**
 * enrich-quartile.ts — Enriquece src/openalex.json con quartile_profile SJR por autor.
 *
 * LOCAL (sin API): recorre all-works.json, cruza cr_issn + up_issn con el mapa SJR,
 * y atribuye cada obra con cuartil a los autores en autores_uta (deduplicado por ORCID).
 *
 * Uso:   npm run enrich:quartile
 *        npm run enrich:quartile -- --force
 *        npm run enrich:quartile -- --only=0000-0002-3298-6877
 *        npm run enrich:quartile -- --explain=0000-0002-3298-6877
 *
 * Fuente de cuartiles: scripts/data/sjr-2025-quartiles.json (Scimago SJR 2025).
 * Requiere autores_uta en all-works.json (npm run link:works).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getQuartileMatch,
  loadQuartileMap,
  makeGetQuartile,
  normIssn,
} from '../src/utils/quartileIndex.js';
import type { Quartile } from '../src/utils/quartileIndex.js';
import {
  aggregateQuartilesFromWorks,
  buildIdToOrcid,
  emptyTally,
  resolveOrcids,
  toQuartileProfile,
  workIssnCandidates,
} from '../src/utils/localQuartileProfile.js';
import type { QuartileProfile, Researcher, Work } from '../src/shared/types/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');
const OA_PATH = join(SRC, 'openalex.json');
const AW_PATH = join(SRC, 'all-works.json');
const DATA_PATH = join(SRC, 'data.json');
const DEFAULT_SJR = join(__dirname, 'data', 'sjr-2025-quartiles.json');

const MINIFY = true;

interface Args {
  force: boolean;
  maxAgeDays: number;
  limit: number;
  only: string | null;
  explain: string | null;
}

function parseArgs(): Args {
  const a: Args = { force: false, maxAgeDays: 7, limit: Infinity, only: null, explain: null };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--force') a.force = true;
    else if (arg.startsWith('--max-age-days=')) a.maxAgeDays = Number(arg.split('=')[1]);
    else if (arg.startsWith('--limit=')) a.limit = Number(arg.split('=')[1]);
    else if (arg.startsWith('--only=')) a.only = arg.split('=')[1] ?? null;
    else if (arg.startsWith('--explain=')) a.explain = arg.split('=')[1] ?? null;
  }
  return a;
}

function cleanOrcid(o?: string | null): string {
  return (o ?? '').replace(/https?:\/\/orcid\.org\//i, '').trim();
}

interface AuthorProfile {
  quartile_profile?: QuartileProfile;
  sjrQuartileFetchedAt?: string;
  [k: string]: unknown;
}
interface OpenAlexFile {
  authors?: Record<string, AuthorProfile>;
  [k: string]: unknown;
}

function isFresh(profile: AuthorProfile, maxAgeDays: number): boolean {
  const ts = profile.sjrQuartileFetchedAt?.trim();
  if (!ts) return false; // sin sello SJR → no considerar fresco; siempre enriquecer
  const fetched = new Date(ts).getTime();
  if (Number.isNaN(fetched)) return false;
  return Date.now() - fetched < maxAgeDays * 86_400_000;
}

function findAuthorOrcid(needle: string, authorOrcids: Set<string>): string | null {
  const n = cleanOrcid(needle);
  if (authorOrcids.has(n)) return n;
  for (const orcid of authorOrcids) {
    if (orcid.includes(n)) return orcid;
  }
  return null;
}

function fmtIssnField(v: string | string[] | null | undefined): string {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  return String(v);
}

function workLabel(work: Work): string {
  const title = (work.t ?? work.title ?? '').trim();
  if (title) return title.replace(/\s+/g, ' ');
  const id = work.openalex_id ?? work.d ?? work.u ?? work.doi;
  return id ? String(id) : '(sin id)';
}

function hasAnyIssn(candidates: Array<string | null | undefined>): boolean {
  return candidates.some((raw) => normIssn(raw) !== '');
}

function explainAuthor(
  needle: string,
  works: Work[],
  quartileMap: Map<string, Quartile>,
  getQuartile: (issns: Array<string | null | undefined>) => Quartile | null,
  idToOrcid: Map<string, string>,
  authorOrcids: Set<string>,
): void {
  const orcid = findAuthorOrcid(needle, authorOrcids);
  if (!orcid) {
    console.error(`No se encontró autor con ORCID que coincida con "${needle}".`);
    process.exit(1);
  }

  const authorWorks = works.filter((work) => resolveOrcids(work.autores_uta, idToOrcid).has(orcid));
  const tally = emptyTally();
  let withIssn = 0;
  let withQuartile = 0;

  console.log(`Explicación quartile SJR para ${orcid} (${authorWorks.length} obras vinculadas)\n`);

  for (const work of authorWorks) {
    const candidates = workIssnCandidates(work);
    const quartile = getQuartile(candidates);
    const { matchedIssn } = getQuartileMatch(quartileMap, candidates);
    const issn = hasAnyIssn(candidates);

    if (issn) withIssn++;
    if (quartile) {
      withQuartile++;
      tally[quartile]++;
    }

    const cr = fmtIssnField(work.cr_issn as string | string[] | null | undefined);
    const up = fmtIssnField(work.up_issn as string | string[] | null | undefined);
    console.log(
      [
        workLabel(work),
        `cr_issn=${cr}`,
        `up_issn=${up}`,
        `matched=${matchedIssn ?? '—'}`,
        `quartile=${quartile ?? '—'}`,
      ].join('\t'),
    );
  }

  console.log('\n--- Totales ---');
  console.log(`Obras totales del autor:  ${authorWorks.length}`);
  console.log(`Obras con algún ISSN:     ${withIssn}`);
  console.log(`Obras con cuartil SJR:    ${withQuartile}`);
  console.log(`Q1=${tally.Q1}  Q2=${tally.Q2}  Q3=${tally.Q3}  Q4=${tally.Q4}`);

  const qp = toQuartileProfile(tally);
  console.log(
    `Perfil agregado: Q1=${qp.q1_pct ?? 'N/D'}%  with_quartile=${qp.with_quartile ?? 0}`,
  );
}

function main(): void {
  const args = parseArgs();
  const sjrPath = process.env.SJR_QUARTILES_PATH ?? DEFAULT_SJR;

  if (!existsSync(sjrPath)) {
    console.error(`No existe el mapa SJR en ${sjrPath}.`);
    process.exit(1);
  }
  for (const p of [OA_PATH, AW_PATH, DATA_PATH]) {
    if (!existsSync(p)) {
      console.error(`No existe ${p}. Corre setup:data primero.`);
      process.exit(1);
    }
  }

  console.log(`Cargando cuartiles SJR desde ${sjrPath}…`);
  const quartileMap = loadQuartileMap(sjrPath);
  const getQuartile = makeGetQuartile(quartileMap);
  console.log(`  ${quartileMap.size.toLocaleString()} ISSN en el mapa SJR.`);

  const works = JSON.parse(readFileSync(AW_PATH, 'utf8')) as Work[];
  const data = JSON.parse(readFileSync(DATA_PATH, 'utf8')) as Researcher[];
  const idToOrcid = buildIdToOrcid(data);
  const OA: OpenAlexFile = JSON.parse(readFileSync(OA_PATH, 'utf8'));
  const authors = OA.authors ?? {};
  const authorOrcids = new Set(Object.keys(authors).map(cleanOrcid));

  if (args.explain) {
    explainAuthor(args.explain, works, quartileMap, getQuartile, idToOrcid, authorOrcids);
    return;
  }

  console.log(`Agregando cuartiles desde ${works.length.toLocaleString()} obras (all-works.json)…`);
  const tallies = aggregateQuartilesFromWorks(works, getQuartile, idToOrcid, authorOrcids);

  let orcids = Object.keys(authors);
  if (args.only) orcids = orcids.filter((o) => o.includes(args.only as string));
  const total = orcids.length;

  const flush = (): void => writeFileSync(OA_PATH, JSON.stringify(OA, null, MINIFY ? undefined : 2));
  let enriched = 0;
  let skipped = 0;
  let processed = 0;

  console.log(`Escribiendo quartile_profile SJR de ${total} autores…`);

  try {
    for (let i = 0; i < orcids.length && processed < args.limit; i++) {
      const orcid = orcids[i] as string;
      const profile = authors[orcid] as AuthorProfile;

      if (!args.force && isFresh(profile, args.maxAgeDays)) {
        skipped++;
        continue;
      }

      const qp = toQuartileProfile(tallies.get(cleanOrcid(orcid)) ?? emptyTally());
      profile.quartile_profile = qp;
      profile.sjrQuartileFetchedAt = new Date().toISOString();

      enriched++;
      console.log(
        `  [${i + 1}/${total}] ${orcid} → Q1=${qp.q1_pct ?? 'N/D'}% (${qp.with_quartile ?? 0} obras con cuartil SJR)`,
      );

      processed++;
      if (processed % 25 === 0) flush();
    }
  } finally {
    flush();
  }

  const worksWithQuartile = works.filter((w) => getQuartile(workIssnCandidates(w)) != null).length;

  console.log(`\n✓ openalex.json enriquecido (${OA_PATH})`);
  console.log(`  enriquecidos: ${enriched} · saltados (frescos): ${skipped}`);
  console.log(
    `  obras con cuartil SJR: ${worksWithQuartile.toLocaleString()} / ${works.length.toLocaleString()}`,
  );
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) main();
