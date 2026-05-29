import type { Connect } from 'vite';
import { getResearchersBySdg, type SdgRegionScope } from '../services/sdg/getResearchersBySdg';

const ROUTE_RE = /^\/api\/sdg\/(\d{1,2})\/researchers\/(local|iberoamerica|global)\/?$/;

function scopeFromSegment(segment: string): SdgRegionScope | null {
  if (segment === 'local') return 'local';
  if (segment === 'iberoamerica') return 'iberoamerica';
  if (segment === 'global') return 'global';
  return null;
}

export function createSdgApiMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = req.url?.split('?')[0] || '';
    const match = url.match(ROUTE_RE);
    if (!match || req.method !== 'GET') {
      next();
      return;
    }

    const sdgId = Number(match[1]);
    const scope = scopeFromSegment(match[2]);
    if (!scope || sdgId < 1 || sdgId > 17) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Invalid SDG or scope' }));
      return;
    }

    getResearchersBySdg(sdgId, scope)
      .then((payload) => {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(payload));
      })
      .catch((err: Error) => {
        res.statusCode = 502;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message || 'SDG ranking failed' }));
      });
  };
}
