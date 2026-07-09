import { describe, it, expect } from 'vitest';
import {
  authorHasProfileLink,
  getAuthorProfileLinkId,
  getAuthorProfilePath,
} from '../utils/authorProfileLink';
import type { EnrichedAuthor } from '../services/discovery/enrichUniversalAuthors';

describe('authorProfileLink', () => {
  it('detects UTA and OpenAlex profile ids', () => {
    const uta: EnrichedAuthor = {
      name: 'Ana',
      authorId: 'A111',
      orcid: '0000-0001-1111-1111',
      position: null,
      utaResearcher: { id: '123', f: 'Ana', l: 'Silva', o: '0000-0001-1111-1111' },
    };
    const external: EnrichedAuthor = {
      name: 'Bob',
      authorId: 'A222',
      orcid: null,
      position: null,
      utaResearcher: null,
    };
    const plain: EnrichedAuthor = {
      name: 'Sin id',
      authorId: null,
      orcid: null,
      position: null,
      utaResearcher: null,
    };

    expect(authorHasProfileLink(uta)).toBe(true);
    expect(getAuthorProfileLinkId(uta)).toBe('0000-0001-1111-1111');
    expect(authorHasProfileLink(external)).toBe(true);
    expect(getAuthorProfileLinkId(external)).toBe('A222');
    expect(authorHasProfileLink(plain)).toBe(false);
  });

  it('builds persistent descubrir link with q and autor', () => {
    const author: EnrichedAuthor = {
      name: 'Bob',
      authorId: 'A222',
      orcid: null,
      position: null,
      utaResearcher: null,
    };
    expect(getAuthorProfilePath(author, '/descubrir', 'educación chile')).toBe(
      '/descubrir?q=educaci%C3%B3n+chile&autor=A222',
    );
  });
});
