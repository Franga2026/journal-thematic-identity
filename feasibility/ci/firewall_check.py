#!/usr/bin/env python3
"""Static firewall check for Pipeline A (Phase 0).

Run in CI *before* any Phase-0 execution. Exit code 0 = clean, 1 = firewall
breach. It enforces the sealed protocol (v1.1) at the source level:

  1. No prohibited symbol (ci/prohibited_symbols.txt) appears as an identifier
     or as a non-docstring string literal anywhere in feasibility/src/**.py or
     feasibility/run_phase0.py. Docstrings are exempt so the code may *describe*
     what it must not do.
  2. feasibility/analysis-side code stays locked: ../analysis/ contains no .py.
  3. feasibility/out/ contains only allowlisted filenames (ci/permitted_outputs.txt).

The check itself is allowed to reference the prohibited tokens because it loads
them from the data file rather than hardcoding them, and this file lives in
ci/, which is not scanned.

Usage:
    python feasibility/ci/firewall_check.py
"""

from __future__ import annotations

import ast
import sys
from pathlib import Path

CI_DIR = Path(__file__).resolve().parent
FEAS_ROOT = CI_DIR.parent
REPO_ROOT = FEAS_ROOT.parent
ANALYSIS_DIR = REPO_ROOT / "analysis"


def load_list(path: Path) -> list[str]:
    out: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            out.append(line)
    return out


PROHIBITED = [t.lower() for t in load_list(CI_DIR / "prohibited_symbols.txt")]
PERMITTED = set(load_list(CI_DIR / "permitted_outputs.txt"))


def scanned_py_files() -> list[Path]:
    files = sorted((FEAS_ROOT / "src").rglob("*.py"))
    orchestrator = FEAS_ROOT / "run_phase0.py"
    if orchestrator.exists():
        files.append(orchestrator)
    return files


def _hits(text: str) -> list[str]:
    low = text.lower()
    return [tok for tok in PROHIBITED if tok in low]


def _docstring_nodes(tree: ast.AST) -> set[int]:
    """id() of Constant nodes that are docstrings (module/class/func first stmt)."""
    doc_ids: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            body = getattr(node, "body", [])
            if body and isinstance(body[0], ast.Expr) and isinstance(body[0].value, ast.Constant) \
                    and isinstance(body[0].value.value, str):
                doc_ids.add(id(body[0].value))
    return doc_ids


def check_source() -> list[str]:
    findings: list[str] = []
    for path in scanned_py_files():
        src = path.read_text(encoding="utf-8")
        try:
            tree = ast.parse(src, filename=str(path))
        except SyntaxError as exc:  # pragma: no cover
            findings.append(f"{path}: syntax error, cannot vet ({exc})")
            continue
        doc_ids = _docstring_nodes(tree)
        rel = path.relative_to(REPO_ROOT)
        for node in ast.walk(tree):
            # identifiers: names, attributes, def names, arg names, imports
            ident = None
            if isinstance(node, ast.Name):
                ident = node.id
            elif isinstance(node, ast.Attribute):
                ident = node.attr
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                ident = node.name
            elif isinstance(node, ast.arg):
                ident = node.arg
            elif isinstance(node, ast.alias):
                ident = (node.asname or node.name)
            if ident:
                for tok in _hits(ident):
                    findings.append(f"{rel}:{getattr(node, 'lineno', '?')}: identifier {ident!r} contains prohibited token {tok!r}")
            # non-docstring string literals
            if isinstance(node, ast.Constant) and isinstance(node.value, str) and id(node) not in doc_ids:
                for tok in _hits(node.value):
                    findings.append(f"{rel}:{getattr(node, 'lineno', '?')}: string literal contains prohibited token {tok!r}")
    return findings


def check_analysis_locked() -> list[str]:
    if not ANALYSIS_DIR.exists():
        return []
    py = sorted(ANALYSIS_DIR.rglob("*.py"))
    return [f"analysis/ is LOCKED but contains code: {p.relative_to(REPO_ROOT)}" for p in py]


def check_out_allowlist() -> list[str]:
    out_dir = FEAS_ROOT / "out"
    if not out_dir.exists():
        return []
    findings = []
    for p in sorted(out_dir.iterdir()):
        if p.is_file() and p.name != ".gitkeep" and p.name not in PERMITTED:
            findings.append(f"out/ contains non-allowlisted output: {p.name}")
    return findings


def main() -> int:
    findings: list[str] = []
    findings += check_source()
    findings += check_analysis_locked()
    findings += check_out_allowlist()
    if findings:
        print("FIREWALL CHECK: FAIL")
        for f in findings:
            print("  -", f)
        print(f"\n{len(findings)} breach(es). Phase 0 must not run.")
        return 1
    print("FIREWALL CHECK: PASS")
    print(f"  scanned {len(scanned_py_files())} source file(s); "
          f"{len(PROHIBITED)} prohibited tokens; analysis/ locked; out/ allowlist clean.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
