import type { Work, Researcher, CoAuthorProfile } from '../../shared/types';
import type {
  BibliometricChatContext,
  ChatMessageInput,
  WorkSummaryInput,
} from './types';
import { sanitizeText, sanitizeStringArray } from './sanitize';
import { stripTags } from '../../utils/helpers';

const MAX_WORKS_IN_PROMPT = 15;
const MAX_WORK_TITLE = 220;

export function compactWorkForPrompt(work: Work | WorkSummaryInput): WorkSummaryInput {
  const w = work as Work;
  return {
    title: sanitizeText(stripTags(w.t || w.title || ''), MAX_WORK_TITLE),
    authors: sanitizeStringArray(w.a || [], 12, 80),
    journal: sanitizeText(w.s || w.pub || '', 200),
    year: w.y,
    abstract: sanitizeText((w as Work & { abstract?: string }).abstract || '', 800),
    doi: sanitizeText(w.d || w.doi || '', 120),
    sdgs: sanitizeStringArray(w.sdgs || [], 8, 80),
    type: sanitizeText(w.tp || '', 40),
    citations: typeof w.c === 'number' ? w.c : w.cited_by_count,
    field: sanitizeText(w.field || '', 80),
  };
}

export function buildWorkPrompt(work: Work | WorkSummaryInput): string {
  const w = compactWorkForPrompt(work);
  return `Analiza esta publicación del repositorio UTA y responde SOLO con JSON válido (sin markdown) con estas claves:
{
  "resumen": "2-3 oraciones",
  "aporte_principal": "string",
  "metodologia_probable": "string o 'No determinable con los metadatos disponibles'",
  "aplicacion_practica": "string",
  "ods_relacionados": ["ODS …"]
}

Publicación:
${JSON.stringify(w, null, 2)}`;
}

export function buildResearcherPrompt(
  researcher: Researcher,
  works: Work[],
  metrics: {
    works_count?: number;
    cited_by_count?: number;
    h_index?: number;
    fields?: string[];
    dept?: string;
    fwci?: number;
    oa_rate?: number;
    scope?: string;
  }
): string {
  const sample = works.slice(0, MAX_WORKS_IN_PROMPT).map((w) => compactWorkForPrompt(w));
  const profile = {
    nombre: `${researcher.f || ''} ${researcher.l || ''}`.trim(),
    cargo: sanitizeText(researcher.t, 120),
    unidad: sanitizeText(metrics.dept || (researcher.dp || [])[0]?.d, 120),
    orcid: sanitizeText(researcher.o, 80),
    ambito_metricas: metrics.scope || 'datos locales UTA + OpenAlex por ORCID',
    metricas: {
      publicaciones: metrics.works_count ?? null,
      citas: metrics.cited_by_count ?? null,
      h_index: metrics.h_index ?? null,
      fwci: metrics.fwci ?? null,
      oa_rate_pct: metrics.oa_rate ?? null,
    },
    campos: sanitizeStringArray(metrics.fields || [], 10, 80),
    muestra_publicaciones: sample,
    total_publicaciones_muestra: works.length,
  };

  return `Analiza al investigador UTA y responde SOLO con JSON válido:
{
  "lineas_investigacion": ["…"],
  "fortalezas_cientificas": ["…"],
  "ods_principales": ["…"],
  "colaboraciones_destacadas": ["…"],
  "publicaciones_clave": ["título breve — año"],
  "oportunidades_colaboracion": ["…"]
}

Perfil:
${JSON.stringify(profile, null, 2)}`;
}

export function buildSdgPrompt(
  sdg: { number: number; name: string; titleEs: string; pubCount: number },
  researchers: Array<{ name: string; score?: number; pubs?: number; dept?: string }>,
  workSamples: WorkSummaryInput[]
): string {
  const payload = {
    ods: sdg,
    investigadores_muestra: researchers.slice(0, 12),
    publicaciones_muestra: workSamples.slice(0, MAX_WORKS_IN_PROMPT),
  };
  return `Analiza el ODS en la Universidad de Tarapacá (UTA) con los datos locales siguientes.
Responde SOLO con JSON válido:
{
  "resumen_uta": "párrafo",
  "investigadores_relevantes": ["nombre — breve rol"],
  "areas_fuertes": ["…"],
  "brechas": ["…"],
  "recomendaciones": ["…"]
}

Datos:
${JSON.stringify(payload, null, 2)}`;
}

export function buildCoauthorPrompt(
  coauthor: CoAuthorProfile,
  works: Work[],
  utaCollaborators: string[]
): string {
  const payload = {
    colaborador: {
      nombre: sanitizeText(coauthor.name, 120),
      instituciones: sanitizeStringArray(coauthor.institutions || [], 6, 120),
      ambito: coauthor.metricsScope || 'colaboración UTA',
      metricas_colaboracion: {
        publicaciones: coauthor.works_count,
        citas: coauthor.cited_by_count,
        h_index: coauthor.h_index,
      },
      campos: sanitizeStringArray(coauthor.fields || [], 8, 80),
    },
    investigadores_uta_vinculados: utaCollaborators.slice(0, 10),
    publicaciones_colaboracion: works.slice(0, MAX_WORKS_IN_PROMPT).map(compactWorkForPrompt),
  };

  return `Analiza la colaboración científica de este coautor con UTA.
Responde SOLO con JSON válido:
{
  "tipo_colaboracion": "string",
  "temas_comunes": ["…"],
  "impacto_colaboracion": "string",
  "lineas_futuras": ["…"]
}

Datos:
${JSON.stringify(payload, null, 2)}`;
}

export function buildChatPrompt(message: string, history: ChatMessageInput[], context?: BibliometricChatContext): string {
  const hist = history.slice(-6).map((m) => ({
    role: m.role,
    content: sanitizeText(m.content, 1500),
  }));
  return `Contexto bibliométrico UTA (resumen, no es el dataset completo):
${JSON.stringify(context || {}, null, 2)}

Historial reciente:
${JSON.stringify(hist, null, 2)}

Pregunta del usuario:
${sanitizeText(message, 1500)}

Responde de forma útil, citando si aplica si los datos son locales UTA, globales OpenAlex o inferencia IA.`;
}

/** Construye contexto compacto para chat (usar en cliente con getters). */
export function buildBibliometricChatContextFromStats(stats: BibliometricChatContext): BibliometricChatContext {
  return {
    investigators_count: stats.investigators_count,
    publications_count: stats.publications_count,
    institution_h_index: stats.institution_h_index,
    top_fields: (stats.top_fields || []).slice(0, 12),
    top_researchers: (stats.top_researchers || []).slice(0, 15),
    sdg_highlights: (stats.sdg_highlights || []).slice(0, 8),
  };
}
