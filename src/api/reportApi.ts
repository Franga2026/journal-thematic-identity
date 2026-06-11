export class ReportApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ReportApiError';
    this.status = status;
  }
}

export interface ReportDownloadResult {
  blob: Blob;
  filename: string;
  format: 'pdf' | 'docx';
}

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const match = /filename="([^"]+)"/i.exec(header);
  return match?.[1] ?? null;
}

export async function requestReport(orcid: string): Promise<ReportDownloadResult> {
  const res = await fetch('/api/report/researcher', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orcid }),
  });

  if (!res.ok) {
    let message = 'No se pudo generar el informe';
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      /* binary or empty */
    }
    throw new ReportApiError(message, res.status);
  }

  const formatHeader = res.headers.get('X-Report-Format');
  const format: 'pdf' | 'docx' = formatHeader === 'docx' ? 'docx' : 'pdf';
  const blob = await res.blob();
  const filename =
    filenameFromDisposition(res.headers.get('Content-Disposition')) ??
    `Informe_${orcid.replace(/\//g, '-')}.${format}`;

  return { blob, filename, format };
}

export function downloadReportBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
