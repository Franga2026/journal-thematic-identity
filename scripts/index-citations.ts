#!/usr/bin/env node
/**
 * Genera src/data/work-citations.json desde all-works.json.
 * Ejecutar: npm run index:citations
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Work } from '../src/shared/types';
import { buildAllCitations } from '../src/utils/citation/buildCitation';
import { getWorkCitationId } from '../src/utils/citation/workCitationId';
import { cleanCitationDoi, normalizeCitationMeta } from '../src/utils/citation/normalizeCitationMeta';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');
const AW_PATH = join(SRC, 'all-works.json');
const OUT_PATH = join(SRC, 'data', 'work-citations.json');

const useCrossref = process.argv.includes('--crossref');

if (!existsSync(AW_PATH)) {
  console.error('Falta src/all-works.json');
  process.exit(1);
}

const AW = JSON.parse(readFileSync(AW_PATH, 'utf8')) as Work[];

async function enrichFromCrossref(doi: string): Promise<Partial<Work> | null> {
  const key = cleanCitationDoi(doi);
  if (!key) return null;
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(key)}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      message?: {
        title?: string[];
        author?: Array<{ family?: string; given?: string }>;
        published?: { 'date-parts'?: number[][] };
        'container-title'?: string[];
        volume?: string;
        issue?: string;
        page?: string;
        DOI?: string;
      };
    };
    const m = json.message || {};
    const authors = (m.author || []).map((a) => `${a.family || ''}, ${(a.given || '').trim()}`.trim());
    return {
      t: m.title?.[0],
      y: m.published?.['date-parts']?.[0]?.[0],
      s: m['container-title']?.[0],
      vol: m.volume,
      issue: m.issue,
      pages: m.page,
      a: authors.filter(Boolean),
      d: m.DOI || key,
    };
  } catch {
    return null;
  }
}

const index: Record<string, ReturnType<typeof buildAllCitations> & { doi?: string; updatedAt: string }> = {};
const updatedAt = new Date().toISOString();
let enriched = 0;

for (let i = 0; i < AW.length; i += 1) {
  let work = AW[i];
  const id = getWorkCitationId(work);

  if (useCrossref && work.d) {
    const meta = normalizeCitationMeta(work);
    if (meta.missing.length > 0) {
      const extra = await enrichFromCrossref(work.d);
      if (extra) {
        work = { ...work, ...extra, d: work.d || extra.d };
        enriched += 1;
      }
      await new Promise((r) => setTimeout(r, 80));
    }
  }

  const citations = buildAllCitations(work);
  index[id] = {
    ...citations,
    doi: cleanCitationDoi(work.d || work.doi) || undefined,
    updatedAt,
  };

  if ((i + 1) % 1000 === 0) {
    console.log(`  … ${i + 1} / ${AW.length}`);
  }
}

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(index));

console.log(`✓ work-citations.json generado (${Object.keys(index).length} entradas)`);
console.log(`  → ${OUT_PATH}`);
if (useCrossref) console.log(`  Crossref enriquecidos: ${enriched}`);
