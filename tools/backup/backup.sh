#!/usr/bin/env bash
# Diagnost AI — backup script (Postgres + ClickHouse)
# Usage: bash tools/backup/backup.sh [outdir]
# Requires: docker compose up, pg_dump and clickhouse-client available inside containers
set -euo pipefail
OUTDIR="${1:-./backups/$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUTDIR"

echo "[backup] Postgres → $OUTDIR/postgres.sql.gz"
docker compose exec -T postgres pg_dump -U diagnost diagnost | gzip > "$OUTDIR/postgres.sql.gz"
echo "[backup] ClickHouse → $OUTDIR/clickhouse_events.csv.gz"
# Native format would be more efficient, but CSV is portable for $0 demos
docker compose exec -T clickhouse clickhouse-client --user diagnost --password diagnost_dev_password \
  --query "SELECT * FROM events.events FORMAT CSVWithNames" | gzip > "$OUTDIR/clickhouse_events.csv.gz" || {
    echo "[backup] ClickHouse empty or unavailable — skipping"
    rm -f "$OUTDIR/clickhouse_events.csv.gz"
  }

echo "[backup] MinIO transcripts — sync via mc mirror (if needed):"
echo "  mc mirror --overwrite local/transcripts \"$OUTDIR/transcripts\""

ls -lh "$OUTDIR"
echo "[backup] done — $OUTDIR"
echo "[backup] Restore Postgres: gunzip -c $OUTDIR/postgres.sql.gz | docker compose exec -T postgres psql -U diagnost diagnost"
