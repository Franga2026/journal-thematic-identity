/**
 * Cloudflare Worker — alternativa a Vercel API Routes.
 * Reutiliza executeAiRoute / handleAiWebRequest (misma lógica que api/ai/*.ts).
 *
 * Limitación: sin filesystem Node; rutas que llaman ensureServerData()
 * (analyze-researcher, classify-sdg, analyze-coauthor) requieren dataset
 * embebido o proxy a Vercel. chat y summarize-work funcionan con payload del cliente.
 */
import {
  handleAiWebRequest,
  routeFromPathname,
  type AiRouteKey,
} from '../src/server/aiApiAdapter';
import { configureClaudeRuntime } from '../src/services/ai/claudeClient';

export interface AiWorkerEnv {
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_MODEL?: string;
}

const NODE_DATA_ROUTES: AiRouteKey[] = [
  'analyze-researcher',
  'classify-sdg',
  'analyze-coauthor',
];

export default {
  async fetch(request: Request, env: AiWorkerEnv): Promise<Response> {
    configureClaudeRuntime({
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL,
    });

    const route = routeFromPathname(new URL(request.url).pathname);
    if (!route) {
      return new Response(JSON.stringify({ ok: false, error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (NODE_DATA_ROUTES.includes(route)) {
      return new Response(
        JSON.stringify({
          ok: false,
          error:
            'Esta ruta requiere dataset local (Node). Use Vercel API Routes o envíe contexto vía chat/summarize-work.',
          code: 'worker_no_dataset',
        }),
        { status: 501, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return handleAiWebRequest(request, route);
  },
};
