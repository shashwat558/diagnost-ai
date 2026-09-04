#!/usr/bin/env bash
# Phase 7E acceptance: concierge installer artifacts validate, dry-run is
# side-effect free, docs exist, and backup/restore roundtrips on the dev stack.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

pass() { printf "\033[32mPASS\033[0m %s\n" "$1"; }
fail() { printf "\033[31mFAIL\033[0m %s\n" "$1"; exit 1; }

export COMPOSE_PROJECT_NAME=diagnost-ai
unset COMPOSE_FILE || true
PSQL="docker compose exec -T postgres psql -U diagnost -d diagnost -tAc"
CH="docker compose exec -T clickhouse clickhouse-client --user diagnost --password diagnost_dev_password --query"

echo "Phase 7E — concierge installer acceptance"

# ── 1. prod compose validates + has required services ───────────────
# required-var guards (:?) are intentional fail-closed; validate with dummies
# scoped inline (NOT exported — leaked env would break the dev stack's minio).
# (env_file directive needs a file present, so stage a temp one and remove it.)
sed -e "s/CHANGE_ME_32_hex_chars/dummysecret1234567890/g" .env.prod.example > .env.prod
POSTGRES_PASSWORD=dummysecret1234567890 CLICKHOUSE_PASSWORD=dummysecret1234567890 S3_SECRET_KEY=dummysecret1234567890 \
  docker compose -f docker-compose.prod.yml config >/dev/null \
  && pass "docker-compose.prod.yml validates" || fail "prod compose invalid"
rm -f .env.prod
for svc in api consumer notifier dashboard retention-cron caddy postgres clickhouse redpanda minio; do
  grep -q "^  $svc:" docker-compose.prod.yml || fail "service $svc missing in prod compose"
done
pass "prod compose has all services (infra + apps + retention-cron + caddy)"
grep -q 'profiles: \["tls"\]' docker-compose.prod.yml \
  && pass "caddy on tls profile (skippable via --skip-tls)" || fail "caddy profile missing"
grep -q "unless-stopped" docker-compose.prod.yml \
  && pass "restart policies set" || fail "restart policy missing"

# ── 2. Caddyfile + env template ─────────────────────────────────────
grep -q 'reverse_proxy dashboard' infra/caddy/Caddyfile && grep -q '{$DOMAIN' infra/caddy/Caddyfile \
  && grep -q 'reverse_proxy api' infra/caddy/Caddyfile \
  && pass "Caddyfile routes dashboard + api with {\$DOMAIN}" || fail "Caddyfile broken"
for k in DOMAIN POSTGRES_PASSWORD DATABASE_URL CLICKHOUSE_PASSWORD KAFKA_BROKERS S3_ENDPOINT SMTP_URL DODO_PAYMENTS_API_KEY NEXT_PUBLIC_APP_URL; do
  grep -q "^$k=" .env.prod.example || fail ".env.prod.example missing $k"
done
pass ".env.prod.example has all required keys (in-network URLs, SMTP, Dodo)"

# ── 3. install.sh help + dry-run (side-effect free) ─────────────────
bash tools/install.sh --help >/dev/null \
  && pass "install.sh --help" || fail "install.sh --help failed"
[[ -f .env.prod ]] && fail ".env.prod already exists — refusing (would mask dry-run check)"
DRY_OUT=$(bash tools/install.sh --dry-run --domain demo.local --email owner@demo.local)
echo "$DRY_OUT" | grep -q "provision workspace" \
  && pass "install.sh --dry-run prints provisioning step" || fail "dry-run output incomplete"
[[ ! -f .env.prod ]] \
  && pass "dry-run creates no .env.prod" || fail "dry-run wrote .env.prod"
bash tools/backup/restore.sh --help >/dev/null \
  && pass "restore.sh --help" || fail "restore.sh --help failed"

# ── 4. docs ─────────────────────────────────────────────────────────
[[ -f docs/self-host.md ]] && grep -q "tools/install.sh --domain" docs/self-host.md \
  && grep -q "restore.sh" docs/self-host.md \
  && pass "docs/self-host.md covers install + restore" || fail "self-host docs missing"

# ── 5. backup/restore roundtrip on dev stack ────────────────────────
docker compose up -d --wait >/dev/null 2>&1 || true
# wait for ClickHouse native port (HTTP ping goes green before :9000 accepts)
for i in $(seq 1 30); do
  $CH "SELECT 1" >/dev/null 2>&1 && break
  sleep 2
done
$CH "SELECT 1" >/dev/null || fail "clickhouse native port not ready"
USERS_BEFORE=$($PSQL "SELECT count(*) FROM users")
CH_BEFORE=$($CH "SELECT count() FROM events.events")
bash tools/backup/backup.sh /tmp/diagnost-rt-backup >/dev/null
[[ -f /tmp/diagnost-rt-backup/postgres.sql.gz && -f /tmp/diagnost-rt-backup/clickhouse_events.native.gz ]] \
  && pass "backup produces postgres.sql.gz + clickhouse native" || fail "backup files missing"
bash tools/backup/restore.sh /tmp/diagnost-rt-backup >/dev/null
USERS_AFTER=$($PSQL "SELECT count(*) FROM users")
CH_AFTER=$($CH "SELECT count() FROM events.events")
[[ "${USERS_BEFORE:-x}" == "${USERS_AFTER:-y}" ]] \
  && pass "postgres roundtrip preserves rows (users $USERS_BEFORE → $USERS_AFTER)" \
  || fail "postgres mismatch ($USERS_BEFORE → $USERS_AFTER)"
[[ "${CH_BEFORE:-x}" == "${CH_AFTER:-y}" ]] \
  && pass "clickhouse roundtrip preserves rows (events $CH_BEFORE → $CH_AFTER)" \
  || fail "clickhouse mismatch ($CH_BEFORE → $CH_AFTER)"
rm -rf /tmp/diagnost-rt-backup

echo ""
echo "All Phase 7E acceptance checks passed."
