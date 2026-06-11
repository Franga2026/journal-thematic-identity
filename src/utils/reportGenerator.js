/**
 * Generates a downloadable HTML report for a researcher's metric analysis.
 * Extracted from the original inline template for maintainability.
 */

const METRIC_NAMES = {
  cpp: 'Citations per Publication (CPP)',
  fwci: 'Field Normalized Citation Impact (FNCI)',
  h_index: 'h-index',
  output: 'Scholarly Output',
  cites: 'Citation Count',
  oa_rate: 'Open Access Rate',
};

const METRIC_SUBTITLES = {
  cpp: 'Impacto promedio de citación por publicación científica',
  fwci: 'Indicador normalizado de impacto por disciplina, año y tipo documental',
  h_index: 'Indicador combinado de productividad e impacto científico',
  output: 'Volumen de producción científica indexada',
  cites: 'Acumulación total de citas recibidas',
  oa_rate: 'Proporción de publicaciones en acceso abierto',
};

export function downloadMetricReport({ metricKey, md, numV, dist, pctile, vsMedia, wc, cc, name, dept, fields, career }) {
  const val = typeof md.val === 'number' ? md.val : numV;
  const cppVal = wc > 0 ? (cc / wc).toFixed(2) : 0;
  const vsM = dist.mean > 0 ? (val / dist.mean).toFixed(1) : 0;
  const markerPos = dist.max > dist.min ? Math.max(2, Math.min(96, ((val - dist.min) / (dist.max - dist.min)) * 100)) : 50;
  const medianPos = dist.max > dist.min ? ((dist.median - dist.min) / (dist.max - dist.min)) * 100 : 50;
  const p75Pos = dist.max > dist.min ? ((dist.p75 - dist.min) / (dist.max - dist.min)) * 100 : 75;
  const metricName = METRIC_NAMES[metricKey] || md.name;
  const metricSub = METRIC_SUBTITLES[metricKey] || '';

  const getMethodNote = () => {
    if (metricKey === 'cpp') return 'CPP no incorpora normalización por disciplina, puede verse influenciado por diferencias entre áreas científicas. Se recomienda interpretar junto con FNCI y percentiles.';
    if (metricKey === 'fwci') return 'FNCI normaliza por campo, año y tipo documental. Un valor de 1.0 es el promedio mundial exacto. El FWCI excluye las obras del año en curso por ventana de citación incompleta; el indicador no es interpretable hasta acumular citas. Las citas absolutas y el conteo de obras sí incluyen el año en curso. Se recomienda complementar con h-index y CPP.';
    if (metricKey === 'h_index') return 'El h-index favorece carreras largas, áreas con alta densidad de citación. Para comparar impacto entre disciplinas, use FNCI.';
    return 'Este indicador debe interpretarse en conjunto con otras métricas bibliométricas para una evaluación integral.';
  };

  const getDataBox = () => {
    if (metricKey === 'cpp') return `<div class="data-box"><strong>Datos:</strong><br>Citas: <strong>${cc.toLocaleString()}</strong> · Publicaciones: <strong>${wc.toLocaleString()}</strong> · CPP: <strong>${cppVal}</strong></div>`;
    if (metricKey === 'h_index') return `<div class="data-box"><strong>Interpretación:</strong> h-index = ${val} → <strong>${val} publicaciones con ≥${val} citas cada una</strong>.</div>`;
    if (metricKey === 'fwci') return `<div class="data-box"><strong>Interpretación:</strong> FNCI = ${val} → publicaciones reciben ${val >= 1 ? ((val - 1) * 100).toFixed(0) + '% más' : ((1 - val) * 100).toFixed(0) + '% menos'} citas que el promedio mundial.</div>`;
    return `<div class="data-box"><strong>Valor:</strong> ${typeof md.val === 'number' ? md.val.toLocaleString() : md.val}</div>`;
  };

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Análisis ${metricName} - ${name}</title>
<style>:root{--azul-profundo:#123a5a;--azul:#1f5d7a;--azul-suave:#eaf3f8;--gris-texto:#2d3748;--gris-linea:#dbe5ee;--verde:#0f766e;--verde-bg:#e9fbf5;--morado:#5b21b6;--morado-bg:#efe7ff;--naranja:#b45309;--naranja-bg:#fff7ed;--blanco:#fff;--radio:26px}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#f5f8fb,#edf3f7);font-family:Inter,system-ui,sans-serif;color:var(--gris-texto);padding:28px}
.card{width:min(1240px,100%);background:var(--blanco);border-radius:var(--radio);border:2px solid rgba(31,93,122,0.24);box-shadow:0 22px 55px rgba(18,58,90,0.16);overflow:hidden}
.hero{background:linear-gradient(135deg,#164461,#2f718b 56%,#6d98aa);color:white;padding:34px 44px;display:grid;grid-template-columns:1fr auto;gap:28px;align-items:center}
.hero h1{margin:0 0 8px;font-size:clamp(34px,4vw,54px);line-height:1;letter-spacing:-0.04em;font-weight:900}.hero p{margin:0;font-size:19px;color:rgba(255,255,255,0.88)}
.score{text-align:right;min-width:230px}.score .number{font-size:clamp(70px,9vw,112px);font-weight:900;letter-spacing:-0.08em;line-height:0.85}
.score .caption{margin-top:12px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.76)}
.meta{padding:16px 44px;background:#f1f5f9;border-bottom:1px solid #dbe5ee;font-size:14px;color:#475569;display:flex;gap:32px;flex-wrap:wrap}
.meta strong{color:#1e293b}
.content{padding:40px 44px 44px;display:grid;grid-template-columns:0.95fr 1.05fr;gap:44px}
.label{font-size:13px;letter-spacing:0.14em;text-transform:uppercase;font-weight:800;color:#94a3b8;margin:0 0 12px}
.definition{font-size:18px;line-height:1.55;margin:0 0 24px;color:#334155}
.formula-box{background:#f8fafc;border:1px solid var(--gris-linea);border-radius:18px;padding:20px 24px;font-family:ui-monospace,monospace;font-size:16px;line-height:1.45;font-weight:700;color:#425066;margin-bottom:24px}
.data-box{background:#f0f9ff;border:1px solid #bae6fd;border-radius:14px;padding:16px 20px;margin-bottom:24px;font-size:15px;line-height:1.7;color:#0c4a6e}
.metrics-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px}
.metric-box{border:1px solid var(--gris-linea);border-radius:16px;padding:16px 18px;background:linear-gradient(180deg,white,#fbfdff)}
.metric-box span{display:block;color:#8a9bb2;font-weight:800;font-size:13px;margin-bottom:5px}.metric-box strong{display:block;font-size:26px;line-height:1;color:#111827}
.insight{background:var(--verde-bg);border:1px solid #99f6d7;border-left:8px solid var(--verde);border-radius:20px;padding:20px 24px;font-size:18px;line-height:1.5;color:#065f56;margin-bottom:24px}
.insight-warn{background:#fef2f2;border:1px solid #fecaca;border-left:8px solid #dc2626;border-radius:20px;padding:20px 24px;font-size:18px;line-height:1.5;color:#991b1b;margin-bottom:24px}
.badges{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px}
.badge{padding:9px 15px;border-radius:999px;font-weight:900;font-size:14px;background:var(--morado-bg);color:var(--morado);border:1px solid #d8c6ff}
.badge.orange{color:var(--naranja);background:var(--naranja-bg);border-color:#fed7aa}
.chart-wrap{background:#f8fbfd;border:1px solid var(--gris-linea);border-radius:20px;padding:22px;margin-bottom:24px}
.chart-title{margin:0 0 18px;font-weight:900;font-size:16px;color:#344054}
.boxplot{position:relative;height:100px;margin:8px 4px 0}
.axis{position:absolute;left:0;right:0;top:40px;height:14px;border-radius:999px;background:linear-gradient(90deg,#dde6ef,#b4cbd7,#2f718b)}
.iqr{position:absolute;left:${medianPos}%;width:${p75Pos - medianPos}%;top:30px;height:34px;background:rgba(31,93,122,0.18);border:2px solid rgba(31,93,122,0.44);border-radius:10px}
.marker{position:absolute;top:20px;width:7px;height:54px;border-radius:999px;transform:translateX(-50%)}
.marker.researcher{left:${markerPos}%;background:var(--azul-profundo);box-shadow:0 0 0 7px rgba(31,93,122,0.12)}
.marker.median{left:${medianPos}%;height:40px;top:25px;background:#7c8da3;box-shadow:none}
.marker.p75{left:${p75Pos}%;height:40px;top:25px;background:#7c8da3;box-shadow:none}
.researcher-tag{position:absolute;left:${markerPos}%;transform:translateX(-50%);top:0;color:var(--azul-profundo);font-weight:950;font-size:15px;white-space:nowrap}
.ticks{position:absolute;left:0;right:0;top:78px;display:flex;justify-content:space-between;font-size:12px;color:#8391a7;font-weight:800}
.analysis-text{font-size:16px;line-height:1.6;margin:0 0 20px;color:#334155}
.warning{background:#f8fafc;border-left:7px solid var(--azul);border-radius:16px;padding:18px 20px;line-height:1.5;font-size:15px;color:#415068;margin-bottom:22px}
.complements{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px}
.complement{background:var(--azul-suave);border:1px solid #c8dcea;border-radius:15px;padding:14px}
.complement span{display:block;color:#63758d;font-size:11px;text-transform:uppercase;font-weight:900;letter-spacing:0.08em;margin-bottom:6px}
.complement strong{font-size:20px;color:var(--azul-profundo)}
h2{color:#1e3a5a;font-size:20px;margin:32px 0 14px;padding-bottom:8px;border-bottom:2px solid #e2e8f0}
.footer-note{border-top:1px solid var(--gris-linea);padding:20px 44px 28px;display:flex;justify-content:space-between;gap:20px;align-items:center;color:#708196;font-size:13px}
@media(max-width:900px){.hero,.content{grid-template-columns:1fr}.content{gap:24px;padding:30px 24px}.hero{padding:30px 24px}.metrics-grid,.complements{grid-template-columns:1fr}.meta{flex-direction:column;gap:8px}}
@media print{body{background:white;padding:0}.card{box-shadow:none;border:none}}
</style></head><body>
<main class="card">
<header class="hero">
<div><h1>${metricName}</h1><p>${metricSub}</p></div>
<div class="score"><div class="number">${typeof md.val === 'number' ? md.val.toLocaleString() : md.val}</div>
<div class="caption">${pctile >= 90 ? 'alto impacto' : pctile >= 75 ? 'sobre promedio' : pctile >= 50 ? 'nivel medio' : 'en desarrollo'}</div></div>
</header>
<div class="meta">
<div><strong>Investigador:</strong> ${name}</div>
<div><strong>Unidad:</strong> ${dept}</div>
<div><strong>Campos:</strong> ${fields.slice(0, 3).join(', ') || 'No identificados'}</div>
<div><strong>Carrera:</strong> ${career.first || '?'}-${career.last || '?'} (${career.years || 0} años)</div>
<div><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-CL')}</div>
</div>
<section class="content">
<div>
<h2>1. Resumen Ejecutivo</h2>
<p class="analysis-text">Análisis del desempeño científico del investigador <strong>${name}</strong> de la <strong>${dept}</strong>, Universidad de Tarapacá, mediante indicadores bibliométricos.</p>
<h2>2. Indicadores Bibliométricos</h2>
<div class="metrics-grid">
<div class="metric-box"><span>Publicaciones</span><strong>${wc.toLocaleString()}</strong></div>
<div class="metric-box"><span>Citas totales</span><strong>${cc.toLocaleString()}</strong></div>
<div class="metric-box"><span>Citas/Pub</span><strong>${wc > 0 ? (cc / wc).toFixed(1) : 0}</strong></div>
<div class="metric-box"><span>${metricName}</span><strong>${typeof md.val === 'number' ? md.val.toLocaleString() : md.val}</strong></div>
</div>
<p class="label">Definición</p>
<p class="definition">${md.desc}</p>
<p class="label">Cálculo</p>
<div class="formula-box">${md.calc}</div>
${getDataBox()}
<p class="label">Benchmark institucional</p>
<div class="metrics-grid">
<div class="metric-box"><span>Investigador</span><strong>${typeof md.val === 'number' ? md.val.toLocaleString() : md.val}</strong></div>
<div class="metric-box"><span>Media UTA</span><strong>${dist.mean || 'N/A'}</strong></div>
<div class="metric-box"><span>Mediana UTA</span><strong>${dist.median || 'N/A'}</strong></div>
<div class="metric-box"><span>P75 UTA</span><strong>${dist.p75 || 'N/A'}</strong></div>
</div>
</div>
<div>
<h2>3. Interpretación Analítica</h2>
<div class="${pctile >= 50 ? 'insight' : 'insight-warn'}">${md.interpret(numV)}</div>
<div class="badges">
${pctile >= 75 ? `<span class="badge">Top ${100 - pctile}% institucional</span>` : ''}
<span class="badge">Percentil P${pctile}</span>
${vsM >= 2 ? `<span class="badge orange">${vsM}× sobre la media UTA</span>` : ''}
</div>
<h2>4. Distribución Institucional</h2>
<div class="chart-wrap"><p class="chart-title">Posición en la distribución UTA</p>
<div class="boxplot"><div class="axis"></div><div class="iqr"></div>
<div class="marker median" title="Mediana: ${dist.median}"></div>
<div class="marker p75" title="P75: ${dist.p75}"></div>
<div class="researcher-tag">${typeof md.val === 'number' ? md.val : numV}</div>
<div class="marker researcher" title="Investigador: ${val}"></div>
<div class="ticks"><span>Min: ${dist.min}</span><span>Mediana: ${dist.median}</span><span>P75: ${dist.p75}</span><span>Max: ${dist.max}</span></div>
</div></div>
<h2>5. Consideraciones Metodológicas</h2>
<div class="warning"><strong>Nota metodológica:</strong> ${getMethodNote()}</div>
<h2>6. Conclusión</h2>
<p class="analysis-text">${pctile >= 75 ? `Trayectoria consolidada con impacto académico sostenido. Percentil P${pctile} confirma posicionamiento de excelencia.` : pctile >= 50 ? `Desempeño adecuado, sobre la mediana institucional, con potencial de crecimiento.` : `Oportunidades de mejora — se recomienda priorizar publicaciones de alto impacto y redes de colaboración internacional.`}</p>
</div>
</section>
<footer class="footer-note"><span>Universidad de Tarapacá · Directorio de Investigadores · Fuentes: OpenAlex, Crossref, Unpaywall, ORCID</span></footer>
</main></body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Analisis_${metricName.replace(/[^a-zA-Z0-9]/g, '_')}_${name.replace(/ /g, '_')}.html`;
  a.click();
  URL.revokeObjectURL(url);
}
