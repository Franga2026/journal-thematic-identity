#!/usr/bin/env python3
"""
validate_vs_scopus.py — Valida Discovery Cite contra el CiteScore REAL de Scopus.

Hasta ahora comparábamos contra el cuartil SJR (métrica de otra familia). Esto
compara contra el CiteScore de Scopus — la MISMA métrica que Discovery Cite
replica, solo que sobre Scopus en vez de OpenAlex.

Dos pruebas:
  1. Correlación de Scores (Discovery Cite Score vs CiteScore). r > 0.85 → reproduce.
  2. Coincidencia de cuartiles contra el cuartil del CiteScore (no el SJR).

Cachea cada CiteScore en scopus_citescore (y guarda source-id para el chip).

Uso:
    set -a && source cris-discovery-api/.env && set +a
    python validate_vs_scopus.py --subfield subfields/3109 --year 2024
"""

from __future__ import annotations

import argparse
import os
import re
import time
from pathlib import Path
from statistics import mean

import requests

_ENV = Path(__file__).resolve().parents[1] / ".env"
if _ENV.exists():
    for line in _ENV.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

KEY = os.environ.get("ELSEVIER_API_KEY", "")
DSN = os.environ.get(
    "CRIS_DB_DSN",
    "postgresql://postgres:victoria@localhost:5432/cris_victoria",
)
ELSEVIER = "https://api.elsevier.com/content/serial/title/issn/"


def norm_issn(v) -> str | None:
    s = re.sub(r"[^0-9Xx]", "", str(v or "")).upper()
    return s if len(s) == 8 else None


def issn_hyphen(n: str) -> str:
    """10420533 -> 1042-0533 (Elsevier espera con guion)"""
    return f"{n[:4]}-{n[4:]}" if n and len(n) == 8 else n


def ensure_cache(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS scopus_citescore (
                issn             TEXT NOT NULL,
                year             INTEGER NOT NULL,
                citescore        NUMERIC(10,2),
                percentile       INTEGER,
                subject_code     TEXT NOT NULL DEFAULT '',
                scopus_source_id TEXT,
                title            TEXT,
                fetched_at       TIMESTAMPTZ DEFAULT now(),
                PRIMARY KEY (issn, year, subject_code)
            );
            CREATE INDEX IF NOT EXISTS idx_scopus_cs_year
                ON scopus_citescore(year);
            """
        )
    conn.commit()


def fetch_citescore(issn_norm: str, year: int) -> list[tuple]:
    """
    Pide CiteScore de un ISSN a Scopus para un año.
    Devuelve lista de (citescore, percentile, subject_code, source_id, title).
    """
    url = f"{ELSEVIER}{issn_hyphen(issn_norm)}"
    params = {"apiKey": KEY, "view": "CITESCORE"}
    headers = {"Accept": "application/json"}
    d = None
    for intento in range(3):
        try:
            r = requests.get(url, params=params, headers=headers, timeout=30)
            if r.status_code == 429:
                time.sleep(2**intento)
                continue
            if r.status_code == 404:
                return []
            r.raise_for_status()
            d = r.json()
            break
        except Exception:
            if intento == 2:
                return []
            time.sleep(1)
    if not d:
        return []
    try:
        entry = d["serial-metadata-response"]["entry"][0]
    except (KeyError, IndexError, TypeError):
        return []

    source_id = entry.get("source-id")
    title = entry.get("dc:title")
    out: list[tuple] = []
    csi_list = (
        entry.get("citeScoreYearInfoList") or {}
    ).get("citeScoreYearInfo", [])
    for yr_info in csi_list:
        if str(yr_info.get("@year")) != str(year):
            continue
        for block in yr_info.get("citeScoreInformationList") or [{}]:
            for info in block.get("citeScoreInfo") or []:
                cs = info.get("citeScore")
                ranks = info.get("citeScoreSubjectRank") or []
                for rk in ranks:
                    out.append(
                        (
                            float(cs) if cs else None,
                            int(rk["percentile"])
                            if rk.get("percentile") is not None
                            else None,
                            str(rk.get("subjectCode") or ""),
                            source_id,
                            title,
                        )
                    )
                if not ranks:
                    out.append(
                        (
                            float(cs) if cs else None,
                            None,
                            "",
                            source_id,
                            title,
                        )
                    )
    return out


def quartile_from_pct(p):
    if p is None:
        return None
    return "Q1" if p >= 75 else "Q2" if p >= 50 else "Q3" if p >= 25 else "Q4"


def pearson(xs, ys):
    n = len(xs)
    if n < 3:
        return None
    mx, my = mean(xs), mean(ys)
    num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    dx = sum((x - mx) ** 2 for x in xs) ** 0.5
    dy = sum((y - my) ** 2 for y in ys) ** 0.5
    return num / (dx * dy) if dx and dy else None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--subfield", default="subfields/3109")
    ap.add_argument("--year", type=int, default=2024)
    ap.add_argument(
        "--limit", type=int, default=200, help="Máx revistas a consultar (cuota)"
    )
    ap.add_argument(
        "--method",
        default="rigorous",
        help="Método en discovery_cite_metrics (rigorous|simple|auto)",
    )
    ap.add_argument("--dsn", default=DSN)
    args = ap.parse_args()

    if not KEY:
        print(
            "Falta ELSEVIER_API_KEY. Corre: "
            "set -a && source cris-discovery-api/.env && set +a"
        )
        return

    import psycopg
    from psycopg.rows import dict_row

    conn = psycopg.connect(args.dsn)
    ensure_cache(conn)

    sfid = (
        args.subfield
        if args.subfield.startswith("subfields/")
        else f"subfields/{args.subfield}"
    )

    method = args.method
    if method == "auto":
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT method, COUNT(*) FROM discovery_cite_metrics
                WHERE subfield_id = %s AND year = %s
                GROUP BY method ORDER BY
                  CASE method WHEN 'rigorous' THEN 0 ELSE 1 END
                """,
                (sfid, args.year),
            )
            rows = cur.fetchall()
        method = rows[0][0] if rows else "rigorous"

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT source_id, source_name, issns, dc_score, dc_quartile, method
            FROM discovery_cite_metrics
            WHERE subfield_id = %s AND year = %s AND method = %s
            ORDER BY dc_score DESC NULLS LAST
            LIMIT %s
            """,
            (sfid, args.year, method, args.limit),
        )
        revistas = cur.fetchall()

    if not revistas and args.method == "rigorous":
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT source_id, source_name, issns, dc_score, dc_quartile, method
                FROM discovery_cite_metrics
                WHERE subfield_id = %s AND year = %s AND method = 'simple'
                ORDER BY dc_score DESC NULLS LAST
                LIMIT %s
                """,
                (sfid, args.year, args.limit),
            )
            revistas = cur.fetchall()
            if revistas:
                method = "simple"
                print(
                    "⚠ Sin filas rigorous; cayendo a method=simple "
                    "(corre discovery_cite_rigorous.py --save primero).\n"
                )

    if not revistas:
        print(f"No hay Discovery Cite para {sfid} año {args.year}.")
        print("Corre primero discovery_cite_compute.py o discovery_cite_rigorous.py")
        return

    print(
        f"Validando {len(revistas)} revistas de {sfid} "
        f"(method={method}) vs CiteScore {args.year}\n"
    )

    pairs_score = []
    q_coincide = q_difiere = q_cerca = sin_scopus = 0
    tabla = []

    with conn.cursor() as cur:
        for i, r in enumerate(revistas, 1):
            issns = r["issns"] or []
            cs_data: list = []
            for issn in issns:
                ni = norm_issn(issn)
                if not ni:
                    continue
                cur.execute(
                    """
                    SELECT citescore, percentile, subject_code, scopus_source_id
                    FROM scopus_citescore WHERE issn=%s AND year=%s
                    """,
                    (ni, args.year),
                )
                cached = cur.fetchall()
                if cached:
                    cs_data = [
                        (
                            float(c[0]) if c[0] is not None else None,
                            c[1],
                            c[2] or "",
                            c[3],
                            None,
                        )
                        for c in cached
                    ]
                    break
                fetched = fetch_citescore(ni, args.year)
                if fetched:
                    for cs, pct, sc, sid, title in fetched:
                        cur.execute(
                            """
                            INSERT INTO scopus_citescore
                                (issn, year, citescore, percentile,
                                 subject_code, scopus_source_id, title)
                            VALUES (%s,%s,%s,%s,%s,%s,%s)
                            ON CONFLICT (issn, year, subject_code) DO UPDATE SET
                                citescore = EXCLUDED.citescore,
                                percentile = EXCLUDED.percentile,
                                scopus_source_id = EXCLUDED.scopus_source_id,
                                title = EXCLUDED.title,
                                fetched_at = now()
                            """,
                            (ni, args.year, cs, pct, sc or "", sid, title),
                        )
                    conn.commit()
                    cs_data = fetched
                    time.sleep(0.15)
                    break

            if i % 20 == 0:
                print(f"  … {i}/{len(revistas)}", flush=True)

            if not cs_data:
                sin_scopus += 1
                continue

            best = max(cs_data, key=lambda x: (x[0] or 0))
            scopus_cs, scopus_pct = best[0], best[1]
            scopus_q = quartile_from_pct(scopus_pct)

            if scopus_cs is not None and r["dc_score"] is not None:
                pairs_score.append((float(r["dc_score"]), float(scopus_cs)))

            if scopus_q and r["dc_quartile"]:
                if r["dc_quartile"] == scopus_q:
                    q_coincide += 1
                else:
                    q_difiere += 1
                if abs(int(r["dc_quartile"][1]) - int(scopus_q[1])) <= 1:
                    q_cerca += 1
                tabla.append(
                    (
                        (r["source_name"] or "")[:36],
                        r["dc_quartile"],
                        scopus_q,
                        float(r["dc_score"] or 0),
                        float(scopus_cs or 0),
                    )
                )

    conn.close()

    print("=" * 66)
    print("VALIDACIÓN vs CiteScore REAL de Scopus")
    print("=" * 66)
    con_q = q_coincide + q_difiere
    print(f"\nRevistas comparadas:     {con_q}")
    print(f"Sin CiteScore en Scopus: {sin_scopus}  ← cobertura extra de Discovery Cite")
    if con_q:
        print("\nCUARTIL (vs percentil CiteScore):")
        print(f"  Exacta: {q_coincide}/{con_q} = {100 * q_coincide / con_q:.0f}%")
        print(f"  ±1:     {q_cerca}/{con_q} = {100 * q_cerca / con_q:.0f}%")

    r = pearson([p[0] for p in pairs_score], [p[1] for p in pairs_score])
    if r is not None:
        print("\nCORRELACIÓN de Scores (Discovery Cite vs CiteScore):")
        print(f"  r = {r:.3f}  sobre {len(pairs_score)} revistas")
        if r > 0.85:
            print("  → ALTA: Discovery Cite REPRODUCE el CiteScore de Scopus.")
        elif r > 0.7:
            print("  → BUENA: correlación fuerte, método válido.")
        else:
            print("  → MODERADA: hay señal pero con dispersión.")

    if tabla:
        print(
            f"\n  {'Revista':<36} {'DC':<4}{'Sco':<4} {'DCscore':>8} {'CiteSc':>7}"
        )
        for name, dq, sq, ds, ss in sorted(tabla, key=lambda x: -x[4])[:20]:
            mark = "" if dq == sq else " <-"
            print(f"  {name:<36} {dq:<4}{sq:<4} {ds:>8.2f} {ss:>7.1f}{mark}")


if __name__ == "__main__":
    main()
