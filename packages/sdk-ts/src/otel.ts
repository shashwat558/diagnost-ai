import type { SpanExporter, ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { ExportResultCode, hrTimeToMilliseconds } from "@opentelemetry/core";
import { EVENT_SCHEMA_VERSION, type EventEnvelope, type EventKind } from "@diagnost/core";
import { DiagnostClient, REDACTOR_VERSION, type DiagnostClientOpts } from "./client.js";

/**
 * OpenTelemetry-native ingestion: point any existing OTel pipeline at this
 * exporter and spans become Diagnost events — no rewrite required.
 *
 * Works with LangChain / Vercel AI SDK / LlamaIndex / MCP instrumentations
 * that emit standard OTel spans.
 */

const LLM_ATTR_PREFIXES = ["gen_ai.", "llm.", "ai.", "openinference.span.kind"];
const TOOL_HINT_RE = /^(tool[._]|function[._])/i;

function inferKind(span: ReadableSpan): EventKind {
  const attrs = span.attributes;
  const oiKind = attrs["openinference.span.kind"];
  if (typeof oiKind === "string") {
    const k = oiKind.toUpperCase();
    if (k === "LLM") return "llm";
    if (k === "TOOL") return "tool";
    if (k === "RETRIEVER") return "retrieval";
    if (k === "AGENT") return "agent";
  }
  for (const prefix of LLM_ATTR_PREFIXES) {
    for (const key of Object.keys(attrs)) {
      if (key.startsWith(prefix)) return "llm";
    }
  }
  if (TOOL_HINT_RE.test(span.name)) return "tool";
  switch (span.kind) {
    case 3: // CLIENT
      return "tool";
    case 4: // PRODUCER
      return "tool";
    default:
      return "agent";
  }
}

export class DiagnostSpanExporter implements SpanExporter {
  private client: DiagnostClient;

  constructor(opts: DiagnostClientOpts) {
    this.client = new DiagnostClient(opts);
  }

  export(spans: ReadableSpan[], resultCallback: (result: { code: ExportResultCode }) => void): void {
    try {
      for (const span of spans) {
        this.client.enqueueRaw(this.convert(span));
      }
      try {
        // fire-and-forget; a flush hiccup must not fail the export callback
        void this.client.flush().catch(() => {});
      } catch {
        /* noop */
      }
      resultCallback({ code: ExportResultCode.SUCCESS });
    } catch {
      resultCallback({ code: ExportResultCode.FAILED });
    }
  }

  async shutdown(): Promise<void> {
    await this.client.shutdown();
  }

  async forceFlush(): Promise<void> {
    await this.client.flush();
  }

  private convert(span: ReadableSpan): EventEnvelope {
    const sc = span.spanContext();
    const status = span.status;
    const isError = status.code === 2; // SpanStatusCode.ERROR

    // conversation/session hints may live on span or resource attributes
    const allAttrs: Record<string, unknown> = {
      ...Object.fromEntries(
        Object.entries(span.resource?.attributes ?? {}).map(([k, v]) => [`resource.${k}`, v])
      ),
      ...span.attributes,
    };

    const redacted = this.client.applyRedaction(allAttrs);

    return {
      schemaVersion: EVENT_SCHEMA_VERSION,
      id: crypto.randomUUID(),
      workspaceId: "",
      traceId: sc.traceId,
      spanId: sc.spanId,
      parentSpanId: span.parentSpanId ?? null,
      conversationId:
        (span.attributes["diagnost.conversation_id"] as string | undefined) ?? sc.traceId,
      sessionId: (span.attributes["diagnost.session_id"] as string | undefined) ?? null,
      name: span.name,
      kind: inferKind(span),
      status: isError ? "error" : "ok",
      errorMessage: isError ? (status.message ?? "error") : null,
      attributes: redacted.attributes,
      metrics: {
        // UInt64 on the CH side — keep whole milliseconds
        latencyMs: Math.round(hrTimeToMilliseconds(span.duration)),
      },
      transcriptRef: null,
      piiAudit: {
        redactions: redacted.audit.redactions,
        zeroPiiMode: redacted.audit.zeroPiiMode,
        redactorVersion: REDACTOR_VERSION,
      },
      timestampMs: hrTimeToMilliseconds(span.startTime),
    };
  }
}

export function createSpanExporter(opts: DiagnostClientOpts): DiagnostSpanExporter {
  return new DiagnostSpanExporter(opts);
}
