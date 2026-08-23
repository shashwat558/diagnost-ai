#!/usr/bin/env bash
# Phase 4 acceptance: the seeded wrong-date-format failure cluster produces a
# PR with a correct prompt fix and an eval report showing improvement with
# zero regressions.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

pass() { printf "\033[32mPASS\033[0m %s\n" "$1"; }
fail() { printf "\033[31mFAIL\033[0m %s\n" "$1"; exit 1; }

PSQL="docker compose exec -T postgres psql -U diagnost -d diagnost -tAc"
CH_USER="${CLICKHOUSE_USER:-diagnost}"
CH_PASS="${CLICKHOUSE_PASSWORD:-diagnost_dev_password}"

echo "Phase 4 — auto-remediation acceptance"

docker compose up -d --wait >/dev/null 2>&1 || true
pnpm --filter @diagnostic/db build >/dev/null 2>&1 || pnpm --filter @diagnost/db build >/dev/null
pnpm --filter @diagnost/db migrate >/dev/null

# ── ensure failure-cluster data exists (reuse Phase 2 pipeline if needed) ──
CID=$($PSQL "SELECT id FROM clusters WHERE intent='date_format_error' ORDER BY size DESC LIMIT 1")
if [[ -z "$CID" ]]; then
  echo "no date_format_error cluster found — seeding via Phase 2 pipeline..."
  fuser -k -n tcp 4100 >/dev/null 2>&1 || true; sleep 0.5
  node apps/api/dist/index.js > /tmp/diagnost-logs/api.log 2>&1 & API_PID=$!
  node apps/api/dist/consumer.js > /tmp/diagnost-logs/consumer.log 2>&1 & CONSUMER_PID=$!
  trap 'kill $API_PID $CONSUMER_PID 2>/dev/null || true' EXIT
  sleep 3
  SEED_OUT=$(node tools/seed/phase2-seed.mjs)
  TOTAL=$(echo "$SEED_OUT" | grep -oE 'accepted [0-9]+' | grep -oE '[0-9]+')
  for i in $(seq 1 90); do
    N=$(docker compose exec -T clickhouse clickhouse-client --user "$CH_USER" --password "$CH_PASS" \
      --query "SELECT count() FROM events.events WHERE conversation_id LIKE 'conv_seed%'" 2>/dev/null || echo 0)
    [[ "${N:-0}" == "$TOTAL" ]] && break; sleep 2
  done
  PY="apps/analysis/.venv/bin/python"; [[ -x "$PY" ]] || PY="python3"
  "$PY" apps/analysis/run_analysis.py >/dev/null
  kill $API_PID $CONSUMER_PID 2>/dev/null || true
  CID=$($PSQL "SELECT id FROM clusters WHERE intent='date_format_error' ORDER BY size DESC LIMIT 1")
fi
[[ -n "$CID" ]] && pass "failure cluster present ($CID)" || fail "no cluster to remediate"

# ── register artifact under remediation (idempotent) ───────────────
$PSQL "
INSERT INTO artifacts (id, workspace_id, kind, name, handles_intent, current_version)
VALUES ('art_booking_prompt','ws_dev','prompt','booking_assistant_prompt','date_format_error','v3')
ON CONFLICT DO NOTHING;

INSERT INTO artifact_versions (id, artifact_id, version, content)
VALUES ('av_booking_v3','art_booking_prompt','v3',
 E'# Booking Assistant Prompt (v3)\nYou are a booking assistant for travel reservations.\nWhen a customer asks to confirm, reschedule, or check a booking:\n- Look up the reservation first.\n- Reply with a short confirmation summary.\n\nRender all dates as YYYY-MM-DD.')
ON CONFLICT DO NOTHING;" >/dev/null
pass "artifact registered (booking_assistant_prompt@v3)"

# ── deterministic run: clear previous remediation state ────────────
$PSQL "DELETE FROM remediations; DELETE FROM artifact_versions WHERE version LIKE '%-fix-%';" >/dev/null
rm -rf /tmp/diagnost-fixture-repo /tmp/diagnost-pr-outbox

# ── run remediation pipeline ────────────────────────────────────────
pnpm --filter @diagnost/pr-bot build >/dev/null
OUT=$(node apps/pr-bot/dist/main.js --cluster "$CID")
echo "$OUT" | grep -q "gate=passed" && pass "eval gate passed (improvement, zero regressions)" || fail "gate did not pass"
echo "$OUT" | grep -q "PR opened" && pass "pull request opened" || fail "no PR opened"

REM=$($PSQL "SELECT id FROM remediations WHERE status='pr_opened' ORDER BY created_at DESC LIMIT 1")
[[ -n "$REM" ]] && pass "remediation recorded ($REM)" || fail "no pr_opened remediation row"

# eval report contents from the DB record
REPORT_JSON=$($PSQL "SELECT eval_report::text FROM remediations WHERE id='$REM'" | python3 -c "
import json, sys
obj = json.loads(sys.stdin.read().strip())
if isinstance(obj, str): obj = json.loads(obj)
print(json.dumps(obj))")

python3 - << EOF
import json
r = json.loads('''$REPORT_JSON''')
assert r["baseline"]["passRate"] < 1.0, f"baseline should fail some cases: {r['baseline']['passRate']}"
assert r["patched"]["passRate"] == 1.0, f"patched should be perfect: {r['patched']['passRate']}"
assert r["heldOut"]["regressions"] == [], "regressions must be empty"
assert r["heldOut"]["baselinePassRate"] == 1.0 and r["heldOut"]["patchedPassRate"] == 1.0
evidence = [c["caseId"] for c in r["patched"]["results"] if c["sourceConversationId"]]
assert evidence, "no evidence-derived cases linked to source conversations"
print("report ok:", len(r["patched"]["results"]), "target cases;", len(evidence), "evidence-linked")
EOF
pass "eval report: baseline<100% → patched=100%, zero regressions, evidence-linked cases"

# ── PR branch carries the correct prompt fix ────────────────────────
BRANCH=$($PSQL "SELECT pr_branch FROM remediations WHERE id='$REM'")
FILE=$(git -C /tmp/diagnost-fixture-repo show "${BRANCH}:artifacts/booking_assistant_prompt")
echo "$FILE" | grep -q "Date validation" && echo "$FILE" | grep -q "month must be 1-12" \
  && pass "branch contains validation directive fix" || fail "patch content missing on branch"
git -C /tmp/diagnost-fixture-repo show "main:artifacts/booking_assistant_prompt" | grep -q "Date validation" \
  && fail "main was contaminated" || pass "base branch untouched"

# ── PR body embeds report + source links ────────────────────────────
MD=$(ls /tmp/diagnost-pr-outbox/*.md | head -1)
grep -q "| Target (failing-cluster cases) | 0% | 100%" "$MD" && pass "PR body shows before/after deltas" || fail "report table missing"
grep -qE "conv_seed_[0-9]+" "$MD" && pass "PR body links source conversations" || fail "no source links"

(cd apps/analysis && PYTHONPATH=src .venv/bin/python -m pytest tests/ -q >/dev/null) \
  && pass "python unit tests (29)" || fail "pytest failed"
pnpm --filter @diagnost/pr-bot test 2>&1 | grep -q "Tests  9 passed" \
  && pass "pr-bot harness unit tests (9)" || fail "harness tests failed"

echo ""
echo "All Phase 4 acceptance checks passed."
