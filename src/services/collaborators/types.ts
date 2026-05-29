import type { CoAuthorProfile } from '../../shared/types';

export interface LinkCollaboratorInput {
  orcid?: string;
  name?: string;
  oaId?: string;
  /** Consultar OpenAlex para cruzar DOIs con all-works local */
  fetchOpenAlex?: boolean;
}

export interface LinkCollaboratorResult {
  ok: boolean;
  total_works: number;
  works_with_autores_uta: number;
  coauthor_linked_count: number;
  authorship_links_added: number;
  openalex_dois_matched: number;
  profile: CoAuthorProfile | null;
  message: string;
}
