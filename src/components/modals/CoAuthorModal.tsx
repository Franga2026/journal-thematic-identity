import { useApp } from '../../context/AppContext';
import { enrichWork } from '../../utils/dataProcessing';
import WorkCard from '../cards/WorkCard';

export default function CoAuthorModal() {
  const { viewCoAuthor, setViewCoAuthor } = useApp();
  if (!viewCoAuthor) return null;

  const ca = viewCoAuthor;

  return (
    <div className="modal-overlay" onClick={() => setViewCoAuthor(null)} style={{ zIndex: 1000 }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1100 }}>
        <div style={{ background: 'linear-gradient(135deg,#2C5F7C,#1e5a78)', padding: '24px clamp(16px,3vw,28px)', borderRadius: '12px 12px 0 0', position: 'relative' }}>
          <button onClick={() => setViewCoAuthor(null)} className="modal__close" aria-label="Cerrar">×</button>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>COLABORADOR INTERNACIONAL</div>
          <h2 style={{ color: '#fff', margin: 0, fontSize: 22, fontWeight: 700 }}>{ca.name}</h2>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>{(ca.institutions || []).join(' · ')}</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            {[{ l: 'Publicaciones', v: ca.works_count }, { l: 'Citas', v: ca.cited_by_count }, { l: 'H-index', v: ca.h_index }].map((m, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{(m.v || 0).toLocaleString()}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>{m.l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '20px clamp(14px,3vw,28px) 28px' }}>
          {ca.fields && ca.fields.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 4 }}>Áreas de investigación</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {ca.fields.map((f, i) => <span key={i} className="chip chip--dept">{f}</span>)}
              </div>
            </div>
          )}
          {ca.works && ca.works.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue-700)', marginBottom: 8 }}>
                Publicaciones más citadas ({ca.works.length})
              </div>
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {ca.works.map((w, i) => <WorkCard key={i} w={enrichWork(w)} compact />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
