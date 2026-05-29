#!/usr/bin/env node
/**
 * Copia JSON reales desde directorio-uta/src/ (referencia local).
 */
import { copyFileSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DST = join(__dirname, '..', 'src');
const PHOTOS_DST = join(__dirname, '..', 'public', 'photos');

const REF_ROOT_CANDIDATES = [
  join(__dirname, '..', '..', 'directorio-uta'),
  join(__dirname, '..', '..', 'directorio-uta/'),
];

const SRC_CANDIDATES = REF_ROOT_CANDIDATES.map((r) => join(r, 'src'));
const PHOTOS_CANDIDATES = REF_ROOT_CANDIDATES.map((r) => join(r, 'public', 'photos'));

const FILES = [
  'data.json',
  'openalex.json',
  'all-works.json',
  'orcid-data.json',
  'ai-data.json',
  'coauthor-profiles.json',
  'institutional-metrics.json',
  'researcher-metrics.json',
];

const srcDir = SRC_CANDIDATES.find((d) => existsSync(join(d, 'data.json')));
const photosDir = PHOTOS_CANDIDATES.find((d) => existsSync(d));

if (!srcDir) {
  console.error('No se encontró directorio-uta/src/ con data.json.');
  console.error('Buscado en:', SRC_CANDIDATES.join(', '));
  process.exit(1);
}

for (const name of FILES) {
  const from = join(srcDir, name);
  const to = join(DST, name);
  if (!existsSync(from)) {
    console.error(`✗ Falta en origen: ${from}`);
    process.exit(1);
  }
  copyFileSync(from, to);
  console.log(`✓ ${name}`);
}

if (photosDir) {
  cpSync(photosDir, PHOTOS_DST, { recursive: true });
  const count = readdirSync(PHOTOS_DST).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).length;
  console.log(`✓ public/photos/ (${count} imágenes)`);
} else {
  console.warn('⚠ No se encontró directorio-uta/public/photos — copia manualmente a public/photos/');
}

console.log(`\nJSON desde ${srcDir} → ${DST}`);
console.log('Ejecuta: npm run verify:data');
