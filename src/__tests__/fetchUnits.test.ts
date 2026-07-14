import { describe, it, expect } from 'vitest';
import { mapUnitsResponse } from '../services/catalog/fetchUnits';
import {
  initData,
  getDepartments,
  getDeptCounts,
  getDeptOrcidCoverage,
} from '../utils/dataProcessing';

describe('mapUnitsResponse', () => {
  it('mapea GET /units al contrato DEPTS / deptCounts / deptOrcid', () => {
    const cat = mapUnitsResponse([
      {
        id: 32,
        name: 'Instituto de Alta Investigación',
        total: 16,
        with_orcid: 16,
        pct: 100,
      },
      {
        id: 1,
        name: 'Centro de Artes',
        total: 3,
        with_orcid: 0,
        pct: 0,
      },
    ]);

    expect(cat.DEPTS).toEqual([
      'Instituto de Alta Investigación',
      'Centro de Artes',
    ]);
    expect(cat.deptCounts['Instituto de Alta Investigación']).toBe(16);
    expect(cat.deptOrcid['Instituto de Alta Investigación']).toEqual({
      total: 16,
      conOrcid: 16,
      pct: 100,
    });
    expect(cat.deptOrcid['Centro de Artes'].conOrcid).toBe(0);
  });
});

describe('initData + UNITS', () => {
  it('preferencia API sobre cómputo JSON', () => {
    initData({
      DATA: [{ id: '1', o: null, dp: [{ d: 'Solo JSON' }] }],
      OA: {},
      AW: [],
      OD: {},
      AI: {},
      COAUTHORS: {},
      METRICS: {},
      RES_METRICS: {},
      UNITS: {
        total: 1,
        results: [
          {
            id: 32,
            name: 'Instituto de Alta Investigación',
            total: 16,
            with_orcid: 16,
            pct: 100,
          },
        ],
      },
    });
    expect(getDepartments()).toEqual(['Instituto de Alta Investigación']);
    expect(getDeptCounts()['Instituto de Alta Investigación']).toBe(16);
    expect(getDeptOrcidCoverage()['Instituto de Alta Investigación'].pct).toBe(100);
  });
});
