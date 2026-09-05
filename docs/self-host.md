# Self-hosting Diagnost AI

One-command install on your own VPS. You pay ~$40–80/mo for the box
(Hetzner / DigitalOcean / any Ubuntu 22.04 with 8 vCPU / 32 GB);
we (or you) run one script over SSH. No infra cost to us, full data
ownership for you.

## 1. Prereqs

- Ubuntu 22.04 (or Debian 12) VM: **8 vCPU / 32 GB RAM / 200 GB disk**
- Ports **80 + 443** open (for Caddy automatic HTTPS)
- A domain pointing at the VM, e.g. `agents.example.com`
- Docker + Node 20 + pnpm on the VM (the installer checks and tells you
  exactly what to install if anything is missing)

## 2. Install (one command)

```bash
git clone https://github.com/shashwat558/diagnost-ai /opt/diagnost-ai
cd /opt/diagnost-ai
bash tools/install.sh --domain agents.example.com --email owner@example.com
```

What it does (idempotent — safe to re-run):

1. Checks prerequisites (docker, node ≥ 20, pnpm, openssl, curl)
2. Generates `.env.prod` (mode 600) with random `POSTGRES_PASSWORD`,
   `CLICKHOUSE_PASSWORD`, `S3_SECRET_KEY` from `.env.prod.example`
3. `pnpm install --frozen-lockfile && pnpm build`
4. `docker compose -p diagnost-ai-prod -f docker-compose.prod.yml --profile tls up -d --wait`
   (postgres, clickhouse, redpanda, minio + api, consumer, notifier,
   dashboard, retention-cron, caddy)
5. Runs Postgres + ClickHouse migrations
6. Provisions workspace + owner + ingestion API key (**printed once** —
   save the login, password and API key)
7. Installs a nightly backup cron (`03:00` → `./backups/YYYYMMDD`)
8. Verifies `GET /readyz` and prints URLs

Open `https://agents.example.com`, log in, paste the API key into your
agent (`DIAGNOST_API_KEY`), and data flows in seconds.

## 3. Local test (no domain, no TLS)

```bash
bash tools/install.sh --skip-tls --email owner@example.com --no-cron
# dashboard: http://localhost:3100   api: http://localhost:4100
```

## 4. Operate

```bash
# status
docker compose -p diagnost-ai-prod -f docker-compose.prod.yml --env-file .env.prod ps
curl -s https://agents.example.com/readyz | jq

# logs
docker compose -p diagnost-ai-prod -f docker-compose.prod.yml logs -f api consumer notifier dashboard

# upgrade (pull, rebuild, migrate, restart)
cd /opt/diagnost-ai && git pull
pnpm install --frozen-lockfile && pnpm build
docker compose -p diagnost-ai-prod -f docker-compose.prod.yml --profile tls --env-file .env.prod up -d --build --wait
DATABASE_URL="postgres://diagnost:<pw>@localhost:5434/diagnost" pnpm --filter @diagnost/db migrate
# NOTE: changing DOMAIN requires rebuild (NEXT_PUBLIC_APP_URL is baked at build time)

# retention (automatic daily via retention-cron; manual:)
pnpm --filter @diagnost/db retention -- --dry-run
pnpm --filter @diagnost/db retention
```

Free 7d · Starter 30d · Pro 90d · Enterprise ∞ (see `packages/db/src/billing.ts`).

## 5. Backup & restore

```bash
bash tools/backup/backup.sh ./backups/2026-09-04     # pg_dump + ClickHouse Native + MinIO hint
bash tools/backup/restore.sh ./backups/2026-09-04    # drops + recreates Postgres, reloads ClickHouse
```

Env override for prod: `COMPOSE_PROJECT_NAME=diagnost-ai-prod COMPOSE_FILE=docker-compose.prod.yml`.

Restore-then-install (migrate to a new box):

```bash
bash tools/install.sh --domain agents.example.com --email owner@example.com --restore ./backups/2026-09-04
```

## 6. Billing keys (DodoPayments)

Free works with zero keys (dev-mode: checkout flips `workspaces.plan`
directly). For real money:

1. Create Starter ($49/mo) + Pro ($299/mo) recurring products in Dodo →
   copy `pdt_*` ids into `.env.prod` (`DODO_PAYMENTS_PRODUCT_STARTER/PRO`)
2. Set `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`,
   `DODO_PAYMENTS_ENVIRONMENT=live_mode`
3. Webhook URL in Dodo dashboard: `https://agents.example.com/api/billing/webhook`
4. `docker compose ... up -d --wait` to pick up env (dashboard rebuild
   not needed — billing routes read env at request time)

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `readyz` 503 postgres | `docker ... logs postgres`; check `POSTGRES_PASSWORD` matches `DATABASE_URL` in `.env.prod` |
| `readyz` 503 clickhouse | `docker ... logs clickhouse`; wait 30s (CH is slow to boot) |
| 402 on ingest | Free quota (50k/mo) exhausted — upgrade plan in Settings or reset `usage_monthly` |
| Caddy no cert | Port 80 must be reachable for ACME HTTP-01; check firewall + DNS |
| Dashboard shows old domain | Rebuild: `pnpm --filter @diagnost/dashboard build` (bakes `NEXT_PUBLIC_APP_URL`) |
| SMTP alerts not sending | Set real `SMTP_URL` in `.env.prod` (MailHog is dev-only) |
