#!/usr/bin/env bash
# Diagnost AI — concierge installer for single-VPS deploys.
# Customer pays ~$40-80/mo (Ubuntu 22.04, 8 vCPU / 32 GB, ports 80+443 open).
# We run this over SSH; everything is idempotent and re-runnable.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/shashwat558/diagnost-ai/main/tools/install.sh -o install.sh
#   bash tools/install.sh --domain agents.example.com --email owner@example.com
#   bash tools/install.sh --skip-tls --email owner@example.com        # local / dry test
#   bash tools/install.sh --dry-run --domain x --email y              # print steps only
#   bash tools/install.sh --domain x --email y --restore ./backups/D  # restore then migrate
set -euo pipefail

DOMAIN=""
OWNER_EMAIL=""
SKIP_TLS=0
DRY_RUN=0
RESTORE_DIR=""
NO_CRON=0
YES=0
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_DIR/docker-compose.prod.yml"
ENV_FILE="$REPO_DIR/.env.prod"
PROJECT="diagnost-ai-prod"

usage() {
  sed -n '2,12p' "$0"
  echo ""
  echo "Flags:"
  echo "  --domain D      public domain (required unless --skip-tls)"
  echo "  --email E       workspace owner email (required)"
  echo "  --skip-tls      no Caddy HTTPS; serve :3100/:4100 directly (local test)"
  echo "  --restore DIR   restore Postgres+ClickHouse from backup dir before migrate"
  echo "  --no-cron       skip nightly backup cron installation"
  echo "  --dry-run       print steps without executing"
  echo "  --yes           assume yes for prompts"
  echo "  --help          this help"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2;;
    --email) OWNER_EMAIL="$2"; shift 2;;
    --skip-tls) SKIP_TLS=1; shift;;
    --restore) RESTORE_DIR="$2"; shift 2;;
    --no-cron) NO_CRON=1; shift;;
    --dry-run) DRY_RUN=1; shift;;
    --yes) YES=1; shift;;
    --help|-h) usage; exit 0;;
    *) echo "unknown flag: $1"; usage; exit 1;;
  esac
done

[[ -z "$OWNER_EMAIL" ]] && { echo "ERROR: --email is required"; usage; exit 1; }
[[ "$SKIP_TLS" == "0" && -z "$DOMAIN" ]] && { echo "ERROR: --domain is required (or use --skip-tls)"; usage; exit 1; }
[[ "$SKIP_TLS" == "1" && -z "$DOMAIN" ]] && DOMAIN="localhost"

run() {
  if [[ "$DRY_RUN" == "1" ]]; then echo "+ $*"; else eval "$*"; fi
}

need() {
  command -v "$1" >/dev/null 2>&1 || { echo "ERROR: missing prerequisite: $1"; return 1; }
}

echo "== Diagnost AI installer =="
echo "repo: $REPO_DIR  domain: $DOMAIN  owner: $OWNER_EMAIL  tls: $([[ $SKIP_TLS == 1 ]] && echo off || echo on)"
export COMPOSE_PROJECT_NAME="$PROJECT"
DC="docker compose -p $PROJECT -f $COMPOSE_FILE --env-file $ENV_FILE"

# ── 1. prerequisites ───────────────────────────────────────────────
echo "-- prerequisites"
for bin in docker openssl curl; do
  if [[ "$DRY_RUN" == "1" ]]; then echo "+ check $bin"; else need "$bin"; fi
done
if [[ "$DRY_RUN" == "1" ]]; then
  echo "+ check node>=20 pnpm"
else
  need node; need pnpm
  node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)" \
    || { echo "ERROR: node >= 20 required"; exit 1; }
fi

# ── 2. .env.prod (generate once, reuse after) ───────────────────────
echo "-- env file: $ENV_FILE"
if [[ -f "$ENV_FILE" ]]; then
  echo "   exists — reusing (delete to regenerate)"
else
  PG_PASS=$(openssl rand -hex 24)
  CH_PASS=$(openssl rand -hex 24)
  S3_PASS=$(openssl rand -hex 24)
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "+ generate $ENV_FILE from .env.prod.example with random secrets"
  else
    sed -e "s/^DOMAIN=.*/DOMAIN=$DOMAIN/" \
        -e "s|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=$( [[ $SKIP_TLS == 1 ]] && echo "http://localhost:3100" || echo "https://$DOMAIN" )|" \
        -e "s|^APP_URL=.*|APP_URL=$( [[ $SKIP_TLS == 1 ]] && echo "http://localhost:3100" || echo "https://$DOMAIN" )|" \
        -e "s|^DASHBOARD_URL=.*|DASHBOARD_URL=$( [[ $SKIP_TLS == 1 ]] && echo "http://localhost:3100" || echo "https://$DOMAIN" )|" \
        -e "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$PG_PASS/" \
        -e "s|postgres://diagnost:CHANGE_ME_32_hex_chars@postgres:5432/diagnost|postgres://diagnost:$PG_PASS@postgres:5432/diagnost|" \
        -e "s/^CLICKHOUSE_PASSWORD=.*/CLICKHOUSE_PASSWORD=$CH_PASS/" \
        -e "s/^S3_SECRET_KEY=.*/S3_SECRET_KEY=$S3_PASS/" \
        -e "s|^DODO_PAYMENTS_RETURN_URL=.*|DODO_PAYMENTS_RETURN_URL=$( [[ $SKIP_TLS == 1 ]] && echo "http://localhost:3100/settings?checkout=success" || echo "https://$DOMAIN/settings?checkout=success" )|" \
        "$REPO_DIR/.env.prod.example" > "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    echo "   generated (mode 600)"
  fi
fi

# shellcheck disable=SC1090
if [[ "$DRY_RUN" == "0" ]]; then set -a; source "$ENV_FILE"; set +a; fi
HOST_DB_URL="postgres://${POSTGRES_USER:-diagnost}:${POSTGRES_PASSWORD:-x}@localhost:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-diagnost}"

# ── 3. build ───────────────────────────────────────────────────────
echo "-- build (pnpm install + build)"
run "cd \"$REPO_DIR\" && pnpm install --frozen-lockfile"
run "cd \"$REPO_DIR\" && pnpm build"

# ── 4. start stack ─────────────────────────────────────────────────
echo "-- start stack ($PROJECT)"
if [[ "$SKIP_TLS" == "1" ]]; then
  run "$DC up -d --wait"
else
  run "$DC --profile tls up -d --wait"
fi

# ── 5. optional restore (before migrate; migrations are idempotent) ─
if [[ -n "$RESTORE_DIR" ]]; then
  echo "-- restore from $RESTORE_DIR"
  run "COMPOSE_PROJECT_NAME=$PROJECT bash \"$REPO_DIR/tools/backup/restore.sh\" \"$RESTORE_DIR\""
fi

# ── 6. migrate ─────────────────────────────────────────────────────
echo "-- migrate"
run "cd \"$REPO_DIR\" && DATABASE_URL=\"$HOST_DB_URL\" pnpm --filter @diagnost/db migrate"

# ── 7. owner provisioning (skip if email exists) ───────────────────
echo "-- owner: $OWNER_EMAIL"
TEMP_PASS=$(openssl rand -hex 12)
if [[ "$DRY_RUN" == "1" ]]; then
  echo "+ provision workspace+owner+api-key via packages/db/dist (skip if email exists)"
else
  EXISTS=$(docker compose -p "$PROJECT" -f "$COMPOSE_FILE" exec -T postgres \
    psql -U "${POSTGRES_USER:-diagnost}" -d "${POSTGRES_DB:-diagnost}" -tAc \
    "SELECT count(*) FROM users WHERE email='$OWNER_EMAIL'")
  if [[ "${EXISTS:-0}" -ge 1 ]]; then
    echo "   owner exists — skipping (use dashboard login)"
  else
    HASH=$(node -e "import('./packages/db/dist/auth.js').then(m=>m.hashPassword('$TEMP_PASS').then(h=>console.log(h)))")
    KEYJSON=$(node -e "import('./packages/db/dist/s3.js').then(m=>{const k=m.generateApiKey(); console.log(JSON.stringify(k))})")
    RAW_KEY=$(echo "$KEYJSON" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).raw))")
    KEY_HASH=$(echo "$KEYJSON" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).hash))")
    KEY_PREFIX=$(echo "$KEYJSON" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).prefix))")
    WS_ID="ws_$(openssl rand -hex 6)"
    USER_ID="user_$(openssl rand -hex 8)"
    KEY_ID="key_$(openssl rand -hex 6)"
    WS_NAME="${OWNER_EMAIL%%@*}'s workspace"
    docker compose -p "$PROJECT" -f "$COMPOSE_FILE" exec -T postgres \
      psql -U "${POSTGRES_USER:-diagnost}" -d "${POSTGRES_DB:-diagnost}" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO workspaces (id, name) VALUES ('$WS_ID', '$WS_NAME');
INSERT INTO users (id, workspace_id, email, password_hash, role) VALUES ('$USER_ID', '$WS_ID', '$OWNER_EMAIL', '$HASH', 'owner');
INSERT INTO api_keys (id, workspace_id, key_hash, prefix) VALUES ('$KEY_ID', '$WS_ID', '$KEY_HASH', '$KEY_PREFIX');
SQL
    echo ""
    echo "   === SAVE THESE (shown once) ==="
    echo "   login:    $OWNER_EMAIL"
    echo "   password: $TEMP_PASS"
    echo "   api key:  $RAW_KEY"
    echo "   ==============================="
  fi
fi

# ── 8. nightly backup cron ─────────────────────────────────────────
if [[ "$NO_CRON" == "1" ]]; then
  echo "-- cron skipped (--no-cron)"
else
  echo "-- nightly backup cron (03:00)"
  CRON_LINE="0 3 * * * cd $REPO_DIR && COMPOSE_PROJECT_NAME=$PROJECT bash tools/backup/backup.sh ./backups/\$(date +\%Y\%m\%d) >> /tmp/diagnost-backup.log 2>&1"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "+ (crontab -l; echo \"$CRON_LINE\") | crontab -"
  else
    if [[ "$YES" == "1" ]] || ! crontab -l 2>/dev/null | grep -q "diagnost-ai-prod.*backup.sh"; then
      (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
      echo "   installed"
    else
      echo "   already present"
    fi
  fi
fi

# ── 9. verify ──────────────────────────────────────────────────────
echo "-- verify"
if [[ "$DRY_RUN" == "1" ]]; then
  echo "+ curl -sf http://localhost:\${API_PORT:-4100}/readyz"
else
  sleep 3
  if curl -sf "http://localhost:${API_PORT:-4100}/readyz" | head -c 300; then echo ""; else echo "WARN: readyz not green yet — check: $DC logs api"; fi
fi

echo ""
echo "== done =="
if [[ "$SKIP_TLS" == "1" ]]; then
  echo "dashboard: http://localhost:${DASHBOARD_PORT:-3100}   api: http://localhost:${API_PORT:-4100}"
else
  echo "dashboard: https://$DOMAIN   api: https://$DOMAIN/v1/events"
fi
echo "compose:   docker compose -p $PROJECT -f $COMPOSE_FILE --env-file $ENV_FILE"
