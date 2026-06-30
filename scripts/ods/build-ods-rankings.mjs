#!/usr/bin/env node
/**
 * build-ods-rankings.mjs — Rankings ODS por FWCI promedio (OpenAlex, standalone).
 *
 * Uso:
 *   node scripts/ods/build-ods-rankings.mjs --sdg 14
 *   node scripts/ods/build-ods-rankings.mjs --sdg 14 --top 25 --min-works 50 --min-h-index 10 --delay 200
 *   node scripts/ods/build-ods-rankings.mjs --sdg 14 --resume
 */

const FORMAT_VERSION = 2;

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGlobalProfile, fetchAllWorks } from '../lib/globalProfileFromOpenAlex.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const OUT_DIR = join(ROOT, 'outputs/ods-rankings');

const OPENALEX_BASE = 'https://api.openalex.org';
const MAILTO = 'directorio.uta@tarapaca.cl';
const PERIOD = '2020-2025';
const WORK_SELECT =
  'id,title,publication_year,fwci,cited_by_count,authorships,doi,primary_location,open_access,primary_topic,type';

const SJR_MAP = JSON.parse(
  readFileSync(join(ROOT, 'scripts/data/sjr-2025-quartiles.json'), 'utf8'),
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normIssn(raw) {
  const v = String(raw ?? '').trim().toUpperCase().replace(/-/g, '');
  return v.length === 8 ? v : '';
}

function extractIssns(work) {
  const src = work?.primary_location?.source;
  const candidates = [];
  if (src?.issn_l) candidates.push(src.issn_l);
  if (src?.issn) {
    if (Array.isArray(src.issn)) candidates.push(...src.issn);
    else candidates.push(src.issn);
  }
  const out = [];
  for (const item of candidates) {
    String(item)
      .split(',')
      .forEach((part) => {
        const n = normIssn(part);
        if (n && !out.includes(n)) out.push(n);
      });
  }
  return out;
}

function lookupQi(work) {
  for (const issn of extractIssns(work)) {
    const q = SJR_MAP[issn];
    if (q) return q;
  }
  return null;
}

function mapWorkToPortalShape(work) {
  const issns = extractIssns(work);
  return {
    t: work.title ?? null,
    y: work.publication_year ?? null,
    c: work.cited_by_count ?? 0,
    impact: work.fwci ?? null,
    d: work.doi || null,
    oa: work.open_access?.is_oa ?? false,
    s: work.primary_location?.source?.display_name || null,
    a: (work.authorships || []).map((au) => au.author?.display_name).filter(Boolean),
    topic: work.primary_topic?.display_name || null,
    field: work.primary_topic?.field?.display_name || null,
    type: work.type || null,
    openalex_id: work.id || null,
    issn: issns[0] || null,
    qi: lookupQi(work),
  };
}

function isJunkCoauthorName(name) {
  const n = (name || '').trim();
  return !n || /^et al\.?$/i.test(n);
}

function pickTopFromCounts(map) {
  let best;
  let bestN = 0;
  for (const [k, n] of map) {
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  }
  return best || null;
}

function buildTopCoauthors(works, authorId, authorUrl) {
  const counts = new Map();

  for (const work of works) {
    for (const auth of work.authorships || []) {
      if (authorMatchesAuthorship(auth, authorId, authorUrl)) continue;
      const name = auth.author?.display_name;
      if (isJunkCoauthorName(name)) continue;
      const id = auth.author?.id;
      if (!id) continue;

      let entry = counts.get(id);
      if (!entry) {
        entry = {
          name,
          openalex_id: id,
          institution: null,
          country: null,
          works_together: 0,
          _instCounts: new Map(),
          _countryCounts: new Map(),
        };
        counts.set(id, entry);
      }
      entry.works_together += 1;
      for (const inst of auth.institutions || []) {
        if (inst.display_name) {
          entry._instCounts.set(
            inst.display_name,
            (entry._instCounts.get(inst.display_name) || 0) + 1,
          );
        }
        const cc = inst.country_code?.toUpperCase();
        if (cc) {
          entry._countryCounts.set(cc, (entry._countryCounts.get(cc) || 0) + 1);
        }
      }
    }
  }

  return [...counts.values()]
    .sort((a, b) => b.works_together - a.works_together)
    .slice(0, 10)
    .map(({ _instCounts, _countryCounts, ...rest }) => ({
      name: rest.name,
      openalex_id: rest.openalex_id,
      institution: pickTopFromCounts(_instCounts),
      country: pickTopFromCounts(_countryCounts),
      works_together: rest.works_together,
    }));
}

async function enrichRankedResearcher(row, rank, delay) {
  const authorId = normalizeAuthorId(row._key || row.openalex_id);
  const authorUrl = row.openalex_id;
  let authorJson = row._authorProfile;
  if (authorId && !authorJson) {
    authorJson = await fetchAuthorProfile(authorId, delay);
  }

  let careerWorks = [];
  if (authorId) {
    careerWorks = await fetchAllWorks(
      authorId,
      (url) => getJSON(url, { delay, category: 'careerWorks' }),
      {
        baseUrl: OPENALEX_BASE,
        mailto: MAILTO,
        pageDelayMs: delay,
        sleep,
      },
    );
  }

  const portalWorks = [...(row.works || [])]
    .sort((a, b) => (b.cited_by_count || 0) - (a.cited_by_count || 0))
    .map(mapWorkToPortalShape);

  const { works: _w, _eligible_fwci, _key, _authorProfile, ...kpiRest } = row;

  return {
    rank,
    ...kpiRest,
    global_profile: authorJson ? buildGlobalProfile(authorJson, careerWorks, SJR_MAP) : null,
    top_coauthors: buildTopCoauthors(row.works || [], authorId, authorUrl),
    works: portalWorks,
  };
}

function parseArgs(argv) {
  const args = {
    sdg: null,
    top: 25,
    minWorks: 50,
    minHIndex: 10,
    delay: 200,
    resume: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sdg') args.sdg = Number(argv[++i]);
    else if (a === '--top') args.top = Number(argv[++i]);
    else if (a === '--min-works') args.minWorks = Number(argv[++i]);
    else if (a === '--min-h-index') args.minHIndex = Number(argv[++i]);
    else if (a === '--delay') args.delay = Number(argv[++i]);
    else if (a === '--resume') args.resume = true;
    else if (a === '--help' || a === '-h') {
      console.log(`Uso: node scripts/ods/build-ods-rankings.mjs --sdg <n> [opciones]
  --top 25           Investigadores en el ranking final
  --min-works 50     Mínimo de obras ODS en el período
  --min-h-index 10   Mínimo h-index ODS (impacto demostrado)
  --delay 200        ms entre llamadas OpenAlex
  --resume           Continuar desde checkpoint`);
      process.exit(0);
    }
  }
  if (!Number.isFinite(args.sdg) || args.sdg < 1 || args.sdg > 17) {
    console.error('Error: --sdg <1-17> es obligatorio.');
    process.exit(1);
  }
  return args;
}

function sdgFilter(sdg) {
  return `sustainable_development_goals.id:${sdg},publication_year:${PERIOD}`;
}

function withMailto(url) {
  const u = new URL(url);
  u.searchParams.set('mailto', MAILTO);
  return u.toString();
}

let httpStats = {
  total: 0,
  candidatesSweep: 0,
  authors: 0,
  careerWorks: 0,
  rateLimited429: 0,
};

function resetHttpStats() {
  httpStats = {
    total: 0,
    candidatesSweep: 0,
    authors: 0,
    careerWorks: 0,
    rateLimited429: 0,
  };
}

async function getJSON(url, { delay = 0, retries = 8, category = 'candidatesSweep' } = {}) {
  for (let attempt = 0; ; attempt++) {
    if (delay > 0) await sleep(delay);
    httpStats.total += 1;
    if (category in httpStats && category !== 'total' && category !== 'rateLimited429') {
      httpStats[category] += 1;
    }
    const res = await fetch(withMailto(url), {
      headers: { Accept: 'application/json', 'User-Agent': `UTA-ODS-Rankings (${MAILTO})` },
    });
    if (res.ok) return res.json();
    if (res.status === 429) httpStats.rateLimited429 += 1;
    if ((res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) && attempt < retries) {
      const raRaw = Number(res.headers.get('retry-after'));
      const ra = Number.isFinite(raRaw) && raRaw > 0 ? Math.min(raRaw, 120) : 0;
      const backoff = Math.min(90_000, 4000 * 2 ** attempt);
      const wait = ra > 0 ? Math.max(ra * 1000, backoff) : backoff;
      process.stderr.write(
        `… ${res.status} OpenAlex, esperando ${Math.round(wait / 1000)}s` +
          (ra > 0 ? ` (retry-after=${ra}s)\n` : `\n`),
      );
      await sleep(wait);
      continue;
    }
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAlex ${res.status} en ${url}\n${body.slice(0, 200)}`);
  }
}

function extractAuthorId(key) {
  if (!key || typeof key !== 'string') return null;
  const m = key.match(/\/(A\d+)\s*$/i) || key.match(/^(A\d+)$/i);
  return m ? m[1].toUpperCase().replace(/^A/, 'A') : null;
}

function normalizeAuthorId(key) {
  const id = extractAuthorId(key);
  if (!id) return null;
  return id.startsWith('A') ? id : `A${id}`;
}

function isJunkCandidate({ key, key_display_name: name, count }) {
  const n = (name || '').trim();
  if (!n) return true;
  if (/^et al\.?$/i.test(n)) return true;
  if (!normalizeAuthorId(key)) return true;
  if (!Number.isFinite(count) || count < 1) return true;
  return false;
}

function computeHIndex(citations) {
  if (!citations.length) return 0;
  const sorted = [...citations].sort((a, b) => b - a);
  let h = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] >= i + 1) h = i + 1;
    else break;
  }
  return h;
}

function authorMatchesAuthorship(authorship, authorId, authorUrl) {
  const aid = authorship?.author?.id;
  if (!aid) return false;
  const short = aid.split('/').pop();
  return short === authorId || aid === authorUrl;
}

function metaFromAuthorProfile(authorJson, fallbackName) {
  const name = authorJson?.display_name || fallbackName;
  const orcid = authorJson?.orcid
    ? authorJson.orcid.replace('https://orcid.org/', '')
    : null;
  const inst = (authorJson?.last_known_institutions || [])[0];
  return {
    name: name || fallbackName,
    orcid,
    institution: inst?.display_name || null,
    country: inst?.country_code?.toUpperCase() || null,
  };
}

async function fetchAuthorProfile(authorId, delay) {
  return getJSON(`${OPENALEX_BASE}/authors/${authorId}`, { delay, category: 'authors' });
}

function extractAuthorMeta(works, authorId, authorUrl, fallbackName) {
  const instCounts = new Map();
  const countryCounts = new Map();
  let name = fallbackName || '';
  let orcid;

  for (const work of works) {
    for (const auth of work.authorships || []) {
      if (!authorMatchesAuthorship(auth, authorId, authorUrl)) continue;
      if (auth.author?.display_name && !/^et al\.?$/i.test(auth.author.display_name)) {
        name = auth.author.display_name;
      }
      if (auth.author?.orcid && !orcid) {
        orcid = auth.author.orcid.replace('https://orcid.org/', '');
      }
      for (const inst of auth.institutions || []) {
        if (inst.display_name) {
          instCounts.set(inst.display_name, (instCounts.get(inst.display_name) || 0) + 1);
        }
        const cc = inst.country_code?.toUpperCase();
        if (cc) countryCounts.set(cc, (countryCounts.get(cc) || 0) + 1);
      }
    }
  }

  const pickTop = (map) => {
    let best;
    let bestN = 0;
    for (const [k, n] of map) {
      if (n > bestN) {
        bestN = n;
        best = k;
      }
    }
    return best;
  };

  return {
    name: name || fallbackName || authorId,
    orcid: orcid || null,
    institution: pickTop(instCounts) || null,
    country: pickTop(countryCounts) || null,
  };
}

function computeAuthorKpis(works, authorId, authorUrl, fallbackName, profileMeta) {
  const publications = works.length;
  const citations_ods = works.reduce((s, w) => s + (w.cited_by_count || 0), 0);
  const h_index_ods = computeHIndex(works.map((w) => w.cited_by_count || 0));

  const eligible = works.filter((w) => w.fwci != null && w.fwci > 0);
  if (!eligible.length) return null;

  const fwci_promedio =
    eligible.reduce((s, w) => s + w.fwci, 0) / eligible.length;

  const meta = profileMeta || extractAuthorMeta(works, authorId, authorUrl, fallbackName);

  return {
    name: meta.name,
    openalex_id: authorUrl,
    orcid: meta.orcid,
    fwci: Math.round(fwci_promedio * 1000) / 1000,
    publications,
    citations_ods,
    h_index_ods,
    country: meta.country,
    institution: meta.institution,
    _eligible_fwci: eligible.length,
    works,
  };
}

async function fetchGroupByCandidates(sdg, delay) {
  const filter = sdgFilter(sdg);
  const url =
    `${OPENALEX_BASE}/works?filter=${encodeURIComponent(filter)}` +
    `&group_by=authorships.author.id`;
  const data = await getJSON(url, { delay });
  return data.group_by || [];
}

async function fetchAuthorOdsWorks(sdg, authorKey, delay, expectedCount = 0) {
  const authorId = normalizeAuthorId(authorKey);
  const authorUrl = authorKey.startsWith('http')
    ? authorKey
    : `${OPENALEX_BASE}/authors/${authorId}`;
  const base = sdgFilter(sdg);
  const filterVariants = [
    `${base},authorships.author.id:${authorUrl}`,
    `${base},author.id:${authorId}`,
  ];
  const works = [];
  let cursor = '*';
  const perPage = expectedCount > 300 ? 50 : 100;

  let lastErr;
  for (const filter of filterVariants) {
    works.length = 0;
    cursor = '*';
    try {
      while (cursor) {
        const url =
          `${OPENALEX_BASE}/works?filter=${encodeURIComponent(filter)}` +
          `&per-page=${perPage}&select=${WORK_SELECT}` +
          `&cursor=${encodeURIComponent(cursor)}`;
        const data = await getJSON(url, { delay });
        const batch = data.results || [];
        works.push(...batch);
        cursor = data.meta?.next_cursor || null;
        if (!batch.length) break;
      }
      return { works, authorId, authorUrl };
    } catch (err) {
      lastErr = err;
      if (String(err.message).includes('504') && filter !== filterVariants.at(-1)) {
        process.stderr.write('(504 → fallback author.id) ');
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function checkpointPath(sdg) {
  return join(OUT_DIR, `.checkpoint-sdg${sdg}.json`);
}

function outputPath(sdg) {
  return join(OUT_DIR, `sdg-${sdg}.json`);
}

function loadCheckpoint(sdg) {
  const p = checkpointPath(sdg);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

function saveCheckpoint(sdg, state) {
  const p = checkpointPath(sdg);
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, p);
}

async function main() {
  const args = parseArgs(process.argv);
  const started = Date.now();
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`\nODS ranking por FWCI — SDG ${args.sdg} (${PERIOD})`);
  console.log(`min-works=${args.minWorks} min-h-index=${args.minHIndex} top=${args.top} delay=${args.delay}ms\n`);

  resetHttpStats();

  const rawCandidates = await fetchGroupByCandidates(args.sdg, 0);
  console.log(`Paso 1: group_by devolvió ${rawCandidates.length} autores`);

  const candidates = rawCandidates
    .filter((c) => !isJunkCandidate(c))
    .filter((c) => c.count >= args.minWorks)
    .sort((a, b) => b.count - a.count);

  console.log(
    `Paso 2: ${candidates.length} candidatos tras filtro (>=${args.minWorks} obras, sin basura)`,
  );
  if (!candidates.length) {
    console.error('Sin candidatos. Abortando.');
    process.exit(1);
  }

  let processed = [];
  let startIdx = 0;

  if (args.resume) {
    const cp = loadCheckpoint(args.sdg);
    if (cp?.processed?.length) {
      processed = cp.processed;
      const doneKeys = new Set(processed.map((p) => p._key));
      startIdx = candidates.findIndex((c) => !doneKeys.has(c.key));
      if (startIdx < 0) startIdx = candidates.length;
      console.log(`Resume: ${processed.length} autores ya procesados, continúa en #${startIdx + 1}`);
    }
  }

  for (let i = startIdx; i < candidates.length; i++) {
    const c = candidates[i];
    const authorId = normalizeAuthorId(c.key);
    process.stderr.write(
      `[${i + 1}/${candidates.length}] ${c.key_display_name} (${c.count} obras)… `,
    );

    try {
      const { works, authorId, authorUrl } = await fetchAuthorOdsWorks(
        args.sdg,
        c.key,
        args.delay,
        c.count,
      );
      let authorProfile = null;
      let profileMeta = null;
      try {
        authorProfile = await fetchAuthorProfile(authorId, args.delay);
        profileMeta = metaFromAuthorProfile(authorProfile, c.key_display_name);
      } catch {
        profileMeta = null;
      }
      const fromWorks = extractAuthorMeta(works, authorId, authorUrl, c.key_display_name);
      const mergedMeta = {
        name: fromWorks.name || profileMeta?.name || c.key_display_name,
        orcid: fromWorks.orcid || profileMeta?.orcid || null,
        institution: fromWorks.institution || profileMeta?.institution || null,
        country: fromWorks.country || profileMeta?.country || null,
      };
      const kpis = computeAuthorKpis(
        works,
        authorId,
        authorUrl,
        c.key_display_name,
        mergedMeta,
      );
      if (!kpis) {
        process.stderr.write(
          works.length === 0
            ? 'sin obras (fetch vacío), omitido\n'
            : 'sin FWCI elegible, omitido\n',
        );
        continue;
      }
      processed.push({
        _key: c.key,
        _authorProfile: authorProfile,
        ...kpis,
      });
      process.stderr.write(`fwci=${kpis.fwci} pubs=${kpis.publications}\n`);

      saveCheckpoint(args.sdg, {
        sdg: args.sdg,
        updated_at: new Date().toISOString(),
        candidates_total: candidates.length,
        processed,
      });
    } catch (err) {
      process.stderr.write(`ERROR: ${err.message}\n`);
      saveCheckpoint(args.sdg, {
        sdg: args.sdg,
        updated_at: new Date().toISOString(),
        candidates_total: candidates.length,
        processed,
        last_error: err.message,
        failed_at_index: i,
        failed_key: c.key,
      });
      throw err;
    }
  }

  const deduped = new Map();
  for (const row of processed) {
    const prev = deduped.get(row._key);
    if (!prev || row.publications > prev.publications) deduped.set(row._key, row);
  }
  const uniqueProcessed = [...deduped.values()];

  const impactQualified = uniqueProcessed.filter(
    (row) => row.publications >= args.minWorks && row.h_index_ods >= args.minHIndex,
  );
  const eliminatedByH = uniqueProcessed.filter(
    (row) => row.publications >= args.minWorks && row.h_index_ods < args.minHIndex,
  );
  if (eliminatedByH.length) {
    console.log(
      `Filtro h-index ODS >= ${args.minHIndex}: descartados ${eliminatedByH.length} — ` +
        eliminatedByH.map((x) => `${x.name} (h${x.h_index_ods})`).join(', '),
    );
  }

  const rankedSlice = [...impactQualified]
    .sort(
      (a, b) =>
        b.fwci - a.fwci ||
        b.publications - a.publications ||
        b.citations_ods - a.citations_ods,
    )
    .slice(0, args.top);

  console.log(`\nEnriqueciendo Top ${rankedSlice.length} (global_profile + obras shape Work + coautores)…`);
  const researchers = [];
  for (let i = 0; i < rankedSlice.length; i++) {
    const row = rankedSlice[i];
    process.stderr.write(`  enrich [${i + 1}/${rankedSlice.length}] ${row.name}… `);
    const enriched = await enrichRankedResearcher(row, i + 1, args.delay);
    researchers.push(enriched);
    const gp = enriched.global_profile;
    process.stderr.write(
      `${enriched.works.length} obras ODS · ${careerWorksLabel(gp)} · ${enriched.top_coauthors.length} coautores\n`,
    );
  }

  function careerWorksLabel(gp) {
    if (!gp) return 'sin global_profile';
    return `carrera ${gp.works_count ?? '?'} obras · fwci ${gp.fwci_mean ?? '—'}`;
  }

  const out = {
    format_version: FORMAT_VERSION,
    sdg: args.sdg,
    generated_at: new Date().toISOString(),
    method: `Top ${args.top} por FWCI promedio entre autores con >=${args.minWorks} obras y h-index ODS >=${args.minHIndex}, ${PERIOD} (perfil global, coautores y obras completas)`,
    period: PERIOD,
    min_works: args.minWorks,
    min_h_index: args.minHIndex,
    api_calls: httpStats.total,
    http_stats: { ...httpStats },
    candidates_after_filter: candidates.length,
    authors_with_fwci: uniqueProcessed.length,
    authors_after_h_index_filter: impactQualified.length,
    researchers,
  };

  const outFile = outputPath(args.sdg);
  if (existsSync(outFile)) {
    const bak = `${outFile}.bak-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    copyFileSync(outFile, bak);
    console.log(`Backup: ${bak}`);
  }

  const tmpOut = `${outFile}.tmp`;
  writeFileSync(tmpOut, JSON.stringify(out, null, 2));
  renameSync(tmpOut, outFile);

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\nEscrito: ${outFile}`);
  console.log(`HTTP: ${httpStats.total} llamadas · ${elapsed}s`);
  console.log(`  barrido candidatos: ${httpStats.candidatesSweep}`);
  console.log(`  authors:            ${httpStats.authors}`);
  console.log(`  works-carrera:      ${httpStats.careerWorks}`);
  console.log(`  respuestas 429:     ${httpStats.rateLimited429}`);
  console.log(`\nTop ${researchers.length} (nombre · fwci · pubs · país):`);
  for (const r of researchers) {
    console.log(
      `  ${String(r.rank).padStart(2)}. ${r.name} · fwci=${r.fwci} · pubs=${r.publications} · ${r.country || '—'}`,
    );
  }
}

main().catch((err) => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
