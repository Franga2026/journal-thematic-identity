/** Normaliza OpenAlex author/work id → "A1234567890" */
export function parseOpenAlexAuthorId(oaId?: string | null): string {
  if (!oaId) return '';
  return String(oaId).replace(/^https?:\/\/openalex\.org\//i, '').trim().toUpperCase();
}
