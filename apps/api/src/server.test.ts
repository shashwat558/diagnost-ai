import { describe, expect, it } from "vitest";
import { buildServer } from "./server.js";
import { type EventEnvelope } from "@diagnost/core";

function validEvent(): EventEnvelope {
  return {
    schemaVersion: 1,
    id: "0b3f6a1e-8f2c-4c1a-9a5f-2f6c8d1e4a7b",
    workspaceId: "ignored",
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    spanId: "00f067aa0ba902b7",
    parentSpanId: null,
    conversationId: "conv_abc",
    sessionId: null,
    name: "llm.call",
    kind: "llm",
    status: "ok",
    errorMessage: null,
    attributes: {},
    metrics: {},
    transcriptRef: null,
    piiAudit: {
      redactions: [],
      zeroPiiMode: false,
      redactorVersion: "sdk-ts@0.1.0",
    },
    timestampMs: Date.now(),
  };
}

// databaseUrl=":test:" disables the auth hook; producer=null → dev workspace fallback
const app = buildServer({
  databaseUrl: ":test:",
  producer: null,
  kafkaTopic: "events.raw",
});

describe("POST /v1/events", () => {
  it("rejects invalid payloads with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/events",
      payload: { garbage: true },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ error: "validation_failed" });
  });

  it("accepts a valid batch and stamps server-side workspaceId", async () => {
    const e = { ...validEvent(), workspaceId: "spoofed" };
    const res = await app.inject({
      method: "POST",
      url: "/v1/events",
      payload: [e, validEvent()],
    });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ accepted: 2 });
  });

  it("healthz reports queue offline in test mode", async () => {
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, queue: "offline" });
  });
});
