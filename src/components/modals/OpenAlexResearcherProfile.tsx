import { useEffect, useMemo, useState } from 'react';
import {
  fetchOpenAlexAuthor,
  fetchOpenAlexAuthorByName,
  fetchAuthorWorks,
  fetchAuthorWorksSample,
  openAlexWorkToEcosystem,
  openAlexWorkToLite,
  type OpenAlexWorkItem,
} from '../../services/odsService';
import { computeAuthorKpis } from '../../services/discovery/computeOpenAlexAuthorKpis';
import { computeEcosystem } from '../../services/discovery/computeAuthorEcosystem';
import OpenAlexResearcherModal from './OpenAlexResearcherModal';
import './OpenAlexResearcherModal.css';
import { getData } from '../../utils/dataProcessing';
import { findResearcherByProfileId, findResearcherByOpenAlexAuthorId } from '../../utils/researcherProfile';
import { useUI } from '../../context/UIContext';
import { useOpenResearcherProfile } from '../../app/hooks/useOpenResearcherProfile';
import type { OpenAlexAuthorDetail, OpenAlexAuthorSummary } from '../../shared/types/openalex';
import type { Researcher } from '../../shared/types';
import type { EcosystemCoauthor } from '../../services/discovery/computeAuthorEcosystem';

interface OpenAlexResearcherProfileProps {
  authorId: string;
  onClose: () => void;
  /** Si el ORCID coincide con un investigador UTA, abrir ficha local completa */
  onUtaMatch?: (researcher: Researcher) => void;
}

const WORKS_PER_PAGE = 30;

function countryLabel(code: string | null | undefined): string | null {
  const raw = (code || '').trim().toUpperCase();
  if (!raw) return null;
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' }).of(raw) || raw;
  } catch {
    return raw;
  }
}

function detailFromSummary(s: OpenAlexAuthorSummary): OpenAlexAuthorDetail {
  return { ...s, topics: [] };
}

function isValidOpenAlexId(id?: string): boolean {
  return !!id && /^A\d+$/i.test(id.replace(/^https?:\/\/openalex\.org\//i, ''));
}

export default function OpenAlexResearcherProfile({
  authorId,
  onClose,
  onUtaMatch,
}: OpenAlexResearcherProfileProps) {
  const { openAlexAuthor } = useUI();
  const { openLocalResearcherProfile, openOpenAlexProfile } = useOpenResearcherProfile();

  const [author, setAuthor] = useState<OpenAlexAuthorDetail | null>(
    openAlexAuthor ? detailFromSummary(openAlexAuthor) : null,
  );
  const [loading, setLoading] = useState(!openAlexAuthor);
  const [error, setError] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);

  const [sampledWorks, setSampledWorks] = useState<OpenAlexWorkItem[]>([]);
  const [worksSampleTotal, setWorksSampleTotal] = useState(0);
  const [dataLoading, setDataLoading] = useState(false);

  const [productionWorks, setProductionWorks] = useState<OpenAlexWorkItem[]>([]);
  const [worksTotal, setWorksTotal] = useState(0);
  const [worksPage, setWorksPage] = useState(0);
  const [worksLoading, setWorksLoading] = useState(false);

  const orcid = author?.orcid?.trim() || undefined;
  const oaId = isValidOpenAlexId(author?.openAlexId) ? author?.openAlexId : undefined;

  const worksLite = useMemo(
    () => sampledWorks.map(openAlexWorkToLite),
    [sampledWorks],
  );

  const worksForEco = useMemo(
    () => sampledWorks.map(openAlexWorkToEcosystem),
    [sampledWorks],
  );

  const worksForGrid = useMemo(
    () => productionWorks.map(openAlexWorkToEcosystem),
    [productionWorks],
  );

  const kpis = useMemo(
    () => (author ? computeAuthorKpis(author, worksLite) : null),
    [author, worksLite],
  );

  const ecosystem = useMemo(
    () => (author && worksForEco.length ? computeEcosystem(worksForEco, author.display_name) : null),
    [author, worksForEco],
  );

  useEffect(() => {
    let cancelled = false;

    const localUta =
      findResearcherByOpenAlexAuthorId(authorId, getData())
      ?? findResearcherByProfileId(getData(), openAlexAuthor?.orcid?.trim() || authorId);
    if (localUta && onUtaMatch) {
      onUtaMatch(localUta);
      return;
    }

    if (openAlexAuthor) {
      setAuthor(detailFromSummary(openAlexAuthor));
      setLoading(false);
      setError(null);
    } else {
      setAuthor(null);
      setLoading(true);
      setError(null);
    }

    const candidates = Array.from(
      new Set(
        [openAlexAuthor?.orcid, authorId, openAlexAuthor?.openAlexId, openAlexAuthor?.id]
          .map((x) => (x || '').trim())
          .filter(Boolean),
      ),
    );

    setEnriching(true);
    (async () => {
      for (const cand of candidates) {
        try {
          const detail = await fetchOpenAlexAuthor(cand);
          if (cancelled) return;
          const localFromDetail = findResearcherByProfileId(
            getData(),
            detail.orcid || detail.openAlexId || cand,
          );
          if (localFromDetail && onUtaMatch) {
            onUtaMatch(localFromDetail);
            return;
          }
          setAuthor(detail);
          setError(null);
          setLoading(false);
          setEnriching(false);
          return;
        } catch {
          // siguiente candidato
        }
      }

      const name = openAlexAuthor?.display_name?.trim();
      if (name) {
        try {
          const byName = await fetchOpenAlexAuthorByName(name);
          if (cancelled) return;
          if (byName) {
            const localByName = findResearcherByProfileId(
              getData(),
              byName.orcid || byName.openAlexId || '',
            );
            if (localByName && onUtaMatch) {
              onUtaMatch(localByName);
              return;
            }
            setAuthor(byName);
            setError(null);
            setLoading(false);
            setEnriching(false);
            return;
          }
        } catch {
          // sin match por nombre
        }
      }

      if (cancelled) return;
      setEnriching(false);
      setLoading(false);
      if (!openAlexAuthor) setError('No se pudo cargar el perfil desde OpenAlex.');
    })();

    return () => {
      cancelled = true;
    };
  }, [authorId, onUtaMatch, openAlexAuthor]);

  useEffect(() => {
    let cancelled = false;

    setSampledWorks([]);
    setWorksSampleTotal(0);
    setProductionWorks([]);
    setWorksPage(0);
    setWorksTotal(0);

    if (!orcid && !oaId) {
      setDataLoading(false);
      return;
    }

    setDataLoading(true);
    setWorksLoading(true);
    Promise.all([
      fetchAuthorWorksSample({ orcid, oaId }),
      fetchAuthorWorks({ orcid, oaId, page: 1, perPage: WORKS_PER_PAGE }),
    ])
      .then(([sampleRes, pageRes]) => {
        if (!cancelled) {
          setSampledWorks(sampleRes.works);
          setWorksSampleTotal(sampleRes.total);
          setProductionWorks(pageRes.works);
          setWorksTotal(pageRes.total);
          setWorksPage(1);
        }
      })
      .catch(() => {
        if (!cancelled) setSampledWorks([]);
      })
      .finally(() => {
        if (!cancelled) {
          setDataLoading(false);
          setWorksLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [orcid, oaId]);

  async function loadMoreWorks() {
    if (!orcid && !oaId) return;
    if (worksLoading || productionWorks.length >= worksTotal) return;
    setWorksLoading(true);
    try {
      const nextPage = worksPage + 1;
      const res = await fetchAuthorWorks({ orcid, oaId, page: nextPage, perPage: WORKS_PER_PAGE });
      setProductionWorks((prev) => {
        const seen = new Set(prev.map((w) => w.id));
        const merged = [...prev];
        for (const work of res.works) {
          if (!seen.has(work.id)) merged.push(work);
        }
        return merged;
      });
      setWorksTotal(res.total);
      setWorksPage(nextPage);
    } catch {
      // conservar lo cargado
    } finally {
      setWorksLoading(false);
    }
  }

  const handleOpenUtaProfile = (researcher: Researcher) => {
    if (onUtaMatch) {
      onUtaMatch(researcher);
      return;
    }
    openLocalResearcherProfile(researcher);
  };

  const handleOpenCoauthor = (c: EcosystemCoauthor) => {
    const oaId = c.author_id?.trim();
    if (!oaId) return;
    const summary: OpenAlexAuthorSummary = {
      id: oaId,
      openAlexId: oaId,
      display_name: c.name,
      institution: c.institution ?? undefined,
      country_code: c.country ?? undefined,
      cited_by_count: 0,
      works_count: 0,
    };
    openOpenAlexProfile(summary, { keepPrevious: true });
  };

  const canLoadMore = worksTotal > productionWorks.length && !worksLoading;

  if (loading && !author) {
    return (
      <OpenAlexResearcherModal
        name=""
        affiliation={null}
        country={null}
        countryLabel={null}
        kpis={null}
        ecosystem={null}
        worksPool={[]}
        worksTotal={0}
        loading
        onClose={onClose}
        onOpenUtaProfile={handleOpenUtaProfile}
        onOpenCoauthor={handleOpenCoauthor}
        onLoadMoreWorks={() => {}}
      />
    );
  }

  if (error && !author) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, padding: 24 }}>
          <p style={{ color: 'var(--red-600)', fontSize: 14, margin: 0 }}>{error}</p>
          <button type="button" className="btn" style={{ marginTop: 16 }} onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  if (!author) return null;

  const affiliationName = author.last_known_institution?.display_name ?? author.institution ?? null;
  const countryCode = author.last_known_institution?.country_code ?? author.country_code ?? null;

  return (
    <OpenAlexResearcherModal
      name={author.display_name}
      affiliation={affiliationName}
      country={countryCode}
      countryLabel={countryLabel(countryCode)}
      orcid={orcid}
      openAlexId={author.openAlexId || author.id}
      kpis={kpis}
      ecosystem={ecosystem}
      worksPool={worksForGrid}
      worksTotal={worksTotal || author.works_count || worksSampleTotal}
      loading={dataLoading || enriching}
      worksLoading={worksLoading}
      canLoadMore={canLoadMore}
      onClose={onClose}
      onOpenUtaProfile={handleOpenUtaProfile}
      onOpenCoauthor={handleOpenCoauthor}
      onLoadMoreWorks={() => void loadMoreWorks()}
    />
  );
}
