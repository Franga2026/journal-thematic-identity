import { describe, it, expect } from 'vitest';
import {
  COAUTHOR_TECHNICAL_NOTE,
  shouldShowCoAuthorLinkingNote,
} from '../utils/coAuthorsTechnicalNote';

describe('coAuthorsTechnicalNote', () => {
  it('shouldShowCoAuthorLinkingNote when collaboration list empty but ORCID present', () => {
    expect(
      shouldShowCoAuthorLinkingNote({
        worksLength: 0,
        publicationListScope: 'collaboration',
        orcid: '0000-0001-8372-1011',
      })
    ).toBe(true);
  });

  it('hides note when works exist', () => {
    expect(
      shouldShowCoAuthorLinkingNote({
        worksLength: 3,
        orcid: '0000-0001-8372-1011',
      })
    ).toBe(false);
  });

  it('hides note when already showing global catalog fallback', () => {
    expect(
      shouldShowCoAuthorLinkingNote({
        worksLength: 0,
        publicationListScope: 'global_openalex',
        globalWorksCount: 50,
      })
    ).toBe(false);
  });

  it('documents link:works message', () => {
    expect(COAUTHOR_TECHNICAL_NOTE.action).toBe('npm run link:works');
    expect(COAUTHOR_TECHNICAL_NOTE.message).toContain('colaboraciones detectadas');
    expect(COAUTHOR_TECHNICAL_NOTE.message).toContain('npm run link:works');
  });
});
