import { describe, it, expect, vi, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

beforeAll(() => {
  const templatePath = join(process.cwd(), 'src/services/report/templates/informe-fase1.docx');
  if (!existsSync(templatePath)) {
    execFileSync('node', ['scripts/build-informe-template.mjs'], { stdio: 'inherit' });
  }
});

describe('handleResearcherReport smoke', () => {
  it('genera archivo no vacío para ORCID Rothhammer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => PNG_1X1.buffer.slice(PNG_1X1.byteOffset, PNG_1X1.byteOffset + PNG_1X1.byteLength),
      }),
    );

    const { handleResearcherReport } = await import('./reportHandler');
    const { ensureServerData, resetServerDataForTests } = await import('../../server/ensureServerData');

    resetServerDataForTests();
    ensureServerData();

    const result = await handleResearcherReport({ orcid: '0000-0001-5228-1180' });

    expect(result.buffer.length).toBeGreaterThan(500);
    expect(['pdf', 'docx']).toContain(result.format);
    expect(result.filename).toMatch(/Informe_Rothhammer_Engel_\d+-\d+\.(pdf|docx)/);

    vi.unstubAllGlobals();
  }, 120_000);
});
