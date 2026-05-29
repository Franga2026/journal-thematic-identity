import {
  getData,
  getAuthorOA,
  getResMetrics,
  getAW,
  resolveCoAuthorProfile,
  getWorksForResearcher,
} from '../../utils/dataProcessing';
import { cleanOrcid } from '../../utils/helpers';
import type { Work, Researcher } from '../../shared/types';
import { askClaude, ClaudeConfigError, ClaudeRateLimitError, ClaudeTimeoutError } from './claudeClient';
import {
  buildWorkPrompt,
  buildResearcherPrompt,
  buildSdgPrompt,
  buildCoauthorPrompt,
  buildChatPrompt,
  compactWorkForPrompt,
} from './promptBuilders';
import { limitPayloadSize, parseJsonFromClaude, sanitizeText } from './sanitize';
import { AI_DISCLAIMER } from './systemPrompt';
import type {
  AiApiResponse,
  ChatRequestBody,
  CoauthorAnalysisStructured,
  ResearcherAnalysisStructured,
  SdgAnalysisStructured,
  WorkSummaryInput,
  WorkSummaryStructured,
} from './types';
import { ensureServerData } from '../../server/ensureServerData';
import { collectPublicationsForSdg } from '../../utils/sdgWorksSource';
import { SDG_ES } from '../../utils/constants';

function success<T>(text: string, structured?: T, model?: string): AiApiResponse<T> {
  return { ok: true, text, structured, model, disclaimer: AI_DISCLAIMER };
}

function failure(error: Error): AiApiResponse {
  const code =
    error instanceof ClaudeConfigError
      ? 'missing_key'
      : error instanceof ClaudeRateLimitError
        ? 'rate_limit'
        : error instanceof ClaudeTimeoutError
          ? 'timeout'
          : error.message.includes('Payload')
            ? 'payload_too_large'
            : 'invalid_request';
  return { ok: false, error: error.message, code };
}

function findResearcher(body: Record<string, unknown>): Researcher | null {
  const DATA = getData();
  const orcid = sanitizeText(body.orcid, 80);
  const id = sanitizeText(body.researcherId ?? body.id, 80);
  if (orcid) {
    const c = cleanOrcid(orcid);
    return DATA.find((r) => cleanOrcid(r.o) === c) || null;
  }
  if (id) {
    return DATA.find((r) => r.id === id || cleanOrcid(r.o) === id) || null;
  }
  return null;
}

export async function handleSummarizeWork(body: Record<string, unknown>): Promise<AiApiResponse<WorkSummaryStructured>> {
  const work: WorkSummaryInput = {
    title: sanitizeText(body.title ?? body.t, 300),
    authors: Array.isArray(body.authors) ? body.authors.map((a) => sanitizeText(a, 120)) : [],
    journal: sanitizeText(body.journal ?? body.s, 200),
    year: body.year as number | string | undefined,
    abstract: sanitizeText(body.abstract, 800),
    doi: sanitizeText(body.doi ?? body.d, 120),
    sdgs: Array.isArray(body.sdgs) ? body.sdgs.map((s) => sanitizeText(s, 80)) : [],
    type: sanitizeText(body.type ?? body.tp, 40),
    citations: typeof body.citations === 'number' ? body.citations : typeof body.c === 'number' ? body.c : undefined,
    field: sanitizeText(body.field, 80),
  };
  limitPayloadSize(work);
  const prompt = buildWorkPrompt(work);
  const { text, model } = await askClaude({ prompt, maxTokens: 900 });
  const structured = parseJsonFromClaude<WorkSummaryStructured>(text);
  return success(text, structured || undefined, model);
}

export async function handleAnalyzeResearcher(
  body: Record<string, unknown>
): Promise<AiApiResponse<ResearcherAnalysisStructured>> {
  ensureServerData();
  const researcher = findResearcher(body);
  if (!researcher) {
    throw new Error('Investigador no encontrado en el directorio UTA');
  }
  const oa = getAuthorOA(researcher);
  const rm = getResMetrics()[cleanOrcid(researcher.o)] || {};
  const works = getWorksForResearcher(researcher).slice(0, 20) as Work[];
  const metrics = {
    works_count: oa?.works_count ?? rm.scholarly_output,
    cited_by_count: oa?.cited_by_count ?? rm.citation_count,
    h_index: oa?.h_index ?? rm.h_index,
    fields: rm.fields || [],
    dept: (researcher.dp || [])[0]?.d,
    fwci: rm.fwci,
    oa_rate: rm.oa_rate,
    scope: 'métricas locales UTA; OpenAlex global solo si se indica en el perfil',
  };
  limitPayloadSize({ researcher: { f: researcher.f, l: researcher.l }, works: works.length });
  const prompt = buildResearcherPrompt(researcher, works, metrics);
  const { text, model } = await askClaude({ prompt, maxTokens: 1400 });
  const structured = parseJsonFromClaude<ResearcherAnalysisStructured>(text);
  return success(text, structured || undefined, model);
}

export async function handleClassifySdg(body: Record<string, unknown>): Promise<AiApiResponse<SdgAnalysisStructured>> {
  ensureServerData();
  const sdgNum = Number(body.sdgNum ?? body.number);
  const sdgName = sanitizeText(body.sdgName ?? body.name, 120);
  if (!sdgName && !sdgNum) throw new Error('Se requiere sdgName o sdgNum');

  const name = sdgName || `SDG${sdgNum}`;
  const works = collectPublicationsForSdg(name, sdgNum || undefined).slice(0, 15);
  const samples = works.map((w) => compactWorkForPrompt(w as Work));

  const researcherNames = Array.isArray(body.researchers)
    ? body.researchers.slice(0, 12).map((r: { name?: string }) => sanitizeText(r.name, 100))
    : [];

  const sdg = {
    number: sdgNum || 0,
    name,
    titleEs: SDG_ES[name as keyof typeof SDG_ES] || name,
    pubCount: typeof body.pubCount === 'number' ? body.pubCount : works.length,
  };

  limitPayloadSize({ sdg, samples });
  const prompt = buildSdgPrompt(
    sdg,
    researcherNames.map((n) => ({ name: n })),
    samples
  );
  const { text, model } = await askClaude({ prompt, maxTokens: 1400 });
  const structured = parseJsonFromClaude<SdgAnalysisStructured>(text);
  return success(text, structured || undefined, model);
}

export async function handleAnalyzeCoauthor(
  body: Record<string, unknown>
): Promise<AiApiResponse<CoauthorAnalysisStructured>> {
  ensureServerData();
  const profile = resolveCoAuthorProfile({
    orcid: body.orcid as string | undefined,
    name: body.name as string | undefined,
    oaId: body.oaId as string | undefined,
  });
  if (!profile) throw new Error('Colaborador no encontrado');

  const works = (profile.works || []).slice(0, 15) as Work[];
  const DATA = getData();
  const utaNames = [
    ...new Set(
      works.flatMap((w) =>
        (w.autores_uta || []).map((id) => {
          const r = DATA.find((x) => x.id === id || cleanOrcid(x.o) === id);
          return r ? `${r.f || ''} ${r.l || ''}`.trim() : id;
        })
      )
    ),
  ].slice(0, 10);

  limitPayloadSize({ name: profile.name, works: works.length });
  const prompt = buildCoauthorPrompt(profile, works, utaNames);
  const { text, model } = await askClaude({ prompt, maxTokens: 1200 });
  const structured = parseJsonFromClaude<CoauthorAnalysisStructured>(text);
  return success(text, structured || undefined, model);
}

export async function handleChat(body: ChatRequestBody): Promise<AiApiResponse> {
  const message = sanitizeText(body.message, 1500);
  if (!message) throw new Error('Mensaje vacío');
  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];
  limitPayloadSize({ message, history, context: body.context });
  const prompt = buildChatPrompt(message, history, body.context);
  const { text, model } = await askClaude({ prompt, maxTokens: 1200 });
  return success(text, undefined, model);
}

/** Expone conteo para tests — no envía AW completo */
export function getPromptDatasetFootprint(): { researchers: number; works: number } {
  ensureServerData();
  return { researchers: getData().length, works: getAW().length };
}
