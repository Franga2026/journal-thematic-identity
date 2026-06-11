#!/usr/bin/env node
/**
 * Genera src/services/report/templates/informe-fase1.docx (plantilla docxtemplater).
 * Ejecutar: node scripts/build-informe-template.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import PizZip from 'pizzip';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'src', 'services', 'report', 'templates', 'informe-fase1.docx');

function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function p(text, bold = false) {
  const rPr = bold ? '<w:rPr><w:b/></w:rPr>' : '';
  return `<w:p><w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}

function imgPlaceholder(tag) {
  return `<w:p><w:r><w:t>{{${tag}}}</w:t></w:r></w:p>`;
}

const body = [
  p('INFORME EJECUTIVO DE INVESTIGACIÓN', true),
  p('CRIS Victoria — Universidad de Tarapacá', true),
  p(''),
  p('Investigador: {{nombre_investigador}}'),
  p('Unidad: {{unidad}}'),
  p('ORCID: {{orcid}}'),
  p('Período de análisis: {{periodo_inicio}} – {{periodo_fin}}'),
  p('Fecha de snapshot OpenAlex: {{fecha_snapshot}}'),
  p(''),
  p('RESUMEN EJECUTIVO', true),
  p(
    'En el período {{periodo_inicio}}–{{periodo_fin}}, el investigador registró {{n_pubs}} publicaciones indexadas, con un índice h de {{h_index}} y {{fwci_pct_label}} (FWCI medio {{fwci_global}}). Las citas por publicación fueron {{cpp}}; el {{pct_q1}}% de las obras con cuartil reconocido están en Q1. La producción creció a un ritmo de {{cagr_label}}. Las áreas dominantes son {{area_top}} ({{pct_area_top}}%) y {{area_2}} ({{pct_area_2}}%). Indicadores de fase 2 no disponibles: top 10% citas ({{pct_top10}}), colaboración internacional ({{pct_colab_intl}}).',
  ),
  p(''),
  p('1. PRODUCCIÓN CIENTÍFICA', true),
  p('1.1 Evolución de la producción anual'),
  imgPlaceholder('%fig_produccion'),
  p(''),
  p('1.2 Distribución por área temática'),
  imgPlaceholder('%fig_areas'),
  p(''),
  p('1.6 Cuartiles de revistas (SJR / Scimago)'),
  imgPlaceholder('%fig_cuartiles'),
  p(''),
  p('Tabla 1.1 — Obras más citadas del período', true),
  `<w:tbl>
    <w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>
    <w:tr>
      <w:tc>${p('Título')}</w:tc>
      <w:tc>${p('Año')}</w:tc>
      <w:tc>${p('Revista')}</w:tc>
      <w:tc>${p('Cuartil')}</w:tc>
      <w:tc>${p('Citas')}</w:tc>
      <w:tc>${p('FWCI')}</w:tc>
    </w:tr>
    <w:tr>
      <w:tc><w:p><w:r><w:t>{{#obras}}{{titulo}} — {{doi_url}}</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>{{anio}}</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>{{revista}}</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>{{cuartil}}</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>{{citas}}</w:t></w:r></w:p></w:tc>
      <w:tc><w:p><w:r><w:t>{{fwci}}{{/obras}}</w:t></w:r></w:p></w:tc>
    </w:tr>
  </w:tbl>`,
  p(''),
  p('APÉNDICE A — METODOLOGÍA Y FUENTES', true),
  p(
    'Fuentes: OpenAlex (métricas de obra y autor), Scimago Journal Rank 2025 (cuartiles por ISSN), directorio UTA (data.json). FWCI: media de obras elegibles (excluye año en curso). Período adaptativo de 5 años con guarda de densidad mínima (5 publicaciones). Figuras generadas con QuickChart.',
  ),
].join('');

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;

const zip = new PizZip();
zip.file(
  '[Content_Types].xml',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
);
zip.file(
  '_rels/.rels',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
);
zip.file('word/document.xml', documentXml);
zip.file(
  'word/_rels/document.xml.rels',
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`,
);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log(`Plantilla escrita: ${OUT}`);
