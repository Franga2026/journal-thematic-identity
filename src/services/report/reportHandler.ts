import { writeFileSync, mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { reportMetricsBundle, ReportMetricsError } from './reportMetrics';
import { buildReportFigures } from './figures';
import { buildExecutiveReportDocx } from './buildExecutiveReport';
import { buildExecutiveReportData } from './reportExecutiveData';
import { computeCollabMetrics, type CollabWork } from './reportCollabMetrics';
import { getAW } from '../../utils/dataProcessing';
import { cleanOrcid } from '../../utils/helpers';

const execFileAsync = promisify(execFile);

export type ReportOutputFormat = 'pdf' | 'docx';

export interface ReportHandlerResult {
  buffer: Buffer;
  format: ReportOutputFormat;
  filename: string;
  metrics: ReturnType<typeof reportMetricsBundle>['metrics'];
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
  const base = docxPath.split('/').pop()?.replace(/\.docx$/i, '') ?? 'report';
  const pdfPath = join(outDir, `${base}.pdf`);
  if (!existsSync(pdfPath)) {
    throw new Error('PDF conversion failed');
  }
  const pdfBuffer = readFileSync(pdfPath);
  if (!pdfBuffer.length) {
    throw new Error('PDF conversion produced empty file');
  }
  return pdfBuffer;
}

export async function handleResearcherReport(body: Record<string, unknown>): Promise<ReportHandlerResult> {
  const orcid = typeof body.orcid === 'string' ? body.orcid.trim() : '';
  if (!orcid) {
    throw new ReportMetricsError('Se requiere orcid en el body', 400);
  }

  const { metrics, obrasPeriodo } = reportMetricsBundle(orcid);
  const orcidClean = cleanOrcid(orcid);
  const corpus = getAW() as CollabWork[];
  const collab = computeCollabMetrics(corpus, orcidClean);
  const figures = await buildReportFigures(metrics, collab);
  const docxBuffer = await buildExecutiveReportDocx({
    ...buildExecutiveReportData(
      metrics,
      collab,
      obrasPeriodo,
      `período ${metrics.periodo_inicio}–${metrics.periodo_fin}`,
    ),
    figures,
  });

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
