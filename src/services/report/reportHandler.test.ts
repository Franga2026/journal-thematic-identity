import { describe, it, expect, vi } from 'vitest';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

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

    expect(result.buffer.length).toBeGreaterThan(2000);
    expect(result.buffer.subarray(0, 2).toString()).toBe('PK');
    expect(['pdf', 'docx']).toContain(result.format);
    expect(result.filename).toMatch(/Informe_Rothhammer_Engel_\d+-\d+\.(pdf|docx)/);

    vi.unstubAllGlobals();
  }, 120_000);
});
