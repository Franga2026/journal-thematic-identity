/**
 * Export utilities for generating reports in Excel, PDF, and PowerPoint formats.
 * Uses dynamic imports to avoid bundling heavy libraries for users who don't export.
 */

export async function exportExcel(data, inst, aw) {
  try {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    const summary = [
      ['INFORME BIBLIOMÉTRICO - Universidad de Tarapacá'],
      ['Fecha', new Date().toLocaleDateString('es-CL')],
      ['Fuente', 'OpenAlex API'],
      [],
      ['Indicador', 'Valor'],
      ['Publicaciones Totales', inst.works_count || 0],
      ['Citas Totales', inst.cited_by_count || 0],
      ['H-index', inst.h_index || 0],
      ['Investigadores', data.length],
      ['Con ORCID', data.filter((r) => r.o).length],
      ['Open Access', aw.filter((w) => w.oa).length],
      ['% Open Access', Math.round((aw.filter((w) => w.oa).length / aw.length) * 100) + '%'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), 'Resumen');

    // Sheet 2: Areas
    const fields = {};
    aw.forEach((w) => { if (w.field) fields[w.field] = (fields[w.field] || 0) + 1; });
    const yrs = [...new Set(aw.map((w) => w.y).filter(Boolean))].sort();
    const areasHeader = ['Área', ...yrs.slice(-6), 'Total'];
    const areasRows = Object.entries(fields)
      .sort((a, b) => b[1] - a[1])
      .map(([f, t]) => {
        const row = [f];
        yrs.slice(-6).forEach((y) => row.push(aw.filter((w) => w.y === y && w.field === f).length));
        row.push(t);
        return row;
      });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([areasHeader, ...areasRows]), 'Áreas');

    // Sheet 3: Researchers
    const { getAuthorsOA } = await import('./dataProcessing');
    const authors = getAuthorsOA();
    const invHeader = ['Nombre', 'Departamento', 'ORCID', 'Publicaciones', 'Citas', 'H-index'];
    const invRows = data
      .filter((r) => r.o)
      .map((r) => {
        const oa = authors[r.o.trim()];
        return [r.f + ' ' + r.l, (r.dp || [])[0]?.d || '', r.o, oa?.works_count || 0, oa?.cited_by_count || 0, oa?.h_index || 0];
      })
      .sort((a, b) => b[4] - a[4]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([invHeader, ...invRows]), 'Investigadores');

    // Sheet 4: Publications
    const pubHeader = ['Título', 'Año', 'Revista', 'Citas', 'Área', 'Cuartil', 'Open Access', 'DOI'];
    const pubRows = aw.slice(0, 5000).map((w) => [
      (w.t || '').replace(/<[^>]*>/g, ''), w.y, w.s, w.c, w.field || '', w.qi || '', w.oa ? 'Sí' : 'No', w.d || '',
    ]);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([pubHeader, ...pubRows]), 'Publicaciones');

    // Sheet 5: Open Access
    const oaHeader = ['Año', 'Total', 'Open Access', '% OA'];
    const oaRows = yrs.slice(-8).map((y) => {
      const yw = aw.filter((w) => w.y === y);
      const oaCnt = yw.filter((w) => w.oa).length;
      return [y, yw.length, oaCnt, yw.length ? Math.round((oaCnt / yw.length) * 100) + '%' : '0%'];
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([oaHeader, ...oaRows]), 'Open Access');

    XLSX.writeFile(wb, `Informe_Bibliometrico_UTA_${new Date().getFullYear()}.xlsx`);
  } catch (err) {
    console.error('Error exportando Excel:', err);
    alert('Error al generar el archivo Excel. Intente nuevamente.');
  }
}

export function exportPDF() {
  window.print();
}

export async function exportPPTX(data, inst, aw) {
  try {
    const PptxGenJS = (await import('pptxgenjs')).default;
    const prs = new PptxGenJS();
    prs.layout = 'LAYOUT_WIDE';

    const { getAuthorsOA } = await import('./dataProcessing');
    const authors = getAuthorsOA();

    // Slide 1: Title
    let slide = prs.addSlide();
    slide.background = { fill: '0f172a' };
    slide.addText('Universidad de Tarapacá', { x: 0.8, y: 0.5, w: 10, fontSize: 14, color: '93c5fd', fontFace: 'Arial' });
    slide.addText('Informe Bibliométrico', { x: 0.8, y: 1.2, w: 10, fontSize: 36, bold: true, color: 'FFFFFF', fontFace: 'Arial' });
    slide.addText(`Indicadores Cienciométricos ${new Date().getFullYear()}`, { x: 0.8, y: 2.2, w: 10, fontSize: 18, color: 'e2e8f0', fontFace: 'Arial' });
    slide.addText('Fuente: OpenAlex API', { x: 0.8, y: 4.5, w: 10, fontSize: 12, color: '94a3b8', fontFace: 'Arial' });

    // Slide 2: Key metrics
    slide = prs.addSlide();
    slide.addText('Indicadores Principales', { x: 0.5, y: 0.3, w: 10, fontSize: 24, bold: true, color: 'dc2626', fontFace: 'Arial' });
    const metrics = [
      { v: (inst.works_count || 0).toLocaleString(), l: 'Publicaciones' },
      { v: (inst.cited_by_count || 0).toLocaleString(), l: 'Citas' },
      { v: String(inst.h_index || 0), l: 'H-index' },
      { v: Math.round((aw.filter((w) => w.oa).length / aw.length) * 100) + '%', l: 'Open Access' },
    ];
    metrics.forEach((m, i) => {
      const x = 0.5 + i * 3;
      slide.addShape(prs.ShapeType.roundRect, { x, y: 1.2, w: 2.7, h: 1.8, fill: { color: 'f8fafc' }, line: { color: 'e2e8f0', width: 1 }, rectRadius: 0.1 });
      slide.addText(m.v, { x, y: 1.4, w: 2.7, h: 1, fontSize: 36, bold: true, color: '1e3a8a', align: 'center', fontFace: 'Arial' });
      slide.addText(m.l, { x, y: 2.3, w: 2.7, h: 0.5, fontSize: 12, color: '64748b', align: 'center', fontFace: 'Arial' });
    });

    // Slide 3: Areas table
    slide = prs.addSlide();
    slide.addText('Producción por Áreas de Investigación', { x: 0.5, y: 0.3, w: 10, fontSize: 24, bold: true, color: 'dc2626', fontFace: 'Arial' });
    const fields = {};
    aw.forEach((w) => { if (w.field) fields[w.field] = (fields[w.field] || 0) + 1; });
    const fl = Object.entries(fields).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const tblRows = [
      [
        { text: 'Área', options: { bold: true, fill: { color: '1e3a8a' }, color: 'FFFFFF', fontSize: 11 } },
        { text: 'Publicaciones', options: { bold: true, fill: { color: '1e3a8a' }, color: 'FFFFFF', fontSize: 11 } },
        { text: '%', options: { bold: true, fill: { color: '1e3a8a' }, color: 'FFFFFF', fontSize: 11 } },
      ],
      ...fl.map(([f, c]) => [
        { text: f, options: { fontSize: 10 } },
        { text: c.toLocaleString(), options: { fontSize: 10, align: 'center' } },
        { text: Math.round((c / aw.length) * 100) + '%', options: { fontSize: 10, align: 'center' } },
      ]),
    ];
    slide.addTable(tblRows, { x: 0.5, y: 1.0, w: 11, colW: [6, 2.5, 2.5], border: { type: 'solid', pt: 0.5, color: 'e2e8f0' } });

    // Slide 4: Top researchers
    slide = prs.addSlide();
    slide.addText('Top 10 Investigadores por Citaciones', { x: 0.5, y: 0.3, w: 10, fontSize: 24, bold: true, color: 'dc2626', fontFace: 'Arial' });
    const topA = data
      .filter((r) => r.o)
      .map((r) => {
        const oa = authors[r.o.trim()];
        return { n: r.f + ' ' + r.l, cc: oa?.cited_by_count || 0, wc: oa?.works_count || 0, hi: oa?.h_index || 0 };
      })
      .sort((a, b) => b.cc - a.cc)
      .slice(0, 10);
    const topRows = [
      [
        { text: '#', options: { bold: true, fill: { color: '1e3a8a' }, color: 'FFFFFF', fontSize: 10 } },
        { text: 'Investigador', options: { bold: true, fill: { color: '1e3a8a' }, color: 'FFFFFF', fontSize: 10 } },
        { text: 'Pub.', options: { bold: true, fill: { color: '1e3a8a' }, color: 'FFFFFF', fontSize: 10 } },
        { text: 'Citas', options: { bold: true, fill: { color: '1e3a8a' }, color: 'FFFFFF', fontSize: 10 } },
        { text: 'H-index', options: { bold: true, fill: { color: '1e3a8a' }, color: 'FFFFFF', fontSize: 10 } },
      ],
      ...topA.map((a, i) => [
        { text: String(i + 1), options: { fontSize: 10 } },
        { text: a.n, options: { fontSize: 10 } },
        { text: a.wc.toLocaleString(), options: { fontSize: 10, align: 'center' } },
        { text: a.cc.toLocaleString(), options: { fontSize: 10, align: 'center', bold: true, color: 'dc2626' } },
        { text: String(a.hi), options: { fontSize: 10, align: 'center' } },
      ]),
    ];
    slide.addTable(topRows, { x: 0.5, y: 1.0, w: 11, colW: [0.8, 5, 1.5, 2, 1.7], border: { type: 'solid', pt: 0.5, color: 'e2e8f0' } });

    prs.writeFile({ fileName: `Informe_Bibliometrico_UTA_${new Date().getFullYear()}.pptx` });
  } catch (err) {
    console.error('Error exportando PPTX:', err);
    alert('Error al generar la presentación. Intente nuevamente.');
  }
}
