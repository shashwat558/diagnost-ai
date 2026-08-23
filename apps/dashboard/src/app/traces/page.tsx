import Link from "next/link";
import { chQuery } from "@/lib/ch";

export const dynamic = "force-dynamic";

interface ConvRow {
  conversation_id: string;
  events: string;
  errors: string;
  first_ts: string;
  last_ts: string;
  pii_findings: string;
}

export default async function ConversationsPage() {
  const convos = await chQuery<ConvRow>(`
    SELECT
      conversation_id,
      count() AS events,
      countIf(status = 'error') AS errors,
      min(timestamp) AS first_ts,
      max(timestamp) AS last_ts,
      sum(length(pii_redactions)) AS pii_findings
    FROM events
    GROUP BY conversation_id
    ORDER BY last_ts DESC
    LIMIT 50
  `);

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">Conversations</h1>
        <span className="text-xs text-slate-500">most recent 50</span>
      </header>

      <div className="overflow-hidden rounded-lg border border-edge bg-panel/70">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="px-4 py-2">Conversation</th>
              <th className="px-4 py-2">Events</th>
              <th className="px-4 py-2">Errors</th>
              <th className="px-4 py-2">PII findings</th>
              <th className="px-4 py-2">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {convos.map((c) => (
              <tr key={c.conversation_id} className="border-t border-edge/60 hover:bg-edge/30">
                <td className="px-4 py-2">
                  <Link href={`/traces/${encodeURIComponent(c.conversation_id)}`} className="font-mono text-xs text-accent hover:underline">
                    {c.conversation_id}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-300">{Number(c.events)}</td>
                <td className={`px-4 py-2 ${Number(c.errors) > 0 ? "text-red-400" : "text-slate-500"}`}>{c.errors}</td>
                <td className="px-4 py-2 text-slate-300">{Number(c.pii_findings)}</td>
                <td className="px-4 py-2 text-xs text-slate-400">{String(c.last_ts).replace("T", " ").slice(0, 19)}</td>
              </tr>
            ))}
            {convos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No conversations yet — run <code className="text-accent">tools/demo/src/sample-agent.mjs</code>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
