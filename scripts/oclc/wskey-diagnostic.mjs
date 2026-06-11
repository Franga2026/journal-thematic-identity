#!/usr/bin/env node
/**
 * Diagnóstico WSKey OCLC — token (client_credentials) + holdings por OCLC number.
 * Salida lista para pegar en ticket de soporte (credenciales redactadas).
 *
 * OCLC reference:
 *   Token:    POST https://oauth.oclc.org/token
 *             grant_type=client_credentials
 *             scope=wcapi:view_holdings wcapi:view_institution_holdings
 *             Authorization: Basic base64(KEY:SECRET)
 *   Holdings: GET https://americas.discovery.api.oclc.org/worldcat/search/v2/bibs-holdings?oclcNumber=<n>
 *             Authorization: Bearer <token>
 *   RegIDs:   128807 = Sandbox (test) · 268388 = ROSFLO (production)
 *   Cliente:  Universidad de Tarapacá — RegID 65521, símbolo OCLC U5T
 *
 * Uso:
 *   node --env-file=scripts/oclc/.env.oclc scripts/oclc/wskey-diagnostic.mjs [oclcNumber]
 *
 * Requiere: OCLC_KEY, OCLC_SECRET (ver scripts/oclc/.env.oclc.example)
 */

const TOKEN_URL = 'https://oauth.oclc.org/token';
const HOLDINGS_URL =
  'https://americas.discovery.api.oclc.org/worldcat/search/v2/bibs-holdings';
const TOKEN_SCOPES = 'wcapi:view_holdings wcapi:view_institution_holdings';
const TARGET_SYMBOL = 'U5T';
const SANDBOX_REG_ID = '128807';
const ROSFLO_REG_ID = '268388';
const UTA_REG_ID = '65521';

/** OCLC number de ejemplo si no se pasa por CLI (editable). */
const DEFAULT_OCLC_NUMBER = '79463431';

function lastChars(value, n = 6) {
  if (!value || typeof value !== 'string') return 'N/A';
  return value.length <= n ? '***' : value.slice(-n);
}

function redactToken(token) {
  if (!token) return '...redacted...';
  return `...${lastChars(token)}...`;
}

function basicAuthHeader(key, secret) {
  return `Basic ${Buffer.from(`${key}:${secret}`, 'utf8').toString('base64')}`;
}

function pickRequestId(headers) {
  const candidates = ['x-request-id', 'request-id', 'correlationid', 'x-correlation-id'];
  for (const name of candidates) {
    const value = headers.get(name);
    if (value) return value;
  }
  return null;
}

function relevantHeaders(headers) {
  const out = {};
  for (const [key, value] of headers.entries()) {
    const lower = key.toLowerCase();
    if (
      lower.includes('request-id') ||
      lower.includes('correlation') ||
      lower === 'content-type' ||
      lower === 'date'
    ) {
      out[key] = value;
    }
  }
  return out;
}

function collectSymbols(institutionHolding) {
  const symbols = new Set();
  if (!institutionHolding || typeof institutionHolding !== 'object') return symbols;

  const brief = institutionHolding.briefHoldings;
  if (Array.isArray(brief)) {
    for (const entry of brief) {
      if (entry?.symbol) symbols.add(String(entry.symbol));
      if (entry?.institutionSymbol) symbols.add(String(entry.institutionSymbol));
    }
  }

  const holdings = institutionHolding.holdings;
  if (Array.isArray(holdings)) {
    for (const h of holdings) {
      if (h?.symbol) symbols.add(String(h.symbol));
      if (h?.institutionSymbol) symbols.add(String(h.institutionSymbol));
    }
  }

  if (institutionHolding.symbol) symbols.add(String(institutionHolding.symbol));

  return symbols;
}

async function readJsonSafe(res) {
  const text = await res.text();
  if (!text) return { raw: '', parsed: null };
  try {
    return { raw: text, parsed: JSON.parse(text) };
  } catch {
    return { raw: text, parsed: null };
  }
}

function printSupportBlock({
  oclcNumber,
  holdingsStatus,
  holdingsBody,
  uniqueCode,
  contextInstitutionId,
  keyLast6,
}) {
  const bodyForTicket =
    typeof holdingsBody === 'string'
      ? holdingsBody
      : JSON.stringify(holdingsBody ?? {}, null, 2);

  console.log('\n───── SUPPORT TICKET BLOCK ─────');
  console.log(`WSKey (last few characters): ${keyLast6}`);
  console.log('HTTP Request:');
  console.log(
    `  GET ${HOLDINGS_URL}?oclcNumber=${oclcNumber}`,
  );
  console.log('  Authorization: Bearer <...redacted...>');
  console.log('  Accept: application/json');
  console.log('HTTP Response:');
  console.log(`  HTTP/1.1 ${holdingsStatus ?? 'N/A (token step failed)'}`);
  console.log(`  ${bodyForTicket}`);
  console.log(`Unique Code: ${uniqueCode ?? 'N/A'}`);
  console.log(
    `Context: token contextInstitutionId = ${contextInstitutionId ?? 'N/A'}. WSKey de ROSFLO (RegID ${ROSFLO_REG_ID}).`,
  );
  console.log(
    `  Se solicita autorización en PRODUCCIÓN para leer holdings de Universidad de Tarapacá`,
  );
  console.log(`  (RegID ${UTA_REG_ID}, símbolo ${TARGET_SYMBOL}).`);
  console.log('────────────────────────────────\n');
}

async function main() {
  const oclcNumber = process.argv[2]?.trim() || DEFAULT_OCLC_NUMBER;
  const key = process.env.OCLC_KEY?.trim();
  const secret = process.env.OCLC_SECRET?.trim();

  let contextInstitutionId = null;
  let holdingsStatus = null;
  let holdingsBody = null;
  let uniqueCode = null;
  const keyLast6 = lastChars(key);

  console.log('=== OCLC WSKey Diagnostic ===');
  console.log(`OCLC number: ${oclcNumber}`);
  console.log(`WSKey suffix: ${keyLast6}`);
  console.log('');

  if (!key || !secret) {
    console.error(
      'ERROR: Defina OCLC_KEY y OCLC_SECRET (p. ej. node --env-file=scripts/oclc/.env.oclc ...).',
    );
    printSupportBlock({
      oclcNumber,
      holdingsStatus: null,
      holdingsBody: { error: 'Missing OCLC_KEY or OCLC_SECRET' },
      uniqueCode: 'N/A',
      contextInstitutionId: null,
      keyLast6,
    });
    process.exit(1);
  }

  // ── Paso 1: token ──
  console.log('── Paso 1: Access token ──');
  const tokenBody = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: TOKEN_SCOPES,
  });

  let tokenRes;
  try {
    tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(key, secret),
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenBody.toString(),
    });
  } catch (err) {
    console.error('ERROR de red al solicitar token:', err.message);
    printSupportBlock({
      oclcNumber,
      holdingsStatus: null,
      holdingsBody: { error: err.message },
      uniqueCode: 'N/A',
      contextInstitutionId: null,
      keyLast6,
    });
    process.exit(1);
  }

  const { raw: tokenRaw, parsed: tokenJson } = await readJsonSafe(tokenRes);
  console.log(`HTTP status: ${tokenRes.status} ${tokenRes.statusText}`);

  if (tokenJson) {
    contextInstitutionId =
      tokenJson.contextInstitutionId != null
        ? String(tokenJson.contextInstitutionId)
        : null;
    console.log(`contextInstitutionId: ${contextInstitutionId ?? 'N/A'}`);
    console.log(`scopes: ${tokenJson.scope ?? tokenJson.scopes ?? 'N/A'}`);
    console.log(`expires_in: ${tokenJson.expires_in ?? 'N/A'} s`);
    if (tokenJson.access_token) {
      console.log(`access_token: ${redactToken(tokenJson.access_token)}`);
    }
  } else if (tokenRaw) {
    console.log('Response body (non-JSON):', tokenRaw);
  }

  if (contextInstitutionId === SANDBOX_REG_ID) {
    console.log('⚠️  Estás en el Sandbox (contextInstitutionId = 128807).');
  }

  if (!tokenRes.ok) {
    console.log('\nToken error — cuerpo completo:');
    console.log(tokenJson ? JSON.stringify(tokenJson, null, 2) : tokenRaw);
    printSupportBlock({
      oclcNumber,
      holdingsStatus: null,
      holdingsBody: tokenJson ?? tokenRaw,
      uniqueCode: pickRequestId(tokenRes.headers) ?? 'N/A',
      contextInstitutionId,
      keyLast6,
    });
    process.exit(1);
  }

  const accessToken = tokenJson?.access_token;
  if (!accessToken) {
    console.error('ERROR: respuesta 2xx sin access_token.');
    printSupportBlock({
      oclcNumber,
      holdingsStatus: null,
      holdingsBody: tokenJson ?? tokenRaw,
      uniqueCode: pickRequestId(tokenRes.headers) ?? 'N/A',
      contextInstitutionId,
      keyLast6,
    });
    process.exit(1);
  }

  // ── Paso 2: holdings ──
  console.log('\n── Paso 2: Bibs-holdings ──');
  const holdingsUrl = `${HOLDINGS_URL}?${new URLSearchParams({ oclcNumber })}`;

  let holdingsRes;
  try {
    holdingsRes = await fetch(holdingsUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
  } catch (err) {
    console.error('ERROR de red al consultar holdings:', err.message);
    printSupportBlock({
      oclcNumber,
      holdingsStatus: null,
      holdingsBody: { error: err.message },
      uniqueCode: 'N/A',
      contextInstitutionId,
      keyLast6,
    });
    process.exit(1);
  }

  holdingsStatus = `${holdingsRes.status} ${holdingsRes.statusText}`;
  uniqueCode = pickRequestId(holdingsRes.headers);

  const { raw: holdingsRaw, parsed: holdingsJson } = await readJsonSafe(holdingsRes);
  holdingsBody = holdingsJson ?? holdingsRaw;

  console.log(`HTTP status: ${holdingsStatus}`);
  const hdrs = relevantHeaders(holdingsRes.headers);
  if (Object.keys(hdrs).length > 0) {
    console.log('Headers relevantes:', JSON.stringify(hdrs, null, 2));
  }
  console.log('Response body:');
  console.log(
    holdingsJson ? JSON.stringify(holdingsJson, null, 2) : holdingsRaw || '(vacío)',
  );

  if (holdingsRes.ok && holdingsJson) {
    const allSymbols = new Set();
    const holdingsList = Array.isArray(holdingsJson.institutionHoldings)
      ? holdingsJson.institutionHoldings
      : holdingsJson.institutionHolding
        ? [holdingsJson.institutionHolding]
        : [];

    for (const ih of holdingsList) {
      for (const sym of collectSymbols(ih)) allSymbols.add(sym);
    }

    const symbolList = [...allSymbols].sort();
    const hasU5T = symbolList.some(
      (s) => s.toUpperCase() === TARGET_SYMBOL.toUpperCase(),
    );
    console.log(`\nSímbolo ${TARGET_SYMBOL} presente: ${hasU5T}`);
    console.log(
      `Símbolos encontrados (${symbolList.length}): ${symbolList.length ? symbolList.join(', ') : '(ninguno)'}`,
    );
  }

  printSupportBlock({
    oclcNumber,
    holdingsStatus,
    holdingsBody,
    uniqueCode: uniqueCode ?? 'N/A',
    contextInstitutionId,
    keyLast6,
  });
}

main().catch((err) => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
