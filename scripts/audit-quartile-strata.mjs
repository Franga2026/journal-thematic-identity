// =============================================================================
// audit-quartile-strata.mjs — auditoría de quartile_profile por estratos de muestra
// -----------------------------------------------------------------------------
// Uso:
//   node scripts/audit-quartile-strata.mjs                 (usa src/openalex.json)
//   node scripts/audit-quartile-strata.mjs ruta/al.json
//
// Agrupa autores por with_quartile (obras con cuartil SJR) y reporta estabilidad
// del % Q1: medias, extremos (0%/100%) y perfiles frágiles (poca muestra).
// =============================================================================

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = process.argv[2] ?? join(__dirname, '..', 'src', 'openalex.json');

/** Estratos por número de obras con cuartil reconocido. */
const WQ_STRATA = [
  { label: '0 (sin cuartil)', min: 0, max: 0 },
  { label: '1', min: 1, max: 1 },
  { label: '2–3', min: 2, max: 3 },
  { label: '4–10', min: 4, max: 10 },
  { label: '11–30', min: 11, max: 30 },
  { label: '31+', min: 31, max: Infinity },
];

/** Estratos por cobertura: with_quartile / works_count. */
const COV_STRATA = [
  { label: '0%', min: 0, max: 0 },
  { label: '1–25%', min: 0.01, max: 0.25 },
  { label: '26–50%', min: 0.26, max: 0.5 },
  { label: '51–75%', min: 0.51, max: 0.75 },
  { label: '76–99%', min: 0.76, max: 0.99 },
  { label: '100%', min: 1, max: 1 },
];

const FRAGILE_MAX_WQ = 5;
const FRAGILE_EXTREME = new Set([0, 100]);

const f = (x) => (typeof x === 'number' ? x.toFixed(1) : 'N/D');
const f2 = (x) => (typeof x === 'number' ? x.toFixed(2) : 'N/D');

function inStratum(value, { min, max }) {
  return value >= min && value <= max;
}

function stats(vals) {
  if (!vals.length) return null;
  const sorted = [...vals].sort((a, b) => a - b);
  const mean = vals.reduce((s, x) => s + x, 0) / vals.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  return { n: vals.length, mean, median, min: sorted[0], max: sorted.at(-1) };
}

function tallyStrata(rows, strata, pick) {
  const buckets = strata.map((s) => ({ ...s, rows: [] }));
  for (const row of rows) {
    const v = pick(row);
    const bucket = buckets.find((s) => inStratum(v, s));
    if (bucket) bucket.rows.push(row);
  }
  return buckets;
}

const db = JSON.parse(readFileSync(path, 'utf8'));
const authors = Object.entries(db.authors ?? {});

const rows = authors.map(([orcid, a]) => {
  const qp = a.quartile_profile ?? {};
  const wq = qp.with_quartile ?? 0;
  const wc = typeof a.works_count === 'number' ? a.works_count : 0;
  const cov = wc > 0 ? wq / wc : 0;
  return {
    orcid,
    name: a.display_name ?? orcid,
    wq,
    wc,
    cov,
    q1: qp.q1_pct,
    q1q2: qp.q1q2_pct,
    q1n: qp.q1 ?? 0,
  };
});

const withQ1 = rows.filter((r) => typeof r.q1 === 'number');
const fragile = withQ1.filter(
  (r) => r.wq > 0 && r.wq <= FRAGILE_MAX_WQ && FRAGILE_EXTREME.has(r.q1),
);

console.log('============= AUDITORÍA QUARTILE POR ESTRATOS =============');
console.log(`Archivo:              ${path}`);
console.log(`Autores totales:      ${rows.length}`);
console.log(`Con q1_pct numérico:  ${withQ1.length}`);
console.log('----------------------------------------------------------');

console.log('Estratos por with_quartile (obras con cuartil SJR):');
console.log('  Estrato   N   Q1% media  mediana   min   max   @0%  @100%');
for (const b of tallyStrata(rows, WQ_STRATA, (r) => r.wq)) {
  const q1s = b.rows.map((r) => r.q1).filter((v) => typeof v === 'number');
  const st = stats(q1s);
  const at0 = q1s.filter((v) => v === 0).length;
  const at100 = q1s.filter((v) => v === 100).length;
  const pad = b.label.padEnd(14);
  if (!st) {
    console.log(`  ${pad} ${String(b.rows.length).padStart(3)}   (sin q1_pct)`);
    continue;
  }
  console.log(
    `  ${pad} ${String(b.rows.length).padStart(3)}   ${f(st.mean).padStart(7)}  ${f(st.median).padStart(7)}  ${f(st.min).padStart(5)}  ${f(st.max).padStart(5)}  ${String(at0).padStart(3)}  ${String(at100).padStart(5)}`,
  );
}

console.log('----------------------------------------------------------');
console.log('Estratos por cobertura (with_quartile / works_count):');
console.log('  Estrato   N   Q1% media  mediana');
for (const b of tallyStrata(rows, COV_STRATA, (r) => r.cov)) {
  const q1s = b.rows.map((r) => r.q1).filter((v) => typeof v === 'number');
  const st = stats(q1s);
  const pad = b.label.padEnd(14);
  if (!st) {
    console.log(`  ${pad} ${String(b.rows.length).padStart(3)}   (sin q1_pct)`);
    continue;
  }
  console.log(
    `  ${pad} ${String(b.rows.length).padStart(3)}   ${f(st.mean).padStart(7)}  ${f(st.median).padStart(7)}`,
  );
}

console.log('----------------------------------------------------------');
const global = stats(withQ1.map((r) => r.q1));
if (global) {
  console.log(
    `Global Q1%:  media=${f(global.mean)}  mediana=${f(global.median)}  min=${f(global.min)}  max=${f(global.max)}`,
  );
}

const wqVals = rows.map((r) => r.wq).filter((v) => v > 0);
const wqStats = stats(wqVals);
if (wqStats) {
  console.log(
    `with_quartile:  media=${f2(wqStats.mean)}  mediana=${f2(wqStats.median)}  min=${wqStats.min}  max=${wqStats.max}`,
  );
}

console.log('----------------------------------------------------------');
console.log(
  `Perfiles frágiles (Q1% 0 o 100 con with_quartile ≤ ${FRAGILE_MAX_WQ}): ${fragile.length}`,
);
if (fragile.length) {
  fragile
    .sort((a, b) => a.wq - b.wq || (b.q1 ?? 0) - (a.q1 ?? 0))
    .slice(0, 20)
    .forEach((r) =>
      console.log(
        `     ${r.orcid}  Q1=${r.q1}%  wq=${r.wq}/${r.wc}  (${r.name})`,
      ),
    );
  if (fragile.length > 20) console.log(`     … y ${fragile.length - 20} más`);
} else {
  console.log('✅ Sin perfiles frágiles en el umbral configurado.');
}

const gKey = rows.find((r) => r.orcid.includes('0000-0002-3298-6877'));
console.log('----------------------------------------------------------');
if (gKey) {
  console.log('Spot-check Gonzalo (0000-0002-3298-6877):');
  console.log(
    `   Q1=${gKey.q1 ?? 'N/D'}%  wq=${gKey.wq}/${gKey.wc}  cobertura=${f(gKey.cov * 100)}%`,
  );
} else {
  console.log('⚠️  No se encontró a Gonzalo por ORCID.');
}

console.log('==========================================================');

if (fragile.length) process.exit(1);
