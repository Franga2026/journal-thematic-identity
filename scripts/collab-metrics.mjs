#!/usr/bin/env node
// CLI — delega en reportCollabMetrics.ts (fuente única de verdad).
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'scripts/collab-metrics-cli.ts');
const r = spawnSync('npx', ['tsx', cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: root,
});
process.exit(r.status ?? 1);
