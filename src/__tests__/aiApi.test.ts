import { describe, it, expect, vi, beforeEach } from 'vitest';
import { friendlyAiError, AiApiError, getAiApiBase } from '../api/aiApi';

describe('aiApi', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ ok: false, error: 'ANTHROPIC_API_KEY no configurada', code: 'missing_key' }),
      })
    );
  });

  it('friendlyAiError no menciona API keys', async () => {
    const msg = friendlyAiError(new AiApiError('IA no configurada', 'missing_key', 503));
    expect(msg).toContain('ANTHROPIC_API_KEY');
    expect(msg).not.toMatch(/sk-ant/);
  });

  it('getAiApiBase usa /api/ai por defecto en dev y producción', () => {
    expect(getAiApiBase()).toBe('/api/ai');
  });

  it('fetch no envía x-api-key desde el cliente', async () => {
    const { summarizeWork } = await import('../api/aiApi');
    await expect(summarizeWork({ t: 'Test' })).rejects.toThrow();
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.stringify(init)).not.toContain('api-key');
    expect(JSON.stringify(init)).not.toContain('sk-');
  });
});
