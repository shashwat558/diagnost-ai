#!/usr/bin/env bash
# Phase 0 acceptance: infra stack is up and every service is healthy.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

pass() { printf "\033[32mPASS\033[0m %s\n" "$1"; }
fail() { printf "\033[31mFAIL\033[0m %s\n" "$1"; exit 1; }

echo "Phase 0 — infrastructure acceptance"

# Postgres
docker compose exec -T postgres pg_isready -U diagnost -d diagnost >/dev/null \
  && pass "postgres ready" || fail "postgres not ready"

# ClickHouse HTTP ping
CH=$(docker compose exec -T clickhouse wget -qO- http://127.0.0.1:8123/ping 2>/dev/null || true)
[[ "$CH" == *"Ok."* ]] && pass "clickhouse healthy (http)" || fail "clickhouse unhealthy"

# ClickHouse events DB exists
DB=$(docker compose exec -T clickhouse clickhouse-client --user diagnost --password diagnost_dev_password --query "SELECT name FROM system.databases WHERE name='events'" 2>/dev/null || true)
[[ "$DB" == "events" ]] && pass "clickhouse 'events' database exists" || fail "events database missing"

# Redpanda cluster health
HP=$(docker compose exec -T redpanda rpk cluster health 2>/dev/null | grep -Ec "Healthy:[[:space:]]+true" || true)
[[ "$HP" -ge 1 ]] && pass "redpanda cluster healthy" || fail "redpanda unhealthy"

# MinIO live + buckets created by init job
MC=$(docker compose exec -T minio sh -c 'mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null && mc ls local/transcripts' >/dev/null 2>&1 && echo yes || echo no)
[[ "$MC" == "yes" ]] && pass "minio healthy, transcripts bucket present" || fail "minio/buckets not ready"

echo ""
echo "All Phase 0 acceptance checks passed."
