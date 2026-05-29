import type {
  AiApiResponse,
  BibliometricChatContext,
  ChatMessageInput,
  CoauthorAnalysisStructured,
  ResearcherAnalysisStructured,
  SdgAnalysisStructured,
  WorkSummaryInput,
  WorkSummaryStructured,
} from '../services/ai/types';
import type { Work } from '../shared/types';
import { compactWorkForPrompt } from '../services/ai/promptBuilders';

/**
 * Base URL de la API IA — mismo path en dev (Vite middleware) y producción (Vercel /api/ai/*).
 * Para Worker/CF en otro origen: VITE_AI_API_BASE=https://ai.tu-dominio.com/api/ai
 */
export function getAiApiBase(): string {
  const custom = import.meta.env.VITE_AI_API_BASE?.replace(/\/$/, '');
  return custom || '/api/ai';
}

export class AiApiError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'AiApiError';
    this.code = code;
    this.status = status;
  }
}

async function postAi<T>(path: string, body: unknown): Promise<AiApiResponse<T>> {
  const res = await fetch(`${getAiApiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as AiApiResponse<T>;
  if (!res.ok || !data.ok) {
    const err = data as { error?: string; code?: string };
    throw new AiApiError(
      err.error || 'No se pudo completar el análisis con IA',
      err.code,
      res.status
    );
  }
  return data;
}

export function summarizeWork(work: Work | WorkSummaryInput) {
  return postAi<WorkSummaryStructured>('/summarize-work', compactWorkForPrompt(work as Work));
}

export function analyzeResearcher(payload: { orcid?: string; researcherId?: string; id?: string }) {
  return postAi<ResearcherAnalysisStructured>('/analyze-researcher', payload);
}

export function classifySdg(payload: {
  sdgNum?: number;
  sdgName?: string;
  pubCount?: number;
  researchers?: Array<{ name: string }>;
}) {
  return postAi<SdgAnalysisStructured>('/classify-sdg', payload);
}

export function analyzeCoauthor(payload: { orcid?: string; name?: string; oaId?: string }) {
  return postAi<CoauthorAnalysisStructured>('/analyze-coauthor', payload);
}

export function chatBibliometric(payload: {
  message: string;
  history?: ChatMessageInput[];
  context?: BibliometricChatContext;
}) {
  return postAi<string>('/chat', payload);
}

export function friendlyAiError(err: unknown): string {
  if (err instanceof AiApiError) {
    if (err.code === 'missing_key') {
      return 'IA no configurada en el servidor. Defina ANTHROPIC_API_KEY en Vercel o .env local.';
    }
    if (err.code === 'rate_limit') return 'Demasiadas solicitudes a Claude. Espere un momento e intente de nuevo.';
    if (err.status === 504) return 'El análisis tardó demasiado. Intente con una pregunta más breve.';
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return 'Error desconocido al contactar el asistente IA';
}
