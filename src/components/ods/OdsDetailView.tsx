import { startTransition, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { SDG_COLORS, SDG_ES } from '../../utils/constants';
import { getInstitution } from '../../utils/dataProcessing';
import { collectPublicationsForSdg } from '../../utils/sdgWorksSource';
import { resolveSdgFromRoute } from '../../utils/sdgNormalize';
import { clearSdgRankingCache } from '../../services/sdg/cache';
import { useTransitionNavigate } from '../../app/hooks/useTransitionNavigate';
import OdsResearchersPanel, { type OdsResearchersTab } from './OdsResearchersPanel';

const TABS: { key: OdsResearchersTab; label: string }[] = [
  { key: 'uta', label: 'Investigadores UTA' },
  { key: 'ibero', label: 'Top 10 Iberoamérica' },
  { key: 'global', label: 'Top 10 Global' },
];

export default function OdsDetailView() {
  const { sdgNum } = useParams();
  const navigate = useTransitionNavigate();
  const [activeTab, setActiveTab] = useState<OdsResearchersTab>('uta');

  const sdgContext = useMemo(() => resolveSdgFromRoute(sdgNum), [sdgNum]);
  const INST = getInstitution();

  const instSdg = useMemo(() => {
    if (!sdgContext) return undefined;
    return (INST.sdgs || []).find((s) => s.name === sdgContext.sdgName);
  }, [INST.sdgs, sdgContext]);

  const localPubCount = useMemo(() => {
    if (!sdgContext) return 0;
    return collectPublicationsForSdg(sdgContext.sdgName, sdgContext.sdgNum).length;
  }, [sdgContext]);

  if (!sdgContext) {
    return (
      <div className="ods-detail">
        <p>ODS no válido (parámetro de ruta sdgNum={String(sdgNum)}). Use /ods/12.</p>
        <button type="button" className="btn btn--ghost" onClick={() => navigate('/ods')}>
          ← Volver a ODS
        </button>
      </div>
    );
  }

  const { sdgNum: sdgNumber, sdgName, sdgNameEs, normalizedSdg } = sdgContext;
  const color = SDG_COLORS[sdgName as keyof typeof SDG_COLORS] || '#333';
  const title = SDG_ES[sdgName as keyof typeof SDG_ES] || sdgNameEs;
  const instCount = instSdg?.count ?? 0;
  const displayPubCount = localPubCount > 0 ? localPubCount : instCount;

  return (
    <div className="ods-detail">
      <button type="button" className="btn btn--ghost ods-detail__back" onClick={() => navigate('/ods')}>
        ← Objetivos de Desarrollo Sostenible
      </button>

      <header className="ods-detail__hero" style={{ borderLeftColor: color }}>
        <div className="ods-detail__hero-badge" style={{ background: color }}>
          ODS {sdgNumber}
        </div>
        <div>
          <h2 className="ods-detail__title">{title}</h2>
          <p className="ods-detail__subtitle">{sdgName}</p>
          <p className="ods-detail__stats">
            <strong>{displayPubCount.toLocaleString()}</strong> publicaciones
            {localPubCount > 0
              ? ` (sdgNum=${normalizedSdg}, all-works/OpenAlex)`
              : instCount > 0
                ? ' (métricas institucionales)'
                : ''}
          </p>
        </div>
      </header>

      <nav className="ods-detail__tabs" role="tablist" aria-label="Investigadores por ODS">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            className={`ods-detail__tab ${activeTab === key ? 'ods-detail__tab--active' : ''}`}
            onClick={() => {
              startTransition(() => {
                clearSdgRankingCache();
                setActiveTab(key);
              });
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="ods-detail__panel" role="tabpanel">
        <OdsResearchersPanel sdgName={sdgName} sdgNum={sdgNumber} activeTab={activeTab} />
      </div>
    </div>
  );
}
