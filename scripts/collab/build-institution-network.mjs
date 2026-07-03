#!/usr/bin/env node
/**
 * Red de colaboración institucional de la UTA.
 * Lee src/all-works.json (local, ya enriquecido con FWCI/cuartil/instituciones)
 * y agrupa por institución partner (excluyendo la UTA).
 *
 * Salida: outputs/collab/uta-institutions.json
 *   - institutions: lista ordenada (--sort)
 *   - grupos: { volumen, impacto, elite } con investigadores_uta por partner
 *   - investigadores_clave: presencia por grupo
 *
 * Uso: node scripts/collab/build-institution-network.mjs [--min 3] [--min-elite 10] [--top 15] [--sort volumen|fwci|q1]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const args = process.argv.slice(2);
const getFlag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const MIN_WORKS = parseInt(getFlag('min', '3'), 10);
const MIN_ELITE = parseInt(getFlag('min-elite', '10'), 10);
const TOP_GROUP = parseInt(getFlag('top', '15'), 10);
const SORT_BY = getFlag('sort', 'volumen');

const UTA_ROR = '04xe01d27';
const isUTA = (inst) => {
  const ror = (inst.ror || '').toLowerCase();
  const name = (inst.display_name || '').toLowerCase();
  return ror.includes(UTA_ROR) || name.includes('tarapac');
};

const rorKey = (inst) => {
  const ror = inst.ror || '';
  const m = ror.match(/ror\.org\/(.+)$/);
  return m ? m[1] : (inst.display_name || 'unknown');
};

const worksPath = resolve(ROOT, 'src/all-works.json');
const works = JSON.parse(readFileSync(worksPath, 'utf8'));
console.log(`Obras cargadas: ${works.length}`);

const acc = new Map();
let worksWithInst = 0;

for (const w of works) {
  const auths = w.authorships || [];
  const partnersEnObra = new Map();
  let hayUTA = false;
  let hayInst = false;

  for (const a of auths) {
    for (const inst of a.institutions || []) {
      hayInst = true;
      if (isUTA(inst)) {
        hayUTA = true;
        continue;
      }
      partnersEnObra.set(rorKey(inst), inst);
    }
  }

  if (hayInst) worksWithInst++;

  const tieneVinculoUTA = hayUTA || (w.autores_uta && w.autores_uta.length > 0);
  if (!tieneVinculoUTA) continue;

  const utaNames = (w.autores_uta || []).map((u) => u.name).filter(Boolean);
  const fwci =
    typeof w.fwci === 'number' ? w.fwci : typeof w.impact === 'number' ? w.impact : null;
  const esQ1 = w.qi === 'Q1';
  const tieneCuartil = !!w.qi;
  const year = typeof w.y === 'number' ? w.y : null;

  for (const [key, inst] of partnersEnObra) {
    if (!acc.has(key)) {
      acc.set(key, {
        ror: key,
        display_name: inst.display_name || key,
        country_code: inst.country_code || null,
        type: inst.type || null,
        trabajos_conjuntos: 0,
        _sumFwci: 0,
        _nFwci: 0,
        _q1: 0,
        _conCuartil: 0,
        _minYear: null,
        _maxYear: null,
        _utaNames: new Set(),
      });
    }
    const e = acc.get(key);
    e.trabajos_conjuntos++;
    if (fwci != null && fwci > 0) {
      e._sumFwci += fwci;
      e._nFwci++;
    }
    if (tieneCuartil) {
      e._conCuartil++;
      if (esQ1) e._q1++;
    }
    if (year != null) {
      e._minYear = e._minYear == null ? year : Math.min(e._minYear, year);
      e._maxYear = e._maxYear == null ? year : Math.max(e._maxYear, year);
    }
    for (const name of utaNames) e._utaNames.add(name);
  }
}

console.log(`Obras con instituciones: ${worksWithInst}`);
console.log(`Instituciones partner únicas (antes de filtrar): ${acc.size}`);

function finalizeRow(e) {
  return {
    ror: e.ror,
    display_name: e.display_name,
    country_code: e.country_code,
    type: e.type,
    trabajos_conjuntos: e.trabajos_conjuntos,
    fwci_promedio: e._nFwci > 0 ? +(e._sumFwci / e._nFwci).toFixed(3) : null,
    obras_con_fwci: e._nFwci,
    pct_q1: e._conCuartil > 0 ? +((e._q1 / e._conCuartil) * 100).toFixed(1) : null,
    obras_q1: e._q1,
    obras_con_cuartil: e._conCuartil,
    primer_año: e._minYear,
    ultimo_año: e._maxYear,
    investigadores_uta: [...e._utaNames].sort((a, b) => a.localeCompare(b, 'es')),
  };
}

const allRows = [...acc.values()]
  .filter((e) => e.trabajos_conjuntos >= MIN_WORKS)
  .map(finalizeRow);

const sorters = {
  volumen: (a, b) => b.trabajos_conjuntos - a.trabajos_conjuntos,
  fwci: (a, b) => (b.fwci_promedio ?? -1) - (a.fwci_promedio ?? -1),
  q1: (a, b) => (b.pct_q1 ?? -1) - (a.pct_q1 ?? -1),
};

const network = [...allRows].sort(sorters[SORT_BY] || sorters.volumen);

function toGrupoRow(e) {
  return {
    institución: e.display_name,
    ror: e.ror,
    trabajos: e.trabajos_conjuntos,
    fwci: e.fwci_promedio,
    q1: e.pct_q1,
    país: e.country_code,
    type: e.type,
    primer_año: e.primer_año,
    ultimo_año: e.ultimo_año,
    investigadores_uta: e.investigadores_uta,
  };
}

const grupos = {
  volumen: [...allRows].sort(sorters.volumen).slice(0, TOP_GROUP).map(toGrupoRow),
  impacto: [...allRows]
    .filter((e) => e.trabajos_conjuntos >= MIN_ELITE && e.fwci_promedio != null)
    .sort(sorters.fwci)
    .slice(0, TOP_GROUP)
    .map(toGrupoRow),
  elite: [...allRows]
    .filter((e) => e.trabajos_conjuntos >= MIN_ELITE && e.pct_q1 != null)
    .sort(sorters.q1)
    .slice(0, TOP_GROUP)
    .map(toGrupoRow),
};

const investigadoresClave = new Map();

function registerGrupo(grupoName, rows) {
  for (const row of rows) {
    for (const name of row.investigadores_uta) {
      if (!investigadoresClave.has(name)) {
        investigadoresClave.set(name, {
          volumen: 0,
          impacto: 0,
          elite: 0,
          instituciones_volumen: [],
          instituciones_impacto: [],
          instituciones_elite: [],
        });
      }
      const rec = investigadoresClave.get(name);
      rec[grupoName]++;
      rec[`instituciones_${grupoName}`].push(row.institución);
    }
  }
}

registerGrupo('volumen', grupos.volumen);
registerGrupo('impacto', grupos.impacto);
registerGrupo('elite', grupos.elite);

const investigadores_clave = Object.fromEntries(
  [...investigadoresClave.entries()]
    .sort((a, b) => {
      const score = (r) => r.volumen + r.impacto + r.elite;
      return score(b[1]) - score(a[1]) || a[0].localeCompare(b[0], 'es');
    })
    .map(([name, rec]) => [
      name,
      {
        volumen: rec.volumen,
        impacto: rec.impacto,
        elite: rec.elite,
        instituciones_volumen: rec.instituciones_volumen,
        instituciones_impacto: rec.instituciones_impacto,
        instituciones_elite: rec.instituciones_elite,
      },
    ]),
);

const porPais = {};
for (const e of network) {
  const c = e.country_code || '??';
  porPais[c] = (porPais[c] || 0) + e.trabajos_conjuntos;
}

const outDir = resolve(ROOT, 'outputs/collab');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'uta-institutions.json');
writeFileSync(
  outPath,
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      source: 'src/all-works.json (local)',
      uta_ror: UTA_ROR,
      min_works: MIN_WORKS,
      min_elite: MIN_ELITE,
      top_group: TOP_GROUP,
      sort_by: SORT_BY,
      total_partners: network.length,
      por_pais: porPais,
      grupos,
      investigadores_clave,
      institutions: network,
    },
    null,
    2,
  ),
);

console.log(`\n✓ Red generada: ${outPath}`);
console.log(`  Partners (>= ${MIN_WORKS} trabajos): ${network.length}`);
console.log(`  Grupos: volumen ${grupos.volumen.length} · impacto ${grupos.impacto.length} · elite ${grupos.elite.length}`);
console.log(`  Investigadores clave: ${Object.keys(investigadores_clave).length}`);
console.log(`\nTop 15 por ${SORT_BY}:`);
network.slice(0, 15).forEach((e, i) => {
  console.log(
    String(i + 1).padStart(2),
    '·',
    String(e.trabajos_conjuntos).padStart(4),
    'obras',
    '· FWCI',
    String(e.fwci_promedio ?? '--').padStart(6),
    '· Q1',
    String(e.pct_q1 ?? '--').padStart(5) + '%',
    '·',
    e.country_code || '??',
    '·',
    e.display_name,
    e.investigadores_uta.length ? `· ${e.investigadores_uta.length} inv. UTA` : '',
  );
});
