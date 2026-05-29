#!/usr/bin/env node
/**
 * Persiste autores_uta en src/all-works.json (vinculación con data.json + openalex.json).
 * Ejecutar tras copiar datos reales: npm run link:works
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');

const files = ['data.json', 'openalex.json', 'all-works.json'];
for (const f of files) {
  if (!existsSync(join(SRC, f))) {
    console.error(`Falta ${f}. Ejecuta npm run setup:data primero.`);
    process.exit(1);
  }
}

const DATA = JSON.parse(readFileSync(join(SRC, 'data.json'), 'utf8'));
const OA = JSON.parse(readFileSync(join(SRC, 'openalex.json'), 'utf8'));
const AW = JSON.parse(readFileSync(join(SRC, 'all-works.json'), 'utf8'));

const { linkAutoresUta } = await import('../src/utils/linkAutoresUta.js');
linkAutoresUta(DATA, AW, OA);

const withAuthors = AW.filter((w) => w.autores_uta?.length).length;
writeFileSync(join(SRC, 'all-works.json'), JSON.stringify(AW));

console.log(`✓ autores_uta actualizado en all-works.json`);
console.log(`  ${withAuthors} / ${AW.length} obras con al menos un investigador UTA`);
