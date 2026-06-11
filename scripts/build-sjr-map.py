#!/usr/bin/env python3
"""
build-sjr-map.py — Genera scripts/data/sjr-2025-quartiles.json desde el CSV de Scimago.

Fuente: exportación "Scimago Journal Rank" (scimagojr.com), columna Issn + SJR Best Quartile.

Bug conocido: en Excel/pandas, revistas con un solo ISSN numérico se leen como float
(p. ej. 20501161 → 20501161.0). Al convertir a texto quedan claves inválidas ("20501161.0")
o pierden ceros iniciales (220515 → "220515.0" en vez de "00220515"). ~8.500 ISSN (~26%)
quedaban fuera del mapa.

Fix: si la celda ISSN es numérica (o string tipo "1234567.0"), reconstruir como
f"{int(round(v)):08d}" antes de indexar.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = SCRIPT_DIR / "data" / "scimagojr-2025.csv"
DEFAULT_OUTPUT = SCRIPT_DIR / "data" / "sjr-2025-quartiles.json"

QUARTILES = frozenset({"Q1", "Q2", "Q3", "Q4"})
ISSN_RE = re.compile(r"^[0-9X]{8}$")


def norm_issn_token(raw: str) -> str | None:
    p = raw.strip().upper().replace("-", "")
    if not p:
        return None
    # Corrupción float desde Excel / pandas
    if re.fullmatch(r"\d+\.0", p) or re.fullmatch(r"\d+\.\d+", p):
        p = f"{int(round(float(p))):08d}"
    elif re.fullmatch(r"\d+", p):
        p = f"{int(p):08d}"
    if len(p) == 8 and ISSN_RE.fullmatch(p):
        return p
    return None


def parse_issn_field(raw: str) -> list[str]:
    out: list[str] = []
    for part in re.split(r"[,;]", raw):
        norm = norm_issn_token(part)
        if norm:
            out.append(norm)
    return out


def build_map(csv_path: Path) -> dict[str, str]:
    m: dict[str, str] = {}
    with csv_path.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            q = (row.get("SJR Best Quartile") or "").strip()
            if q not in QUARTILES:
                continue
            for issn in parse_issn_field(row.get("Issn") or ""):
                m[issn] = q
    return m


def main() -> int:
    ap = argparse.ArgumentParser(description="Build ISSN→quartile map from Scimago CSV")
    ap.add_argument(
        "-i",
        "--input",
        type=Path,
        default=DEFAULT_INPUT,
        help=f"Scimago CSV (default: {DEFAULT_INPUT})",
    )
    ap.add_argument(
        "-o",
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help=f"Output JSON (default: {DEFAULT_OUTPUT})",
    )
    args = ap.parse_args()

    if not args.input.is_file():
        print(f"Error: no existe {args.input}", file=sys.stderr)
        return 1

    m = build_map(args.input)
    keys = list(m.keys())
    if not keys:
        print("Error: mapa vacío", file=sys.stderr)
        return 1
    if not all(len(k) == 8 for k in keys):
        bad = [k for k in keys if len(k) != 8][:5]
        print(f"Error: claves con largo ≠ 8: {bad}", file=sys.stderr)
        return 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(m, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    print(f"✓ {len(keys):,} ISSN → {args.output}")
    print(f"  muestra: 16972600={m.get('16972600')}  20501161={m.get('20501161')}  16640640={m.get('16640640')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
