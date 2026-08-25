import { pgQuery } from "@/lib/pg";

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

export default async function AuditPage() {
  const rows = await pgQuery<AuditRow>(
    `SELECT id, actor, action, target, metadata, ip, created_at
     FROM audit_logs WHERE workspace_id='ws_dev'
     ORDER BY created_at DESC LIMIT 100`
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
            <th className="border-b border-gray-200 py-2 pr-4 font-normal">Action</th>
            <th className="border-b border-gray-200 py-2 pr-4 font-normal">Actor</th>
            <th className="border-b border-gray-200 py-2 pr-4 font-normal">Details</th>
            <th className="border-b border-gray-200 py-2 pr-4 font-normal">IP</th>
            <th className="border-b border-gray-200 py-2 font-normal">When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="border-b border-gray-100 py-2.5 pr-4">
                <span className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${
                  r.action.includes("quota") ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-700"
                }`}>
                  {r.action}
                </span>
              </td>
              <td className="border-b border-gray-100 py-2.5 pr-4 font-mono text-[12px] text-gray-600">{r.actor}</td>
              <td className="border-b border-gray-100 py-2.5 pr-4 text-gray-600">
                {r.target && <span className="font-mono text-[11px]">{r.target} </span>}
                <span className="text-gray-500">{metaSummary(r.metadata ?? {})}</span>
              </td>
              <td className="border-b border-gray-100 py-2.5 pr-4 font-mono text-[11px] text-gray-400">{r.ip || "—"}</td>
              <td className="border-b border-gray-100 py-2.5 text-gray-500">
                {String(r.created_at).replace("T", " ").slice(0, 19)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-10 text-center text-gray-400">
                No audit events yet — privileged actions will appear here.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
