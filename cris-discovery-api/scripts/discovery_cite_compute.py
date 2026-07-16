#!/usr/bin/env python3
"""
discovery_cite_compute.py — Motor de cálculo de Discovery Cite, 100% LOCAL.

Lee de openalex_sources (universo mundial del snapshot) y calcula, para cada
subfield: score, percentil y cuartil de cada revista. CERO API, cero rate-limits.

Valida contra Scimago (tabla sources) y guarda en discovery_cite_metrics.

Uso:
    python discovery_cite_compute.py --year 2024
    python discovery_cite_compute.py --year 2024 --subfield 3107
    python discovery_cite_compute.py --year 2024 --validate-only
"""

from __future__ import annotations

import argparse
import json
import os
import re

import psycopg
from psycopg.rows import dict_row

DSN = os.environ.get(
    "CRIS_DB_DSN",
    "postgresql://postgres:victoria@localhost:5432/cris_victoria",
)


def norm_issn(v) -> str | None:
    s = re.sub(r"[^0-9Xx]", "", str(v or "")).upper()
    return s if len(s) == 8 else None


def belonging_share(topics, subfield_id: str) -> tuple[float, int]:
    """Fracción de la producción de la revista que cae en el subfield."""
    if not topics:
        return 0.0, 0
    total = sum(t.get("count", 0) or 0 for t in topics)
    if not total:
        return 0.0, 0
    # Acepta "subfields/3107" o "3107"
    needles = {subfield_id}
    if subfield_id.startswith("subfields/"):
        needles.add(subfield_id.split("/", 1)[1])
    else:
        needles.add(f"subfields/{subfield_id}")
    in_sf = sum(
        (t.get("count", 0) or 0)
        for t in topics
        if t.get("subfield_id") in needles
    )
    return in_sf / total, total


def score_from_counts(cby, year: int, window: int = 3) -> tuple[float | None, int]:
    """
    Discovery Cite Score: citas / works en la ventana [year-(window-1) .. year].
    """
    if not cby:
        return None, 0
    years = {year - i for i in range(window)}
    works = sum(
        c.get("works_count", 0) or 0 for c in cby if c.get("year") in years
    )
    cites = sum(
        c.get("cited_by_count", 0) or 0 for c in cby if c.get("year") in years
    )
    if works < 1:
        return None, works
    return cites / works, works


def ensure_metrics_table(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS discovery_cite_metrics (
                subfield_id   TEXT NOT NULL,
                subfield_name TEXT,
                source_id     TEXT NOT NULL,
                source_name   TEXT,
                issns         TEXT[],
                year          INTEGER NOT NULL,
                share         NUMERIC(5,4),
                works_window  INTEGER,
                dc_score      NUMERIC(10,4),
                dc_percentile NUMERIC(5,2),
                dc_quartile   TEXT,
                method        TEXT DEFAULT 'simple',
                PRIMARY KEY (subfield_id, source_id, year, method)
            );
            CREATE INDEX IF NOT EXISTS idx_dcm_subfield
                ON discovery_cite_metrics(subfield_id, year);
            CREATE INDEX IF NOT EXISTS idx_dcm_issns
                ON discovery_cite_metrics USING GIN (issns);
            -- Acelera topics @> [{"subfield_id": "..."}]
            CREATE INDEX IF NOT EXISTS idx_oa_sources_topics
                ON openalex_sources USING GIN (topics jsonb_path_ops);
            """
        )
    conn.commit()


def compute_subfield(
    conn: psycopg.Connection,
    subfield_id: str,
    subfield_name: str | None,
    year: int,
    min_share: float,
    min_works: int,
    save: bool,
) -> list[dict] | None:
    """Calcula Discovery Cite para un subfield."""
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT source_id, name, issns, counts_by_year, topics
            FROM openalex_sources
            WHERE topics @> %s::jsonb
            """,
            (json.dumps([{"subfield_id": subfield_id}]),),
        )
        candidates = cur.fetchall()

    universo: list[dict] = []
    for s in candidates:
        if not s["topics"] or s["counts_by_year"] is None:
            continue
        share, _ = belonging_share(s["topics"], subfield_id)
        if share < min_share:
            continue
        score, works = score_from_counts(s["counts_by_year"], year)
        if score is None or works < min_works:
            continue
        universo.append(
            {
                "source_id": s["source_id"],
                "name": s["name"],
                "issns": s["issns"] or [],
                "share": share,
                "works": works,
                "score": score,
            }
        )

    if not universo:
        return None

    universo.sort(key=lambda x: x["score"], reverse=True)
    n = len(universo)
    for i, r in enumerate(universo):
        pct = (1 - (i + 1) / n) * 100
        r["percentile"] = round(pct, 2)
        r["quartile"] = (
            "Q1"
            if pct >= 75
            else "Q2"
            if pct >= 50
            else "Q3"
            if pct >= 25
            else "Q4"
        )

    if save:
        with conn.cursor() as cur:
            for r in universo:
                cur.execute(
                    """
                    INSERT INTO discovery_cite_metrics
                        (subfield_id, subfield_name, source_id, source_name, issns,
                         year, share, works_window, dc_score, dc_percentile,
                         dc_quartile, method)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'simple')
                    ON CONFLICT (subfield_id, source_id, year, method) DO UPDATE SET
                        subfield_name = EXCLUDED.subfield_name,
                        source_name = EXCLUDED.source_name,
                        issns = EXCLUDED.issns,
                        dc_score = EXCLUDED.dc_score,
                        dc_percentile = EXCLUDED.dc_percentile,
                        dc_quartile = EXCLUDED.dc_quartile,
                        share = EXCLUDED.share,
                        works_window = EXCLUDED.works_window
                    """,
                    (
                        subfield_id,
                        subfield_name,
                        r["source_id"],
                        r["name"],
                        r["issns"],
                        year,
                        round(r["share"], 4),
                        r["works"],
                        round(r["score"], 4),
                        r["percentile"],
                        r["quartile"],
                    ),
                )
        conn.commit()

    return universo


def validate(universo: list[dict], scimago: dict[str, str]):
    """Compara los cuartiles Discovery Cite con Scimago."""
    coincide = difiere = sin_scimago = 0
    cerca = 0
    for r in universo:
        sjr = None
        for issn in r["issns"]:
            sjr = scimago.get(norm_issn(issn) or "")
            if sjr:
                break
        if not sjr:
            sin_scimago += 1
            continue
        if r["quartile"] == sjr:
            coincide += 1
        else:
            difiere += 1
        if abs(int(r["quartile"][1]) - int(sjr[1])) <= 1:
            cerca += 1
    return coincide, difiere, sin_scimago, cerca


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2024)
    ap.add_argument("--subfield", help="Solo este subfield (ej. 3107 o subfields/3107)")
    ap.add_argument(
        "--min-share",
        type=float,
        default=0.30,
        help="Pertenencia mínima al subfield (default 0.30 = 30%%)",
    )
    ap.add_argument(
        "--min-works",
        type=int,
        default=50,
        help="Mínimo de works en la ventana de 3 años",
    )
    ap.add_argument("--no-save", action="store_true", help="No escribir en la tabla")
    ap.add_argument(
        "--validate-only",
        action="store_true",
        help="Igual que --no-save (solo reporte vs Scimago)",
    )
    ap.add_argument("--dsn", default=DSN)
    args = ap.parse_args()
    save = not (args.no_save or args.validate_only)

    conn = psycopg.connect(args.dsn)
    if save:
        ensure_metrics_table(conn)

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT unnest(issns) AS issn, sjr_quartile
            FROM sources WHERE sjr_quartile IS NOT NULL
            """
        )
        scimago: dict[str, str] = {}
        for issn, q in cur.fetchall():
            ni = norm_issn(issn)
            if ni:
                scimago[ni] = q
    print(f"Scimago de referencia: {len(scimago):,} ISSN con cuartil\n")

    with conn.cursor(row_factory=dict_row) as cur:
        if args.subfield:
            sfid = (
                args.subfield
                if args.subfield.startswith("subfields/")
                else f"subfields/{args.subfield}"
            )
            cur.execute(
                """
                SELECT DISTINCT subfield_id, subfield_name
                FROM openalex_topics WHERE subfield_id = %s
                """,
                (sfid,),
            )
        else:
            cur.execute(
                """
                SELECT DISTINCT subfield_id, subfield_name
                FROM openalex_topics
                WHERE subfield_id IS NOT NULL
                ORDER BY subfield_id
                """
            )
        subfields = cur.fetchall()

    print(
        f"Calculando {len(subfields)} subfield(s), año {args.year}, "
        f"min_share={args.min_share:.0%}, min_works={args.min_works}\n"
    )
    print(
        f"{'Subfield':<45} {'Rev':>5} {'SJR':>5} {'Exact':>6} {'±1':>6} {'SoloDC':>7}"
    )
    print("-" * 80)

    tot_coincide = tot_con_ambos = tot_solo_dc = 0
    resultados: list[tuple[str, float, int]] = []

    for sf in subfields:
        universo = compute_subfield(
            conn,
            sf["subfield_id"],
            sf["subfield_name"],
            args.year,
            args.min_share,
            args.min_works,
            save=save,
        )
        if not universo:
            continue
        coincide, difiere, sin_scimago, cerca = validate(universo, scimago)
        con_ambos = coincide + difiere
        exact = f"{100 * coincide / con_ambos:.0f}%" if con_ambos else "—"
        pm1 = f"{100 * cerca / con_ambos:.0f}%" if con_ambos else "—"
        name = (sf["subfield_name"] or sf["subfield_id"])[:43]
        print(
            f"{name:<45} {len(universo):>5} {con_ambos:>5} "
            f"{exact:>6} {pm1:>6} {sin_scimago:>7}"
        )
        tot_coincide += coincide
        tot_con_ambos += con_ambos
        tot_solo_dc += sin_scimago
        if con_ambos >= 10:
            resultados.append((name, 100 * coincide / con_ambos, con_ambos))

    print("-" * 80)
    if tot_con_ambos:
        print(
            f"\nGLOBAL: {100 * tot_coincide / tot_con_ambos:.0f}% coincidencia exacta "
            f"sobre {tot_con_ambos:,} revistas con Scimago"
        )
    print(f"Revistas con cuartil que Scopus NO da: {tot_solo_dc:,}")

    if resultados:
        resultados.sort(key=lambda x: x[1])
        print("\nSubfields MENOS fiables (posible experimental):")
        for name, pct, n in resultados[:5]:
            print(f"  {pct:.0f}%  {name} (n={n})")
        print("\nSubfields MAS fiables:")
        for name, pct, n in resultados[-5:]:
            print(f"  {pct:.0f}%  {name} (n={n})")

    conn.close()


if __name__ == "__main__":
    main()
