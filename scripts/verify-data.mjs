#!/usr/bin/env node
/**
 * Verifica que los 8 JSON de datos existan en src/ y no sean stubs vacíos.
 * Uso: npm run verify:data
 * CI / solo existencia: npm run verify:data -- --allow-stubs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');

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

const allowStubs = process.argv.includes('--allow-stubs');

function checkRealData(name, raw) {
  if (name === 'data.json') {
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || data.length < 10) {
      return `se esperan ≥10 investigadores (tiene ${Array.isArray(data) ? data.length : '?'})`;
    }
    return null;
  }
  if (name === 'all-works.json') {
    const works = JSON.parse(raw);
    if (!Array.isArray(works) || works.length < 100) {
      return `se esperan ≥100 publicaciones (tiene ${Array.isArray(works) ? works.length : '?'})`;
    }
    return null;
  }
  if (name === 'openalex.json') {
    const oa = JSON.parse(raw);
    const n = Object.keys(oa.authors || {}).length;
    if (n < 5) return `se esperan ≥5 autores OpenAlex (tiene ${n})`;
    return null;
  }
  const minBytes = {
    'orcid-data.json': 10_000,
    'ai-data.json': 10_000,
    'coauthor-profiles.json': 50_000,
    'institutional-metrics.json': 1_000,
    'researcher-metrics.json': 5_000,
  };
  const min = minBytes[name];
  if (min && raw.length < min) {
    return `archivo muy pequeño (${raw.length} bytes, mínimo ~${min})`;
  }
  return null;
}

let failed = false;

for (const name of FILES) {
  const path = join(SRC, name);
  if (!existsSync(path)) {
    console.error(`✗ Falta ${path}`);
    failed = true;
    continue;
  }

  const size = statSync(path).size;
  const raw = readFileSync(path, 'utf8');

  if (allowStubs) {
    console.log(`✓ ${name} (${size} bytes)`);
    continue;
  }

  try {
    const issue = checkRealData(name, raw);
    if (issue) {
      console.error(`✗ ${name}: ${issue}`);
      failed = true;
    } else {
      console.log(`✓ ${name} (${size} bytes)`);
    }
  } catch (err) {
    console.error(`✗ ${name}: JSON inválido — ${err.message}`);
    failed = true;
  }
}

if (failed) {
  console.error(`
Dataset incompleto o son stubs.

Copia los JSON reales desde:
  directorio-uta/src/
hacia:
  directorio-uta 7/src/

Ejemplo (ajusta rutas si hace falta):
  cp ../directorio-uta/src/*.json src/

O ejecuta: npm run setup:data
`);
  process.exit(1);
}

const photosDir = join(__dirname, '..', 'public', 'photos');
if (!existsSync(photosDir)) {
  console.warn('\n⚠ Falta public/photos/ — las fotos de perfil no se verán. Ejecuta: npm run setup:data');
} else {
  const photoCount = readdirSync(photosDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).length;
  if (photoCount < 10 && !allowStubs) {
    console.warn(`\n⚠ public/photos/ tiene solo ${photoCount} archivos — esperado ~173. Ejecuta: npm run setup:data`);
  } else {
    console.log(`✓ public/photos/ (${photoCount} imágenes)`);
  }
}

console.log('\nDataset OK — listo para dev / build con datos reales.');
