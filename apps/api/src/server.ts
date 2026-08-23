import Fastify, { type FastifyInstance } from "fastify";
import { apiKeyAuth } from "./auth.js";
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

  // Auth runs whenever a DB is wired; unit tests run without it to exercise routes directly.
  if (opts.databaseUrl !== ":test:") {
    apiKeyAuth(app, opts.databaseUrl);
  }
  eventsRoutes(app, {
    producer: opts.producer,
    topic: opts.kafkaTopic,
    defaultWorkspaceId: "ws_dev",
    allowDryRun: !opts.producer && opts.databaseUrl === ":test:",
  });

  return app;
}
