#!/usr/bin/env python3
"""
jca_discriminant_validity.py — Pre-registro: validez discriminante de JCA.

Congelado 2026-07-22. No reinterpretar umbrales post-hoc.
Ver reglas en el prompt de pre-registro (R² base, ΔAIC, CV AUC, etc.).

Uso:
  python jca_discriminant_validity.py --year 2024
  python jca_discriminant_validity.py --year 2024 --json-out data/jca_discriminant_2024.json
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import psycopg
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, mean_squared_error, r2_score
from sklearn.model_selection import StratifiedKFold, KFold
import statsmodels.api as sm
from statsmodels.stats.outliers_influence import variance_inflation_factor

_SCRIPTS = Path(__file__).resolve().parent
_API_ROOT = _SCRIPTS.parent
sys.path.insert(0, str(_API_ROOT))
from db import DSN  # noqa: E402

warnings.filterwarnings("ignore", category=RuntimeWarning)

# ── Umbrales pre-registrados (NO cambiar) ──────────────────────────────────
R2_SURVIVE_MAX = 0.40
R2_ABSORB_MIN = 0.80
DAIC_SURVIVE = 2.0
LR_P_SURVIVE = 0.05


def q_num(q) -> float | None:
    if q is None:
        return None
    s = str(q).upper()
    if s.startswith("Q") and s[1:].isdigit():
        return float(s[1])
    return None


def load_frame(conn, window_year: int) -> pd.DataFrame:
    """
    Una fila por revista con JCA.
    Núcleo operativo: core_subfield si tiene fila en journal_frame_index;
    si no, principal_field (enmienda operativa documentada abajo).
    """
    sql = """
    WITH base AS (
      SELECT
        s.source_id,
        s.name,
        s.jca::float AS jca,
        s.docs_total::float AS n_docs,
        s.entropy_norm::float AS h,
        s.core_subfield,
        COALESCE(cardinality(s.editorial_asjc), 0)::float AS n_e_summary,
        f.principal_field,
        f.headline_verdict,
        f.headline_status
      FROM journal_identity_summary s
      JOIN journal_frame_summary f ON f.source_id = s.source_id
      WHERE s.window_year = %s AND s.jca IS NOT NULL AND s.docs_total > 0
    ),
    core_hit AS (
      SELECT b.*, i.field_code AS nucleus_field,
             i.frame_status, i.verdict,
             i.content_q, i.editorial_q_efectivo, i.content_pct::float AS p_content,
             i.scopus_q, i.editorial_q,
             'core_subfield'::text AS nucleus_source
      FROM base b
      JOIN journal_frame_index i
        ON i.source_id = b.source_id AND i.field_code = b.core_subfield
    ),
    principal_hit AS (
      SELECT b.*, i.field_code AS nucleus_field,
             i.frame_status, i.verdict,
             i.content_q, i.editorial_q_efectivo, i.content_pct::float AS p_content,
             i.scopus_q, i.editorial_q,
             'principal_field'::text AS nucleus_source
      FROM base b
      JOIN journal_frame_index i
        ON i.source_id = b.source_id AND i.field_code = b.principal_field
      WHERE NOT EXISTS (
        SELECT 1 FROM core_hit c WHERE c.source_id = b.source_id
      )
    ),
    united AS (
      SELECT * FROM core_hit
      UNION ALL
      SELECT * FROM principal_hit
    )
    SELECT * FROM united
    """
    df = pd.read_sql(sql, conn, params=(window_year,))

    # |E_j|: preferir editorial_asjc del extract (= journal_asjc activo por ISSN)
    # (el bloque de conteo ISSN queda abajo solo para n_e=0)
    df["n_e"] = df["n_e_summary"].fillna(0.0)
    # Si el array del extract está vacío, contar desde journal_asjc por ISSN
    missing = df.loc[df["n_e"] <= 0, "source_id"].tolist()
    if missing:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT o.source_id, COUNT(DISTINCT j.asjc_code)::float
                FROM openalex_sources o
                CROSS JOIN LATERAL unnest(
                    COALESCE(o.issns, ARRAY[]::text[]) || ARRAY[o.issn_l]
                ) AS u(raw)
                JOIN journal_asjc j
                  ON j.active
                 AND lpad(replace(j.issn_l,'-',''),8,'0')
                   = lpad(replace(u.raw,'-',''),8,'0')
                WHERE o.source_id = ANY(%s) AND u.raw IS NOT NULL AND u.raw <> ''
                GROUP BY o.source_id
                """,
                (missing,),
            )
            for sid, n in cur.fetchall():
                df.loc[df["source_id"] == sid, "n_e"] = n


    # Percentil editorial: jss_asjc → citescore_2025
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT source_id,
                   regexp_replace(subfield_id, '^(subfields/|asjc/)', '') AS field_code,
                   dc_percentile::float
            FROM discovery_cite_metrics
            WHERE year = %s AND method = 'jss_asjc' AND dc_percentile IS NOT NULL
            """,
            (window_year,),
        )
        asjc_pct = {(r[0], str(r[1])): r[2] for r in cur.fetchall()}

        cur.execute(
            """
            SELECT o.source_id, c.asjc_code::text, c.percentile::float
            FROM openalex_sources o
            JOIN citescore_2025 c
              ON (
                (c.print_issn IS NOT NULL AND c.print_issn <> ''
                 AND lpad(replace(c.print_issn,'-',''),8,'0')
                   = ANY (
                     SELECT lpad(replace(x,'-',''),8,'0')
                     FROM unnest(COALESCE(o.issns, ARRAY[]::text[]) || ARRAY[o.issn_l]) x
                     WHERE x IS NOT NULL AND x <> ''
                   ))
                OR
                (c.eissn IS NOT NULL AND c.eissn <> ''
                 AND lpad(replace(c.eissn,'-',''),8,'0')
                   = ANY (
                     SELECT lpad(replace(x,'-',''),8,'0')
                     FROM unnest(COALESCE(o.issns, ARRAY[]::text[]) || ARRAY[o.issn_l]) x
                     WHERE x IS NOT NULL AND x <> ''
                   ))
              )
            WHERE o.source_id = ANY(%s) AND c.percentile IS NOT NULL
            """,
            (df["source_id"].tolist(),),
        )
        cs_pct = {}
        for sid, code, pct in cur.fetchall():
            key = (sid, str(code))
            # percentil Scopus 0-100; quedarse con el mayor si hay empate ISSN
            if key not in cs_pct or pct > cs_pct[key]:
                cs_pct[key] = pct

    p_ed = []
    d_vals = []
    d_method = []
    m_vals = []
    for _, row in df.iterrows():
        key = (row["source_id"], str(row["nucleus_field"]))
        pe = asjc_pct.get(key)
        if pe is None:
            pe = cs_pct.get(key)
        p_ed.append(pe)

        verdict = row["verdict"]
        status = row["frame_status"]
        m = 1 if (status == "comparable" and verdict in ("robusto", "depende")) else 0
        # solo_contenido / solo_editorial / pendientes → M=0
        m_vals.append(m)

        pc = row["p_content"]
        cq, eq = q_num(row["content_q"]), q_num(row["editorial_q_efectivo"])
        if m == 1 and pc is not None and pe is not None:
            d_vals.append(abs(float(pc) - float(pe)))
            d_method.append("percentile")
        elif m == 1 and cq is not None and eq is not None:
            d_vals.append(abs(cq - eq))
            d_method.append("quartile_fallback")
        else:
            d_vals.append(np.nan)
            d_method.append(None)

    df["p_editorial"] = p_ed
    df["M"] = m_vals
    df["D"] = d_vals
    df["D_method"] = d_method
    df["logN"] = np.log(df["n_docs"].clip(lower=1))
    df["h"] = df["h"].fillna(0.0)
    return df


def corr_matrix(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    return df[cols].corr(method="pearson")


def vif_table(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    X = sm.add_constant(df[cols].astype(float))
    rows = []
    for i, col in enumerate(X.columns):
        if col == "const":
            continue
        rows.append({"var": col, "VIF": float(variance_inflation_factor(X.values, i))})
    return pd.DataFrame(rows)


def jca_distribution(series: pd.Series) -> dict:
    s = series.dropna().astype(float)
    deciles = {f"d{i}": float(np.quantile(s, i / 10)) for i in range(1, 10)}
    return {
        "n": int(len(s)),
        "mean": float(s.mean()),
        "sd": float(s.std(ddof=1)),
        "iqr": float(s.quantile(0.75) - s.quantile(0.25)),
        "p25": float(s.quantile(0.25)),
        "p50": float(s.quantile(0.50)),
        "p75": float(s.quantile(0.75)),
        "deciles": deciles,
        "pct_lt_0_20": float((s < 0.20).mean() * 100),
        "pct_lt_0_30": float((s < 0.30).mean() * 100),
        "n_lt_0_20": int((s < 0.20).sum()),
        "n_lt_0_30": int((s < 0.30).sum()),
    }


def ols_base(df: pd.DataFrame) -> dict:
    y = df["jca"].astype(float)
    X = sm.add_constant(df[["n_e", "logN", "h"]].astype(float))
    X = X.rename(columns={"n_e": "E", "logN": "logN", "h": "H"})
    model = sm.OLS(y, X).fit()
    resid_sd = float(np.std(model.resid, ddof=1))
    return {
        "n": int(model.nobs),
        "r2": float(model.rsquared),
        "r2_adj": float(model.rsquared_adj),
        "resid_sd": resid_sd,
        "params": {k: float(v) for k, v in model.params.items()},
        "pvalues": {k: float(v) for k, v in model.pvalues.items()},
        "summary": model.summary().as_text(),
    }


def nested_logit_M(df: pd.DataFrame) -> dict:
    d = df.dropna(subset=["jca", "n_e", "logN", "h", "M"]).copy()
    y = d["M"].astype(int)
    X0 = sm.add_constant(d[["n_e", "logN", "h"]].astype(float))
    X1 = sm.add_constant(d[["jca", "n_e", "logN", "h"]].astype(float))
    X0.columns = ["const", "E", "logN", "H"]
    X1.columns = ["const", "JCA", "E", "logN", "H"]

    m0 = sm.Logit(y, X0).fit(disp=False)
    m1 = sm.Logit(y, X1).fit(disp=False)

    # LR test
    lr_stat = 2 * (m1.llf - m0.llf)
    from scipy import stats as scipy_stats

    lr_p = float(scipy_stats.chi2.sf(lr_stat, 1))

    # partial corr JCA~M | structural: residualize both
    r_j = sm.OLS(d["jca"], X0).fit().resid
    r_m = sm.OLS(y.astype(float), X0).fit().resid
    partial = float(np.corrcoef(r_j, r_m)[0, 1])

    # 5-fold CV AUC
    def cv_auc(with_jca: bool) -> float:
        skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
        feats = ["jca", "n_e", "logN", "h"] if with_jca else ["n_e", "logN", "h"]
        X = d[feats].astype(float).values
        yt = y.values
        scores = []
        for tr, te in skf.split(X, yt):
            if len(np.unique(yt[tr])) < 2 or len(np.unique(yt[te])) < 2:
                continue
            clf = LogisticRegression(max_iter=1000, solver="lbfgs")
            clf.fit(X[tr], yt[tr])
            proba = clf.predict_proba(X[te])[:, 1]
            scores.append(roc_auc_score(yt[te], proba))
        return float(np.mean(scores)) if scores else float("nan")

    auc0 = cv_auc(False)
    auc1 = cv_auc(True)

    return {
        "n": int(len(d)),
        "n_M1": int(y.sum()),
        "n_M0": int((y == 0).sum()),
        "without_jca": {
            "pseudo_r2_mcfadden": float(m0.prsquared),
            "aic": float(m0.aic),
            "bic": float(m0.bic),
            "llf": float(m0.llf),
            "params": {k: float(v) for k, v in m0.params.items()},
            "pvalues": {k: float(v) for k, v in m0.pvalues.items()},
            "cv_auc": auc0,
        },
        "with_jca": {
            "pseudo_r2_mcfadden": float(m1.prsquared),
            "aic": float(m1.aic),
            "bic": float(m1.bic),
            "llf": float(m1.llf),
            "params": {k: float(v) for k, v in m1.params.items()},
            "pvalues": {k: float(v) for k, v in m1.pvalues.items()},
            "cv_auc": auc1,
        },
        "delta_pseudo_r2": float(m1.prsquared - m0.prsquared),
        "delta_aic": float(m0.aic - m1.aic),  # >0 ⇒ with JCA better
        "delta_bic": float(m0.bic - m1.bic),
        "lr_stat": float(lr_stat),
        "lr_pvalue": lr_p,
        "delta_cv_auc": float(auc1 - auc0),
        "partial_corr_jca_M": partial,
    }


def nested_ols_D(df: pd.DataFrame) -> dict:
    d = df[df["M"] == 1].dropna(subset=["jca", "n_e", "logN", "h", "D"]).copy()
    if len(d) < 30:
        return {"n": int(len(d)), "note": "n insuficiente"}

    y = d["D"].astype(float)
    X0 = sm.add_constant(d[["n_e", "logN", "h"]].astype(float))
    X1 = sm.add_constant(d[["jca", "n_e", "logN", "h"]].astype(float))
    X0.columns = ["const", "E", "logN", "H"]
    X1.columns = ["const", "JCA", "E", "logN", "H"]
    m0 = sm.OLS(y, X0).fit()
    m1 = sm.OLS(y, X1).fit()

    r_j = sm.OLS(d["jca"], X0).fit().resid
    r_d = sm.OLS(y, X0).fit().resid
    partial = float(np.corrcoef(r_j, r_d)[0, 1])

    def cv_metrics(with_jca: bool):
        kf = KFold(n_splits=5, shuffle=True, random_state=42)
        feats = ["jca", "n_e", "logN", "h"] if with_jca else ["n_e", "logN", "h"]
        X = d[feats].astype(float).values
        yt = y.values
        rmses, r2s = [], []
        for tr, te in kf.split(X):
            Xtr = sm.add_constant(X[tr], has_constant="add")
            Xte = sm.add_constant(X[te], has_constant="add")
            fit = sm.OLS(yt[tr], Xtr).fit()
            pred = fit.predict(Xte)
            rmses.append(math.sqrt(mean_squared_error(yt[te], pred)))
            r2s.append(r2_score(yt[te], pred))
        return float(np.mean(rmses)), float(np.mean(r2s))

    rmse0, r2cv0 = cv_metrics(False)
    rmse1, r2cv1 = cv_metrics(True)

    # LR-style F-test for nested OLS via compare
    # statsmodels ANOVA nested
    from statsmodels.stats.anova import anova_lm

    try:
        an = anova_lm(m0, m1)
        f_p = float(an["Pr(>F)"].iloc[1])
    except Exception:
        f_p = None

    return {
        "n": int(len(d)),
        "d_methods": d["D_method"].value_counts(dropna=False).to_dict(),
        "without_jca": {
            "r2": float(m0.rsquared),
            "aic": float(m0.aic),
            "bic": float(m0.bic),
            "cv_rmse": rmse0,
            "cv_r2": r2cv0,
            "params": {k: float(v) for k, v in m0.params.items()},
            "pvalues": {k: float(v) for k, v in m0.pvalues.items()},
        },
        "with_jca": {
            "r2": float(m1.rsquared),
            "aic": float(m1.aic),
            "bic": float(m1.bic),
            "cv_rmse": rmse1,
            "cv_r2": r2cv1,
            "params": {k: float(v) for k, v in m1.params.items()},
            "pvalues": {k: float(v) for k, v in m1.pvalues.items()},
        },
        "delta_r2": float(m1.rsquared - m0.rsquared),
        "delta_aic": float(m0.aic - m1.aic),
        "delta_bic": float(m0.bic - m1.bic),
        "nested_F_pvalue": f_p,
        "delta_cv_rmse": float(rmse0 - rmse1),
        "delta_cv_r2": float(r2cv1 - r2cv0),
        "partial_corr_jca_D": partial,
    }


def stability_by_field(df: pd.DataFrame, min_n: int = 30) -> list[dict]:
    """Reajusta logit M ~ JCA + E + logN + H dentro de cada nucleus_field con n≥30."""
    out = []
    for field, g in df.groupby("nucleus_field"):
        if len(g) < min_n:
            continue
        if g["M"].nunique() < 2:
            out.append(
                {
                    "field": field,
                    "n": int(len(g)),
                    "note": "M sin variación",
                    "beta_jca": None,
                    "pvalue": None,
                }
            )
            continue
        y = g["M"].astype(int)
        X = sm.add_constant(g[["jca", "n_e", "logN", "h"]].astype(float))
        X.columns = ["const", "JCA", "E", "logN", "H"]
        try:
            m = sm.Logit(y, X).fit(disp=False)
            out.append(
                {
                    "field": str(field),
                    "n": int(len(g)),
                    "n_M1": int(y.sum()),
                    "beta_jca": float(m.params["JCA"]),
                    "pvalue": float(m.pvalues["JCA"]),
                    "sign": "+" if m.params["JCA"] > 0 else "-",
                }
            )
        except Exception as exc:
            out.append(
                {
                    "field": str(field),
                    "n": int(len(g)),
                    "note": str(exc),
                    "beta_jca": None,
                    "pvalue": None,
                }
            )
    return out


def decide_status(base: dict, m_inc: dict, field_stab: list[dict]) -> dict:
    """Aplica tabla de resultados pre-definida."""
    r2 = base["r2"]
    daic = m_inc["delta_aic"]
    lr_p = m_inc["lr_pvalue"]
    d_auc = m_inc["delta_cv_auc"]
    auc_improved = d_auc > 0 and not math.isnan(d_auc)

    incremental_ok = (daic >= DAIC_SURVIVE or lr_p < LR_P_SURVIVE) and auc_improved
    incremental_marginal = (0 <= daic < DAIC_SURVIVE) and not (
        lr_p < LR_P_SURVIVE and auc_improved
    )

    signs = [f["sign"] for f in field_stab if f.get("sign")]
    unstable = len(set(signs)) > 1 if len(signs) >= 2 else False

    if unstable:
        status = "inestable_por_campo"
        consequence = (
            "No es un puntaje global válido → modelar por disciplina o abandonar score global"
        )
    elif r2 >= R2_ABSORB_MIN and not incremental_ok:
        status = "absorbido"
        consequence = (
            "No es constructo independiente → simplificar/reformular/descriptor derivado; "
            "NO venderlo como novedad"
        )
    elif r2 <= R2_SURVIVE_MAX and incremental_ok:
        status = "sobrevive"
        consequence = (
            "Dimensión autónoma de alineación temática → sección analítica propia; "
            "JCA es eje descriptivo del paper"
        )
    elif (R2_SURVIVE_MAX < r2 < R2_ABSORB_MIN) or incremental_marginal or (
        r2 <= R2_SURVIVE_MAX and not incremental_ok
    ):
        status = "pierde_fuerza_pero_no_desaparece"
        consequence = (
            "Indicador parcialmente ligado a interdisciplinariedad, utilidad incremental "
            "limitada → descriptor con caveat; no lidera"
        )
    else:
        # r2 alto pero con aporte incremental raro
        status = "pierde_fuerza_pero_no_desaparece"
        consequence = (
            "Caso intermedio no cubierto de forma limpia → tratar como descriptor con caveat"
        )

    return {
        "status": status,
        "consequence": consequence,
        "checks": {
            "r2_base": r2,
            "r2_survive_max": R2_SURVIVE_MAX,
            "r2_absorb_min": R2_ABSORB_MIN,
            "delta_aic_M": daic,
            "lr_pvalue_M": lr_p,
            "delta_cv_auc_M": d_auc,
            "incremental_ok": incremental_ok,
            "field_signs": signs,
            "unstable_by_field": unstable,
        },
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2024)
    ap.add_argument("--dsn", default=DSN)
    ap.add_argument("--json-out", default="")
    args = ap.parse_args()

    conn = psycopg.connect(args.dsn)
    df = load_frame(conn, args.year)
    conn.close()

    print(f"=== Pre-registro JCA — window_year={args.year} ===")
    print(f"n revistas={len(df)}  nucleus_source: {df['nucleus_source'].value_counts().to_dict()}")
    print(
        "ENMIENDA OPERATIVA (2026-07-22): si core_subfield no tiene fila en "
        "journal_frame_index, se usa principal_field como núcleo para M/D."
    )
    print("NOTA: S (estabilidad) excluida por bug de lag — no entra en este análisis.\n")

    # 2 · Colinealidad primero en espíritu del pre-reg (orden: 1 base, 2 coli, 3 nested)
    # Ejecutamos 1 luego 2 luego 3 como especifica el orden.

    # 1 · Modelo base
    base = ols_base(df)
    print("── 1 · Modelo base: JCA ~ |E| + logN + H ──")
    print(f"  n={base['n']}  R²={base['r2']:.4f}  R²adj={base['r2_adj']:.4f}  "
          f"resid_SD={base['resid_sd']:.4f}")
    for k in ("const", "E", "logN", "H"):
        print(f"  β_{k}={base['params'][k]:+.4f}  p={base['pvalues'][k]:.4g}")

    # 2 · Colinealidad / distribución
    print("\n── 2 · Colinealidad / distribución ──")
    cm = corr_matrix(df, ["jca", "n_e", "logN", "h"])
    print("  correlaciones:")
    print(cm.round(3).to_string().replace("\n", "\n  "))
    vif = vif_table(df, ["n_e", "logN", "h"])
    print("  VIF predictores estructurales:")
    for _, r in vif.iterrows():
        print(f"    {r['var']}: {r['VIF']:.3f}")
    dist = jca_distribution(df["jca"])
    print(
        f"  JCA: mean={dist['mean']:.3f} SD={dist['sd']:.3f} IQR={dist['iqr']:.3f} "
        f"  %<0.20={dist['pct_lt_0_20']:.1f}% ({dist['n_lt_0_20']})  "
        f"%<0.30={dist['pct_lt_0_30']:.1f}% ({dist['n_lt_0_30']})"
    )
    print("  deciles:", {k: round(v, 3) for k, v in dist["deciles"].items()})

    # 3 · Utilidad incremental
    print("\n── 3a · Cobertura M (logístico anidado) ──")
    m_inc = nested_logit_M(df)
    print(f"  n={m_inc['n']}  M=1:{m_inc['n_M1']}  M=0:{m_inc['n_M0']}")
    print(
        f"  sin JCA: pseudoR²={m_inc['without_jca']['pseudo_r2_mcfadden']:.4f}  "
        f"AIC={m_inc['without_jca']['aic']:.1f}  CV-AUC={m_inc['without_jca']['cv_auc']:.4f}"
    )
    print(
        f"  con JCA: pseudoR²={m_inc['with_jca']['pseudo_r2_mcfadden']:.4f}  "
        f"AIC={m_inc['with_jca']['aic']:.1f}  CV-AUC={m_inc['with_jca']['cv_auc']:.4f}"
    )
    print(
        f"  ΔpseudoR²={m_inc['delta_pseudo_r2']:+.4f}  ΔAIC(sin−con)={m_inc['delta_aic']:+.2f}  "
        f"ΔBIC={m_inc['delta_bic']:+.2f}  LR p={m_inc['lr_pvalue']:.4g}  "
        f"ΔCV-AUC={m_inc['delta_cv_auc']:+.4f}"
    )
    print(
        f"  β_JCA={m_inc['with_jca']['params']['JCA']:+.4f}  "
        f"p={m_inc['with_jca']['pvalues']['JCA']:.4g}  "
        f"partial corr(JCA,M|struct)={m_inc['partial_corr_jca_M']:+.4f}"
    )

    print("\n── 3b · Posición D (OLS, solo M=1) ──")
    d_inc = nested_ols_D(df)
    if "note" in d_inc and d_inc.get("n", 0) < 30:
        print(f"  {d_inc}")
    else:
        print(f"  n={d_inc['n']}  D_methods={d_inc['d_methods']}")
        print(
            f"  sin JCA: R²={d_inc['without_jca']['r2']:.4f}  "
            f"AIC={d_inc['without_jca']['aic']:.1f}  "
            f"CV-RMSE={d_inc['without_jca']['cv_rmse']:.3f}  "
            f"CV-R²={d_inc['without_jca']['cv_r2']:.4f}"
        )
        print(
            f"  con JCA: R²={d_inc['with_jca']['r2']:.4f}  "
            f"AIC={d_inc['with_jca']['aic']:.1f}  "
            f"CV-RMSE={d_inc['with_jca']['cv_rmse']:.3f}  "
            f"CV-R²={d_inc['with_jca']['cv_r2']:.4f}"
        )
        print(
            f"  ΔR²={d_inc['delta_r2']:+.4f}  ΔAIC={d_inc['delta_aic']:+.2f}  "
            f"ΔBIC={d_inc['delta_bic']:+.2f}  nested F p={d_inc['nested_F_pvalue']}  "
            f"partial corr(JCA,D|struct)={d_inc['partial_corr_jca_D']:+.4f}"
        )
        print(
            f"  β_JCA={d_inc['with_jca']['params']['JCA']:+.4f}  "
            f"p={d_inc['with_jca']['pvalues']['JCA']:.4g}"
        )

    # 4 · Estabilidad por campo
    print("\n── 4 · Estabilidad por campo (n≥30) ──")
    stab = stability_by_field(df, 30)
    for f in stab:
        if f.get("beta_jca") is None:
            print(f"  {f['field']}: n={f['n']}  ({f.get('note','')})")
        else:
            print(
                f"  {f['field']}: n={f['n']}  β_JCA={f['beta_jca']:+.3f}  "
                f"sign={f['sign']}  p={f['pvalue']:.4g}"
            )

    decision = decide_status(base, m_inc, stab)
    print("\n══ VEREDICTO PRE-REGISTRADO ══")
    print(f"  Estatus: {decision['status']}")
    print(f"  Consecuencia: {decision['consequence']}")
    print(f"  Checks: {json.dumps(decision['checks'], indent=2)}")

    payload = {
        "window_year": args.year,
        "n": len(df),
        "amendment_2026_07_22": (
            "Núcleo = core_subfield si existe en journal_frame_index; "
            "si no, principal_field. S excluida."
        ),
        "base_model": {k: v for k, v in base.items() if k != "summary"},
        "correlations": cm.round(6).to_dict(),
        "vif": vif.to_dict(orient="records"),
        "jca_distribution": dist,
        "incremental_M": m_inc,
        "incremental_D": {
            k: v
            for k, v in d_inc.items()
            if k != "d_methods" or True
        },
        "stability_by_field": stab,
        "decision": decision,
    }
    # make JSON-safe
    def _clean(o):
        if isinstance(o, dict):
            return {str(k): _clean(v) for k, v in o.items()}
        if isinstance(o, (list, tuple)):
            return [_clean(x) for x in o]
        if isinstance(o, (np.floating, float)):
            x = float(o)
            return None if (math.isnan(x) or math.isinf(x)) else x
        if isinstance(o, (np.integer, int)):
            return int(o)
        if isinstance(o, (np.bool_, bool)):
            return bool(o)
        return o

    payload = _clean(payload)
    out = Path(args.json_out) if args.json_out else (
        _API_ROOT / "data" / f"jca_discriminant_{args.year}.json"
    )
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(f"\nJSON → {out}")


if __name__ == "__main__":
    main()
