#!/usr/bin/env bash
# Phase 7A acceptance: hosted auth — signup, login, sessions, RBAC,
# workspace provisioning end-to-end (new API key ingests events).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

pass() { printf "\033[32mPASS\033[0m %s\n" "$1"; }
fail() { printf "\033[31mFAIL\033[0m %s\n" "$1"; exit 1; }

DASH="http://localhost:3100"
API="http://localhost:4100"
PSQL="docker compose exec -T postgres psql -U diagnost -d diagnost -tAc"
JAR_O=/tmp/diagnost-jar-owner.txt
JAR_M=/tmp/diagnost-jar-member.txt
rm -f "$JAR_O" "$JAR_M"

echo "Phase 7A — hosted auth acceptance"

docker compose up -d --wait >/dev/null 2>&1 || true
pnpm --filter @diagnost/db build >/dev/null 2>&1 || fail "db build failed"
pnpm --filter @diagnost/db migrate >/dev/null

SESSIONS_TABLE=$($PSQL "SELECT count(*) FROM information_schema.tables WHERE table_name='sessions'")
[[ "${SESSIONS_TABLE:-0}" -ge 1 ]] && pass "sessions table migrated (0008_auth)" || fail "sessions missing"

pnpm --filter @diagnost/dashboard build >/tmp/diagnost-logs/dash-build.log 2>&1 || { tail -15 /tmp/diagnost-logs/dash-build.log; fail "dashboard build failed"; }
fuser -k -n tcp 3100 >/dev/null 2>&1 || true; sleep 0.5
mkdir -p /tmp/diagnost-logs
(pnpm --filter @diagnost/dashboard start > /tmp/diagnost-logs/dash.log 2>&1 &)
for i in $(seq 1 30); do curl -sf "$DASH/api/auth/me" >/dev/null 2>&1 && break; sleep 0.5; done

# ── reset test tenants so re-runs are idempotent ────────────────────
$PSQL "DELETE FROM workspaces WHERE id IN (SELECT workspace_id FROM users WHERE email LIKE '%@acme.test')" >/dev/null
$PSQL "DELETE FROM users WHERE email='member@acme.test'" >/dev/null

# ── signup → workspace + api key + session ──────────────────────────
EMAIL="founder@acme.test"
SIGNUP=$(curl -s -c "$JAR_O" -X POST "$DASH/api/auth/signup" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"correct horse battery\",\"workspaceName\":\"Acme Agents\"}")
NEW_KEY=$(echo "$SIGNUP" | grep -o 'dw_[a-f0-9]\{8\}_[a-f0-9]*' || true)
WS_ID=$(echo "$SIGNUP" | grep -o '"workspaceId":"[^"]*"' | cut -d'"' -f4 || true)
[[ -n "$NEW_KEY" && -n "$WS_ID" ]] && pass "signup provisions workspace + API key ($WS_ID)" \
  || fail "signup response incomplete: $SIGNUP"

ME=$(curl -s -b "$JAR_O" "$DASH/api/auth/me")
echo "$ME" | grep -q '"role":"owner"' && echo "$ME" | grep -q '"plan":"free"' \
  && pass "session cookie resolves owner + free plan via /me" || fail "me=$ME"

AUDIT_WS=$($PSQL "SELECT count(*) FROM audit_logs WHERE action='workspace.created' AND workspace_id='$WS_ID'")
[[ "${AUDIT_WS:-0}" -ge 1 ]] && pass "workspace creation audited" || fail "no audit row for signup"

# duplicate email rejected
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$DASH/api/auth/signup" \
  -H 'content-type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"another password\"}")
[[ "$CODE" == "400" ]] && pass "duplicate email rejected (400)" || fail "expected 400, got $CODE"

# weak password rejected
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$DASH/api/auth/signup" \
  -H 'content-type: application/json' -d '{"email":"other@acme.test","password":"short"}')
[[ "$CODE" == "400" ]] && pass "weak password rejected (400)" || fail "expected 400, got $CODE"

# ── new workspace's key ingests real events ─────────────────────────
pnpm --filter @diagnost/api build >/dev/null
fuser -k -n tcp 4100 >/dev/null 2>&1 || true; sleep 0.5
node apps/api/dist/index.js > /tmp/diagnost-logs/api.log 2>&1 & API_PID=$!
trap 'kill $API_PID 2>/dev/null || true; fuser -k -n tcp 3100 >/dev/null 2>&1 || true' EXIT
for i in $(seq 1 30); do curl -sf "$API/healthz" >/dev/null 2>&1 && break; sleep 0.5; done
CODE=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "$API/v1/events" \
  -H 'content-type: application/json' -H "authorization: Bearer $NEW_KEY" \
  -d '[{"id":"7c1d2e3f-4a5b-6c7d-8e9f-0a1b2c3d4e5f","workspaceId":"","traceId":"4bf92f3577b34da6a3ce929d0e0e4736","spanId":"00f067aa0ba902b8","conversationId":"conv_acme_1","name":"t","kind":"checkpoint","piiAudit":{"redactions":[],"zeroPiiMode":false,"redactorVersion":"t"},"timestampMs":1700000000000}]') || CODE="000"
[[ "$CODE" == "202" ]] && pass "provisioned key ingests events (202)" || fail "expected 202, got $CODE"

# ── login flow ───────────────────────────────────────────────────────
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$DASH/api/auth/login" \
  -H 'content-type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"wrong password\"}")
[[ "$CODE" == "401" ]] && pass "wrong password rejected (401)" || fail "expected 401, got $CODE"

CODE=$(curl -s -o /dev/null -w "%{http_code}" -c "$JAR_O" -X POST "$DASH/api/auth/login" \
  -H 'content-type: application/json' -d "{\"email\":\"$EMAIL\",\"password\":\"correct horse battery\"}")
[[ "$CODE" == "200" ]] && pass "login succeeds with correct credentials" || fail "expected 200, got $CODE"

# ── dashboard gating ────────────────────────────────────────────────
LOC=$(curl -s -o /dev/null -w "%{redirect_url}" "$DASH/dashboard")
[[ "$LOC" == *"/login"* ]] && pass "unauthenticated /dashboard redirects to /login" || fail "redirect=$LOC"
# landing page is public with hero background
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$DASH/")
BODY=$(curl -s "$DASH/")
[[ "$CODE" == "200" ]] && echo "$BODY" | grep -q "Production analytics" && echo "$BODY" | grep -q "hero.jpg" \
  && pass "landing page renders hero with background image" || fail "landing broken ($CODE)"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR_O" "$DASH/settings")
[[ "$CODE" == "200" ]] && pass "owner can open /settings" || fail "owner settings=$CODE"

# member RBAC: seed a member user in the owner's workspace
HASH=$(node -e "import('./packages/db/dist/auth.js').then(m=>m.hashPassword('member pass phrase').then(h=>console.log(h)))")
[[ -n "$HASH" ]] || fail "could not hash member password"
$PSQL "INSERT INTO users (id, workspace_id, email, password_hash, role)
       VALUES ('user_member_test', '$WS_ID', 'member@acme.test', '$HASH', 'member')
       ON CONFLICT (id) DO UPDATE SET password_hash=excluded.password_hash, workspace_id=excluded.workspace_id" >/dev/null
CODE=$(curl -s -o /dev/null -w "%{http_code}" -c "$JAR_M" -X POST "$DASH/api/auth/login" \
  -H 'content-type: application/json' -d '{"email":"member@acme.test","password":"member pass phrase"}')
[[ "$CODE" == "200" ]] && pass "member logs in" || fail "member login=$CODE"
LOC=$(curl -s -o /dev/null -w "%{redirect_url}" -b "$JAR_M" "$DASH/settings")
[[ "$LOC" != *"/settings"* ]] && NAV=$(curl -s -b "$JAR_M" "$DASH/dashboard") && ! echo "$NAV" | grep -q 'href="/settings"' \
  && pass "member blocked from settings (page + nav)" || fail "member can reach settings"

# logout invalidates server-side
curl -s -b "$JAR_M" -c "$JAR_M" -X POST "$DASH/api/auth/logout" >/dev/null
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR_M" "$DASH/api/auth/me")
[[ "$CODE" == "401" ]] && pass "logout destroys session (me→401)" || fail "expected 401, got $CODE"

fuser -k -n tcp 3100 >/dev/null 2>&1 || true
pnpm --filter @diagnost/db test 2>&1 | grep -q "Tests  6 passed" \
  && pass "auth unit tests (scrypt hashing)" || fail "db tests failed"

echo ""
echo "All Phase 7A acceptance checks passed."
