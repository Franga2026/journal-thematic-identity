#!/usr/bin/env node
/**
 * build-ods-rankings.mjs — Rankings ODS por FWCI promedio (OpenAlex, standalone).
 *
 * Uso:
 *   node scripts/ods/build-ods-rankings.mjs --sdg 14
 *   node scripts/ods/build-ods-rankings.mjs --sdg 14 --top 25 --min-works 50 --max-pubs-json 20 --delay 200
 *   node scripts/ods/build-ods-rankings.mjs --sdg 14 --resume
 */

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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const OUT_DIR = join(ROOT, 'outputs/ods-rankings');

const OPENALEX_BASE = 'https://api.openalex.org';
const MAILTO = 'directorio.uta@tarapaca.cl';
const PERIOD = '2020-2025';
const WORK_SELECT =
  'id,title,publication_year,fwci,cited_by_count,authorships';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const args = {
    sdg: null,
    top: 25,
    minWorks: 50,
    minHIndex: 10,
    maxPubsJson: 20,
    delay: 200,
    resume: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sdg') args.sdg = Number(argv[++i]);
    else if (a === '--top') args.top = Number(argv[++i]);
    else if (a === '--min-works') args.minWorks = Number(argv[++i]);
    else if (a === '--min-h-index') args.minHIndex = Number(argv[++i]);
    else if (a === '--max-pubs-json') args.maxPubsJson = Number(argv[++i]);
    else if (a === '--delay') args.delay = Number(argv[++i]);
    else if (a === '--resume') args.resume = true;
    else if (a === '--help' || a === '-h') {
      console.log(`Uso: node scripts/ods/build-ods-rankings.mjs --sdg <n> [opciones]
  --top 25           Investigadores en el ranking final
  --min-works 50     Mínimo de obras ODS en el período
  --min-h-index 10   Mínimo h-index ODS (impacto demostrado)
  --max-pubs-json 20 Obras por autor en el JSON de salida
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

let apiCalls = 0;

async function getJSON(url, { delay = 0, retries = 8 } = {}) {
  for (let attempt = 0; ; attempt++) {
    if (delay > 0) await sleep(delay);
    apiCalls += 1;
    const res = await fetch(withMailto(url), {
      headers: { Accept: 'application/json', 'User-Agent': `UTA-ODS-Rankings (${MAILTO})` },
    });
    if (res.ok) return res.json();
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
  return getJSON(`${OPENALEX_BASE}/authors/${authorId}`, { delay });
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

function formatWorkForJson(w) {
  return {
    id: w.id,
    title: w.title,
    year: w.publication_year,
    fwci: w.fwci,
    citations: w.cited_by_count || 0,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const started = Date.now();
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`\nODS ranking por FWCI — SDG ${args.sdg} (${PERIOD})`);
  console.log(`min-works=${args.minWorks} min-h-index=${args.minHIndex} top=${args.top} delay=${args.delay}ms\n`);

  apiCalls = 0;
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
      let profileMeta = null;
      try {
        const profile = await fetchAuthorProfile(authorId, args.delay);
        profileMeta = metaFromAuthorProfile(profile, c.key_display_name);
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

  const ranked = [...impactQualified]
    .sort(
      (a, b) =>
        b.fwci - a.fwci ||
        b.publications - a.publications ||
        b.citations_ods - a.citations_ods,
    )
    .slice(0, args.top)
    .map((row, idx) => {
      const topWorks = [...row.works]
        .sort((a, b) => (b.cited_by_count || 0) - (a.cited_by_count || 0))
        .slice(0, args.maxPubsJson)
        .map(formatWorkForJson);
      const { works: _w, _eligible_fwci, _key, ...rest } = row;
      return {
        rank: idx + 1,
        ...rest,
        works: topWorks,
      };
    });

  const out = {
    sdg: args.sdg,
    generated_at: new Date().toISOString(),
    method: `Top ${args.top} por FWCI promedio entre autores con >=${args.minWorks} obras y h-index ODS >=${args.minHIndex}, ${PERIOD}`,
    period: PERIOD,
    min_works: args.minWorks,
    min_h_index: args.minHIndex,
    api_calls: apiCalls,
    candidates_after_filter: candidates.length,
    authors_with_fwci: uniqueProcessed.length,
    authors_after_h_index_filter: impactQualified.length,
    researchers: ranked,
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
  console.log(`Llamadas API: ${apiCalls} · Tiempo: ${elapsed}s`);
  console.log(`\nTop ${ranked.length} (nombre · fwci · pubs · país):`);
  for (const r of ranked) {
    console.log(
      `  ${String(r.rank).padStart(2)}. ${r.name} · fwci=${r.fwci} · pubs=${r.publications} · ${r.country || '—'}`,
    );
  }
}

main().catch((err) => {
  console.error('\nFatal:', err.message);
  process.exit(1);
});
