import type { ReportMetricsResult } from './reportMetrics';
import type { CollabMetrics } from './reportCollabMetrics';
import { ccName } from './ccNames';

const QUICKCHART_URL = 'https://quickchart.io/chart';
const ACCENT = '#05607D';
const ACCENT2 = '#087EA4';
const GREEN = '#15803D';
const MUTED = '#5D7280';

async function fetchChartPng(chart: object, width = 640, height = 360): Promise<Buffer> {
  const res = await fetch(QUICKCHART_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chart,
      width,
      height,
      backgroundColor: 'white',
      format: 'png',
    }),
  });
  if (!res.ok) {
    throw new Error(`QuickChart error ${res.status}: ${res.statusText}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

export interface ReportFigures {
  fig_produccion: Buffer;
  fig_areas: Buffer;
  fig_cuartiles: Buffer;
  fig_colab_tipo: Buffer;
  fig_colab_paises: Buffer;
  fig_colab_intersectorial: Buffer;
}

export async function buildReportFigures(
  metrics: ReportMetricsResult,
  collab: CollabMetrics,
): Promise<ReportFigures> {
  const years = metrics.prod_por_anio.map((p) => String(p.anio));
  const counts = metrics.prod_por_anio.map((p) => p.count);

  const fig_produccion = await fetchChartPng({
    type: 'bar',
    data: {
      labels: years,
      datasets: [{ label: 'Publicaciones', data: counts, backgroundColor: ACCENT }],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: `Producción anual (${metrics.periodo_inicio}–${metrics.periodo_fin}) · CAGR: ${metrics.cagr_label}`,
          color: MUTED,
          font: { size: 14 },
        },
        legend: { display: false },
      },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });

  const topAreas = metrics.prod_por_area.slice(0, 6);
  const fig_areas = await fetchChartPng(
    {
      type: 'horizontalBar',
      data: {
        labels: topAreas.map((a) => a.area),
        datasets: [{ label: '% del total', data: topAreas.map((a) => a.pct), backgroundColor: ACCENT2 }],
      },
      options: {
        indexAxis: 'y',
        plugins: {
          title: {
            display: true,
            text: 'Distribución por área temática (%)',
            color: MUTED,
            font: { size: 14 },
          },
          legend: { display: false },
        },
        scales: {
          x: { max: 100, ticks: { callback: (v: number) => `${v}%` } },
        },
      },
    },
    640,
    Math.max(280, topAreas.length * 48 + 80),
  );

  const { Q1, Q2, Q3, Q4 } = metrics.dist_cuartiles;
  const fig_cuartiles = await fetchChartPng({
    type: 'bar',
    data: {
      labels: ['Q1', 'Q2', 'Q3', 'Q4'],
      datasets: [
        {
          label: 'Obras',
          data: [Q1, Q2, Q3, Q4],
          backgroundColor: ['#dc2626', '#f59e0b', '#F97316', '#888888'],
        },
      ],
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: 'Distribución por cuartil SJR (Scimago)',
          color: MUTED,
          font: { size: 14 },
        },
        legend: { display: false },
      },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });

  const { internacional, nacional, institucional } = collab.colaboracion;
  const fig_colab_tipo = await fetchChartPng(
    {
      type: 'doughnut',
      data: {
        labels: ['Internacional', 'Nacional', 'Institucional'],
        datasets: [
          {
            data: [internacional.n, nacional.n, institucional.n],
            backgroundColor: [ACCENT, ACCENT2, '#CFE8F6'],
          },
        ],
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: 'Tipo de colaboración (trayectoria completa)',
            color: MUTED,
            font: { size: 14 },
          },
          legend: { position: 'bottom' },
        },
      },
    },
    520,
    288,
  );

  const topPaises = collab.paises_colaboradores.slice(0, 12);
  const fig_colab_paises = await fetchChartPng(
    {
      type: 'horizontalBar',
      data: {
        labels: topPaises.map((p) => ccName(p.cc)),
        datasets: [{ label: 'Obras', data: topPaises.map((p) => p.n), backgroundColor: ACCENT }],
      },
      options: {
        indexAxis: 'y',
        plugins: {
          title: {
            display: true,
            text: 'Países colaboradores (top 12)',
            color: MUTED,
            font: { size: 14 },
          },
          legend: { display: false },
        },
        scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    },
    500,
    Math.max(292, topPaises.length * 28 + 80),
  );

  const sectorLabels: Record<string, string> = {
    government: 'Gobierno',
    facility: 'Centros I+D',
    healthcare: 'Salud',
    company: 'Empresa',
    education: 'Educación',
    nonprofit: 'Sin fines de lucro',
  };
  const sectorKeys = ['government', 'facility', 'healthcare', 'company', 'education', 'nonprofit'] as const;
  const sectorData = sectorKeys.map((k) => collab.intersectorial_obras[k] ?? 0);
  const fig_colab_intersectorial = await fetchChartPng(
    {
      type: 'bar',
      data: {
        labels: sectorKeys.map((k) => sectorLabels[k]),
        datasets: [{ label: 'Obras', data: sectorData, backgroundColor: [ACCENT, ACCENT2, GREEN, '#64748b', '#94a3b8', '#cbd5e1'] }],
      },
      options: {
        plugins: {
          title: {
            display: true,
            text: 'Colaboración intersectorial (obras)',
            color: MUTED,
            font: { size: 14 },
          },
          legend: { display: false },
        },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
      },
    },
    540,
    260,
  );

  return {
    fig_produccion,
    fig_areas,
    fig_cuartiles,
    fig_colab_tipo,
    fig_colab_paises,
    fig_colab_intersectorial,
  };
}
