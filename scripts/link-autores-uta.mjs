#!/usr/bin/env node
/**
 * Persiste autores_uta en src/all-works.json (author.id vía cache ORCID→author.id).
 * Ejecutar: npm run enrich:author-ids && npm run link:works
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');
const MAP_PATH = join(SRC, 'data', 'orcid-authorid-map.json');
const AUDIT_PATH = join(__dirname, '..', 'outputs', 'audit-blockkey.json');

const files = ['data.json', 'all-works.json'];
for (const f of files) {
  if (!existsSync(join(SRC, f))) {
    console.error(`Falta ${f}. Ejecuta npm run setup:data primero.`);
    process.exit(1);
  }
}

if (!existsSync(MAP_PATH)) {
  console.error('Falta src/data/orcid-authorid-map.json. Ejecuta: npm run enrich:author-ids');
  process.exit(1);
}

const DATA = JSON.parse(readFileSync(join(SRC, 'data.json'), 'utf8'));
const AW = JSON.parse(readFileSync(join(SRC, 'all-works.json'), 'utf8'));
const mapFile = JSON.parse(readFileSync(MAP_PATH, 'utf8'));

const { linkAutoresUta } = await import('../src/utils/linkAutoresUta.ts');
const { parseOpenAlexAuthorId } = await import('../src/utils/openAlexAuthorId.ts');
const { conflicts } = linkAutoresUta(DATA, AW, mapFile);

const withAuthors = AW.filter((w) => w.autores_uta?.length).length;
writeFileSync(join(SRC, 'all-works.json'), JSON.stringify(AW));

const provenance = mapFile.provenance || {};
const ORCID_SOURCES = new Set(['orcid', 'authorship_orcid']);
const ALIAS_SOURCES = new Set(['alias_uta_ror', 'alias_coauthors']);

function linkProvenance(link) {
  const orcidKey = (link.orcid || '').toLowerCase().replace(/^https?:\/\/orcid.org\//i, '');
  const authorId = parseOpenAlexAuthorId(link.author_id);
  return provenance[orcidKey]?.[authorId] || 'orcid';
}

let worksViaOrcidOnly = 0;
let worksViaAlias = 0;
let linksOrcid = 0;
let linksAlias = 0;

for (const w of AW) {
  const links = w.autores_uta || [];
  if (!links.length) continue;
  let hasAlias = false;
  let hasOrcid = false;
  for (const link of links) {
    const src = linkProvenance(link);
    if (ALIAS_SOURCES.has(src)) {
      hasAlias = true;
      linksAlias += 1;
    } else {
      hasOrcid = true;
      linksOrcid += 1;
    }
  }
  if (hasAlias) worksViaAlias += 1;
  else if (hasOrcid) worksViaOrcidOnly += 1;
}

const chin = AW.find((w) => (w.t || '').includes('Chinchorro mummy'));
const spotChecks = {
  arriaza_chinchorro: {
    vinculada: Boolean(chin?.autores_uta?.some((l) => l.rut === '07177740-5')),
    author_ids: (chin?.autores_uta || []).filter((l) => l.rut === '07177740-5').map((l) => l.author_id),
  },
  ariany_a_adriano: AW.filter(
    (w) => (w.a || []).some((n) => /Ariany/i.test(n))
      && (w.autores_uta || []).some((l) => l.rut === '27952891-3'),
  ).length,
  felipe_a_claudia: AW.filter(
    (w) => (w.a || []).some((n) => /Felipe Ponce/i.test(n))
      && (w.autores_uta || []).some((l) => l.rut === '16080784-9'),
  ).length,
  standen_obras: AW.filter((w) => (w.autores_uta || []).some((l) => l.rut === '08243585-9')).length,
};

let audit = {};
if (existsSync(AUDIT_PATH)) {
  audit = JSON.parse(readFileSync(AUDIT_PATH, 'utf8'));
}

const rejectedWorksLost = (audit.alias_rechazados || []).reduce(
  (sum, row) => sum + (row.obras_que_aporta || 0),
  0,
);

audit.generated_at_link = new Date().toISOString();
audit.obras_vinculo_uta = {
  ...(audit.obras_vinculo_uta || {}),
  antes_regla_estricta: audit.obras_vinculo_uta?.antes_regla_estricta ?? 4158,
  despues_regla_estricta: withAuthors,
  delta: withAuthors - (audit.obras_vinculo_uta?.antes_regla_estricta ?? 4158),
  obras_solo_entidad_orcid: worksViaOrcidOnly,
  obras_con_alias_aceptado: worksViaAlias,
  vinculos_por_orcid: linksOrcid,
  vinculos_por_alias: linksAlias,
  obras_potenciales_perdidas_por_alias_rechazado: rejectedWorksLost,
  pendiente_link_works: false,
};
audit.conflictos_author_id_multi_rut = conflicts;
audit.spot_checks = spotChecks;

mkdirSync(dirname(AUDIT_PATH), { recursive: true });
writeFileSync(AUDIT_PATH, JSON.stringify(audit, null, 2));

console.log('✓ autores_uta actualizado en all-works.json');
console.log(`  ${withAuthors} / ${AW.length} obras con al menos un investigador UTA`);
console.log(`  Obras: ${audit.obras_vinculo_uta.antes_regla_estricta} → ${withAuthors} (Δ ${audit.obras_vinculo_uta.delta})`);
console.log(`  Con alias aceptado: ${worksViaAlias} obras | solo ORCID: ${worksViaOrcidOnly}`);
console.log(`  Alias rechazados (obras que aportaban): ${rejectedWorksLost}`);
if (conflicts.length > 0) {
  console.warn(`  ⚠ ${conflicts.length} author.id con conflicto multi-RUT (no atribuidos)`);
}
console.log(`✓ auditoría actualizada en ${AUDIT_PATH}`);
