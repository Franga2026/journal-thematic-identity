import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
// @ts-expect-error no types published
import ImageModule from 'docxtemplater-image-module-free';
import { reportMetrics, ReportMetricsError } from './reportMetrics';
import { buildReportFigures } from './figures';

const execFileAsync = promisify(execFile);
const TEMPLATE_PATH = join(process.cwd(), 'src/services/report/templates/informe-fase1.docx');

export type ReportOutputFormat = 'pdf' | 'docx';

export interface ReportHandlerResult {
  buffer: Buffer;
  format: ReportOutputFormat;
  filename: string;
  metrics: ReturnType<typeof reportMetrics>;
}

async function findSoffice(): Promise<string | null> {
  const candidates = [
    process.env.SOFFICE_PATH,
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    '/usr/bin/soffice',
    '/usr/local/bin/soffice',
  ].filter(Boolean) as string[];
  for (const bin of candidates) {
    if (existsSync(bin)) return bin;
  }
  try {
    const { stdout } = await execFileAsync('which', ['soffice']);
    const p = stdout.trim();
    if (p) return p;
  } catch {
    /* not in PATH */
  }
  return null;
}

async function convertDocxToPdf(docxPath: string, outDir: string): Promise<Buffer> {
  const soffice = await findSoffice();
  if (!soffice) {
    throw new Error('soffice not available');
  }
  await execFileAsync(soffice, [
    '--headless',
    '--convert-to',
    'pdf',
    '--outdir',
    outDir,
    docxPath,
  ]);
  const pdfPath = join(outDir, `${docxPath.split('/').pop()?.replace(/\.docx$/i, '')}.pdf`);
  if (!existsSync(pdfPath)) {
    throw new Error('PDF conversion failed');
  }
  return readFileSync(pdfPath);
}

function renderDocx(
  metrics: ReturnType<typeof reportMetrics>,
  figures: Awaited<ReturnType<typeof buildReportFigures>>,
): Buffer {
  if (!existsSync(TEMPLATE_PATH)) {
    throw new Error(`Plantilla no encontrada: ${TEMPLATE_PATH}. Ejecute node scripts/build-informe-template.mjs`);
  }
  const content = readFileSync(TEMPLATE_PATH);
  const zip = new PizZip(content);

  const figureBuffers = {
    fig_produccion: figures.fig_produccion,
    fig_areas: figures.fig_areas,
    fig_cuartiles: figures.fig_cuartiles,
  };

  const imageOpts = {
    centered: false,
    getImage: (tagValue: string) => {
      const buf = figureBuffers[tagValue as keyof typeof figureBuffers];
      if (!buf) throw new Error(`Figura desconocida: ${tagValue}`);
      return buf;
    },
    getSize: (_img: Buffer, tagValue: string) => {
      if (tagValue === 'fig_areas') return [640, 400] as [number, number];
      return [640, 360] as [number, number];
    },
  };
  const imageModule = new ImageModule(imageOpts);

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
    modules: [imageModule],
  });

  const templateData = {
    ...metrics,
    fwci_global: metrics.fwci_global ?? '—',
    fwci_pct: metrics.fwci_pct ?? '—',
    cpp: metrics.cpp ?? '—',
    pct_q1: metrics.pct_q1 ?? '—',
    cagr: metrics.cagr ?? '—',
    fig_produccion: 'fig_produccion',
    fig_areas: 'fig_areas',
    fig_cuartiles: 'fig_cuartiles',
  };

  doc.render(templateData);
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

export async function handleResearcherReport(body: Record<string, unknown>): Promise<ReportHandlerResult> {
  const orcid = typeof body.orcid === 'string' ? body.orcid.trim() : '';
  if (!orcid) {
    throw new ReportMetricsError('Se requiere orcid en el body', 400);
  }

  const metrics = reportMetrics(orcid);
  const figures = await buildReportFigures(metrics);
  const docxBuffer = renderDocx(metrics, figures);

  const baseName = `Informe_${metrics.apellido.replace(/\s+/g, '_')}_${metrics.periodo_inicio}-${metrics.periodo_fin}`;
  const tmpDir = mkdtempSync(join(tmpdir(), 'uta-report-'));
  const docxPath = join(tmpDir, `${baseName}.docx`);

  try {
    writeFileSync(docxPath, docxBuffer);
    try {
      const pdfBuffer = await convertDocxToPdf(docxPath, tmpDir);
      console.info('[report] PDF generado vía LibreOffice soffice');
      return {
        buffer: pdfBuffer,
        format: 'pdf',
        filename: `${baseName}.pdf`,
        metrics,
      };
    } catch {
      console.warn('[report] soffice no disponible — devolviendo DOCX');
      return {
        buffer: docxBuffer,
        format: 'docx',
        filename: `${baseName}.docx`,
        metrics,
      };
    }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function statusForReportError(err: Error): number {
  if (err instanceof ReportMetricsError) return err.statusCode;
  if (err.message.includes('QuickChart')) return 502;
  return 500;
}
