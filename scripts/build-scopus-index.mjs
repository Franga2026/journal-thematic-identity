/**
 * build-scopus-index.mjs — Genera el índice compacto de Scopus.
 *
 * Lee el KBART crudo de Scopus (17 MB, FUERA del repo) y produce
 * public/data/scopus_index.json: lista compacta de ISSN indexados.
 * La URL se reconstruye en el cliente con:
 *   https://www.scopus.com/scopus/openurl/link.url?svc.citedby=1&rft.issn=XXXX-XXXX
 *
 * USO:
 *   node scripts/build-scopus-index.mjs [ruta-al-kbart]
 *
 * Por defecto lee de scripts/data/6569_elsevier_scopus_kbart.txt.
 * El KBART crudo NO debe versionarse; solo el JSON resultante.
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_KBART =
  process.argv[2] ||
  'scripts/data/6569_elsevier_scopus_kbart.txt';
const OUT = 'public/data/scopus_index.json';

/** Normaliza un ISSN a formato XXXX-XXXX en mayúsculas. */
function normIssn(raw) {
  if (!raw) return null;
  const s = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (s.length !== 8) return null;
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

function main() {
  const kbartPath = path.resolve(DEFAULT_KBART);
  if (!fs.existsSync(kbartPath)) {
    console.error(`✗ No se encontró el KBART en: ${kbartPath}`);
    console.error(`  Pásalo como argumento: node scripts/build-scopus-index.mjs "ruta/al/kbart.txt"`);
    process.exit(1);
  }

  const raw = fs.readFileSync(kbartPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const header = lines[0].split('\t');

  const col = (name) => header.indexOf(name);
  const iPrint = col('print_identifier');
  const iOnline = col('online_identifier');

  if (iPrint === -1 && iOnline === -1) {
    console.error('✗ El KBART no tiene print_identifier / online_identifier.');
    process.exit(1);
  }

  const set = new Set();
  let rows = 0;
  let noIssn = 0;

  for (let n = 1; n < lines.length; n++) {
    const line = lines[n];
    if (!line.trim()) continue;
    rows++;
    const cells = line.split('\t');
    const issns = [
      normIssn(iPrint >= 0 ? cells[iPrint] : ''),
      normIssn(iOnline >= 0 ? cells[iOnline] : ''),
    ].filter(Boolean);

    if (issns.length === 0) {
      noIssn++;
      continue;
    }
    for (const issn of issns) set.add(issn);
  }

  const list = [...set].sort();
  fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
  fs.writeFileSync(path.resolve(OUT), JSON.stringify(list));

  const sizeKb = (fs.statSync(path.resolve(OUT)).size / 1024).toFixed(0);
  console.log('✓ Índice Scopus generado (lista de ISSN; URL se reconstruye en cliente)');
  console.log(`  Filas leídas:        ${rows}`);
  console.log(`  ISSN únicos:         ${list.length}`);
  console.log(`  Filas sin ISSN:      ${noIssn}`);
  console.log(`  Salida:              ${OUT} (${sizeKb} KB)`);
}

main();
