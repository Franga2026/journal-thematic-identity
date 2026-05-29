import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeAiRoute,
  routeFromPathname,
  readJsonBodyWeb,
  handleAiWebRequest,
  MAX_AI_BODY_BYTES,
} from '../server/aiApiAdapter';

vi.mock('../services/ai/aiHandlers', () => ({
  handleSummarizeWork: vi.fn().mockResolvedValue({
    ok: true,
    text: 'ok',
    disclaimer: 'IA',
  }),
  handleAnalyzeResearcher: vi.fn(),
  handleChat: vi.fn().mockResolvedValue({ ok: true, text: 'hola', disclaimer: 'IA' }),
  handleClassifySdg: vi.fn(),
  handleAnalyzeCoauthor: vi.fn(),
}));

describe('aiApiAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routeFromPathname resuelve rutas /api/ai/*', () => {
    expect(routeFromPathname('/api/ai/chat')).toBe('chat');
    expect(routeFromPathname('/api/ai/summarize-work')).toBe('summarize-work');
    expect(routeFromPathname('/api/ai/unknown')).toBeNull();
  });

  it('executeAiRoute delega en handler sin duplicar lógica', async () => {
    const { status, payload } = await executeAiRoute('summarize-work', { title: 'Test' });
    expect(status).toBe(200);
    expect(payload).toMatchObject({ ok: true, text: 'ok' });
  });

  it('readJsonBodyWeb rechaza payload enorme', async () => {
    const req = new Request('http://localhost/api/ai/chat', {
      method: 'POST',
      body: 'x'.repeat(MAX_AI_BODY_BYTES + 1),
    });
    await expect(readJsonBodyWeb(req)).rejects.toThrow(/Payload/);
  });

  it('handleAiWebRequest responde 405 en GET', async () => {
    const res = await handleAiWebRequest(
      new Request('http://localhost/api/ai/chat', { method: 'GET' }),
      'chat'
    );
    expect(res.status).toBe(405);
  });

  it('handleAiWebRequest OPTIONS devuelve 204', async () => {
    const res = await handleAiWebRequest(
      new Request('http://localhost/api/ai/chat', { method: 'OPTIONS' }),
      'chat'
    );
    expect(res.status).toBe(204);
  });
});
