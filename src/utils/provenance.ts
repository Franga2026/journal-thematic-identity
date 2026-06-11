import type { MetricKey } from '../shared/types';

export function buildProvenanceNote(opts: {
  fetchedAt?: string | null;
  fwciN?: number | null;
  orcid?: string | null;
  quartileFetchedAt?: string | null;
  withQuartile?: number | null;
  datasetsFetchedAt?: string | null;
}): string {
  const { fetchedAt, fwciN, orcid, quartileFetchedAt, withQuartile, datasetsFetchedAt } = opts;
  const parts: string[] = [];

  if (!fetchedAt) {
    parts.push(
      orcid
        ? `Métricas OpenAlex (FWCI, % OA) pendientes de cálculo para ${orcid}.`
        : 'Métricas OpenAlex (FWCI, % OA) pendientes de cálculo.',
    );
  } else {
    const date = new Date(fetchedAt).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const nPart =
      typeof fwciN === 'number' && fwciN > 0
        ? ` Promedio sobre ${fwciN} obras con FWCI calculable.`
        : '';
    parts.push(`FWCI y % OA desde OpenAlex API, actualizado ${date}.${nPart}`);
  }

  if (quartileFetchedAt) {
    const qDate = new Date(quartileFetchedAt).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const wPart =
      typeof withQuartile === 'number' && withQuartile > 0
        ? ` Denominador: ${withQuartile} obras con cuartil reconocido.`
        : '';
    parts.push(
      `Cuartiles SJR: fuente Scimago Journal Rank (SJR) 2025; match local por ISSN (cr_issn/up_issn) contra mapa SJR; cuartil = SJR Best Quartile; actualizado ${qDate}.${wPart}`,
    );
  }

  if (datasetsFetchedAt) {
    const dDate = new Date(datasetsFetchedAt).toLocaleDateString('es-CL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    parts.push(
      `Datasets: conteo de obras con type = dataset en OpenAlex (origen principal: DataCite), actualizado ${dDate}.`,
    );
  }

  return parts.join(' ');
}

export const KPI_PROVENANCE: Partial<Record<MetricKey, string>> = {
  output:
    'Conteo de obras del perfil de autor en OpenAlex (works_count), excluyendo datasets (works_count − datasetsCount).',
  cites: 'Suma de cited_by_count del perfil OpenAlex del autor.',
  h_index: 'h-index reportado por OpenAlex en el perfil del autor.',
  cpp: 'Derivado: cited_by_count ÷ works_count (OpenAlex).',
  fwci:
    'Media de los FWCI por obra (OpenAlex). 1,0 = promedio mundial. Excluye obras del año en curso por ventana de citación incompleta; el indicador no es interpretable hasta acumular citas. Las citas absolutas y el conteo de obras sí incluyen el año en curso. Puede diferir de Scopus/WoS.',
  oa_rate:
    'Porcentaje de obras en acceso abierto según OpenAlex (gold, green, hybrid, bronze).',
  datasets:
    'Datasets — obras tipo dataset en OpenAlex (origen principal: DataCite). Cobertura parcial.',
};
