import type { Connect } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { linkCollaborator } from '../services/collaborators/linkCollaborators';
import type { LinkCollaboratorInput } from '../services/collaborators/types';

const LINK_POST_RE = /^\/api\/collaborators\/link\/?$/;
const LINK_GET_RE = /^\/api\/collaborators\/([^/]+)\/link\/?$/;

function sendJson(res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b: string) => void }, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function readJsonBody(req: Connect.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
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

function parseInput(body: Record<string, unknown>, orcidFromPath?: string): LinkCollaboratorInput {
  return {
    orcid: (body.orcid as string) || orcidFromPath,
    name: body.name as string | undefined,
    oaId: body.oaId as string | undefined,
    fetchOpenAlex: body.fetchOpenAlex !== false,
  };
}

function persistAllWorks(works: unknown[]): boolean {
  const awPath = join(process.cwd(), 'src', 'all-works.json');
  if (!existsSync(awPath)) return false;
  writeFileSync(awPath, JSON.stringify(works));
  return true;
}

export function createCollaboratorsApiMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = req.url?.split('?')[0] || '';

    const postMatch = url.match(LINK_POST_RE);
    const getMatch = url.match(LINK_GET_RE);

    if (!postMatch && !getMatch) {
      next();
      return;
    }

    const run = async (input: LinkCollaboratorInput, persist = false) => {
      const result = await linkCollaborator(input);
      if (persist && result.ok) {
        const { getAW } = await import('../utils/dataProcessing.js');
        const saved = persistAllWorks(getAW());
        return { ...result, persisted: saved };
      }
      return result;
    };

    if (postMatch && req.method === 'POST') {
      readJsonBody(req)
        .then((body) => run(parseInput(body), Boolean(body.persist)))
        .then((payload) => sendJson(res, 200, payload))
        .catch((err: Error) => sendJson(res, 502, { ok: false, error: err.message }));
      return;
    }

    if (getMatch && req.method === 'GET') {
      const orcid = decodeURIComponent(getMatch[1]);
      const persist = req.url?.includes('persist=1') ?? false;
      run(parseInput({}, orcid), persist)
        .then((payload) => sendJson(res, 200, payload))
        .catch((err: Error) => sendJson(res, 502, { ok: false, error: err.message }));
      return;
    }

    next();
  };
}
