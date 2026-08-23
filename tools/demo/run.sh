#!/usr/bin/env bash
# Diagnost AI — phase acceptance runner.
# Usage: bash tools/demo/run.sh [phase0|phase1|...]
set -euo pipefail

PHASE="${1:-all}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

run_phase() {
  local script="$ROOT/tools/demo/phase$1.sh"
  if [[ ! -f "$script" ]]; then
    echo "SKIP: no acceptance script for phase $1"
    return 0
  fi
  echo "── Phase $1 acceptance ──"
  bash "$script"
}

if [[ "$PHASE" == "all" ]]; then
  for p in 0 1 2 3 4 5 6; do
    run_phase "$p"
  done
else
  run_phase "${PHASE#phase}"
fi
