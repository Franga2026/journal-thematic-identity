import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const createMock = vi.fn();

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: createMock },
  })),
}));

describe('claudeClient', () => {
  const prevKey = process.env.ANTHROPIC_API_KEY;
  const prevModel = process.env.ANTHROPIC_MODEL;

  beforeEach(() => {
    vi.resetModules();
    createMock.mockReset();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
  });

  afterEach(() => {
    if (prevKey) process.env.ANTHROPIC_API_KEY = prevKey;
    else delete process.env.ANTHROPIC_API_KEY;
    if (prevModel) process.env.ANTHROPIC_MODEL = prevModel;
    else delete process.env.ANTHROPIC_MODEL;
  });

  it('throws ClaudeConfigError when ANTHROPIC_API_KEY is missing', async () => {
    const { askClaude, ClaudeConfigError } = await import('../services/ai/claudeClient');
    await expect(askClaude({ prompt: 'hola' })).rejects.toBeInstanceOf(ClaudeConfigError);
  });

  it('returns text from Claude without exposing key', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-secret';
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'Respuesta de prueba' }],
    });
    const { askClaude, resetClaudeClient } = await import('../services/ai/claudeClient');
    resetClaudeClient();
    const { text } = await askClaude({ prompt: 'test', maxTokens: 100 });
    expect(text).toBe('Respuesta de prueba');
    expect(createMock).toHaveBeenCalled();
    const callArg = createMock.mock.calls[0][0];
    expect(JSON.stringify(callArg)).not.toContain('sk-test-secret');
  });

  it('resolveAnthropicModel uses env or fallback', async () => {
    process.env.ANTHROPIC_MODEL = 'claude-custom';
    const { resolveAnthropicModel } = await import('../services/ai/claudeClient');
    expect(resolveAnthropicModel()).toBe('claude-custom');
  });
});
