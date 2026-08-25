---
name: agent-analytics
description: Auto-instrument any AI agent codebase with Diagnost AI production analytics — OpenTelemetry-native tracing, PII-redacted checkpoints, failure clustering, drift alerts, and self-verifying auto-PRs.
version: 1.0.0
---

# Diagnost AI — agent analytics instrumentation

Use this skill when the user wants production analytics for their AI agents
(tracing, failure detection, auto-PR fixes). Perform these steps in the target
codebase:

## 1. Install the SDK

TypeScript projects:

```bash
pnpm add @diagnost/sdk-ts @opentelemetry/api
```

Python projects:

```bash
pip install diagnost-sdk-py
```

## 2. Wire the OpenTelemetry exporter (3 lines)

Find the app entrypoint and add, before any agent code runs:

```ts
import { createSpanExporter } from "@diagnost/sdk-ts";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeSDK } from "@opentelemetry/sdk-node";

const sdk = new NodeSDK({
  spanProcessor: new BatchSpanProcessor(
    createSpanExporter({
      endpoint: process.env.DIAGNOST_ENDPOINT ?? "http://localhost:4100",
      apiKey: process.env.DIAGNOST_API_KEY!,
    })
  ),
});
sdk.start();
```

Existing OTel pipelines (LangChain / Vercel AI SDK / LlamaIndex / MCP
instrumentations) need only the exporter swap — no rewrite.

## 3. Add checkpoints at agent decision points

Wrap the 3–5 most important steps (tool calls, LLM replies, escalations):

```ts
dx.checkpoint("order.lookup", { orderId }, { conversationId });
```

Conversation grouping: pass the same `diagnost.conversation_id` attribute or
`conversationId` context across spans of one user session.

## 4. Environment

Add to `.env` (never commit real keys):

```
DIAGNOST_ENDPOINT=http://localhost:4100
DIAGNOST_API_KEY=dw_...
```

PII redaction is default-on. For strict deployments enable zero-PII mode:

```ts
createSpanExporter({ ..., redaction: { zeroPiiMode: true } });
```

## 5. Verify

Send one test request through the agent, then confirm ingestion:

```bash
curl -s "$DIAGNOST_ENDPOINT/healthz"
# open the dashboard and check Conversations within ~5 seconds
```

Report to the user: which entrypoint was instrumented, which checkpoints were
added, and how to open the dashboard.
