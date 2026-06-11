import { useMemo, useCallback, useState, useEffect } from 'react';
import { startTransition } from 'react';
import { useLocation } from 'react-router-dom';
import { useTransitionNavigate } from '../../app/hooks/useTransitionNavigate';
import { useOpenResearcherProfile } from '../../app/hooks/useOpenResearcherProfile';
import { useApp } from '../../context/AppContext';
import {
  getAuthorOA,
  getOrcidProfile,
  getMetrics,
  getResMetrics,
  getData,
  getAI,
  getResearcherOpenAlexUrl,
  getMetricPercentile,
  getDatasetsForAuthor,
} from '../../utils/dataProcessing';
import { getOrcidRecordUrl, shouldSyncProfileRoute, getProfileRoutePath } from '../../utils/researcherProfile';
import { getCoAuthorClickTarget, isCoAuthorClickable } from '../../utils/coAuthorProfileResolver';
import type { CoAuthorRef, MetricKey, Researcher } from '../../shared/types';
import { cleanOrcid, getInitials } from '../../utils/helpers';
import { downloadMetricReport } from '../../utils/reportGenerator';
import { buildProvenanceNote, KPI_PROVENANCE } from '../../utils/provenance';
import {
  fwciKpiSublabel,
  fwciKpiTooltip,
  OPENALEX_METRICS_UNIVERSE_NOTE,
} from '../../utils/fwciKpiDisplay';
import {
  quartileSummaryLine,
  QUARTILE_NO_DATA,
} from '../../utils/quartileDisplay';
import {
  formatOrcidEducationLine,
  normalizeOrcidEducation,
} from '../../utils/orcidEducationDisplay';
import { downloadReportBlob, ReportApiError, requestReport } from '../../api/reportApi';
import ResearcherAreasSection from '../researcher/ResearcherAreasSection';
import ResearcherPublicationsSection from '../researcher/ResearcherPublicationsSection';
import OpenAlexResearcherProfile from './OpenAlexResearcherProfile';
import AISummaryButton from '../ai/AISummaryButton';
import WorkCard from '../cards/WorkCard';
import { analyzeResearcher } from '../../api/aiApi';
import type { ResearcherAnalysisStructured } from '../../services/ai/types';

const NO_DATA = '—';
const NO_DATA_COLOR = '#94a3b8';

function IconFileText({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconSchool({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c0 1 2 3 6 3s6-2 6-3v-5" />
    </svg>
  );
}

function IconMail({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function IconSparkles({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M19 13l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
    </svg>
  );
}

function formatMetricDisplay(val: number | string | null | undefined): string {
  if (val === null || val === undefined) return NO_DATA;
  if (typeof val === 'number') return val.toLocaleString();
  return val;
}

function cppFromOa(oa: { works_count?: number; cited_by_count?: number }): number | null {
  if (!oa.works_count) return null;
  return +((oa.cited_by_count || 0) / oa.works_count).toFixed(2);
}

function datasetsDisplay(oa: {
  datasetsCount?: number | null;
  datasetsFetchedAt?: string | null;
}): number | null {
  if (!oa.datasetsFetchedAt) return null;
  return oa.datasetsCount ?? 0;
}

function buildDistinctionLabels(mq: {
  above_world_avg?: boolean;
  highly_cited?: boolean;
  interdisciplinary?: boolean;
  productive?: boolean;
}): string[] {
  const labels: string[] = [];
  if (mq.above_world_avg) labels.push('Impacto sobre promedio mundial');
  if (mq.highly_cited) labels.push('Altamente citado');
  if (mq.interdisciplinary) labels.push('Interdisciplinario');
  if (mq.productive) labels.push('Productivo');
  return labels;
}

type OaAuthor = NonNullable<ReturnType<typeof getAuthorOA>>;
type Rdist = Record<string, { min?: number; max?: number; mean?: number; median?: number; p75?: number; std?: number } | null | undefined>;

function buildMetricDefs(oa: OaAuthor, rdist: Rdist) {
  const oaRate = oa.oaRate ?? null;
  const utaFWCI = rdist.fwci?.mean ?? null;
  const utaFWCILabel = utaFWCI !== null ? utaFWCI : NO_DATA;
  const fwciNLabel = oa.fwciN ?? NO_DATA;

  return {
    h_index: {
      name: 'h-index',
      val: oa.h_index ?? null,
      numVal: oa.h_index ?? null,
      dist: rdist.h_index,
      color: '#1e5a78',
      desc: 'El h-index indica un balance entre productividad e impacto de citación. Un h-index de N significa N publicaciones con al menos N citas cada una.',
      calc: 'Se ordenan las publicaciones por citas (descendente). El h-index es el mayor valor h tal que h publicaciones tienen ≥h citas.',
      interpret: (v: number | null) =>
        v === null
          ? 'Sin dato de h-index disponible en OpenAlex.'
          : v >= 20
            ? 'Excelente trayectoria con producción e impacto sostenido.'
            : v >= 10
              ? 'Trayectoria consolidada.'
              : v >= 5
                ? 'Investigador en desarrollo.'
                : 'Etapa temprana o producción aún no ampliamente citada.',
    },
    fwci: {
      name: 'FWCI',
      val: oa.fwci ?? null,
      numVal: oa.fwci ?? null,
      dist: rdist.fwci,
      color: oa.fwci === null ? NO_DATA_COLOR : oa.fwci >= 1 ? '#15803D' : '#ef4444',
      desc: `Media de los FWCI por obra (OpenAlex). 1,0 = promedio mundial. Promedio UTA = ${utaFWCILabel}. Basado en N=${fwciNLabel} obras. El FWCI de OpenAlex tiende a ser más alto que en Scopus/WoS por diferencias metodológicas.`,
      calc: `FWCI = (1/N) × Σ(fwci_i por obra). Mundo = 1,0. Promedio UTA = ${utaFWCILabel}.`,
      interpret: (v: number | null) => {
        if (v === null) return 'Sin dato de FWCI disponible en OpenAlex para este autor.';
        const pW = ((v - 1) * 100).toFixed(1);
        if (v === 0) return '⚠️ FWCI = 0: Sin citas esperadas calculables.';
        if (v >= 2) return `🏆 Excelente: FWCI ${v} — +${pW}% vs mundo. Más del doble del promedio.`;
        if (v >= 1) return `🟢 Sobre promedio mundial: FWCI ${v} — +${pW}% vs mundo.`;
        if (v >= 0.8) return `🟡 Ligeramente bajo: FWCI ${v} — ${pW}% vs mundo. Margen de mejora.`;
        return `🔴 Bajo promedio: FWCI ${v} — ${pW}% vs mundo.`;
      },
    },
    cpp: {
      name: 'Citas/Pub',
      val: cppFromOa(oa),
      numVal: cppFromOa(oa),
      dist: rdist.citations_per_pub,
      color: '#7c3aed',
      desc: 'Promedio de citas por publicación. No normaliza por disciplina.',
      calc: 'CPP = Total de citas ÷ Total de publicaciones',
      interpret: (v: number | null) =>
        v === null
          ? 'Sin dato: no hay publicaciones indexadas en OpenAlex.'
          : v >= 20
            ? 'Muy alto promedio de citas.'
            : v >= 10
              ? 'Buena visibilidad.'
              : v >= 5
                ? 'Promedio moderado.'
                : 'Promedio bajo — puede reflejar publicaciones recientes.',
    },
    output: {
      name: 'Scholarly Output',
      val: oa.publicationsCount ?? null,
      numVal: oa.publicationsCount ?? null,
      dist: rdist.scholarly_output,
      color: '#1e3a8a',
      desc: "Total de publicaciones indexadas, excluyendo datasets. 'Power Metric' que aumenta con tamaño.",
      calc: 'works_count − datasetsCount (OpenAlex).',
      interpret: (v: number | null) =>
        v === null
          ? 'Sin dato de producción en OpenAlex.'
          : v >= 100
            ? 'Producción muy alta.'
            : v >= 50
              ? 'Producción sustancial.'
              : v >= 20
                ? 'Producción activa.'
                : 'Producción moderada.',
    },
    cites: {
      name: 'Citation Count',
      val: oa.cited_by_count ?? null,
      numVal: oa.cited_by_count ?? null,
      dist: null,
      color: '#dc2626',
      desc: "Total de citas recibidas. 'Power Metric' de visibilidad acumulada.",
      calc: 'Suma de todas las citas recibidas.',
      interpret: (v: number | null) =>
        v === null
          ? 'Sin dato de citas en OpenAlex.'
          : v >= 1000
            ? 'Visibilidad excepcional.'
            : v >= 200
              ? 'Buena visibilidad.'
              : v >= 50
                ? 'Visibilidad en desarrollo.'
                : 'Visibilidad aún limitada.',
    },
    oa_rate: {
      name: 'Open Access',
      val: oaRate === null ? NO_DATA : `${oaRate}%`,
      numVal: oaRate,
      dist: rdist.oa_rate,
      color: oaRate === null ? NO_DATA_COLOR : '#15803D',
      desc: 'Porcentaje en acceso abierto (gold, green, hybrid, bronze).',
      calc: 'OA rate = Publicaciones OA ÷ Total × 100',
      interpret: (v: number | null) =>
        v === null
          ? 'Sin dato de acceso abierto en OpenAlex.'
          : v >= 80
            ? 'Excelente compromiso OA.'
            : v >= 50
              ? 'Buena tasa OA.'
              : v >= 30
                ? 'Tasa moderada.'
                : 'Baja tasa OA — oportunidad de mejora.',
    },
    datasets: {
      name: 'Datasets',
      val: datasetsDisplay(oa),
      numVal: datasetsDisplay(oa),
      dist: null,
      color: '#0d9488',
      desc: 'Obras tipo dataset en OpenAlex (origen principal: DataCite). Cobertura parcial.',
      calc: 'Conteo de obras con type = dataset en OpenAlex.',
      interpret: (v: number | null) =>
        v === null
          ? 'Sin dato: ejecute npm run enrich:datasets para calcular.'
          : v === 0
            ? 'Sin datasets registrados en OpenAlex para este autor.'
            : `${v} dataset${v === 1 ? '' : 's'} indexado${v === 1 ? '' : 's'} en OpenAlex.`,
    },
  };
}

const METHOD_NOTES: Partial<Record<MetricKey, string>> = {
  cpp: 'CPP no está normalizado por disciplina. Se recomienda interpretarlo con FWCI y percentiles.',
  fwci: 'FWCI normaliza por campo, año y tipo. 1.0 = promedio mundial exacto.',
  h_index: 'El h-index favorece carreras largas y no distingue entre disciplinas.',
  oa_rate: 'No normaliza por disciplina. Diferentes áreas tienen distintos patrones OA.',
  datasets: 'Conteo desde OpenAlex (type=dataset). Cobertura parcial según repositorio.',
};

export default function ResearcherModal() {
  const navigate = useTransitionNavigate();
  const location = useLocation();
  const { openLocalResearcherProfile } = useOpenResearcherProfile();
  const {
    selected,
    openAlexAuthorId,
    closeResearcher,
    modalTopic,
    setModalTopic,
    metricDetail,
    setMetricDetail,
    setViewCoAuthor,
    openResearcher,
    resolveResearcherProfile,
  } = useApp();

  const [datasetsExpanded, setDatasetsExpanded] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const METRICS = getMetrics();
  const RES_METRICS = getResMetrics();
  const DATA = getData();

  const researcherOrcid = cleanOrcid(selected?.o);
  const oa = selected ? getAuthorOA(selected) : null;
  const rm = selected ? (RES_METRICS[researcherOrcid] || {}) : {};
  const rdist = METRICS.researcher_distributions || {};

  const authorDatasets = useMemo(
    () => (researcherOrcid ? getDatasetsForAuthor(researcherOrcid) : []),
    [researcherOrcid],
  );
  const datasetsCount = authorDatasets.length;

  const sortedAuthorDatasets = useMemo(
    () => [...authorDatasets].sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
    [authorDatasets],
  );

  const MDEFS = useMemo(
    () => (oa ? buildMetricDefs(oa, rdist) : {}),
    [oa, rdist],
  );

  const provenanceNote = useMemo(() => {
    if (!oa) return '';
    return buildProvenanceNote({
      fetchedAt: oa.fwciFetchedAt,
      fwciN: oa.fwciN,
      orcid: researcherOrcid,
      quartileFetchedAt: oa.sjrQuartileFetchedAt,
      withQuartile: oa.quartile_profile?.with_quartile,
      datasetsFetchedAt: oa.datasetsFetchedAt,
    });
  }, [oa, researcherOrcid]);

  useEffect(() => {
    setDatasetsExpanded(false);
  }, [selected?.id]);

  const openCoAuthor = useCallback(
    (ref: CoAuthorRef) => {
      const target = getCoAuthorClickTarget(ref, getData());
      if (!target) return;
      if (target.kind === 'uta') {
        openLocalResearcherProfile(target.researcher);
        return;
      }
      setViewCoAuthor(target.profile);
    },
    [openLocalResearcherProfile, setViewCoAuthor],
  );

  const handleCloseProfile = useCallback(() => {
    startTransition(() => {
      closeResearcher();
      if (/^\/perfiles\/[^/]+/.test(location.pathname)) {
        navigate('/perfiles');
      }
    });
  }, [closeResearcher, navigate, location.pathname]);

  const handleExecutiveReport = useCallback(async () => {
    if (!selected?.o || reportLoading) return;
    setReportLoading(true);
    try {
      const { blob, filename } = await requestReport(selected.o);
      downloadReportBlob(blob, filename);
    } catch (err) {
      const message =
        err instanceof ReportApiError ? err.message : 'No se pudo generar el informe ejecutivo';
      window.alert(message);
    } finally {
      setReportLoading(false);
    }
  }, [selected?.o, reportLoading]);

  const handleOpenResearcherFromWork = useCallback(
    (profileId: string) => {
      const rut = profileId.trim();
      if (!rut) return;
      startTransition(() => {
        resolveResearcherProfile(rut);
        if (shouldSyncProfileRoute(location.pathname)) {
          navigate(getProfileRoutePath(rut));
        }
      });
    },
    [resolveResearcherProfile, navigate, location.pathname],
  );

  if (openAlexAuthorId) {
    return (
      <OpenAlexResearcherProfile
        authorId={openAlexAuthorId}
        onClose={handleCloseProfile}
        onUtaMatch={(r) => {
          startTransition(() => {
            openResearcher(r);
            if (shouldSyncProfileRoute(location.pathname)) {
              const orcid = (r.o || '').replace(/https?:\/\/orcid\.org\//i, '').trim();
              if (orcid) navigate(`/perfiles/${orcid}`);
              else if (r.id) navigate(`/perfiles/${encodeURIComponent(r.id)}`);
            }
          });
        }}
      />
    );
  }

  if (!selected) return null;

  const orcidUrl = getOrcidRecordUrl(selected.o);
  const openAlexUrl = getResearcherOpenAlexUrl(selected);
  const op = getOrcidProfile(selected);
  const AI = getAI();

  const aiSummary = (AI?.summaries || {})[researcherOrcid];
  const affinityList = (AI?.affinity || {})[researcherOrcid] || [];
  const qp = oa?.quartile_profile || {};
  const q1Line = quartileSummaryLine(qp, 'q1');
  const q1q2Line = quartileSummaryLine(qp, 'q1q2');
  const mq = rm.metrics_quality || {};
  const educationLine = formatOrcidEducationLine(normalizeOrcidEducation(op?.education));
  const distinctions = buildDistinctionLabels(mq);
  const dept = (selected.dp || [])[0];
  const roleLine =
    selected.t && dept
      ? `${selected.t} — ${dept.d}${dept.j ? ` · ${dept.j}` : ''}`
      : selected.t || (dept ? `${dept.d}${dept.j ? ` · ${dept.j}` : ''}` : '');
  const productivityTrend = rm.productivity_trend as Record<string, number> | undefined;
  const trendYearCount = productivityTrend ? Object.keys(productivityTrend).length : 0;

  const renderKpiCard = (k: string, label: string) => {
    const md = MDEFS[k as MetricKey] || {};
    const isDatasetsKpi = k === 'datasets';
    const isFwci = k === 'fwci';
    const displayVal =
      k === 'cpp'
        ? cppFromOa(oa!)
        : isDatasetsKpi
          ? datasetsCount > 0
            ? datasetsCount
            : datasetsDisplay(oa!)
          : md.val;
    const isNoData = displayVal === null || displayVal === undefined || displayVal === NO_DATA;
    const datasetsClickable = isDatasetsKpi && datasetsCount > 0;
    const kpiActive = isDatasetsKpi ? datasetsExpanded : metricDetail === k;
    const cardTitle = isFwci ? fwciKpiTooltip(oa!.fwciN) : KPI_PROVENANCE[k as MetricKey];
    const valueClass = [
      'researcher-kpi__value',
      isNoData ? 'researcher-kpi__value--muted' : '',
      isFwci && !isNoData && typeof md.numVal === 'number' && md.numVal >= 1
        ? 'researcher-kpi__value--fwci-ok'
        : '',
    ]
      .filter(Boolean)
      .join(' ');
    const showAnalyze = !isDatasetsKpi || datasetsClickable;
    const actionLabel = isDatasetsKpi
      ? datasetsClickable
        ? datasetsExpanded
          ? '▲ Cerrar'
          : '▼ Ver listado'
        : ''
      : kpiActive
        ? '▲ Cerrar'
        : '· Analizar';

    const body = (
      <>
        <div className={valueClass}>{formatMetricDisplay(displayVal as number | string | null | undefined)}</div>
        <div className="researcher-kpi__label">{label}</div>
        {isDatasetsKpi && datasetsCount === 0 && (
          <div className="researcher-kpi__sub">sin datasets</div>
        )}
        {isFwci && (
          <div className="researcher-kpi__sub">{fwciKpiSublabel(oa!.fwci ?? null, oa!.fwciN)}</div>
        )}
        {showAnalyze && actionLabel && (
          <div className="researcher-kpi__action">{actionLabel}</div>
        )}
      </>
    );

    const className = [
      'researcher-kpi',
      kpiActive ? 'researcher-kpi--active' : '',
      isDatasetsKpi && !datasetsClickable ? 'researcher-kpi--static' : '',
    ]
      .filter(Boolean)
      .join(' ');

    const onClick = () => {
      if (isDatasetsKpi) {
        if (!datasetsClickable) return;
        setDatasetsExpanded((open) => !open);
        if (metricDetail === 'datasets') setMetricDetail(null);
        return;
      }
      setMetricDetail(metricDetail === k ? null : (k as MetricKey));
    };

    if (datasetsClickable || !isDatasetsKpi) {
      return (
        <button
          key={k}
          type="button"
          title={cardTitle}
          className={className}
          aria-expanded={kpiActive}
          onClick={onClick}
        >
          {body}
        </button>
      );
    }

    return (
      <div key={k} title={cardTitle} className={className}>
        {body}
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={handleCloseProfile}>
      <div
        className="modal researcher-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="researcher-modal-title"
      >
        <header className="researcher-hero">
          <div className="researcher-hero__toolbar">
            <button
              type="button"
              onClick={handleExecutiveReport}
              disabled={reportLoading || !selected.o}
              className="researcher-hero__report"
              title="Generar informe ejecutivo PDF (CRIS Victoria)"
            >
              <IconFileText className="ti-file-text" />
              {reportLoading ? 'Generando…' : 'Reporte Ejecutivo'}
            </button>
            <button
              type="button"
              onClick={handleCloseProfile}
              className="modal__close researcher-hero__close"
              aria-label="Cerrar"
            >
              <span className="ti-x" aria-hidden>×</span>
            </button>
          </div>

          <p className="researcher-hero__eyebrow">Universidad de Tarapacá</p>

          <div className="researcher-hero__main">
            {selected.ph ? (
              <img
                src={`/photos/${selected.ph}`}
                alt=""
                className="researcher-hero__avatar-img"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="researcher-hero__avatar" aria-hidden>
                {getInitials(selected.f, selected.l)}
              </div>
            )}
            <div className="researcher-hero__info">
              <h2 id="researcher-modal-title" className="researcher-hero__name">
                {selected.f} {selected.l}
              </h2>
              {roleLine && <p className="researcher-hero__role">{roleLine}</p>}
              {educationLine && (
                <p className="researcher-hero__meta-row">
                  <IconSchool className="ti-school" />
                  <span>{educationLine}</span>
                </p>
              )}
              {selected.e && (
                <p className="researcher-hero__meta-row">
                  <IconMail className="ti-mail" />
                  <span>{selected.e}</span>
                </p>
              )}
              <div className="researcher-hero__chips">
                {orcidUrl && (
                  <a
                    href={orcidUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="researcher-hero__chip researcher-hero__chip--orcid"
                    title="Abrir ficha en orcid.org"
                  >
                    ORCID: {cleanOrcid(selected.o)}
                  </a>
                )}
                {openAlexUrl && (
                  <a
                    href={openAlexUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="researcher-hero__chip researcher-hero__chip--openalex"
                    title="Ver autor en OpenAlex"
                  >
                    OpenAlex
                  </a>
                )}
              </div>
            </div>
          </div>

          {distinctions.length > 0 && (
            <>
              <hr className="researcher-hero__divider" />
              <div className="researcher-hero__distinctions">
                {distinctions.map((label) => (
                  <span key={label} className="researcher-hero__distinction">
                    <IconCheck className="ti-check" />
                    {label}
                  </span>
                ))}
              </div>
            </>
          )}
        </header>

        <div className="researcher-body">
          <section className="researcher-section" aria-label="Resumen IA">
            <div className="researcher-card">
              <div className="researcher-ai__heading">
                <IconSparkles className="ti-sparkles" />
                Resumen IA:
              </div>
              {aiSummary && <p className="researcher-ai__summary">{aiSummary}</p>}
            </div>
          </section>

          {oa && (
            <>
              <section className="researcher-section" aria-labelledby="researcher-kpi-label">
                <h3 id="researcher-kpi-label" className="researcher-section__label">
                  Indicadores
                </h3>
                <div className="researcher-card researcher-kpi-row">
                  <div className="researcher-kpi-grid researcher-kpi-grid--primary">
                    {renderKpiCard('output', 'Publicaciones')}
                    {renderKpiCard('cites', 'Citas totales')}
                    {renderKpiCard('h_index', 'H-index')}
                  </div>
                </div>
                <div className="researcher-card researcher-kpi-row">
                  <div className="researcher-kpi-grid researcher-kpi-grid--secondary">
                    {renderKpiCard('fwci', 'FWCI')}
                    {renderKpiCard('cpp', 'Citas/pub')}
                    {renderKpiCard('datasets', 'Datasets')}
                  </div>
                </div>
                <p className="researcher-provenance">{OPENALEX_METRICS_UNIVERSE_NOTE}</p>
                {provenanceNote && <p className="researcher-provenance">{provenanceNote}</p>}

                {datasetsExpanded && sortedAuthorDatasets.length > 0 && (
                  <div
                    id="researcher-datasets-panel"
                    className="researcher-datasets-panel"
                    role="region"
                    aria-label={`Datasets del investigador (${sortedAuthorDatasets.length})`}
                  >
                    {sortedAuthorDatasets.map((ds) => (
                      <WorkCard
                        key={ds.openalex_id}
                        ds={ds}
                        variant="dataset"
                        onOpenResearcher={handleOpenResearcherFromWork}
                        currentResearcher={selected}
                      />
                    ))}
                  </div>
                )}

                {metricDetail && MDEFS[metricDetail] && (
                  <MetricDetailPanel
                    metricKey={metricDetail}
                    md={MDEFS[metricDetail]}
                    oa={oa}
                    selected={selected}
                    METRICS={METRICS}
                    RES_METRICS={RES_METRICS}
                  />
                )}
              </section>

              <AISummaryButton
                className="researcher-ai-cta"
                label="Analizar con IA"
                panelTitle={`Análisis IA — ${selected.f} ${selected.l}`}
                fetchAnalysis={() =>
                  analyzeResearcher({
                    orcid: researcherOrcid,
                    researcherId: selected.id,
                  })
                }
                renderStructured={(data: ResearcherAnalysisStructured) => (
                  <div className="ai-researcher-analysis">
                    {[
                      ['Líneas de investigación', data.lineas_investigacion],
                      ['Fortalezas científicas', data.fortalezas_cientificas],
                      ['ODS principales', data.ods_principales],
                      ['Colaboraciones destacadas', data.colaboraciones_destacadas],
                      ['Publicaciones clave', data.publicaciones_clave],
                      ['Oportunidades de colaboración', data.oportunidades_colaboracion],
                    ].map(([title, items]) =>
                      items?.length ? (
                        <div key={String(title)} className="ai-panel__section">
                          <div className="ai-panel__heading">{title}</div>
                          <ul className="ai-panel__list">
                            {items.map((item, i) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null,
                    )}
                  </div>
                )}
              />

              <section className="researcher-section" aria-labelledby="researcher-impact-label">
                <h3 id="researcher-impact-label" className="researcher-section__label">
                  Impacto y ecosistema
                </h3>
                <div className="researcher-card researcher-impact">
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--cel-muted)', marginBottom: 6 }}>
                      Cuartiles de revistas (SJR / Scimago)
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: q1Line.muted ? NO_DATA_COLOR : 'var(--cel-texto)',
                        marginBottom: 4,
                        lineHeight: 1.5,
                      }}
                    >
                      {q1Line.text}
                      {q1Line.note && (
                        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--cel-muted)', marginLeft: 6 }}>
                          ({q1Line.note})
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: q1q2Line.muted ? NO_DATA_COLOR : 'var(--cel-muted)',
                        marginBottom: 10,
                        lineHeight: 1.5,
                      }}
                    >
                      {q1q2Line.text === QUARTILE_NO_DATA
                        ? `${q1q2Line.label}: ${QUARTILE_NO_DATA}`
                        : q1q2Line.text}
                      {q1q2Line.note && (
                        <span style={{ fontSize: 11, color: 'var(--cel-muted)', marginLeft: 6 }}>
                          ({q1q2Line.note})
                        </span>
                      )}
                    </div>
                    <div className="researcher-quartile-bar">
                      {[
                        { q: 'Q1', c: 'var(--q1)', n: qp.q1 || 0 },
                        { q: 'Q2', c: 'var(--q2)', n: qp.q2 || 0 },
                        { q: 'Q3', c: 'var(--q3)', n: qp.q3 || 0 },
                        { q: 'Q4', c: 'var(--q4)', n: qp.q4 || 0 },
                      ].map(({ q, c, n }) => {
                        const pct = qp.with_quartile ? (n / qp.with_quartile) * 100 : 0;
                        return pct > 0 ? (
                          <div
                            key={q}
                            style={{
                              width: `${pct}%`,
                              background: c,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 8,
                              fontWeight: 700,
                              color: '#fff',
                            }}
                          >
                            {pct > 3 ? q : ''}
                          </div>
                        ) : null;
                      })}
                    </div>
                    {[
                      { q: 'Q1', c: 'var(--q1)' },
                      { q: 'Q2', c: 'var(--q2)' },
                      { q: 'Q3', c: 'var(--q3)' },
                      { q: 'Q4', c: 'var(--q4)' },
                    ].map(({ q, c }) => (
                      <div key={q} className="researcher-quartile-legend">
                        <span className="researcher-quartile-legend__dot" style={{ background: c }} />
                        <strong>{q}:</strong> {qp[q.toLowerCase() as 'q1'] || 0} pub. (
                        {qp.q1_pct && q === 'Q1'
                          ? qp.q1_pct
                          : qp.with_quartile
                            ? (((qp[q.toLowerCase() as 'q1'] || 0) / qp.with_quartile) * 100).toFixed(1)
                            : 0}
                        %)
                      </div>
                    ))}
                  </div>
                  <div className="researcher-oa-box">
                    <div
                      className="researcher-oa-box__value"
                      style={{ color: oa.oaRate === null ? NO_DATA_COLOR : undefined }}
                    >
                      {oa.oaRate === null ? NO_DATA : `${oa.oaRate}%`}
                    </div>
                    <div className="researcher-oa-box__label">Open Access</div>
                  </div>
                </div>
              </section>

              {productivityTrend && trendYearCount > 0 && (
                <section className="researcher-section" aria-labelledby="researcher-trend-label">
                  <h3 id="researcher-trend-label" className="researcher-section__label">
                    Trayectoria
                  </h3>
                  <div className="researcher-card">
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--cel-muted)', marginBottom: 10 }}>
                      Publicaciones por año (últimos {trendYearCount} años)
                    </div>
                    <div className="researcher-trend">
                      {Object.entries(productivityTrend).map(([yr, n]) => {
                        const mx = Math.max(...Object.values(productivityTrend)) || 1;
                        return (
                          <div key={yr} className="researcher-trend__col">
                            <div className="researcher-trend__count">{n}</div>
                            <div
                              className="researcher-trend__bar"
                              style={{ height: Math.max(4, (n / mx) * 36) }}
                            />
                            <div className="researcher-trend__year">{yr}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          <section className="researcher-section" aria-labelledby="researcher-collab-label">
            <h3 id="researcher-collab-label" className="researcher-section__label">
              Colaboración
            </h3>
            <div className="researcher-collab-grid">
              <div className="researcher-card researcher-collab-card">
                <p className="researcher-collab-card__title">
                  Co-autores principales{' '}
                  <span className="researcher-collab-card__hint">(clic para abrir ficha)</span>
                </p>
                {op?.coAuthors?.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {op.coAuthors.slice(0, 12).map((ca, i) => {
                      const clickable = isCoAuthorClickable(ca, DATA);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (clickable) openCoAuthor(ca);
                          }}
                          className={`coauthor-chip ${clickable ? 'coauthor-chip--linked' : ''}`}
                          disabled={!clickable}
                        >
                          {ca.name} ({ca.count})
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="researcher-collab-card__empty">Sin coautores registrados en ORCID.</p>
                )}
              </div>

              {affinityList.length > 0 && (
                <div className="researcher-card researcher-collab-card">
                  <p className="researcher-collab-card__title">Investigadores afines (IA)</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {affinityList.slice(0, 8).map((af, i) => (
                      <button
                        key={i}
                        type="button"
                        className="researcher-affinity-chip"
                        onClick={() => {
                          const r2 = DATA.find((p) => cleanOrcid(p.o) === cleanOrcid(af.orcid));
                          if (r2) openResearcher(r2);
                        }}
                      >
                        {af.name} <strong>({af.score})</strong>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="researcher-section">
            <h3 className="researcher-section__title">Áreas de Investigación</h3>
            <ResearcherAreasSection
              researcher={selected}
              activeArea={modalTopic}
              onAreaClick={setModalTopic}
            />
          </section>

          <section className="researcher-section">
            <h3 className="researcher-section__title">Producción Científica</h3>
            <ResearcherPublicationsSection
              researcher={selected}
              modalTopic={modalTopic}
              onTopicChange={setModalTopic}
              onOpenResearcher={handleOpenResearcherFromWork}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

type MetricDef = {
  name: string;
  val: number | string | null;
  numVal?: number | null;
  dist?: Rdist[string];
  color: string;
  desc: string;
  calc: string;
  interpret: (v: number | null) => string;
};

function MetricDetailPanel({
  metricKey,
  md,
  oa,
  selected,
  METRICS,
  RES_METRICS,
}: {
  metricKey: MetricKey;
  md: MetricDef;
  oa: OaAuthor;
  selected: Researcher;
  METRICS: ReturnType<typeof getMetrics>;
  RES_METRICS: ReturnType<typeof getResMetrics>;
}) {
  const numV =
    md.numVal !== undefined && md.numVal !== null
      ? md.numVal
      : typeof md.val === 'string' && md.val !== NO_DATA
        ? parseFloat(md.val)
        : typeof md.val === 'number'
          ? md.val
          : null;
  const hasNum = numV !== null && !Number.isNaN(numV);
  const dist = md.dist || {};
  const pctile = hasNum ? getMetricPercentile(metricKey, numV) : null;
  const vsMedia = hasNum && dist.mean != null && dist.mean > 0 ? +(numV / dist.mean).toFixed(1) : null;
  const wc = oa?.works_count || 0;
  const cc = oa?.cited_by_count || 0;
  const rm2 = RES_METRICS[cleanOrcid(selected.o)] || {};
  const isPositive = !hasNum ? false : metricKey === 'fwci' ? numV >= 1 : numV >= (dist.median || 0);
  const panelValue =
    md.val === null || md.val === undefined
      ? NO_DATA
      : typeof md.val === 'number'
        ? md.val.toLocaleString()
        : md.val;

  return (
    <div className="metric-panel" style={{ borderColor: md.color }}>
      <div className="metric-panel__header" style={{ background: `linear-gradient(135deg,${md.color},${md.color}cc)` }}>
        <div>
          <div className="metric-panel__title">{md.name}</div>
          <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Análisis detallado de indicador bibliométrico</div>
          {KPI_PROVENANCE[metricKey] && (
            <div style={{ fontSize: 11, opacity: 0.75, marginTop: 6 }}>{KPI_PROVENANCE[metricKey]}</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="metric-panel__value" style={{ color: panelValue === NO_DATA ? NO_DATA_COLOR : undefined }}>
            {panelValue}
          </div>
        </div>
      </div>

      <div className="metric-panel__body">
        <div>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#94a3b8', fontWeight: 800, marginBottom: 10 }}>Definición</div>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: '#334155', marginBottom: 20 }}>{md.desc}</div>

          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#94a3b8', fontWeight: 800, marginBottom: 10 }}>Cálculo</div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#f8fafc', padding: '14px 16px', fontSize: 14, fontWeight: 600, color: '#475569', fontFamily: 'monospace', marginBottom: 20 }}>{md.calc}</div>

          {metricKey === 'cpp' && (
            <div style={{ marginBottom: 20, fontSize: 13, color: '#475569', lineHeight: 1.8 }}>
              Citas totales: <strong>{cc.toLocaleString()}</strong><br />
              Publicaciones totales: <strong>{wc.toLocaleString()}</strong><br />
              CPP resultante:{' '}
              <strong style={{ color: wc > 0 ? undefined : NO_DATA_COLOR }}>
                {wc > 0 ? (cc / wc).toFixed(2) : NO_DATA}
              </strong>{' '}
              citas por publicación
            </div>
          )}

          {dist.mean !== undefined && (
            <>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#94a3b8', fontWeight: 800, marginBottom: 10 }}>Benchmark institucional</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[{ l: 'Investigador', v: typeof md.val === 'number' ? md.val : numV }, { l: 'Media UTA', v: dist.mean }, { l: 'Mediana UTA', v: dist.median }, { l: 'P75 UTA', v: dist.p75 }].map(({ l, v }) => (
                  <div key={l} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', background: '#fff' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, marginBottom: 3 }}>{l}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>{typeof v === 'number' ? v.toLocaleString() : v ?? NO_DATA}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.14em', color: '#94a3b8', fontWeight: 800, marginBottom: 10 }}>Interpretación analítica</div>
          <div style={{ background: isPositive ? '#ecfdf5' : '#fef2f2', border: `1px solid ${isPositive ? '#a7f3d0' : '#fecaca'}`, borderRadius: 14, padding: '14px 16px', fontSize: 14, lineHeight: 1.5, color: isPositive ? '#065f46' : '#991b1b', marginBottom: 16 }}>
            {md.interpret(hasNum ? numV : null)}
          </div>

          {hasNum && pctile !== null && dist.max !== undefined && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 10 }}>Distribución comparativa institucional</div>
              <div style={{ position: 'relative', height: 50, marginBottom: 8 }}>
                <div style={{ position: 'absolute', top: 14, left: 0, right: 0, height: 18, borderRadius: 999, background: `linear-gradient(90deg,#e2e8f0 0%,${md.color}66 55%,${md.color} 100%)`, opacity: 0.9 }} />
                {[{ pos: 50, label: 'Mediana' }, { pos: 75, label: 'P75' }].map(({ pos }) => (
                  <div
                    key={pos}
                    style={{
                      position: 'absolute',
                      top: 12,
                      left: `${pos}%`,
                      transform: 'translateX(-50%)',
                      width: 2,
                      height: 22,
                      background: '#94a3b8',
                      opacity: 0.45,
                      borderRadius: 1,
                    }}
                  />
                ))}
                <div
                  style={{
                    position: 'absolute',
                    top: 5,
                    left: `${Math.max(0, Math.min(95, pctile))}%`,
                    width: 5,
                    height: 38,
                    borderRadius: 999,
                    background: md.color,
                    boxShadow: `0 0 0 5px ${md.color}22`,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 44,
                    left: `${Math.max(0, Math.min(95, pctile))}%`,
                    transform: 'translateX(-50%)',
                    fontSize: 12,
                    fontWeight: 900,
                    color: md.color,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {typeof md.val === 'number' ? md.val : numV}
                </div>
              </div>
              <div style={{ position: 'relative', height: 32, fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>
                <span style={{ position: 'absolute', left: 0, top: 0 }}>Min: {dist.min}</span>
                <span style={{ position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)' }}>Mediana: {dist.median}</span>
                <span style={{ position: 'absolute', left: '75%', top: 0, transform: 'translateX(-50%)' }}>P75: {dist.p75}</span>
                <span style={{ position: 'absolute', right: 0, top: 0 }}>Max: {dist.max}</span>
              </div>
            </div>
          )}

          {hasNum && dist.mean !== undefined && pctile !== null && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {pctile >= 75 && (
                  <span style={{ borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 800, background: '#f3e8ff', color: '#5b21b6', border: '1px solid #ddd6fe' }}>
                    Top {100 - pctile}% institucional
                  </span>
                )}
                {vsMedia !== null && vsMedia >= 2 && (
                  <span style={{ borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 800, background: '#f3e8ff', color: '#5b21b6', border: '1px solid #ddd6fe' }}>
                    {vsMedia}× sobre la media UTA
                  </span>
                )}
                <span style={{ borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 800, background: '#f3e8ff', color: '#5b21b6', border: '1px solid #ddd6fe' }}>
                  Percentil P{pctile}
                </span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, color: '#475569' }}>
                <strong>Distribución UTA ({METRICS.metadata?.total_researchers || 164} investigadores):</strong> Media={dist.mean}, σ={dist.std}.
                {pctile >= 90
                  ? ` Se ubica en el segmento de mayor impacto (P${pctile}).`
                  : pctile >= 75
                    ? ' Cuartil superior de la distribución.'
                    : pctile >= 50
                      ? ' Sobre la mediana institucional.'
                      : ' Bajo la mediana, con oportunidad de mejora.'}
              </div>
            </div>
          )}

          {hasNum && dist.mean !== undefined && pctile === null && (
            <div style={{ marginBottom: 16, fontSize: 13, lineHeight: 1.6, color: '#475569' }}>
              Sin datos suficientes para calcular percentil institucional.
            </div>
          )}

          <div style={{ borderLeft: `4px solid ${md.color}`, padding: '10px 12px', background: `${md.color}08`, color: '#475569', fontSize: 12, lineHeight: 1.5, borderRadius: 8 }}>
            <strong>Nota metodológica:</strong> {METHOD_NOTES[metricKey] || KPI_PROVENANCE[metricKey] || 'Interpretar en conjunto con otras métricas.'}
          </div>

          <button
            type="button"
            onClick={() => {
              downloadMetricReport({
                metricKey,
                md,
                numV: hasNum ? numV : 0,
                dist,
                pctile: pctile ?? 50,
                vsMedia: vsMedia ?? 0,
                wc,
                cc,
                name: `${selected.f} ${selected.l}`,
                dept: (selected.dp || [])[0]?.d || 'No especificada',
                fields: rm2.fields || [],
                career: rm2.career_span || {},
              });
            }}
            className="btn btn--xl btn--primary"
            style={{ marginTop: 14, boxShadow: '0 10px 22px rgba(30,58,138,0.24)' }}
          >
            📥 Descargar Análisis Completo
          </button>
        </div>
      </div>
    </div>
  );
}
