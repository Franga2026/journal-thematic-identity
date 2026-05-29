import type { Connect } from 'vite';
import type { ChatRequestBody } from '../services/ai/types';
import {
  handleAnalyzeCoauthor,
  handleAnalyzeResearcher,
  handleChat,
  handleClassifySdg,
  handleSummarizeWork,
} from '../services/ai/aiHandlers';
import {
  ClaudeConfigError,
  ClaudeRateLimitError,
  ClaudeTimeoutError,
} from '../services/ai/claudeClient';

export const AI_ROUTE_KEYS = [
  'chat',
  'summarize-work',
  'analyze-researcher',
  'classify-sdg',
  'analyze-coauthor',
] as const;

export type AiRouteKey = (typeof AI_ROUTE_KEYS)[number];

export const AI_PATH_TO_ROUTE: Record<string, AiRouteKey> = {
  '/api/ai/chat': 'chat',
  '/api/ai/summarize-work': 'summarize-work',
  '/api/ai/analyze-researcher': 'analyze-researcher',
  '/api/ai/classify-sdg': 'classify-sdg',
  '/api/ai/analyze-coauthor': 'analyze-coauthor',
};

export const MAX_AI_BODY_BYTES = 32_000;

export const AI_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function statusForAiError(err: Error): number {
  if (err instanceof ClaudeConfigError) return 503;
  if (err instanceof ClaudeRateLimitError) return 429;
  if (err instanceof ClaudeTimeoutError) return 504;
  if (err.message.includes('Payload')) return 413;
  return 502;
}

export function errorPayload(err: Error): { ok: false; error: string; code?: string } {
  return {
    ok: false,
    error: err.message || 'Error en asistente IA',
    code:
      err instanceof ClaudeConfigError
        ? 'missing_key'
        : err instanceof ClaudeRateLimitError
          ? 'rate_limit'
          : err instanceof ClaudeTimeoutError
            ? 'timeout'
            : err.message.includes('Payload')
              ? 'payload_too_large'
              : undefined,
  };
}

export async function executeAiRoute(
  route: AiRouteKey,
  body: Record<string, unknown>
): Promise<{ status: number; payload: unknown }> {
  try {
    let payload: { ok: boolean };
    switch (route) {
      case 'summarize-work':
        payload = await handleSummarizeWork(body);
        break;
      case 'analyze-researcher':
        payload = await handleAnalyzeResearcher(body);
        break;
      case 'classify-sdg':
        payload = await handleClassifySdg(body);
        break;
      case 'analyze-coauthor':
        payload = await handleAnalyzeCoauthor(body);
        break;
      case 'chat':
        payload = await handleChat(body as ChatRequestBody);
        break;
      default:
        return { status: 404, payload: { ok: false, error: 'Ruta desconocida' } };
    }
    return { status: payload.ok ? 200 : 502, payload };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { status: statusForAiError(error), payload: errorPayload(error) };
  }
}

export function routeFromPathname(pathname: string): AiRouteKey | null {
  const path = pathname.split('?')[0].replace(/\/$/, '') || pathname;
  return AI_PATH_TO_ROUTE[path] ?? null;
}

export async function readJsonBodyWeb(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (raw.length > MAX_AI_BODY_BYTES) {
    throw new Error('Payload demasiado grande');
  }
  if (!raw.trim()) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

export function readJsonBodyConnect(req: Connect.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_AI_BODY_BYTES) {
        reject(new Error('Payload demasiado grande'));
        req.destroy();
        return;
      }
      raw += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function jsonResponse(status: number, payload: unknown, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...AI_CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

/** Handler Fetch API — Vercel (edge opcional) y Cloudflare Workers */
export async function handleAiWebRequest(request: Request, route: AiRouteKey): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: AI_CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'Method not allowed' });
  }
  try {
    const body = await readJsonBodyWeb(request);
    const { status, payload } = await executeAiRoute(route, body);
    return jsonResponse(status, payload);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return jsonResponse(statusForAiError(error), errorPayload(error));
  }
}

/** Vercel Serverless (Node) — reutiliza executeAiRoute */
export function createVercelAiHandler(route: AiRouteKey) {
  return async function vercelAiHandler(
    req: { method?: string; body?: unknown },
    res: {
      status: (code: number) => { json: (body: unknown) => void; end?: (body?: string) => void };
      setHeader: (key: string, value: string) => void;
    }
  ): Promise<void> {
    Object.entries(AI_CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

    if (req.method === 'OPTIONS') {
      res.status(204).json(null);
      return;
    }
    if (req.method !== 'POST') {
      res.status(405).json({ ok: false, error: 'Method not allowed' });
      return;
    }

    const body =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};

    try {
      if (JSON.stringify(body).length > MAX_AI_BODY_BYTES) {
        throw new Error('Payload demasiado grande');
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Payload')) {
        res.status(413).json(errorPayload(err));
        return;
      }
    }

    const { status, payload } = await executeAiRoute(route, body);
    res.status(status).json(payload);
  };
}
