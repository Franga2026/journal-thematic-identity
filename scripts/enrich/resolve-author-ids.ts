#!/usr/bin/env tsx
/**
 * resolve-author-ids.ts — ORCID UTA → OpenAlex author.id (cache persistente).
 * Expansión block_key con ancla dura (UTA ROR o ≥2 co-autores).
 *
 * Uso:   npm run enrich:author-ids
 *        npm run enrich:author-ids -- --force
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanOrcid } from '../../src/utils/helpers.js';
import { parseOpenAlexAuthorId } from '../../src/utils/openAlexAuthorId.ts';
import type { AuthorIdProvenance, OrcidAuthorIdMapFile } from '../../src/utils/orcidAuthorIdMap.ts';
import {
  UTA_INST_ID,
  UTA_OPENALEX_ID,
  UTA_ROR,
  UTA_ROR_BARE,
  isUtaRor,
  normRor,
} from '../../src/constants/utaInstitution.ts';
import { buildCoAuthorIndex, sharedCoAuthorCount } from '../../src/utils/coAuthorIndex.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', '..', 'src', 'data.json');
const MAP_PATH = join(__dirname, '..', '..', 'src', 'data', 'orcid-authorid-map.json');
const AW_PATH = join(__dirname, '..', '..', 'src', 'all-works.json');
const AUDIT_PATH = join(__dirname, '..', '..', 'outputs', 'audit-blockkey.json');
const MAILTO = process.env.OPENALEX_MAILTO ?? 'fgarrido@rosflo.com';
const BATCH_SIZE = 50;
const WORKS_BEFORE_STRICT = 4158;

function normOrcid(value: string): string {
  return cleanOrcid(value).toLowerCase();
}

function parseArgs(): { force: boolean } {
  return { force: process.argv.includes('--force') };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type InstitutionRef = {
  id?: string;
  ror?: string | null;
  display_name?: string;
};

type OpenAlexAuthorHit = {
  id?: string;
  orcid?: string | null;
  display_name?: string;
  block_key?: string | null;
  affiliations?: Array<{ institution?: InstitutionRef }>;
  last_known_institutions?: InstitutionRef[];
};

type ResearcherRow = {
  id?: string;
  f?: string;
  l?: string;
  o?: string;
};

type AliasAuditRow = {
  investigador: { rut: string; name: string; orcid: string };
  alias_author_id: string;
  display_name: string;
  instituciones_ror: string[];
  ancla?: 'UTA_ROR' | 'coautores';
  motivo?: 'orcid_distinto' | 'sin_ancla';
  obras_que_aporta?: number;
};

function addAuthorId(
  map: Record<string, string[]>,
  provenance: Record<string, Record<string, AuthorIdProvenance>>,
  orcidKey: string,
  authorId: string,
  source: AuthorIdProvenance,
): void {
  const list = map[orcidKey] || [];
  if (!list.includes(authorId)) list.push(authorId);
  map[orcidKey] = list;
  if (!provenance[orcidKey]) provenance[orcidKey] = {};
  if (!provenance[orcidKey][authorId]) provenance[orcidKey][authorId] = source;
}

function authorHasUtaInstitution(hit: OpenAlexAuthorHit): boolean {
  for (const inst of hit.last_known_institutions || []) {
    if (isUtaRor(inst.ror) || inst.id === UTA_OPENALEX_ID) return true;
  }
  for (const aff of hit.affiliations || []) {
    const inst = aff.institution;
    if (!inst) continue;
    if (isUtaRor(inst.ror) || inst.id === UTA_OPENALEX_ID) return true;
  }
  return false;
}

function institutionRors(hit: OpenAlexAuthorHit): string[] {
  const rors = new Set<string>();
  for (const inst of hit.last_known_institutions || []) {
    const r = normRor(inst.ror);
    if (r) rors.add(r);
  }
  for (const aff of hit.affiliations || []) {
    const r = normRor(aff.institution?.ror);
    if (r) rors.add(r);
  }
  return [...rors];
}

async function fetchAuthorsByOrcidBatch(orcids: string[]): Promise<OpenAlexAuthorHit[]> {
  const filter = `orcid:${orcids.join('|')}`;
  const url = new URL('https://api.openalex.org/authors');
  url.searchParams.set('filter', filter);
  url.searchParams.set('per-page', String(Math.min(orcids.length, 200)));
  url.searchParams.set('select', 'id,orcid,display_name,block_key');
  url.searchParams.set('mailto', MAILTO);

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`OpenAlex ${res.status}: ${res.statusText}`);
  const data = (await res.json()) as { results?: OpenAlexAuthorHit[] };
  return data.results || [];
}

async function fetchAuthorsByOpenAlexIdBatch(ids: string[]): Promise<OpenAlexAuthorHit[]> {
  const filter = `openalex:${ids.join('|')}`;
  const url = new URL('https://api.openalex.org/authors');
  url.searchParams.set('filter', filter);
  url.searchParams.set('per-page', String(Math.min(ids.length, 200)));
  url.searchParams.set(
    'select',
    'id,orcid,display_name,block_key,affiliations,last_known_institutions',
  );
  url.searchParams.set('mailto', MAILTO);

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`OpenAlex ${res.status}: ${res.statusText}`);
  const data = (await res.json()) as { results?: OpenAlexAuthorHit[] };
  return data.results || [];
}

async function fetchUtaAuthorsByBlockKey(): Promise<Map<string, string[]>> {
  const byBlock = new Map<string, string[]>();
  let page = 1;
  let total = Infinity;

  while ((page - 1) * 200 < total) {
    const url = new URL('https://api.openalex.org/authors');
    url.searchParams.set('filter', `last_known_institutions.id:${UTA_INST_ID}`);
    url.searchParams.set('per-page', '200');
    url.searchParams.set('page', String(page));
    url.searchParams.set('select', 'id,block_key');
    url.searchParams.set('mailto', MAILTO);

    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`OpenAlex UTA authors ${res.status}: ${res.statusText}`);

    const data = (await res.json()) as { meta?: { count?: number }; results?: OpenAlexAuthorHit[] };
    total = data.meta?.count ?? 0;

    for (const hit of data.results || []) {
      const blockKey = (hit.block_key || '').trim().toLowerCase();
      const authorId = parseOpenAlexAuthorId(hit.id);
      if (!blockKey || !authorId) continue;
      const list = byBlock.get(blockKey) || [];
      if (!list.includes(authorId)) list.push(authorId);
      byBlock.set(blockKey, list);
    }

    page += 1;
    await sleep(200);
  }

  return byBlock;
}

function countWorksForAuthor(works: Array<{ authorships?: unknown[] }>, authorId: string): number {
  let n = 0;
  for (const w of works) {
    const authorships = (w.authorships || []) as Array<{ author?: { id?: string } }>;
    if (authorships.some((a) => parseOpenAlexAuthorId(a.author?.id) === authorId)) n += 1;
  }
  return n;
}

/** Expansión block_key con ancla UTA_ROR o ≥2 co-autores con entidad ORCID. */
async function expandBlockKeyAliasesStrict(
  map: Record<string, string[]>,
  provenance: Record<string, Record<string, AuthorIdProvenance>>,
  orcidConfirmed: Record<string, string[]>,
  catalog: ResearcherRow[],
  utaByBlock: Map<string, string[]>,
  coAuthorIndex: Map<string, Set<string>>,
  works: Array<{ authorships?: unknown[] }>,
): Promise<{ accepted: AliasAuditRow[]; rejected: AliasAuditRow[] }> {
  const accepted: AliasAuditRow[] = [];
  const rejected: AliasAuditRow[] = [];

  const researcherByOrcid = new Map<string, ResearcherRow>();
  for (const r of catalog) {
    const key = normOrcid(r.o || '');
    if (key) researcherByOrcid.set(key, r);
  }

  const blockByCanonical = new Map<string, string>();
  const allCanonical = new Set<string>();
  for (const ids of Object.values(orcidConfirmed)) {
    for (const id of ids) allCanonical.add(id);
  }

  const idList = [...allCanonical];
  for (let i = 0; i < idList.length; i += BATCH_SIZE) {
    const hits = await fetchAuthorsByOpenAlexIdBatch(idList.slice(i, i + BATCH_SIZE));
    for (const hit of hits) {
      const authorId = parseOpenAlexAuthorId(hit.id);
      const blockKey = (hit.block_key || '').trim().toLowerCase();
      if (authorId && blockKey) blockByCanonical.set(authorId, blockKey);
    }
    await sleep(150);
  }

  const candidateIds = new Set<string>();
  for (const [orcidKey, canonicalIds] of Object.entries(orcidConfirmed)) {
    for (const canonicalId of canonicalIds) {
      const blockKey = blockByCanonical.get(canonicalId);
      if (!blockKey) continue;
      for (const aliasId of utaByBlock.get(blockKey) || []) {
        if (!canonicalIds.includes(aliasId)) candidateIds.add(aliasId);
      }
    }
  }

  const profileById = new Map<string, OpenAlexAuthorHit>();
  const candidates = [...candidateIds];
  for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
    const hits = await fetchAuthorsByOpenAlexIdBatch(candidates.slice(i, i + BATCH_SIZE));
    for (const hit of hits) {
      const authorId = parseOpenAlexAuthorId(hit.id);
      if (authorId) profileById.set(authorId, hit);
    }
    await sleep(150);
  }

  for (const [orcidKey, canonicalIds] of Object.entries(orcidConfirmed)) {
    const researcher = researcherByOrcid.get(orcidKey);
    if (!researcher) continue;

    const inv = {
      rut: (researcher.id || '').trim(),
      name: `${researcher.f || ''} ${researcher.l || ''}`.trim(),
      orcid: cleanOrcid(researcher.o || ''),
    };

    const blockKeys = new Set<string>();
    for (const canonicalId of canonicalIds) {
      const bk = blockByCanonical.get(canonicalId);
      if (bk) blockKeys.add(bk);
    }

    const canonicalSet = new Set(canonicalIds);
    const currentIds = new Set(map[orcidKey] || []);

    for (const blockKey of blockKeys) {
      for (const aliasId of utaByBlock.get(blockKey) || []) {
        if (canonicalSet.has(aliasId) || currentIds.has(aliasId)) continue;

        const profile = profileById.get(aliasId);
        const displayName = profile?.display_name || aliasId;
        const instRors = profile ? institutionRors(profile) : [];
        const baseRow: AliasAuditRow = {
          investigador: inv,
          alias_author_id: aliasId,
          display_name: displayName,
          instituciones_ror: instRors,
          obras_que_aporta: countWorksForAuthor(works, aliasId),
        };

        const aliasOrcid = normOrcid(profile?.orcid || '');
        if (aliasOrcid && aliasOrcid !== orcidKey) {
          rejected.push({ ...baseRow, motivo: 'orcid_distinto' });
          continue;
        }

        const utaAnchor = profile ? authorHasUtaInstitution(profile) : false;
        let coAnchor = false;
        for (const canonicalId of canonicalIds) {
          if (sharedCoAuthorCount(coAuthorIndex, aliasId, new Set([canonicalId])) >= 2) {
            coAnchor = true;
            break;
          }
        }

        if (!utaAnchor && !coAnchor) {
          rejected.push({ ...baseRow, motivo: 'sin_ancla' });
          continue;
        }

        const source: AuthorIdProvenance = utaAnchor ? 'alias_uta_ror' : 'alias_coauthors';
        addAuthorId(map, provenance, orcidKey, aliasId, source);
        currentIds.add(aliasId);
        accepted.push({
          ...baseRow,
          ancla: utaAnchor ? 'UTA_ROR' : 'coautores',
        });
      }
    }
  }

  return { accepted, rejected };
}

function supplementFromAuthorshipOrcids(
  map: Record<string, string[]>,
  provenance: Record<string, Record<string, AuthorIdProvenance>>,
  catalogOrcids: Set<string>,
): number {
  if (!existsSync(AW_PATH)) return 0;
  const works = JSON.parse(readFileSync(AW_PATH, 'utf8')) as Array<{
    authorships?: Array<{ author?: { id?: string; orcid?: string | null } }>;
  }>;

  let added = 0;
  for (const work of works) {
    for (const raw of work.authorships || []) {
      const orcidKey = normOrcid(raw.author?.orcid || '');
      const authorId = parseOpenAlexAuthorId(raw.author?.id);
      if (!orcidKey || !authorId || !catalogOrcids.has(orcidKey)) continue;
      const before = (map[orcidKey] || []).length;
      addAuthorId(map, provenance, orcidKey, authorId, 'authorship_orcid');
      if ((map[orcidKey] || []).length > before) added += 1;
    }
  }
  return added;
}

async function main(): Promise<void> {
  const args = parseArgs();
  if (!existsSync(DATA_PATH)) {
    console.error('Falta src/data.json');
    process.exit(1);
  }

  mkdirSync(dirname(MAP_PATH), { recursive: true });
  mkdirSync(dirname(AUDIT_PATH), { recursive: true });

  const catalog = JSON.parse(readFileSync(DATA_PATH, 'utf8')) as ResearcherRow[];
  const works = existsSync(AW_PATH)
    ? JSON.parse(readFileSync(AW_PATH, 'utf8')) as Array<{ authorships?: unknown[] }>
    : [];

  const orcids = [
    ...new Set(catalog.map((r) => normOrcid(r.o || '')).filter(Boolean)),
  ];

  const map: Record<string, string[]> = {};
  const provenance: Record<string, Record<string, AuthorIdProvenance>> = {};
  const orcidConfirmed: Record<string, string[]> = {};

  const toFetch = args.force ? orcids : orcids;

  console.log(`UTA institución: ${UTA_OPENALEX_ID} | ROR ${UTA_ROR}`);
  console.log(`Resolviendo ORCID → author.id: ${orcids.length} con ORCID en catálogo`);

  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE);
    const hits = await fetchAuthorsByOrcidBatch(batch);

    for (const hit of hits) {
      const authorId = parseOpenAlexAuthorId(hit.id);
      const orcidKey = normOrcid(hit.orcid || '');
      if (!authorId || !orcidKey) continue;
      addAuthorId(map, provenance, orcidKey, authorId, 'orcid');
      if (!orcidConfirmed[orcidKey]) orcidConfirmed[orcidKey] = [];
      if (!orcidConfirmed[orcidKey].includes(authorId)) orcidConfirmed[orcidKey].push(authorId);
    }

    console.log(`  ORCID lote ${Math.floor(i / BATCH_SIZE) + 1}: ${Math.min(i + BATCH_SIZE, toFetch.length)}/${toFetch.length}`);
    if (i + BATCH_SIZE < toFetch.length) await sleep(250);
  }

  console.log('Expandiendo alias block_key (ancla UTA_ROR | ≥2 co-autores)…');
  const utaByBlock = await fetchUtaAuthorsByBlockKey();
  const coAuthorIndex = buildCoAuthorIndex(works);
  const { accepted, rejected } = await expandBlockKeyAliasesStrict(
    map,
    provenance,
    orcidConfirmed,
    catalog,
    utaByBlock,
    coAuthorIndex,
    works,
  );
  console.log(`  alias aceptados: ${accepted.length}`);
  console.log(`  alias rechazados: ${rejected.length}`);

  const authAdded = supplementFromAuthorshipOrcids(map, provenance, new Set(orcids));
  console.log(`  +${authAdded} author.id desde authorships con ORCID`);

  const resolved = orcids.filter((o) => (map[o] || []).length > 0);
  const unresolved = orcids.filter((o) => !(map[o] || []).length);
  const multi = resolved.filter((o) => (map[o] || []).length > 1);

  const output: OrcidAuthorIdMapFile = {
    fetched_at: new Date().toISOString(),
    map,
    provenance,
    stats: {
      orcids_resolved: resolved.length,
      orcids_unresolved: unresolved.length,
      orcids_multi_author: multi.length,
      aliases_accepted: accepted.length,
      aliases_rejected: rejected.length,
    },
  };

  writeFileSync(MAP_PATH, JSON.stringify(output, null, 2));

  const audit = {
    generated_at: new Date().toISOString(),
    uta_institution: { id: UTA_INST_ID, ror: UTA_ROR, ror_bare: UTA_ROR_BARE },
    alias_aceptados: accepted,
    alias_rechazados: rejected,
    obras_vinculo_uta: {
      antes_regla_estricta: WORKS_BEFORE_STRICT,
      pendiente_link_works: true,
    },
    orcid_stats: output.stats,
  };

  writeFileSync(AUDIT_PATH, JSON.stringify(audit, null, 2));

  console.log(`✓ cache en ${MAP_PATH}`);
  console.log(`✓ auditoría en ${AUDIT_PATH}`);
  console.log(`  ORCID resueltos: ${resolved.length} / ${orcids.length}`);
  console.log(`  ORCID sin Author entity: ${unresolved.length}`);
  console.log(`  ORCID con >1 author.id: ${multi.length}`);
  console.log(`  Alias aceptados: ${accepted.length} | rechazados: ${rejected.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
