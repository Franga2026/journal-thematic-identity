# -*- coding: utf-8 -*-
"""
Estudio 1 — ¿La reasignación por contenido mueve el cuartil?
============================================================
Implementa el preregistro CONGELADO `preregistro_estudio1_cuartil_por_contenido.md`
(SHA-256 74ca815faf79e188bd07adc89f366760e96f1c3ec5c8605532acaa4f76e4b836).
Los umbrales de abajo están FIJADOS antes de ver resultados; NO tocarlos tras correr.

Comparación A (TITULAR): usa el CiteScore oficial de Scopus (mismo valor por revista)
y cambia SOLO el agrupamiento — cuartil dentro de la categoría ASJC (oficial) vs.
cuartil dentro del subcampo de CONTENIDO (núcleo p_cit, τ=0.5). Todo cambio de cuartil
proviene del re-agrupamiento, no de la fuente de citas.

Comparación B (MECANISMO): módulo aparte a nivel de artículo (blockbuster fuera de núcleo).
Requiere la tabla de obras; ver sección 6 y CONFIG WORKS_TABLE.

Ejecución LOCAL contra cris_victoria.
pip install --break-system-packages psycopg[binary] pandas numpy scipy statsmodels openpyxl
"""
import sys
import numpy as np
import pandas as pd

# ============================================================ CONFIG (AJUSTAR) ==
DSN = "postgresql://postgres:victoria@localhost:5432/cris_victoria"
CITESCORE_XLSX = "CiteScore 2025.xlsx"           # <-- ruta al archivo Scopus
PROFILE_TABLE  = "journal_identity_profile"       # source_id, subfield_id, p_cit, config
CONFIG_TAG     = "W0_2021_2024"                    # <-- config del perfil p_cit alineado a CiteScore 2025 (2021-2024)

# Mapa OpenAlex source_id -> ISSNs. AJUSTAR al esquema real:
#   se espera una tabla con (source_id, issn) o (source_id, issn_l, issn_print, issn_electronic).
SOURCES_TABLE  = "openalex_sources"               # <-- tabla de fuentes OpenAlex con ISSNs
SOURCES_COLS   = dict(source_id="source_id", issns="issns")  # 'issns' = texto/lista de ISSNs; AJUSTAR

# Módulo de mecanismo (Comparación B). Esquema real de cris_victoria:
#   works.source_id (int, FK -> sources.id) ; works.primary_topic_id (FK -> topics.id)
#   works.cited_by_count ; works.publication_year
#   sources: id (int) + openalex_id (texto 'S...', = llave del perfil)
#   topics:  id + openalex_id ('T...')  ->  openalex_topics.topic_id
#   openalex_topics.subfield_id ('subfields/2708' -> '2708' = código ASJC = subfield del perfil)
WORKS_TABLE          = "works"           # obras OpenAlex
SOURCES_JOIN_TABLE   = "sources"         # puente works.source_id -> openalex_id ('S...')
TOPICS_TABLE         = "topics"          # works.primary_topic_id -> topics.openalex_id ('T...')
OA_TOPICS_TABLE      = "openalex_topics" # topics.openalex_id -> subfield_id ('subfields/2708' -> '2708')

# ------------------------------------------------- UMBRALES CONGELADOS (NO TOCAR)
TAU          = 0.50      # operador de núcleo (heredado de QSS)
B_NULL       = 2000      # repeticiones del nulo de re-agrupamiento
ALPHA        = 0.05      # nivel, unilateral
NULL_PCTL    = 95        # banda "dentro del nulo"
MOVE_THRESH  = 1         # movimiento >= 1 cuartil cuenta como "cambia"
MIN_SUBFIELDS= 3         # masa suficiente (heredado)
RANDOM_TAG   = "estudio1"  # (la semilla se fija abajo de forma determinista)

R_MECH         = 200      # sorteos del nulo intra-revista (exclusión aleatoria) del mecanismo
# §7 (CONFIRMA) exige el mecanismo blockbuster (Comparación B), como PRUEBA CAUSAL:
#   (i) tener un artículo de alto impacto fuera de núcleo predice el movimiento, y
#  (ii) excluir el top-1% POR CITAS revierte la asignación MÁS que excluir un 1% ALEATORIO.
# La Comparación B fija estos valores en tiempo de ejecución (no se editan a mano):
MECHANISM_DONE = False   # lo pone True la Comparación B si corre con datos de obras
MECHANISM_OK   = None     # lo fija la Comparación B (True/False); None = no corrido

BANNER = f"""
==============================================================================
 ESTUDIO 1 — cuartil por CONTENIDO vs por CATEGORÍA  (preregistro CONGELADO)
 Ventana 2021-2024 (alineada a CiteScore 2025) · núcleo τ={TAU} · desempate (-p_cit, subfield_id)
 Umbrales: α={ALPHA} (unilateral) · B={B_NULL} · banda=P{NULL_PCTL} · movimiento ≥{MOVE_THRESH} cuartil
 Titular = Comparación A (mismo CiteScore, distinto agrupamiento). Sin re-sintonizar nada.
==============================================================================
"""

# =============================================================== UTILIDADES =====
def get_conn():
    try:
        import psycopg as _pg
    except ImportError:
        import psycopg2 as _pg
    return _pg.connect(DSN)

def nucleo(dist, tau=TAU):
    s = sorted(dist.items(), key=lambda kv: (-kv[1], kv[0]))
    acc, out = 0.0, []
    for k, v in s:
        out.append(k); acc += v
        if acc >= tau:
            break
    return out  # lista ordenada; out[0] = dominante

def entropy(dist):
    p = np.array([v for v in dist.values() if v > 0])
    return float(-np.sum(p * np.log(p))) if len(p) else 0.0

def rank_to_quartile(citescores):
    """Dado un array de CiteScore de una población, devuelve el cuartil (1..4) de cada uno.
    Q1 = mejor 25%. Empates: método 'max' (conservador, como ranking estándar)."""
    s = pd.Series(citescores)
    # rank descendente: 1 = mayor CiteScore
    r = s.rank(ascending=False, method="min")
    n = len(s)
    frac = r / n
    q = np.where(frac <= 0.25, 1, np.where(frac <= 0.50, 2, np.where(frac <= 0.75, 3, 4)))
    return q.astype(int)

# ============================================================ 1) CARGA DATOS ====
def load_profile():
    with get_conn() as c:
        df = pd.read_sql(
            f"""SELECT source_id, subfield_id::text AS s, p_cit
                FROM {PROFILE_TABLE} WHERE config=%(cfg)s""",
            c, params={"cfg": CONFIG_TAG})
    prof = {}
    for sid, g in df.groupby("source_id"):
        d = dict(zip(g["s"], g["p_cit"].astype(float)))
        tot = sum(v for v in d.values() if v > 0)
        if tot > 0 and len([v for v in d.values() if v > 0]) >= MIN_SUBFIELDS:
            prof[sid] = {k: v / tot for k, v in d.items() if v > 0}
    return prof

def load_sources_issn():
    """OpenAlex source_id -> set(ISSN normalizados). AJUSTAR SOURCES_TABLE/COLS al esquema real."""
    with get_conn() as c:
        df = pd.read_sql(f"SELECT * FROM {SOURCES_TABLE}", c)
    idc = SOURCES_COLS["source_id"]; isc = SOURCES_COLS["issns"]
    out = {}
    for _, row in df.iterrows():
        raw = row[isc]
        if raw is None: continue
        issns = raw if isinstance(raw, (list, tuple)) else str(raw).replace(";", ",").split(",")
        out[row[idc]] = {norm_issn(x) for x in issns if x and str(x).strip()}
    return out

def norm_issn(x):
    return str(x).upper().replace("-", "").replace(" ", "").strip()

def load_citescore(path):
    df = pd.read_excel(path, sheet_name="CiteScore 2025 annual values", engine="openpyxl")
    df.columns = [c.strip() for c in df.columns]
    # nivel-revista (dedup): CiteScore/Citation Count/Scholarly Output son constantes por Source ID
    jl = (df.groupby("Scopus Source ID")
            .agg(title=("Title", "first"),
                 citescore=("CiteScore", "first"),
                 citations=("Citation Count", "first"),
                 output=("Scholarly Output", "first"),
                 issn_p=("Print ISSN", "first"),
                 issn_e=("E-ISSN", "first"),
                 asjc_set=("Scopus ASJC Code (Sub-subject Area)", lambda s: set(str(x) for x in s)),
                 quartile_off=("Quartile", "min"))   # mejor cuartil (min) entre categorías
            .reset_index())
    jl["citescore"] = pd.to_numeric(jl["citescore"], errors="coerce")
    jl = jl.dropna(subset=["citescore"])
    # filas por categoría (por si se necesita)
    cat = df[["Scopus Source ID", "Scopus ASJC Code (Sub-subject Area)", "Quartile",
              "Percentile", "RANK", "Rank Out Of"]].copy()
    return jl, cat

# ============================================================ 2) COMPARACIÓN A ==
def build_frame(prof, issn_map, jl):
    """Une OpenAlex(perfil p_cit) con Scopus(CiteScore) por ISSN, y arma el frame por revista."""
    # invertir issn_map: issn -> openalex source_id
    issn2src = {}
    for sid, issns in issn_map.items():
        for i in issns: issn2src[i] = sid
    rows = []
    for _, r in jl.iterrows():
        cand = {norm_issn(r["issn_p"]), norm_issn(r["issn_e"])} - {"NAN", ""}
        oa = next((issn2src[i] for i in cand if i in issn2src), None)
        if oa is None or oa not in prof:
            continue
        dist = prof[oa]
        nuc = nucleo(dist, TAU)
        dom = nuc[0]                              # subcampo de contenido dominante (código ASJC 4-díg)
        asjc = {a.split(".")[0] for a in r["asjc_set"]}  # categorías editoriales de la revista
        jca = sum(v for k, v in dist.items() if k in asjc)   # alineación (masa dentro de categoría)
        rows.append(dict(
            openalex_id=oa, scopus_id=r["Scopus Source ID"], title=r["title"],
            citescore=float(r["citescore"]), output=float(r["output"]),
            quartile_cat=int(r["quartile_off"]),           # cuartil oficial (mejor entre categorías)
            content_subfield=dom, in_category=(dom in asjc), asjc_set=frozenset(asjc),
            jca=jca, divergence=1.0 - jca, n_asjc=len(asjc),
            entropy=entropy(dist)))
    return pd.DataFrame(rows)

def content_quartiles(fr):
    """Cuartil de cada revista rankeando su CiteScore DENTRO de su subcampo-de-contenido."""
    fr = fr.copy()
    fr["quartile_content"] = np.nan
    fr["subfield_size"] = np.nan
    for sf, g in fr.groupby("content_subfield"):
        q = rank_to_quartile(g["citescore"].values)
        fr.loc[g.index, "quartile_content"] = q
        fr.loc[g.index, "subfield_size"] = len(g)
    fr["quartile_content"] = fr["quartile_content"].astype(int)
    fr["delta_q"] = fr["quartile_content"] - fr["quartile_cat"]
    fr["changed"] = (fr["delta_q"].abs() >= MOVE_THRESH).astype(int)
    return fr

# ============================================================ 3) NULO ===========
def null_fraction(fr, B=B_NULL, seed=20260731):
    """Permuta las etiquetas de subcampo-de-contenido entre revistas (preserva frecuencias)
    y recomputa F. Devuelve la distribución nula de F."""
    rng = np.random.default_rng(seed)
    labels = fr["content_subfield"].values.copy()
    base = fr[["citescore", "quartile_cat"]].copy()
    Fs = []
    for _ in range(B):
        perm = rng.permutation(labels)
        tmp = base.copy(); tmp["content_subfield"] = perm
        tmp["qc"] = np.nan
        for sf, g in tmp.groupby("content_subfield"):
            tmp.loc[g.index, "qc"] = rank_to_quartile(g["citescore"].values)
        changed = (np.abs(tmp["qc"] - tmp["quartile_cat"]) >= MOVE_THRESH)
        Fs.append(float(changed.mean()))
    return np.array(Fs)

# ============================================================ 4) ASOCIACIÓN =====
def association_test(fr):
    """Regresión logística: changed ~ divergence + controles. p unilateral sobre divergence."""
    try:
        import statsmodels.api as sm
    except Exception:
        print("  (statsmodels no instalado — se omite la regresión; instalar para el test primario)")
        return None
    X = fr[["divergence", "n_asjc", "subfield_size", "entropy"]].copy()
    X["log_output"] = np.log(fr["output"].clip(lower=1))
    X = sm.add_constant(X)
    y = fr["changed"].values
    m = sm.Logit(y, X).fit(disp=0)
    coef = m.params["divergence"]; p_two = m.pvalues["divergence"]
    p_one = p_two / 2 if coef > 0 else 1 - p_two / 2   # unilateral, dirección esperada positiva
    return dict(coef=coef, p_one=p_one, model=m)

# ============================================================ 5) MAIN (Comp. A) =
def main():
    print(BANNER)
    prof = load_profile();            print(f"[perfil] revistas con p_cit válido ({CONFIG_TAG}): {len(prof)}")
    issn_map = load_sources_issn();   print(f"[sources] fuentes OpenAlex con ISSN: {len(issn_map)}")
    jl, _cat = load_citescore(CITESCORE_XLSX); print(f"[scopus] revistas (nivel) con CiteScore: {len(jl)}")

    fr = build_frame(prof, issn_map, jl)
    print(f"[emparejadas] revistas Scopus∩OpenAlex con perfil: {len(fr)}  "
          f"(tasa vs Scopus={len(fr)/max(1,len(jl)):.1%})")
    if len(fr) < 100:
        print("ABORTA: muy pocas revistas emparejadas; revisar SOURCES_TABLE/COLS e ISSNs.", file=sys.stderr)
        sys.exit(2)

    fr = content_quartiles(fr)

    # --- Descriptivo (magnitud) ---
    F = float(fr["changed"].mean())
    print("\n--- Comparación A: cuartil contenido vs categoría ---")
    print(f"  F = fracción que cambia de cuartil (|Δ|≥{MOVE_THRESH}): {F:.1%}  (N={len(fr)})")
    print("  Matriz de transición categoría→contenido:")
    print(pd.crosstab(fr["quartile_cat"], fr["quartile_content"],
                      rownames=["cat"], colnames=["cont"]))

    # --- Nulo de re-agrupamiento ---
    Fnull = null_fraction(fr)
    p95 = float(np.percentile(Fnull, NULL_PCTL))
    excede = F > p95
    print(f"\n  Nulo de re-agrupamiento (B={B_NULL}): F_nulo media={Fnull.mean():.1%} · "
          f"P{NULL_PCTL}={p95:.1%}  →  observado {'EXCEDE' if excede else 'DENTRO de'} el nulo")

    # --- Test de asociación (primario) ---
    assoc = association_test(fr)
    if assoc:
        sig = assoc["p_one"] < ALPHA and assoc["coef"] > 0
        print(f"\n  Asociación divergencia→cambio: coef={assoc['coef']:+.3f} · "
              f"p(unilateral)={assoc['p_one']:.4f}  →  {'SIGNIFICATIVA' if sig else 'no significativa'}")
    else:
        sig = None

    # --- Comparación B: mecanismo blockbuster (§6, prueba causal) ---
    mech_done, mech_ok = MECHANISM_DONE, MECHANISM_OK
    try:
        mech = mecanismo_blockbuster(fr)
        mech_done, mech_ok = mech["done"], mech["ok"]
        if not mech_done:
            print(f"\n  (Comparación B no evaluable: {mech.get('reason','')} — veredicto quedará INCONCLUSO)")
    except Exception as e:
        print(f"\n  (Comparación B no ejecutada: {e}\n"
              f"   ajustar WORKS_TABLE/columnas; el veredicto global quedará INCONCLUSO)")

    # --- Veredicto (regla congelada §7: exige asociación + supera nulo + mecanismo blockbuster) ---
    print("\n--- VEREDICTO (regla congelada §7) ---")
    A_consistent = (sig is True) and excede
    if (sig is False) or (not excede):
        print("  NO CONFIRMA (H0): ya en la Comparación A no hay asociación significativa o el")
        print("  movimiento no supera el nulo. La regla §7 no se cumple.")
    elif not mech_done:
        print("  Comparación A: CONSISTENTE CON H1 (asociación significativa Y F supera el nulo).")
        print("  Pero §7 exige ADEMÁS el mecanismo blockbuster (Comparación B), no evaluable ahora.")
        print("  → VEREDICTO GLOBAL: INCONCLUSO (pendiente Comparación B). NO se declara CONFIRMA.")
    elif A_consistent and mech_ok:
        print("  CONFIRMA (H1): asociación + supera nulo + mecanismo blockbuster robusto (§7 completa).")
    else:
        print("  INCONCLUSO/MIXTO: A consistente pero el mecanismo no sobrevive (top-1%). Reportar sin forzar.")

    # --- Robustez τ (diagnóstico; primaria τ=0.50) ---
    print("\n--- Robustez τ (diagnóstico) ---")
    for tau in (0.48, 0.52):
        fr2 = fr.copy()
        fr2["content_subfield"] = [nucleo(prof[o], tau)[0] for o in fr2["openalex_id"]]
        fr2 = content_quartiles(fr2)
        print(f"  τ={tau}: F={float(fr2['changed'].mean()):.1%}")

    fr.to_csv("estudio1_comparacionA_por_revista.csv", index=False)
    print("\nGuardado: estudio1_comparacionA_por_revista.csv")
    print("Validación externa aparte: correlación análogo-OpenAlex vs CiteScore oficial (Comparación B).")

# ============================================================ 6) MECANISMO (B) ==
def load_works(source_ids):
    """Obras 2021-2024 de las revistas emparejadas, con llave y subcampo homogéneos al perfil.
    Puente (esquema real cris_victoria):
      works.source_id (int) -> sources.id ; se devuelve sources.openalex_id ('S...'),
        que es EXACTAMENTE la llave del frame (fr['openalex_id'] = journal_identity_profile.source_id).
      works.primary_topic_id -> topics.id -> topics.openalex_id ('T...')
        -> openalex_topics.topic_id -> subfield_id ('subfields/2708') -> '2708'
        = código ASJC de 4 dígitos, MISMO espacio que journal_identity_profile.subfield_id
        y que las categorías ASJC de la Comparación A (join por id, sin match de texto).
    Devuelve columnas (source_id='S...', cc=citas, s=código ASJC) que consumen
    groupby('source_id') y _dom_from_counts sin más cambios."""
    with get_conn() as c:
        df = pd.read_sql(
            f"""SELECT s.openalex_id           AS source_id,
                       w.cited_by_count::float AS cc,
                       regexp_replace(ot.subfield_id, '^subfields/', '') AS s
                FROM {WORKS_TABLE} w
                JOIN {SOURCES_JOIN_TABLE} s   ON w.source_id = s.id
                JOIN {TOPICS_TABLE} t         ON w.primary_topic_id = t.id
                JOIN {OA_TOPICS_TABLE} ot     ON t.openalex_id = ot.topic_id
                WHERE w.publication_year BETWEEN 2021 AND 2024
                  AND s.openalex_id = ANY(%(ids)s)""",
            c, params={"ids": list(source_ids)})
    return df

def _dom_from_counts(sub, cc, drop_idx=None):
    """Subcampo dominante del núcleo a partir de conteos de citas por obra, excluyendo drop_idx."""
    agg = {}
    for i, (s_, c_) in enumerate(zip(sub, cc)):
        if drop_idx is not None and i in drop_idx:
            continue
        agg[s_] = agg.get(s_, 0.0) + c_
    tot = sum(agg.values())
    if tot <= 0:
        return None
    dist = {k: v / tot for k, v in agg.items() if v > 0}
    if len(dist) < MIN_SUBFIELDS:
        return None
    return nucleo(dist, TAU)[0]

def mecanismo_blockbuster(fr, seed=20260731, R=R_MECH):
    """Comparación B — prueba CAUSAL del mecanismo (preregistro §6, congelado).
    (i) asociación: tener un artículo top fuera de núcleo predice el movimiento.
    (ii) causalidad: excluir el top-1% POR CITAS revierte el dominante MÁS que excluir
         un 1% ALEATORIO (nulo intra-revista, R sorteos; prueba pareada unilateral).
    Devuelve done/ok y descriptivos. Requiere WORKS_TABLE."""
    from scipy.stats import wilcoxon
    rng = np.random.default_rng(seed)
    works = load_works(fr["openalex_id"].tolist())
    if works.empty:
        return dict(done=False, ok=None, reason="WORKS_TABLE sin filas para las revistas emparejadas")

    asjc_by_oa = dict(zip(fr["openalex_id"], fr["asjc_set"]))
    changed_by_oa = dict(zip(fr["openalex_id"], fr["changed"]))
    recs = []
    for oa, g in works.groupby("source_id"):
        if oa not in asjc_by_oa:
            continue
        cc = g["cc"].values.astype(float); sub = g["s"].values; n = len(g)
        if n < MIN_SUBFIELDS:
            continue
        dom_full = _dom_from_counts(sub, cc)
        if dom_full is None:
            continue
        k = max(1, int(np.ceil(0.01 * n)))            # top-1% (≥1)
        top_idx = set(np.argsort(-cc)[:k].tolist())
        dom_top = _dom_from_counts(sub, cc, drop_idx=top_idx)
        rev_top = int(dom_top is not None and dom_top != dom_full)
        rev_top_tocat = int(rev_top and dom_top in asjc_by_oa[oa])   # revierte HACIA la categoría
        # nulo intra-revista: exclusión de 1% aleatorio (no por citas)
        cnt = 0
        for _ in range(R):
            ridx = set(rng.choice(n, size=k, replace=False).tolist())
            dr = _dom_from_counts(sub, cc, drop_idx=ridx)
            cnt += int(dr is not None and dr != dom_full)
        rev_rand = cnt / R
        # blockbuster fuera de núcleo: la obra más citada cae en subcampo ∉ {dom_full}? (proxy simple)
        top1_sub = sub[int(np.argmax(cc))]
        bb_offnucleus = int(top1_sub != dom_full)
        recs.append(dict(openalex_id=oa, dom_full=dom_full, rev_top=rev_top,
                         rev_top_tocat=rev_top_tocat, rev_rand=rev_rand,
                         bb_offnucleus=bb_offnucleus, changed=int(changed_by_oa.get(oa, 0))))
    m = pd.DataFrame(recs)
    if len(m) < 30:
        return dict(done=False, ok=None, reason=f"muy pocas revistas con obras ({len(m)})")

    # (i) asociación: bb_offnucleus -> changed (unilateral, esperado positivo)
    from scipy.stats import fisher_exact
    tab = pd.crosstab(m["bb_offnucleus"], m["changed"])
    try:
        _, p_assoc = fisher_exact(tab.reindex(index=[0,1], columns=[0,1], fill_value=0), alternative="greater")
    except Exception:
        p_assoc = 1.0
    assoc_ok = p_assoc < ALPHA

    # (ii) causalidad: en las revistas que se MUEVEN, rev_top > rev_rand (pareado, unilateral)
    mv = m[m["changed"] == 1]
    d = (mv["rev_top"] - mv["rev_rand"]).values
    if len(mv) >= 10 and np.any(d != 0):
        try:
            _, p_caus = wilcoxon(d, alternative="greater")
        except Exception:
            p_caus = 1.0
    else:
        p_caus = 1.0
    caus_ok = (p_caus < ALPHA) and (np.mean(d) > 0)

    ok = bool(assoc_ok and caus_ok)
    attrib_frac = float(mv["rev_top"].mean()) if len(mv) else float("nan")
    print("\n--- Comparación B: mecanismo blockbuster (prueba causal §6) ---")
    print(f"  (i)  asociación bb-fuera-de-núcleo → movimiento: p(unilateral)={p_assoc:.4f}  "
          f"→ {'SIGNIFICATIVA' if assoc_ok else 'no'}")
    print(f"  (ii) reversión top-1%(citas) vs aleatorio (movers, N={len(mv)}): "
          f"media(rev_top−rev_rand)={np.mean(d):+.3f} · p={p_caus:.4f}  → {'CAUSAL' if caus_ok else 'no'}")
    print(f"  descriptivo: fracción de movers con reasignación atribuible al blockbuster = {attrib_frac:.1%} "
          f"(de ellas, hacia la categoría: {float(mv['rev_top_tocat'].mean()):.1%})")
    return dict(done=True, ok=ok, p_assoc=p_assoc, p_caus=p_caus,
                attrib_frac=attrib_frac, n_movers=len(mv))

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("ERROR:", e, file=sys.stderr)
        print("Revisá: CONFIG_TAG poblado en journal_identity_profile; SOURCES_TABLE/COLS con ISSNs; "
              "ruta de CiteScore 2025.xlsx; columnas del xlsx sin renombrar.", file=sys.stderr)
        raise
