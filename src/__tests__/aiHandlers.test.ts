import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initData } from '../utils/dataProcessing';
import { resetServerDataForTests } from '../server/ensureServerData';

vi.mock('../services/ai/claudeClient', () => ({
  askClaude: vi.fn().mockResolvedValue({
    text: '{"resumen":"ok","aporte_principal":"a","metodologia_probable":"m","aplicacion_practica":"p","ods_relacionados":["ODS 3"]}',
    model: 'test-model',
  }),
  ClaudeConfigError: class extends Error {
    code = 'missing_key';
  },
}));

describe('aiHandlers', () => {
  beforeEach(() => {
    resetServerDataForTests();
    initData({
      DATA: [{ id: '1', f: 'Ana', l: 'Silva', o: '0000-0001-1111-1111', dp: [{ d: 'Ingeniería' }] }],
      OA: {
        authors: {
          '0000-0001-1111-1111': {
            works_count: 5,
            cited_by_count: 10,
            h_index: 3,
            works: [{ t: 'Paper 1', y: 2023, c: 2 }],
          },
        },
        institution: {},
      },
      AW: [{ t: 'Paper UTA', y: 2023, autores_uta: [{ author_id: 'A1', rut: '1', orcid: '0000-0001-0000-0001', name: 'Ana', author_index: 0 }], sdgs: ['SDG3'] }],
      OD: {},
      AI: {},
      COAUTHORS: {},
      METRICS: {},
      RES_METRICS: { '0000-0001-1111-1111': { fields: ['Salud'], h_index: 3 } },
    });
  });

  it('handleSummarizeWork responde ok sin enviar dataset completo', async () => {
    const { handleSummarizeWork } = await import('../services/ai/aiHandlers');
    const res = await handleSummarizeWork({ title: 'Test', year: 2024 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.structured?.resumen).toBe('ok');
      expect(res.disclaimer).toContain('IA');
    }
  });

  it('handleAnalyzeResearcher falla si no hay investigador', async () => {
    const { handleAnalyzeResearcher } = await import('../services/ai/aiHandlers');
    await expect(handleAnalyzeResearcher({ orcid: '9999' })).rejects.toThrow('no encontrado');
  });

  it('buildWorkPrompt no embebe el catálogo completo de obras', async () => {
    const { buildWorkPrompt } = await import('../services/ai/promptBuilders');
    const prompt = buildWorkPrompt({ t: 'Publicación de prueba', y: 2024 });
    expect(prompt.length).toBeLessThan(5000);
    expect(prompt).not.toContain('9127');
    expect(prompt).not.toMatch(/Paper \d{3,}/);
  });
});
