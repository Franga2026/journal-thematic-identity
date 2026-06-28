import type { ReportMetricsResult } from './reportMetrics';
import type { CollabMetrics } from './reportCollabMetrics';
import type { Work } from '../../shared/types';
import { ccName } from './ccNames';
import type { ExecutiveReportData } from './buildExecutiveReport';
import { buildObrasFull } from './reportObrasFull';

function fmtEs(n: number | null | undefined, decimals = 1): string {
  if (n == null || Number.isNaN(n)) return '—';
  return n.toFixed(decimals).replace('.', ',');
}

function fmtInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—';
  return String(Math.round(n));
}

/** Arma el payload del informe ejecutivo a partir de métricas de desempeño y colaboración. */
export function buildExecutiveReportData(
  metrics: ReportMetricsResult,
  collab: CollabMetrics,
  fullWorks: Work[] = [],
  obrasFullLabel?: string,
): Omit<ExecutiveReportData, 'figures'> {
  const periodoColab =
    collab.periodo.from != null && collab.periodo.to != null
      ? `${collab.periodo.from} – ${collab.periodo.to}`
      : '—';

  const label =
    obrasFullLabel ?? `período ${metrics.periodo_inicio}–${metrics.periodo_fin}`;

  return {
    meta: {
      nombre_investigador: metrics.nombre_investigador,
      unidad: metrics.unidad,
      orcid: metrics.orcid,
      periodo_inicio: String(metrics.periodo_inicio),
      periodo_fin: String(metrics.periodo_fin),
      fecha_snapshot: metrics.fecha_snapshot,
    },
    desempeno: {
      n_pubs: fmtInt(metrics.n_pubs),
      fwci_global: metrics.fwci_global != null ? fmtEs(metrics.fwci_global, 1) : '—',
      fwci_pct: metrics.fwci_pct != null ? fmtInt(metrics.fwci_pct) : '—',
      cpp: metrics.cpp != null ? fmtEs(metrics.cpp, 1) : '—',
      h_index: fmtInt(metrics.h_index),
      pct_q1: metrics.pct_q1 != null ? fmtEs(metrics.pct_q1, 0) : '—',
      cagr: metrics.cagr != null ? fmtEs(metrics.cagr, 1) : '—',
      area_top: metrics.area_top,
      pct_area_top: fmtEs(metrics.pct_area_top, 0),
      area_2: metrics.area_2,
      pct_area_2: fmtEs(metrics.pct_area_2, 0),
    },
    obras: metrics.obras.map((o) => ({
      anio: String(o.anio),
      titulo: o.titulo,
      revista: o.revista,
      cuartil: o.cuartil,
      citas: String(o.citas),
      fwci: o.fwci,
    })),
    colab: {
      periodo: periodoColab,
      n_obras: fmtInt(collab.n_clasificables),
      intl_pct: fmtEs(collab.pct_colab_intl, 1),
      intl_n: fmtInt(collab.colaboracion.internacional.n),
      nac_pct: fmtEs(collab.colaboracion.nacional.pct, 1),
      nac_n: fmtInt(collab.colaboracion.nacional.n),
      inst_pct: fmtEs(collab.colaboracion.institucional.pct, 1),
      inst_n: fmtInt(collab.colaboracion.institucional.n),
      n_paises: collab.n_paises,
      paises_colaboradores: collab.paises_colaboradores,
      top10_pct: fmtEs(collab.excelencia.top10.pct, 1),
      top10_n: fmtInt(collab.excelencia.top10.n),
      top10_base: fmtInt(collab.excelencia.obras_con_percentil),
      top1_pct: fmtEs(collab.excelencia.top1.pct, 1),
      top1_n: fmtInt(collab.excelencia.top1.n),
      empresa_n: fmtInt(collab.intersectorial_obras.company),
      gob_n: fmtInt(collab.intersectorial_obras.government),
      fac_n: fmtInt(collab.intersectorial_obras.facility),
      salud_n: fmtInt(collab.intersectorial_obras.healthcare),
      coautores: collab.top_coautores.map((c) => ({
        nombre: c.nombre || '—',
        pais: c.pais ? ccName(c.pais) : '—',
        inst: c.institucion || '—',
        n: c.n_obras,
      })),
    },
    obras_full: fullWorks.length ? buildObrasFull(fullWorks) : undefined,
    obras_full_label: fullWorks.length ? label : undefined,
  };
}
