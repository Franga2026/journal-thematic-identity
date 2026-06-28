import { useMemo } from 'react';
import { buildWorkFacets } from '../../utils/dataProcessing';
import { typeLabelEs } from '../../utils/constants';
import { fieldEs } from '../../utils/fieldEs';
import FacetCard, { useFacetMax } from './FacetCard';
import type { Work } from '../../shared/types';

interface ProductionFacetsProps {
  worksForYears: Work[];
  worksForTypes: Work[];
  worksForAccess: Work[];
  worksForTopics: Work[];
  workYear: string;
  workType: string;
  workAccess: '' | 'open' | 'closed';
  workTopic: string;
  setWorkYear: (y: string) => void;
  setWorkType: (t: string) => void;
  setWorkAccess: (a: '' | 'open' | 'closed') => void;
  setWorkTopic: (t: string) => void;
  onFilterChange: () => void;
}

export default function ProductionFacets({
  worksForYears,
  worksForTypes,
  worksForAccess,
  worksForTopics,
  workYear,
  workType,
  workAccess,
  workTopic,
  setWorkYear,
  setWorkType,
  setWorkAccess,
  setWorkTopic,
  onFilterChange,
}: ProductionFacetsProps) {
  const yearFacets = useMemo(() => buildWorkFacets(worksForYears).years, [worksForYears]);
  const typeFacets = useMemo(() => buildWorkFacets(worksForTypes).types, [worksForTypes]);
  const accessFacets = useMemo(() => buildWorkFacets(worksForAccess).access, [worksForAccess]);
  const topicFacets = useMemo(() => buildWorkFacets(worksForTopics).topics, [worksForTopics]);
  const yearMax = useFacetMax(yearFacets);
  const typeMax = useFacetMax(typeFacets);

  const typeItems = typeFacets.map((t) => ({
    name: t.name,
    count: t.count,
    label: typeLabelEs(t.name),
  }));

  const accessItems = accessFacets
    .filter((a) => a.count > 0)
    .map((a) => ({
      name: a.name,
      count: a.count,
      label: a.name === 'open' ? 'Open Access' : 'Closed',
    }));

  return (
    <aside className="production-facets" aria-label="Filtros de publicaciones">
      <FacetCard
        title="Year"
        items={yearFacets}
        selected={workYear}
        maxCount={yearMax}
        onSelect={(name) => {
          setWorkYear(name);
          onFilterChange();
        }}
      />
      <FacetCard
        title="Type"
        items={typeItems}
        selected={workType}
        maxCount={typeMax}
        onSelect={(name) => {
          setWorkType(name);
          onFilterChange();
        }}
      />
      <FacetCard
        title="Open Access"
        items={accessItems}
        selected={workAccess}
        showBars={false}
        limit={2}
        onSelect={(name) => {
          const next = name as '' | 'open' | 'closed';
          setWorkAccess(workAccess === next ? '' : next);
          onFilterChange();
        }}
      />
      <FacetCard
        title="Topic / Área"
        items={topicFacets.map((t) => ({ ...t, label: fieldEs(t.name) }))}
        selected={workTopic}
        onSelect={(name) => {
          setWorkTopic(workTopic === name ? '' : name);
          onFilterChange();
        }}
      />
    </aside>
  );
}
