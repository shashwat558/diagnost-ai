# Diagnost AI

**Production analytics and self-improvement for AI agents — Sentry + PostHog + auto-PR-bot, purpose-built for LLM agents.**

[![CI](https://github.com/shashwat558/diagnost-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/shashwat558/diagnost-ai/actions)

Your agent is live. Users talk to it. Some conversations fail — wrong dates, timeouts, hallucinations — and you find out from angry emails, days later. Diagnost fixes that loop: it watches every conversation, clusters failures into ranked intents, alerts you the moment a failure pattern spikes, and opens pull requests with verified fixes. Then it distills your traffic into a small, cheap specialist model.

## Who it's for

- **Teams running agents in production** (support bots, voice agents, ops copilots) who need to see *why* their agent fails at scale.
- **Indie agent builders** who want a free tier, 5-minute setup, and room to grow.
- **Enterprises with compliance needs** — self-host in your VPC, PII redacted by default, audit log, role-based access.
- **AI coding-agent users** — one-line skill auto-instruments any codebase.

## Features

**Observe**
- OpenTelemetry-native ingestion (`POST /v1/events`, single or batches ≤1000), API-key auth, per-workspace quotas enforced at the edge (HTTP 402).
- TypeScript SDK with 3-line OTel exporter swap (LangChain, Vercel AI SDK, LlamaIndex, MCP) or manual `checkpoint()` API; batching + retry, never breaks the host agent.
- **PII redaction default-on** — email, phone, SSN, credit cards (Luhn-validated) + named-entity heuristics hashed in your process, per-event audit log, zero-PII mode.

**Understand**
- Failure clustering (HDBSCAN + LLM judge) ranked by failure impact, with plain-language stats: error rate, frustration, mood, trend sparklines.
- Drift detection that only fires on real spikes (z-gate + CUSUM) — no alert fatigue.
- Feature-request mining: what users keep asking for, ranked with example conversations.

**Alert**
- Slack + email delivery with per-intent hourly rate limiting and an at-least-once ledger.
- Self-serve channels in Settings with one-click test delivery; any SMTP provider in prod, MailHog locally.

**Fix**
- Self-verifying auto-PRs: eval cases generated from your real failing conversations, strict-improvement + zero-regression gate, PRs with diffs, deltas, and evidence links. Works with a GitHub token or fully offline.

**Improve**
- Specialist model training on your traffic with side-by-side frontier comparison (accuracy, latency, cost) and a winner badge.

**Platform**
- Workspaces, API keys, roles (owner > admin > member > viewer), audit log, usage-based billing (Free → Enterprise) via DodoPayments, per-plan retention, backups, one-command self-host or Terraform (AWS/GCP).

## How it works

```
your agent ──SDK/OTel──▶ POST /v1/events ──▶ Redpanda ──▶ consumer ──┬──▶ ClickHouse (analytics)
                                                                     └──▶ MinIO/S3 (transcripts)
        ┌────────────────────────────────────────────────────────────────┘
        ▼
 Python workers: cluster → judge → drift alerts → feature mining → fine-tune
        ▼
 Dashboard (intents, conversations, models) · Slack/email alerts · auto-PR bot
```

## Quickstart (local, ~10 min)

```bash
git clone https://github.com/shashwat558/diagnost-ai && cd diagnost-ai
pnpm install
docker compose up -d --wait        # Postgres :5434, ClickHouse :8123, Redpanda :9092, MinIO :9001
pnpm --filter @diagnost/db migrate # schema + dev workspace
pnpm build
node apps/api/dist/index.js & node apps/api/dist/consumer.js & node apps/api/dist/notifier.js &
pnpm --filter @diagnost/dashboard start   # :3100
```

Sign up at `:3100/signup` for an API key, instrument your agent ([docs](http://localhost:3100/docs/instrumentation)), send traffic, and watch the dashboard. For instant demo data: `bash tools/demo/run.sh phase2` (16k conversations, 3 failure patterns, 1 drift alert). Dev login: `owner@dev.local` / `devpassword123`.

| Service | Endpoint |
|---|---|
| Dashboard / landing | http://localhost:3100 |
| Ingestion API (`/healthz`, `/readyz`) | http://localhost:4100 |
| Postgres | localhost:5434 (`diagnost` / `diagnost_dev_password`) |
| ClickHouse HTTP / native | :8123 / localhost:9009 |
| Redpanda (Kafka) | localhost:9092 (external), `redpanda:29092` (in-network) |
| MinIO console / MailHog | :9001 / :8025 |

## Instrument your agent

```ts
import { createSpanExporter } from "@diagnost/sdk-ts";
// existing OTel pipeline? swap the exporter — done.
dx.checkpoint("order.lookup", { orderId }, { conversationId }); // or manual checkpoints
```

Python / anything else: `POST /v1/events` directly. Or let an AI do it: `npx skills add shashwat558/diagnost-ai --skill agent-analytics`.

## Pricing

| Plan | Price | Events/mo | Retention |
|---|---|---|---|
| Free | $0 | 50k | 7 days |
| Starter | $49 | 250k | 30 days |
| Pro | $299 | 2M | 90 days |
| Enterprise | Custom | Unlimited | 365 days |

Manage tiers in Settings; every change is audited. Self-hostable from Free.

## Self-host (your VPS, one command)

```bash
bash tools/install.sh --domain agents.example.com --email owner@example.com
```

Provisions everything (infra + app + HTTPS + backups + owner account). Full guide: [`docs/self-host.md`](docs/self-host.md). Cloud instead? Terraform modules in `infra/terraform/{aws,gcp}`.

## Project structure

```
apps/
  api/          Fastify ingestion API + consumer + notifier workers
  dashboard/    Next.js 15 app (landing, dashboard, docs, auth, billing)
  analysis/     Python clustering / judge / drift / feature workers
  pr-bot/       auto-remediation → eval-gated pull requests
  finetune/     SFT export, specialist training, benchmarks
packages/
  core/         shared zod event schema       db/  pg/CH/S3 + auth/billing/governance
  queue/        Kafka wrapper                 sdk-ts/  OTel exporter + PII redaction
skills/         agent-analytics installer     tools/   demo seeds, acceptance, backup, install.sh
infra/          clickhouse init, Caddy, Terraform
```

**Stack:** Node 20 + Fastify · Redpanda · ClickHouse · MinIO · Postgres 16 · Python (HDBSCAN/scikit-learn) · Next.js 15 + Tailwind + Recharts + Zustand + TanStack Query + RHF + Zod + shadcn/ui · DodoPayments.

## Docs & development

- In-app docs site: `:3100/docs` — overview, quickstart, instrumentation, concepts, dashboard tour, alerts, billing, self-host, API reference, skill.
- `pnpm lint && pnpm typecheck && pnpm build && pnpm test` — all green required.
- Acceptance per area: `bash tools/demo/run.sh phase{0..8,7e,7f}` (CI runs them all against real Docker infra).
- Build history, phase by phase: [`docs/BUILD_LOG.md`](docs/BUILD_LOG.md).

## License

TBD — pick one before public launch (MIT recommended for open-source-led growth; proprietary license if going closed-source).
