import { useEffect } from 'react';
import type { Work } from '../../shared/types';
import ProductionWorkList from '../production/ProductionWorkList';

interface OdsWorksModalProps {
  open: boolean;
  onClose: () => void;
  works: Work[];
  name: string;
  role?: string;
  unit?: string;
  badgeLabel: string;
}

export default function OdsWorksModal({
  open,
  onClose,
  works,
  name,
  role,
  unit,
  badgeLabel,
}: OdsWorksModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="ods-works-modal-title"
        style={{ maxWidth: 960 }}
      >
        <div className="researcher-modal__header" style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={onClose}
            className="modal__close"
            aria-label="Cerrar"
          >
            ×
          </button>
          <div style={{ paddingRight: 40 }}>
            <div
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: 1.2,
                color: '#93c5fd',
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Publicaciones en este ODS
            </div>
            <h2 id="ods-works-modal-title" style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#fff' }}>
              {name}
            </h2>
            {role && <div style={{ fontSize: 14, color: '#e2e8f0', marginBottom: 4 }}>{role}</div>}
            {unit && <div style={{ fontSize: 13, color: '#cbd5e1' }}>{unit}</div>}
            <div style={{ fontSize: 12, color: '#93c5fd', marginTop: 10, fontWeight: 600 }}>{badgeLabel}</div>
          </div>
        </div>

        <div style={{ padding: '16px 20px 20px' }}>
          <ProductionWorkList works={works} />
        </div>
      </div>
    </div>
  );
}
