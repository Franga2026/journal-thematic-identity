#!/usr/bin/env bash
# Genera rankings ODS (Global + Iberoamérica) para una lista de SDGs.
# Uso: bash scripts/ods/run-all-ods.sh "12 11 10 9 8 7 6 5 4 3 2 1"
#      DELAY=200 bash scripts/ods/run-all-ods.sh "7 6 5"
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

DELAY="${DELAY:-200}"
SDGS="${1:-}"

if [[ -z "$SDGS" ]]; then
  echo "Uso: $0 \"12 11 10 ...\""
  echo "  DELAY=200 (ms entre llamadas OpenAlex, por defecto 200)"
  exit 1
fi

mkdir -p outputs/ods-rankings public/ods-rankings

for sdg in $SDGS; do
  echo ""
  echo "════════════════════════════════════════"
  echo " ODS $sdg — $(date '+%Y-%m-%d %H:%M:%S')"
  echo "════════════════════════════════════════"
  node scripts/ods/build-ods-rankings.mjs --sdg "$sdg" --delay "$DELAY"
  if [[ -f "outputs/ods-rankings/sdg-${sdg}.json" ]]; then
    cp "outputs/ods-rankings/sdg-${sdg}.json" "public/ods-rankings/sdg-${sdg}.json"
    echo "→ public/ods-rankings/sdg-${sdg}.json"
  fi
done

echo ""
echo "Listo: $(date '+%Y-%m-%d %H:%M:%S')"
