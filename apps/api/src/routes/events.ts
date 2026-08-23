import type { FastifyInstance } from "fastify";
import { EventsPayload, EVENT_SCHEMA_VERSION, type EventEnvelope } from "@diagnost/core";
import { publish, type Producer } from "@diagnost/queue";

export function eventsRoutes(
  app: FastifyInstance,
  opts: { producer: Producer | null; topic: string; defaultWorkspaceId: string; allowDryRun?: boolean }
): void {
  app.post("/v1/events", async (req, reply) => {
    // Auth hook sets workspaceId; in unit-test mode a dev fallback keeps the route testable.
    const workspaceId = req.workspaceId ?? (opts.producer ? undefined : opts.defaultWorkspaceId);
    if (!workspaceId) {
      return reply.code(401).send({ error: "unauthenticated" });
    }

    const parsed = EventsPayload.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "validation_failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }

    const events: EventEnvelope[] = (Array.isArray(parsed.data) ? parsed.data : [parsed.data]).map(
      (e) => ({
        ...e,
        schemaVersion: EVENT_SCHEMA_VERSION,
        // server-side tenant stamping — never trust client-supplied workspaceId
        workspaceId,
      })
    );

    if (opts.producer) {
      await publish(opts.producer, opts.topic, events.map((e) => ({ key: e.traceId, value: e })));
    } else if (!opts.allowDryRun) {
      return reply.code(503).send({ error: "queue_unavailable" });
    }
    // allowDryRun (unit tests): validation + stamping verified without a broker
    return reply.code(202).send({ accepted: events.length });
  });
}
