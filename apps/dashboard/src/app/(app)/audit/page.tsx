import { pgQuery } from "@/lib/pg";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

interface AuditRow {
  id: string;
  actor: string;
  action: string;
  target: string;
  metadata: Record<string, unknown>;
  ip: string;
  created_at: string;
}

function metaSummary(m: Record<string, unknown>): string {
  const entries = Object.entries(m).slice(0, 3);
  return entries.map(([k, v]) => `${k}=${String(v)}`).join(" · ");
}

/** Plain-language sentence for each audit action, e.g. "Plan changed to Pro". */
function describeAction(action: string, metadata: Record<string, unknown>): string {
  const m = metadata ?? {};
  const str = (v: unknown) => String(v ?? "");
  switch (action) {
    case "plan.changed":
      return `Plan changed${m.to ? ` to ${str(m.to)}` : ""}${m.from ? ` (was ${str(m.from)})` : ""}`;
    case "ingest.quota_exceeded":
      return `Monthly event limit hit (${str(m.used) || "?"} of ${str(m.limit) || "?"} used)`;
    case "workspace.created":
      return "Workspace created";
    case "artifact.created":
      return `Instruction “${str(m.name) || "?"}” saved${m.version ? ` (${str(m.version)})` : ""}`;
    case "plan.on_hold":
      return "Subscription payment on hold — update payment method to avoid downgrade";
    default:
      return action.replace(/[_.]/g, " ");
  }
}

export default async function AuditPage() {
  const user = await requireAdmin();
  const rows = await pgQuery<AuditRow>(
    `SELECT id, actor, action, target, metadata, ip, created_at
     FROM audit_logs WHERE workspace_id=$1
     ORDER BY created_at DESC LIMIT 100`,
    [user.workspaceId]
  );

  return (
    <div className="px-6 pt-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[15px] font-semibold text-gray-900">Audit log</h1>
        <span className="text-[12px] text-gray-400">privileged actions, most recent 100</span>
      </div>

      <table className="mt-4 w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr className="text-left text-[12px] text-gray-500">
            <th className="border-b border-gray-200 py-2 pr-4 font-normal">What happened</th>
            <th className="border-b border-gray-200 py-2 pr-4 font-normal">Who</th>
            <th className="border-b border-gray-200 py-2 pr-4 font-normal">When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="border-b border-gray-100 py-2.5 pr-4">
                <span className={`rounded px-1.5 py-0.5 text-[12px] font-medium ${
                  r.action.includes("quota") || r.action.includes("on_hold")
                    ? "bg-red-50 text-red-600"
                    : "bg-gray-100 text-gray-700"
                }`}>
                  {describeAction(r.action, r.metadata ?? {})}
                </span>
                <details className="mt-0.5">
                  <summary className="cursor-pointer text-[11px] text-gray-400 hover:text-gray-600">
                    Technical details
                  </summary>
                  <span className="font-mono text-[11px] text-gray-500">{r.action}</span>
                  {r.target && <span className="font-mono text-[11px] text-gray-500"> · {r.target} </span>}
                  <span className="text-[11px] text-gray-500">{metaSummary(r.metadata ?? {})}</span>
                  {r.ip && <span className="font-mono text-[11px] text-gray-400"> · IP {r.ip}</span>}
                </details>
              </td>
              <td className="border-b border-gray-100 py-2.5 pr-4 text-[12px] text-gray-600">{r.actor}</td>
              <td className="border-b border-gray-100 py-2.5 text-gray-500">
                {String(r.created_at).replace("T", " ").slice(0, 19)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="py-10 text-center text-gray-400">
                No audit events yet — plan changes, quota hits and new instructions will appear here.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
