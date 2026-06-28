// =============================================================================
// audit-colab.mjs — auditoría enfocada en campos de COLABORACIÓN
// Uso: node scripts/audit-colab.mjs [ruta]
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

const path = process.argv[2] || guesses.find((g) => fs.existsSync(g));

if (!path || !fs.existsSync(path)) {
  console.error('No existe:', process.argv[2] || '(ruta por defecto)');
  console.error('Uso: node scripts/audit-colab.mjs <ruta a all-works.json>');
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
const n = works.length;
const pct = (x) => (n ? `${((100 * x) / n).toFixed(1)}%` : '-');

let perc = 0;
let inst = 0;
let cc = 0;
let ror = 0;
let type = 0;
let nAuth = 0;
let nAutoresUta = 0;
let multiUta = 0;
const countries = new Set();

for (const w of works) {
  if (
    w.citation_normalized_percentile != null
    || w.cited_by_percentile_year != null
    || w.percentile != null
    || w.percentile?.value != null
  ) {
    perc++;
  }

  const auth = w.authorships || w.authors || [];
  if (Array.isArray(auth) && auth.length) nAuth++;

  if (Array.isArray(w.autores_uta) && w.autores_uta.length) {
    nAutoresUta++;
    if (w.autores_uta.length >= 2) multiUta++;
  }

  let hi = false;
  let hc = false;
  let hr = false;
  let ht = false;

  for (const a of auth) {
    for (const ins of a.institutions || (a.institution ? [a.institution] : [])) {
      hi = true;
      if (ins.country_code) {
        hc = true;
        countries.add(ins.country_code);
      }
      if (ins.ror) hr = true;
      if (ins.type) ht = true;
    }
    if (a.countries?.length) {
      hc = true;
      a.countries.forEach((c) => countries.add(c));
    }
  }

  if (hi) inst++;
  if (hc) cc++;
  if (hr) ror++;
  if (ht) type++;
}

console.log('Archivo:', path, '| works:', n);
console.log('\n=== Campos para el Capítulo de Colaboración ===');
console.log('authorships/autores presentes:   ', nAuth, `(${pct(nAuth)})`);
console.log('institutions dentro de authorships:', inst, `(${pct(inst)})`);
console.log(
  'country_code de afiliaciones:      ',
  cc,
  `(${pct(cc)})  | países distintos: ${countries.size}`,
);
console.log('ror de instituciones:              ', ror, `(${pct(ror)})`);
console.log('institution.type:                  ', type, `(${pct(type)})`);
console.log('citation_normalized_percentile:    ', perc, `(${pct(perc)})`);

console.log('\n=== Vínculos UTA (autores_uta) ===');
console.log('obras con autores_uta:             ', nAutoresUta, `(${pct(nAutoresUta)})`);
console.log('multi-UTA (≥2 autores UTA):        ', multiUta, `(${pct(multiUta)})`);

console.log('\nPaíses (muestra):', [...countries].slice(0, 20).join(', ') || '(ninguno)');

const s = works.find((w) => (w.authorships || w.authors || []).length);
console.log('\n--- Afiliación de muestra (estructura real) ---');
console.log(
  s
    ? JSON.stringify((s.authorships || s.authors)[0], null, 2).slice(0, 1500)
    : '(sin authorships)',
);
