/** Entrada cruda de educación en orcid-data.json (perfiles[].education). */
export interface OrcidEducationEntry {
  degree?: string;
  institution?: string;
  department?: string;
  title?: string;
  startYear?: string | number;
  endYear?: string | number;
}

function trimStr(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function parseEndYear(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}

function degreeLabel(entry: OrcidEducationEntry): string | null {
  const degree = trimStr(entry.degree);
  if (degree) return degree;
  const title = trimStr(entry.title);
  if (title) return title;
  const department = trimStr(entry.department);
  if (department) return department;
  return null;
}

function institutionLabel(entry: OrcidEducationEntry): string | null {
  const institution = trimStr(entry.institution);
  return institution || null;
}

/**
 * Formato hero: "Grado · Grado — Institución".
 * Institución: la del registro con endYear más reciente; si empatan, el primero con institución.
 */
export function formatOrcidEducationLine(
  education: OrcidEducationEntry[] | undefined | null,
): string | null {
  if (!education?.length) return null;

  const normalized = education
    .map((entry) => ({
      degree: degreeLabel(entry),
      institution: institutionLabel(entry),
      endYear: parseEndYear(entry.endYear),
    }))
    .filter((entry) => entry.degree || entry.institution);

  if (!normalized.length) return null;

  const degrees: string[] = [];
  for (const entry of normalized) {
    if (entry.degree && !degrees.includes(entry.degree)) {
      degrees.push(entry.degree);
    }
  }
  if (!degrees.length) return null;

  const withInstitution = normalized.filter((entry) => entry.institution);
  const institution =
    [...withInstitution]
      .sort((a, b) => (b.endYear ?? -Infinity) - (a.endYear ?? -Infinity))[0]?.institution ??
    withInstitution[0]?.institution ??
    null;

  const degreePart = degrees.slice(0, 4).join(' · ');
  return institution ? `${degreePart} — ${institution}` : degreePart;
}

/** Normaliza el array education del perfil ORCID (trim + descarta vacíos). */
export function normalizeOrcidEducation(
  education: OrcidEducationEntry[] | undefined | null,
): OrcidEducationEntry[] {
  if (!education?.length) return [];
  return education.filter((entry) => degreeLabel(entry) || institutionLabel(entry));
}
