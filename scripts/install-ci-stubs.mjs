#!/usr/bin/env node
/**
 * Solo para CI: copia stubs a src/ sin tocar datos reales en desarrollo.
 * Requiere VERIFY_CI_STUBS=1 o argumento --ci.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STUBS = join(__dirname, '..', 'src', 'data-stubs');
const DST = join(__dirname, '..', 'src');

const isCi =
  process.env.CI === 'true' ||
  process.env.VERIFY_CI_STUBS === '1' ||
  process.argv.includes('--ci');

if (!isCi) {
  console.error(
    'install-ci-stubs: abortado. No sobrescribas datos reales en local.\n' +
      '  Para restaurar el dataset: npm run restore:data\n' +
      '  En CI: VERIFY_CI_STUBS=1 node scripts/install-ci-stubs.mjs'
  );
  process.exit(1);
}

const dataPath = join(DST, 'data.json');
if (existsSync(dataPath)) {
  try {
    const raw = readFileSync(dataPath, 'utf8');
    const data = JSON.parse(raw);
    if (Array.isArray(data) && data.length >= 10) {
      console.error(
        'install-ci-stubs: data.json ya tiene datos reales (≥10 investigadores). No se copian stubs.'
      );
      process.exit(1);
    }
  } catch {
    /* seguir con stubs */
  }
}

const names = [
  'data.json',
  'openalex.json',
  'all-works.json',
  'orcid-data.json',
  'ai-data.json',
  'coauthor-profiles.json',
  'institutional-metrics.json',
  'researcher-metrics.json',
];

for (const name of names) {
  const from = join(STUBS, name);
  if (!existsSync(from)) {
    console.error(`✗ Falta stub: ${from}`);
    process.exit(1);
  }
  copyFileSync(from, join(DST, name));
  console.log(`✓ ${name} (stub, ${statSync(from).size} bytes)`);
}

const citationsStub = join(STUBS, 'work-citations.json');
if (existsSync(citationsStub)) {
  const citationsDir = join(DST, 'data');
  mkdirSync(citationsDir, { recursive: true });
  copyFileSync(citationsStub, join(citationsDir, 'work-citations.json'));
  console.log('✓ data/work-citations.json (stub)');
}

console.log('\nStubs instalados para CI.');
