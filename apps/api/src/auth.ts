import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { hashApiKey, query } from "@diagnost/db";

interface CachedKey {
  workspaceId: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000;

declare module "fastify" {
  interface FastifyRequest {
    workspaceId?: string;
  }
}

export function apiKeyAuth(app: FastifyInstance, databaseUrl: string): void {
  const cache = new Map<string, CachedKey>();

  app.addHook("onRequest", async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.url === "/healthz" || req.method === "OPTIONS") return;

    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "missing_bearer_token" });
    }
    const raw = header.slice("Bearer ".length).trim();
    if (!raw.startsWith("dw_")) {
      return reply.code(401).send({ error: "invalid_api_key_format" });
    }

    const keyHash = hashApiKey(raw);
    const now = Date.now();
    const cached = cache.get(keyHash);

    if (cached && cached.expiresAt > now) {
      req.workspaceId = cached.workspaceId;
      return;
    }

    const rows = await query<{ workspace_id: string }>(
      databaseUrl,
      `SELECT k.workspace_id
       FROM api_keys k
       WHERE k.key_hash = $1 AND k.revoked_at IS NULL`,
      [keyHash]
    );

    if (rows.length === 0) {
      return reply.code(401).send({ error: "invalid_api_key" });
    }

    const workspaceId = rows[0]!.workspace_id;
    cache.set(keyHash, { workspaceId, expiresAt: now + CACHE_TTL_MS });
    req.workspaceId = workspaceId;
  });
}
