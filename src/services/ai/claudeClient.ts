import Anthropic from '@anthropic-ai/sdk';
import { BIBLIOMETRIC_SYSTEM_PROMPT } from './systemPrompt';

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const FALLBACK_MODEL = 'claude-sonnet-4-6';
const DEFAULT_TIMEOUT_MS = 55_000;

let client: Anthropic | null = null;
let runtimeApiKey: string | undefined;
let runtimeModel: string | undefined;

export function resetClaudeClient(): void {
  client = null;
}

/** Inyección de credenciales (p. ej. Cloudflare Worker env) sin exponerlas al cliente */
export function configureClaudeRuntime(opts: { apiKey?: string; model?: string }): void {
  if (opts.apiKey !== undefined) runtimeApiKey = opts.apiKey.trim() || undefined;
  if (opts.model !== undefined) runtimeModel = opts.model.trim() || undefined;
  resetClaudeClient();
}

export function getAnthropicApiKey(): string | undefined {
  return runtimeApiKey || process.env.ANTHROPIC_API_KEY?.trim() || undefined;
}

export function resolveAnthropicModel(): string {
  return (
    runtimeModel ||
    process.env.ANTHROPIC_MODEL?.trim() ||
    process.env.ANTHROPIC_DEFAULT_MODEL?.trim() ||
    DEFAULT_MODEL
  );
}

function getClient(): Anthropic {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new ClaudeConfigError('ANTHROPIC_API_KEY no configurada en el servidor');
  }
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

export class ClaudeConfigError extends Error {
  code = 'missing_key' as const;
}

export class ClaudeRateLimitError extends Error {
  code = 'rate_limit' as const;
}

export class ClaudeTimeoutError extends Error {
  code = 'timeout' as const;
}

function mapApiError(err: unknown): Error {
  if (err instanceof ClaudeConfigError || err instanceof ClaudeTimeoutError) return err;
  const status = (err as { status?: number })?.status;
  if (status === 429) return new ClaudeRateLimitError('Límite de solicitudes de Anthropic alcanzado. Intente más tarde.');
  if (status === 401) return new ClaudeConfigError('API key de Anthropic inválida');
  const message = err instanceof Error ? err.message : String(err);
  return new Error(message);
}

export async function askClaude({
  system = BIBLIOMETRIC_SYSTEM_PROMPT,
  prompt,
  maxTokens = 1200,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  model,
}: {
  system?: string;
  prompt: string;
  maxTokens?: number;
  timeoutMs?: number;
  model?: string;
}): Promise<{ text: string; model: string }> {
  const anthropic = getClient();
  const primaryModel = model || resolveAnthropicModel();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const run = async (useModel: string) => {
    const response = await anthropic.messages.create(
      {
        model: useModel,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
      },
      { signal: controller.signal }
    );
    const text = response.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('\n')
      .trim();
    return { text, model: useModel };
  };

  try {
    try {
      return await run(primaryModel);
    } catch (firstErr) {
      const msg = firstErr instanceof Error ? firstErr.message : '';
      const notFound = msg.includes('not_found') || msg.includes('model');
      if (notFound && primaryModel !== FALLBACK_MODEL) {
        return await run(FALLBACK_MODEL);
      }
      throw firstErr;
    }
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new ClaudeTimeoutError('La solicitud a Claude excedió el tiempo límite');
    }
    throw mapApiError(err);
  } finally {
    clearTimeout(timer);
  }
}
