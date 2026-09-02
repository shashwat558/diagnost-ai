#!/usr/bin/env bash
# Phase 2 acceptance: seeded 5k-conversation dataset with 3 injected failure
# patterns surfaces as top clusters, sources link back, drift alert fires
# for the spiking pattern only.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

pass() { printf "\033[32mPASS\033[0m %s\n" "$1"; }
fail() { printf "\033[31mFAIL\033[0m %s\n" "$1"; exit 1; }

CH_USER="${CLICKHOUSE_USER:-diagnost}"
CH_PASS="${CLICKHOUSE_PASSWORD:-diagnost_dev_password}"

echo "Phase 2 — conversation intelligence acceptance"

# 0. infra + schema
docker compose up -d --wait >/dev/null 2>&1 || true
pnpm --filter @diagnost/db build >/dev/null
pnpm --filter @diagnost/db migrate >/dev/null

# clean slate: event store + intelligence state (Kafka offsets stay committed)
docker compose exec -T clickhouse clickhouse-client --user "$CH_USER" --password "$CH_PASS" \
  --query "TRUNCATE TABLE events.events"
docker compose exec -T postgres psql -U diagnost -d diagnost \
  -c "TRUNCATE alert_deliveries, alerts, remediations, cluster_members, clusters, processed_conversations;" >/dev/null

# 1. ingestion pipeline live
fuser -k -n tcp 4100 >/dev/null 2>&1 || true; sleep 0.5
mkdir -p /tmp/diagnost-logs
node apps/api/dist/index.js > /tmp/diagnost-logs/api.log 2>&1 &
API_PID=$!
node apps/api/dist/consumer.js > /tmp/diagnost-logs/consumer.log 2>&1 &
CONSUMER_PID=$!
trap 'kill $API_PID $CONSUMER_PID 2>/dev/null || true' EXIT
for i in $(seq 1 30); do curl -sf http://localhost:4100/healthz >/dev/null 2>&1 && break; sleep 0.5; done
curl -sf http://localhost:4100/healthz >/dev/null || fail "api did not start"

# python env ready: prefer local venv, fall back to preinstalled interpreter
PY="apps/analysis/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  if python3 -c "import hdbscan, sklearn, psycopg" >/dev/null 2>&1; then
    PY="python3"
  else
    echo "creating analysis venv..."
    (cd apps/analysis && python3 -m venv .venv && .venv/bin/pip install --quiet numpy hdbscan scikit-learn httpx "psycopg[binary]")
    PY="apps/analysis/.venv/bin/python"
  fi
fi

# 2. seed 5,000 synthetic conversations (3 injected patterns, B spikes)
SEED_OUT=$(node tools/seed/phase2-seed.mjs)
TOTAL=$(echo "$SEED_OUT" | grep -oE 'accepted [0-9]+' | grep -oE '[0-9]+')
echo "seeded $TOTAL events; waiting for consumer to drain..."
for i in $(seq 1 90); do
  N=$(docker compose exec -T clickhouse clickhouse-client --user "$CH_USER" --password "$CH_PASS" \
    --query "SELECT count() FROM events.events WHERE conversation_id LIKE 'conv_seed%'" 2>/dev/null || echo 0)
  [[ "${N:-0}" == "$TOTAL" ]] && break
  sleep 2
done
[[ "${N:-0}" == "$TOTAL" ]] && pass "seeded dataset ingested ($N events)" || fail "drain incomplete ($N/$TOTAL)"

# 3. analysis pipeline: embed → HDBSCAN → judge → drift
"$PY" apps/analysis/run_analysis.py > /tmp/diagnost-logs/analysis.log 2>&1 || { cat /tmp/diagnost-logs/analysis.log; fail "analysis failed"; }
grep -q "clusters=" /tmp/diagnost-logs/analysis.log && pass "analysis pipeline ran" || fail "no analysis output"

PSQL="docker compose exec -T postgres psql -U diagnost -d diagnost -tAc"

# 4. all 3 injected patterns surface as TOP clusters (by failure impact)
TOP6=$($PSQL "SELECT string_agg(intent, ',') FROM (
  SELECT intent, row_number() OVER (ORDER BY size*error_rate DESC) rn FROM clusters) t WHERE rn <= 6")
echo "$TOP6" | grep -q "date_format_error" && pass "pattern B (date_format_error) in top clusters" || fail "B missing from top: $TOP6"
echo "$TOP6" | grep -q "tool_timeout" && pass "pattern A (tool_timeout) in top clusters" || fail "A missing from top: $TOP6"
echo "$TOP6" | grep -q "billing_dispute" && pass "pattern C (billing_dispute) in top clusters" || fail "C missing from top: $TOP6"

RANK_B=$($PSQL "SELECT rn FROM (SELECT id, row_number() OVER (ORDER BY size*error_rate DESC) rn FROM clusters) t WHERE id=(SELECT id FROM clusters WHERE intent='date_format_error' ORDER BY size DESC LIMIT 1)")
[[ "$RANK_B" == "1" ]] && pass "spiking pattern ranks #1 by failure impact" || fail "B rank=$RANK_B"

# 5. clusters link to exact source conversations (marker purity ≥70%)
check_purity () {
  local intent="$1" marker_sql="$2"
  local cid members
  # representative cluster = highest failure impact within the intent
  cid=$($PSQL "SELECT id FROM clusters WHERE intent='$intent' ORDER BY size*error_rate DESC LIMIT 1")
  members=$($PSQL "SELECT coalesce(string_agg(chr(39) || conversation_id || chr(39), ','), '') FROM (
    SELECT conversation_id FROM cluster_members WHERE cluster_id='$cid' LIMIT 200) t")
  [[ -z "$members" ]] && { echo "0"; return; }
  docker compose exec -T clickhouse clickhouse-client --user "$CH_USER" --password "$CH_PASS" \
    --query "SELECT round(avg(marked),2) FROM (
      SELECT conversation_id, countIf($marker_sql)>0 AS marked
      FROM events.events WHERE conversation_id IN ($members)
      GROUP BY conversation_id)"
}
PURITY_A=$(check_purity tool_timeout "position(error_message,'gateway timeout')>0")
PURITY_B=$(check_purity date_format_error "positionCaseInsensitive(attributes,'wrong date format')>0 OR position(attributes,'2026-13-')>0 OR positionCaseInsensitive(attributes,'known display issue')>0")
PURITY_C=$(check_purity billing_dispute "positionCaseInsensitive(attributes,'refund policy')>0")

awk -v p="$PURITY_A" 'BEGIN{exit !(p>=0.7)}' && pass "pattern A linked to sources (purity $PURITY_A)" || fail "A purity $PURITY_A"
awk -v p="$PURITY_B" 'BEGIN{exit !(p>=0.7)}' && pass "pattern B linked to sources (purity $PURITY_B)" || fail "B purity $PURITY_B"
awk -v p="$PURITY_C" 'BEGIN{exit !(p>=0.7)}' && pass "pattern C linked to sources (purity $PURITY_C)" || fail "C purity $PURITY_C"

# 6. exactly one drift alert, for the spiking pattern
ALERTS=$($PSQL "SELECT coalesce(string_agg(c.intent || ':' || a.severity, ' '), 'none')
  FROM alerts a LEFT JOIN clusters c ON c.id=a.cluster_id WHERE a.type='failure_rate_spike'")
[[ "$ALERTS" == "date_format_error:critical" ]] && pass "single drift alert fired on spiking pattern only ($ALERTS)" || fail "alerts: $ALERTS"

# 7. unit-level guarantees still hold
(cd apps/analysis && PYTHONPATH=src .venv/bin/python -m pytest tests/ -q >/dev/null) \
  && pass "python unit tests (21)" || fail "pytest failed"

# 8. dashboard renders patterns view (auth-gated since Phase 7A)
pnpm --filter @diagnost/dashboard build >/dev/null
fuser -k -n tcp 3100 >/dev/null 2>&1 || true; sleep 0.5
(pnpm --filter @diagnost/dashboard start > /tmp/diagnost-logs/dash.log 2>&1 &)
for i in $(seq 1 20); do curl -sf http://localhost:3100/login >/dev/null 2>&1 && break; sleep 0.5; done
curl -s -c /tmp/diagnost-cookie.jar -X POST http://localhost:3100/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"owner@dev.local","password":"devpassword123"}' >/dev/null
CODE=$(curl -s -b /tmp/diagnost-cookie.jar -o /dev/null -w "%{http_code}" http://localhost:3100/clusters)
BODY=$(curl -s -b /tmp/diagnost-cookie.jar http://localhost:3100/clusters)
[[ "$CODE" == "200" ]] && echo "$BODY" | grep -q "date format" \
  && pass "dashboard /clusters renders patterns + alert banner" || fail "dashboard clusters page broken ($CODE)"
fuser -k -n tcp 3100 >/dev/null 2>&1 || true

echo ""
echo "All Phase 2 acceptance checks passed."
