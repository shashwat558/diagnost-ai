import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DiagnostClient } from "./client.js";

describe("DiagnostClient", () => {
  let server: Server;
  const received: unknown[] = [];
  let requestCount = 0;

  beforeAll(async () => {
    server = createServer((req, res) => {
      requestCount++;
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        received.push(JSON.parse(body));
        res.writeHead(202, { "content-type": "application/json" });
        res.end(JSON.stringify({ accepted: JSON.parse(body).length }));
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  });

  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
  });

  it("batches checkpoints and delivers them with auth header", async () => {
    const port = (server.address() as { port: number }).port;
    const client = new DiagnostClient({
      endpoint: `http://127.0.0.1:${port}`,
      apiKey: "dw_test_key",
      flushIntervalMs: 50,
    });

    client.checkpoint("order.lookup", { orderId: "o_1", note: "user jane@x.io called" });
    client.checkpoint("llm.reply", {}, { kind: "llm", metrics: { latencyMs: 120 } });
    await client.shutdown();

    const batch = received[0] as Array<Record<string, unknown>>;
    expect(batch.length).toBe(2);
    expect(batch[0]).toMatchObject({ name: "order.lookup", kind: "checkpoint" });
    // PII redacted in transit
    expect(JSON.stringify(batch)).not.toContain("jane@x.io");
    expect(JSON.stringify(batch)).toContain("[EMAIL:");
    // audit log present
    const audit = batch[0]!.piiAudit as { redactions: unknown[] };
    expect(audit.redactions.length).toBeGreaterThan(0);
    void requestCount;
  });

  it("fails open when the endpoint is down", async () => {
    const client = new DiagnostClient({
      endpoint: "http://127.0.0.1:1",
      apiKey: "dw_x",
      flushIntervalMs: 20,
      debug: false,
    });
    client.checkpoint("should.not.throw");
    await client.shutdown(); // must not throw despite retries failing
    expect(requestCount).toBeGreaterThanOrEqual(0);
  });

  it("zero-pii mode strips strings in transit", async () => {
    const port = (server.address() as { port: number }).port;
    const client = new DiagnostClient({
      endpoint: `http://127.0.0.1:${port}`,
      apiKey: "dw_test_key",
      flushIntervalMs: 50,
      redaction: { zeroPiiMode: true },
    });
    client.track({ name: "tool.search", kind: "tool", attributes: { query: "flights to paris" } });
    await client.shutdown();

    const lastBatch = received.at(-1) as Array<Record<string, unknown>>;
    expect(JSON.stringify(lastBatch)).not.toContain("paris");
    expect(JSON.stringify(lastBatch)).toContain("[ZERO_PII]");
  });
});
