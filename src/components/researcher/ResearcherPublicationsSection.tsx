import { useMemo, useCallback } from 'react';
import type { Researcher, Work } from '../../shared/types';
import { getResearcherUtaId } from '../../utils/helpers';
import { getEnrichedWorksForResearcher } from '../../utils/researcherWorks';
import ProductionWorkList from '../production/ProductionWorkList';
import { EmptyState } from '../common/UIComponents';

interface ResearcherPublicationsSectionProps {
  researcher: Researcher;
  modalTopic: string;
  onTopicChange: (topic: string) => void;
}

export default function ResearcherPublicationsSection({
  researcher,
  modalTopic,
  onTopicChange,
}: ResearcherPublicationsSectionProps) {
  const utaId = getResearcherUtaId(researcher);

  const allLinked = useMemo(
    () => getEnrichedWorksForResearcher(researcher),
    [researcher, utaId]
  );

  const publicacionesFiltradas = useMemo(() => {
    if (!modalTopic) return allLinked;
    return allLinked.filter((w) => w.field === modalTopic || w.topic === modalTopic);
  }, [allLinked, modalTopic]);

  const fieldCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allLinked.forEach((w) => {
      const f = w.field || w.topic;
      if (f) counts[f] = (counts[f] || 0) + 1;
    });
    return counts;
  }, [allLinked]);

  const fields = useMemo(() => Object.keys(fieldCounts).sort(), [fieldCounts]);

  const handleTopic = useCallback(
    (topic: string) => onTopicChange(topic),
    [onTopicChange]
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
      {fields.length > 0 && (
        <div className="researcher-pubs__topics">
          <div className="researcher-pubs__topics-label">Áreas temáticas</div>
          <div className="researcher-pubs__topics-chips">
            <span
              role="button"
              tabIndex={0}
              onClick={() => handleTopic('')}
              onKeyDown={(e) => e.key === 'Enter' && handleTopic('')}
              className={`badge badge--clickable ${!modalTopic ? 'badge--cites' : ''}`}
              style={
                !modalTopic
                  ? { background: '#1e3a8a', color: '#fff', borderColor: '#1e3a8a' }
                  : undefined
              }
            >
              Todas ({allLinked.length})
            </span>
            {fields.map((f) => (
              <span
                key={f}
                role="button"
                tabIndex={0}
                onClick={() => handleTopic(f)}
                onKeyDown={(e) => e.key === 'Enter' && handleTopic(f)}
                className={`badge badge--clickable ${modalTopic === f ? 'badge--cites' : ''}`}
                style={
                  modalTopic === f
                    ? { background: '#1e3a8a', color: '#fff', borderColor: '#1e3a8a' }
                    : { background: '#eff6ff', color: '#1e40af', borderColor: '#bfdbfe' }
                }
              >
                {f} ({fieldCounts[f]})
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="researcher-pubs__meta">
        {publicacionesFiltradas.length.toLocaleString()} publicaciones vinculadas
        <span className="researcher-pubs__source"> · fuente: all-works.json</span>
      </p>

      <div className="researcher-pubs__list">
        {publicacionesFiltradas.length > 0 ? (
          <ProductionWorkList works={publicacionesFiltradas as Work[]} />
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
