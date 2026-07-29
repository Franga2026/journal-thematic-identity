# -*- coding: utf-8 -*-
"""
M (cobertura) y D (posición) — descriptores intrínsecos
=======================================================
Implementa la spec científica (docs/paper2/spec_MD_cientifica.md). Pipeline de INFERENCIA:
  Etapa 1  entrada oficial = perfil por revista + E_j (categorías ASJC editoriales)
  Etapa 2  núcleo por masa acumulada τ=0.5, MISMO procedimiento para todas
  Etapa 3  proyección editorial: se localiza E_j DENTRO de la estructura observada
           (no la revista dentro del ranking ASJC)
  Etapa 4  cálculo de M y D, sin interpretación
  Etapa 5  (descriptiva) correlación M↔D, cuadrantes 2×2, ejemplares extremos

NO necesita el ranking por contenido (Path1): todo es intrínseco al perfil + E_j.
Criterios PRE-REGISTRADOS abajo (fijados antes de correr; spec_MD_cientifica.md §4).

E_j: journal_identity_summary.editorial_asjc (ventana = fin de W0), no journal_asjc.source_id.
"""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

# ------------------------------------------------------------------ CONFIG ---
import os
DSN = os.getenv("CRIS_DB_DSN")
if not DSN:
    raise RuntimeError(
        "CRIS_DB_DSN is not set. Provide a PostgreSQL DSN through the environment."
    )
PROFILE_TABLE, W0 = "journal_identity_profile", "W0_2021_2024"
# E_j ya resuelto en el extract Tier-1 (ISSN → journal_asjc → array)
SUMMARY_TABLE = "journal_identity_summary"
SUMMARY_YEAR = 2024  # window_year de W0 (Y de Y-3..Y)
TAU = 0.50            # núcleo: masa acumulada
EPS_DESPL = 0.05      # E_j con masa < EPS → 'desplazada'
M_ALTA = 0.50         # 2×2: M ≥ M_ALTA = alta
FRAC_CORE_NUC = 0.50  # ≥ este umbral de la masa de E_j en el núcleo = 'núcleo'

BANNER = f"""
==============================================================================
 M/D INTRÍNSECOS — criterios PRE-REGISTRADOS (spec_MD_cientifica.md §4)
 M = masa del núcleo cubierta por E_j / masa del núcleo    (0..1)
 D = posición de E_j: 'núcleo' (≥{FRAC_CORE_NUC:.0%} de su masa en el núcleo) /
     'periferia' (presente, fuera del núcleo) / 'desplazada' (masa < {EPS_DESPL})
 2×2:  M alta ≥ {M_ALTA} ;  D cerca = núcleo, lejos = periferia∪desplazada
 Etapa 4 no interpreta; Etapa 5 reporta correlación y cuadrantes contra estos criterios.
==============================================================================
"""


def get_conn():
    try:
        import psycopg
        return psycopg.connect(DSN)
    except Exception:
        import psycopg2
        return psycopg2.connect(DSN)


def load():
    with get_conn() as c:
        prof = pd.read_sql(
            f"""SELECT source_id, subfield_id::text AS s, p_cit
                FROM {PROFILE_TABLE} WHERE config='{W0}'""",
            c,
        )
        ej = pd.read_sql(
            f"""SELECT source_id, unnest(editorial_asjc)::text AS s
                FROM {SUMMARY_TABLE}
                WHERE window_year = {SUMMARY_YEAR}
                  AND editorial_asjc IS NOT NULL
                  AND cardinality(editorial_asjc) > 0""",
            c,
        )
    return prof, ej


def nucleo(dist, tau=TAU):
    s = sorted(dist.items(), key=lambda kv: -kv[1])
    acc, out = 0.0, []
    for k, v in s:
        out.append(k)
        acc += v
        if acc >= tau:
            break
    return set(out)


def norm_ranks(dist):
    """subfield -> rango normalizado (0 = tope de p_cit, 1 = cola)."""
    order = sorted(dist, key=lambda k: -dist[k])
    n = len(order)
    return {k: (i / (n - 1) if n > 1 else 0.0) for i, k in enumerate(order)}


def main():
    print(BANNER)
    prof, ej = load()
    P = {sid: dict(zip(g["s"], g["p_cit"].astype(float))) for sid, g in prof.groupby("source_id")}
    E = {sid: set(g["s"]) for sid, g in ej.groupby("source_id")}
    rows = []
    for sid, d in P.items():
        Ej = E.get(sid, set())
        K = nucleo(d)
        massK = sum(d[s] for s in K)
        # --- Etapa 4: M ---
        m = (sum(d[s] for s in (K & Ej)) / massK) if massK > 0 else np.nan
        jca = sum(d.get(s, 0.0) for s in Ej)
        ej_mass = sum(d[s] for s in Ej if s in d)
        # --- Etapa 4: D ---
        if ej_mass < EPS_DESPL:
            d_cat, d_cont = "desplazada", np.nan
        else:
            frac_core = sum(d[s] for s in (K & Ej)) / ej_mass
            rnk = norm_ranks(d)
            d_cont = sum(d[s] * rnk[s] for s in Ej if s in d) / ej_mass
            d_cat = "núcleo" if frac_core >= FRAC_CORE_NUC else "periferia"
        rows.append(dict(
            source_id=sid, M=m, JCA=jca, ej_mass=ej_mass,
            nK=len(K), nEj=len(Ej), D_cont=d_cont, D_cat=d_cat,
        ))
    r = pd.DataFrame(rows).dropna(subset=["M"])
    n = len(r)

    # --- Etapa 5 (descriptiva) ---
    print(f"[datos] revistas={n}  (sin E_j: {int((r['nEj']==0).sum())})\n")
    print("--- Distribución de M (cobertura estructural) ---")
    q = r["M"].quantile([.1, .25, .5, .75, .9]).round(3).to_dict()
    print(f"  media={r['M'].mean():.3f}  P50={q[0.5]}  IQR=[{q[0.25]},{q[0.75]}]  "
          f"%M<0.2={100*(r['M']<0.2).mean():.1f}%  %M>0.8={100*(r['M']>0.8).mean():.1f}%")
    print(f"  (contraste JCA impacto-total: media={r['JCA'].mean():.3f}; corr(M,JCA)="
          f"{r['M'].corr(r['JCA']):.3f})")

    print("\n--- Distribución de D (categórica) ---")
    print("  " + "  ".join(f"{k}={v} ({v/n:.1%})" for k, v in r["D_cat"].value_counts().items()))

    print("\n--- ¿M y D son independientes? (correlación observada) ---")
    from scipy.stats import pearsonr, spearmanr
    mm = r.dropna(subset=["D_cont"])
    if len(mm) > 3:
        print(f"  corr(M, D_cont) Pearson={pearsonr(mm['M'], mm['D_cont'])[0]:.3f}  "
              f"Spearman={spearmanr(mm['M'], mm['D_cont'])[0]:.3f}  (excluye desplazadas)")
    print("  (se reporta la correlación; NO se colapsan en un índice compuesto — pre-registrado.)")

    # --- Matriz 2×2 ---
    r["M_lvl"] = np.where(r["M"] >= M_ALTA, "M-alta", "M-baja")
    r["D_lvl"] = np.where(r["D_cat"] == "núcleo", "D-cerca", "D-lejos")
    print("\n--- Matriz 2×2 (conteos) ---")
    ct = pd.crosstab(r["M_lvl"], r["D_lvl"])
    print(ct.to_string())

    # --- Ejemplares extremos por cuadrante ---
    print("\n--- Ejemplares extremos por cuadrante ---")

    def extremo(mlvl, dlvl, by, asc):
        sub = r[(r["M_lvl"] == mlvl) & (r["D_lvl"] == dlvl)]
        return sub.sort_values(by, ascending=asc).head(3)[["source_id", "M", "JCA", "D_cont", "D_cat"]]

    print("[M-alta · D-cerca]  (etiqueta representa bien el núcleo) → mayor M:")
    print(extremo("M-alta", "D-cerca", "M", False).to_string(index=False))
    print("[M-baja · D-lejos]  (fuerte discrepancia; tipo JOES) → menor JCA:")
    print(extremo("M-baja", "D-lejos", "JCA", True).to_string(index=False))
    print("[M-baja · D-cerca]  (núcleo coincide, pero mucha diversidad fuera) → menor M con D=núcleo:")
    print(extremo("M-baja", "D-cerca", "M", True).to_string(index=False))
    print("[M-alta · D-lejos]  (cobertura amplia pero desplazada; puede ser raro) → mayor M con D=lejos:")
    print(extremo("M-alta", "D-lejos", "M", False).to_string(index=False))
    print("\nNota: la escasez del cuadrante M-alta/D-lejos, si aparece, es en sí un hallazgo")
    print("(no se puede cubrir el núcleo estando desplazado). Reportar el conteo, no forzarlo.")
    print("\nGuardar esta salida como Etapa 4/5 de M/D. Interpretar contra los criterios pre-registrados.")

    out = Path(__file__).resolve().parent.parent / "data" / "md_intrinsecos_W0.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    r.to_csv(out, index=False)
    print(f"\n[csv] → {out}")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print("ERROR:", e, file=sys.stderr)
        print("Revisá CONFIG (W0 poblado, editorial_asjc en summary).", file=sys.stderr)
        raise
