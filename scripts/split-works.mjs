/**
 * split-works.mjs — Parte all-works.json en un archivo por investigador.
 *
 * PROBLEMA: all-works.json (60 MB) se importa estáticamente en el bundle,
 * causando OOM en el build y una app lentísima.
 *
 * SOLUCIÓN: partir el corpus en public/data/works/{id}.json (uno por
 * investigador UTA, clave = data.json `id`, formato RUT, 367/367 lo tienen).
 * El cliente carga solo las obras del investigador que abre (~200 KB).
 *
 * USO: node scripts/split-works.mjs
 *
 * Genera:
 *   public/data/works/{id}.json   — obras de ese investigador
 *   public/data/works/_index.json — { id: nObras } (para saber qué existe)
 */

import fs from 'node:fs';
import path from 'node:path';

const ALL_WORKS = 'src/all-works.json';
const DATA = 'src/data.json';
const OUT_DIR = 'public/data/works';

function main() {
  console.log('Leyendo el corpus...');
  const allWorks = JSON.parse(fs.readFileSync(path.resolve(ALL_WORKS), 'utf8'));
  const works = Array.isArray(allWorks) ? allWorks : (allWorks.works || Object.values(allWorks)[0]);
  console.log(`  ${works.length} obras en total`);

  const dataRaw = JSON.parse(fs.readFileSync(path.resolve(DATA), 'utf8'));
  const researchers = Array.isArray(dataRaw) ? dataRaw : (dataRaw.researchers || Object.values(dataRaw)[0]);
  console.log(`  ${researchers.length} investigadores en el catálogo`);

  // Índice de claves válidas: id (RUT), orcid, author_id → id del investigador
  // Un investigador puede tener varios author_id de OpenAlex.
  const byRut = new Map();     // id (RUT) → id
  const byOrcid = new Map();   // ORCID → id
  for (const r of researchers) {
    if (r.id) byRut.set(String(r.id), String(r.id));
    if (r.o) byOrcid.set(String(r.o).trim(), String(r.id));
  }

  // Agrupa las obras por investigador, usando autores_uta de cada obra.
  const buckets = new Map();   // id → [obras]

  for (const w of works) {
    const utaAuthors = w.autores_uta || [];
    // Un investigador puede aparecer una vez; evitamos duplicar la obra
    const idsDeEstaObra = new Set();

    for (const a of utaAuthors) {
      let rid = null;
      // Prioridad: rut (que es el id) → orcid
      if (a.rut && byRut.has(String(a.rut))) rid = byRut.get(String(a.rut));
      else if (a.orcid && byOrcid.has(String(a.orcid).trim())) rid = byOrcid.get(String(a.orcid).trim());

      if (rid) idsDeEstaObra.add(rid);
    }

    for (const rid of idsDeEstaObra) {
      if (!buckets.has(rid)) buckets.set(rid, []);
      buckets.get(rid).push(w);
    }
  }

  // Escribe un archivo por investigador
  fs.mkdirSync(path.resolve(OUT_DIR), { recursive: true });
  const index = {};
  let totalBytes = 0;
  let maxKb = 0, maxId = '';

  for (const [rid, obras] of buckets) {
    const file = path.resolve(OUT_DIR, `${rid}.json`);
    const json = JSON.stringify(obras);
    fs.writeFileSync(file, json);
    index[rid] = obras.length;
    const kb = Buffer.byteLength(json) / 1024;
    totalBytes += Buffer.byteLength(json);
    if (kb > maxKb) { maxKb = kb; maxId = rid; }
  }

  // Índice: qué investigadores tienen obras y cuántas
  fs.writeFileSync(path.resolve(OUT_DIR, '_index.json'), JSON.stringify(index));

  const sinObras = researchers.filter((r) => !buckets.has(String(r.id))).length;

  console.log('');
  console.log('✓ Partición completa');
  console.log(`  Investigadores con obras:  ${buckets.size}`);
  console.log(`  Investigadores sin obras:  ${sinObras}`);
  console.log(`  Tamaño total generado:     ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  Archivo más grande:        ${maxKb.toFixed(0)} KB (${maxId})`);
  console.log(`  Promedio por investigador: ${(totalBytes / 1024 / buckets.size).toFixed(0)} KB`);
  console.log(`  Salida:                    ${OUT_DIR}/`);
  console.log('');
  console.log('  → El cliente ahora carga ~' + (totalBytes / 1024 / buckets.size).toFixed(0) + ' KB por investigador,');
  console.log('    en vez de los 60 MB del corpus completo.');
}

main();
