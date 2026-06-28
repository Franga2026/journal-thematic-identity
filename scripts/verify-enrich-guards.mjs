#!/usr/bin/env node
/**
 * Verificación rápida de salvaguardas de enrich-coauthor-global.mjs.
 * Usa --mock-fail para evitar llamadas a OpenAlex.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(__dirname, 'enrich-coauthor-global.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function runNode(args, { timeoutMs = 15_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d;
    });
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`timeout: node ${args.join(' ')}`));
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    child.on('error', reject);
  });
}

async function main() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'enrich-guard-'));
  const batch = path.join(tmp, 'batch.json');
  const out = path.join(tmp, 'out.json');
  const lock = `${out}.lock`;

  const enriched = {
    '0000-0001-1111-1111': {
      name: 'Alice',
      orcid: '0000-0001-1111-1111',
      oaId: 'A5011201528',
      global_profile: { source: 'fixture', works_count: 42 },
    },
    '0000-0002-2222-2222': {
      name: 'Bob',
      orcid: '0000-0002-2222-2222',
      oaId: 'A5084154522',
      global_profile: { source: 'fixture', works_count: 7 },
    },
    '0000-0003-3333-3333': {
      name: 'Carol',
      orcid: '0000-0003-3333-3333',
      oaId: 'A5012420772',
    },
  };
  const bare = structuredClone(enriched);
  for (const p of Object.values(bare)) delete p.global_profile;

  await fs.writeFile(batch, JSON.stringify(bare));
  await fs.writeFile(out, JSON.stringify(enriched));

  // 1) Lock preexistente → aborta
  await fs.writeFile(lock, '999\n');
  const locked = await runNode([SCRIPT, '--batch', batch, '--out', out, '--resume'], { timeoutMs: 5000 });
  if (locked.code !== 1 || !locked.stderr.includes('Ya hay un batch corriendo')) {
    throw new Error(`lock preexistente: code=${locked.code} stderr=${locked.stderr}`);
  }
  await fs.unlink(lock);
  console.log('✓ lock preexistente aborta');

  // 2) Dos en paralelo → el segundo aborta
  const p1 = spawn(
    'node',
    [SCRIPT, '--batch', batch, '--out', out, '--resume', '--hold-lock', '3000'],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );
  await sleep(200);
  const parallel = await runNode([SCRIPT, '--batch', batch, '--out', out, '--resume'], { timeoutMs: 5000 });
  await new Promise((resolve) => {
    p1.on('close', resolve);
    setTimeout(() => {
      p1.kill('SIGINT');
      resolve();
    }, 5000);
  });
  if (parallel.code !== 1 || !parallel.stderr.includes('Ya hay un batch corriendo')) {
    p1.kill('SIGKILL');
    throw new Error(`paralelo: code=${parallel.code} stderr=${parallel.stderr}`);
  }
  try {
    await fs.unlink(lock);
  } catch {
    /* p1 pudo liberarlo */
  }
  console.log('✓ segundo proceso paralelo aborta');

  // 3) Fallos simulados no degradan perfiles previos (batch sin GP, out con 2 GP)
  const failRun = await runNode(
    [SCRIPT, '--batch', batch, '--out', out, '--mock-fail', '--delay', '0'],
    { timeoutMs: 10_000 },
  );
  const after = JSON.parse(await fs.readFile(out, 'utf8'));
  const countAfter = Object.values(after).filter((p) => p.global_profile).length;
  const backups = (await fs.readdir(tmp)).filter((f) => f.includes('.bak-'));
  if (countAfter < 2) {
    throw new Error(`regresión: countAfter=${countAfter} stderr=${failRun.stderr}`);
  }
  if (!backups.length) {
    throw new Error('no se creó backup .bak-*');
  }
  if (!failRun.stderr.includes('global_profile al inicio: 2')) {
    throw new Error(`resumen inicio inesperado: ${failRun.stderr}`);
  }
  if (!failRun.stderr.includes(`al final: ${countAfter}`)) {
    throw new Error(`resumen final inesperado: ${failRun.stderr}`);
  }
  if (countAfter < 2 && failRun.stderr.includes('REGRESIÓN')) {
    throw new Error('marcó regresión');
  }
  console.log(`✓ fallos simulados no degradan (${countAfter} global_profile, backup ${backups[0]})`);

  // 4) Backup y conteo final >= inicial en corrida resume (todo omitido)
  const allEnriched = structuredClone(enriched);
  allEnriched['0000-0003-3333-3333'].global_profile = { source: 'fixture', works_count: 3 };
  await fs.writeFile(out, JSON.stringify(allEnriched));
  const resumeRun = await runNode(
    [SCRIPT, '--batch', batch, '--out', out, '--resume', '--mock-fail', '--delay', '0'],
    { timeoutMs: 10_000 },
  );
  const afterResume = JSON.parse(await fs.readFile(out, 'utf8'));
  const countResume = Object.values(afterResume).filter((p) => p.global_profile).length;
  if (countResume < 3) {
    throw new Error(`resume regresión: ${countResume} stderr=${resumeRun.stderr}`);
  }
  console.log(`✓ resume conserva perfiles (${countResume} global_profile)`);

  await fs.rm(tmp, { recursive: true, force: true });
  console.log('\nTodas las verificaciones OK');
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
