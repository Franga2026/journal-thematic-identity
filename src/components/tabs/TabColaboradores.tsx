import { useCallback, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useOpenResearcherProfile } from '../../app/hooks/useOpenResearcherProfile';
import { getData, getAuthorOA, getOrcidProfile } from '../../utils/dataProcessing';
import { getColor, getInitials, cleanOrcid } from '../../utils/helpers';
import {
  getCoAuthorClickTarget,
  isCoAuthorClickable,
} from '../../utils/coAuthorProfileResolver';
import type { CoAuthorRef } from '../../shared/types';

export default function TabColaboradores() {
  const { cSearch, setCSearch, openResearcher, setViewCoAuthor } = useApp();
  const { openLocalResearcherProfile } = useOpenResearcherProfile();
  const DATA = getData();

  const openCoAuthor = useCallback(
    (ref: CoAuthorRef) => {
      const target = getCoAuthorClickTarget(ref, DATA);
      if (!target) return;
      if (target.kind === 'uta') {
        openLocalResearcherProfile(target.researcher);
        return;
      }
      setViewCoAuthor(target.profile);
    },
    [DATA, openLocalResearcherProfile, setViewCoAuthor]
  );

  const utaCA = useMemo(
    () =>
      DATA.filter((r) => r.o)
        .map((r) => {
          const op = getOrcidProfile(r);
          const oa = getAuthorOA(r);
          return {
            ...r,
            ca: op?.coAuthors || [],
            hi: oa?.h_index || 0,
            wc: oa?.works_count || 0,
            cc: oa?.cited_by_count || 0,
          };
        })
        .filter((r) => r.ca.length > 0)
        .sort((a, b) => b.ca.length - a.ca.length),
    [DATA]
  );

  const filtered = useMemo(() => {
    if (!cSearch) return utaCA;
    const q = cSearch.toLowerCase();
    return utaCA.filter(
      (r) =>
        ((r.f || '') + ' ' + (r.l || '')).toLowerCase().includes(q) ||
        r.ca.some((c) => c.name.toLowerCase().includes(q))
    );
  }, [utaCA, cSearch]);

  return (
    <>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 4px' }}>Redes de Colaboración</h2>
      <p style={{ fontSize: 13, color: '#666', margin: '0 0 12px' }}>
        {utaCA.length} investigadores UTA con co-autores identificados
      </p>
      <input
        className="filter-bar__input"
        value={cSearch}
        onChange={(e) => setCSearch(e.target.value)}
        placeholder="Buscar investigador o co-autor..."
        style={{ maxWidth: 500, marginBottom: 14 }}
        aria-label="Buscar colaborador"
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.slice(0, 30).map((r, idx) => {
          const cl = getColor((r.f || '') + (r.l || ''));
          return (
            <div key={idx} className="card" style={{ overflow: 'hidden' }}>
              <div
                onClick={() => openResearcher(r)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  background: 'var(--gray-50)',
                  borderBottom: '1px solid #eee',
                }}
              >
                {r.ph ? (
                  <img
                    src={`/photos/${r.ph}`}
                    alt=""
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '2px solid #e8edf0',
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: cl,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: 15,
                    }}
                  >
                    {getInitials(r.f, r.l)}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--blue-700)' }}>
                    {r.f} {r.l}
                  </div>
                  <div style={{ fontSize: 11, color: '#888' }}>
                    {(r.dp || [])[0]?.d || ''} · h={r.hi} · {r.wc} pub · {r.cc.toLocaleString()} citas
                  </div>
                </div>
                {r.o && (
                  <a
                    href={`https://orcid.org/${cleanOrcid(r.o)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      fontSize: 10,
                      color: '#fff',
                      background: '#A6CE39',
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    ORCID
                  </a>
                )}
                <div className="unit-card__badge">{r.ca.length}</div>
              </div>
              <div style={{ padding: '10px 16px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {r.ca.slice(0, 12).map((c2, j) => {
                    const clickable = isCoAuthorClickable(c2, DATA);
                    return (
                      <div
                        key={j}
                        role={clickable ? 'button' : undefined}
                        tabIndex={clickable ? 0 : undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (clickable) openCoAuthor(c2);
                        }}
                        onKeyDown={(e) => {
                          if (!clickable) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            openCoAuthor(c2);
                          }
                        }}
                        style={{
                          fontSize: 11,
                          background: clickable ? 'var(--blue-50)' : 'var(--gray-50)',
                          border: `1px solid ${clickable ? '#bfdbfe' : '#eee'}`,
                          borderRadius: 6,
                          padding: '4px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          cursor: clickable ? 'pointer' : 'default',
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            color: clickable ? 'var(--blue-700)' : '#1a1a1a',
                          }}
                        >
                          {c2.name}
                        </span>
                        <span style={{ fontSize: 9, color: '#888' }} title="Publicaciones conjuntas">
                          ({c2.count})
                        </span>
                        {(c2.fields || []).slice(0, 1).map((f, k) => (
                          <span key={k} className="chip chip--dept" style={{ fontSize: 8 }}>
                            {f}
                          </span>
                        ))}
                        {cleanOrcid(c2.orcid) && (
                          <a
                            href={`https://orcid.org/${cleanOrcid(c2.orcid)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              fontSize: 8,
                              color: '#A6CE39',
                              fontWeight: 700,
                              textDecoration: 'none',
                            }}
                          >
                            ORCID
                          </a>
                        )}
                      </div>
                    );
                  })}
                  {r.ca.length > 12 && (
                    <span style={{ fontSize: 10, color: '#888', padding: '4px' }}>
                      +{r.ca.length - 12} más
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
