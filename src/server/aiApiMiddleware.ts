import type { Connect } from 'vite';
import { loadEnv } from 'vite';
import {
  AI_PATH_TO_ROUTE,
  executeAiRoute,
  readJsonBodyConnect,
  statusForAiError,
  errorPayload,
} from './aiApiAdapter';

let envLoaded = false;

function loadServerEnv(): void {
  if (envLoaded) return;
  const mode = process.env.NODE_ENV || 'development';
  const env = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  envLoaded = true;
}

function sendJson(
  res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b: string) => void },
  status: number,
  body: unknown
): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function createAiApiMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = req.url?.split('?')[0] || '';
    const route = AI_PATH_TO_ROUTE[url];

    if (!route) {
      next();
      return;
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'Method not allowed' });
      return;
    }

    loadServerEnv();

    readJsonBodyConnect(req)
      .then((body) => executeAiRoute(route, body))
      .then(({ status, payload }) => sendJson(res, status, payload))
      .catch((err: Error) => sendJson(res, statusForAiError(err), errorPayload(err)));
  };
}
