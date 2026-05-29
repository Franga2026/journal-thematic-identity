import type { Work } from '../shared/types';

/** Etiqueta de área a partir de field o topic (misma regla que /areas) */
export function getWorkAreaLabel(work: Work): string | null {
  const label = (work.field || work.topic || '').trim();
  return label || null;
}

export interface AreaGroup {
  name: string;
  count: number;
  /** % del total de obras del conjunto (investigador o catálogo) */
  sharePct: number;
  /** % relativo al área con más publicaciones (gráfico circular, como /areas) */
  donutPct: number;
}

/**
 * Agrupa publicaciones por área/topic y calcula conteos y porcentajes.
 */
export function groupWorksByArea(works: Work[]): AreaGroup[] {
  const counts: Record<string, number> = {};

  works.forEach((w) => {
    const label = getWorkAreaLabel(w);
    if (label) counts[label] = (counts[label] || 0) + 1;
  });

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = works.length;
  const maxCount = Math.max(...entries.map(([, c]) => c), 1);

  return entries.map(([name, count]) => ({
    name,
    count,
    sharePct: total > 0 ? Math.round((count / total) * 100) : 0,
    donutPct: Math.round((count / maxCount) * 100),
  }));
}
