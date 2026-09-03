import type { ClickHouseClient } from "@clickhouse/client";
import { planFor } from "./billing.js";
import { query } from "./postgres.js";

/**
 * Retention enforcement: per-workspace TTL based on plan.retentionDays.
 * Deletes ClickHouse events older than cutoff and purges expired sessions.
 * S3 transcripts are lifecycle-managed via bucket TTL (see infra) — this
 * job handles the queryable stores.
 */

export interface RetentionResult {
  workspaceId: string;
  plan: string;
  retentionDays: number;
  cutoff: string; // ISO
  deletedSessions: number;
  chMutationId?: string;
}

function chTimestamp(d: Date): string {
  // ClickHouse DateTime64(3) expects "YYYY-MM-DD HH:MM:SS.mmm"
  return d.toISOString().replace("T", " ").replace("Z", "");
}

export async function enforceRetention(opts: {
  databaseUrl: string;
  clickhouse: ClickHouseClient;
  clickhouseDb: string;
  dryRun?: boolean;
}): Promise<RetentionResult[]> {
  const workspaces = await query<{ id: string; plan: string }>(
    opts.databaseUrl,
    "SELECT id, plan FROM workspaces"
  );

  const results: RetentionResult[] = [];
  const now = Date.now();

  // global session purge (expired dashboard sessions)
  let deletedSessions = 0;
  try {
    if (opts.dryRun) {
      const r = await query<{ count: string }>(
        opts.databaseUrl,
        "SELECT count(*)::text AS count FROM sessions WHERE expires_at < now()"
      );
      deletedSessions = Number(r[0]?.count ?? 0);
    } else {
      const r = await query<{ count: string }>(
        opts.databaseUrl,
        "WITH deleted AS (DELETE FROM sessions WHERE expires_at < now() RETURNING id) SELECT count(*)::text AS count FROM deleted"
      );
      deletedSessions = Number(r[0]?.count ?? 0);
    }
  } catch {
    deletedSessions = 0;
  }

  for (const ws of workspaces) {
    const plan = planFor(ws.plan);
    // enterprise has effectively infinite retention
    if (plan.retentionDays >= Number.MAX_SAFE_INTEGER / 86400) {
      results.push({
        workspaceId: ws.id,
        plan: plan.id,
        retentionDays: plan.retentionDays,
        cutoff: "never",
        deletedSessions: 0,
      });
      continue;
    }

    const cutoff = new Date(now - plan.retentionDays * 86_400_000);
    const cutoffCh = chTimestamp(cutoff);
    const cutoffIso = cutoff.toISOString();

    if (opts.dryRun) {
      results.push({
        workspaceId: ws.id,
        plan: plan.id,
        retentionDays: plan.retentionDays,
        cutoff: cutoffIso,
        deletedSessions: 0,
      });
      continue;
    }

    // ClickHouse: async mutation per workspace
    try {
      await opts.clickhouse.command({
        query: `ALTER TABLE ${opts.clickhouseDb}.events DELETE WHERE workspace_id = {wsId:String} AND timestamp < {cutoff:DateTime64(3)}`,
        query_params: { wsId: ws.id, cutoff: cutoffCh },
      });
    } catch (err) {
      console.error(`[retention] CH delete failed for ${ws.id}:`, err);
    }

    // Postgres: audit_logs older than retention (keep at least 30d even for free)
    const auditCutoffDays = Math.max(plan.retentionDays, 30);
    const auditCutoff = new Date(now - auditCutoffDays * 86_400_000);
    try {
      await query(
        opts.databaseUrl,
        "DELETE FROM audit_logs WHERE workspace_id = $1 AND created_at < $2",
        [ws.id, auditCutoff.toISOString()]
      );
    } catch {
      // ignore if table missing
    }

    results.push({
      workspaceId: ws.id,
      plan: plan.id,
      retentionDays: plan.retentionDays,
      cutoff: cutoffIso,
      deletedSessions: 0,
    });
  }

  // attach global session count to first result for reporting
  if (results.length > 0) results[0]!.deletedSessions = deletedSessions;

  return results;
}
