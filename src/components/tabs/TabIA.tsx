import { useMemo, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { getData, getAW, getInstitution, getAuthorsOA, getAuthorOA, getOrcidProfile, getAI, getOA } from '../../utils/dataProcessing';
import { COLORS, SDG_COLORS, SDG_ES, AI_TABS } from '../../utils/constants';
import type { AITabKey } from '../../shared/types';
import { cleanOrcid } from '../../utils/helpers';

export default function TabIA() {
  const ctx = useApp();
  const { aiTab, setAiTab, chatMsgs, setChatMsgs, chatIn, setChatIn, chatLoading, setChatLoading,
    comp1, setComp1, comp2, setComp2, compQ, setCompQ, openResearcher } = ctx;

  const DATA = getData();
  const AW = getAW();
  const INST = getInstitution();
  const AUTHORS_OA = getAuthorsOA();
  const AI = getAI();
  const OA = getOA();

  const gaps = AI?.gaps || {};

  // ─── Chat ───
  const sendChat = useCallback(async () => {
    if (!chatIn.trim() || chatLoading) return;
    const userMsg = chatIn.trim();
    setChatMsgs(p => [...p, { r: 'user', t: userMsg }]);
    setChatIn(''); setChatLoading(true);

    const topRes = DATA.filter(r => r.o).slice(0, 50).map(r => {
      const oa = getAuthorOA(r);
      return { n: r.f + ' ' + r.l, dept: (r.dp || [])[0]?.d || '', h: oa?.h_index || 0, pubs: oa?.works_count || 0, cites: oa?.cited_by_count || 0, fields: [...new Set((oa?.works || []).map(w => w.field).filter(Boolean))].slice(0, 3) };
    });
    const topFields = {};
    (AW || []).forEach(w => { if (w.field) topFields[w.field] = (topFields[w.field] || 0) + 1; });

    const sysCtx = `Eres un asistente experto del directorio de investigadores de la Universidad de Tarapacá (Arica, Chile). Datos: ${DATA.length} investigadores, ${(AW || []).length} publicaciones, ${Object.keys(AUTHORS_OA).length} con ORCID. H-index institucional: ${INST.h_index || 0}. Citas totales: ${INST.cited_by_count || 0}. Áreas: ${JSON.stringify(topFields)}. Top investigadores: ${JSON.stringify(topRes.slice(0, 20))}. Responde en español, conciso y útil.`;

    try {
      const key = import.meta.env.VITE_ANTHROPIC_KEY || '';
      if (!key) { setChatMsgs(p => [...p, { r: 'ai', t: '⚠️ Configura VITE_ANTHROPIC_KEY en el archivo .env del proyecto.' }]); setChatLoading(false); return; }
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1024, system: sysCtx, messages: [...chatMsgs.map(m => ({ role: m.r === 'user' ? 'user' : 'assistant', content: m.t })), { role: 'user', content: userMsg }] }),
      });
      const data = await res.json();
      const reply = data.content ? data.content.map(c => c.text || '').join('') : 'Error: ' + JSON.stringify(data.error || data);
      setChatMsgs(p => [...p, { r: 'ai', t: reply }]);
    } catch (e) { setChatMsgs(p => [...p, { r: 'ai', t: 'Error de conexión: ' + e.message }]); }
    setChatLoading(false);
  }, [chatIn, chatLoading, chatMsgs, setChatMsgs, setChatIn, setChatLoading, DATA, AW, AUTHORS_OA, INST]);

  // ─── Comparador search ───
  const compList = useMemo(() =>
    compQ ? DATA.filter(r => r.o && ((r.f || '') + ' ' + (r.l || '')).toLowerCase().includes(compQ.toLowerCase())).slice(0, 6) : [],
  [compQ, DATA]);

  // ─── Trends ───
  const { last6, oaByYear, topTrendFields } = useMemo(() => {
    const yrsAll = [...new Set((AW || []).map(w => w.y).filter(Boolean))].sort();
    const l6 = yrsAll.slice(-6);
    const ft = {};
    l6.forEach(y => { (AW || []).filter(w => w.y === y).forEach(w => { if (w.field) { if (!ft[w.field]) ft[w.field] = {}; ft[w.field][y] = (ft[w.field][y] || 0) + 1; } }); });
    const ttf = Object.entries(ft).sort((a, b) => Object.values(b[1]).reduce((s, v) => s + v, 0) - Object.values(a[1]).reduce((s, v) => s + v, 0)).slice(0, 8);
    const oaY = {};
    l6.forEach(y => { const yw = (AW || []).filter(w => w.y === y); oaY[y] = { total: yw.length, oa: yw.filter(w => w.oa).length }; });
    return { last6: l6, oaByYear: oaY, topTrendFields: ttf };
  }, [AW]);

  // ─── Oportunidades ───
  const { highImpact, crossField, lonely, sdgRes } = useMemo(() => {
    const hi = DATA.filter(r => r.o).map(r => { const oa = getAuthorOA(r); const q1Count = (oa?.works || []).filter(w => w.qi === 'Q1').length; return { ...r, q1: q1Count, hi: oa?.h_index || 0 }; }).filter(r => r.q1 > 0).sort((a, b) => b.q1 - a.q1).slice(0, 10);
    const cf = DATA.filter(r => r.o).map(r => { const oa = getAuthorOA(r); const fields = [...new Set((oa?.works || []).map(w => w.field).filter(Boolean))]; return { ...r, fields, fc: fields.length }; }).filter(r => r.fc >= 3).sort((a, b) => b.fc - a.fc).slice(0, 10);
    const lo = DATA.filter(r => r.o).map(r => { const op = getOrcidProfile(r); return { ...r, caCount: (op?.coAuthors || []).length }; }).filter(r => r.caCount === 0).slice(0, 10);
    const sr: Record<string, { count: number; researchers: typeof DATA }> = {};
    (INST.sdgs || []).forEach(s => { const researchers = ((OA.sdg_researchers || {})[s.name] || []).map(orcid => DATA.find(r => (r.o || '').trim() === orcid)).filter(Boolean); sr[s.name] = { count: s.count, researchers }; });
    return { highImpact: hi, crossField: cf, lonely: lo, sdgRes: sr };
  }, [DATA, INST, OA]);

  return (
    <>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 14px' }}>Inteligencia Artificial</h2>
      <div className="btn-group" style={{ marginBottom: 16 }}>
        {AI_TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setAiTab(key as AITabKey)}
            className={`btn ${aiTab === key ? 'btn--gradient' : 'btn--ghost'}`}
            style={{ fontSize: 12, borderColor: aiTab === key ? 'transparent' : '#e0d5ee', color: aiTab !== key ? '#6A4C93' : undefined }}>
            {label}
          </button>
        ))}
      </div>

      {/* ─── Chat ─── */}
      {aiTab === 'chat' && (
        <div>
          <div style={{ background: 'linear-gradient(135deg,#6A4C93,var(--blue-700))', borderRadius: 10, padding: 20, marginBottom: 16, color: '#fff' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>🤖 Chat con el Directorio UTA</div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Pregunta lo que quieras sobre los investigadores, publicaciones, áreas, métricas o colaboraciones.</div>
          </div>
          <div className="chat-window">
            {chatMsgs.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--gray-400)', fontSize: 13, padding: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
                Haz una pregunta sobre el directorio...<br />
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                  {['¿Quién investiga cambio climático?', 'Top 5 investigadores por citas', '¿Qué áreas tienen más Open Access?', 'Investigadores que publican en Q1'].map((q, i) => (
                    <button key={i} onClick={() => setChatIn(q)} className="btn btn--ghost" style={{ fontSize: 11, padding: '4px 10px', background: '#faf5ff', color: '#6A4C93', borderColor: '#e0d5ee' }}>{q}</button>
                  ))}
                </div>
              </div>
            )}
            {chatMsgs.map((m, i) => (
              <div key={i} className={`chat-message chat-message--${m.r === 'user' ? 'user' : 'ai'}`}>
                <div className={`chat-bubble chat-bubble--${m.r === 'user' ? 'user' : 'ai'}`}>
                  {m.r === 'ai' && <span style={{ fontSize: 10, color: '#6A4C93', fontWeight: 700, display: 'block', marginBottom: 4 }}>🤖 Claude</span>}
                  {m.t}
                </div>
              </div>
            ))}
            {chatLoading && <div style={{ color: '#6A4C93', fontSize: 13, padding: 8 }}>🤖 Analizando datos...</div>}
          </div>
          <div className="chat-input">
            <input className="chat-input__field" value={chatIn} onChange={e => setChatIn(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendChat(); }} placeholder="Pregunta sobre investigadores, áreas, métricas..." />
            <button onClick={sendChat} disabled={chatLoading} className="btn btn--gradient" style={{ padding: '12px 24px' }}>Enviar</button>
          </div>
        </div>
      )}

      {/* ─── Comparador ─── */}
      {aiTab === 'comparar' && (
        <div>
          <div className="card card--elevated" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--blue-700)', marginBottom: 12 }}>🔬 Comparador de Investigadores</div>
            <input className="filter-bar__input" value={compQ} onChange={e => setCompQ(e.target.value)} placeholder="Buscar investigador para comparar..." style={{ width: '100%', marginBottom: 8, boxSizing: 'border-box' }} />
            {compQ && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {compList.map((r, i) => {
                  const oa = getAuthorOA(r);
                  return <span key={i} onClick={() => { if (!comp1) setComp1(r); else if (!comp2) setComp2(r); setCompQ(''); }} className="badge badge--clickable badge--cites">{r.f} {r.l} (h={oa?.h_index || 0})</span>;
                })}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {comp1 && <span className="badge" style={{ background: 'var(--blue-800)', color: '#fff' }}>1: {comp1.f} {comp1.l} <span onClick={() => setComp1(null)} style={{ cursor: 'pointer', marginLeft: 4 }}>✕</span></span>}
              {comp2 && <span className="badge" style={{ background: '#6A4C93', color: '#fff' }}>2: {comp2.f} {comp2.l} <span onClick={() => setComp2(null)} style={{ cursor: 'pointer', marginLeft: 4 }}>✕</span></span>}
              {(comp1 || comp2) && <button className="btn btn--ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => { setComp1(null); setComp2(null); }}>Limpiar</button>}
            </div>
          </div>
          {comp1 && comp2 && <ComparisonView comp1={comp1} comp2={comp2} openResearcher={openResearcher} />}
        </div>
      )}

      {/* ─── Tendencias ─── */}
      {aiTab === 'tendencias' && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--blue-700)', marginBottom: 16 }}>📊 Dashboard de Tendencias</div>
          <div className="grid grid--2col" style={{ marginBottom: 16 }}>
            <div className="card card--elevated" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 12 }}>Producción por Año</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
                {last6.map((y, i) => { const t = oaByYear[y]?.total || 0; const mx = Math.max(...last6.map(y2 => oaByYear[y2]?.total || 0)) || 1; return (
                  <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ height: Math.max(8, t / mx * 90), background: 'linear-gradient(var(--blue-800),var(--blue-500))', borderRadius: '3px 3px 0 0', marginBottom: 4, position: 'relative' }}>
                      <div style={{ position: 'absolute', top: -16, width: '100%', fontSize: 9, fontWeight: 700, color: 'var(--blue-800)' }}>{t}</div>
                    </div>
                    <div style={{ fontSize: 9, color: '#888' }}>{y}</div>
                  </div>
                ); })}
              </div>
            </div>
            <div className="card card--elevated" style={{ padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 12 }}>Evolución Open Access</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
                {last6.map((y, i) => { const d = oaByYear[y] || {}; const pct = d.total ? Math.round(d.oa / d.total * 100) : 0; return (
                  <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ height: Math.max(8, pct / 100 * 90), background: 'linear-gradient(var(--green-600),#4ade80)', borderRadius: '3px 3px 0 0', marginBottom: 4, position: 'relative' }}>
                      <div style={{ position: 'absolute', top: -16, width: '100%', fontSize: 9, fontWeight: 700, color: 'var(--green-700)' }}>{pct}%</div>
                    </div>
                    <div style={{ fontSize: 9, color: '#888' }}>{y}</div>
                  </div>
                ); })}
              </div>
            </div>
          </div>
          <div className="card card--elevated" style={{ padding: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginBottom: 12 }}>Tendencia por Áreas (últimos 6 años)</div>
            {topTrendFields.map(([field, yData], i) => {
              const vals = last6.map(y => yData[y] || 0); const mx = Math.max(...vals) || 1;
              const first = vals[0] || 0; const last = vals[vals.length - 1] || 0;
              const trend = last > first ? '📈' : '📉';
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-800)' }}>{field}</span>
                    <span style={{ fontSize: 11, color: last > first ? 'var(--green-600)' : '#ef4444' }}>{trend} {last > first ? '+' : ''}{last - first} ({last6[0]}-{last6[last6.length - 1]})</span>
                  </div>
                  <div style={{ display: 'flex', gap: 2, height: 24 }}>
                    {vals.map((v, j) => (
                      <div key={j} style={{ flex: 1, background: COLORS[i % COLORS.length], opacity: 0.3 + 0.7 * (v / mx), borderRadius: 2, position: 'relative' }} title={`${last6[j]}: ${v}`}>
                        {v > 0 && <div style={{ position: 'absolute', top: 4, width: '100%', textAlign: 'center', fontSize: 8, color: '#fff', fontWeight: 700 }}>{v}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {gaps.fortalezas && (
            <div className="card card--elevated" style={{ padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--blue-700)', marginBottom: 12 }}>📊 Análisis Estratégico (IA)</div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
                <div><div style={{ fontSize: 12, fontWeight: 600, color: '#4C9F38', marginBottom: 6 }}>💪 Fortalezas</div>{(gaps.fortalezas || []).map((f, i) => <div key={i} style={{ fontSize: 12, color: '#555', marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid #4C9F38' }}>{f}</div>)}</div>
                <div><div style={{ fontSize: 12, fontWeight: 600, color: '#FD6925', marginBottom: 6 }}>🚀 Oportunidades</div>{(gaps.oportunidades || []).map((f, i) => <div key={i} style={{ fontSize: 12, color: '#555', marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid #FD6925' }}>{f}</div>)}</div>
                <div><div style={{ fontSize: 12, fontWeight: 600, color: '#0A97D9', marginBottom: 6 }}>🌍 ODS con Potencial</div>{(gaps.ods_potencial || []).map((f, i) => <div key={i} style={{ fontSize: 12, color: '#555', marginBottom: 4, paddingLeft: 8, borderLeft: '2px solid #0A97D9' }}>{f}</div>)}</div>
              </div>
              {gaps.recomendacion && <div style={{ marginTop: 12, padding: 12, background: 'var(--gray-50)', borderRadius: 6, fontSize: 12, color: 'var(--blue-700)', lineHeight: 1.6 }}>💡 <strong>Recomendación:</strong> {gaps.recomendacion}</div>}
            </div>
          )}
        </div>
      )}

      {/* ─── Redes ─── */}
      {aiTab === 'redes' && <NetworkView />}

      {/* ─── Oportunidades ─── */}
      {aiTab === 'oportunidades' && (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--blue-700)', marginBottom: 16 }}>🎯 Detector de Oportunidades</div>
          <div className="grid grid--2col" style={{ marginBottom: 16 }}>
            <div className="card card--elevated" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red-600)', marginBottom: 10 }}>🏆 Líderes Q1 (alto impacto)</div>
              {highImpact.map((r, i) => (
                <div key={i} onClick={() => openResearcher(r)} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--blue-700)', fontWeight: 600 }}>{r.f} {r.l}</span>
                  <span style={{ color: 'var(--red-600)', fontWeight: 700 }}>{r.q1} en Q1 · h={r.hi}</span>
                </div>
              ))}
            </div>
            <div className="card card--elevated" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#6A4C93', marginBottom: 10 }}>🌐 Investigadores Interdisciplinarios</div>
              {crossField.map((r, i) => (
                <div key={i} onClick={() => openResearcher(r)} style={{ fontSize: 12, padding: '6px 0', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}>
                  <div style={{ fontWeight: 600, color: 'var(--blue-700)' }}>{r.f} {r.l} <span style={{ fontWeight: 400, color: '#6A4C93' }}>({r.fc} áreas)</span></div>
                  <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{r.fields.join(' · ')}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid--2col">
            <div className="card card--elevated" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber-500)', marginBottom: 10 }}>🤝 Sin red de colaboración</div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>Investigadores sin co-autores — oportunidad de conectar</div>
              {lonely.map((r, i) => (
                <div key={i} onClick={() => openResearcher(r)} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', color: 'var(--blue-700)', fontWeight: 500 }}>
                  {r.f} {r.l} <span style={{ fontSize: 10, color: '#888' }}>· {(r.dp || [])[0]?.d || ''}</span>
                </div>
              ))}
            </div>
            <div className="card card--elevated" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--green-600)', marginBottom: 10 }}>🌍 Oportunidades ODS</div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>Áreas ODS con pocos investigadores</div>
              {Object.entries(sdgRes).sort((a, b) => a[1].researchers.length - b[1].researchers.length).slice(0, 8).map(([name, d], i) => (
                <div key={i} style={{ fontSize: 12, padding: '4px 0', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: SDG_COLORS[name] || '#333', fontWeight: 600 }}>{SDG_ES[name] || name}</span>
                  <span style={{ fontSize: 11, color: '#888' }}>{d.researchers.length} inv. · {d.count} pub.</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ─── Comparison sub-component ───
function ComparisonView({ comp1, comp2, openResearcher }) {
  const oa1 = getAuthorOA(comp1), oa2 = getAuthorOA(comp2);
  const metrics = [
    { l: 'Publicaciones', v1: oa1?.works_count || 0, v2: oa2?.works_count || 0 },
    { l: 'Citas', v1: oa1?.cited_by_count || 0, v2: oa2?.cited_by_count || 0 },
    { l: 'H-index', v1: oa1?.h_index || 0, v2: oa2?.h_index || 0 },
    { l: 'Works OA', v1: (oa1?.works || []).filter(w => w.oa).length, v2: (oa2?.works || []).filter(w => w.oa).length },
  ];
  const f1 = [...new Set((oa1?.works || []).map(w => w.field).filter(Boolean))];
  const f2 = [...new Set((oa2?.works || []).map(w => w.field).filter(Boolean))];
  const shared = f1.filter(f => f2.includes(f));

  return (
    <div>
      <div className="grid grid--2col" style={{ marginBottom: 16 }}>
        {[{ r: comp1, oa: oa1, c: 'var(--blue-800)' }, { r: comp2, oa: oa2, c: '#6A4C93' }].map((x, i) => (
          <div key={i} style={{ background: `linear-gradient(135deg,${x.c},var(--blue-900))`, borderRadius: 10, padding: 16, color: '#fff' }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{x.r.f} {x.r.l}</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{(x.r.dp || [])[0]?.d || ''}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 16 }}>
        {metrics.map((m, i) => {
          const mx = Math.max(m.v1, m.v2) || 1;
          return (
            <div key={i} className="card card--elevated" style={{ padding: 14, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>{m.l}</div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'flex-end', height: 50 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 30, background: 'var(--blue-800)', borderRadius: 3, height: Math.max(6, m.v1 / mx * 40), marginBottom: 4 }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue-800)' }}>{m.v1.toLocaleString()}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: 30, background: '#6A4C93', borderRadius: 3, height: Math.max(6, m.v2 / mx * 40), marginBottom: 4 }} />
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#6A4C93' }}>{m.v2.toLocaleString()}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {shared.length > 0 && (
        <div className="card card--elevated" style={{ padding: 14, background: 'var(--green-100)', borderColor: '#bbf7d0', fontSize: 12, color: 'var(--green-700)' }}>
          ✅ <strong>Potencial de colaboración:</strong> Comparten {shared.length} área(s): {shared.join(', ')}
        </div>
      )}
    </div>
  );
}

// ─── Network sub-component ───
function NetworkView() {
  const DATA = getData();
  const nodes = [], links = [], seen = {};
  DATA.filter(r => r.o).slice(0, 40).forEach(r => {
    const op = getOrcidProfile(r); const oa = getAuthorOA(r);
    const id = (r.o || '').trim(); if (!id) return;
    nodes.push({ id, n: r.f + ' ' + r.l, h: oa?.h_index || 0, uta: true }); seen[id] = true;
    (op?.coAuthors || []).slice(0, 5).forEach(ca => {
      if (ca.orcid && !seen[ca.orcid]) { nodes.push({ id: ca.orcid, n: ca.name, h: ca.h_index || 0, uta: false }); seen[ca.orcid] = true; }
      if (ca.orcid) links.push({ s: id, t: ca.orcid, v: ca.count || 1 });
    });
  });
  const W = 700, H = 420;
  const utaN = nodes.filter(n => n.uta);
  utaN.forEach((n, i) => { const angle = (2 * Math.PI * i) / utaN.length; n.x = W / 2 + 140 * Math.cos(angle); n.y = H / 2 + 140 * Math.sin(angle); });
  const extN = nodes.filter(n => !n.uta);
  extN.forEach((n, i) => { const angle = (2 * Math.PI * i) / Math.max(extN.length, 1); n.x = W / 2 + 250 * Math.cos(angle) + Math.random() * 30; n.y = H / 2 + 180 * Math.sin(angle) + Math.random() * 30; });
  const nodeMap = {}; nodes.forEach(n => nodeMap[n.id] = n);

  return (
    <div className="card card--elevated" style={{ padding: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--blue-700)', marginBottom: 4 }}>🕸️ Red de Colaboración UTA</div>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 12 }}>{utaN.length} investigadores UTA · {extN.length} colaboradores externos · {links.length} conexiones</div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--blue-800)', display: 'inline-block' }} /> UTA</span>
        <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--amber-500)', display: 'inline-block' }} /> Externo</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', background: 'var(--gray-50)', borderRadius: 8, border: '1px solid #e8e8e8' }} aria-label="Grafo de red de colaboración">
        {links.map((l, i) => { const s = nodeMap[l.s], t = nodeMap[l.t]; return s && t ? <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="#cbd5e1" strokeWidth={Math.min(l.v, 3) * 0.5} strokeOpacity={0.4} /> : null; })}
        {nodes.map((n, i) => { const r = n.uta ? Math.max(4, Math.min((n.h || 1) * 0.8, 14)) : 3; return (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={r} fill={n.uta ? 'var(--blue-800)' : 'var(--amber-500)'} stroke="#fff" strokeWidth={1} opacity={0.85} />
            {n.uta && n.h > 8 && <text x={n.x} y={n.y - r - 3} textAnchor="middle" fontSize={7} fill="var(--gray-700)" fontWeight={600}>{n.n.split(' ').slice(-1)[0]}</text>}
          </g>
        ); })}
      </svg>
    </div>
  );
}
