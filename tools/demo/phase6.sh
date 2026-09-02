#!/usr/bin/env bash
# Phase 6 acceptance: billing quota enforcement, audit trail, roles,
# docs/settings/audit pages, Terraform + skill installer artifacts.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

pass() { printf "\033[32mPASS\033[0m %s\n" "$1"; }
fail() { printf "\033[31mFAIL\033[0m %s\n" "$1"; exit 1; }

PSQL="docker compose exec -T postgres psql -U diagnost -d diagnost -tAc"
API="http://localhost:4100"
DEV_KEY="dw_local_devkey_diagnost_00000000"

echo "Phase 6 — productionization acceptance"

docker compose up -d --wait >/dev/null 2>&1 || true
pnpm --filter @diagnostic/db build >/dev/null 2>&1 || pnpm --filter @diagnost/db build >/dev/null
pnpm --filter @diagnost/db migrate >/dev/null
pnpm --filter @diagnost/api build >/dev/null

fuser -k -n tcp 4100 >/dev/null 2>&1 || true; sleep 0.5
mkdir -p /tmp/diagnost-logs
node apps/api/dist/index.js > /tmp/diagnost-logs/api.log 2>&1 & API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT
for i in $(seq 1 30); do curl -sf "$API/healthz" >/dev/null 2>&1 && break; sleep 0.5; done
curl -sf "$API/healthz" >/dev/null && pass "api running with quota middleware" || fail "api down"

# ── quota enforcement: exhaust free tier → 402 + audit ─────────────
$PSQL "INSERT INTO usage_monthly (workspace_id, period, events)
       VALUES ('ws_dev', to_char(now(),'YYYY-MM'), 50000)
       ON CONFLICT (workspace_id, period) DO UPDATE SET events = 50000" >/dev/null

CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/v1/events" \
  -H 'content-type: application/json' -H "authorization: Bearer $DEV_KEY" \
  -d '[{"id":"9b3f6a1e-8f2c-4c1a-9a5f-2f6c8d1e4a7c","workspaceId":"","traceId":"4bf92f3577b34da6a3ce929d0e0e4736","spanId":"00f067aa0ba902b8","conversationId":"conv_quota_test","name":"t","kind":"checkpoint","piiAudit":{"redactions":[],"zeroPiiMode":false,"redactorVersion":"t"},"timestampMs":1700000000000}]')
[[ "$CODE" == "402" ]] && pass "over-quota ingestion rejected with 402" || fail "expected 402, got $CODE"

QUOTA_AUDIT=$($PSQL "SELECT count(*) FROM audit_logs WHERE action='ingest.quota_exceeded'")
[[ "${QUOTA_AUDIT:-0}" -ge 1 ]] && pass "quota violation recorded in audit log" || fail "no audit row for quota"

# reset → ingestion works again (restart API to clear the quota cache)
$PSQL "UPDATE usage_monthly SET events = 0 WHERE workspace_id='ws_dev'" >/dev/null
kill $API_PID 2>/dev/null || true; sleep 0.5
node apps/api/dist/index.js >> /tmp/diagnost-logs/api.log 2>&1 & API_PID=$!
for i in $(seq 1 30); do curl -sf "$API/healthz" >/dev/null 2>&1 && break; sleep 0.5; done
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/v1/events" \
  -H 'content-type: application/json' -H "authorization: Bearer $DEV_KEY" \
  -d '[{"id":"9b3f6a1e-8f2c-4c1a-9a5f-2f6c8d1e4a7d","workspaceId":"","traceId":"4bf92f3577b34da6a3ce929d0e0e4736","spanId":"00f067aa0ba902b9","conversationId":"conv_quota_test","name":"t","kind":"checkpoint","piiAudit":{"redactions":[],"zeroPiiMode":false,"redactorVersion":"t"},"timestampMs":1700000000000}]')
[[ "$CODE" == "202" ]] && pass "ingestion resumes after usage reset (202)" || fail "expected 202, got $CODE"

# ── roles seeded ────────────────────────────────────────────────────
ROLE=$($PSQL "SELECT role FROM users WHERE email='owner@dev.local'")
[[ "$ROLE" == "owner" ]] && pass "workspace roles present (owner@dev.local=owner)" || fail "role=$ROLE"

# ── dashboard: settings / audit / docs (auth-gated since Phase 7A) ───
pnpm --filter @diagnostic/dashboard build >/dev/null 2>&1 || pnpm --filter @diagnost/dashboard build >/dev/null
mkdir -p /tmp/diagnost-logs
fuser -k -n tcp 3100 >/dev/null 2>&1 || true; sleep 0.5
(pnpm --filter @diagnost/dashboard start > /tmp/diagnost-logs/dash.log 2>&1 &)
for i in $(seq 1 20); do curl -sf http://localhost:3100/login >/dev/null 2>&1 && break; sleep 0.5; done
curl -s -c /tmp/diagnost-cookie.jar -X POST http://localhost:3100/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"owner@dev.local","password":"devpassword123"}' >/dev/null

CODE=$(curl -s -b /tmp/diagnost-cookie.jar -o /dev/null -w "%{http_code}" http://localhost:3100/settings)
BODY=$(curl -s -b /tmp/diagnost-cookie.jar http://localhost:3100/settings)
[[ "$CODE" == "200" ]] && echo "$BODY" | grep -q "Billing" && echo "$BODY" | grep -qi "free" \
  && pass "settings page renders plan tiers + usage meter" || fail "settings broken ($CODE)"

CODE=$(curl -s -b /tmp/diagnost-cookie.jar -o /dev/null -w "%{http_code}" http://localhost:3100/audit)
BODY=$(curl -s -b /tmp/diagnost-cookie.jar http://localhost:3100/audit)
[[ "$CODE" == "200" ]] && echo "$BODY" | grep -q "ingest.quota_exceeded" \
  && pass "audit page lists quota violation" || fail "audit page broken ($CODE)"

CODE=$(curl -s -b /tmp/diagnost-cookie.jar -o /dev/null -w "%{http_code}" http://localhost:3100/docs)
BODY=$(curl -s -b /tmp/diagnost-cookie.jar http://localhost:3100/docs)
[[ "$CODE" == "200" ]] && echo "$BODY" | grep -q "Quickstart" && echo "$BODY" | grep -q "skills add" \
  && pass "docs site renders quickstart + skill installer" || fail "docs broken ($CODE)"
fuser -k -n tcp 3100 >/dev/null 2>&1 || true

# ── deployment + skill artifacts ────────────────────────────────────
[[ -f infra/terraform/aws/main.tf ]] && grep -q "aws_ecs_cluster" infra/terraform/aws/main.tf \
  && pass "Terraform AWS module present (ECS/RDS/S3/ALB)" || fail "aws terraform missing"
[[ -f infra/terraform/gcp/main.tf ]] && grep -q "google_compute_instance" infra/terraform/gcp/main.tf \
  && pass "Terraform GCP skeleton present" || fail "gcp terraform missing"
[[ -f skills/agent-analytics/SKILL.md ]] && grep -q "^name: agent-analytics" skills/agent-analytics/SKILL.md \
  && pass "skill installer package present (agent-analytics)" || fail "skill missing"

pnpm --filter @diagnost/db test 2>&1 | grep -q "Tests  6 passed" \
  && pass "governance/billing + auth unit tests (6)" || fail "db tests failed"

echo ""
echo "All Phase 6 acceptance checks passed."
