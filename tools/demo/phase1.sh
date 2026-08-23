#!/usr/bin/env bash
# Phase 1 acceptance: sample agent → API → queue → ClickHouse+S3, PII redacted.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

pass() { printf "\033[32mPASS\033[0m %s\n" "$1"; }
fail() { printf "\033[31mFAIL\033[0m %s\n" "$1"; exit 1; }

API_PORT="${API_PORT:-4100}"
API_URL="http://localhost:${API_PORT}"
CH_USER="${CLICKHOUSE_USER:-diagnost}"
CH_PASS="${CLICKHOUSE_PASSWORD:-diagnost_dev_password}"
DEV_KEY="dw_local_devkey_diagnost_00000000"

echo "Phase 1 — ingestion acceptance"

# 0. infra + schema + dev workspace
docker compose up -d --wait >/dev/null 2>&1 || true
pnpm --filter @diagnost/db migrate >/dev/null
pnpm --filter @diagnost/db seed >/dev/null

# 1. start api + consumer in background (clear any stale processes first)
pnpm --filter @diagnost/api build >/dev/null
fuser -k -n tcp "${API_PORT}" >/dev/null 2>&1 || true
sleep 0.5
mkdir -p /tmp/diagnost-logs
node apps/api/dist/index.js > /tmp/diagnost-logs/api.log 2>&1 &
API_PID=$!
node apps/api/dist/consumer.js > /tmp/diagnost-logs/consumer.log 2>&1 &
CONSUMER_PID=$!
trap 'kill $API_PID $CONSUMER_PID 2>/dev/null || true' EXIT

for i in $(seq 1 30); do
  curl -sf "$API_URL/healthz" >/dev/null 2>&1 && break
  sleep 0.5
done
curl -sf "$API_URL/healthz" >/dev/null && pass "api healthy" || fail "api did not start (see /tmp/diagnost-logs/api.log)"

# consumer readiness: wait for kafka group assignment
sleep 3

# 2. auth is enforced: no key → 401
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/v1/events" \
  -H 'content-type: application/json' -d '{"x":1}')
[[ "$CODE" == "401" ]] && pass "ingestion rejects unauthenticated requests" || fail "expected 401 without api key, got $CODE"

# bad key → 401
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API_URL/v1/events" \
  -H 'content-type: application/json' -H "authorization: Bearer dw_wrong_wrong" -d '{"x":1}')
[[ "$CODE" == "401" ]] && pass "ingestion rejects invalid keys" || fail "expected 401 with bad key, got $CODE"

# 3. run the instrumented sample agent
CONVERSATION_ID="conv_demo_$RANDOM$RANDOM"
export CONVERSATION_ID
node tools/demo/src/sample-agent.mjs >/dev/null
pass "sample agent executed"

# 4. events visible in ClickHouse within seconds
FOUND=""
for i in $(seq 1 20); do
  N=$(docker compose exec -T clickhouse clickhouse-client --user "$CH_USER" --password "$CH_PASS" \
    --query "SELECT count() FROM events.events WHERE conversation_id='$CONVERSATION_ID'" 2>/dev/null || echo 0)
  if [[ "${N:-0}" -ge 5 ]]; then FOUND="$N"; break; fi
  sleep 0.5
done
[[ -n "$FOUND" ]] && pass "traces landed in ClickHouse within seconds ($FOUND events)" || fail "events not found in ClickHouse"

# 5. PII visibly redacted in stored payload
RAW_HITS=$(docker compose exec -T clickhouse clickhouse-client --user "$CH_USER" --password "$CH_PASS" \
  --query "SELECT countIf(positionCaseInsensitive(attributes, 'jane.smith@example.com') > 0 OR position(attributes,'4111 1111 1111 1111') > 0 OR position(attributes,'123-45-6789') > 0) FROM events.events WHERE conversation_id='$CONVERSATION_ID'" 2>/dev/null)
[[ "$RAW_HITS" == "0" ]] && pass "no raw PII stored in event store" || fail "raw PII leaked into ClickHouse ($RAW_HITS rows)"

REDACT_MARKS=$(docker compose exec -T clickhouse clickhouse-client --user "$CH_USER" --password "$CH_PASS" \
  --query "SELECT sum(length(pii_redactions)) FROM events.events WHERE conversation_id='$CONVERSATION_ID'" 2>/dev/null)
[[ "${REDACT_MARKS:-0}" -ge 4 ]] && pass "redaction audit log shipped alongside events ($REDACT_MARKS findings)" || fail "audit log missing"

HASHED=$(docker compose exec -T clickhouse clickhouse-client --user "$CH_USER" --password "$CH_PASS" \
  --query "SELECT countIf(positionCaseInsensitive(attributes,'[EMAIL:')>0 AND position(attributes,'[CARD:')>0) FROM events.events WHERE conversation_id='$CONVERSATION_ID'")
[[ "$HASHED" == "1" ]] && pass "email+card present as hashes in stored payload" || fail "hashed markers missing"

# error spans captured
ERRS=$(docker compose exec -T clickhouse clickhouse-client --user "$CH_USER" --password "$CH_PASS" \
  --query "SELECT count() FROM events.events WHERE conversation_id='$CONVERSATION_ID' AND status='error'")
[[ "$ERRS" == "1" ]] && pass "error span captured with message" || fail "expected exactly 1 errored span, got $ERRS"

# 6. full transcript landed in object storage
S3_OBJECTS=$(docker compose exec -T minio sh -c 'mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc find local/transcripts --name "*.json" | wc -l')
[[ "${S3_OBJECTS:-0}" -ge 1 ]] && pass "full transcripts stored in object storage ($S3_OBJECTS objects)" || fail "no transcripts in MinIO"
# and the S3 copy is redacted too (privacy-first: raw PII never reaches the server)
S3_KEY=$(docker compose exec -T minio sh -c 'mc find local/transcripts --name "*'"$CONVERSATION_ID"'*" | head -1' 2>/dev/null)
LEAK=$(docker compose exec -T minio sh -c 'mc cat "'"$S3_KEY"'"' 2>/dev/null | grep -c "jane.smith@example.com" || true)
[[ "$LEAK" == "0" ]] && pass "object-storage transcript contains only redacted content" || fail "raw PII found in S3 transcript"

echo ""
echo "All Phase 1 acceptance checks passed."
