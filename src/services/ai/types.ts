export interface AiApiError {
  ok: false;
  error: string;
  code?: 'missing_key' | 'rate_limit' | 'timeout' | 'payload_too_large' | 'invalid_request';
}

export interface AiApiSuccess<T = string> {
  ok: true;
  text: string;
  structured?: T;
  model?: string;
  disclaimer: string;
}

export type AiApiResponse<T = string> = AiApiSuccess<T> | AiApiError;

export interface WorkSummaryInput {
  title?: string;
  authors?: string[];
  journal?: string;
  year?: number | string;
  abstract?: string;
  doi?: string;
  sdgs?: string[];
  type?: string;
  citations?: number;
  field?: string;
}

export interface WorkSummaryStructured {
  resumen: string;
  aporte_principal: string;
  metodologia_probable: string;
  aplicacion_practica: string;
  ods_relacionados: string[];
}

export interface ResearcherAnalysisStructured {
  lineas_investigacion: string[];
  fortalezas_cientificas: string[];
  ods_principales: string[];
  colaboraciones_destacadas: string[];
  publicaciones_clave: string[];
  oportunidades_colaboracion: string[];
}

export interface SdgAnalysisStructured {
  resumen_uta: string;
  investigadores_relevantes: string[];
  areas_fuertes: string[];
  brechas: string[];
  recomendaciones: string[];
}

export interface CoauthorAnalysisStructured {
  tipo_colaboracion: string;
  temas_comunes: string[];
  impacto_colaboracion: string;
  lineas_futuras: string[];
}

export interface ChatMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequestBody {
  message: string;
  history?: ChatMessageInput[];
  context?: BibliometricChatContext;
}

export interface BibliometricChatContext {
  investigators_count: number;
  publications_count: number;
  institution_h_index?: number;
  top_fields?: Array<{ field: string; count: number }>;
  top_researchers?: Array<{ name: string; h_index: number; pubs: number; dept?: string }>;
  sdg_highlights?: Array<{ sdg: string; pubs: number }>;
}
