// =============================================================================
// audit-enrich.mjs — revisión rápida del openalex.json enriquecido
// -----------------------------------------------------------------------------
// Uso:
//   node scripts/audit-enrich.mjs                 (usa src/openalex.json)
//   node scripts/audit-enrich.mjs ruta/al.json
//
// No modifica nada: solo lee y reporta cobertura, rangos y casos sospechosos.
// Compara q1_pct SJR (openalex.json) vs quartile_profile precomputado (researcher-metrics.json).
// =============================================================================

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = process.argv[2] ?? 'src/openalex.json';
const rmPath = join(__dirname, '..', 'src', 'researcher-metrics.json');

const db = JSON.parse(readFileSync(path, 'utf8'));
const authors = Object.entries(db.authors ?? {});

let withFwci = 0, nullFwci = 0, withOa = 0, oaOutOfRange = 0, missingStamp = 0;
let withScopus = 0, nullScopus = 0, missingScopusStamp = 0, scopusOutOfRange = 0;
let withQuartile = 0, nullQuartile = 0, missingQuartileStamp = 0, quartileOutOfRange = 0;
const fwciVals = [];
const scopusRates = [];
const q1PctVals = [];
const fwciOutliers = [];
const oaIssues = [];
const scopusIssues = [];
const quartileIssues = [];
const noStamp = [];
const noScopusStamp = [];
const noQuartileStamp = [];
let scopusWorksWithIssn = 0;
let scopusWorksWithoutIssn = 0;

for (const [key, a] of authors) {
  if (a.fwci == null) {
    nullFwci++;
  } else {
    withFwci++;
    fwciVals.push(a.fwci);
    if (typeof a.fwci !== 'number' || Number.isNaN(a.fwci) || a.fwci < 0 || a.fwci > 20) {
      fwciOutliers.push({ key, fwci: a.fwci, n: a.fwciN });
    }
  }
  if (a.oaRate != null) {
    withOa++;
    if (typeof a.oaRate !== 'number' || Number.isNaN(a.oaRate) || a.oaRate < 0 || a.oaRate > 100) {
      oaOutOfRange++;
      oaIssues.push({ key, oaRate: a.oaRate });
    }
  }
  if (!a.fwciFetchedAt) { missingStamp++; noStamp.push(key); }

  if (a.scopusIndexedRate == null) {
    nullScopus++;
  } else {
    withScopus++;
    scopusRates.push(a.scopusIndexedRate);
    if (
      typeof a.scopusIndexedRate !== 'number' ||
      Number.isNaN(a.scopusIndexedRate) ||
      a.scopusIndexedRate < 0 ||
      a.scopusIndexedRate > 100
    ) {
      scopusOutOfRange++;
      scopusIssues.push({ key, rate: a.scopusIndexedRate, n: a.scopusIndexedN, total: a.scopusWorksTotal });
    }
  }
  if (typeof a.scopusWorksTotal === 'number') {
    scopusWorksWithIssn += a.scopusWorksTotal;
    const wc = typeof a.works_count === 'number' ? a.works_count : 0;
    if (wc > a.scopusWorksTotal) scopusWorksWithoutIssn += wc - a.scopusWorksTotal;
  }
  if (!a.scopusFetchedAt) { missingScopusStamp++; noScopusStamp.push(key); }

  const qp = a.quartile_profile;
  if (!qp || qp.q1_pct == null) {
    nullQuartile++;
  } else {
    withQuartile++;
    q1PctVals.push(qp.q1_pct);
    if (
      typeof qp.q1_pct !== 'number' ||
      Number.isNaN(qp.q1_pct) ||
      qp.q1_pct < 0 ||
      qp.q1_pct > 100 ||
      typeof qp.with_quartile !== 'number' ||
      qp.with_quartile < 0
    ) {
      quartileOutOfRange++;
      quartileIssues.push({ key, q1_pct: qp.q1_pct, with_quartile: qp.with_quartile });
    }
  }
  if (!a.sjrQuartileFetchedAt) { missingQuartileStamp++; noQuartileStamp.push(key); }
}

const n = fwciVals.length;
const sum = fwciVals.reduce((s, x) => s + x, 0);
const mean = n ? sum / n : 0;
const sorted = [...fwciVals].sort((a, b) => a - b);
const median = n ? sorted[Math.floor(n / 2)] : 0;

const nScopus = scopusRates.length;
const scopusMean = nScopus ? scopusRates.reduce((s, x) => s + x, 0) / nScopus : 0;
const scopusSorted = [...scopusRates].sort((a, b) => a - b);
const scopusMedian = nScopus ? scopusSorted[Math.floor(nScopus / 2)] : 0;

const nQ1 = q1PctVals.length;
const q1Mean = nQ1 ? q1PctVals.reduce((s, x) => s + x, 0) / nQ1 : 0;
const q1Sorted = [...q1PctVals].sort((a, b) => a - b);
const q1Median = nQ1 ? q1Sorted[Math.floor(nQ1 / 2)] : 0;

const f = (x) => (typeof x === 'number' ? x.toFixed(2) : 'N/D');

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const vx = xs[i] - mx;
    const vy = ys[i] - my;
    num += vx * vy;
    dx += vx * vx;
    dy += vy * vy;
  }
  const den = Math.sqrt(dx * dy);
  return den ? num / den : null;
}

console.log('==================== AUDITORÍA ENRICH ====================');
console.log(`Archivo:            ${path}`);
console.log(`Autores totales:    ${authors.length}`);
console.log(`Con FWCI:           ${withFwci}   |   FWCI null: ${nullFwci}`);
console.log(`Con oaRate:         ${withOa}`);
console.log(`Sin fwciFetchedAt:  ${missingStamp}  (no procesados)`);
console.log('----------------------------------------------------------');
console.log(`FWCI  min=${f(sorted[0])}  mediana=${f(median)}  media=${f(mean)}  max=${f(sorted.at(-1))}`);
console.log('----------------------------------------------------------');
console.log(`Con scopusIndexedRate: ${withScopus}   |   null: ${nullScopus}`);
console.log(`Sin scopusFetchedAt:   ${missingScopusStamp}  (no procesados Scopus)`);
console.log(
  `Scopus% min=${f(scopusSorted[0])}  mediana=${f(scopusMedian)}  media=${f(scopusMean)}  max=${f(scopusSorted.at(-1))}`,
);
console.log(
  `Obras con ISSN (suma autores): ${scopusWorksWithIssn}  |  sin ISSN (works_count − con ISSN): ${scopusWorksWithoutIssn}`,
);
console.log('----------------------------------------------------------');
console.log(`Con quartile_profile (SJR): ${withQuartile}   |   sin q1_pct: ${nullQuartile}`);
console.log(`Sin sjrQuartileFetchedAt:   ${missingQuartileStamp}  (no procesados SJR)`);
console.log(
  `Q1% SJR min=${f(q1Sorted[0])}  mediana=${f(q1Median)}  media=${f(q1Mean)}  max=${f(q1Sorted.at(-1))}`,
);
console.log('----------------------------------------------------------');

if (fwciOutliers.length) {
  console.log(`⚠️  Outliers FWCI (<0 o >20) — revisar:`);
  fwciOutliers.forEach(o => console.log(`     ${o.key}  fwci=${o.fwci}  N=${o.n}`));
} else {
  console.log('✅ Sin outliers de FWCI.');
}

if (oaOutOfRange) {
  console.log(`⚠️  oaRate fuera de rango 0–100:`);
  oaIssues.forEach(o => console.log(`     ${o.key}  oaRate=${o.oaRate}`));
} else {
  console.log('✅ Todos los oaRate en rango 0–100.');
}

if (scopusOutOfRange) {
  console.log(`⚠️  scopusIndexedRate fuera de rango 0–100:`);
  scopusIssues.forEach(o => console.log(`     ${o.key}  rate=${o.rate}  n=${o.n}/${o.total}`));
} else if (withScopus) {
  console.log('✅ Todos los scopusIndexedRate en rango 0–100.');
}

if (quartileOutOfRange) {
  console.log(`⚠️  quartile_profile inválido:`);
  quartileIssues.forEach(o => console.log(`     ${o.key}  q1_pct=${o.q1_pct}  with_quartile=${o.with_quartile}`));
} else if (withQuartile) {
  console.log('✅ Todos los quartile_profile SJR en rango válido.');
}

if (missingStamp && missingStamp <= 20) {
  console.log(`ℹ️  Sin procesar FWCI (${missingStamp}): ${noStamp.join(', ')}`);
}

// ---- Comparación SJR vs precomputado (researcher-metrics.json) ----
if (existsSync(rmPath)) {
  const rm = JSON.parse(readFileSync(rmPath, 'utf8'));
  const pairs = [];
  const largeDiffs = [];

  for (const [orcid, a] of authors) {
    const newQ1 = a.quartile_profile?.q1_pct;
    const oldQ1 = rm[orcid]?.quartile_profile?.q1_pct;
    if (typeof newQ1 === 'number' && typeof oldQ1 === 'number') {
      pairs.push({ orcid, newQ1, oldQ1, delta: newQ1 - oldQ1 });
    }
  }

  if (pairs.length) {
    const xs = pairs.map((p) => p.newQ1);
    const ys = pairs.map((p) => p.oldQ1);
    const r = pearson(xs, ys);
    const deltas = pairs.map((p) => Math.abs(p.delta)).sort((a, b) => b - a);
    const meanAbsDelta = deltas.reduce((s, x) => s + x, 0) / deltas.length;

    console.log('----------------------------------------------------------');
    console.log(`Comparación SJR (nuevo) vs precomputado (researcher-metrics.json):`);
    console.log(`  Autores comparables: ${pairs.length}`);
    console.log(`  Correlación Pearson r: ${r != null ? r.toFixed(3) : 'N/D'}`);
    console.log(`  |Δ| media: ${meanAbsDelta.toFixed(2)} pp  |  |Δ| máx: ${deltas[0].toFixed(2)} pp`);

    for (const p of pairs) {
      if (Math.abs(p.delta) >= 25) largeDiffs.push(p);
    }
    if (largeDiffs.length) {
      console.log(`⚠️  Diferencias ≥25 pp (revisar matching ISSN):`);
      largeDiffs
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 15)
        .forEach((p) => console.log(`     ${p.orcid}  SJR=${p.newQ1}%  viejo=${p.oldQ1}%  Δ=${p.delta.toFixed(1)}`));
    } else {
      console.log('✅ Sin diferencias ≥25 pp entre SJR y precomputado.');
    }
  } else {
    console.log('ℹ️  Sin pares comparables (ejecuta enrich:quartile primero).');
  }
} else {
  console.log(`ℹ️  No se encontró ${rmPath} para comparar con precomputado.`);
}

const gKey = Object.keys(db.authors ?? {}).find(k => k.includes('0000-0002-3298-6877'));
const g = gKey ? db.authors[gKey] : null;
console.log('----------------------------------------------------------');
if (g) {
  console.log('Spot-check Gonzalo (0000-0002-3298-6877):');
  console.log(`   fwci=${g.fwci}  fwciN=${g.fwciN}  oaRate=${g.oaRate}  fetched=${g.fwciFetchedAt}`);
  console.log(
    `   scopus=${g.scopusIndexedRate ?? 'N/D'}%  n=${g.scopusIndexedN ?? '?'}/${g.scopusWorksTotal ?? '?'}  fetched=${g.scopusFetchedAt ?? 'N/D'}`,
  );
  const gqp = g.quartile_profile;
  console.log(
    `   SJR Q1=${gqp?.q1_pct ?? 'N/D'}%  with_quartile=${gqp?.with_quartile ?? '?'}  fetched=${g.sjrQuartileFetchedAt ?? 'N/D'}`,
  );
  console.log('   Esperado aprox:  fwci~4.12   fwciN=54   oaRate~78.1');
} else {
  console.log('⚠️  No se encontró a Gonzalo por ORCID en el archivo.');
}
console.log('==========================================================');
