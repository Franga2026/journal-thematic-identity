"""Conexión a PostgreSQL (catálogo CRIS Victoria)."""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Iterator

import psycopg
from psycopg.rows import dict_row

DSN = os.getenv("CRIS_DB_DSN")
if not DSN:
    raise RuntimeError(
        "CRIS_DB_DSN is not set. "
        "Provide a PostgreSQL DSN through the environment."
    )
DSN = DSN.strip()


@contextmanager
def get_conn() -> Iterator[psycopg.Connection]:
    conn = psycopg.connect(DSN, row_factory=dict_row)
    try:
        yield conn
    finally:
        conn.close()


def db_ok() -> bool:
    try:
        with get_conn() as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False
