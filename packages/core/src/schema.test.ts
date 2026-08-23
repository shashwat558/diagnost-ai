import { describe, expect, it } from "vitest";
import {
  EVENT_SCHEMA_VERSION,
  EventEnvelope,
  EventsPayload,
  type EventEnvelope as Envelope,
} from "./schema.js";

function validEvent(): Envelope {
  return {
    schemaVersion: 1,
    id: "0b3f6a1e-8f2c-4c1a-9a5f-2f6c8d1e4a7b",
    workspaceId: "ws_123",
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    spanId: "00f067aa0ba902b7",
    parentSpanId: null,
    conversationId: "conv_abc",
    sessionId: null,
    name: "llm.call",
    kind: "llm",
    status: "ok",
    errorMessage: null,
    attributes: { "llm.model": "gpt-4o-mini" },
    metrics: { latencyMs: 420 },
    transcriptRef: null,
    piiAudit: {
      redactions: [{ field: "attributes.prompt", type: "email", action: "hash", count: 1 }],
      zeroPiiMode: false,
      redactorVersion: "sdk-ts@0.1.0",
    },
    timestampMs: Date.now(),
  };
}

describe("EventEnvelope", () => {
  it("accepts a valid envelope", () => {
    const parsed = EventEnvelope.parse(validEvent());
    expect(parsed.schemaVersion).toBe(EVENT_SCHEMA_VERSION);
  });

  it("applies defaults for status/attributes/metrics/schemaVersion", () => {
    const e = validEvent();
    // @ts-expect-error exercising runtime defaulting
    delete e.status;
    // @ts-expect-error exercising runtime defaulting
    delete e.attributes;
    // @ts-expect-error exercising runtime defaulting
    delete e.metrics;
    const parsed = EventEnvelope.parse(e);
    expect(parsed.status).toBe("ok");
    expect(parsed.attributes).toEqual({});
    expect(parsed.metrics).toEqual({});
  });

  it("rejects malformed trace/span ids", () => {
    const e = validEvent();
    e.traceId = "not-hex";
    expect(EventEnvelope.safeParse(e).success).toBe(false);
  });

  it("rejects unknown top-level keys (strict)", () => {
    const e = validEvent() as Record<string, unknown>;
    e.sneaky = true;
    expect(EventEnvelope.safeParse(e).success).toBe(false);
  });

  it("payload accepts single event or batch", () => {
    expect(EventsPayload.safeParse(validEvent()).success).toBe(true);
    expect(EventsPayload.safeParse([validEvent(), validEvent()]).success).toBe(true);
    expect(EventsPayload.safeParse([]).success).toBe(false);
  });
});
