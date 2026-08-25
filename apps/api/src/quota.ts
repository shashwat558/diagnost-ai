import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getMonthlyUsage, planFor, recordAudit, type QueryFn } from "@diagnost/db";

/**
 * Ingestion quota enforcement: fail-closed once the workspace's monthly event
 * quota is exhausted (HTTP 402). Reads are never blocked. Plan/usage lookups
 * are cached briefly to keep the hot path cheap.
 */

interface CacheEntry {
  limit: number;
  used: number;
  expires: number;
}

export function quotaEnforcement(
  app: FastifyInstance,
  opts: { databaseUrl: string; query: QueryFn }
): void {
  const cache = new Map<string, CacheEntry>();
  const TTL_MS = 15_000;

  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.url !== "/v1/events" || req.method !== "POST") return;
    const workspaceId = req.workspaceId;
    if (!workspaceId) return; // auth hook runs first; unauthenticated → 401 there

    const now = Date.now();
    let entry = cache.get(workspaceId);
    if (!entry || entry.expires < now) {
      const wsRows = await opts.query<{ plan: string }>(
        opts.databaseUrl,
        "SELECT plan FROM workspaces WHERE id = $1",
        [workspaceId]
      );
      const plan = planFor(wsRows[0]?.plan);
      const used = await getMonthlyUsage(opts.databaseUrl, workspaceId);
      entry = { limit: plan.monthlyEvents, used, expires: now + TTL_MS };
      cache.set(workspaceId, entry);
    }

    if (entry.used >= entry.limit) {
      await recordAudit(opts.databaseUrl, {
        workspaceId,
        actor: `workspace:${workspaceId}`,
        action: "ingest.quota_exceeded",
        metadata: { used: entry.used, limit: entry.limit },
        ip: req.ip,
      });
      return reply.code(402).send({
        error: "quota_exceeded",
        message: "Monthly event quota exhausted — upgrade the workspace plan to continue ingestion.",
      });
    }
  });
}
