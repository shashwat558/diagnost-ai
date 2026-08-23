import { describe, expect, it } from "vitest";
import { envelopeToRow } from "./clickhouse.js";
import { generateApiKey, hashApiKey } from "./s3.js";
import type { EventEnvelope } from "@diagnost/core";

function sampleEvent(): EventEnvelope {
  return {
    schemaVersion: 1,
    id: "0b3f6a1e-8f2c-4c1a-9a5f-2f6c8d1e4a7b",
    workspaceId: "ws_dev",
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    spanId: "00f067aa0ba902b7",
    parentSpanId: null,
    conversationId: "conv_1",
    sessionId: null,
    name: "llm.call",
    kind: "llm",
    status: "ok",
    errorMessage: null,
    attributes: { model: "gpt-4o-mini" },
    metrics: { latencyMs: 120.6, tokensIn: 10 },
    transcriptRef: null,
    piiAudit: {
      redactions: [{ field: "(root)", type: "email", action: "hash", count: 1 }],
      zeroPiiMode: false,
      redactorVersion: "sdk-ts@0.1.0",
    },
    timestampMs: Date.UTC(2026, 0, 15, 12, 30, 45, 123),
  };
}

describe("envelopeToRow", () => {
  it("flattens the envelope into a ClickHouse-safe row", () => {
    const row = envelopeToRow(sampleEvent());
    expect(row.id).toBe("0b3f6a1e-8f2c-4c1a-9a5f-2f6c8d1e4a7b");
    expect(row.kind).toBe("llm");
    expect(row.attributes).toBe('{"model":"gpt-4o-mini"}');
    // DateTime64 JSONEachRow format
    expect(row.timestamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
    // latency rounded to whole ms for UInt64
    expect(row.latency_ms).toBe(121);
    expect(row.pii_redactions).toEqual([
      { field: "(root)", type: "email", action: "hash", count: 1 },
    ]);
  });
});

describe("api keys", () => {
  it("generates dw_-prefixed keys with stable hashes", () => {
    const key = generateApiKey();
    expect(key.raw).toMatch(/^dw_[0-9a-f]{8}_/);
    expect(hashApiKey(key.raw)).toHaveLength(64);
    expect(hashApiKey(key.raw)).toBe(key.hash);
  });
});
