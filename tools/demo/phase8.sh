#!/usr/bin/env bash
# Phase 8 acceptance: P0 UX overhaul — plain language, tooltips, readable IDs,
# friendly errors. Asserts new strings present and old jargon gone from HTML.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

pass() { printf "\033[32mPASS\033[0m %s\n" "$1"; }
fail() { printf "\033[31mFAIL\033[0m %s\n" "$1"; exit 1; }

DASH="http://localhost:3100"
JAR=/tmp/diagnost-jar-ux.txt
rm -f "$JAR"
CH="docker compose exec -T clickhouse clickhouse-client --user diagnost --password diagnost_dev_password --query"

echo "Phase 8 — UX plain-language acceptance"

docker compose up -d --wait >/dev/null 2>&1 || true
# fail fast if infra isn't actually up (a killed postgres makes every authed page redirect)
for svc in postgres clickhouse; do
  docker compose ps --format "{{.Service}} {{.Status}}" | grep -q "^$svc .*healthy\|^$svc .*Up" \
    || fail "$svc is not running — run 'docker compose up -d --wait' and retry"
done
$CH "SELECT 1" >/dev/null 2>&1 || fail "clickhouse not reachable"
docker compose exec -T postgres pg_isready -U diagnost >/dev/null 2>&1 || fail "postgres not reachable"
pnpm --filter @diagnost/dashboard build >/tmp/diagnost-logs/dash-build.log 2>&1 || { tail -15 /tmp/diagnost-logs/dash-build.log; fail "dashboard build failed"; }
fuser -k -n tcp 3100 >/dev/null 2>&1 || true; sleep 0.5
mkdir -p /tmp/diagnost-logs
(pnpm --filter @diagnost/dashboard start > /tmp/diagnost-logs/dash.log 2>&1 &)
for i in $(seq 1 30); do curl -sf "$DASH/login" >/dev/null 2>&1 && break; sleep 0.5; done
trap 'fuser -k -n tcp 3100 >/dev/null 2>&1 || true' EXIT

curl -s -c "$JAR" -X POST "$DASH/api/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"owner@dev.local","password":"devpassword123"}' >/dev/null
G() { curl -s -b "$JAR" "$DASH$1"; }
has() { echo "$2" | grep -qF "$1"; }
missing() { ! echo "$2" | grep -qF "$1"; }

# ── dashboard ───────────────────────────────────────────────────────
HOME_HTML=$(G /dashboard)
has "Typical reply time (p50)" "$HOME_HTML" && has "Slowest 5% (p95)" "$HOME_HTML" \
  && pass "dashboard uses plain metric names" || fail "dashboard metric names"
has "Half of replies were faster" "$HOME_HTML" \
  && pass "dashboard explains p50 via tooltip" || fail "dashboard p50 tip missing"
missing ">p50 latency<" "$HOME_HTML" && missing "ok vs error" "$HOME_HTML" \
  && pass "dashboard drops bare p50 / ok-vs-error" || fail "dashboard jargon remains"
has "Avg time" "$HOME_HTML" && has "Live events" "$HOME_HTML" && has " failed" "$HOME_HTML" \
  && pass "dashboard tool table headers + legend" || fail "dashboard table/legend"

# ── intents ─────────────────────────────────────────────────────────
CL_HTML=$(G /clusters)
has "Share of conversations in this intent that failed" "$CL_HTML" \
  && pass "intents explain error rate" || fail "intents tip missing"
missing ">Suggested<" "$CL_HTML" \
  && pass "no stale Suggested badge" || fail "Suggested badge remains"

# ── conversations list ──────────────────────────────────────────────
TR_HTML=$(G /traces)
has "PII redacted" "$TR_HTML" && has ">Steps<" "$TR_HTML" \
  && pass "conversations use plain headers" || fail "conversations headers"
missing ">passing<" "$TR_HTML" \
  && pass "no stale 'passing' label" || fail "'passing' remains"

# ── conversation detail (real failed convo if data exists) ──────────
CID=$($CH "SELECT conversation_id FROM events.events WHERE status='error' LIMIT 1" 2>/dev/null || true)
if [[ -n "$CID" ]]; then
  DET_HTML=$(curl -s -b "$JAR" "$DASH/traces/$CID")
  has "What happened" "$DET_HTML" \
    && pass "detail shows What-happened box" || fail "What-happened box missing"
  missing "s3://" "$DET_HTML" && missing ">FAIL<" "$DET_HTML" && missing ">PASS<" "$DET_HTML" \
    && pass "detail drops s3:// and FAIL/PASS codes" || fail "detail jargon remains"
  has "How long this step took" "$DET_HTML" \
    && pass "detail explains the Time column" || fail "time tip missing"
else
  DET_HTML=$(curl -s -b "$JAR" "$DASH/traces/conv_does_not_exist")
  has "No steps found for this conversation" "$DET_HTML" \
    && pass "detail friendly empty state (no data)" || fail "detail empty state"
fi

# ── audit ───────────────────────────────────────────────────────────
AU_HTML=$(G /audit)
has "What happened" "$AU_HTML" && has "Technical details" "$AU_HTML" \
  && pass "audit uses sentences + collapsible tech details" || fail "audit copy"
missing ">Action<" "$AU_HTML" \
  && pass "audit drops raw Action header" || fail "audit header remains"

# ── settings ────────────────────────────────────────────────────────
SET_HTML=$(G /settings)
has "one per intent per hour" "$SET_HTML" \
  && pass "settings uses intent wording" || fail "settings wording"
missing "alert(" "$SET_HTML" \
  && pass "no native alert() on settings" || fail "alert() remains"

# ── models ──────────────────────────────────────────────────────────
MO_HTML=$(G /models)
has "Model comparison" "$MO_HTML" \
  && pass "models page renders" || fail "models broken"
if echo "$MO_HTML" | grep -q "fresh examples"; then
  pass "models explains test data in plain words"
elif echo "$MO_HTML" | grep -q "run_pipeline"; then
  pass "models empty state gives the run command"
else
  fail "models copy"
fi
missing "held-out" "$MO_HTML" \
  && pass "models drops held-out jargon" || fail "held-out remains"

fuser -k -n tcp 3100 >/dev/null 2>&1 || true
echo ""
echo "All Phase 8 acceptance checks passed."
