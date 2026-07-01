import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadProjectEnv } from './loadEnv.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
loadProjectEnv(ROOT);
