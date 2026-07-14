/**
 * build-works-lite.mjs — Genera el corpus LIGERO para las tabs globales.
 *
 * PROBLEMA: all-works.json (60 MB) se importa estáticamente → OOM en el build
 * y bundle gigantesco. Las tabs globales (Producción, Áreas, Métricas, ODS,
 * Descubridor) necesitan TODAS las obras, pero NO todos los campos.
 *
 * ANÁLISIS: authorships pesa 1.366 de 2.403 bytes por obra (57%) y las tabs
 * no lo usan. Los campos Crossref/Unpaywall tampoco, salvo cr_issn y up_issn
 * que usa el buscador del Descubridor.
 *
 * RESULTADO: works-lite.json con solo lo necesario → de 60 MB a ~5–8 MB.
 *
 * USO: node scripts/build-works-lite.mjs
 * Genera: public/data/works-lite.json
 */

import fs from 'node:fs';
import path from 'node:path';

const IN = 'src/all-works.json';
const OUT = 'public/data/works-lite.json';

// Campos que SÍ conservamos (los que consumen las tabs globales).
// Verificado con grep sobre src/components/tabs/, src/utils/, src/services/.
const KEEP = [
  // Identificación y básicos
  'openalex_id', 'd', 't', 'y', 'u',
  // Métricas
  'c', 'cited_by_count', 'fwci', 'impact', 'percentile',
  // Clasificación
  'field', 'subfield', 'topic', 'sdgs',
  // Publicación
  's', 'pub', 'tp', 'a', 'ou',
  // Acceso abierto y cuartiles
  'oa', 'srcOA', 'qc', 'qi',
  // Vínculo con investigadores UTA (imprescindible)
  'autores_uta',
  // ISSN que usa el buscador del Descubridor
  'cr_issn', 'up_issn',
];

// Campos EXCLUIDOS explícitamente (para el log):
//   authorships (1366 b, 57% del peso) — las tabs no lo usan
//   resto Crossref/Unpaywall — solo se usan en scripts
//   collabFetchedAt — metadato de generación

function main() {
  console.log('Leyendo el corpus completo...');
  const raw = fs.readFileSync(path.resolve(IN), 'utf8');
  const parsed = JSON.parse(raw);
  const works = Array.isArray(parsed) ? parsed : (parsed.works || Object.values(parsed)[0]);
  const sizeOrigMb = (Buffer.byteLength(raw) / 1024 / 1024).toFixed(1);
  console.log(`  ${works.length} obras · ${sizeOrigMb} MB`);

  const lite = works.map((w) => {
    const o = {};
    for (const k of KEEP) {
      if (w[k] !== undefined && w[k] !== null) o[k] = w[k];
    }
    return o;
  });

  fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
  const json = JSON.stringify(lite);
  fs.writeFileSync(path.resolve(OUT), json);

  const sizeLiteMb = (Buffer.byteLength(json) / 1024 / 1024).toFixed(1);
  const reduccion = (100 * (1 - Buffer.byteLength(json) / Buffer.byteLength(raw))).toFixed(0);

  const todosLosCampos = new Set();
  for (const w of works.slice(0, 100)) {
    for (const k of Object.keys(w)) todosLosCampos.add(k);
  }
  const descartados = [...todosLosCampos].filter((k) => !KEEP.includes(k));

  console.log('');
  console.log('✓ Corpus ligero generado');
  console.log(`  Original:   ${sizeOrigMb} MB`);
  console.log(`  Ligero:     ${sizeLiteMb} MB`);
  console.log(`  Reducción:  ${reduccion}%`);
  console.log(`  Salida:     ${OUT}`);
  console.log('');
  console.log(`  Campos conservados (${KEEP.length}): ${KEEP.join(', ')}`);
  console.log('');
  console.log(`  Campos descartados (${descartados.length}): ${descartados.join(', ')}`);
  console.log('');
  console.log('  → Si alguna tab necesita un campo descartado, añádelo a KEEP y regenera.');
}

main();
