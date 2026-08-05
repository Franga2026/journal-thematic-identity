#!/usr/bin/env bash
# Launcher local de Prueba D — NO modifica los bytes sellados del kit.
# Copia a un workdir, reescribe solo rutas /home/claude y INPUT_CSV, corre el runner,
# y compara artefactos contra los sellados (salvo run_iso_utc en el manifiesto).
set -euo pipefail
KIT="$(cd "$(dirname "$0")" && pwd)"
PY="${PY:-python3}"
if [[ -x "$KIT/../.venv/bin/python" ]]; then PY="$KIT/../.venv/bin/python"; fi
WORK="${TMPDIR:-/tmp}/pruebaD_local_$$"
mkdir -p "$WORK"
cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

cp -a "$KIT"/*.py "$KIT"/D_panel_input_combined.csv "$WORK/"
# plumbing only
INPUT_CSV="$WORK/D_panel_input_combined.csv"
perl -pi -e "s|/home/claude|$WORK|g; s|INPUT_CSV=\".*\"|INPUT_CSV=\"$INPUT_CSV\"|" \
  "$WORK/estudio1_pruebaD.py" "$WORK/tests_pruebaD.py"

run_once() {
  local seed="$1" out="$2"
  mkdir -p "$out"
  # runner writes into WORK via rewritten paths; isolate by fresh WORK copy per run
  local w="$out/work"
  mkdir -p "$w"
  cp -a "$WORK"/*.py "$WORK"/D_panel_input_combined.csv "$w/"
  perl -pi -e "s|$WORK|$w|g" "$w/estudio1_pruebaD.py" "$w/tests_pruebaD.py"
  (cd "$w" && PYTHONHASHSEED="$seed" "$PY" estudio1_pruebaD.py) | tee "$out/run.log"
  for f in canonical_D_observed.csv canonical_D_null.npy canonical_D_directionality.csv \
           canonical_D_robustness.csv run_manifest_universe_D.json; do
    cp "$w/$f" "$out/$f"
  done
}

echo "=== Test 1a: PYTHONHASHSEED=0 ==="
run_once 0 "$KIT/_local_run_A"
echo "=== Test 1b: PYTHONHASHSEED=1 ==="
run_once 1 "$KIT/_local_run_B"

echo "=== Comparar artefactos byte-idénticos entre seeds (salvo manifiesto) ==="
ok=1
for f in canonical_D_observed.csv canonical_D_null.npy canonical_D_directionality.csv canonical_D_robustness.csv; do
  if cmp -s "$KIT/_local_run_A/$f" "$KIT/_local_run_B/$f"; then
    echo "OK A≡B $f"
  else
    echo "FAIL A≠B $f"; ok=0
  fi
  if cmp -s "$KIT/_local_run_A/$f" "$KIT/$f"; then
    echo "OK A≡sealed $f"
  else
    echo "FAIL A≠sealed $f"; ok=0
  fi
done

"$PY" - <<PY
import json
from pathlib import Path
kit=Path("$KIT")
def load(p):
    return json.loads(Path(p).read_text())
a=load(kit/"_local_run_A/run_manifest_universe_D.json")
b=load(kit/"_local_run_B/run_manifest_universe_D.json")
s=load(kit/"run_manifest_universe_D.json")
def strip(m):
    m=dict(m); m.pop("run_iso_utc", None); m.pop("run_epoch", None); return m
print("A≡B salvo utc/epoch:", strip(a)==strip(b))
print("A≡sealed salvo utc/epoch:", strip(a)==strip(s))
print("veredicto A:", a.get("verdict") or a.get("celdas") or a.get("decision") or list(a.keys())[:8])
# print F / verdict keys
for k in ("verdict","F_obs","results","decision","celda"):
    if k in a: print(k, a[k])
PY

echo "=== SHA sellados del kit (intactos) ==="
(cd "$KIT" && sha256sum -c SHA256SUMS)
echo "DONE local Test 1"
