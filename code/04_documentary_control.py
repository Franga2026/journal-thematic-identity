# -*- coding: utf-8 -*-
"""
Recompute S sobre p_doc (documental) — preregistro_S_pdoc.md (CONGELADO).
===========================================================================
1) Extrae D[s,y] anuales 2021–2024 (misma tubería Tier-1) → journal_yearly_doc
2) Computa S = 1 − mean JSD_base2(p_doc[·|y], p_doc[·|y+1]) con D_MIN primario=5
3) Sensibilidad D_MIN ∈ {3,5,10}

NO usa distribuciones por citas. Umbrales/decisiones del pre-registro: no reinterpretar.

Uso:
  .venv/bin/python scripts/recompute_S_pdoc.py --extract --resume
  .venv/bin/python scripts/recompute_S_pdoc.py --compute
  .venv/bin/python scripts/recompute_S_pdoc.py --extract --resume --compute
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

_SCRIPTS = Path(__file__).resolve().parent
_API_ROOT = _SCRIPTS.parent
sys.path.insert(0, str(_SCRIPTS))
sys.path.insert(0, str(_API_ROOT))

os.environ.setdefault("OPENALEX_MAILTO", "your-email@example.com")

from db import DSN  # noqa: E402
from journal_identity_extract import fetch_works_bucketed  # noqa: E402

YEARS = [2021, 2022, 2023, 2024]
WINDOW_YEAR = 2024
D_MIN_PRIMARY = 5
D_MIN_SENS = (3, 5, 10)
YEARLY_TABLE = "journal_yearly_doc"


DDL = f"""
CREATE TABLE IF NOT EXISTS {YEARLY_TABLE} (
    source_id   text NOT NULL,
    year        int  NOT NULL,
    subfield_id text NOT NULL,
    d           int  NOT NULL,
    p_doc       double precision,
    PRIMARY KEY (source_id, year, subfield_id)
);
CREATE INDEX IF NOT EXISTS idx_jyd_src ON {YEARLY_TABLE} (source_id);
"""


def get_conn(dsn=DSN):
    import psycopg
    return psycopg.connect(dsn)


def ensure_table(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(DDL)
    conn.commit()


def list_universe(conn) -> list[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT source_id FROM journal_identity_summary
            WHERE window_year = %s ORDER BY 1
            """,
            (WINDOW_YEAR,),
        )
        return [r[0] for r in cur.fetchall()]


def yearly_done(conn, source_id: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT 1 FROM {YEARLY_TABLE} WHERE source_id=%s LIMIT 1",
            (source_id,),
        )
        return cur.fetchone() is not None


def save_yearly(conn, source_id: str, buckets: dict) -> int:
    """Persiste D[s,y] y p_doc[s|y] para YEARS."""
    # year -> {subfield: d}
    by_y: dict[int, dict[str, int]] = {y: {} for y in YEARS}
    for code, b in buckets.items():
        if code == "_unknown":
            continue
        for y, dc in (b.get("by_year") or {}).items():
            yi = int(y)
            if yi not in by_y:
                continue
            by_y[yi][code] = by_y[yi].get(code, 0) + int(dc.get("d") or 0)

    with conn.cursor() as cur:
        cur.execute(f"DELETE FROM {YEARLY_TABLE} WHERE source_id=%s", (source_id,))
        n = 0
        for y, dist in by_y.items():
            tot = sum(dist.values())
            for code, d in dist.items():
                if d <= 0:
                    continue
                p = d / tot if tot else 0.0
                cur.execute(
                    f"""
                    INSERT INTO {YEARLY_TABLE} (source_id, year, subfield_id, d, p_doc)
                    VALUES (%s,%s,%s,%s,%s)
                    """,
                    (source_id, y, code, d, p),
                )
                n += 1
    conn.commit()
    return n


def extract_one(conn, source_id: str) -> None:
    y0, y1 = YEARS[0], YEARS[-1]
    cite_years = set(YEARS)  # no usado para S; fetch lo necesita
    print(f"\n=== {source_id}  yearly docs {y0}–{y1} ===", flush=True)
    raw = fetch_works_bucketed(source_id, y0, y1, cite_years)
    n = save_yearly(conn, source_id, raw["buckets"])
    print(
        f"  docs={raw['docs']} pages={raw['pages']} ({raw['elapsed']:.1f}s) "
        f"→ {n} filas yearly",
        flush=True,
    )


def run_extract(conn, *, resume: bool, limit: int, source: str) -> None:
    ensure_table(conn)
    sources = [source] if source else list_universe(conn)
    if limit:
        sources = sources[:limit]
    print(f"[extract] {len(sources)} revistas → {YEARLY_TABLE}", flush=True)
    ok = fail = skipped = 0
    t0 = time.time()
    for i, sid in enumerate(sources, 1):
        if resume and yearly_done(conn, sid):
            skipped += 1
            continue
        try:
            extract_one(conn, sid)
            ok += 1
        except Exception as exc:
            fail += 1
            print(f"  FAIL {sid}: {exc}", flush=True)
        if i % 25 == 0 or i == len(sources):
            print(
                f"  progress {i}/{len(sources)} ok={ok} fail={fail} "
                f"skip={skipped} elapsed={time.time()-t0:.0f}s",
                flush=True,
            )
    print(f"[extract] DONE ok={ok} fail={fail} skip={skipped}", flush=True)


def jsd_base2(p: dict, q: dict) -> float:
    keys = set(p) | set(q)
    P = np.array([p.get(k, 0.0) for k in keys], float)
    Q = np.array([q.get(k, 0.0) for k in keys], float)
    if P.sum() <= 0 or Q.sum() <= 0:
        return float("nan")
    P, Q = P / P.sum(), Q / Q.sum()
    M = 0.5 * (P + Q)

    def kl(a, b):
        m = a > 0
        return float(np.sum(a[m] * (np.log2(a[m]) - np.log2(b[m]))))

    return 0.5 * kl(P, M) + 0.5 * kl(Q, M)


def load_yearly(conn) -> pd.DataFrame:
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT source_id, year, subfield_id, d, p_doc
            FROM {YEARLY_TABLE}
            WHERE year = ANY(%s)
            """,
            (YEARS,),
        )
        rows = cur.fetchall()
    return pd.DataFrame(rows, columns=["source_id", "year", "subfield_id", "d", "p_doc"])


def compute_S_for_journal(year_dists: dict[int, dict], year_docs: dict[int, int], d_min: int):
    """
    year_dists: y -> {sub: p_doc}
    year_docs: y -> D_y
    """
    valid = [y for y in YEARS if year_docs.get(y, 0) >= d_min]
    n_valid = len(valid)
    if n_valid == 0:
        return dict(
            n_valid_years=0, n_adjacent_pairs=0, mean_jsd_doc=np.nan,
            stability_S=np.nan, status="sin_anios_validos",
        )
    jsds = []
    for y in YEARS[:-1]:
        y2 = y + 1
        if y in valid and y2 in valid:
            jsds.append(jsd_base2(year_dists[y], year_dists[y2]))
    if not jsds:
        return dict(
            n_valid_years=n_valid, n_adjacent_pairs=0, mean_jsd_doc=np.nan,
            stability_S=np.nan, status="sin_pares_adyacentes",
        )
    mean_jsd = float(np.mean(jsds))
    return dict(
        n_valid_years=n_valid,
        n_adjacent_pairs=len(jsds),
        mean_jsd_doc=mean_jsd,
        stability_S=1.0 - mean_jsd,
        status="ok",
    )


def build_journal_maps(df: pd.DataFrame):
    """source -> (year_dists, year_docs)"""
    out = {}
    for sid, g in df.groupby("source_id"):
        year_docs = {}
        year_dists = {}
        for y, gy in g.groupby("year"):
            tot = int(gy["d"].sum())
            year_docs[int(y)] = tot
            year_dists[int(y)] = dict(zip(gy["subfield_id"], gy["p_doc"].astype(float)))
        out[sid] = (year_dists, year_docs)
    return out


def summarize(res: pd.DataFrame, d_min: int, n_universe: int) -> None:
    ok = res[res["status"] == "ok"]
    n_ok = len(ok)
    excl = res[res["status"] != "ok"]
    print(f"\n=== D_MIN={d_min}  (primario={'SÍ' if d_min == D_MIN_PRIMARY else 'no'}) ===")
    print(f"  N universo={n_universe}  N analizable={n_ok}  "
          f"excluido={len(excl)} ({100*len(excl)/n_universe:.1f}%)")
    if len(excl):
        print("  motivos:", excl["status"].value_counts().to_dict())
    if n_ok == 0:
        print("  (sin S computable)")
        return
    s = ok["stability_S"]
    q = s.quantile([0.10, 0.25, 0.50, 0.75, 0.90])
    print(f"  mediana S={q[0.50]:.3f}  IQR=[{q[0.25]:.3f},{q[0.75]:.3f}]  "
          f"P10={q[0.10]:.3f}  P90={q[0.90]:.3f}  media={s.mean():.3f}")


def run_compute(conn) -> pd.DataFrame:
    ensure_table(conn)
    universe = list_universe(conn)
    n_u = len(universe)
    df = load_yearly(conn)
    if df.empty:
        print("ABORTA: journal_yearly_doc vacío — corré --extract primero.", file=sys.stderr)
        sys.exit(2)
    maps = build_journal_maps(df)
    # revistas del universo sin filas yearly
    missing = [s for s in universe if s not in maps]
    print(f"[compute] yearly rows={len(df)}  journals_in_yearly={len(maps)}  "
          f"universo={n_u}  missing_yearly={len(missing)}")

    print("\n" + "=" * 70)
    print(" RECOMPUTE S SOBRE p_doc — pre-registro CONGELADO (preregistro_S_pdoc.md)")
    print(f" Años={YEARS}  JSD base 2  S=1−mean(JSD)  D_MIN primario={D_MIN_PRIMARY}")
    print("=" * 70)

    sensitivity = []
    primary_rows = None
    for d_min in D_MIN_SENS:
        rows = []
        for sid in universe:
            if sid not in maps:
                rows.append(dict(
                    journal_id=sid, n_valid_years=0, n_adjacent_pairs=0,
                    mean_jsd_doc=np.nan, stability_S=np.nan,
                    status="sin_anios_validos", d_min=d_min,
                ))
                continue
            yd, ydocs = maps[sid]
            r = compute_S_for_journal(yd, ydocs, d_min)
            r["journal_id"] = sid
            r["d_min"] = d_min
            rows.append(r)
        res = pd.DataFrame(rows)
        summarize(res, d_min, n_u)
        sensitivity.append({
            "d_min": d_min,
            "n_analizable": int((res.status == "ok").sum()),
            "pct_excluido": float((res.status != "ok").mean()),
            "mediana_S": float(res.loc[res.status == "ok", "stability_S"].median())
            if (res.status == "ok").any() else np.nan,
        })
        if d_min == D_MIN_PRIMARY:
            primary_rows = res

    print("\n--- Sensibilidad D_MIN (pre-declarada) ---")
    print(pd.DataFrame(sensitivity).to_string(index=False))

    out = _API_ROOT / "data" / "stability_S_pdoc.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    primary_rows.to_csv(out, index=False)
    print(f"\n[csv primario D_MIN={D_MIN_PRIMARY}] → {out}")

    # Actualizar summary.stability_s (solo D_MIN primario, status=ok)
    with conn.cursor() as cur:
        n_upd = 0
        for _, row in primary_rows.iterrows():
            if row["status"] != "ok":
                continue
            cur.execute(
                """
                UPDATE journal_identity_summary
                SET stability_s = %s
                WHERE source_id = %s AND window_year = %s
                """,
                (float(row["stability_S"]), row["journal_id"], WINDOW_YEAR),
            )
            n_upd += cur.rowcount
    conn.commit()
    print(f"[db] journal_identity_summary.stability_s actualizado (ok): {n_upd} filas")
    return primary_rows


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--extract", action="store_true", help="Poblar journal_yearly_doc vía OpenAlex")
    ap.add_argument("--compute", action="store_true", help="Calcular S (requiere yearly)")
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--source", default="")
    ap.add_argument("--dsn", default=DSN)
    args = ap.parse_args()
    if not (args.extract or args.compute):
        ap.error("Indicá --extract y/o --compute")

    conn = get_conn(args.dsn)
    try:
        if args.extract:
            run_extract(conn, resume=args.resume, limit=args.limit, source=args.source)
        if args.compute:
            run_compute(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
