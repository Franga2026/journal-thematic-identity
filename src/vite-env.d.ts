/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** @deprecated Use server ANTHROPIC_API_KEY — never expose in client */
  readonly VITE_ANTHROPIC_KEY?: string;
  /** Solo si la API IA está en otro origen (p. ej. Cloudflare Worker) */
  readonly VITE_AI_API_BASE?: string;
  /** URL del proxy cris-discovery-api (OpenAlex) */
  readonly VITE_DISCOVERY_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
