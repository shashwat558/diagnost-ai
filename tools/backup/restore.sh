#!/usr/bin/env bash
# Diagnost AI — restore script (inverse of backup.sh).
# Usage: bash tools/backup/restore.sh <backupdir>
# Env: COMPOSE_PROJECT_NAME (default: diagnost-ai dev), COMPOSE_FILE to target prod.
# WARNING: drops and recreates the Postgres database. ClickHouse events table
# is truncated and reloaded from the Native backup (idempotent re-run safe).
set -euo pipefail

usage() {
  echo "Usage: bash tools/backup/restore.sh <backupdir>"
  echo "Env: COMPOSE_PROJECT_NAME (default diagnost-ai), COMPOSE_FILE (e.g. docker-compose.prod.yml)"
}

[[ "${1:-}" == "--help" || "${1:-}" == "-h" ]] && { usage; exit 0; }
[[ $# -lt 1 ]] && { usage; exit 1; }
BACKUP_DIR="$1"
[[ -d "$BACKUP_DIR" ]] || { echo "ERROR: not a directory: $BACKUP_DIR"; exit 1; }
[[ -f "$BACKUP_DIR/postgres.sql.gz" ]] || { echo "ERROR: $BACKUP_DIR/postgres.sql.gz missing"; exit 1; }

PROJECT="${COMPOSE_PROJECT_NAME:-diagnost-ai}"
COMPOSE_ARGS="${COMPOSE_FILE:+ -f $COMPOSE_FILE}"
# shellcheck disable=SC2086
DC="docker compose -p $PROJECT $COMPOSE_ARGS"

PG_USER="${POSTGRES_USER:-diagnost}"
PG_DB="${POSTGRES_DB:-diagnost}"
CH_USER="${CLICKHOUSE_USER:-diagnost}"
CH_PASS="${CLICKHOUSE_PASSWORD:-diagnost_dev_password}"
CH_DB="${CLICKHOUSE_DB:-events}"

if [[ -f "$BACKUP_DIR/project.txt" ]]; then
  echo "[restore] backup taken from project: $(cat "$BACKUP_DIR/project.txt") → restoring into: $PROJECT"
fi

echo "[restore] Postgres: drop + recreate $PG_DB, load $BACKUP_DIR/postgres.sql.gz"
# shellcheck disable=SC2086
$DC exec -T postgres psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$PG_DB\"" >/dev/null
# shellcheck disable=SC2086
$DC exec -T postgres psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$PG_DB\"" >/dev/null
gunzip -c "$BACKUP_DIR/postgres.sql.gz" | {
  # shellcheck disable=SC2086
  $DC exec -T postgres psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 -q
}
echo "[restore] Postgres done"

if [[ -f "$BACKUP_DIR/clickhouse_events.native.gz" ]]; then
  echo "[restore] ClickHouse: truncate $CH_DB.events, reload Native backup"
  # shellcheck disable=SC2086
  $DC exec -T clickhouse clickhouse-client --user "$CH_USER" --password "$CH_PASS" \
    --query "TRUNCATE TABLE $CH_DB.events"
  gunzip -c "$BACKUP_DIR/clickhouse_events.native.gz" | {
    # shellcheck disable=SC2086
    $DC exec -T clickhouse clickhouse-client --user "$CH_USER" --password "$CH_PASS" \
      --query "INSERT INTO $CH_DB.events FORMAT Native"
  }
  echo "[restore] ClickHouse done"
else
  echo "[restore] no clickhouse backup file — skipping (events re-ingest naturally)"
fi

echo "[restore] MinIO transcripts: sync back if mirrored:"
echo "  mc mirror --overwrite \"$BACKUP_DIR/transcripts\" local/transcripts"
echo "[restore] done — run migrations after restore if schema changed:"
echo "  pnpm --filter @diagnost/db migrate"
