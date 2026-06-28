export const FIELD_ES: Record<string, string> = {
  Medicine: 'Medicina',
  'Social Sciences': 'Ciencias Sociales',
  Engineering: 'Ingeniería',
  'Arts and Humanities': 'Artes y Humanidades',
  'Computer Science': 'Ciencias de la Computación',
  'Biochemistry, Genetics and Molecular Biology':
    'Bioquímica, Genética y Biología Molecular',
  'Agricultural and Biological Sciences': 'Ciencias Agrícolas y Biológicas',
  'Environmental Science': 'Ciencias Ambientales',
  'Physics and Astronomy': 'Física y Astronomía',
  'Business, Management and Accounting': 'Negocios, Administración y Contabilidad',
  'Materials Science': 'Ciencia de los Materiales',
  Chemistry: 'Química',
  'Economics, Econometrics and Finance': 'Economía, Econometría y Finanzas',
  Psychology: 'Psicología',
  Mathematics: 'Matemáticas',
  'Earth and Planetary Sciences': 'Ciencias de la Tierra y Planetarias',
  Neuroscience: 'Neurociencia',
  'Immunology and Microbiology': 'Inmunología y Microbiología',
  'Chemical Engineering': 'Ingeniería Química',
  Energy: 'Energía',
  Nursing: 'Enfermería',
  'Pharmacology, Toxicology and Pharmaceutics': 'Farmacología, Toxicología y Farmacia',
  'Health Professions': 'Profesiones de la Salud',
  'Decision Sciences': 'Ciencias de la Decisión',
  Dentistry: 'Odontología',
  Veterinary: 'Veterinaria',
  Genetics: 'Genética',
  'Forensic and Genetic Research': 'Investigación Forense y Genética',
  'Indigenous Studies and Ecology': 'Estudios Indígenas y Ecología',
  'General Health Professions': 'Profesiones de la Salud (general)',
};

export const fieldEs = (s: string) => FIELD_ES[s] ?? s;

/** Línea topic · subfield para WorkCard (clave de filtro sigue en inglés). */
export function topicLineEs(w: { topic?: string; field?: string; subfield?: string }) {
  const primary = w.topic || w.field;
  if (!primary) return '';
  const parts = [fieldEs(primary)];
  if (w.subfield && w.subfield !== w.field) parts.push(fieldEs(w.subfield));
  return parts.join(' · ');
}
