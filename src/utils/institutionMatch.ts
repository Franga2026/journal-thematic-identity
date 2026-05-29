export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Afiliación UTA: Universidad Técnica de Ambato (Ecuador) y variantes OpenAlex.
 * También Universidad de Tarapacá (Chile) para el directorio UTA regional.
 */
export function isUTAInstitution(name?: string | null): boolean {
  if (!name?.trim()) return false;
  const normalized = normalizeText(name);
  return (
    normalized.includes('universidad tecnica de ambato') ||
    normalized.includes('technical university of ambato') ||
    normalized.includes('universidad de tarapaca') ||
    normalized.includes('university of tarapaca') ||
    normalized === 'uta' ||
    normalized.includes(' tarapaca')
  );
}

/** @deprecated Alias */
export const isUtaInstitution = isUTAInstitution;
