import { memo, useMemo, type ReactNode } from 'react';
import { getData, enrichWork } from '../../utils/dataProcessing';
import { findResearcherByProfileId } from '../../utils/researcherProfile';
import { normalizeAuthorName } from '../../utils/helpers';
import { TYPE_ES, SDG_ES } from '../../utils/constants';
import { stripTags } from '../../utils/helpers';
import type { Researcher, Work } from '../../shared/types';

type EnrichedWork = NonNullable<ReturnType<typeof enrichWork>>;

interface UtaAuthorMatch {
  researcher: Researcher;
}

function IconGraduationCap({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
    </svg>
  );
}

function IconAward({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

function IconTrendingUp({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function IconMapPin({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function matchAuthorToUta(
  authorName: string,
  utaIds: string[],
  catalog: Researcher[],
): UtaAuthorMatch | null {
  const norm = normalizeAuthorName(authorName);
  if (!norm) return null;

  for (const utaId of utaIds) {
    const researcher = findResearcherByProfileId(catalog, utaId);
    if (!researcher) continue;

    const full = normalizeAuthorName(`${researcher.f || ''} ${researcher.l || ''}`);
    const last = normalizeAuthorName(researcher.l || '');

    if (norm === full || (last.length >= 3 && norm.includes(last))) {
      return { researcher };
    }
  }

  return null;
}

function getUtaLeadershipLabel(work: Work, catalog: Researcher[]): string | null {
  const authors = work.a || [];
  const utaIds = work.autores_uta || [];
  if (!utaIds.length) return null;

  const utaIndices = authors
    .map((name, idx) => (matchAuthorToUta(name, utaIds, catalog) ? idx : -1))
    .filter((idx) => idx >= 0);

  if (!utaIndices.length) {
    return utaIds.some((id) => findResearcherByProfileId(catalog, id)) ? 'Coautor' : null;
  }

  if (utaIndices.includes(0)) return 'Primer Autor';
  if (authors.length > 1 && utaIndices.includes(authors.length - 1)) return 'Autor de Correspondencia';
  return 'Coautor';
}

function formatSdgLabel(sdg: string): string {
  return SDG_ES[sdg as keyof typeof SDG_ES] || sdg;
}

interface Props {
  w: EnrichedWork;
  onOpenResearcher: (researcher: Researcher) => void;
}

const DiscoveryCard = memo(function DiscoveryCard({ w, onOpenResearcher }: Props) {
  const catalog = useMemo(() => getData(), []);

  if (!w) return null;

  const title = stripTags(w.t) || 'Sin título';
  const year = w.y || '';
  const source = w.s || '';
  const type = TYPE_ES[w.tp as keyof typeof TYPE_ES] || w.tp || '';
  const cites = w.c || 0;
  const authors = w.a || [];
  const utaIds = w.autores_uta || [];
  const impact = w.impact;
  const sdgs = w.sdgs || [];
  const leadership = getUtaLeadershipLabel(w, catalog);

  return (
    <article className="discovery-card">
      <h3 className="discovery-card__title">{title}</h3>

      {authors.length > 0 && (
        <div className="discovery-card__authors">
          {authors.slice(0, 8).map((authorName, idx) => {
            const utaMatch = matchAuthorToUta(authorName, utaIds, catalog);

            return (
              <span key={`${authorName}-${idx}`} className="discovery-card__author-row">
                {idx > 0 && <span className="discovery-card__author-sep">,</span>}
                {utaMatch ? (
                  <span className="discovery-card__author discovery-card__author--uta">
                    <span className="discovery-card__author-name">{authorName}</span>
                    <button
                      type="button"
                      className="discovery-card__profile-link"
                      title={`Ver ficha académica de ${authorName}`}
                      onClick={() => onOpenResearcher(utaMatch.researcher)}
                    >
                      <IconGraduationCap className="discovery-card__profile-icon" />
                      Ver Ficha Académica
                    </button>
                  </span>
                ) : (
                  <span className="discovery-card__author">{authorName}</span>
                )}
              </span>
            );
          })}
          {authors.length > 8 && (
            <span className="discovery-card__author-more"> +{authors.length - 8} más</span>
          )}
        </div>
      )}

      <div className="discovery-card__meta">
        {[
          year && <strong key="y">{year}</strong>,
          source && <em key="s">{source}</em>,
          type && <span key="t">{type}</span>,
        ].filter(Boolean).reduce<ReactNode[]>((acc, el, i) => {
          if (i > 0) acc.push(<span key={`sep-${i}`} className="discovery-card__meta-sep"> · </span>);
          acc.push(el);
          return acc;
        }, [])}
      </div>

      <div className="discovery-card__metrics">
        <div className="discovery-card__metric">
          <div className="discovery-card__metric-head">
            <IconAward className="discovery-card__metric-icon" />
            <span className="discovery-card__metric-label">Impacto Normalizado (FNCI)</span>
          </div>
          <div className="discovery-card__metric-value">
            {impact != null && impact > 0 ? impact.toFixed(2) : '—'}
          </div>
          {impact != null && impact > 1 && (
            <div className="discovery-card__metric-note">Supera el promedio mundial (1.0)</div>
          )}
        </div>

        <div className="discovery-card__metric">
          <div className="discovery-card__metric-head">
            <IconTrendingUp className="discovery-card__metric-icon" />
            <span className="discovery-card__metric-label">Citaciones</span>
          </div>
          <div className="discovery-card__metric-value">{cites.toLocaleString()}</div>
          <div className="discovery-card__metric-note">Acumuladas del artículo</div>
        </div>

        <div className="discovery-card__metric">
          <div className="discovery-card__metric-head">
            <IconMapPin className="discovery-card__metric-icon" />
            <span className="discovery-card__metric-label">Liderazgo Científico</span>
          </div>
          <div className="discovery-card__metric-value discovery-card__metric-value--role">
            {leadership || '—'}
          </div>
          <div className="discovery-card__metric-note">
            {leadership ? 'Posición del investigador UTA' : 'Sin autor UTA vinculado'}
          </div>
        </div>

        <div className="discovery-card__metric discovery-card__metric--qualification">
          <span className="discovery-card__metric-label">Calificación</span>
          <div className="discovery-card__qualification">
            {w.qi ? (
              <span className="discovery-card__qual-badge discovery-card__qual-badge--quartile">
                Scopus {w.qi}
              </span>
            ) : (
              <span className="discovery-card__qual-badge discovery-card__qual-badge--muted">Sin cuartil</span>
            )}
            {sdgs.slice(0, 1).map((sdg) => (
              <span key={sdg} className="discovery-card__qual-badge discovery-card__qual-badge--sdg">
                ODS · {formatSdgLabel(sdg)}
              </span>
            ))}
            {!sdgs.length && (
              <span className="discovery-card__qual-badge discovery-card__qual-badge--muted">Sin ODS</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
});

export default DiscoveryCard;
