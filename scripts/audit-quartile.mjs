// =============================================================================
// audit-quartile.mjs — auditoría de quartile_profile SJR en openalex.json
// -----------------------------------------------------------------------------
// Uso:
//   node scripts/audit-quartile.mjs                 (usa src/openalex.json)
//   node scripts/audit-quartile.mjs ruta/al.json
//
// No modifica nada: valida perfiles almacenados, recomputa desde all-works.json
// y compara con researcher-metrics.json (precomputado).
// =============================================================================

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');
const path = process.argv[2] ?? join(SRC, 'openalex.json');
const awPath = join(SRC, 'all-works.json');
const dataPath = join(SRC, 'data.json');
const rmPath = join(SRC, 'researcher-metrics.json');
const sjrPath = process.env.SJR_QUARTILES_PATH ?? join(__dirname, 'data', 'sjr-2025-quartiles.json');

const QUARTILE_RANK = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };

function normIssn(s) {
  const v = (s ?? '').trim().toUpperCase().replace(/-/g, '');
  return v.length === 8 ? v : '';
}

function cleanOrcid(o) {
  return (o ?? '').replace(/https?:\/\/orcid\.org\//i, '').trim();
}

function looksLikeOrcid(value) {
  const v = cleanOrcid(value);
  return v.length === 19 && (v.match(/-/g) ?? []).length === 3;
}

function getQuartile(map, issns) {
  let best = null;
  for (const raw of issns) {
    const q = map.get(normIssn(raw));
    if (q && (best === null || QUARTILE_RANK[q] < QUARTILE_RANK[best])) best = q;
  }
  return best;
}

function workIssnCandidates(work) {
  return [].concat(work.cr_issn ?? [], work.up_issn ?? []);
}

function emptyTally() {
  return { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
}

function toQuartileProfile(tally) {
  const q1 = tally.Q1;
  const q2 = tally.Q2;
  const q3 = tally.Q3;
  const q4 = tally.Q4;
  const with_quartile = q1 + q2 + q3 + q4;
  const pct = (n) => (with_quartile > 0 ? +((n / with_quartile) * 100).toFixed(1) : undefined);
  return {
    q1,
    q2,
    q3,
    q4,
    with_quartile,
    q1_pct: pct(q1),
    q1q2_pct: pct(q1 + q2),
  };
}

function buildIdToOrcid(data) {
  const map = new Map();
  for (const r of data) {
    const orcid = cleanOrcid(r.o);
    if (!orcid) continue;
    map.set(orcid, orcid);
    const utaId = (r.id || '').trim() || orcid;
    if (utaId) map.set(utaId, orcid);
    if (r.id?.trim()) map.set(r.id.trim(), orcid);
  }
  return map;
}

function resolveOrcids(autoresUta, idToOrcid) {
  const orcids = new Set();
  for (const raw of autoresUta ?? []) {
    const id = (raw || '').trim();
    if (!id) continue;
    const orcid = looksLikeOrcid(id) ? cleanOrcid(id) : idToOrcid.get(id);
    if (orcid) orcids.add(orcid);
  }
  return orcids;
}

function aggregateQuartilesFromWorks(works, quartileMap, idToOrcid, authorOrcids) {
  const tallies = new Map();
  for (const work of works) {
    const q = getQuartile(quartileMap, workIssnCandidates(work));
    if (!q) continue;
    const orcids = resolveOrcids(work.autores_uta, idToOrcid);
    for (const orcid of orcids) {
      if (!authorOrcids.has(orcid)) continue;
      if (!tallies.has(orcid)) tallies.set(orcid, emptyTally());
      tallies.get(orcid)[q]++;
    }
  }
  return tallies;
}

function profilesMatch(a, b) {
  if (!a || !b) return false;
  return (
    a.q1 === b.q1 &&
    a.q2 === b.q2 &&
    a.q3 === b.q3 &&
    a.q4 === b.q4 &&
    a.with_quartile === b.with_quartile &&
    a.q1_pct === b.q1_pct &&
    a.q1q2_pct === b.q1q2_pct
  );
}

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

const f = (x) => (typeof x === 'number' ? x.toFixed(2) : 'N/D');

if (!existsSync(sjrPath)) {
  console.error(`No existe el mapa SJR en ${sjrPath}.`);
  process.exit(1);
}

const db = JSON.parse(readFileSync(path, 'utf8'));
const authors = Object.entries(db.authors ?? {});
const quartileMap = new Map(Object.entries(JSON.parse(readFileSync(sjrPath, 'utf8'))));

let withStamp = 0;
let missingStamp = 0;
let withQ1Pct = 0;
let emptyProfile = 0;
let invalidProfile = 0;
const q1PctVals = [];
const issues = [];
const noStamp = [];

for (const [key, a] of authors) {
  if (a.sjrQuartileFetchedAt) withStamp++;
  else {
    missingStamp++;
    noStamp.push(key);
  }

  const qp = a.quartile_profile;
  if (!qp || qp.with_quartile === 0) {
    emptyProfile++;
    continue;
  }

  const sum = (qp.q1 ?? 0) + (qp.q2 ?? 0) + (qp.q3 ?? 0) + (qp.q4 ?? 0);
  const bad =
    sum !== qp.with_quartile ||
    typeof qp.q1_pct !== 'number' ||
    Number.isNaN(qp.q1_pct) ||
    qp.q1_pct < 0 ||
    qp.q1_pct > 100 ||
    (typeof qp.q1q2_pct === 'number' && (qp.q1q2_pct < 0 || qp.q1q2_pct > 100));

  if (bad) {
    invalidProfile++;
    issues.push({ key, reason: 'inconsistent', qp });
  } else if (qp.q1_pct != null) {
    withQ1Pct++;
    q1PctVals.push(qp.q1_pct);
  }
}

const nQ1 = q1PctVals.length;
const q1Sorted = [...q1PctVals].sort((a, b) => a - b);
const q1Mean = nQ1 ? q1PctVals.reduce((s, x) => s + x, 0) / nQ1 : 0;
const q1Median = nQ1 ? q1Sorted[Math.floor(nQ1 / 2)] : 0;

console.log('================= AUDITORÍA QUARTILE SJR =================');
console.log(`Archivo:                 ${path}`);
console.log(`Mapa SJR:                ${sjrPath} (${quartileMap.size.toLocaleString()} ISSN)`);
console.log(`Autores totales:         ${authors.length}`);
console.log(`Con sjrQuartileFetchedAt: ${withStamp}   |   sin stamp: ${missingStamp}`);
console.log(`Con obras cuartil (q1_pct): ${withQ1Pct}   |   perfil vacío: ${emptyProfile}`);
console.log(
  `Q1% min=${f(q1Sorted[0])}  mediana=${f(q1Median)}  media=${f(q1Mean)}  max=${f(q1Sorted.at(-1))}`,
);
console.log('----------------------------------------------------------');

if (invalidProfile) {
  console.log(`⚠️  Perfiles inconsistentes (${invalidProfile}):`);
  issues.slice(0, 10).forEach((o) => console.log(`     ${o.key}  ${JSON.stringify(o.qp)}`));
} else {
  console.log('✅ Todos los perfiles almacenados son internamente consistentes.');
}

// ---- Recomputación desde all-works.json ----
let recomputeMismatches = [];
let recomputeOk = 0;
let worksWithQuartile = 0;

if (existsSync(awPath) && existsSync(dataPath)) {
  const works = JSON.parse(readFileSync(awPath, 'utf8'));
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  const idToOrcid = buildIdToOrcid(data);
  const authorOrcids = new Set(Object.keys(db.authors ?? {}).map(cleanOrcid));
  const tallies = aggregateQuartilesFromWorks(works, quartileMap, idToOrcid, authorOrcids);

  worksWithQuartile = works.filter((w) => getQuartile(quartileMap, workIssnCandidates(w)) != null).length;

  for (const [orcid, a] of authors) {
    const expected = toQuartileProfile(tallies.get(cleanOrcid(orcid)) ?? emptyTally());
    const stored = a.quartile_profile ?? toQuartileProfile(emptyTally());
    if (profilesMatch(expected, stored)) recomputeOk++;
    else recomputeMismatches.push({ orcid, expected, stored });
  }

  console.log(
    `Obras con cuartil SJR:   ${worksWithQuartile.toLocaleString()} / ${works.length.toLocaleString()}`,
  );
  console.log(`Recomputación vs almacenado: ${recomputeOk} OK  |  ${recomputeMismatches.length} difieren`);

  if (recomputeMismatches.length) {
    console.log('⚠️  Diferencias recomputación (primeras 15):');
    recomputeMismatches
      .slice(0, 15)
      .forEach((m) =>
        console.log(
          `     ${m.orcid}  stored Q1=${m.stored.q1_pct ?? 'N/D'}% (${m.stored.with_quartile})  expected Q1=${m.expected.q1_pct ?? 'N/D'}% (${m.expected.with_quartile})`,
        ),
      );
    if (recomputeMismatches.length > 15) {
      console.log(`     … y ${recomputeMismatches.length - 15} más`);
    }
  } else {
    console.log('✅ Todos los perfiles coinciden con la recomputación local.');
  }
} else {
  console.log('ℹ️  Sin all-works.json o data.json — omitiendo recomputación.');
}

// ---- Comparación con researcher-metrics.json ----
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

  console.log('----------------------------------------------------------');
  if (pairs.length) {
    const xs = pairs.map((p) => p.newQ1);
    const ys = pairs.map((p) => p.oldQ1);
    const r = pearson(xs, ys);
    const deltas = pairs.map((p) => Math.abs(p.delta)).sort((a, b) => b - a);
    const meanAbsDelta = deltas.reduce((s, x) => s + x, 0) / deltas.length;

    console.log(`Comparación SJR (nuevo) vs precomputado (researcher-metrics.json):`);
    console.log(`  Autores comparables: ${pairs.length}`);
    console.log(`  Correlación Pearson r: ${r != null ? r.toFixed(3) : 'N/D'}`);
    console.log(`  |Δ| media: ${meanAbsDelta.toFixed(2)} pp  |  |Δ| máx: ${deltas[0].toFixed(2)} pp`);

    for (const p of pairs) {
      if (Math.abs(p.delta) >= 25) largeDiffs.push(p);
    }
    if (largeDiffs.length) {
      console.log(`⚠️  Diferencias ≥25 pp:`);
      largeDiffs
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 10)
        .forEach((p) => console.log(`     ${p.orcid}  SJR=${p.newQ1}%  viejo=${p.oldQ1}%  Δ=${p.delta.toFixed(1)}`));
    } else {
      console.log('✅ Sin diferencias ≥25 pp entre SJR y precomputado.');
    }
  } else {
    console.log('ℹ️  Sin pares comparables con researcher-metrics.json.');
  }
} else {
  console.log(`ℹ️  No se encontró ${rmPath}.`);
}

const gKey = Object.keys(db.authors ?? {}).find((k) => k.includes('0000-0002-3298-6877'));
const g = gKey ? db.authors[gKey] : null;
console.log('----------------------------------------------------------');
if (g) {
  const gqp = g.quartile_profile;
  console.log('Spot-check Gonzalo (0000-0002-3298-6877):');
  console.log(
    `   SJR Q1=${gqp?.q1_pct ?? 'N/D'}%  Q1Q2=${gqp?.q1q2_pct ?? 'N/D'}%  with_quartile=${gqp?.with_quartile ?? '?'}  fetched=${g.sjrQuartileFetchedAt ?? 'N/D'}`,
  );
} else {
  console.log('⚠️  No se encontró a Gonzalo por ORCID.');
}

if (missingStamp && missingStamp <= 20) {
  console.log(`ℹ️  Sin procesar SJR (${missingStamp}): ${noStamp.join(', ')}`);
}

console.log('==========================================================');

if (invalidProfile || recomputeMismatches.length) process.exit(1);
