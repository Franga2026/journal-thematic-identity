#!/usr/bin/env node
/**
 * Valida entradas global_profile contra el contrato GlobalProfile.
 * Uso: node scripts/validate-global-profile.mjs ./src/coauthor-profiles.json
 */

import { readFileSync } from 'node:fs';

const path = process.argv[2] || './src/coauthor-profiles.json';
const data = JSON.parse(readFileSync(path, 'utf8'));
const entries = Array.isArray(data) ? data : Object.values(data);

const REQUIRED_TOP = [
  'source',
  'fetched_at',
  'author_id',
  'works_count',
  'cited_by_count',
  'elite',
  'oa',
  'scope',
  'trajectory',
  'top_works',
];

function validate(gp, label) {
  const issues = [];
  for (const k of REQUIRED_TOP) {
    if (gp[k] == null) issues.push(`falta ${k}`);
  }
  if (typeof gp.works_count !== 'number' || gp.works_count < 0) issues.push('works_count inválido');
  if (!Array.isArray(gp.trajectory) || gp.trajectory.length === 0) issues.push('trajectory vacía');
  if (!Array.isArray(gp.top_works) || gp.top_works.length === 0) issues.push('top_works vacío');
  if (gp.elite && gp.elite.total < gp.elite.top10) issues.push('elite.top10 > total');
  if (gp.scope && gp.scope.intl + gp.scope.natl + gp.scope.inst > 103) issues.push('scope % suma > 103');
  const last = gp.trajectory?.[gp.trajectory.length - 1];
  if (last && last.cum_cits < 0) issues.push('cum_cits negativo');
  return { label, ok: issues.length === 0, issues, summary: {
    works: gp.works_count,
    cits: gp.cited_by_count,
    h: gp.h_index,
    fwci: gp.fwci_mean,
    elite: gp.elite ? `${gp.elite.top10}/${gp.elite.total}` : null,
    oa: gp.oa?.pct,
    scope: gp.scope ? `${gp.scope.intl}/${gp.scope.natl}/${gp.scope.inst}` : null,
    cuartiles: gp.cuartiles?.with_quartile ?? null,
    trajYears: gp.trajectory?.length ?? 0,
    topWorks: gp.top_works?.length ?? 0,
  }};
}

const withGp = entries.filter((e) => e?.global_profile);
const results = withGp.map((e) => validate(e.global_profile, e.name || e.orcid));
const bad = results.filter((r) => !r.ok);

console.log(`Archivo: ${path}`);
console.log(`Total perfiles: ${entries.length}`);
console.log(`Con global_profile: ${withGp.length}`);
console.log(`Válidos: ${results.length - bad.length}`);
console.log(`Con issues: ${bad.length}`);

if (results.length) {
  console.log('\nMuestra (hasta 5):');
  for (const r of results.slice(0, 5)) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.label}`, JSON.stringify(r.summary));
    if (!r.ok) console.log('    ', r.issues.join('; '));
  }
}

if (bad.length) {
  console.log('\nPrimeros fallos:');
  for (const r of bad.slice(0, 10)) {
    console.log(`  ✗ ${r.label}: ${r.issues.join('; ')}`);
  }
  process.exit(1);
}
