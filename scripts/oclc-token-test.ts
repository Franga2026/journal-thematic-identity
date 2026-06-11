#!/usr/bin/env tsx
/**
 * Prueba OAuth2 client-credentials de OCLC (solo servidor).
 * Uso: npm run oclc:token-test
 *
 * Solicita token con el scope de KB API definido en OCLC_KB_API_SCOPE (.env).
 * Imprime confirmación sin exponer token ni secret.
 */
import { loadProjectEnv } from './lib/loadEnv.js';
import { getTokenResult } from './lib/oclcAuth.js';

function requireKbApiScope(): string {
  const scope = process.env.OCLC_KB_API_SCOPE?.trim();
  if (!scope) {
    throw new Error(
      'OCLC auth: falta OCLC_KB_API_SCOPE. ' +
        'Copie el scope exacto de KB API desde la configuración de su WSKey en el portal OCLC (ver .env.example).'
    );
  }
  return scope;
}

async function main(): Promise<void> {
  loadProjectEnv();
  const scope = requireKbApiScope();
  const { expiresInSec } = await getTokenResult(scope);
  console.log(`OK · token recibido · expira en ${expiresInSec} s`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
