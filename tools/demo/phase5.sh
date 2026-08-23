#!/usr/bin/env bash
# Phase 5 acceptance: a fine-tuned specialist model on the synthetic routing
# task matches-or-beats frontier accuracy on held-out data at materially
# lower cost/latency — shown side-by-side in the dashboard.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

pass() { printf "\033[32mPASS\033[0m %s\n" "$1"; }
fail() { printf "\033[31mFAIL\033[0m %s\n" "$1"; exit 1; }

PSQL="docker compose exec -T postgres psql -U diagnost -d diagnost -tAc"

echo "Phase 5 — custom model training acceptance"

docker compose up -d --wait >/dev/null 2>&1 || true

# ── ensure labeled data exists (Phase 2 pipeline) ──────────────────
COUNT=$($PSQL "SELECT count(*) FROM cluster_members cm JOIN clusters c ON c.id=cm.cluster_id WHERE c.workspace_id='ws_dev' AND c.intent NOT IN ('general_inquiry')")
if [[ "${COUNT:-0}" -lt 50 ]]; then
  echo "insufficient labeled data ($COUNT) — running Phase 2 pipeline first..."
  bash tools/demo/run.sh phase2 >/dev/null 2>&1
fi
COUNT=$($PSQL "SELECT count(*) FROM cluster_members cm JOIN clusters c ON c.id=cm.cluster_id WHERE c.workspace_id='ws_dev' AND c.intent NOT IN ('general_inquiry')")
[[ "${COUNT:-0}" -ge 50 ]] && pass "labeled corpus available ($COUNT conversations)" || fail "no labeled data"

# ── run export → train → benchmark pipeline ────────────────────────
PY="apps/finetune/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  if python3 -c "import sklearn, joblib, psycopg" >/dev/null 2>&1; then PY="python3";
  else (cd apps/finetune && python3 -m venv .venv && .venv/bin/pip install --quiet numpy scikit-learn joblib httpx "psycopg[binary]" boto3); PY="apps/finetune/.venv/bin/python"; fi
fi

OUT=$("$PY" apps/finetune/run_pipeline.py)
echo "$OUT" | grep -q "\[train\]" && pass "specialist trained" || fail "training failed"
echo "$OUT" | grep -q "acceptance invariants hold" && pass "invariants asserted in-pipeline (accuracy ≥, cost <, latency <)" || fail "invariants failed"

S3_REF=$(echo "$OUT" | grep -oE "s3://finetune-datasets/[^ ]+" | head -1)
[[ -n "$S3_REF" ]] && pass "SFT dataset exported to object storage ($S3_REF)" || fail "no S3 dataset ref"
MC_PATH=${S3_REF#s3://}            # finetune-datasets/routing/<id>/train.jsonl
LINES=$(docker compose exec -T minio sh -c 'mc cat "local/'"$MC_PATH"'"' 2>/dev/null | wc -l)
[[ "${LINES:-0}" -ge 100 ]] && pass "dataset readable from MinIO ($LINES SFT rows)" || fail "dataset unreadable ($LINES rows)"

# ── benchmark record invariants from Postgres ──────────────────────
BM=$($PSQL "SELECT candidates::text FROM model_benchmarks ORDER BY created_at DESC LIMIT 1")
WINNER=$($PSQL "SELECT winner FROM model_benchmarks ORDER BY created_at DESC LIMIT 1")
echo "$WINNER" | grep -q "specialist" && pass "specialist declared winner ($WINNER)" || fail "winner=$WINNER"

python3 - << EOF
import json
cands = json.loads("""$BM""")
cs = {c["kind"]: c for c in cands}
f, s = cs["frontier"], cs["specialist"]
assert s["accuracy"] >= f["accuracy"] - 0.001, f"accuracy: specialist {s['accuracy']} vs frontier {f['accuracy']}"
assert s["p95_ms"] < f["p95_ms"], f"latency: {s['p95_ms']} vs {f['p95_ms']}"
assert s["cost_per_1k_usd"] < f["cost_per_1k_usd"], "cost"
assert s["measured_latency"] and not f["measured_latency"]
print(f"side-by-side ok: acc {s['accuracy']:.3f} vs {f['accuracy']:.3f}; p95 {s['p95_ms']}ms vs {f['p95_ms']}ms; \$/1k \${s['cost_per_1k_usd']} vs \${f['cost_per_1k_usd']}")
EOF
pass "benchmark side-by-side: matches/beats frontier at lower cost+latency"

MODEL_REF=$($PSQL "SELECT model_ref FROM fine_tunes WHERE status='succeeded' ORDER BY created_at DESC LIMIT 1")
[[ -f "$MODEL_REF" ]] && pass "specialist artifact persisted ($MODEL_REF)" || fail "model artifact missing"

(cd apps/finetune && PYTHONPATH=src .venv/bin/python -m pytest tests/ -q >/dev/null) \
  && pass "finetune unit tests (5)" || fail "pytest failed"

# ── dashboard renders comparison ────────────────────────────────────
pnpm --filter @diagnostic/dashboard build >/dev/null 2>&1 || pnpm --filter @diagnost/dashboard build >/dev/null
mkdir -p /tmp/diagnost-logs
fuser -k -n tcp 3100 >/dev/null 2>&1 || true; sleep 0.5
(pnpm --filter @diagnost/dashboard start > /tmp/diagnost-logs/dash.log 2>&1 &)
for i in $(seq 1 20); do curl -sf http://localhost:3100/models >/dev/null 2>&1 && break; sleep 0.5; done
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/models)
BODY=$(curl -s http://localhost:3100/models)
if [[ "$CODE" == "200" ]] && echo "$BODY" | grep -q "winner" && echo "$BODY" | grep -q "specialist:fine-tuned-router"; then
  pass "dashboard /models shows side-by-side comparison with winner badge"
else
  fail "models page broken ($CODE)"
fi
fuser -k -n tcp 3100 >/dev/null 2>&1 || true

echo ""
echo "All Phase 5 acceptance checks passed."
