import { describe, expect, it } from "vitest";
import { ExportResultCode } from "@opentelemetry/core";
import { DiagnostSpanExporter } from "./otel.js";
import { DiagnostClient } from "./client.js";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";

/** Swap the internal client's sink while keeping its redaction methods. */
function interceptSink(exporter: DiagnostSpanExporter, sink: (e: Record<string, unknown>) => void): void {
  const real = new DiagnostClient({ endpoint: "http://127.0.0.1:9", apiKey: "dw_x" });
  const proxy = Object.create(real) as Record<string, unknown>;
  proxy.enqueueRaw = (e: unknown) => sink(e as Record<string, unknown>);
  proxy.flush = async () => {};
  (exporter as unknown as { client: unknown }).client = proxy;
}

function fakeSpan(overrides: Partial<Record<string, unknown>> = {}): ReadableSpan {
  const base = {
    name: "agent.run",
    kind: 0,
    spanContext: () => ({
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      spanId: "00f067aa0ba902b7",
      traceFlags: 1,
    }),
    parentSpanContext: undefined,
    startTime: [1_700_000_000, 0] as [number, number],
    duration: [0, 120_000_000] as [number, number], // 120ms
    status: { code: 0 },
    attributes: {} as Record<string, unknown>,
    resource: { attributes: { "service.name": "demo-agent" } },
    ...overrides,
  };
  return base as unknown as ReadableSpan;
}

describe("DiagnostSpanExporter.convert", () => {
  it("maps an OTel span to the event envelope with kind inference", async () => {
    const exporter = new DiagnostSpanExporter({
      endpoint: "http://127.0.0.1:9", // never called in this test
      apiKey: "dw_x",
    });
    const span = fakeSpan({
      attributes: {
        "gen_ai.model": "gpt-4o-mini",
        "diagnost.conversation_id": "conv_77",
        prompt: "user alice@example.com asked",
      },
    });

    let envelope!: Record<string, unknown>;
    interceptSink(exporter, (e) => {
      envelope = e;
    });
    exporter.export([span], (r) => expect(r.code).toBe(ExportResultCode.SUCCESS));

    await Promise.resolve();
    expect(envelope.kind).toBe("llm");
    expect(envelope.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(envelope.conversationId).toBe("conv_77");
    expect(envelope.metrics).toMatchObject({ latencyMs: expect.any(Number) });
    // PII redacted inside attributes
    expect(JSON.stringify(envelope.attributes)).toContain("[EMAIL:");
    expect(JSON.stringify(envelope.attributes)).not.toContain("alice@example.com");
    expect((envelope.piiAudit as { redactions: unknown[] }).redactions.length).toBeGreaterThan(0);
  });

  it("marks error spans", () => {
    const exporter = new DiagnostSpanExporter({ endpoint: "http://127.0.0.1:9", apiKey: "dw_x" });
    const span = fakeSpan({
      status: { code: 2, message: "tool timeout" },
      name: "tool.search_flights",
    });
    interceptSink(exporter, (e) => {
      expect(e.status).toBe("error");
      expect(e.kind).toBe("tool");
    });
    exporter.export([span], () => {});
  });
});
