# Diagnost AI

Production analytics and self-improvement platform for teams running AI agents (chat / voice / MCP-based). Ingests production conversation traces via OpenTelemetry, clusters failures and feature requests, detects regressions statistically (EWMA/CUSUM) before LLM-judge labeling, opens self-verifying auto-PRs with eval reports, and fine-tunes small specialist models from accumulated data.

**Sentry + PostHog + auto-PR-bot — purpose-built for LLM agents.**

## Differentiators

- **PII redaction default-on** in the SDK (email/phone/SSN/credit-card + lightweight NER), with a per-event redaction audit log and a zero-PII mode.
- **OpenTelemetry-native ingestion first**: one-line exporter change for existing OTel users; manual `checkpoint()` API second.
- **Statistical anomaly detection + LLM judge**: control-chart drift detection as cheap explainable first pass; LLM as deeper labeler.
- **Self-verifying auto-PRs**: every generated fix ships with the eval cases it passed and before/after deltas.
- **Self-hostable from the lowest tier.**

## Stack

| Layer | Tech |
|---|---|
| Ingestion API | Node 20 + Fastify |
| Queue | Redpanda (Kafka API), single node |
| Event store | ClickHouse |
| Blob store | MinIO (S3-compatible) |
| App DB | Postgres |
| Analysis workers | Python (embeddings + HDBSCAN + stats) |
| Dashboard | Next.js + Tailwind + Recharts |
| SDKs | TypeScript, Python |

## Quickstart

```bash
pnpm install
docker compose up -d --wait   # Postgres, ClickHouse, Redpanda, MinIO
pnpm build && pnpm test       # monorepo pipelines
bash tools/demo/run.sh phase0 # infra acceptance checks
```

Services (local):

| Service | Endpoint |
|---|---|
| ClickHouse HTTP | http://localhost:8123 |
| ClickHouse native | localhost:9009 |
| Postgres | localhost:5432 (`diagnost` / `diagnost_dev_password`) |
| Redpanda (Kafka) | localhost:9092 (external), redpanda:29092 (in-network) |
| MinIO console | http://localhost:9001 |
| Ingestion API | http://localhost:4100 |

Copy `.env.example` → `.env` to override defaults.

---

## Phase 0 — Scaffolding ✅

What was built:

- **Monorepo**: pnpm workspaces + Turborepo (`build` / `typecheck` / `test` / `dev` task graph, `^build` dependency ordering).
- **CI**: GitHub Actions — lint (ESLint 9 flat config), build, typecheck, vitest unit tests, plus an integration job that boots the full Docker stack and runs phase acceptance scripts.
- **Local infra** (`docker-compose.yml`, healthchecked):
  - `postgres:16-alpine` — app DB
  - `clickhouse/clickhouse-server:24.8-alpine` — event store, `events` database created on boot
  - `redpandadata/redpanda:v24.2.7` — single broker, dual listeners (container-internal `redpanda:29092`, host-advertised `127.0.0.1:9092`)
  - `minio` + one-shot init job creating buckets `transcripts`, `finetune-datasets`, `eval-artifacts`
- **Shared event schema** (`packages/core`): versioned, strict zod envelope — OTel trace/span ids, PII audit log fields, zero-PII flag — validated by unit tests.
- **API skeleton** (`apps/api`): Fastify `/healthz`.

Acceptance criteria & proof:

```bash
docker compose up -d --wait      # all services report healthy
bash tools/demo/run.sh phase0    # PASS postgres / clickhouse(+events db) / redpanda / minio+buckets
pnpm lint && pnpm typecheck && pnpm build && pnpm test   # green
```

Known port mapping: ClickHouse native is published on host **9009** (container 9000) to avoid colliding with MinIO's API on host 9000.

---

## Phase 1 — Ingestion MVP ✅

What was built:

- **Ingestion API** (`apps/api`):
  - `POST /v1/events` (single event or batch ≤1000) with zod validation of the strict envelope
  - API-key auth (`Authorization: Bearer dw_…`), sha256-hashed keys in Postgres, per-workspace scoping stamped **server-side**
  - Produces to Redpanda topic `events.raw`; graceful degraded startup if Kafka is down
- **Ingestion consumer** (`apps/api/dist/consumer.js`, separate process):
  - Kafka → ClickHouse batch inserts (MergeTree, daily partitions, 90-day TTL)
  - Full transcripts → MinIO (`s3://transcripts/<ws>/<conversation>/<span>.json`) whenever a span carries a `diagnost.transcript` JSON attribute; the inline copy stays in ClickHouse for drill-down
- **TypeScript SDK** (`packages/sdk-ts`):
  - **OTel-native**: `createSpanExporter()` plugs into any existing OpenTelemetry pipeline (LangChain / Vercel AI SDK / LlamaIndex / MCP instrumentations emit standard spans) — one exporter change, no rewrite
  - Manual API: `client.checkpoint(name, metadata)` / `client.track(event)`
  - **Default-on PII redaction before send**: email, phone (digit-count validated), SSN, credit card (Luhn-validated), heuristic named-entity pass; customer custom rules; per-event audit log (`pii_audit`) ships alongside every event; **zero-PII mode** strips all string content
  - Batching + retry w/ backoff + fail-open (never breaks the host agent)
- **Dashboard** (`apps/dashboard`, Next.js + Tailwind + Recharts): event volume ok/error timeline, latency p50/p95, per-tool breakdown table+chart, conversation list, and a session drill-down waterfall with PASS/FAIL markers, redacted attribute inspector, and PII-audit badges
- **Migrations & seed** (`packages/db`): Postgres + ClickHouse migration runner (`pnpm --filter @diagnost/db migrate && … run seed`)

Acceptance criteria & proof:

```bash
bash tools/demo/run.sh phase1
```

PASS checks: api healthy · rejects unauthenticated/invalid keys · sample agent executes · traces land in ClickHouse within seconds · no raw PII stored anywhere (CH or S3) · redaction audit log shipped · hashed `[EMAIL:`/`[CARD:` markers present · error spans captured · transcripts in object storage, redacted.

Try the dashboard:

```bash
pnpm --filter @diagnost/dashboard build && pnpm --filter @diagnost/dashboard start
# open http://localhost:3100
```

---

## Phase 2 — Conversation intelligence ✅

What was built:

- **Analysis worker** (`apps/analysis`, Python 3.12 + numpy/HDBSCAN/scikit-learn):
  - **Embeddings**: deterministic hashing embedder offline (`EMBEDDING_PROVIDER=openai` upgrades to real embeddings); pattern discovery embeds **user-side text only** — users describe problems consistently, assistant boilerplate would fragment clusters along response variants
  - **HDBSCAN** clustering (eom selection + epsilon merge) over conversation embeddings
  - **LLM judge**: rule-based offline default labeling intent / sentiment / frustration / summary, specific-intent-first taxonomy; `OPENAI_API_KEY` + `LLM_PROVIDER=openai` swaps in model-based judging
  - **Drift engine**: EWMA baseline + CUSUM control chart per cluster, gated by a two-proportion z-test (z ≥ 3) and minimum effect size; adaptive bucket sizing keeps per-bucket volume statistically meaningful; every alert ships its full rate series as evidence
- **Pipeline** idempotent via `processed_conversations` checkpointing; alerts deduped per hour
- **Seeder** (`tools/seed/phase2-seed.mjs`): 5,000 synthetic conversations over 48h — benign base corpus plus three injected failure patterns, one (`date_format_error`) with an accelerating failure-rate ramp
- **Dashboard**: Patterns page ranked by failure impact with drift-alert banners, cluster detail linking every member conversation to its session drill-down (PASS/FAIL markers)
- Postgres schema: `clusters`, `cluster_members` (+per-member `has_error`), `alerts`, `processed_conversations`, `feature_requests` (reserved for Phase 3)

Acceptance criteria & proof:

```bash
bash tools/demo/run.sh phase2   # 12 checks, all PASS
```

PASS checks: 16k events ingested · analysis ran · all 3 injected patterns surface as top clusters by failure impact · spiking pattern ranks #1 · source-conversation linkage purity 0.83–1.0 · exactly ONE drift alert, on the spiking pattern only · 21 Python unit tests · dashboard renders patterns view.

Run intelligence manually:

```bash
node tools/seed/phase2-seed.mjs                       # seed data
apps/analysis/.venv/bin/python apps/analysis/run_analysis.py
```

---

## Phase 3 — Alerts & feedback loop ✅

What was built:

- **Alert notifier** (`apps/api/src/notifier.ts`, separate process):
  - Fans out undelivered alerts to per-workspace channels: **Slack webhook** + **SMTP email** (MailHog captures locally at http://localhost:8025)
  - **Rate limiting**: one notification per cluster per 60min window; suppressed duplicates are logged as `skipped` rows, never silently dropped
  - **At-least-once ledger** (`alert_deliveries`): every attempt recorded as sent / failed / skipped with detail
- **Feature-request extraction** (`apps/analysis` → `run_features.py`):
  - Separate pass over transcripts tagging *"user asked for X we don't support"* signals
  - Offline rule-based judge: sentence-level request-cue detection + signature-keyword slug mapping (`csv_export`, `slack_integration`, …) with stable derived slugs for unmapped asks
  - OpenAI-compatible LLM path via `FEATURE_JUDGE=openai` + key
  - Aggregation counts **conversations per slug** (never raw mentions), keeps up to 20 example conversation IDs linked to source sessions
- **Dashboard**: Features page — ranked requests with frequency bars and example links into session drill-downs

Acceptance criteria & proof:

```bash
bash tools/demo/run.sh phase3   # 12 checks, all PASS
```

PASS checks: notifier running · alert delivered as email (MailHog) · duplicate-cluster alert rate-limited to `skipped` · seeded transcripts ingested · ranked list matches seed exactly (#1 csv_export×25, #2 slack_integration×15, #3 dark_mode×8) · webhooks ×5 · one-off requests captured · examples linked · dashboard renders · 29 python unit tests.

---

## Phase 4 — Auto-remediation (auto-PR) ✅

What was built (`apps/pr-bot`):

- **Artifact registry** (Postgres): workspaces register versioned patch targets — prompt templates or tool schemas — each owning a failure `intent` (e.g. `booking_assistant_prompt@v3` handles `date_format_error`)
- **Remediation pipeline** (`node apps/pr-bot/dist/main.js --cluster <id>`):
  1. Matches the failure cluster to its artifact
  2. Generates a candidate patch — deterministic offline repair, or model rewrite with `LLM_PROVIDER=openai`
  3. **Auto-generates eval cases from the cluster's failing conversations** (impossible dates observed in real evidence become probes) plus canonical edge cases
  4. Runs the patch against them **and a held-out regression set** of previously-passing same-intent conversations
  5. **Gate**: strict improvement required + zero regressions, or no PR
  6. Opens a PR containing the unified diff, before/after eval table, and links to source conversations
- **GitHub dual-mode**: real API via `GITHUB_TOKEN`+`GITHUB_REPO`, or an offline local git fixture (`fixture://…`) so self-hosted/no-token environments get the full flow; PR payloads land in `/tmp/diagnost-pr-outbox`
- Agent-under-test: deterministic prompt-directive simulator offline (same grading contract as live-model mode); grader + gate covered by unit tests

Acceptance criteria & proof:

```bash
bash tools/demo/run.sh phase4   # 13 checks, all PASS
```

PASS checks: failure cluster present · artifact registered · gate passed (baseline 0% → patched 100%, zero held-out regressions) · PR opened & recorded · branch carries the validation-directive fix while main stays untouched · PR body shows deltas + source-conversation links · eval cases are evidence-linked · 9 harness unit tests + 29 python tests.

---

## Phase 5 — Custom model training ✅

What was built (`apps/finetune`, Python):

- **Dataset export**: labeled/clustered traces → SFT JSONL (`system router prompt + user text → intent`) with deterministic stratified train/held-out split; uploaded to `s3://finetune-datasets/…` (MinIO). DPO export shares the same loader.
- **Trainer abstraction**:
  - `local_specialist` (offline default): a genuinely trained tiny router — TF-IDF + logistic regression via scikit-learn, persisted with joblib. Millisecond inference, zero marginal cost.
  - `together` / `fireworks`: managed-provider LoRA fine-tune job submission for small open models (Llama-3.2-3B class); activates with `FINETUNE_TRAINER` + `FINETUNE_API_KEY`.
- **Benchmark harness**: specialist vs frontier on the held-out set — accuracy per intent, p50/p95 latency, cost per 1k requests. Frontier runs live against an OpenAI-compatible model when a key is present; otherwise documented reference figures for gpt-4o-mini are shown clearly marked `measured_latency=false`. Specialist figures are always locally measured.
- **Dashboard**: Models page — side-by-side cards with winner badge, accuracy bars, latency/cost comparison table, per-intent breakdown.

Acceptance criteria & proof:

```bash
bash tools/demo/run.sh phase5   # 11 checks, all PASS
```

PASS checks: labeled corpus available (2,412 conversations) · specialist trained · SFT dataset exported to object storage and readable (1,811 rows) · benchmark side-by-side: **accuracy 1.000 vs 1.000 (matches frontier), p95 latency ~2ms vs 1800ms reference, $0 vs $22.80 per 1k requests** · specialist declared winner · artifact persisted · 5 unit tests · dashboard renders the comparison.

---

## Phase 6 — Productionization ✅

What was built:

- **Usage-based billing**: Free (50k events/mo, 7-day retention) · Starter (250k, $49) · Pro (2M, $299) · Enterprise (custom). Monthly usage metered by the ingest consumer; **quotas enforced at the ingestion edge (HTTP 402)** with audit logging; reads never blocked. Settings page shows the usage meter and tier comparison.
- **Audit log**: every privileged action (quota violations, plan changes, auto-PR openings) recorded with actor/target/metadata/IP — browsable at `/audit`.
- **Workspace roles**: owner > admin > member > viewer (`users.role`, enforced via `hasAtLeast()`), dev owner seeded. OIDC SSO adapter documented (`OIDC_ISSUER_URL`) with IdP-group→role mapping.
- **Deployment**: Terraform AWS module (VPC, RDS Postgres, S3, ECS Fargate for api/consumer/notifier/dashboard/pr-bot, ALB) + GCP skeleton (Compute Engine, Cloud SQL, GCS). Fully self-hostable via Docker Compose from the Free tier. Self-host guide in `/docs`.
- **Docs site**: in-app documentation (quickstart, SDK instrumentation, plans, self-hosting, agent skill).
- **Skill installer**: `skills/agent-analytics/SKILL.md` — one-line auto-instrumentation for AI coding agents:
  `npx skills add shashwat558/diagnost-ai --skill agent-analytics`

Acceptance criteria & proof:

```bash
bash tools/demo/run.sh phase6   # 12 checks, all PASS
```

PASS checks: over-quota ingestion rejected 402 + audited · ingestion resumes after reset · roles seeded · settings/audit/docs pages render · Terraform AWS + GCP present · skill package present · 4 governance/billing unit tests.
