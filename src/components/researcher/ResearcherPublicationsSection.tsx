import { useMemo, useState } from 'react';
import type { Researcher, Work } from '../../shared/types';
import { fieldEs } from '../../utils/fieldEs';
import { getResearcherUtaId } from '../../utils/helpers';
import { getEnrichedWorksForResearcher } from '../../utils/researcherWorks';
import { sortWorks, type SortKey } from '../../utils/sortWorks';
import ProductionWorkList from '../production/ProductionWorkList';
import { EmptyState } from '../common/UIComponents';

interface ResearcherPublicationsSectionProps {
  researcher: Researcher;
  modalTopic: string;
  onTopicChange: (topic: string) => void;
  onOpenResearcher?: (profileId: string) => void;
}

export default function ResearcherPublicationsSection({
  researcher,
  modalTopic,
  onTopicChange,
  onOpenResearcher,
}: ResearcherPublicationsSectionProps) {
  const utaId = getResearcherUtaId(researcher);
  const [sortBy, setSortBy] = useState<SortKey>('citations');

  const works = useMemo(
    () => getEnrichedWorksForResearcher(researcher),
    [researcher, utaId],
  );

  const total = works.length;

  const topicCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of works) {
      const t = (w.field ?? w.topic) as string | undefined;
      if (t) m.set(t, (m.get(t) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [works]);

  const publicacionesFiltradas = useMemo(() => {
    if (!modalTopic) return works;
    return works.filter((w) => w.field === modalTopic || w.topic === modalTopic);
  }, [works, modalTopic]);

  const publicacionesOrdenadas = useMemo(
    () => sortWorks(publicacionesFiltradas, sortBy),
    [publicacionesFiltradas, sortBy],
  );

  if (!utaId) {
    return (
      <EmptyState
        icon="📄"
        title="Sin identificador UTA"
        message="Este perfil no tiene RUT ni ORCID para vincular publicaciones del repositorio global."
      />
    );
  }

  return (
    <>
      <div className="rps-head">
        <div className="rps-head__left">
          <span className="rps-count">{total} publicaciones</span>
        </div>
        <div className="descubridor__sort">
          <label htmlFor="rps-sort" className="descubridor__sort-label">Ordenar por</label>
          <select
            id="rps-sort"
            className="descubridor__sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
          >
            <option value="citations">Más citadas</option>
            <option value="fwci">Mayor FWCI</option>
            <option value="year">Año (recientes)</option>
            <option value="quartile">Mejor cuartil</option>
          </select>
        </div>
      </div>
      <span className="rps-topics__label">Áreas temáticas</span>
      <div className="rps-chips">
        <button
          type="button"
          className={`rps-chip${!modalTopic ? ' rps-chip--active' : ''}`}
          onClick={() => onTopicChange('')}
        >
          Todas · {total}
        </button>
        {topicCounts.map(([t, n]) => (
          <button
            key={t}
            type="button"
            className={`rps-chip${modalTopic === t ? ' rps-chip--active' : ''}`}
            onClick={() => onTopicChange(t)}
          >
            {fieldEs(t)} · {n}
          </button>
        ))}
      </div>

      <div className="researcher-pubs__list">
        {publicacionesOrdenadas.length > 0 ? (
          <ProductionWorkList
            works={publicacionesOrdenadas as Work[]}
            viewMode="cards"
            onOpenResearcher={onOpenResearcher}
            currentResearcher={researcher}
          />
        ) : (
          <EmptyState
            icon="📄"
            title="Sin publicaciones vinculadas"
            message="No hay obras en el repositorio global con este investigador en autores_uta."
          />
        )}
      </div>
    </>
  );
}
