/**
 * sync-public-data.mjs — Copia JSON grandes de src/ a public/data/ para fetch.
 *
 * Tras enriquecer datos locales, corre esto (o npm run sync:public-data)
 * para que el cliente pueda cargarlos sin meterlos en el bundle.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'data');

const COPIES = [
  { from: 'src/data/work-citations.json', to: 'work-citations.json' },
  { from: 'src/coauthor-profiles.json', to: 'coauthor-profiles.json' },
  { from: 'src/openalex.json', to: 'openalex.json' },
];

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const { from, to } of COPIES) {
    const src = path.join(ROOT, from);
    const dest = path.join(OUT, to);
    if (!fs.existsSync(src)) {
      console.warn(`⚠ Falta ${from} — omitido`);
      continue;
    }
    fs.copyFileSync(src, dest);
    const mb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(1);
    console.log(`✓ ${to} (${mb} MB)`);
  }
  if (!fs.existsSync(path.join(OUT, 'works-lite.json'))) {
    console.warn('⚠ Falta works-lite.json — corre: npm run build:works-lite');
  } else {
    const mb = (fs.statSync(path.join(OUT, 'works-lite.json')).size / (1024 * 1024)).toFixed(1);
    console.log(`✓ works-lite.json (${mb} MB) [ya presente]`);
  }
}

main();
