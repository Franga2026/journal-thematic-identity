#!/usr/bin/env node
/**
 * enrich-coauthor-global.mjs
 * -----------------------------------------------------------------------------
 * Enriquece coautores con su PERFIL GLOBAL desde la API de OpenAlex.
 * Calcula las MISMAS métricas que la ficha del investigador, pero sobre la
 * carrera completa del coautor (todas sus obras, no solo las compartidas con UTA).
 *
 * Pensado para el modo PRE-CACHE: corre en batch y embebe `global_profile`
 * en cada entrada de src/coauthor-profiles.json. El modal lo lee local.
 *
 * USO:
 *   node scripts/enrich-coauthor-global.mjs --author A5047078365      # un autor (debug)
 *   node scripts/enrich-coauthor-global.mjs --orcid 0000-0002-3156-2079
 *   node scripts/enrich-coauthor-global.mjs --batch ./src/coauthor-profiles.json \
 *        --out ./src/coauthor-profiles.enriched.json \
 *        --sjr ./scripts/data/sjr-2025-quartiles.json
 *
 * NOTAS:
 *  - OpenAlex es gratis y sin API key. Usa mailto (cortesía / pool rápido).
 *  - Cuartiles SJR NO existen en OpenAlex: se cruzan por issn_l contra tu
 *    tabla local (--sjr). Sin --sjr, `cuartiles` queda null (el resto se calcula).
 *  - Respeta un pequeño delay entre autores para no saturar la API.
 *  - Batch: lockfile anti-paralelo, backup previo, merge no destructivo,
 *    escritura atómica en checkpoints y resumen de conteos antes/después.
 * -----------------------------------------------------------------------------
 */

import { unlinkSync } from 'node:fs';
import { buildGlobalProfile, fetchAllWorks } from './lib/globalProfileFromOpenAlex.mjs';

const MAILTO = 'cris-victoria@uta.cl';
const OA = 'https://api.openalex.org';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, retries = 8) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': `CRIS-Victoria (${MAILTO})` } });
    if (res.ok) return res.json();
    if (res.status === 429 && attempt < retries) {
      const ra = Number(res.headers.get('retry-after'));
      const backoff = Math.min(90_000, 4000 * 2 ** attempt);
      const wait = ra > 0 ? Math.max(ra * 1000, backoff) : backoff;
      process.stderr.write(
        `… 429 OpenAlex, esperando ${Math.round(wait / 1000)}s` +
          (ra > 0 ? ` (retry-after=${ra}s)\n` : `\n`),
      );
      await sleep(wait);
      continue;
    }
    throw new Error(`OpenAlex ${res.status} en ${url}`);
  }
}

async function resolveAuthorId({ author, orcid }) {
  if (author) return author.startsWith('A') ? author : author.split('/').pop();
  if (orcid) {
    const clean = orcid.replace('https://orcid.org/', '');
    const d = await getJSON(`${OA}/authors/orcid:${clean}?mailto=${MAILTO}`);
    return d.id.split('/').pop();
  }
  throw new Error('Falta --author o --orcid');
}

async function fetchAuthor(authorId) {
  return getJSON(`${OA}/authors/${authorId}?mailto=${MAILTO}`);
}

async function fetchAuthorWorks(authorId) {
  return fetchAllWorks(authorId, (url) => getJSON(url), {
    baseUrl: OA,
    mailto: MAILTO,
    pageDelayMs: 200,
    sleep,
  });
}

async function enrichOne({ author, orcid }, sjrMap) {
  const authorId = await resolveAuthorId({ author, orcid });
  const authorObj = await fetchAuthor(authorId);
  const works = await fetchAuthorWorks(authorId);
  return buildGlobalProfile(authorObj, works, sjrMap);
}

function parseArgs() {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) {
      o[a[i].slice(2)] = a[i + 1]?.startsWith('--') || a[i + 1] == null ? true : a[++i];
    }
  }
  return o;
}

function countGlobalProfiles(data) {
  const entries = Array.isArray(data) ? data : Object.values(data);
  return entries.filter((prof) => prof?.global_profile).length;
}

function indexGlobalProfiles(data) {
  const map = new Map();
  if (!data) return map;
  const entries = Array.isArray(data)
    ? data.map((prof) => [prof.orcid || prof.oaId, prof])
    : Object.entries(data);
  for (const [key, prof] of entries) {
    if (prof?.global_profile) map.set(String(key), prof.global_profile);
  }
  return map;
}

function mergeGlobalProfiles(target, source) {
  if (!source) return;
  const preserved = indexGlobalProfiles(source);
  const entries = Array.isArray(target)
    ? target.map((prof) => [prof.orcid || prof.oaId, prof])
    : Object.entries(target);
  for (const [key, prof] of entries) {
    const prev = preserved.get(String(key));
    if (prev) prof.global_profile = prev;
  }
}

async function acquireLock(lockPath, fs) {
  try {
    await fs.writeFile(lockPath, `${process.pid}\n${new Date().toISOString()}\n`, { flag: 'wx' });
  } catch (e) {
    if (e.code === 'EEXIST') {
      console.error(`Ya hay un batch corriendo (lockfile ${lockPath}). Si estás seguro de que no, bórralo.`);
      process.exit(1);
    }
    throw e;
  }
}

async function releaseLock(lockPath, fs) {
  try {
    await fs.unlink(lockPath);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

async function backupOut(outPath, fs) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const bakPath = `${outPath}.bak-${stamp}`;
  await fs.copyFile(outPath, bakPath);
  process.stderr.write(`… backup → ${bakPath}\n`);
  return bakPath;
}

async function atomicWrite(outPath, data, fs) {
  const tmpPath = `${outPath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data), 'utf8');
  await fs.rename(tmpPath, outPath);
}

async function main() {
  const args = parseArgs();
  const fs = await import('node:fs/promises');

  const sjrMap = args.sjr ? JSON.parse(await fs.readFile(args.sjr, 'utf8')) : null;

  if (args.author || args.orcid) {
    const profile = await enrichOne({ author: args.author, orcid: args.orcid }, sjrMap);
    console.log(JSON.stringify(profile, null, 2));
    return;
  }

  if (args.batch) {
    const outPath = args.out || args.batch.replace(/\.json$/, '.enriched.json');
    const lockPath = `${outPath}.lock`;
    const resume = args.resume != null;
    const mockFail = args['mock-fail'] != null;
    const delayMs = Number(args.delay) || 300;
    const checkpointEvery = Number(args.checkpoint) || 20;
    if (mockFail) process.stderr.write('… modo mock-fail (sin OpenAlex)\n');

    await acquireLock(lockPath, fs);
    if (args['hold-lock']) await sleep(Number(args['hold-lock']) || 5000);

    let lockReleased = false;
    const unlock = async () => {
      if (!lockReleased) {
        await releaseLock(lockPath, fs);
        lockReleased = true;
      }
    };

    const onSignal = (sig) => {
      process.stderr.write(`\n… ${sig}, liberando lock…\n`);
      try {
        unlinkSync(lockPath);
      } catch {
        /* lock ya eliminado */
      }
      process.exit(sig === 'SIGINT' ? 130 : 143);
    };
    process.once('SIGINT', () => onSignal('SIGINT'));
    process.once('SIGTERM', () => onSignal('SIGTERM'));

    let data;
    let backedUp = false;
    const writeOut = async (label) => {
      if (!backedUp) {
        try {
          await fs.access(outPath);
          await backupOut(outPath, fs);
        } catch (e) {
          if (e.code !== 'ENOENT') throw e;
        }
        backedUp = true;
      }
      await atomicWrite(outPath, data, fs);
      if (label) process.stderr.write(`… ${label} → ${outPath}\n`);
    };

    try {
      let existingOut = null;
      try {
        existingOut = JSON.parse(await fs.readFile(outPath, 'utf8'));
      } catch {
        /* sin archivo previo */
      }

      if (resume) {
        try {
          data = JSON.parse(await fs.readFile(outPath, 'utf8'));
          process.stderr.write(`Reanudando desde ${outPath}\n`);
        } catch {
          data = JSON.parse(await fs.readFile(args.batch, 'utf8'));
          process.stderr.write(`Reanudando desde ${args.batch} (sin out previo)\n`);
        }
      } else {
        data = JSON.parse(await fs.readFile(args.batch, 'utf8'));
      }
      if (existingOut) mergeGlobalProfiles(data, existingOut);

      const preservedProfiles = indexGlobalProfiles(existingOut);
      const countBefore = countGlobalProfiles(data);
      process.stderr.write(`global_profile al inicio: ${countBefore}\n`);

      const entries = Array.isArray(data)
        ? data.map((prof) => [prof.orcid || prof.oaId, prof])
        : Object.entries(data);
      let done = 0;
      let failed = 0;
      let skipped = 0;
      let preserved = 0;

      for (const [key, prof] of entries) {
        const orcid = prof.orcid || (typeof key === 'string' && key.includes('-') ? key : null);
        const author = prof.oaId || prof.openalex_id || null;
        if (!orcid && !author) {
          failed++;
          continue;
        }
        if (prof.global_profile) {
          skipped++;
          continue;
        }
        try {
          if (mockFail) throw new Error('mock failure (guard-test)');
          prof.global_profile = await enrichOne({ author, orcid }, sjrMap);
          done++;
          process.stderr.write(`✓ ${prof.name || key} (${prof.global_profile.works_count} obras)\n`);
        } catch (e) {
          failed++;
          const prevProfile = preservedProfiles.get(String(key)) ?? prof.global_profile;
          if (prevProfile) {
            prof.global_profile = prevProfile;
            preserved++;
          }
          process.stderr.write(`✗ ${prof.name || key}: ${e.message}\n`);
          if (String(e.message).includes('429')) await sleep(20_000);
        }
        if (done > 0 && done % checkpointEvery === 0) {
          await writeOut(`checkpoint ${done} enriquecidos`);
        }
        await sleep(delayMs);
      }

      await writeOut(null);

      const countAfter = countGlobalProfiles(data);
      process.stderr.write(
        `\nListo: ${done} enriquecidos, ${skipped} omitidos, ${failed} fallidos` +
          (preserved ? `, ${preserved} conservados tras fallo` : '') +
          ` → ${outPath}\n`,
      );
      process.stderr.write(`global_profile al inicio: ${countBefore} · al final: ${countAfter}\n`);
      if (countAfter < countBefore) {
        process.stderr.write(
          `⚠ REGRESIÓN: bajó de ${countBefore} a ${countAfter} global_profile. Revisa el backup.\n`,
        );
      }
    } finally {
      await unlock();
    }
    return;
  }

  console.error(
    'Uso: --author <id> | --orcid <id> | --batch <profiles.json> [--out ...] [--sjr ./scripts/data/sjr-2025-quartiles.json]',
  );
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
