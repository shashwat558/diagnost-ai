/**
 * Governance: audit trail + role-based access.
 *
 * Roles: owner > admin > member > viewer.
 *  - viewer  : read-only dashboards
 *  - member  : ingest events (API keys scoped at workspace level)
 *  - admin   : manage API keys, notification channels, artifacts
 *  - owner   : billing/plan changes, workspace deletion
 */

import { randomUUID } from "node:crypto";
import { currentPeriod } from "./billing.js";
import { query } from "./postgres.js";

export type Role = "owner" | "admin" | "member" | "viewer";

const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

export function hasAtLeast(role: string | null | undefined, min: Role): boolean {
  const r = ROLE_RANK[(role ?? "viewer") as Role];
  return (r ?? 0) >= ROLE_RANK[min];
}

export interface AuditEntry {
  workspaceId: string | null;
  actor: string;
  action: string;
  target?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}

export async function recordAudit(databaseUrl: string, entry: AuditEntry): Promise<void> {
  await query(
    databaseUrl,
    `
    INSERT INTO audit_logs (id, workspace_id, actor, action, target, metadata, ip)
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    `,
    [
      randomUUID(),
      entry.workspaceId,
      entry.actor,
      entry.action,
      entry.target ?? "",
      JSON.stringify(entry.metadata ?? {}),
      entry.ip ?? "",
    ]
  );
}

export async function getMonthlyUsage(databaseUrl: string, workspaceId: string): Promise<number> {
  const rows = await query<{ events: string }>(
    databaseUrl,
    "SELECT events FROM usage_monthly WHERE workspace_id = $1 AND period = $2",
    [workspaceId, currentPeriod()]
  );
  return Number(rows[0]?.events ?? 0);
}

export async function incrementUsage(
  databaseUrl: string,
  workspaceId: string,
  count: number
): Promise<void> {
  await query(
    databaseUrl,
    `
    INSERT INTO usage_monthly (workspace_id, period, events, updated_at)
    VALUES ($1, $2, $3, now())
    ON CONFLICT (workspace_id, period)
    DO UPDATE SET events = usage_monthly.events + $3, updated_at = now()
    `,
    [workspaceId, currentPeriod(), count]
  );
}
