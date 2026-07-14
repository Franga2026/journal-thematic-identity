/**
 * build-scopus-index.mjs (v2) — Índice compacto de Scopus con DOS grupos.
 *
 * Corrige los 404: ~2.809 revistas que Scopus solo resuelve por rft.title
 * (no por ISSN). El índice ahora distingue:
 *   - byIssn:  array de ISSN → se reconstruye con &rft.issn=ISSN
 *   - byTitle: { ISSN → título } → se reconstruye con &rft.title=título
 *
 * USO: node scripts/build-scopus-index.mjs "ruta/al/6569_elsevier.scopus_kbart.txt"
 *
 * El KBART crudo NO debe versionarse; solo el JSON resultante.
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_KBART = process.argv[2] || 'scripts/data/6569_elsevier_scopus_kbart.txt';
const OUT = 'public/data/scopus_index.json';

function normIssn(raw) {
  if (!raw) return null;
  const s = raw.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (s.length !== 8) return null;
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Extrae el valor de rft.title de una URL (tal como viene, ya codificado). */
function extractRftTitle(url) {
  const m = url.match(/[?&]rft\.title=([^&]*)/i);
  return m ? m[1] : null;
}

/** ¿La URL enlaza por ISSN? (contiene rft.issn). */
function urlUsesIssn(url) {
  return /[?&]rft\.issn=/i.test(url);
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
  const col = (n) => header.indexOf(n);
  const iPrint = col('print_identifier');
  const iOnline = col('online_identifier');
  const iUrl = col('title_url');

  if (iUrl === -1) {
    console.error('✗ El KBART no tiene columna title_url.');
    process.exit(1);
  }

  const byIssnSet = new Set();
  const byTitle = {};
  let rows = 0;
  let nIssn = 0;
  let nTitle = 0;
  let noIssn = 0;
  let noUrl = 0;

  for (let n = 1; n < lines.length; n++) {
    const line = lines[n];
    if (!line.trim()) continue;
    rows++;
    const cells = line.split('\t');
    const url = (cells[iUrl] || '').trim();
    if (!url) {
      noUrl++;
      continue;
    }

    const issns = [
      normIssn(iPrint >= 0 ? cells[iPrint] : ''),
      normIssn(iOnline >= 0 ? cells[iOnline] : ''),
    ].filter(Boolean);
    if (issns.length === 0) {
      noIssn++;
      continue;
    }

    if (urlUsesIssn(url)) {
      for (const issn of issns) byIssnSet.add(issn);
      nIssn++;
    } else {
      const title = extractRftTitle(url);
      if (title) {
        for (const issn of issns) {
          if (!byTitle[issn] && !byIssnSet.has(issn)) byTitle[issn] = title;
        }
        nTitle++;
      } else {
        for (const issn of issns) byIssnSet.add(issn);
        nIssn++;
      }
    }
  }

  // byTitle gana: ISSN que el KBART solo resuelve por título
  const byIssn = [...byIssnSet].filter((i) => !byTitle[i]).sort();

  const payload = { byIssn, byTitle };
  const json = JSON.stringify(payload);
  fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
  fs.writeFileSync(path.resolve(OUT), json);

  const sizeKb = (fs.statSync(path.resolve(OUT)).size / 1024).toFixed(0);
  console.log('✓ Índice Scopus v2 generado (dos grupos)');
  console.log(`  Filas leídas:          ${rows}`);
  console.log(`  ISSN por rft.issn:     ${byIssn.length}`);
  console.log(`  ISSN por rft.title:    ${Object.keys(byTitle).length}`);
  console.log(`  Filas sin ISSN:        ${noIssn}`);
  console.log(`  Filas sin URL:         ${noUrl}`);
  console.log(`  Salida:                ${OUT} (${sizeKb} KB)`);
}

main();
