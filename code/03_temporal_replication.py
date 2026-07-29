# -*- coding: utf-8 -*-
"""
Prueba A′ — Réplica temporal prospectiva (ventana 2021-2024 vs 2022-2025)
=========================================================================
Réplica HACIA ADELANTE de la Prueba A sobre el mismo eje temporal (~75% solape).
NO es una perturbación independiente. Implementa `preregistro_pruebaA_prima.md`
(CONGELADO) + Enmienda 1 (diagnósticos) + Enmienda 2 (alineación técnica).
NO tocar umbrales ni ramas.
Alineación técnica (Enmienda 2): reporta Pearson y Spearman; imprime IQR/P90/%JSD≤0.01
y el diagnóstico de la rejilla; entradas/salidas por ELEGIBILIDAD; panel determinista
(sorted); persiste resultados por revista (CSV) y un manifest_A_prima.json con los
diagnósticos de la Enmienda 1; DSN por variable de entorno.
REJILLA (operacionalización congelada, apples-to-apples; sin estruct_ref):
  estruct_ok   = estructura de A′ cumple los pisos de A
  forma_techo  = las tres correlaciones de forma > 0.95
    estruct_ok & ¬forma_techo → reproduce asimetría (fortalece)
    estruct_ok &  forma_techo → perturbación pequeña (inconcluso, como C0)
   ¬estruct_ok & ¬forma_techo → ambas degradan (debilita)
   ¬estruct_ok &  forma_techo → forma reproduce, estructura no (contradice)
pip install --break-system-packages psycopg[binary] pandas numpy scipy
Requiere: export CRIS_DB_DSN=postgresql://USER:PASSWORD@HOST:5432/DBNAME
"""
import os, sys, json, datetime
import numpy as np
import pandas as pd
# ------------------------------------------------------------------ CONFIG ---
DSN = os.environ.get("CRIS_DB_DSN") or os.environ.get("DSN")
if not DSN:
    print("ERROR: falta la variable de entorno DSN "
          "(export CRIS_DB_DSN=postgresql://USER:PASSWORD@HOST:5432/DBNAME).", file=sys.stderr)
    sys.exit(2)
PROFILE_TABLE = "journal_identity_profile"
CONFIG_A      = "W0_2021_2024"      # ventana 1 (ya existe)
CONFIG_APRIMA = "W+1_2022_2025"     # ventana 2 (poblar con el MISMO pipeline; solo cambia el rango)
YEAR_OUT, YEAR_IN = 2021, 2025      # año que sale / año que entra (fuente de la perturbación)
TAU = 0.50
MIN_SUBFIELDS = 3
JSD_ZERO_TOL = 1e-9                 # Enmienda 2: convención computacional de "JSD>0"
# Referencias de A y bandas (pre-registro §4). NO reinterpretar.
REF_A = dict(jsd=0.046, jacc=1.00, dom=0.822, tci=0.83, hcrudo=0.90, hnorm=0.76)
BAND_JSD, BAND_CORR = 0.010, 0.03
PISO_JSD  = REF_A["jsd"] + BAND_JSD      # <= 0.056
PISO_DOM  = REF_A["dom"] - BAND_CORR     # >= 0.792
TECHO_FORMA = 0.95
# Plumbing atestado (Enmienda 2): tabla anual real del pipeline S / journal_yearly_doc.
# Misma fuente documental usada para S (columna d, no n_docs).
QUERY_YEARLY = """
    SELECT source_id, year::int AS y, subfield_id::text AS s, d::float AS d
    FROM journal_yearly_doc
    WHERE year = ANY(%(years)s)
"""
OUT_CSV = "resultados_A_prima_por_revista.csv"
OUT_MANIFEST = "manifest_A_prima.json"
BANNER = f"""
==============================================================================
 PRUEBA A′ — réplica temporal prospectiva (pre-registro CONGELADO + Enm.1/2)
 Ventanas:  A='{CONFIG_A}'  vs  A′='{CONFIG_APRIMA}'   (solape ~3 años; sale {YEAR_OUT}, entra {YEAR_IN})
 Réplica del eje temporal de A; NO perturbación independiente.
 Referencias A: JSD 0.046 · Jaccard 1.00 · dominante 0.822 · TCI 0.83 · H 0.90 · Hn 0.76
==============================================================================
"""
def get_conn():
    try:
        import psycopg; return psycopg.connect(DSN)
    except Exception:
        import psycopg2; return psycopg2.connect(DSN)
def load_profile(cfg):
    with get_conn() as c:
        return pd.read_sql(f"""SELECT source_id, subfield_id::text AS s, p_cit
                               FROM {PROFILE_TABLE} WHERE config=%(c)s""",
                           c, params={"c": cfg})
def load_yearly():
    try:
        with get_conn() as c:
            return pd.read_sql(QUERY_YEARLY, c, params={"years": [YEAR_OUT, YEAR_IN]})
    except Exception as e:
        print(f"  ⚠ diagnóstico anual no disponible ({e}). Ajustá QUERY_YEARLY.", file=sys.stderr)
        return pd.DataFrame(columns=["source_id", "y", "s", "d"])
def to_dists(df):
    out = {}
    for sid, g in df.groupby("source_id"):
        d = {k: float(v) for k, v in zip(g["s"], g["p_cit"]) if float(v) > 0}
        tot = sum(d.values())
        if tot > 0:
            out[sid] = {k: v / tot for k, v in d.items()}
    return out
def nucleo(dist, tau=TAU):
    s = sorted(dist.items(), key=lambda kv: (-kv[1], kv[0])); acc, out = 0.0, []
    for k, v in s:
        out.append(k); acc += v
        if acc >= tau: break
    return set(out)
def dominant(dist):
    return sorted(dist.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
def jsd(p, q):
    keys = set(p) | set(q)
    P = np.array([p.get(k, 0.0) for k in keys]); Q = np.array([q.get(k, 0.0) for k in keys])
    M = 0.5 * (P + Q)
    def kl(a, b):
        m = a > 0
        return float(np.sum(a[m] * (np.log2(a[m]) - np.log2(b[m]))))
    return 0.5 * kl(P, M) + 0.5 * kl(Q, M)
def H(dist):
    p = np.array([v for v in dist.values() if v > 0]); return float(-np.sum(p * np.log(p)))
def Hnorm(dist):
    k = len([v for v in dist.values() if v > 0]); return H(dist) / np.log(k) if k > 1 else 0.0
def HHI(dist):
    return float(np.sum(np.array(list(dist.values())) ** 2))
def annual_diagnostic(dyear, common_set):
    """Enmienda 1 §2: volumen 2021 vs 2025 y subcampos dominantes, sobre el panel común."""
    if dyear.empty:
        return {"available": False}
    g = dyear[dyear["source_id"].isin(common_set)]
    out = {"available": True, "year_out": YEAR_OUT, "year_in": YEAR_IN}
    for label, yr in (("out", YEAR_OUT), ("in", YEAR_IN)):
        gy = g[g["y"] == yr]
        vol = float(gy["d"].sum())
        by_s = gy.groupby("s")["d"].sum().sort_values(ascending=False)
        top5 = [(str(k), round(float(v) / vol, 4) if vol > 0 else None) for k, v in by_s.head(5).items()]
        out[f"vol_{yr}"] = vol
        out[f"dominant_{yr}"] = (str(by_s.index[0]) if len(by_s) else None)
        out[f"top5_{yr}"] = top5
    v0, v1 = out.get(f"vol_{YEAR_OUT}", 0.0), out.get(f"vol_{YEAR_IN}", 0.0)
    out["vol_abs_diff"] = v1 - v0
    out["vol_rel_diff"] = ((v1 - v0) / v0) if v0 else None
    out["dominant_changed"] = (out.get(f"dominant_{YEAR_OUT}") != out.get(f"dominant_{YEAR_IN}"))
    return out
def main():
    print(BANNER)
    dA, dAp = load_profile(CONFIG_A), load_profile(CONFIG_APRIMA)
    if dA.empty or dAp.empty:
        print("ABORTA: alguna ventana sin filas. Poblá W+1_2022_2025 con el pipeline de A.",
              file=sys.stderr); sys.exit(2)
    PA, PAp = to_dists(dA), to_dists(dAp)
    # ---- Panel por ELEGIBILIDAD (Enmienda 2 punto 3) · determinista (punto 6) ----
    eligible_A  = {sid for sid, d in PA.items()  if len(d) >= MIN_SUBFIELDS}
    eligible_Ap = {sid for sid, d in PAp.items() if len(d) >= MIN_SUBFIELDS}
    common  = sorted(eligible_A & eligible_Ap)
    entries = sorted(eligible_Ap - eligible_A)   # elegibles solo en 2022-2025
    exits   = sorted(eligible_A - eligible_Ap)   # elegibles solo en 2021-2024
    print("--- Panel y elegibilidad (Enmienda 1 §4) ---")
    print(f"  presencia bruta: N(2021-2024)={len(PA)}  N(2022-2025)={len(PAp)}")
    print(f"  elegibles (≥{MIN_SUBFIELDS} subc.): A={len(eligible_A)}  A′={len(eligible_Ap)}")
    print(f"  panel común (elegibles en ambas)={len(common)}  ·  entradas={len(entries)}  ·  salidas={len(exits)}")
    print("  (entradas/salidas = cambio real de elegibilidad; el análisis corre sobre el panel común)\n")
    if len(common) < 30:
        print("ABORTA: panel común < 30.", file=sys.stderr); sys.exit(2)
    # ---- Métricas por revista (con source_id; persistencia, punto 5) ----
    rows = []
    for sid in common:
        p, q = PA[sid], PAp[sid]
        K1, K2 = nucleo(p), nucleo(q)
        rows.append(dict(source_id=sid, jsd=jsd(p, q),
                         jaccard=len(K1 & K2) / len(K1 | K2) if (K1 | K2) else np.nan,
                         dom_eq=(dominant(p) == dominant(q)),
                         dom_A=dominant(p), dom_Ap=dominant(q),
                         tci1=HHI(p), tci2=HHI(q), h1=H(p), h2=H(q), hn1=Hnorm(p), hn2=Hnorm(q)))
    r = pd.DataFrame(rows)
    from scipy.stats import pearsonr, spearmanr
    # === DIAGNÓSTICO DE PERTURBACIÓN (Enmienda 1; NO decide la rejilla) ===
    frac_pos_exact = float((r["jsd"] > 0).mean())
    frac_pos_tol   = float((r["jsd"] > JSD_ZERO_TOL).mean())
    frac_jsd_le001 = float((r["jsd"] <= 0.01).mean())
    q = r["jsd"].quantile([0, .25, .5, .75, .90, 1.0]); iqr = q[.75] - q[.25]
    print("--- DIAGNÓSTICO DE PERTURBACIÓN (Enmienda 1; NO clasifica) ---")
    print(f"  panel común n={len(r)}  ·  JSD>0 (exacto)={frac_pos_exact:.1%}  "
          f"JSD>{JSD_ZERO_TOL:g} (tol)={frac_pos_tol:.1%}  ·  %JSD≤0.01={frac_jsd_le001:.1%}")
    print(f"  JSD: min={q[0]:.4f} P25={q[.25]:.4f} mediana={q[.5]:.4f} media={r['jsd'].mean():.4f} "
          f"P75={q[.75]:.4f} IQR={iqr:.4f} P90={q[.90]:.4f} max={q[1.0]:.4f}")
    if frac_pos_tol < 0.05 or q[.5] < 1e-4:
        print("  ⚠ Perturbación efectiva MUY BAJA: un veredicto inconcluso = 'poca capacidad de prueba', NO refutación.")
    print("  BARANDA: la magnitud NO es umbral; no reclasifica la rejilla ni altera umbrales.\n")
    # === Diagnóstico anual 2021 vs 2025 (Enmienda 1 §2) → manifest ===
    ann = annual_diagnostic(load_yearly(), set(common))
    if ann.get("available"):
        print("--- Diagnóstico anual (panel común) ---")
        print(f"  volumen docs {YEAR_OUT}={ann[f'vol_{YEAR_OUT}']:.0f}  {YEAR_IN}={ann[f'vol_{YEAR_IN}']:.0f}  "
              f"Δabs={ann['vol_abs_diff']:.0f}  Δrel={ann['vol_rel_diff']:.2%}" if ann['vol_rel_diff'] is not None else "")
        print(f"  dominante {YEAR_OUT}={ann[f'dominant_{YEAR_OUT}']}  {YEAR_IN}={ann[f'dominant_{YEAR_IN}']}  "
              f"cambió={ann['dominant_changed']}\n")
    else:
        print("  ⚠ Diagnóstico anual PENDIENTE: configurá QUERY_YEARLY (Enmienda 1 exige estos datos).\n")
    # ---- Estructura ----
    jsd_med = r["jsd"].median(); jac_med = r["jaccard"].median()
    jac_pct = float((r["jaccard"] >= 0.90).mean()); dom_pct = float(r["dom_eq"].mean())
    print("--- Estructura (ref. A entre paréntesis) ---")
    print(f"  JSD mediana={jsd_med:.3f} (A 0.046) | Jaccard mediana={jac_med:.3f} %≥.90={jac_pct:.1%} (A 1.00) | dominante={dom_pct:.1%} (A 82.2%)")
    # ---- Forma (Pearson r Y Spearman ρ — Enmienda 2 punto 1) ----
    def corr(a, b): return pearsonr(r[a], r[b])[0], spearmanr(r[a], r[b])[0]
    tci_r, tci_rho = corr("tci1", "tci2"); h_r, h_rho = corr("h1", "h2"); hn_r, hn_rho = corr("hn1", "hn2")
    print("--- Forma (r Pearson · ρ Spearman; ref. A) ---")
    print(f"  TCI  r={tci_r:.3f} ρ={tci_rho:.3f} (A 0.83) | H cruda r={h_r:.3f} ρ={h_rho:.3f} (A 0.90) | H norm r={hn_r:.3f} ρ={hn_rho:.3f} (A 0.76)")
    # ---- Veredicto: rejilla congelada estruct_ok × forma_techo ----
    estruct_ok  = (jsd_med <= PISO_JSD) and (jac_med >= 1 - 1e-9 and jac_pct >= 0.90) and (dom_pct >= PISO_DOM)
    forma_min   = min(tci_r, h_r, hn_r)
    forma_techo = forma_min > TECHO_FORMA
    print(f"\n  diagnóstico rejilla: estruct_ok={estruct_ok} · forma_min={forma_min:.3f} · forma_techo={forma_techo}")
    if estruct_ok and not forma_techo:
        cell = "REPRODUCE_ASIMETRIA"; msg = "REPRODUCE LA ASIMETRÍA → FORTALECE la generalización temporal."
    elif estruct_ok and forma_techo:
        cell = "INCONCLUSO"; msg = "ESTRUCTURA PRESERVADA pero FORMA EN EL TECHO → perturbación pequeña; INCONCLUSO (como C0)."
    elif (not estruct_ok) and (not forma_techo):
        cell = "DEBILITA"; msg = "ESTRUCTURA Y FORMA SE DEGRADAN → DEBILITA la hipótesis."
    else:
        cell = "CONTRADICE"; msg = "FORMA REPRODUCE Y ESTRUCTURA NO → CONTRADICE la hipótesis para esta ventana."
    print(f"--- Veredicto (rejilla §5, congelada): {cell} ---\n  {msg}")
    print("\n  Reportar A y A′ POR SEPARADO (sin índice compuesto). No tocar umbrales.")
    # ---- Persistencia de artefactos (determinista) ----
    r.sort_values("source_id").to_csv(OUT_CSV, index=False)
    manifest = {
        "computed_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "config_A": CONFIG_A, "config_Aprima": CONFIG_APRIMA,
        "year_out": YEAR_OUT, "year_in": YEAR_IN,
        "panel": {"presencia_A": len(PA), "presencia_Ap": len(PAp),
                  "elegibles_A": len(eligible_A), "elegibles_Ap": len(eligible_Ap),
                  "comun": len(common), "entradas": len(entries), "salidas": len(exits)},
        "perturbacion": {"jsd_gt0_exact": frac_pos_exact, "jsd_gt_tol": frac_pos_tol,
                         "jsd_le_0.01": frac_jsd_le001, "jsd_min": float(q[0]), "jsd_p25": float(q[.25]),
                         "jsd_median": float(q[.5]), "jsd_mean": float(r["jsd"].mean()),
                         "jsd_p75": float(q[.75]), "jsd_iqr": float(iqr), "jsd_p90": float(q[.90]),
                         "jsd_max": float(q[1.0])},
        "anual": ann,
        "estructura": {"jsd_median": jsd_med, "jaccard_median": jac_med, "jaccard_pct_ge_090": jac_pct, "dominante_pct": dom_pct},
        "forma": {"tci_r": tci_r, "tci_rho": tci_rho, "h_r": h_r, "h_rho": h_rho, "hnorm_r": hn_r, "hnorm_rho": hn_rho},
        "rejilla": {"estruct_ok": bool(estruct_ok), "forma_min": forma_min, "forma_techo": bool(forma_techo), "cell": cell},
        "umbrales": {"PISO_JSD": PISO_JSD, "PISO_DOM": PISO_DOM, "TECHO_FORMA": TECHO_FORMA, "TAU": TAU},
    }
    with open(OUT_MANIFEST, "w") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2, default=float)
    print(f"\n  Artefactos: {OUT_CSV} · {OUT_MANIFEST}")
if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("ERROR:", e, file=sys.stderr); raise
