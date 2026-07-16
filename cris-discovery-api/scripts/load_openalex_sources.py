#!/usr/bin/env python3
"""
load_openalex_sources.py — Descarga el snapshot de SOURCES de OpenAlex y lo
carga en la tabla openalex_sources (el universo mundial de revistas).

Esto es el cimiento de Discovery Cite: las ~283.287 revistas del mundo con su
counts_by_year, topics e ISSN. Con esto se calculan los 252 subfields SIN tocar
la API (cero rate-limits, reproducible).

Baja solo la partición sources/ en parquet (~162 MiB), NO el dump completo (~746 GB).

Uso:
    python load_openalex_sources.py                    # baja + carga todo
    python load_openalex_sources.py --skip-download    # ya bajado, solo carga
    python load_openalex_sources.py --limit 5          # prueba con 5 archivos
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import boto3
import polars as pl
import psycopg
from botocore import UNSIGNED
from botocore.config import Config
from psycopg.types.json import Jsonb

BUCKET = "openalex"
PREFIX = "data/parquet/sources/"


def _repo_root() -> Path:
    """Funciona desde cris-discovery-api/scripts/ o copiado en la raíz del repo."""
    here = Path(__file__).resolve().parent
    for cand in (here, *here.parents):
        if (cand / "data" / "openalex-snapshot").is_dir() or (
            cand / "cris-discovery-api"
        ).is_dir():
            return cand
    return here


REPO = _repo_root()
LOCAL = REPO / "data/openalex-snapshot/sources"
DSN = os.environ.get(
    "CRIS_DB_DSN",
    "postgresql://postgres:victoria@localhost:5432/cris_victoria",
)


def short_id(url: str | None) -> str | None:
    if not url:
        return None
    # Conservar jerarquía subfields/ / fields/
    if "/subfields/" in url:
        return "subfields/" + url.rsplit("/", 1)[-1]
    if "/fields/" in url:
        return "fields/" + url.rsplit("/", 1)[-1]
    return url.rsplit("/", 1)[-1]


def list_parquet_keys() -> list[dict]:
    s3 = boto3.client("s3", config=Config(signature_version=UNSIGNED))
    paginator = s3.get_paginator("list_objects_v2")
    out: list[dict] = []
    for page in paginator.paginate(Bucket=BUCKET, Prefix=PREFIX):
        for o in page.get("Contents") or []:
            if o["Key"].endswith(".parquet"):
                out.append(o)
    return out


def download(limit: int | None = None) -> list[Path]:
    s3 = boto3.client("s3", config=Config(signature_version=UNSIGNED))
    parquets = list_parquet_keys()
    if limit:
        parquets = parquets[:limit]
    LOCAL.mkdir(parents=True, exist_ok=True)
    print(f"Descargando {len(parquets)} archivos parquet → {LOCAL}")
    for i, o in enumerate(parquets, 1):
        dest = LOCAL / o["Key"].replace("/", "__")
        if dest.exists() and dest.stat().st_size == o["Size"]:
            print(f"  [{i}/{len(parquets)}] skip {dest.name}")
            continue
        s3.download_file(BUCKET, o["Key"], str(dest))
        print(
            f"  [{i}/{len(parquets)}] {dest.name} ({o['Size'] / 1024 / 1024:.1f} MiB)"
        )
    return sorted(LOCAL.glob("*.parquet"))


def create_table(conn: psycopg.Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS openalex_sources (
                source_id       TEXT PRIMARY KEY,       -- S137773608
                name            TEXT,
                issns           TEXT[],
                issn_l          TEXT,
                is_oa           BOOLEAN,
                is_in_doaj      BOOLEAN,
                works_count     INTEGER,
                cited_by_count  BIGINT,
                counts_by_year  JSONB,
                topics          JSONB,
                homepage_url    TEXT,
                type            TEXT,
                updated_date    TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_oa_sources_issns
                ON openalex_sources USING GIN (issns);
            CREATE INDEX IF NOT EXISTS idx_oa_sources_type
                ON openalex_sources (type);
            """
        )
    conn.commit()


def _as_list(val):
    if val is None:
        return None
    if isinstance(val, list):
        return val
    if isinstance(val, str):
        try:
            parsed = json.loads(val)
            return parsed if isinstance(parsed, list) else [val]
        except Exception:
            return [val]
    return None


def _topics_slim(topics) -> list[dict] | None:
    topics = _as_list(topics)
    if not topics:
        return None
    out = []
    for t in topics:
        if not isinstance(t, dict):
            continue
        sf = t.get("subfield") or {}
        fld = t.get("field") or {}
        out.append(
            {
                "id": short_id(t.get("id")),
                "count": t.get("count"),
                "subfield_id": short_id(sf.get("id"))
                if isinstance(sf, dict)
                else None,
                "field_id": short_id(fld.get("id")) if isinstance(fld, dict) else None,
            }
        )
    return out or None


def load(files: list[Path], conn: psycopg.Connection) -> int:
    create_table(conn)
    total = 0
    sql = """
        INSERT INTO openalex_sources
            (source_id, name, issns, issn_l, is_oa, is_in_doaj,
             works_count, cited_by_count, counts_by_year, topics,
             homepage_url, type, updated_date)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (source_id) DO UPDATE SET
            name = EXCLUDED.name,
            issns = EXCLUDED.issns,
            issn_l = EXCLUDED.issn_l,
            is_oa = EXCLUDED.is_oa,
            is_in_doaj = EXCLUDED.is_in_doaj,
            counts_by_year = EXCLUDED.counts_by_year,
            topics = EXCLUDED.topics,
            works_count = EXCLUDED.works_count,
            cited_by_count = EXCLUDED.cited_by_count,
            homepage_url = EXCLUDED.homepage_url,
            type = EXCLUDED.type,
            updated_date = EXCLUDED.updated_date
    """
    for f in files:
        df = pl.read_parquet(f)
        rows = df.to_dicts()
        batch = []
        for r in rows:
            sid = short_id(r.get("id"))
            if not sid:
                continue
            issns = _as_list(r.get("issn"))
            cby = r.get("counts_by_year")
            if isinstance(cby, str):
                try:
                    cby = json.loads(cby)
                except Exception:
                    cby = None
            topics_slim = _topics_slim(r.get("topics"))
            # is_in_doaj a veces viene anidado
            is_in_doaj = r.get("is_in_doaj")
            if isinstance(is_in_doaj, dict):
                is_in_doaj = is_in_doaj.get("is_in_doaj")
            batch.append(
                (
                    sid,
                    r.get("display_name"),
                    issns,
                    r.get("issn_l"),
                    r.get("is_oa"),
                    is_in_doaj,
                    r.get("works_count"),
                    r.get("cited_by_count"),
                    Jsonb(cby) if cby is not None else None,
                    Jsonb(topics_slim) if topics_slim is not None else None,
                    r.get("homepage_url"),
                    r.get("type"),
                    str(r.get("updated_date")) if r.get("updated_date") is not None else None,
                )
            )
        with conn.cursor() as cur:
            cur.executemany(sql, batch)
        conn.commit()
        total += len(batch)
        print(f"  {f.name}: +{len(batch):,} (total {total:,})")
    return total


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-download", action="store_true")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument(
        "--dsn",
        default=DSN,
        help="Postgres DSN (default CRIS_DB_DSN o localhost)",
    )
    args = ap.parse_args()

    if args.skip_download:
        files = sorted(LOCAL.glob("*.parquet"))
        if args.limit:
            files = files[: args.limit]
        print(f"Usando {len(files)} archivos ya descargados en {LOCAL}")
    else:
        files = download(args.limit)

    if not files:
        print("No hay archivos parquet. Revisa la descarga.")
        return

    conn = psycopg.connect(args.dsn)
    total = load(files, conn)
    print(f"\n✓ Cargadas {total:,} sources de OpenAlex")

    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM openalex_sources")
        print(f"  Total en la tabla: {cur.fetchone()[0]:,}")
        cur.execute(
            "SELECT COUNT(*) FROM openalex_sources WHERE counts_by_year IS NOT NULL"
        )
        print(f"  Con counts_by_year: {cur.fetchone()[0]:,}")
        cur.execute("SELECT COUNT(*) FROM openalex_sources WHERE issns IS NOT NULL")
        print(f"  Con ISSN: {cur.fetchone()[0]:,}")
        cur.execute(
            "SELECT COUNT(*) FROM openalex_sources WHERE type = 'journal'"
        )
        print(f"  type=journal: {cur.fetchone()[0]:,}")
    conn.close()


if __name__ == "__main__":
    main()
