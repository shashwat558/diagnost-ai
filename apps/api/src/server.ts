import Fastify, { type FastifyInstance } from "fastify";
import { query } from "@diagnost/db";
import { apiKeyAuth } from "./auth.js";
import { quotaEnforcement } from "./quota.js";
import { eventsRoutes } from "./routes/events.js";
import type { Producer } from "@diagnost/queue";

export interface ServerOpts {
  databaseUrl: string;
  producer: Producer | null;
  kafkaTopic: string;
}

export function buildServer(opts: ServerOpts): FastifyInstance {
  const app: FastifyInstance = Fastify({ logger: false, bodyLimit: 5 * 1024 * 1024 });

  app.get("/healthz", async () => ({
    ok: true,
    component: "api",
    version: "0.1.0",
    queue: opts.producer ? "connected" : "offline",
  }));

  // Liveness + dependency checks — used by k8s / load balancers
  app.get("/readyz", async (_req, reply) => {
    const checks: Record<string, string> = {};
    let ok = true;

    // Postgres
    try {
      const { query } = await import("@diagnost/db");
      // Use a lightweight query; opts.databaseUrl is ":test:" in unit tests — skip there
      if (opts.databaseUrl !== ":test:") {
        await query<{ one: number }>(opts.databaseUrl, "SELECT 1 AS one");
        checks.postgres = "ok";
      } else {
        checks.postgres = "skipped:test";
      }
    } catch (e) {
      checks.postgres = `error:${String(e).slice(0, 120)}`;
      ok = false;
    }

    // ClickHouse — best-effort ping (env may not be set in tests)
    try {
      const chUrl = process.env.CLICKHOUSE_URL ?? process.env.CLICKHOUSE_HTTP_URL ?? "http://localhost:8123";
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${chUrl}/ping`, { signal: controller.signal });
      clearTimeout(t);
      checks.clickhouse = res.ok ? "ok" : `http:${res.status}`;
      if (!res.ok) ok = false;
    } catch (e) {
      // In unit-test env CH is not running — treat as skipped, not failure
      if (opts.databaseUrl === ":test:") checks.clickhouse = "skipped:test";
      else {
        checks.clickhouse = `error:${String(e).slice(0, 80)}`;
        ok = false;
      }
    }

    checks.queue = opts.producer ? "connected" : "offline";
    if (!ok) return reply.code(503).send({ ok: false, checks });
    return { ok: true, checks };
  });

  // Auth runs whenever a DB is wired; unit tests run without it to exercise routes directly.
  if (opts.databaseUrl !== ":test:") {
    apiKeyAuth(app, opts.databaseUrl);
    quotaEnforcement(app, { databaseUrl: opts.databaseUrl, query });
  }
  eventsRoutes(app, {
    producer: opts.producer,
    topic: opts.kafkaTopic,
    defaultWorkspaceId: "ws_dev",
    allowDryRun: !opts.producer && opts.databaseUrl === ":test:",
  });

  return app;
}
