import { loadEnv } from 'vite';

let loaded = false;

/** Carga .env / .env.local en process.env (solo scripts y servidor). */
export function loadProjectEnv(): void {
  if (loaded) return;
  const mode = process.env.NODE_ENV || 'development';
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  loaded = true;
}
