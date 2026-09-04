#!/usr/bin/env bash
# Phase 7F acceptance: notification channels CRUD + test delivery + real-SMTP config.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

pass() { printf "\033[32mPASS\033[0m %s\n" "$1"; }
fail() { printf "\033[31mFAIL\033[0m %s\n" "$1"; exit 1; }

DASH="http://localhost:3100"
PSQL="docker compose exec -T postgres psql -U diagnost -d diagnost -tAc"
JAR_O=/tmp/diagnost-jar-owner7f.txt
JAR_M=/tmp/diagnost-jar-member7f.txt
rm -f "$JAR_O" "$JAR_M"

echo "Phase 7F — notifications acceptance"

docker compose up -d --wait >/dev/null 2>&1 || true
pnpm --filter @diagnostic/dashboard build >/dev/null 2>&1 || pnpm --filter @diagnost/dashboard build >/dev/null
fuser -k -n tcp 3100 >/dev/null 2>&1 || true; sleep 0.5
mkdir -p /tmp/diagnost-logs
(pnpm --filter @diagnost/dashboard start > /tmp/diagnost-logs/dash.log 2>&1 &)
for i in $(seq 1 30); do curl -sf "$DASH/login" >/dev/null 2>&1 && break; sleep 0.5; done
trap 'fuser -k -n tcp 3100 >/dev/null 2>&1 || true' EXIT

curl -s -c "$JAR_O" -X POST "$DASH/api/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"owner@dev.local","password":"devpassword123"}' >/dev/null

# ── list (seeded dev channel present) ──────────────────────────────
LIST=$(curl -s -b "$JAR_O" "$DASH/api/channels")
echo "$LIST" | grep -q "oncall@dev.local" \
  && pass "channels list includes seeded dev email channel" || fail "list=$LIST"

# ── validation ─────────────────────────────────────────────────────
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR_O" -X POST "$DASH/api/channels" \
  -H 'content-type: application/json' -d '{"channel":"email","target":"not-an-email"}')
[[ "$CODE" == "400" ]] && pass "invalid email rejected (400)" || fail "expected 400, got $CODE"

# ── create → duplicate → toggle → test → delete ────────────────────
CREATED=$(curl -s -b "$JAR_O" -X POST "$DASH/api/channels" \
  -H 'content-type: application/json' -d '{"channel":"email","target":"qa7f@example.com"}')
CID=$(echo "$CREATED" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[[ -n "$CID" ]] && pass "channel created ($CID)" || fail "create=$CREATED"

CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR_O" -X POST "$DASH/api/channels" \
  -H 'content-type: application/json' -d '{"channel":"email","target":"qa7f@example.com"}')
[[ "$CODE" == "409" ]] && pass "duplicate channel rejected (409)" || fail "expected 409, got $CODE"

TOGGLED=$(curl -s -b "$JAR_O" -X PATCH "$DASH/api/channels/$CID" \
  -H 'content-type: application/json' -d '{"enabled":false}')
echo "$TOGGLED" | grep -q '"enabled":false' \
  && pass "channel disabled" || fail "toggle=$TOGGLED"
curl -s -b "$JAR_O" -X PATCH "$DASH/api/channels/$CID" \
  -H 'content-type: application/json' -d '{"enabled":true}' >/dev/null

BEFORE=$(curl -s http://localhost:8025/api/v2/messages | python3 -c "import json,sys; print(json.load(sys.stdin)['total'])")
TEST=$(curl -s -b "$JAR_O" -X POST "$DASH/api/channels/$CID/test")
echo "$TEST" | grep -q '"ok":true' \
  && pass "test delivery accepted" || fail "test=$TEST"
AFTER=$(curl -s http://localhost:8025/api/v2/messages | python3 -c "import json,sys; print(json.load(sys.stdin)['total'])")
[[ "${AFTER:-0}" -gt "${BEFORE:-0}" ]] \
  && pass "test email landed in MailHog ($BEFORE → $AFTER)" || fail "mailhog $BEFORE → $AFTER"

CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR_O" -X DELETE "$DASH/api/channels/$CID")
[[ "$CODE" == "200" ]] && pass "channel deleted" || fail "delete=$CODE"
curl -s -b "$JAR_O" "$DASH/api/channels" | grep -q "qa7f@example.com" \
  && fail "channel still listed" || pass "channel gone from list"

# ── RBAC: member blocked, logged-out blocked ───────────────────────
HASH=$(node -e "import('./packages/db/dist/auth.js').then(m=>m.hashPassword('member pass phrase 7f').then(h=>console.log(h)))")
$PSQL "INSERT INTO users (id, workspace_id, email, password_hash, role)
       VALUES ('user_member_7f', 'ws_dev', 'member7f@test.local', '$HASH', 'member')
       ON CONFLICT (id) DO UPDATE SET password_hash=excluded.password_hash" >/dev/null
curl -s -c "$JAR_M" -X POST "$DASH/api/auth/login" \
  -H 'content-type: application/json' -d '{"email":"member7f@test.local","password":"member pass phrase 7f"}' >/dev/null
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR_M" "$DASH/api/channels")
[[ "$CODE" == "403" ]] && pass "member blocked from channels (403)" || fail "member=$CODE"
$PSQL "DELETE FROM users WHERE id='user_member_7f'" >/dev/null
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DASH/api/channels")
[[ "$CODE" == "401" ]] && pass "unauthenticated blocked (401)" || fail "anon=$CODE"

# ── settings renders notifications section ─────────────────────────
BODY=$(curl -s -b "$JAR_O" "$DASH/settings")
echo "$BODY" | grep -q "Alert notifications" \
  && pass "settings shows Alert notifications section" || fail "settings missing section"

fuser -k -n tcp 3100 >/dev/null 2>&1 || true
echo ""
echo "All Phase 7F acceptance checks passed."
