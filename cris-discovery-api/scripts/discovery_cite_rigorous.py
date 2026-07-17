#!/usr/bin/env python3
"""
discovery_cite_rigorous.py — CiteScore RIGUROSO (metodología Scopus actual).

Implementa la fórmula real (ventana simétrica de 4 años), no la aproximación:

  Discovery Cite Score(revista, Y) =
     SUM(citas recibidas en [Y-3..Y] por papers de la revista publicados en [Y-3..Y])
     ---------------------------------------------------------------------------------
    COUNT(papers elegibles de la revista publicados en [Y-3..Y])

Clave: usa counts_by_year A NIVEL DE WORK (citas a ESE paper por año).
Tipos elegibles: article, review, conference-paper (revisados por pares).

Guarda en discovery_cite_metrics con method='rigorous' (coexiste con 'simple').

Uso:
    python discovery_cite_rigorous.py --subfield 3312 --year 2024 --save
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import traceback
from collections import defaultdict
from pathlib import Path

import requests

_env = Path(__file__).resolve().parents[1] / ".env"
if _env.exists():
    for line in _env.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

MAILTO = os.environ.get("OPENALEX_MAILTO", "cris@uta.cl")
KEY = os.environ.get("OPENALEX_API_KEY", "")
API = "https://api.openalex.org"
ELIGIBLE = {"article", "review", "conference-paper"}
METHOD = "rigorous"


def api_get(path: str, params: dict) -> dict:
    params = dict(params)
    params.setdefault("mailto", MAILTO)
    if KEY:
        params["api_key"] = KEY
    last_err: Exception | None = None
    for intento in range(6):
        try:
            r = requests.get(f"{API}{path}", params=params, timeout=90)
            if r.status_code == 429:
                wait = min(90, 2**intento)
                print(f"\n    rate-limit → wait {wait}s…", flush=True)
                time.sleep(wait)
                continue
            r.raise_for_status()
            return r.json()
        except Exception as e:
            last_err = e
            if intento == 5:
                raise
            time.sleep(2**intento)
    raise last_err or RuntimeError("api_get failed")


def source_of(work: dict) -> tuple[str | None, str | None]:
    loc = work.get("primary_location") or {}
    src = loc.get("source") or {}
    sid = src.get("id")
    return (sid.rsplit("/", 1)[-1] if sid else None), src.get("display_name")


def _load_checkpoint(path: Path | None) -> dict | None:
    if not path or not path.exists():
        return None
    try:
        return json.loads(path.read_text())
    except Exception:
        return None


def _save_checkpoint(path: Path | None, payload: dict) -> None:
    if not path:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(payload))
    tmp.replace(path)


def _stream_one_year(
    subfield_id: str,
    pub_year: int,
    cite_years: set[int],
    checkpoint: Path | None,
    lock,
    shared_state: dict,
) -> tuple[dict[str, int], dict[str, int], dict[str, str], int]:
    """Baja works de un solo año de publicación y agrega cites en la ventana."""
    filt = (
        f"primary_topic.subfield.id:subfields/{subfield_id},"
        f"from_publication_date:{pub_year}-01-01,"
        f"to_publication_date:{pub_year}-12-31,"
        f"type:article|review|conference-paper"
    )
    select = "id,publication_year,type,primary_location,counts_by_year"
    key = str(pub_year)
    docs: dict[str, int] = defaultdict(int)
    cites: dict[str, int] = defaultdict(int)
    names: dict[str, str] = {}
    total = 0
    cursor: str | None = "*"

    with lock:
        yp = (shared_state.get("years") or {}).get(key)
        if yp and yp.get("cursor"):
            docs = defaultdict(int, {k: int(v) for k, v in yp["docs"].items()})
            cites = defaultdict(int, {k: int(v) for k, v in yp["cites"].items()})
            names = dict(yp["names"])
            total = int(yp["total"])
            cursor = yp["cursor"]

    pages = 0
    try:
        while cursor:
            d = api_get(
                "/works",
                {
                    "filter": filt,
                    "per-page": 200,
                    "cursor": cursor,
                    "select": select,
                },
            )
            results = d.get("results", [])
            for w in results:
                if w.get("type") not in ELIGIBLE:
                    continue
                sid, name = source_of(w)
                if not sid:
                    continue
                names[sid] = name or sid
                docs[sid] += 1
                for c in w.get("counts_by_year") or []:
                    if c.get("year") in cite_years:
                        cites[sid] += c.get("cited_by_count", 0) or 0
            total += len(results)
            cursor = d.get("meta", {}).get("next_cursor")
            pages += 1
            with lock:
                shared_state.setdefault("years", {})[key] = {
                    "cursor": cursor,
                    "total": total,
                    "docs": dict(docs),
                    "cites": dict(cites),
                    "names": names,
                }
                shared_state["tick"] = shared_state.get("tick", 0) + 1
                if pages % 10 == 0:
                    _save_checkpoint(checkpoint, shared_state)
                done = sum(
                    (shared_state.get("years") or {})
                    .get(str(y), {})
                    .get("total", 0)
                    for y in cite_years
                )
                print(
                    f"    … {done:,} works  "
                    f"[y{pub_year}={total:,}]  pages={shared_state['tick']}",
                    end="\r",
                    flush=True,
                )
            if not results:
                break
    except Exception:
        with lock:
            shared_state.setdefault("years", {})[key] = {
                "cursor": cursor,
                "total": total,
                "docs": dict(docs),
                "cites": dict(cites),
                "names": names,
            }
            _save_checkpoint(checkpoint, shared_state)
        raise

    with lock:
        shared_state.setdefault("years", {})[key] = {
            "cursor": None,
            "total": total,
            "docs": dict(docs),
            "cites": dict(cites),
            "names": names,
            "done": True,
        }
        _save_checkpoint(checkpoint, shared_state)
    return dict(docs), dict(cites), names, total


def stream_aggregate(
    subfield_id: str,
    y0: int,
    y1: int,
    checkpoint: Path | None = None,
) -> dict[str, dict]:
    """
    Stream paralelo por año de publicación (≈4× throughput),
    agregando cites en la ventana [y0..y1].
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from threading import Lock

    cite_years = set(range(y0, y1 + 1))
    lock = Lock()
    shared: dict = _load_checkpoint(checkpoint) or {"years": {}, "version": 2}
    if shared.get("version") != 2:
        # checkpoint legacy (stream único) → empezar limpio en paralelo
        shared = {"years": {}, "version": 2}
        print("   (checkpoint legacy ignorado; modo paralelo por año)\n")

    resumed = [
        y
        for y in range(y0, y1 + 1)
        if (shared.get("years") or {}).get(str(y), {}).get("total", 0) > 0
    ]
    if resumed:
        print(f"   reanudando años: {resumed}\n")

    print(f"   paralelo: años {y0}–{y1} ({y1 - y0 + 1} hilos)\n")
    todo = []
    for y in range(y0, y1 + 1):
        yp = (shared.get("years") or {}).get(str(y), {})
        if yp.get("done") and not yp.get("cursor"):
            print(f"   ✓ año {y} ya completo ({yp.get('total', 0):,} works)")
            continue
        todo.append(y)

    results = []
    # Años ya hechos entran al merge desde checkpoint
    for y in range(y0, y1 + 1):
        yp = (shared.get("years") or {}).get(str(y), {})
        if yp.get("done") and not yp.get("cursor"):
            results.append(
                (
                    y,
                    yp.get("docs") or {},
                    yp.get("cites") or {},
                    yp.get("names") or {},
                    int(yp.get("total") or 0),
                )
            )

    if todo:
        with ThreadPoolExecutor(max_workers=len(todo)) as pool:
            futs = {
                pool.submit(
                    _stream_one_year,
                    subfield_id,
                    y,
                    cite_years,
                    checkpoint,
                    lock,
                    shared,
                ): y
                for y in todo
            }
            for fut in as_completed(futs):
                y = futs[fut]
                docs_y, cites_y, names_y, total_y = fut.result()
                results.append((y, docs_y, cites_y, names_y, total_y))
                print(f"\n   ✓ año {y}: {total_y:,} works", flush=True)
    else:
        print("   todos los años ya estaban en checkpoint\n")

    docs: dict[str, int] = defaultdict(int)
    cites: dict[str, int] = defaultdict(int)
    names: dict[str, str] = {}
    for _, dy, cy, ny, _ in results:
        for sid, n in dy.items():
            docs[sid] += n
        for sid, n in cy.items():
            cites[sid] += n
        names.update(ny)

    print()
    if checkpoint and checkpoint.exists():
        checkpoint.unlink(missing_ok=True)

    scores = {}
    for sid in docs:
        scores[sid] = {
            "name": names.get(sid, sid),
            "docs": docs[sid],
            "cites": cites[sid],
            "score": cites[sid] / docs[sid],
        }
    return scores


def ensure_metrics_pk(conn) -> None:
    """PK incluye method para coexistir simple + rigorous."""
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
            """
        )
        cur.execute(
            """
            SELECT a.attname
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = 'discovery_cite_metrics'::regclass AND i.indisprimary
            ORDER BY a.attnum
            """
        )
        pk_cols = [r[0] for r in cur.fetchall()]
        if pk_cols and pk_cols != [
            "subfield_id",
            "source_id",
            "year",
            "method",
        ]:
            cur.execute(
                "UPDATE discovery_cite_metrics SET method = 'simple' WHERE method IS NULL"
            )
            cur.execute(
                "ALTER TABLE discovery_cite_metrics DROP CONSTRAINT IF EXISTS "
                "discovery_cite_metrics_pkey"
            )
            cur.execute(
                "ALTER TABLE discovery_cite_metrics "
                "ADD PRIMARY KEY (subfield_id, source_id, year, method)"
            )
    conn.commit()


def save_metrics(
    conn,
    subfield_id: str,
    subfield_name: str | None,
    year: int,
    universo: list[dict],
    issn_map: dict[str, list],
) -> int:
    ensure_metrics_pk(conn)
    sfid = (
        subfield_id
        if subfield_id.startswith("subfields/")
        else f"subfields/{subfield_id}"
    )
    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM discovery_cite_metrics
            WHERE subfield_id = %s AND year = %s AND method = %s
            """,
            (sfid, year, METHOD),
        )
        for r in universo:
            cur.execute(
                """
                INSERT INTO discovery_cite_metrics
                    (subfield_id, subfield_name, source_id, source_name, issns,
                     year, share, works_window, dc_score, dc_percentile,
                     dc_quartile, method)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    sfid,
                    subfield_name,
                    r["source_id"],
                    r["name"],
                    issn_map.get(r["source_id"]) or [],
                    year,
                    round(r["share"], 4) if r.get("share") is not None else None,
                    r["docs"],
                    round(r["score"], 4),
                    r["percentile"],
                    r["quartile"],
                    METHOD,
                ),
            )
    conn.commit()
    return len(universo)


def belonging_share(topics, subfield_id: str) -> float:
    """Fracción de la producción de la revista en el subfield (vía topics)."""
    if not topics:
        return 0.0
    if isinstance(topics, str):
        topics = json.loads(topics)
    total = sum((t.get("count", 0) or 0) for t in topics)
    if not total:
        return 0.0
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
    return in_sf / total


def load_belonging_shares(
    conn, source_ids: list[str], subfield_id: str
) -> dict[str, float]:
    """Share del subfield por revista desde openalex_sources.topics."""
    sfid = (
        subfield_id
        if subfield_id.startswith("subfields/")
        else f"subfields/{subfield_id}"
    )
    shares: dict[str, float] = {}
    if not source_ids:
        return shares
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT source_id, topics, works_count
            FROM openalex_sources WHERE source_id = ANY(%s)
            """,
            (source_ids,),
        )
        for sid, topics, _wc in cur.fetchall():
            if not topics:
                continue
            shares[sid] = belonging_share(topics, sfid)
    return shares


def subfield_name_lookup(conn, subfield_id: str) -> str | None:
    sfid = (
        subfield_id
        if subfield_id.startswith("subfields/")
        else f"subfields/{subfield_id}"
    )
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT subfield_name FROM openalex_topics
            WHERE subfield_id = %s AND subfield_name IS NOT NULL LIMIT 1
            """,
            (sfid,),
        )
        row = cur.fetchone()
        if row:
            return row[0]
        cur.execute(
            """
            SELECT subfield_name FROM discovery_cite_metrics
            WHERE subfield_id = %s AND subfield_name IS NOT NULL LIMIT 1
            """,
            (sfid,),
        )
        row = cur.fetchone()
        return row[0] if row else None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--subfield", default="3109")
    ap.add_argument("--year", type=int, default=2024)
    ap.add_argument(
        "--min-docs",
        type=int,
        default=50,
        help="Mínimo de papers en la ventana para entrar al ranking",
    )
    ap.add_argument(
        "--min-share",
        type=float,
        default=0.30,
        help="Pertenencia mínima al subfield (topics) para entrar al ranking",
    )
    ap.add_argument(
        "--save",
        action="store_true",
        default=True,
        help="Guardar en discovery_cite_metrics (method=rigorous)",
    )
    ap.add_argument("--no-save", action="store_true")
    ap.add_argument("--skip-sjr", action="store_true")
    ap.add_argument(
        "--checkpoint",
        default="",
        help="Ruta JSON de checkpoint (default: data/dc_rigorous_<sf>_<year>.ckpt.json)",
    )
    ap.add_argument(
        "--dsn",
        default=os.environ.get(
            "CRIS_DB_DSN",
            "postgresql://postgres:victoria@localhost:5432/cris_victoria",
        ),
    )
    args = ap.parse_args()
    do_save = args.save and not args.no_save

    sid_num = args.subfield.replace("subfields/", "")
    y0 = args.year - 3
    ckpt = Path(
        args.checkpoint
        or f"cris-discovery-api/data/dc_rigorous_{sid_num}_{args.year}.ckpt.json"
    )
    print(
        f"=== Discovery Cite RIGUROSO — subfield {sid_num}, "
        f"CiteScore {args.year} (ventana {y0}-{args.year}) ===\n"
    )
    if not KEY:
        print("⚠ Sin OPENALEX_API_KEY — puede fallar por presupuesto free.\n")

    print("1. Streaming works elegibles del subfield (agregando en vivo)...")
    print(f"   checkpoint: {ckpt}")
    try:
        scores = stream_aggregate(sid_num, y0, args.year, checkpoint=ckpt)
    except Exception:
        traceback.print_exc()
        print(
            "\n⚠ Falló el stream. Re-ejecuta el mismo comando para reanudar "
            f"desde {ckpt}",
            flush=True,
        )
        raise
    print(f"   {len(scores):,} revistas con ≥1 paper elegible\n")

    print("2. Ranking por CiteScore riguroso...")
    universo = [
        {"source_id": sid, **v}
        for sid, v in scores.items()
        if v["docs"] >= args.min_docs
    ]
    print(f"   {len(universo)} revistas con >= {args.min_docs} papers")

    if not universo:
        print("Sin revistas tras el filtro. Baja --min-docs.")
        return

    import psycopg

    conn = psycopg.connect(args.dsn)

    # Antes de cuartiles: filtrar por pertenencia al subfield (excluye BMJ etc.)
    shares = load_belonging_shares(conn, [r["source_id"] for r in universo], sid_num)
    before = len(universo)
    for r in universo:
        r["share"] = shares.get(r["source_id"], 0.0)
    universo = [r for r in universo if r["share"] >= args.min_share]
    print(
        f"   {len(universo)} revistas con share >= {args.min_share:.0%} "
        f"(filtradas {before - len(universo)})\n"
    )

    if not universo:
        print("Sin revistas tras el filtro de pertenencia. Baja --min-share.")
        conn.close()
        return

    universo.sort(key=lambda x: x["score"], reverse=True)
    n = len(universo)
    for i, r in enumerate(universo):
        pct = (1 - (i + 1) / n) * 100
        r["percentile"] = round(pct, 1)
        r["quartile"] = (
            "Q1"
            if pct >= 75
            else "Q2"
            if pct >= 50
            else "Q3"
            if pct >= 25
            else "Q4"
        )

    print("   Top 5 por CiteScore:")
    for r in universo[:5]:
        print(
            f"     {r['quartile']}  {r['score']:6.2f}  "
            f"share={r['share']:.0%}  "
            f"({r['cites']:,}c/{r['docs']}d)  {r['name'][:40]}"
        )
    print()

    sids = [r["source_id"] for r in universo]
    with conn.cursor() as cur:
        cur.execute(
            "SELECT source_id, issns FROM openalex_sources WHERE source_id = ANY(%s)",
            (sids,),
        )
        issn_map = {row[0]: (row[1] or []) for row in cur.fetchall()}

    sf_name = subfield_name_lookup(conn, sid_num)

    if do_save:
        print("3. Guardando method=rigorous en discovery_cite_metrics...")
        saved = save_metrics(conn, sid_num, sf_name, args.year, universo, issn_map)
        print(f"   {saved} filas guardadas\n")
    else:
        print("3. (skip --no-save)\n")

    if args.skip_sjr:
        conn.close()
        print("Hecho (sin validación Scimago).")
        return

    print("4. VALIDACIÓN contra Scimago...")

    def norm(v):
        s = re.sub(r"[^0-9Xx]", "", str(v or "")).upper()
        return s if len(s) == 8 else None

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT unnest(issns) AS issn, sjr_quartile
            FROM sources WHERE sjr_quartile IS NOT NULL
            """
        )
        scimago = {}
        for issn, q in cur.fetchall():
            ni = norm(issn)
            if ni:
                scimago[ni] = q
    conn.close()

    coincide = difiere = sin_sjr = cerca = 0
    tabla = []
    for r in universo:
        sjr = None
        for issn in issn_map.get(r["source_id"], []):
            sjr = scimago.get(norm(issn) or "")
            if sjr:
                break
        if not sjr:
            sin_sjr += 1
            continue
        if r["quartile"] == sjr:
            coincide += 1
        else:
            difiere += 1
        if abs(int(r["quartile"][1]) - int(sjr[1])) <= 1:
            cerca += 1
        tabla.append((r["name"][:38], r["quartile"], sjr))

    con_ambos = coincide + difiere
    print(f"\n   Revistas con Scimago: {con_ambos}  |  Solo DC: {sin_sjr}")
    if con_ambos:
        print(f"   EXACTA: {coincide}/{con_ambos} = {100 * coincide / con_ambos:.0f}%")
        print(f"   ±1:     {cerca}/{con_ambos} = {100 * cerca / con_ambos:.0f}%")
        print(f"\n   {'Revista':<38} {'DC':<4} {'SJR'}")
        for name, dc, sj in tabla[:20]:
            mark = "" if dc == sj else "  <-"
            print(f"   {name:<38} {dc:<4} {sj}{mark}")

    print("\n" + "=" * 60)
    if con_ambos:
        pct = 100 * coincide / con_ambos
        print(f"RIGUROSO: {pct:.0f}% exacta vs SJR")
    else:
        print("Sin revistas cruzables con Scimago.")


if __name__ == "__main__":
    main()
