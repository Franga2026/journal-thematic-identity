// ─── Color Palette ───
export const COLORS = [
  '#2C5F7C', '#8E4C3A', '#5C8374', '#6A4C93', '#3A6B35', '#944E63',
  '#1B6B93', '#9B6B3D', '#557A95', '#7B6D8D', '#B85C38', '#4A6670',
];

export const SDG_COLORS = {
  'No poverty': '#E5243B',
  'Zero hunger': '#DDA63A',
  'Good health and well-being': '#4C9F38',
  'Quality education': '#C5192D',
  'Gender equality': '#FF3A21',
  'Clean water and sanitation': '#26BDE2',
  'Affordable and clean energy': '#F97316',
  'Decent work and economic growth': '#A21942',
  'Industry, innovation and infrastructure': '#FD6925',
  'Reduced inequalities': '#DD1367',
  'Sustainable cities and communities': '#FD9D24',
  'Responsible consumption and production': '#BF8B2E',
  'Climate action': '#3F7E44',
  'Life below water': '#0A97D9',
  'Life on land': '#56C02B',
  'Peace, justice, and strong institutions': '#00689D',
  'Partnerships for the goals': '#19486A',
};

/** Número OpenAlex SDG1–SDG17 por nombre en inglés (dataset local) */
export const SDG_NAME_TO_NUMBER = {
  'No poverty': 1,
  'Zero hunger': 2,
  'Good health and well-being': 3,
  'Quality education': 4,
  'Gender equality': 5,
  'Clean water and sanitation': 6,
  'Affordable and clean energy': 7,
  'Decent work and economic growth': 8,
  'Industry, innovation and infrastructure': 9,
  'Reduced inequalities': 10,
  'Sustainable cities and communities': 11,
  'Responsible consumption and production': 12,
  'Climate action': 13,
  'Life below water': 14,
  'Life on land': 15,
  'Peace, justice, and strong institutions': 16,
  'Partnerships for the goals': 17,
};

export const SDG_NUMBER_TO_NAME = Object.fromEntries(
  Object.entries(SDG_NAME_TO_NUMBER).map(([name, num]) => [String(num), name])
);

/** Países iberoamericanos para filtro OpenAlex */
export const IBEROAMERICA_COUNTRY_CODES = 'CL|AR|BR|MX|ES|CO|PE|VE|UY|PY|EC';

export const SDG_ES = {
  'No poverty': 'Fin de la pobreza',
  'Zero hunger': 'Hambre cero',
  'Good health and well-being': 'Salud y bienestar',
  'Quality education': 'Educación de calidad',
  'Gender equality': 'Igualdad de género',
  'Clean water and sanitation': 'Agua limpia',
  'Affordable and clean energy': 'Energía asequible',
  'Decent work and economic growth': 'Trabajo decente',
  'Industry, innovation and infrastructure': 'Industria e innovación',
  'Reduced inequalities': 'Reducción desigualdades',
  'Sustainable cities and communities': 'Ciudades sostenibles',
  'Responsible consumption and production': 'Producción responsable',
  'Climate action': 'Acción por el clima',
  'Life below water': 'Vida submarina',
  'Life on land': 'Vida ecosistemas terrestres',
  'Peace, justice, and strong institutions': 'Paz y justicia',
  'Partnerships for the goals': 'Alianzas',
};

export const TYPE_ES = {
  article: 'Artículo',
  'book-chapter': 'Capítulo',
  book: 'Libro',
  dissertation: 'Tesis',
  preprint: 'Preprint',
  review: 'Revisión',
  dataset: 'Dataset',
  report: 'Reporte',
  other: 'Otro',
};

export const PAGE_SIZE = 20;
export const WORKS_PAGE_SIZE = 50;

// ─── Tab Configuration ───
export const TABS = [
  { key: 'perfiles', label: 'Perfiles' },
  { key: 'unidades', label: 'Unidades' },
  { key: 'areas', label: 'Áreas' },
  { key: 'ods', label: 'ODS' },
  { key: 'produccion', label: 'Producción' },
  { key: 'ranking', label: 'Ranking' },
  { key: 'metricas', label: 'Métricas' },
  { key: 'informes', label: 'Informes' },
  { key: 'fuentes', label: 'Fuentes' },
];

export const AI_TABS = [
  { key: 'chat', label: '🤖 Chat IA' },
  { key: 'comparar', label: '🔬 Comparador' },
  { key: 'redes', label: '🕸️ Redes' },
  { key: 'tendencias', label: '📊 Tendencias' },
  { key: 'oportunidades', label: '🎯 Oportunidades' },
];

export const RANK_OPTIONS = {
  fwci: { label: '🎯 Impacto Real (FNCI)', desc: 'FNCI mide impacto real: citas recibidas vs esperadas por campo/año/tipo. Mundo=1.0.' },
  hindex: { label: '📐 h-index', desc: 'Balance entre productividad e impacto. Favorece carreras largas.' },
  citas: { label: '📊 Citas Totales', desc: 'Total de citas acumuladas. Favorece entidades grandes.' },
  q1: { label: '🥇 % en Q1', desc: '% de publicaciones en revistas del top 25% (CiteScore).' },
  cpp: { label: '📈 Citas/Pub', desc: 'Promedio de citas por publicación. No normaliza por disciplina.' },
  oa: { label: '🔓 Open Access', desc: '% de publicaciones en acceso abierto.' },
};
