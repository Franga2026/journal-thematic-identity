/**
 * Universidad de Tarapacá — entidad OpenAlex verificada (2026-06).
 * GET https://api.openalex.org/institutions/I185652977
 */
export const UTA_INST_ID = 'I185652977';
export const UTA_OPENALEX_ID = `https://openalex.org/${UTA_INST_ID}`;
export const UTA_ROR = 'https://ror.org/04xe01d27';
export const UTA_ROR_BARE = '04xe01d27';

export function normRor(value?: string | null): string {
  if (!value) return '';
  return value.replace(/^https?:\/\/(www\.)?ror\.org\//i, '').trim().toLowerCase();
}

export function isUtaRor(value?: string | null): boolean {
  return normRor(value) === UTA_ROR_BARE;
}
