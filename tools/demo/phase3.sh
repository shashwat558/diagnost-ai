#!/usr/bin/env bash
# Phase 3 acceptance: alert delivery (Slack/email via MailHog, rate-limited)
# and feature-request extraction producing a ranked list matching the seed.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

pass() { printf "\033[32mPASS\033[0m %s\n" "$1"; }
fail() { printf "\033[31mFAIL\033[0m %s\n" "$1"; exit 1; }

CH_USER="${CLICKHOUSE_USER:-diagnost}"
CH_PASS="${CLICKHOUSE_PASSWORD:-diagnost_dev_password}"
PSQL="docker compose exec -T postgres psql -U diagnost -d diagnost -tAc"
PY="apps/analysis/.venv/bin/python"

echo "Phase 3 — alerts & feedback loop acceptance"

docker compose up -d --wait >/dev/null 2>&1 || true
pnpm --filter @diagnostic/db build >/dev/null 2>&1 || pnpm --filter @diagnost/db build >/dev/null
pnpm --filter @diagnost/db migrate >/dev/null

# python env (venv preferred, system fallback)
if [[ ! -x "$PY" ]]; then
  if python3 -c "import hdbscan, sklearn, psycopg" >/dev/null 2>&1; then PY="python3";
  else (cd apps/analysis && python3 -m venv .venv && .venv/bin/pip install --quiet numpy hdbscan scikit-learn httpx "psycopg[binary]"); PY="apps/analysis/.venv/bin/python"; fi
fi

fuser -k -n tcp 4100 >/dev/null 2>&1 || true; sleep 0.5
mkdir -p /tmp/diagnost-logs
node apps/api/dist/index.js > /tmp/diagnost-logs/api.log 2>&1 & API_PID=$!
node apps/api/dist/consumer.js > /tmp/diagnost-logs/consumer.log 2>&1 & CONSUMER_PID=$!
node apps/api/dist/notifier.js > /tmp/diagnost-logs/notifier.log 2>&1 & NOTIFIER_PID=$!
trap 'kill $API_PID $CONSUMER_PID $NOTIFIER_PID 2>/dev/null || true' EXIT
for i in $(seq 1 30); do curl -sf http://localhost:4100/healthz >/dev/null 2>&1 && break; sleep 0.5; done
curl -sf http://localhost:4100/healthz >/dev/null && pass "api+consumer+notifier running" || fail "services did not start"

# ── Part 1: alert delivery ─────────────────────────────────────
# idempotency: clear leftovers from any previous run
$PSQL "DELETE FROM alert_deliveries d USING alerts a WHERE d.alert_id=a.id AND a.dedupe_key LIKE 'p3_%';
       DELETE FROM alerts WHERE dedupe_key LIKE 'p3_%';" >/dev/null
# throwaway cluster so the run can't collide with prior notification state
$PSQL "INSERT INTO clusters (id, workspace_id, label, intent)
       VALUES ('cl_p3_test','ws_dev','phase3 delivery probe','delivery_probe')
       ON CONFLICT DO NOTHING" >/dev/null
$PSQL "INSERT INTO alerts (id, workspace_id, cluster_id, type, severity, message, dedupe_key)
       VALUES ('al_p3_email','ws_dev','cl_p3_test','failure_rate_spike','critical',
               'Phase 3 delivery check: failure rate rising', 'p3_dedupe_1')
       ON CONFLICT DO NOTHING" >/dev/null

sleep 7   # notifier poll cycle
EMAILS=$(curl -s http://localhost:8025/api/v2/messages | python3 -c "import json,sys; print(json.load(sys.stdin)['total'])")
STATUS=$($PSQL "SELECT status FROM alert_deliveries WHERE alert_id='al_p3_email'")
[[ "$STATUS" == "sent" && "${EMAILS:-0}" -ge 1 ]] \
  && pass "alert delivered as email via SMTP ($EMAILS in MailHog)" \
  || fail "email delivery failed (status=$STATUS, emails=$EMAILS)"

# duplicate alert on same cluster is rate-limited
$PSQL "INSERT INTO alerts (id, workspace_id, cluster_id, type, severity, message, dedupe_key)
       VALUES ('al_p3_dup','ws_dev','cl_p3_test','failure_rate_spike','critical',
               'Phase 3 rate-limit check', 'p3_dedupe_2')
       ON CONFLICT DO NOTHING" >/dev/null
sleep 7
DUP_STATUS=$($PSQL "SELECT status FROM alert_deliveries WHERE alert_id='al_p3_dup'")
[[ "$DUP_STATUS" == "skipped" ]] && pass "duplicate cluster alert rate-limited (skipped)" || fail "dup status=$DUP_STATUS"

# ── Part 2: feature-request extraction matches seeded frequencies ──
# deterministic acceptance: reset extraction state entirely (demo env only)
$PSQL "TRUNCATE feature_scans; DELETE FROM feature_requests;" >/dev/null
docker compose exec -T clickhouse clickhouse-client --user "$CH_USER" --password "$CH_PASS" \
  --query "DELETE FROM events.events WHERE conversation_id LIKE 'conv_seed3%'" >/dev/null 2>&1 || true

SEED_OUT=$(node tools/seed/phase3-seed.mjs)
TOTAL=$(echo "$SEED_OUT" | grep -oE 'accepted [0-9]+' | grep -oE '[0-9]+')
for i in $(seq 1 60); do
  N=$(docker compose exec -T clickhouse clickhouse-client --user "$CH_USER" --password "$CH_PASS" \
    --query "SELECT count() FROM events.events WHERE conversation_id LIKE 'conv_seed3%'" 2>/dev/null || echo 0)
  [[ "${N:-0}" == "$TOTAL" ]] && break; sleep 2
done
[[ "${N:-0}" == "$TOTAL" ]] && pass "phase-3 transcripts ingested ($N events)" || fail "drain incomplete ($N/$TOTAL)"

"$PY" apps/analysis/run_features.py > /tmp/diagnost-logs/features.log 2>&1 || { cat /tmp/diagnost-logs/features.log; fail "feature scan failed"; }

RANKED=$($PSQL "SELECT slug || '=' || frequency FROM feature_requests WHERE workspace_id='ws_dev' ORDER BY frequency DESC")
echo "ranking: $(echo "$RANKED" | tr '\n' ' ')"

R1=$(echo "$RANKED" | sed -n 1p); R2=$(echo "$RANKED" | sed -n 2p); R3=$(echo "$RANKED" | sed -n 3p)
[[ "$R1" == "csv_export=25" ]] && pass "#1 csv_export ×25 matches seed" || fail "rank1=$R1"
[[ "$R2" == "slack_integration=15" ]] && pass "#2 slack_integration ×15 matches seed" || fail "rank2=$R2"
[[ "$R3" == "dark_mode=8" ]] && pass "#3 dark_mode ×8 matches seed" || fail "rank3=$R3"
echo "$RANKED" | grep -q "webhooks_api=5" && pass "webhooks_api ×5 present" || fail "webhooks missing"
ONEOFFS=$($PSQL "SELECT count(*) FROM feature_requests WHERE slug LIKE 'req_%' AND frequency>=1")
[[ "${ONEOFFS:-0}" -ge 4 ]] && pass "one-off requests captured with derived slugs ($ONEOFFS)" || fail "oneoffs=$ONEOFFS"

EXAMPLES=$($PSQL "SELECT cardinality(example_conversation_ids) FROM feature_requests WHERE slug='csv_export'")
[[ "${EXAMPLES:-0}" -ge 1 ]] && pass "examples linked to source conversations ($EXAMPLES stored)" || fail "no examples"

# ── Part 3: dashboard renders features view ────────────────────
pnpm --filter @diagnost/dashboard build >/dev/null
fuser -k -n tcp 3100 >/dev/null 2>&1 || true; sleep 0.5
(pnpm --filter @diagnost/dashboard start > /tmp/diagnost-logs/dash.log 2>&1 &)
for i in $(seq 1 20); do curl -sf http://localhost:3100/features >/dev/null 2>&1 && break; sleep 0.5; done
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/features)
BODY=$(curl -s http://localhost:3100/features)
[[ "$CODE" == "200" ]] && echo "$BODY" | grep -qi "csv export" \
  && pass "dashboard /features renders ranked requests" || fail "features page broken ($CODE)"
fuser -k -n tcp 3100 >/dev/null 2>&1 || true

(cd apps/analysis && PYTHONPATH=src .venv/bin/python -m pytest tests/ -q >/dev/null) \
  && pass "python unit tests (29)" || fail "pytest failed"

# cleanup throwaway test rows
$PSQL "DELETE FROM alert_deliveries d USING alerts a WHERE d.alert_id=a.id AND a.id IN ('al_p3_email','al_p3_dup');
       DELETE FROM alerts WHERE id IN ('al_p3_email','al_p3_dup');
       DELETE FROM clusters WHERE id='cl_p3_test';" >/dev/null

echo ""
echo "All Phase 3 acceptance checks passed."
