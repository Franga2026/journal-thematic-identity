import { describe, it, expect } from 'vitest';
import {
  extractOrcidFromOpenAlex,
  findResearcherByProfileId,
  findResearcherByOpenAlexAuthorId,
  isUtaOpenAlexAuthorId,
  getOrcidRecordUrl,
  getResearcherProfilePath,
  getOpenAlexAuthorProfilePath,
  isOpenAlexAuthorId,
  shouldSyncProfileRoute,
} from '../utils/researcherProfile';
import type { Researcher } from '../shared/types';

const DATA: Researcher[] = [
  { id: '111', f: 'Ana', l: 'Silva', o: '0000-0001-1111-1111' },
];

describe('researcherProfile', () => {
  it('extractOrcidFromOpenAlex', () => {
    expect(extractOrcidFromOpenAlex('https://orcid.org/0000-0002-1825-0097')).toBe('0000-0002-1825-0097');
  });

  it('findResearcherByProfileId by RUT or ORCID', () => {
    expect(findResearcherByProfileId(DATA, '111')?.f).toBe('Ana');
    expect(findResearcherByProfileId(DATA, '0000-0001-1111-1111')?.f).toBe('Ana');
    expect(findResearcherByProfileId(DATA, 'https://orcid.org/0000-0001-1111-1111')?.f).toBe('Ana');
  });

  it('getOrcidRecordUrl builds orcid.org link', () => {
    expect(getOrcidRecordUrl('0000-0001-1111-1111')).toBe('https://orcid.org/0000-0001-1111-1111');
    expect(getOrcidRecordUrl('https://orcid.org/0000-0001-1111-1111')).toBe(
      'https://orcid.org/0000-0001-1111-1111'
    );
  });

  it('getResearcherProfilePath prefers ORCID', () => {
    expect(getResearcherProfilePath(DATA[0])).toBe('/perfiles/0000-0001-1111-1111');
  });

  it('shouldSyncProfileRoute is true only on perfiles routes', () => {
    expect(shouldSyncProfileRoute('/perfiles')).toBe(true);
    expect(shouldSyncProfileRoute('/perfiles/0000-0001-1111-1111')).toBe(true);
    expect(shouldSyncProfileRoute('/ods/12')).toBe(false);
    expect(shouldSyncProfileRoute('/unidades')).toBe(false);
  });

  it('isOpenAlexAuthorId detects A-prefixed ids', () => {
    expect(isOpenAlexAuthorId('A5012345678')).toBe(true);
    expect(isOpenAlexAuthorId('0000-0001-1111-1111')).toBe(false);
  });

  it('getOpenAlexAuthorProfilePath uses openAlexId when no ORCID', () => {
    expect(
      getOpenAlexAuthorProfilePath({
        id: 'https://openalex.org/A5012345678',
        openAlexId: 'A5012345678',
        display_name: 'X',
        cited_by_count: 0,
        works_count: 7,
      })
    ).toBe('/perfiles/A5012345678');
  });

  it('getOpenAlexAuthorProfilePath prefers ORCID', () => {
    expect(
      getOpenAlexAuthorProfilePath({
        id: 'https://openalex.org/A1',
        openAlexId: 'A1',
        display_name: 'X',
        orcid: '0000-0002-1825-0097',
        cited_by_count: 0,
        works_count: 1,
      })
    ).toBe('/perfiles/0000-0002-1825-0097');
  });

  it('findResearcherByOpenAlexAuthorId resolves UTA via orcid-authorid-map', () => {
    const catalog: Researcher[] = [
      { id: '12345678-9', f: 'Francisco', l: 'Rothhammer Engel', o: '0000-0001-5228-1180' },
    ];
    const hit = findResearcherByOpenAlexAuthorId('A5022063392', catalog);
    expect(hit?.l).toMatch(/Rothhammer/i);
    expect(isUtaOpenAlexAuthorId('A5022063392', catalog)).toBe(true);
    expect(isUtaOpenAlexAuthorId('A9999999999', catalog)).toBe(false);
  });
});
