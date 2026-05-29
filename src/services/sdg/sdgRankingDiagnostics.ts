import { sdgLog } from './diagnostics';

export type SdgEmptyReason =
  | 'ok'
  | 'no_publications'
  | 'no_authorships'
  | 'authors_filtered_out'
  | 'openalex_fallback_failed';

export class SdgRankingDiagnostics {
  sdgId = 0;
  sdgName = '';
  regionScope = '';
  totalPublications = 0;
  worksWithAuthorships = 0;
  worksWithAuthorsArray = 0;
  worksWithAutoresUta = 0;
  authorshipsExtracted = 0;
  authorsAfterDedupe = 0;
  authorsAfterRegionFilter = 0;
  source: 'local' | 'openalex' | 'mixed' = 'local';
  samplePublication: unknown = null;
  emptyReason: SdgEmptyReason = 'ok';

  constructor(sdgId: number, sdgName: string, regionScope: string) {
    this.sdgId = sdgId;
    this.sdgName = sdgName;
    this.regionScope = regionScope;
  }

  toLines(): string[] {
    return [
      `ODS=${this.sdgId} (${this.sdgName}) scope=${this.regionScope} source=${this.source}`,
      `publications=${this.totalPublications}`,
      `works_with_authorships=${this.worksWithAuthorships}`,
      `works_with_a[]=${this.worksWithAuthorsArray}`,
      `works_with_autores_uta=${this.worksWithAutoresUta}`,
      `authorships_extracted=${this.authorshipsExtracted}`,
      `authors_deduped=${this.authorsAfterDedupe}`,
      `authors_after_filter=${this.authorsAfterRegionFilter}`,
      `empty_reason=${this.emptyReason}`,
    ];
  }

  flush(): void {
    sdgLog('Diagnóstico ranking ODS', {
      ...this,
      samplePublication: this.samplePublication,
    });
    this.toLines().forEach((line) => sdgLog(line));
  }
}
