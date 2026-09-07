import { H1, Lead, H2, P, Code, Inline, DocTable, Callout, PrevNext } from "@/components/docs-ui";

export const metadata = { title: "Instrument your agent — Diagnost AI Docs" };

export default function InstrumentationPage() {
  return (
    <div>
      <H1>Instrument your agent</H1>
      <Lead>Three ways to send data, from zero-config to fully manual. PII redaction runs in your process either way.</Lead>

      <H2>Option A — OpenTelemetry exporter (recommended)</H2>
      <P>
        Already emitting spans (LangChain, Vercel AI SDK, LlamaIndex, MCP instrumentations)?
        Swap the exporter — three lines, no rewrite:
      </P>
      <Code>{`import { createSpanExporter } from "@diagnost/sdk-ts";
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
sdk.start();`}</Code>
      <P>
        Group spans into conversations with the same <Inline>diagnost.conversation_id</Inline>{" "}
        span attribute (or <Inline>conversationId</Inline> in checkpoint context) across one user session.
      </P>

      <H2>Option B — Manual checkpoints</H2>
      <P>Wrap the 3–5 most important steps (tool calls, replies, escalations):</P>
      <Code>{`import { createClient } from "@diagnost/sdk-ts";
const dx = createClient({ endpoint: "http://localhost:4100", apiKey: process.env.DIAGNOST_API_KEY! });

dx.checkpoint("order.lookup", { orderId }, { conversationId });
dx.checkpoint("llm.reply", { model: "gpt-4o-mini" }, { conversationId, kind: "llm" });`}</Code>

      <H2>Option C — Raw HTTP (any language)</H2>
      <P>
        <Inline>POST /v1/events</Inline> with <Inline>Authorization: Bearer &lt;key&gt;</Inline>.
        Batches of 1–1000 envelopes; server stamps <Inline>workspaceId</Inline> from your key
        (never trust client-supplied tenants). See <Inline>/docs/api-reference</Inline> for the envelope schema.
      </P>

      <H2>PII redaction</H2>
      <P>
        Default-on in the SDK: email, phone, SSN, credit cards (Luhn-validated) plus a
        lightweight named-entity heuristic are hashed before anything leaves your process, with a
        per-event redaction audit log. For strict deployments, enable zero-PII mode (strips all
        string content):
      </P>
      <Code>{`createSpanExporter({ endpoint, apiKey, redaction: { zeroPiiMode: true } });`}</Code>
      <Callout>
        Custom rules via <Inline>redaction.customRules</Inline>. Known gaps are documented in{" "}
        <Inline>docs/pii.md</Inline> in the repo.
      </Callout>

      <H2>SDK options</H2>
      <DocTable
        head={["Option", "Default", "What it does"]}
        rows={[
          ["endpoint", "http://localhost:4100", "Ingestion API base URL"],
          ["apiKey", "(required)", "Workspace key from signup — shown once"],
          ["redaction.zeroPiiMode", "false", "Strip all string content"],
          ["redaction.customRules", "[]", "Your own regex/NER rules"],
          ["conversationId", "per-process uuid", "Default session grouping"],
        ]}
      />

      <PrevNext
        prev={{ href: "/docs/quickstart", label: "Quickstart" }}
        next={{ href: "/docs/concepts", label: "Core concepts" }}
      />
    </div>
  );
}
