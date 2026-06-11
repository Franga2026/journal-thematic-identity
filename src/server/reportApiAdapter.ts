import type { Connect } from 'vite';
import { handleResearcherReport, statusForReportError } from '../services/report/reportHandler';
import { ReportMetricsError } from '../services/report/reportMetrics';

export const REPORT_PATH = '/api/report/researcher';

export const REPORT_CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const MAX_REPORT_BODY_BYTES = 8_000;

export function readReportJsonBody(req: Connect.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_REPORT_BODY_BYTES) {
        reject(new ReportMetricsError('Payload demasiado grande', 413));
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

export async function executeReportRoute(
  body: Record<string, unknown>,
): Promise<{ status: number; headers: Record<string, string>; body: Buffer | string }> {
  try {
    const result = await handleResearcherReport(body);
    const mime =
      result.format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    return {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'X-Report-Format': result.format,
        ...REPORT_CORS_HEADERS,
      },
      body: result.buffer,
    };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const status = statusForReportError(error);
    return {
      status,
      headers: { 'Content-Type': 'application/json', ...REPORT_CORS_HEADERS },
      body: JSON.stringify({ ok: false, error: error.message }),
    };
  }
}

export function createReportApiMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = req.url?.split('?')[0] || '';
    if (url !== REPORT_PATH) {
      next();
      return;
    }
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      Object.entries(REPORT_CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
      return;
    }

    readReportJsonBody(req)
      .then((body) => executeReportRoute(body))
      .then(({ status, headers, body }) => {
        res.statusCode = status;
        Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
        res.end(body);
      })
      .catch((err: Error) => {
        res.statusCode = statusForReportError(err);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: false, error: err.message }));
      });
  };
}

export function createVercelReportHandler() {
  return async function vercelReportHandler(
    req: { method?: string; body?: unknown },
    res: {
      statusCode?: number;
      setHeader: (key: string, value: string) => void;
      end: (body?: Buffer | string) => void;
    },
  ): Promise<void> {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      Object.entries(REPORT_CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
      return;
    }

    const body =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};

    const { status, headers, body: out } = await executeReportRoute(body);
    res.statusCode = status;
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    res.end(out);
  };
}
