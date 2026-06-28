import { describe, it, expect } from 'vitest';
import {
  computeCollabMetrics,
  normOrcid,
  normWorks,
} from './reportCollabMetrics';
import type { CollabWork } from './reportCollabMetrics';

const UTA = {
  display_name: 'Universidad de Tarapacá',
  ror: 'https://ror.org/04xe01d27',
  country_code: 'CL',
  type: 'education',
};
const FOREIGN = {
  display_name: 'University College London',
  ror: 'https://ror.org/02jx3x895',
  country_code: 'GB',
  type: 'education',
};

function work(partial: CollabWork): CollabWork {
  return partial;
}

describe('reportCollabMetrics', () => {
  it('normOrcid extrae ORCID de URL', () => {
    expect(normOrcid('https://orcid.org/0000-0001-5228-1180')).toBe('0000-0001-5228-1180');
  });

  it('clasifica colaboración internacional con ≥2 países', () => {
    const works = [
      work({
        y: 2024,
        authorships: [
          {
            author: { display_name: 'Ana Test', orcid: '0000-0001-5228-1180' },
            institutions: [UTA],
          },
          {
            author: { display_name: 'Peer', orcid: '0000-0001-8372-1011' },
            institutions: [FOREIGN],
          },
        ],
        percentile: { value: 0.9, is_in_top_10_percent: true, is_in_top_1_percent: false },
      }),
    ];
    const m = computeCollabMetrics(works, '0000-0001-5228-1180');
    expect(m.n_obras).toBe(1);
    expect(m.pct_colab_intl).toBe(100);
    expect(m.excelencia.top10.pct).toBe(100);
  });

  it('filtra por periodo --from/--to', () => {
    const works = [
      work({
        y: 2020,
        authorships: [
          { author: { orcid: '0000-0001-5228-1180' }, institutions: [UTA, FOREIGN] },
        ],
      }),
      work({
        y: 2025,
        authorships: [
          { author: { orcid: '0000-0001-5228-1180' }, institutions: [UTA, FOREIGN] },
        ],
      }),
    ];
    const m = computeCollabMetrics(works, '0000-0001-5228-1180', { from: 2022, to: 2026 });
    expect(m.n_obras).toBe(1);
    expect(m.periodo.from).toBe(2022);
    expect(m.periodo.to).toBe(2026);
  });

  it('normWorks aplana objeto anidado', () => {
    const flat = normWorks({ a: [{ authorships: [] }], b: [{ authorships: [] }] });
    expect(flat).toHaveLength(2);
  });
});
