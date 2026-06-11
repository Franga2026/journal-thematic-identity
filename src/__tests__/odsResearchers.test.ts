import { describe, it, expect } from 'vitest';
import {
  workMatchesSdg,
  collectAutoresUtaIds,
  resolveUtaResearchers,
  buildUtaResearchersForSdg,
} from '../utils/odsResearchers';
import type { Researcher, Work } from '../shared/types';
import { utaLink } from './utaLinkFixtures';

const RESEARCHERS: Researcher[] = [
  { id: '111', f: 'Ana', l: 'Silva', o: '0000-0001-1111-1111' },
  { id: '222', f: 'Luis', l: 'Rojas' },
];

const WORKS: Work[] = [
  {
    t: 'Paper 1',
    sdgs: ['Life on land'],
    autores_uta: [utaLink('111', '0000-0001-1111-1111', 'Ana Silva', 0)],
  },
  {
    t: 'Paper 2',
    sdgs: ['Life on land'],
    autores_uta: [utaLink('222', '', 'Luis Rojas', 0)],
  },
  { t: 'Paper 3', sdgs: ['Climate action'], autores_uta: [utaLink('111', '0000-0001-1111-1111', 'Ana Silva', 0)] },
];

describe('odsResearchers', () => {
  it('workMatchesSdg is case-insensitive', () => {
    expect(workMatchesSdg({ sdgs: ['Life on land'] }, 'life on land')).toBe(true);
    expect(workMatchesSdg({ sdgs: ['Climate action'] }, 'Life on land')).toBe(false);
  });

  it('collectAutoresUtaIds returns unique ids', () => {
    const ids = collectAutoresUtaIds(WORKS.slice(0, 2));
    expect(ids.size).toBe(2);
    expect(ids.has('111')).toBe(true);
    expect(ids.has('222')).toBe(true);
  });

  it('resolveUtaResearchers maps id and orcid', () => {
    const rows = resolveUtaResearchers(['111', '0000-0001-1111-1111'], RESEARCHERS);
    expect(rows).toHaveLength(1);
    expect(rows[0].f).toBe('Ana');
  });

  it('buildUtaResearchersForSdg counts publications per researcher', () => {
    const rows = buildUtaResearchersForSdg(WORKS, RESEARCHERS, 'Life on land');
    expect(rows).toHaveLength(2);
    const ana = rows.find((r) => r.researcher.id === '111');
    expect(ana?.publicationCount).toBe(1);
  });
});
