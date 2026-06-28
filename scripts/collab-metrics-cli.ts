#!/usr/bin/env tsx
import fs from 'node:fs';
import {
  computeCollabMetrics,
  normWorks,
} from '../src/services/report/reportCollabMetrics';

const argv = process.argv.slice(2);
const ORCID_RAW = argv.find((a) => /\d{4}-\d{4}-\d{4}-\d{3}[\dX]/i.test(a));
let path = argv.find((a) => a.endsWith('.json'));
const fromY = (() => {
  const i = argv.indexOf('--from');
  return i >= 0 ? +argv[i + 1] : null;
})();
const toY = (() => {
  const i = argv.indexOf('--to');
  return i >= 0 ? +argv[i + 1] : null;
})();

if (!ORCID_RAW) {
  console.error(
    'Falta el ORCID. Ej: node scripts/collab-metrics.mjs 0000-0001-5228-1180 src/all-works.json',
  );
  process.exit(1);
}

const guesses = [path, 'src/all-works.json', './all-works.json', 'all-works.json'].filter(Boolean);
path = guesses.find((p) => {
  try {
    return fs.existsSync(p!);
  } catch {
    return false;
  }
});
if (!path) {
  console.error('No encuentro all-works.json. Pásalo como 2º argumento.');
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
const works = normWorks(raw);
const metrics = computeCollabMetrics(works, ORCID_RAW, { from: fromY, to: toY });

console.log(JSON.stringify({ ...metrics, archivo: path }, null, 2));
