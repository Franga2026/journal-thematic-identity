export type SearchIntent = 'orcid' | 'doi' | 'issn' | 'general';

export interface SearchIntentMeta {
  intent: SearchIntent;
  label: string;
  route: '/perfiles' | '/descubridor';
  hint: string;
}

const INTENT_META: Record<SearchIntent, Omit<SearchIntentMeta, 'intent'>> = {
  orcid: {
    label: 'ORCID',
    route: '/perfiles',
    hint: 'Investigador UTA · se abrirá en Perfiles',
  },
  doi: {
    label: 'DOI',
    route: '/descubridor',
    hint: 'Publicación · se buscará en el Descubridor',
  },
  issn: {
    label: 'ISSN',
    route: '/descubridor',
    hint: 'Revista · se buscará en el Descubridor',
  },
  general: {
    label: 'Búsqueda general',
    route: '/descubridor',
    hint: 'Título, autor, revista o palabra clave',
  },
};

export function detectSearchIntent(raw: string): SearchIntent {
  const value = raw.trim();
  if (!value) return 'general';
  if (/^0000-/i.test(value)) return 'orcid';
  if (/^10\./i.test(value)) return 'doi';
  if (/^\d{4}-[\dXx]{4}$/.test(value.replace(/\s/g, ''))) return 'issn';
  return 'general';
}

export function getSearchIntentMeta(raw: string): SearchIntentMeta {
  const intent = detectSearchIntent(raw);
  return { intent, ...INTENT_META[intent] };
}
