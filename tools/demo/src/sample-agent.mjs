/**
 * Sample "support agent" — demonstrates the Phase 1 acceptance:
 * instrumenting an existing OTel-shaped agent with 3 lines of code.
 *
 * The 3 lines are marked below. Everything else is the agent itself,
 * emitting standard OpenTelemetry spans (as LangChain / Vercel AI SDK /
 * LlamaIndex / MCP instrumentations do).
 */
import { DiagnostClient, createSpanExporter } from "@diagnost/sdk-ts";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { trace } from "@opentelemetry/api";

const ENDPOINT = process.env.DIAGNOST_ENDPOINT ?? "http://localhost:4100";
const API_KEY = process.env.DIAGNOST_API_KEY ?? "dw_local_devkey_diagnost_00000000";
const CONVERSATION_ID = process.env.CONVERSATION_ID ?? `conv_demo_${Date.now()}`;

// ── THE 3 LINES ─────────────────────────────────────────────────
const exporter = createSpanExporter({ endpoint: ENDPOINT, apiKey: API_KEY });
const sdk = new NodeSDK({ spanProcessor: new BatchSpanProcessor(exporter) });
sdk.start();
// ────────────────────────────────────────────────────────────────

const tracer = trace.getTracer("sample-support-agent", "0.1.0");
const manual = new DiagnostClient({ endpoint: ENDPOINT, apiKey: API_KEY });

async function main() {
  const convAttrs = { "diagnost.conversation_id": CONVERSATION_ID };

  await tracer.startActiveSpan("agent.session", { attributes: convAttrs }, async (session) => {
    // user message full of PII — must be redacted before it leaves this process
    await tracer.startActiveSpan(
      "llm.reply",
      {
        attributes: {
          ...convAttrs,
          "gen_ai.model": "gpt-4o-mini",
          // full conversation content ships as a JSON string attribute
          // (OTel attributes must be primitives; the platform unpacks this)
          "diagnost.transcript": JSON.stringify([
            { role: "user", content: "Hi, I'm Jane Smith (jane.smith@example.com, +1 555-867-5309). My card 4111 1111 1111 1111 was charged twice!" },
            { role: "assistant", content: "Sorry about that, let me check your billing records." },
          ]),
          prompt: "Refund request for order #8842 by Jane Smith",
        },
      },
      async (llm) => {
        llm.setAttributes({ "gen_ai.usage.tokens_in": 42, "gen_ai.usage.tokens_out": 87 });
        await new Promise((r) => setTimeout(r, 30));
        llm.end();
      }
    );

    await tracer.startActiveSpan(
      "tool.search_billing",
      { attributes: { ...convAttrs, "tool.name": "search_billing", query: "Jane Smith order 8842 SSN 123-45-6789" } },
      async (tool) => {
        await new Promise((r) => setTimeout(r, 20));
        tool.setAttributes({ result_count: 3 });
        tool.end();
      }
    );

    await tracer.startActiveSpan(
      "tool.refund_charge",
      { attributes: { ...convAttrs, "tool.name": "refund_charge" } },
      async (tool) => {
        tool.setStatus({ code: 2, message: "payment gateway timeout after 5000ms" });
        tool.end();
      }
    );

    // manual checkpoint API alongside OTel spans
    manual.checkpoint(
      "user.feedback",
      { rating: 2, comment: "agent could not fix it, asked for Sarah Johnson to call back at 555-123-4567" },
      { conversationId: CONVERSATION_ID, status: "ok", kind: "checkpoint", metrics: {} }
    );

    session.end();
  });

  // flush everything deterministically before exit
  sdk.shutdown
    ? await sdk.shutdown()
    : await new Promise((r) => setTimeout(r, 1500));
  await manual.shutdown();

  console.log(`[sample-agent] sent events for ${CONVERSATION_ID}`);
}

main().catch((err) => {
  console.error("[sample-agent] failed:", err);
  process.exit(1);
});
