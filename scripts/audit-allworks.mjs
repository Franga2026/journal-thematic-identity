// =============================================================================
// audit-allworks.mjs — auditoría de all-works.json
// Uso: node scripts/audit-allworks.mjs [ruta]
// =============================================================================

import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const guesses = [
  'src/all-works.json',
  'src/data/all-works.json',
  'public/data/all-works.json',
  'data/all-works.json',
  'public/all-works.json',
  'src/assets/all-works.json',
  'src/data/openalex/all-works.json',
].map((g) => join(ROOT, g));

const argPath = process.argv[2];
const path = argPath || guesses.find((g) => fs.existsSync(g));

if (!path || !fs.existsSync(path)) {
  console.error('No encontré all-works.json. Pásame la ruta:  node scripts/audit-allworks.mjs <ruta>');
  process.exit(1);
}

function normalizeWorks(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    if (Array.isArray(raw.works)) return raw.works;
    const out = [];
    for (const v of Object.values(raw)) {
      if (Array.isArray(v)) out.push(...v);
      else if (v && Array.isArray(v.works)) out.push(...v.works);
      else if (v && typeof v === 'object' && (v.id || v.title || v.display_name || v.t)) out.push(v);
    }
    if (out.length) return out;
  }
  return [];
}

const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
const works = normalizeWorks(raw);

console.log('Archivo:', path);
console.log('Estructura raíz:', Array.isArray(raw) ? 'array' : typeof raw);
console.log('Total works detectados:', works.length);

if (!works.length) {
  console.log('Claves raíz:', raw && typeof raw === 'object' ? Object.keys(raw).slice(0, 25) : '(vacío)');
  process.exit(0);
}

const sample = works[0];
console.log('\nClaves de un work de muestra:\n ', Object.keys(sample).sort().join(', '));

const pct = (n) => (works.length ? `${((100 * n) / works.length).toFixed(1)}%` : '-');

let nPerc = 0;
let nAuth = 0;
let nInst = 0;
let nCountry = 0;
let nRor = 0;
let nType = 0;
let nAutoresUta = 0;
let nOpenAlexId = 0;
let nDoi = 0;
let nQuartile = 0;
let nFwci = 0;
const countries = new Set();

for (const w of works) {
  if (
    w.citation_normalized_percentile != null
    || w.cited_by_percentile_year != null
    || w.percentile != null
    || w.percentile?.value != null
  ) {
    nPerc++;
  }

  const auth = w.authorships || w.authors || [];
  if (Array.isArray(auth) && auth.length) nAuth++;

  let hasInst = false;
  let hasCountry = false;
  let hasRor = false;
  let hasType = false;

  for (const a of Array.isArray(auth) ? auth : []) {
    const insts = a.institutions || (a.institution ? [a.institution] : []);
    for (const ins of insts) {
      hasInst = true;
      if (ins.country_code) {
        hasCountry = true;
        countries.add(ins.country_code);
      }
      if (ins.ror) hasRor = true;
      if (ins.type) hasType = true;
    }
    if (a.countries?.length) {
      hasCountry = true;
      a.countries.forEach((c) => countries.add(c));
    }
  }

  if (hasInst) nInst++;
  if (hasCountry) nCountry++;
  if (hasRor) nRor++;
  if (hasType) nType++;

  if (Array.isArray(w.autores_uta) && w.autores_uta.length) nAutoresUta++;
  if (w.openalex_id?.trim?.()) nOpenAlexId++;
  if (w.d || w.u) nDoi++;
  if (w.qi?.trim?.()) nQuartile++;
  if (w.fwci != null || w.impact != null) nFwci++;
}

console.log('\n=== Cobertura para el Capítulo de Colaboración ===');
console.log('citation_normalized_percentile (o equiv.):', nPerc, `(${pct(nPerc)})`);
console.log('authorships/autores presentes:           ', nAuth, `(${pct(nAuth)})`);
console.log('institutions dentro de authorships:      ', nInst, `(${pct(nInst)})`);
console.log(
  'country_code de afiliaciones:            ',
  nCountry,
  `(${pct(nCountry)})  | países distintos: ${countries.size}`,
);
console.log('ror de instituciones:                    ', nRor, `(${pct(nRor)})`);
console.log('type de institución:                     ', nType, `(${pct(nType)})`);

console.log('\n=== Cobertura general (directorio UTA) ===');
console.log('autores_uta:                             ', nAutoresUta, `(${pct(nAutoresUta)})`);
console.log('openalex_id:                             ', nOpenAlexId, `(${pct(nOpenAlexId)})`);
console.log('DOI/URL:                                 ', nDoi, `(${pct(nDoi)})`);
console.log('cuartil (qi):                            ', nQuartile, `(${pct(nQuartile)})`);
console.log('FWCI/impact:                             ', nFwci, `(${pct(nFwci)})`);

console.log('\nPaíses detectados (muestra):', [...countries].slice(0, 15).join(', ') || '(ninguno)');

console.log('\n--- Forma de una afiliación de muestra (estructura real) ---');
const withAuth = works.find((w) => (w.authorships || w.authors || []).length);
const a0 = withAuth ? (withAuth.authorships || withAuth.authors)[0] : null;
console.log(a0 ? JSON.stringify(a0, null, 2).slice(0, 1200) : '(no hay authorships)');
