// Informe Ejecutivo completo (Portada · Resumen · Cap I · Cap II · Cap III · Apéndice) con docx-js.
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  Header,
  Footer,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
  PageNumber,
  PageBreak,
  TabStopType,
  ExternalHyperlink,
} from 'docx';
import { ccName } from './ccNames';
import { numEs } from './numEs';

const ACCENT = '05607D';
const ACCENT2 = '087EA4';
const TEXT = '123040';
const MUTED = '5D7280';
const LINE = 'CFE8F6';
const GREEN = '15803D';
const ZEBRA = 'F4FBFF';
const HEADTXT = 'FFFFFF';
const CW = 9360;

export interface ExecutiveReportMeta {
  nombre_investigador: string;
  unidad: string;
  orcid: string;
  periodo_inicio: string;
  periodo_fin: string;
  fecha_snapshot: string;
}

export interface ExecutiveReportDesempeno {
  n_pubs: string;
  fwci_global: string;
  fwci_pct: string;
  cpp: string;
  h_index: string;
  pct_q1: string;
  cagr: string;
  area_top: string;
  pct_area_top: string;
  area_2: string;
  pct_area_2: string;
}

export interface ExecutiveReportObra {
  anio: string;
  titulo: string;
  revista: string;
  cuartil: string;
  citas: string;
  fwci: string;
}

export interface ExecutiveReportColab {
  periodo: string;
  n_obras: string;
  intl_pct: string;
  intl_n: string;
  nac_pct: string;
  nac_n: string;
  inst_pct: string;
  inst_n: string;
  n_paises: number;
  paises_colaboradores: { cc: string; n: number }[];
  top10_pct: string;
  top10_n: string;
  top10_base: string;
  top1_pct: string;
  top1_n: string;
  empresa_n: string;
  gob_n: string;
  fac_n: string;
  salud_n: string;
  coautores: { nombre: string; pais: string; inst: string; n: number }[];
}

export interface ExecutiveReportObraFull {
  anio: number | string;
  titulo: string;
  revista: string;
  cuartil: string;
  citas: number;
  doi?: string;
  url?: string;
  link?: string;
}

export interface ExecutiveReportFigures {
  fig_produccion: Buffer;
  fig_areas: Buffer;
  fig_cuartiles: Buffer;
  fig_colab_tipo: Buffer;
  fig_colab_paises: Buffer;
  fig_colab_intersectorial: Buffer;
}

export interface ExecutiveReportData {
  meta: ExecutiveReportMeta;
  desempeno: ExecutiveReportDesempeno;
  obras: ExecutiveReportObra[];
  colab: ExecutiveReportColab;
  obras_full?: ExecutiveReportObraFull[];
  obras_full_label?: string;
  figures: ExecutiveReportFigures;
}

const P = (children: Paragraph['root'][], o: Record<string, unknown> = {}) =>
  new Paragraph({ children, ...o });
const run = (text: string, o: Record<string, unknown> = {}) =>
  new TextRun({ text, size: 22, color: TEXT, ...o });
const small = (t: string, c = MUTED) => new TextRun({ text: t, size: 18, color: c });
const eyebrow = (t: string) =>
  P([new TextRun({ text: t, color: ACCENT2, bold: true, size: 16, characterSpacing: 40 })], {
    spacing: { after: 60 },
  });
const h1 = (t: string) =>
  new Paragraph({
    spacing: { before: 300, after: 140 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: LINE, space: 6 } },
    children: [new TextRun({ text: t, color: ACCENT, bold: true, size: 26 })],
  });
const body = (t: string) => P([run(t, { color: TEXT })], { spacing: { after: 140, line: 300 } });
const cellBorders = (c: string) => {
  const b = { style: BorderStyle.SINGLE, size: 2, color: c };
  return { top: b, bottom: b, left: b, right: b };
};
const pageBreak = () => new Paragraph({ children: [new PageBreak()] });

function kpiCell(
  num: string | number,
  label: string,
  numColor = ACCENT,
  w = 3120,
  numSize = 40,
  lblSize = 16,
) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    margins: { top: 120, bottom: 120, left: 120, right: 120 },
    borders: cellBorders(LINE),
    shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      P([new TextRun({ text: String(num), bold: true, size: numSize, color: numColor })], {
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 },
      }),
      P([new TextRun({ text: label, size: lblSize, color: MUTED, characterSpacing: 20 })], {
        alignment: AlignmentType.CENTER,
      }),
    ],
  });
}

function kpiGrid(D: ExecutiveReportDesempeno) {
  const row = (cells: TableCell[]) => new TableRow({ children: cells });
  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: [3120, 3120, 3120],
    rows: [
      row([
        kpiCell(D.n_pubs, 'PUBLICACIONES'),
        kpiCell(D.fwci_global, 'FWCI PROMEDIO', GREEN),
        kpiCell(D.cpp, 'CITAS / PUB'),
      ]),
      row([
        kpiCell(D.h_index, 'H-INDEX'),
        kpiCell(`${D.pct_q1}%`, 'EN Q1 (SJR)'),
        kpiCell(`${D.cagr}%`, 'CAGR PRODUCCIÓN'),
      ]),
    ],
  });
}

function kpiStrip4(items: { num: string; label: string; color?: string }[]) {
  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: [2340, 2340, 2340, 2340],
    rows: [
      new TableRow({
        children: items.map((it) =>
          kpiCell(it.num, it.label, it.color || ACCENT, 2340, 36, 15),
        ),
      }),
    ],
  });
}

function tableHead(t: string, al = AlignmentType.LEFT) {
  return new TableCell({
    width: { size: 0, type: WidthType.DXA },
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    borders: cellBorders(ACCENT),
    shading: { fill: ACCENT, type: ShadingType.CLEAR },
    children: [P([new TextRun({ text: t, bold: true, size: 18, color: HEADTXT })], { alignment: al })],
  });
}

function tableCell(children: (TextRun | ExternalHyperlink)[], al = AlignmentType.LEFT, fill = 'FFFFFF') {
  return new TableCell({
    width: { size: 0, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 110, right: 110 },
    borders: cellBorders(LINE),
    shading: { fill, type: ShadingType.CLEAR },
    children: [P(children, { alignment: al })],
  });
}

/** Enlace FAIR: prioriza link explícito, luego DOI, luego url/landing. */
export function obraLink(r: ExecutiveReportObraFull): string | null {
  if (r.link) return r.link;
  if (r.doi) {
    const d = String(r.doi)
      .trim()
      .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
    return d ? `https://doi.org/${d}` : null;
  }
  return r.url || null;
}

function obrasFullTable(rows: ExecutiveReportObraFull[]) {
  const widths = [600, 4560, 2560, 760, 880];
  const head = (t: string, al = AlignmentType.LEFT) =>
    new TableCell({
      width: { size: 0, type: WidthType.DXA },
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      borders: cellBorders(ACCENT),
      shading: { fill: ACCENT, type: ShadingType.CLEAR },
      children: [P([new TextRun({ text: t, bold: true, size: 16, color: HEADTXT })], { alignment: al })],
    });
  const cell = (children: (TextRun | ExternalHyperlink)[], al = AlignmentType.LEFT, fill = 'FFFFFF') =>
    new TableCell({
      width: { size: 0, type: WidthType.DXA },
      margins: { top: 50, bottom: 50, left: 100, right: 100 },
      borders: cellBorders(LINE),
      shading: { fill, type: ShadingType.CLEAR },
      children: [P(children, { alignment: al })],
    });
  const sorted = [...rows].sort(
    (a, b) => Number(b.anio) - Number(a.anio) || Number(b.citas) - Number(a.citas),
  );
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      head('Año', AlignmentType.CENTER),
      head('Título'),
      head('Revista'),
      head('SJR', AlignmentType.CENTER),
      head('Citas', AlignmentType.CENTER),
    ],
  });
  const dataRows = sorted.map((r, i) => {
    const fill = i % 2 ? ZEBRA : 'FFFFFF';
    const link = obraLink(r);
    const titulo = link
      ? new ExternalHyperlink({
          children: [new TextRun({ text: r.titulo, size: 16, color: ACCENT2, underline: {} })],
          link,
        })
      : new TextRun({ text: r.titulo, size: 16, color: TEXT });
    return new TableRow({
      children: [
        cell([new TextRun({ text: String(r.anio), size: 16, color: MUTED })], AlignmentType.CENTER, fill),
        cell([titulo], AlignmentType.LEFT, fill),
        cell([new TextRun({ text: r.revista || '—', size: 16, color: MUTED })], AlignmentType.LEFT, fill),
        cell(
          [new TextRun({ text: r.cuartil || '—', size: 16, color: ACCENT, bold: true })],
          AlignmentType.CENTER,
          fill,
        ),
        cell([new TextRun({ text: String(r.citas), size: 16, color: TEXT })], AlignmentType.CENTER, fill),
      ],
    });
  });
  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: widths,
    rows: [headerRow, ...dataRows],
  });
}

function obrasTable(rows: ExecutiveReportObra[]) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      tableHead('Año', AlignmentType.CENTER),
      tableHead('Título'),
      tableHead('Revista'),
      tableHead('SJR', AlignmentType.CENTER),
      tableHead('Citas', AlignmentType.CENTER),
      tableHead('FWCI', AlignmentType.CENTER),
    ],
  });
  const dataRows = rows.map((r, i) => {
    const fill = i % 2 ? ZEBRA : 'FFFFFF';
    return new TableRow({
      children: [
        tableCell([new TextRun({ text: String(r.anio), size: 18, color: MUTED })], AlignmentType.CENTER, fill),
        tableCell([new TextRun({ text: r.titulo, size: 18, color: TEXT })], AlignmentType.LEFT, fill),
        tableCell([new TextRun({ text: r.revista, size: 18, color: MUTED })], AlignmentType.LEFT, fill),
        tableCell([new TextRun({ text: r.cuartil, size: 18, color: ACCENT, bold: true })], AlignmentType.CENTER, fill),
        tableCell([new TextRun({ text: String(r.citas), size: 18, color: TEXT })], AlignmentType.CENTER, fill),
        tableCell([new TextRun({ text: String(r.fwci), size: 18, color: GREEN, bold: true })], AlignmentType.CENTER, fill),
      ],
    });
  });
  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: [640, 3760, 2560, 760, 800, 840],
    rows: [headerRow, ...dataRows],
  });
}

function coautoresTable(rows: ExecutiveReportColab['coautores']) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      tableHead('Coautor'),
      tableHead('País', AlignmentType.CENTER),
      tableHead('Institución principal'),
      tableHead('Obras', AlignmentType.CENTER),
    ],
  });
  const dataRows = rows.map((r, i) => {
    const fill = i % 2 ? ZEBRA : 'FFFFFF';
    return new TableRow({
      children: [
        tableCell([new TextRun({ text: r.nombre, size: 18, color: TEXT, bold: true })], AlignmentType.LEFT, fill),
        tableCell([new TextRun({ text: r.pais || '—', size: 18, color: MUTED })], AlignmentType.CENTER, fill),
        tableCell([new TextRun({ text: r.inst || '—', size: 18, color: MUTED })], AlignmentType.LEFT, fill),
        tableCell([new TextRun({ text: String(r.n), size: 18, color: ACCENT, bold: true })], AlignmentType.CENTER, fill),
      ],
    });
  });
  return new Table({
    width: { size: CW, type: WidthType.DXA },
    columnWidths: [3000, 1500, 3660, 1200],
    rows: [headerRow, ...dataRows],
  });
}

function figureFromBuffer(buf: Buffer, w: number, h: number) {
  return P(
    [new ImageRun({ type: 'png', data: buf, transformation: { width: w, height: h } })],
    { alignment: AlignmentType.CENTER, spacing: { before: 60, after: 120 } },
  );
}

function metaLine(label: string, value: string) {
  return P(
    [small(`${label}  `, MUTED), new TextRun({ text: String(value), size: 20, color: TEXT, bold: true })],
    { spacing: { after: 40 } },
  );
}

function geoProse(n_paises: number, paises: { cc: string; n: number }[]) {
  const top = (paises || []).slice(0, 5).map((p) => `${ccName(p.cc)} (${p.n} obras)`);
  const next = (paises || []).slice(5, 12).map((p) => ccName(p.cc));
  let s = `La red de coautoría abarca ${n_paises} países.`;
  if (top.length) {
    s += ` Los principales socios son ${top.slice(0, -1).join(', ')} y ${top[top.length - 1]}`;
  }
  if (next.length) s += `, seguidos por ${next.join(', ')}`;
  s +=
    '. La distribución refleja un eje de colaboración regional, complementado por vínculos de alto nivel en Europa, Norteamérica y Asia.';
  return s;
}

export async function buildExecutiveReportDocx(data: ExecutiveReportData): Promise<Buffer> {
  const { meta: M, desempeno: D, obras: OBRAS, colab: C, figures: F } = data;
  const OBRAS_FULL = data.obras_full || [];

  const cover = [
    eyebrow('UNIVERSIDAD DE TARAPACÁ  ·  CRIS VICTORIA'),
    P([], { spacing: { after: 200 } }),
    P([new TextRun({ text: 'Informe Ejecutivo', bold: true, size: 52, color: ACCENT })], {
      spacing: { after: 20 },
    }),
    P([new TextRun({ text: 'de Investigador', bold: true, size: 52, color: ACCENT })], {
      spacing: { after: 200 },
    }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 14, color: ACCENT, space: 1 } },
      spacing: { after: 220 },
    }),
    P([new TextRun({ text: M.nombre_investigador, bold: true, size: 40, color: TEXT })], {
      spacing: { after: 40 },
    }),
    P([new TextRun({ text: M.unidad, size: 24, color: MUTED })], { spacing: { after: 300 } }),
    metaLine('ORCID', M.orcid),
    metaLine('Período analizado', `${M.periodo_inicio} – ${M.periodo_fin}`),
    metaLine('Fecha de corte', M.fecha_snapshot),
    P([], { spacing: { after: 2600 } }),
    P([small('Generado por CRIS Victoria · Rosflo Analytics Service', MUTED)]),
    pageBreak(),
  ];

  const bodyChildren = [
    eyebrow('RESUMEN EJECUTIVO'),
    h1('Panorama general'),
    body(
      `Durante el período ${M.periodo_inicio}–${M.periodo_fin}, ${M.nombre_investigador} registra ${D.n_pubs} publicaciones indexadas, con un impacto normalizado (FWCI) de ${D.fwci_global} —es decir, un ${D.fwci_pct}% por sobre el promedio mundial de su campo— y un promedio de ${D.cpp} citas por publicación. El ${D.pct_q1}% de su producción con cuartil reconocido se ubica en revistas Q1 (SJR/Scimago).`,
    ),
    kpiGrid(D),
    P([], { spacing: { after: 120 } }),

    eyebrow('CAPÍTULO I  ·  DESEMPEÑO'),
    h1('Producción científica'),
    body(
      `La producción se concentra en ${String(D.area_top).toLowerCase()} y ${String(D.area_2).toLowerCase()}, con una tasa de crecimiento anual compuesta (CAGR) de ${D.cagr}% en la ventana analizada. El siguiente gráfico muestra la evolución del número de publicaciones por año.`,
    ),
    figureFromBuffer(F.fig_produccion, 600, 236),
    h1('Áreas de investigación'),
    body(
      `Las áreas con mayor volumen de producción son ${D.area_top} (${D.pct_area_top}% de la producción del período) y ${D.area_2} (${D.pct_area_2}%), reflejando un perfil temático definido y a la vez interdisciplinario.`,
    ),
    figureFromBuffer(F.fig_areas, 600, 236),
    h1('Excelencia y calidad de publicación'),
    body(
      `La distribución por cuartil de revista (SJR/Scimago) confirma una fuerte presencia en revistas de primer nivel: ${D.pct_q1}% en Q1. La concentración en Q1–Q2 evidencia visibilidad y rigor sostenidos.`,
    ),
    figureFromBuffer(F.fig_cuartiles, 600, 236),

    pageBreak(),
    eyebrow('CAPÍTULO II  ·  COLABORACIÓN CIENTÍFICA'),
    h1('Colaboración científica'),
    P(
      [
        small(
          `Trayectoria completa  ${C.periodo}   ·   ${C.n_obras} publicaciones con afiliación institucional identificada`,
          MUTED,
        ),
      ],
      { spacing: { after: 180 } },
    ),
    kpiStrip4([
      { num: `${C.intl_pct}%`, label: 'COLAB. INTERNACIONAL' },
      { num: String(C.n_paises), label: 'PAÍSES SOCIOS' },
      { num: `${C.top10_pct}%`, label: 'EN TOP 10% CITAS', color: GREEN },
      { num: `${C.top1_pct}%`, label: 'EN TOP 1% CITAS', color: GREEN },
    ]),
    P([], { spacing: { after: 120 } }),
    h1('Tipo de colaboración'),
    body(
      `De las ${C.n_obras} publicaciones con afiliación institucional identificada, el ${C.intl_pct}% (${C.intl_n} obras) corresponde a colaboración internacional —con instituciones de al menos dos países—, el ${C.nac_pct}% (${C.nac_n}) a colaboración nacional entre instituciones chilenas, y solo el ${C.inst_pct}% (${C.inst_n}) a trabajos de autoría exclusivamente institucional. El perfil es marcadamente internacional.`,
    ),
    figureFromBuffer(F.fig_colab_tipo, 520, 288),
    h1('Alcance geográfico'),
    body(geoProse(C.n_paises, C.paises_colaboradores)),
    figureFromBuffer(F.fig_colab_paises, 500, 292),
    h1('Principales coautores'),
    body(
      'Coautores recurrentes a lo largo de la trayectoria, con su país e institución principal y el número de obras conjuntas:',
    ),
    coautoresTable(C.coautores),
    P(
      [
        small(
          `Se muestran los coautores de mayor recurrencia (${C.coautores.length} de ${Math.max(C.coautores.length, 15)}).`,
          MUTED,
        ),
      ],
      { spacing: { before: 80, after: 160 } },
    ),
    h1('Colaboración intersectorial'),
    body(
      `Más allá del ámbito académico, la producción evidencia vínculos intersectoriales: ${C.gob_n} obras involucran organismos de gobierno, ${C.fac_n} centros de investigación, ${C.salud_n} instituciones de salud y ${C.empresa_n} al sector privado. Esta diversidad de socios —educación, gobierno, salud e industria— amplía el alcance y la transferencia del trabajo.`,
    ),
    figureFromBuffer(F.fig_colab_intersectorial, 540, 260),
    h1('Excelencia citacional'),
    body(
      `El ${C.top10_pct}% de las obras con percentil disponible (${C.top10_n} de ${C.top10_base}) se ubica en el 10% más citado de su campo y año, y el ${C.top1_pct}% (${C.top1_n} obras) alcanza el 1% superior —señal de una producción no solo prolífica, sino de alta influencia.`,
    ),

    pageBreak(),
    eyebrow('CAPÍTULO III  ·  OBRAS DESTACADAS'),
    h1('Obras más citadas del período'),
    body(
      OBRAS.length === 1
        ? 'La publicación de mayor impacto en la ventana analizada:'
        : `Las ${numEs(OBRAS.length)} publicaciones de mayor impacto en la ventana analizada, ordenadas por número de citas:`,
    ),
    obrasTable(OBRAS),
    P([], { spacing: { after: 160 } }),

    eyebrow('APÉNDICE A'),
    h1('Metodología y fuentes'),
    body(
      'Los indicadores provienen de OpenAlex (producción, citas, FWCI, acceso abierto, afiliaciones y percentil de citación) y de SCImago Journal Rank (cuartiles de revista por ISSN). El FWCI (Field-Weighted Citation Impact) normaliza las citas por campo, año y tipo de documento; un valor de 1,0 equivale al promedio mundial. El período de desempeño se determina de forma adaptativa sobre una ventana de cinco años, priorizando densidad de producción.',
    ),
    body(
      'El capítulo de colaboración se calcula sobre la trayectoria completa del investigador. Una obra se clasifica como internacional cuando intervienen instituciones de dos o más países; nacional cuando participan varias instituciones chilenas; e institucional cuando solo figura la Universidad de Tarapacá. La colaboración intersectorial se determina por el tipo de institución socia (educación, gobierno, salud, empresa, entre otros). El percentil de citación se encuentra normalizado por campo, año y tipo de documento.',
    ),
  ];

  if (OBRAS_FULL.length) {
    const scope = data.obras_full_label ? ` (${data.obras_full_label})` : '';
    bodyChildren.push(
      pageBreak(),
      eyebrow('APÉNDICE B'),
      h1('Producción científica completa'),
      body(
        `Listado completo de las ${OBRAS_FULL.length} publicaciones registradas${scope}, ordenadas de la más reciente a la más antigua. Cada título enlaza a su DOI —identificador persistente conforme a los principios FAIR (localizable y accesible)—; las obras sin DOI se listan sin enlace.`,
      ),
      obrasFullTable(OBRAS_FULL),
    );
  }

  const header = new Header({
    children: [
      new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } },
        tabStops: [{ type: TabStopType.RIGHT, position: CW }],
        children: [
          small(`Informe Ejecutivo · ${M.nombre_investigador}`, MUTED),
          new TextRun({ text: '\t', size: 18 }),
          small('CRIS Victoria · UTA', ACCENT2),
        ],
      }),
    ],
  });
  const footer = new Footer({
    children: [
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: CW }],
        children: [
          small('Rosflo Analytics Service', MUTED),
          new TextRun({ text: '\t', size: 18 }),
          new TextRun({ children: ['Página ', PageNumber.CURRENT], size: 18, color: MUTED }),
        ],
      }),
    ],
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 22, color: TEXT } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: cover,
      },
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        headers: { default: header },
        footers: { default: footer },
        children: bodyChildren,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
