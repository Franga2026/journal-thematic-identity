#!/usr/bin/env tsx
/**
 * Sonda server-side de WorldCat Knowledge Base API (solo diagnóstico).
 *
 * Auth legacy: wskey = OCLC_WSKEY_CLIENT_ID (público) en query. Nunca el secret.
 *
 * Uso:
 *   npm run oclc:kb-probe -- --issn=1234-5678
 *   npm run oclc:kb-probe -- --issn=1234-5678,0042-7092
 *   npm run oclc:kb-probe -- --issn=0028-0836 --institution=128807
 *
 * --institution=REGISTRY_ID → query param institution_id (WorldCat Registry ID).
 *
 * @see https://developer.api.oclc.org/kb
 */
import dns from 'node:dns';
import { loadProjectEnv } from './lib/loadEnv.js';

dns.setDefaultResultOrder('ipv4first');

const KB_BASE = 'https://worldcat.org/webservices/kb';

interface ProbeArgs {
  issns: string[];
  /** WorldCat Registry ID → query param institution_id */
  institutionId?: string;
}

function requireWskeyClientId(): string {
  const clientId = process.env.OCLC_WSKEY_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error(
      'oclc-kb-probe: falta OCLC_WSKEY_CLIENT_ID en .env (client_id público del WSKey, no el secret).'
    );
  }
  return clientId;
}

function parseArgs(argv: string[]): ProbeArgs {
  const issns: string[] = [];
  let institutionId: string | undefined;

  for (const arg of argv) {
    if (arg.startsWith('--issn=')) {
      const raw = arg.slice('--issn='.length).trim();
      if (!raw) {
        throw new Error('oclc-kb-probe: --issn= requiere al menos un ISSN (XXXX-XXXX).');
      }
      for (const part of raw.split(',')) {
        const issn = part.trim();
        if (issn) issns.push(issn);
      }
      continue;
    }
    if (arg.startsWith('--institution=')) {
      const raw = arg.slice('--institution='.length).trim();
      if (!raw) {
        throw new Error('oclc-kb-probe: --institution= requiere un WorldCat Registry ID.');
      }
      institutionId = raw;
      continue;
    }
  }

  if (issns.length === 0) {
    throw new Error(
      'oclc-kb-probe: indique uno o más ISSN con --issn=XXXX-XXXX (varios separados por coma).'
    );
  }

  return { issns, institutionId };
}

function normalizeIssn(issn: string): string {
  const compact = issn.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (compact.length === 8) {
    return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  }
  return issn.trim();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return undefined;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

interface KbLink {
  rel?: string;
  href?: string;
  type?: string;
  title?: string;
}

interface KbEntry {
  id?: string;
  title?: string;
  entry_uid?: string;
  entry_status?: string;
  bkey?: string;
  'kb:collection_name'?: string;
  'kb:collection_uid'?: string;
  'kb:provider_name'?: string;
  'kb:provider_uid'?: string;
  'kb:issn'?: string;
  'kb:isbn'?: string;
  'kb:oclcnum'?: string;
  'kb:coverage'?: string;
  'kb:publisher'?: string;
  'kb:institution_name'?: string;
  'kb:institution_id'?: string | number | string[];
  links?: KbLink[];
  [k: string]: unknown;
}

interface EntriesSearchBody {
  'os:totalResults'?: number | string;
  'os:startIndex'?: number | string;
  'os:itemsPerPage'?: number | string;
  'os:Query'?: string;
  entries?: KbEntry[];
  links?: KbLink[];
  [k: string]: unknown;
}

interface InstitutionContext {
  institutionIds: string[];
  institutionNames: string[];
  oclcSymbols: string[];
  requestedInstitutionId?: string;
  queryString?: string;
  sources: string[];
}

function parseInstitutionIdFromUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    const fromQuery = u.searchParams.get('institution_id');
    if (fromQuery) return fromQuery;
    const rft = u.searchParams.get('rft.institution_id');
    if (rft) return rft;
  } catch {
    // ignore malformed URLs in response metadata
  }
  const pathMatch = url.match(/,(?:\d{4,})(?:[/?#]|$)/);
  if (pathMatch) {
    const id = url.match(/,(\d{4,})(?:[/?#]|$)/);
    return id?.[1];
  }
  return undefined;
}

function parseInstitutionIdsFromQueryString(query: string): string[] {
  const ids: string[] = [];
  const direct = query.match(/(?:^|&)institution_id=(\d+)/g);
  if (direct) {
    for (const part of direct) {
      const m = part.match(/institution_id=(\d+)/);
      if (m?.[1]) ids.push(m[1]);
    }
  }
  return ids;
}

function collectEntryInstitutionIds(entry: KbEntry): string[] {
  const ids: string[] = [];
  const raw = entry['kb:institution_id'];
  if (Array.isArray(raw)) {
    for (const v of raw) {
      const s = asString(v);
      if (s) ids.push(s);
    }
  } else {
    const s = asString(raw);
    if (s) ids.push(s);
  }
  if (entry.id) {
    const fromId = parseInstitutionIdFromUrl(entry.id);
    if (fromId) ids.push(fromId);
  }
  return ids;
}

function extractInstitutionContext(
  body: EntriesSearchBody | null,
  requestedInstitutionId?: string
): InstitutionContext {
  const institutionIds: string[] = [];
  const institutionNames: string[] = [];
  const oclcSymbols: string[] = [];
  const sources: string[] = [];

  if (requestedInstitutionId) {
    institutionIds.push(requestedInstitutionId);
    sources.push('--institution (enviado)');
  }

  const query = asString(body?.['os:Query']);
  if (query) {
    const fromQuery = parseInstitutionIdsFromQueryString(query);
    if (fromQuery.length > 0) {
      institutionIds.push(...fromQuery);
      sources.push('os:Query');
    }
  }

  if (Array.isArray(body?.links)) {
    for (const link of body.links) {
      if (!isRecord(link)) continue;
      const href = asString(link.href);
      if (!href) continue;
      const fromLink = parseInstitutionIdFromUrl(href);
      if (fromLink) {
        institutionIds.push(fromLink);
        sources.push(`link[${asString(link.rel) ?? '?'}]`);
      }
    }
  }

  if (Array.isArray(body?.entries)) {
    for (const entry of body.entries) {
      const fromEntry = collectEntryInstitutionIds(entry);
      if (fromEntry.length > 0) {
        institutionIds.push(...fromEntry);
        sources.push('entry.kb:institution_id / entry.id');
      }
      const name = asString(entry['kb:institution_name']);
      if (name) institutionNames.push(name);
    }
  }

  return {
    institutionIds: uniqueStrings(institutionIds),
    institutionNames: uniqueStrings(institutionNames),
    oclcSymbols: uniqueStrings(oclcSymbols),
    requestedInstitutionId,
    queryString: query,
    sources: uniqueStrings(sources),
  };
}

function parseTotalResults(body: EntriesSearchBody): number {
  const raw = body['os:totalResults'];
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function extractLinks(entry: KbEntry): KbLink[] {
  if (!Array.isArray(entry.links)) return [];
  return entry.links.filter((l) => isRecord(l)) as KbLink[];
}

function compactEntry(entry: KbEntry): Record<string, unknown> {
  const links = extractLinks(entry).map((l) => ({
    rel: l.rel,
    href: l.href,
    type: l.type,
    title: l.title,
  }));

  return {
    id: entry.id,
    title: entry.title,
    entry_uid: entry.entry_uid,
    entry_status: entry.entry_status,
    bkey: entry.bkey,
    collection_name: entry['kb:collection_name'],
    collection_uid: entry['kb:collection_uid'],
    provider_name: entry['kb:provider_name'],
    provider_uid: entry['kb:provider_uid'],
    issn: entry['kb:issn'],
    isbn: entry['kb:isbn'],
    oclcnum: entry['kb:oclcnum'],
    coverage: entry['kb:coverage'],
    publisher: entry['kb:publisher'],
    institution_id: entry['kb:institution_id'],
    institution_name: entry['kb:institution_name'],
    links,
  };
}

function compactBody(body: EntriesSearchBody): Record<string, unknown> {
  const entries = Array.isArray(body.entries) ? body.entries.map(compactEntry) : [];
  return {
    totalResults: body['os:totalResults'],
    startIndex: body['os:startIndex'],
    itemsPerPage: body['os:itemsPerPage'],
    query: body['os:Query'],
    entries,
  };
}

function redactWskeyFromText(text: string, wskey: string): string {
  return text.split(wskey).join('<wskey>');
}

function parseAuthzMessage(text: string): string | undefined {
  const m = text.match(/AuthzResult\[status=([^,\]]+)(?:,message=([^,\]]+))?/);
  if (!m) return undefined;
  const status = m[1]?.trim();
  const message = m[2]?.trim();
  return message ? `${status}: ${message}` : status;
}

function printHttpError(status: number, text: string, wskey: string): void {
  const safe = redactWskeyFromText(text, wskey);
  const authz = parseAuthzMessage(safe);

  if (status === 401) {
    if (authz?.includes('WSKEY_NOT_MATCH_REGID')) {
      console.error(
        '  ✗ 401 — el Registry ID (--institution / institution_id) no coincide con la institución del WSKey.'
      );
      console.error(`     detalle: ${authz}`);
      return;
    }
    if (authz?.includes('IPADDRESS_NOT_ALLOWED')) {
      console.error(
        '  ✗ 401 — IP no permitida. Con auth wskey en query no debería ocurrir; revise el WSKey.'
      );
      console.error(`     detalle: ${authz}`);
      return;
    }
    console.error('  ✗ 401 Unauthorized — WSKey inválido o sin acceso a KB API.');
    if (authz) console.error(`     detalle: ${authz}`);
    return;
  }

  if (status === 403) {
    console.error(
      '  ✗ 403 Forbidden — el WSKey no tiene permisos para esta institución o recurso KB.'
    );
    if (authz) console.error(`     detalle: ${authz}`);
    return;
  }

  if (status === 404) {
    console.error('  ✗ 404 — no encontrado (ISSN ausente en la KB de la institución o ruta inválida).');
    if (authz) console.error(`     detalle: ${authz}`);
  }
}

async function kbFetch(
  path: string,
  params: Record<string, string>,
  wskey: string
): Promise<{ status: number; statusText: string; body: unknown; text: string; url: string }> {
  const url = new URL(`${KB_BASE}${path}`);
  url.searchParams.set('wskey', wskey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  const text = await res.text();
  let body: unknown = null;
  if (text.trim()) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      body = { _rawPreview: redactWskeyFromText(text.slice(0, 500), wskey) };
    }
  }

  const safeUrl = redactWskeyFromText(url.toString(), wskey);
  return { status: res.status, statusText: res.statusText, body, text, url: safeUrl };
}

function institutionIdFromOsQuery(query: string | undefined): string | undefined {
  if (!query) return undefined;
  const ids = parseInstitutionIdsFromQueryString(query);
  return ids[0];
}

function printInstitutionOverride(sent: string | undefined, query: string | undefined): void {
  console.log('\n── Institución (override) ──');
  console.log(`  institution_id enviado:  ${sent ?? '(ninguno — default del WSKey)'}`);
  const fromQuery = institutionIdFromOsQuery(query);
  console.log(`  institution_id os:Query: ${fromQuery ?? '(no en os:Query)'}`);
  if (sent && fromQuery) {
    console.log(`  override aplicado:       ${sent === fromQuery ? 'SÍ' : 'NO'}`);
  } else if (!sent && fromQuery) {
    console.log('  override aplicado:       N/A (institución por defecto del WSKey)');
  }
}

function printInstitutionContext(ctx: InstitutionContext): void {
  console.log('\n── Institución (datos devueltos) ──');
  if (ctx.institutionIds.length > 0) {
    console.log(`  institution_id (Registry): ${ctx.institutionIds.join(', ')}`);
  } else {
    console.log('  institution_id (Registry): (no identificado en la respuesta)');
  }
  if (ctx.institutionNames.length > 0) {
    console.log(`  institution_name:        ${ctx.institutionNames.join(', ')}`);
  }
  if (ctx.oclcSymbols.length > 0) {
    console.log(`  oclc_symbol:             ${ctx.oclcSymbols.join(', ')}`);
  }
  if (ctx.sources.length > 0) {
    console.log(`  fuentes:                 ${ctx.sources.join(', ')}`);
  }
}

function printEntrySummary(entry: KbEntry, index: number): void {
  const links = extractLinks(entry);
  const via = links.filter((l) => l.rel === 'via' || l.rel === 'alternate');
  const proxyLike = links.filter((l) => {
    const href = l.href ?? '';
    return l.rel === 'via' || href.includes('linker') || href.includes('proxy');
  });

  console.log(`\n  [${index}] ${entry.title ?? '(sin título)'}`);
  console.log(`      entry_uid:      ${entry.entry_uid ?? '—'}`);
  console.log(`      entry_status:   ${entry.entry_status ?? '—'}`);
  console.log(`      colección:      ${entry['kb:collection_name'] ?? '—'}`);
  console.log(`      collection_uid: ${entry['kb:collection_uid'] ?? '—'}`);
  console.log(`      proveedor:      ${entry['kb:provider_name'] ?? '—'}`);
  console.log(`      issn:           ${entry['kb:issn'] ?? '—'}`);
  console.log(`      cobertura:      ${entry['kb:coverage'] ?? '—'}`);

  const entryInst = collectEntryInstitutionIds(entry);
  if (entryInst.length > 0) {
    console.log(`      institution_id: ${entryInst.join(', ')}`);
  }

  if (proxyLike.length > 0) {
    console.log('      enlaces acceso / proxy:');
    for (const l of proxyLike) {
      console.log(`        · [${l.rel ?? '?'}] ${l.href ?? '—'}`);
    }
  } else if (via.length > 0) {
    console.log('      enlaces acceso:');
    for (const l of via) {
      console.log(`        · [${l.rel ?? '?'}] ${l.href ?? '—'}`);
    }
  }
}

function compactOpenUrl(body: unknown): Record<string, unknown> | null {
  if (!isRecord(body)) return null;

  const entries = Array.isArray(body.entries)
    ? body.entries.filter(isRecord).map((e) => ({
        title: e.title,
        entry_uid: e.entry_uid,
        collection_name: e['kb:collection_name'] ?? e.collection_name,
        institution_id: e.institution_id,
        url: e.url,
        linkerurl: e.linkerurl,
        proxy: e.proxy,
        links: Array.isArray(e.links)
          ? e.links.filter(isRecord).map((l) => ({ rel: l.rel, href: l.href, type: l.type }))
          : [],
      }))
    : undefined;

  const links = Array.isArray(body.links)
    ? body.links.filter(isRecord).map((l) => ({ rel: l.rel, href: l.href, type: l.type }))
    : undefined;

  return {
    totalResults: body['os:totalResults'] ?? body.totalResults,
    entries,
    links,
    proxy: body.proxy ?? body['kb:proxy'],
    institution_id: body.institution_id,
  };
}

async function searchEntriesByIssn(
  issn: string,
  wskey: string,
  institutionId?: string
): Promise<{ status: number; body: EntriesSearchBody | null; url: string }> {
  const params: Record<string, string> = {
    issn,
    alt: 'json',
    scope: 'my',
    itemsPerPage: '25',
    startIndex: '1',
  };
  if (institutionId) params.institution_id = institutionId;

  const { status, body, text, url } = await kbFetch('/rest/entries/search', params, wskey);

  if (status === 401 || status === 403) {
    printHttpError(status, text, wskey);
    return { status, body: null, url };
  }

  if (status === 404 || !body) {
    if (status === 404) printHttpError(status, text, wskey);
    return { status, body: null, url };
  }

  if (!isRecord(body)) {
    return { status, body: null, url };
  }

  return { status, body: body as EntriesSearchBody, url };
}

async function resolveOpenUrlByIssn(
  issn: string,
  wskey: string,
  institutionId?: string
): Promise<{ status: number; body: unknown }> {
  const params: Record<string, string> = {
    'rft.genre': 'journal',
    'rft.issn': issn,
    alt: 'json',
  };
  if (institutionId) params['rft.institution_id'] = institutionId;

  const { status, body, text } = await kbFetch('/openurl/resolve', params, wskey);

  if (status === 401 || status === 403 || status === 404) {
    printHttpError(status, text, wskey);
  }

  return { status, body };
}

async function probeIssn(
  issnInput: string,
  wskey: string,
  institutionId?: string
): Promise<void> {
  const issn = normalizeIssn(issnInput);
  console.log(`\n${'='.repeat(72)}`);
  console.log(`ISSN: ${issn}${issn !== issnInput.trim() ? ` (normalizado desde "${issnInput.trim()}")` : ''}`);
  console.log(`${'='.repeat(72)}`);

  const search = await searchEntriesByIssn(issn, wskey, institutionId);
  if (search.status === 401 || search.status === 403) return;

  console.log(`  GET ${search.url}`);

  const searchBody = search.body;
  printInstitutionOverride(institutionId, asString(searchBody?.['os:Query']));
  const instCtx = extractInstitutionContext(searchBody, institutionId);
  printInstitutionContext(instCtx);

  const total = searchBody ? parseTotalResults(searchBody) : 0;
  const found = total > 0 && Array.isArray(searchBody?.entries) && searchBody.entries.length > 0;

  console.log(`\n  ¿En KB de la institución? ${found ? 'SÍ' : 'NO'}`);
  if (search.status === 404) {
    console.log('  (HTTP 404 — tratado como no encontrado)');
  } else if (search.status >= 400 && search.status !== 404) {
    console.log(`  (HTTP ${search.status} — sin resultados utilizables)`);
  }

  if (found && searchBody?.entries) {
    console.log(`  coincidencias: ${total} (mostrando ${searchBody.entries.length})`);
    searchBody.entries.forEach((entry, i) => printEntrySummary(entry, i + 1));
  }

  console.log('\n── OpenURL resolve (acceso / proxy) ──');
  const openUrl = await resolveOpenUrlByIssn(issn, wskey, institutionId);
  if (openUrl.status === 401 || openUrl.status === 403) return;

  const openUrlCompact = compactOpenUrl(openUrl.body);

  if (openUrl.status === 404 || !openUrlCompact) {
    console.log('  sin resolución OpenURL (404 o vacío)');
  } else {
    const ouEntries = openUrlCompact.entries;
    if (Array.isArray(ouEntries) && ouEntries.length > 0) {
      console.log(`  entradas OpenURL: ${ouEntries.length}`);
      for (let i = 0; i < ouEntries.length; i++) {
        const e = ouEntries[i];
        if (!isRecord(e)) continue;
        console.log(`    [${i + 1}] ${asString(e.title) ?? '(sin título)'}`);
        const coll = asString(e.collection_name);
        if (coll) console.log(`        colección: ${coll}`);
        const inst = e.institution_id;
        if (inst != null) console.log(`        institution_id: ${JSON.stringify(inst)}`);
        const linker = asString(e.linkerurl) ?? asString(e.url);
        if (linker) console.log(`        enlace: ${linker}`);
        if (e.proxy) console.log(`        proxy: ${JSON.stringify(e.proxy)}`);
        const links = Array.isArray(e.links) ? e.links : [];
        for (const l of links) {
          if (!isRecord(l)) continue;
          console.log(`        · [${asString(l.rel) ?? '?'}] ${asString(l.href) ?? '—'}`);
        }
      }
    } else {
      console.log('  sin entradas OpenURL');
    }

    const topLinks = openUrlCompact.links;
    if (Array.isArray(topLinks) && topLinks.length > 0) {
      console.log('  links OpenURL:');
      for (const l of topLinks) {
        if (!isRecord(l)) continue;
        console.log(`    · [${asString(l.rel) ?? '?'}] ${asString(l.href) ?? '—'}`);
      }
    }

    if (openUrlCompact.proxy) {
      console.log(`  proxy: ${JSON.stringify(openUrlCompact.proxy)}`);
    }
  }

  console.log('\n── Respuesta REST compacta (forma de datos) ──');
  if (searchBody) {
    console.log(JSON.stringify(compactBody(searchBody), null, 2));
  } else {
    console.log('  (vacía)');
  }

  if (openUrlCompact) {
    console.log('\n── OpenURL compacto ──');
    console.log(JSON.stringify(openUrlCompact, null, 2));
  }
}

async function main(): Promise<void> {
  loadProjectEnv();
  const { issns, institutionId } = parseArgs(process.argv.slice(2));
  const wskey = requireWskeyClientId();

  console.log('OCLC KB probe · WorldCat Knowledge Base API (legacy wskey)');
  console.log(
    `endpoint: GET ${KB_BASE}/rest/entries/search?issn=…&wskey=<client_id>&scope=my[&institution_id=…]`
  );
  if (institutionId) {
    console.log(`--institution: ${institutionId}`);
  }

  for (const issn of issns) {
    await probeIssn(issn, wskey, institutionId);
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
