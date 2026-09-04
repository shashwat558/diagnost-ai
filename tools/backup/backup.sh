#!/usr/bin/env bash
# Diagnost AI — backup script (Postgres + ClickHouse)
# Usage: bash tools/backup/backup.sh [outdir]
# Env: COMPOSE_PROJECT_NAME (default: diagnost-ai dev), COMPOSE_FILE to target prod.
# Requires: stack up, pg_dump and clickhouse-client available inside containers.
# Restore with: bash tools/backup/restore.sh <outdir>
set -euo pipefail
OUTDIR="${1:-./backups/$(date +%Y%m%d-%H%M%S)}"
PROJECT="${COMPOSE_PROJECT_NAME:-diagnost-ai}"
COMPOSE_ARGS="${COMPOSE_FILE:+ -f $COMPOSE_FILE}"
mkdir -p "$OUTDIR"

# shellcheck disable=SC2086
DC="docker compose -p $PROJECT $COMPOSE_ARGS"

PG_USER="${POSTGRES_USER:-diagnost}"
PG_DB="${POSTGRES_DB:-diagnost}"
CH_USER="${CLICKHOUSE_USER:-diagnost}"
CH_PASS="${CLICKHOUSE_PASSWORD:-diagnost_dev_password}"
CH_DB="${CLICKHOUSE_DB:-events}"

echo "[backup] Postgres → $OUTDIR/postgres.sql.gz"
# shellcheck disable=SC2086
$DC exec -T postgres pg_dump -U "$PG_USER" "$PG_DB" | gzip > "$OUTDIR/postgres.sql.gz"

echo "[backup] ClickHouse → $OUTDIR/clickhouse_events.native.gz (Native format restores exactly)"
# shellcheck disable=SC2086
$DC exec -T clickhouse clickhouse-client --user "$CH_USER" --password "$CH_PASS" \
  --query "SELECT * FROM $CH_DB.events FORMAT Native" | gzip > "$OUTDIR/clickhouse_events.native.gz" || {
    echo "[backup] ClickHouse empty or unavailable — skipping"
    rm -f "$OUTDIR/clickhouse_events.native.gz"
  }

echo "[backup] MinIO transcripts — sync via mc mirror (if needed):"
echo "  mc mirror --overwrite local/transcripts \"$OUTDIR/transcripts\""

ls -lh "$OUTDIR"
echo "$PROJECT" > "$OUTDIR/project.txt"
echo "[backup] done — $OUTDIR (project: $PROJECT)"
echo "[backup] Restore: bash tools/backup/restore.sh $OUTDIR"
