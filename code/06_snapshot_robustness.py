# -*- coding: utf-8 -*-
"""
Prueba C — Reproducibilidad del perfil bajo perturbación de SNAPSHOT
===================================================================
Tercera perturbación independiente (misma ventana, misma taxonomía, mismas
revistas; solo cambia la fecha de extracción de OpenAlex → maduran citas y se
reasignan algunos primary_topic).

Implementa el pre-registro `docs/paper2/preregistro_pruebaC.md` (CONGELADO).
Los umbrales de abajo son PISOS/BANDAS fijados ANTES de ver el segundo snapshot;
NO tocarlos tras correr.

Salida comparable renglón a renglón con §5.2 del manuscrito.
"""
import sys
import numpy as np
import pandas as pd

# ------------------------------------------------------------------ CONFIG ---
import os
DSN = os.getenv("CRIS_DB_DSN")
if not DSN:
    raise RuntimeError(
        "CRIS_DB_DSN is not set. Provide a PostgreSQL DSN through the environment."
    )
PROFILE_TABLE = "journal_identity_profile"
# >>> AJUSTAR: los DOS config-tags de snapshot de la MISMA ventana.
#     Deben diferir SOLO en el snapshot (fecha de extracción), no en la ventana.
CONFIG_S1 = "W0_2021_2024"            # snapshot 1 (extracción previa)
CONFIG_S2 = "W0_2021_2024_snap2"      # snapshot 2 (extracción posterior)  <-- crear/poblar
TAU = 0.50                 # operador de núcleo (idéntico a A/B)
MIN_SUBFIELDS = 3          # regla de "masa suficiente": < 3 subcampos => excluida

# --- Umbrales PRE-REGISTRADOS (preregistro_pruebaC.md §3). NO reinterpretar. ---
REF_A = dict(jsd=0.046, jacc=1.00, dom=0.822, tci=0.83, hcrudo=0.90, hnorm=0.76)
BAND_JSD = 0.010
BAND_CORR = 0.03
PISO_JSD = REF_A["jsd"] + BAND_JSD        # <= 0.056
PISO_JACC_PCT = 0.90
PISO_DOM = REF_A["dom"] - BAND_CORR       # >= 0.792
PISO_TCI = REF_A["tci"] - BAND_CORR       # >= 0.80
PISO_HCRU = REF_A["hcrudo"] - BAND_CORR   # >= 0.87
PISO_HNORM = REF_A["hnorm"] - BAND_CORR   # >= 0.73

BANNER = f"""
==============================================================================
 PRUEBA C — perturbación de SNAPSHOT  (pre-registro CONGELADO)
 Snapshots:  S1='{CONFIG_S1}'   vs   S2='{CONFIG_S2}'
 Núcleo τ={TAU} · desempate estable (-p_cit, subfield_id) · idéntico en S1/S2
 Pisos:  JSD<= {PISO_JSD:.3f} · Jaccard med=1.00 & %>=.90 >= {PISO_JACC_PCT:.0%}
         dominante >= {PISO_DOM:.3f} · TCI r>= {PISO_TCI:.2f}
         H_cruda r>= {PISO_HCRU:.2f} · H_norm r>= {PISO_HNORM:.2f}
 Estructura vs forma, veredictos SEPARADOS, sin índice compuesto.
==============================================================================
"""


def get_conn():
    try:
        import psycopg
        return psycopg.connect(DSN)
    except Exception:
        import psycopg2
        return psycopg2.connect(DSN)


def load(config):
    with get_conn() as c:
        df = pd.read_sql(
            f"""SELECT source_id, subfield_id::text AS s, p_cit
                FROM {PROFILE_TABLE} WHERE config = %(cfg)s""",
            c,
            params={"cfg": config},
        )
    return df


def to_dists(df):
    """source_id -> {subfield: p_cit(float)}, renormalizado por seguridad."""
    out = {}
    for sid, g in df.groupby("source_id"):
        d = dict(zip(g["s"], g["p_cit"].astype(float)))
        tot = sum(v for v in d.values() if v > 0)
        if tot > 0:
            out[sid] = {k: v / tot for k, v in d.items() if v > 0}
    return out


def nucleo(dist, tau=TAU):
    # orden estable: por -p_cit y, a igualdad, por subfield_id (desempate fijo)
    s = sorted(dist.items(), key=lambda kv: (-kv[1], kv[0]))
    acc, out = 0.0, []
    for k, v in s:
        out.append(k)
        acc += v
        if acc >= tau:
            break
    return set(out)


def dominant(dist):
    return sorted(dist.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]


def jsd(p, q):
    """Divergencia Jensen-Shannon, base 2, sobre el soporte unión. En [0,1]."""
    keys = set(p) | set(q)
    P = np.array([p.get(k, 0.0) for k in keys])
    Q = np.array([q.get(k, 0.0) for k in keys])
    M = 0.5 * (P + Q)

    def kl(a, b):
        mask = a > 0
        return float(np.sum(a[mask] * (np.log2(a[mask]) - np.log2(b[mask]))))

    return 0.5 * kl(P, M) + 0.5 * kl(Q, M)


def H(dist):
    p = np.array([v for v in dist.values() if v > 0])
    return float(-np.sum(p * np.log(p)))


def Hnorm(dist):
    k = len([v for v in dist.values() if v > 0])
    return H(dist) / np.log(k) if k > 1 else 0.0


def HHI(dist):
    return float(np.sum(np.array(list(dist.values())) ** 2))


def main():
    print(BANNER)
    # ---------------------------------------------- 1) COMPARABILIDAD (aborta) --
    d1_raw, d2_raw = load(CONFIG_S1), load(CONFIG_S2)
    if d1_raw.empty or d2_raw.empty:
        print(
            "ABORTA: uno de los snapshots no devolvió filas. "
            "Revisá CONFIG_S1/CONFIG_S2 y que ambos estén poblados.",
            file=sys.stderr,
        )
        sys.exit(2)
    P1_all, P2_all = to_dists(d1_raw), to_dists(d2_raw)
    N1, N2 = len(P1_all), len(P2_all)
    common = [
        sid
        for sid in (set(P1_all) & set(P2_all))
        if len(P1_all[sid]) >= MIN_SUBFIELDS and len(P2_all[sid]) >= MIN_SUBFIELDS
    ]
    excl_pocos = len(set(P1_all) & set(P2_all)) - len(common)
    solo1 = len(set(P1_all) - set(P2_all))
    solo2 = len(set(P2_all) - set(P1_all))
    print("--- 1) Comparabilidad (condiciones 1–6 del pre-registro) ---")
    print(f"  N_S1={N1}  N_S2={N2}  intersección={len(set(P1_all)&set(P2_all))}")
    print(f"  cohorte común (>= {MIN_SUBFIELDS} subcampos en ambos) = {len(common)}")
    print(f"  exclusiones: <{MIN_SUBFIELDS} subcampos={excl_pocos} · solo_S1={solo1} · solo_S2={solo2}")
    if len(common) < 30:
        print(
            "ABORTA: cohorte común < 30 revistas; snapshots no comparables o mal poblados.",
            file=sys.stderr,
        )
        sys.exit(2)
    print(
        "  → mismas revistas/obras, misma ventana y taxonomía: verificar que CONFIG_* "
        "difieran SOLO en snapshot. Núcleo y desempate idénticos por construcción.\n"
    )

    # ---------------------------------------------------- 2) MÉTRICAS por revista
    rows = []
    for sid in common:
        p, q = P1_all[sid], P2_all[sid]
        K1, K2 = nucleo(p), nucleo(q)
        jac = len(K1 & K2) / len(K1 | K2) if (K1 | K2) else np.nan
        rows.append(dict(
            source_id=sid,
            jsd=jsd(p, q),
            jaccard=jac,
            dom_eq=(dominant(p) == dominant(q)),
            tci1=HHI(p), tci2=HHI(q),
            h1=H(p), h2=H(q),
            hn1=Hnorm(p), hn2=Hnorm(q),
        ))
    r = pd.DataFrame(rows)

    from scipy.stats import pearsonr, spearmanr

    # ---------------------------------------------------------- 3) ESTRUCTURA ---
    jsd_med = r["jsd"].median()
    jsd_iqr = (r["jsd"].quantile(.25), r["jsd"].quantile(.75))
    jsd_p90 = r["jsd"].quantile(.90)
    jac_med = r["jaccard"].median()
    jac_pct = (r["jaccard"] >= 0.90).mean()
    dom_pct = r["dom_eq"].mean()
    pass_jsd = jsd_med <= PISO_JSD
    pass_jac = (jac_med >= 1.00 - 1e-9) and (jac_pct >= PISO_JACC_PCT)
    pass_dom = dom_pct >= PISO_DOM
    print("--- 3) ESTRUCTURA (por revista; referencia A entre paréntesis) ---")
    print(f"  JSD masa:  mediana={jsd_med:.3f}  IQR=[{jsd_iqr[0]:.3f},{jsd_iqr[1]:.3f}]  "
          f"P90={jsd_p90:.3f}   (A=0.046)  piso<= {PISO_JSD:.3f}  -> {'PASS' if pass_jsd else 'FALLA'}")
    print(f"  Jaccard núcleo:  mediana={jac_med:.3f}  %(>=0.90)={jac_pct:.1%}   (A=1.00)  "
          f"-> {'PASS' if pass_jac else 'FALLA'}")
    print(f"  Dominante preservado:  {dom_pct:.1%}   (A=82.2%)  piso>= {PISO_DOM:.1%}  "
          f"-> {'PASS' if pass_dom else 'FALLA'}")

    # -------------------------------------------------------------- 4) FORMA ---
    def corr(a, b):
        return pearsonr(r[a], r[b])[0], spearmanr(r[a], r[b])[0]

    tci_r, tci_rho = corr("tci1", "tci2")
    h_r, h_rho = corr("h1", "h2")
    hn_r, hn_rho = corr("hn1", "hn2")
    pass_tci = tci_r >= PISO_TCI
    pass_h = h_r >= PISO_HCRU
    pass_hn = hn_r >= PISO_HNORM
    estruct_ref = min(dom_pct, jac_pct)
    asim_tci = tci_r < estruct_ref
    asim_h = h_r < estruct_ref
    asim_hn = hn_r < estruct_ref
    print("\n--- 4) FORMA (entre revistas; r Pearson · ρ Spearman) ---")
    print(f"  TCI (HHI):        r={tci_r:.3f}  ρ={tci_rho:.3f}   (A=0.83)  piso>= {PISO_TCI:.2f}  "
          f"-> {'PASS' if pass_tci else 'FALLA'}  · asimetría(<estruct)={'sí' if asim_tci else 'NO'}")
    print(f"  Entropía cruda:   r={h_r:.3f}  ρ={h_rho:.3f}   (A=0.90)  piso>= {PISO_HCRU:.2f}  "
          f"-> {'PASS' if pass_h else 'FALLA'}  · asimetría(<estruct)={'sí' if asim_h else 'NO'}")
    print(f"  Entropía norm.:   r={hn_r:.3f}  ρ={hn_rho:.3f}   (A=0.76)  piso>= {PISO_HNORM:.2f}  "
          f"-> {'PASS' if pass_hn else 'FALLA'}  · asimetría(<estruct)={'sí' if asim_hn else 'NO'}")

    # ---------------------------------------------------------- 5) VEREDICTOS ---
    est_pasos = sum([pass_jsd, pass_jac, pass_dom])
    if est_pasos == 3:
        vered_est = "ÉXITO"
    elif est_pasos == 2:
        vered_est = "PARCIAL"
    else:
        vered_est = "FRACASO"
    forma_pisos = all([pass_tci, pass_h, pass_hn])
    forma_asim = all([asim_tci, asim_h, asim_hn])
    vered_forma = "CONSISTENTE CON LA PREDICCIÓN" if (forma_pisos and forma_asim) else "DIVERGENTE"
    print("\n--- 5) VEREDICTOS (separados; sin índice compuesto) ---")
    print(f"  ESTRUCTURAL: {vered_est}   ({est_pasos}/3 pisos)")
    print(f"  FORMA:       {vered_forma}   (pisos {'ok' if forma_pisos else 'NO'} · "
          f"asimetría estructura>forma {'ok' if forma_asim else 'NO'})")

    # ------------------------------------------- 6) VÍNCULO CON LA HIPÓTESIS ---
    print("\n--- 6) Vínculo con la hipótesis de estabilidad (preregistro §5) ---")
    if vered_est == "ÉXITO" and forma_asim:
        print("  FORTALECE: estructura reproduce y la asimetría estructura>forma persiste")
        print("  bajo un tercer mecanismo independiente. Cabe RECONSIDERAR la elevación")
        print("  de la hipótesis estructura/dinámica (tres perturbaciones convergentes).")
    elif (vered_est == "FRACASO") or (not forma_asim):
        print("  DEBILITA el respaldo empírico (sin invalidar el núcleo deductivo del marco):")
        print("  la estructura degradó bajo una perturbación MÁS SUAVE que A, o la asimetría")
        print("  se invirtió (forma >= estructura). Reportar como resultado en contra.")
    else:
        print("  PARCIAL / INFORMATIVO: veredicto estructural PARCIAL. Diagnosticar la naturaleza")
        print("  del faltante (p. ej. cardinalidad del núcleo) sin mover umbrales; reportar como en B.")
    print("\nGuardar esta salida como Prueba C. Interpretar SOLO contra el pre-registro congelado.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("ERROR:", e, file=sys.stderr)
        print(
            "Revisá: ambos CONFIG_* poblados, columnas source_id/subfield_id/p_cit/config, "
            "y que los snapshots difieran solo en la fecha de extracción.",
            file=sys.stderr,
        )
        raise
