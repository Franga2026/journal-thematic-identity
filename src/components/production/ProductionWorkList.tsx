import type { Work } from '../../shared/types';
import ProductionWorkItem from './ProductionWorkItem';
import { EmptyState } from '../common/UIComponents';

interface ProductionWorkListProps {
  works: Work[];
}

export default function ProductionWorkList({ works }: ProductionWorkListProps) {
  if (!works.length) {
    return (
      <EmptyState
        icon="📄"
        title="No se encontraron publicaciones"
        message="Prueba con otros términos de búsqueda o ajusta los filtros laterales."
      />
    );
  }

  return (
    <div className="production-work-list" role="list">
      {works.map((w, i) => (
        <ProductionWorkItem key={`${w.d || ''}-${w.y || ''}-${i}`} work={w} />
      ))}
    </div>
  );
}
