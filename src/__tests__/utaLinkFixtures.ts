import type { UtaAuthorLink } from '../shared/types';

export function utaLink(
  rut: string,
  orcid: string,
  name: string,
  author_index: number,
  author_id = 'A0000000001',
): UtaAuthorLink {
  return { author_id, rut, orcid, name, author_index };
}
