import type { ReportMetricsResult } from './reportMetrics';

const QUICKCHART_URL = 'https://quickchart.io/chart';
const ACCENT = '#1e3a8a';
const MUTED = '#64748b';

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
}

export async function buildReportFigures(metrics: ReportMetricsResult): Promise<ReportFigures> {
  const years = metrics.prod_por_anio.map((p) => String(p.anio));
  const counts = metrics.prod_por_anio.map((p) => p.count);

  const fig_produccion = await fetchChartPng({
    type: 'bar',
    data: {
      labels: years,
      datasets: [
        {
          label: 'Publicaciones',
          data: counts,
          backgroundColor: ACCENT,
        },
      ],
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
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
      },
    },
  });

  const topAreas = metrics.prod_por_area.slice(0, 6);
  const fig_areas = await fetchChartPng(
    {
      type: 'horizontalBar',
      data: {
        labels: topAreas.map((a) => a.area),
        datasets: [
          {
            label: '% del total',
            data: topAreas.map((a) => a.pct),
            backgroundColor: '#3b82f6',
          },
        ],
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

  return { fig_produccion, fig_areas, fig_cuartiles };
}
