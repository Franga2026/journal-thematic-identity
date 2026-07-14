import { typeLabelEs } from '../../utils/constants';
import { fieldEs } from '../../utils/fieldEs';
import type { WorksFacetBucket } from '../../services/catalog/fetchWorks';
import FacetCard, { useFacetMax } from './FacetCard';

type FacetItem = { name: string; count: number; label?: string };

const QUARTILE_ORDER = ['Q1', 'Q2', 'Q3', 'Q4', 'sin_datos'];

function toItems(buckets: WorksFacetBucket[] | undefined): FacetItem[] {
  return (buckets || []).map((b) => ({ name: b.key, count: b.count }));
}

function quartileLabel(key: string): string {
  if (key === 'sin_datos') return 'sin datos';
  return key;
}

function sortQuartileItems(items: FacetItem[]): FacetItem[] {
  return [...items].sort(
    (a, b) => QUARTILE_ORDER.indexOf(a.name) - QUARTILE_ORDER.indexOf(b.name)
  );
}

interface ProductionFacetsProps {
  facets: {
    year?: WorksFacetBucket[];
    type?: WorksFacetBucket[];
    quartile?: WorksFacetBucket[];
    access?: WorksFacetBucket[];
    field?: WorksFacetBucket[];
  };
  workYear: string;
  workType: string;
  workQuartile: string;
  workAccess: '' | 'open' | 'closed';
  workTopic: string;
  setWorkYear: (y: string) => void;
  setWorkType: (t: string) => void;
  setWorkQuartile: (q: string) => void;
  setWorkAccess: (a: '' | 'open' | 'closed') => void;
  setWorkTopic: (t: string) => void;
  onFilterChange: () => void;
}

export default function ProductionFacets({
  facets,
  workYear,
  workType,
  workQuartile,
  workAccess,
  workTopic,
  setWorkYear,
  setWorkType,
  setWorkQuartile,
  setWorkAccess,
  setWorkTopic,
  onFilterChange,
}: ProductionFacetsProps) {
  const yearFacets = toItems(facets.year);
  const typeFacets = toItems(facets.type);
  const quartileFacets = sortQuartileItems(toItems(facets.quartile));
  const accessFacets = toItems(facets.access);
  const topicFacets = toItems(facets.field);
  const yearMax = useFacetMax(yearFacets);
  const typeMax = useFacetMax(typeFacets);
  const quartileMax = useFacetMax(quartileFacets);

  const typeItems = typeFacets.map((t) => ({
    name: t.name,
    count: t.count,
    label: typeLabelEs(t.name),
  }));

  const quartileItems = quartileFacets
    .filter((q) => q.count > 0)
    .map((q) => ({
      name: q.name,
      count: q.count,
      label: quartileLabel(q.name),
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
        title="Cuartil"
        items={quartileItems}
        selected={workQuartile}
        maxCount={quartileMax}
        limit={5}
        onSelect={(name) => {
          setWorkQuartile(workQuartile === name ? '' : name);
          onFilterChange();
        }}
      />
      <FacetCard
        title="Tipo"
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
