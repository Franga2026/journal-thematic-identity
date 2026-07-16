#!/usr/bin/env python3
"""
discovery_cite_poc.py — Prueba de concepto de Discovery Cite sobre UN subfield.

Objetivo: responder con datos si nuestro cuartil calculado con OpenAlex se
parece al de Scimago. Si coinciden razonablemente, el método es creíble.

Sobre el subfield 3107 (Atomic and Molecular Physics, and Optics):
  1. Trae todas las sources que tocan sus topics (universo bruto ~13.933).
  2. PERTENENCIA: calcula qué fracción de cada revista cae en el subfield,
     usando el `count` de sus topics. Filtra las que pertenecen de verdad
     (el subfield es su área dominante). Esto elimina las multidisciplinares
     (Nature, PLOS ONE) que solo rozan el tema.
  3. SCORE: de counts_by_year, calcula citas/paper en ventana de 3 años.
  4. PERCENTIL y CUARTIL dentro del subfield limpio.
  5. VALIDACIÓN: cruza con el cuartil Scimago que ya tenemos en la BD.

Uso:
    python discovery_cite_poc.py --subfield 3107 --year 2024
"""

from __future__ import annotations

import argparse
import os
import re
import time

import requests

MAILTO = os.environ.get("OPENALEX_MAILTO", "cris@uta.cl")
API = "https://api.openalex.org"


def api_get(url: str, params: dict | None = None) -> dict:
    last_err: Exception | None = None
    for intento in range(8):
        try:
            r = requests.get(url, params=params, timeout=60)
            if r.status_code == 429:
                wait = min(90, 2 ** intento)
                print(f"\n    rate-limit 429 → wait {wait}s…")
                time.sleep(wait)
                last_err = requests.HTTPError(f"429 Too Many Requests: {url}")
                continue
            r.raise_for_status()
            return r.json()
        except Exception as e:
            last_err = e
            if intento == 7:
                raise
            time.sleep(1.5)
    raise last_err or RuntimeError(f"api_get failed: {url}")


def get_subfield_topics(subfield_id: str, dsn: str | None = None) -> list[str]:
    """Los topics (IDs cortos) de un subfield.

    Prefiere la tabla local `openalex_topics` (evita golpear la API);
    si no hay DSN/tabla, pagina OpenAlex.
    """
    if dsn:
        try:
            import psycopg

            with psycopg.connect(dsn) as conn, conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT topic_id FROM openalex_topics
                    WHERE subfield_id = %s
                    ORDER BY topic_id
                    """,
                    (f"subfields/{subfield_id}",),
                )
                rows = [r[0] for r in cur.fetchall()]
            if rows:
                print(f"   (desde openalex_topics local)")
                return rows
        except Exception as e:
            print(f"   (fallback API: {e})")

    ids: list[str] = []
    cursor: str | None = "*"
    while cursor:
        d = api_get(
            f"{API}/topics",
            {
                "filter": f"subfield.id:subfields/{subfield_id}",
                "per-page": 200,
                "cursor": cursor,
                "mailto": MAILTO,
            },
        )
        ids.extend(t["id"].split("/")[-1] for t in d.get("results", []))
        cursor = d.get("meta", {}).get("next_cursor")
        if not d.get("results"):
            break
        time.sleep(0.2)
    return ids


def get_sources_touching(
    topic_ids: list[str],
    *,
    batch_size: int = 25,
    min_works: int = 50,
) -> list[dict]:
    """
    Sources que tocan cualquiera de los topics (OR), en lotes.
    OpenAlex rechaza filtros OR demasiado largos (HTTP 400) → batches.
    Deduplica por openalex id. Filtra works_count en la API para reducir volumen.
    """
    by_id: dict[str, dict] = {}
    batches = [
        topic_ids[i : i + batch_size]
        for i in range(0, len(topic_ids), batch_size)
    ]
    for bi, batch in enumerate(batches, 1):
        filt = (
            f"topics.id:{'|'.join(batch)},type:journal,works_count:>{max(0, min_works - 1)}"
        )
        cursor: str | None = "*"
        while cursor:
            d = api_get(
                f"{API}/sources",
                {
                    "filter": filt,
                    "per-page": 200,
                    "cursor": cursor,
                    "select": "id,display_name,issn,issn_l,counts_by_year,topics,works_count",
                    "mailto": MAILTO,
                },
            )
            results = d.get("results", [])
            for s in results:
                sid = s.get("id") or ""
                if sid and sid not in by_id:
                    by_id[sid] = s
            cursor = d.get("meta", {}).get("next_cursor")
            print(
                f"    lote {bi}/{len(batches)} … {len(by_id)} sources",
                end="\r",
            )
            if not results:
                break
            time.sleep(0.15)
    print()
    return list(by_id.values())


def belonging_share(source: dict, subfield_id: str) -> float:
    """
    Qué fracción de la producción de la revista cae en el subfield.
    Usa el `count` de cada topic. Nature: ~2% en física atómica → no pertenece.
    """
    topics = source.get("topics") or []
    total = sum(t.get("count", 0) for t in topics)
    if not total:
        return 0.0
    suffix = f"/{subfield_id}"
    in_sf = sum(
        t.get("count", 0)
        for t in topics
        if (t.get("subfield") or {}).get("id", "").endswith(suffix)
    )
    return in_sf / total


def citescore(source: dict, year: int, window: int = 3) -> float | None:
    """
    Discovery Cite Score versión SIMPLE, desde counts_by_year:
      citas recibidas en (year, year-1, year-2) / works publicados en esos años.

    (La versión rigurosa exigiría citas del año T a papers de T-1..T-3;
     esta es la aproximación barata que vamos a VALIDAR contra Scimago.)
    """
    cby = {c["year"]: c for c in source.get("counts_by_year") or []}
    years = [year - i for i in range(window)]
    works = sum(cby.get(y, {}).get("works_count", 0) for y in years)
    cites = sum(cby.get(y, {}).get("cited_by_count", 0) for y in years)
    if works < 1:
        return None
    return cites / works


def norm_issn(issn: str | None) -> str | None:
    s = re.sub(r"[^0-9Xx]", "", str(issn or "")).upper()
    return s if len(s) == 8 else None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--subfield", default="3107")
    ap.add_argument("--year", type=int, default=2024)
    ap.add_argument(
        "--min-share",
        type=float,
        default=0.30,
        help="Fracción mínima del subfield para 'pertenecer' (0.30 = 30%%)",
    )
    ap.add_argument(
        "--min-works",
        type=int,
        default=50,
        help="Mínimo de works totales para entrar al ranking",
    )
    ap.add_argument(
        "--max-topics",
        type=int,
        default=0,
        help="Limitar a N topics (0 = todos). Útil en subfields ruidosos (p.ej. Sociology).",
    )
    ap.add_argument(
        "--dsn",
        default=os.environ.get(
            "CRIS_DB_DSN",
            "postgresql://postgres:victoria@localhost:5432/cris_victoria",
        ),
    )
    args = ap.parse_args()

    print(
        f"=== Discovery Cite — PoC subfield {args.subfield}, año {args.year} ===\n"
    )

    print("1. Topics del subfield...")
    topics = get_subfield_topics(args.subfield, dsn=args.dsn)
    if args.max_topics and len(topics) > args.max_topics:
        print(
            f"   {len(topics)} topics → usando los primeros {args.max_topics} "
            f"(--max-topics)"
        )
        topics = topics[: args.max_topics]
    else:
        print(f"   {len(topics)} topics\n")

    print("2. Sources que tocan el subfield (universo bruto, type=journal)...")
    sources = get_sources_touching(topics, min_works=args.min_works)
    print(f"   {len(sources)} sources brutas\n")

    print(
        f"3. Filtro de pertenencia (share >= {args.min_share:.0%}, "
        f"works >= {args.min_works})..."
    )
    universo: list[dict] = []
    for s in sources:
        share = belonging_share(s, args.subfield)
        works = s.get("works_count", 0) or 0
        score = citescore(s, args.year)
        if share >= args.min_share and works >= args.min_works and score is not None:
            universo.append(
                {
                    "id": s["id"].split("/")[-1],
                    "name": s["display_name"],
                    "issns": s.get("issn") or [],
                    "issn_l": s.get("issn_l"),
                    "share": share,
                    "works": works,
                    "score": score,
                }
            )
    print(f"   {len(universo)} revistas pertenecen de verdad al subfield")
    print(
        f"   (se descartaron {len(sources) - len(universo)} "
        f"multidisciplinares o pequeñas)\n"
    )

    if not universo:
        print("Sin revistas tras el filtro. Prueba --min-share más bajo.")
        return

    print("4. Percentil y cuartil (Discovery Cite)...")
    universo.sort(key=lambda x: x["score"], reverse=True)
    n = len(universo)
    for i, r in enumerate(universo):
        rank = i + 1  # 1 = mejor score
        pct = (1 - rank / n) * 100
        r["percentile"] = round(pct, 1)
        if pct >= 75:
            r["dc_quartile"] = "Q1"
        elif pct >= 50:
            r["dc_quartile"] = "Q2"
        elif pct >= 25:
            r["dc_quartile"] = "Q3"
        else:
            r["dc_quartile"] = "Q4"

    print("   Top 5:")
    for r in universo[:5]:
        print(
            f"     {r['dc_quartile']}  score={r['score']:6.2f}  {r['name'][:45]}"
        )
    print()

    # =====================================================================
    # 5. VALIDACIÓN contra Scimago — el momento de la verdad
    # =====================================================================
    print("5. VALIDACIÓN contra Scimago (cruce por ISSN)...")
    import psycopg

    conn = psycopg.connect(args.dsn)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT unnest(issns) AS issn, sjr_quartile
            FROM sources WHERE sjr_quartile IS NOT NULL
            """
        )
        scimago: dict[str, str] = {}
        for issn, q in cur.fetchall():
            n_issn = norm_issn(issn)
            if n_issn:
                scimago[n_issn] = q
    conn.close()

    coincide = 0
    difiere = 0
    sin_scimago = 0
    tabla: list[tuple[str, str, str, str]] = []
    for r in universo:
        sjr = None
        for issn in r["issns"] or []:
            sjr = scimago.get(norm_issn(issn) or "")
            if sjr:
                break
        if not sjr and r.get("issn_l"):
            sjr = scimago.get(norm_issn(r["issn_l"]) or "")
        if not sjr:
            sin_scimago += 1
            continue
        match = r["dc_quartile"] == sjr
        if match:
            coincide += 1
        else:
            difiere += 1
        tabla.append(
            (r["name"][:40], r["dc_quartile"], sjr, "OK" if match else "X")
        )

    con_ambos = coincide + difiere
    print(f"\n   Revistas del universo con cuartil Scimago: {con_ambos}")
    print(
        f"   Sin cuartil Scimago (solo Discovery Cite): {sin_scimago}  "
        f"← ciencia que Scopus ignora"
    )
    if con_ambos:
        print(
            f"\n   COINCIDENCIA EXACTA: {coincide}/{con_ambos} = "
            f"{100 * coincide / con_ambos:.0f}%"
        )
        cerca = sum(
            1
            for _, dc, sj, _ in tabla
            if abs(int(dc[1]) - int(sj[1])) <= 1
        )
        print(
            f"   COINCIDENCIA ±1 cuartil:  {cerca}/{con_ambos} = "
            f"{100 * cerca / con_ambos:.0f}%"
        )
        print(f"\n   Muestra (Discovery Cite vs Scimago):")
        print(f"     {'Revista':<40} {'DC':<4} {'SJR':<4}")
        for name, dc, sj, mark in tabla[:15]:
            print(f"     {name:<40} {dc:<4} {sj:<4} {mark}")

    print("\n" + "=" * 60)
    print("VEREDICTO")
    print("=" * 60)
    if con_ambos:
        pct = 100 * coincide / con_ambos
        if pct >= 70:
            print(f"  {pct:.0f}% de coincidencia exacta → método CREÍBLE.")
        elif pct >= 50:
            print(f"  {pct:.0f}% exacta → prometedor, ajustar la fórmula/ventana.")
        else:
            print(f"  {pct:.0f}% exacta → el método simple no basta; revisar.")
        print(f"  Y {sin_scimago} revistas obtienen cuartil que Scopus NO da.")
    else:
        print("  Sin revistas cruzables con Scimago en este subfield (ISSN).")


if __name__ == "__main__":
    main()
